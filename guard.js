/* SafeBuy NG guard.js: reports page crashes to the admin Errors screen and shows a calm offline banner.
   Sends no personal data: only the page name, the error text, the file and line. Max 5 reports per page visit. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig, sent = 0, seen = {};
  function report(msg, src, line) {
    try {
      if (!cfg || !cfg.url || !cfg.publishableKey || sent >= 5) return;
      msg = String(msg || "").slice(0, 300); if (!msg || /^Script error\.?$/i.test(msg) || seen[msg]) return;
      if (/ResizeObserver|extension:\/\/|chrome-extension|Failed to fetch|NetworkError|Load failed|AbortError/i.test(msg + " " + src)) return;   // browser noise and flaky-network messages
      seen[msg] = 1; sent++;
      var page = location.pathname.replace(/\/index\.html$/, "/").slice(0, 120);
      fetch(String(cfg.url).replace(/\/+$/, "") + "/rest/v1/rpc/log_client_error", { method: "POST", keepalive: true,
        headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_page: page, p_msg: msg, p_src: String(src || "").replace(/^https?:\/\/[^\/]+/, "").slice(0, 160), p_line: line | 0, p_ua: (navigator.userAgent || "").slice(0, 140) }) }).catch(function () {});
    } catch (e) {}
  }
  window.addEventListener("error", function (e) { report(e.message, e.filename, e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { var r = e.reason; report("Promise: " + (r && r.message ? r.message : r), "", 0); });

  var bar;
  function banner() {
    if (navigator.onLine) { if (bar) { bar.remove(); bar = null; } return; }
    if (bar || !document.body) return;
    bar = document.createElement("div"); bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147482000;background:#1f2937;color:#fff;padding:10px 14px;text-align:center;font:600 13px/1.4 system-ui,sans-serif";
    bar.textContent = "You're offline. Some things won't work until your connection is back."; document.body.appendChild(bar);
  }
  window.addEventListener("online", banner); window.addEventListener("offline", banner);
  if (document.body) banner(); else document.addEventListener("DOMContentLoaded", banner);
})();
