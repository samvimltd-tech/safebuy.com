
/* SafeBuy NG: single Rider / Delivery partner homepage card.
   Uses existing delivery.js registration and dashboard.
   Preserves buyer and seller delivery flows.
   Image path: ./images/safebuy-rider.jpg
   Load AFTER delivery.js, delivery-orders.js and delivery-boost.js. */

(function () {
  "use strict";

  var KEY = "safebuy_intent";
  var MAX_AGE = 2 * 60 * 60 * 1000;

  function q(selector) {
    return document.querySelector(selector);
  }

  function store(key, value) {
    try {
      if (value === undefined) {
        return localStorage.getItem(key);
      }

      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      return null;
    }
  }

  function signedIn() {
    return document.body.classList.contains("sb-in");
  }

  // Open the existing rider registration/dashboard.
  function openRiderFlow() {
    var button = q('[data-action="deliver"]');

    if (button) {
      button.click();
      return;
    }

    if (window.showToast) {
      window.showToast(
        "Delivery registration is temporarily unavailable. Please try again."
      );
    }
  }

  function chooseRider() {
    if (signedIn()) {
      openRiderFlow();
      return;
    }

    // Remember the rider choice until sign-in is complete.
    store(KEY, JSON.stringify({
      r: "ride",
      t: Date.now()
    }));

    var signup =
      q('#drawer-account [data-auth="signup"]') ||
      q('[data-auth="signup"]') ||
      q('[data-action="account"]');

    if (signup) {
      signup.click();
    }

    if (window.showToast) {
      window.showToast(
        "Sign in or create an account to become a delivery partner."
      );
    } else if (window.say) {
      window.say(
        "Create your account to deliver with SafeBuy NG."
      );
    }
  }

  // Resume the rider flow after successful authentication.
  function resumeRiderFlow() {
    var raw = store(KEY);

    if (!raw || !signedIn()) {
      return;
    }

    var intent;

    try {
      intent = JSON.parse(raw);
    } catch (error) {
      store(KEY, null);
      return;
    }

    if (
      !intent ||
      intent.r !== "ride" ||
      !intent.t ||
      Date.now() - intent.t > MAX_AGE
    ) {
      store(KEY, null);
      return;
    }

    store(KEY, null);

    window.setTimeout(openRiderFlow, 900);
  }

  // Card styling.
  var style = document.createElement("style");

  style.textContent =
    ".rr-hero{" +
      "display:flex;" +
      "align-items:center;" +
      "gap:14px;" +
      "margin:18px 0 22px;" +
      "padding:14px 16px;" +
      "max-width:560px;" +
      "background:#fff;" +
      "border:1px solid #bfe6d1;" +
      "border-radius:16px;" +
      "box-shadow:0 8px 25px #173b2812;" +
    "}" +

    ".rr-ico{" +
      "display:grid;" +
      "place-items:center;" +
      "flex:0 0 64px;" +
      "width:64px;" +
      "height:64px;" +
      "overflow:hidden;" +
      "border-radius:14px;" +
      "background:#101010;" +
    "}" +

    ".rr-ico img{" +
      "display:block;" +
      "width:100%;" +
      "height:100%;" +
      "object-fit:contain;" +
      "object-position:center;" +
    "}" +

    ".rr-text{" +
      "flex:1;" +
      "min-width:0;" +
    "}" +

    ".rr-text strong{" +
      "display:block;" +
      "font-size:15px;" +
      "line-height:1.35;" +
    "}" +

    ".rr-text small{" +
      "display:block;" +
      "margin-top:3px;" +
      "color:var(--muted);" +
      "font-size:12px;" +
      "line-height:1.5;" +
    "}" +

    ".rr-hero .button{" +
      "flex-shrink:0;" +
      "padding:10px 14px;" +
      "font-size:13px;" +
    "}" +

    "@media(max-width:520px){" +
      ".rr-hero{" +
        "align-items:center;" +
        "flex-wrap:wrap;" +
      "}" +
      ".rr-hero .rr-text{" +
        "flex:1;" +
        "min-width:150px;" +
      "}" +
      ".rr-hero .button{" +
        "width:100%;" +
      "}" +
    "}";

  document.head.appendChild(style);

  // Create one card only.
  function buildCard() {
    if (document.getElementById("rr-hero")) {
      return;
    }

    var heroButtons = q(".hero-buttons");

    if (!heroButtons) {
      return;
    }

    var card = document.createElement("section");

    card.id = "rr-hero";
    card.className = "rr-hero";
    card.setAttribute(
      "aria-label",
      "Rider / Delivery partner"
    );

    card.innerHTML =
      '<span class="rr-ico">' +
        '<img ' +
          'src="./images/safebuy-rider.jpg" ' +
          'alt="SafeBuy NG delivery rider" ' +
          'loading="eager" ' +
          'onerror="this.style.display=\'none\'">' +
      '</span>' +

      '<span class="rr-text">' +
        '<strong>Rider / Delivery partner</strong>' +
        '<small>Deliver orders and get paid</small>' +
      '</span>' +

      '<button ' +
        'class="button button-primary" ' +
        'type="button" ' +
        'data-rr="ride">' +
        'Get started →' +
      '</button>';

    heroButtons.insertAdjacentElement("afterend", card);
  }

  // Only the rider card responds to this handler.
  document.addEventListener("click", function (event) {
    var button = event.target.closest('[data-rr="ride"]');

    if (button) {
      chooseRider();
    }
  });

  // Watch for authentication changes.
  new MutationObserver(resumeRiderFlow).observe(
    document.body,
    {
      attributes: true,
      attributeFilter: ["class"]
    }
  );

  buildCard();
  resumeRiderFlow();

})();
