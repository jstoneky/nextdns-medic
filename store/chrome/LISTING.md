# Chrome Web Store Listing

## Name
NextDNS Medic

## Short Description (132 chars max)
See what your DNS blocker is blocking — and why it matters. Impact badges, blocklist attribution, one-click allowlist for NextDNS & Pi-hole.

## Full Description

**Ever wonder why a website isn't loading properly — even though your internet is fine?**

If you use NextDNS, Pi-hole, or any DNS-based blocker, the answer is often a silently blocked domain. A feature flag service gets blocked, and the inventory page never loads. An auth provider is blocked, and login breaks. A CAPTCHA provider is blocked, and the form won't submit. You reload six times and never find the cause.

**NextDNS Medic makes it visible — and tells you exactly what's at stake.**

---

### See what's blocked and why it matters

Most DNS debuggers just show you a list of blocked domains. NextDNS Medic shows you the *functional impact* — a color-coded badge on every blocked domain telling you what breaks if you leave it blocked:

🔴 **login/forms** — Could prevent login, sign-up, or checkout (auth, payments, CAPTCHA)
🔵 **media/maps/assets** — Could break video playback, maps, or page images (CDN, video players, maps, image CDNs)
🟢 **chat** — Could hide or disable support chat widgets
🟣 **feature flags** — Could silently change or disable site features
🩵 **search** — Could break search or autocomplete
⚫ **monitoring** — Could disable error reporting

So instead of "statsig.com is blocked (High)", you see "statsig.com is blocked — 🟣 feature flags". You know immediately whether it matters for what you're trying to do.

---

### What it does

• Monitors every network request on every tab in real-time
• Detects DNS-level blocks (ERR_NAME_NOT_RESOLVED, ERR_CERT_AUTHORITY_INVALID, and similar)
• Shows a **functional impact badge** on every blocked domain — not just risk, but *what breaks*
• **Blocklist attribution** — see which blocklist (HaGeZi, AdGuard, uBlock, etc.) flagged each domain
• Classifies 492 known services across 13 categories by functional impact
• Shows a live badge on the icon — red means high-risk blocks are active right now
• Filter by risk level (High / Medium / Low) with a single click on the stats bar
• Copy any domain to clipboard — works with Pi-hole, AdGuard, or any DNS blocker
• **One-click allowlist for NextDNS AND Pi-hole** (v5 + v6) — API key required
• DNS flush reminder after every allowlist or copy action — exact command for your OS, ready to copy
• **NextDNS profile auto-detection** — fingerprint match labels your current device's profile "This device"

---

### Risk levels

🔴 **High — May break this site**
Feature flag services (Statsig, LaunchDarkly, Optimizely, PostHog), authentication providers (Auth0, Okta, Clerk), search APIs (Algolia, Bloomreach), payment processors (Stripe, Braintree, Adyen), CAPTCHA (reCAPTCHA, hCaptcha, Turnstile), and core CDNs. When these are blocked, sites often fail silently or show broken/empty states.

🟡 **Medium — Worth reviewing**
Support chat (Intercom, Zendesk, Drift), video players (YouTube Embed, Vimeo, Wistia), maps (Google Maps, Mapbox), image CDNs (Cloudinary, Imgix), error monitoring (Sentry, Datadog, New Relic), and e-commerce widgets (Yotpo, Bazaarvoice). May affect functionality depending on how the site is built.

🟢 **Low — Safe to ignore**
Pure analytics (Google Analytics, Mixpanel, Amplitude, Heap) and advertising pixels (Meta, LinkedIn, TikTok). Blocking these is usually intentional and rarely breaks anything.

Unknown domains are flagged as Medium by default.

---

### Blocklist attribution

Each blocked domain shows *which blocklist rule* flagged it — works for both NextDNS and Pi-hole:

• **NextDNS** — pulled directly from the NextDNS logs API, showing the exact list name
• **Pi-hole** — uses the gravity search API to look up which of your enabled lists contains the domain, with pretty names for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList, EasyPrivacy, Disconnect.me, Energized, URLhaus, and more

So you know exactly where the block is coming from and can make an informed call about whether to allowlist it.

---

### Filter by risk level

Click **High**, **Medium**, or **Low** in the stats bar to filter the list instantly. Click again to clear. Active level is highlighted; inactive ones dim out — so you can focus on what matters.

---

### Copy to clipboard

Every blocked domain has a 📋 copy button. No account needed — copy the domain and paste it into Pi-hole, AdGuard Home, or any other DNS blocker's dashboard.

---

### DNS flush reminder

After you allowlist or copy a domain, a banner appears with the exact DNS flush command for your OS (macOS, Windows, or Linux) — with its own copy button. No more wondering why changes aren't taking effect.

---

### One-click allowlist (NextDNS + Pi-hole)

**NextDNS:** Connect your account (API key + profile ID from my.nextdns.io). The extension auto-detects which profile belongs to this device and labels it "This device". One click — domain added, no dashboard required.

**Pi-hole:** Connect your Pi-hole (URL + API token). Supports both Pi-hole v5 and Pi-hole v6. One click — domain allowlisted instantly.

---

### 492-domain database, always up to date

Ships with a curated database of **492 known services across 13 categories**: feature flags, auth, payments, search, CDN, real-time, CAPTCHA, video players, maps, support chat, image CDNs, error monitoring, and e-commerce. The database is automatically fetched from GitHub and cached locally for 7 days. Force-refresh anytime from the Settings panel.

---

### Privacy

• No data is ever sent to any third party
• All monitoring is session-only — cleared on navigation
• Only hostnames are stored, never full URLs or page content
• Your API key stays in your local Chrome storage
• Remote DB fetch contacts GitHub only (no user data sent)

---

### Perfect for

• NextDNS and Pi-hole users who want to know what's actually being blocked
• Developers debugging sites behind DNS blockers
• Anyone who's ever had a site break mysteriously and suspected their DNS setup
• Anyone who wants to allowlist responsibly — knowing the impact before they unblock

---

## Category
Productivity

## Language
English

## Tags / Keywords
nextdns, pi-hole, dns, blocker, network monitor, privacy, allowlist, debugging, web developer, adguard, impact badges, blocklist

---

## What's New (v2.2.0)
Pi-hole users now get full blocklist attribution — see exactly which gravity list flagged each blocked domain. Includes pretty names for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList, EasyPrivacy, Disconnect.me, Energized, URLhaus, and more. Previously only available for NextDNS users.

---

## Screenshots (1280x800)
Located in store/chrome/screenshots/
1. Popup with HIGH confidence blocks detected (red badge, red section visible, impact badges shown)
2. Popup showing mixed High/Medium/Low breakdown with blocklist attribution
3. Filter active — only High items shown, Medium/Low dimmed
4. Settings panel open showing DB meta + refresh button + Pi-hole config
5. DNS flush banner visible after allowlist action

## Promotional tile (440x280)
store/chrome/promo-tile-440x280.jpg

## Marquee (1400x560)
store/chrome/marquee-1400x560.jpg

## Store icon (128x128)
store/chrome/icon-128-store.png
