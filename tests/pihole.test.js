// tests/pihole.test.js
// Unit tests for providers/pihole.js
// Run with: node --test tests/pihole.test.js

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { makeFetchSequence, makeResponse, makeMockStorage } = require("./helpers");

// ── Module setup ──────────────────────────────────────────────────────────────
// pihole.js is an IIFE that registers on window.NDMProviders
globalThis.window = { NDMProviders: {} };
require("../providers/pihole.js");
const pihole = globalThis.window.NDMProviders.pihole;

const BASE = "http://pi.hole";
const TOKEN = "test-token-abc";
const creds = { piholeUrl: BASE, piholeToken: TOKEN };

beforeEach(() => {
  pihole.clearSession();
  globalThis.fetch = async () => { throw new Error("fetch not set up for this test"); };
});

// ── hasCredentials ────────────────────────────────────────────────────────────
describe("hasCredentials", () => {
  test("true when both URL and token present", () =>
    assert.equal(pihole.hasCredentials({ piholeUrl: BASE, piholeToken: TOKEN }), true));

  test("false when URL missing", () =>
    assert.equal(pihole.hasCredentials({ piholeToken: TOKEN }), false));

  test("false when token missing", () =>
    assert.equal(pihole.hasCredentials({ piholeUrl: BASE }), false));

  test("false when both missing", () =>
    assert.equal(pihole.hasCredentials({}), false));

  test("false when both empty strings", () =>
    assert.equal(pihole.hasCredentials({ piholeUrl: "", piholeToken: "" }), false));
});

// ── detectVersion ─────────────────────────────────────────────────────────────
describe("detectVersion", () => {
  test("returns 6 when /api/auth returns 200", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    assert.equal(await pihole.detectVersion(BASE), 6);
  });

  test("returns 6 when /api/auth returns 401", async () => {
    globalThis.fetch = makeFetchSequence({ status: 401, body: {} });
    assert.equal(await pihole.detectVersion(BASE), 6);
  });

  test("returns 5 when /api/auth returns 404", async () => {
    globalThis.fetch = makeFetchSequence({ status: 404, body: {} });
    assert.equal(await pihole.detectVersion(BASE), 5);
  });

  test("returns 5 when fetch throws (unreachable)", async () => {
    globalThis.fetch = makeFetchSequence({ throws: "NetworkError" });
    assert.equal(await pihole.detectVersion(BASE), 5);
  });
});

// ── detectUsage ───────────────────────────────────────────────────────────────
describe("detectUsage", () => {
  test("active: true when fetch succeeds", async () => {
    globalThis.fetch = async () => makeResponse(200, {});
    const result = await pihole.detectUsage();
    assert.equal(result.active, true);
  });

  test("active: false when fetch throws (ENOTFOUND)", async () => {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const result = await pihole.detectUsage();
    assert.equal(result.active, false);
  });
});

// ── getV6Session — caching ────────────────────────────────────────────────────
describe("getV6Session — session caching", () => {
  test("unauthenticated: calls POST /api/auth and returns sid", async () => {
    // testConnection calls detectVersion (1 fetch) then authenticates (1 fetch)
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },                          // detectVersion → v6
      { status: 200, body: { session: { sid: "sid-abc" } } }, // auth
    );
    const session = await pihole.testConnection(creds);
    assert.equal(session.ok, true);
  });

  test("cache hit: second call reuses sid without re-authenticating", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, { session: { sid: "cached-sid" } });
    };
    // First call: version detect + auth = 2 fetches
    await pihole.testConnection(creds);
    const countAfterFirst = fetchCount;

    // Second call: testConnection always re-auths (clears cache), but v6Allowlist reuses it
    // Test cache reuse via allowlistDomain with piholeVersion: 6 (skips version detect)
    pihole.clearSession();
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, { session: { sid: "cached-sid" } });
    };
    fetchCount = 0;
    // First allowlist: auth + add = 2 fetches
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "example.com");
    assert.equal(fetchCount, 2);

    // Second allowlist without clearing: only add = 1 fetch (cache hit)
    fetchCount = 0;
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "other.com");
    assert.equal(fetchCount, 1);
  });

  test("clearSession invalidates cache so next call re-authenticates", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, { session: { sid: "sid" } });
    };
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "a.com"); // auth + add = 2
    fetchCount = 0;
    pihole.clearSession();
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "b.com"); // auth + add = 2
    assert.equal(fetchCount, 2);
  });

  test("cache expires after TTL (4 minutes)", async () => {
    const origNow = Date.now;
    let fakeNow = origNow();
    Date.now = () => fakeNow;

    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, { session: { sid: "expiring-sid" } });
    };

    // Populate cache
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "a.com");
    fetchCount = 0;

    // Advance past 4-minute TTL
    fakeNow += 4 * 60 * 1000 + 1000;

    // Next call should re-auth
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "b.com");
    assert.equal(fetchCount, 2); // auth + add

    Date.now = origNow;
    pihole.clearSession();
  });
});

// ── authenticateV6 (via testConnection) ──────────────────────────────────────
describe("authenticateV6", () => {
  test("returns error on 401", async () => {
    // detectVersion returns 6 (status 200 or 401), then auth returns 401
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },   // detectVersion
      { status: 401, body: {} },   // auth
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
    assert.equal(result.error, "Invalid API token");
  });

  test("returns error on non-401 HTTP failure", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },   // detectVersion
      { status: 503, body: {} },   // auth
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
    assert.match(result.error, /503/);
  });

  test("returns error when session.sid missing from response", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },          // detectVersion
      { status: 200, body: { session: {} } }, // auth — no sid
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
    assert.match(result.error, /session token/i);
  });

  test("TimeoutError → human-readable message", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },
      { throws: "The operation timed out", errorName: "TimeoutError" },
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
    assert.match(result.error, /unreachable/i);
  });
});

// ── normalizeUrl (tested via allowlistDomain) ─────────────────────────────────
describe("normalizeUrl — URL normalization", () => {
  test("strips trailing slash before building fetch URL", async () => {
    const captured = [];
    globalThis.fetch = async (url) => {
      captured.push(url);
      return makeResponse(200, { session: { sid: "s" } });
    };
    // With trailing slash
    await pihole.allowlistDomain({ piholeUrl: `${BASE}/`, piholeToken: TOKEN, piholeVersion: 5 }, "x.com");
    assert.ok(captured[0].startsWith(`${BASE}/`), `URL should start with ${BASE}/`);
    assert.ok(!captured[0].startsWith(`${BASE}//`), "Should not have double slash");
  });

  test("strips multiple trailing slashes", async () => {
    const captured = [];
    globalThis.fetch = async (url) => { captured.push(url); return makeResponse(200, { success: true }); };
    await pihole.allowlistDomain({ piholeUrl: `${BASE}///`, piholeToken: TOKEN, piholeVersion: 5 }, "x.com");
    assert.ok(!captured[0].includes("///"));
  });
});

// ── v5Allowlist ───────────────────────────────────────────────────────────────
describe("v5Allowlist", () => {
  const v5creds = { ...creds, piholeVersion: 5 };

  test("happy path: success: true", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { success: true } });
    const result = await pihole.allowlistDomain(v5creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("API-level error with message", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { success: false, message: "Already exists" } });
    const result = await pihole.allowlistDomain(v5creds, "example.com");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Already exists");
  });

  test("success: false without message returns fallback error", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { success: false } });
    const result = await pihole.allowlistDomain(v5creds, "example.com");
    assert.equal(result.ok, false);
    assert.ok(result.error.length > 0);
  });

  test("HTTP error returns HTTP status", async () => {
    globalThis.fetch = makeFetchSequence({ status: 503, body: {} });
    const result = await pihole.allowlistDomain(v5creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /503/);
  });

  test("TimeoutError returns human-readable message", async () => {
    globalThis.fetch = makeFetchSequence({ throws: "timed out", errorName: "TimeoutError" });
    const result = await pihole.allowlistDomain(v5creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /unreachable/i);
  });

  test("missing credentials returns error without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await pihole.allowlistDomain({ piholeUrl: "", piholeToken: TOKEN, piholeVersion: 5 }, "x.com");
    assert.equal(result.ok, false);
    assert.equal(fetched, false);
  });

  test("domain is URL-encoded in query string", async () => {
    const captured = [];
    globalThis.fetch = async (url) => { captured.push(url); return makeResponse(200, { success: true }); };
    await pihole.allowlistDomain(v5creds, "sub.example.com");
    assert.ok(captured[0].includes("sub.example.com"));
  });
});

// ── v6Allowlist ───────────────────────────────────────────────────────────────
describe("v6Allowlist", () => {
  const v6creds = { ...creds, piholeVersion: 6 };

  test("happy path: auth then add succeeds", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s1" } } },
      { status: 200, body: {} },
    );
    const result = await pihole.allowlistDomain(v6creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("add returns 401 → re-auth and retry succeeds", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s1" } } }, // auth
      { status: 401, body: {} },                          // add → expired
      { status: 200, body: { session: { sid: "s2" } } }, // re-auth
      { status: 200, body: {} },                          // retry add
    );
    const result = await pihole.allowlistDomain(v6creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("add returns 401 and re-auth also fails → returns error", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s1" } } }, // auth
      { status: 401, body: {} },                          // add → expired
      { status: 401, body: {} },                          // re-auth fails
    );
    const result = await pihole.allowlistDomain(v6creds, "example.com");
    assert.equal(result.ok, false);
  });

  test("initial auth fails → returns error without attempting add", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 401, body: {} }, // auth fails
    );
    const result = await pihole.allowlistDomain(v6creds, "example.com");
    assert.equal(result.ok, false);
  });

  test("add HTTP 403 returns error", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 403, body: {} },
    );
    const result = await pihole.allowlistDomain(v6creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /403/);
  });

  test("request body includes comment field", async () => {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      if (opts?.body) bodies.push(JSON.parse(opts.body));
      return makeResponse(200, { session: { sid: "s" } });
    };
    await pihole.allowlistDomain(v6creds, "example.com");
    const addBody = bodies.find(b => b.comment !== undefined);
    assert.ok(addBody, "Expected a request body with comment field");
    assert.equal(addBody.comment, "Added by DNS Medic");
  });
});

// ── testConnection ────────────────────────────────────────────────────────────
describe("testConnection", () => {
  test("v5 happy path", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 404, body: {} },                                         // detectVersion → 5
      { status: 200, body: { domains_being_blocked: 12345 } },          // summary
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, true);
    assert.equal(result.version, 5);
  });

  test("v5 invalid token (no domains_being_blocked in response)", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 404, body: {} }, // detectVersion → 5
      { status: 200, body: {} }, // summary — no domains_being_blocked
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
    assert.match(result.error, /invalid token/i);
  });

  test("v6 happy path", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },                          // detectVersion → 6
      { status: 200, body: { session: { sid: "abc" } } }, // auth
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, true);
    assert.equal(result.version, 6);
  });

  test("v6 bad token", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} }, // detectVersion → 6
      { status: 401, body: {} }, // auth fails
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, false);
  });

  test("missing URL returns error without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await pihole.testConnection({ piholeUrl: "", piholeToken: TOKEN });
    assert.equal(result.ok, false);
    assert.equal(fetched, false);
  });

  test("testConnection always clears session before v6 auth", async () => {
    // Populate cache first
    globalThis.fetch = async () => makeResponse(200, { session: { sid: "old-sid" } });
    await pihole.allowlistDomain({ ...creds, piholeVersion: 6 }, "a.com");

    // testConnection should re-auth regardless of cache
    let authCalls = 0;
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },                          // detectVersion → 6
      { status: 200, body: { session: { sid: "new" } } }, // fresh auth (not cached)
    );
    const result = await pihole.testConnection(creds);
    assert.equal(result.ok, true);
  });
});

// ── v5/v6 GetBlocking ─────────────────────────────────────────────────────────
describe("getBlocking", () => {
  test("v5: returns blocking: true when status is 'enabled'", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "enabled" } });
    const result = await pihole.v5GetBlocking(creds);
    assert.equal(result.ok, true);
    assert.equal(result.blocking, true);
  });

  test("v5: returns blocking: false when status is 'disabled'", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "disabled" } });
    const result = await pihole.v5GetBlocking(creds);
    assert.equal(result.ok, true);
    assert.equal(result.blocking, false);
  });

  test("v5: unexpected status returns error", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "unknown" } });
    const result = await pihole.v5GetBlocking(creds);
    assert.equal(result.ok, false);
  });

  test("v6: normalizes string 'enabled' to boolean true", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "enabled" } },
    );
    const result = await pihole.v6GetBlocking(creds);
    assert.equal(result.ok, true);
    assert.equal(result.blocking, true);
  });

  test("v6: normalizes string 'disabled' to boolean false", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "disabled" } },
    );
    const result = await pihole.v6GetBlocking(creds);
    assert.equal(result.blocking, false);
  });

  test("v6: includes timer when present and > 0", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "disabled", timer: 300 } },
    );
    const result = await pihole.v6GetBlocking(creds);
    assert.equal(result.timer, 300);
  });

  test("v6: omits timer when 0", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "disabled", timer: 0 } },
    );
    const result = await pihole.v6GetBlocking(creds);
    assert.equal("timer" in result, false);
  });

  test("getBlocking dispatches to v6 when piholeVersion: 6", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "enabled" } },
    );
    const result = await pihole.getBlocking({ ...creds, piholeVersion: 6 });
    assert.equal(result.ok, true);
    assert.equal(result.blocking, true);
  });

  test("getBlocking dispatches to v5 when piholeVersion: 5", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "enabled" } });
    const result = await pihole.getBlocking({ ...creds, piholeVersion: 5 });
    assert.equal(result.ok, true);
    assert.equal(result.blocking, true);
  });
});

// ── v5/v6 DisableBlocking ─────────────────────────────────────────────────────
describe("disableBlocking", () => {
  test("v5: returns ok and status on success", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "disabled" } });
    const result = await pihole.v5DisableBlocking(creds, undefined);
    assert.equal(result.ok, true);
    assert.equal(result.status, "disabled");
  });

  test("v5: includes &time= when timer provided", async () => {
    const captured = [];
    globalThis.fetch = async (url) => { captured.push(url); return makeResponse(200, { status: "disabled" }); };
    await pihole.v5DisableBlocking(creds, 300);
    assert.ok(captured[0].includes("time=300"));
  });

  test("v5: omits &time= when timer is 0", async () => {
    const captured = [];
    globalThis.fetch = async (url) => { captured.push(url); return makeResponse(200, { status: "disabled" }); };
    await pihole.v5DisableBlocking(creds, 0);
    assert.ok(!captured[0].includes("time="));
  });

  test("v6: happy path — blocking: false", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { blocking: "disabled" } },
    );
    const result = await pihole.v6DisableBlocking(creds, undefined);
    assert.equal(result.ok, true);
    assert.equal(result.blocking, false);
  });

  test("v6: passes timer in body when provided", async () => {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      if (opts?.body) bodies.push(JSON.parse(opts.body));
      return makeResponse(200, { session: { sid: "s" } });
    };
    await pihole.v6DisableBlocking(creds, 60);
    const disableBody = bodies.find(b => b.timer !== undefined);
    assert.ok(disableBody, "Expected body with timer");
    assert.equal(disableBody.timer, 60);
  });

  test("v6: session expired → retry succeeds", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s1" } } }, // auth
      { status: 401, body: {} },                          // disable → 401
      { status: 200, body: { session: { sid: "s2" } } }, // re-auth
      { status: 200, body: { blocking: "disabled" } },    // retry
    );
    const result = await pihole.v6DisableBlocking(creds);
    assert.equal(result.ok, true);
  });
});

// ── v5/v6 EnableBlocking ──────────────────────────────────────────────────────
describe("enableBlocking", () => {
  test("v5: returns ok on status 'enabled'", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "enabled" } });
    const result = await pihole.v5EnableBlocking(creds);
    assert.equal(result.ok, true);
  });

  test("v5: returns error on unexpected status", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { status: "disabled" } });
    const result = await pihole.v5EnableBlocking(creds);
    assert.equal(result.ok, false);
  });

  test("v6: happy path sends blocking: true", async () => {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      if (opts?.body) bodies.push(JSON.parse(opts.body));
      return makeResponse(200, { session: { sid: "s" } });
    };
    await pihole.v6EnableBlocking(creds);
    const enableBody = bodies.find(b => b.blocking === true);
    assert.ok(enableBody, "Expected body with blocking: true");
  });

  test("v6: session expired → retry succeeds", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s1" } } },
      { status: 401, body: {} },
      { status: 200, body: { session: { sid: "s2" } } },
      { status: 200, body: {} },
    );
    const result = await pihole.v6EnableBlocking(creds);
    assert.equal(result.ok, true);
  });

  test("enableBlocking dispatches to v6 when piholeVersion: 6", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: {} },
    );
    const result = await pihole.enableBlocking({ ...creds, piholeVersion: 6 });
    assert.equal(result.ok, true);
  });
});

// ── fetchBlocklistReasons ─────────────────────────────────────────────────────
describe("fetchBlocklistReasons", () => {
  test("happy path: domain matched in gravity hits", async () => {
    // Use a URL that maps to an unambiguous key in LIST_NAMES.
    // "dbl.oisd.nl/basic" would first match the shorter "dbl.oisd.nl" key (OISD Full)
    // because prettyListName uses String.includes(). Steven Black has a unique path.
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      {
        status: 200,
        body: {
          search: {
            gravity: [{
              id: 1,
              address: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
            }],
          },
        },
      },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.ok(result["ads.example.com"]);
    assert.equal(result["ads.example.com"][0].name, "Steven Black Unified");
    assert.equal(result["ads.example.com"][0].id, "1");
  });

  test("hit.id coerced to string", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { search: { gravity: [{ id: 42, address: "https://dbl.oisd.nl" }] } } },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].id, "42");
  });

  test("missing hit.id defaults to empty string", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { search: { gravity: [{ address: "https://dbl.oisd.nl" }] } } },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].id, "");
  });

  test("deduplication: same address appears only once", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      {
        status: 200,
        body: {
          search: {
            gravity: [
              { id: 1, address: "https://dbl.oisd.nl" },
              { id: 2, address: "https://dbl.oisd.nl" }, // duplicate address
            ],
          },
        },
      },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"].length, 1);
  });

  test("domain not in gravity hits returns empty result", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { search: { gravity: [] } } },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"], undefined);
  });

  test("empty domains array returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await pihole.fetchBlocklistReasons(creds, []);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("missing credentials returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await pihole.fetchBlocklistReasons({ piholeUrl: "", piholeToken: "" }, ["x.com"]);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("HTTP error on search skips domain and returns {}", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 404, body: {} }, // search fails
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.deepEqual(result, {});
  });

  test("sequential fetch: N domains = 1 auth + N search calls", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      if (fetchCount === 1) return makeResponse(200, { session: { sid: "s" } });
      return makeResponse(200, { search: { gravity: [] } });
    };
    await pihole.fetchBlocklistReasons(creds, ["a.com", "b.com", "c.com"]);
    assert.equal(fetchCount, 4); // 1 auth + 3 searches
  });

  test("session expired mid-loop → re-auth and retry", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      if (fetchCount === 1) return makeResponse(200, { session: { sid: "s1" } }); // auth
      if (fetchCount === 2) return makeResponse(401, {}); // first search → 401
      if (fetchCount === 3) return makeResponse(200, { session: { sid: "s2" } }); // re-auth
      return makeResponse(200, { search: { gravity: [{ id: 1, address: "https://dbl.oisd.nl" }] } });
    };
    const result = await pihole.fetchBlocklistReasons(creds, ["a.com", "b.com"]);
    // After re-auth, both domains should be searched again
    assert.ok(fetchCount >= 4);
  });

  test("prettyListName: Steven Black URL returns correct name", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      {
        status: 200,
        body: {
          search: {
            gravity: [{
              id: 1,
              address: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
            }],
          },
        },
      },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "Steven Black Unified");
  });

  test("prettyListName: unknown URL falls back to hostname", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      {
        status: 200,
        body: { search: { gravity: [{ id: 1, address: "https://custom-list.example.com/hosts.txt" }] } },
      },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "custom-list.example.com");
  });

  test("prettyListName: null address returns 'Pi-hole blocklist'", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: { session: { sid: "s" } } },
      { status: 200, body: { search: { gravity: [{ id: 1, address: null }] } } },
    );
    const result = await pihole.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "Pi-hole blocklist");
  });
});

// ── validateCredentials ───────────────────────────────────────────────────────
describe("validateCredentials", () => {
  test("returns true when testConnection succeeds", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} },                          // detectVersion → 6
      { status: 200, body: { session: { sid: "s" } } },  // auth
    );
    const result = await pihole.validateCredentials(creds);
    assert.equal(result, true);
  });

  test("returns false when testConnection fails", async () => {
    globalThis.fetch = makeFetchSequence(
      { status: 200, body: {} }, // detectVersion → 6
      { status: 401, body: {} }, // auth fails
    );
    const result = await pihole.validateCredentials(creds);
    assert.equal(result, false);
  });
});
