/* SafeBuy NG switches.js: applies the on/off switches you set in Admin > Control. Safe by design: if it cannot read them, the site works normally. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig;
  if (!cfg || !cfg.url || !cfg.publishableKey) return;
  var url = String(cfg.url).replace(/\/+$/, "") + "/rest/v1/site_content?key=eq.switches&select=value";
  var S = {}, bar, wall;
  var tones = { info: ["#e8f3ff", "#0b3d78"], warn: ["#fff4d6", "#7a4b00"], good: ["#e3f8ec", "#0b5a2c"] };

  function banner() {
    var t = String(S.banner_text || "").trim();
    if (!t) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "sb-banner"; bar.setAttribute("role", "status"); document.body.insertBefore(bar, document.body.firstChild); }
    var c = tones[S.banner_tone] || tones.info;
    bar.style.cssText = "background:" + c[0] + ";color:" + c[1] + ";padding:9px 14px;text-align:center;font:700 13.5px/1.4 system-ui,sans-serif";
    bar.textContent = t;
  }
  function maintenance() {
    if (S.maintenance_on !== true) { if (wall) { wall.remove(); wall = null; } return; }
    if (!wall) {
      wall = document.createElement("div"); wall.id = "sb-maint";
      wall.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;padding:28px;text-align:center;font-family:system-ui,sans-serif";
      wall.innerHTML = '<div style="max-width:420px"><div style="font-size:46px">🛠️</div><h1 style="font-size:22px;margin:10px 0">We will be right back</h1><p id="sb-maint-t" style="color:#444;line-height:1.55"></p></div>';
      document.body.appendChild(wall);
    }
    wall.querySelector("#sb-maint-t").textContent = S.maintenance_text || "SafeBuy NG is being updated. Please check again in a few minutes.";
  }
  function apply() { if (!document.body) return; banner(); maintenance(); }

  function load() {
    fetch(url, { headers: { apikey: cfg.publishableKey }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { S = (rows && rows[0] && rows[0].value) || {}; apply(); })
      .catch(function () {});
  }

  /* Signups paused: stops the Create-account form and says why. Sign-in keeps working. */
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || f.id !== "account-form" || S.signups_open !== false) return;
    var nm = document.getElementById("account-name");
    if (!nm || nm.hidden) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var m = document.getElementById("account-message");
    if (m) m.textContent = "New sign-ups are paused for a short while. Please try again later. Existing accounts can still sign in.";
  }, true);

  /* Riders paused: the Go online button explains instead of starting. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#dp-on");
    if (!b || S.rider_online_open !== false) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var m = document.getElementById("dp-msg");
    if (m) { m.textContent = "Going online is paused for now. Please try again soon."; m.className = "form-message error"; }
  }, true);

  function start() { apply(); load(); setInterval(function () { if (!document.hidden) load(); }, 60000); document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); }); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
