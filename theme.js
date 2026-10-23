/* SafeBuy NG theme: loads theme.css, then tidies the home page:
   one-row stats card, "Marketplace pulse" dropdown (live donut), and "How it works" dropdowns for buyers and sellers. */
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

  /* ---- stats card + pulse dropdown ---- */
  function build() {
    var shop = document.getElementById("shop");
    if (!shop) return null;
    var s = document.createElement("section");
    s.className = "section"; s.id = "pulse"; s.hidden = true;
    s.innerHTML = '<div class="container">' +
      '<article class="pulse-card stats-row">' +
      '<div class="s"><span class="tile">🏪</span><b id="pl-sellers">0</b><small>Active sellers</small></div>' +
      '<div class="s"><span class="tile o">💰</span><b id="pl-avg">₦0</b><small>Average price</small></div>' +
      '<div class="s"><span class="tile o">⚡</span><b id="pl-cats">0</b><small>Categories stocked</small></div></article>' +
      '<details class="dd" id="pl-dd"><summary><span class="tile">📊</span><span class="dd-t">Marketplace pulse<small>See what is on sale, by category</small></span>' +
      '<span class="live-pill" id="pl-pill">Live</span><span class="chev">⌄</span></summary>' +
      '<div class="dd-body"><div class="ring-wrap"><div class="ring" id="pl-ring"></div><div class="ring-c"><div><span id="pl-total">0</span><small>products</small></div></div></div>' +
      '<ul class="legend" id="pl-legend"></ul></div></details></div>';
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

  /* ---- "How it works" as dropdowns: buyers, sellers, trust & safety ---- */
  function guide() {
    var sec = document.getElementById("how-it-works");
    var grid = sec && sec.querySelector(".trust-grid");
    if (!grid || sec.querySelector(".guide")) return;
    var sub = sec.querySelector(".section-heading p");
    if (sub) sub.textContent = "New here? Tap a card to see how SafeBuy NG works for you.";
    function item(icon, title, small, body) {
      return '<details class="dd" name="sb-guide"><summary><span class="tile' + (icon === "🏪" ? " o" : "") + '">' + icon + '</span><span class="dd-t">' + title + "<small>" + small + '</small></span><span class="chev">⌄</span></summary><div class="dd-body">' + body + "</div></details>";
    }
    var g = document.createElement("div"); g.className = "guide";
    g.innerHTML =
      item("🛍️", "For buyers", "Find it, order it, track it",
        '<ol class="steps"><li><span>Browse or search products, then tap <b>Place order</b>.</span></li>' +
        "<li><span>Choose to pay at the seller's shop or on delivery. Add <b>SafeBuy Protection</b> if you want an inspection.</span></li>" +
        "<li><span>Follow your order under <b>Orders</b>. Seller contact unlocks once they mark it paid.</span></li></ol>") +
      item("🏪", "For sellers", "Open a shop and sell in minutes",
        '<ol class="steps"><li><span>Tap <b>Start selling</b> and create your shop in one step.</span></li>' +
        "<li><span>List products with photos. They go live right away.</span></li>" +
        "<li><span>Manage orders under <b>New orders</b>: mark paid, then shipped.</span></li></ol>") +
      item("🛡️", "Trust &amp; safety", "Verified labels and clear records", "");
    g.querySelector("details:last-child .dd-body").appendChild(grid);   // the original three trust cards live here now
    sec.querySelector(".container").appendChild(g);
  }

  var rl = document.getElementById("results-line");
  if (rl) new MutationObserver(update).observe(rl, { childList: true, characterData: true, subtree: true });
  setInterval(update, 2000);
  update();
  guide();
})();
