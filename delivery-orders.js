/* SafeBuy NG: connects orders to delivery. Needs delivery.sql + delivery_v2.sql.
   Load after orders.js. Buyer: request delivery, track, see handover code.
   Seller: set pickup location, hand paid orders to a rider. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  if (!c) return;

  // Set to true after Paystack and the backend functions are set up (see SETUP.md).
  var ONLINE_PAYMENTS = false;

  var STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
  var JOB_LABEL = { searching: "Finding a rider…", offered: "Finding a rider…", assigned: "Rider on the way to the seller", picked_up: "Rider has your item", delivered: "Delivered", unassigned: "No rider yet. SafeBuy NG is working on it", cancelled: "Cancelled" };

  function E(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function N(k) { return "₦" + (Number(k) / 100).toLocaleString("en-NG"); }
  function T(m) { if (window.showToast) window.showToast(m); }
  function user() { return c.auth.getUser().then(function (r) { return r.data && r.data.user; }); }
  async function rpc(n, a) { var r = await c.rpc(n, a || {}); if (r.error) throw r.error; return r.data; }
  // Call a backend function and return its JSON, or throw a readable error.
  async function fn(name, payload) {
    var r = await c.functions.invoke(name, { body: payload });
    if (r.error) {
      var msg = r.error.message;
      try { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    if (r.data && r.data.error) throw new Error(r.data.error);
    return r.data;
  }
  function phone(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("234") === 0) d = d.slice(3); else if (d.charAt(0) === "0") d = d.slice(1);
    return d.length === 10 ? "+234" + d : "";
  }
  function stateOpts(sel) {
    return STATES.map(function (s) { return "<option" + (s.toLowerCase() === sel ? " selected" : "") + ">" + E(s) + "</option>"; }).join("");
  }


  /* ---------- contact buttons + timeline (connect_roles.sql) ---------- */
  var st0 = document.createElement("style");
  st0.textContent =
    ".cx-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.cx-row a{flex:1 1 120px;text-align:center;padding:10px 12px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;border:1px solid var(--line);color:var(--ink);background:#fff}" +
    ".cx-row a.cx-wa{background:#25d366;border-color:#25d366;color:#fff}" +
    ".cx-box{margin:10px 0;padding:12px;border:1px solid #bfe6d1;border-radius:14px;background:var(--green-light)}.cx-box strong{display:block}" +
    ".cx-code{display:inline-block;margin:4px 0;padding:4px 14px;border-radius:10px;background:#fff;border:1px dashed var(--green);font-size:26px;font-weight:800;letter-spacing:6px}" +
    ".cx-stars{display:flex;gap:6px;margin:6px 0}.cx-star{border:0;background:none;font-size:34px;line-height:1;color:#c9d6cd;cursor:pointer;padding:2px}.cx-star.on,.cx-star:hover{color:#f5b301}" +
    ".tl{list-style:none;margin:8px 0 0;padding:0 0 0 6px}.tl li{position:relative;padding:0 0 12px 22px;font-size:14px}.tl li::before{content:'';position:absolute;left:0;top:5px;width:10px;height:10px;border-radius:50%;background:var(--green)}.tl li::after{content:'';position:absolute;left:4px;top:15px;bottom:-2px;width:2px;background:#cfe6da}.tl li:last-child::after{display:none}.tl li.now::before{box-shadow:0 0 0 4px #1fae6f33}.tl small{display:block;color:var(--muted);font-size:12px}";
  document.head.appendChild(st0);
  function waDigits(v) { var p = phone(v); return p ? p.replace("+", "") : ""; }
  // Call and WhatsApp buttons. Returns "" when there is no usable number.
  function contactRow(num, who, about) {
    var wa = waDigits(num), tel = phone(num);
    if (!tel) return "";
    return '<div class="cx-row"><a href="tel:' + E(tel) + '">📞 Call ' + E(who) + '</a>' +
      '<a class="cx-wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + (about ? "?text=" + encodeURIComponent(about) : "") + '">💬 WhatsApp</a></div>';
  }
  function timeline(events) {
    if (!events || !events.length) return "";
    return '<details class="cx-tl"><summary><strong>Order progress</strong></summary><ul class="tl">' + events.map(function (ev, i) {
      return '<li' + (i === events.length - 1 ? ' class="now"' : "") + ">" + E(ev.label) + "<small>" + new Date(ev.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) + "</small></li>";
    }).join("") + "</ul></details>";
  }
  function track(id) {
    return c.rpc("order_tracking", { p_order: id }).then(function (r) { return r.error ? null : r.data; }, function () { return null; });
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
  btn.className = "button button-outline"; btn.type = "button"; btn.textContent = "🚚 Deliveries"; btn.hidden = true; btn.id = "do-btn";
  var anchor = document.getElementById("mp-orders-btn");
  actions.insertBefore(btn, anchor ? anchor.nextSibling : actions.firstChild);
  btn.onclick = showBuyer;
  function refreshBtn() { user().then(function (u) { btn.hidden = !u; }); }
  c.auth.onAuthStateChange(function () { setTimeout(refreshBtn, 0); });
  refreshBtn();


  /* ---------- in-app alerts (everyone: buyers, sellers, riders) ---------- */
  var abk = document.createElement("div");
  abk.className = "modal-backdrop";
  abk.innerHTML = '<div class="modal"><div class="modal-top"><h2>Updates</h2><button class="icon-button" type="button" id="da-close" aria-label="Close">✕</button></div><div id="da-body"></div></div>';
  document.body.appendChild(abk);
  var abody = abk.querySelector("#da-body");
  abk.querySelector("#da-close").onclick = function () { abk.classList.remove("open"); };
  abk.addEventListener("click", function (e) { if (e.target === abk) abk.classList.remove("open"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") abk.classList.remove("open"); });

  var abtn = document.createElement("button");
  abtn.className = "button button-outline"; abtn.type = "button"; abtn.hidden = true; abtn.id = "da-btn"; abtn.textContent = "📣 Updates";
  actions.insertBefore(abtn, btn.nextSibling);
  var seenTop = null, firstLoad = true;

  async function loadAlerts(openIt) {
    var u = await user();
    if (!u) { abtn.hidden = true; return; }
    var r = await c.from("user_alerts").select("*").order("created_at", { ascending: false }).limit(30);
    if (r.error) return;                       // table not installed yet: stay quiet
    var rows = r.data || [], unread = rows.filter(function (n) { return !n.read_at; });
    abtn.hidden = false;
    abtn.textContent = "📣 Updates" + (unread.length ? " (" + unread.length + ")" : "");
    if (!firstLoad && unread.length && unread[0].id !== seenTop && !openIt) T(unread[0].title + ": " + (unread[0].body || ""));
    firstLoad = false;
    seenTop = unread.length ? unread[0].id : seenTop;
    if (openIt) {
      abody.innerHTML = rows.length ? rows.map(function (n) {
        return '<div class="review-card"><strong>' + E(n.title) + (n.read_at ? "" : ' <span class="status-pill">new</span>') + "</strong><br>" + E(n.body || "") +
          '<br><span class="muted">' + new Date(n.created_at).toLocaleString("en-NG") + "</span></div>";
      }).join("") : "<p>No updates yet.</p>";
      abk.classList.add("open");
      if (unread.length) { await c.rpc("alerts_mark_read"); abtn.textContent = "📣 Updates"; }
    }
  }
  abtn.onclick = function () { loadAlerts(true); };
  c.auth.onAuthStateChange(function () { firstLoad = true; seenTop = null; setTimeout(function () { loadAlerts(false); }, 0); });
  setInterval(function () { if (!document.hidden) loadAlerts(false); }, 30000);
  loadAlerts(false);

  /* ---------- buyer ---------- */
  async function showBuyer() {
    body.innerHTML = "<p>Loading…</p>";
    back.classList.add("open");
    var u = await user();
    var r = await c.from("marketplace_orders").select("*").order("created_at", { ascending: false }).limit(40);
    if (r.error) { body.innerHTML = "<p>" + E(r.error.message) + "</p>"; return; }
    // If the buyer paid online and came back, ask Paystack and confirm the fee before drawing the list.
    var waiting = !ONLINE_PAYMENTS ? [] : (r.data || []).filter(function (o) { return u && o.buyer_id === u.id && o.delivery_status === "requested" && o.delivery_fee_ref; });
    if (waiting.length) {
      await Promise.all(waiting.map(function (o) { return fn("delivery-pay", { action: "verify", order_id: o.id }).catch(function () {}); }));
      r = await c.from("marketplace_orders").select("*").order("created_at", { ascending: false }).limit(40);
      if (r.error) { body.innerHTML = "<p>" + E(r.error.message) + "</p>"; return; }
    }
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

    var trks = await Promise.all(mine.map(function (o) { return o.delivery_status ? track(o.id) : Promise.resolve(null); }));

    body.innerHTML = mine.map(function (o, i) {
      var inf = infos[i], trk = trks[i];
      var head = "<strong>" + E(o.product_name || "Product") + "</strong> × " + o.quantity + '<br><span class="muted">#' + E(String(o.id).slice(0, 8)) + "</span>";
      var inner = "";
      if (!inf) {
        inner = '<div class="seller-actions"><button class="button button-primary" type="button" data-dform="' + E(o.id) + '">Request delivery</button></div><div class="do-form"></div>';
      } else if (inf.delivery_status === "requested") {
        inner = '<p><span class="status-pill">Waiting for your payment</span></p><p>Delivery fee: <strong>' + N(inf.fee_kobo) + "</strong></p>" +
          (ONLINE_PAYMENTS ? '<div class="seller-actions"><button class="button button-primary" type="button" data-dpay="' + E(o.id) + '">Pay ' + N(inf.fee_kobo) + ' now</button></div><p class="form-message do-paymsg"></p>' : "") +
          "<p class=\"muted\">" + (ONLINE_PAYMENTS ? "Your payment is confirmed automatically. Cannot pay online? " : "") + E(inf.instructions) + " Quote order #" + E(String(o.id).slice(0, 8)) + " when you pay.</p>";
      } else if (inf.delivery_status === "fee_paid") {
        inner = '<p><span class="status-pill ok">Fee confirmed</span></p><p class="muted">' + (o.status === "paid" ? "We are finding a rider for you." : "We will find a rider as soon as the seller marks your order Paid.") + "</p>";
      } else if (inf.delivery_status === "dispatched") {
        inner = '<p><span class="status-pill' + (inf.job_status === "delivered" ? " ok" : inf.job_status === "unassigned" ? " bad" : "") + '">' + E(JOB_LABEL[inf.job_status] || inf.job_status) + "</span></p>" +
          (inf.rider_name ? "<p>Rider: <strong>" + E(inf.rider_name) + "</strong>" + (inf.rider_vehicle ? " (" + E(inf.rider_vehicle) + ")" : "") + "</p>" : "") +
          (inf.delivery_code ? '<p class="modal-note">Your delivery code: <strong style="font-size:22px;letter-spacing:4px">' + E(inf.delivery_code) +
            "</strong><br>Give it to the rider only after you have received and checked your item.</p>" : "") +
          (trk && trk.rider ? '<div class="cx-box"><strong>Your rider: ' + E(trk.rider.name || "Rider") + (trk.rider.vehicle ? " (" + E(trk.rider.vehicle) + ")" : "") +
            (trk.rider.rating_count ? " · ★ " + E(trk.rider.rating_avg) + " (" + E(trk.rider.rating_count) + ")" : "") + "</strong>" +
            contactRow(trk.rider.phone, "rider", "Hello, I am the buyer of order #" + String(o.id).slice(0, 8) + " on SafeBuy NG.") + "</div>" : "");
      }
      var rate = "";
      if (trk && trk.can_rate) {
        rate = '<div class="cx-box"><strong>How was your rider?</strong><div class="cx-stars" data-order="' + E(o.id) + '">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="cx-star" data-stars="' + n + '" aria-label="' + n + ' star' + (n > 1 ? "s" : "") + '">★</button>'; }).join("") +
          '</div><p class="muted cx-ratemsg">Tap a star to rate.</p></div>';
      } else if (trk && trk.my_rating) {
        rate = '<p class="muted">You rated this delivery ' + E(trk.my_rating) + " ★. Thank you!</p>";
      }
      return '<div class="review-card">' + head + inner + rate + timeline(trk && trk.events) + "</div>";
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
    var pay = e.target.closest("[data-dpay]");
    if (pay) payFee(pay);
    var star = e.target.closest(".cx-star");
    if (star) rateRider(star);
  });

  async function rateRider(star) {
    var wrap = star.closest(".cx-stars"), msg = wrap.parentNode.querySelector(".cx-ratemsg");
    var n = Number(star.dataset.stars);
    [].forEach.call(wrap.children, function (b) { b.disabled = true; b.classList.toggle("on", Number(b.dataset.stars) <= n); });
    try {
      await rpc("rate_delivery", { p_order: wrap.dataset.order, p_stars: n });
      T("Thanks for rating your rider.");
      showBuyer();
    } catch (err) {
      msg.textContent = err.message; msg.style.color = "#8a1f1f";
      [].forEach.call(wrap.children, function (b) { b.disabled = false; });
    }
  }

  async function payFee(btn) {
    var m = btn.closest(".review-card").querySelector(".do-paymsg");
    btn.disabled = true; m.style.color = ""; m.textContent = "Opening secure payment…";
    try {
      var res = await fn("delivery-pay", {
        action: "init", order_id: btn.dataset.dpay,
        return_url: location.origin + location.pathname + "?dfee=" + encodeURIComponent(btn.dataset.dpay)
      });
      if (res.url) { location.href = res.url; return; }
      T("Delivery fee confirmed."); showBuyer();
    } catch (err) { m.textContent = err.message; m.style.color = "#8a1f1f"; btn.disabled = false; }
  }

  // Back from Paystack: open the deliveries window, which re-checks the payment.
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.get("dfee")) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    setTimeout(function () { showBuyer(); }, 800);
  })();

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

    var rows = o.data || [];
    var trks = await Promise.all(rows.map(function (x) { return track(x.id); }));
    var list = rows.map(function (x, i) {
      var trk = trks[i], extra = "";
      if (trk && trk.pickup_code) {
        extra += '<div class="cx-box"><strong>Pickup code</strong><span class="cx-code">' + E(trk.pickup_code) + "</span>" +
          "<div class=\"muted\">Give this code to the rider when they arrive. They need it to collect the item.</div></div>";
      }
      if (trk && trk.rider) {
        extra += '<div class="cx-box"><strong>Rider: ' + E(trk.rider.name || "Rider") + (trk.rider.vehicle ? " (" + E(trk.rider.vehicle) + ")" : "") + "</strong>" +
          contactRow(trk.rider.phone, "rider", "Hello, I am the seller for order #" + String(x.id).slice(0, 8) + " on SafeBuy NG.") + "</div>";
      }
      extra += timeline(trk && trk.events);
      var st = x.delivery_status, act = "";
      if (st === "fee_paid" && x.status === "paid") act = '<button class="button button-primary" type="button" data-ddisp="' + E(x.id) + '">Ready for rider pickup</button>';
      else if (st === "fee_paid") act = '<span class="muted">Mark the order Paid. A rider is requested automatically.</span>';
      return '<div class="seller-item"><strong>' + E(x.product_name || "Product") + "</strong> × " + x.quantity +
        '<br><span class="muted">' + (st === "requested" ? "Buyer must pay the delivery fee first" : st === "fee_paid" ? "Delivery fee confirmed" : "With the rider network") +
        " · #" + E(String(x.id).slice(0, 8)) + '</span><div class="seller-actions">' + act + "</div>" + extra + "</div>";
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
