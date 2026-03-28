// DNS Medic — Popup Script (v3.0 — multi-provider)

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
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTabId = tab.id;

  try {
    const hostname = new URL(tab.url).hostname;
    document.getElementById("page-host").textContent = hostname;
  } catch {
    document.getElementById("page-host").textContent = tab.url || "Unknown";
  }

  loadBlocks();

  // Wire buttons
  document.getElementById("btn-settings").addEventListener("click", toggleSettings);
  document.getElementById("btn-clear").addEventListener("click", clearBlocks);
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-refresh-db").addEventListener("click", handleRefreshDB);
  document.getElementById("btn-test-pihole").addEventListener("click", handleTestPihole);
  document.getElementById("btn-lookup-profiles").addEventListener("click", handleLookupProfiles);
  document.getElementById("btn-clear-apikey").addEventListener("click", handleClearApiKey);
  document.getElementById("btn-lookup-controld-profiles").addEventListener("click", handleLookupControldProfiles);
  document.getElementById("provider-select").addEventListener("change", e => {
    updateProviderUI(e.target.value);
  });

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
  const response = await sendMessage({ type: "GET_TAB_DATA", tabId: currentTabId });
  const blocks = response?.blocks || [];
  blocklistCache = {};
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
  if (!impact || !IMPACT_LABELS[impact]) return "";
  return `<span class="impact-badge impact-${impact}">${IMPACT_LABELS[impact]}</span>`;
}

function renderBlockedBy(domain) {
  const reasons = blocklistCache[domain];
  if (!reasons?.length) return "";
  return `<div class="block-reasons">${
    reasons.map(r => `<span class="blocklist-tag" title="${r.id}">${r.name}</span>`).join("")
  }</div>`;
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

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  blocks.sort((a, b) => {
    const co = order[a.classification.confidence] - order[b.classification.confidence];
    return co !== 0 ? co : b.count - a.count;
  });

  const highCount   = blocks.filter(b => b.classification.confidence === "HIGH").length;
  const mediumCount = blocks.filter(b => b.classification.confidence === "MEDIUM").length;
  const lowCount    = blocks.filter(b => b.classification.confidence === "LOW").length;

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

  const provider = getProvider();
  const hasCredentials = provider?.hasCredentials(creds) ?? false;

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

  const visibleBlocks = activeFilter
    ? blocks.filter(b => b.classification.confidence === activeFilter)
    : blocks;

  let lastConfidence = null;

  for (const block of visibleBlocks) {
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

    const item = document.createElement("div");
    item.className = "block-item";

    const errorShort = block.error
      .replace("net::", "")
      .replace("ERR_", "")
      .replace(/_/g, " ")
      .toLowerCase();

    item.innerHTML = `
      <div class="confidence-dot ${conf}"></div>
      <div class="block-info">
        <div class="block-domain" title="${block.domain}">${block.domain}</div>
        <div class="block-label">${block.classification.label}</div>
        <div class="block-meta">
          <span class="block-error">${errorShort}</span>
          ${block.count > 1 ? `<span class="block-count">×${block.count}</span>` : ""}
        </div>
        ${renderImpactBadge(block.classification.functionalImpact)}
        ${renderBlockedBy(block.domain)}
      </div>
      <div class="block-actions">
        <button class="copy-btn" data-domain="${block.domain}" title="Copy domain">📋</button>
        <button class="allowlist-btn" data-domain="${block.domain}" ${!hasCredentials ? "disabled title='Configure your DNS provider in settings'" : ""}>
          + Allowlist
        </button>
      </div>
    `;

    listEl.appendChild(item);
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
  if (meta.source === "bundled") {
    el.textContent = `Bundled DB • ${meta.count} entries`;
  } else {
    const age = meta.fetchedAt ? Math.floor((Date.now() - meta.fetchedAt) / 86400000) : "?";
    const ageStr = age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`;
    el.textContent = `${meta.source === "remote" ? "Remote" : "Cached"} DB v${meta.version} • ${meta.count} entries • fetched ${ageStr}`;
  }
}

function updateProviderUI(selected) {
  document.getElementById("provider-nextdns").classList.toggle("hidden",  selected !== "nextdns");
  document.getElementById("provider-pihole").classList.toggle("hidden",   selected !== "pihole");
  document.getElementById("provider-controld").classList.toggle("hidden", selected !== "controld");
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

  list.innerHTML = profiles.map(p => {
    const isSelected = p.id === creds.controldProfileId;
    return `<div class="ndm-profile-item${isSelected ? " selected" : ""}" data-id="${p.id}">
      <div class="ndm-profile-item-info">
        <span class="ndm-profile-item-name">${p.name}</span>
        <span class="ndm-profile-item-id">${p.id}</span>
      </div>
      <div class="ndm-profile-item-right">
        ${isSelected ? `<span class="ndm-profile-item-check">✓</span>` : ""}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".ndm-profile-item").forEach(el => {
    el.addEventListener("click", () => {
      creds.controldProfileId = el.dataset.id;
      document.getElementById("controld-profile-input").value = el.dataset.id;
      renderControldProfileList(profiles, token);
    });
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

  list.innerHTML = profilesList.map(p => {
    const isDevice   = p.id === activeId;
    const isSelected = p.id === creds.profileId;
    return `
      <div class="ndm-profile-item${isSelected ? " selected" : ""}" data-id="${p.id}">
        <div class="ndm-profile-item-info">
          <span class="ndm-profile-item-name">${p.name}</span>
          <span class="ndm-profile-item-id">${p.id}</span>
        </div>
        <div class="ndm-profile-item-right">
          ${isDevice   ? `<span class="ndm-profile-item-badge">This device</span>` : ""}
          ${isSelected ? `<span class="ndm-profile-item-check">✓</span>` : ""}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".ndm-profile-item").forEach(el => {
    el.addEventListener("click", () => {
      creds.profileId = el.dataset.id;
      renderProfileList(activeId);
    });
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
