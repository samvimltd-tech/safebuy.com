/* ---------- Products: load straight from Supabase's REST API (no sign-in lock) ---------- */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig;
  if (!cfg || !cfg.url || !cfg.publishableKey || typeof window.setProducts !== "function") return;
  var live = false, orig = window.setProducts;

  /* never let the page's slow built-in loader replace live data with sample products */
  window.setProducts = function (list, source, message) {
    if (live && source === "sample") return;
    return orig.call(this, list, source, message);
  };

  function load(attempt) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    fetch(cfg.url + "/rest/v1/seller_products_public?select=*&order=created_at.desc", {
      headers: { apikey: cfg.publishableKey },
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      return res.json().then(function (rows) { return { ok: res.ok, rows: rows }; });
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok || !Array.isArray(r.rows)) throw new Error("bad response");
      live = true;
      window.setProducts(r.rows.map(function (x, i) {
        return window.normalizeProduct({
          id: x.id, name: x.name, category: x.category, price: Number(x.price_kobo) / 100,
          seller: x.shop_name, image: x.image_url, description: x.description,
          verified: x.verified, inStock: x.in_stock, slug: x.slug, condition: x.condition
        }, i);
      }), "supabase");
    }).catch(function () {
      clearTimeout(timer);
      if (attempt < 2) setTimeout(function () { load(attempt + 1); }, 1500);
    });
  }
  load(0);
})();

/* SafeBuy NG: Account settings (name, email, password, shop contact, delivery partner link).
   Load after orders.js and before delivery.js / delivery-orders.js. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  var logout = document.getElementById("account-logout");
  if (!c || !logout) return;

  function E(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
  function msg(id, t, bad) { var m = document.getElementById(id); if (m) { m.textContent = t; m.style.color = bad ? "#8a1f1f" : ""; } }

  /* modal */
  var back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = '<div class="modal"><div class="modal-top"><h2>Account settings</h2><button class="icon-button" type="button" id="as-close" aria-label="Close">✕</button></div><div id="as-body"></div></div>';
  document.body.appendChild(back);
  var body = back.querySelector("#as-body");
  function close() { back.classList.remove("open"); }
  back.querySelector("#as-close").onclick = close;
  back.addEventListener("click", function (e) { if (e.target === back) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  /* button inside the sign-in/account popup */
  var btn = document.createElement("button");
  btn.type = "button"; btn.id = "account-settings-btn"; btn.className = "button button-outline"; btn.hidden = true;
  btn.textContent = "⚙ Account settings";
  logout.parentNode.insertBefore(btn, logout);
  function sync() { c.auth.getSession().then(function (r) { btn.hidden = !(r.data && r.data.session); }); }
  c.auth.onAuthStateChange(function () { setTimeout(sync, 0); });
  sync();
  btn.onclick = function () { var x = document.getElementById("account-close"); if (x) x.click(); open(); };

  function open() {
    body.innerHTML = "<p>Loading…</p>";
    back.classList.add("open");
    c.auth.getUser().then(function (r) {
      var u = r.data && r.data.user;
      if (!u) { body.innerHTML = "<p>Please sign in first.</p>"; return; }
      c.from("seller_applications").select("id,shop_name,phone,state").eq("user_id", u.id).maybeSingle().then(function (a) {
        var app = a.data;
        // Delivery details are optional: if the delivery tables are not installed yet, this section is simply left out.
        Promise.all([
          c.from("delivery_partners").select("status,partner_type,company_name").eq("user_id", u.id).maybeSingle(),
          app ? c.from("seller_applications").select("dp_address,dp_city,dp_state").eq("id", app.id).maybeSingle() : Promise.resolve({ data: null })
        ]).then(function (x) {
          render(u, app, {
            show: !x[0].error,
            partner: x[0].error ? null : x[0].data,
            pickup: x[1].error ? undefined : x[1].data
          });
        }, function () { render(u, app, { show: false }); });
      });
    });
  }

  function deliveryHtml(d, app) {
    if (!d || !d.show) return "";
    var h = "<h3>Delivery</h3>";
    if (d.partner) {
      var st = d.partner.status;
      h += '<p class="muted">Delivery partner account: <span class="status-pill' + (st === "approved" ? " ok" : st === "pending" ? "" : " bad") + '">' +
        E(st === "approved" ? "Approved" : st === "pending" ? "Under review" : st) + "</span></p>" +
        '<button class="button button-light" type="button" id="as-deliver" data-action="deliver">Open delivery dashboard</button>';
    } else {
      h += '<p class="muted">Earn by delivering SafeBuy NG orders. Every partner is verified before taking jobs.</p>' +
        '<button class="button button-light" type="button" id="as-deliver" data-action="deliver">Become a delivery partner</button>';
    }
    if (app && d.pickup !== undefined) {
      h += '<p class="muted" style="margin-top:12px">Shop pickup for delivery: ' +
        (d.pickup && d.pickup.dp_address ? E(d.pickup.dp_address + ", " + (d.pickup.dp_city || "") + ", " + (d.pickup.dp_state || "")) : "not set") +
        ". Change it under My shop › Delivery.</p>";
    }
    return h;
  }

  function render(u, app, d) {
    var name = (u.user_metadata && u.user_metadata.full_name) || "";
    body.innerHTML =
      "<h3>Account mode</h3>" +
      '<p class="muted">You are in <strong>' + (mode() === "seller" ? "Seller" : "Buyer") + '</strong> mode. One login works for both.</p>' +
      '<button class="button button-light" type="button" id="as-mode">' + modeLabel() + "</button>" +
      "<h3>Profile</h3>" +
      '<form id="as-profile"><label for="as-name">Full name</label><input id="as-name" type="text" maxlength="80" value="' + E(name) + '">' +
      '<label for="as-email">Email</label><input id="as-email" type="email" required value="' + E(u.email) + '">' +
      '<button class="button button-primary" type="submit">Save profile</button></form>' +
      '<p class="form-message" id="as-m1" role="status" aria-live="polite"></p>' +
      "<h3>Change password</h3>" +
      '<form id="as-pass"><label for="as-p1">New password</label><input id="as-p1" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters">' +
      '<label for="as-p2">Confirm new password</label><input id="as-p2" type="password" minlength="8" required autocomplete="new-password">' +
      '<button class="button button-primary" type="submit">Update password</button></form>' +
      '<p class="form-message" id="as-m2" role="status" aria-live="polite"></p>' +
      (app
        ? "<h3>Shop contact: " + E(app.shop_name) + "</h3>" +
          '<p class="muted">Buyers only receive this number after they have a paid order.</p>' +
          '<form id="as-shop"><label for="as-phone">WhatsApp / phone number</label><input id="as-phone" type="tel" required value="' + E(app.phone) + '">' +
          '<label for="as-state">State</label><input id="as-state" type="text" value="' + E(app.state) + '">' +
          '<button class="button button-primary" type="submit">Save shop contact</button></form>' +
          '<p class="form-message" id="as-m3" role="status" aria-live="polite"></p>'
        : "") +
      deliveryHtml(d, app);

    document.getElementById("as-mode").onclick = function () { switchMode(); close(); };
    var dv = document.getElementById("as-deliver");
    if (dv) dv.addEventListener("click", close);   // delivery.js opens its own window from the same click
    document.getElementById("as-profile").onsubmit = function (e) {
      e.preventDefault();
      var email = document.getElementById("as-email").value.trim();
      var attrs = { data: { full_name: document.getElementById("as-name").value.trim() } };
      var changed = email.toLowerCase() !== String(u.email).toLowerCase();
      if (changed) attrs.email = email;
      msg("as-m1", "Saving…");
      c.auth.updateUser(attrs).then(function (r) {
        if (r.error) { msg("as-m1", r.error.message, true); return; }
        msg("as-m1", changed ? "Saved. Check your new email inbox to confirm the change." : "Profile saved.");
      });
    };

    document.getElementById("as-pass").onsubmit = function (e) {
      e.preventDefault();
      var p1 = document.getElementById("as-p1").value, p2 = document.getElementById("as-p2").value;
      if (p1 !== p2) { msg("as-m2", "The two passwords do not match.", true); return; }
      msg("as-m2", "Updating…");
      c.auth.updateUser({ password: p1 }).then(function (r) {
        if (r.error) { msg("as-m2", r.error.message, true); return; }
        document.getElementById("as-p1").value = ""; document.getElementById("as-p2").value = "";
        msg("as-m2", "Password updated.");
      });
    };

    var shop = document.getElementById("as-shop");
    if (shop) shop.onsubmit = function (e) {
      e.preventDefault();
      msg("as-m3", "Saving…");
      c.from("seller_applications").update({
        phone: document.getElementById("as-phone").value.trim(),
        state: document.getElementById("as-state").value.trim() || null
      }).eq("id", app.id).select("id").then(function (r) {
        if (r.error || !r.data || !r.data.length) {
          var m = r.error ? r.error.message : "You do not have permission to change this.";
          if (/phone_format/.test(m)) m = "Check the phone number format, for example 08012345678.";
          msg("as-m3", m, true); return;
        }
        msg("as-m3", "Shop contact saved.");
      });
    };
  }

  /* ---------- Buyer / Seller mode ---------- */
  var MKEY = "sb_mode";
  function mode() { try { return localStorage.getItem(MKEY) === "seller" ? "seller" : "buyer"; } catch (e) { return "buyer"; } }
  function modeLabel() { return mode() === "seller" ? "🔄 Switch to Buyer mode" : "🔄 Switch to Seller mode"; }

  var st = document.createElement("style");
  st.textContent =
    "body.sb-seller .cart-button,body.sb-seller #mp-orders-btn,body.sb-seller #do-btn,body.sb-seller .mobile-nav [data-action=cart]{display:none!important}" +
    "body.sb-buyer #mp-shop-btn{display:none!important}#sb-myshop{display:none!important}body.sb-seller #sb-myshop{display:inline-flex!important}";
  document.head.appendChild(st);

  var actions = document.querySelector(".header-actions");
  var myShop = document.createElement("button");
  myShop.type = "button"; myShop.id = "sb-myshop"; myShop.className = "button button-primary"; myShop.textContent = "🏪 My shop";
  myShop.onclick = function () { var b = document.querySelector('[data-action="sell"]'); if (b) b.click(); };
  if (actions) actions.insertBefore(myShop, actions.firstChild);

  var modeBtn = document.createElement("button");
  modeBtn.type = "button"; modeBtn.id = "account-mode-btn"; modeBtn.className = "button button-light"; modeBtn.hidden = true;
  btn.parentNode.insertBefore(modeBtn, btn);

  function applyMode() {
    c.auth.getSession().then(function (r) {
      var on = !!(r.data && r.data.session);
      document.body.classList.remove("sb-seller", "sb-buyer");
      if (on) document.body.classList.add(mode() === "seller" ? "sb-seller" : "sb-buyer");
      modeBtn.hidden = !on;
      modeBtn.textContent = modeLabel();
    });
  }
  function switchMode() {
    var next = mode() === "seller" ? "buyer" : "seller";
    try { localStorage.setItem(MKEY, next); } catch (e) {}
    applyMode();
    var x = document.getElementById("account-close"); if (x) x.click();
    if (next === "buyer") {
      var sc = document.getElementById("seller-close"); if (sc) sc.click();
      if (window.showToast) window.showToast("Buyer mode: browse and order.");
    } else {
      var sell = document.querySelector('[data-action="sell"]'); if (sell) sell.click();
    }
  }
  modeBtn.onclick = switchMode;
  c.auth.onAuthStateChange(function () { setTimeout(applyMode, 0); });
  applyMode();
})();
