/* SafeBuy NG: Seller growth tools. Promote my products, Boost my shop, Product impressions, Product enquiries,
   Customer clicks, Upgrade my subscription, Advertise my business, Invite other sellers and earn rewards.
   Needs growth2.sql. Opens from the seller home tiles and from a card inside the seller panel. */
(function () {
  "use strict";
  if (window.__sbHub) return;
  var root = location.href.split("#")[0].split("?")[0].replace(/(seller|rider)\/(index\.html)?$/, "").replace(/index\.html$/, "");
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function client() { return window.safeBuySupabase && window.safeBuySupabase.rpc ? window.safeBuySupabase : null; }
  function toast(t) { if (typeof window.showToast === "function") window.showToast(t); else if (window.say) window.say(t); }
  function num(n) { return Number(n || 0).toLocaleString("en-NG"); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---- remember an invite link (?ref=CODE) and use it once the new seller has an account ---- */
  try { var m = /[?&]ref=([A-Za-z0-9]{4,12})/.exec(location.search); if (m) store("sb-ref", m[1].toUpperCase()); } catch (e) {}
  var claiming = false;
  async function claim() {
    var code = store("sb-ref"), c = client(); if (!code || !c || claiming) return; claiming = true;
    try { var r = await c.rpc("claim_referral", { p_code: code }); if (!r.error && r.data && r.data !== "no_account") store("sb-ref", null); } catch (e) {}
    claiming = false;
  }

  /* ---- the sheet ---- */
  var st = document.createElement("style");
  st.textContent =
    "#sh{position:fixed;inset:0;z-index:320;display:none;flex-direction:column;background:#f7f9f7;color:#172b24;font-family:Arial,Helvetica,sans-serif}#sh.open{display:flex}" +
    ".sh-top{display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));background:#fff;border-bottom:1px solid #e6ece8}.sh-top strong{flex:1;font-size:17px}" +
    ".sh-top button{width:40px;height:40px;border:0;border-radius:50%;background:#edf6ef;color:#066548;font-size:20px;cursor:pointer}" +
    ".sh-body{flex:1;overflow-y:auto;padding:14px;-webkit-overflow-scrolling:touch;max-width:640px;width:100%;margin:0 auto}" +
    ".sh-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".sh-tile{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid #e6ece8;border-radius:16px;background:#fff;padding:14px 12px;font:700 14px Arial,sans-serif;color:#172b24;cursor:pointer;min-height:88px}" +
    ".sh-tile small{font:400 12px/1.35 Arial,sans-serif;color:#718078}.sh-tile .e{font-size:24px;line-height:1}" +
    ".sh-card{background:#fff;border:1px solid #e6ece8;border-radius:14px;padding:14px;margin:0 0 12px}.sh-card h3{margin:0 0 6px;font-size:16px}.sh-card p{margin:0 0 8px;color:#52675c;font-size:14px;line-height:1.5}" +
    ".sh-nums{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.sh-nums div{flex:1;min-width:96px;background:#fff;border:1px solid #e6ece8;border-radius:12px;padding:10px}.sh-nums b{display:block;font-size:20px}.sh-nums span{font-size:12px;color:#718078}" +
    ".sh-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eef2ef;font-size:14px}.sh-row:first-child{border-top:0}.sh-row b{display:block}.sh-row small{color:#718078}.sh-row .n{font-weight:700;white-space:nowrap}" +
    ".sh-f label{display:block;margin:10px 0 4px;font-size:13px;font-weight:700}.sh-f select,.sh-f input,.sh-f textarea{width:100%;padding:11px;border:1px solid #cfd8d2;border-radius:10px;font:16px Arial,sans-serif;background:#fff}" +
    ".sh-btn{display:block;width:100%;margin-top:12px;padding:13px;border:0;border-radius:12px;background:#087f5b;color:#fff;font:700 15px Arial,sans-serif;cursor:pointer}.sh-btn.alt{background:#edf6ef;color:#066548}.sh-btn:disabled{opacity:.55}" +
    ".sh-msg{min-height:18px;margin:8px 0 0;font-size:13px}.sh-ok{color:#087f5b}.sh-bad{color:#b42318}" +
    ".sh-row .sh-pill{align-self:flex-start;white-space:nowrap}.sh-pill{display:inline-block;line-height:1.5;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;background:#fff3e0;color:#7a4a05}.sh-pill.approved{background:#e7f7ef;color:#066548}.sh-pill.rejected,.sh-pill.cancelled,.sh-pill.ended{background:#eef0f1;color:#52606a}" +
    ".sh-code{font:800 28px Arial,sans-serif;letter-spacing:4px;text-align:center;padding:12px;border:2px dashed #087f5b;border-radius:12px;background:#f4fbf6;margin:8px 0}" +
    "#hub-card .sh-grid{margin-top:8px}";
  document.head.appendChild(st);
  var sh = document.createElement("div"); sh.id = "sh"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
  sh.innerHTML = '<div class="sh-top"><button type="button" id="sh-back" aria-label="Back" hidden>‹</button><strong id="sh-title">Grow my business</strong><button type="button" id="sh-x" aria-label="Close">✕</button></div><div class="sh-body" id="sh-body"></div>';
  document.body.appendChild(sh);
  var bodyEl = $("sh-body"), titleEl = $("sh-title"), backBtn = $("sh-back"), cur = "", payBack = "";
  function show() { sh.classList.add("open"); document.body.style.overflow = "hidden"; }
  function hide() { sh.classList.remove("open"); document.body.style.overflow = ""; }
  $("sh-x").addEventListener("click", hide); backBtn.addEventListener("click", function () { open(cur === "pay" ? (payBack || "home") : "home"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sh.classList.contains("open")) hide(); });

  var TILES = [
    ["promote", "📣", "Promote my products", "Get a product featured"], ["boost", "🚀", "Boost my shop", "Feature your whole shop"],
    ["impressions", "👁️", "Product impressions", "Times your products were shown"], ["enquiries", "💬", "Product enquiries", "Customers who asked about you"],
    ["clicks", "👆", "Customer clicks", "Times your products were opened"], ["upgrade", "⭐", "Upgrade my subscription", "Verified badge plan"],
    ["advertise", "📢", "Advertise my business", "Ask us to advertise your shop"], ["invite", "🎁", "Invite sellers, earn rewards", "Free badge days for every shop"],
    ["billing", "💳", "Payments & fees", "Pay for promotions, fees and plans"]
  ];
  var TITLES = { home: "Grow my business", promote: "Promote my products", boost: "Boost my shop", impressions: "Product impressions", enquiries: "Product enquiries", clicks: "Customer clicks", upgrade: "Upgrade my subscription", advertise: "Advertise my business", invite: "Invite sellers & earn", billing: "Payments & fees", pay: "Pay now" };
  function tilesHtml() { return '<div class="sh-grid">' + TILES.map(function (t) { return '<button type="button" class="sh-tile" data-hub="' + t[0] + '"><span class="e">' + t[1] + "</span>" + t[2] + "<small>" + t[3] + "</small></button>"; }).join("") + "</div>"; }

  var growth = null;
  async function loadGrowth(force) {
    var c = client(); if (!c) throw new Error("Still connecting. Try again in a moment.");
    if (!growth || force) { var r = await c.rpc("seller_growth"); if (r.error) throw new Error(/function/i.test(r.error.message) ? "Setup needed: run growth2.sql in Supabase." : r.error.message); growth = r.data; }
    if (!growth || !growth.app) throw new Error("Open your seller account first (tap My shop & listings).");
    return growth;
  }
  function err(e) { return '<div class="sh-card"><p class="sh-bad">' + esc(e && e.message || e) + "</p></div>"; }

  async function open(view) {
    cur = view || "home"; show(); titleEl.textContent = TITLES[cur] || "Grow my business"; backBtn.hidden = cur === "home";
    bodyEl.scrollTop = 0;
    if (cur === "home") { bodyEl.innerHTML = '<div id="sh-coach"></div><p style="color:#52675c;font-size:14px;margin:0 0 12px">Tools to get more customers. Tap one to start.</p>' + tilesHtml(); drawCoach($("sh-coach")); return; }
    bodyEl.innerHTML = '<p style="color:#718078">Loading…</p>';
    var v = cur;
    try {
      var html = await ({ impressions: vStat, enquiries: vStat, clicks: vStat, promote: vPromote, boost: vBoost, advertise: vAd, upgrade: vUpgrade, invite: vInvite, billing: vBilling })[v](v);
      if (cur === v) { bodyEl.innerHTML = html; wire(v); }
    } catch (e) { if (cur === v) bodyEl.innerHTML = err(e); }
  }

  /* ---- numbers: impressions / enquiries / clicks ---- */
  var META = {
    impressions: { w: "impressions7", t: "impressions", label: "Impressions", tip: "An impression is counted each time one of your products is shown on a customer's screen." },
    enquiries: { w: "contacts7", t: "contacts", label: "Enquiries", tip: "An enquiry is counted each time a customer taps to chat with you about a product." },
    clicks: { w: "views7", t: "views", label: "Clicks", tip: "A click is counted each time a customer opens one of your products." }
  };
  async function vStat(v) {
    var g = await loadGrowth(true), P = g.products || [], M = META[v];
    var w = P.reduce(function (a, p) { return a + Number(p[M.w] || 0); }, 0), t = P.reduce(function (a, p) { return a + Number(p[M.t] || 0); }, 0);
    var imp = P.reduce(function (a, p) { return a + Number(p.impressions || 0); }, 0), clk = P.reduce(function (a, p) { return a + Number(p.views || 0); }, 0);
    var extra = v === "clicks" && imp ? "<div><b>" + (Math.round(clk / imp * 1000) / 10) + "%</b><span>of impressions got a click</span></div>" : "";
    var rows = P.slice().sort(function (a, b) { return Number(b[M.w] || 0) - Number(a[M.w] || 0) || Number(b[M.t] || 0) - Number(a[M.t] || 0); });
    return '<div class="sh-nums"><div><b>' + num(w) + "</b><span>" + M.label + ", last 7 days</span></div><div><b>" + num(t) + "</b><span>" + M.label + ", all time</span></div>" + extra + "</div>" +
      '<div class="sh-card"><p>' + esc(M.tip) + "</p>" + (rows.length ? rows.map(function (p) {
        return '<div class="sh-row"><div><b>' + esc(p.name) + (p.in_stock ? "" : " (sold out)") + "</b><small>" + num(p[M.t]) + " all time</small></div><span class=\"n\">" + num(p[M.w]) + " this week</span></div>";
      }).join("") : "<p>You have no products yet. Add your first product in My shop &amp; listings.</p>") + "</div>" +
      '<button type="button" class="sh-btn alt" data-hub="promote">📣 Get more ' + M.label.toLowerCase() + ": promote a product</button>";
  }

  /* ---- money helpers ---- */
  function naira(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  var prices = null;
  async function loadPrices() { if (prices) return prices; var r = await client().rpc("money_prices"); prices = (r && r.data) || {}; return prices; }
  function bankHtml(b) {
    b = b || {};
    if (!b.account_number) return '<p class="sh-bad">Payment details are not ready yet. Please contact SafeBuy NG support to pay.</p>';
    return '<div class="sh-row"><div><small>Bank</small><b>' + esc(b.bank_name) + '</b></div></div><div class="sh-row"><div><small>Account number</small><b style="font-size:20px;letter-spacing:1px">' + esc(b.account_number) + '</b></div><button type="button" class="sh-cp" data-v="' + esc(b.account_number) + '" style="border:0;background:#edf6ef;color:#066548;border-radius:10px;padding:8px 12px;font:700 13px Arial;cursor:pointer">Copy</button></div><div class="sh-row"><div><small>Account name</small><b>' + esc(b.account_name) + "</b></div></div>" + (b.note ? '<p style="font-size:13px;color:#52675c">' + esc(b.note) + "</p>" : "");
  }
  /* the "send the money and tell us" panel, used by every payment */
  function showPay(p, back) {
    cur = "pay"; payBack = back || cur; show(); titleEl.textContent = "Pay now"; backBtn.hidden = false; bodyEl.scrollTop = 0;
    var done = p.status === "confirmed", rep = p.status === "reported", bad = p.status === "rejected" || p.status === "cancelled";
    bodyEl.innerHTML = '<div class="sh-card"><h3>Pay ' + naira(p.amount_kobo) + '</h3>' +
      (done ? '<p class="sh-ok"><b>Payment confirmed. Thank you.</b></p>' : bad ? '<p class="sh-bad">This payment is ' + esc(p.status) + ".</p>" :
      "<p>Transfer <b>exactly " + naira(p.amount_kobo) + '</b> to the account below. Put this reference in the transfer remark:</p><div class="sh-code" id="sh-ref">' + esc(p.reference) + "</div>" + bankHtml(p.bank)) + "</div>" +
      (rep ? '<div class="sh-card"><p class="sh-ok"><b>Thanks. We are checking your payment.</b> You will get a notification once it is confirmed, usually within a few hours.</p></div>' :
       (!done && !bad) ? '<div class="sh-card"><h3>Already paid?</h3><form class="sh-f" id="sh-rep"><label for="sh-pn">Name on your bank account (helps us find it)</label><input id="sh-pn" maxlength="100" autocomplete="name"><button class="sh-btn" type="submit">I have paid</button><p class="sh-msg" id="sh-msg" role="status"></p></form><button type="button" class="sh-btn alt" id="sh-cancelpay" style="margin-top:10px">Cancel this payment</button></div>' : "");
    var f = $("sh-rep");
    if (f) f.onsubmit = async function (e) {
      e.preventDefault(); var m = $("sh-msg"), b = f.querySelector("button"); b.disabled = true; m.className = "sh-msg"; m.textContent = "Sending…";
      var r = await client().rpc("report_payment", { p_ref: p.reference, p_note: $("sh-pn").value || null, p_phone: null });
      if (r.error) { m.className = "sh-msg sh-bad"; m.textContent = r.error.message; b.disabled = false; return; }
      p.status = "reported"; showPay(p, payBack);
    };
    var cp = $("sh-cancelpay"); if (cp) cp.onclick = async function () { if (!window.confirm("Cancel this payment?")) return; await client().rpc("cancel_my_payment", { p_id: p.id }); open(payBack === "pay" ? "billing" : payBack); };
    wirePay();
  }
  function wirePay() { bodyEl.querySelectorAll(".sh-cp").forEach(function (b) { b.onclick = function () { var v = b.dataset.v; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { b.textContent = "Copied ✓"; }, function () { window.prompt("Copy", v); }); else window.prompt("Copy", v); }; }); }

  /* ---- promote / boost (paid, or free if you switch charging off) ---- */
  async function myPromos(kind) {
    var c = client(), r = await c.rpc("my_promos"); if (r.error) return "";
    var pays = await c.rpc("my_payments"), byRef = {}; ((pays && pays.data) || []).forEach(function (x) { if (x.ref_id) byRef[x.ref_id] = x; });
    var rows = (r.data || []).filter(function (x) { return !kind || x.kind === kind; });
    if (!rows.length) return "";
    return '<div class="sh-card"><h3>My requests</h3>' + rows.map(function (x) {
      var what = x.kind === "product" ? "Product: " + esc(x.product || "") : x.kind === "shop" ? "Boost my shop" : "Advert", st = x.status === "awaiting_payment" ? "awaiting payment" : x.status, pay = byRef[x.id];
      return '<div class="sh-row"><div><b>' + what + '</b><small>' + x.days + " days" + (x.ends_at && x.status === "approved" ? " · ends " + new Date(x.ends_at).toLocaleDateString("en-NG") : "") + (x.admin_note ? " · " + esc(x.admin_note) : "") + '</small></div><div style="text-align:right"><span class="sh-pill ' + esc(x.status) + '">' + esc(st) + "</span>" +
        (x.status === "awaiting_payment" && pay ? '<br><button type="button" class="sh-paynow" data-id="' + esc(pay.id) + '" style="border:0;background:none;color:#087f5b;font:700 13px Arial;padding:6px 0;cursor:pointer">Pay now</button>' : "") +
        (x.status === "pending" ? '<br><button type="button" class="sh-cancel" data-id="' + esc(x.id) + '" style="border:0;background:none;color:#b42318;font-size:12px;padding:6px 0;cursor:pointer">Cancel</button>' : "") + "</div></div>";
    }).join("") + "</div>";
  }
  var DAYS = '<label for="sh-days">How long?</label><select id="sh-days"><option value="3">3 days</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option></select>';
  function priceLine(kind) { return '<p id="sh-price" data-kind="' + kind + '" style="font-weight:700;margin:10px 0 0"></p>'; }
  async function vPromote() {
    var g = await loadGrowth(true), P = (g.products || []).filter(function (p) { return p.in_stock; }); await loadPrices();
    if (!P.length) return '<div class="sh-card"><p>Add a product that is in stock first, then you can promote it.</p></div>';
    return '<div class="sh-card"><p>Promoted products appear in the <b>Featured</b> section on the SafeBuy home page.' + (prices.charge_promos ? " You pay by bank transfer, and it starts as soon as we confirm your payment." : " The SafeBuy team reviews each request.") + '</p><form class="sh-f" id="sh-form" data-kind="product">' +
      '<label for="sh-prod">Which product?</label><select id="sh-prod">' + P.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("") + "</select>" + DAYS + priceLine("promote_day_kobo") +
      '<label for="sh-note">Note for the team (optional)</label><textarea id="sh-note" rows="2" maxlength="300" placeholder="Anything we should know"></textarea>' +
      '<button class="sh-btn" type="submit">Continue</button><p class="sh-msg" id="sh-msg" role="status"></p></form></div>' + await myPromos("product");
  }
  async function vBoost() {
    var g = await loadGrowth(true), n = (g.products || []).filter(function (p) { return p.in_stock; }).length; await loadPrices();
    if (!n) return '<div class="sh-card"><p>Add a product that is in stock first, then you can boost your shop.</p></div>';
    return '<div class="sh-card"><p>Boosting features up to your 12 newest in-stock products in the <b>Featured</b> section, so customers find your shop first. You have ' + n + " in-stock product" + (n === 1 ? "" : "s") + '.</p><form class="sh-f" id="sh-form" data-kind="shop">' + DAYS + priceLine("boost_day_kobo") +
      '<button class="sh-btn" type="submit">Continue</button><p class="sh-msg" id="sh-msg" role="status"></p></form></div>' + await myPromos("shop");
  }
  /* ---- advertise my business: a banner on the SafeBuy home page ---- */
  var SLOTS = { home_top: "Top of the home page", home_mid: "Middle of the home page" };
  async function vAd() {
    await loadGrowth(false); await loadPrices(); var ap = prices.ad_day_kobo || {};
    return '<div class="sh-card"><p>Get a banner on the SafeBuy home page, seen by every shopper. Pay by bank transfer and it goes live when we confirm your payment.</p><form class="sh-f" id="sh-form" data-kind="banner">' +
      '<label for="sh-slot">Where should it appear?</label><select id="sh-slot">' + Object.keys(ap).map(function (k) { return '<option value="' + esc(k) + '">' + esc(SLOTS[k] || k) + " · " + naira(ap[k]) + " a day</option>"; }).join("") + "</select>" + DAYS + priceLine("ad") +
      '<label for="sh-biz">Business name</label><input id="sh-biz" maxlength="80" autocomplete="organization">' +
      '<label for="sh-phone">Phone or WhatsApp</label><input id="sh-phone" maxlength="30" inputmode="tel" autocomplete="tel">' +
      '<label for="sh-title">Headline (short)</label><input id="sh-title2" maxlength="60" placeholder="e.g. Fresh shoes, delivered fast">' +
      '<label for="sh-body">Text under it (optional)</label><textarea id="sh-body" rows="2" maxlength="160"></textarea>' +
      '<label for="sh-btnl">Button words (optional)</label><input id="sh-btnl" maxlength="20" placeholder="e.g. Shop now">' +
      '<label for="sh-link">Where the button goes (optional, must start with https://)</label><input id="sh-link" maxlength="250" inputmode="url" placeholder="https://wa.me/234…">' +
      '<label for="sh-img">Picture link (optional, https://)</label><input id="sh-img" maxlength="250" inputmode="url">' +
      '<button class="sh-btn" type="submit">Continue</button><p class="sh-msg" id="sh-msg" role="status"></p></form></div>';
  }

  /* ---- upgrade my subscription ---- */
  async function vUpgrade() {
    var c = client(), r = await c.rpc("seller_subscription");
    if (r.error) throw new Error(/function/i.test(r.error.message) ? "Setup needed: run seller_plans.sql in Supabase." : r.error.message);
    var s = r.data || {}, P = s.plans || {};
    if (!s.app) throw new Error("Open your seller account first (tap My shop & listings).");
    var status = s.active ? '<p class="sh-ok"><b>Verified badge plan active</b> until ' + new Date(s.expires_at).toLocaleDateString("en-NG") + " (" + esc(s.plan) + ").</p>" : "<p>You do not have an active badge plan.</p>";
    return '<div class="sh-card"><h3>Verified seller badge</h3>' + status + "<p>Listing is free. The Verified badge costs <b>" + naira(P.monthly_kobo) + " a month</b> or <b>" + naira(P.yearly_kobo) + " for 12 months</b>" + (Number(P.monthly_kobo) * 12 > Number(P.yearly_kobo) ? " (save " + naira(Number(P.monthly_kobo) * 12 - Number(P.yearly_kobo)) + ")" : "") + ". Verified shops also pay lower fees on sales.</p>" +
      '<button type="button" class="sh-btn" data-plan="yearly">' + (s.active ? "Renew 12 months " : "Get 12 months ") + naira(P.yearly_kobo) + '</button><button type="button" class="sh-btn alt" data-plan="monthly">' + (s.active ? "Renew 1 month " : "Get 1 month ") + naira(P.monthly_kobo) + '</button><p class="sh-msg" id="sh-msg" role="status"></p></div>';
  }

  /* ---- payments & fees ---- */
  async function vBilling() {
    var c = client(), b = await c.rpc("seller_billing"); if (b.error) throw new Error(/function/i.test(b.error.message) ? "Setup needed: run money.sql in Supabase." : b.error.message);
    var d = b.data || {}; if (!d.app) throw new Error("Open your seller account first (tap My shop & listings).");
    var p = await c.rpc("my_payments"), rows = (p && p.data) || [], KN = { promo: "Promotion", ad: "Banner advert", commission: "Sales fees", subscription: "Badge plan" };
    var fees = d.enabled ? '<div class="sh-card"><h3>Fees on your sales</h3><p>SafeBuy NG charges <b>' + esc(d.rate_pct) + "%</b> on each completed sale" + (d.verified ? " (Verified rate)" : ". Verified shops pay only " + esc(d.verified_pct) + "%") + ".</p>" +
      (Number(d.owed_kobo) > 0 ? '<div class="sh-nums"><div><b>' + naira(d.owed_kobo) + "</b><span>owed on " + num(d.orders) + ' sale' + (d.orders == 1 ? "" : "s") + '</span></div></div><button type="button" class="sh-btn" id="sh-payfees">Pay ' + naira(d.owed_kobo) + "</button>" + (Number(d.owed_kobo) < Number(d.min_invoice_kobo) ? '<p class="sh-msg">You can pay once fees reach ' + naira(d.min_invoice_kobo) + ".</p>" : "") : '<p class="sh-ok">You do not owe any fees. 🎉</p>') + "</div>" : "";
    return fees + '<div class="sh-card"><h3>My payments</h3>' + (rows.length ? rows.map(function (x) {
      return '<div class="sh-row"><div><b>' + esc(KN[x.kind] || x.kind) + '</b><small>' + naira(x.amount_kobo) + " · ref " + esc(x.reference) + " · " + new Date(x.created_at).toLocaleDateString("en-NG") + '</small></div><div style="text-align:right"><span class="sh-pill ' + (x.status === "confirmed" ? "approved" : x.status === "rejected" || x.status === "cancelled" ? "rejected" : "") + '">' + esc(x.status === "awaiting" ? "awaiting payment" : x.status) + "</span>" +
        ((x.status === "awaiting" || x.status === "reported") ? '<br><button type="button" class="sh-paynow" data-id="' + esc(x.id) + '" style="border:0;background:none;color:#087f5b;font:700 13px Arial;padding:6px 0;cursor:pointer">' + (x.status === "awaiting" ? "Pay now" : "View") + "</button>" : "") + "</div></div>";
    }).join("") : "<p>No payments yet.</p>") + "</div>";
  }

  /* ---- invite other sellers and earn ---- */
  async function vInvite() {
    var c = client(), r = await c.rpc("my_referral");
    if (r.error) throw new Error(/function/i.test(r.error.message) ? "Setup needed: run growth2.sql in Supabase." : r.error.message);
    var d = r.data || {}; if (!d.app) throw new Error("Open your seller account first (tap My shop & listings).");
    var S = d.settings || {}; if (S.enabled === false) return '<div class="sh-card"><p>Seller rewards are paused right now. Please check again soon.</p></div>';
    var link = root + "seller/?ref=" + encodeURIComponent(d.code), txt = "Sell on SafeBuy NG, free to list. Join with my link: " + link;
    return '<div class="sh-card"><h3>Earn free Verified-badge days</h3><p>For every shop you invite that gets approved, you get <b>' + (S.reward_days || 30) + " free days</b> of the Verified badge (up to " + (S.max_rewards || 20) + ' rewards).</p>' +
      '<div class="sh-code" id="sh-code">' + esc(d.code) + '</div><a class="sh-btn" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">Share on WhatsApp</a>' +
      '<button type="button" class="sh-btn alt" id="sh-copy" data-link="' + esc(link) + '">Copy my invite link</button></div>' +
      '<div class="sh-nums"><div><b>' + num(d.invited) + "</b><span>Invited</span></div><div><b>" + num(d.approved) + "</b><span>Approved</span></div><div><b>" + num(d.reward_days_total) + "</b><span>Free days earned</span></div></div>" +
      ((d.items || []).length ? '<div class="sh-card"><h3>Shops you invited</h3>' + d.items.map(function (i) { return '<div class="sh-row"><div><b>' + esc(i.shop || "New shop") + "</b><small>" + new Date(i.at).toLocaleDateString("en-NG") + '</small></div><span class="sh-pill ' + (i.rewarded ? "approved" : "") + '">' + (i.rewarded ? "Rewarded" : i.approved ? "Approved" : "Waiting for approval") + "</span></div>"; }).join("") + "</div>" : "");
  }

  /* ---- clicks inside the sheet ---- */
  async function openPayById(id, back) { var r = await client().rpc("my_payment", { p_id: id }); if (r.data) showPay(r.data, back); else toast("Could not open that payment."); }
  function wire(v) {
    var f = $("sh-form"), pr = $("sh-price");
    function upd() { if (!pr || !prices) return; var d = Number($("sh-days").value), k = pr.dataset.kind, rate = k === "ad" ? (prices.ad_day_kobo || {})[$("sh-slot").value] : prices[k]; pr.textContent = prices.charge_promos || k === "ad" ? "Price: " + naira(Number(rate || 0) * d) + " for " + d + " days" : "Free for now"; }
    if (pr && $("sh-days")) { $("sh-days").onchange = upd; if ($("sh-slot")) $("sh-slot").onchange = upd; upd(); }
    if (f) f.onsubmit = async function (e) {
      e.preventDefault(); var kind = f.dataset.kind, msg = $("sh-msg"), b = f.querySelector("button[type=submit]"), c = client();
      b.disabled = true; msg.className = "sh-msg"; msg.textContent = "Working…";
      try {
        var r;
        if (kind === "banner") {
          r = await c.rpc("submit_ad", { p_slot: $("sh-slot").value, p_days: Number($("sh-days").value), p_advertiser: $("sh-biz").value, p_phone: $("sh-phone").value, p_title: $("sh-title2").value, p_body: $("sh-body").value, p_button: $("sh-btnl").value, p_link: $("sh-link").value, p_image: $("sh-img").value });
        } else {
          r = await c.rpc("seller_order_promo", { p_kind: kind, p_product: kind === "product" ? $("sh-prod").value : null, p_days: Number($("sh-days").value), p_note: $("sh-note") ? $("sh-note").value : null, p_business: null, p_phone: null });
        }
        if (r.error) throw new Error(r.error.message);
        var d = r.data || {};
        if (d.free) { msg.className = "sh-msg sh-ok"; msg.textContent = "Request sent. We will reply in your notifications."; setTimeout(function () { if (cur === v) open(v); }, 900); return; }
        showPay(d.payment, v);
      } catch (er) { msg.className = "sh-msg sh-bad"; msg.textContent = er.message; b.disabled = false; }
    };
    bodyEl.querySelectorAll(".sh-cancel").forEach(function (b) {
      b.onclick = async function () { b.disabled = true; try { await client().rpc("seller_cancel_promo", { p_id: b.dataset.id }); } catch (e) {} open(v); };
    });
    bodyEl.querySelectorAll(".sh-paynow").forEach(function (b) { b.onclick = function () { openPayById(b.dataset.id, v); }; });
    bodyEl.querySelectorAll("[data-plan]").forEach(function (b) {
      b.onclick = async function () {
        var m = $("sh-msg"); b.disabled = true; var r = await client().rpc("seller_pay_plan", { p_plan: b.dataset.plan });
        if (r.error) { m.className = "sh-msg sh-bad"; m.textContent = r.error.message; b.disabled = false; return; } showPay(r.data, v);
      };
    });
    var pf = $("sh-payfees"); if (pf) pf.onclick = async function () {
      pf.disabled = true; var r = await client().rpc("seller_pay_fees"); if (r.error) { toast(r.error.message); pf.disabled = false; return; } showPay(r.data, v);
    };
    var cp = $("sh-copy"); if (cp) cp.onclick = function () {
      var l = cp.dataset.link;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(l).then(function () { cp.textContent = "Copied ✓"; }, function () { window.prompt("Copy your invite link", l); });
      else window.prompt("Copy your invite link", l);
    };
  }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-hub]"); if (b) { e.preventDefault(); open(b.dataset.hub); } });


  /* ---- "Next steps" coach: live checklist for this seller ---- */
  var COACH_CSS = "<style>.sh-coach{background:#fff;border:1px solid #e6ece8;border-radius:16px;padding:14px;margin:0 0 14px}.sh-coach h3{margin:0 0 4px;font-size:16px}.sh-bar{height:8px;border-radius:6px;background:#e6efe9;margin:8px 0 10px;overflow:hidden}.sh-bar i{display:block;height:100%;background:#087f5b}.sh-step{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-top:1px solid #eef2ef;background:none;padding:10px 0;font:14px Arial,sans-serif;color:#172b24;cursor:pointer}.sh-step:first-of-type{border-top:0}.sh-step .c{flex:0 0 22px;height:22px;border-radius:50%;border:2px solid #b8c7bd;display:grid;place-items:center;font-size:13px;color:#fff}.sh-step.done .c{background:#087f5b;border-color:#087f5b}.sh-step.done b{text-decoration:line-through;color:#8a9a90}.sh-step small{display:block;color:#718078;font-size:12px}</style>";
  async function drawCoach(host) {
    var c = client(); if (!host || !c) return;
    try {
      var r = await c.rpc("seller_coach"); if (r.error || !r.data || !r.data.app) { host.innerHTML = ""; return; }
      var steps = r.data.steps || [], done = steps.filter(function (x) { return x.done; }).length;
      var todo = steps.filter(function (x) { return !x.done; }).slice(0, 4);
      if (!todo.length) { host.innerHTML = COACH_CSS + '<div class="sh-coach"><h3>🎉 You have done every growth step</h3><p style="margin:4px 0 0;font-size:14px;color:#52675c">Keep your stock updated and reply fast to customers.</p></div>'; return; }
      host.innerHTML = COACH_CSS + '<div class="sh-coach"><h3>Your next steps</h3><div style="font-size:13px;color:#718078">' + done + " of " + steps.length + ' done</div><div class="sh-bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
        todo.map(function (x) { return '<button type="button" class="sh-step" data-coach="' + esc(x.go) + '"><span class="c"></span><span><b>' + esc(x.title) + "</b><small>" + esc(x.hint) + "</small></span></button>"; }).join("") + "</div>";
    } catch (e) { host.innerHTML = ""; }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-coach]"); if (!b) return; e.preventDefault();
    var go = b.dataset.coach;
    if (go === "sell") { var sell = document.querySelector('[data-action="sell"]'); hide(); if (sell) sell.click(); } else open(go);
  });
  function coachAll() { var h = $("sa-coach"); if (h) drawCoach(h); }

  /* ---- a card inside the seller panel ---- */
  function inject() {
    var body = $("account-body") || document.querySelector("#sell-body, .modal-body");
    var form = document.getElementById("product-form");
    if (!form || document.getElementById("hub-card") || !document.querySelector(".status-pill")) return;
    var host = document.createElement("div"); host.id = "hub-card"; host.className = "sh-card"; host.style.margin = "12px 0";
    host.innerHTML = "<h3>🚀 Grow my business</h3><p style=\"margin:0\">Get more customers with these tools.</p>" + tilesHtml();
    form.parentNode.insertBefore(host, form); claim();
  }
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
  var ci = setInterval(function () { var c = client(); if (c && c.auth) { clearInterval(ci); claim(); c.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN") setTimeout(claim, 1500); }); } }, 600);
  setTimeout(function () { clearInterval(ci); }, 30000);

  setTimeout(coachAll, 2500);
  var ci2 = setInterval(function () { var c = client(); if (c && c.auth) { clearInterval(ci2); c.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN") setTimeout(coachAll, 1500); }); } }, 700);
  setTimeout(function () { clearInterval(ci2); }, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) coachAll(); });
  window.__sbHub = { open: open, close: hide, coach: coachAll };
})();
