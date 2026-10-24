(function () {
  "use strict";

  var client = window.safeBuySupabase;
  if (!client && window.supabase && window.SAFEbuySupabaseConfig) {
    var c = window.SAFEbuySupabaseConfig;
    try { client = window.supabase.createClient(c.url, c.publishableKey); } catch (e) {}
  }
  if (!client) return;

  var css = document.createElement("style");
  css.textContent =
    ".trust-group{grid-column:1/-1;margin:8px 0 0;padding:11px 14px;border-radius:12px;font-size:15px;font-weight:800;" +
    "background:#e7f7ef;color:#066548;border:1px solid #bfe6d1}" +
    ".trust-group.unv{background:#fff8e8;color:#79551b;border-color:#f1d69a}" +
    ".trust-group small{font-weight:400;font-size:12px;margin-left:6px}" +
    ".trust-box{margin:14px 0;padding:14px 16px;border-radius:14px;font-size:14px;line-height:1.6;border:1px solid #f1d69a;background:#fff8e8;color:#79551b}" +
    ".trust-box.ok{border-color:#bfe6d1;background:#e7f7ef;color:#066548}" +
    ".trust-box strong{font-size:15px}";
  document.head.appendChild(css);

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function badge(t) {
    return t.verified
      ? '<span class="badge ok">✓ Verified' + (t.badge_number ? " · " + esc(t.badge_number) : "") + "</span>"
      : '<span class="badge">Unverified</span>';
  }

  /* ---------- Shop page: two groups, verified first ---------- */
  var trust = null, loading = null, lastLoad = 0;
  var grid = document.getElementById("product-grid");

  var headV = document.createElement("div");
  headV.className = "trust-group";
  var headU = document.createElement("div");
  headU.className = "trust-group unv";

  function loadTrust() {
    if (loading) return loading;
    lastLoad = Date.now();
    loading = client.from("product_seller_trust")
      .select("product_id,shop_name,verified,badge_number,verified_until")
      .then(function (r) {
        if (!r.error) {
          trust = {};
          (r.data || []).forEach(function (t) { trust[String(t.product_id)] = t; });
        }
        loading = null;
      }, function () { loading = null; });
    return loading;
  }

  function decorate() {
    if (!grid || !trust) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(":scope > .product-card"));
    if (!cards.length) return;

    var ver = [], unv = [], known = 0, missing = false;
    cards.forEach(function (card) {
      var btn = card.querySelector("[data-id]");
      var t = btn && trust[String(btn.dataset.id)];
      if (!t) { missing = true; unv.push(card); return; }
      known++;
      var key = t.verified ? "v:" + t.badge_number : "u";
      var line = card.querySelector(".seller-name");
      if (line && line.dataset.trust !== key) {
        line.querySelectorAll(".badge").forEach(function (b) { b.remove(); });
        line.insertAdjacentHTML("beforeend", " " + badge(t));
        line.dataset.trust = key;
      }
      (t.verified ? ver : unv).push(card);
    });

    // Sample products (database offline) have no seller info: leave the grid alone
    if (!known) return;

    headV.innerHTML = "✓ Verified sellers <small>" + ver.length + " product" + (ver.length === 1 ? "" : "s") + "</small>";
    headU.innerHTML = "Sellers without a verified badge <small>" + unv.length + " product" + (unv.length === 1 ? "" : "s") + "</small>";

    var want = [];
    if (ver.length) want = want.concat([headV], ver);
    if (unv.length) want = want.concat([headU], unv);

    var have = Array.prototype.slice.call(grid.children);
    var same = have.length === want.length && want.every(function (n, i) { return have[i] === n; });
    if (!same) grid.replaceChildren.apply(grid, want);

    if (missing && Date.now() - lastLoad > 20000) loadTrust().then(decorate);
  }

  if (grid) {
    new MutationObserver(decorate).observe(grid, { childList: true });
    loadTrust().then(decorate);
  }

  /* ---------- Product page: /p/<slug>/ ---------- */
  var m = location.pathname.match(/\/p\/([a-z0-9-]+)\/?$/);
  if (m) {
    var slug = m[1];
    var box = null;

    var show = function (t) {
      if (box) return true;
      var h1 = document.querySelector("h1");
      if (!h1) return false;
      box = document.createElement("div");
      box.id = "seller-trust-box";
      box.className = "trust-box" + (t.verified ? " ok" : "");
      box.innerHTML = t.verified
        ? "<strong>✓ Verified seller</strong><br>Badge number: <strong>" + esc(t.badge_number) + "</strong> · " + esc(t.shop_name) +
          "<br>This seller sent SafeBuy NG a business registration (RC) or tax (TIN) number and holds an active verified subscription."
        : "<strong>Seller without a verified badge</strong> · " + esc(t.shop_name) +
          "<br>This seller has not completed SafeBuy NG verification. Agree details first, meet in a public place and inspect the item before you pay.";
      h1.parentNode.insertBefore(box, h1.nextSibling);
      return true;
    };

    client.from("seller_products_public").select("id").eq("slug", slug).maybeSingle().then(function (r) {
      if (r.error || !r.data) return;
      client.from("product_seller_trust")
        .select("shop_name,verified,badge_number")
        .eq("product_id", r.data.id).maybeSingle().then(function (tr) {
          if (tr.error || !tr.data) return;
          var t = tr.data;
          if (show(t)) return;
          var obs = new MutationObserver(function () { if (show(t)) obs.disconnect(); });
          obs.observe(document.body, { childList: true, subtree: true });
          setTimeout(function () { obs.disconnect(); }, 10000);
        });
    });
  }
})();
