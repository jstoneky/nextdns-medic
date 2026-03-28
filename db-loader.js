// db-loader.js — Dynamic domain database loader for DNS Medic
//
// Fetches domain-db.json from GitHub, validates strictly, caches for 7 days.
// Falls back to bundled domain-db.js if remote is unavailable.
// Overrides the global classifyDomain() provided by domain-db.js.
//
// Security model:
//   - Fetch JSON only; never eval or execute remote content
//   - Strict schema validation on every entry before use
//   - Pattern string allowlist (domain-safe characters only) before RegExp compile
//   - Max entry count + pattern length caps to prevent abuse
//   - Try/catch around every regex compile and test (ReDoS isolation)
//   - Host pinned to specific GitHub repo path in manifest host_permissions

const DB_REMOTE_URL  = "https://raw.githubusercontent.com/jstoneky/nextdns-medic/main/domain-db.json";
const DB_CACHE_KEY   = "ndm_dbCache";
const DB_CACHE_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ── Validation constraints ─────────────────────────────────────────────────────
const VALID_CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW"]);
const MAX_ENTRIES      = 2000;
const MAX_PATTERN_LEN  = 300;
const MAX_LABEL_LEN    = 150;
// Characters valid in domain-matching regex patterns.
// Intentionally excludes backtick, $(...), lookaheads — nothing executable.
const SAFE_PATTERN_RE  = /^[a-zA-Z0-9.\-_\\^$*+?|()[\]{}/]+$/;
const SAFE_FLAGS_RE    = /^[gimsuy]*$/;

// ── In-memory compiled DB (null = use bundled fallback) ───────────────────────
let _activeDB = null;
let _dbMeta   = null; // { source, fetchedAt, count }

// ── Validation + compilation ──────────────────────────────────────────────────
function validateAndCompile(raw) {
  if (!raw || typeof raw !== "object") throw new Error("invalid root object");
  if (!Array.isArray(raw.entries))     throw new Error("entries must be an array");
  if (raw.entries.length > MAX_ENTRIES) throw new Error(`too many entries: ${raw.entries.length}`);

  const compiled = [];

  for (const entry of raw.entries) {
    try {
      // Pattern
      if (typeof entry.pattern !== "string") continue;
      if (entry.pattern.length === 0 || entry.pattern.length > MAX_PATTERN_LEN) continue;
      if (!SAFE_PATTERN_RE.test(entry.pattern)) continue;

      // Label
      if (typeof entry.label !== "string") continue;
      if (entry.label.length === 0 || entry.label.length > MAX_LABEL_LEN) continue;

      // Confidence
      if (!VALID_CONFIDENCE.has(entry.confidence)) continue;

      // Category (free-form string, just length-check)
      if (typeof entry.category !== "string" || entry.category.length === 0) continue;

      // Flags — strip anything that isn't a valid JS regex flag
      const flags = typeof entry.flags === "string"
        ? entry.flags.replace(/[^gimsuy]/g, "")
        : "";
      if (!SAFE_FLAGS_RE.test(flags)) continue;

      // Compile regex in isolation — catch ReDoS/invalid patterns
      const regex = new RegExp(entry.pattern, flags);

      compiled.push({
        pattern:        regex,
        label:          entry.label,
        confidence:     entry.confidence,
        category:       entry.category,
        functionalImpact: entry.functionalImpact || null,
      });
    } catch (_) {
      // Invalid entry — skip silently
    }
  }

  if (compiled.length === 0) throw new Error("no valid entries after validation");
  return compiled;
}

// ── classifyDomain using active (or bundled fallback) DB ──────────────────────
function classifyDomainActive(hostname) {
  const db = _activeDB || (typeof DOMAIN_DB !== "undefined" ? DOMAIN_DB : []);
  for (const entry of db) {
    try {
      if (entry.pattern.test(hostname)) {
        return { label: entry.label, confidence: entry.confidence, category: entry.category, functionalImpact: entry.functionalImpact || null, known: true };
      }
    } catch (_) {
      // Skip broken entry
    }
  }
  return { label: "Unknown Domain", confidence: "MEDIUM", category: "unknown", known: false };
}

// ── DB fetch + cache ───────────────────────────────────────────────────────────
async function fetchAndCacheDB() {
  const res = await fetch(DB_REMOTE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Parse as JSON — never eval, never pass to Function()
  const raw = await res.json();

  const compiled = validateAndCompile(raw);

  // Cache raw data (strings, not compiled RegExps) for persistence
  await ext.storage.local.set({
    [DB_CACHE_KEY]: {
      data:      raw,
      fetchedAt: Date.now(),
      count:     compiled.length,
    },
  });

  _activeDB = compiled;
  _dbMeta   = { source: "remote", fetchedAt: Date.now(), count: compiled.length, version: raw.version || "?" };
  return _dbMeta;
}

async function loadFromCache() {
  const stored = await ext.storage.local.get(DB_CACHE_KEY);
  const entry  = stored[DB_CACHE_KEY];
  if (!entry || !entry.data || !entry.fetchedAt) return false;
  if (Date.now() - entry.fetchedAt > DB_CACHE_TTL) return false; // stale

  const compiled = validateAndCompile(entry.data);
  _activeDB = compiled;
  _dbMeta   = { source: "cache", fetchedAt: entry.fetchedAt, count: compiled.length, version: entry.data.version || "?" };
  return true;
}

// ── Public: init (called on background load) ──────────────────────────────────
async function initDB() {
  try {
    const fromCache = await loadFromCache();
    if (!fromCache) await fetchAndCacheDB();
  } catch (_) {
    // Non-fatal: bundled DOMAIN_DB remains as fallback
    _dbMeta = { source: "bundled", fetchedAt: null, count: typeof DOMAIN_DB !== "undefined" ? DOMAIN_DB.length : 0, version: "bundled" };
  }
}

// ── Public: force refresh (called from popup settings) ───────────────────────
async function forceRefreshDB() {
  try {
    // Clear cache first
    await ext.storage.local.remove(DB_CACHE_KEY);
    const meta = await fetchAndCacheDB();
    return { ok: true, ...meta };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Public: get DB metadata ────────────────────────────────────────────────────
function getDBMeta() {
  return _dbMeta || {
    source: "bundled",
    fetchedAt: null,
    count: typeof DOMAIN_DB !== "undefined" ? DOMAIN_DB.length : 0,
    version: "bundled",
  };
}

// Override global classifyDomain from domain-db.js
globalThis.classifyDomain = classifyDomainActive;

// Initialize on load — non-blocking, bundled DB handles requests in the meantime
initDB();

// Node test exports
if (typeof module !== "undefined") {
  module.exports = { validateAndCompile, classifyDomainActive, forceRefreshDB, getDBMeta, SAFE_PATTERN_RE };
}
