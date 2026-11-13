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
    "#ops-panel .ops-f label{display:block;margin:8px 0;font-weight:700;font-size:14px}#ops-panel .ops-f input:not([type=checkbox]),#ops-panel .ops-f select{display:block;width:100%;margin-top:4px;padding:10px;border:1px solid #d6dbe0;border-radius:10px;font:16px system-ui;box-sizing:border-box}#ops-panel .ops-act{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}#ops-panel .ops-act .button,#ops-panel .ops-row>.button{width:auto;padding:9px 12px;font-size:14px}" +
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
  /* ---- live: new payments and campaigns show up the moment they happen ---- */
  (function rt() {
    if (!window.supabase || !window.supabase.createClient) return;
    var c, started = false;
    function note(t, b) {
      var el = $("ops-toast"); if (!el) { el = document.createElement("div"); el.id = "ops-toast"; el.setAttribute("role", "status"); el.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:9999;max-width:420px;margin:0 auto;background:#172b24;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.35 Arial,sans-serif;box-shadow:0 8px 28px #0005;display:none"; document.body.appendChild(el); }
      el.innerHTML = "<b>" + esc(t) + "</b><div>" + esc(b || "") + "</div>"; el.style.display = "block"; clearTimeout(el._t); el._t = setTimeout(function () { el.style.display = "none"; }, 7000);
    }
    function typing() { var a = document.activeElement; return a && panel.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); }
    function refresh(only) { if (isOpen() && only.indexOf(view) >= 0 && !typing() && !document.hidden) go(view); }
    function start() {
      if (started || !token()) return; started = true;
      try {
        c = window.supabase.createClient(base, cfg.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        c.realtime.setAuth(token());
        c.channel("sb-admin-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "money_payments" }, function (p) {
            var n = p.new || {}, o = p.old || {};
            if (n.status === "reported" && o.status !== "reported") note("Payment to confirm", money(n.amount_kobo) + " · ref " + n.reference);
            refresh(["payments", "revenue", "live"]);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "social_campaigns" }, function (p) { var n = p.new || {}; if (n.status === "paid" && (p.old || {}).status !== "paid") note("Social campaign paid", "Set it up and tap Start."); refresh(["social", "revenue"]); })
          .subscribe();
        setInterval(function () { try { c.realtime.setAuth(token()); } catch (e) {} }, 600000);
      } catch (e) {}
    }
    var n = 0, iv = setInterval(function () { start(); if (started || ++n > 120) clearInterval(iv); }, 3000);
  })();

  tab.addEventListener("click", show);
  document.addEventListener("click", function (e) { var t = e.target.closest("[data-tab],[data-go],[data-plustab]"); if (t && t !== tab && !tab.contains(t)) hide(); }, true);

  function nav() {
    return '<div class="ops-nav">' + [["live", "Live"], ["orders", "Orders"], ["users", "Users"], ["reports", "Reports"], ["promote", "Promote"], ["requests", "Requests"], ["revenue", "Revenue"], ["payments", "Payments"], ["pricing", "Pricing"], ["sellers", "Seller control"], ["photos", "Photo search"], ["ads", "Ads"], ["social", "Social"], ["reviews", "Reviews"], ["message", "Message"], ["plans", "Plans"], ["switches", "Switches"], ["health", "Health"], ["security", "Security"], ["errors", "Errors"], ["checklist", "Checklist"], ["adcentre", "Ad Centre"], ["cards", "Cards"], ["cleanup", "Clean-up"], ["audit", "Audit"]].map(function (v) {
      return '<button type="button" data-v="' + v[0] + '" class="' + (view === v[0] ? "on" : "") + '">' + v[1] + "</button>";
    }).join("") + "</div>";
  }
  panel.addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (b) go(b.dataset.v); });
  function body(html) { panel.innerHTML = nav() + '<div id="ops-body">' + html + "</div>"; }
  function fail(e) {
    var m = String(e && e.message || e);
    var missing = /could not find the function|does not exist|schema cache|404/i.test(m);
    return '<div class="ops-row"><b class="ops-bad">' + (missing ? "Setup needed" : "Could not load") + "</b><p>" + (missing ? "Run admin_ops.sql once in Supabase (SQL editor), then open this tab again. If you already did, run reload_api.sql, then refresh this page.<br><small class=\"muted\">Technical detail: " + esc(m) + "</small>" : esc(m)) + "</p></div>";
  }

  var seq = 0;
  function go(v) {
    view = v; clearInterval(timer); timer = null; var my = ++seq;
    body('<p class="muted">Loading…</p>');
    ({ live: pLive, orders: pOrders, users: pUsers, security: pSecurity, errors: pErrors, promote: pPromote, requests: pRequests, revenue: pRevenue, payments: pPayments, pricing: pPricing, sellers: pSellers, photos: pPhotos, ads: pAds, social: pSocial, reviews: pReviews, message: pMessage, audit: pAudit, reports: pReports, plans: pPlans, switches: pSwitches, health: pHealth, checklist: pChecklist, cleanup: pCleanup, adcentre: pAdCentre, cards: pCards })[v](my);
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
          ((d.warnings && d.warnings.length) ? '<div class="ops-row"><b class="ops-warn">Some numbers could not be read</b><p class="muted">' + d.warnings.map(esc).join("<br>") + "</p></div>" : "") +
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

  /* ---- Requests: seller promotion / boost / advert requests + invite reward settings ---- */
  async function pRequests(my) {
    var rows, ref = null;
    try { rows = await rpc("admin_promos", { p_status: "pending" }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "growth2.sql")); return; }
    try { var rs = await rpc("admin_promos", { p_status: "approved" }); window.__opsApproved = rs; } catch (e) { window.__opsApproved = []; }
    var ga = null; try { ga = await rpc("admin_growth_auto"); } catch (e) { ga = null; }
    if (stale(my)) return;
    rows = rows || [];
    var kindName = { product: "Promote product", shop: "Boost shop", ad: "Advertise business" };
    body('<h3>Waiting for you (' + rows.length + ')</h3>' + (rows.length ? rows.map(function (r) {
      return '<div class="ops-row" data-id="' + esc(r.id) + '"><b>' + esc(kindName[r.kind] || r.kind) + "</b> · " + esc(r.shop || "") + (r.product ? "<br>Product: " + esc(r.product) : "") +
        (r.business ? "<br>Business: " + esc(r.business) : "") + (r.phone ? "<br>Phone: " + esc(r.phone) : "") + (r.note ? "<br><i>" + esc(r.note) + "</i>" : "") +
        '<br><span class="muted">Asked for ' + r.days + " days · " + new Date(r.created_at).toLocaleDateString("en-NG") + "</span>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input type="text" class="rq-days" inputmode="numeric" value="' + r.days + '" style="width:70px;padding:8px;border:1px solid #cfd5da;border-radius:8px" aria-label="Days">' +
        '<input type="text" class="rq-note" maxlength="200" placeholder="Note to seller (optional)" style="flex:1;min-width:140px;padding:8px;border:1px solid #cfd5da;border-radius:8px">' +
        '<button class="button" data-ok="1">Approve</button><button class="button outline" data-ok="0">Decline</button></div></div>';
    }).join("") : '<p class="muted">Nothing waiting. New requests show here.</p>') +
      '<h3>Running now</h3>' + ((window.__opsApproved || []).filter(function (r) { return r.ends_at && new Date(r.ends_at) > new Date(); }).map(function (r) {
        return '<div class="ops-row"><b>' + esc(kindName[r.kind] || r.kind) + "</b> · " + esc(r.shop || "") + (r.product ? " · " + esc(r.product) : "") + '<br><span class="muted">Ends ' + new Date(r.ends_at).toLocaleDateString("en-NG") + "</span></div>";
      }).join("") || '<p class="muted">No promotions running.</p>') +
      '<h3>Invite rewards</h3><form id="rf-form" class="ops-row"><label><input type="checkbox" id="rf-on" checked><span>Reward sellers who invite other sellers</span></label>' +
      '<input type="text" id="rf-days" inputmode="numeric" value="30" aria-label="Free badge days per approved invite" placeholder="Free badge days per approved invite" style="width:100%;margin-top:8px;padding:8px;border:1px solid #cfd5da;border-radius:8px">' +
      '<input type="text" id="rf-max" inputmode="numeric" value="20" aria-label="Most rewards per seller" placeholder="Most rewards per seller" style="width:100%;margin-top:8px;padding:8px;border:1px solid #cfd5da;border-radius:8px">' +
      '<button class="button full" type="submit" style="margin-top:8px">Save reward settings</button><p id="rf-msg" class="muted"></p></form>' +
      '<h3>Automatic growth</h3>' + (ga ? '<form id="ga-form" class="ops-row"><label><input type="checkbox" id="ga-on"' + (ga.enabled !== false ? " checked" : "") + '><span>Run daily: boost new shops, remind empty shops, send weekly results<br><small class="muted">' + (ga.sent_30d || 0) + ' messages sent in the last 30 days</small></span></label>' +
        '<input type="text" id="ga-days" inputmode="numeric" value="' + (ga.welcome_days || 7) + '" aria-label="Days a new shop stays featured" placeholder="Days a new shop stays featured" style="width:100%;margin-top:8px;padding:8px;border:1px solid #cfd5da;border-radius:8px">' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="button" type="submit" style="flex:1">Save</button><button class="button outline" type="button" id="ga-run" style="flex:1">Run now</button></div><p id="ga-msg" class="muted"></p></form>' : '<div class="ops-row"><b class="ops-bad">Setup needed</b><p>Run growth3.sql once in Supabase, then open this tab again.</p></div>') + '<p id="rq-msg" class="muted"></p>');
    panel.querySelectorAll("[data-ok]").forEach(function (b) {
      b.onclick = async function () {
        var row = b.closest(".ops-row"), ok = b.dataset.ok === "1", d = Number(row.querySelector(".rq-days").value);
        if (!window.confirm((ok ? "Approve" : "Decline") + " this request?")) return;
        b.disabled = true;
        try { await rpc("admin_decide_promo", { p_id: row.dataset.id, p_approve: ok, p_days: d >= 1 ? d : null, p_note: row.querySelector(".rq-note").value || null }); pRequests(my); }
        catch (er) { b.disabled = false; $("rq-msg").textContent = "Failed: " + er.message; }
      };
    });
    if ($("ga-form")) {
      $("ga-form").onsubmit = async function (e) {
        e.preventDefault(); var m = $("ga-msg");
        try { await rpc("admin_set_growth_auto", { p_enabled: $("ga-on").checked, p_days: Number($("ga-days").value) || 7 }); m.className = "ops-ok"; m.textContent = "Saved."; }
        catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
      };
      $("ga-run").onclick = async function () {
        var m = $("ga-msg"); this.disabled = true; m.className = "muted"; m.textContent = "Running…";
        try { var r = await rpc("admin_run_growth"); m.className = "ops-ok"; m.textContent = r && r.enabled === false ? "It is switched off. Turn it on and save first." : "Done. New shops boosted: " + (r.boosted || 0) + " · empty-shop reminders: " + (r.first_product || 0) + " · weekly results sent: " + (r.weekly || 0); }
        catch (er) { m.className = "ops-bad"; m.textContent = "Failed: " + er.message; }
        this.disabled = false;
      };
    }
    $("rf-form").onsubmit = async function (e) {
      e.preventDefault(); var m = $("rf-msg");
      try { await rpc("admin_set_referral", { p_enabled: $("rf-on").checked, p_days: Number($("rf-days").value), p_max: Number($("rf-max").value) }); m.className = "ops-ok"; m.textContent = "Saved."; }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
    };
  }


  /* ---- Money: revenue, payments to confirm, pricing and bank details, banner ads ---- */
  var KINDS = { promo: "Promotion", ad: "Banner advert", commission: "Sales fees", subscription: "Badge plan", protection: "Buyer protection fees", social: "Social media marketing" };
  function waLink(p) { var d = String(p || "").replace(/\D/g, ""); if (!d) return ""; d = d.indexOf("234") === 0 ? d : d.charAt(0) === "0" ? "234" + d.slice(1) : d.length === 10 ? "234" + d : d; return ' · <a href="https://wa.me/' + d + '" target="_blank" rel="noopener">WhatsApp</a>'; }
  function setupMsg(e) { return fail(e).replace("admin_ops.sql", "money.sql"); }

  async function pRevenue(my) {
    var d; try { d = await rpc("admin_revenue"); } catch (e) { if (!stale(my)) body(setupMsg(e)); return; }
    if (stale(my)) return;
    var S = d.streams || {}, per = ["today", "d7", "d30", "all"], names = ["Today", "Last 7 days", "Last 30 days", "All time"], tot = {};
    per.forEach(function (k) { tot[k] = Object.keys(S).reduce(function (a, s) { return a + Number((S[s] || {})[k] || 0); }, 0); });
    var comm30 = Number(((S.commission || {}).d30) || 0), gmv = Number(d.gmv_30d_kobo || 0);
    body((d.warnings && d.warnings.length ? '<div class="ops-row"><b class="ops-warn">Some numbers could not be read</b><p class="muted">' + d.warnings.map(esc).join("<br>") + "</p></div>" : "") +
      '<div class="ops-grid">' + per.map(function (k, i) { return card(money(tot[k]), names[i] + " income"); }).join("") + "</div>" +
      '<div class="ops-row"><b>14-day income</b>' + spark(d.series) + "</div>" +
      '<div class="ops-row"><b>Where the money comes from</b>' + Object.keys(S).map(function (k) {
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #eef1f3"><span>' + esc(KINDS[k] || k) + '</span><span><b>' + money(S[k].d30) + '</b> <span class="muted">30d · ' + money(S[k].all) + " all</span></span></div>";
      }).join("") + "</div>" +
      '<div class="ops-grid">' + card(money(d.mrr_kobo), "Monthly badge income (" + (d.active_subscribers || 0) + " subscribers)") + card(money(gmv), "Sales through SafeBuy, 30 days") +
        card(money(d.fees_owed_kobo), "Sales fees sellers owe you") + card(money(d.awaiting_kobo), "Invoices waiting to be paid") + "</div>" +
      (d.reported_count ? '<div class="ops-row"><b class="ops-warn">' + d.reported_count + " payment" + (d.reported_count == 1 ? "" : "s") + " (" + money(d.reported_kobo) + ') waiting for you to confirm</b><p><button class="button" type="button" data-v="payments">Open Payments</button></p></div>' : "") +
      '<p class="muted">Income counts money you confirmed here, badge plans, and buyer protection fees. Delivery margin is not included. Sales fees count when the seller pays them' + (gmv ? "; your fee rate on sales over 30 days: " + (Math.round(comm30 / gmv * 1000) / 10) + "%" : "") + ".</p>");
  }

  async function pPayments(my) {
    var rep, aw, ok; try { rep = await rpc("admin_payments", { p_status: "reported" }); aw = await rpc("admin_payments", { p_status: "awaiting" }); ok = await rpc("admin_payments", { p_status: "confirmed" }); } catch (e) { if (!stale(my)) body(setupMsg(e)); return; }
    if (stale(my)) return;
    function row(x, act) {
      var det = x.ad ? "<br>Advert: <b>" + esc(x.ad.title) + "</b>" + (x.ad.body ? " · " + esc(x.ad.body) : "") + (x.ad.link ? "<br>Link: " + esc(x.ad.link) : "") + "<br>" + esc(x.ad.slot) + " · " + x.ad.days + " days" : "";
      det += x.promo ? "<br>" + (x.promo.kind === "shop" ? "Boost shop" : "Promote: " + esc(x.promo.product || "")) + " · " + x.promo.days + " days" : "";
      det += x.kind === "subscription" && x.meta ? "<br>Plan: " + esc(x.meta.plan) : "";
      return '<div class="ops-row" data-id="' + esc(x.id) + '"><b>' + esc(KINDS[x.kind] || x.kind) + " · " + money(x.amount_kobo) + "</b> <span class=\"muted\">ref " + esc(x.reference) + "</span><br>" + esc(x.payer || "") + (x.phone ? " · " + esc(x.phone) + waLink(x.phone) : "") +
        (x.payer_note ? '<br><i>Sender: ' + esc(x.payer_note) + "</i>" : "") + det + '<br><span class="muted">' + new Date(x.reported_at || x.created_at).toLocaleString("en-NG") + "</span>" +
        (act === "refund" ? '<div style="margin-top:8px"><button class="button outline" data-refund="1">Refund</button></div>' : "") + (act === true ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input type="text" class="py-note" maxlength="150" placeholder="Note (optional)" style="flex:1;min-width:130px;padding:8px;border:1px solid #cfd5da;border-radius:8px"><button class="button" data-pay="1">Confirm received</button><button class="button outline" data-pay="0">Reject</button></div>' : "") + "</div>";
    }
    body('<h3>Tell us you received the money (' + rep.length + ')</h3><p class="muted">Check your bank app for the amount and the reference, then tap Confirm. Confirming starts the promotion or advert, or marks the fees or plan paid.</p>' + (rep.length ? rep.map(function (x) { return row(x, true); }).join("") : '<p class="muted">Nothing waiting.</p>') +
      "<h3>Invoices not paid yet (" + aw.length + ")</h3>" + (aw.length ? aw.map(function (x) { return row(x, true); }).join("") : '<p class="muted">None.</p>') +
      "<h3>Recently confirmed</h3>" + (ok.slice(0, 10).map(function (x) { return row(x, "refund"); }).join("") || '<p class="muted">None yet.</p>') + '<p id="py-msg" class="muted"></p>');
    panel.querySelectorAll("[data-refund]").forEach(function (b) {
      b.onclick = async function () {
        var r = b.closest(".ops-row"), why = window.prompt("Why are you refunding " + r.querySelector("b").textContent + "? The seller will see this. Send the money back to them yourself."); if (why === null) return; b.disabled = true;
        try { await rpc("admin_refund_payment", { p_id: r.dataset.id, p_note: why }); pPayments(my); } catch (er) { b.disabled = false; $("py-msg").className = "ops-bad"; $("py-msg").textContent = "Failed: " + er.message; }
      };
    });
    panel.querySelectorAll("[data-pay]").forEach(function (b) {
      b.onclick = async function () {
        var r = b.closest(".ops-row"), yes = b.dataset.pay === "1", amt = r.querySelector("b").textContent;
        if (!window.confirm((yes ? "Confirm you received " : "Reject ") + amt + "?")) return; b.disabled = true;
        try { await rpc(yes ? "admin_confirm_payment" : "admin_reject_payment", { p_id: r.dataset.id, p_note: r.querySelector(".py-note").value || null }); pPayments(my); }
        catch (er) { b.disabled = false; $("py-msg").className = "ops-bad"; $("py-msg").textContent = "Failed: " + er.message; }
      };
    });
  }

  async function pPricing(my) {
    var d; try { d = await rpc("admin_get_prices"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "control.sql")); return; }
    if (stale(my)) return;
    var P = d.pricing || {}, C = P.commission || {}, B = d.bank || {}, A = P.ad_day_kobo || {}, PL = d.plans || {}, S = d.social || {}, R = d.referral || {}, nv = function (k) { return Math.round(Number(k || 0) / 100); };
    function f(id, label, val, hint) { return '<label style="display:block;margin-top:10px;font-weight:700;font-size:13px" for="' + id + '">' + esc(label) + '</label><input type="text" id="' + id + '" value="' + esc(val == null ? "" : val) + '" ' + (hint ? 'placeholder="' + esc(hint) + '" ' : "") + 'inputmode="decimal" style="width:100%;padding:9px;border:1px solid #cfd5da;border-radius:8px">'; }
    function ck(id, label, on) { return '<label style="display:flex;gap:9px;align-items:center;margin-top:10px"><input type="checkbox" id="' + id + '" style="width:auto"' + (on ? " checked" : "") + "><span>" + esc(label) + "</span></label>"; }
    function sec(t, hint, inner) { return '<div class="ops-row"><b>' + esc(t) + "</b>" + (hint ? '<p class="muted" style="margin:4px 0 0">' + hint + "</p>" : "") + inner + "</div>"; }
    body('<p class="muted">Every price and rate in the system is here. All amounts are in naira. Press Save once at the bottom: it saves everything together and records the change in the Audit log. New prices apply to new orders and requests. Delivery fees are in the Delivery tab.</p>' +
      sec("Your bank account", "Sellers and advertisers pay into this account.", f("pr-bank", "Bank name", B.bank_name) + f("pr-acct", "Account number", B.account_number) + f("pr-aname", "Account name", B.account_name) + f("pr-bnote", "Note shown to payers (optional)", B.note, "e.g. Payments confirmed within 3 hours")) +
      sec("Promotions", "Charged when a seller promotes a product or boosts their shop.", ck("pr-charge", "Charge for Promote and Boost (off = free, you approve each one)", P.charge_promos !== false) + f("pr-prom", "Promote one product, per day (₦)", nv(P.promote_day_kobo)) + f("pr-boost", "Boost a whole shop, per day (₦)", nv(P.boost_day_kobo))) +
      sec("Banner adverts", "Per day, for sellers and outside businesses.", f("pr-top", "Top of the home page, per day (₦)", nv(A.home_top)) + f("pr-mid", "Middle of the home page, per day (₦)", nv(A.home_mid))) +
      sec("Fee on completed sales", "Applies only to orders marked paid after you switch it on.", ck("pr-comm", "Charge sellers a fee on sales", C.enabled) + f("pr-std", "Shops without the Verified badge (%)", C.standard_pct) + f("pr-ver", "Verified shops (%)", C.verified_pct) + f("pr-min", "Sellers can pay once fees reach (₦)", nv(C.min_invoice_kobo)) + f("pr-max", "Most you charge on one order (₦, 0 = no limit)", nv(C.max_per_order_kobo))) +
      sec("Verified badge plans", "What sellers pay to keep the Verified badge.", ck("pr-req", "The badge needs a paid plan (off = badge is free)", PL.required) + f("pr-mo", "Monthly price (₦)", nv(PL.monthly_kobo)) + f("pr-yr", "12 months price (₦)", nv(PL.yearly_kobo))) +
      sec("Social media marketing", "Facebook, Instagram and TikTok tools and managed campaigns.", ck("pr-son", "Sellers can order campaigns", S.enabled !== false) + f("pr-spass", "Social Pass price (₦)", nv(S.pass_kobo)) + f("pr-spd", "Social Pass lasts (days)", S.pass_days || 30) + f("pr-sfree", "Free scheduled posts per seller", S.free_scheduled) + f("pr-spct", "Management fee (% of ad budget)", S.fee_pct) + f("pr-smin", "Smallest management fee (₦)", nv(S.fee_min_kobo)) + f("pr-sbud", "Smallest ad budget (₦)", nv(S.min_budget_kobo))) +
      sec("Invite and earn", "Free Verified-badge days a seller earns for each shop they invite that gets approved.", ck("pr-ren", "Invite and earn is on", R.enabled !== false) + f("pr-rdays", "Free days per approved invite", R.reward_days) + f("pr-rmax", "Most rewards one seller can earn", R.max_rewards)) +
      '<button class="button full" id="pr-save" type="button">Save all prices and settings</button><p id="pr-msg" class="muted" role="status"></p>' +
      '<p class="muted">Need a different price for one seller? Open Seller control: you can give any seller their own fee rate, a discount, free promotions, or free badge days.</p>');
    $("pr-save").onclick = async function () {
      var m = $("pr-msg"), num = function (id) { var v = Number(String($(id).value).replace(/[^0-9.]/g, "")); return isFinite(v) ? v : 0; }, k = function (id) { return Math.round(num(id) * 100); };
      var pricing = { charge_promos: $("pr-charge").checked, promote_day_kobo: k("pr-prom"), boost_day_kobo: k("pr-boost"), ad_day_kobo: { home_top: k("pr-top"), home_mid: k("pr-mid") },
        commission: { enabled: $("pr-comm").checked, standard_pct: num("pr-std"), verified_pct: num("pr-ver"), min_invoice_kobo: k("pr-min"), max_per_order_kobo: k("pr-max") } };
      var bank = { bank_name: $("pr-bank").value, account_number: $("pr-acct").value, account_name: $("pr-aname").value, note: $("pr-bnote").value };
      var plans = { required: $("pr-req").checked, monthly_kobo: k("pr-mo"), yearly_kobo: k("pr-yr") };
      var social = { enabled: $("pr-son").checked, pass_kobo: k("pr-spass"), pass_days: Math.max(1, Math.round(num("pr-spd"))), free_scheduled: Math.round(num("pr-sfree")), fee_pct: num("pr-spct"), fee_min_kobo: k("pr-smin"), min_budget_kobo: k("pr-sbud") };
      var referral = { enabled: $("pr-ren").checked, reward_days: Math.round(num("pr-rdays")), max_rewards: Math.round(num("pr-rmax")) };
      var warn = [];
      if (pricing.commission.enabled && !C.enabled) warn.push("charge sellers " + pricing.commission.standard_pct + "% (" + pricing.commission.verified_pct + "% for Verified shops) on new sales");
      if (plans.required && !PL.required) warn.push("require a paid plan for the Verified badge");
      if (warn.length && !window.confirm("You are about to " + warn.join(" and ") + ". Sellers should be told first. Continue?")) return;
      m.className = "muted"; m.textContent = "Saving…"; $("pr-save").disabled = true;
      try { await rpc("admin_set_prices", { p_pricing: pricing, p_bank: bank, p_plans: plans, p_social: social, p_referral: referral }); m.className = "ops-ok"; m.textContent = "Saved. Everything is updated."; }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
      $("pr-save").disabled = false;
    };
  }

  /* ---- Seller control: special terms, free badge, fees and refunds for any one seller ---- */
  async function pSellers(my) {
    body('<div class="ops-row"><b>Find a seller</b><div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="sc-q" placeholder="Shop name or phone" maxlength="60" style="flex:1;padding:10px;border:1px solid #cfd5da;border-radius:8px"><button class="button" id="sc-go" type="button">Search</button></div></div><div id="sc-list"></div><div id="sc-one"></div>');
    function when(s) { try { return new Date(s).toLocaleDateString("en-NG"); } catch (e) { return ""; } }
    async function search() {
      var box = $("sc-list"); box.innerHTML = '<p class="muted">Searching…</p>';
      var rows; try { rows = await rpc("admin_find_sellers", { p_q: $("sc-q").value }); } catch (e) { box.innerHTML = fail(e).replace("admin_ops.sql", "control.sql"); return; }
      box.innerHTML = rows.length ? rows.map(function (x) {
        var o = x.override || {}, sp = [];
        if (o.commission_pct != null) sp.push("fee " + o.commission_pct + "%"); if (Number(o.discount_pct) > 0) sp.push(o.discount_pct + "% off"); if (o.free_promos) sp.push("free promotions");
        return '<div class="ops-row"><b>' + esc(x.shop || "Shop") + '</b> <span class="muted">' + esc(x.status || "") + "</span><br>" + esc(x.phone || "") + waLink(x.phone) + "<br>" + x.products + " products · paid to you " + money(x.paid_kobo) + " · owes fees " + money(x.owed_kobo) +
          (x.badge_until ? "<br>Badge until " + when(x.badge_until) : "") + (x.pass_until ? "<br>Social Pass until " + when(x.pass_until) : "") + (sp.length ? '<br><b class="ops-warn">Special terms: ' + sp.join(", ") + "</b>" : "") + '<div style="margin-top:8px"><button class="button" data-open="' + esc(x.id) + '">Manage</button></div></div>';
      }).join("") : '<p class="muted">No shops found.</p>';
      box.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { one(rows.filter(function (r) { return r.id === b.dataset.open; })[0]); }; });
    }
    async function one(x) {
      var o = x.override || {}, pays = []; try { pays = await rpc("admin_seller_payments", { p_app: x.id }); } catch (e) {}
      var inp = function (id, label, val, ph) { return '<label style="display:block;margin-top:10px;font-weight:700;font-size:13px" for="' + id + '">' + esc(label) + '</label><input type="text" id="' + id + '" value="' + esc(val == null ? "" : val) + '" placeholder="' + esc(ph || "") + '" inputmode="decimal" style="width:100%;padding:9px;border:1px solid #cfd5da;border-radius:8px">'; };
      $("sc-one").innerHTML = '<div class="ops-row" style="border:2px solid #087f5b"><b>' + esc(x.shop) + '</b> <button class="button outline" id="sc-close" type="button" style="float:right">Close</button>' +
        '<h3 style="margin:14px 0 0">Special terms</h3><p class="muted">Leave a box empty to use the normal price list.</p>' + inp("so-fee", "Their own sales fee rate (%) (0 = no fee)", o.commission_pct, "normal rate") + inp("so-disc", "Discount on promotions, adverts, plans and social fees (%)", Number(o.discount_pct) || "", "0") +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:10px"><input type="checkbox" id="so-free" style="width:auto"' + (o.free_promos ? " checked" : "") + '><span>Promote and Boost are free for this seller</span></label>' + inp("so-note", "Private note", o.note, "e.g. Partner shop") +
        '<button class="button full" id="so-save" type="button" style="margin-top:10px">Save special terms</button>' +
        '<h3 style="margin:16px 0 0">Give or remove</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><input type="text" id="gr-days" value="30" inputmode="numeric" style="width:80px;padding:9px;border:1px solid #cfd5da;border-radius:8px"><span style="align-self:center">days</span>' +
        '<button class="button" data-gr="badge:1">Give Verified badge days</button><button class="button outline" data-gr="badge:0">Remove badge</button><button class="button" data-gr="social_pass:1">Give Social Pass days</button><button class="button outline" data-gr="social_pass:0">Remove Social Pass</button></div>' +
        '<h3 style="margin:16px 0 0">Fees owed: ' + money(x.owed_kobo) + '</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="button" data-fee="collect">I collected it in cash</button><button class="button outline" data-fee="waive">Waive it</button></div>' +
        '<h3 style="margin:16px 0 0">Recent payments</h3>' + (pays.length ? pays.map(function (p) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #eef1f3"><span>' + esc(KINDS[p.kind] || p.kind) + " · " + money(p.amount_kobo) + '<br><span class="muted">' + esc(p.status) + " · " + esc(p.reference) + "</span></span>" + (p.status === "confirmed" ? '<button class="button outline" data-refund="' + esc(p.id) + '" style="align-self:center">Refund</button>' : "") + "</div>"; }).join("") : '<p class="muted">No payments yet.</p>') +
        '<p id="sc-msg" class="muted" role="status"></p></div>';
      var msg = function (t, ok) { $("sc-msg").className = ok ? "ops-ok" : "ops-bad"; $("sc-msg").textContent = t; };
      var root = $("sc-one"), num = function (id) { var v = String($(id).value).replace(/[^0-9.]/g, ""); return v === "" ? null : Number(v); };
      $("sc-close").onclick = function () { root.innerHTML = ""; };
      $("so-save").onclick = async function () { try { await rpc("admin_seller_terms", { p_app: x.id, p_commission_pct: num("so-fee"), p_discount_pct: num("so-disc") || 0, p_free_promos: $("so-free").checked, p_note: $("so-note").value }); msg("Saved.", true); search(); } catch (e) { msg("Not saved: " + e.message, false); } };
      root.querySelectorAll("[data-gr]").forEach(function (b) { b.onclick = async function () { var p = b.dataset.gr.split(":"), days = p[1] === "1" ? Math.round(num("gr-days") || 0) : 0; if (p[1] === "1" && days < 1) { msg("Enter how many days.", false); return; } if (!window.confirm((p[1] === "1" ? "Give " + days + " days?" : "Remove it now?"))) return; try { await rpc("admin_grant", { p_app: x.id, p_what: p[0], p_days: days }); msg("Done.", true); search(); } catch (e) { msg("Failed: " + e.message, false); } }; });
      root.querySelectorAll("[data-fee]").forEach(function (b) { b.onclick = async function () { var w = b.dataset.fee === "collect"; if (!window.confirm(w ? "Record that you received " + money(x.owed_kobo) + " in cash?" : "Waive " + money(x.owed_kobo) + " in fees? The seller will not pay it.")) return; try { var r = await rpc(w ? "admin_collect_fees" : "admin_waive_fees", { p_app: x.id, p_note: null }); msg("Done. " + money(r.amount_kobo) + " cleared.", true); search(); } catch (e) { msg(e.message, false); } }; });
      root.querySelectorAll("[data-refund]").forEach(function (b) { b.onclick = async function () { var why = window.prompt("Why are you refunding this? (the seller will see it). Send the money back to them yourself."); if (why === null) return; try { await rpc("admin_refund_payment", { p_id: b.dataset.refund, p_note: why }); msg("Refunded in the records.", true); one(x); } catch (e) { msg("Failed: " + e.message, false); } }; });
    }
    $("sc-go").onclick = search; $("sc-q").onkeydown = function (e) { if (e.key === "Enter") search(); };
    search();
  }

  async function pAds(my) {
    var rows; try { rows = await rpc("admin_ads"); } catch (e) { if (!stale(my)) body(setupMsg(e)); return; }
    if (stale(my)) return;
    var inp = function (id, ph, max) { return '<input type="text" id="' + id + '" placeholder="' + ph + '" maxlength="' + max + '" style="width:100%;padding:9px;margin-top:8px;border:1px solid #cfd5da;border-radius:8px">'; };
    body("<h3>Adverts (" + rows.length + ")</h3>" + (rows.length ? rows.map(function (x) {
      var ctr = x.impressions ? Math.round(x.clicks / x.impressions * 1000) / 10 : 0;
      return '<div class="ops-row"><b>' + esc(x.title) + "</b> · " + esc(x.advertiser) + ' <span class="muted">' + esc(x.slot) + "</span><br>" + esc(x.status) + (x.ends_at ? " · ends " + new Date(x.ends_at).toLocaleDateString("en-NG") : "") + " · " + (x.impressions || 0) + " views · " + (x.clicks || 0) + " clicks (" + ctr + "%)" +
        (x.status === "live" ? '<div style="margin-top:8px"><button class="button outline" data-stop="' + esc(x.id) + '">Stop this advert</button></div>' : "") + "</div>";
    }).join("") : '<p class="muted">No adverts yet.</p>') +
      '<h3>Put up an advert yourself (free, goes live now)</h3><form id="ad-form" class="ops-row"><select id="ad-slot" style="width:100%;padding:9px;border:1px solid #cfd5da;border-radius:8px"><option value="home_top">Top of the home page</option><option value="home_mid">Middle of the home page</option></select>' +
      inp("ad-days", "How many days (e.g. 7)", 3) + inp("ad-who", "Advertiser name", 80) + inp("ad-title", "Headline", 60) + inp("ad-body", "Text (optional)", 160) + inp("ad-btn", "Button words (optional)", 20) + inp("ad-link", "Button link, https:// (optional)", 250) + inp("ad-img", "Picture link, https:// (optional)", 250) +
      '<button class="button full" type="submit" style="margin-top:10px">Put it live</button><p id="ad-msg" class="muted"></p></form>');
    panel.querySelectorAll("[data-stop]").forEach(function (b) { b.onclick = async function () { if (!window.confirm("Stop this advert now?")) return; b.disabled = true; try { await rpc("admin_ad_stop", { p_id: b.dataset.stop }); pAds(my); } catch (e) { b.disabled = false; } }; });
    $("ad-form").onsubmit = async function (e) {
      e.preventDefault(); var m = $("ad-msg"); m.className = "muted"; m.textContent = "Saving…";
      try { await rpc("admin_create_ad", { p_slot: $("ad-slot").value, p_days: Number($("ad-days").value) || 7, p_advertiser: $("ad-who").value, p_title: $("ad-title").value, p_body: $("ad-body").value, p_button: $("ad-btn").value, p_link: $("ad-link").value, p_image: $("ad-img").value }); pAds(my); }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
    };
  }


  async function pSocial(my) {
    var d; try { d = await rpc("admin_social"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "social.sql")); return; }
    if (stale(my)) return;
    var P = d.pricing || {}, rows = d.rows || [], NM = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };
    function inp(id, ph, v) { return '<input type="text" id="' + id + '" placeholder="' + ph + '" value="' + esc(v == null ? "" : v) + '" style="width:100%;padding:8px;border:1px solid #cfd5da;border-radius:8px;margin-top:6px">'; }
    body('<div class="ops-row"><b>Social media campaigns</b><p class="muted">Paid ones appear first. Set one up on Facebook, Instagram or TikTok, tap Start, then add each day&#39;s numbers from the platform report. Sellers see them straight away.</p></div>' +
      (rows.length ? rows.map(function (x) {
        var link = x.product_id ? location.origin + location.pathname.replace(/[^/]*$/, "").replace(/(admin|seller|rider)\/$/, "") + "?p=" + x.product_id : "";
        return '<div class="ops-row" data-id="' + esc(x.id) + '"><b>' + esc(x.business || "Seller") + " · " + esc(x.product || "Whole shop") + "</b> <span class=\"muted\">" + esc(x.status) + "</span><br>" + (x.platforms || []).map(function (k) { return NM[k] || k; }).join(", ") + " · budget " + money(x.budget_kobo) + " · " + x.days + " days" +
          "<br>Goal: " + esc(x.objective || "-") + "<br>Audience: " + esc(x.audience || "-") + (x.caption ? "<br>Caption: " + esc(x.caption) : "") + (x.image ? '<br><a href="' + esc(x.image) + '" target="_blank" rel="noopener">Product picture</a>' : "") +
          "<br>Phone: " + esc(x.phone || "-") + waLink(x.phone) + (link ? '<br><span class="muted">Link to use: ' + esc(link) + "&amp;src=fb (or ig, tt)</span>" : "") +
          "<br>So far: reach " + (x.reach || 0) + " · clicks " + (x.clicks || 0) + " · spent " + money(x.spend_kobo) +
          (x.status === "paid" || x.status === "running" ? '<div style="margin-top:8px"><select class="so-plat" style="padding:8px;border-radius:8px">' + (x.platforms || []).map(function (k) { return '<option value="' + k + '">' + (NM[k] || k) + "</option>"; }).join("") + "</select>" +
            inp("sp" + x.id, "Spent today (₦)") + inp("rc" + x.id, "Reach") + inp("ck" + x.id, "Clicks") + inp("en" + x.id, "Messages / enquiries") + inp("pu" + x.id, "Orders") + inp("sl" + x.id, "Sales value (₦)") +
            '<button class="button" data-so="stats" style="margin-top:8px">Save today&#39;s numbers</button> ' + (x.status === "paid" ? '<button class="button" data-so="running">Start (it is live)</button> ' : "") + '<button class="button outline" data-so="finished">Finish</button> <button class="button outline" data-so="rejected">Cannot run it</button>' + "</div>" : "") + "</div>";
      }).join("") : '<p class="muted">No campaigns yet.</p>') +
      '<form id="sp-form" class="ops-row"><b>Prices</b><p class="muted">Money amounts in naira.</p>' + inp("sp-pass", "Social Pass price (₦)", Math.round((P.pass_kobo || 0) / 100)) + inp("sp-free", "Free scheduled posts", P.free_scheduled) + inp("sp-pct", "Management fee (% of ad budget)", P.fee_pct) + inp("sp-min", "Smallest management fee (₦)", Math.round((P.fee_min_kobo || 0) / 100)) + inp("sp-bud", "Smallest ad budget (₦)", Math.round((P.min_budget_kobo || 0) / 100)) +
      '<label style="display:block;margin-top:8px"><input type="checkbox" id="sp-on"' + (P.enabled !== false ? " checked" : "") + "> Sellers can order campaigns</label>" + '<button class="button full" type="submit" style="margin-top:8px">Save</button><p id="sp-msg" class="muted"></p></form>');
    panel.querySelectorAll("[data-so]").forEach(function (b) {
      b.onclick = async function () {
        var r = b.closest(".ops-row"), id = r.dataset.id, k = b.dataset.so, n = function (p) { return Math.round(Number(String(r.querySelector("#" + p + id).value).replace(/[^0-9.]/g, "")) || 0); };
        b.disabled = true;
        try {
          if (k === "stats") await rpc("admin_social_stats", { p_id: id, p_platform: r.querySelector(".so-plat").value, p_day: null, p_spend_kobo: n("sp") * 100, p_reach: n("rc"), p_clicks: n("ck"), p_enquiries: n("en"), p_purchases: n("pu"), p_sales_kobo: n("sl") * 100 });
          else { if (k === "rejected" && !window.confirm("Tell the seller it cannot run? Remember to refund their ad budget.")) { b.disabled = false; return; } await rpc("admin_social_set", { p_id: id, p_status: k, p_note: null }); }
          pSocial(my);
        } catch (er) { b.disabled = false; window.alert("Failed: " + er.message); }
      };
    });
    $("sp-form").onsubmit = async function (e) {
      e.preventDefault(); var m = $("sp-msg"), k = function (i) { return Math.round(Number(String($(i).value).replace(/[^0-9.]/g, "")) * 100); };
      try { await rpc("admin_set_social", { p_pricing: { enabled: $("sp-on").checked, pass_kobo: k("sp-pass"), free_scheduled: Math.round(k("sp-free") / 100), fee_pct: k("sp-pct") / 100, fee_min_kobo: k("sp-min"), min_budget_kobo: k("sp-bud") } }); m.className = "ops-ok"; m.textContent = "Saved."; }
      catch (er) { m.className = "ops-bad"; m.textContent = "Not saved: " + er.message; }
    };
  }


  /* ---- Photo search: prepare every product photo so buyers can search with a picture ---- */
  function loadVision() {
    if (window.sbVision) return Promise.resolve(window.sbVision);
    return new Promise(function (ok, bad) { var sc = document.createElement("script"); sc.src = "./visual-search.js?v=1"; sc.onload = function () { window.sbVision ? ok(window.sbVision) : bad(new Error("visual-search.js is old. Upload the newest one.")); }; sc.onerror = function () { bad(new Error("visual-search.js was not found. Upload it to the main folder.")); }; document.head.appendChild(sc); });
  }
  async function pPhotos(my) {
    var V; try { V = await loadVision(); } catch (e) { if (!stale(my)) body('<div class="ops-row"><b class="ops-bad">' + esc(e.message) + "</b></div>"); return; }
    var d; try { d = await rpc("admin_missing_vectors", { p_model: V.tag, p_limit: 30 }); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "visual.sql")); return; }
    if (stale(my)) return;
    var left = Number(d.total) - Number(d.indexed);
    body('<div class="ops-row"><b>Search by photo</b><p class="muted">Buyers can tap the camera button on the home page, take or choose a photo, and see the closest products. For that, every product photo needs a fingerprint. New photos from sellers are done automatically when the seller is on wifi; use this button to catch up or to do everything now.</p>' +
      '<div class="ops-grid">' + card(d.indexed, "photos ready") + card(left > 0 ? left : 0, "waiting") + "</div>" +
      (left > 0 ? '<button class="button full" id="ph-go" type="button">Prepare ' + left + " photo" + (left === 1 ? "" : "s") + ' now</button><p class="muted">The first time, your phone downloads about 15 MB. Keep this page open until it finishes.</p>' : '<p class="ops-ok">All product photos are ready. Buyers can search by photo.</p>') +
      '<p id="ph-msg" class="muted" role="status"></p></div>');
    var go = $("ph-go"); if (!go) return;
    go.onclick = async function () {
      go.disabled = true; var msg = $("ph-msg"), total = 0, fails = 0; msg.className = "muted"; msg.textContent = "Getting the photo tool ready…";
      try {
        for (var round = 0; round < 40; round++) {
          var r = await rpc("admin_missing_vectors", { p_model: V.tag, p_limit: 30 }), rows = (r.rows || []).filter(function (x) { return !window.__phSkip || !window.__phSkip[x.id]; });
          if (!rows.length) break;
          var out = await V.indexMissing({ list: function () { return Promise.resolve(rows); }, save: function (id, vec, src) { return rpc("admin_save_product_vector", { p_product: id, p_vec: vec, p_model: V.tag, p_src: src }); },
            progress: function (i, n, ok, bad) { msg.textContent = "Preparing photos… " + (total + i) + " done" + (fails + bad ? " (" + (fails + bad) + " could not be read)" : ""); } });
          total += out.done; fails += out.failed;
          if (out.done === 0) { window.__phSkip = window.__phSkip || {}; rows.forEach(function (x) { window.__phSkip[x.id] = 1; }); }
        }
        msg.className = "ops-ok"; msg.textContent = "Done. " + total + " photo" + (total === 1 ? "" : "s") + " ready." + (fails ? " " + fails + " could not be read (the photo may be blocked or deleted)." : "");
      } catch (e) { msg.className = "ops-bad"; msg.textContent = "Stopped: " + e.message; }
      go.disabled = false; setTimeout(function () { if (!stale(my)) pPhotos(my); }, 1500);
    };
  }

  /* ---- Clean-up: admin chooses what to clear. Backs up first; needs a typed confirm word. ---- */
  async function pCleanup(my) {
    var d; try { d = await rpc("admin_cleanup_counts"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "cleanup.sql")); return; }
    if (stale(my)) return;
    var G = [["orders", "Orders and deliveries", "All orders, delivery jobs, order history and ratings."], ["payments", "Payments, ads and promotions", "Payment records, adverts, featured products and promotion requests."],
      ["social", "Social media campaigns", "Campaigns, posts, results and connected accounts."], ["activity", "Activity and logs", "Views, clicks, notifications, error records, reports and referral records."],
      ["products", "Products (and photo fingerprints)", "Every product listing. Clear Orders first if products are linked to orders."], ["sellers", "Seller shops", "Seller applications and subscriptions. Clear Products first. Login accounts are kept."],
      ["riders", "Riders", "Rider profiles. Login accounts are kept."]];
    body('<div class="ops-row"><b>Clean-up</b><p class="muted">Choose exactly what to clear before real customers start. Each clean-up saves a backup copy first, asks you to type a confirm word, and is written to the Audit log. Admin accounts, prices, settings and everyone\'s login are never deleted.</p></div>' +
      G.map(function (g) { var x = d[g[0]] || { total: 0, tables: {} }; var det = Object.keys(x.tables).filter(function (k) { return x.tables[k] > 0; }).map(function (k) { return esc(k.replace(/_/g, " ")) + " " + x.tables[k]; }).join(" · ");
        return '<div class="ops-row"><b>' + esc(g[1]) + ' <span class="muted">(' + x.total + ' records)</span></b><p class="muted">' + esc(g[2]) + (det ? "<br>" + det : "") + "</p>" +
          (x.total > 0 ? '<button class="button full" type="button" data-g="' + g[0] + '">Clear ' + esc(g[1].toLowerCase()) + "</button>" : '<p class="ops-ok">Already empty.</p>') + "</div>"; }).join("") + '<p id="cu-msg" role="status" class="muted"></p>');
    var btns = panel.querySelectorAll("[data-g]");
    Array.prototype.forEach.call(btns, function (b) { b.onclick = async function () {
      var g = b.getAttribute("data-g"), word = "DELETE " + g.toUpperCase();
      var t = window.prompt("This will clear: " + b.textContent.replace("Clear ", "") + ".\nA backup is saved first.\n\nType " + word + " to confirm:");
      if (t === null) return; var msg = $("cu-msg"); msg.className = "muted"; msg.textContent = "Clearing…"; b.disabled = true;
      try { var r = await rpc("admin_cleanup", { p_group: g, p_confirm: t }); var sk = Object.keys(r.skipped || {});
        msg.className = sk.length ? "ops-bad" : "ops-ok"; msg.textContent = "Cleared: " + (Object.keys(r.cleared).map(function (k) { return k.replace(/_/g, " ") + " " + r.cleared[k]; }).join(", ") || "nothing") + (sk.length ? ". Not cleared (still linked): " + sk.join(", ") + ". Clear the related group first." : ".");
        setTimeout(function () { if (!stale(my)) pCleanup(my); }, 2500);
      } catch (e) { msg.className = "ops-bad"; msg.textContent = e.message; b.disabled = false; } }; });
  }


  /* ---- Cards: switch card payments and automatic renewals on/off ---- */
  async function pCards(my) {
    var d; try { d = await rpc("admin_autorenew"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "autorenew.sql")); return; }
    if (stale(my)) return;
    var NAMES = { badge: "Verified badge", promo: "Promotion", boost: "Shop boost", ad: "Banner advert", social_pass: "Social Pass" };
    body('<div class="ops-row"><b>Card payments and automatic renewal</b><p class="muted">When ON, sellers see a <b>Pay by card</b> button on every payment (Paystack) and can tick <b>Renew automatically</b>. Bank transfer keeps working. Turn this ON only after the Paystack server function is deployed and tested with a small real payment.</p>' +
      '<p>Status: <b class="' + (d.enabled ? "ops-ok" : "ops-bad") + '">' + (d.enabled ? "ON" : "OFF") + '</b></p><button class="button full" type="button" id="cd-t">' + (d.enabled ? "Turn card payments OFF" : "Turn card payments ON") + '</button><p id="cd-m" class="muted" role="status"></p></div>' +
      '<div class="ops-grid">' + card(d.cards, "saved cards") + card(d.active, "active renewals") + card(d.past_due, "stopped (failed)") + "</div>" +
      (d.rows && d.rows.length ? d.rows.map(function (r) { return '<div class="ops-row"><b>' + esc(r.shop || "Seller") + " · " + esc(NAMES[r.tool] || r.tool) + '</b><p class="muted">' + esc(r.status) + (r.next ? " · next charge " + when(r.next) : "") + (r.amount_kobo ? " · " + money(r.amount_kobo) : "") + (r.error ? " · " + esc(r.error) : "") + "</p></div>"; }).join("") : '<p class="muted">No automatic renewals yet.</p>'));
    $("cd-t").onclick = async function () {
      if (!d.enabled && !window.confirm("Turn card payments ON for all sellers? Make sure Paystack is set up and tested.")) return;
      try { await rpc("admin_set_cards", { p_enabled: !d.enabled }); pCards(my); } catch (e) { $("cd-m").className = "ops-bad"; $("cd-m").textContent = e.message; }
    };
  }

  /* ---- Ad Centre: Consolidation Advertising command centre ---- */
  var CH = ["site", "facebook", "instagram", "tiktok", "google"], CHN = { site: "SafeBuy site", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", google: "Google" };
  function nk(id) { var v = Number(($(id) || {}).value); return Math.round((isFinite(v) ? v : 0) * 100); }
  async function pAdCentre(my) {
    var d; try { d = await rpc("admin_consol_overview"); } catch (e) { if (!stale(my)) body(fail(e).replace("admin_ops.sql", "consolidation.sql")); return; }
    var ap = true; try { ap = await rpc("admin_consol_autopilot_get"); } catch (e) { ap = null; }
    if (stale(my)) return;
    var h = '<div class="ops-grid">' + card(d.active, "active campaigns") + card(d.sellers, "participating sellers") + card(d.pending, "products awaiting approval") + card(money(d.net_kobo), "net advertising earnings") + "</div>" +
      '<div class="ops-row"><b>Automation: <span class="' + (d.auto ? "ops-ok" : "ops-bad") + '">' + (d.auto ? "ON" : "OFF") + '</span></b><p class="muted">When ON, SafeBuy creates the daily, weekly and monthly campaigns itself, opens registration, sends reminders, closes at the deadline and launches only campaigns that are paid, approved and funded. Times are West Africa Time.</p>' +
      '<button class="button full" type="button" id="ac-auto">' + (d.auto ? "Turn automation OFF" : "Turn automation ON") + '</button><button class="button full" type="button" id="ac-run" style="margin-top:8px">Run the scheduler now</button><p id="ac-m" class="muted" role="status"></p></div>' +
      (ap === null ? "" : '<div class="ops-row"><b>Autopilot launch: <span class="' + (ap ? "ops-ok" : "ops-bad") + '">' + (ap ? "ON" : "OFF") + '</span></b><p class="muted">When ON, a campaign launches the moment it is ready: enough sellers have paid, every product is reviewed, and the money collected covers the advertising budget. It starts right after you confirm a payment or approve products, without waiting for the launch time. A new campaign opens for the next sellers.</p><button class="button full" type="button" id="ac-ap">' + (ap ? "Turn autopilot OFF" : "Turn autopilot ON") + '</button></div>');
    h += '<div class="ops-row"><b>Campaign settings</b><p class="muted">Prices and limits used for every new campaign. Advertising spend is separate from SafeBuy earnings.</p></div>';
    (d.types || []).forEach(function (t) {
      h += '<div class="ops-row" data-type="' + t.code + '"><b>' + esc(t.name) + '</b><div class="ops-f">' +
        '<label>Fee per seller (₦)<input type="number" min="0" step="100" data-k="fee" value="' + (t.fee_kobo / 100) + '"></label>' +
        '<label>Minimum sellers<input type="number" min="1" data-k="min" value="' + t.min_sellers + '"></label><label>Maximum sellers<input type="number" min="1" data-k="max" value="' + t.max_sellers + '"></label>' +
        '<label>Products per seller<input type="number" min="1" data-k="per" value="' + t.products_per_seller + '"></label><label>Advertising budget (₦)<input type="number" min="0" step="100" data-k="budget" value="' + (t.budget_kobo / 100) + '"></label>' +
        '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="auto" style="width:22px;height:22px" ' + (t.auto_approve ? "checked" : "") + '> Approve products automatically</label>' +
        '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="on" style="width:22px;height:22px" ' + (t.enabled ? "checked" : "") + '> Create these campaigns</label>' +
        '<div>' + CH.map(function (c) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin-right:12px"><input type="checkbox" data-ch="' + c + '" style="width:20px;height:20px" ' + ((t.channels || []).indexOf(c) >= 0 ? "checked" : "") + '>' + CHN[c] + "</label>"; }).join("") + '</div></div>' +
        '<button class="button full" type="button" data-act="savetype" data-code="' + t.code + '">Save ' + esc(t.name) + "</button></div>";
    });
    h += '<div class="ops-row"><b>Campaigns</b><button class="button full" type="button" id="ac-new" style="margin:6px 0">+ New campaign</button><button class="button full" type="button" id="ac-csv">Export revenue and expenses (CSV)</button></div>';
    var SC = { draft: "Opens soon", open: "Registration open", closed: "Registration closed", running: "Running", paused: "Paused", completed: "Completed", cancelled: "Cancelled" };
    (d.campaigns || []).forEach(function (c) {
      var net = c.collected_kobo - c.ad_spend_kobo - c.creative_kobo - c.ops_kobo - c.fees_kobo;
      h += '<div class="ops-row" data-c="' + c.id + '"><b>' + esc(c.name) + (c.bucket ? " · Bucket " + String(c.bucket).padStart(3, "0") : "") + ' <span class="muted">· ' + (c.full && c.status === "closed" ? "FULL" : esc(SC[c.status] || c.status)) + "</span></b>" +
        '<p class="muted">Places: ' + (c.occupied || 0) + " of " + c.max + (c.waiting ? " · " + c.waiting + " on the waiting list" : "") + "<br>Registration closes " + when(c.deadline_at) + " · launches " + when(c.launch_at) + (c.ends_at ? " · ends " + when(c.ends_at) : "") + "<br>Paid " + c.paid + " of " + c.joined + " joined (minimum " + c.min + ", maximum " + c.max + ") · products: " + c.approved + " approved, " + c.pending + " waiting" + (c.refund_due ? " · <b class=\"ops-bad\">" + c.refund_due + " refund(s) due</b>" : "") + "</p>" +
        (c.block ? '<p class="ops-bad">' + esc(c.block) + "</p>" : "") +
        '<p>Collected ' + money(c.collected_kobo) + (c.refunded_kobo ? " · refunded " + money(c.refunded_kobo) : "") + " · ad spend " + money(c.ad_spend_kobo) + " · creative " + money(c.creative_kobo) + " · operations " + money(c.ops_kobo) + " · payment fees " + money(c.fees_kobo) + '<br><b>Net SafeBuy earnings: ' + money(net) + "</b> <span class=\"muted\">(budget set: " + money(c.budget_kobo) + ")</span></p>" +
        (c.status === "running" || c.status === "completed" || c.status === "paused" ? '<p class="muted">Counted on SafeBuy: ' + c.impressions + " shown · " + c.clicks + " opened · " + c.enquiries + " enquiries" + ((c.platform || []).length ? "<br>Platform-reported (not added to the above): " + c.platform.map(function (x) { return esc(CHN[x.channel] || x.channel) + " " + x.impressions + " shown / " + x.clicks + " clicks"; }).join("; ") : "") + "</p>" : "") +
        '<div class="ops-act"><button type="button" class="button" data-act="review">Review products</button>' + (/^(cancelled|draft|open|closed)$/.test(c.status) ? '<button type="button" class="button" data-act="delete" style="background:#b42318">Delete</button>' : "") + (c.pending ? '<button type="button" class="button" data-act="approveall">Approve all waiting (' + c.pending + ")</button>" : "") +
        (c.status === "open" ? '<button type="button" class="button" data-act="status" data-to="closed">Close registration</button>' : "") + (c.status === "running" ? '<button type="button" class="button" data-act="status" data-to="paused">Pause</button>' : "") + (c.status === "paused" ? '<button type="button" class="button" data-act="status" data-to="running">Resume</button>' : "") +
        (["draft", "open", "closed", "paused", "running"].indexOf(c.status) >= 0 ? '<button type="button" class="button" data-act="status" data-to="cancelled">Cancel and refund</button><button type="button" class="button" data-act="budget" data-b="' + c.budget_kobo + '">Set budget</button>' : "") +
        '<button type="button" class="button" data-act="events">History</button><button type="button" class="button" data-act="expense">Add expense</button><button type="button" class="button" data-act="stats">Platform numbers</button></div>' +
        ((c.captions || []).length ? '<details><summary>Captions and posting</summary>' + c.captions.map(function (x) {
          var po = (c.posts || []).filter(function (q) { return q.channel === x.channel; })[0];
          return '<div class="ops-row"><b>' + esc(CHN[x.channel] || x.channel) + (po ? ' <span class="muted">· ' + esc(po.status) + "</span>" : "") + '</b><p style="white-space:pre-wrap">' + esc(x.caption) + '</p><button type="button" class="button" data-act="copy" data-t="' + esc(x.caption) + '">Copy caption</button>' + (po ? '<button type="button" class="button" data-act="posted" data-ch="' + esc(x.channel) + '">Mark as posted</button>' + (po.url ? ' <a href="' + esc(po.url) + '" target="_blank" rel="noopener">View post</a>' : "") : "") + "</div>"; }).join("") + "</details>" : "") +
        '<div class="ac-rev"></div></div>';
    });
    h += '<p class="muted">Publishing to Facebook, Instagram and TikTok is done by you from the captions above (copy, post, then mark as posted) until those platform accounts are approved for automatic posting.</p><div id="ac-new-box"></div>';
    body(h);
    var msg = function (t, bad) { var m = $("ac-m"); if (m) { m.className = bad ? "ops-bad" : "ops-ok"; m.textContent = t; } };
    var again = function () { if (!stale(my)) pAdCentre(my); };
    if ($("ac-ap")) $("ac-ap").onclick = async function () { try { await rpc("admin_consol_autopilot", { p_on: !ap }); again(); } catch (e) { msg(e.message, true); } };
    $("ac-auto").onclick = async function () { if (!d.auto && !window.confirm("Turn automation ON? SafeBuy will start creating campaigns and notifying sellers.")) return; try { await rpc("admin_consol_auto", { p_on: !d.auto }); again(); } catch (e) { msg(e.message, true); } };
    $("ac-run").onclick = async function () { msg("Running…"); try { var r = await rpc("admin_consol_run"); msg("Done. Created " + r.created + ", opened " + r.opened + ", closed " + r.closed + ", launched " + r.launched + ", completed " + r.completed + "."); setTimeout(again, 1800); } catch (e) { msg(e.message, true); } };
    $("ac-csv").onclick = function () {
      var rows = [["Campaign", "Type", "Status", "Paid sellers", "Collected NGN", "Refunded NGN", "Ad spend NGN", "Creative NGN", "Operations NGN", "Payment fees NGN", "Net NGN"]];
      (d.campaigns || []).forEach(function (c) { rows.push([c.name, c.type, c.status, c.paid, c.collected_kobo / 100, c.refunded_kobo / 100, c.ad_spend_kobo / 100, c.creative_kobo / 100, c.ops_kobo / 100, c.fees_kobo / 100, (c.collected_kobo - c.ad_spend_kobo - c.creative_kobo - c.ops_kobo - c.fees_kobo) / 100]); });
      var csv = rows.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "safebuy-campaigns.csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
    };
    $("ac-new").onclick = function () {
      var iso = function (h) { var t = new Date(Date.now() + h * 3600e3 + 3600e3); return t.toISOString().slice(0, 16); };
      $("ac-new-box").innerHTML = '<div class="ops-row"><b>New campaign</b><div class="ops-f"><label>Type<select id="nc-t"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Name<input id="nc-n" maxlength="80"></label>' +
        '<label>Registration opens<input type="datetime-local" id="nc-o" value="' + iso(0) + '"></label><label>Registration closes<input type="datetime-local" id="nc-d" value="' + iso(48) + '"></label><label>Launches<input type="datetime-local" id="nc-l" value="' + iso(60) + '"></label></div>' +
        '<button class="button full" type="button" id="nc-go">Create campaign</button><p class="muted">Times are your phone\'s time. Settings come from the type above.</p></div>';
      $("nc-go").onclick = async function () { try { await rpc("admin_consol_create", { p_type: $("nc-t").value, p_name: $("nc-n").value, p_opens: new Date($("nc-o").value).toISOString(), p_deadline: new Date($("nc-d").value).toISOString(), p_launch: new Date($("nc-l").value).toISOString() }); again(); } catch (e) { msg(e.message, true); alert(e.message); } };
      $("ac-new-box").scrollIntoView({ behavior: "smooth" });
    };
    panel.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = async function () {
        var act = b.dataset.act, row = b.closest("[data-c]"), cid = row && row.dataset.c;
        try {
          if (act === "savetype") {
            var r = b.closest("[data-type]"), g = function (k) { return r.querySelector('[data-k="' + k + '"]'); };
            await rpc("admin_consol_type_set", { p_code: b.dataset.code, p_fee: Math.round(Number(g("fee").value) * 100), p_min: Number(g("min").value), p_max: Number(g("max").value), p_per: Number(g("per").value), p_budget: Math.round(Number(g("budget").value) * 100), p_enabled: g("on").checked, p_auto_approve: g("auto").checked,
              p_channels: [].slice.call(r.querySelectorAll("[data-ch]")).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.ch; }) });
            b.textContent = "Saved ✓"; return;
          }
          if (act === "copy") { if (navigator.clipboard) await navigator.clipboard.writeText(b.dataset.t); b.textContent = "Copied ✓"; return; }
          if (act === "status") { if (b.dataset.to === "cancelled" && !window.confirm("Cancel this campaign? Paid sellers are marked for refund and told.")) return; await rpc("admin_consol_status", { p_id: cid, p_status: b.dataset.to }); again(); return; }
          if (act === "delete") { if (!window.confirm("Delete this campaign for good? Its report and entries are removed. This cannot be undone.")) return; await rpc("admin_consol_delete", { p_id: cid }); again(); return; }
          if (act === "approveall") { var n = await rpc("admin_consol_approve_all", { p_campaign: cid }); alert(n + " product(s) approved."); again(); return; }
          if (act === "budget") { var v = window.prompt("Advertising budget for this campaign in ₦ (a campaign only launches when collections cover it):", String(Number(b.dataset.b) / 100)); if (v === null) return;
            var c = (d.campaigns || []).filter(function (x) { return x.id === cid; })[0];
            await rpc("admin_consol_edit", { p_id: cid, p_name: c.name, p_fee: c.fee_kobo, p_min: c.min, p_max: c.max, p_per: c.per_seller, p_budget: Math.round(Number(v) * 100), p_deadline: null, p_launch: null, p_auto_approve: c.auto_approve }); again(); return; }
          if (act === "expense") { var k = window.prompt("Type of expense: ad_spend, creative, operations or processing", "ad_spend"); if (!k) return; var a = window.prompt("Amount in ₦"); if (a === null) return; var note = window.prompt("Note (optional)") || "";
            await rpc("admin_consol_expense", { p_id: cid, p_kind: k.trim(), p_amount: Math.round(Number(a) * 100), p_note: note }); again(); return; }
          if (act === "stats") { var ch = window.prompt("Channel: facebook, instagram, tiktok or google", "facebook"); if (!ch) return; var im = window.prompt("Impressions reported by " + ch); if (im === null) return; var ck = window.prompt("Clicks reported by " + ch); if (ck === null) return;
            await rpc("admin_consol_platform_stats", { p_id: cid, p_channel: ch.trim(), p_impressions: Number(im) || 0, p_clicks: Number(ck) || 0, p_note: "typed in by admin" }); again(); return; }
          if (act === "posted") { var url = window.prompt("Link to the post (https://…), or leave empty"); if (url === null) return; await rpc("admin_consol_post", { p_id: cid, p_channel: b.dataset.ch, p_status: "posted", p_url: url }); again(); return; }
          if (act === "events") { var ev = await rpc("admin_consol_events", { p_campaign: cid }); var bx = row.querySelector(".ac-rev");
            bx.innerHTML = ev.length ? ev.map(function (x) { return '<p class="muted" style="margin:4px 0">' + when(x.at) + " · <b>" + esc(String(x.kind).replace(/_/g, " ")) + "</b>" + (x.shop ? " · " + esc(x.shop) : "") + (x.detail ? " · " + esc(x.detail) : "") + "</p>"; }).join("") : '<p class="muted">No events yet.</p>'; return; }
          if (act === "review") {
            var box = row.querySelector(".ac-rev"); if (box.innerHTML) { box.innerHTML = ""; return; }
            box.innerHTML = '<p class="muted">Loading…</p>'; var list = await rpc("admin_consol_pending", { p_campaign: cid });
            box.innerHTML = list.length ? list.map(function (x) {
              return '<div class="ops-row" data-i="' + x.id + '" style="display:flex;gap:10px;align-items:center">' + (x.image ? '<img src="' + esc(x.image) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px" referrerpolicy="no-referrer">' : "") +
                '<div style="flex:1"><b>' + esc(x.name || "Product") + "</b><br><small>" + esc(x.shop) + " · " + money(x.price_kobo) + (x.in_stock ? "" : " · OUT OF STOCK") + (x.paid ? "" : " · NOT PAID YET") + " · " + esc(x.status) + (x.reason ? " (" + esc(x.reason) + ")" : "") + '</small></div>' +
                '<button type="button" class="button" data-d="1">Approve</button><button type="button" class="button" data-d="0">Reject</button></div>'; }).join("") : '<p class="muted">No products yet.</p>';
            box.querySelectorAll("[data-d]").forEach(function (q) { q.onclick = async function () {
              var yes = q.dataset.d === "1", why = ""; if (!yes) { why = window.prompt("Reason for the seller (they will see it):"); if (!why) return; }
              try { await rpc("admin_consol_decide", { p_id: q.closest("[data-i]").dataset.i, p_approve: yes, p_reason: why }); q.closest("[data-i]").style.opacity = ".5"; q.parentNode.querySelectorAll("button").forEach(function (z) { z.disabled = true; }); } catch (e) { alert(e.message); } }; });
          }
        } catch (e) { alert(e.message); }
      };
    });
  }

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
    ["support", "Saved support email and WhatsApp in Site content"],
    ["sql_cards", "Ran autorenew.sql, consolidation.sql and smart_adslot.sql (cards, Ad Centre)"],
    ["deals", "Uploaded deals.html and opened it once to check it loads"],
    ["paystack", "Deployed the paystack-cards function (JWT check OFF) and set PAYSTACK_SECRET + CRON_KEY"],
    ["hook", "Added the Paystack webhook URL and the hourly renewals.yml GitHub workflow"],
    ["cardson", "Turned on Admin > Control > Cards, then Ad Centre > Automation"]
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
