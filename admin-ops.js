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
    return '<div class="ops-nav">' + [["live", "Live"], ["reports", "Reports"], ["switches", "Switches"], ["health", "Health"], ["checklist", "Checklist"]].map(function (v) {
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
    ({ live: pLive, reports: pReports, switches: pSwitches, health: pHealth, checklist: pChecklist })[v](my);
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
      '<div class="ops-row"><b>Biggest tables</b><br>' + (h.biggest || []).map(function (b) { return esc(b.table) + " · " + mb(b.bytes); }).join("<br>") + '</div><button class="button outline full" type="button" id="hl-again">Check again</button>');
    $("hl-again").onclick = function () { go("health"); };
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
