// providers/nextdns.js — NextDNS provider for DNS Medic
// Registered on window.NDMProviders.nextdns

(function () {
  const API = "https://api.nextdns.io";

  window.NDMProviders = window.NDMProviders || {};
  window.NDMProviders.nextdns = {
    label: "NextDNS",
    id: "nextdns",

    hasCredentials({ apiKey, profileId }) {
      return !!(apiKey && profileId);
    },

    async fetchBlocklistReasons({ apiKey, profileId }, domains) {
      const result = {};
      if (!apiKey || !profileId || !domains.length) return result;

      const domainSet = new Set(domains);
      let fetched = 0;
      let cursor = null;

      while (domainSet.size > 0 && fetched < 1000) {
        const url = `${API}/profiles/${profileId}/logs?status=blocked&limit=1000${cursor ? `&cursor=${cursor}` : ""}`;
        try {
          const res = await fetch(url, {
            headers: { "X-Api-Key": apiKey },
            credentials: "omit",
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) break;
          const data = await res.json();
          const entries = data.data || [];
          fetched += entries.length;

          for (const entry of entries) {
            if (domainSet.has(entry.domain) && entry.reasons?.length) {
              result[entry.domain] = entry.reasons;
              domainSet.delete(entry.domain);
            }
          }

          cursor = data.meta?.cursor || null;
          if (!cursor || !entries.length) break;
        } catch (_) {
          break;
        }
      }
      return result;
    },

    async allowlistDomain({ apiKey, profileId }, domain) {
      if (!apiKey || !profileId) return { ok: false, error: "No API key or profile configured" };
      try {
        const res = await fetch(`${API}/profiles/${profileId}/allowlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
          credentials: "omit",
          body: JSON.stringify({ id: domain, active: true }),
        });
        if (res.ok || res.status === 201 || res.status === 204) return { ok: true };
        return { ok: false, error: `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    // Returns true (valid) | false (invalid) | null (network error)
    async validateCredentials({ apiKey }) {
      try {
        const res = await fetch(`${API}/profiles`, {
          headers: { "X-Api-Key": apiKey },
          credentials: "omit",
          signal: AbortSignal.timeout(6000),
        });
        return res.ok;
      } catch (_) {
        return null;
      }
    },

    // Fetch all profiles for an API key
    async fetchProfiles({ apiKey }) {
      try {
        const res = await fetch(`${API}/profiles`, {
          headers: { "X-Api-Key": apiKey },
          credentials: "omit",
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.data || [];
      } catch (_) {
        return null;
      }
    },

    // Detect which NextDNS profile this device is using
    async detectDeviceFingerprint() {
      try {
        const res = await fetch("https://test.nextdns.io", {
          headers: { Accept: "application/json" },
          credentials: "omit",
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        // status: "ok" = using NextDNS, "unconfigured" = not using NextDNS
        return {
          fingerprint: data.profile || null,
          deviceName: data.deviceName || data.clientName || null,
          status: data.status || (data.profile ? "ok" : "unconfigured"),
        };
      } catch (_) {
        return { fingerprint: null, deviceName: null, status: "error" };
      }
    },
  };
})();
