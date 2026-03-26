// NextDNS Monitor — Popup Script

const NEXTDNS_API = "https://api.nextdns.io";

let currentTabId = null;
let apiKey = "";
let profileId = "";

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Load settings
  const stored = await ext.storage.sync.get(["apiKey", "profileId"]);
  apiKey = stored.apiKey || "";
  profileId = stored.profileId || "";

  if (apiKey) document.getElementById("api-key-input").value = apiKey;
  if (profileId) document.getElementById("profile-id-input").value = profileId;

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
  renderBlocks(response?.blocks || []);
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

  statsBar.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";

  let lastConfidence = null;

  // No API key note
  if (!apiKey || !profileId) {
    const note = document.createElement("div");
    note.className = "no-api-key";
    note.textContent = "⚙️ Add your NextDNS API key in settings to enable one-click allowlist";
    listEl.appendChild(note);
  }

  for (const block of blocks) {
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
      </div>
      <div class="block-actions">
        <button class="copy-btn" data-domain="${block.domain}" title="Copy domain">📋</button>
        <button class="allowlist-btn" data-domain="${block.domain}" ${(!apiKey || !profileId) ? "disabled title='Add API key in settings'" : ""}>
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

// ── Copy to clipboard ─────────────────────────────────────────────────────────
async function copyDomain(btn) {
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
  if (!domain || !apiKey || !profileId) return;

  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
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

async function saveSettings() {
  const newKey = document.getElementById("api-key-input").value.trim();
  const newProfile = document.getElementById("profile-id-input").value.trim();

  await ext.storage.sync.set({ apiKey: newKey, profileId: newProfile });
  apiKey = newKey;
  profileId = newProfile;

  const status = document.getElementById("settings-status");
  status.textContent = "✓ Saved";
  setTimeout(() => {
    status.textContent = "";
    document.getElementById("settings-panel").classList.add("hidden");
    loadBlocks(); // Re-render to enable/disable allowlist buttons
  }, 1200);
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
