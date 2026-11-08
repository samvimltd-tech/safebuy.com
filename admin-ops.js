/* SafeBuy NG admin-ops.js: the Control tab (Live, Reports, Switches, Health, Checklist).
   Add-on: needs admin_ops.sql to have been run. Uses the signed-in admin's own session. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig;
  if (!cfg || !cfg.url || !cfg.publishableKey) return;
  var base = String(cfg.url).replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var list = $("list"), tabs = $("main-tabs");
  if (!list || !tabs) return;
  var covered = ["filter-tabs", "tools", "list", "dash-msg", "stats"];
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  function mb(b) { b = Number(b || 0); return b > 1073741824 ? (b / 1073741824).toFixed(2) + " GB" : (b / 1048576).toFixed(1) + " MB"; }
  function token() { try { var s = JSON.parse(localStorage.getItem("safebuy-admin-auth") || "{}"); return s.access_token || (s.currentSession && s.currentSession.access_token) || ""; } catch (e) { return ""; } }
  function rpc(name, args) {
    return fetch(base + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: cfg.publishableKey, Authorization: "Bearer " + token(), "Content-Type": "application/json" }, body: JSON.stringify(args || {}) })
      .then(function (r) { return r.text().then(function (t) { if (!r.ok) { var m = ""; try { m = JSON.parse(t).message; } catch (e) {} throw new Error(m || t.slice(0, 160) || "Request failed"); } return t ? JSON.parse(t) : null; }); });
  }
  function readSwitches() {
    return fetch(base + "/rest/v1/site_content?key=eq.switches&select=value", { headers: { apikey: cfg.publishableKey, Authorization: "Bearer " + token() }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (x) { return (x[0] && x[0].value) || {}; }).catch(function () { return {}; });
  }

  var st = document.createElement("style");
  st.textContent = "#ops-panel .ops-nav{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}#ops-panel .ops-nav button{border:1px solid #d6dbe0;background:#fff;border-radius:20px;padding:7px 13px;font:700 13px system-ui;cursor:pointer}#ops-panel .ops-nav button.on{background:#12372a;color:#fff;border-color:#12372a}" +
    "#ops-panel .ops-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}#ops-panel .ops-c{background:#fff;border:1px solid #e1e5e9;border-radius:14px;padding:12px}#ops-panel .ops-c b{display:block;font-size:24px}#ops-panel .ops-c span{font-size:12.5px;color:#5b6670}" +
    "#ops-panel .ops-spark{display:flex;align-items:flex-end;gap:4px;height:36px;margin-top:6px}#ops-panel .ops-spark i{flex:1;background:#12372a;border-radius:3px 3px 0 0;min-height:2px;opacity:.85}" +
    "#ops-panel .ops-row{background:#fff;border:1px solid #e1e5e9;border-radius:14px;padding:12px;margin-bottom:10px}#ops-panel .ops-row label{display:flex;gap:10px;align-items:flex-start;font-weight:600}#ops-panel .ops-row input[type=text],#ops-panel .ops-row select,#ops-panel .ops-row textarea{width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border:1px solid #cfd5da;border-radius:9px;font:inherit}" +
    "#ops-panel .ops-ok{color:#0b6b36}#ops-panel .ops-bad{color:#b42318}#ops-panel .ops-warn{color:#9a5b00}#ops-panel .ops-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2fb26a;margin-right:6px;animation:opsp 1.6s infinite}@keyframes opsp{50%{opacity:.3}}" +
    "#ops-panel .ops-bar{height:8px;background:#e6eaee;border-radius:6px;overflow:hidden;margin-top:6px}#ops-panel .ops-bar i{display:block;height:100%;background:#12372a}#ops-panel .ops-bar i.hi{background:#c2410c}";
  document.head.appendChild(st);

  var tab = document.createElement("button");
  tab.type = "button"; tab.className = "tab"; tab.dataset.plustab = "ops"; tab.innerHTML = "Control <span id=\"ops-badge\" hidden style=\"background:#c2410c;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px\"></span>";
  tabs.appendChild(tab);
  var panel = document.createElement("div");
  panel.id = "ops-panel"; panel.hidden = true; list.parentNode.insertBefore(panel, list.nextSibling);

  var view = "live", timer = null, hidden = covered.map(function () { return false; });
  function isOpen() { return !panel.hidden; }
  function show() {
    document.querySelectorAll("#main-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
    ["site-panel", "launch-panel", "backup-panel"].forEach(function (i) { var p = $(i); if (p) p.hidden = true; });
    tab.classList.add("active"); hidden = covered.map(function (i) { return !!($(i) && $(i).hidden); });
    covered.forEach(function (i) { if ($(i)) $(i).hidden = true; });
    panel.hidden = false; go(view);
  }
  function hide() {
    if (!isOpen()) return;
    panel.hidden = true; tab.classList.remove("active"); clearInterval(timer); timer = null;
    covered.forEach(function (i, n) { if ($(i)) $(i).hidden = false; });
  }
  tab.addEventListener("click", show);
  document.addEventListener("click", function (e) { var t = e.target.closest("[data-tab],[data-go],[data-plustab]"); if (t && t !== tab && !tab.contains(t)) hide(); }, true);

  function nav() {
    return '<div class="ops-nav">' + [["live", "Live"], ["orders", "Orders"], ["users", "Users"], ["reports", "Reports"], ["promote", "Promote"], ["reviews", "Reviews"], ["message", "Message"], ["plans", "Plans"], ["switches", "Switches"], ["health", "Health"], ["security", "Security"], ["errors", "Errors"], ["checklist", "Checklist"], ["audit", "Audit"]].map(function (v) {
      return '<button type="button" data-v="' + v[0] + '" class="' + (view === v[0] ? "on" : "") + '">' + v[1] + "</button>";
    }).join("") + "</div>";
  }
  panel.addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (b) go(b.dataset.v); });
  function body(html) { panel.innerHTML = nav() + '<div id="ops-body">' + html + "</div>"; }
  function fail(e) {
    var m = String(e && e.message || e);
    var missing = /could not find the function|does not exist|schema cache|404/i.test(m);
    return '<div class="ops-row"><b class="ops-bad">' + (missing ? "Setup needed" : "Could not load") + "</b><p>" + (missing ? "Run admin_ops.sql once in Supabase (SQL editor), then open this tab again." : esc(m)) + "</p></div>";
  }

  var seq = 0;
  function go(v) {
    view = v; clearInterval(timer); timer = null; var my = ++seq;
    body('<p class="muted">Loading…</p>');
    ({ live: pLive, orders: pOrders, users: pUsers, security: pSecurity, errors: pErrors, promote: pPromote, reviews: pReviews, message: pMessage, audit: pAudit, reports: pReports, plans: pPlans, switches: pSwitches, health: pHealth, checklist: pChecklist })[v](my);
  }
  function stale(my) { return my !== seq || !isOpen(); }

  function spark(a) { a = a || []; var m = Math.max.apply(null, a.concat([1])); return '<div class="ops-spark">' + a.map(function (x) { return '<i title="' + x + '" style="height:' + Math.max(6, Math.round(x / m * 100)) + '%"></i>'; }).join("") + "</div>"; }
  function card(n, l, x) { return '<div class="ops-c"><b>' + esc(n) + "</b><span>" + esc(l) + "</span>" + (x || "") + "</div>"; }

  /* ---- Live: refreshes itself every 20 seconds while open ---- */
  async function pLive(my) {
    async function draw() {
      try {
        var d = await rpc("admin_live"); if (stale(my)) return;
        if (d.error) throw new Error(d.error);
        setBadge(d.reports_open);
        var el = $("ops-body"); if (!el) return;
        el.innerHTML = '<p class="muted"><span class="ops-dot"></span>Live · updates every 20 seconds · ' + new Date().toLocaleTimeString("en-NG") + "</p>" +
          '<div class="ops-grid">' +
          card(d.users_total, "Total users", '<span> · +' + (d.users_today || 0) + " today</span>" + spark(d.signups_series)) +
          card(d.orders_today, "Orders today", "<span> · " + (d.orders_total || 0) + " in total</span>" + spark(d.orders_series)) +
          card(money(d.sales_today_kobo), "Paid sales today") +
          card(d.deliveries_active || 0, "Deliveries in progress", "<span> · " + (d.deliveries_done_today || 0) + " done today</span>") +
          card(d.riders_online || 0, "Riders online", "<span> · " + (d.riders_approved || 0) + " approved</span>") +
          card((d.sellers_pending || 0) + (d.riders_pending || 0), "Waiting for your approval", "<span> · " + (d.sellers_pending || 0) + " sellers, " + (d.riders_pending || 0) + " riders</span>") +
          card(d.products_total || 0, "Products listed") + card(d.reports_open || 0, "Open reports") + "</div>";
      } catch (e) { if (!stale(my) && $("ops-body")) $("ops-body").innerHTML = fail(e); }
    }
    await draw(); if (stale(my)) return;
    timer = setInterval(function () { if (!document.hidden && !stale(my)) draw(); }, 20000);
  }
  function setBadge(n) { var b = $("ops-badge"); if (!b) return; n = Number(n || 0); b.hidden = !n; b.textContent = n; }

  /* ---- Reports ---- */
  async function pReports(my) {
    async function draw(status) {
      var rows;
      try { rows = await rpc("admin_reports", { p_status: status }); } catch (e) { if (!stale(my)) body(fail(e)); return; }
      if (stale(my)) return;
      if (status === "open") setBadge((rows || []).length);
      body('<div class="ops-nav" style="margin-top:-4px">' + ["open", "resolved", "dismissed"].map(function (s) { return '<button type="button" data-s="' + s + '" class="' + (s === status ? "on" : "") + '">' + s[0].toUpperCase() + s.slice(1) + "</button>"; }).join("") + "</div>" +
        ((rows || []).length ? rows.map(function (r) {
          return '<div class="ops-row" data-id="' + esc(r.id) + '" data-p="' + esc(r.product_id) + '"><b>' + esc(r.product_name || "Product removed") + "</b>" + (r.shop_name ? " <span class=\"muted\">· " + esc(r.shop_name) + "</span>" : "") +
            (r.product_in_stock === false ? ' <span class="ops-warn">· hidden</span>' : "") +
            "<p><b>" + esc(r.reason) + "</b>" + (r.details ? "<br>" + esc(r.details) : "") + '</p><p class="muted" style="font-size:12px">' + new Date(r.created_at).toLocaleString("en-NG") + (r.admin_note ? " · note: " + esc(r.admin_note) : "") + "</p>" +
            '<input type="text" class="rp-note" maxlength="300" placeholder="Note (optional)">' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            (status === "open" ? '<button class="button" data-a="resolved">Resolve</button><button class="button outline" data-a="dismissed">Dismiss</button>' : '<button class="button outline" data-a="open">Reopen</button>') +
            (r.product_id ? '<button class="button outline" data-a="hide">' + (r.product_in_stock === false ? "Show product" : "Hide product") + "</button>" : "") + "</div></div>";
        }).join("") : '<p class="muted">Nothing here. ✓</p>') + '<p id="rp-msg" class="muted"></p>');
      panel.querySelectorAll("[data-s]").forEach(function (b) { b.onclick = function () { draw(b.dataset.s); }; });
      panel.querySelectorAll(".ops-row [data-a]").forEach(function (b) {
        b.onclick = async function () {
          var row = b.closest(".ops-row"), a = b.dataset.a; b.disabled = true;
          try {
            if (a === "hide") { var hideIt = !/Show/.test(b.textContent); await rpc("admin_hide_product", { p_product: row.dataset.p, p_hide: hideIt }); b.textContent = hideIt ? "Show product" : "Hide product"; b.disabled = false; $("rp-msg").textContent = hideIt ? "Product hidden from buyers." : "Product visible again."; }
            else { await rpc("admin_resolve_report", { p_report: row.dataset.id, p_status: a, p_note: row.querySelector(".rp-note").value }); row.remove(); $("rp-msg").textContent = "Saved."; }
          } catch (e) { b.disabled = false; $("rp-msg").textContent = "Failed: " + e.message; }
        };
      });
    }
    draw("open");
  }

  function wa(p) { var d = String(p || "").replace(/\D/g, ""); return d.indexOf("234") === 0 ? d : d.charAt(0) === "0" ? "234" + d.slice(1) : d.length === 10 ? "234" + d : d; }
  function when(t) { return t ? new Date(t).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
  var INP = 'style="flex:1;min-width:150px;padding:9px;border:1px solid #cfd5da;border-radius:9px;font:inherit"';
  function searchBar(ph, val) { return '<div style="display:flex;gap:8px;margin-bottom:10px"><input type="text" id="q-in" ' + INP + ' placeholder="' + ph + '" value="' + esc(val || "") + '"><button class="button" type="button" id="q-go">Search</button></div>'; }
  function wireSearch(fn) { var i = $("q-in"); $("q-go").onclick = function () { fn(i.value); }; i.onkeydown = function (e) { if (e.key === "Enter") fn(i.value); }; }

  /* ---- Orders ---- */
  async function pOrders(my, q) {
    var rows;
    try { rows = await rpc("admin_orders", { p_search: q || null, p_limit: 100 }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "admin_control.sql")); return; }
    if (stale(my)) return;
    body(searchBar("Search order, buyer, shop, product, city, status", q) + ((rows || []).length ? rows.map(function (o) {
      var done = o.status === "cancelled";
      return '<div class="ops-row" data-id="' + esc(o.id) + '"><b>' + esc(o.product) + "</b> × " + esc(o.qty) + " · " + money(o.total_kobo) + ' · <span class="' + (done ? "ops-bad" : "ops-ok") + '">' + esc(o.status) + "</span><br>" +
        '<span class="muted">Buyer ' + esc(o.buyer) + " · Shop " + esc(o.shop) + (o.rider ? " · Rider " + esc(o.rider) : "") + (o.city ? " · " + esc(o.city) : "") + (o.job_status ? " · delivery: " + esc(o.job_status) : "") + " · " + when(o.created_at) + " · #" + esc(String(o.id).slice(0, 8)) + "</span>" +
        '<div class="o-tl muted" style="font-size:13px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="button outline" data-o="tl">Timeline</button>' + (done ? "" : '<button class="button outline" data-o="cancel" style="color:#b42318;border-color:#b42318">Cancel order</button>') + "</div></div>";
    }).join("") : '<p class="muted">No orders found.</p>') + '<p id="o-msg" class="muted"></p>');
    wireSearch(function (v) { pOrders(my, v); });
    panel.querySelectorAll("[data-o]").forEach(function (b) {
      b.onclick = async function () {
        var row = b.closest(".ops-row");
        try {
          if (b.dataset.o === "tl") { var t = await rpc("admin_order_timeline", { p_order: row.dataset.id }); row.querySelector(".o-tl").innerHTML = (t || []).length ? (t || []).map(function (x) { return "• " + esc(x.label) + " <small>(" + when(x.at) + ")</small>"; }).join("<br>") : "No events yet."; }
          else {
            var why = window.prompt("Reason for cancelling (the buyer and seller will see it):", "");
            if (why === null) return; if (!window.confirm("Cancel this order? This cannot be undone.")) return;
            b.disabled = true; await rpc("admin_cancel_order", { p_order: row.dataset.id, p_reason: why }); pOrders(my, q);
          }
        } catch (e) { b.disabled = false; $("o-msg").className = "ops-bad"; $("o-msg").textContent = e.message; }
      };
    });
  }

  /* ---- Users (buyers and riders) ---- */
  var ukind = "buyers";
  async function pUsers(my, q) {
    var rows;
    try { rows = await rpc("admin_people", { p_kind: ukind, p_search: q || null }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "admin_control.sql")); return; }
    if (stale(my)) return;
    body('<div class="ops-nav" style="margin-top:-4px">' + ["buyers", "riders"].map(function (k) { return '<button type="button" data-k="' + k + '" class="' + (k === ukind ? "on" : "") + '">' + k[0].toUpperCase() + k.slice(1) + "</button>"; }).join("") + "</div>" +
      searchBar("Search name or phone", q) + ((rows || []).length ? rows.map(function (u) {
        var ph = u.phone ? ' · <a href="https://wa.me/' + wa(u.phone) + '" target="_blank" rel="noopener">' + esc(u.phone) + "</a>" : "";
        if (ukind === "buyers") return '<div class="ops-row" data-u="' + esc(u.user_id) + '"><b>' + esc(u.name || "Buyer") + "</b>" + ph + (u.blocked ? ' · <b class="ops-bad">BLOCKED</b>' : "") + '<br><span class="muted">' + u.orders + " orders · paid " + money(u.spent_kobo) + " · last " + when(u.last_order) + '</span><div style="margin-top:8px"><button class="button outline" data-b="' + (u.blocked ? "0" : "1") + '">' + (u.blocked ? "Unblock" : "Block from ordering") + "</button></div></div>";
        return '<div class="ops-row"><b>' + esc(u.name) + "</b>" + ph + ' · <span class="' + (u.status === "approved" ? "ops-ok" : "ops-warn") + '">' + esc(u.status) + "</span>" + (u.online ? " · 🟢 online" : "") + '<br><span class="muted">' + esc(u.vehicle || "") + " · " + esc(u.state || "") + " · " + (u.done || 0) + " deliveries · " + (u.rating ? "★ " + u.rating + " (" + u.ratings + ")" : "no ratings") + " · earned " + money(u.earned_kobo) + " · owed " + money(u.owed_kobo) + "</span></div>";
      }).join("") : '<p class="muted">Nobody found.</p>') + '<p class="muted" style="font-size:12px">Block stops a buyer placing new orders. To suspend a rider or seller, use the Delivery or Sellers tab.</p><p id="u-msg" class="muted"></p>');
    panel.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { ukind = b.dataset.k; go("users"); }; });
    wireSearch(function (v) { pUsers(my, v); });
    panel.querySelectorAll("[data-b]").forEach(function (b) {
      b.onclick = async function () {
        var blockIt = b.dataset.b === "1", reason = "";
        if (blockIt) { reason = window.prompt("Reason (optional):", ""); if (reason === null) return; }
        if (!window.confirm(blockIt ? "Block this buyer from placing orders?" : "Let this buyer order again?")) return;
        b.disabled = true;
        try { await rpc("admin_block_user", { p_user: b.closest(".ops-row").dataset.u, p_block: blockIt, p_reason: reason }); pUsers(my, q); }
        catch (e) { b.disabled = false; $("u-msg").className = "ops-bad"; $("u-msg").textContent = e.message; }
      };
    });
  }

  /* ---- Errors: crashes reported by the pages (needs guard.js on the pages and hardening.sql) ---- */
  async function pErrors(my) {
    var rows;
    try { rows = await rpc("admin_errors"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "hardening.sql")); return; }
    if (stale(my)) return;
    body('<p class="muted">Crashes found by real visitors, newest first. The same error is counted once with a number. Send me the text of any that keep coming back.</p>' +
      ((rows || []).length ? rows.map(function (r) {
        return '<div class="ops-row"><b class="ops-bad">' + esc(r.msg) + "</b><br><span class=\"muted\">" + esc(r.page) + (r.src ? " · " + esc(r.src) + (r.line ? ":" + r.line : "") : "") + " · " + r.n + " time" + (r.n > 1 ? "s" : "") + " · last " + when(r.last_at) + "<br>" + esc(r.ua || "") + "</span></div>";
      }).join("") + '<button class="button outline full" type="button" id="er-clear">Clear the list</button>' : '<p class="ops-ok">✓ No crashes reported.</p>') + '<p id="er-msg" class="muted"></p>');
    var c = $("er-clear");
    if (c) c.onclick = async function () { if (!window.confirm("Clear all error records?")) return; try { await rpc("admin_clear_errors"); pErrors(my); } catch (e) { $("er-msg").textContent = e.message; } };
  }

  /* ---- Security audit ---- */
  var EXPECT_FN = ["track_product", "log_client_error", "home_sections", "shops_without_badge", "list_delivery_coverage", "order_tracking", "rate_delivery"];
  async function pSecurity(my) {
    var a;
    try { a = await rpc("admin_security_audit"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "hardening.sql")); return; }
    if (stale(my)) return;
    function list(x) { return (x || []).map(esc).join(", "); }
    function row(good, title, detail, fix) { return '<div class="ops-row"><b class="' + (good ? "ops-ok" : "ops-bad") + '">' + (good ? "✓ " : "⚠ ") + esc(title) + "</b>" + (detail ? "<p style=\"margin:6px 0 0\">" + detail + "</p>" : "") + (!good && fix ? '<p class="muted" style="margin:6px 0 0">' + esc(fix) + "</p>" : "") + "</div>"; }
    var unexpected = (a.open_functions || []).filter(function (f) { return EXPECT_FN.indexOf(f) < 0; });
    var badBuckets = (a.public_buckets || []).filter(function (b) { return b !== "product-images"; });
    body('<p class="muted">An automatic check of your database rules. It lists names only. Tell me about any ⚠ and I will give you the exact fix.</p>' +
      row(!(a.no_rls || []).length, (a.no_rls || []).length ? "Row security is OFF on: " + list(a.no_rls) : "Row security is on for every table", "", "Anyone with your public key could read or change these. Do not ignore this one.") +
      row(!(a.open_write_policies || []).length, (a.open_write_policies || []).length ? "Rules that let ANYONE write: " + list(a.open_write_policies) : "No rule lets anonymous visitors write freely", "", "Replace the rule with one that checks who the user is.") +
      row(!(a.anon_can_write || []).length, (a.anon_can_write || []).length ? "Signed-out visitors have write permission on: " + list(a.anon_can_write) + " (safe only if row security and rules are strict)" : "Signed-out visitors cannot write to any table", "", "Remove the permission if signed-out writes are not needed.") +
      row(!unexpected.length, unexpected.length ? "Functions callable by anyone that I do not recognise: " + list(unexpected) : "Only the expected public functions are open", "Expected open: " + list((a.open_functions || []).filter(function (f) { return EXPECT_FN.indexOf(f) >= 0; })), "Check each one cannot expose private data or change records.") +
      row(!badBuckets.length, badBuckets.length ? "Public file buckets: " + list(badBuckets) : "Only the product photo bucket is public", "", "Make private buckets (documents, IDs) private in Supabase Storage.") +
      '<button class="button outline full" type="button" id="sc-again">Check again</button>');
    $("sc-again").onclick = function () { go("security"); };
  }

  /* ---- Promote: choose Featured and Hot products shown on the home page ---- */
  async function pPromote(my, q) {
    var rows;
    try { rows = await rpc("admin_find_products", { p_q: q || null }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "growth.sql")); return; }
    if (stale(my)) return;
    body('<p class="muted">Featured and Hot products appear in their own rows at the top of the shop page. Trending and Best sellers fill in by themselves from real views and orders.</p>' + searchBar("Search product or shop", q) +
      ((rows || []).length ? rows.map(function (r) {
        return '<div class="ops-row" data-id="' + esc(r.id) + '"><b>' + esc(r.name) + "</b> · " + esc(r.shop || "") + (r.in_stock ? "" : ' <span class="ops-warn">· sold out</span>') + '<br><span class="muted">' + (r.views7 || 0) + " views this week" + (r.kind ? " · currently <b>" + esc(r.kind) + "</b>" : "") + '</span><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
          ["featured", "hot"].map(function (k) { return '<button class="button ' + (r.kind === k ? "" : "outline") + '" data-k="' + k + '">' + (k === "hot" ? "🔥 Hot" : "⭐ Featured") + "</button>"; }).join("") + (r.kind ? '<button class="button outline" data-k="">Remove</button>' : "") + "</div></div>";
      }).join("") : '<p class="muted">No products found.</p>') + '<p id="pm-msg" class="muted"></p>');
    wireSearch(function (v) { pPromote(my, v); });
    panel.querySelectorAll(".ops-row [data-k]").forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { await rpc("admin_set_featured", { p_product: b.closest(".ops-row").dataset.id, p_kind: b.dataset.k || null }); pPromote(my, q); }
        catch (e) { b.disabled = false; $("pm-msg").className = "ops-bad"; $("pm-msg").textContent = e.message; }
      };
    });
  }

  /* ---- Reviews ---- */
  async function pReviews(my) {
    var rows;
    try { rows = await rpc("admin_reviews", { p_limit: 100 }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "admin_control.sql")); return; }
    if (stale(my)) return;
    body(((rows || []).length ? rows.map(function (r) {
      var stars = r.rating != null ? r.rating : r.stars, text = r.comment || r.body || r.text || r.review || "";
      return '<div class="ops-row" data-id="' + esc(r.id) + '"><b>' + esc(r.product_name || "Product") + "</b>" + (stars != null ? " · " + "★".repeat(Math.max(0, Math.min(5, Number(stars) || 0))) : "") + '<p style="margin:6px 0">' + esc(text) + '</p><span class="muted" style="font-size:12px">' + when(r.created_at) + '</span><div style="margin-top:8px"><button class="button outline" data-del style="color:#b42318;border-color:#b42318">Delete review</button></div></div>';
    }).join("") : '<p class="muted">No reviews yet.</p>') + '<p id="rv-msg" class="muted"></p>');
    panel.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = async function () {
        if (!window.confirm("Delete this review for good?")) return; b.disabled = true;
        try { await rpc("admin_delete_review", { p_review: b.closest(".ops-row").dataset.id }); b.closest(".ops-row").remove(); $("rv-msg").textContent = "Deleted."; }
        catch (e) { b.disabled = false; $("rv-msg").className = "ops-bad"; $("rv-msg").textContent = e.message; }
      };
    });
  }

  /* ---- Message everyone (in-app alert) ---- */
  function pMessage() {
    body('<form id="ms-form" class="ops-row"><b>Send an in-app alert</b><p class="muted" style="margin:4px 0">People see it in their alerts next time they open the app. It is not an SMS or email.</p>' +
      '<select id="ms-aud"><option value="all">Everyone</option><option value="buyers">Buyers</option><option value="sellers">Sellers</option><option value="riders">Riders</option></select>' +
      '<input type="text" id="ms-t" maxlength="80" placeholder="Title (required)"><textarea id="ms-b" maxlength="300" rows="3" placeholder="Message (up to 300 letters)"></textarea>' +
      '<button class="button full" type="submit" style="margin-top:8px">Send</button><p id="ms-msg" class="muted"></p></form>');
    $("ms-form").onsubmit = async function (e) {
      e.preventDefault(); var m = $("ms-msg"), aud = $("ms-aud").value, t = $("ms-t").value.trim();
      if (!t) { m.className = "ops-bad"; m.textContent = "Write a title first."; return; }
      if (!window.confirm("Send this to " + $("ms-aud").selectedOptions[0].text.toLowerCase() + " now? You cannot take it back.")) return;
      m.className = "muted"; m.textContent = "Sending…";
      try { var n = await rpc("admin_broadcast", { p_audience: aud, p_title: t, p_body: $("ms-b").value.trim() }); rpc("admin_log", { p_action: "Announcement sent", p_detail: aud + " · " + n + " people · " + t.slice(0, 60) }).catch(function () {}); m.className = "ops-ok"; m.textContent = "Sent to " + n + " people."; $("ms-t").value = ""; $("ms-b").value = ""; }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not sent: " + er.message; }
    };
  }

  /* ---- Audit log ---- */
  async function pAudit(my) {
    var rows;
    try { rows = await rpc("admin_audit_list", { p_limit: 150 }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "admin_extra.sql")); return; }
    if (stale(my)) return;
    body('<p class="muted">Every admin change, newest first. Only changes made while signed in as an admin are recorded.</p>' + ((rows || []).length ? rows.map(function (r) {
      return '<div class="ops-row"><b>' + esc(r.action) + '</b><br><span class="muted">' + esc(r.who) + " · " + when(r.at) + (r.detail ? " · " + esc(r.detail) : "") + "</span></div>";
    }).join("") : '<p class="muted">Nothing logged yet.</p>'));
  }

  /* ---- Plans: Verified badge subscriptions (N1,000 monthly / N12,000 yearly) ---- */
  async function pPlans(my) {
    var d;
    try { d = await rpc("admin_subscriptions"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "seller_plans.sql")); return; }
    if (stale(my)) return;
    var P = d.plans || {}, rows = d.rows || [], active = rows.filter(function (r) { return r.active; }).length;
    body('<div class="ops-grid">' + card(active, "Active badges") + card(money(d.paid_total_kobo), "Collected so far") + "</div>" +
      '<form id="pl-form" class="ops-row"><label><input type="checkbox" id="pl-req"' + (P.required ? " checked" : "") + "><span>Verified badge needs a paid subscription<br><small class=\"muted\">OFF = every verified shop keeps its badge (nothing changes). ON = only shops with an active plan show the badge. Listing stays free either way.</small></span></label>" +
      '<input type="text" id="pl-m" inputmode="numeric" value="' + Math.round((P.monthly_kobo || 100000) / 100) + '" placeholder="Monthly price in naira"><input type="text" id="pl-y" inputmode="numeric" value="' + Math.round((P.yearly_kobo || 1200000) / 100) + '" placeholder="12-month price in naira">' +
      '<button class="button full" type="submit" style="margin-top:8px">Save plans</button><p id="pl-msg" class="muted"></p></form>' +
      "<h3>Sellers</h3>" + (rows.length ? rows.map(function (r) {
        return '<div class="ops-row" data-app="' + esc(r.app) + '"><b>' + esc(r.shop) + "</b> · " + (r.verification === "approved" ? "verified" : "not verified") + "<br>" +
          (r.active ? '<span class="ops-ok">Badge active until ' + new Date(r.expires_at).toLocaleDateString("en-NG") + " (" + esc(r.plan) + (r.auto_renew ? ", auto-renew" : ", no renewal") + ")</span>" : '<span class="muted">No active plan</span>') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input type="text" class="pl-ref" maxlength="60" placeholder="Payment reference (optional)" style="flex:1;min-width:140px;padding:8px;border:1px solid #cfd5da;border-radius:9px">' +
          '<button class="button outline" data-pay="monthly">Mark paid · 1 month</button><button class="button outline" data-pay="yearly">Mark paid · 12 months</button></div></div>';
      }).join("") : '<p class="muted">No shops yet.</p>') + '<p id="pl-msg2" class="muted"></p>');
    $("pl-form").onsubmit = async function (e) {
      e.preventDefault(); var m = $("pl-msg"), mo = Number($("pl-m").value), yr = Number($("pl-y").value);
      if (!(mo >= 0) || !(yr >= 0)) { m.textContent = "Enter prices as numbers."; return; }
      if ($("pl-req").checked && !P.required && !window.confirm("Turn ON? Verified shops WITHOUT an active plan will lose their badge straight away.")) return;
      try { await rpc("admin_set_plans", { p_required: $("pl-req").checked, p_monthly_kobo: Math.round(mo * 100), p_yearly_kobo: Math.round(yr * 100) }); m.className = "ops-ok"; m.textContent = "Saved."; }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
    };
    panel.querySelectorAll("[data-pay]").forEach(function (b) {
      b.onclick = async function () {
        var row = b.closest(".ops-row"), plan = b.dataset.pay;
        if (!window.confirm("Record a " + (plan === "yearly" ? "12-month" : "1-month") + " payment for " + row.querySelector("b").textContent + "?")) return;
        b.disabled = true;
        try { await rpc("admin_record_payment", { p_app: row.dataset.app, p_plan: plan, p_reference: row.querySelector(".pl-ref").value }); pPlans(my); }
        catch (er) { b.disabled = false; $("pl-msg2").textContent = "Failed: " + er.message; }
      };
    });
  }

  /* ---- Switches ---- */
  async function pSwitches(my) {
    var v = await readSwitches(); if (stale(my)) return;
    function on(k, d) { return v[k] === undefined ? d : v[k] === true; }
    body('<form id="sw-form">' +
      '<div class="ops-row"><label><input type="checkbox" id="sw-signups"' + (on("signups_open", true) ? " checked" : "") + '><span>New sign-ups are open<br><small class="muted">Switch off to pause Create account. People who already have an account can still sign in.</small></span></label></div>' +
      '<div class="ops-row"><label><input type="checkbox" id="sw-rider"' + (on("rider_online_open", true) ? " checked" : "") + '><span>Riders can go online<br><small class="muted">Switch off to stop new "Go online" taps.</small></span></label></div>' +
      '<div class="ops-row"><label><input type="checkbox" id="sw-maint"' + (on("maintenance_on", false) ? " checked" : "") + '><span>Maintenance mode (covers the whole site)<br><small class="muted">Visitors see the message below. This admin page stays usable.</small></span></label>' +
      '<input type="text" id="sw-mtext" maxlength="300" placeholder="Message shown to visitors" value="' + esc(v.maintenance_text || "") + '"></div>' +
      '<div class="ops-row"><b>Banner at the top of every page</b><input type="text" id="sw-btext" maxlength="200" placeholder="e.g. Free delivery this weekend! (empty = no banner)" value="' + esc(v.banner_text || "") + '">' +
      '<select id="sw-btone"><option value="info">Blue (information)</option><option value="warn">Yellow (warning)</option><option value="good">Green (good news)</option></select></div>' +
      '<button class="button full" type="submit">Save switches</button><p id="sw-msg" class="muted"></p></form>');
    $("sw-btone").value = v.banner_tone || "info";
    $("sw-form").onsubmit = async function (e) {
      e.preventDefault();
      if ($("sw-maint").checked && !window.confirm("Turn ON maintenance mode? Everyone visiting the shop will see the maintenance message.")) return;
      var m = $("sw-msg"); m.textContent = "Saving…";
      try {
        await rpc("admin_set_switches", { p_value: { signups_open: $("sw-signups").checked, rider_online_open: $("sw-rider").checked, maintenance_on: $("sw-maint").checked, maintenance_text: $("sw-mtext").value.trim(), banner_text: $("sw-btext").value.trim(), banner_tone: $("sw-btone").value } });
        m.className = "ops-ok"; m.textContent = "Saved. Visitors get it within about a minute.";
      } catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
    };
  }

  /* ---- Health ---- */
  async function pHealth(my) {
    var t0 = Date.now(), h;
    try { h = await rpc("admin_health"); } catch (e) { if (!stale(my)) body(fail(e)); return; }
    var ms = Date.now() - t0; if (stale(my)) return;
    function bar(used, cap, label) { var p = Math.min(100, Math.round(used / cap * 100)); return '<div class="ops-row"><b>' + label + "</b> · " + mb(used) + " of " + mb(cap) + " (" + p + '%)<div class="ops-bar"><i class="' + (p > 75 ? "hi" : "") + '" style="width:' + p + '%"></i></div>' + (p > 75 ? '<p class="ops-bad">Getting full. Plan an upgrade or clean up.</p>' : "") + "</div>"; }
    var pub = (h.buckets || []).filter(function (b) { return b.name === "delivery-docs" && b.public; });
    var rls = h.rls_off || [];
    body('<div class="ops-row"><b>Database answered in ' + ms + ' ms</b> ' + (ms < 800 ? '<span class="ops-ok">✓ fast</span>' : '<span class="ops-warn">slow</span>') + "<br>" + (h.connections || 0) + " open connections</div>" +
      bar(h.db_bytes, 524288000, "Database size (free plan limit 500 MB)") +
      (h.storage_bytes != null ? bar(h.storage_bytes, 1073741824, "Photo and document storage (free plan limit 1 GB)") : "") +
      '<div class="ops-row"><b>Security</b><p class="' + (rls.length ? "ops-bad" : "ops-ok") + '">' + (rls.length ? "⚠ Row security is OFF on: " + esc(rls.join(", ")) + ". Anyone with your public key can read these. Tell me and I will give you the SQL to turn it on safely." : "✓ Row security is on for every table.") + "</p>" +
      (pub.length ? '<p class="ops-bad">⚠ The delivery-docs bucket is PUBLIC. Rider ID documents should be private.</p>' : '<p class="ops-ok">✓ Rider documents bucket is not public.</p>') +
      (h.slow_policies ? '<p class="ops-warn">' + h.slow_policies + " access rules can be made faster (run backup_and_speed.sql).</p>" : '<p class="ops-ok">✓ Access rules are speed-optimised.</p>') + "</div>" +
      '<div class="ops-row" id="hl-bk"><b>Backups</b><p id="hl-bk-t" class="muted" style="margin:6px 0">Checking…</p><button class="button outline" type="button" id="hl-bk-btn">I just downloaded a backup</button></div>' +
      '<div class="ops-row"><b>Biggest tables</b><br>' + (h.biggest || []).map(function (b) { return esc(b.table) + " · " + mb(b.bytes); }).join("<br>") + '</div><button class="button outline full" type="button" id="hl-again">Check again</button>');
    $("hl-again").onclick = function () { go("health"); };
    rpc("admin_kv_get", { p_key: "last_backup" }).then(function (k) {
      var d = k && k.at ? Math.floor((Date.now() - new Date(k.at).getTime()) / 86400000) : null, t = $("hl-bk-t"); if (!t) return;
      t.className = d === null || d > 7 ? "ops-bad" : "ops-ok";
      t.textContent = d === null ? "⚠ No backup recorded yet. Open the Backup tab and download one now." : d > 7 ? "⚠ Your last backup was " + d + " days ago. Download a fresh one from the Backup tab." : "✓ Last backup " + (d === 0 ? "today" : d + " day(s) ago") + ".";
    }).catch(function () {});
    $("hl-bk-btn").onclick = function () { rpc("admin_kv_set", { p_key: "last_backup", p_value: { at: new Date().toISOString() } }).then(function () { go("health"); }).catch(function () {}); };
  }

  /* ---- Checklist (progress is saved in the database, so it is the same on every device) ---- */
  var ITEMS = [
    ["files", "All site files uploaded, and the Health page (health.html) shows green"],
    ["sql_ops", "Ran admin_ops.sql (this Control tab)"],
    ["sql_speed", "Ran backup_and_speed.sql (backup + speed)"],
    ["sql_veh", "Ran vehicles.sql (rider vehicles)"],
    ["vendor", "Uploaded vendor/supabase-2.45.4.js"],
    ["keepalive", "Added the keep-alive GitHub Action (stops free Supabase pausing)"],
    ["redirect", "Set Supabase Redirect URLs for the buyer, seller and rider pages"],
    ["smtp", "Set up custom email (SMTP) so sign-up emails do not hit the free limit"],
    ["cf", "Moved the site to Cloudflare Pages"],
    ["docs", "delivery-docs bucket is private"],
    ["policy", "Read the About, Terms, Privacy and Refund pages and put in a real support contact"],
    ["order", "Tested one full order with 3 accounts: buyer, seller, rider"],
    ["backup", "Downloaded a first backup from the Backup tab"],
    ["support", "Saved support email and WhatsApp in Site content"]
  ];
  async function pChecklist(my) {
    var s;
    try { s = await rpc("admin_kv_get", { p_key: "checklist" }); } catch (e) { if (!stale(my)) body(fail(e)); return; }
    if (stale(my)) return; s = s || {};
    function draw() {
      var done = ITEMS.filter(function (i) { return s[i[0]]; }).length;
      body('<div class="ops-row"><b>' + done + " of " + ITEMS.length + ' done</b><div class="ops-bar"><i style="width:' + Math.round(done / ITEMS.length * 100) + '%"></i></div></div>' +
        ITEMS.map(function (i) { return '<div class="ops-row"><label><input type="checkbox" data-k="' + i[0] + '"' + (s[i[0]] ? " checked" : "") + "><span>" + esc(i[1]) + "</span></label></div>"; }).join("") + '<p id="ck-msg" class="muted"></p>');
      panel.querySelectorAll("[data-k]").forEach(function (c) {
        c.onchange = async function () {
          s[c.dataset.k] = c.checked; var prev = !c.checked;
          try { await rpc("admin_kv_set", { p_key: "checklist", p_value: s }); draw(); }
          catch (e) { s[c.dataset.k] = prev; c.checked = prev; $("ck-msg").textContent = "Not saved: " + e.message; }
        };
      });
    }
    draw();
  }

  /* quietly show the open-reports count on the tab */
  setTimeout(function () { if (token()) rpc("admin_live").then(function (d) { if (d && !d.error) setBadge(d.reports_open); }).catch(function () {}); }, 2500);
})();
