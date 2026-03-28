# Changelog

All notable changes to NextDNS Medic are documented here.

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
