/* SafeBuy NG: SafeBuy delivery on orders (buyer request and payment, seller pickup).
   Load AFTER orders.js. Needs delivery.sql and delivery-orders.sql run in Supabase. */
(function () {
  "use strict";
  var c = window.safeBuySupabase, cfg = window.SAFEbuySupabaseConfig;
  if (!c || !cfg) return;
  var FN = String(cfg.url).replace(/\/+$/, "") + "/functions/v1/";

  function E(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function N(k) { return "₦" + (Number(k) / 100).toLocaleString("en-NG"); }
  function T(m) { if (window.showToast) window.showToast(m); else alert(m); }
  function user() { return c.auth.getUser().then(function (r) { return r.data && r.data.user; }); }
  function phone(v) {
    var d = String(v || "").replace(/[^\d+]/g, "");
    if (d.charAt(0) === "+") return "+" + d.slice(1).replace(/\D/g, "");
    d = d.replace(/\D/g, "");
    if (d.indexOf("234") === 0) return "+" + d;
    if (d.charAt(0) === "0" && d.length === 11) return "+234" + d.slice(1);
    if (d.length === 10) return "+234" + d;
    return "+" + d;
  }
  function shortId(el) {
    var m = (el.textContent || "").match(/#[0-9a-f]{8}/gi);
    return m ? m[m.length - 1].slice(1).toLowerCase() : "";
  }
  async function callFn(name, payload) {
    var s = await c.auth.getSession();
    var token = s.data && s.data.session ? s.data.session.access_token : "";
    try {
      var res = await fetch(FN + name, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: cfg.publishableKey },
        body: JSON.stringify(payload || {})
      });
      var j = await res.json().catch(function () { return {}; });
      return res.ok && j.url ? { ok: true, url: j.url } : { ok: false, error: j.error || "Something went wrong (" + res.status + ")." };
    } catch (e) { return { ok: false, error: "Could not reach the payment service. Try again." }; }
  }

  var css = document.createElement("style");
  css.textContent =
    ".vd-box{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f2fbf6;border:1px solid #bfe6d1;font-size:13px;line-height:1.6;color:#172b24}" +
    ".vd-box .vd-code{display:inline-block;font-size:20px;font-weight:800;letter-spacing:3px;color:#066548}" +
    ".vd-box .vd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}" +
    ".vd-box .vd-row .button{width:auto;margin:0;padding:9px 14px;font-size:13px}" +
    ".vd-box a{color:#066548;font-weight:700}";
  document.head.appendChild(css);

  /* ---------- own small modal (request form) ---------- */
  var back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = '<div class="modal"><div class="modal-top"><h2 id="vd-title"></h2><button class="icon-button" type="button" id="vd-close" aria-label="Close">✕</button></div><div id="vd-body"></div></div>';
  document.body.appendChild(back);
  var mBody = back.querySelector("#vd-body"), mTitle = back.querySelector("#vd-title");
  function openM(t, html) { mTitle.textContent = t; mBody.innerHTML = html; back.classList.add("open"); }
  function closeM() { back.classList.remove("open"); }
  back.querySelector("#vd-close").onclick = closeM;
  back.addEventListener("click", function (e) { if (e.target === back) closeM(); });

  function refreshOrders() { var b = document.getElementById("mp-orders-btn"); if (b) b.click(); }

  /* ---------- buyer: delivery on "My orders" ---------- */
  var ob = document.getElementById("om-body"), busyB = false, againB = false;

  function codeLine(d) {
    return d.delivery_code
      ? '<br>Delivery code: <span class="vd-code">' + E(d.delivery_code) + '</span><br><span class="muted">Give this code to the rider only when you have received your item. SafeBuy NG never asks for it any other way.</span>'
      : "";
  }
  function cancelBtn(d) { return '<button class="button button-outline" type="button" data-vd="cancel" data-did="' + E(d.delivery_id) + '">Cancel delivery</button>'; }

  function boxHtml(o, d) {
    if (!d) {
      return String(o.status) === "paid"
        ? '<button class="button button-outline" type="button" data-vd="req" data-oid="' + E(o.id) + '">🚚 Request SafeBuy delivery</button>'
        : "";
    }
    var js = d.job_status;
    if (d.status === "requested") return "🚚 Delivery requested. SafeBuy will confirm the fee soon." + '<div class="vd-row">' + cancelBtn(d) + "</div>";
    if (d.status === "quoted") {
      return "🚚 Delivery fee: <strong>" + N(d.fee_kobo) + "</strong>, paid to SafeBuy NG." +
        '<div class="vd-row"><button class="button button-primary" type="button" data-vd="pay" data-did="' + E(d.delivery_id) + '">Pay ' + N(d.fee_kobo) + "</button>" + cancelBtn(d) + "</div>";
    }
    if (d.status === "paid") {
      if (js === "delivered") return "✅ Delivered by SafeBuy delivery.";
      if (js === "unassigned") return "⚠ We could not find a rider yet. SafeBuy NG will contact you.";
      if (js === "assigned" || js === "picked_up") {
        return "🚚 " + (js === "picked_up" ? "On the way" : "Rider heading to the seller") + ": <strong>" + E(d.partner_name) + "</strong>" +
          (d.partner_phone ? ' · <a href="tel:' + E(d.partner_phone) + '">' + E(d.partner_phone) + "</a>" : "") + codeLine(d);
      }
      return "🚚 Fee paid. Finding a rider near the seller…";
    }
    return "";
  }

  async function decorateBuyer() {
    if (!ob) return;
    if (busyB) { againB = true; return; }
    var cards = [].slice.call(ob.querySelectorAll(".review-card")).filter(function (x) { return !x.dataset.vd; });
    if (!cards.length) return;
    busyB = true;
    try {
      var u = await user();
      if (!u) return;
      var res = await Promise.all([
        c.from("marketplace_orders").select("id,status,buyer_id"),
        c.rpc("buyer_deliveries")
      ]);
      cards.forEach(function (x) { x.dataset.vd = "1"; });
      if (res[1].error) return;                          // delivery not installed yet: show nothing
      var orders = (res[0].data || []).filter(function (o) { return o.buyer_id === u.id; });
      var ds = res[1].data || [];
      cards.forEach(function (card) {
        var sid = shortId(card);
        if (!sid) return;
        var o = orders.filter(function (x) { return String(x.id).toLowerCase().indexOf(sid) === 0; })[0];
        if (!o) return;
        var d = ds.filter(function (x) { return x.order_id === String(o.id); })[0];
        var html = boxHtml(o, d);
        if (html) card.insertAdjacentHTML("beforeend", '<div class="vd-box">' + html + "</div>");
      });
    } finally {
      busyB = false;
      if (againB) { againB = false; decorateBuyer(); }
    }
  }

  async function openRequest(oid) {
    var cov = await c.from("delivery_coverage").select("state").eq("available", true).order("state");
    var states = cov.error ? [] : (cov.data || []).map(function (x) { return x.state; });
    if (!states.length) {
      openM("SafeBuy delivery", "<p>SafeBuy delivery is not available in any state yet. Ask the seller to arrange delivery.</p>");
      return;
    }
    openM("SafeBuy delivery",
      "<p>A SafeBuy rider collects your item from the seller and brings it to you. Delivery works inside the seller’s state.</p>" +
      '<label for="vd-state">Your state</label><select id="vd-state">' +
      states.map(function (s) { return '<option value="' + E(s) + '">' + E(s) + "</option>"; }).join("") + "</select>" +
      '<label for="vd-d-lga">Your LGA or town</label><input id="vd-d-lga" maxlength="60">' +
      '<label for="vd-addr">Delivery address</label><input id="vd-addr" maxlength="300" placeholder="House number, street, landmark">' +
      '<label for="vd-phone">Phone the rider can call</label><input id="vd-phone" type="tel" placeholder="08012345678">' +
      '<p class="modal-note">The rider sees your address and phone only after accepting the job.</p>' +
      '<button class="button button-primary" type="button" id="vd-go">Request delivery</button>' +
      '<p class="form-message" id="vd-msg" role="status" aria-live="polite"></p>');
    document.getElementById("vd-go").onclick = async function () {
      var btn = this, msg = document.getElementById("vd-msg");
      var addr = document.getElementById("vd-addr").value.trim(), ph = phone(document.getElementById("vd-phone").value);
      if (addr.length < 5) { msg.textContent = "Enter your delivery address."; return; }
      if (!/^\+\d{10,15}$/.test(ph)) { msg.textContent = "Check your phone number, for example 08012345678."; return; }
      btn.disabled = true; msg.textContent = "Sending…";
      var r = await c.rpc("buyer_request_delivery", {
        p_order: String(oid), p_state: document.getElementById("vd-state").value,
        p_lga: document.getElementById("vd-d-lga").value, p_address: addr, p_phone: ph
      });
      if (r.error) { msg.textContent = r.error.message; btn.disabled = false; return; }
      closeM();
      T(r.data && r.data.status === "quoted" ? "Delivery fee: " + N(r.data.fee_kobo) + ". Tap Pay to continue." : "Delivery requested. SafeBuy will send you the fee.");
      refreshOrders();
    };
  }

  if (ob) {
    new MutationObserver(decorateBuyer).observe(ob, { childList: true });
    ob.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-vd]");
      if (!b) return;
      var k = b.dataset.vd;
      if (k === "req") { openRequest(b.dataset.oid); return; }
      b.disabled = true;
      if (k === "cancel") {
        var r = await c.rpc("buyer_cancel_delivery", { p_delivery: b.dataset.did });
        T(r.error ? r.error.message : "Delivery request cancelled.");
        refreshOrders();
        return;
      }
      if (k === "pay") {
        T("Opening secure payment…");
        var p = await callFn("paystack-delivery-checkout", { delivery_id: b.dataset.did });
        if (p.ok) { window.location.href = p.url; return; }
        T(p.error);
        b.disabled = false;
      }
    });
  }

  /* ---------- seller: pickup location + delivery info on orders ---------- */
  var sb = document.getElementById("seller-body"), busyP = false, busyO = false;

  async function pickupBox() {
    if (!sb || busyP || !document.getElementById("pf-heading") || document.getElementById("vd-pickup")) return;
    busyP = true;
    try {
      var r = await c.rpc("seller_my_pickup");
      if (r.error) return;                               // delivery not installed yet
      var row = (r.data && r.data[0]) || null;
      var anchor = document.getElementById("pf-heading");
      if (!anchor || document.getElementById("vd-pickup")) return;
      var box = document.createElement("div");
      box.id = "vd-pickup";
      box.className = "vd-box";
      box.innerHTML =
        "<strong>🚚 Delivery pickup</strong><br>Tell SafeBuy riders where to collect orders. Riders see your shop address and phone only after they accept a pickup." +
        '<label for="vd-lga">Your LGA or town</label><input id="vd-lga" maxlength="60" value="' + E(row && row.lga || "") + '">' +
        '<p class="muted">' + (row && row.lat != null ? "✓ Map location saved. Riders are matched by distance." : "No map location yet. Without it, riders are matched by area only.") + "</p>" +
        '<div class="vd-row"><button class="button button-primary" type="button" data-vd-save="geo">Save with my current location</button>' +
        '<button class="button button-outline" type="button" data-vd-save="area">Save area only</button></div>';
      anchor.parentNode.insertBefore(box, anchor);
    } finally { busyP = false; }
  }

  async function decorateSellerOrders() {
    var list = document.getElementById("so-list");
    if (!list || busyO) return;
    var items = [].slice.call(list.querySelectorAll(".seller-item")).filter(function (x) { return !x.dataset.vd; });
    if (!items.length) return;
    busyO = true;
    try {
      var r = await c.rpc("seller_deliveries");
      items.forEach(function (x) { x.dataset.vd = "1"; });
      if (r.error) return;
      var ds = r.data || [];
      items.forEach(function (item) {
        var sid = shortId(item);
        if (!sid) return;
        var d = ds.filter(function (x) { return String(x.order_id).toLowerCase().indexOf(sid) === 0; })[0];
        if (!d) return;
        var js = d.job_status, t;
        if (d.status === "requested" || d.status === "quoted") t = "🚚 Buyer asked for SafeBuy delivery. Waiting for the buyer to pay the delivery fee.";
        else if (js === "delivered") t = "✅ Delivered by a SafeBuy rider.";
        else if (js === "picked_up") t = "🚚 The rider has the item and is on the way.";
        else if (js === "assigned") t = "🚚 Rider coming to collect: <strong>" + E(d.partner_name) + "</strong>" + (d.partner_phone ? ' · <a href="tel:' + E(d.partner_phone) + '">' + E(d.partner_phone) + "</a>" : "") + "<br>Hand the item to this rider only. The order turns Shipped by itself.";
        else if (js === "unassigned") t = "⚠ No rider found yet. SafeBuy NG is looking into it.";
        else t = "🚚 SafeBuy delivery paid. Finding a rider.";
        item.insertAdjacentHTML("beforeend", '<div class="vd-box">' + t + "</div>");
      });
    } finally { busyO = false; }
  }

  if (sb) {
    new MutationObserver(function () { pickupBox(); decorateSellerOrders(); }).observe(sb, { childList: true, subtree: true });
    sb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-vd-save]");
      if (!b) return;
      var lga = document.getElementById("vd-lga").value.trim();
      b.disabled = true;
      function save(lat, lng) {
        c.rpc("seller_set_pickup", { p_lga: lga, p_lat: lat, p_lng: lng }).then(function (r) {
          T(r.error ? r.error.message : "Pickup saved.");
          var box = document.getElementById("vd-pickup");
          if (box) box.remove();
          pickupBox();
        });
      }
      if (b.dataset.vdSave === "geo") {
        if (!navigator.geolocation) { T("This device cannot share its location."); b.disabled = false; return; }
        navigator.geolocation.getCurrentPosition(function (p) { save(p.coords.latitude, p.coords.longitude); },
          function () { T("Allow location access, or save the area only."); b.disabled = false; },
          { enableHighAccuracy: true, timeout: 20000 });
      } else { save(null, null); }
    });
  }

  /* ---------- back from Paystack after paying a delivery fee ---------- */
  try {
    var q = new URLSearchParams(location.search);
    if (q.get("delivery") === "paid") {
      setTimeout(function () { T("Payment received. We are finding a rider."); refreshOrders(); }, 800);
      history.replaceState(null, "", location.pathname + location.hash);
    }
  } catch (e) {}
})();
