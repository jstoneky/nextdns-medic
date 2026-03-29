// domain-db.js — DNS Medic domain classification
//
// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
// Source of truth: nextdns-medic-research/db/*.yaml
// Regenerate: npm run build (in nextdns-medic-research) or ./build.sh (here)
//
// The bundled domain-db.json is used as a fallback when the remote DB
// fetch fails or hasn't been cached yet.

let _db = null;

function getDB() {
  if (_db) return _db;

  // In extension context, load the bundled JSON
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Synchronous load isn't possible in extension context —
    // db-loader.js handles this via getClassifyFn()
    return null;
  }

  // Node.js context (tests)
  if (typeof require !== "undefined") {
    _db = require("./domain-db.json");
    return _db;
  }

  return null;
}

function classifyDomain(hostname, dbEntries) {
  const entries = dbEntries || (getDB() && getDB().entries) || [];
  for (const entry of entries) {
    try {
      const re = new RegExp(entry.pattern, entry.flags || "");
      if (re.test(hostname)) {
        return {
          label:           entry.label,
          confidence:      entry.confidence,
          category:        entry.category,
          functionalImpact: entry.functionalImpact || null,
          known:           true,
        };
      }
    } catch (_) { /* skip malformed pattern */ }
  }
  return {
    label:      "Unknown Domain",
    confidence: "MEDIUM",
    category:   "unknown",
    known:      false,
  };
}

// DOMAIN_DB kept for backwards compat — actual DB is loaded by db-loader.js from domain-db.json
const DOMAIN_DB = [];

if (typeof module !== "undefined") {
  module.exports = { classifyDomain, DOMAIN_DB };
}
