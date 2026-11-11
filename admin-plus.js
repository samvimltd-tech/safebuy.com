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

  /* ---- Overview: promotion / boost / advert requests waiting (opens Control > Requests) ---- */
  var promoAt = 0;
  function promoTile() {
    if (!stats.children.length) return;
    var t = $("plus-promo-tile");
    if (!t) {
      t = document.createElement("button"); t.type = "button"; t.className = "stat"; t.id = "plus-promo-tile"; t.hidden = true;
      t.innerHTML = "<b>0</b><span>Promotion requests waiting</span>"; stats.appendChild(t);
      t.addEventListener("click", function () {
        var c = document.querySelector('#main-tabs [data-plustab="ops"]'); if (!c) return; c.click();
        setTimeout(function () { var v = document.querySelector('#ops-panel [data-v="requests"]'); if (v) v.click(); }, 400);
      });
    }
    if (Date.now() - promoAt < 30000) return; promoAt = Date.now();
    rpcRead("admin_promos", { p_status: "pending" }).then(function (rows) {
      var n = (rows || []).length; t.hidden = false; t.firstChild.textContent = n; t.classList.toggle("alert", n > 0);
    }, function () { t.hidden = true; });
  }

  /* ---- Overview: money waiting for you (opens Control > Payments / Social) ---- */
  var moneyAt = 0;
  function goOps(view) {
    var c = document.querySelector('#main-tabs [data-plustab="ops"]'); if (!c) return; c.click();
    setTimeout(function () { var v = document.querySelector('#ops-panel [data-v="' + view + '"]'); if (v) v.click(); }, 400);
  }
  function moneyTiles() {
    if (!stats.children.length) return;
    var defs = [["plus-pay-tile", "Payments to confirm", "payments"], ["plus-soc-tile", "Social campaigns to set up", "social"], ["plus-fee-tile", "Fees sellers owe you", "sellers"]], t = {};
    defs.forEach(function (d) {
      var el = $(d[0]);
      if (!el) { el = document.createElement("button"); el.type = "button"; el.className = "stat"; el.id = d[0]; el.hidden = true; el.innerHTML = "<b>0</b><span>" + d[1] + "</span>"; stats.appendChild(el); el.addEventListener("click", function () { goOps(d[2]); }); }
      t[d[0]] = el;
    });
    if (Date.now() - moneyAt < 30000) return; moneyAt = Date.now();
    rpcRead("admin_revenue").then(function (r) {
      var n = Number(r.reported_count || 0); t["plus-pay-tile"].hidden = false; t["plus-pay-tile"].firstChild.textContent = n; t["plus-pay-tile"].classList.toggle("alert", n > 0);
      t["plus-fee-tile"].hidden = false; t["plus-fee-tile"].firstChild.textContent = money(r.fees_owed_kobo);
    }, function () { t["plus-pay-tile"].hidden = true; t["plus-fee-tile"].hidden = true; });
    rpcRead("admin_social").then(function (r) {
      var n = (r.rows || []).filter(function (x) { return x.status === "paid"; }).length; t["plus-soc-tile"].hidden = false; t["plus-soc-tile"].firstChild.textContent = n; t["plus-soc-tile"].classList.toggle("alert", n > 0);
    }, function () { t["plus-soc-tile"].hidden = true; });
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


  /* ---- Site content tab: edit what visitors see on index.html ---- */
  var FIELDS = [
    ["h", "Announcement bar"], ["ann_show", "Show the announcement bar", "on"], ["ann_text", "Announcement text", "text"],
    ["h", "Home page"], ["hero_title", "Main headline (put | before the green second line, e.g. Good finds. | Better shopping.)", "text"], ["hero_lead", "Line under the headline", "area"],
    ["role_sell_sub", "Sell with us card text", "text"], ["role_ride_sub", "Deliver with us card text", "text"],
    ["h", "Show or hide sections"], ["show_quicklinks", "Quick links row", "on"], ["show_notice", "Safety notice under the cards", "on"], ["show_pulse", "Marketplace pulse", "on"], ["show_sell", "Sell with us and Deliver with us cards", "on"],
    ["h", "Sell panel"], ["sell_title", "Title", "text"], ["sell_text", "Text", "area"], ["sell_button", "Button label", "text"],
    ["h", "Notice under the Sell and Deliver cards"], ["notice_text", "Notice text (turn the notice on or off above)", "area"],
    ["h", "Delivery pop-up"], ["delivery_note", "Note under the delivery areas list", "area"],
    ["h", "Support contact (shown in the footer and on the Privacy and Terms pages)"], ["support_whatsapp", "Support WhatsApp number, e.g. 08012345678", "text"], ["support_email", "Support email", "text"],
    ["h", "Safety tips"], ["safety_tips", "One tip per line", "area"],
    ["h", "Footer"], ["footer_text", "Footer text", "area"],
    ["h", "About us page (about.html)"], ["about_text", "Leave empty to use the built-in text. Start a heading with # and leave a blank line between paragraphs", "long"],
    ["h", "Refund policy page (refund.html)"], ["refund_text", "Leave empty to use the built-in policy. Start a heading with # and leave a blank line between paragraphs", "long"],
    ["h", "Privacy policy page (privacy.html)"], ["privacy_text", "Leave empty to use the built-in policy. Start a heading with # and leave a blank line between paragraphs", "long"],
    ["h", "Terms of use page (terms.html)"], ["terms_text", "Leave empty to use the built-in terms. Start a heading with # and leave a blank line between paragraphs", "long"],
    ["h", "Brand"], ["brand_color", "Main colour, for example #087f5b", "text"]
  ];
  var siteTab = document.createElement("button");
  siteTab.type = "button"; siteTab.className = "tab"; siteTab.dataset.plustab = "site"; siteTab.textContent = "Site content";
  $("main-tabs").appendChild(siteTab);
  var panel = document.createElement("div");
  panel.id = "site-panel"; panel.hidden = true; list.parentNode.insertBefore(panel, list.nextSibling);
  var covered = ["filter-tabs", "tools", "list", "dash-msg"];
  function headers(extra) { var h = { apikey: cfg.publishableKey, Authorization: "Bearer " + token() }; for (var k in extra) h[k] = extra[k]; return h; }
  var launchTab = document.createElement("button");
  launchTab.type = "button"; launchTab.className = "tab"; launchTab.dataset.plustab = "launch"; launchTab.textContent = "Launch check";
  $("main-tabs").appendChild(launchTab);
  var launchPanel = document.createElement("div");
  launchPanel.id = "launch-panel"; launchPanel.hidden = true; list.parentNode.insertBefore(launchPanel, list.nextSibling);
  var backupTab = document.createElement("button");
  backupTab.type = "button"; backupTab.className = "tab"; backupTab.dataset.plustab = "backup"; backupTab.textContent = "Backup";
  $("main-tabs").appendChild(backupTab);
  var backupPanel = document.createElement("div");
  backupPanel.id = "backup-panel"; backupPanel.hidden = true; list.parentNode.insertBefore(backupPanel, list.nextSibling);
  function closeSite() {
    if (panel.hidden && launchPanel.hidden && backupPanel.hidden) return;
    panel.hidden = true; launchPanel.hidden = true; backupPanel.hidden = true; siteTab.classList.remove("active"); launchTab.classList.remove("active"); backupTab.classList.remove("active");
    covered.forEach(function (i) { $(i).hidden = false; });
  }
  async function openSite() {
    document.querySelectorAll("#main-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
    siteTab.classList.add("active"); launchTab.classList.remove("active"); launchPanel.hidden = true; backupPanel.hidden = true; backupTab.classList.remove("active");
    covered.forEach(function (i) { $(i).hidden = true; });
    panel.hidden = false; panel.innerHTML = '<p class="muted">Loading…</p>';
    var v = {};
    try { var r = await fetch(base + "/rest/v1/site_content?key=eq.site&select=value", { headers: headers() }); if (r.ok) { var rows = await r.json(); v = (rows[0] && rows[0].value) || {}; } else throw 0; }
    catch (e) { panel.innerHTML = '<div class="empty">Could not read site content. Run site_content.sql in Supabase first.</div>'; return; }
    panel.innerHTML = '<p class="muted">Leave a text box empty to keep the page’s own wording. Changes show on the live site the next time a visitor opens it.</p><div class="item"><form id="site-form">' +
      FIELDS.map(function (f) {
        if (f[0] === "h") return '<h3 style="margin:18px 0 4px;font-size:15px">' + esc(f[1]) + "</h3>";
        var id = "sc-" + f[0], val = v[f[0]];
        if (f[2] === "on") return '<label style="display:flex;gap:9px;align-items:center;font-weight:400"><input type="checkbox" id="' + id + '" style="width:auto"' + (val === false ? "" : " checked") + "> " + esc(f[1]) + "</label>";
        if (f[2] === "long") return '<label for="' + id + '">' + esc(f[1]) + '</label><textarea id="' + id + '" rows="12" maxlength="20000" style="width:100%;padding:12px;border:1px solid #dce5de;border-radius:12px;font:inherit">' + esc(val || "") + "</textarea>";
        if (f[2] === "area") return '<label for="' + id + '">' + esc(f[1]) + '</label><textarea id="' + id + '" rows="3" maxlength="800" style="width:100%;padding:12px;border:1px solid #dce5de;border-radius:12px;font:inherit">' + esc(val || "") + "</textarea>";
        return '<label for="' + id + '">' + esc(f[1]) + '</label><input id="' + id + '" maxlength="200" value="' + esc(val || "") + '">';
      }).join("") +
      '<button class="button full" type="submit">Save changes</button><button class="button outline full" type="button" id="site-reset">Reset everything to the page’s own wording</button></form><p class="msg" id="site-msg" role="status"></p></div>';
  }
  async function saveSite(value) {
    var m = $("site-msg"); m.className = "msg"; m.textContent = "Saving…";
    try {
      var r = await fetch(base + "/rest/v1/site_content?on_conflict=key", { method: "POST", headers: headers({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify({ key: "site", value: value, updated_at: new Date().toISOString() }) });
      if (!r.ok) throw new Error((await r.text()).slice(0, 160) || "Not saved");
      m.textContent = "Saved. The live site shows it the next time it loads.";
    } catch (e) { m.className = "msg err"; m.textContent = "Not saved: " + e.message + " (run site_content.sql in Supabase, then refresh this page)"; }
  }

  /* ---- Launch check: a live list of what is ready before real customers arrive ---- */
  async function openLaunch() {
    document.querySelectorAll("#main-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
    launchTab.classList.add("active"); siteTab.classList.remove("active"); panel.hidden = true; backupPanel.hidden = true; backupTab.classList.remove("active");
    covered.forEach(function (i) { $(i).hidden = true; });
    launchPanel.hidden = false; launchPanel.innerHTML = '<p class="muted">Checking…</p>';
    var r = await Promise.all([get("seller_applications"), get("seller_products"), get("delivery_partners"), get("delivery_supported_areas"), get("site_content"), get("delivery_settings")]);
    var apps = r[0], prods = r[1], partners = r[2], areas = r[3], sc = r[4], settings = r[5];
    var site = {}; (sc || []).forEach(function (x) { if (x.key === "site") site = x.value || {}; });
    var verified = apps.filter(function (a) { return a.verification_status === "approved"; }).length;
    var approved = partners.filter(function (p) { return p.status === "approved"; });
    var docsPending = partners.filter(function (p) { return p.status === "pending"; }).length;
    var onAreas = areas.filter(function (a) { return a.is_active; }).length;
    var hasFees = settings && settings.length && settings[0] && Number(settings[0].fee_same_city_kobo || settings[0].same_city_fee_kobo || 1) > 0;
    var sup = !!(site.support_whatsapp || site.support_email);
    var pl = null, rq = null, ga = null, rf = null;
    try { pl = await rpcRead("admin_subscriptions"); } catch (e) {}
    try { rq = await rpcRead("admin_promos", { p_status: "pending" }); } catch (e) {}
    try { ga = await rpcRead("admin_growth_auto"); } catch (e) {}
    var ms = null, rv = null, sc = null;
    try { ms = await rpcRead("admin_money_settings"); } catch (e) {}
    try { rv = await rpcRead("admin_revenue"); } catch (e) {}
    try { sc = await rpcRead("admin_social"); } catch (e) {}
    var bank = ms && ms.bank, bankOk = !!(bank && bank.account_number && bank.bank_name && bank.account_name), paidWait = sc ? (sc.rows || []).filter(function (x) { return x.status === "paid"; }).length : 0;
    var P = (pl && pl.plans) || null;
    var items = [
      [apps.length > 0, "Shops on the platform", apps.length + " shop" + (apps.length === 1 ? "" : "s") + ", " + verified + " verified", "Sellers tab"],
      [prods.length > 0, "Products listed", prods.length + " product" + (prods.length === 1 ? "" : "s"), "Products tab"],
      [approved.length > 0, "Approved riders", approved.length + " approved" + (docsPending ? ", " + docsPending + " waiting for review" : ""), "Delivery > Partners"],
      [onAreas > 0, "Delivery areas switched on", onAreas + " area" + (onAreas === 1 ? "" : "s") + " on", "Delivery > Coverage"],
      [!!hasFees, "Delivery fees set", hasFees ? "Fees are set. Check they are the amounts you want" : "Open Delivery > Settings and set your fees", "Delivery > Settings"],
      [sup, "Support contact entered", sup ? "Shown in the footer and on the policy pages" : "Add a WhatsApp number or email", "Site content"],
      [!!(site.privacy_text || site.terms_text || site.refund_text || site.about_text), "Policy pages reviewed", (site.privacy_text || site.terms_text || site.refund_text || site.about_text) ? "You have edited at least one page" : "Pages use the built-in draft text. Read and edit them before launch", "Site content"],
      [P ? Number(P.monthly_kobo) > 0 && Number(P.yearly_kobo) > 0 : false, "Verified badge plan prices", P ? "Monthly " + money(P.monthly_kobo) + ", 12 months " + money(P.yearly_kobo) + (P.required ? ". The badge needs a paid plan." : ". The badge is free for now.") : "Run seller_plans.sql in Supabase", "Control > Plans"],
      [rq ? rq.length === 0 : false, "Promotion requests", rq ? (rq.length ? rq.length + " waiting for your reply" : "Nothing waiting") : "Run growth2.sql in Supabase", "Control > Requests"],
      [ga ? ga.enabled !== false : false, "Automatic seller growth", ga ? (ga.enabled !== false ? "On. " + (ga.sent_30d || 0) + " messages sent in the last 30 days" : "Switched off") : "Run growth3.sql in Supabase", "Control > Requests"],
      [ms ? bankOk : false, "Your bank details for payments", ms ? (bankOk ? bank.bank_name + ", " + bank.account_name : "Open Control > Pricing and enter your bank account. Sellers cannot pay you without it") : "Run money.sql in Supabase", "Control > Pricing"],
      [rv ? Number(rv.reported_count || 0) === 0 : false, "Payments waiting for you to confirm", rv ? (Number(rv.reported_count || 0) ? rv.reported_count + " waiting (" + money(rv.reported_kobo) + ")" : "Nothing waiting") : "Run money.sql in Supabase", "Control > Payments"],
      [sc ? paidWait === 0 : false, "Social campaigns waiting to be set up", sc ? (paidWait ? paidWait + " paid and waiting for you" : "Nothing waiting") : "Run social.sql in Supabase", "Control > Social"],
      [null, "Paystack online payments", "Cannot be checked from here. Follow SETUP.md, then test a full order in Paystack test mode", "SETUP.md"],
      [null, "Database security", "Run: select tablename from pg_tables where schemaname='public' and not rowsecurity; and fix anything listed", "Supabase SQL"],
      [null, "Rider documents are private", "In Supabase Storage, the delivery-docs bucket must not be public", "Supabase Storage"],
      [null, "Supabase plan", "The free plan pauses after a week of no activity and has no backups. Consider the paid plan", "Supabase billing"]
    ];
    var ok = items.filter(function (i) { return i[0] === true; }).length, auto = items.filter(function (i) { return i[0] !== null; }).length;
    launchPanel.innerHTML = '<p class="muted">Checked just now from your live data. Items marked "Check yourself" cannot be tested from this page.</p>' +
      '<div class="item"><strong style="font-size:16px">' + ok + " of " + auto + ' automatic checks passed</strong></div>' +
      items.map(function (i) {
        var pill = i[0] === true ? '<span class="pill approved">Ready</span>' : i[0] === false ? '<span class="pill rejected">Fix</span>' : '<span class="pill">Check yourself</span>';
        return '<div class="item">' + pill + " <strong>" + esc(i[1]) + '</strong><br><span class="muted">' + esc(i[2]) + " · " + esc(i[3]) + "</span></div>";
      }).join("") + '<button class="button outline full" type="button" id="launch-again">Check again</button>';
  }
  launchTab.addEventListener("click", openLaunch);
  launchPanel.addEventListener("click", function (e) { if (e.target.id === "launch-again") openLaunch(); });

  /* ---- Backup: saves your data to this phone as one file (read-only: it never changes anything) ---- */
  function rpcRead(name, args) {
    return fetch(base + "/rest/v1/rpc/" + name, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(args || {}) })
      .then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t.slice(0, 160) || "Request failed"); return t ? JSON.parse(t) : null; }); });
  }
  function lastBackup() { try { return localStorage.getItem("sb-last-backup") || ""; } catch (e) { return ""; } }
  async function openBackup() {
    document.querySelectorAll("#main-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
    backupTab.classList.add("active"); siteTab.classList.remove("active"); launchTab.classList.remove("active"); panel.hidden = true; launchPanel.hidden = true;
    covered.forEach(function (i) { $(i).hidden = true; });
    backupPanel.hidden = false; backupPanel.innerHTML = '<p class="muted">Checking…</p>';
    var tables;
    try { tables = await rpcRead("admin_backup_tables"); }
    catch (e) { backupPanel.innerHTML = '<div class="empty">Backup is not switched on yet. Run backup_and_speed.sql in Supabase, then refresh this page.<br><small>' + esc(e.message) + "</small></div>"; return; }
    var total = tables.reduce(function (s, t) { return s + Number(t.rows || 0); }, 0), lb = lastBackup();
    var age = lb ? Math.floor((Date.now() - new Date(lb).getTime()) / 86400000) : null;
    backupPanel.innerHTML = '<p class="muted">Saves all your marketplace data (accounts, shops, products, orders, deliveries) to this phone as one file. Product photos and passwords are not included. Keep the file private: it contains customers\' personal details.</p>' +
      '<div class="item"><strong>' + (lb ? "Last backup: " + esc(new Date(lb).toLocaleString()) + (age >= 7 ? ' <span class="pill rejected">' + age + " days ago: back up now</span>" : "") : '<span class="pill rejected">No backup yet</span>') + "</strong><br>" +
      '<span class="muted">' + tables.length + " tables, " + total.toLocaleString() + " rows</span></div>" +
      '<button class="button full" type="button" id="bk-go">Download backup now</button><p class="msg" id="bk-msg" role="status"></p>' +
      '<div class="item muted" style="font-size:13px">' + tables.map(function (t) { return esc(t.table) + " (" + t.rows + ")"; }).join(" · ") + "</div>";
    $("bk-go").addEventListener("click", function () { runBackup(tables); });
  }
  async function runBackup(tables) {
    var btn = $("bk-go"), msg = $("bk-msg"); btn.disabled = true; msg.className = "msg";
    var parts = ['{"app":"SafeBuy NG","saved_at":"' + new Date().toISOString() + '","tables":{'], first = true, done = 0, all = tables.reduce(function (s, t) { return s + Number(t.rows || 0); }, 0);
    try {
      for (var i = 0; i < tables.length; i++) {
        var t = tables[i], off = 0, rows = [];
        while (off < Number(t.rows || 0)) {
          var chunk = await rpcRead("admin_backup_table", { p_table: t.table, p_offset: off, p_limit: 500 });
          if (!chunk || !chunk.length) break;
          rows.push(JSON.stringify(chunk).slice(1, -1)); off += chunk.length; done += chunk.length;
          msg.textContent = "Saving… " + t.table + " (" + Math.min(100, Math.round(done / Math.max(all, 1) * 100)) + "%)";
        }
        parts.push((first ? "" : ",") + JSON.stringify(t.table) + ":[" + rows.join(",") + "]"); first = false;
      }
      parts.push("}}");
      var blob = new Blob(parts, { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "safebuy-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      try { localStorage.setItem("sb-last-backup", new Date().toISOString()); } catch (e) {}
      msg.textContent = "Done. " + done.toLocaleString() + " rows saved to your phone's Downloads. Keep the file somewhere safe and private.";
    } catch (e) { msg.className = "msg err"; msg.textContent = "Backup stopped: " + e.message; }
    btn.disabled = false;
  }
  backupTab.addEventListener("click", openBackup);
  siteTab.addEventListener("click", openSite);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-tab],[data-go]")) closeSite(); });
  panel.addEventListener("submit", function (e) {
    e.preventDefault();
    var out = {};
    FIELDS.forEach(function (f) {
      if (f[0] === "h") return;
      var el = $("sc-" + f[0]);
      if (f[2] === "on") { if (!el.checked) out[f[0]] = false; }
      else if (el.value.trim()) out[f[0]] = el.value.trim();
    });
    if (out.support_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.support_email)) { $("site-msg").className = "msg err"; $("site-msg").textContent = "That support email does not look right."; return; }
    if (out.support_whatsapp && String(out.support_whatsapp).replace(/\D/g, "").length < 10) { $("site-msg").className = "msg err"; $("site-msg").textContent = "Enter the support WhatsApp number with at least 10 digits."; return; }
    if (out.brand_color && !/^#[0-9a-f]{6}$/i.test(out.brand_color)) { $("site-msg").className = "msg err"; $("site-msg").textContent = "Colour must look like #087f5b."; return; }
    saveSite(out);
  });
  panel.addEventListener("click", function (e) {
    if (e.target.id === "site-reset" && window.confirm("Remove all your changes and go back to the page's own wording?")) saveSite({}).then(openSite);
  });

  function run() { fillCats(); decorateStats(); promoTile(); moneyTiles(); decorateItems(); applyCat(); }
  function refresh() {
    run();
    if (Date.now() - loadedAt > 20000) load().then(run);
  }
  new MutationObserver(refresh).observe(list, { childList: true });
  new MutationObserver(refresh).observe(stats, { childList: true });
  document.querySelector("#main-tabs").addEventListener("click", function () { setTimeout(applyCat, 0); });
  refresh();
})();
