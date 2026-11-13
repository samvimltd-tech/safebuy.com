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
    ".sh-skel i{display:block;height:64px;border-radius:14px;margin:0 0 10px;background:linear-gradient(90deg,#eef2ef 25%,#f7faf8 50%,#eef2ef 75%);background-size:200% 100%;animation:shk 1.1s linear infinite}@keyframes shk{to{background-position:-200% 0}}" +
    ".sh-btn,.sh-tile,.sh-back,#sh-sheet button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}.sh-btn:active,.sh-tile:active{transform:scale(.98);opacity:.9}" +
    ".sh-tile{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid #e6ece8;border-radius:16px;background:#fff;padding:14px 12px;font:700 14px Arial,sans-serif;color:#172b24;cursor:pointer;min-height:88px}" +
    ".sh-tile small{font:400 12px/1.35 Arial,sans-serif;color:#718078}.sh-tile .e{font-size:24px;line-height:1}" +
    ".sh-card{background:#fff;border:1px solid #e6ece8;border-radius:14px;padding:14px;margin:0 0 12px}.sh-card h3{margin:0 0 6px;font-size:18px}.sh-card p{margin:0 0 8px;color:#52675c;font-size:16px;line-height:1.5}" +
    ".sh-nums{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.sh-nums div{flex:1;min-width:96px;background:#fff;border:1px solid #e6ece8;border-radius:12px;padding:10px}.sh-nums b{display:block;font-size:20px}.sh-nums span{font-size:14px;color:#718078}" +
    ".sh-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eef2ef;font-size:16px}.sh-row:first-child{border-top:0}.sh-row b{display:block}.sh-row small{color:#718078}.sh-row .n{font-weight:700;white-space:nowrap}" +
    ".sh-f label{display:block;margin:10px 0 4px;font-size:15px;font-weight:700}.sh-f select,.sh-f input,.sh-f textarea{width:100%;padding:11px;border:1px solid #cfd8d2;border-radius:10px;font:16px Arial,sans-serif;background:#fff}" +
    ".sh-btn{display:block;width:100%;margin-top:12px;padding:13px;border:0;border-radius:12px;background:#087f5b;color:#fff;font:700 15px Arial,sans-serif;cursor:pointer}.sh-btn.alt{background:#edf6ef;color:#066548}.sh-btn:disabled{opacity:.55}" +
    ".sh-msg{min-height:18px;margin:8px 0 0;font-size:15px}.sh-ok{color:#087f5b}.sh-bad{color:#b42318}" +
    ".sh-row .sh-pill{align-self:flex-start;white-space:nowrap}.sh-pill{display:inline-block;line-height:1.5;padding:2px 9px;border-radius:20px;font-size:13px;font-weight:700;background:#fff3e0;color:#7a4a05}.sh-pill.approved{background:#e7f7ef;color:#066548}.sh-pill.rejected,.sh-pill.cancelled,.sh-pill.ended{background:#eef0f1;color:#52606a}" +
    ".sh-code{font:800 28px Arial,sans-serif;letter-spacing:4px;text-align:center;padding:12px;border:2px dashed #087f5b;border-radius:12px;background:#f4fbf6;margin:8px 0}" +
    "#hub-card .sh-grid{margin-top:8px}";
  document.head.appendChild(st);
  var sh = document.createElement("div"); sh.id = "sh"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
  sh.innerHTML = '<div class="sh-top"><button type="button" id="sh-back" aria-label="Back" hidden>‹</button><strong id="sh-title">Grow my business</strong><button type="button" id="sh-x" aria-label="Close">✕</button></div><div class="sh-body" id="sh-body"></div>';
  document.body.appendChild(sh);
  var bodyEl = $("sh-body"), titleEl = $("sh-title"), backBtn = $("sh-back"), cur = "", payBack = "";
  function show() { sh.classList.add("open"); document.body.style.overflow = "hidden"; }
  function hide() { sh.classList.remove("open"); document.body.style.overflow = ""; }
  $("sh-x").addEventListener("click", hide); backBtn.addEventListener("click", function () { open(cur === "pay" ? (payBack || "home") : cur === "consol-form" ? "consol" : "home"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sh.classList.contains("open")) hide(); });

  var TILES = [
    ["promote", "📣", "Promote my products", "Get a product featured"], ["boost", "🚀", "Boost my shop", "Feature your whole shop"],
    ["impressions", "👁️", "Product impressions", "Times your products were shown"], ["enquiries", "💬", "Product enquiries", "Customers who asked about you"],
    ["clicks", "👆", "Customer clicks", "Times your products were opened"], ["upgrade", "⭐", "Upgrade my subscription", "Verified badge plan"],
    ["advertise", "📢", "Advertise my business", "Ask us to advertise your shop"], ["invite", "🎁", "Invite sellers, earn rewards", "Free badge days for every shop"],
    ["billing", "💳", "Payments & fees", "Pay for promotions, fees and plans"],
    ["social", "📱", "Social Media Marketing", "Facebook, Instagram and TikTok"],
    ["consol", "🤝", "Consolidation Ads", "Join shared daily, weekly and monthly campaigns"]
  ];
  var TITLES = { home: "Grow my business", promote: "Promote my products", boost: "Boost my shop", impressions: "Product impressions", enquiries: "Product enquiries", clicks: "Customer clicks", upgrade: "Upgrade my subscription", advertise: "Advertise my business", invite: "Invite sellers & earn", billing: "Payments & fees", social: "Social Media Marketing", consol: "Consolidation Ads", pay: "Pay now" };
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
    if (cur === "home") { bodyEl.innerHTML = '<div id="sh-coach"></div><p style="color:#52675c;font-size:16px;margin:0 0 12px">Tools to get more customers. Tap one to start.</p>' + tilesHtml(); drawCoach($("sh-coach")); return; }
    var v = cur, seen = viewCache[v];
    if (seen) { bodyEl.innerHTML = seen; wire(v); }
    else bodyEl.innerHTML = '<div class="sh-skel" aria-busy="true" aria-label="Loading"><i></i><i></i><i></i></div>';
    try {
      var html = await ({ impressions: vStat, enquiries: vStat, clicks: vStat, promote: vPromote, boost: vBoost, advertise: vAd, upgrade: vUpgrade, invite: vInvite, billing: vBilling, social: vSocial, consol: vConsol })[v](v);
      viewCache[v] = html;
      if (cur !== v) return;
      var ae = document.activeElement, typing = seen && ae && bodyEl.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
      if (!seen || (html !== seen && !typing)) { var top = bodyEl.scrollTop; bodyEl.innerHTML = html; wire(v); if (seen) bodyEl.scrollTop = top; }
    } catch (e) { if (cur === v && !seen) bodyEl.innerHTML = err(e); }
  }
  var viewCache = {};
  /* after any button press, drop remembered screens so the next screen is always fresh */
  document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("#sh-body .sh-btn, #sh-body button[data-wait-join], #sh-body button[data-wait-leave]")) viewCache = {}; }, true);

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
    return '<div class="sh-row"><div><small>Bank</small><b>' + esc(b.bank_name) + '</b></div></div><div class="sh-row"><div><small>Account number</small><b style="font-size:20px;letter-spacing:1px">' + esc(b.account_number) + '</b></div><button type="button" class="sh-cp" data-v="' + esc(b.account_number) + '" style="border:0;background:#edf6ef;color:#066548;border-radius:10px;padding:8px 12px;font:700 13px Arial;cursor:pointer">Copy</button></div><div class="sh-row"><div><small>Account name</small><b>' + esc(b.account_name) + "</b></div></div>" + (b.note ? '<p style="font-size:15px;color:#52675c">' + esc(b.note) + "</p>" : "");
  }
  /* the "send the money and tell us" panel, used by every payment */
  function showPay(p, back) {
    cur = "pay"; payBack = back || cur; show(); titleEl.textContent = "Pay now"; backBtn.hidden = false; bodyEl.scrollTop = 0;
    var done = p.status === "confirmed", rep = p.status === "reported", bad = p.status === "rejected" || p.status === "cancelled";
    var cardBlock = (p.card && !done && !bad && !rep) ? '<div class="sh-card"><h3>💳 Pay by card</h3><p>Pay <b>' + naira(p.amount_kobo) + '</b> safely on Paystack. It switches on straight away. We never see your card number.</p>' +
      (p.renewable ? '<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;font-size:16px;line-height:1.45"><input type="checkbox" id="sh-renew" style="width:22px;height:22px;min-width:22px;flex:0 0 22px;margin:2px 0 0;padding:0;accent-color:#087f5b"><span>Renew automatically. Charge my card again when this period ends, until I stop it. I can stop any time in Payments &amp; fees.</span></label>' : '') +
      '<button type="button" class="sh-btn" id="sh-card">Pay ' + naira(p.amount_kobo) + ' by card</button><p class="sh-msg" id="sh-cmsg" role="status"></p></div>' : '';
    bodyEl.innerHTML = cardBlock + '<div class="sh-card"><h3>' + (cardBlock ? 'Or pay ' : 'Pay ') + naira(p.amount_kobo) + (cardBlock ? ' by bank transfer' : '') + '</h3>' +
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
    var cb = $("sh-card"); if (cb) cb.onclick = async function () {
      var m = $("sh-cmsg"); cb.disabled = true; m.className = "sh-msg"; m.textContent = "Opening secure payment…";
      try {
        var cfg = window.SAFEbuySupabaseConfig, ses = await client().auth.getSession(), tok = ses.data.session.access_token;
        var r = await fetch(String(cfg.url).replace(/\/+$/, "") + "/functions/v1/paystack-cards", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, apikey: cfg.publishableKey },
          body: JSON.stringify({ action: "init", reference: p.reference, renew: !!($("sh-renew") && $("sh-renew").checked), back: location.href.split("#")[0].split("?")[0] }) });
        var j = await r.json().catch(function () { return {}; }); if (!r.ok || !j.url) throw new Error(j.error || "Could not start the payment. Please try again.");
        location.href = j.url;
      } catch (er) { m.className = "sh-msg sh-bad"; m.textContent = er.message; cb.disabled = false; }
    };
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
        (x.status === "pending" ? '<br><button type="button" class="sh-cancel" data-id="' + esc(x.id) + '" style="border:0;background:none;color:#b42318;font-size:14px;padding:6px 0;cursor:pointer">Cancel</button>' : "") + "</div></div>";
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
  function fdate(t) { try { return new Date(t).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }); } catch (e) { return ""; } }
  function fdt(t) { try { return new Date(t).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }); } catch (e) { return ""; } }
  async function autoHtml() {
    var r = await client().rpc("autorenew_my"); if (r.error || !r.data) return ""; var d = r.data, items = d.items || [];
    if (!d.enabled && !items.length && !d.card) return "";
    var h = '<div class="sh-card"><h3>🔁 Automatic renewals</h3>';
    if (d.card) h += '<div class="sh-row"><div><b>Saved card</b><small>' + esc((d.card.brand || "Card") + " ending " + (d.card.last4 || "") + (d.card.exp ? " · expires " + d.card.exp : "")) + '</small></div><button type="button" id="sh-cardrm" style="border:0;background:none;color:#b42318;font:700 14px Arial;cursor:pointer">Remove card</button></div>';
    h += items.length ? items.map(function (x) {
      var bad = x.status === "past_due";
      return '<div class="sh-row"><div><b>' + esc(x.label) + '</b><small>' + (bad ? "Stopped: " + esc(x.error || "card declined") : "Next charge " + fdate(x.next_charge_at) + (x.amount_kobo ? " · about " + naira(x.amount_kobo) : "")) + '</small></div><button type="button" class="sh-arstop" data-id="' + esc(x.id) + '" style="border:0;background:#fdecea;color:#b42318;border-radius:10px;padding:8px 12px;font:700 14px Arial;cursor:pointer">' + (bad ? "Remove" : "Stop") + "</button></div>";
    }).join("") : "<p>Nothing renews automatically. When you pay by card, tick <b>Renew automatically</b> to keep a tool running without paying each time.</p>";
    return h + '<p class="sh-msg" id="sh-armsg" role="status"></p></div>';
  }
  async function vBilling() {
    var c = client(), b = await c.rpc("seller_billing"); if (b.error) throw new Error(/function/i.test(b.error.message) ? "Setup needed: run money.sql in Supabase." : b.error.message);
    var d = b.data || {}; if (!d.app) throw new Error("Open your seller account first (tap My shop & listings).");
    var p = await c.rpc("my_payments"), rows = (p && p.data) || [], KN = { promo: "Promotion", ad: "Banner advert", commission: "Sales fees", subscription: "Badge plan" };
    var fees = d.enabled ? '<div class="sh-card"><h3>Fees on your sales</h3><p>SafeBuy NG charges <b>' + esc(d.rate_pct) + "%</b> on each completed sale" + (d.verified ? " (Verified rate)" : ". Verified shops pay only " + esc(d.verified_pct) + "%") + ".</p>" +
      (Number(d.owed_kobo) > 0 ? '<div class="sh-nums"><div><b>' + naira(d.owed_kobo) + "</b><span>owed on " + num(d.orders) + ' sale' + (d.orders == 1 ? "" : "s") + '</span></div></div><button type="button" class="sh-btn" id="sh-payfees">Pay ' + naira(d.owed_kobo) + "</button>" + (Number(d.owed_kobo) < Number(d.min_invoice_kobo) ? '<p class="sh-msg">You can pay once fees reach ' + naira(d.min_invoice_kobo) + ".</p>" : "") : '<p class="sh-ok">You do not owe any fees. 🎉</p>') + "</div>" : "";
    return fees + (await autoHtml()) + '<div class="sh-card"><h3>My payments</h3>' + (rows.length ? rows.map(function (x) {
      return '<div class="sh-row"><div><b>' + esc(KN[x.kind] || x.kind) + '</b><small>' + naira(x.amount_kobo) + " · ref " + esc(x.reference) + " · " + new Date(x.created_at).toLocaleDateString("en-NG") + '</small></div><div style="text-align:right"><span class="sh-pill ' + (x.status === "confirmed" ? "approved" : x.status === "rejected" || x.status === "cancelled" ? "rejected" : "") + '">' + esc(x.status === "awaiting" ? "awaiting payment" : x.status) + "</span>" +
        ((x.status === "awaiting" || x.status === "reported") ? '<br><button type="button" class="sh-paynow" data-id="' + esc(x.id) + '" style="border:0;background:none;color:#087f5b;font:700 13px Arial;padding:6px 0;cursor:pointer">' + (x.status === "awaiting" ? "Pay now" : "View") + "</button>" : "") + "</div></div>";
    }).join("") : "<p>No payments yet.</p>") + "</div>";
  }

  /* ---- Consolidation Advertising ---- */
  var CON = null, CK = 'style="width:22px;height:22px;min-width:22px;flex:0 0 22px;margin:2px 0 0;padding:0;accent-color:#087f5b"';
  var TYPE_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  function pill(t, cls) { return '<span class="sh-pill ' + (cls || "") + '">' + esc(t) + "</span>"; }
  async function vConsol() {
    var r = await client().rpc("consol_overview"); if (r.error) throw new Error(/function/i.test(r.error.message) ? "Setup needed: run consolidation.sql in Supabase." : r.error.message);
    var d = r.data || {}; if (!d.app) throw new Error("Open your seller account first (tap My shop & listings)."); CON = d;
    var cs = d.campaigns || [];
    var intro = '<div class="sh-card"><p>Join shared advertising campaigns with other sellers. SafeBuy NG promotes everyone’s products together on the SafeBuy website and our social pages. Every product is checked first, so joining does not guarantee that each product is approved.</p></div>';
    if (!cs.length) return intro + '<div class="sh-card"><h3>No campaign is open right now</h3><p>New daily, weekly and monthly campaigns open by themselves. You will get a notification when registration opens.</p></div>';
    return intro + cs.map(conCard).join("");
  }
  function conCard(c) {
    var st = c.stats || {}, items = c.items || [], bk = c.bucket ? " · Bucket " + String(c.bucket).padStart(3, "0") : "", h = '<div class="sh-card"><h3>' + esc(c.name) + esc(bk) + "</h3>";
    var open = c.status === "open", live = c.status === "running" || c.status === "paused", done = c.status === "completed";
    h += '<p style="margin:0 0 6px">' + pill(TYPE_LABEL[c.type] || c.type) + " " + pill(open ? "Registration open" : c.full && c.status === "closed" ? "FULL" : c.status === "draft" ? "Opens " + fdt(c.opens_at) : live ? "Live now" : done ? "Finished" : c.status === "closed" ? "Registration closed" : c.status, open || live ? "approved" : c.status === "cancelled" ? "rejected" : "") + "</p>";
    h += '<div class="sh-row" style="flex-wrap:wrap"><div><small>Fee to join</small><b>' + naira(c.fee_kobo) + '</b></div><div><small>Products you can enter</small><b>' + c.per_seller + "</b></div></div>" +
      '<div class="sh-row" style="flex-wrap:wrap"><div><small>Registration closes</small><b>' + fdt(c.deadline_at) + '</b></div><div><small>Launches</small><b>' + fdt(c.launch_at) + "</b></div></div>";
    if (c.max) {
      var pct = Math.min(100, Math.round((c.occupied || 0) / c.max * 100)), left = c.spots_left;
      h += '<div style="margin:8px 0 2px;font-weight:700;font-size:16px">' + (c.occupied || 0) + " of " + c.max + ' places taken' + (open ? (left > 0 ? " · " + left + " left" : " · " + (c.full ? "FULL" : "all reserved")) : c.full ? " · FULL" : "") + '</div>' +
        '<div style="height:12px;background:#e3ece7;border-radius:8px;overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:' + (pct >= 100 ? "#c2410c" : "#087f5b") + '"></i></div>';
    }
    if (c.joined) {
      h += (items.length ? items.map(function (x) { return '<div class="sh-row"><div><b>' + esc(x.name || "Product") + "</b>" + (x.reason ? "<small>" + esc(x.reason) + "</small>" : "") + "</div>" + pill(x.status === "pending" ? "In review" : x.status === "approved" ? "Approved" : x.status === "rejected" ? "Not approved" : x.status, x.status === "approved" ? "approved" : x.status === "rejected" ? "rejected" : "") + "</div>"; }).join("") : "");
      if (c.part_status === "refund_due") h += '<p class="sh-ok" style="margin-top:8px">Your fee is being refunded.</p>';
      else if (c.part_status === "refunded") h += '<p class="sh-ok" style="margin-top:8px">Your fee was refunded.</p>';
      else if (!c.paid && c.payment && c.payment.status !== "confirmed" && open) h += (c.reserved_until ? '<p style="margin:8px 0 0;font-weight:700;color:#b45309">Your place is held until ' + fdt(c.reserved_until) + ". Pay before then to keep it.</p>" : "") + '<button type="button" class="sh-btn" data-con-pay="' + esc(c.id) + '">Pay ' + naira(c.fee_kobo) + " to confirm your place</button>";
      else if (c.paid) h += '<p class="sh-ok" style="margin-top:8px"><b>✓ You are in' + (c.slot ? ": Slot " + String(c.slot).padStart(3, "0") : "") + '.</b>' + (live || done ? "" : " We will tell you when your products are approved and when it launches.") + "</p>";
      if ((live || done) && c.paid) h += '<div class="sh-nums" style="margin-top:10px"><div><b>' + num(st.impressions) + "</b><span>Times shown on SafeBuy</span></div><div><b>" + num(st.clicks) + "</b><span>Opens</span></div><div><b>" + num(st.enquiries) + "</b><span>Customers asked</span></div></div><p style=\"font-size:13px;color:#718078;margin:4px 0 0\">These are real counts from SafeBuy NG. Social platforms report their own numbers separately.</p>";
      if (open && c.part_status !== "refund_due" && c.part_status !== "refunded") h += '<button type="button" class="sh-btn alt" data-con-join="' + esc(c.id) + '">Change my products</button>' + (!c.paid ? '<button type="button" class="sh-btn alt" data-con-leave="' + esc(c.id) + '" style="color:#b42318">Leave this campaign</button>' : "");
    } else if (open && c.spots_left > 0) h += (c.wait && c.wait.status === "offered" ? '<p class="sh-ok" style="margin-top:8px"><b>A place is held for you until ' + fdt(c.wait.until) + ".</b></p>" : "") + '<button type="button" class="sh-btn" data-con-join="' + esc(c.id) + '">Join for ' + naira(c.fee_kobo) + "</button>";
    else if (open && c.wait) h += '<p class="sh-ok" style="margin-top:8px">You are on the waiting list: number ' + c.wait.pos + '. We will tell you if a place opens.</p><button type="button" class="sh-btn alt" data-wait-leave="' + esc(c.id) + '">Leave the waiting list</button>';
    else if (open) h += '<p style="margin:8px 0 0;color:#52675c">Every place is reserved right now' + (c.waiting ? " (" + c.waiting + " waiting)" : "") + '. If a payment is not completed, the place goes to the waiting list.</p><button type="button" class="sh-btn alt" data-wait-join="' + esc(c.id) + '">Join the waiting list</button>';
    else if (c.full && c.status === "closed") h += '<p style="margin:8px 0 0;color:#52675c">This bucket is full. The next bucket is open above.</p>';
    return h + "</div>";
  }
  function conForm(id) {
    var c = (CON.campaigns || []).filter(function (x) { return x.id === id; })[0]; if (!c) return;
    cur = "consol-form"; titleEl.textContent = "Join: " + c.name; backBtn.hidden = false; payBack = "consol"; bodyEl.scrollTop = 0;
    var chosen = {}; (c.items || []).forEach(function (x) { if (x.status !== "removed") chosen[x.product] = 1; });
    var P = CON.products || [];
    bodyEl.innerHTML = '<div class="sh-card"><h3>Choose up to ' + c.per_seller + " product" + (c.per_seller == 1 ? "" : "s") + '</h3><form class="sh-f" id="con-form">' +
      (P.length ? P.map(function (p) { return '<label style="display:flex;gap:10px;align-items:center;margin:8px 0;font-size:16px;font-weight:600"><input type="checkbox" class="con-p" value="' + esc(p.id) + '" ' + (chosen[p.id] ? "checked " : "") + CK + '><span style="flex:1">' + esc(p.name) + '<br><small style="font-weight:400;color:#718078">' + naira(p.price_kobo) + "</small></span></label>"; }).join("") : "<p>You have no products in stock yet. Add a product first.</p>") +
      '<label style="display:flex;gap:10px;align-items:flex-start;margin:14px 0 4px;font-size:15px;font-weight:600;line-height:1.45"><input type="checkbox" id="con-ok" ' + CK + '><span>I confirm the prices and stock are right, and I allow SafeBuy NG to use my product photos and details in this campaign. I know SafeBuy NG checks each product and may not approve all of them.</span></label>' +
      '<button class="sh-btn" type="submit"' + (P.length ? "" : " disabled") + '>' + (c.joined ? "Save my products" : "Continue · fee " + naira(c.fee_kobo)) + '</button><p class="sh-msg" id="con-msg" role="status"></p></form></div>';
    var f = $("con-form"); if (!f) return;
    f.onsubmit = async function (e) {
      e.preventDefault(); var m = $("con-msg"), b = f.querySelector("button[type=submit]"); m.className = "sh-msg";
      var ids = [].slice.call(f.querySelectorAll(".con-p:checked")).map(function (x) { return x.value; });
      if (!ids.length) { m.className = "sh-msg sh-bad"; m.textContent = "Choose at least one product."; return; }
      if (ids.length > c.per_seller) { m.className = "sh-msg sh-bad"; m.textContent = "You can choose up to " + c.per_seller + "."; return; }
      if (!$("con-ok").checked) { m.className = "sh-msg sh-bad"; m.textContent = "Please tick the box to continue."; return; }
      b.disabled = true; m.textContent = "Saving…";
      var r = await client().rpc("consol_join", { p_campaign: id, p_products: ids, p_consent: true });
      if (r.error) { m.className = "sh-msg sh-bad"; m.textContent = r.error.message; b.disabled = false; return; }
      if (r.data && r.data.payment) showPay(r.data.payment, "consol"); else open("consol");
    };
  }
  function wireConsol() {
    bodyEl.querySelectorAll("[data-con-join]").forEach(function (b) { b.onclick = function () { conForm(b.dataset.conJoin); }; });
    bodyEl.querySelectorAll("[data-con-pay]").forEach(function (b) { b.onclick = function () {
      var c = (CON.campaigns || []).filter(function (x) { return x.id === b.dataset.conPay; })[0]; if (c && c.payment) showPay(c.payment, "consol"); }; });
    bodyEl.querySelectorAll("[data-wait-join]").forEach(function (b) { b.onclick = async function () { b.disabled = true; var r = await client().rpc("consol_wait_join", { p_campaign: b.dataset.waitJoin }); if (r.error) toast(r.error.message); open("consol"); }; });
    bodyEl.querySelectorAll("[data-wait-leave]").forEach(function (b) { b.onclick = async function () { b.disabled = true; await client().rpc("consol_wait_leave", { p_campaign: b.dataset.waitLeave }); open("consol"); }; });
    bodyEl.querySelectorAll("[data-con-leave]").forEach(function (b) { b.onclick = async function () {
      if (!window.confirm("Leave this campaign?")) return; b.disabled = true; var r = await client().rpc("consol_leave", { p_campaign: b.dataset.conLeave }); if (r.error) toast(r.error.message); open("consol"); }; });
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


  /* ---- Social Media Marketing: connect pages, ready-made posts, schedule, paid campaigns, results ---- */
  var SOC = { data: null, prods: [] };
  var PL = { facebook: ["Facebook", "fb", "📘"], instagram: ["Instagram", "ig", "📸"], tiktok: ["TikTok", "tt", "🎵"], whatsapp: ["WhatsApp", "wa", "💬"] };
  function tag(s) { return "#" + String(s || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24); }
  function kitFor(p, plat) {
    var link = root + "?p=" + encodeURIComponent(p.id) + "&src=" + PL[plat][1], price = naira(p.price_kobo), d = String(p.description || "").replace(/\s+/g, " ").trim().slice(0, 140);
    var first = String(p.name || "").split(" ")[0], tags = ["#SafeBuyNG", "#ShopNaija", "#MadeInNigeria", tag(p.category), tag(first)].filter(function (t) { return t.length > 2; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).join(" ");
    var body;
    if (plat === "tiktok") body = "🔥 " + p.name + " - " + price + "\n" + (d ? d + "\n" : "") + "Order safely on SafeBuy NG. Link in my bio 👆\n" + link + "\n" + tags;
    else if (plat === "instagram") body = "✨ " + p.name + " is now on SafeBuy NG!\n" + (d ? d + "\n" : "") + "💰 " + price + "\nOrder safely from our shop. Tap the link in our bio.\n" + link + "\n.\n" + tags;
    else if (plat === "whatsapp") body = "Hello 👋 " + p.name + " is available for " + price + ". " + (d ? d + " " : "") + "Order safely here: " + link;
    else body = "✨ " + p.name + " now available on SafeBuy NG!\n" + (d ? d + "\n" : "") + "💰 " + price + "\nOrder directly from our shop 👉 " + link + "\n" + tags;
    return { text: body, link: link };
  }
  function when(s) { try { return new Date(s).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } }
  function localInput(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); }
  function roas(sales, spend) { return Number(spend) > 0 ? (Number(sales) / Number(spend)).toFixed(1) + "x" : "-"; }
  var CST = { awaiting_payment: "Waiting for your payment", paid: "Paid. We are setting it up", running: "Running", finished: "Finished", rejected: "Not run", cancelled: "Cancelled" };

  async function vSocial() {
    var c = client(); if (!c) throw new Error("Still connecting. Try again in a moment.");
    var r = await c.rpc("social_overview"); if (r.error) throw new Error(/function/i.test(r.error.message) ? "Setup needed: run social.sql in Supabase." : r.error.message);
    var pr = await c.rpc("social_products"); SOC.data = r.data || {}; SOC.prods = (pr && pr.data) || [];
    var D = SOC.data, P = D.pricing || {}, acc = {}; (D.accounts || []).forEach(function (a) { acc[a.platform] = a; });
    var pass = D.pass_until ? "Social Pass active until " + new Date(D.pass_until).toLocaleDateString("en-NG") : "";
    var opts = SOC.prods.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("");
    var h = '<div class="sh-card"><h3>Grow beyond SafeBuy</h3><p>Connect your pages, get ready-made posts for every product, schedule them, and let us run paid ads for you on Facebook, Instagram and TikTok.</p></div>';
    h += '<div class="sh-card"><h3>1. Your accounts</h3><form class="sh-f" id="so-acc">' + ["facebook", "instagram", "tiktok"].map(function (k) {
      var a = acc[k] || {}; return '<label for="so-h-' + k + '">' + PL[k][2] + " " + PL[k][0] + ' page or username</label><input id="so-h-' + k + '" maxlength="60" value="' + esc(a.handle || "") + '" placeholder="e.g. @mybrand"><input id="so-u-' + k + '" maxlength="250" inputmode="url" value="' + esc(a.url || "") + '" placeholder="Page link (https://…)" style="margin-top:6px">';
    }).join("") + '<button class="sh-btn" type="submit">Save my accounts</button><p class="sh-msg" id="so-accmsg" role="status"></p></form>' +
      '<p style="font-size:14px;color:#718078;margin-top:8px">We never ask for your password. Posts are shared from your own phone, so you stay in control.</p></div>';
    h += '<div class="sh-card"><h3>2. Make a post</h3>' + (SOC.prods.length ? '<form class="sh-f" id="so-post"><label for="so-prod">Product</label><select id="so-prod">' + opts + '</select>' +
      '<label for="so-plat">Where will you post it?</label><select id="so-plat">' + Object.keys(PL).map(function (k) { return '<option value="' + k + '">' + PL[k][0] + "</option>"; }).join("") + '</select>' +
      '<div id="so-img"></div><label for="so-cap">Caption (ready for you, edit if you like)</label><textarea id="so-cap" rows="7" maxlength="1500"></textarea>' +
      '<button type="button" class="sh-btn" id="so-share">Share now</button><button type="button" class="sh-btn alt" id="so-copycap">Copy caption</button>' +
      '<label for="so-when">Or schedule it (we will remind you)</label><input id="so-when" type="datetime-local" value="' + localInput(new Date(Date.now() + 3600000)) + '">' +
      '<button type="button" class="sh-btn alt" id="so-sched">Schedule this post</button><p class="sh-msg" id="so-postmsg" role="status"></p></form>' : '<p>Add a product first (My shop &amp; listings), then your post is made for you.</p>') + "</div>";
    var posts = (D.posts || []).filter(function (x) { return x.status === "scheduled"; });
    h += '<div class="sh-card"><h3>Scheduled posts</h3>' + (posts.length ? posts.map(function (x) {
      var due = new Date(x.scheduled_at) <= new Date();
      return '<div class="sh-row"><div><b>' + esc(PL[x.platform] ? PL[x.platform][0] : x.platform) + (x.product ? " · " + esc(x.product) : "") + "</b><small>" + esc(when(x.scheduled_at)) + (due ? " · due now" : "") + "</small></div><div style=\"display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end\">" +
        '<button type="button" class="sh-btn alt" style="margin:0;width:auto;padding:8px 10px" data-so="share" data-id="' + esc(x.id) + '" data-plat="' + esc(x.platform) + '" data-cap="' + esc(x.caption) + '">Post now</button>' +
        '<button type="button" class="sh-btn alt" style="margin:0;width:auto;padding:8px 10px" data-so="del" data-id="' + esc(x.id) + '">Delete</button></div></div>';
    }).join("") : '<p>Nothing scheduled.</p>') + (pass ? '<p class="sh-ok" style="margin-top:8px"><b>' + esc(pass) + "</b></p>" : '<p style="font-size:15px;margin-top:8px">Free: ' + (P.free_scheduled || 3) + ' scheduled posts at a time. <b>Social Pass</b> (' + naira(P.pass_kobo) + " for " + (P.pass_days || 30) + ' days) gives unlimited scheduling.</p><button type="button" class="sh-btn alt" id="so-pass">Get the Social Pass</button>') + "</div>";
    h += '<div class="sh-card"><h3>3. Paid ads (we run them for you)</h3><p>Pay once. We set up and run your ads on the platforms you choose and show the results here. The ad budget goes to the platform; our management fee is separate and shown before you pay.</p>' +
      (SOC.prods.length ? '<form class="sh-f" id="so-camp"><label for="so-cprod">Product to advertise</label><select id="so-cprod">' + opts + "</select><label>Platforms</label>" +
        ["facebook", "instagram", "tiktok"].map(function (k) { return '<label style="font-weight:400"><input type="checkbox" class="so-cp" value="' + k + '" style="width:auto;margin-right:8px"' + (k === "facebook" ? " checked" : "") + ">" + PL[k][2] + " " + PL[k][0] + "</label>"; }).join("") +
        '<label for="so-bud">Ad budget in naira (smallest ' + naira(P.min_budget_kobo) + ')</label><input id="so-bud" inputmode="numeric" value="' + Math.round(Number(P.min_budget_kobo || 500000) / 100) + '">' +
        '<label for="so-cdays">How many days?</label><select id="so-cdays"><option>3</option><option selected>7</option><option>14</option><option>30</option></select>' +
        '<label for="so-obj">Goal</label><select id="so-obj"><option>Get more orders</option><option>Get more customer messages</option><option>Get more people to see my shop</option></select>' +
        '<label for="so-aud">Who should see it? (town, age, interests)</label><textarea id="so-aud" rows="2" maxlength="400" placeholder="e.g. Women 25-45 in Lagos who like fashion"></textarea>' +
        '<label for="so-cphone">Your phone or WhatsApp number</label><input id="so-cphone" inputmode="tel" maxlength="20">' +
        '<p id="so-quote" style="font-weight:700;margin:10px 0 0"></p><button class="sh-btn" type="submit">Continue to payment</button><p class="sh-msg" id="so-cmsg" role="status"></p></form>' : "<p>Add a product first.</p>") + "</div>";
    var camps = D.campaigns || [];
    h += '<div class="sh-card"><h3>Your campaigns</h3>' + (camps.length ? camps.map(function (x) {
      return '<div class="sh-row"><div><b>' + esc(x.product || "Campaign") + "</b><small>" + (x.platforms || []).map(function (k) { return PL[k] ? PL[k][0] : k; }).join(", ") + " · budget " + naira(x.budget_kobo) + " · " + x.days + " days</small>" +
        (x.status === "running" || x.status === "finished" ? "<small>Reach " + num(x.reach) + " · Clicks " + num(x.clicks) + " · Messages " + num(x.enquiries) + " · Orders " + num(x.purchases) + " · Spent " + naira(x.spend_kobo) + "</small>" : "") + (x.admin_note ? "<small>" + esc(x.admin_note) + "</small>" : "") + '</div><div><span class="sh-pill">' + esc(CST[x.status] || x.status) + "</span>" +
        (x.status === "awaiting_payment" ? '<button type="button" class="sh-btn" style="margin:6px 0 0;padding:8px 10px" data-so="paycamp" data-id="' + esc(x.payment_id) + '">Pay now</button><button type="button" class="sh-btn alt" style="margin:6px 0 0;padding:8px 10px" data-so="cancelcamp" data-id="' + esc(x.id) + '">Cancel</button>' : "") + "</div></div>";
    }).join("") : "<p>No campaigns yet.</p>") + "</div>";
    var pl = D.platforms || [], vis = D.visits || {}, sb = D.safebuy || {}, tv = Number(vis.fb || 0) + Number(vis.ig || 0) + Number(vis.tt || 0) + Number(vis.wa || 0);
    h += '<div class="sh-card"><h3>4. Which platform brings customers?</h3><div class="sh-nums"><div><b>' + num(sb.product_views_30d) + "</b><span>Views on SafeBuy (30 days)</span></div><div><b>" + num(tv) + "</b><span>Visits from your social links</span></div></div>" +
      ["fb", "ig", "tt", "wa"].map(function (k) { var nm = { fb: "Facebook", ig: "Instagram", tt: "TikTok", wa: "WhatsApp" }[k]; return '<div class="sh-row"><div><b>' + nm + "</b><small>Visits to your products from your " + nm + " links</small></div><b>" + num(vis[k]) + "</b></div>"; }).join("") +
      (pl.length ? "<h3 style=\"margin-top:12px\">Paid ad results</h3>" + pl.map(function (x) { return '<div class="sh-row"><div><b>' + esc(PL[x.platform] ? PL[x.platform][0] : x.platform) + "</b><small>Reach " + num(x.reach) + " · Clicks " + num(x.clicks) + " · Messages " + num(x.enquiries) + " · Orders " + num(x.purchases) + "</small><small>Spent " + naira(x.spend_kobo) + " · Sales " + naira(x.sales_kobo) + "</small></div><b>" + roas(x.sales_kobo, x.spend_kobo) + "</b></div>"; }).join("") + '<p style="font-size:14px;color:#718078;margin-top:6px">The big number is sales for every ₦1 spent. Results are entered by our team from the platform reports.</p>' : '<p style="font-size:15px;margin-top:8px">Paid ad results appear here after your first campaign.</p>') + "</div>";
    return h;
  }

  function wireSocial() {
    var c = client(), D = SOC.data || {}, P = D.pricing || {};
    function msg(id, t, ok) { var m = $(id); if (m) { m.className = "sh-msg " + (ok ? "sh-ok" : "sh-bad"); m.textContent = t; } }
    function product() { var s = $("so-prod"); return s ? SOC.prods.filter(function (p) { return p.id === s.value; })[0] : null; }
    function refresh() { var p = product(); if (!p) return; var plat = $("so-plat").value, k = kitFor(p, plat); $("so-cap").value = k.text;
      $("so-img").innerHTML = p.image ? '<img src="' + esc(p.image) + '" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-top:8px" referrerpolicy="no-referrer"><p style="font-size:14px;color:#718078;margin:4px 0 0">Press and hold the picture to save it, then attach it when you post.</p>' : ""; }
    if ($("so-prod")) { $("so-prod").onchange = refresh; $("so-plat").onchange = refresh; refresh(); }
    var af = $("so-acc"); if (af) af.onsubmit = async function (e) {
      e.preventDefault(); var b = af.querySelector("button"); b.disabled = true; var n = 0, bad = "";
      for (var k of ["facebook", "instagram", "tiktok"]) { var h = $("so-h-" + k).value.trim(), u = $("so-u-" + k).value.trim(); if (!h && !u) continue; var r = await c.rpc("social_save_account", { p_platform: k, p_handle: h, p_url: u }); if (r.error) { bad = PL[k][0] + ": " + r.error.message; break; } n++; }
      b.disabled = false; if (bad) msg("so-accmsg", bad, false); else msg("so-accmsg", n ? "Saved." : "Nothing to save.", n > 0);
    };
    function shareNow(plat, cap, link, img) {
      var done = function () { toast("Caption copied. Paste it when you post."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cap).then(done, function () {});
      var url = plat === "facebook" ? "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link) + "&quote=" + encodeURIComponent(cap) : plat === "whatsapp" ? "https://wa.me/?text=" + encodeURIComponent(cap) : "";
      if (navigator.share) { navigator.share({ title: "SafeBuy NG", text: cap, url: link }).catch(function () {}); return; }
      if (url) window.open(url, "_blank", "noopener"); else if (plat === "instagram") window.open("https://www.instagram.com/", "_blank", "noopener"); else if (plat === "tiktok") window.open("https://www.tiktok.com/upload", "_blank", "noopener");
    }
    var sb = $("so-share"); if (sb) sb.onclick = function () { var p = product(); if (!p) return; var plat = $("so-plat").value; shareNow(plat, $("so-cap").value, kitFor(p, plat).link); };
    var cc = $("so-copycap"); if (cc) cc.onclick = function () { var t = $("so-cap").value; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { cc.textContent = "Copied ✓"; }, function () { window.prompt("Copy your caption", t); }); else window.prompt("Copy your caption", t); };
    var sc = $("so-sched"); if (sc) sc.onclick = async function () {
      var p = product(); if (!p) return; sc.disabled = true;
      var r = await c.rpc("social_schedule", { p_product: p.id, p_platform: $("so-plat").value, p_caption: $("so-cap").value, p_when: new Date($("so-when").value).toISOString() });
      sc.disabled = false; if (r.error) { msg("so-postmsg", r.error.message, false); return; } msg("so-postmsg", "Scheduled. We will notify you when it is time.", true); setTimeout(function () { if (cur === "social") open("social"); }, 900);
    };
    bodyEl.querySelectorAll("[data-so]").forEach(function (b) {
      b.onclick = async function () {
        var k = b.dataset.so, id = b.dataset.id;
        if (k === "share") { shareNow(b.dataset.plat, b.dataset.cap, root); await c.rpc("social_post_done", { p_id: id, p_skip: false }); setTimeout(function () { if (cur === "social") open("social"); }, 600); }
        else if (k === "del") { await c.rpc("social_post_delete", { p_id: id }); open("social"); }
        else if (k === "paycamp") openPayById(id, "social");
        else if (k === "cancelcamp") { if (!window.confirm("Cancel this campaign?")) return; var r = await c.rpc("social_cancel_campaign", { p_id: id }); if (r.error) toast(r.error.message); open("social"); }
      };
    });
    var pp = $("so-pass"); if (pp) pp.onclick = async function () { pp.disabled = true; var r = await c.rpc("social_pay_pass"); if (r.error) { toast(r.error.message); pp.disabled = false; return; } showPay(r.data, "social"); };
    var cf = $("so-camp");
    if (cf) {
      var q = async function () { var kb = Math.round(Number($("so-bud").value || 0) * 100); if (!kb) { $("so-quote").textContent = ""; return; } var r = await c.rpc("social_quote", { p_budget_kobo: kb }); if (r.data) $("so-quote").textContent = "Ad budget " + naira(r.data.budget_kobo) + " + our management fee " + naira(r.data.fee_kobo) + " = " + naira(r.data.total_kobo); };
      $("so-bud").oninput = q; q();
      cf.onsubmit = async function (e) {
        e.preventDefault(); var b = cf.querySelector("button[type=submit]"), pls = [].slice.call(cf.querySelectorAll(".so-cp:checked")).map(function (x) { return x.value; }); b.disabled = true; msg("so-cmsg", "Working…", true);
        var r = await c.rpc("social_request_campaign", { p_product: $("so-cprod").value, p_platforms: pls, p_budget_kobo: Math.round(Number($("so-bud").value || 0) * 100), p_days: Number($("so-cdays").value), p_objective: $("so-obj").value, p_audience: $("so-aud").value, p_caption: "", p_phone: $("so-cphone").value });
        if (r.error) { msg("so-cmsg", r.error.message, false); b.disabled = false; return; } showPay(r.data.payment, "social");
      };
    }
  }

  /* ---- clicks inside the sheet ---- */
  async function openPayById(id, back) { var r = await client().rpc("my_payment", { p_id: id }); if (r.data) showPay(r.data, back); else toast("Could not open that payment."); }
  function wire(v) {
    if (v === "social") wireSocial();
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
    bodyEl.querySelectorAll(".sh-arstop").forEach(function (b) { b.onclick = async function () {
      if (!window.confirm("Stop automatic renewal for this? What you already paid for keeps running until it ends.")) return;
      b.disabled = true; var r = await client().rpc("autorenew_cancel", { p_id: b.dataset.id }); if (r.error) { var m = $("sh-armsg"); if (m) { m.className = "sh-msg sh-bad"; m.textContent = r.error.message; } b.disabled = false; return; } open(v); }; });
    var rm = $("sh-cardrm"); if (rm) rm.onclick = async function () {
      if (!window.confirm("Remove your saved card? All automatic renewals will stop.")) return;
      rm.disabled = true; await client().rpc("card_remove"); open(v); };
    if (v === "consol") wireConsol();
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
  document.addEventListener("sb:payment", function () { if (sh.classList.contains("open") && /^(billing|social|promote|boost|advertise|upgrade)$/.test(cur)) open(cur); else if (cur === "pay" && sh.classList.contains("open") && payBack) open(payBack === "pay" ? "billing" : payBack); });
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-hub]"); if (b) { e.preventDefault(); open(b.dataset.hub); } });


  /* ---- "Next steps" coach: live checklist for this seller ---- */
  var COACH_CSS = "<style>.sh-coach{background:#fff;border:1px solid #e6ece8;border-radius:16px;padding:14px;margin:0 0 14px}.sh-coach h3{margin:0 0 4px;font-size:18px}.sh-bar{height:8px;border-radius:6px;background:#e6efe9;margin:8px 0 10px;overflow:hidden}.sh-bar i{display:block;height:100%;background:#087f5b}.sh-step{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-top:1px solid #eef2ef;background:none;padding:10px 0;font:14px Arial,sans-serif;color:#172b24;cursor:pointer}.sh-step:first-of-type{border-top:0}.sh-step .c{flex:0 0 22px;height:22px;border-radius:50%;border:2px solid #b8c7bd;display:grid;place-items:center;font-size:15px;color:#fff}.sh-step.done .c{background:#087f5b;border-color:#087f5b}.sh-step.done b{text-decoration:line-through;color:#8a9a90}.sh-step small{display:block;color:#718078;font-size:14px}</style>";
  async function drawCoach(host) {
    var c = client(); if (!host || !c) return;
    try {
      var r = await c.rpc("seller_coach"); if (r.error || !r.data || !r.data.app) { host.innerHTML = ""; return; }
      var steps = r.data.steps || [], done = steps.filter(function (x) { return x.done; }).length;
      var todo = steps.filter(function (x) { return !x.done; }).slice(0, 4);
      if (!todo.length) { host.innerHTML = COACH_CSS + '<div class="sh-coach"><h3>🎉 You have done every growth step</h3><p style="margin:4px 0 0;font-size:16px;color:#52675c">Keep your stock updated and reply fast to customers.</p></div>'; return; }
      host.innerHTML = COACH_CSS + '<div class="sh-coach"><h3>Your next steps</h3><div style="font-size:15px;color:#718078">' + done + " of " + steps.length + ' done</div><div class="sh-bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
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
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get("card") === "1") {
      history.replaceState(null, "", location.pathname + location.hash);
      setTimeout(function () { toast("Payment received. It switches on within a minute."); open("billing"); }, 800);
    }
  } catch (e) {}
  window.__sbHub = { open: open, close: hide, coach: coachAll };
})();
