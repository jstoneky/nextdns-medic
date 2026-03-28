// Stub browser APIs when running in Node (for unit tests)
if (typeof ext === "undefined" && typeof module !== "undefined") {
  global.ext = {
    webNavigation: { onCommitted: { addListener: () => {} } },
    tabs:          { onUpdated:   { addListener: () => {} }, onRemoved: { addListener: () => {} } },
    webRequest:    { onErrorOccurred: { addListener: () => {} } },
    action:        { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
    runtime:       { onMessage: { addListener: () => {} } },
  };
  global.classifyDomain = (h) => ({ label: "Unknown Domain", confidence: "MEDIUM", category: "unknown", known: false });
  global.forceRefreshDB = async () => ({ ok: false, error: "stub" });
  global.getDBMeta = () => ({ source: "stub", fetchedAt: null, count: 0, version: "stub" });
}

// NextDNS Traffic Monitor — Background Service Worker
// Monitors webRequest errors and flags likely NextDNS blocks

// Chrome service worker loads these via importScripts.
// Firefox loads them via background.scripts in manifest — these will no-op silently.
try { importScripts("browser-compat.js"); } catch (e) {}
try { importScripts("domain-db.js"); } catch (e) {}
try { importScripts("db-loader.js"); } catch (e) {}

// Detect Safari — its extension URLs start with "safari-web-extension://"
const IS_SAFARI = (typeof ext !== "undefined" && typeof ext.runtime?.getURL === "function")
  ? ext.runtime.getURL("").startsWith("safari-web-extension://")
  : false;

// In-memory store: tabId -> { url, hostname, blocks: Map<domain, blockInfo> }
const tabData = new Map();

// ── Error log (persisted to storage.local, capped at 20 entries) ──────────────
const ERROR_LOG_KEY = "dnsmedic_error_log";
const ERROR_LOG_MAX = 20;

async function logError(context, err) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      ctx: context,
      msg: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.split("\n").slice(0, 4).join(" | ") : "",
    };
    const stored = await ext.storage.local.get(ERROR_LOG_KEY);
    const log = Array.isArray(stored[ERROR_LOG_KEY]) ? stored[ERROR_LOG_KEY] : [];
    log.push(entry);
    if (log.length > ERROR_LOG_MAX) log.splice(0, log.length - ERROR_LOG_MAX);
    await ext.storage.local.set({ [ERROR_LOG_KEY]: log });
  } catch (_) {
    // never throw from the error logger itself
  }
}

// Catch unhandled errors in the background context
if (typeof self !== "undefined") {
  self.addEventListener("error", (e) => logError("uncaught", e.error || e.message));
  self.addEventListener("unhandledrejection", (e) => logError("unhandledrejection", e.reason));
}

// Errors that indicate DNS-level blocking
// Chrome uses net::ERR_* codes; Firefox uses human-readable cert/network error strings
const DNS_BLOCK_ERRORS = [
  // Chrome
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_BLOCKED_BY_ADMINISTRATOR",
  // Firefox — NextDNS block page returns a self-signed cert, causing these.
  // Note: avoid apostrophes — Firefox may use curly quotes (U+2019) vs straight (U+0027)
  "Certificate issuer is not recognized",   // covers "Peer's Certificate issuer is not recognized."
  "received an invalid certificate",         // covers "You have received an invalid certificate..."
  "uses an invalid security certificate",    // another Firefox cert error variant
  "SEC_ERROR_UNKNOWN_ISSUER",               // raw Firefox cert error code
  "NS_ERROR_UNKNOWN_HOST",
  "NS_ERROR_NET_ON_RESOLVING",
];

// Also watch for these as possible (lower confidence)
const POSSIBLE_BLOCK_ERRORS = [
  // Chrome
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_FAILED",
  // Firefox
  "NS_ERROR_CONNECTION_REFUSED",
  "NS_ERROR_NET_RESET",
];

function getOrCreateTabData(tabId) {
  if (!tabData.has(tabId)) {
    tabData.set(tabId, { url: "", hostname: "", blocks: new Map(), startTime: Date.now() });
  }
  return tabData.get(tabId);
}

function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getTabHostname(tabId) {
  return tabData.get(tabId)?.hostname || "";
}

// Listen for navigation to reset tab data
ext.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // top frame only
  const hostname = extractHostname(details.url);

  tabData.set(details.tabId, {
    url: details.url,
    hostname,
    blocks: new Map(),
    startTime: Date.now(),
  });
  updateBadge(details.tabId, 0);
});

// Listen for completed navigation to set tab hostname if not set
ext.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only reset on a genuine navigation to a new hostname.
  // Ignore status="loading" here — onCommitted is the authoritative navigation event.
  // We use onUpdated only as a fallback for cases where webNavigation doesn't fire
  // (e.g. very early page loads before the extension initialises).
  if (changeInfo.status === "complete" && tab.url) {
    const hostname = extractHostname(tab.url);
    const data = tabData.get(tabId);
    // If we already have data for this exact hostname, don't wipe it.
    // onCommitted already handled the reset if the hostname changed.
    if (!data || data.hostname !== hostname) {
      // Only set if we have no record at all — don't overwrite onCommitted data.
      if (!data) {
        tabData.set(tabId, {
          url: tab.url,
          hostname,
          blocks: new Map(),
          startTime: Date.now(),
        });
        updateBadge(tabId, 0);
      }
    }
  }
});

// Clean up when tab closes
ext.tabs.onRemoved.addListener((tabId) => {
  tabData.delete(tabId);
});

// Core: monitor request errors
ext.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId < 0) return; // background requests, ignore
    if (!details.error) return;

    const error = details.error;
    const reqHostname = extractHostname(details.url);
    const tabHostname = getTabHostname(details.tabId);

    // Skip errors on the main page domain itself
    if (reqHostname === tabHostname) return;

    // Determine if this looks like a DNS block
    const isDefiniteBlock = DNS_BLOCK_ERRORS.some(e => error.includes(e));
    const isPossibleBlock = !isDefiniteBlock && POSSIBLE_BLOCK_ERRORS.some(e => error.includes(e));

    // Safari reports ERR_ABORTED for DNS blocks instead of ERR_NAME_NOT_RESOLVED.
    // ERR_ABORTED is too broad on its own (also fires for cancelled prefetches, etc.)
    // so we only treat it as a block when the domain is known in our database.
    const isSafariAbort = IS_SAFARI && !isDefiniteBlock && !isPossibleBlock && error === "net::ERR_ABORTED";
    if (isSafariAbort) {
      const classification = classifyDomain(reqHostname);
      // Treat as possible block for known domains
      const data = getOrCreateTabData(details.tabId);
      const existing = data.blocks.get(reqHostname);
      if (existing) {
        existing.count++;
        existing.lastSeen = Date.now();
      } else {
        data.blocks.set(reqHostname, {
          domain: reqHostname,
          url: details.url,
          error: error,
          isDefiniteBlock: false,
          isPossibleBlock: true,
          classification,
          count: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
      const highCount = [...data.blocks.values()].filter(
        b => b.classification.confidence === "HIGH"
      ).length;
      updateBadge(details.tabId, data.blocks.size, highCount);
      return;
    }

    if (!isDefiniteBlock && !isPossibleBlock) return;

    const classification = classifyDomain(reqHostname);
    const data = getOrCreateTabData(details.tabId);

    // Update or add the block record
    const existing = data.blocks.get(reqHostname);
    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
    } else {
      data.blocks.set(reqHostname, {
        domain: reqHostname,
        url: details.url,
        error: error,
        isDefiniteBlock,
        isPossibleBlock,
        classification,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }

    // Update badge
    const highCount = [...data.blocks.values()].filter(
      b => b.classification.confidence === "HIGH"
    ).length;
    updateBadge(details.tabId, data.blocks.size, highCount);
  },
  { urls: ["<all_urls>"] }
);

function updateBadge(tabId, total, highCount = 0) {
  if (total === 0) {
    ext.action.setBadgeText({ text: "", tabId });
    return;
  }
  ext.action.setBadgeText({ text: String(total), tabId });
  // NOTE: Safari ignores setBadgeBackgroundColor — always renders red regardless.
  // This is a known Safari Web Extensions bug (developer.apple.com/forums/thread/656868).
  // Chrome and Firefox respect the color correctly.
  ext.action.setBadgeBackgroundColor({
    color: highCount > 0 ? "#e53935" : "#f59e0b",
    tabId,
  });
}

// Exports for unit testing (Node environment only)
if (typeof module !== "undefined") {
  module.exports = { DNS_BLOCK_ERRORS, POSSIBLE_BLOCK_ERRORS, extractHostname, getOrCreateTabData, tabData, logError, ERROR_LOG_KEY, ERROR_LOG_MAX };
}

// Message handler — popup requests data for current tab
// Returns true (Chrome) to keep channel open; also handles Firefox Promise-based messaging.
ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TAB_DATA") {

    const data = tabData.get(msg.tabId);
    const payload = data
      ? { blocks: [...data.blocks.values()], url: data.url, hostname: data.hostname, startTime: data.startTime }
      : { blocks: [], url: "", hostname: "" };
    sendResponse(payload);
    return true; // Keep message channel open for Chrome
  }

  if (msg.type === "CLEAR_TAB_DATA") {
    const data = tabData.get(msg.tabId);
    if (data) {
      data.blocks.clear();
      updateBadge(msg.tabId, 0);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "REFRESH_DB") {
    forceRefreshDB().then(result => sendResponse(result));
    return true; // async
  }

  if (msg.type === "GET_DB_META") {
    sendResponse(getDBMeta());
    return true;
  }

  if (msg.type === "GET_ERROR_LOG") {
    ext.storage.local.get(ERROR_LOG_KEY).then((stored) => {
      sendResponse(stored[ERROR_LOG_KEY] || []);
    });
    return true;
  }

  if (msg.type === "CLEAR_ERROR_LOG") {
    ext.storage.local.remove(ERROR_LOG_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }
});
