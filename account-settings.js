/* SafeBuy NG: Account settings (name, email, password, shop contact). Load after orders.js */
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
        render(u, a.data);
      });
    });
  }

  function render(u, app) {
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
        : "");

    document.getElementById("as-mode").onclick = function () { switchMode(); close(); };
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
    "body.sb-seller .cart-button,body.sb-seller #mp-orders-btn,body.sb-seller .mobile-nav [data-action=cart]{display:none!important}" +
    "body.sb-buyer #mp-shop-btn,body.sb-buyer #sb-myshop{display:none!important}";
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
