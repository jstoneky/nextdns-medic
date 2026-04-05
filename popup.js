// DNS Medic — Popup Script (v3.0 — multi-provider)

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentTabId = null;
let activeFilter = null; // "HIGH" | "MEDIUM" | "LOW" | null
let blocklistCache = {}; // domain → [{ id, name }] — cleared on each popup open

// Provider ID: "nextdns" | "pihole" | "controld"
let providerKey = "nextdns";

// Per-provider credential stores
let creds = {
  // NextDNS
  apiKey:    "",
  profileId: "",
  // Pi-hole
  piholeUrl:     "",
  piholeToken:   "",
  piholeVersion: null,
  // Control D
  controldToken:     "",
  controldProfileId: "",
};

// NextDNS-specific UI state
let detectedFingerprint   = null;
let detectedDeviceName    = null;
let profilesList          = [];
let profilesFetchInFlight = false;

// Control D cached profiles (persisted for settings re-render)
let controldProfilesList = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Map verbose Firefox/Chrome error strings to short, readable labels
const ERROR_LABELS = [
  // Firefox cert errors (prose strings)
  [/certificate issuer is not recognized/i,     "untrusted cert issuer"],
  [/invalid security certificate/i,             "invalid certificate"],
  [/received an invalid certificate/i,          "invalid certificate"],
  [/SEC_ERROR_UNKNOWN_ISSUER/i,                 "untrusted cert issuer"],
  [/SEC_ERROR_EXPIRED_CERTIFICATE/i,            "cert expired"],
  [/SEC_ERROR_REVOKED_CERTIFICATE/i,            "cert revoked"],
  [/SEC_ERROR_BAD_SIGNATURE/i,                  "cert bad signature"],
  [/SSL_ERROR_BAD_CERT_DOMAIN/i,               "cert domain mismatch"],
  [/SSL_ERROR_RX_RECORD_TOO_LONG/i,            "SSL protocol error"],
  [/PR_CONNECT_RESET_ERROR/i,                   "connection reset"],
  [/PR_END_OF_FILE_ERROR/i,                     "connection closed"],
  // Chrome / generic net:: errors
  [/ERR_CERT_AUTHORITY_INVALID/,               "untrusted cert issuer"],
  [/ERR_CERT_DATE_INVALID/,                    "cert expired"],
  [/ERR_CERT_REVOKED/,                         "cert revoked"],
  [/ERR_CERT_COMMON_NAME_INVALID/,             "cert domain mismatch"],
  [/ERR_SSL_PROTOCOL_ERROR/,                   "SSL protocol error"],
  [/ERR_CONNECTION_RESET/,                     "connection reset"],
  [/ERR_CONNECTION_REFUSED/,                   "connection refused"],
  [/ERR_NAME_NOT_RESOLVED/,                    "DNS not resolved"],
  [/ERR_INTERNET_DISCONNECTED/,               "no internet"],
  [/ERR_NETWORK_CHANGED/,                      "network changed"],
  [/ERR_TIMED_OUT/,                            "timed out"],
  [/ERR_BLOCKED_BY_CLIENT/,                    "blocked by extension"],
  [/ERR_ABORTED/,                              "request aborted"],
];

function friendlyError(raw) {
  if (!raw) return "";
  for (const [pattern, label] of ERROR_LABELS) {
    if (pattern.test(raw)) return label;
  }
  // Fallback: strip net:: prefix, ERR_ prefix, underscores → lowercase
  return raw
    .replace(/^net::/, "")
    .replace(/^ERR_/, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function getProvider() {
  return window.NDMProviders?.[providerKey];
}

// Messaging helper — Firefox browser.* is Promise-based; Chrome uses callbacks.
function sendMessage(msg) {
  if (typeof browser !== "undefined" && browser.runtime) {
    return browser.runtime.sendMessage(msg).catch(() => null);
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

// ── DNS Routing Status Chip ───────────────────────────────────────────────────
async function checkDNSRouting() {
  const chip = document.getElementById("dns-status-chip");
  if (!chip) return;

  const providerLabels = {
    nextdns:  "NextDNS",
    controld: "Control D",
    pihole:   "Pi-hole",
  };
  const label = providerLabels[providerKey] || providerKey;

  chip.textContent = "checking…";
  chip.className = "dns-status-chip checking";
  chip.classList.remove("hidden");

  let active = false;

  try {
    if (providerKey === "nextdns") {
      const nextdns = window.NDMProviders?.nextdns;
      if (nextdns) {
        const result = await nextdns.detectDeviceFingerprint();
        active = result?.status === "ok";
      }
    } else if (providerKey === "controld") {
      const controld = window.NDMProviders?.controld;
      if (controld) {
        const result = await controld.detectUsage();
        active = result?.active === true;
      }
    } else if (providerKey === "pihole") {
      const pihole = window.NDMProviders?.pihole;
      if (pihole) {
        const result = await pihole.detectUsage();
        active = result?.active === true;
      }
    }
  } catch (_) {
    active = false;
  }

  if (active === true) {
    chip.textContent = `✓ ${label} active`;
    chip.className = "dns-status-chip active";
  } else {
    chip.textContent = `⚠ Not routing to ${label}`;
    chip.className = "dns-status-chip inactive";
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await ext.storage.sync.get([
    "apiKey", "profileId", "provider",
    "piholeUrl", "piholeToken",
    "controldToken", "controldProfileId",
  ]);

  providerKey = stored.provider || "nextdns";
  creds.apiKey    = stored.apiKey    || "";
  creds.profileId = stored.profileId || "";
  creds.piholeUrl    = stored.piholeUrl    || "";
  creds.piholeToken  = stored.piholeToken  || "";
  creds.controldToken     = stored.controldToken     || "";
  creds.controldProfileId = stored.controldProfileId || "";

  const local = await ext.storage.local.get(["piholeVersion"]);
  creds.piholeVersion = local.piholeVersion || null;

  // Restore UI fields
  if (creds.apiKey)   { document.getElementById("api-key-input").value = creds.apiKey; lockApiKeyField(); }
  if (creds.piholeUrl)   document.getElementById("pihole-url-input").value   = creds.piholeUrl;
  if (creds.piholeToken) document.getElementById("pihole-token-input").value = creds.piholeToken;
  if (creds.controldToken)     document.getElementById("controld-token-input").value      = creds.controldToken;
  if (creds.controldProfileId) document.getElementById("controld-profile-input").value    = creds.controldProfileId;

  document.getElementById("provider-select").value = providerKey;
  updateProviderUI(providerKey);
  if (creds.piholeVersion) updatePiholeVersionLabel(creds.piholeVersion);

  // NextDNS: auto-detect profile on load
  if (providerKey === "nextdns" && creds.apiKey) {
    fetchDeviceFingerprint().then(() => fetchAndMatchProfiles(creds.apiKey));
  }

  // DNS routing status chip
  checkDNSRouting();

  // Get active tab
  let tab;
  try {
    [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    // Tab closed or moved between query and response — bail silently
    return;
  }
  if (!tab || tab.id == null) return;
  currentTabId = tab.id;

  try {
    const hostname = new URL(tab.url).hostname;
    document.getElementById("page-host").textContent = hostname;
  } catch {
    document.getElementById("page-host").textContent = tab.url || "Unknown";
  }

  loadBlocks();

  // Close popup when the tab navigates (refresh, new URL, etc.)
  // Background sends TAB_NAVIGATED on onCommitted — works on Chrome MV3 and Firefox.
  ext.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TAB_NAVIGATED" && msg.tabId === currentTabId) {
      window.close();
    }
  });

  // Wire buttons
  document.getElementById("btn-settings").addEventListener("click", toggleSettings);
  document.getElementById("btn-clear").addEventListener("click", clearBlocks);
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-refresh-db").addEventListener("click", handleRefreshDB);

  // Theme toggle
  initThemeToggle();

  document.getElementById("btn-test-pihole").addEventListener("click", handleTestPihole);
  document.getElementById("btn-lookup-profiles").addEventListener("click", handleLookupProfiles);
  document.getElementById("btn-clear-apikey").addEventListener("click", handleClearApiKey);
  document.getElementById("btn-lookup-controld-profiles").addEventListener("click", handleLookupControldProfiles);
  document.getElementById("provider-select").addEventListener("change", e => {
    updateProviderUI(e.target.value);
  });

  // ── Disable Blocking dropdown ──
  initDisableBlockingMenu();

  // Re-check DNS routing after save
  document.getElementById("btn-save-settings").addEventListener("click", () => {
    setTimeout(checkDNSRouting, 500);
  }, { capture: true });

  ["HIGH", "MEDIUM", "LOW"].forEach(level => {
    const el = document.getElementById(`stat-${level.toLowerCase()}`).closest(".stat");
    el.addEventListener("click", () => {
      activeFilter = activeFilter === level ? null : level;
      loadBlocks();
    });
  });
});

// ── Load & Render Blocks ──────────────────────────────────────────────────────
async function loadBlocks() {
  if (currentTabId == null) return;
  const response = await sendMessage({ type: "GET_TAB_DATA", tabId: currentTabId });
  const blocks = response?.blocks || [];

  // Only clear the blocklist cache on a fresh data load (not on filter toggles).
  // Filter toggles call renderBlocks() directly with the already-fetched blocks,
  // so we track the last fetched tab to know when we actually have new data.
  if (loadBlocks._lastTabId !== currentTabId || loadBlocks._lastBlockCount !== blocks.length) {
    blocklistCache = {};
    loadBlocks._lastTabId = currentTabId;
    loadBlocks._lastBlockCount = blocks.length;
  }

  renderBlocks(blocks);

  const blockedDomains = blocks.map(b => b.domain);
  if (blockedDomains.length) {
    fetchBlocklistReasons(blockedDomains).then(() => renderBlocks(blocks));
  }
}

// ── Blocklist reason lookup ───────────────────────────────────────────────────
async function fetchBlocklistReasons(domains) {
  if (!domains.length) return;
  const provider = getProvider();
  if (!provider || !provider.hasCredentials(creds)) return;

  const result = await provider.fetchBlocklistReasons(creds, domains);
  Object.assign(blocklistCache, result);
}

// ── Display block computation (pure — no DOM, no globals) ────────────────────
// Takes the raw blocks array from the background and a blocklistCache map.
// Returns a new array with computed display classifications — originals never mutated.
// Exported via module.exports for unit testing.
function computeDisplayBlocks(blocks, cache) {
  return blocks.map(block => {
    const c = block.classification;
    let displayC = c;

    // Priority 1: confirmed by DNS provider logs
    if (!c.known && cache[block.domain]?.length) {
      displayC = { ...c, known: true, label: "Confirmed by DNS logs", confidence: "MEDIUM" };
    // Priority 2: definite or non-Safari possible block → promote to known MEDIUM
    // (real DNS block, just not in DB yet; Safari ERR_ABORTED stays unverified)
    } else if (!c.known && (block.isDefiniteBlock || (block.isPossibleBlock && !block.isSafariAbort))) {
      displayC = { ...c, known: true, label: "Unknown Domain", confidence: "MEDIUM" };
    }

    return { ...block, classification: displayC };
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
const IMPACT_LABELS = {
  login:        "⚠️ May prevent login",
  forms:        "⚠️ May break forms",
  media:        "🎬 Media may not load",
  map:          "🗺️ Map may not load",
  search:       "🔍 Search may break",
  chat:         "💬 Support chat may break",
  features:     "🚩 Feature flags affected",
  assets:       "🖼️ Assets may not load",
  monitoring:   "📊 Error monitoring blocked",
  notifications:"🔔 Notifications may break",
};

function renderImpactBadge(impact) {
  if (!impact || !IMPACT_LABELS[impact]) return null;
  const span = document.createElement("span");
  span.className = `impact-badge impact-${impact}`;
  span.textContent = IMPACT_LABELS[impact];
  return span;
}

function renderBlockedBy(domain) {
  const reasons = blocklistCache[domain];
  if (!reasons?.length) return null;
  const div = document.createElement("div");
  div.className = "block-reasons";
  reasons.forEach(r => {
    const tag = document.createElement("span");
    tag.className = "blocklist-tag";
    tag.title = r.id;
    tag.textContent = r.name;
    div.appendChild(tag);
  });
  return div;
}

function renderBlocks(blocks) {
  const listEl   = document.getElementById("blocks-list");
  const emptyEl  = document.getElementById("empty-state");
  const statsBar = document.getElementById("stats-bar");

  if (!blocks.length) {
    listEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    statsBar.classList.add("hidden");
    return;
  }

  const provider = getProvider();
  const hasCredentials = provider?.hasCredentials(creds) ?? false;

  // Build display blocks — immutable view over the raw blocks array
  const displayBlocks = computeDisplayBlocks(blocks, blocklistCache);

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  displayBlocks.sort((a, b) => {
    const co = order[a.classification.confidence] - order[b.classification.confidence];
    return co !== 0 ? co : b.count - a.count;
  });

  const highCount   = displayBlocks.filter(b => b.classification.confidence === "HIGH").length;
  const mediumCount = displayBlocks.filter(b => b.classification.confidence === "MEDIUM").length;
  const lowCount    = displayBlocks.filter(b => b.classification.confidence === "LOW").length;

  document.getElementById("stat-high").textContent   = highCount;
  document.getElementById("stat-medium").textContent = mediumCount;
  document.getElementById("stat-low").textContent    = lowCount;

  ["HIGH", "MEDIUM", "LOW"].forEach(level => {
    const el = document.getElementById(`stat-${level.toLowerCase()}`).closest(".stat");
    el.classList.toggle("stat-active",  activeFilter === level);
    el.classList.toggle("stat-dimmed", activeFilter !== null && activeFilter !== level);
  });

  statsBar.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";

  if (!hasCredentials) {
    const note = document.createElement("div");
    note.className = "no-api-key";
    const labels = {
      nextdns:  "⚙️ Add your NextDNS API key in settings to enable one-click allowlist",
      pihole:   "⚙️ Enter your Pi-hole URL and API token in settings to enable one-click allowlist",
      controld: "⚙️ Add your Control D token in settings to enable one-click allowlist",
    };
    note.textContent = labels[providerKey] || "⚙️ Configure your DNS provider in settings";
    listEl.appendChild(note);
  }

  // Split into known (confirmed) and unknown (unverified Safari aborts only)
  const knownBlocks   = displayBlocks.filter(b => b.classification.known);
  const unknownBlocks = displayBlocks.filter(b => !b.classification.known);

  const visibleKnown = activeFilter
    ? knownBlocks.filter(b => b.classification.confidence === activeFilter)
    : knownBlocks;

  function renderBlockItem(block, muted = false) {
    const conf = block.classification.known ? block.classification.confidence : "UNKNOWN";
    const item = document.createElement("div");
    item.className = "block-item" + (muted ? " block-item-unverified" : "");

    const errorShort = friendlyError(block.error);

    // confidence dot
    const dot = document.createElement("div");
    dot.className = `confidence-dot ${muted ? "UNKNOWN" : conf}`;
    item.appendChild(dot);

    // block info
    const info = document.createElement("div");
    info.className = "block-info";

    const domainEl = document.createElement("div");
    domainEl.className = "block-domain";
    domainEl.title = block.domain;
    domainEl.textContent = block.domain;
    info.appendChild(domainEl);

    const labelEl = document.createElement("div");
    labelEl.className = "block-label";
    labelEl.textContent = muted ? "Unknown domain" : block.classification.label;
    info.appendChild(labelEl);

    const meta = document.createElement("div");
    meta.className = "block-meta";
    const errorSpan = document.createElement("span");
    errorSpan.className = "block-error";
    errorSpan.textContent = errorShort;
    meta.appendChild(errorSpan);
    if (block.count > 1) {
      const countSpan = document.createElement("span");
      countSpan.className = "block-count";
      countSpan.textContent = `×${block.count}`;
      meta.appendChild(countSpan);
    }
    info.appendChild(meta);

    if (!muted) {
      const badge = renderImpactBadge(block.classification.functionalImpact);
      if (badge) info.appendChild(badge);
    }
    const blockedBy = renderBlockedBy(block.domain);
    if (blockedBy) info.appendChild(blockedBy);

    item.appendChild(info);

    // actions
    const actions = document.createElement("div");
    actions.className = "block-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.dataset.domain = block.domain;
    copyBtn.title = "Copy domain";
    copyBtn.textContent = "📋";
    actions.appendChild(copyBtn);

    const allowBtn = document.createElement("button");
    allowBtn.className = "allowlist-btn";
    allowBtn.dataset.domain = block.domain;
    if (!hasCredentials) {
      allowBtn.disabled = true;
      allowBtn.title = "Configure your DNS provider in settings";
    }
    allowBtn.textContent = "+ Allowlist";
    actions.appendChild(allowBtn);

    item.appendChild(actions);
    return item;
  }

  // ── Render known blocks ──
  let lastConfidence = null;
  for (const block of visibleKnown) {
    const conf = block.classification.confidence;
    if (conf !== lastConfidence) {
      const header = document.createElement("div");
      header.className = `section-header ${conf.toLowerCase()}`;
      const labels = {
        HIGH:   "🔴 High Risk — May Break Functionality",
        MEDIUM: "🟡 Medium — Worth Reviewing",
        LOW:    "🟢 Low — Analytics & Ads (Safe to Ignore)",
      };
      header.textContent = labels[conf];
      listEl.appendChild(header);
      lastConfidence = conf;
    }
    listEl.appendChild(renderBlockItem(block, false));
  }

  // ── Render unverified aborts (unknown domains, Safari only) ──
  if (unknownBlocks.length && (!activeFilter || activeFilter === "MEDIUM")) {
    const header = document.createElement("div");
    header.className = "section-header unverified";
    header.textContent = "⚪ Unverified — Aborted Requests";
    listEl.appendChild(header);

    const disclaimer = document.createElement("div");
    disclaimer.className = "unverified-disclaimer";
    disclaimer.textContent = "These requests were aborted — may be DNS blocks or cancelled by the browser.";
    listEl.appendChild(disclaimer);

    for (const block of unknownBlocks) {
      listEl.appendChild(renderBlockItem(block, true));
    }
  }

  listEl.querySelectorAll(".allowlist-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => addToAllowlist(btn));
  });
  listEl.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => copyDomain(btn));
  });
}

// ── DNS Flush Banner ──────────────────────────────────────────────────────────
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function getDNSFlushCommand() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return null;
  if (ua.includes("Mac"))  return "sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder";
  if (ua.includes("Win"))  return "ipconfig /flushdns";
  return "sudo systemd-resolve --flush-caches  # or: sudo service nscd restart";
}

function showFlushBanner(title = "✓ Added — flush DNS to apply") {
  const banner  = document.getElementById("flush-banner");
  const titleEl = document.querySelector(".flush-banner-title");
  const cmdEl   = document.getElementById("flush-cmd");
  const copyBtn = document.getElementById("flush-copy");
  const dismiss = document.getElementById("flush-dismiss");
  if (!banner) return;

  titleEl.textContent = title;

  if (isAndroid()) {
    cmdEl.textContent = "Toggle Airplane Mode → wait 5 seconds → toggle back. Or close and reopen Firefox. This forces Android to re-resolve blocked domains.";
    copyBtn.style.display = "none";
  } else {
    copyBtn.style.display = "";
    const cmd = getDNSFlushCommand();
    cmdEl.textContent = cmd;
    copyBtn.textContent = "Copy";
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(cmd);
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1500);
      } catch (_) {}
    };
  }

  banner.classList.remove("hidden");
  dismiss.onclick = () => banner.classList.add("hidden");
}

// ── Copy to clipboard ─────────────────────────────────────────────────────────
async function copyDomain(btn) {
  showFlushBanner("📋 Copied — flush DNS after adding to your blocker");
  const domain = btn.dataset.domain;
  if (!domain) return;
  try {
    await navigator.clipboard.writeText(domain);
    const orig = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copy-success");
    setTimeout(() => { btn.textContent = orig; btn.classList.remove("copy-success"); }, 1500);
  } catch (_) {
    btn.textContent = "✗";
    setTimeout(() => { btn.textContent = "📋"; }, 1500);
  }
}

// ── Allowlist ─────────────────────────────────────────────────────────────────
async function addToAllowlist(btn) {
  const domain = btn.dataset.domain;
  const provider = getProvider();
  if (!domain || !provider?.hasCredentials(creds)) return;

  btn.disabled = true;
  btn.textContent = "Adding...";

  const result = await provider.allowlistDomain(creds, domain);

  if (result.ok) {
    btn.textContent = "✓ Added";
    btn.classList.add("success");
    showFlushBanner();
  } else {
    btn.textContent = "✗ Failed";
    btn.title = result.error || "Unknown error";
    setTimeout(() => { btn.textContent = "+ Allowlist"; btn.title = ""; btn.disabled = false; }, 3000);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function toggleSettings() {
  if (profilesList.length > 0) {
    const fingerprintMatch = detectedFingerprint
      ? profilesList.find(p => p.fingerprint === detectedFingerprint) : null;
    renderProfileList(fingerprintMatch?.id || null);
  }
  if (controldProfilesList.length > 0) {
    renderControldProfileList(controldProfilesList, creds.controldToken);
  }
  const panel = document.getElementById("settings-panel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) await refreshDBMeta();
}

async function refreshDBMeta() {
  const meta = await sendMessage({ type: "GET_DB_META" });
  if (!meta) return;
  const el = document.getElementById("db-meta-label");
  if (!el) return;
  if (meta.source === "empty") {
    el.textContent = "⚠ DB failed to load — click Refresh";
    el.style.color = "#f87171";
  } else if (meta.source === "bundled") {
    el.textContent = `Bundled DB • ${meta.count} entries`;
    el.style.color = "";
  } else {
    const age = meta.fetchedAt ? Math.floor((Date.now() - meta.fetchedAt) / 86400000) : "?";
    const ageStr = age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`;
    el.textContent = `${meta.source === "remote" ? "Remote" : "Cached"} DB v${meta.version} • ${meta.count} entries • fetched ${ageStr}`;
    el.style.color = "";
  }
  await buildBugReportLink(meta);
}

async function buildBugReportLink(dbMeta) {
  const btn = document.getElementById("btn-report-bug");
  if (!btn) return;

  // Gather diagnostic info
  const manifest  = (typeof chrome !== "undefined" && chrome.runtime?.getManifest)
                    ? chrome.runtime.getManifest()
                    : (typeof browser !== "undefined" && browser.runtime?.getManifest ? browser.runtime.getManifest() : {});
  const version   = manifest.version || "unknown";
  const ua        = navigator.userAgent;
  const provider  = providerKey || "none";
  const dbStr     = dbMeta
                    ? `${dbMeta.source === "bundled" ? "Bundled" : "Remote"} v${dbMeta.version || "?"}, ${dbMeta.count || "?"} entries`
                    : "unknown";

  // Fetch recent error log from background
  const errorLog  = await sendMessage({ type: "GET_ERROR_LOG" }) || [];
  const errorStr  = errorLog.length
                    ? errorLog.map(e => `[${e.ts}] ${e.ctx}: ${e.msg}`).join("\n")
                    : "None";

  const body = [
    `**Extension version:** ${version}`,
    `**Browser:** ${ua}`,
    `**DNS provider:** ${provider}`,
    `**Domain database:** ${dbStr}`,
    ``,
    `**Describe the bug:**`,
    `<!-- What happened? What did you expect? -->`,
    ``,
    `**Steps to reproduce:**`,
    `1. `,
    `2. `,
    ``,
    `**Background error log:**`,
    "```",
    errorStr,
    "```",
    ``,
    `**Console errors (if any):**`,
    `<!-- Chrome: chrome://extensions → DNS Medic → Inspect views: background page → Console`,
    `     Firefox: about:debugging → This Firefox → DNS Medic → Inspect → Console -->`,
  ].join("\n");

  const url = `https://github.com/jstoneky/nextdns-medic/issues/new?template=bug_report.md&title=%5BBug%5D+&body=${encodeURIComponent(body)}`;
  btn.href = url;
}

function updateProviderUI(selected) {
  document.getElementById("provider-nextdns").classList.toggle("hidden",  selected !== "nextdns");
  document.getElementById("provider-pihole").classList.toggle("hidden",   selected !== "pihole");
  document.getElementById("provider-controld").classList.toggle("hidden", selected !== "controld");
  document.getElementById("disable-blocking-wrap").classList.toggle("hidden", selected !== "pihole");
}

// ── Disable Blocking Menu ────────────────────────────────────────────────────
let blockingState = { blocking: true, timer: null }; // current Pi-hole blocking status
let countdownInterval = null;
let countdownEnd = null; // epoch ms when timer expires

function formatCountdown(seconds) {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function updateBlockingButton() {
  const btn = document.getElementById("btn-disable-blocking");
  const menu = document.getElementById("disable-blocking-menu");
  if (!btn || !menu) return;

  // Update button appearance
  if (blockingState.blocking) {
    btn.textContent = "🛡️";
    btn.title = "Blocking enabled — click to disable";
    btn.classList.remove("blocking-disabled");
  } else {
    if (countdownEnd) {
      const remaining = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000));
      btn.textContent = formatCountdown(remaining);
      btn.title = `Blocking disabled — ${formatCountdown(remaining)} remaining`;
    } else {
      btn.textContent = "🛡️‼";
      btn.title = "Blocking disabled indefinitely";
    }
    btn.classList.add("blocking-disabled");
  }

  // Update menu items visibility
  const disableItems = menu.querySelectorAll(".disable-menu-item[data-seconds]");
  const customTrigger = menu.querySelector(".disable-menu-custom-trigger");
  const customRow = menu.querySelector(".disable-menu-custom-row");
  const enableItem = menu.querySelector(".enable-menu-item");

  if (blockingState.blocking) {
    // Blocking is ON — show disable options, hide enable
    disableItems.forEach(el => el.classList.remove("hidden"));
    if (customTrigger) customTrigger.classList.remove("hidden");
    if (enableItem) enableItem.classList.add("hidden");
  } else {
    // Blocking is OFF — hide disable options, show enable
    disableItems.forEach(el => el.classList.add("hidden"));
    if (customTrigger) customTrigger.classList.add("hidden");
    if (customRow) customRow.classList.add("hidden");
    if (enableItem) enableItem.classList.remove("hidden");
  }
}

function startCountdown(seconds) {
  stopCountdown();
  if (!seconds || seconds <= 0) return;
  countdownEnd = Date.now() + seconds * 1000;
  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000));
    if (remaining <= 0) {
      stopCountdown();
      blockingState.blocking = true;
      blockingState.timer = null;
      updateBlockingButton();
      return;
    }
    updateBlockingButton();
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownEnd = null;
}

async function fetchBlockingStatus() {
  const pihole = window.NDMProviders?.pihole;
  if (!pihole || providerKey !== "pihole" || !pihole.hasCredentials(creds)) return;

  const result = await pihole.getBlocking(creds);
  if (!result.ok) return;

  blockingState.blocking = result.blocking;
  blockingState.timer = result.timer || null;

  stopCountdown();
  if (!result.blocking && result.timer > 0) {
    startCountdown(result.timer);
  }

  updateBlockingButton();
}

function initDisableBlockingMenu() {
  const btn = document.getElementById("btn-disable-blocking");
  const menu = document.getElementById("disable-blocking-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  // Close menu on outside click
  document.addEventListener("click", () => menu.classList.add("hidden"));
  menu.addEventListener("click", (e) => e.stopPropagation());

  // Preset duration items
  menu.querySelectorAll(".disable-menu-item[data-seconds]").forEach(item => {
    item.addEventListener("click", () => {
      const seconds = parseInt(item.dataset.seconds, 10);
      triggerDisableBlocking(seconds);
      menu.classList.add("hidden");
    });
  });

  // Enable blocking item
  menu.querySelector(".enable-menu-item")?.addEventListener("click", () => {
    triggerEnableBlocking();
    menu.classList.add("hidden");
  });

  // Custom trigger
  const customTrigger = menu.querySelector(".disable-menu-custom-trigger");
  const customRow = menu.querySelector(".disable-menu-custom-row");
  customTrigger.addEventListener("click", () => {
    customRow.classList.toggle("hidden");
    if (!customRow.classList.contains("hidden")) {
      document.getElementById("disable-custom-seconds").focus();
    }
  });

  document.getElementById("disable-custom-go").addEventListener("click", () => {
    const val = parseInt(document.getElementById("disable-custom-seconds").value, 10);
    if (val > 0) {
      triggerDisableBlocking(val);
      menu.classList.add("hidden");
      customRow.classList.add("hidden");
    }
  });

  document.getElementById("disable-custom-seconds").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("disable-custom-go").click();
  });

  // Fetch initial status
  fetchBlockingStatus();
}

async function triggerDisableBlocking(seconds) {
  const pihole = window.NDMProviders?.pihole;
  if (!pihole) return;

  const btn = document.getElementById("btn-disable-blocking");
  btn.textContent = "⏳";
  btn.disabled = true;

  const timer = seconds > 0 ? seconds : undefined;
  const result = await pihole.disableBlocking(creds, timer);

  btn.disabled = false;

  if (result.ok) {
    blockingState.blocking = false;
    const remaining = result.timer || timer || null;
    blockingState.timer = remaining;
    stopCountdown();
    if (remaining) startCountdown(remaining);
    updateBlockingButton();
  } else {
    btn.textContent = "✗";
    btn.title = result.error || "Failed to disable blocking";
    setTimeout(() => updateBlockingButton(), 2000);
  }
}

async function triggerEnableBlocking() {
  const pihole = window.NDMProviders?.pihole;
  if (!pihole) return;

  const btn = document.getElementById("btn-disable-blocking");
  btn.textContent = "⏳";
  btn.disabled = true;

  const result = await pihole.enableBlocking(creds);

  btn.disabled = false;

  if (result.ok) {
    blockingState.blocking = true;
    blockingState.timer = null;
    stopCountdown();
    updateBlockingButton();
  } else {
    btn.textContent = "✗";
    btn.title = result.error || "Failed to enable blocking";
    setTimeout(() => updateBlockingButton(), 2000);
  }
}

function updatePiholeVersionLabel(version) {
  const el = document.getElementById("pihole-version-label");
  if (!el) return;
  el.textContent = version ? `Pi-hole v${version} detected` : "";
  el.className = "pihole-version-label" + (version ? " detected" : "");
}

// ── API Key (NextDNS) lock/clear ──────────────────────────────────────────────
function lockApiKeyField() {
  const input = document.getElementById("api-key-input");
  const btn   = document.getElementById("btn-clear-apikey");
  input.readOnly = true;
  input.classList.add("locked");
  btn.classList.remove("hidden");
}

function unlockApiKeyField() {
  const input = document.getElementById("api-key-input");
  const btn   = document.getElementById("btn-clear-apikey");
  input.readOnly = false;
  input.classList.remove("locked");
  btn.classList.add("hidden");
  input.value = "";
  input.focus();
}

async function handleClearApiKey() {
  creds.apiKey    = "";
  creds.profileId = "";
  profilesList = [];
  detectedFingerprint = null;
  detectedDeviceName  = null;
  profilesFetchInFlight = false;

  await ext.storage.sync.remove(["apiKey", "profileId"]);
  await ext.storage.local.remove(["piholeVersion", "ndm_dbCache"]);

  unlockApiKeyField();
  document.getElementById("ndm-profile-section").classList.add("hidden");
  document.getElementById("ndm-profile-list").innerHTML = "";
}

// ── Pi-hole test connection ───────────────────────────────────────────────────
async function handleTestPihole() {
  const btn = document.getElementById("btn-test-pihole");
  const versionLabel = document.getElementById("pihole-version-label");
  const url = document.getElementById("pihole-url-input").value;
  const token = document.getElementById("pihole-token-input").value.trim();

  if (!url || !token) {
    versionLabel.textContent = "Enter URL and token first";
    versionLabel.className = "pihole-version-label error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Testing...";
  versionLabel.textContent = "";
  versionLabel.className = "pihole-version-label";

  const pihole = window.NDMProviders?.pihole;
  const result = await pihole.testConnection({ piholeUrl: url, piholeToken: token });

  if (result.ok) {
    creds.piholeVersion = result.version;
    await ext.storage.local.set({ piholeVersion: result.version });
    versionLabel.textContent = `✓ Connected (Pi-hole v${result.version})`;
    versionLabel.className = "pihole-version-label success";
  } else {
    versionLabel.textContent = `✗ ${result.error || "Connection failed"}`;
    versionLabel.className = "pihole-version-label error";
  }

  btn.disabled = false;
  btn.textContent = "Test Connection";
}

// ── Control D profile lookup ──────────────────────────────────────────────────
async function handleLookupControldProfiles() {
  const btn = document.getElementById("btn-lookup-controld-profiles");
  const errEl = document.getElementById("controld-token-error");
  const token = document.getElementById("controld-token-input").value.trim();
  if (!token) return;

  btn.disabled = true;
  btn.textContent = "…";
  errEl?.classList.add("hidden");

  const controld = window.NDMProviders?.controld;
  const profiles = await controld.fetchProfiles({ controldToken: token });

  btn.disabled = false;
  btn.textContent = "→";

  if (!profiles) {
    if (errEl) { errEl.textContent = "✗ Invalid token or CORS error"; errEl.classList.remove("hidden"); }
    setTimeout(() => errEl?.classList.add("hidden"), 3000);
    return;
  }

  controldProfilesList = profiles;
  renderControldProfileList(profiles, token);
}

function renderControldProfileList(profiles, token) {
  const section = document.getElementById("controld-profile-section");
  const list = document.getElementById("controld-profile-list");
  if (!section || !list) return;
  if (!profiles.length) { section.classList.add("hidden"); return; }

  list.textContent = "";
  profiles.forEach(p => {
    const isSelected = p.id === creds.controldProfileId;
    const item = document.createElement("div");
    item.className = "ndm-profile-item" + (isSelected ? " selected" : "");
    item.dataset.id = p.id;

    const infoDiv = document.createElement("div");
    infoDiv.className = "ndm-profile-item-info";
    const nameSpan = document.createElement("span");
    nameSpan.className = "ndm-profile-item-name";
    nameSpan.textContent = p.name;
    const idSpan = document.createElement("span");
    idSpan.className = "ndm-profile-item-id";
    idSpan.textContent = p.id;
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(idSpan);

    const rightDiv = document.createElement("div");
    rightDiv.className = "ndm-profile-item-right";
    if (isSelected) {
      const check = document.createElement("span");
      check.className = "ndm-profile-item-check";
      check.textContent = "✓";
      rightDiv.appendChild(check);
    }

    item.appendChild(infoDiv);
    item.appendChild(rightDiv);
    item.addEventListener("click", () => {
      creds.controldProfileId = item.dataset.id;
      document.getElementById("controld-profile-input").value = item.dataset.id;
      renderControldProfileList(profiles, token);
    });
    list.appendChild(item);
  });

  section.classList.remove("hidden");
}

// ── NextDNS Profile Auto-detect ───────────────────────────────────────────────
async function fetchDeviceFingerprint() {
  const nextdns = window.NDMProviders?.nextdns;
  if (!nextdns) return;
  const result = await nextdns.detectDeviceFingerprint();
  detectedFingerprint = result.fingerprint;
  detectedDeviceName  = result.deviceName;
}

async function fetchAndMatchProfiles(key) {
  if (profilesFetchInFlight) return;
  profilesFetchInFlight = true;
  try {
    const nextdns = window.NDMProviders?.nextdns;
    const profiles = await nextdns.fetchProfiles({ apiKey: key });
    if (!profiles) return;
    profilesList = profiles;

    const fingerprintMatch = detectedFingerprint
      ? profilesList.find(p => p.fingerprint === detectedFingerprint) : null;
    const savedMatch = creds.profileId
      ? profilesList.find(p => p.id === creds.profileId) : null;
    const autoSelect = fingerprintMatch || savedMatch || profilesList[0] || null;
    if (autoSelect) creds.profileId = autoSelect.id;

    renderProfileList(fingerprintMatch?.id || null);
  } finally {
    profilesFetchInFlight = false;
  }
}

function renderProfileList(activeId) {
  const section = document.getElementById("ndm-profile-section");
  const list    = document.getElementById("ndm-profile-list");
  if (!profilesList.length) { section.classList.add("hidden"); return; }

  list.textContent = "";
  profilesList.forEach(p => {
    const isDevice   = p.id === activeId;
    const isSelected = p.id === creds.profileId;
    const item = document.createElement("div");
    item.className = "ndm-profile-item" + (isSelected ? " selected" : "");
    item.dataset.id = p.id;

    const infoDiv = document.createElement("div");
    infoDiv.className = "ndm-profile-item-info";
    const nameSpan = document.createElement("span");
    nameSpan.className = "ndm-profile-item-name";
    nameSpan.textContent = p.name;
    const idSpan = document.createElement("span");
    idSpan.className = "ndm-profile-item-id";
    idSpan.textContent = p.id;
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(idSpan);

    const rightDiv = document.createElement("div");
    rightDiv.className = "ndm-profile-item-right";
    if (isDevice) {
      const badge = document.createElement("span");
      badge.className = "ndm-profile-item-badge";
      badge.textContent = "This device";
      rightDiv.appendChild(badge);
    }
    if (isSelected) {
      const check = document.createElement("span");
      check.className = "ndm-profile-item-check";
      check.textContent = "✓";
      rightDiv.appendChild(check);
    }

    item.appendChild(infoDiv);
    item.appendChild(rightDiv);
    item.addEventListener("click", () => {
      creds.profileId = item.dataset.id;
      renderProfileList(activeId);
    });
    list.appendChild(item);
  });

  section.classList.remove("hidden");
}

async function handleLookupProfiles() {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;
  const btn   = document.getElementById("btn-lookup-profiles");
  const errEl = document.getElementById("api-key-error");

  btn.textContent = "…";
  btn.disabled = true;
  errEl.classList.add("hidden");

  const nextdns = window.NDMProviders?.nextdns;
  const valid = await nextdns.validateCredentials({ apiKey: key });

  if (valid === false) {
    btn.textContent = "→";
    btn.disabled = false;
    errEl.textContent = "✗ Invalid API key";
    errEl.classList.remove("hidden");
    setTimeout(() => { errEl.classList.add("hidden"); errEl.textContent = ""; }, 3000);
    return;
  }

  profilesFetchInFlight = false;
  await fetchDeviceFingerprint();
  await fetchAndMatchProfiles(key);
  btn.textContent = "→";
  btn.disabled = false;
  lockApiKeyField();
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────
function initThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  // Load current preference and highlight active button
  ext.storage.sync.get(["themePreference"], function(result) {
    const pref = result.themePreference || "system";
    setActiveThemeBtn(pref);
  });

  // Handle button clicks
  toggle.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const pref = this.dataset.theme;
      await ext.storage.sync.set({ themePreference: pref });
      setActiveThemeBtn(pref);
      // applyTheme is called via storage.onChanged in platform-detect.js
      // but call directly here too for immediate response
      if (typeof applyTheme === "function") {
        applyTheme(pref);
      } else {
        // Fallback: apply inline
        const preferLight = window.matchMedia("(prefers-color-scheme: light)").matches;
        const useLightMode = (pref === "light") || (pref === "system" && preferLight);
        document.body.classList.toggle("light-mode", useLightMode);
      }
    });
  });
}

function setActiveThemeBtn(pref) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  toggle.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === pref);
  });
}

// ── Save Settings ─────────────────────────────────────────────────────────────
async function saveSettings() {
  const newProvider       = document.getElementById("provider-select").value;
  const newApiKey         = document.getElementById("api-key-input").value.trim();
  const newPiholeUrl      = (document.getElementById("pihole-url-input").value || "").replace(/\/+$/, "").trim();
  const newPiholeToken    = document.getElementById("pihole-token-input").value.trim();
  const newControldToken  = document.getElementById("controld-token-input").value.trim();
  const newControldProfileId = document.getElementById("controld-profile-input").value.trim();
  const status = document.getElementById("settings-status");

  // Validate NextDNS key before saving
  if (newProvider === "nextdns" && newApiKey) {
    status.textContent = "Validating…";
    status.style.color = "";
    const nextdns = window.NDMProviders?.nextdns;
    const valid = await nextdns.validateCredentials({ apiKey: newApiKey });
    if (valid === false) {
      status.textContent = "✗ Invalid API key";
      status.style.color = "#f87171";
      setTimeout(() => { status.textContent = ""; status.style.color = ""; }, 3000);
      return;
    }
    if (valid === null) {
      status.textContent = "⚠ Network error — saved anyway";
      status.style.color = "#fbbf24";
      setTimeout(() => { status.textContent = ""; status.style.color = ""; }, 3000);
    }
  }

  await ext.storage.sync.set({
    provider: newProvider,
    apiKey: newApiKey,
    profileId: creds.profileId,
    piholeUrl: newPiholeUrl,
    piholeToken: newPiholeToken,
    controldToken: newControldToken,
    controldProfileId: newControldProfileId,
  });

  providerKey = newProvider;
  creds.apiKey    = newApiKey;
  creds.piholeUrl    = newPiholeUrl;
  creds.piholeToken  = newPiholeToken;
  creds.controldToken     = newControldToken;
  creds.controldProfileId = newControldProfileId;

  if (newApiKey && newProvider === "nextdns") lockApiKeyField();

  status.style.color = "#4ade80";
  status.textContent = "✓ Saved";
  setTimeout(() => { status.textContent = ""; status.style.color = ""; }, 1200);
  loadBlocks();
}

// ── Clear ─────────────────────────────────────────────────────────────────────
async function clearBlocks() {
  await sendMessage({ type: "CLEAR_TAB_DATA", tabId: currentTabId });
  loadBlocks();
}

// ── DB Refresh ────────────────────────────────────────────────────────────────
async function handleRefreshDB() {
  const btn   = document.getElementById("btn-refresh-db");
  const label = document.getElementById("db-meta-label");
  btn.disabled = true;
  btn.textContent = "Refreshing...";
  label.textContent = "Fetching from GitHub...";

  const result = await sendMessage({ type: "REFRESH_DB" });

  if (result?.ok) {
    btn.textContent = "✓ Updated";
    await refreshDBMeta();
    setTimeout(() => { btn.textContent = "↻ Refresh"; btn.disabled = false; }, 2000);
  } else {
    btn.textContent = "✗ Failed";
    label.textContent = result?.error || "Unknown error";
    setTimeout(() => { btn.textContent = "↻ Refresh"; btn.disabled = false; }, 2500);
  }
}

if (typeof module !== "undefined") {
  module.exports = { computeDisplayBlocks };
}
