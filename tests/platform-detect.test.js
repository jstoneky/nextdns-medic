// tests/platform-detect.test.js
// Unit tests for platform-detect.js: layout classes, theme, storage.onChanged
// Run with: node --test tests/platform-detect.test.js

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

const SRC = fs.readFileSync(path.resolve(__dirname, "../platform-detect.js"), "utf8");

/**
 * Execute platform-detect.js in an isolated vm context with full mock globals.
 *
 * Using vm.createContext + vm.runInContext (rather than vm.runInThisContext)
 * because Node.js 21+ defines a non-configurable globalThis.navigator that
 * cannot be overridden by assignment — vm context gives a clean slate.
 *
 * Returns a handle with captured state and helpers to fire listeners.
 */
function runPlatformDetect(opts = {}) {
  const {
    userAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36",
    href         = "chrome-extension://fakeid/popup.html",
    prefersLight = false,
    storagePref  = "system",
    useBrowser   = false,
  } = opts;

  const docElementClasses = [];
  const bodyClasses        = [];
  const bodyToggles        = [];
  const domListeners       = [];
  let   mediaChangeHandler = null;
  let   storageOnChanged   = null;

  const mockStorage = {
    sync: {
      get: (_keys, cb) => cb({ themePreference: storagePref }),
    },
    onChanged: {
      addListener: (fn) => { storageOnChanged = fn; },
    },
  };

  const ctx = vm.createContext({
    navigator: { userAgent },
    window: {
      location:   { href },
      matchMedia: () => ({
        matches: prefersLight,
        addEventListener: (_evt, fn) => { mediaChangeHandler = fn; },
      }),
      NDMProviders: {},
    },
    document: {
      documentElement: {
        classList: { add: (...c) => docElementClasses.push(...c) },
      },
      body: {
        classList: {
          add:    (...c) => bodyClasses.push(...c),
          toggle: (cls, val) => bodyToggles.push({ cls, val }),
          remove: () => {},
        },
      },
      addEventListener: (evt, fn) => {
        if (evt === "DOMContentLoaded") domListeners.push(fn);
      },
    },
    browser: useBrowser ? { storage: mockStorage } : undefined,
    chrome:  useBrowser ? undefined : { storage: mockStorage },
  });

  vm.runInContext(SRC, ctx);

  return {
    docElementClasses,
    bodyClasses,
    bodyToggles,
    domListeners,
    get mediaChangeHandler() { return mediaChangeHandler; },
    get storageOnChanged()   { return storageOnChanged;   },
    fireDOMContentLoaded()   { domListeners.forEach(fn => fn()); },
  };
}

// ── Layout class injection (IIFE — runs immediately) ─────────────────────────
describe("Layout class injection — documentElement (immediate)", () => {
  test("desktop: adds is-desktop to documentElement", () => {
    const { docElementClasses } = runPlatformDetect({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/120",
    });
    assert.ok(docElementClasses.includes("is-desktop"),
      `Expected is-desktop, got: ${docElementClasses}`);
    assert.ok(!docElementClasses.includes("is-mobile"));
  });

  test("Android: adds is-mobile to documentElement", () => {
    const { docElementClasses } = runPlatformDetect({
      userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36",
    });
    assert.ok(docElementClasses.includes("is-mobile"),
      `Expected is-mobile, got: ${docElementClasses}`);
    assert.ok(!docElementClasses.includes("is-desktop"));
  });

  test("Safari extension URL: adds is-safari to documentElement", () => {
    const { docElementClasses } = runPlatformDetect({
      href: "safari-web-extension://fakeid/popup.html",
    });
    assert.ok(docElementClasses.includes("is-safari"));
    assert.ok(docElementClasses.includes("is-desktop"));
  });

  test("non-Safari URL: does NOT add is-safari", () => {
    const { docElementClasses } = runPlatformDetect({
      href: "chrome-extension://fakeid/popup.html",
    });
    assert.ok(!docElementClasses.includes("is-safari"));
  });

  test("Android + Safari URL: is-mobile and is-safari both added", () => {
    const { docElementClasses } = runPlatformDetect({
      userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit",
      href:      "safari-web-extension://fakeid/popup.html",
    });
    assert.ok(docElementClasses.includes("is-mobile"));
    assert.ok(docElementClasses.includes("is-safari"));
  });
});

// ── DOMContentLoaded — body classes ──────────────────────────────────────────
describe("DOMContentLoaded — body class injection", () => {
  test("body classes NOT added before DOMContentLoaded fires", () => {
    const { bodyClasses } = runPlatformDetect();
    assert.ok(!bodyClasses.includes("desktop"),
      "Should not have desktop class before DOMContentLoaded");
  });

  test("fires 'desktop' on body after DOMContentLoaded", () => {
    const ctx = runPlatformDetect({
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
    });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyClasses.includes("desktop"));
    assert.ok(!ctx.bodyClasses.includes("mobile"));
  });

  test("fires 'mobile' on body after DOMContentLoaded for Android", () => {
    const ctx = runPlatformDetect({
      userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit",
    });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyClasses.includes("mobile"),
      `Expected 'mobile' in body classes, got: ${ctx.bodyClasses}`);
  });

  test("fires 'safari' on body when Safari URL after DOMContentLoaded", () => {
    const ctx = runPlatformDetect({
      href: "safari-web-extension://fakeid/popup.html",
    });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyClasses.includes("safari"));
  });

  test("does NOT fire 'safari' on body for Chrome URL", () => {
    const ctx = runPlatformDetect({
      href: "chrome-extension://fakeid/popup.html",
    });
    ctx.fireDOMContentLoaded();
    assert.ok(!ctx.bodyClasses.includes("safari"));
  });
});

// ── applyTheme ────────────────────────────────────────────────────────────────
describe("applyTheme — light-mode class toggling", () => {
  test("pref='light' → toggles light-mode to true regardless of matchMedia", () => {
    const ctx = runPlatformDetect({ prefersLight: false, storagePref: "light" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === true));
  });

  test("pref='dark' → toggles light-mode to false", () => {
    const ctx = runPlatformDetect({ prefersLight: true, storagePref: "dark" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === false));
  });

  test("pref='system', prefers-light=true → light mode on", () => {
    const ctx = runPlatformDetect({ prefersLight: true, storagePref: "system" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === true));
  });

  test("pref='system', prefers-light=false → light mode off", () => {
    const ctx = runPlatformDetect({ prefersLight: false, storagePref: "system" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === false));
  });
});

// ── loadAndApplyTheme — browser vs chrome ─────────────────────────────────────
describe("loadAndApplyTheme — namespace resolution", () => {
  test("uses browser.storage when browser is defined", () => {
    const ctx = runPlatformDetect({ useBrowser: true, storagePref: "light" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === true));
  });

  test("uses chrome.storage when browser is undefined", () => {
    const ctx = runPlatformDetect({ useBrowser: false, storagePref: "dark" });
    ctx.fireDOMContentLoaded();
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === false));
  });
});

// ── storage.onChanged listener ────────────────────────────────────────────────
describe("storage.onChanged — theme updates", () => {
  test("themePreference change → applyTheme called with new value", () => {
    const ctx = runPlatformDetect({ storagePref: "system", prefersLight: false });
    ctx.fireDOMContentLoaded();
    // Clear toggles from init so we can assert on the storage-change toggle only
    ctx.bodyToggles.length = 0;

    assert.ok(ctx.storageOnChanged, "storageOnChanged listener should be registered");
    ctx.storageOnChanged({ themePreference: { newValue: "light" } });
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === true));
  });

  test("unrelated storage key change → applyTheme NOT called", () => {
    const ctx = runPlatformDetect({ storagePref: "system" });
    ctx.fireDOMContentLoaded();
    ctx.bodyToggles.length = 0;

    ctx.storageOnChanged({ someOtherKey: { newValue: "x" } });
    assert.equal(ctx.bodyToggles.length, 0);
  });

  test("themePreference with no newValue → defaults to system", () => {
    const ctx = runPlatformDetect({ storagePref: "system", prefersLight: false });
    ctx.fireDOMContentLoaded();
    ctx.bodyToggles.length = 0;

    ctx.storageOnChanged({ themePreference: {} }); // no newValue → falls back to "system"
    // system + prefersLight=false → light-mode: false
    assert.ok(ctx.bodyToggles.some(t => t.cls === "light-mode" && t.val === false));
  });
});
