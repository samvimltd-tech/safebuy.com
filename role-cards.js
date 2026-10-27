/* SafeBuy NG: role-cards.js
   Adds (1) a "Become a delivery rider or partner" card on the hero and
   (2) three clear paths: I want to buy / I want to sell / Rider (delivery partner).
   Does not edit index.html logic, product loading or Supabase code. Load AFTER ./delivery-boost.js. */
(function () {
  "use strict";
  var KEY = "safebuy_intent";
  var MAX_AGE = 2 * 60 * 60 * 1000; // intent expires after 2 hours
  var LABEL = { sell: "sell on SafeBuy NG", ride: "deliver with SafeBuy NG" };

  function q(sel) { return document.querySelector(sel); }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function signedIn() { return document.body.classList.contains("sb-in"); }
  function press(el) { if (el) { el.click(); return true; } return false; }

  /* Open the existing flow for each role (uses the buttons your page already has). */
  function act(role) {
    if (role === "buy") {
      var shop = q("#shop");
      if (shop) shop.scrollIntoView({ behavior: "smooth" });
    } else if (role === "sell") {
      press(q('#sell [data-action="sell"]')) || press(q('[data-action="sell"]'));
    } else if (role === "ride") {
      press(q('.dd-menu [data-action="deliver"]')) || press(q('[data-action="deliver"]'));
    }
  }

  function choose(role) {
    if (role === "buy" || signedIn()) { act(role); return; }
    // Selling and riding need an account: remember the choice, open Create account, continue after sign-in.
    store(KEY, JSON.stringify({ r: role, t: Date.now() }));
    var signup = q('#drawer-account [data-auth="signup"]') || q('[data-auth="signup"]');
    if (!press(signup)) press(q('[data-action="account"]'));
    setTimeout(function () {
      if (window.say) window.say("Create your account to " + LABEL[role] + ". We will take you there as soon as you are signed in.");
    }, 60);
  }

  /* After sign-in, take the person to the path they picked. */
  function resume() {
    var raw = store(KEY);
    if (!raw || !signedIn()) return;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) {}
    store(KEY, null);
    if (!d || !d.r || Date.now() - d.t > MAX_AGE) return;
    setTimeout(function () { act(d.r); }, 900);
  }
  new MutationObserver(resume).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  resume();

  /* ---------- Look ---------- */
  var style = document.createElement("style");
  style.textContent =
    ".rr-hero{display:flex;align-items:center;gap:12px;margin-top:18px;padding:12px 14px;max-width:520px;background:#fff;border:1px solid #bfe6d1;border-radius:16px;box-shadow:0 8px 25px #173b2812}" +
    ".rr-ico{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border-radius:13px;background:var(--green-light);font-size:22px}" +
    ".rr-hero .rr-text{flex:1;min-width:0}" +
    ".rr-hero strong{display:block;font-size:15px;line-height:1.3}" +
    ".rr-hero small{display:block;color:var(--muted);font-size:12px;line-height:1.4;margin-top:2px}" +
    ".rr-hero .button{flex-shrink:0;padding:10px 14px;font-size:13px}" +
    ".rr-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 22px}" +
    ".rr-role{display:flex;align-items:center;gap:12px;padding:16px;background:#fff;border:1px solid var(--line);border-radius:16px;text-align:left;color:var(--ink);font-weight:800;font-size:15px}" +
    ".rr-role:hover{border-color:var(--green);background:var(--green-light)}" +
    ".rr-role small{display:block;color:var(--muted);font-weight:400;font-size:12px;line-height:1.4}" +
    ".rr-role.rider{border-color:#bfe6d1;background:var(--green-light)}" +
    "@media (max-width:650px){.rr-roles{grid-template-columns:1fr;gap:9px}.rr-hero{flex-wrap:wrap}.rr-hero .button{width:100%}}";
  document.head.appendChild(style);

  function build() {
    var buttons = q(".hero-buttons");
    var quick = q(".quick-links");
    if (!buttons || !quick || document.getElementById("rr-hero")) return;

    var hero = document.createElement("div");
    hero.id = "rr-hero";
    hero.className = "rr-hero";
    hero.innerHTML =
      '<span class="rr-ico" aria-hidden="true">🏍️</span>' +
      '<div class="rr-text"><strong>Become a delivery rider or partner</strong>' +
      "<small>Earn by delivering SafeBuy NG orders. Individual riders and delivery companies welcome. Every partner is verified.</small></div>" +
      '<button class="button button-primary" type="button" data-rr="ride">Apply →</button>';
    buttons.insertAdjacentElement("afterend", hero);

    var roles = document.createElement("section");
    roles.className = "rr-roles";
    roles.setAttribute("aria-label", "Choose how you want to use SafeBuy NG");
    roles.innerHTML =
      '<button class="rr-role" type="button" data-rr="buy"><span class="rr-ico" aria-hidden="true">🛍️</span><span>I want to buy<small>Browse products and chat with sellers</small></span></button>' +
      '<button class="rr-role" type="button" data-rr="sell"><span class="rr-ico" aria-hidden="true">🏪</span><span>I want to sell<small>Open a shop and list products</small></span></button>' +
      '<button class="rr-role rider" type="button" data-rr="ride"><span class="rr-ico" aria-hidden="true">🏍️</span><span>Rider / Delivery partner<small>Deliver orders and get paid</small></span></button>';
    quick.insertAdjacentElement("beforebegin", roles);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-rr]");
    if (b) choose(b.dataset.rr);
  });

  build();
})();
