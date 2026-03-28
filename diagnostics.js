    function detectBrowser(ua) {
      if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}`;
      if (/Edg\/(\d+)/.test(ua))     return `Edge ${ua.match(/Edg\/(\d+)/)[1]}`;
      if (/Chrome\/(\d+)/.test(ua))  return `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}`;
      if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
        const m = ua.match(/Version\/(\d+)/);
        return `Safari ${m ? m[1] : ''}`;
      }
      return ua.slice(0, 80);
    }

    function detectOS(ua) {
      if (/Windows NT 10/.test(ua)) return "Windows 10/11";
      if (/Windows/.test(ua))       return "Windows";
      if (/Mac OS X/.test(ua))      return `macOS ${(ua.match(/Mac OS X ([\d_]+)/) || ['',''])[1].replace(/_/g,'.')}`;
      if (/Android/.test(ua))       return `Android ${(ua.match(/Android ([\d.]+)/) || ['',''])[1]}`;
      if (/Linux/.test(ua))         return "Linux";
      if (/iPhone|iPad/.test(ua))   return "iOS";
      return "Unknown";
    }

    const ua = navigator.userAgent;
    const browser = detectBrowser(ua);
    const os = detectOS(ua);

    document.getElementById("d-browser").textContent   = browser;
    document.getElementById("d-os").textContent        = os;
    document.getElementById("d-platform").textContent  = navigator.platform || "unknown";
    document.getElementById("d-lang").textContent      = navigator.language || "unknown";

    // Check if extension APIs are available (only works if page is loaded from extension context)
    const hasExt = typeof chrome !== "undefined" || typeof browser !== "undefined";
    const extEl = document.getElementById("d-ext-api");
    extEl.textContent = hasExt ? "Yes" : "No (page loaded outside extension)";
    extEl.className   = "row-value " + (hasExt ? "status-ok" : "status-warn");

    // Check GitHub reachability
    const ghEl = document.getElementById("d-github");
    fetch("https://raw.githubusercontent.com/jstoneky/nextdns-medic/main/manifest.json", { cache: "no-store" })
      .then(r => {
        ghEl.textContent = r.ok ? "Yes" : `No (HTTP ${r.status})`;
        ghEl.className   = "row-value " + (r.ok ? "status-ok" : "status-err");
      })
      .catch(e => {
        ghEl.textContent = `No (${e.message})`;
        ghEl.className   = "row-value status-err";
      });

    // Build report text
    function buildReport() {
      const ghStatus = document.getElementById("d-github").textContent;
      return [
        "**Extension version:** (check chrome://extensions or about:addons)",
        `**Browser:** ${browser}`,
        `**OS:** ${os}`,
        `**DNS provider:** `,
        `**GitHub reachable:** ${ghStatus}`,
        "",
        "**Describe the bug:**",
        "",
        "**Steps to reproduce:**",
        "1. ",
        "2. ",
        "",
        "**Console errors (if any):**",
        "```",
        "",
        "```",
      ].join("\n");
    }

    // Populate textarea after GitHub check settles
    setTimeout(() => {
      document.getElementById("report-text").value = buildReport();
    }, 1500);

    function copyReport() {
      const text = document.getElementById("report-text").value;
      navigator.clipboard.writeText(text).then(() => {
        document.getElementById("copy-status").textContent = "Copied!";
        setTimeout(() => document.getElementById("copy-status").textContent = "", 2000);
      }).catch(() => {
        document.getElementById("copy-status").textContent = "Select all and copy manually (Ctrl+A / Cmd+A)";
      });
    }

    function openGitHub() {
      const body = document.getElementById("report-text").value;
      const url  = `https://github.com/jstoneky/nextdns-medic/issues/new?template=bug_report.md&title=%5BBug%5D+&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank");
    }
