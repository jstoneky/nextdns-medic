// browser-compat.js
// Normalizes chrome.* vs browser.* across Chrome (MV3) and Firefox (MV2/MV3).
// Load this before any other extension scripts.

// eslint-disable-next-line no-var
var ext = (function () {
  if (typeof browser !== "undefined" && browser.runtime) return browser;
  if (typeof chrome !== "undefined" && chrome.runtime) return chrome;
  throw new Error("No WebExtension API found");
})();

// MV2 Firefox uses browserAction; MV3 Chrome uses action.
// Alias whichever is missing so ext.action.* always works.
if (!ext.action && ext.browserAction) {
  ext.action = ext.browserAction;
}
if (!ext.browserAction && ext.action) {
  ext.browserAction = ext.action;
}
