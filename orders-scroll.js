/* SafeBuy smart scroll: tap a header button and the page glides to the matching section.
   Works for buttons and sections that are added later (listens on the whole page and waits for the target). */
(function () {
  "use strict";

  // label = words on the button, targets = places to scroll to, heading = fallback word to find in a section title
  var RULES = [
    { label: /orders?/i,                       targets: ["#orders", "#my-orders", "#seller-orders", "#orders-list", "#order-list", "[data-orders]", ".orders-section", ".orders-list", ".order-list"], heading: /orders?/i },
    { label: /my\s*shop|dashboard/i,           targets: ["#my-shop", "#shop-dashboard", "#seller-dashboard", "#seller-body", "#my-products", "[data-shop]"], heading: /your listings|my shop|dashboard/i },
    { label: /^\s*hi[,\s]|account|profile|settings/i, targets: ["#account-settings", "#settings", "#profile", "#buyer-account", "[data-account]"], heading: /account|profile|settings/i }
  ];

  function visible(el) { return el && (el.offsetParent !== null || getComputedStyle(el).position === "fixed"); }

  function find(rule, btn) {
    var i, el;
    for (i = 0; i < rule.targets.length; i++) {
      el = document.querySelector(rule.targets[i]);
      if (el && el !== btn && !btn.contains(el) && visible(el)) return el;
    }
    var heads = document.querySelectorAll("h1,h2,h3,h4");
    for (i = 0; i < heads.length; i++) {
      if (rule.heading.test(heads[i].textContent) && !btn.contains(heads[i]) && visible(heads[i])) return heads[i];
    }
    return null;
  }

  function resolve(btn) {
    var explicit = btn.getAttribute("data-scroll-to");           // add data-scroll-to="#my-id" to any button
    if (explicit) return function () { var e = document.querySelector(explicit); return e && visible(e) ? e : null; };
    var text = btn.textContent || "";
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].label.test(text)) { var r = RULES[i]; return function () { return find(r, btn); }; }
    }
    return null;
  }

  function glide(el) {
    el.style.scrollMarginTop = "90px";                            // keeps it clear of the sticky header
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    var old = el.style.outline;
    el.style.outline = "3px solid #087f5b";
    setTimeout(function () { el.style.outline = old; }, 1600);
  }

  function whenReady(getter) {
    var done = false, obs;
    function attempt() { if (done) return; var el = getter(); if (el) { done = true; if (obs) obs.disconnect(); glide(el); } }
    setTimeout(attempt, 200);
    obs = new MutationObserver(attempt);                          // sections that appear after the tap are caught too
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { done = true; obs.disconnect(); }, 4000);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button,a,[data-scroll-to]");
    if (!btn) return;
    var getter = resolve(btn);
    if (getter) whenReady(getter);
  });
})();
