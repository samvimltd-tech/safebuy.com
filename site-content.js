/* SafeBuy NG site-content.js (for index.html): applies text and on/off settings saved in Admin > Site content.
   Display only. Never touches products, orders or delivery. If anything fails, the page stays exactly as written. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig, KEY = "safebuy_site_content";
  function q(s) { return document.querySelector(s); }
  function text(sel, v) { var el = typeof sel === "string" ? q(sel) : sel; if (el && v && el.textContent !== v) el.textContent = v; }
  function vis(sel, show) { var el = q(sel); if (!el) return; if (show === false) el.style.setProperty("display", "none", "important"); else el.style.removeProperty("display"); }
  function darker(h) { var n = parseInt(h.slice(1), 16), f = function (v) { return Math.max(0, Math.round(v * .8)); }; return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return ("0" + f(v).toString(16)).slice(-2); }).join(""); }

  function apply(c) {
    if (!c || typeof c !== "object") return;
    try {
      var bar = q(".announcement");
      if (c.ann_show === false) { if (bar) bar.style.setProperty("display", "none", "important"); }
      else if (c.ann_text) {
        if (!bar) { bar = document.createElement("div"); bar.className = "announcement"; bar.style.cssText = "padding:8px 16px;text-align:center;background:#066548;color:#fff;font-size:12px"; document.body.insertBefore(bar, document.body.firstChild); }
        bar.style.removeProperty("display"); text(bar, c.ann_text);
      }
      text(".hero h1", c.hero_title);
      text(q(".hero-lead") || q(".hero-panel p"), c.hero_lead);
      text(".role.buy small", c.role_buy_sub); text(".role.sell small", c.role_sell_sub); text(".role.ride small", c.role_ride_sub);
      vis(".quick-links", c.show_quicklinks); vis("#pulse", c.show_pulse); vis("#sell", c.show_sell);
      if (c.show_notice === false) vis(".prototype-notice", false);
      text(".sell-panel h2", c.sell_title); text(".sell-panel p", c.sell_text); text(".sell-panel .button", c.sell_button);
      if (c.safety_tips) {
        var ul = q("#safety-backdrop ul"), tips = String(c.safety_tips).split("\n").map(function (t) { return t.trim(); }).filter(Boolean);
        if (ul && tips.length && ul.dataset.sc !== c.safety_tips) { ul.innerHTML = ""; tips.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); ul.dataset.sc = c.safety_tips; }
      }
      text("footer .footer-row p", c.footer_text);
      if (/^#[0-9a-f]{6}$/i.test(c.brand_color || "")) { var r = document.documentElement.style; r.setProperty("--green", c.brand_color); r.setProperty("--green-dark", darker(c.brand_color)); }
    } catch (e) { console.info("site-content skipped:", e && e.message); }
  }
  function again(c) { apply(c); setTimeout(function () { apply(c); }, 1500); setTimeout(function () { apply(c); }, 4000); }

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (cached) again(cached);
  if (!cfg || !cfg.url || !cfg.publishableKey) return;
  fetch(String(cfg.url).replace(/\/+$/, "") + "/rest/v1/site_content?key=eq.site&select=value", { headers: { apikey: cfg.publishableKey } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var v = rows && rows[0] && rows[0].value;
      if (!v) { try { localStorage.removeItem(KEY); } catch (e) {} return; }
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
      again(v);
    }).catch(function () {});
})();
