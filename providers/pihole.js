// providers/pihole.js — Pi-hole provider for DNS Medic
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

  // ── v6 session cache ──────────────────────────────────────────────
  // Reuse the session token within a popup session to avoid re-authing on every call.
  // TTL matches Pi-hole v6's ~5-minute session lifetime.
  let _sessionCache = null;
  const V6_SESSION_TTL_MS = 4 * 60 * 1000; // 4 minutes

  async function getV6Session(url, token) {
    if (_sessionCache &&
        _sessionCache.url === url &&
        _sessionCache.token === token &&
        Date.now() < _sessionCache.expiresAt) {
      return { ok: true, sid: _sessionCache.sid };
    }
    return authenticateV6(url, token);
  }

  async function authenticateV6(url, token) {
    try {
      const res = await fetch(`${url}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, error: res.status === 401 ? "Invalid API token" : `Auth failed (HTTP ${res.status})` };
      const data = await res.json();
      const sid = data?.session?.sid;
      if (!sid) return { ok: false, error: "Could not obtain Pi-hole session token" };
      _sessionCache = { url, token, sid, expiresAt: Date.now() + V6_SESSION_TTL_MS };
      return { ok: true, sid };
    } catch (e) {
      return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
    }
  }

  // Invalidate cache so the next call re-authenticates
  function clearV6Session() {
    _sessionCache = null;
  }

  // Delete the session on the Pi-hole server and clear the local cache.
  // Uses keepalive so it survives popup close / unload.
  function destroyV6Session() {
    if (!_sessionCache) return;
    const { url, sid } = _sessionCache;
    _sessionCache = null;
    try {
      fetch(`${url}/api/auth`, {
        method: "DELETE",
        headers: { "X-FTL-SID": sid },
        keepalive: true,
      });
    } catch (_) {}
  }
  // ─────────────────────────────────────────────────────────────────

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
      let session = await getV6Session(url, token);
      if (!session.ok) return session;

      let addRes = await fetch(`${url}/api/domains/allow/exact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
        body: JSON.stringify({ domain, comment: "Added by DNS Medic" }),
        signal: AbortSignal.timeout(8000),
      });

      // Session expired — re-authenticate once and retry
      if (addRes.status === 401) {
        clearV6Session();
        session = await getV6Session(url, token);
        if (!session.ok) return session;
        addRes = await fetch(`${url}/api/domains/allow/exact`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
          body: JSON.stringify({ domain, comment: "Added by DNS Medic" }),
          signal: AbortSignal.timeout(8000),
        });
      }

      if (!addRes.ok) return { ok: false, error: `HTTP ${addRes.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
    }
  }

  window.NDMProviders = window.NDMProviders || {};
  window.NDMProviders.pihole = {
    // Detect if Pi-hole is reachable.
    // Two-step: 1) try http://pi.hole (magic domain — only resolves if DNS goes through Pi-hole)
    //           2) fall back to saved piholeUrl if set (confirms server is up)
    // Returns { active: true } | { active: false } | { active: null }
    async detectUsage() {
      // Only the pi.hole magic domain is a real DNS routing check.
      // It resolves to the Pi-hole IP only if DNS is going through Pi-hole.
      // URL reachability (saved piholeUrl) is NOT used — the web UI being up
      // doesn't mean DNS is routing through Pi-hole.
      try {
        const res = await fetch("http://pi.hole/api/info/version", {
          signal: AbortSignal.timeout(3000),
          credentials: "omit",
          mode: "no-cors",
        });
        // no-cors returns opaque response object (not TypeError) = resolved = routed
        return { active: true };
      } catch (_) {
        return { active: false };
      }
    },
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
        let session = await getV6Session(url, piholeToken);
        if (!session.ok) return result;

        // Fetch all domains in parallel — much faster than sequential awaits.
        // Returns true if any request got a 401 (session expired mid-flight).
        const fetchDomains = async (sid) => {
          let sessionExpired = false;
          await Promise.allSettled(domains.map(async (domain) => {
            try {
              const res = await fetch(
                `${url}/api/search/${encodeURIComponent(domain)}`,
                { headers: { "X-FTL-SID": sid }, signal: AbortSignal.timeout(6000) }
              );
              if (res.status === 401) { sessionExpired = true; return; }
              if (!res.ok) return;
              const data = await res.json();
              const gravityHits = data?.search?.gravity || [];
              if (!gravityHits.length) return;

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
          }));
          return sessionExpired;
        };

        const expired = await fetchDomains(session.sid);
        if (expired) {
          clearV6Session();
          session = await getV6Session(url, piholeToken);
          if (session.ok) await fetchDomains(session.sid);
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
          // testConnection always does a fresh auth to verify the token
          clearV6Session();
          const session = await getV6Session(url, piholeToken);
          if (!session.ok) return { ok: false, error: session.error };
          tokenOk = true;
        }
      } catch (_) {
        return { ok: false, error: "Pi-hole unreachable — check your URL" };
      }

      if (tokenOk) return { ok: true, version };
      return { ok: false, error: "Invalid token — check Pi-hole settings" };
    },

    // Disable DNS blocking via Pi-hole v5 API.
    // timer: optional seconds to disable for (omit or 0 = disable indefinitely)
    async v5DisableBlocking({ piholeUrl, piholeToken }, timer) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        let endpoint = `${url}/admin/api.php?disable&auth=${encodeURIComponent(piholeToken)}`;
        if (timer && timer > 0) endpoint += `&time=${timer}`;

        const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        if (data.status === "disabled") return { ok: true, status: data.status };
        return { ok: false, error: data.message || "Pi-hole returned an unexpected status" };
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    // Disable DNS blocking via Pi-hole v6 API.
    // timer: optional seconds to disable for (omit or 0 = disable indefinitely)
    async v6DisableBlocking({ piholeUrl, piholeToken }, timer) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        let session = await getV6Session(url, piholeToken);
        if (!session.ok) return session;

        const body = { blocking: false };
        if (timer && timer > 0) body.timer = timer;

        let res = await fetch(`${url}/api/dns/blocking`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 401) {
          clearV6Session();
          session = await getV6Session(url, piholeToken);
          if (!session.ok) return session;
          res = await fetch(`${url}/api/dns/blocking`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8000),
          });
        }

        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        const result = { ok: true, blocking: data.blocking === "enabled" || data.blocking === true };
        if (data.timer != null && data.timer > 0) result.timer = data.timer;
        return result;
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    // Get current DNS blocking state via Pi-hole v5 API.
    async v5GetBlocking({ piholeUrl, piholeToken }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        const res = await fetch(
          `${url}/admin/api.php?status&auth=${encodeURIComponent(piholeToken)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        if (data.status === "enabled" || data.status === "disabled") {
          return { ok: true, blocking: data.status === "enabled" };
        }
        return { ok: false, error: data.message || "Pi-hole returned an unexpected status" };
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    // Get current DNS blocking state via Pi-hole v6 API.
    async v6GetBlocking({ piholeUrl, piholeToken }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        let session = await getV6Session(url, piholeToken);
        if (!session.ok) return session;

        let res = await fetch(`${url}/api/dns/blocking`, {
          method: "GET",
          headers: { "X-FTL-SID": session.sid },
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 401) {
          clearV6Session();
          session = await getV6Session(url, piholeToken);
          if (!session.ok) return session;
          res = await fetch(`${url}/api/dns/blocking`, {
            method: "GET",
            headers: { "X-FTL-SID": session.sid },
            signal: AbortSignal.timeout(8000),
          });
        }

        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        // v6 returns blocking as "enabled"/"disabled" string — normalize to boolean
        const blocking = data.blocking === "enabled" || data.blocking === true;
        const result = { ok: true, blocking };
        if (data.timer != null && data.timer > 0) result.timer = data.timer;
        return result;
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    async getBlocking({ piholeUrl, piholeToken, piholeVersion }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      let version = piholeVersion;
      if (!version) {
        version = await detectVersion(url);
      }

      if (version === 6) return this.v6GetBlocking({ piholeUrl, piholeToken });
      return this.v5GetBlocking({ piholeUrl, piholeToken });
    },

    async enableBlocking({ piholeUrl, piholeToken, piholeVersion }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      let version = piholeVersion;
      if (!version) {
        version = await detectVersion(url);
      }

      if (version === 6) return this.v6EnableBlocking({ piholeUrl, piholeToken });
      return this.v5EnableBlocking({ piholeUrl, piholeToken });
    },

    async v5EnableBlocking({ piholeUrl, piholeToken }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        const res = await fetch(
          `${url}/admin/api.php?enable&auth=${encodeURIComponent(piholeToken)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        if (data.status === "enabled") return { ok: true };
        return { ok: false, error: data.message || "Pi-hole returned an unexpected status" };
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    async v6EnableBlocking({ piholeUrl, piholeToken }) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      try {
        let session = await getV6Session(url, piholeToken);
        if (!session.ok) return session;

        let res = await fetch(`${url}/api/dns/blocking`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
          body: JSON.stringify({ blocking: true }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 401) {
          clearV6Session();
          session = await getV6Session(url, piholeToken);
          if (!session.ok) return session;
          res = await fetch(`${url}/api/dns/blocking`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-FTL-SID": session.sid },
            body: JSON.stringify({ blocking: true }),
            signal: AbortSignal.timeout(8000),
          });
        }

        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Pi-hole unreachable — check your URL" : e.message };
      }
    },

    async disableBlocking({ piholeUrl, piholeToken, piholeVersion }, timer) {
      const url = normalizeUrl(piholeUrl);
      if (!url || !piholeToken) return { ok: false, error: "No Pi-hole URL or token configured" };

      let version = piholeVersion;
      if (!version) {
        version = await detectVersion(url);
      }

      if (version === 6) return this.v6DisableBlocking({ piholeUrl, piholeToken }, timer);
      return this.v5DisableBlocking({ piholeUrl, piholeToken }, timer);
    },

    // validateCredentials maps to testConnection for the abstraction layer
    async validateCredentials(config) {
      const result = await this.testConnection(config);
      return result.ok ? true : false;
    },

    clearSession: clearV6Session,
    destroySession: destroyV6Session,
    detectVersion,
  };
})();
