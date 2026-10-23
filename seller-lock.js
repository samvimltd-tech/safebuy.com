/* SafeBuy NG: while a seller has overdue orders, the dashboard shows only the
   orders. Adding and editing products is hidden until they are handled.
   Needs seller-lock.sql run first. Load AFTER orders.js. */
(function () {
  "use strict";

  var c = window.safeBuySupabase;
  var sb = document.getElementById("seller-body");
  if (!c || !sb) return;

  var HOURS = 24; // keep in sync with seller-lock.sql
  var state = { overdue: 0, pending: false };
  var lastForm = null;

  function done(n) {
    state.overdue = n;
    state.pending = false;
    applyLock();
  }

  function refresh(showPending) {
    if (showPending) { state.pending = true; applyLock(); }

    c.auth.getUser().then(function (r) {
      var u = r.data && r.data.user;
      if (!u) return done(0);

      return c.from("seller_applications").select("id").eq("user_id", u.id).maybeSingle().then(function (a) {
        if (!a.data) return done(0);

        var cutoff = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();
        return c.from("marketplace_orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_application_id", a.data.id)
          .in("status", ["placed", "paid"])
          .lt("status_changed_at", cutoff)
          .then(function (res) {
            if (res.error) {
              console.warn("SafeBuy: overdue check failed (did you run seller-lock.sql?)", res.error.message);
              return done(0);
            }
            done(res.count || 0);
          });
      });
    }).catch(function () { done(0); });
  }

  /* Idempotent: safe to call any number of times. */
  function applyLock() {
    var form = document.getElementById("product-form");
    if (!form) return;

    var heading = document.getElementById("pf-heading");
    var list = document.getElementById("my-products");
    var listHeading = list && list.previousElementSibling;
    var locked = !state.pending && state.overdue > 0;
    var hide = state.pending || state.overdue > 0;

    [heading, form, list, listHeading].forEach(function (el) {
      if (el && el.hidden !== hide) el.hidden = hide;
    });

    var banner = document.getElementById("lock-banner");
    if (locked) {
      var text = "You have " + state.overdue + " overdue order" + (state.overdue === 1 ? "" : "s") +
        ". Mark each one Paid then Shipped, or Cancel it, to unlock adding and editing products. Buyers are waiting.";
      if (!banner) {
        banner = document.createElement("p");
        banner.id = "lock-banner";
        banner.className = "modal-note";
        if (heading && heading.parentNode) heading.parentNode.insertBefore(banner, heading);
        else sb.appendChild(banner);
      }
      if (banner.textContent !== text) banner.textContent = text;
    } else if (banner) {
      banner.remove();
      banner = null;
    }

    // Show orders right under the banner while locked, back at the bottom otherwise
    var box = document.getElementById("seller-orders");
    if (box) {
      if (locked && banner) {
        if (banner.nextElementSibling !== box) banner.after(box);
      } else if (!hide && sb.lastElementChild !== box) {
        sb.appendChild(box);
      }
    }
  }

  // The dashboard is rebuilt every time it opens: detect a fresh render and re-check
  new MutationObserver(function () {
    var form = document.getElementById("product-form");
    if (!form) { lastForm = null; return; }
    if (form !== lastForm) { lastForm = form; refresh(true); return; }
    applyLock();
  }).observe(sb, { childList: true, subtree: true });

  // After the seller marks an order, re-check so the dashboard unlocks right away
  sb.addEventListener("click", function (e) {
    if (e.target.closest("[data-so]")) {
      setTimeout(function () { refresh(false); }, 1500);
      setTimeout(function () { refresh(false); }, 4000);
    }
  });
})();
