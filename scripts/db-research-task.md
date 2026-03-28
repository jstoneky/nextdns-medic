# DNS Medic — Domain DB Research Task

## Your Goal
Find domains that are commonly blocked by DNS blocklists but are **functionally necessary** for websites to work correctly. These go into `domain-db.json` so DNS Medic can warn users that a blocked domain is why their site is broken.

## The DB Format
Each entry in `domain-db.json` has:
- `pattern` — regex pattern (escape dots as `\\.`)
- `flags` — regex flags (usually `""`)
- `label` — short display name e.g. `"Auth (Frontegg)"`
- `confidence` — `"HIGH"` / `"MEDIUM"` / `"LOW"`
- `category` — one of: `auth`, `payments`, `cdn`, `analytics`, `advertising`, `tag-manager`, `feature-flags`, `session-replay`, `monitoring`, `support-chat`, `captcha`, `video`, `search-api`, `realtime`, `consent`, `maps`, `ecommerce`, `image-cdn`, `chat`
- `functionalImpact` — one of: `"login"`, `"forms"`, `"media"`, `"features"`, `"content"`, `"performance"`, `"tracking"`
- `reason` — 1-2 sentence explanation of what breaks when blocked
- `source` — brief note on where you found this

## Current DB State
- File: `/Users/jstoneky/Projects/Openclaw/nextdns-medic/domain-db.json`
- Currently 520 entries
- Categories already well-covered: auth, payments, cdn, analytics, advertising, tag-manager, session-replay, monitoring, support-chat, captcha, video, feature-flags, search-api

## Research Sources — USE THESE

### 1. DNS Blocklists (HIGH VALUE — check these first)
Use `web_search` to find false positives reported in these lists:
- **HaGeZi GitHub issues**: `web_search: query="site:github.com/hagezi false positive" freshness="year"`
- **uBlock Origin filter issues**: `web_search: query="site:github.com/uBlockOrigin false positive broken site" freshness="year"`
- **EasyList/EasyPrivacy false positives**: `web_search: query="easylist easyPrivacy false positive broken functionality site:github.com" freshness="year"`
- **Pi-hole false positives**: `web_search: query="pihole false positive broken site reddit" freshness="year"`
- **NextDNS false positives**: `web_search: query="nextdns blocked breaking site reddit" freshness="year"`

### 2. WhoTracks.me / TrackerDB (HIGH VALUE)
Ghostery's open-source tracker database — categorized by function.
- Main data: `https://raw.githubusercontent.com/ghostery/trackerdb/main/trackers.json` (try web_fetch)
- GitHub: `https://github.com/ghostery/trackerdb`
- Focus on their `essential` and `cdn` categories — those are most likely to be functionally necessary
- Also check `customer_interaction` (maps to our `support-chat`) and `audio_video_player` (maps to `video`)
- Use `web_search: query="site:github.com/ghostery/trackerdb trackers essential cdn"` if direct fetch fails

### 3. Emerging Providers (use web_search)
Research these specific gaps we know exist:
- **Identity/SSO**: `web_search: query="new SSO identity provider 2024 2025 developer authentication"` 
- **Headless commerce**: `web_search: query="headless commerce checkout SDK blocked nextdns pihole"` (Nacelle, Medusa, Swell)
- **AI/LLM API clients**: `web_search: query="openai anthropic api domain blocked dns filtering"` 
- **Maps alternatives**: `web_search: query="Mapbox MapTiler HERE maps domain blocked DNS"` — check if we're missing any
- **Internationalization/i18n CDNs**: `web_search: query="translation CDN domain blocked pihole Crowdin Phrase Lokalise"`
- **Push notifications**: `web_search: query="web push notification service domain blocked onesignal pushwoosh airship"`
- **A/B testing**: `web_search: query="AB testing platform domain blocked DNS VWO Kameleoon Statsig"`
- **Customer data platforms (CDP)**: `web_search: query="CDP customer data platform domain blocked segment rudderstack mparticle"`

### 4. Common Functional Breakage Reports
- `web_search: query="website broken after enabling DNS filter reddit 2024 2025"` 
- `web_search: query="chrome extension blocked DNS report false positive 2025"`

## Rules
1. **Use web_search (Brave) as your primary research tool** — not web_fetch for discovery
2. Use web_fetch only to get specific domain lists or docs you've already identified via search
3. **Write incrementally** — after every 10-15 new candidates, write them to `proposed-additions.json` and commit
4. Don't add pure trackers/analytics with no functional impact — only things that break user experience when blocked
5. Don't duplicate existing entries — check `domain-db.json` before adding
6. HIGH confidence = widely used + well-documented functional breakage
7. MEDIUM confidence = real but less common, or functional impact is partial
8. Skip anything LOW confidence

## Output Format
Write candidates to `/Users/jstoneky/Projects/Openclaw/nextdns-medic/proposed-additions.json`:
```json
{
  "generated": "YYYY-MM-DD",
  "source": "db-research-agent-v2",
  "totalCandidates": N,
  "candidates": [ ... ]
}
```

## Commit Protocol
After every batch of ~15 candidates:
```
git add proposed-additions.json
git commit -m "research: add batch N — [categories covered]"
```

## When Done
1. Do a final commit with all candidates
2. Message Jeff on Discord (channel `1479675665094803686`):
   - Total candidates found
   - Categories covered
   - Top 3 most impactful finds
   - Any WhoTracks.me insights worth acting on for the extension itself
