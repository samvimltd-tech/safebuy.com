/* SafeBuy NG admin-plus.js: extra admin features. Add-on only: it never changes your admin.html logic or writes to the database.
   It reads with the signed-in admin's own session, the same access the admin page already has. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig;
  if (!cfg || !cfg.url || !cfg.publishableKey) return;
  var base = String(cfg.url).replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var list = $("list"), stats = $("stats"), tools = $("tools");
  if (!list || !stats || !tools) return;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  function wa(p) { var d = String(p || "").replace(/\D/g, ""); return d.indexOf("234") === 0 ? d : d.charAt(0) === "0" ? "234" + d.slice(1) : d.length === 10 ? "234" + d : d; }

  var st = document.createElement("style");
  st.textContent = "@media(max-width:600px){.topbar{flex-direction:column;align-items:flex-start}.top-actions{flex-wrap:wrap}}.plus-a{text-decoration:none;display:inline-flex;align-items:center}";
  document.head.appendChild(st);

  /* ---- Read-only data, using the admin's current session token ---- */
  function token() {
    try { var s = JSON.parse(localStorage.getItem("safebuy-admin-auth") || "{}"); return s.access_token || (s.currentSession && s.currentSession.access_token) || ""; }
    catch (e) { return ""; }
  }
  function get(table) {
    var t = token();
    if (!t) return Promise.resolve([]);
    return fetch(base + "/rest/v1/" + table + "?select=*", { headers: { apikey: cfg.publishableKey, Authorization: "Bearer " + t } })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  var D = { apps: {}, prods: {}, partners: [], jobs: [], pays: [] }, loadedAt = 0, loading = null;
  function load() {
    if (loading) return loading;
    loading = Promise.all([get("seller_applications"), get("seller_products"), get("delivery_partners"), get("delivery_jobs"), get("delivery_payouts")]).then(function (r) {
      D.apps = {}; r[0].forEach(function (a) { D.apps[a.id] = a; });
      D.prods = {}; r[1].forEach(function (p) { D.prods[p.id] = p; });
      D.partners = r[2]; D.jobs = r[3]; D.pays = r[4];
      loadedAt = Date.now(); loading = null;
    }, function () { loading = null; });
    return loading;
  }

  function tabNow() { var a = document.querySelector("#main-tabs .tab.active"); return a ? a.dataset.tab : ""; }

  /* ---- Overview: extra tiles + waiting count in the tab title ---- */
  function decorateStats() {
    var need = 0;
    stats.querySelectorAll(".stat.alert b").forEach(function (b) { need += parseInt(b.textContent, 10) || 0; });
    document.title = (need ? "(" + need + ") " : "") + "SafeBuy NG Admin";
    if (stats.querySelector("[data-plus]") || !stats.children.length) return;
    var online = D.partners.filter(function (p) { return p.is_online; }).length;
    var done = D.jobs.filter(function (j) { return j.status === "delivered"; }).length;
    var owed = D.pays.filter(function (r) { return r.status === "pending"; }).reduce(function (s, r) { return s + Number(r.amount_kobo || 0); }, 0);
    [["Riders online", online, "delivery|partners"], ["Deliveries completed", done, "delivery|jobs"], ["Owed to partners", money(owed), "delivery|payouts"]].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "stat"; b.dataset.plus = "1"; b.dataset.go = c[2];
      b.innerHTML = "<b>" + esc(c[1]) + "</b><span>" + esc(c[0]) + "</span>";
      stats.appendChild(b);
    });
  }

  /* ---- Products: category filter ---- */
  var cat = document.createElement("select");
  cat.id = "catf-plus"; cat.hidden = true; cat.setAttribute("aria-label", "Category");
  tools.insertBefore(cat, $("sort"));
  function fillCats() {
    var cur = cat.value, n = {};
    Object.keys(D.prods).forEach(function (k) { var c = D.prods[k].category; if (c) n[c] = (n[c] || 0) + 1; });
    var keys = Object.keys(n).sort(), sig = keys.join("|") + Object.keys(n).map(function (k) { return n[k]; }).join(",");
    if (cat.dataset.sig === sig) return;
    cat.dataset.sig = sig;
    cat.innerHTML = '<option value="">All categories</option>' + keys.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + " (" + n[c] + ")</option>"; }).join("");
    cat.value = n[cur] ? cur : "";
  }
  function applyCat() {
    var on = tabNow() === "products";
    cat.hidden = !on;
    if (!on) cat.value = "";
    list.querySelectorAll(".item").forEach(function (it) {
      var del = it.querySelector("[data-pdel]");
      if (!del) { it.hidden = false; return; }
      var p = D.prods[del.dataset.pdel];
      it.hidden = !!(cat.value && p && p.category !== cat.value);
    });
  }
  cat.addEventListener("change", applyCat);

  /* ---- Per-item extras ---- */
  function decorateItems() {
    list.querySelectorAll(".item").forEach(function (it) {
      if (it.dataset.plus) return;
      var del = it.querySelector("[data-pdel]"), acts = it.querySelector(".actions");
      if (del && D.prods[del.dataset.pdel]) {
        it.dataset.plus = "1";
        var p = D.prods[del.dataset.pdel], a = D.apps[p.seller_application_id], mu = it.querySelector(".grow .muted");
        if (mu) {
          mu.insertAdjacentHTML("afterend", (a && a.verification_status === "approved" ? ' <span class="pill approved">✓ Verified</span>' : ' <span class="pill">Unverified</span>') +
            (p.condition && p.condition !== "new" ? ' <span class="muted">· ' + esc(p.condition) + "</span>" : ""));
        }
        if (acts && p.slug && /^[a-z0-9-]+$/.test(p.slug)) del.insertAdjacentHTML("beforebegin", '<a class="button outline plus-a" href="./p/' + esc(p.slug) + '/" target="_blank" rel="noopener">View on site</a>');
        return;
      }
      var ac = it.querySelector("[data-acat]");
      if (ac && acts && D.apps[ac.dataset.id]) {
        it.dataset.plus = "1";
        var s = D.apps[ac.dataset.id], name = (it.querySelector("strong") || {}).textContent || "";
        ac.insertAdjacentHTML("beforebegin",
          (s.phone ? '<a class="button light plus-a" href="https://wa.me/' + esc(wa(s.phone)) + '" target="_blank" rel="noopener">Chat</a>' : "") +
          '<button class="button outline" type="button" data-plusgo="' + esc(name) + '">View products</button>');
      }
    });
    var n = list.querySelectorAll(".fresh").length, msg = $("dash-msg");
    if (n && msg && !msg.textContent) msg.textContent = n + " new update" + (n === 1 ? "" : "s") + " just arrived.";
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-plusgo]");
    if (!b) return;
    var t = document.querySelector('#main-tabs [data-tab="products"]');
    if (t) t.click();
    var s = $("search");
    s.value = b.dataset.plusgo;
    s.dispatchEvent(new Event("input", { bubbles: true }));
    window.scrollTo(0, 0);
  });

  function run() { fillCats(); decorateStats(); decorateItems(); applyCat(); }
  function refresh() {
    run();
    if (Date.now() - loadedAt > 20000) load().then(run);
  }
  new MutationObserver(refresh).observe(list, { childList: true });
  new MutationObserver(refresh).observe(stats, { childList: true });
  document.querySelector("#main-tabs").addEventListener("click", function () { setTimeout(applyCat, 0); });
  refresh();
})();
