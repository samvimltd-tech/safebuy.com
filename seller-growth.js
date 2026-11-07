/* SafeBuy NG seller-growth.js: "My growth" card in the seller dashboard (views, contacts, orders, tips, share buttons). */
(function () {
  "use strict";
  var body = document.getElementById("seller-body"); if (!body) return;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  var busy = false, root = location.origin + location.pathname.replace(/\/(seller|rider)\/[^\/]*$/, "/").replace(/[^\/]*$/, "");

  function tips(P, orders) {
    var t = [], total = P.reduce(function (s, p) { return s + p.views; }, 0);
    if (!P.length) return ["Add your first product. Shops with 5 or more products get noticed far more."];
    P.forEach(function (p) {
      if (p.views >= 15 && p.contacts === 0) t.push("“" + p.name + "” gets views but no chats. Improve the photo, description or price.");
      else if (p.views >= 10 && p.orders === 0 && p.contacts > 0) t.push("“" + p.name + "” gets chats but no orders. Try a lower price or reply faster.");
      if (!p.in_stock && p.views > 0) t.push("“" + p.name + "” is sold out but still gets views. Restock it.");
    });
    var top = P[0]; if (top && top.views7 > 0) t.push("Your best product this week is “" + top.name + "”. Share it on WhatsApp status.");
    if (total === 0) t.push("No views yet. Use the Share buttons below to send your products to friends and groups.");
    if (P.length < 5) t.push("Add more products: you have " + P.length + ". Aim for at least 5.");
    if (orders && orders.cancelled > orders.total / 3 && orders.total >= 3) t.push("Many of your orders were cancelled. Check your stock before accepting.");
    return t.slice(0, 5);
  }
  function draw(host, g) {
    var P = g.products || [], o = g.orders || {}, s = g.series || [], mx = Math.max.apply(null, s.concat([1]));
    var v7 = P.reduce(function (a, p) { return a + p.views7; }, 0), vt = P.reduce(function (a, p) { return a + p.views; }, 0), ct = P.reduce(function (a, p) { return a + p.contacts; }, 0), sh = P.reduce(function (a, p) { return a + p.shares; }, 0);
    var conv = vt ? Math.round((o.total || 0) / vt * 1000) / 10 : 0, tp = tips(P, o);
    function box(n, l) { return '<div style="flex:1;min-width:92px;background:#fff;border:1px solid #e1e5e9;border-radius:12px;padding:9px"><b style="font-size:19px;display:block">' + esc(n) + '</b><span class="muted" style="font-size:12px">' + esc(l) + "</span></div>"; }
    host.innerHTML = '<div style="border:1px solid #d7e3f5;background:#f5f9ff;border-radius:14px;padding:14px;margin:12px 0"><strong>📈 My shop growth</strong>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' + box(v7, "Views, last 7 days") + box(ct, "Chats started") + box(o.total || 0, "Orders") + box(naira(o.revenue_kobo), "Paid revenue") + "</div>" +
      '<div style="display:flex;align-items:flex-end;gap:4px;height:44px" aria-label="Views per day">' + s.map(function (x) { return '<i title="' + x + ' views" style="flex:1;background:#2563eb;border-radius:3px 3px 0 0;height:' + Math.max(6, Math.round(x / mx * 100)) + '%"></i>'; }).join("") + "</div>" +
      '<p class="muted" style="font-size:12px;margin:6px 0">All-time: ' + vt + " views · " + sh + " shares · " + conv + "% of views became orders</p>" +
      (tp.length ? "<strong>Tips for you</strong><ul style=\"margin:6px 0 10px;padding-left:18px\">" + tp.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (P.length ? '<details><summary style="font-weight:700;cursor:pointer">Your products and share buttons</summary>' + P.map(function (p) {
        var url = root + "?p=" + encodeURIComponent(p.id), txt = p.name + " on SafeBuy NG";
        return '<div style="border-top:1px solid #e1e5e9;padding:8px 0"><b>' + esc(p.name) + (p.in_stock ? "" : " (sold out)") + '</b><br><span class="muted" style="font-size:12.5px">' + p.views7 + " views this week · " + p.contacts + " chats · " + p.orders + ' orders</span><br>' +
          '<a class="button button-outline" target="_blank" rel="noopener" style="margin-top:6px;display:inline-block;text-decoration:none" href="https://wa.me/?text=' + encodeURIComponent(txt + "\n" + url) + '">Share on WhatsApp</a></div>';
      }).join("") + "</details>" : "") + "</div>";
  }
  async function load(host) {
    var c = window.safeBuySupabase; if (!c || !c.rpc || busy) return; busy = true;
    try { var r = await c.rpc("seller_growth"); if (!r.error && r.data && r.data.app) draw(host, r.data); else host.innerHTML = ""; } catch (e) { host.innerHTML = ""; }
    busy = false;
  }
  function inject() {
    if (document.getElementById("growth-host") || !body.querySelector(".status-pill") || !body.querySelector("#product-form")) return;
    var host = document.createElement("div"); host.id = "growth-host"; var f = body.querySelector("#product-form"); f.parentNode.insertBefore(host, f); load(host);
  }
  new MutationObserver(inject).observe(body, { childList: true }); inject();
})();
