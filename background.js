// NextDNS Traffic Monitor — Background Service Worker
// Monitors webRequest errors and flags likely NextDNS blocks

// Chrome service worker loads these via importScripts.
// Firefox loads them via background.scripts in manifest — these will no-op silently.
try { importScripts("browser-compat.js"); } catch (e) {}
try { importScripts("domain-db.js"); } catch (e) {}

// In-memory store: tabId -> { url, hostname, blocks: Map<domain, blockInfo> }
const tabData = new Map();

// Errors that indicate DNS-level blocking
const DNS_BLOCK_ERRORS = [
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_BLOCKED_BY_ADMINISTRATOR",
];

// Also watch for these as possible (lower confidence)
const POSSIBLE_BLOCK_ERRORS = [
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_FAILED",
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
  if (changeInfo.status === "loading" && tab.url) {
    const hostname = extractHostname(tab.url);
    const data = getOrCreateTabData(tabId);
    if (data.hostname !== hostname) {
      tabData.set(tabId, {
        url: tab.url,
        hostname,
        blocks: new Map(),
        startTime: Date.now(),
      });
      updateBadge(tabId, 0);
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

    // Determine if this looks like a NextDNS block
    const isDefiniteBlock = DNS_BLOCK_ERRORS.some(e => error.includes(e));
    const isPossibleBlock = !isDefiniteBlock && POSSIBLE_BLOCK_ERRORS.some(e => error.includes(e));

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
  ext.action.setBadgeBackgroundColor({
    color: highCount > 0 ? "#e53935" : "#f59e0b",
    tabId,
  });
}

// Message handler — popup requests data for current tab
ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TAB_DATA") {
    const data = tabData.get(msg.tabId);
    if (!data) {
      sendResponse({ blocks: [], url: "", hostname: "" });
      return true;
    }
    sendResponse({
      blocks: [...data.blocks.values()],
      url: data.url,
      hostname: data.hostname,
      startTime: data.startTime,
    });
    return true;
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
});
