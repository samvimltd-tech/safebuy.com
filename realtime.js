/* SafeBuy NG - live updates. Works with or without Supabase Realtime: if the live link drops, it checks again every 45 seconds. */
(function () {
  "use strict";
  var started = false, chans = [], live = false, tmr = null, last = 0;
  function client() { return window.safeBuySupabase && window.safeBuySupabase.channel ? window.safeBuySupabase : null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(t, b) {
    var el = document.getElementById("sb-live-toast");
    if (!el) { el = document.createElement("div"); el.id = "sb-live-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      el.style.cssText = "position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:9999;max-width:420px;margin:0 auto;background:#172b24;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.35 Arial,sans-serif;box-shadow:0 8px 28px #0005;display:none";
      document.body.appendChild(el); }
    el.innerHTML = "<b>" + esc(t) + "</b>" + (b ? "<div style=\"opacity:.85;margin-top:2px\">" + esc(b) + "</div>" : ""); el.style.display = "block";
    clearTimeout(el._t); el._t = setTimeout(function () { el.style.display = "none"; }, 6000);
  }
  window.sbToast = toast;
  function modalOpen() { return !!document.querySelector(".modal-backdrop.open, #sh.open"); }
  var pend = false;
  function pulse() {
    var now = Date.now(); if (now - last < 800) return; last = now;
    document.dispatchEvent(new CustomEvent("sb:pulse"));
    if (typeof window.sbRefreshAds === "function") window.sbRefreshAds();
    if (typeof window.sbReloadProducts === "function") { if (modalOpen()) pend = true; else window.sbReloadProducts(); }
  }
  setInterval(function () { if (pend && !modalOpen()) { pend = false; if (typeof window.sbReloadProducts === "function") window.sbReloadProducts(); } }, 3000);
  function fallback() { clearInterval(tmr); tmr = setInterval(function () { if (!document.hidden && !live) pulse(); }, 45000); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) pulse(); });
  window.addEventListener("online", pulse);

  var LBL = { confirmed: ["Payment confirmed", "Your payment was received. Thank you."], rejected: ["Payment not confirmed", "Open Payments & fees to see why."] };
  function setup(c, uid) {
    chans.forEach(function (x) { try { c.removeChannel(x); } catch (e) {} }); chans = [];
    var ch = c.channel("sb-pulse")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content", filter: "key=eq.pulse" }, pulse)
      .subscribe(function (s) { live = s === "SUBSCRIBED"; if (!live && (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED")) fallback(); });
    chans.push(ch);
    if (!uid) return;
    var me = c.channel("sb-me-" + uid)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "money_payments" }, function (p) {
        var n = p.new || {}, o = p.old || {};
        if (n.status && n.status !== o.status && LBL[n.status]) { toast(LBL[n.status][0], LBL[n.status][1]); document.dispatchEvent(new CustomEvent("sb:payment", { detail: n })); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_campaigns" }, function (p) {
        var n = p.new || {}; if (n.status === "running") toast("Your social campaign is live", "Follow the results in Social Media Marketing."); document.dispatchEvent(new CustomEvent("sb:payment", { detail: n }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "marketplace_orders" }, function (p) {
        var n = p.new || {}, o = p.old || {}; if (n.status && o.status && n.status !== o.status) toast("Order update", "An order is now: " + String(n.status).replace(/_/g, " ") + ".");
        document.dispatchEvent(new CustomEvent("sb:order", { detail: n }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "marketplace_orders" }, function (p) { if (p.new && p.new.buyer_id === uid) return; toast("New order", "You have a new order. Open your orders to see it."); document.dispatchEvent(new CustomEvent("sb:order", { detail: {} })); })
      .subscribe();
    chans.push(me);
  }
  function start() {
    var c = client(); if (!c) return false;
    if (started) return true; started = true; fallback();
    c.auth.getSession().then(function (r) { setup(c, r && r.data && r.data.session && r.data.session.user && r.data.session.user.id); }, function () { setup(c, null); });
    c.auth.onAuthStateChange(function (ev, s) { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") setTimeout(function () { setup(c, s && s.user && s.user.id); }, 300); });
    return true;
  }
  var n = 0, iv = setInterval(function () { if (start() || ++n > 60) clearInterval(iv); }, 500);
})();
