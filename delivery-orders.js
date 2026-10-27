/* SafeBuy NG: connects orders to delivery. Needs delivery.sql + delivery_v2.sql.
   Load after orders.js. Buyer: request delivery, track, see handover code.
   Seller: set pickup location, hand paid orders to a rider. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  if (!c) return;

  var STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
  var JOB_LABEL = { searching: "Finding a rider…", offered: "Finding a rider…", assigned: "Rider on the way to the seller", picked_up: "Rider has your item", delivered: "Delivered", unassigned: "No rider yet. SafeBuy NG is working on it", cancelled: "Cancelled" };

  function E(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function N(k) { return "₦" + (Number(k) / 100).toLocaleString("en-NG"); }
  function T(m) { if (window.showToast) window.showToast(m); }
  function user() { return c.auth.getUser().then(function (r) { return r.data && r.data.user; }); }
  async function rpc(n, a) { var r = await c.rpc(n, a || {}); if (r.error) throw r.error; return r.data; }
  function phone(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("234") === 0) d = d.slice(3); else if (d.charAt(0) === "0") d = d.slice(1);
    return d.length === 10 ? "+234" + d : "";
  }
  function stateOpts(sel) {
    return STATES.map(function (s) { return "<option" + (s.toLowerCase() === sel ? " selected" : "") + ">" + E(s) + "</option>"; }).join("");
  }

  /* ---------- modal ---------- */
  var back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = '<div class="modal"><div class="modal-top"><h2>My deliveries</h2><button class="icon-button" type="button" id="do-close" aria-label="Close">✕</button></div><div id="do-body"></div></div>';
  document.body.appendChild(back);
  var body = back.querySelector("#do-body");
  back.querySelector("#do-close").onclick = function () { back.classList.remove("open"); };
  back.addEventListener("click", function (e) { if (e.target === back) back.classList.remove("open"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") back.classList.remove("open"); });

  /* ---------- header button ---------- */
  var actions = document.querySelector(".header-actions");
  var btn = document.createElement("button");
  btn.className = "button button-outline"; btn.type = "button"; btn.textContent = "🚚 Deliveries"; btn.hidden = true;
  var anchor = document.getElementById("mp-orders-btn");
  actions.insertBefore(btn, anchor ? anchor.nextSibling : actions.firstChild);
  btn.onclick = showBuyer;
  function refreshBtn() { user().then(function (u) { btn.hidden = !u; }); }
  c.auth.onAuthStateChange(function () { setTimeout(refreshBtn, 0); });
  refreshBtn();

  /* ---------- buyer ---------- */
  async function showBuyer() {
    body.innerHTML = "<p>Loading…</p>";
    back.classList.add("open");
    var u = await user();
    var r = await c.from("marketplace_orders").select("*").order("created_at", { ascending: false }).limit(40);
    if (r.error) { body.innerHTML = "<p>" + E(r.error.message) + "</p>"; return; }
    var mine = (r.data || []).filter(function (o) {
      return u && o.buyer_id === u.id && o.status !== "cancelled" &&
        (o.delivery_status || o.status === "placed" || o.status === "paid");
    });
    if (!mine.length) { body.innerHTML = "<p>No orders that can use delivery yet.</p>"; return; }

    var infos = await Promise.all(mine.map(function (o) {
      return o.delivery_status && o.delivery_status !== "cancelled"
        ? c.rpc("my_delivery_info", { p_order: o.id }).then(function (x) { return x.data && x.data[0]; })
        : Promise.resolve(null);
    }));

    body.innerHTML = mine.map(function (o, i) {
      var inf = infos[i];
      var head = "<strong>" + E(o.product_name || "Product") + "</strong> × " + o.quantity + '<br><span class="muted">#' + E(String(o.id).slice(0, 8)) + "</span>";
      var inner = "";
      if (!inf) {
        inner = '<div class="seller-actions"><button class="button button-primary" type="button" data-dform="' + E(o.id) + '">Request delivery</button></div><div class="do-form"></div>';
      } else if (inf.delivery_status === "requested") {
        inner = '<p><span class="status-pill">Waiting for your payment</span></p><p>Delivery fee: <strong>' + N(inf.fee_kobo) + "</strong></p><p class=\"muted\">" + E(inf.instructions) +
          "</p><p class=\"muted\">Quote your order number #" + E(String(o.id).slice(0, 8)) + " when you pay.</p>";
      } else if (inf.delivery_status === "fee_paid") {
        inner = '<p><span class="status-pill ok">Fee confirmed</span></p><p class="muted">Waiting for the seller to hand your item to a rider.</p>';
      } else if (inf.delivery_status === "dispatched") {
        inner = '<p><span class="status-pill' + (inf.job_status === "delivered" ? " ok" : inf.job_status === "unassigned" ? " bad" : "") + '">' + E(JOB_LABEL[inf.job_status] || inf.job_status) + "</span></p>" +
          (inf.rider_name ? "<p>Rider: <strong>" + E(inf.rider_name) + "</strong>" + (inf.rider_vehicle ? " (" + E(inf.rider_vehicle) + ")" : "") + "</p>" : "") +
          (inf.delivery_code ? '<p class="modal-note">Your delivery code: <strong style="font-size:22px;letter-spacing:4px">' + E(inf.delivery_code) +
            "</strong><br>Give it to the rider only after you have received and checked your item.</p>" : "");
      }
      return '<div class="review-card">' + head + inner + "</div>";
    }).join("");
  }

  body.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dform]");
    if (b) {
      var box = b.closest(".review-card").querySelector(".do-form");
      b.hidden = true;
      box.innerHTML =
        '<label>State</label><select class="do-state">' + stateOpts("lagos") + "</select>" +
        '<label>City / area</label><input class="do-city" maxlength="60" placeholder="e.g. Ikeja">' +
        '<label>Full delivery address</label><textarea class="do-addr" maxlength="200" placeholder="House number, street, landmark"></textarea>' +
        '<label>Your phone (the rider may call)</label><input class="do-phone" type="tel" placeholder="08012345678">' +
        '<button class="button button-primary" type="button" data-dsend="' + E(b.dataset.dform) + '">Get delivery quote</button>' +
        '<p class="form-message do-msg"></p>';
      return;
    }
    var s = e.target.closest("[data-dsend]");
    if (s) sendRequest(s);
  });

  async function sendRequest(s) {
    var box = s.closest(".do-form");
    var m = box.querySelector(".do-msg");
    var ph = phone(box.querySelector(".do-phone").value);
    if (!ph) { m.textContent = "Enter a valid Nigerian phone number."; m.style.color = "#8a1f1f"; return; }
    s.disabled = true; m.style.color = ""; m.textContent = "Checking coverage…";
    try {
      await rpc("order_request_delivery", {
        p_order: s.dataset.dsend, p_state: box.querySelector(".do-state").value,
        p_city: box.querySelector(".do-city").value, p_address: box.querySelector(".do-addr").value, p_phone: ph
      });
      T("Delivery requested.");
      showBuyer();
    } catch (err) { m.textContent = err.message; m.style.color = "#8a1f1f"; s.disabled = false; }
  }

  /* ---------- seller ---------- */
  var sb = document.getElementById("seller-body");
  var app = null;

  function sellerBox() {
    if (!document.getElementById("my-products") || document.getElementById("do-seller")) return;
    var box = document.createElement("div");
    box.id = "do-seller";
    box.innerHTML = "<h3>Delivery</h3><div id='do-sbody'>Loading…</div>";
    sb.appendChild(box);
    loadSeller();
  }

  async function loadSeller() {
    var u = await user(); if (!u) return;
    var a = await c.from("seller_applications").select("*").eq("user_id", u.id).maybeSingle();
    var el = document.getElementById("do-sbody"); if (!el || !a.data) return;
    app = a.data;
    var o = await c.from("marketplace_orders").select("*").eq("seller_application_id", app.id)
      .in("delivery_status", ["requested", "fee_paid", "dispatched"]).order("created_at", { ascending: false }).limit(30);

    var pick = app.dp_address
      ? '<p class="muted">Pickup: ' + E(app.dp_address) + ", " + E(app.dp_city) + ", " + E(app.dp_state) + (app.dp_lat ? " · location saved" : " · no GPS pin") +
        '</p><button class="button button-outline" type="button" data-dpick="1">Change pickup location</button>'
      : '<p class="modal-note">Set your pickup location so buyers can request delivery on your products.</p><button class="button button-primary" type="button" data-dpick="1">Set pickup location</button>';

    var list = (o.data || []).map(function (x) {
      var st = x.delivery_status, act = "";
      if (st === "fee_paid" && x.status === "paid") act = '<button class="button button-primary" type="button" data-ddisp="' + E(x.id) + '">Ready for rider pickup</button>';
      else if (st === "fee_paid") act = '<span class="muted">Mark the order Paid, then hand it to a rider.</span>';
      return '<div class="seller-item"><strong>' + E(x.product_name || "Product") + "</strong> × " + x.quantity +
        '<br><span class="muted">' + (st === "requested" ? "Buyer must pay the delivery fee first" : st === "fee_paid" ? "Delivery fee confirmed" : "With the rider network") +
        " · #" + E(String(x.id).slice(0, 8)) + '</span><div class="seller-actions">' + act + "</div></div>";
    }).join("");
    el.innerHTML = pick + '<div id="do-pickform"></div><h3>Delivery orders</h3>' + (list || '<p class="muted">No delivery orders yet.</p>');
  }

  sb.addEventListener("click", async function (e) {
    var p = e.target.closest("[data-dpick]"), d = e.target.closest("[data-ddisp]");
    if (p) {
      var f = document.getElementById("do-pickform");
      f.innerHTML =
        '<label>State</label><select id="dpk-state">' + stateOpts(app && app.dp_state) + "</select>" +
        '<label>City / area</label><input id="dpk-city" maxlength="60" value="' + E(app && app.dp_city ? app.dp_city : "") + '">' +
        '<label>Full pickup address</label><textarea id="dpk-addr" maxlength="200">' + E(app && app.dp_address ? app.dp_address : "") + "</textarea>" +
        '<button class="button button-light" type="button" id="dpk-gps">Use my current location (recommended)</button>' +
        '<input type="hidden" id="dpk-lat"><input type="hidden" id="dpk-lng">' +
        '<button class="button button-primary" type="button" id="dpk-save">Save pickup location</button><p class="form-message" id="dpk-msg"></p>';
      document.getElementById("dpk-gps").onclick = function () {
        navigator.geolocation.getCurrentPosition(function (pos) {
          document.getElementById("dpk-lat").value = pos.coords.latitude;
          document.getElementById("dpk-lng").value = pos.coords.longitude;
          document.getElementById("dpk-msg").textContent = "Location captured.";
        }, function () { document.getElementById("dpk-msg").textContent = "Could not get your location."; });
      };
      document.getElementById("dpk-save").onclick = async function () {
        var lat = parseFloat(document.getElementById("dpk-lat").value), lng = parseFloat(document.getElementById("dpk-lng").value);
        try {
          await rpc("seller_set_pickup", {
            p_state: document.getElementById("dpk-state").value, p_city: document.getElementById("dpk-city").value,
            p_address: document.getElementById("dpk-addr").value, p_lat: isNaN(lat) ? null : lat, p_lng: isNaN(lng) ? null : lng
          });
          T("Pickup location saved."); loadSeller();
        } catch (err) { document.getElementById("dpk-msg").textContent = err.message; }
      };
    }
    if (d) {
      d.disabled = true;
      try { await rpc("seller_dispatch_order", { p_order: d.dataset.ddisp }); T("Sent to the rider network."); }
      catch (err) { T(err.message); }
      loadSeller();
    }
  });

  new MutationObserver(sellerBox).observe(sb, { childList: true, subtree: true });
})();
