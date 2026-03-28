// tests/build.test.js
// Verifies that build artifacts contain all required files and are valid
// Run with: node --test tests/build.test.js

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "store/dist");

// ─── Required source files ────────────────────────────────────────────────────
describe("Source files exist", () => {
  const required = [
    "manifest.json",
    "manifest.firefox.json",
    "background.js",
    "browser-compat.js",
    "domain-db.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "build.sh",
    "README.md",
    "store/PRIVACY.md",
    "store/chrome/LISTING.md",
    "store/firefox/LISTING.md",
  ];

  for (const file of required) {
    test(file, () => {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `Missing: ${file}`);
    });
  }
});

// ─── manifest.json (Chrome MV3) ───────────────────────────────────────────────
describe("Chrome manifest.json", () => {
  let manifest;
  before(() => {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  });

  test("manifest_version is 3", () => assert.equal(manifest.manifest_version, 3));
  test("has name", () => assert.ok(manifest.name?.length > 0));
  test("name is DNS Medic", () => assert.equal(manifest.name, "DNS Medic"));
  test("has version", () => assert.match(manifest.version, /^\d+\.\d+\.\d+$/));
  test("has background.service_worker", () => assert.ok(manifest.background?.service_worker));
  test("has action", () => assert.ok(manifest.action));
  test("has webRequest permission", () =>
    assert.ok(manifest.permissions?.includes("webRequest") || manifest.host_permissions?.length > 0));
});

// ─── manifest.firefox.json (Firefox MV2) ─────────────────────────────────────
describe("Firefox manifest.firefox.json", () => {
  let manifest;
  before(() => {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.firefox.json"), "utf8"));
  });

  test("manifest_version is 2", () => assert.equal(manifest.manifest_version, 2));
  test("name is DNS Medic", () => assert.equal(manifest.name, "DNS Medic"));
  test("has browser_specific_settings.gecko.id", () =>
    assert.ok(manifest.browser_specific_settings?.gecko?.id?.length > 0));
  test("gecko ID matches expected", () =>
    assert.equal(manifest.browser_specific_settings.gecko.id, "dns-medic@jstoneky.github.io"));
  test("has data_collection_permissions", () =>
    assert.ok(manifest.browser_specific_settings?.gecko?.data_collection_permissions));
  test("data_collection_permissions.required contains 'none'", () =>
    assert.ok(manifest.browser_specific_settings.gecko.data_collection_permissions.required?.includes("none")));
  test("has background.scripts (not service_worker)", () =>
    assert.ok(Array.isArray(manifest.background?.scripts)));
  test("browser-compat.js is first background script", () =>
    assert.equal(manifest.background.scripts[0], "browser-compat.js"));
  test("has browser_action (not action)", () =>
    assert.ok(manifest.browser_action));
});

// ─── domain-db.js sanity checks ───────────────────────────────────────────────
describe("domain-db.js sanity", () => {
  let db;
  before(() => { db = require("../domain-db.js"); });

  test("DOMAIN_DB is a non-empty array", () =>
    assert.ok(Array.isArray(db.DOMAIN_DB) && db.DOMAIN_DB.length > 50));

  test("every entry has required fields", () => {
    for (const entry of db.DOMAIN_DB) {
      assert.ok(entry.pattern instanceof RegExp, `pattern must be RegExp: ${JSON.stringify(entry)}`);
      assert.ok(typeof entry.label === "string" && entry.label.length > 0, `missing label: ${JSON.stringify(entry)}`);
      assert.ok(["HIGH", "MEDIUM", "LOW"].includes(entry.confidence), `invalid confidence: ${entry.confidence}`);
      assert.ok(typeof entry.category === "string" && entry.category.length > 0, `missing category: ${JSON.stringify(entry)}`);
    }
  });

  test("no duplicate patterns", () => {
    const seen = new Set();
    const dupes = [];
    for (const entry of db.DOMAIN_DB) {
      const key = entry.pattern.toString();
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }
    assert.deepEqual(dupes, [], `Duplicate patterns: ${dupes.join(", ")}`);
  });

  test("classifyDomain returns object with required fields", () => {
    const r = db.classifyDomain("featureassets.org");
    assert.ok(r.label);
    assert.ok(r.confidence);
    assert.ok(r.category);
    assert.ok(typeof r.known === "boolean");
  });
});

// ─── Build output ─────────────────────────────────────────────────────────────
describe("Build zips", () => {
  before(() => {
    // Build only if current version zip is missing (avoids recursive build)
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
    const expected = path.join(DIST, `dns-medic-chrome-v${pkg.version}.zip`);
    if (!fs.existsSync(expected)) {
      execSync("node --test tests/domain-db.test.js tests/error-detection.test.js && ./build.sh all", { cwd: ROOT, stdio: "pipe" });
    }
  });

  // Derive expected filenames from the manifest version
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const v = pkg.version;
  const zips = [
    `dns-medic-chrome-v${v}.zip`,
    `dns-medic-firefox-v${v}.zip`,
  ];

  for (const zip of zips) {
    test(`${zip} exists`, () =>
      assert.ok(fs.existsSync(path.join(DIST, zip)), `Missing: ${zip}`));

    test(`${zip} is non-empty`, () => {
      const stat = fs.statSync(path.join(DIST, zip));
      assert.ok(stat.size > 40000, `${zip} is suspiciously small: ${stat.size} bytes`);
    });
  }

  test("XPI exists for Firefox", () =>
    assert.ok(
      fs.existsSync(path.join(DIST, `dns-medic-firefox-v${v}.xpi`)),
      "Missing Firefox XPI"
    ));
});
