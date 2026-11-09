/* SafeBuy NG: counts how many times a product card was actually shown on screen (feeds "Product impressions" in the seller tools).
   Once per product per visit, sent in small batches. Safe to load on every page. */
(function () {
  "use strict";
  if (window.__sbImp) return; window.__sbImp = true;
  if (!("IntersectionObserver" in window)) return;
  var seen = {}, queue = [], timer = null, sentTotal = 0;
  function client() { return window.safeBuySupabase && window.safeBuySupabase.rpc ? window.safeBuySupabase : null; }
  function flush() {
    timer = null; var c = client(); if (!c || !queue.length) return;
    var batch = queue.splice(0, 30); sentTotal += batch.length;
    try { var p = c.rpc("track_impressions", { p_ids: batch }); if (p && p.then) p.then(function () {}, function () {}); } catch (e) {}
    if (queue.length && sentTotal < 300) timer = setTimeout(flush, 4000);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.getAttribute("data-id"); io.unobserve(en.target);
      if (!id || seen[id] || sentTotal + queue.length >= 300) return;
      seen[id] = 1; queue.push(id);
      if (!timer) timer = setTimeout(flush, 2500);
    });
  }, { threshold: 0.5 });
  function scan() { document.querySelectorAll(".product-art[data-id]:not([data-imp])").forEach(function (el) { el.setAttribute("data-imp", "1"); io.observe(el); }); }
  new MutationObserver(function () { scan(); }).observe(document.body, { childList: true, subtree: true });
  scan();
  document.addEventListener("visibilitychange", function () { if (document.hidden && queue.length) flush(); });
})();
