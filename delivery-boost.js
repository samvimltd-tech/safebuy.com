/* SafeBuy NG: delivery-boost.js
   Add-on for delivery.js and delivery-orders.js. Does not edit them and does not touch product loading.
   Load AFTER ./delivery-orders.js. If anything is missing, it quietly does nothing. */
(function () {
  "use strict";
  var c = window.safeBuySupabase, cfg = window.SAFEbuySupabaseConfig;
  if (!c) return;

  /* Keep the latest sign-in token so we can switch a rider offline even as the page closes. */
  var token = null;
  function setToken(s) { token = s && s.access_token ? s.access_token : null; }
  try {
    c.auth.getSession().then(function (r) { setToken(r.data && r.data.session); }).catch(function () {});
    c.auth.onAuthStateChange(function (_e, s) { setToken(s); });
  } catch (e) {}

  function note(text, cls) {
    var p = document.createElement("p");
    p.className = "muted " + cls;
    p.textContent = text;
    return p;
  }

  /* 1. Buyer: say what happens if no rider is found (workflow section 5 and 10). */
  function enhanceBuyer() {
    var cards = document.querySelectorAll("#do-body .review-card");
    Array.prototype.forEach.call(cards, function (card) {
      var t = card.textContent;
      if (card.querySelector(".sbx-note")) return;
      if (t.indexOf("Waiting for your payment") !== -1) {
        card.appendChild(note("If no rider is found, you get a full refund or a free retry. Your fee is held by SafeBuy NG until you confirm delivery with your code.", "sbx-note"));
      } else if (t.indexOf("No rider yet") !== -1) {
        card.appendChild(note("SafeBuy NG will assign a rider by hand. You can ask for a full refund or a free retry at any time before pickup.", "sbx-note"));
      }
    });
  }

  /* 2. Rider: after a reload the job card is hidden until you go online. Say so, so nobody abandons a parcel. */
  function enhanceRider() {
    var job = document.getElementById("dp-job");
    if (!job || job.dataset.sbx) return;
    job.dataset.sbx = "1";
    if (!document.getElementById("dp-on")) return; // only when offline
    c.rpc("my_active_job").then(function (r) {
      if (r.error || !r.data || !r.data.length || job.children.length) return;
      var d = document.createElement("div");
      d.className = "dp-card dp-offer";
      d.innerHTML = "<strong>You have an active delivery</strong><p class=\"muted\">Agree to location sharing and tap Go online to see the pickup and drop-off details and finish the job.</p>";
      job.appendChild(d);
    }).catch(function () {});
  }

  var queued = false;
  function run() {
    queued = false;
    try { enhanceBuyer(); enhanceRider(); } catch (e) {}
  }
  new MutationObserver(function () {
    if (!queued) { queued = true; requestAnimationFrame(run); }
  }).observe(document.body, { childList: true, subtree: true });

  /* 3. Rider: warn before closing the page in the middle of a delivery. */
  window.addEventListener("beforeunload", function (e) {
    if (document.querySelector("#dp-picked, #dp-done")) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* 4. Rider: when the page closes, reliably switch to offline so jobs stop going to a closed app. */
  window.addEventListener("pagehide", function () {
    if (!document.getElementById("dp-off") || !token || !cfg || !cfg.url || !cfg.publishableKey) return;
    try {
      fetch(String(cfg.url).replace(/\/+$/, "") + "/rest/v1/rpc/partner_set_online", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.publishableKey,
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ p_online: false, p_consent: true })
      });
    } catch (e) {}
  });
})();
