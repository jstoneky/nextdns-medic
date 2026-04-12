// tests/browser-compat.test.js
// Unit tests for browser-compat.js: namespace resolution and action aliasing
// Run with: node --test tests/browser-compat.test.js

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

const SRC = fs.readFileSync(path.resolve(__dirname, "../browser-compat.js"), "utf8");

/**
 * Evaluate browser-compat.js in the global context after installing browser/chrome stubs.
 * Returns the value of global.ext after execution.
 * Cleans up globals afterwards.
 */
function runCompat({ browser: browserStub, chrome: chromeStub } = {}) {
  // Clean slate
  delete globalThis.browser;
  delete globalThis.chrome;
  delete globalThis.ext;

  if (browserStub !== undefined) globalThis.browser = browserStub;
  if (chromeStub  !== undefined) globalThis.chrome  = chromeStub;

  vm.runInThisContext(SRC);

  const result = globalThis.ext;

  // Clean up
  delete globalThis.browser;
  delete globalThis.chrome;
  delete globalThis.ext;

  return result;
}

// ── Namespace resolution ───────────────────────────────────────────────────────
describe("namespace resolution", () => {
  test("returns browser when browser.runtime is defined", () => {
    const stub = { runtime: {}, storage: {} };
    const ext = runCompat({ browser: stub });
    assert.equal(ext, stub);
  });

  test("returns chrome when browser is undefined and chrome.runtime is defined", () => {
    const stub = { runtime: {}, storage: {} };
    const ext = runCompat({ chrome: stub });
    assert.equal(ext, stub);
  });

  test("browser takes priority over chrome when both defined", () => {
    const browserStub = { runtime: {}, id: "browser" };
    const chromeStub  = { runtime: {}, id: "chrome"  };
    const ext = runCompat({ browser: browserStub, chrome: chromeStub });
    assert.equal(ext.id, "browser");
  });

  test("throws when neither browser nor chrome defined", () => {
    delete globalThis.browser;
    delete globalThis.chrome;
    delete globalThis.ext;
    assert.throws(
      () => vm.runInThisContext(SRC),
      /No WebExtension API found/
    );
    delete globalThis.ext;
  });

  test("falls through to chrome when browser.runtime is falsy", () => {
    const browserStub = {}; // no .runtime
    const chromeStub  = { runtime: {}, id: "chrome" };
    const ext = runCompat({ browser: browserStub, chrome: chromeStub });
    assert.equal(ext.id, "chrome");
  });

  test("throws when chrome.runtime is falsy and browser absent", () => {
    delete globalThis.browser;
    delete globalThis.chrome;
    delete globalThis.ext;
    globalThis.chrome = {}; // no .runtime
    assert.throws(
      () => vm.runInThisContext(SRC),
      /No WebExtension API found/
    );
    delete globalThis.chrome;
    delete globalThis.ext;
  });
});

// ── action / browserAction aliasing ──────────────────────────────────────────
describe("action / browserAction aliasing", () => {
  test("MV2 Firefox: browserAction present, action absent → ext.action aliased to browserAction", () => {
    const browserAction = { setBadgeText: () => {} };
    const stub = { runtime: {}, browserAction };
    const ext = runCompat({ browser: stub });
    assert.equal(ext.action, browserAction);
    assert.equal(ext.action, ext.browserAction); // same reference
  });

  test("MV3 Chrome: action present, browserAction absent → ext.browserAction aliased to action", () => {
    const action = { setBadgeText: () => {} };
    const stub = { runtime: {}, action };
    const ext = runCompat({ chrome: stub });
    assert.equal(ext.browserAction, action);
    assert.equal(ext.browserAction, ext.action); // same reference
  });

  test("both present → neither is overwritten", () => {
    const action       = { id: "action" };
    const browserAction = { id: "browserAction" };
    const stub = { runtime: {}, action, browserAction };
    const ext = runCompat({ chrome: stub });
    assert.equal(ext.action.id, "action");
    assert.equal(ext.browserAction.id, "browserAction");
  });

  test("neither present → both remain undefined", () => {
    const stub = { runtime: {} };
    const ext = runCompat({ chrome: stub });
    assert.equal(ext.action, undefined);
    assert.equal(ext.browserAction, undefined);
  });

  test("browserAction alias preserves exact object reference", () => {
    const browserAction = { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} };
    const stub = { runtime: {}, browserAction };
    const ext = runCompat({ browser: stub });
    assert.ok(ext.action === browserAction);
  });

  test("action alias preserves exact object reference", () => {
    const action = { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} };
    const stub = { runtime: {}, action };
    const ext = runCompat({ chrome: stub });
    assert.ok(ext.browserAction === action);
  });
});
