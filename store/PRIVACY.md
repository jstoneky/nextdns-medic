# Privacy Policy — DNS Medic

Last updated: March 2026

## Summary

DNS Medic does not collect, store, or transmit any personal data or browsing history. It is a local-only tool.

## Data collected

**Nothing is sent to any external server** except:
- Direct calls to the NextDNS API (`api.nextdns.io`) when you explicitly click the **+ Allowlist** button. These calls contain only the domain name you chose to allowlist and your API key, sent directly from your browser to NextDNS.

## Data stored locally

The extension stores the following in your browser's local storage (`chrome.storage.sync`):
- Your NextDNS API key (if you choose to enter it)
- Your NextDNS profile ID (if you choose to enter it)

This data never leaves your Chrome profile and is never transmitted to the extension developer or any third party.

## Session data

Blocked domain information (hostnames and error types) is held in memory only for the current browser session and the current page. It is cleared automatically when you navigate away from a page or close the tab. It is never persisted to disk or transmitted anywhere.

## Permissions explained

- **webRequest**: Required to observe network request errors (read-only; the extension cannot modify or block requests)
- **webNavigation**: Required to detect page navigation and reset per-tab monitoring state
- **tabs**: Required to associate network errors with the correct tab
- **storage**: Required to save your NextDNS API key and profile ID locally
- **activeTab**: Required to display the correct domain in the popup header
- **host_permissions (`<all_urls>`)**: Required to monitor requests across all websites (observation only)

## Contact

Questions or concerns: open an issue at https://github.com/jstoneky/nextdns-medic
