// NextDNS Monitor — Popup Script

const NEXTDNS_API = "https://api.nextdns.io";

let currentTabId = null;
let apiKey = "";
let profileId = "";
let activeFilter = null; // "HIGH" | "MEDIUM" | "LOW" | null
let provider = "nextdns"; // "nextdns" | "pihole"
let piholeUrl = "";
let piholeToken = "";
let piholeVersion = null; // 5 | 6 | null (cached detection result)
let detectedFingerprint   = null;
let detectedDeviceName    = null;
let profilesList          = []; // [{ id, name, fingerprint }]
let profilesFetchInFlight = false;
let blocklistCache        = {}; // domain → [{ id, name }] — cleared on each popup open

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Load settings
  const stored = await ext.storage.sync.get(["apiKey", "profileId", "provider", "piholeUrl", "piholeToken"]);
  apiKey     = stored.apiKey     || "";
  profileId  = stored.profileId  || "";
  provider   = stored.provider   || "nextdns";
  piholeUrl  = stored.piholeUrl  || "";
  piholeToken = stored.piholeToken || "";

  // Restore cached version detection from local storage
  const local = await ext.storage.local.get(["piholeVersion"]);
  piholeVersion = local.piholeVersion || null;

  if (apiKey) {
    document.getElementById("api-key-input").value = apiKey;
    lockApiKeyField();
    // Silently restore profile list in background (no spinner)
    fetchDeviceFingerprint().then(() => fetchAndMatchProfiles(apiKey));
  }
  // profileId is managed in memory; no input field to sync
  if (piholeUrl)   document.getElementById("pihole-url-input").value = piholeUrl;
  if (piholeToken) document.getElementById("pihole-token-input").value = piholeToken;

  document.getElementById("provider-select").value = provider;
  updateProviderUI(provider);
  if (piholeVersion) updatePiholeVersionLabel(piholeVersion);

  // Auto-detect profile on load if NextDNS and API key already saved
  if (provider === "nextdns" && apiKey) {
    await fetchDeviceFingerprint();
    await fetchAndMatchProfiles(apiKey);
  }

  // Get active tab
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;

  // Set page host in header
  try {
    const hostname = new URL(tab.url).hostname;
    document.getElementById("page-host").textContent = hostname;
  } catch {
    document.getElementById("page-host").textContent = tab.url || "Unknown";
  }

  // Load blocked domains for this tab
  loadBlocks();

  // Wire up buttons
  document.getElementById("btn-settings").addEventListener("click", toggleSettings);
  document.getElementById("btn-clear").addEventListener("click", clearBlocks);
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-refresh-db").addEventListener("click", handleRefreshDB);
  document.getElementById("btn-test-pihole").addEventListener("click", handleTestPihole);
  document.getElementById("provider-select").addEventListener("change", e => {
    updateProviderUI(e.target.value);
  });
  document.getElementById("btn-lookup-profiles").addEventListener("click", handleLookupProfiles);
  document.getElementById("btn-clear-apikey").addEventListener("click", handleClearApiKey);

  // Filter by confidence level on stat click
  ["HIGH", "MEDIUM", "LOW"].forEach(level => {
    const el = document.getElementById(`stat-${level.toLowerCase()}`).closest(".stat");
    el.addEventListener("click", () => {
      activeFilter = activeFilter === level ? null : level;
      loadBlocks();
    });
  });
});

// ── Load & Render Blocks ──────────────────────────────────────────────────────
// Messaging helper — Firefox browser.* is Promise-based; Chrome uses callbacks.
// Check for real `browser` (Firefox) first; fall back to chrome callback style.
function sendMessage(msg) {
  if (typeof browser !== "undefined" && browser.runtime) {
    // Firefox: browser.runtime.sendMessage returns a native Promise
    return browser.runtime.sendMessage(msg).catch(() => null);
  }
  // Chrome: callback-based
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

async function loadBlocks() {
  const response = await sendMessage({ type: "GET_TAB_DATA", tabId: currentTabId });
  const blocks = response?.blocks || [];
  blocklistCache = {}; // reset on each load
  renderBlocks(blocks);

  // Fetch blocklist reasons in background, then re-render
  const blockedDomains = blocks.map(b => b.domain);
  if (blockedDomains.length) {
    fetchBlocklistReasons(blockedDomains).then(() => renderBlocks(blocks));
  }
}

// ── Blocklist reason lookup ───────────────────────────────────────────────────
async function fetchBlocklistReasons(domains) {
  if (!domains.length) return;

  if (provider === "nextdns" && apiKey && profileId) {
    await fetchNextDNSReasons(domains);
  } else if (provider === "pihole" && piholeUrl && piholeToken) {
    await fetchPiholeReasons(domains);
  }
}

async function fetchNextDNSReasons(domains) {
  const domainSet = new Set(domains);
  let fetched = 0;
  let cursor  = null;

  // Fetch up to 1000 recent blocked entries (paginate if needed)
  while (domainSet.size > 0 && fetched < 1000) {
    const url = `https://api.nextdns.io/profiles/${profileId}/logs?status=blocked&limit=1000${cursor ? `&cursor=${cursor}` : ""}`;
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) break;
      const data = await res.json();
      const entries = data.data || [];
      fetched += entries.length;

      for (const entry of entries) {
        if (domainSet.has(entry.domain) && entry.reasons?.length) {
          blocklistCache[entry.domain] = entry.reasons;
          domainSet.delete(entry.domain);
        }
      }

      // Stop if all found or no more pages
      cursor = data.meta?.cursor || null;
      if (!cursor || !entries.length) break;
    } catch (_) { break; }
  }
}

// Pretty display names for common Pi-hole blocklist URLs
const PIHOLE_LIST_NAMES = {
  // Steven Black
  "raw.githubusercontent.com/StevenBlack/hosts/master/hosts":                        "Steven Black Unified",
  "raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts": "Steven Black (Extended)",
  // HaGeZi
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/multi.txt":             "HaGeZi — Multi",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/pro.txt":               "HaGeZi — Pro",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/pro.plus.txt":          "HaGeZi — Pro++",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/ultimate.txt":          "HaGeZi — Ultimate",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/tif.txt":               "HaGeZi — Threat Intelligence",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/multi.txt":           "HaGeZi — Multi (adblock)",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.plus.txt":        "HaGeZi — Pro++ (adblock)",
  "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/ultimate.txt":        "HaGeZi — Ultimate (adblock)",
  // OISD
  "dbl.oisd.nl":                                                                       "OISD Full",
  "dbl.oisd.nl/basic":                                                                 "OISD Basic",
  "small.oisd.nl":                                                                     "OISD Small",
  // AdGuard
  "adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt":                       "AdGuard DNS filter",
  "raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt": "AdGuard DNS filter",
  // EasyList / EasyPrivacy
  "easylist-downloads.adblockplus.org/easylist.txt":                                   "EasyList",
  "easylist-downloads.adblockplus.org/easyprivacy.txt":                                "EasyPrivacy",
  "raw.githubusercontent.com/easylist/easylist/master/easylist.txt":                  "EasyList",
  "raw.githubusercontent.com/easylist/easylist/master/easyprivacy.txt":               "EasyPrivacy",
  // Disconnect
  "s3.amazonaws.com/lists.disconnect.me/simple_ad.txt":                               "Disconnect.me Ads",
  "s3.amazonaws.com/lists.disconnect.me/simple_tracking.txt":                         "Disconnect.me Tracking",
  "s3.amazonaws.com/lists.disconnect.me/simple_malware.txt":                          "Disconnect.me Malware",
  // Malware / security
  "raw.githubusercontent.com/nicehash/NiceHash-Blocklist/main/blocklist.txt":         "NiceHash Blocklist",
  "raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt":  "WindowsSpyBlocker",
  "raw.githubusercontent.com/nicehash/nicehash-blocklist/main/blocklist.txt":         "NiceHash Blocklist",
  "urlhaus-filter.pages.dev/urlhaus-filter-hosts.txt":                                "URLhaus Malware",
  "raw.githubusercontent.com/RPiList/specials/master/Blocklisten/notserious":          "RPiList Not-Serious",
  // Energized
  "block.energized.pro/downloads/basic.txt":                                           "Energized Basic",
  "block.energized.pro/downloads/blu.txt":                                             "Energized BLU",
  "block.energized.pro/downloads/ultimate.txt":                                        "Energized Ultimate",
};

function piholeListPrettyName(address) {
  if (!address) return "Pi-hole blocklist";
  try {
    const host = new URL(address).hostname + new URL(address).pathname;
    // Check for exact or partial match
    for (const [key, name] of Object.entries(PIHOLE_LIST_NAMES)) {
      if (host.includes(key)) return name;
    }
  } catch (_) {}
  // Fall back to hostname only
  try { return new URL(address).hostname; } catch (_) {}
  return "Pi-hole blocklist";
}

async function fetchPiholeReasons(domains) {
  if (!domains.length) return;
  try {
    // Auth
    const authRes = await fetch(`${piholeUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: piholeToken }),
      signal: AbortSignal.timeout(6000)
    });
    if (!authRes.ok) return;
    const authData = await authRes.json();
    const sid = authData?.session?.sid;
    if (!sid) return;

    // For each blocked domain, use the gravity search endpoint
    for (const domain of domains) {
      try {
        const res = await fetch(
          `${piholeUrl}/api/search/${encodeURIComponent(domain)}`,
          { headers: { "X-FTL-SID": sid }, signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const gravityHits = data?.search?.gravity || [];
        if (!gravityHits.length) continue;

        // Deduplicate by list address and map to pretty names
        const seen = new Set();
        const reasons = [];
        for (const hit of gravityHits) {
          const address = hit.address || "";
          if (seen.has(address)) continue;
          seen.add(address);
          reasons.push({ id: String(hit.id || ""), name: piholeListPrettyName(address) });
        }
        if (reasons.length) blocklistCache[domain] = reasons;
      } catch (_) {}
    }
  } catch (_) {}
}

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
  const listEl = document.getElementById("blocks-list");
  const emptyEl = document.getElementById("empty-state");
  const statsBar = document.getElementById("stats-bar");

  if (!blocks.length) {
    listEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    statsBar.classList.add("hidden");
    return;
  }

  // Sort: HIGH first, then MEDIUM, then LOW; within each group by count desc
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  blocks.sort((a, b) => {
    const co = order[a.classification.confidence] - order[b.classification.confidence];
    return co !== 0 ? co : b.count - a.count;
  });

  // Stats
  const highCount   = blocks.filter(b => b.classification.confidence === "HIGH").length;
  const mediumCount = blocks.filter(b => b.classification.confidence === "MEDIUM").length;
  const lowCount    = blocks.filter(b => b.classification.confidence === "LOW").length;

  document.getElementById("stat-high").textContent   = highCount;
  document.getElementById("stat-medium").textContent = mediumCount;
  document.getElementById("stat-low").textContent    = lowCount;

  // Update filter highlight
  ["HIGH", "MEDIUM", "LOW"].forEach(level => {
    const el = document.getElementById(`stat-${level.toLowerCase()}`).closest(".stat");
    el.classList.toggle("stat-active",  activeFilter === level);
    el.classList.toggle("stat-dimmed", activeFilter !== null && activeFilter !== level);
  });

  statsBar.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";

  // Apply filter
  const visibleBlocks = activeFilter
    ? blocks.filter(b => b.classification.confidence === activeFilter)
    : blocks;

  let lastConfidence = null;

  // No API key note
  const hasCredentials = provider === "pihole" ? (piholeUrl && piholeToken) : (apiKey && profileId);
  if (!hasCredentials) {
    const note = document.createElement("div");
    note.className = "no-api-key";
    note.textContent = provider === "pihole"
      ? "⚙️ Enter your Pi-hole URL and API token in settings to enable one-click allowlist"
      : "⚙️ Add your NextDNS API key in settings to enable one-click allowlist";
    listEl.appendChild(note);
  }

  for (const block of visibleBlocks) {
    const conf = block.classification.confidence;

    // Section header when confidence group changes
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

    // Block item
    const item = document.createElement("div");
    item.className = "block-item";

    // Error shortname
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

  // Wire up allowlist buttons
  listEl.querySelectorAll(".allowlist-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => addToAllowlist(btn));
  });

  // Wire up copy buttons
  listEl.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => copyDomain(btn));
  });
}

// ── DNS Flush Banner ──────────────────────────────────────────────────────────
function getDNSFlushCommand() {
  const ua = navigator.userAgent;
  if (ua.includes("Mac"))  return "sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder";
  if (ua.includes("Win"))  return "ipconfig /flushdns";
  // Linux — systemd-resolved is most common; show both common options
  return "sudo systemd-resolve --flush-caches  # or: sudo service nscd restart";
}

function showFlushBanner(title = "✓ Added — flush DNS to apply") {
  const banner   = document.getElementById("flush-banner");
  const titleEl  = document.querySelector(".flush-banner-title");
  const cmdEl    = document.getElementById("flush-cmd");
  const copyBtn  = document.getElementById("flush-copy");
  const dismiss  = document.getElementById("flush-dismiss");

  if (!banner) return;
  titleEl.textContent = title;
  cmdEl.textContent = getDNSFlushCommand();
  banner.classList.remove("hidden");

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(getDNSFlushCommand());
      const orig = copyBtn.textContent;
      copyBtn.textContent = "✓";
      setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    } catch (_) {}
  };

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

// ── NextDNS Allowlist ──────────────────────────────────────────────────────────
async function addToAllowlist(btn) {
  const domain = btn.dataset.domain;
  const canAllowlist = provider === "pihole" ? (piholeUrl && piholeToken) : (apiKey && profileId);
  if (!domain || !canAllowlist) return;

  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    // Route to the correct provider
    if (provider === "pihole") {
      const result = await piholeAllowlist(domain);
      if (result.ok) {
        btn.textContent = "✓ Added";
        btn.classList.add("success");
        showFlushBanner();
      } else {
        btn.textContent = "✗ Failed";
        btn.title = result.error;
        setTimeout(() => { btn.textContent = "+ Allowlist"; btn.title = ""; btn.disabled = false; }, 3000);
      }
      return;
    }

    const res = await fetch(`${NEXTDNS_API}/profiles/${profileId}/allowlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ id: domain, active: true }),
    });

    if (res.ok || res.status === 204 || res.status === 201) {
      btn.textContent = "✓ Added";
      btn.classList.add("success");
      showFlushBanner();
    } else {
      const body = await res.text();
      console.error("NextDNS API error:", res.status, body);
      btn.textContent = `Error ${res.status}`;
      btn.classList.add("error");
      btn.disabled = false;
    }
  } catch (err) {
    console.error("Allowlist request failed:", err);
    btn.textContent = "Failed";
    btn.classList.add("error");
    btn.disabled = false;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function toggleSettings() {
  // Re-render profile list if already loaded (keeps selection in sync)
  if (profilesList.length > 0) {
    const fingerprintMatch = detectedFingerprint
      ? profilesList.find(p => p.fingerprint === detectedFingerprint) : null;
    renderProfileList(fingerprintMatch?.id || null);
  }
  const panel = document.getElementById("settings-panel");
  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  if (isHidden) await refreshDBMeta();
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

// ── API Key lock / clear ──────────────────────────────────────────────────────
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
  // Clear API key from storage and reset all NextDNS state
  apiKey      = "";
  profileId   = "";
  profilesList = [];
  detectedFingerprint = null;
  detectedDeviceName  = null;
  profilesFetchInFlight = false;

  await ext.storage.sync.remove(["apiKey", "profileId"]);
  await ext.storage.local.remove(["piholeVersion", "ndm_dbCache"]);

  unlockApiKeyField();

  // Reset profile UI
  profilesList = [];
  document.getElementById("ndm-profile-section").classList.add("hidden");
  document.getElementById("ndm-profile-list").innerHTML = "";
}

function updateProviderUI(selectedProvider) {
  document.getElementById("provider-nextdns").classList.toggle("hidden", selectedProvider !== "nextdns");
  document.getElementById("provider-pihole").classList.toggle("hidden",  selectedProvider !== "pihole");
}

function updatePiholeVersionLabel(version) {
  const el = document.getElementById("pihole-version-label");
  if (!el) return;
  el.textContent = version ? `Pi-hole v${version} detected` : "";
  el.className = "pihole-version-label" + (version ? " detected" : "");
}

// ── Pi-hole API ───────────────────────────────────────────────────────────────
function normalizePiholeUrl(url) {
  return url.replace(/\/+$/, "").trim();
}

async function detectPiholeVersion(url) {
  // v6 exposes /api/auth; v5 does not
  try {
    const res = await fetch(`${url}/api/auth`, { method: "GET", signal: AbortSignal.timeout(4000) });
    if (res.status === 200 || res.status === 401) return 6;
  } catch (_) {}
  return 5; // fallback — assume v5
}

async function piholeAllowlist(domain) {
  const url = normalizePiholeUrl(piholeUrl);
  if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

  // Auto-detect version if not yet cached
  if (!piholeVersion) {
    piholeVersion = await detectPiholeVersion(url);
    await ext.storage.local.set({ piholeVersion });
    updatePiholeVersionLabel(piholeVersion);
  }

  if (piholeVersion === 6) {
    return await piholeV6Allowlist(url, domain);
  } else {
    return await piholeV5Allowlist(url, domain);
  }
}

async function piholeV5Allowlist(url, domain) {
  try {
    const res = await fetch(
      `${url}/admin/api.php?list=white&add=${encodeURIComponent(domain)}&auth=${encodeURIComponent(piholeToken)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data.success) return { ok: true };
    return { ok: false, error: data.message || "Pi-hole returned an error" };
  } catch (e) {
    return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
  }
}

async function piholeV6Allowlist(url, domain) {
  try {
    // Step 1: get session token
    const authRes = await fetch(`${url}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: piholeToken }),
      signal: AbortSignal.timeout(8000)
    });
    if (!authRes.ok) return { ok: false, error: authRes.status === 401 ? "Invalid API token" : `Auth failed (HTTP ${authRes.status})` };
    const authData = await authRes.json();
    const sid = authData?.session?.sid;
    if (!sid) return { ok: false, error: "Could not obtain Pi-hole session token" };

    // Step 2: add to allowlist
    const addRes = await fetch(`${url}/api/domains/allow/exact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FTL-SID": sid },
      body: JSON.stringify({ domain, comment: "Added by NextDNS Medic" }),
      signal: AbortSignal.timeout(8000)
    });
    if (!addRes.ok) return { ok: false, error: `HTTP ${addRes.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
  }
}

async function handleTestPihole() {
  const btn = document.getElementById("btn-test-pihole");
  const url = normalizePiholeUrl(document.getElementById("pihole-url-input").value);
  const token = document.getElementById("pihole-token-input").value.trim();
  const versionLabel = document.getElementById("pihole-version-label");

  if (!url || !token) {
    versionLabel.textContent = "Enter URL and token first";
    versionLabel.className = "pihole-version-label error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Testing...";
  versionLabel.textContent = "";
  versionLabel.className = "pihole-version-label";

  try {
    const version = await detectPiholeVersion(url);

    // Validate the token works by doing a read-only API call
    let tokenOk = false;
    if (version === 5) {
      const res = await fetch(`${url}/admin/api.php?summaryRaw&auth=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(6000) });
      const data = await res.json().catch(() => null);
      tokenOk = data && typeof data.domains_being_blocked !== "undefined";
    } else {
      const res = await fetch(`${url}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
        signal: AbortSignal.timeout(6000)
      });
      const data = await res.json().catch(() => null);
      tokenOk = data?.session?.valid === true;
    }

    if (tokenOk) {
      piholeVersion = version;
      await ext.storage.local.set({ piholeVersion });
      versionLabel.textContent = `✓ Connected (Pi-hole v${version})`;
      versionLabel.className = "pihole-version-label success";
    } else {
      versionLabel.textContent = "✗ Invalid token — check Pi-hole settings";
      versionLabel.className = "pihole-version-label error";
    }
  } catch (e) {
    versionLabel.textContent = "✗ Unreachable — check your URL";
    versionLabel.className = "pihole-version-label error";
  }

  btn.disabled = false;
  btn.textContent = "Test Connection";
}

// ── NextDNS Profile Auto-detect ───────────────────────────────────────────────
async function fetchDeviceFingerprint() {
  try {
    const res = await fetch("https://test.nextdns.io", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    detectedFingerprint = data.profile    || null;
    detectedDeviceName  = data.deviceName || data.clientName || null;
  } catch (_) {
    // Not on NextDNS or network not configured — silent fail
  }
}

async function fetchAndMatchProfiles(key) {
  if (profilesFetchInFlight) return;
  profilesFetchInFlight = true;
  try {
    const res = await fetch("https://api.nextdns.io/profiles", {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return;
    const data = await res.json();
    profilesList = data.data || [];

    const fingerprintMatch = detectedFingerprint
      ? profilesList.find(p => p.fingerprint === detectedFingerprint) : null;
    const savedMatch = profileId
      ? profilesList.find(p => p.id === profileId) : null;
    const autoSelect = fingerprintMatch || savedMatch || profilesList[0] || null;
    if (autoSelect) profileId = autoSelect.id;

    renderProfileList(fingerprintMatch?.id || null);
  } catch (_) {
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
    const isSelected = p.id === profileId;
    return `
      <div class="ndm-profile-item${isSelected ? " selected" : ""}" data-id="${p.id}">
        <div class="ndm-profile-item-info">
          <span class="ndm-profile-item-name">${p.name}</span>
          <span class="ndm-profile-item-id">${p.id}</span>
        </div>
        <div class="ndm-profile-item-right">
          ${isDevice ? `<span class="ndm-profile-item-badge">This device</span>` : ""}
          ${isSelected ? `<span class="ndm-profile-item-check">✓</span>` : ""}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".ndm-profile-item").forEach(el => {
    el.addEventListener("click", () => {
      profileId = el.dataset.id;
      renderProfileList(activeId);
    });
  });

  section.classList.remove("hidden");
}

async function handleLookupProfiles() {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;
  const btn = document.getElementById("btn-lookup-profiles");
  btn.textContent = "…";
  btn.disabled = true;
  profilesFetchInFlight = false;
  await fetchDeviceFingerprint();
  await fetchAndMatchProfiles(key);
  btn.textContent = "→";
  btn.disabled = false;
  lockApiKeyField();
}

async function saveSettings() {
  const newKey = document.getElementById("api-key-input").value.trim();
  const newProfile = profileId; // set by renderProfileList click or auto-detect

  const newProvider     = document.getElementById("provider-select").value;
  const newPiholeUrl    = normalizePiholeUrl(document.getElementById("pihole-url-input").value);
  const newPiholeToken  = document.getElementById("pihole-token-input").value.trim();

  await ext.storage.sync.set({
    apiKey: newKey, profileId: newProfile,
    provider: newProvider, piholeUrl: newPiholeUrl, piholeToken: newPiholeToken
  });
  apiKey       = newKey;
  profileId    = newProfile;
  provider     = newProvider;
  piholeUrl    = newPiholeUrl;
  piholeToken  = newPiholeToken;

  if (newKey && newProvider === "nextdns") lockApiKeyField();

  const status = document.getElementById("settings-status");
  status.textContent = "✓ Saved";
  setTimeout(() => { status.textContent = ""; }, 1200);
  loadBlocks(); // Re-render to enable/disable allowlist buttons
}

// ── Clear ─────────────────────────────────────────────────────────────────────
async function clearBlocks() {
  await sendMessage({ type: "CLEAR_TAB_DATA", tabId: currentTabId });
  loadBlocks();
}

// ── DB Refresh ────────────────────────────────────────────────────────────────
async function handleRefreshDB() {
  const btn = document.getElementById("btn-refresh-db");
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
