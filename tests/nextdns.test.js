// tests/nextdns.test.js
// Unit tests for providers/nextdns.js
// Run with: node --test tests/nextdns.test.js

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { makeFetchSequence, makeResponse } = require("./helpers");

// ── Module setup ──────────────────────────────────────────────────────────────
globalThis.window = { NDMProviders: {} };
require("../providers/nextdns.js");
const nextdns = globalThis.window.NDMProviders.nextdns;

const API_KEY = "test-api-key-123";
const PROFILE = "abc123";
const creds = { apiKey: API_KEY, profileId: PROFILE };

beforeEach(() => {
  globalThis.fetch = async () => { throw new Error("fetch not set up for this test"); };
});

// ── hasCredentials ────────────────────────────────────────────────────────────
describe("hasCredentials", () => {
  test("true when both apiKey and profileId present", () =>
    assert.equal(nextdns.hasCredentials({ apiKey: API_KEY, profileId: PROFILE }), true));

  test("false when apiKey missing", () =>
    assert.equal(nextdns.hasCredentials({ profileId: PROFILE }), false));

  test("false when profileId missing", () =>
    assert.equal(nextdns.hasCredentials({ apiKey: API_KEY }), false));

  test("false when both missing", () =>
    assert.equal(nextdns.hasCredentials({}), false));

  test("false when both empty strings", () =>
    assert.equal(nextdns.hasCredentials({ apiKey: "", profileId: "" }), false));
});

// ── fetchBlocklistReasons ─────────────────────────────────────────────────────
describe("fetchBlocklistReasons", () => {
  test("happy path: domain found with reasons", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        data: [{ domain: "ads.example.com", reasons: [{ id: "r1", name: "EasyList" }] }],
        meta: { cursor: null },
      },
    });
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.deepEqual(result["ads.example.com"], [{ id: "r1", name: "EasyList" }]);
  });

  test("domain not in log returns empty result", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        data: [{ domain: "other.com", reasons: [{ id: "x", name: "X" }] }],
        meta: {},
      },
    });
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(result["ads.example.com"], undefined);
  });

  test("missing reasons field: domain not added to result", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {
        data: [{ domain: "ads.example.com" }], // no reasons
        meta: {},
      },
    });
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(result["ads.example.com"], undefined);
  });

  test("empty reasons array: domain not added", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { data: [{ domain: "ads.example.com", reasons: [] }], meta: {} },
    });
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(result["ads.example.com"], undefined);
  });

  test("multi-page: cursor present then null", async () => {
    globalThis.fetch = makeFetchSequence(
      {
        status: 200,
        body: {
          data: [{ domain: "other.com", reasons: [{ id: "x", name: "X" }] }],
          meta: { cursor: "next-page-cursor" },
        },
      },
      {
        status: 200,
        body: {
          data: [{ domain: "ads.example.com", reasons: [{ id: "r1", name: "EasyList" }] }],
          meta: { cursor: null },
        },
      },
    );
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.ok(result["ads.example.com"]);
  });

  test("loop exits when domainSet is empty (all domains found early)", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, {
        data: [{ domain: "ads.example.com", reasons: [{ id: "r1", name: "X" }] }],
        meta: { cursor: "has-more" }, // cursor present but domainSet will be empty
      });
    };
    await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(fetchCount, 1); // stops after finding the only domain
  });

  test("loop exits when data is empty even if cursor present", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return makeResponse(200, {
        data: [],
        meta: { cursor: "cursor" },
      });
    };
    await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.equal(fetchCount, 1);
  });

  test("HTTP error breaks loop and returns {}", async () => {
    globalThis.fetch = makeFetchSequence({ status: 401, body: {} });
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.deepEqual(result, {});
  });

  test("fetch throws → returns {}", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await nextdns.fetchBlocklistReasons(creds, ["ads.example.com"]);
    assert.deepEqual(result, {});
  });

  test("empty domains array → returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await nextdns.fetchBlocklistReasons(creds, []);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("missing credentials → returns {} without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await nextdns.fetchBlocklistReasons({ apiKey: "" , profileId: PROFILE }, ["x.com"]);
    assert.deepEqual(result, {});
    assert.equal(fetched, false);
  });

  test("fetched counter stops loop at 1000 entries", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      // Return 1000 entries each time with a cursor — loop should stop after 1 page
      return makeResponse(200, {
        data: Array.from({ length: 1000 }, (_, i) => ({ domain: `entry${i}.com`, reasons: [{ id: "x", name: "X" }] })),
        meta: { cursor: "more" },
      });
    };
    await nextdns.fetchBlocklistReasons(creds, ["notfound.com"]);
    assert.equal(fetchCount, 1); // fetched = 1000 → loop exits even though cursor present
  });

  test("request includes X-Api-Key header", async () => {
    const headers = [];
    globalThis.fetch = async (url, opts) => {
      if (opts?.headers) headers.push(opts.headers);
      return makeResponse(200, { data: [], meta: {} });
    };
    await nextdns.fetchBlocklistReasons(creds, ["x.com"]);
    assert.ok(headers.some(h => h["X-Api-Key"] === API_KEY));
  });
});

// ── allowlistDomain ───────────────────────────────────────────────────────────
describe("allowlistDomain", () => {
  test("HTTP 200 → ok: true", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    const result = await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 201 → ok: true (created)", async () => {
    globalThis.fetch = makeFetchSequence({ status: 201, body: {} });
    const result = await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 204 → ok: true (no content)", async () => {
    globalThis.fetch = makeFetchSequence({ status: 204, body: {} });
    const result = await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, true);
  });

  test("HTTP 409 → ok: false with error", async () => {
    globalThis.fetch = makeFetchSequence({ status: 409, body: {} });
    const result = await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.match(result.error, /409/);
  });

  test("fetch throws → ok: false with error message", async () => {
    globalThis.fetch = async () => { throw new Error("Connection refused"); };
    const result = await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(result.ok, false);
    assert.equal(result.error, "Connection refused");
  });

  test("missing credentials → ok: false without fetching", async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return makeResponse(200, {}); };
    const result = await nextdns.allowlistDomain({ apiKey: "", profileId: PROFILE }, "example.com");
    assert.equal(result.ok, false);
    assert.equal(fetched, false);
  });

  test("request body is correct JSON", async () => {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return makeResponse(200, {});
    };
    await nextdns.allowlistDomain(creds, "example.com");
    assert.deepEqual(bodies[0], { id: "example.com", active: true });
  });

  test("request includes X-Api-Key and Content-Type headers", async () => {
    const capturedOpts = [];
    globalThis.fetch = async (url, opts) => { capturedOpts.push(opts); return makeResponse(200, {}); };
    await nextdns.allowlistDomain(creds, "example.com");
    assert.equal(capturedOpts[0].headers["X-Api-Key"], API_KEY);
    assert.equal(capturedOpts[0].headers["Content-Type"], "application/json");
  });
});

// ── validateCredentials ───────────────────────────────────────────────────────
describe("validateCredentials", () => {
  test("returns true when GET /profiles returns 200", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    const result = await nextdns.validateCredentials({ apiKey: API_KEY });
    assert.equal(result, true);
  });

  test("returns false when GET /profiles returns 401", async () => {
    globalThis.fetch = makeFetchSequence({ status: 401, body: {} });
    const result = await nextdns.validateCredentials({ apiKey: API_KEY });
    assert.equal(result, false);
  });

  test("returns null when fetch throws", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await nextdns.validateCredentials({ apiKey: API_KEY });
    assert.equal(result, null);
  });
});

// ── fetchProfiles ─────────────────────────────────────────────────────────────
describe("fetchProfiles", () => {
  test("happy path: returns profile array", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { data: [{ id: "p1", name: "Home" }, { id: "p2", name: "Work" }] },
    });
    const result = await nextdns.fetchProfiles({ apiKey: API_KEY });
    assert.deepEqual(result, [{ id: "p1", name: "Home" }, { id: "p2", name: "Work" }]);
  });

  test("data field missing → returns empty array", async () => {
    globalThis.fetch = makeFetchSequence({ status: 200, body: {} });
    const result = await nextdns.fetchProfiles({ apiKey: API_KEY });
    assert.deepEqual(result, []);
  });

  test("HTTP error → returns null", async () => {
    globalThis.fetch = makeFetchSequence({ status: 403, body: {} });
    const result = await nextdns.fetchProfiles({ apiKey: API_KEY });
    assert.equal(result, null);
  });

  test("fetch throws → returns null", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await nextdns.fetchProfiles({ apiKey: API_KEY });
    assert.equal(result, null);
  });
});

// ── detectDeviceFingerprint ───────────────────────────────────────────────────
describe("detectDeviceFingerprint", () => {
  test("happy path: returns fingerprint and deviceName", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { status: "ok", profile: "abc123", deviceName: "MacBook Pro" },
    });
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.fingerprint, "abc123");
    assert.equal(result.deviceName, "MacBook Pro");
    assert.equal(result.status, "ok");
  });

  test("unconfigured: returns null fingerprint and unconfigured status", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { status: "unconfigured", profile: null },
    });
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.fingerprint, null);
    assert.equal(result.status, "unconfigured");
  });

  test("deviceName falls back to clientName", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { status: "ok", profile: "p1", clientName: "iPhone" },
    });
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.deviceName, "iPhone");
  });

  test("profile present but no status → derives status as 'ok'", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: { profile: "p1" }, // no status field
    });
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.status, "ok");
  });

  test("no profile and no status → status is 'unconfigured'", async () => {
    globalThis.fetch = makeFetchSequence({
      status: 200,
      body: {},
    });
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.fingerprint, null);
    assert.equal(result.status, "unconfigured");
  });

  test("fetch throws → returns error status", async () => {
    globalThis.fetch = async () => { throw new Error("Network error"); };
    const result = await nextdns.detectDeviceFingerprint();
    assert.equal(result.fingerprint, null);
    assert.equal(result.deviceName, null);
    assert.equal(result.status, "error");
  });
});
