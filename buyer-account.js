/* SafeBuy NG: buyer/seller accounts + show/hide password. Load after the main inline script. */
(function () {
  "use strict";

  var client = window.safeBuySupabase || null;
  var accountBtn = document.querySelector('.header-actions [data-action="account"]');
  var backdrop = document.getElementById("account-backdrop");
  var title = document.getElementById("account-title");
  var form = document.getElementById("account-form");
  var submit = document.getElementById("account-submit");
  var toggle = document.getElementById("account-toggle");
  var pass = document.getElementById("account-password");
  if (!accountBtn || !backdrop || !title || !form || !submit || !toggle || !pass) return;

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var style = document.createElement("style");
  style.textContent =
    "@media (max-width:650px){.header-actions .buyer-header{display:none}}" +
    ".pw-wrap{position:relative}.pw-wrap input{padding-right:76px}" +
    ".pw-toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#066548;font-weight:700;font-size:13px;padding:10px}" +
    "#role-box{margin:0 0 6px}#role-box .status-pill.buyer{background:#e7eefa;color:#1f3d7a}";
  document.head.appendChild(style);

  /* ---------- Show / hide password ---------- */
  var wrap = document.createElement("div");
  wrap.className = "pw-wrap";
  pass.parentNode.insertBefore(wrap, pass);
  wrap.appendChild(pass);
  var eye = document.createElement("button");
  eye.type = "button";
  eye.className = "pw-toggle";
  wrap.appendChild(eye);

  function setPw(show) {
    pass.type = show ? "text" : "password";
    eye.textContent = show ? "Hide" : "Show";
    eye.setAttribute("aria-pressed", show ? "true" : "false");
    eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }
  setPw(false);
  eye.addEventListener("click", function () { setPw(pass.type === "password"); });
  new MutationObserver(function () {
    if (!backdrop.classList.contains("open")) setPw(false); // re-hide when the popup closes
  }).observe(backdrop, { attributes: true, attributeFilter: ["class"] });

  /* ---------- Buyer or seller choice at sign-up ---------- */
  var chooser = document.createElement("div");
  chooser.innerHTML =
    '<label class="check"><input type="radio" name="sb-type" value="buyer" checked> I want to buy (buyer account)</label>' +
    '<label class="check"><input type="radio" name="sb-type" value="seller"> I want to sell (seller account)</label>';
  submit.insertAdjacentElement("beforebegin", chooser);

  function chosen() {
    var r = chooser.querySelector("input:checked");
    return r ? r.value : "buyer";
  }

  function syncWording() {
    var signup = /^create/i.test(submit.textContent);
    var t = chosen();
    chooser.hidden = !signup;
    var want = "Create " + t + " account";
    if (signup && submit.textContent !== want) submit.textContent = want;
    var wantTitle = signup ? "Create your " + t + " account" : "Welcome to SafeBuy NG";
    if (title.textContent !== wantTitle) title.textContent = wantTitle;
  }
  new MutationObserver(syncWording).observe(submit, { childList: true, characterData: true, subtree: true });
  chooser.addEventListener("change", syncWording);
  form.addEventListener("submit", function () {
    if (/^create/i.test(submit.textContent)) store("sb_signup_type", chosen());
  }, true);
  syncWording();

  /* ---------- Header button ---------- */
  var buyerBtn = document.createElement("button");
  buyerBtn.type = "button";
  buyerBtn.className = "button button-light buyer-header";
  buyerBtn.textContent = "Create buyer account";
  accountBtn.insertAdjacentElement("afterend", buyerBtn);
  buyerBtn.addEventListener("click", function () {
    chooser.querySelector('input[value="buyer"]').checked = true;
    accountBtn.click();
    if (/sign up/i.test(toggle.textContent)) toggle.click();
    syncWording();
  });

  /* ---------- Role box inside the account popup ---------- */
  var box = document.createElement("div");
  box.id = "role-box";
  box.hidden = true;
  backdrop.querySelector(".modal-top").insertAdjacentElement("afterend", box);

  function openSell() {
    document.getElementById("account-close").click();
    var b = document.querySelector('[data-action="sell"]');
    if (b) b.click();
  }
  box.addEventListener("click", function (e) {
    if (e.target.closest("#role-action")) openSell();
  });

  function renderRole(user, app) {
    if (!user) { box.hidden = true; box.innerHTML = ""; return; }
    var meta = (user.user_metadata || {}).account_type;
    var pill, note, btn;
    if (app) {
      if (app.verification_status === "approved") pill = '<p class="status-pill ok">✓ Seller account · Verified</p>';
      else if (app.verification_status === "rejected") pill = '<p class="status-pill bad">Seller account · Suspended</p>';
      else pill = '<p class="status-pill">Seller account · Unverified</p>';
      note = "Shop: " + esc(app.shop_name) + ". You can also buy from other sellers with this login.";
      btn = "Manage my shop";
    } else if (meta === "seller") {
      pill = '<p class="status-pill">Seller account · shop not set up</p>';
      note = "Finish setting up your shop to start listing products.";
      btn = "Set up my shop";
    } else {
      pill = '<p class="status-pill buyer">Buyer account</p>';
      note = "You can browse and chat with sellers. Want to sell too? Open a shop with this same login.";
      btn = "Become a seller";
    }
    box.innerHTML = pill + '<p class="muted">' + note + '</p><button type="button" class="button button-light" id="role-action">' + btn + "</button>";
    box.hidden = false;
  }

  /* ---------- Signed-in state ---------- */
  function refreshHeader(user) {
    var name = user && user.user_metadata && user.user_metadata.full_name;
    accountBtn.textContent = user ? "Hi, " + (name ? String(name).trim().split(" ")[0] : "account") : "Sign in";
    buyerBtn.hidden = !!user;
  }

  function handleUser(user) {
    refreshHeader(user);
    if (!user || !client) { renderRole(null); return; }
    // Deferred: calling Supabase inside its own auth callback can stall.
    setTimeout(async function () {
      try {
        var fresh = false;
        var meta = (user.user_metadata || {}).account_type;
        var pending = read("sb_signup_type") === "seller" ? "seller" : "buyer";
        if (!meta) {
          fresh = true;
          await client.auth.updateUser({ data: { account_type: pending } });
          user = Object.assign({}, user, { user_metadata: Object.assign({}, user.user_metadata, { account_type: pending }) });
        }
        var res = await client.from("seller_applications").select("shop_name,verification_status").eq("user_id", user.id).maybeSingle();
        var app = res.error ? null : res.data;
        renderRole(user, app);
        if (fresh) {
          store("sb_signup_type", null);
          if (pending === "seller" && !app) openSell(); // new seller goes straight to shop setup
        }
      } catch (e) {}
    }, 0);
  }

  if (client) {
    client.auth.getSession().then(function (r) {
      handleUser(r.data && r.data.session ? r.data.session.user : null);
    });
    client.auth.onAuthStateChange(function (_event, session) {
      handleUser(session ? session.user : null);
    });
  }
})();
