/* SafeBuy NG - sponsored banner renderer. Fills <div data-ad-slot="home_top|home_mid">. Safe: text is escaped, links must be https. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ok(u) { return typeof u === "string" && /^https:\/\/[^\s<>"']{3,250}$/.test(u); }
  function client() { return window.safeBuySupabase && window.safeBuySupabase.rpc ? window.safeBuySupabase : null; }
  var seen = {};
  function fill(el, c) {
    var slot = el.getAttribute("data-ad-slot");
    c.rpc("active_ads", { p_slot: slot }).then(function (r) {
      var list = r && r.data; if (!Array.isArray(list) || !list.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = list.map(function (a) {
        var img = ok(a.image) ? '<img src="' + esc(a.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none">' : "";
        var btn = ok(a.link) ? '<a class="sb-ad-go" data-ad="' + esc(a.id) + '" href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer sponsored" style="flex:none;background:#087f5b;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:9px 13px;border-radius:10px">' + esc(a.button || "Visit") + "</a>" : "";
        return '<div class="sb-ad" data-ad="' + esc(a.id) + '" style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e6ece8;border-radius:16px;padding:12px;margin:10px 0">' + img +
          '<div style="min-width:0;flex:1"><div style="font-size:11px;color:#718078;font-weight:700">Sponsored · ' + esc(a.advertiser) + '</div><div style="font-weight:800;line-height:1.3">' + esc(a.title) + "</div>" + (a.body ? '<div style="font-size:13px;color:#51615a">' + esc(a.body) + "</div>" : "") + "</div>" + btn + "</div>";
      }).join("");
      list.forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; c.rpc("ad_event", { p_id: a.id, p_kind: "view" }).then(function () {}, function () {}); } });
    }, function () { el.hidden = true; });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.sb-ad-go"); var c = client();
    if (a && c) c.rpc("ad_event", { p_id: a.getAttribute("data-ad"), p_kind: "click" }).then(function () {}, function () {});
  });
  window.sbRefreshAds = function () { var c = client(); if (c) document.querySelectorAll("[data-ad-slot]").forEach(function (el) { fill(el, c); }); };
  function run(n) {
    var c = client(); if (!c) { if (n < 40) setTimeout(function () { run(n + 1); }, 500); return; }
    document.querySelectorAll("[data-ad-slot]").forEach(function (el) { fill(el, c); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { run(0); }); else run(0);
})();
