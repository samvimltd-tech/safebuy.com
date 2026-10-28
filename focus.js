/* SafeBuy NG - focus.js: three role cards + folded FAQ. Hides nothing your other scripts need. */
(function () {
  "use strict";
  var h1 = document.querySelector(".hero h1");
  var lead = document.querySelector(".hero-lead");
  var old = document.querySelector(".hero-buttons");
  if (!h1 || !old) return;

  h1.innerHTML = "Buy it. Sell it.<br>We deliver it.";
  if (lead) lead.textContent = "SafeBuy NG brings Nigerian buyers, sellers and approved delivery riders together in one marketplace.";

  /* Clicks go to the original buttons, so sign-in checks and dialogs behave exactly as before. */
  function proxy(selector) {
    return function () { var el = document.querySelector(selector); if (el) el.click(); };
  }
  var roles = [
    { cls: "buy",  ico: "🛍️", t: "Buy",     d: "Shop from verified sellers and get it delivered to you.", cta: "Shop products",  go: function () { var s = document.getElementById("shop"); if (s) s.scrollIntoView({ behavior: "smooth" }); } },
    { cls: "sell", ico: "🏪", t: "Sell",    d: "Open a free shop and list your products in minutes.",      cta: "Start selling",  go: proxy('.duo-card [data-action="sell"]') },
    { cls: "ride", ico: "🏍️", t: "Deliver", d: "Earn by delivering nearby orders as an approved rider.",   cta: "Become a rider", img: "./images/safebuy-rider.jpg", go: function () { var el = document.querySelector('[data-rr="ride"]') || document.querySelector('.duo-card [data-action="deliver"]'); if (el) el.click(); } }
  ];
  var wrap = document.createElement("div");
  wrap.className = "roles";
  roles.forEach(function (r) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "role " + r.cls;
    b.innerHTML = '<span class="role-ico" aria-hidden="true">' + r.ico + (r.img ? '<img src="' + r.img + '" alt="" onerror="this.remove()">' : "") + "</span><b>" + r.t + "</b><small>" + r.d + '</small><span class="role-cta">' + r.cta + "</span>";
    b.addEventListener("click", r.go);
    wrap.appendChild(b);
  });
  old.parentNode.replaceChild(wrap, old);

  /* Header "Sell" link opens the seller flow instead of scrolling to a hidden block. */
  var nav = document.querySelector('.desktop-nav a[data-spy="sell"]');
  if (nav) nav.addEventListener("click", function (e) { e.preventDefault(); proxy('.duo-card [data-action="sell"]')(); });

  /* Fold the delivery FAQ. */
  var faq = document.querySelector(".faq");
  if (faq) {
    var d = document.createElement("details");
    d.className = "faq-more";
    d.innerHTML = "<summary>Questions about delivery</summary>";
    faq.parentNode.insertBefore(d, faq);
    d.appendChild(faq);
  }

  /* theme.js adds the stats card above the shop; move it below the products so listings come first. */
  var tries = 0, t = setInterval(function () {
    var p = document.getElementById("pulse"), s = document.getElementById("shop");
    if (p && s) { s.parentNode.insertBefore(p, s.nextSibling); clearInterval(t); }
    else if (++tries > 40) clearInterval(t);
  }, 500);
})();
