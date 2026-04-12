// tests/background.test.js
// Unit tests for background.js: tab lifecycle, block accumulation, message handlers, badge
// Run with: node --test tests/background.test.js

const { test, describe, beforeEach, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { makeMockStorage } = require("./helpers");

// ── Listener capture ──────────────────────────────────────────────────────────
// Set these up BEFORE require so background.js registers into our mocks
let onCommitted, onUpdated, onRemoved, onErrorOccurred, onMessage;
const badgeTexts  = [];
const badgeColors = [];
const sentMessages = [];
const mockStorage  = makeMockStorage();

global.ext = {
  webNavigation: { onCommitted:  { addListener: (fn) => { onCommitted  = fn; } } },
  tabs: {
    onUpdated: { addListener: (fn) => { onUpdated  = fn; } },
    onRemoved: { addListener: (fn) => { onRemoved  = fn; } },
  },
  webRequest: { onErrorOccurred: { addListener: (fn) => { onErrorOccurred = fn; } } },
  action: {
    setBadgeText:            (o) => badgeTexts.push(o),
    setBadgeBackgroundColor: (o) => badgeColors.push(o),
  },
  runtime: {
    onMessage: { addListener: (fn) => { onMessage = fn; } },
    sendMessage: async (msg) => { sentMessages.push(msg); },
    getURL: (p) => `chrome-extension://fakeid/${p}`,
  },
  storage: { local: mockStorage },
};

global.classifyDomain = () => ({
  label: "Unknown Domain", confidence: "MEDIUM", category: "unknown", known: false,
});
global.forceRefreshDB = async () => ({ ok: true });
global.getDBMeta = () => ({ source: "test", fetchedAt: 0, count: 10, version: "1.0" });

const bg = require("../background.js");

// ── Per-test reset ────────────────────────────────────────────────────────────
beforeEach(() => {
  bg.tabData.clear();
  badgeTexts.length  = 0;
  badgeColors.length = 0;
  sentMessages.length = 0;
  mockStorage._raw   = {};
});

// ── getOrCreateTabData ────────────────────────────────────────────────────────
describe("getOrCreateTabData", () => {
  test("creates a new entry with empty blocks Map", () => {
    const data = bg.getOrCreateTabData(99);
    assert.ok(data.blocks instanceof Map);
    assert.equal(data.blocks.size, 0);
  });

  test("returns same object reference on subsequent calls", () => {
    const a = bg.getOrCreateTabData(42);
    const b = bg.getOrCreateTabData(42);
    assert.equal(a, b);
  });

  test("startTime is close to Date.now()", () => {
    const before = Date.now();
    const data = bg.getOrCreateTabData(1);
    const after = Date.now();
    assert.ok(data.startTime >= before && data.startTime <= after);
  });

  test("url and hostname default to empty strings", () => {
    const data = bg.getOrCreateTabData(7);
    assert.equal(data.url, "");
    assert.equal(data.hostname, "");
  });
});

// ── onCommitted (navigation reset) ───────────────────────────────────────────
describe("onCommitted listener", () => {
  test("top-frame navigation resets tabData for the tab", () => {
    // Pre-seed some blocks
    bg.getOrCreateTabData(1).blocks.set("old.com", { domain: "old.com" });

    onCommitted({ frameId: 0, tabId: 1, url: "https://example.com" });

    const data = bg.tabData.get(1);
    assert.equal(data.hostname, "example.com");
    assert.equal(data.blocks.size, 0);
  });

  test("subframe navigation (frameId !== 0) is ignored", () => {
    bg.getOrCreateTabData(1).blocks.set("old.com", { domain: "old.com" });
    onCommitted({ frameId: 2, tabId: 1, url: "https://example.com/frame" });
    // tabData should still have the old block
    assert.equal(bg.tabData.get(1).blocks.size, 1);
  });

  test("resets badge to empty text on navigation", () => {
    onCommitted({ frameId: 0, tabId: 1, url: "https://example.com" });
    const badgeCall = badgeTexts.find(c => c.tabId === 1);
    assert.ok(badgeCall);
    assert.equal(badgeCall.text, "");
  });

  test("sends TAB_NAVIGATED message", () => {
    onCommitted({ frameId: 0, tabId: 5, url: "https://example.com" });
    assert.ok(sentMessages.some(m => m.type === "TAB_NAVIGATED" && m.tabId === 5));
  });

  test("stores correct url and hostname", () => {
    onCommitted({ frameId: 0, tabId: 2, url: "https://shop.example.com/cart" });
    const data = bg.tabData.get(2);
    assert.equal(data.url, "https://shop.example.com/cart");
    assert.equal(data.hostname, "shop.example.com");
  });
});

// ── onUpdated (tabs.onUpdated fallback) ──────────────────────────────────────
describe("onUpdated listener", () => {
  test("status=complete creates entry when none exists", () => {
    onUpdated(10, { status: "complete" }, { url: "https://newsite.com" });
    assert.ok(bg.tabData.has(10));
    assert.equal(bg.tabData.get(10).hostname, "newsite.com");
  });

  test("status=loading is ignored", () => {
    onUpdated(10, { status: "loading" }, { url: "https://newsite.com" });
    assert.equal(bg.tabData.has(10), false);
  });

  test("does not overwrite existing onCommitted data", () => {
    // Simulate onCommitted already set up data for this tab
    onCommitted({ frameId: 0, tabId: 10, url: "https://example.com" });
    bg.tabData.get(10).blocks.set("tracker.com", { domain: "tracker.com" });

    // onUpdated fires for the same tab — should NOT wipe the block
    onUpdated(10, { status: "complete" }, { url: "https://example.com" });
    assert.equal(bg.tabData.get(10).blocks.size, 1);
  });

  test("missing tab.url is ignored", () => {
    onUpdated(11, { status: "complete" }, {});
    assert.equal(bg.tabData.has(11), false);
  });
});

// ── onRemoved ────────────────────────────────────────────────────────────────
describe("onRemoved listener", () => {
  test("removes tabData for the closed tab", () => {
    bg.getOrCreateTabData(20);
    onRemoved(20);
    assert.equal(bg.tabData.has(20), false);
  });

  test("removing non-existent tab does not throw", () => {
    assert.doesNotThrow(() => onRemoved(999));
  });
});

// ── onErrorOccurred — block detection ─────────────────────────────────────────
describe("onErrorOccurred — basic block detection", () => {
  test("definite block (ERR_NAME_NOT_RESOLVED) is recorded", () => {
    onErrorOccurred({ tabId: 1, url: "https://ads.tracker.com/pixel", error: "net::ERR_NAME_NOT_RESOLVED" });
    const block = bg.tabData.get(1)?.blocks.get("ads.tracker.com");
    assert.ok(block);
    assert.equal(block.isDefiniteBlock, true);
    assert.equal(block.isPossibleBlock, false);
  });

  test("possible block (ERR_CONNECTION_REFUSED) is recorded", () => {
    onErrorOccurred({ tabId: 1, url: "https://cdn.tracker.com/x.js", error: "net::ERR_CONNECTION_REFUSED" });
    const block = bg.tabData.get(1)?.blocks.get("cdn.tracker.com");
    assert.ok(block);
    assert.equal(block.isDefiniteBlock, false);
    assert.equal(block.isPossibleBlock, true);
  });

  test("non-block error (ERR_TIMED_OUT) is not recorded", () => {
    onErrorOccurred({ tabId: 1, url: "https://cdn.tracker.com/x.js", error: "net::ERR_TIMED_OUT" });
    assert.equal(bg.tabData.has(1), false);
  });

  test("empty error string is not recorded", () => {
    onErrorOccurred({ tabId: 1, url: "https://cdn.tracker.com/x.js", error: "" });
    assert.equal(bg.tabData.has(1), false);
  });

  test("background request (tabId < 0) is ignored", () => {
    onErrorOccurred({ tabId: -1, url: "https://tracker.com/x.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    assert.equal(bg.tabData.has(-1), false);
  });

  test("tabId = 0 is processed (not filtered)", () => {
    onErrorOccurred({ tabId: 0, url: "https://tracker.com/x.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    assert.ok(bg.tabData.has(0));
  });
});

// ── onErrorOccurred — same-domain filter ─────────────────────────────────────
describe("onErrorOccurred — same-domain filter", () => {
  test("error on same hostname as tab is skipped", () => {
    bg.tabData.set(1, { url: "https://example.com", hostname: "example.com", blocks: new Map(), startTime: Date.now() });
    onErrorOccurred({ tabId: 1, url: "https://example.com/api/data", error: "net::ERR_NAME_NOT_RESOLVED" });
    assert.equal(bg.tabData.get(1).blocks.size, 0);
  });

  test("error on third-party domain is recorded", () => {
    bg.tabData.set(1, { url: "https://example.com", hostname: "example.com", blocks: new Map(), startTime: Date.now() });
    onErrorOccurred({ tabId: 1, url: "https://cdn.analytics.com/track.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    assert.equal(bg.tabData.get(1).blocks.size, 1);
  });

  test("tab with no data: request hostname compared to empty string — third-party passes", () => {
    // No prior tabData: tabHostname = ""
    onErrorOccurred({ tabId: 2, url: "https://tracker.com/pixel", error: "net::ERR_NAME_NOT_RESOLVED" });
    assert.ok(bg.tabData.get(2)?.blocks.has("tracker.com"));
  });
});

// ── onErrorOccurred — count increment and dedup ───────────────────────────────
describe("onErrorOccurred — count increment and deduplication", () => {
  test("second error for same domain increments count", () => {
    onErrorOccurred({ tabId: 1, url: "https://ads.com/x.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    onErrorOccurred({ tabId: 1, url: "https://ads.com/y.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const block = bg.tabData.get(1).blocks.get("ads.com");
    assert.equal(block.count, 2);
    assert.equal(bg.tabData.get(1).blocks.size, 1); // still one entry
  });

  test("lastSeen is updated on duplicate hit", () => {
    const origNow = Date.now;
    let t = 1000;
    Date.now = () => t;

    onErrorOccurred({ tabId: 1, url: "https://ads.com/x.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const firstSeen = bg.tabData.get(1).blocks.get("ads.com").firstSeen;

    t = 2000;
    onErrorOccurred({ tabId: 1, url: "https://ads.com/y.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const block = bg.tabData.get(1).blocks.get("ads.com");

    assert.equal(block.firstSeen, firstSeen);
    assert.equal(block.lastSeen, 2000);

    Date.now = origNow;
  });

  test("block record includes domain, url, error, classification", () => {
    onErrorOccurred({ tabId: 1, url: "https://ads.example.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const block = bg.tabData.get(1).blocks.get("ads.example.com");
    assert.equal(block.domain, "ads.example.com");
    assert.equal(block.url, "https://ads.example.com/t.js");
    assert.equal(block.error, "net::ERR_NAME_NOT_RESOLVED");
    assert.ok(block.classification);
    assert.equal(block.count, 1);
  });
});

// ── onErrorOccurred — 100-entry cap ──────────────────────────────────────────
describe("onErrorOccurred — 100-entry cap", () => {
  test("blocks capped at 100 entries", () => {
    for (let i = 0; i < 101; i++) {
      onErrorOccurred({ tabId: 1, url: `https://domain${i}.com/t.js`, error: "net::ERR_NAME_NOT_RESOLVED" });
    }
    assert.equal(bg.tabData.get(1).blocks.size, 100);
  });

  test("oldest entry (domain0) is evicted first", () => {
    for (let i = 0; i < 101; i++) {
      onErrorOccurred({ tabId: 1, url: `https://domain${i}.com/t.js`, error: "net::ERR_NAME_NOT_RESOLVED" });
    }
    assert.equal(bg.tabData.get(1).blocks.has("domain0.com"), false);
    assert.ok(bg.tabData.get(1).blocks.has("domain100.com"));
  });
});

// ── Badge updates ─────────────────────────────────────────────────────────────
describe("badge updates", () => {
  test("0 blocks → badge text is empty, no color set", () => {
    // Navigation triggers updateBadge(tabId, 0) which sets text="" with no color call
    onCommitted({ frameId: 0, tabId: 1, url: "https://example.com" });
    assert.ok(badgeTexts.some(b => b.text === "" && b.tabId === 1));
    assert.equal(badgeColors.length, 0);
  });

  test("blocks with no HIGH confidence → amber badge", () => {
    global.classifyDomain = () => ({ label: "Analytics", confidence: "MEDIUM", category: "analytics", known: true });
    onErrorOccurred({ tabId: 1, url: "https://analytics.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const color = badgeColors.find(c => c.tabId === 1);
    assert.ok(color);
    assert.equal(color.color, "#f59e0b");
    global.classifyDomain = () => ({ label: "Unknown", confidence: "MEDIUM", category: "unknown", known: false });
  });

  test("any HIGH confidence block → red badge", () => {
    global.classifyDomain = () => ({ label: "Auth", confidence: "HIGH", category: "authentication", known: true });
    onErrorOccurred({ tabId: 1, url: "https://auth0.com/login.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const color = badgeColors.find(c => c.tabId === 1);
    assert.equal(color.color, "#e53935");
    global.classifyDomain = () => ({ label: "Unknown", confidence: "MEDIUM", category: "unknown", known: false });
  });

  test("badge text shows total block count", () => {
    onErrorOccurred({ tabId: 1, url: "https://a.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    onErrorOccurred({ tabId: 1, url: "https://b.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    onErrorOccurred({ tabId: 1, url: "https://c.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const lastText = [...badgeTexts].reverse().find(b => b.tabId === 1);
    assert.equal(lastText.text, "3");
  });
});

// ── Message handlers ──────────────────────────────────────────────────────────
describe("message handler — GET_TAB_DATA", () => {
  test("returns blocks as array for known tab", () => {
    bg.getOrCreateTabData(5);
    onErrorOccurred({ tabId: 5, url: "https://tracker.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });

    const responses = [];
    const ret = onMessage({ type: "GET_TAB_DATA", tabId: 5 }, {}, (r) => responses.push(r));
    assert.equal(ret, true); // keeps channel open
    assert.ok(Array.isArray(responses[0].blocks));
    assert.equal(responses[0].blocks.length, 1);
    assert.equal(responses[0].blocks[0].domain, "tracker.com");
  });

  test("blocks Map serialized to Array (not Map)", () => {
    bg.getOrCreateTabData(5);
    onErrorOccurred({ tabId: 5, url: "https://tracker.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    const responses = [];
    onMessage({ type: "GET_TAB_DATA", tabId: 5 }, {}, (r) => responses.push(r));
    assert.ok(Array.isArray(responses[0].blocks));
    assert.equal(responses[0].blocks instanceof Map, false);
  });

  test("returns empty blocks for unknown tab", () => {
    const responses = [];
    onMessage({ type: "GET_TAB_DATA", tabId: 9999 }, {}, (r) => responses.push(r));
    assert.deepEqual(responses[0].blocks, []);
    assert.equal(responses[0].url, "");
  });

  test("returns url, hostname, startTime for known tab", () => {
    onCommitted({ frameId: 0, tabId: 6, url: "https://mysite.com" });
    const responses = [];
    onMessage({ type: "GET_TAB_DATA", tabId: 6 }, {}, (r) => responses.push(r));
    assert.equal(responses[0].hostname, "mysite.com");
    assert.equal(responses[0].url, "https://mysite.com");
    assert.ok(typeof responses[0].startTime === "number");
  });
});

describe("message handler — CLEAR_TAB_DATA", () => {
  test("clears blocks and resets badge", () => {
    onErrorOccurred({ tabId: 1, url: "https://tracker.com/t.js", error: "net::ERR_NAME_NOT_RESOLVED" });
    badgeTexts.length = 0;

    const responses = [];
    const ret = onMessage({ type: "CLEAR_TAB_DATA", tabId: 1 }, {}, (r) => responses.push(r));
    assert.equal(ret, true);
    assert.deepEqual(responses[0], { ok: true });
    assert.equal(bg.tabData.get(1).blocks.size, 0);
    assert.ok(badgeTexts.some(b => b.text === "" && b.tabId === 1));
  });

  test("clearing unknown tab does not throw", () => {
    const responses = [];
    assert.doesNotThrow(() =>
      onMessage({ type: "CLEAR_TAB_DATA", tabId: 9999 }, {}, (r) => responses.push(r))
    );
    assert.deepEqual(responses[0], { ok: true });
  });
});

describe("message handler — REFRESH_DB", () => {
  test("calls forceRefreshDB and returns result asynchronously", async () => {
    const responses = [];
    const ret = onMessage({ type: "REFRESH_DB" }, {}, (r) => responses.push(r));
    assert.equal(ret, true); // async, keeps channel open
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses[0], { ok: true });
  });
});

describe("message handler — GET_DB_META", () => {
  test("returns result of getDBMeta synchronously", () => {
    const responses = [];
    const ret = onMessage({ type: "GET_DB_META" }, {}, (r) => responses.push(r));
    assert.equal(ret, true);
    assert.equal(responses[0].source, "test");
    assert.equal(responses[0].count, 10);
  });
});

describe("message handler — GET_ERROR_LOG", () => {
  test("returns empty array when no log exists", async () => {
    const responses = [];
    onMessage({ type: "GET_ERROR_LOG" }, {}, (r) => responses.push(r));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses[0], []);
  });

  test("returns stored log entries", async () => {
    const entries = [{ ts: "2026-01-01", ctx: "test", msg: "err", stack: "" }];
    mockStorage._raw[bg.ERROR_LOG_KEY] = entries;

    const responses = [];
    onMessage({ type: "GET_ERROR_LOG" }, {}, (r) => responses.push(r));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses[0], entries);
  });
});

describe("message handler — CLEAR_ERROR_LOG", () => {
  test("removes log from storage and responds ok", async () => {
    mockStorage._raw[bg.ERROR_LOG_KEY] = [{ ts: "t", ctx: "c", msg: "m", stack: "" }];

    const responses = [];
    onMessage({ type: "CLEAR_ERROR_LOG" }, {}, (r) => responses.push(r));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(responses[0], { ok: true });
    assert.equal(mockStorage._raw[bg.ERROR_LOG_KEY], undefined);
  });
});

describe("message handler — unknown type", () => {
  test("unknown message type does not throw and returns undefined", () => {
    const responses = [];
    assert.doesNotThrow(() =>
      onMessage({ type: "UNKNOWN_MSG" }, {}, (r) => responses.push(r))
    );
    assert.equal(responses.length, 0);
  });
});

// ── Module exports ────────────────────────────────────────────────────────────
describe("module exports", () => {
  test("logError is exported as a function", () =>
    assert.equal(typeof bg.logError, "function"));

  test("ERROR_LOG_KEY is the expected string", () =>
    assert.equal(bg.ERROR_LOG_KEY, "dnsmedic_error_log"));

  test("ERROR_LOG_MAX is 20", () =>
    assert.equal(bg.ERROR_LOG_MAX, 20));

  test("tabData is a Map", () =>
    assert.ok(bg.tabData instanceof Map));
});

// ── Safari path (IS_SAFARI=true) ─────────────────────────────────────────────
// Re-require background.js with a Safari extension URL to flip IS_SAFARI=true.
describe("Safari path (IS_SAFARI=true)", () => {
  let safariOnError;
  let safariModule;
  const safariBadgeTexts  = [];
  const safariBadgeColors = [];

  const safariExt = {
    webNavigation: { onCommitted:  { addListener: () => {} } },
    tabs: {
      onUpdated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    webRequest: { onErrorOccurred: { addListener: (fn) => { safariOnError = fn; } } },
    action: {
      setBadgeText:            (o) => safariBadgeTexts.push(o),
      setBadgeBackgroundColor: (o) => safariBadgeColors.push(o),
    },
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: async () => {},
      getURL: (p) => `safari-web-extension://fakeid/${p}`,
    },
    storage: { local: makeMockStorage() },
  };

  before(() => {
    // Swap to Safari ext, re-require, then leave safariExt active for Safari tests
    global.ext = safariExt;
    delete require.cache[require.resolve("../background.js")];
    safariModule = require("../background.js");
  });

  after(() => {
    // Restore Chrome ext after all Safari tests complete
    global.ext = {
      webNavigation: { onCommitted:  { addListener: () => {} } },
      tabs: { onUpdated: { addListener: () => {} }, onRemoved: { addListener: () => {} } },
      webRequest: { onErrorOccurred: { addListener: () => {} } },
      action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
      runtime: { onMessage: { addListener: () => {} }, sendMessage: async () => {}, getURL: (p) => `chrome-extension://fakeid/${p}` },
      storage: { local: makeMockStorage() },
    };
    delete require.cache[require.resolve("../background.js")];
  });

  beforeEach(() => {
    safariModule.tabData.clear();
    safariBadgeTexts.length  = 0;
    safariBadgeColors.length = 0;
  });

  test("ERR_ABORTED is treated as possible block with isSafariAbort=true", () => {
    global.classifyDomain = () => ({ label: "Analytics", confidence: "HIGH", category: "analytics", known: true });
    safariOnError({ tabId: 1, url: "https://www.google-analytics.com/collect", error: "net::ERR_ABORTED" });

    const block = safariModule.tabData.get(1)?.blocks.get("www.google-analytics.com");
    assert.ok(block, "Block should be recorded");
    assert.equal(block.isSafariAbort, true);
    assert.equal(block.isPossibleBlock, true);
    assert.equal(block.isDefiniteBlock, false);
    global.classifyDomain = () => ({ label: "Unknown", confidence: "MEDIUM", category: "unknown", known: false });
  });

  test("ERR_ABORTED increments count on duplicate domain", () => {
    global.classifyDomain = () => ({ label: "X", confidence: "MEDIUM", category: "unknown", known: false });
    safariOnError({ tabId: 1, url: "https://tracker.com/a", error: "net::ERR_ABORTED" });
    safariOnError({ tabId: 1, url: "https://tracker.com/b", error: "net::ERR_ABORTED" });
    assert.equal(safariModule.tabData.get(1).blocks.get("tracker.com").count, 2);
    global.classifyDomain = () => ({ label: "Unknown", confidence: "MEDIUM", category: "unknown", known: false });
  });

  test("ERR_ABORTED respects 100-entry cap", () => {
    global.classifyDomain = () => ({ label: "X", confidence: "MEDIUM", category: "unknown", known: false });
    for (let i = 0; i < 101; i++) {
      safariOnError({ tabId: 1, url: `https://domain${i}.com/t`, error: "net::ERR_ABORTED" });
    }
    assert.equal(safariModule.tabData.get(1).blocks.size, 100);
    global.classifyDomain = () => ({ label: "Unknown", confidence: "MEDIUM", category: "unknown", known: false });
  });

  test("definitite block errors still work on Safari (not treated as Safari abort)", () => {
    safariOnError({ tabId: 1, url: "https://blocked.com/x", error: "net::ERR_NAME_NOT_RESOLVED" });
    const block = safariModule.tabData.get(1)?.blocks.get("blocked.com");
    assert.ok(block);
    assert.equal(block.isSafariAbort, undefined);
    assert.equal(block.isDefiniteBlock, true);
  });
});
