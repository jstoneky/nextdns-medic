# Chrome Web Store Listing — DNS Medic v3.2.0

## Name
DNS Medic

## Short Description (132 chars max)
Detects DNS blocks that break websites. Supports NextDNS, Pi-hole, and Control D. Groups by risk and lets you allowlist instantly.

## Full Description

**Your DNS blocker is silently breaking websites. DNS Medic shows you exactly what — and why it matters.**

If you use NextDNS, Pi-hole, or Control D, you already know the tradeoff: great privacy, but occasionally something stops working. A login breaks. A payment form won't load. Search autocomplete disappears. You reload three times and give up.

DNS Medic watches every network request in real time, catches the DNS blocks, and tells you the functional impact of each one — so you can make a smart call: ignore it, or allowlist it in one click.

---

### What it does

- Monitors every tab in real time for DNS-level blocks
- Detects ERR_NAME_NOT_RESOLVED, ERR_CERT_AUTHORITY_INVALID, and more
- Classifies 492 known services across 13 categories by functional impact
- Shows **impact badges** — not just "blocked," but what actually breaks
- Shows **blocklist attribution** — which list flagged the domain (HaGeZi, AdGuard, uBlock, etc.)
- Live badge on the extension icon — red dot means high-risk blocks are active now
- Filter by **High / Medium / Low** risk with one click
- **One-click allowlist** for NextDNS, Pi-hole (v5 + v6), and Control D
- DNS flush command shown automatically after every allowlist action
- **Light and dark mode** — follows your system preference or set manually

---

### Risk levels

🔴 **High — May break this site**
Auth providers (Auth0, Okta, Clerk), feature flags (Statsig, LaunchDarkly, PostHog), payment processors (Stripe, Braintree, Adyen), search APIs (Algolia, Bloomreach), CAPTCHA (reCAPTCHA, hCaptcha, Turnstile), and core CDNs. When these are blocked, things fail visibly — or silently.

🟡 **Medium — Worth reviewing**
Support chat (Intercom, Zendesk, Drift), video players (YouTube Embed, Vimeo), maps (Google Maps, Mapbox), image CDNs (Cloudinary, Imgix), error monitoring (Sentry, Datadog, New Relic), and e-commerce widgets. May affect functionality depending on the site.

🟢 **Low — Safe to ignore**
Analytics (Google Analytics, Mixpanel, Amplitude) and ad pixels (Meta, LinkedIn, TikTok). Blocking these is usually intentional and rarely breaks anything.

Unknown domains default to Medium.

---

### Impact badges

Every blocked domain shows what breaks if you leave it blocked:

- 🔴 **login / forms** — auth, CAPTCHA, payments
- 🟣 **feature flags** — silent behavior changes
- 🩵 **search** — autocomplete and results
- 🔵 **media / maps / assets** — video, maps, images
- 🟢 **chat** — support widgets
- ⚫ **monitoring** — error reporting

---

### Blocklist attribution

See exactly which blocklist rule flagged each domain:

- **NextDNS** — pulled from the NextDNS logs API, showing the exact list name
- **Pi-hole** — searches your gravity database, with pretty names for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList, EasyPrivacy, Disconnect.me, Energized, URLhaus, and more
- **Control D** — shows the active filter profile that triggered the block

---

### One-click allowlist

**NextDNS** — Connect with your API key. DNS Medic auto-detects which profile belongs to this device and labels it "This device." One click adds the domain.

**Pi-hole** — Connect with your Pi-hole URL and API token. Supports v5 and v6. One click allowlists the domain instantly.

**Control D** — Connect with your Control D credentials. One click adds the domain to your custom rules.

After every allowlist action, a banner appears with the exact DNS flush command for your OS — with its own copy button.

---

### 492-domain database

Ships with a curated database of 492 known services across 13 categories. Automatically updated from GitHub and cached locally for 7 days. Force-refresh anytime from Settings.

---

### Light & Dark mode

Full light mode support added in v3.2.0. Follows your system preference by default, or set it manually in Settings.

---

### Privacy

- No data is ever sent to any third party
- All monitoring is session-only — cleared on navigation
- Only hostnames are stored, never full URLs or page content
- Your API keys stay in local Chrome storage only
- Remote DB fetch contacts GitHub only — no user data sent

Full privacy policy: https://raw.githubusercontent.com/jstoneky/nextdns-medic/main/store/PRIVACY.md

---

### Perfect for

- NextDNS, Pi-hole, and Control D users who want to know what's being blocked
- Developers debugging sites behind DNS filters
- Anyone who's had a site break mysteriously and suspected their DNS setup
- Anyone who wants to allowlist responsibly — understanding the impact before unblocking

---

## Category
Developer Tools

## Tags / Keywords
nextdns, pi-hole, control d, dns, blocker, network monitor, privacy, allowlist, debugging, web developer, adguard, blocklist, dns medic

---

## What's New (v3.2.0)

**Control D support** — DNS Medic now works with all three major DNS providers: NextDNS, Pi-hole, and Control D. One-click allowlist, blocklist attribution, and profile auto-detection for all three.

**Light mode** — Full light theme added. Follows your system preference by default; override it in Settings.

**UI refresh** — Cleaner stats bar, smoother animations, improved mobile layout for Safari iOS.

---

## Assets

### Screenshots (1280×800) — store/chrome/screenshots/
- app-1.png — Dark mode: high-risk blocks detected (shop.example.com — stripe, auth0, feature flags)
- app-2.png — Dark mode: single HIGH block in focus (cdn.auth0.com)
- app-3.png — Light mode: mixed risk levels (news.example.com)
- app-4.png — Settings panel: DNS provider selector, API key, profile picker
- app-5.png — Post-allowlist: success banner + DNS flush command
- marketing-1.png — "Know exactly what is being blocked as you browse"
- marketing-2.png — "Every block, categorised by risk"
- marketing-3.png — "Works with NextDNS, Pi-hole and Control D"
- marketing-4.png — "All clear. Real-time monitoring"
- marketing-5.png — "Fix it in one click. For real"

### Store icon (128×128)
store/chrome/icon-128-store.png

### Promotional tile (440×280)
store/chrome/promo-tile-440x280.jpg

### Marquee (1400×560)
store/chrome/marquee-1400x560-v3.0.jpg
