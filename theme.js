/* SafeBuy NG theme: loads theme.css and adds a live "Marketplace pulse" (donut + stats) built from the real product list. */
(function () {
  "use strict";
  var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "./theme.css"; document.head.appendChild(l);

  var COLORS = ["#087f5b", "#f97316", "#34d399", "#fbbf24", "#14b8a6", "#fb923c"];
  var LABELS = { Home: "Home & living" };
  var sig = "", sec = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString("en-NG"); }
  function count(el, to, fmt) {
    var t0 = performance.now();
    (function step(t) { var k = Math.min(1, (t - t0) / 700); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  function build() {
    var shop = document.getElementById("shop");
    if (!shop) return null;
    var s = document.createElement("section");
    s.className = "section"; s.id = "pulse"; s.hidden = true;
    s.innerHTML = '<div class="container"><div class="pulse-grid">' +
      '<article class="pulse-card"><div class="pulse-head"><span class="tile">📊</span>Marketplace pulse<span class="live-pill" id="pl-pill">Live</span></div>' +
      '<div class="ring-wrap"><div class="ring" id="pl-ring"></div><div class="ring-c"><div><span id="pl-total">0</span><small>products</small></div></div></div>' +
      '<ul class="legend" id="pl-legend"></ul></article>' +
      '<div class="pulse-stats">' +
      '<article class="pulse-card stat"><span class="tile">🏪</span><div><b id="pl-sellers">0</b><small>Active sellers</small></div></article>' +
      '<article class="pulse-card stat"><span class="tile o">💰</span><div><b id="pl-avg">₦0</b><small>Average price</small></div></article>' +
      '<article class="pulse-card stat"><span class="tile o">⚡</span><div><b id="pl-cats">0</b><small>Categories stocked</small></div></article>' +
      "</div></div></div>";
    shop.parentNode.insertBefore(s, shop);
    return s;
  }

  function update() {
    var list = typeof products !== "undefined" ? products : [];
    var src = typeof productSource !== "undefined" ? productSource : "";
    var key = src + "|" + list.map(function (p) { return p.id + ":" + p.price + ":" + p.category; }).join(",");
    if (key === sig) return;
    sig = key;
    if (!sec) sec = build();
    if (!sec) return;

    // category chip counts
    var by = {};
    list.forEach(function (p) { by[p.category] = (by[p.category] || 0) + 1; });
    document.querySelectorAll("[data-category]").forEach(function (b) {
      var c = b.dataset.category === "All" ? list.length : (by[b.dataset.category] || 0);
      var sp = b.querySelector(".cc") || b.appendChild(Object.assign(document.createElement("span"), { className: "cc" }));
      sp.textContent = c;
    });

    sec.hidden = !list.length;
    if (!list.length) return;
    var pill = document.getElementById("pl-pill");
    pill.textContent = src === "sample" ? "Sample" : "Live"; pill.className = "live-pill" + (src === "sample" ? " sample" : "");

    var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), acc = 0, stops = [];
    cats.forEach(function (c, i) {
      var from = acc / list.length * 100; acc += by[c]; var to = acc / list.length * 100;
      stops.push(COLORS[i % COLORS.length] + " " + from + "% " + to + "%");
    });
    document.getElementById("pl-ring").style.background = "conic-gradient(" + stops.join(",") + ")";
    document.getElementById("pl-legend").innerHTML = cats.map(function (c, i) {
      return '<li><span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(LABELS[c] || c) + "<b>" + by[c] + "</b></li>";
    }).join("");

    var sellers = {}, sum = 0;
    list.forEach(function (p) { sellers[p.seller] = 1; sum += p.price; });
    count(document.getElementById("pl-total"), list.length, function (v) { return Math.round(v); });
    count(document.getElementById("pl-sellers"), Object.keys(sellers).length, function (v) { return Math.round(v); });
    count(document.getElementById("pl-avg"), sum / list.length, naira);
    count(document.getElementById("pl-cats"), cats.length, function (v) { return Math.round(v); });
  }

  var rl = document.getElementById("results-line");
  if (rl) new MutationObserver(update).observe(rl, { childList: true, characterData: true, subtree: true });
  setInterval(update, 2000);                                     // also catches changes made after sellers publish
  update();
})();
