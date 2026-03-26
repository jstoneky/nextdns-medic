// tests/domain-db.test.js
// Unit tests for domain-db.js classifyDomain()
// Run with: node --test tests/domain-db.test.js

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { classifyDomain } = require("../domain-db.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function assertHigh(hostname, desc) {
  const r = classifyDomain(hostname);
  assert.equal(r.confidence, "HIGH", `${desc || hostname}: expected HIGH, got ${r.confidence} (${r.label})`);
}
function assertMedium(hostname, desc) {
  const r = classifyDomain(hostname);
  assert.equal(r.confidence, "MEDIUM", `${desc || hostname}: expected MEDIUM, got ${r.confidence} (${r.label})`);
}
function assertLow(hostname, desc) {
  const r = classifyDomain(hostname);
  assert.equal(r.confidence, "LOW", `${desc || hostname}: expected LOW, got ${r.confidence} (${r.label})`);
}
function assertCategory(hostname, expected) {
  const r = classifyDomain(hostname);
  assert.equal(r.category, expected, `${hostname}: expected category "${expected}", got "${r.category}"`);
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
describe("Feature Flags (HIGH)", () => {
  test("Statsig CDN", () => assertHigh("featureassets.org"));
  test("Statsig API", () => assertHigh("statsigapi.net"));
  test("LaunchDarkly", () => assertHigh("app.launchdarkly.com"));
  test("LaunchDarkly events", () => assertHigh("events.launchdarkly.com"));
  test("Split.io", () => assertHigh("sdk.split.io"));
  test("Optimizely CDN", () => assertHigh("cdn.optimizely.com"));
  test("PostHog US", () => assertHigh("us.posthog.com"));
  test("PostHog EU", () => assertHigh("eu.posthog.com"));
  test("GrowthBook", () => assertHigh("cdn.growthbook.io"));
});

// ─── Authentication ───────────────────────────────────────────────────────────
describe("Authentication (HIGH)", () => {
  test("Auth0 CDN", () => assertHigh("cdn.auth0.com"));
  test("Auth0 tenant", () => assertHigh("myapp.us.auth0.com"));
  test("Okta", () => assertHigh("company.okta.com"));
  test("Okta CDN", () => assertHigh("ok12static.oktacdn.com"));
  test("Clerk", () => assertHigh("clerk.myapp.com"));
  test("Clerk accounts", () => assertHigh("accounts.clerk.myapp.dev"));
  test("Firebase identitytoolkit", () => assertHigh("identitytoolkit.googleapis.com"));
  test("Microsoft SSO", () => assertHigh("login.microsoftonline.com"));
  test("Google accounts", () => assertHigh("accounts.google.com"));
  test("Cognito", () => assertHigh("cognito-idp.us-east-1.amazonaws.com"));
});

// ─── Payments ────────────────────────────────────────────────────────────────
describe("Payments (HIGH)", () => {
  test("Stripe JS", () => assertHigh("js.stripe.com"));
  test("Stripe API", () => assertHigh("api.stripe.com"));
  test("Braintree", () => assertHigh("js.braintreegateway.com"));
  test("PayPal", () => assertHigh("www.paypalobjects.com"));
  test("Klarna", () => assertHigh("js.klarna.com"));
  test("Affirm", () => assertHigh("cdn1.affirm.com"));
  test("Adyen", () => assertHigh("checkoutshopper-live.adyen.com"));
  test("Afterpay", () => assertHigh("portal.afterpay.com"));
});

// ─── Search APIs ─────────────────────────────────────────────────────────────
describe("Search APIs (HIGH)", () => {
  test("Algolia net", () => assertHigh("myapp-dsn.algolia.net"));
  test("Algolia net2", () => assertHigh("myapp.algolianet.com"));
  test("Constructor.io", () => assertHigh("ac.cnstrc.com"));
  test("Searchspring", () => assertHigh("myshop.a.searchspring.io"));
  test("Klevu", () => assertHigh("eucs10v2.ksearchnet.com"));
  test("Bloomreach", () => assertHigh("pathways.bloomreach.com"));
  test("Coveo", () => assertHigh("platform.cloud.coveo.com"));
});

// ─── CDN / Infrastructure ─────────────────────────────────────────────────────
describe("CDN / Infrastructure (HIGH)", () => {
  test("Fastly", () => assertHigh("cdn.fastly.net"));
  test("Cloudflare assets", () => assertHigh("cdnjs.cloudflare.com"));
  test("jsDelivr", () => assertHigh("cdn.jsdelivr.net"));
  test("unpkg", () => assertHigh("unpkg.com"));
  test("Google APIs", () => assertHigh("maps.googleapis.com"));
  test("gstatic", () => assertHigh("fonts.gstatic.com"));
  test("AWS S3", () => assertHigh("mybucket.s3.amazonaws.com"));
});

// ─── Real-time ────────────────────────────────────────────────────────────────
describe("Real-time (HIGH)", () => {
  test("Pusher app", () => assertHigh("ws-us3.pusher.com"));
  test("Ably", () => assertHigh("realtime.ably.io"));
  test("Twilio", () => assertHigh("media.twiliocdn.com"));
});

// ─── Tag Managers ─────────────────────────────────────────────────────────────
describe("Tag Managers (MEDIUM)", () => {
  test("GTM", () => assertMedium("www.googletagmanager.com"));
  test("Tealium", () => assertMedium("tags.tiqcdn.com"));
  test("Segment CDN", () => assertMedium("cdn.segment.com"));
  test("Segment API", () => assertMedium("api.segment.io"));
  test("Adobe Launch", () => assertMedium("assets.adobedtm.com"));
  assertCategory("www.googletagmanager.com", "tag-manager");
});

// ─── Support / Chat ───────────────────────────────────────────────────────────
describe("Support / Chat (MEDIUM)", () => {
  test("Intercom widget", () => assertMedium("widget.intercom.io"));
  test("Zendesk assets", () => assertMedium("static.zdassets.com"));
  test("HubSpot scripts", () => assertMedium("js.hs-scripts.com"));
  test("Drift", () => assertMedium("js.drift.com"));
  test("Crisp", () => assertMedium("client.crisp.chat"));
  test("Freshchat", () => assertMedium("wchat.freshchat.com"));
});

// ─── Error Monitoring ─────────────────────────────────────────────────────────
describe("Error Monitoring (MEDIUM)", () => {
  test("Sentry CDN", () => assertMedium("browser.sentry-cdn.com"));
  test("Sentry API", () => assertMedium("o12345.ingest.sentry.io"));
  test("Datadog RUM", () => assertMedium("rum.browser-intake-datadoghq.com"));
  test("New Relic", () => assertMedium("js-agent.newrelic.com"));
  test("Bugsnag", () => assertMedium("notify.bugsnag.com"));
  test("Raygun", () => assertMedium("api.raygun.io"));
});

// ─── Session Replay ───────────────────────────────────────────────────────────
describe("Session Replay (MEDIUM)", () => {
  test("Hotjar", () => assertMedium("script.hotjar.com"));
  test("FullStory", () => assertMedium("rs.fullstory.com"));
  test("LogRocket", () => assertMedium("cdn.logrocket.io"));
  test("Microsoft Clarity", () => assertMedium("www.clarity.ms"));
  test("Lucky Orange", () => assertMedium("d10lpsik1i8c69.cloudfront.net")); // unknown → MEDIUM default
  test("Mouseflow", () => assertMedium("cdn.mouseflow.com"));
});

// ─── Consent ──────────────────────────────────────────────────────────────────
describe("Consent Management (MEDIUM)", () => {
  test("OneTrust CDN", () => assertMedium("cdn.cookielaw.org"));
  test("OneTrust geolocation", () => assertMedium("geolocation.onetrust.com"));
  test("Cookiebot", () => assertMedium("consent.cookiebot.com"));
  test("TrustArc", () => assertMedium("consent.truste.com"));
  test("Didomi", () => assertMedium("sdk.privacy-center.org"));
});

// ─── Analytics (LOW) ─────────────────────────────────────────────────────────
describe("Analytics (LOW)", () => {
  test("Google Analytics", () => assertLow("www.google-analytics.com"));
  test("GA4 region", () => assertLow("region1.google-analytics.com"));
  test("Mixpanel API", () => assertLow("api.mixpanel.com"));
  test("Amplitude CDN", () => assertLow("cdn.amplitude.com"));
  test("Heap", () => assertLow("cdn.heapanalytics.com"));
  test("Plausible", () => assertLow("plausible.io"));
  test("Pendo", () => assertLow("cdn.pendo.io"));
});

// ─── Advertising (LOW) ───────────────────────────────────────────────────────
describe("Advertising (LOW)", () => {
  test("DoubleClick", () => assertLow("stats.g.doubleclick.net"));
  test("Google AdSense", () => assertLow("pagead2.googlesyndication.com"));
  test("Meta Pixel", () => assertLow("connect.facebook.net"));
  test("LinkedIn Insight", () => assertLow("snap.licdn.com"));
  test("Criteo", () => assertLow("static.criteo.net"));
  test("TikTok pixel", () => assertLow("analytics.tiktok.com"));
  test("AdRoll", () => assertLow("d.adroll.com"));
});

// ─── Unknown domain fallback ──────────────────────────────────────────────────
describe("Unknown domain fallback", () => {
  test("returns MEDIUM for unrecognized domain", () => {
    const r = classifyDomain("totally-random-unknown.io");
    assert.equal(r.confidence, "MEDIUM");
    assert.equal(r.category, "unknown");
    assert.equal(r.known, false);
  });

  test("returns known=true for recognized domain", () => {
    const r = classifyDomain("featureassets.org");
    assert.equal(r.known, true);
  });

  test("label is a non-empty string", () => {
    const r = classifyDomain("featureassets.org");
    assert.ok(r.label.length > 0);
  });
});
