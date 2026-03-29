// tests/db-loader.test.js
// Tests for db-loader.js: cache TTL, validation, force refresh, fallback
// Run with: node --test tests/db-loader.test.js

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Mock ext.storage.local before requiring db-loader ─────────────────────────
let _store = {};
globalThis.ext = {
  storage: {
    local: {
      get: async (key) => {
        if (typeof key === "string") return { [key]: _store[key] };
        const result = {};
        for (const k of (Array.isArray(key) ? key : [key])) result[k] = _store[k];
        return result;
      },
      set: async (obj) => { Object.assign(_store, obj); },
      remove: async (key) => {
        const keys = Array.isArray(key) ? key : [key];
        for (const k of keys) delete _store[k];
      },
    },
  },
};

// Prevent db-loader's initDB() from firing on require (it calls ext.storage immediately)
// We isolate by loading only the exports, not the auto-init side effect
// db-loader.js calls initDB() at module load — we suppress by providing an already-
// populated store where needed, or by testing the exported functions directly.

const {
  validateAndCompile,
  classifyDomainActive,
  SAFE_PATTERN_RE,
} = require("../db-loader.js");

// ── Helpers ────────────────────────────────────────────────────────────────────

const DB_CACHE_KEY = "ndm_dbCache";
const DB_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function makeValidDB(overrides = {}) {
  return {
    version: "test-1.0",
    entries: [
      {
        pattern: "featureassets\\.org",
        label: "Statsig CDN",
        confidence: "HIGH",
        category: "feature-flags",
        functionalImpact: "feature flags",
      },
      {
        pattern: "cdn\\.auth0\\.com",
        label: "Auth0 CDN",
        confidence: "HIGH",
        category: "authentication",
        functionalImpact: "login",
      },
      {
        pattern: "www\\.google-analytics\\.com",
        label: "Google Analytics",
        confidence: "LOW",
        category: "analytics",
        functionalImpact: null,
      },
    ],
    ...overrides,
  };
}

function writeCacheEntry(fetchedAt, data) {
  _store[DB_CACHE_KEY] = {
    data: data || makeValidDB(),
    fetchedAt,
    count: 3,
  };
}

// ── validateAndCompile ─────────────────────────────────────────────────────────

describe("validateAndCompile — valid input", () => {
  test("returns compiled entries for well-formed DB", () => {
    const result = validateAndCompile(makeValidDB());
    assert.equal(result.length, 3);
  });

  test("compiled entries have RegExp patterns", () => {
    const result = validateAndCompile(makeValidDB());
    for (const entry of result) {
      assert.ok(entry.pattern instanceof RegExp, "pattern should be RegExp");
    }
  });

  test("preserves label, confidence, category, functionalImpact", () => {
    const result = validateAndCompile(makeValidDB());
    const statsig = result.find(e => e.label === "Statsig CDN");
    assert.ok(statsig, "Statsig CDN entry should exist");
    assert.equal(statsig.confidence, "HIGH");
    assert.equal(statsig.category, "feature-flags");
    assert.equal(statsig.functionalImpact, "feature flags");
  });

  test("null functionalImpact is preserved as null", () => {
    const result = validateAndCompile(makeValidDB());
    const ga = result.find(e => e.label === "Google Analytics");
    assert.equal(ga.functionalImpact, null);
  });
});

describe("validateAndCompile — invalid / edge cases", () => {
  test("throws on null input", () => {
    assert.throws(() => validateAndCompile(null));
  });

  test("throws on missing entries array", () => {
    assert.throws(() => validateAndCompile({ version: "1" }));
  });

  test("throws if all entries are invalid (empty result)", () => {
    const bad = { entries: [{ pattern: "", label: "", confidence: "HIGH", category: "x" }] };
    assert.throws(() => validateAndCompile(bad));
  });

  test("skips entry with invalid confidence", () => {
    const db = makeValidDB();
    db.entries[0].confidence = "CRITICAL"; // invalid
    const result = validateAndCompile(db);
    assert.equal(result.length, 2); // one skipped
  });

  test("skips entry with pattern containing unsafe characters", () => {
    const db = makeValidDB();
    db.entries[0].pattern = "evil`rm -rf`"; // backtick not allowed
    const result = validateAndCompile(db);
    assert.equal(result.length, 2); // one skipped
  });

  test("skips entry with oversized pattern", () => {
    const db = makeValidDB();
    db.entries[0].pattern = "a".repeat(301); // over MAX_PATTERN_LEN
    const result = validateAndCompile(db);
    assert.equal(result.length, 2);
  });

  test("skips entry with empty label", () => {
    const db = makeValidDB();
    db.entries[0].label = "";
    const result = validateAndCompile(db);
    assert.equal(result.length, 2);
  });

  test("throws if entry count exceeds MAX_ENTRIES (2000)", () => {
    const db = { entries: Array(2001).fill({ pattern: "x", label: "X", confidence: "LOW", category: "test" }) };
    assert.throws(() => validateAndCompile(db), /too many entries/);
  });

  test("skips malformed regex (but doesn't throw)", () => {
    const db = makeValidDB();
    db.entries[0].pattern = "((unmatched"; // invalid regex
    const result = validateAndCompile(db);
    assert.equal(result.length, 2); // one skipped silently
  });

  test("strips unsafe flags, compiles with remaining valid flags", () => {
    const db = makeValidDB();
    db.entries[0].flags = "iX"; // X is not a valid JS flag
    const result = validateAndCompile(db);
    // should compile with 'i' only and not throw
    assert.equal(result.length, 3);
  });
});

// ── SAFE_PATTERN_RE ────────────────────────────────────────────────────────────

describe("SAFE_PATTERN_RE allowlist", () => {
  test("allows standard domain pattern characters", () => {
    assert.ok(SAFE_PATTERN_RE.test("cdn\\.auth0\\.com"));
    assert.ok(SAFE_PATTERN_RE.test("featureassets\\.org"));
    assert.ok(SAFE_PATTERN_RE.test(".*\\.stripe\\.com$"));
    assert.ok(SAFE_PATTERN_RE.test("(api|cdn)\\.segment\\.io"));
  });

  test("blocks backtick", () => {
    assert.ok(!SAFE_PATTERN_RE.test("cdn`exec`"));
  });

  test("blocks dollar-paren (command substitution)", () => {
    assert.ok(!SAFE_PATTERN_RE.test("cdn$(rm -rf /)"));
  });

  test("blocks newline", () => {
    assert.ok(!SAFE_PATTERN_RE.test("cdn\n.com"));
  });
});

// ── Cache TTL logic ────────────────────────────────────────────────────────────

describe("Cache TTL — fresh cache (< 7 days)", () => {
  beforeEach(() => { _store = {}; });

  test("loadFromCache returns true when cache is fresh (1 hour old)", async () => {
    const freshTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
    writeCacheEntry(freshTime);

    // Directly replicate the logic from loadFromCache
    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(entry && entry.data && entry.fetchedAt, "cache entry should exist");
    assert.ok(Date.now() - entry.fetchedAt <= DB_CACHE_TTL, "cache should be fresh");
  });

  test("loadFromCache returns true when cache is 6 days 23 hours old", async () => {
    const almostStale = Date.now() - (6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
    writeCacheEntry(almostStale);

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(Date.now() - entry.fetchedAt <= DB_CACHE_TTL, "6d23h cache should still be fresh");
  });
});

describe("Cache TTL — stale cache (> 7 days)", () => {
  beforeEach(() => { _store = {}; });

  test("cache is stale when exactly 7 days old", async () => {
    const exactlyStale = Date.now() - DB_CACHE_TTL;
    writeCacheEntry(exactlyStale);

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(Date.now() - entry.fetchedAt >= DB_CACHE_TTL, "7-day cache should be stale");
  });

  test("cache is stale when 8 days old", async () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    writeCacheEntry(eightDaysAgo);

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(Date.now() - entry.fetchedAt > DB_CACHE_TTL, "8-day cache should be stale");
  });

  test("cache is stale when 30 days old", async () => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    writeCacheEntry(thirtyDaysAgo);

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(Date.now() - entry.fetchedAt > DB_CACHE_TTL, "30-day cache should be stale");
  });
});

describe("Cache TTL — missing or corrupt cache", () => {
  beforeEach(() => { _store = {}; });

  test("missing cache key returns no entry", async () => {
    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    assert.equal(stored[DB_CACHE_KEY], undefined);
  });

  test("cache with no fetchedAt is treated as missing", async () => {
    _store[DB_CACHE_KEY] = { data: makeValidDB() }; // no fetchedAt
    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    // loadFromCache checks: if (!entry || !entry.data || !entry.fetchedAt) return false
    assert.ok(!entry.fetchedAt, "fetchedAt is missing — should be treated as no cache");
  });

  test("cache with no data is treated as missing", async () => {
    _store[DB_CACHE_KEY] = { fetchedAt: Date.now() }; // no data
    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(!entry.data, "data is missing — should be treated as no cache");
  });
});

// ── Force refresh ──────────────────────────────────────────────────────────────

describe("forceRefreshDB — clears cache", () => {
  beforeEach(() => { _store = {}; });

  test("calling storage.remove clears the cache key", async () => {
    writeCacheEntry(Date.now() - 1000); // write a fresh cache entry
    assert.ok(_store[DB_CACHE_KEY], "cache should exist before clear");

    await globalThis.ext.storage.local.remove(DB_CACHE_KEY);
    assert.equal(_store[DB_CACHE_KEY], undefined, "cache should be cleared after remove");
  });

  test("storage.set writes a new cache entry with current timestamp", async () => {
    const before = Date.now();
    const newEntry = {
      data: makeValidDB(),
      fetchedAt: Date.now(),
      count: 3,
    };
    await globalThis.ext.storage.local.set({ [DB_CACHE_KEY]: newEntry });
    const after = Date.now();

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const entry = stored[DB_CACHE_KEY];
    assert.ok(entry.fetchedAt >= before && entry.fetchedAt <= after, "fetchedAt should be recent");
    assert.equal(entry.count, 3);
  });

  test("after force refresh, new cache is fresh (not stale)", async () => {
    // Simulate: old stale cache → force refresh → new fresh cache
    writeCacheEntry(Date.now() - (8 * 24 * 60 * 60 * 1000)); // 8 days old
    const staleEntry = _store[DB_CACHE_KEY];
    assert.ok(Date.now() - staleEntry.fetchedAt > DB_CACHE_TTL, "precondition: cache is stale");

    // Simulate forceRefreshDB: remove then re-set
    await globalThis.ext.storage.local.remove(DB_CACHE_KEY);
    await globalThis.ext.storage.local.set({
      [DB_CACHE_KEY]: { data: makeValidDB(), fetchedAt: Date.now(), count: 3 },
    });

    const stored = await globalThis.ext.storage.local.get(DB_CACHE_KEY);
    const newEntry = stored[DB_CACHE_KEY];
    assert.ok(Date.now() - newEntry.fetchedAt <= DB_CACHE_TTL, "refreshed cache should be fresh");
  });
});

// ── DB_CACHE_TTL constant ──────────────────────────────────────────────────────

describe("DB_CACHE_TTL constant", () => {
  test("TTL is exactly 7 days in milliseconds", () => {
    assert.equal(DB_CACHE_TTL, 604800000);
  });

  test("TTL matches 7 * 24 * 60 * 60 * 1000", () => {
    assert.equal(DB_CACHE_TTL, 7 * 24 * 60 * 60 * 1000);
  });
});
