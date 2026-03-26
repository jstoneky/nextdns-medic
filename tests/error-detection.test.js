// tests/error-detection.test.js
// Unit tests for DNS block error string detection in background.js
// Run with: node --test tests/error-detection.test.js

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { DNS_BLOCK_ERRORS, POSSIBLE_BLOCK_ERRORS, extractHostname } = require("../background.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isDefiniteBlock(error) {
  return DNS_BLOCK_ERRORS.some(e => error.includes(e));
}
function isPossibleBlock(error) {
  return !isDefiniteBlock(error) && POSSIBLE_BLOCK_ERRORS.some(e => error.includes(e));
}

// ─── Chrome definite block errors ────────────────────────────────────────────
describe("Chrome — definite block errors", () => {
  test("ERR_NAME_NOT_RESOLVED", () =>
    assert.ok(isDefiniteBlock("net::ERR_NAME_NOT_RESOLVED")));

  test("ERR_CERT_AUTHORITY_INVALID", () =>
    assert.ok(isDefiniteBlock("net::ERR_CERT_AUTHORITY_INVALID")));

  test("ERR_BLOCKED_BY_ADMINISTRATOR", () =>
    assert.ok(isDefiniteBlock("net::ERR_BLOCKED_BY_ADMINISTRATOR")));
});

// ─── Firefox definite block errors ───────────────────────────────────────────
describe("Firefox — definite block errors", () => {
  test("straight apostrophe variant", () =>
    assert.ok(isDefiniteBlock("Peer's Certificate issuer is not recognized.")));

  test("curly apostrophe variant (U+2019)", () =>
    // Firefox uses right single quotation mark — our pattern avoids the apostrophe entirely
    assert.ok(isDefiniteBlock("Peer\u2019s Certificate issuer is not recognized.")));

  test("'received an invalid certificate' variant", () =>
    assert.ok(isDefiniteBlock("You have received an invalid certificate. Please contact...")));

  test("'uses an invalid security certificate' variant", () =>
    assert.ok(isDefiniteBlock("This site uses an invalid security certificate.")));

  test("SEC_ERROR_UNKNOWN_ISSUER raw code", () =>
    assert.ok(isDefiniteBlock("SEC_ERROR_UNKNOWN_ISSUER")));

  test("NS_ERROR_UNKNOWN_HOST", () =>
    assert.ok(isDefiniteBlock("NS_ERROR_UNKNOWN_HOST")));

  test("NS_ERROR_NET_ON_RESOLVING", () =>
    assert.ok(isDefiniteBlock("NS_ERROR_NET_ON_RESOLVING")));
});

// ─── Possible (lower confidence) block errors ─────────────────────────────────
describe("Possible block errors", () => {
  test("ERR_BLOCKED_BY_CLIENT", () =>
    assert.ok(isPossibleBlock("net::ERR_BLOCKED_BY_CLIENT")));

  test("ERR_CONNECTION_REFUSED", () =>
    assert.ok(isPossibleBlock("net::ERR_CONNECTION_REFUSED")));

  test("ERR_FAILED", () =>
    assert.ok(isPossibleBlock("net::ERR_FAILED")));

  test("NS_ERROR_CONNECTION_REFUSED (Firefox)", () =>
    assert.ok(isPossibleBlock("NS_ERROR_CONNECTION_REFUSED")));

  test("NS_ERROR_NET_RESET (Firefox)", () =>
    assert.ok(isPossibleBlock("NS_ERROR_NET_RESET")));
});

// ─── Non-block errors should NOT match ───────────────────────────────────────
describe("Non-block errors — should not match", () => {
  test("NS_BINDING_ABORTED is not a block", () =>
    assert.ok(!isDefiniteBlock("NS_BINDING_ABORTED") && !isPossibleBlock("NS_BINDING_ABORTED")));

  test("ERR_NETWORK_CHANGED is not a block", () =>
    assert.ok(!isDefiniteBlock("net::ERR_NETWORK_CHANGED") && !isPossibleBlock("net::ERR_NETWORK_CHANGED")));

  test("ERR_TIMED_OUT is not a block", () =>
    assert.ok(!isDefiniteBlock("net::ERR_TIMED_OUT") && !isPossibleBlock("net::ERR_TIMED_OUT")));

  test("empty string is not a block", () =>
    assert.ok(!isDefiniteBlock("") && !isPossibleBlock("")));
});

// ─── extractHostname ──────────────────────────────────────────────────────────
describe("extractHostname()", () => {
  test("standard URL", () =>
    assert.equal(extractHostname("https://featureassets.org/v1/sdk"), "featureassets.org"));

  test("subdomain URL", () =>
    assert.equal(extractHostname("https://cdn.auth0.com/js/lock.js"), "cdn.auth0.com"));

  test("URL with port", () =>
    assert.equal(extractHostname("https://api.stripe.com:443/v1/charges"), "api.stripe.com"));

  test("URL with query string", () =>
    assert.equal(extractHostname("https://www.google-analytics.com/collect?v=1"), "www.google-analytics.com"));

  test("invalid URL falls back gracefully", () => {
    const result = extractHostname("not-a-url");
    assert.ok(typeof result === "string");
  });
});
