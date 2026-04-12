// tests/controld.test.js
// Unit tests for providers/controld.js
// Run with: node --test tests/controld.test.js

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { makeFetchSequence, makeResponse } = require("./helpers");

// ── Module setup ──────────────────────────────────────────────────────────────
globalThis.window = { NDMProviders: {} };
require("../providers/controld.js");
const controld = globalThis.window.NDMProviders.controld;

const TOKEN = "test-controld-token";
const PROFILE = "profile-xyz";
const creds = { controldToken: TOKEN, controldProfileId: PROFILE };

beforeEach(() => {
  globalThis.fetch = async () => { throw new Error("fetch not set up for this test"); };
});

// ── hasCredentials ────────────────────────────────────────────────────────────
describe("hasCredentials", () => {
  test("true when both token and profileId present", () =>
    assert.equal(controld.hasCredentials({ controldToken: TOKEN, controldProfileId: PROFILE }), true));

  test("false when token missing", () =>
    assert.equal(controld.hasCredentials({ controldProfileId: PROFILE }), false));

  test("false when profileId missing", () =>
    assert.equal(controld.hasCredentials({ controldToken: TOKEN }), false));

  test("false when both missing", () =>
    assert.equal(controld.hasCredentials({}), false));

  test("false when both empty strings", () =>
    assert.equal(controld.hasCredentials({ controldToken: "", controldProfileId: "" }), false));
});

// ── fetchBlocklistReasons ─────────────────────────────────────────────────────
describe("fetchBlocklistReasons", () => {
  test("happy path: domain matched via entry.domain", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        body: {
          queries: [{ domain: "ads.example.com", filter_name: "EasyList", list_id: 5 }],
        },
      },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.ok(result["ads.example.com"]);
    assert.equal(result["ads.example.com"][0].name, "EasyList");
    assert.equal(result["ads.example.com"][0].id, "5");
  });

  test("entry.name used when entry.domain absent", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        body: {
          queries: [{ name: "ads.example.com", filter_name: "EasyList", list_id: 1 }],
        },
      },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.ok(result["ads.example.com"]);
  });

  test("filter_name takes priority over list_name", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        body: {
          queries: [{ domain: "x.com", filter_name: "FilterA", list_name: "ListB", list_id: 1 }],
        },
      },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "FilterA");
  });

  test("falls back to list_name when filter_name absent", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        body: { queries: [{ domain: "x.com", list_name: "CustomList", list_id: 1 }] },
      },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "CustomList");
  });

  test("falls back to 'Control D blocklist' when both name fields absent", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { body: { queries: [{ domain: "x.com", list_id: 1 }] } },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].name, "Control D blocklist");
  });

  test("list_id coerced to string", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { body: { queries: [{ domain: "x.com", filter_name: "X", list_id: 42 }] } },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].id, "42");
  });

  test("missing list_id defaults to empty string", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { body: { queries: [{ domain: "x.com", filter_name: "X" }] } },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(result["x.com"][0].id, "");
  });

  test("domain not in query log returns empty result", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { body: { queries: [{ domain: "other.com", filter_name: "X", list_id: 1 }] } },
    });
    const result = await controld.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(result["ads.example.com"], undefined);
  });

  test("HTTP error → returns {}", async () => {
    globalThis.fetch = makeFetchSequence({ status: 403, body: {} });
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.deepEqual(result, {});
  });

  test("fetch throws → returns {}", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.deepEqual(result, {});
  });

  test("missing credentials → returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await controld.fetchBlocklistReasons({ controldToken: "", controldProfileId: "" }, ["x.com"]);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("empty domains array → returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await controld.fetchBlocklistReasons(creds, []);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("request uses Bearer auth header", async () => {
    const capturedHeaders = [];
    globalThis.fetch = async (url, opts) => {
      capturedHeaders.push(opts?.headers || {});
      return makeResponse(200, { body: { queries: [] } });
    };
    await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.equal(capturedHeaders[0]["Authorization"], `Bearer ${TOKEN}`);
  });

  test("request URL includes profile_id and status=blocked", async () => {
    const capturedUrls = [];
    globalThis.fetch = async (url) => {
      capturedUrls.push(url);
      return makeResponse(200, { body: { queries: [] } });
    };
    await controld.fetchBlocklistReasons(creds, ["x.com"]);
    assert.ok(capturedUrls[0].includes("status=blocked"));
    assert.ok(capturedUrls[0].includes(encodeURIComponent(PROFILE)));
  });
});

// ── allowlistDomain ───────────────────────────────────────────────────────────
describe("allowlistDomain", () => {
  test("HTTP 200 → ok: true", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 201 → ok: true", async () => {
    globalThis.fetch = makeFetchSequence({ status: 201, body: {} });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 204 → ok: true", async () => {
    globalThis.fetch = makeFetchSequence({ status: 204, body: {} });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 422 with error body → uses error message", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 422,
      body: { error: { message: "Invalid domain format" } },
    });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Invalid domain format");
  });

  test("HTTP error with no parseable body → falls back to HTTP status", async () => {
    globalThis.fetch = async (url, opts) => ({
      ok: false,
      status: 422,
      json: async () => { throw new Error("Invalid JSON"); },
    });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /422/);
  });

  test("TimeoutError → human-readable message", async () => {
    globalThis.fetch = makeFetchSequence({
      throws: "The operation timed out",
      errorName: "TimeoutError",
    });
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /unreachable/i);
  });

  test("generic fetch error → uses error message", async () => {
    globalThis.fetch = async () => { throw new Error("Connection reset"); };
    const result = await controld.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Connection reset");
  });

  test("missing credentials → ok: false without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await controld.allowlistDomain({ controldToken: "", controldProfileId: "" }, "example.com");
    assert.equal(result.ok, false);
    assert.equal(fetched, false);
  });

  test("request body is form-encoded with correct fields", async () => {
    const capturedBodies = [];
    globalThis.fetch = async (url, opts) => {
      capturedBodies.push(opts?.body);
      return makeResponse(200, {});
    };
    await controld.allowlistDomain(creds, "example.com");
    const body = capturedBodies[0];
    assert.ok(body.includes("do=1"));
    assert.ok(body.includes("status=1"));
    assert.ok(body.includes(encodeURIComponent("hostnames[]") + "=example.com") ||
              body.includes("hostnames%5B%5D=example.com"));
  });

  test("Content-Type is application/x-www-form-urlencoded", async () => {
    const capturedOpts = [];
    globalThis.fetch = async (url, opts) => { capturedOpts.push(opts); return makeResponse(200, {}); };
    await controld.allowlistDomain(creds, "example.com");
    assert.equal(capturedOpts[0].headers["Content-Type"], "application/x-www-form-urlencoded");
  });

  test("request uses Bearer auth header", async () => {
    const capturedOpts = [];
    globalThis.fetch = async (url, opts) => { capturedOpts.push(opts); return makeResponse(200, {}); };
    await controld.allowlistDomain(creds, "example.com");
    assert.equal(capturedOpts[0].headers["Authorization"], `Bearer ${TOKEN}`);
  });
});

// ── fetchProfiles ─────────────────────────────────────────────────────────────
describe("fetchProfiles", () => {
  test("happy path: maps PK to id", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        body: {
          profiles: [
            { PK: "p1", name: "Home" },
            { PK: "p2", name: "Work" },
          ],
        },
      },
    });
    const result = await controld.fetchProfiles({ controldToken: TOKEN });
    assert.deepEqual(result, [{ id: "p1", name: "Home" }, { id: "p2", name: "Work" }]);
  });

  test("profiles field missing → returns empty array", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: { body: {} } });
    const result = await controld.fetchProfiles({ controldToken: TOKEN });
    assert.deepEqual(result, []);
  });

  test("HTTP error → returns null", async () => {
    globalThis.fetch = makeFetchSequence({ status: 401, body: {} });
    const result = await controld.fetchProfiles({ controldToken: TOKEN });
    assert.equal(result, null);
  });

  test("fetch throws → returns null", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await controld.fetchProfiles({ controldToken: TOKEN });
    assert.equal(result, null);
  });

  test("empty token → returns null without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await controld.fetchProfiles({ controldToken: "" });
    assert.equal(result, null);
    assert.equal(fetched, false);
  });
});

// ── detectUsage ───────────────────────────────────────────────────────────────
describe("detectUsage", () => {
  test("active: true when fetch succeeds with data", async () => {
    globalThis.fetch = async () =>
      makeResponse(200, { profile: "abc123" });
    const result = await controld.detectUsage();
    assert.equal(result.active, true);
    assert.deepEqual(result.data, { profile: "abc123" });
  });

  test("active: false when fetch throws", async () => {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const result = await controld.detectUsage();
    assert.equal(result.active, false);
  });

  test("active: false when HTTP non-200", async () => {
    globalThis.fetch = async () => makeResponse(404, {});
    const result = await controld.detectUsage();
    assert.equal(result.active, false);
  });

  test("active: true with null data when JSON parse fails", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error("Invalid JSON"); },
    });
    const result = await controld.detectUsage();
    assert.equal(result.active, true);
    assert.equal(result.data, null);
  });

  test("URL contains random subdomain matching expected pattern", async () => {
    const capturedUrls = [];
    globalThis.fetch = async (url) => {
      capturedUrls.push(url);
      return makeResponse(200, {});
    };
    await controld.detectUsage();
    assert.match(capturedUrls[0], /https:\/\/[a-z0-9]+\.dns\.controld\.com\/detect/);
  });
});

// ── validateCredentials ───────────────────────────────────────────────────────
describe("validateCredentials", () => {
  test("returns true when /profiles returns 200", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    const result = await controld.validateCredentials({ controldToken: TOKEN });
    assert.equal(result, true);
  });

  test("returns false when /profiles returns 401", async () => {
    globalThis.fetch = makeFetchSequence({ status: 401, body: {} });
    const result = await controld.validateCredentials({ controldToken: TOKEN });
    assert.equal(result, false);
  });

  test("returns null when fetch throws", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await controld.validateCredentials({ controldToken: TOKEN });
    assert.equal(result, null);
  });

  test("empty token → returns false without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await controld.validateCredentials({ controldToken: "" });
    assert.equal(result, false);
    assert.equal(fetched, false);
  });
});
