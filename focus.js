/* SafeBuy NG - focus.js v2. Display only: never touches Supabase, products, orders or delivery code. */
(function () {
  "use strict";
  try {
    var h1 = document.querySelector(".hero h1"), lead = document.querySelector(".hero-lead");
    if (!h1 || !lead || document.querySelector(".roles")) return;

    h1.textContent = "Shop from Nigerian sellers, delivered by approved riders.";
    lead.textContent = "Sellers list products. Riders deliver them. You confirm with a code.";

    /* Search moves into the hero (same element, so its handlers keep working). */
    var sw = document.querySelector(".search-wrap");
    if (sw) {
      var hs = document.createElement("div");
      hs.className = "hero-search";
      lead.insertAdjacentElement("afterend", hs);
      hs.appendChild(sw);
    }

    /* Clicks go to the original buttons, so sign-in checks and dialogs behave as before. */
    function click(sel) { var el = document.querySelector(sel); if (el) el.click(); }
    function sell() { click('.duo-card [data-action="sell"]'); }
    var roles = [
      { c: "buy",  i: "🛍️", t: "Buy",     s: "Products from verified sellers", cta: "Shop now", go: function () { var s = document.getElementById("shop"); if (s) s.scrollIntoView({ behavior: "smooth" }); } },
      { c: "sell", i: "🏪", t: "Sell",    s: "Open a free shop in minutes", cta: "Start selling", go: sell },
      { c: "ride", i: "🏍️", t: "Deliver", s: "Earn as an approved rider", cta: "Become a rider", img: "./images/safebuy-rider.jpg",
        go: function () { click('[data-rr="ride"]') || click('.duo-card [data-action="deliver"]'); } }
    ];
    var wrap = document.createElement("div");
    wrap.className = "roles";
    roles.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "role " + r.c;
      b.innerHTML = '<span class="role-ico" aria-hidden="true">' + r.i + (r.img ? '<img src="' + r.img + '" alt="" onerror="this.remove()">' : "") +
        '</span><span class="role-txt"><b>' + r.t + "</b><small>" + r.s + '</small></span><span class="role-cta">' + r.cta + "</span>";
      b.addEventListener("click", r.go);
      wrap.appendChild(b);
    });
    (hs || lead).insertAdjacentElement("afterend", wrap);
    var old = document.querySelector(".hero-buttons"); if (old) old.remove();

    var nav = document.querySelector('.desktop-nav a[data-spy="sell"]');
    if (nav) nav.addEventListener("click", function (e) { e.preventDefault(); sell(); });

    /* 1. "How it works": one dropdown per role, in the delivery section (replaces the 4 step cards). */
    var steps = document.querySelector(".dsteps"), faq = document.querySelector(".faq");
    var where = document.querySelector(".dwhere");
    if (steps && where) {
      var hd = document.querySelector("#delivery .section-heading");
      if (hd) {
        hd.querySelector("h2").textContent = "How it works";
        hd.querySelector("p").textContent = "Tap your role to see the steps. Nothing is marked delivered until the buyer shares their code.";
      }
      var item = function (ico, cls, title, sub, body, go, cta) {
        return '<details class="dd" name="sb-guide"><summary><span class="tile ' + cls + '">' + ico + '</span><span class="dd-t">' + title +
          "<small>" + sub + '</small></span><span class="chev">⌄</span></summary><div class="dd-body">' + body +
          (go ? '<button class="button button-primary" type="button" data-go="' + go + '" style="margin-top:8px">' + cta + "</button>" : "") + "</div></details>";
      };
      var g = document.createElement("div");
      g.className = "guide";
      g.innerHTML =
        item("🛍️", "", "For buyers", "Find it, order it, get it delivered",
          '<ol class="steps"><li><span>Browse or search products and tap <b>Chat seller</b>.</span></li><li><span>Choose delivery on your order. <b>You see the fee before you pay.</b></span></li><li><span>The nearest approved rider collects it and brings it to you.</span></li><li><span>Check the item, then give the rider your <b>4-digit code</b>.</span></li></ol>', "shop", "Browse products") +
        item("🏪", "o", "For sellers", "Open a shop and sell in minutes",
          '<ol class="steps"><li><span>Tap <b>Sell</b> and create your shop in one step.</span></li><li><span>List products with photos. They go live right away.</span></li><li><span>Buyers contact you on WhatsApp. Mark the order ready and a rider collects it.</span></li><li><span>Get verified to earn the <b>✓ Verified</b> badge.</span></li></ol>', "sell", "Start selling") +
        item("🏍️", "", "For riders and companies", "Earn by delivering nearby orders",
          '<ol class="steps"><li><span>Apply as an individual rider or a delivery company.</span></li><li><span>We check your ID and documents before you can take jobs.</span></li><li><span>Go online to receive nearby offers. Accept one job at a time.</span></li><li><span>Collect, deliver, and enter the buyer’s code. <b>You are paid after delivery is confirmed.</b></span></li></ol>', "ride", "Become a rider") +
        item("❓", "o", "Delivery questions", "Fees, matching and refunds", "", "", "");
      steps.style.display = "none";
      where.parentNode.insertBefore(g, steps);
      if (faq) g.querySelector("details:last-child .dd-body").appendChild(faq);
      g.addEventListener("click", function (e) {
        var b = e.target.closest("[data-go]");
        if (!b) return;
        if (b.dataset.go === "shop") { var s = document.getElementById("shop"); if (s) s.scrollIntoView({ behavior: "smooth" }); }
        if (b.dataset.go === "sell") sell();
        if (b.dataset.go === "ride") click('[data-rr="ride"]') || click('.duo-card [data-action="deliver"]');
      });
    }

    /* 2. Shop: filters and sort share one small dropdown (same elements, so their handlers keep working). */
    var tb = document.querySelector(".toolbar"), fr = document.getElementById("filter-row"), sr = document.querySelector(".sort-row");
    if (tb && fr && sr) {
      var f = document.createElement("details");
      f.className = "dd filters-dd";
      f.innerHTML = '<summary><span class="tile">⚙️</span><span class="dd-t">Filters &amp; sort</span><span class="chev">⌄</span></summary><div class="dd-body"></div>';
      tb.appendChild(f);
      var body = f.querySelector(".dd-body");
      body.appendChild(fr);
      body.appendChild(sr);
    }

    /* theme.js adds "Marketplace pulse" above the shop; put it below the products. */
    var tries = 0, t = setInterval(function () {
      var p = document.getElementById("pulse"), s = document.getElementById("shop");
      if (p && s) { s.parentNode.insertBefore(p, s.nextSibling); clearInterval(t); }
      else if (++tries > 40) clearInterval(t);
    }, 500);
  } catch (e) { console.info("focus.js skipped:", e && e.message); }
})();
