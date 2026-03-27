# Firefox Add-ons Listing

## Name
NextDNS Medic

## Summary (250 chars max)
See what your DNS blocker is blocking — and why it matters. Impact badges, blocklist attribution, one-click allowlist for NextDNS & Pi-hole. 492 known domains across 13 categories.

## Description

**Ever wonder why a website isn't loading properly — even though your internet is fine?**

If you use NextDNS, Pi-hole, or any DNS-based blocker, the answer is often a silently blocked domain. A CAPTCHA provider is blocked, and login fails. A feature flag service is blocked, and the page loads empty. A video CDN is blocked, and the player is just a white box. You reload six times and never find the cause.

**NextDNS Medic makes it visible — and tells you exactly what's at stake.**

---

**See what's blocked and why it matters**

Most DNS debuggers just show you a list of blocked domains. NextDNS Medic shows you the *functional impact* — a color-coded badge on every blocked domain telling you what breaks:

🔴 **login/forms** — Could prevent login, sign-up, or checkout (auth, payments, CAPTCHA)
🔵 **media/maps/assets** — Could break video playback, maps, or page images
🟢 **chat** — Could hide or disable support chat widgets
🟣 **feature flags** — Could silently change or disable site features
🩵 **search** — Could break search or autocomplete
⚫ **monitoring** — Could disable error reporting

---

**Blocklist attribution**

See exactly which blocklist flagged each domain — works for NextDNS and Pi-hole. NextDNS pulls from the logs API. Pi-hole uses the gravity search API to match your enabled lists, with pretty names for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList, Disconnect.me, and more.

---

**What it does**

• Monitors every network request on every tab in real-time
• Detects DNS-level blocks (certificate issuer errors, name resolution failures, and similar)
• Shows functional impact badges — know immediately whether a block matters
• Shows which blocklist caused each block
• Live badge on the icon — red means high-risk blocks are active right now
• Filter by risk level with a single click on the stats bar
• Copy any domain to clipboard — works with any DNS blocker
• One-click allowlist for NextDNS and Pi-hole (v5 + v6)
• DNS flush reminder after every allowlist or copy — exact command for your OS, ready to copy

---

**Risk levels**

🔴 High — May break this site
Feature flags (Statsig, LaunchDarkly, PostHog), auth (Auth0, Okta, Clerk), payments (Stripe, Braintree), search (Algolia), CAPTCHA (reCAPTCHA, hCaptcha, Turnstile), video (Vimeo, Wistia, Loom), maps (Google Maps, Mapbox), image CDNs (Imgix, Cloudinary).

🟡 Medium — Worth reviewing
Tag managers, support chat (Intercom, Zendesk, Drift, Crisp), error monitoring (Sentry, Datadog), session replay (Hotjar, FullStory), consent platforms.

🟢 Low — Safe to ignore
Pure analytics and advertising pixels. Blocking these is usually intentional and rarely breaks anything.

---

**Filter by risk level**

Click High, Medium, or Low in the stats bar to filter the list instantly. Click again to clear.

---

**Copy to clipboard**

Every blocked domain has a 📋 copy button. No account needed — copy and paste into any DNS blocker's dashboard.

---

**DNS flush reminder**

After you allowlist or copy a domain, a banner shows the exact DNS flush command for your OS (macOS, Windows, or Linux) — with its own copy button.

---

**One-click allowlist — NextDNS and Pi-hole**

• **NextDNS**: Enter your API key, auto-detect your active profile via fingerprint matching, one-click allowlist
• **Pi-hole v5 + v6**: Enter your URL and password, auto-detects version, one-click allowlist

---

**492+ domain database, always up to date**

Ships with a curated database of 492+ known services across 13 categories: feature flags, auth, payments, search, CDN, real-time, CAPTCHA, video, maps, support chat, image CDNs, error monitoring, and e-commerce. Auto-fetched from GitHub, cached 7 days, force-refresh anytime.

---

**Privacy**

• No data is ever sent to any third party
• All monitoring is session-only — cleared on navigation
• Only hostnames are stored, never full URLs or page content
• Your API key stays in your local browser storage
• Remote DB fetch contacts GitHub only (no user data sent)

---

**Perfect for**

• NextDNS users who want visibility into what's being blocked
• Developers debugging sites behind DNS blockers
• Pi-hole and AdGuard users who need to identify broken domains
• Anyone who's ever had a site break mysteriously and suspected their DNS setup

---

## Category
Privacy & Security

## Tags
nextdns, dns, blocker, network monitor, privacy, allowlist, debugging, developer tools, pi-hole, adguard

## Support / Homepage
https://github.com/jstoneky/nextdns-medic

## License
MIT

---

## Release Notes (v2.2.0)
Pi-hole users now get full blocklist attribution — see exactly which gravity list flagged each blocked domain. Includes pretty names for 30+ popular lists: HaGeZi, Steven Black, OISD, AdGuard DNS filter, EasyList, EasyPrivacy, Disconnect.me, Energized, URLhaus, and more. Previously only available for NextDNS users.

---

## Screenshots (1280x800 PNG)
Located in store/firefox/screenshots/ — same as Chrome screenshots (identical UI).

## Privacy Policy URL
https://raw.githubusercontent.com/jstoneky/nextdns-medic/main/store/PRIVACY.md
