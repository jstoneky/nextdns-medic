// providers/pihole.js — Pi-hole provider for NextDNS Medic
// Registered on window.NDMProviders.pihole

(function () {
  // Pretty display names for common Pi-hole blocklist URLs
  const LIST_NAMES = {
    "raw.githubusercontent.com/StevenBlack/hosts/master/hosts": "Steven Black Unified",
    "raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts": "Steven Black (Extended)",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/multi.txt": "HaGeZi — Multi",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/pro.txt": "HaGeZi — Pro",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/pro.plus.txt": "HaGeZi — Pro++",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/ultimate.txt": "HaGeZi — Ultimate",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/tif.txt": "HaGeZi — Threat Intelligence",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/multi.txt": "HaGeZi — Multi (adblock)",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.plus.txt": "HaGeZi — Pro++ (adblock)",
    "raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/ultimate.txt": "HaGeZi — Ultimate (adblock)",
    "dbl.oisd.nl": "OISD Full",
    "dbl.oisd.nl/basic": "OISD Basic",
    "small.oisd.nl": "OISD Small",
    "adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt": "AdGuard DNS filter",
    "raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt": "AdGuard DNS filter",
    "easylist-downloads.adblockplus.org/easylist.txt": "EasyList",
    "easylist-downloads.adblockplus.org/easyprivacy.txt": "EasyPrivacy",
    "raw.githubusercontent.com/easylist/easylist/master/easylist.txt": "EasyList",
    "raw.githubusercontent.com/easylist/easylist/master/easyprivacy.txt": "EasyPrivacy",
    "s3.amazonaws.com/lists.disconnect.me/simple_ad.txt": "Disconnect.me Ads",
    "s3.amazonaws.com/lists.disconnect.me/simple_tracking.txt": "Disconnect.me Tracking",
    "s3.amazonaws.com/lists.disconnect.me/simple_malware.txt": "Disconnect.me Malware",
    "raw.githubusercontent.com/nicehash/NiceHash-Blocklist/main/blocklist.txt": "NiceHash Blocklist",
    "raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt": "WindowsSpyBlocker",
    "urlhaus-filter.pages.dev/urlhaus-filter-hosts.txt": "URLhaus Malware",
    "raw.githubusercontent.com/RPiList/specials/master/Blocklisten/notserious": "RPiList Not-Serious",
    "block.energized.pro/downloads/basic.txt": "Energized Basic",
    "block.energized.pro/downloads/blu.txt": "Energized BLU",
    "block.energized.pro/downloads/ultimate.txt": "Energized Ultimate",
  };

  function prettyListName(address) {
    if (!address) return "Pi-hole blocklist";
    try {
      const host = new URL(address).hostname + new URL(address).pathname;
      for (const [key, name] of Object.entries(LIST_NAMES)) {
        if (host.includes(key)) return name;
      }
    } catch (_) {}
    try { return new URL(address).hostname; } catch (_) {}
    return "Pi-hole blocklist";
  }

  function normalizeUrl(url) {
    return (url || "").replace(/\/+$/, "").trim();
  }

  // v6 exposes /api/auth; v5 does not
  async function detectVersion(url) {
    try {
      const res = await fetch(`${url}/api/auth`, { method: "GET", signal: AbortSignal.timeout(4000) });
      if (res.status === 200 || res.status === 401) return 6;
    } catch (_) {}
    return 5;
  }

  async function v5Allowlist(url, token, domain) {
    try {
      const res = await fetch(
        `${url}/admin/api.php?list=white&add=${encodeURIComponent(domain)}&auth=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      if (data.success) return { ok: true };
      return { ok: false, error: data.message || "Pi-hole returned an error" };
    } catch (e) {
      return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
    }
  }

  async function v6Allowlist(url, token, domain) {
    try {
      const authRes = await fetch(`${url}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
        signal: AbortSignal.timeout(8000),
      });
      if (!authRes.ok) return { ok: false, error: authRes.status === 401 ? "Invalid API token" : `Auth failed (HTTP ${authRes.status})` };
      const authData = await authRes.json();
      const sid = authData?.session?.sid;
      if (!sid) return { ok: false, error: "Could not obtain Pi-hole session token" };

      const addRes = await fetch(`${url}/api/domains/allow/exact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-FTL-SID": sid },
        body: JSON.stringify({ domain, comment: "Added by NextDNS Medic" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!addRes.ok) return { ok: false, error: `HTTP ${addRes.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
    }
  }

  window.NDMProviders = window.NDMProviders || {};
  window.NDMProviders.pihole = {
    label: "Pi-hole",
    id: "pihole",

    // Persistent version cache (written by popup.js, passed in via config)
    _versionCache: null,

    hasCredentials({ piholeUrl, piholeToken }) {
      return !!(piholeUrl && piholeToken);
    },

    async fetchBlocklistReasons({ piholeUrl, piholeToken }, domains) {
      const result = {};
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken || !domains.length) return result;

      try {
        const authRes = await fetch(`${url}/api/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: piholeToken }),
          signal: AbortSignal.timeout(6000),
        });
        if (!authRes.ok) return result;
        const authData = await authRes.json();
        const sid = authData?.session?.sid;
        if (!sid) return result;

        for (const domain of domains) {
          try {
            const res = await fetch(
              `${url}/api/search/${encodeURIComponent(domain)}`,
              { headers: { "X-FTL-SID": sid }, signal: AbortSignal.timeout(6000) }
            );
            if (!res.ok) continue;
            const data = await res.json();
            const gravityHits = data?.search?.gravity || [];
            if (!gravityHits.length) continue;

            const seen = new Set();
            const reasons = [];
            for (const hit of gravityHits) {
              const address = hit.address || "";
              if (seen.has(address)) continue;
              seen.add(address);
              reasons.push({ id: String(hit.id || ""), name: prettyListName(address) });
            }
            if (reasons.length) result[domain] = reasons;
          } catch (_) {}
        }
      } catch (_) {}

      return result;
    },

    async allowlistDomain({ piholeUrl, piholeToken, piholeVersion }, domain) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      let version = piholeVersion;
      if (!version) {
        version = await detectVersion(url);
      }

      if (version === 6) return v6Allowlist(url, piholeToken, domain);
      return v5Allowlist(url, piholeToken, domain);
    },

    // Returns { ok, version } — called from UI "Test Connection" button
    async testConnection({ piholeUrl, piholeToken }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "Enter URL and token first" };

      const version = await detectVersion(url);
      let tokenOk = false;

      try {
        if (version === 5) {
          const res = await fetch(
            `${url}/admin/api.php?summaryRaw&auth=${encodeURIComponent(piholeToken)}`,
            { signal: AbortSignal.timeout(6000) }
          );
          const data = await res.json().catch(() => null);
          tokenOk = data && typeof data.domains_being_blocked !== "undefined";
        } else {
          const res = await fetch(`${url}/api/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: piholeToken }),
            signal: AbortSignal.timeout(6000),
          });
          const data = await res.json().catch(() => null);
          tokenOk = data?.session?.valid === true;
        }
      } catch (_) {
        return { ok: false, error: "Pi-hole unreachable — check your URL" };
      }

      if (tokenOk) return { ok: true, version };
      return { ok: false, error: "Invalid token — check Pi-hole settings" };
    },

    // validateCredentials maps to testConnection for the abstraction layer
    async validateCredentials(config) {
      const result = await this.testConnection(config);
      return result.ok ? true : false;
    },

    detectVersion,
  };
})();
