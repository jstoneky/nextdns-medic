# NextDNS Medic

**See exactly what your DNS blocker is blocking — and why it matters.**

A browser extension for **Chrome** and **Firefox** that watches your network traffic in real-time, identifies domains blocked by NextDNS or Pi-hole, and tells you the *functional impact* — whether a block might break login, stop videos from loading, prevent checkout, hide maps, or silence support chat.

[![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com)
[![Firefox](https://img.shields.io/badge/Firefox-MV2-FF7139?logo=firefox&logoColor=white)](https://addons.mozilla.org)

---

## The Problem

NextDNS, Pi-hole, and other DNS-level blockers work great for privacy, but they can cause subtle breakage on websites. A feature flag service gets blocked, and suddenly an inventory page won't load. An auth provider is blocked, and login silently fails. A payment processor is blocked, and checkout never completes. You reload the page six times wondering what's wrong, never knowing DNS was the culprit.

This extension makes that visible — and tells you exactly what's at stake.

---

## How It Works

1. **Monitors network errors** on every tab using the browser's `webRequest` API
2. **Identifies DNS-block signatures** — certificate issuer failures, name resolution errors, and other patterns that indicate a DNS-level block (not a server error or timeout)
3. **Classifies every blocked domain** against a database of **492 known services across 13 categories**, grouped by how likely they are to break site functionality:
   - 🔴 **High** — Feature flags, authentication, payment processors, search APIs, core CDNs, CAPTCHA. These break sites.
   - 🟡 **Medium** — Support chat, video players, maps, image CDNs, error monitoring, e-commerce. May affect functionality depending on the site.
   - 🟢 **Low** — Pure analytics and advertising. Almost never affects how a site works.
4. **Shows a functional impact badge** on every blocked domain — so you know at a glance *what breaks*, not just *that something broke*
5. **Attributes the block** to a specific blocklist — works for both **NextDNS** (from the logs API) and **Pi-hole v6** (via the gravity search API, with pretty names for 30+ common lists)
6. **Unknown domains** fall back to Medium — worth reviewing, but not necessarily critical
7. **Badge updates** on the extension icon: count of blocked domains, red = high-risk detected

---

## Popup UI

Click the extension icon on any page to see:

- **Stats bar** — counts of High / Medium / Low blocked domains; click any level to filter
- **Impact badge** — color-coded tag on every domain showing the functional consequence of blocking it (see [Impact Badges](#impact-badges) below)
- **Blocklist attribution** — which blocklist rule flagged the domain (HaGeZi, AdGuard, uBlock Origin, etc.)
- **Grouped list** — blocked domains sorted by risk, showing service name, error type, and hit count
- **📋 Copy button** — copies the domain to clipboard; works with NextDNS, Pi-hole, AdGuard, or any DNS blocker
- **+ Allowlist button** — one click adds the domain to your **NextDNS** or **Pi-hole** allowlist (requires credentials)
- **DNS flush reminder** — appears after every allowlist/copy action with the exact command for your OS
- **Profile indicator** — NextDNS profiles are fingerprint-matched; your current device's profile is labeled "This device"

---

## Impact Badges

Every blocked domain carries a color-coded badge showing the **functional impact** of the block — not just how risky it is, but specifically what it might break:

| Badge | Color | What it means | Example categories |
|-------|-------|---------------|--------------------|
| login/forms | 🔴 Red | Could prevent login, registration, or form submission | Auth, payments, CAPTCHA |
| media/maps/assets | 🔵 Blue | Could break video playback, maps, or page assets | Video players, maps, image CDNs, CDN |
| chat | 🟢 Green | Could hide or disable support chat widgets | Support chat, real-time |
| feature flags | 🟣 Purple | Could silently change or disable site features | Feature flags |
| search | 🩵 Cyan | Could break search or autocomplete | Search APIs |
| monitoring | ⚫ Black | Could disable error reporting or observability | Error monitoring |

These badges are independent of the High/Medium/Low risk rating — a "Low" domain can still carry a `monitoring` badge so you know what's affected.

---

## Setup

### Install

**Chrome:** Load unpacked via `chrome://extensions` → Developer mode → Load unpacked (select the folder)

**Firefox:** Load via `about:debugging` → This Firefox → Load Temporary Add-on (select the zip)

*Both will be available on their respective extension stores once reviewed.*

### Configure NextDNS credentials (optional)
Click the extension icon → ⚙️ Settings and enter:
- **NextDNS API Key** — found at [my.nextdns.io](https://my.nextdns.io) → Account → API
- **Profile ID** — the 6-character ID in your NextDNS dashboard URL

The extension auto-detects which NextDNS profile belongs to this device (fingerprint match) and labels it **"This device"** in the profile list.

### Configure Pi-hole credentials (optional)
Click the extension icon → ⚙️ Settings and enter:
- **Pi-hole URL** — e.g. `http://pi.hole` or your Pi-hole's IP address
- **API Token** — found in Pi-hole's web interface → Settings → API

Both **Pi-hole v5** and **Pi-hole v6** are supported. The extension auto-detects the API version.

Without credentials the extension still monitors and classifies — you just won't have the one-click allowlist button. You can always use the 📋 copy button to manually add domains in your DNS blocker's dashboard.

---

## Browser Compatibility

| Browser | Manifest | Background | Status |
|---|---|---|---|
| Chrome 109+ | MV3 | Service Worker | ✅ Supported |
| Firefox 109+ | MV2 | Background Scripts | ✅ Supported |
| Edge | MV3 | Service Worker | ✅ Should work (untested) |

**Firefox note:** NextDNS blocks appear as certificate issuer errors in Firefox (e.g. "Peer's Certificate issuer is not recognized"). The extension detects these correctly, including the curly-apostrophe variant (U+2019) that Firefox uses internally.

---

## Domain Classification Database

The extension ships with a bundled database of **492 entries across 13 categories** and automatically fetches updates from this repository. The database is cached locally for 7 days and can be force-refreshed from the Settings panel at any time.

### Coverage

| Category | Examples | Risk | Impact Badge |
|---|---|---|---|
| Feature Flags | Statsig, LaunchDarkly, Split.io, Optimizely, PostHog, GrowthBook, ConfigCat | 🔴 High | 🟣 feature flags |
| Authentication | Auth0, Okta, Clerk, Kinde, Stytch, WorkOS, Firebase Auth, AWS Cognito, Azure AD | 🔴 High | 🔴 login/forms |
| Payment Processors | Stripe, Braintree, PayPal, Klarna, Adyen, Affirm, Afterpay, Square | 🔴 High | 🔴 login/forms |
| Search APIs | Algolia, Constructor.io, Searchspring, Klevu, Bloomreach, Coveo, Yext | 🔴 High | 🩵 search |
| CDN | Cloudflare, Fastly, Akamai, jsDelivr, unpkg, Google APIs, AWS | 🔴 High | 🔵 media/maps/assets |
| Real-time / WebSocket | Pusher, Ably, Twilio, LiveKit, Daily.co, Agora | 🔴 High | 🟢 chat |
| CAPTCHA | reCAPTCHA, hCaptcha, Turnstile, FunCAPTCHA, GeeTest | 🔴 High | 🔴 login/forms |
| Video Players | YouTube Embed, Vimeo, Wistia, Mux, Brightcove, JW Player | 🟡 Medium | 🔵 media/maps/assets |
| Maps | Google Maps, Mapbox, HERE Maps, MapTiler, OpenStreetMap tiles | 🟡 Medium | 🔵 media/maps/assets |
| Support Chat | Intercom, Zendesk, HubSpot, Drift, Crisp, Freshchat, LiveChat | 🟡 Medium | 🟢 chat |
| Image CDNs | Cloudinary, Imgix, Fastly Image Optimizer, Thumbor, ImageKit | 🟡 Medium | 🔵 media/maps/assets |
| Error Monitoring | Sentry, Datadog RUM, New Relic, Bugsnag, Rollbar, Raygun | 🟡 Medium | ⚫ monitoring |
| E-commerce | Shopify, Affirm, Klarna widgets, Yotpo, Bazaarvoice, Stamped | 🟡 Medium | 🔴 login/forms |

### Dynamic updates

The database is maintained in [`domain-db.json`](./domain-db.json) in this repo. On first load the extension fetches the latest version and caches it for 7 days. If the fetch fails for any reason, the bundled fallback is used transparently. No version bump required — the DB updates silently in the background.

**Security:** The remote DB is fetched as JSON only — never eval'd or executed. Every entry is validated against a strict schema (pattern allowlist, length caps, confidence enum) before being compiled into RegExp objects. Each regex test is wrapped in try/catch for ReDoS isolation.

---

## Supported DNS Blockers

| Provider | One-click Allowlist | Blocklist Attribution | Profile Auto-detect |
|---|---|---|---|
| **NextDNS** | ✅ via REST API | ✅ (HaGeZi, AdGuard, etc.) | ✅ "This device" fingerprint |
| **Pi-hole v5** | ✅ via API Token | — | — |
| **Pi-hole v6** | ✅ via API Token | — | — |
| **Any other** | 📋 Copy to clipboard | — | — |

---

## Building

```bash
# Build both Chrome and Firefox (runs tests first)
./build.sh all

# Build for a specific browser
./build.sh chrome
./build.sh firefox

# Remove old artifacts from store/dist/
./build.sh clean
```

The build script runs the full test suite before building. If any test fails, the build is aborted. Old version artifacts are automatically cleaned from `store/dist/` before each build.

Output goes to `store/dist/`.

---

## Testing

```bash
# Run all tests
npm test

# Run specific suites
npm run test:domain   # Domain classification (492 entries, 13 categories)
npm run test:errors   # Error string detection (24 tests)
npm run test:build    # Build artifact validation (41 tests)
```

No dependencies — uses Node's built-in `node:test` runner. Tests cover:
- Domain classification accuracy across all 13 categories
- Chrome and Firefox error string matching (including curly-apostrophe edge case)
- False-positive rejection (NS_BINDING_ABORTED, ERR_TIMED_OUT, etc.)
- `extractHostname()` edge cases
- Manifest schema validation (MV3 and MV2)
- Build artifact existence and size

---

## Privacy

This extension:
- **Does not collect or transmit any personal data**
- **Does not store browsing history** — all data is session-only and cleared on navigation
- **Only stores hostnames**, never full URLs or page content
- **Fetches domain-db.json** from GitHub on first load and every 7 days (no user data sent)
- Your NextDNS API key is stored locally in browser sync storage

Full privacy policy: [store/PRIVACY.md](./store/PRIVACY.md)

---

## Tech Stack

- Browser Extension (Chrome MV3 / Firefox MV2)
- Vanilla JS — no build step, no framework dependencies
- `webRequest.onErrorOccurred` — request error monitoring
- `webNavigation.onCommitted` — tab lifecycle management
- `storage.local` — DB caching
- `storage.sync` — settings sync across devices
- `navigator.clipboard` — copy to clipboard
- NextDNS REST API — allowlist management
- `browser-compat.js` — cross-browser API shim (`chrome.*` ↔ `browser.*`)
- `db-loader.js` — remote DB fetch, validation, and cache management

---

## Store Assets

```
store/
├── PRIVACY.md              # Shared privacy policy
├── chrome/
│   ├── LISTING.md          # Chrome Web Store listing copy
│   ├── icon-128-store.png  # 128×128 store icon
│   ├── promo-tile-440x280.jpg
│   ├── marquee-1400x560.jpg
│   └── screenshots/        # 1280×800 PNG (5 screenshots)
└── firefox/
    ├── LISTING.md          # Firefox Add-ons listing copy
    └── screenshots/        # Same screenshots, Firefox-compatible
```

---

## Contributing

PRs welcome. Most useful contributions:

- **New entries in `domain-db.json`** — add real hostnames with correct confidence, category, and impact badge
- **Confidence corrections** — if a domain is miscategorized, open a PR with justification
- **Impact badge corrections** — if the functional impact label is wrong, fix it with reasoning
- **Blocklist attribution data** — if you know which blocklist targets a domain, add it
- **New categories** — e.g. A/B testing tools, identity verification, streaming infrastructure
- **Edge / Safari port**
- **Automated integration tests**

When adding entries to `domain-db.json`, match the schema:
```json
{ "pattern": "exact\\.domain\\.com", "flags": "", "label": "Category (Service Name)", "confidence": "HIGH", "category": "feature-flags" }
```

Run `npm test` before submitting — the test suite validates every entry and will catch malformed patterns or invalid confidence values.

---

## Changelog

### v2.2.0
- **Pi-hole blocklist attribution** — for Pi-hole users, blocked domains now show which gravity list flagged them (uses `/api/search/{domain}`). Includes a pretty-name map for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList/EasyPrivacy, Disconnect.me, Energized, URLhaus, and more. Unknown lists fall back to their hostname.

### v2.1.0
- **Expanded domain database** — 492 entries across 13 categories (+146 new entries: CAPTCHA, video players, maps, support chat, image CDNs, error monitoring)
- **Functional impact badges** — every blocked domain now shows a color-coded badge describing the specific consequence (login, media, maps, chat, features, assets, monitoring, notifications)
- **New extension icon** — dark shield with cyan medical cross and pulse line

### v2.0.0
- **Pi-hole support** — allowlist directly to Pi-hole v5 or v6 (auto-detected)
- **NextDNS profile auto-detect** — fingerprints your device against your profiles; no manual profile ID needed
- **DNS provider toggle** — switch between NextDNS and Pi-hole in settings

### v1.4.0 – v1.4.1
- Risk-level filter — click HIGH / MEDIUM / LOW stats bar to filter the block list
- DNS flush reminder banner — shows exact OS-aware command after every allowlist/copy action

### v1.3.0
- DNS flush banner after allowlist actions

### v1.2.0
- Copy to clipboard button
- Remote domain database with 7-day cache and force-refresh

### v1.1.0
- Firefox support (MV2)
- Dynamic remote domain database

---

## License

MIT
