# Changelog

All notable changes to DNS Medic are documented here.

---

## [3.2.0] — 2026-03-29

### Added
- **Light mode** — full light theme with off-white palette and WCAG AA contrast throughout
- **Theme toggle** — three-way System / Light / Dark selector in settings panel; preference synced via `chrome.storage.sync`
- **Friendly error labels** — Firefox verbose cert/network error strings (e.g. "Peer's Certificate issuer is not recognized.") now display as short readable labels (e.g. "untrusted cert issuer"); ~15 Firefox and Chrome error patterns covered

### Fixed
- Light mode contrast audit: selected profile, DNS status chips, flush banner, allowlist button states, impact badges, profile badge/checkmark, Pi-hole version labels, copy button success state all properly adapted for light backgrounds

---

## [3.1.2] — 2026-03-28

### Fixed
- Resolved all AMO linter warnings: bumped `strict_min_version` to 142, replaced all `innerHTML` assignments with DOM construction, extracted inline `<script>` from `diagnostics.html` to external `diagnostics.js`
- Safari popup height no longer expands when settings panel opens, eliminating white gap on close
- Settings panel scrolls internally on Safari instead of scrolling the whole popup

### Added
- Ko-fi support link ("☕ Buy me a coffee") in settings panel footer alongside bug report link

---

## [3.1.0] — 2026-03-28

### Added
- **Safari for macOS support** — DNS Medic now runs as a native Safari Web Extension via a macOS app wrapper (MV2, persistent background)
  - Detects blocked requests via Safari's `net::ERR_ABORTED` signal — known tracker domains classified immediately
  - Unknown aborted domains shown in a separate **"⚪ Unverified — Aborted Requests"** section (muted, with disclaimer)
  - For NextDNS users: unverified domains auto-confirmed via NextDNS logs API when popup opens — promoted to main HIGH/MEDIUM/LOW list with blocklist tag
  - `build-safari.sh` added; `build.sh all` now includes Safari
  - Distributable: `dns-medic-safari-macOS-v3.1.0.zip` (unsigned — right-click → Open to install)
- **Bug reporting system**
  - "🐛 Report a Bug" link in settings panel — pre-fills GitHub issue with version, browser, DNS provider, DB meta, recent error log
  - `diagnostics.html` standalone page — environment info, reachability test, copyable bug report, one-click GitHub issue
  - `.github/ISSUE_TEMPLATE/bug_report.md` — structured issue template
- **27 new tests** for bug reporting (error logger, message handlers, URL construction, file existence)

### Fixed
- Badge/data desync — popup no longer shows "Nothing here" when badge has a non-zero count; `onUpdated` no longer wipes `tabData` on `loading` status; `onCommitted` is sole reset owner
- Stale tab ID error — `No tab with id` error silenced when tab closes during popup init
- Firefox Android popup height — `100vh` → `100dvh` + dynamic `max-height` for blocks list

### Changed
- All 49 bare keyword patterns anchored to canonical TLD domains — eliminates false positives from substring matches
- 3 over-broad patterns corrected: `fathom` → `usefathom\.com`, `pages\.dev` → `\.pages\.dev`, `daily\.co` → `(^|\.)daily\.co$`

### Domain Database (492 → 561 entries, +69)
- **Notifications:** OneSignal, Pushwoosh, Airship, Braze, Iterable, Attentive, Klaviyo
- **Headless CMS:** Contentful (ctfassets.net), Storyblok, Sanity, DatoCMS
- **A/B Testing:** VWO, AB Tasty, Convert.com
- **Reviews:** Yotpo, Bazaarvoice
- **Auth:** Frontegg, Descope, PropelAuth, Hanko, Corbado
- **Payments:** Lemon Squeezy, Checkout.com, Spreedly, Primer
- **Feature flags:** DevCycle, Hypertune
- **CAPTCHA:** GeeTest v3/v4, MTCaptcha
- **Video:** Kaltura, SproutVideo
- **Other:** LottieFiles (animation), Crowdin (localization), call-tracking, SEO, maps

---

## [3.0.0] — 2026-03-27

### Added
- **Control D support** — allowlist directly to Control D; profile picker loads your profiles via API token; one-click allowlist creates a BYPASS rule in the selected profile
- **DNS routing status chip** — header now shows a live green/red indicator confirming whether your browser's DNS is actually routing through the selected provider:
  - NextDNS: probes `test.nextdns.io`
  - Control D: probes `{random}.dns.controld.com/detect`
  - Pi-hole: probes `http://pi.hole` (magic domain; resolves only if DNS goes through Pi-hole)
- **Provider abstraction layer** — internal refactor; all DNS provider logic extracted into `providers/nextdns.js`, `providers/pihole.js`, `providers/controld.js`; `popup.js` is now provider-agnostic

### Changed
- Settings panel now has a three-way provider toggle: **NextDNS**, **Pi-hole**, **Control D**
- Status chip always visible after credentials are configured — shows active state or warning; never silently hides

---

## [2.5.0] — 2026-03-27

### Fixed
- **Flush banner copy button** — replaced invisible emoji button with a visible styled "Copy" button; turns green and shows "Copied!" on success
- **Android flush banner** — removed confusing "Reload" button; replaced with full plain-English instructions that wrap correctly on mobile ("Toggle Airplane Mode → wait 5 seconds → toggle back…")

---

## [2.4.0] — 2026-03-27

### Added
- **Firefox for Android support** — extension now works on mobile; popup fills the full panel width on narrow viewports
- **API key validation on save** — NextDNS API key is validated before saving; invalid keys show a red error and are not stored; network errors show a warning but save anyway

### Fixed
- **Cookie bypass** — all NextDNS API calls now use `credentials: "omit"` to prevent browser session cookies from silently authenticating garbage keys
- **Android DNS flush banner** — on Android, the flush command is replaced with "Toggle Airplane Mode or restart Firefox to flush DNS" and a Reload button instead of a copyable shell command
- **Popup width** — increased from 400px to 440px on desktop

### Docs
- README feature matrix updated: Pi-hole v6 now shows ✅ for blocklist attribution

---

## [2.3.1] — 2026-03-26

### Added
- **Pi-hole blocklist attribution** — for Pi-hole v6 users, blocked domains now show which gravity list flagged them (e.g. "Steven Black Unified", "HaGeZi — Multi", "OISD Full"). Uses the Pi-hole `/api/search/{domain}` gravity endpoint. Includes a pretty-name map for 30+ popular lists:
  - HaGeZi (Multi, Pro, Pro++, Ultimate, Threat Intelligence)
  - Steven Black Unified
  - OISD (Full, Basic, Small)
  - AdGuard DNS filter
  - EasyList / EasyPrivacy
  - Disconnect.me (Ads, Tracking, Malware)
  - Energized (Basic, BLU, Ultimate)
  - URLhaus Malware
  - WindowsSpyBlocker
  - Unknown lists fall back to their hostname

### Developer
- `npm run pihole:start` now exposes port 53 (UDP + TCP) for local DNS testing
- `npm run dns:pihole` — sets system DNS to 127.0.0.1 (Pi-hole) on the active interface
- `npm run dns:restore` — restores system DNS to automatic (DHCP)

---

## [2.1.0] — 2026-03-26

### Added
- **Expanded domain database** — 492 entries across 13 categories (+146 new entries in 6 new categories)
  - New categories: CAPTCHA (24), video players (33), maps (15), support chat (37), image CDNs (9), error monitoring (28)
- **Functional impact badges** — every blocked domain shows a color-coded badge describing the specific consequence of blocking it:
  - 🔴 Red — login / forms (auth, payments, CAPTCHA)
  - 🔵 Blue — media / maps / assets (video, maps, image CDNs, CDN)
  - 🟢 Green — chat / notifications (support chat, real-time)
  - 🟣 Purple — feature flags
  - 🩵 Cyan — search
  - ⚫ Grey — monitoring (error tracking, analytics)
- **New extension icon** — dark shield with cyan (#22d3ee) medical cross and pulse/heartbeat line

### Changed
- Remote domain DB version bumped to `2.0.1`

---

## [2.0.1] — 2026-03-16

### Fixed
- Token hint spacing and label clarity in Pi-hole settings ("Password / API Token")
- Pi-hole v6 auth hint: "Pi-hole v6: your web UI password · Pi-hole v5: Admin → Settings → API"
- Settings panel stays open after Save Settings

---

## [2.0.0] — 2026-03-16

### Added
- **Pi-hole support** — allowlist directly to Pi-hole v5 or v6. Version is auto-detected on first use
  - Pi-hole v6: authenticates with web UI password, uses `/api/domains/allow/exact`
  - Pi-hole v5: uses legacy `/admin/api.php?list=white&add={domain}&auth={token}` endpoint
- **NextDNS profile auto-detect** — fingerprints your device against your NextDNS profiles via `test.nextdns.io`; your active profile is labeled "This device" automatically
- **DNS provider toggle** in settings — switch between NextDNS and Pi-hole
- **API key lock** — key field goes read-only after save, red Clear button resets it
- **Blocklist reason display** — fetches NextDNS logs on popup open and shows source blocklist name under each blocked domain

---

## [1.4.1] — 2026-03-10

### Fixed
- DNS flush banner now also shown on clipboard copy action
- `showFlushBanner()` accepts optional `title` parameter

---

## [1.4.0] — 2026-03-10

### Added
- **Risk-level filter** — click HIGH / MEDIUM / LOW in the stats bar to filter the block list; click again to clear
- Active filter level highlighted in the stats bar

---

## [1.3.0] — 2026-03-09

### Added
- **DNS flush reminder banner** — shown after every allowlist or copy action with the exact OS-aware command (macOS, Windows, Linux) and a copy button

---

## [1.2.0] — 2026-03-08

### Added
- **Copy to clipboard button** on each blocked domain
- **Remote domain database** — fetched from GitHub, cached locally for 7 days, force-refresh in settings
- `clipboardWrite` permission added to manifests

---

## [1.1.0] — 2026-03-07

### Added
- **Firefox support** (Manifest V2)
- Dynamic remote domain database with `db-loader.js`

---

## [1.0.0] — 2026-03-06

Initial release.

- Real-time DNS block detection via `webRequest` API
- Domain classification against a bundled database (Chrome MV3, Firefox MV2)
- HIGH / MEDIUM / LOW risk grouping
- Extension badge count
- NextDNS allowlist integration
