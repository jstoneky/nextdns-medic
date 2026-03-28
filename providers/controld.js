// providers/controld.js — Control D provider for DNS Medic
// Registered on window.NDMProviders.controld
//
// API base: https://api.controld.com
// Auth: Bearer token (generated in Control D dashboard)
// Notes:
//   - Query log requires Business plan
//   - Data model: Profiles → Endpoints → Custom Rules
//   - CORS from browser extensions: unconfirmed — tested at runtime

(function () {
  const API = "https://api.controld.com";

  function authHeaders(apiToken) {
    return {
      "Authorization": `Bearer ${apiToken}`,
      "Accept": "application/json",
    };
  }

  window.NDMProviders = window.NDMProviders || {};
  window.NDMProviders.controld = {
    label: "Control D",
    id: "controld",

    hasCredentials({ controldToken, controldProfileId }) {
      return !!(controldToken && controldProfileId);
    },

    // Fetch blocked domains from query log (requires Business plan)
    async fetchBlocklistReasons({ controldToken, controldProfileId }, domains) {
      const result = {};
      if (!controldToken || !controldProfileId || !domains.length) return result;

      try {
        const res = await fetch(
          `${API}/query_log?profile_id=${encodeURIComponent(controldProfileId)}&status=blocked&limit=1000`,
          { headers: authHeaders(controldToken), signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return result;
        const data = await res.json();
        const entries = data.body?.queries || [];

        const domainSet = new Set(domains);
        for (const entry of entries) {
          const d = entry.domain || entry.name;
          if (d && domainSet.has(d)) {
            const listName = entry.filter_name || entry.list_name || "Control D blocklist";
            result[d] = [{ id: String(entry.list_id || ""), name: listName }];
          }
        }
      } catch (_) {}

      return result;
    },

    // Add domain to custom allow rule in the given profile
    async allowlistDomain({ controldToken, controldProfileId }, domain) {
      if (!controldToken || !controldProfileId) {
        return { ok: false, error: "No API token or profile configured" };
      }
      try {
        // API requires form-encoded body, not JSON
        // do: 1 = BYPASS (allow), do: 0 = BLOCK
        const body = new URLSearchParams();
        body.append("do", "1");       // 1 = BYPASS (allow through)
        body.append("status", "1");   // 1 = enabled
        body.append("hostnames[]", domain);

        const res = await fetch(
          `${API}/profiles/${encodeURIComponent(controldProfileId)}/rules`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${controldToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
            signal: AbortSignal.timeout(8000),
          }
        );
        if (res.ok || res.status === 201 || res.status === 204) return { ok: true };
        const resBody = await res.json().catch(() => null);
        return { ok: false, error: resBody?.error?.message || `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, error: e.name === "TimeoutError" ? "Control D unreachable" : e.message };
      }
    },

    // Fetch all profiles for this token
    async fetchProfiles({ controldToken }) {
      if (!controldToken) return null;
      try {
        const res = await fetch(`${API}/profiles`, {
          headers: authHeaders(controldToken),
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        // Returns array of { PK, name, ... }
        return (data.body?.profiles || []).map(p => ({ id: p.PK, name: p.name }));
      } catch (_) {
        return null;
      }
    },

    // Detect if current DNS is routing through Control D.
    // Fetches https://{rand}.dns.controld.com/detect — resolves only if Control D is active.
    // Returns { active: true } | { active: false } | { active: null } (null = network error)
    async detectUsage() {
      const rand = Math.random().toString(36).substr(2, 12);
      const url = `https://${rand}.dns.controld.com/detect`;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(4000),
          credentials: "omit",
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          return { active: true, data };
        }
        return { active: false };
      } catch (_) {
        // ENOTFOUND or connection refused = not using Control D
        return { active: false };
      }
    },

    // Returns true | false | null
    async validateCredentials({ controldToken }) {
      if (!controldToken) return false;
      try {
        const res = await fetch(`${API}/profiles`, {
          headers: authHeaders(controldToken),
          signal: AbortSignal.timeout(6000),
        });
        return res.ok;
      } catch (_) {
        return null;
      }
    },
  };
})();
