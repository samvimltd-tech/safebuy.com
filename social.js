/* SafeBuy NG - counts visits that come from a seller's Facebook / Instagram / TikTok / WhatsApp link (?p=PRODUCT&src=fb). */
(function () {
  "use strict";
  var q = location.search, m = /[?&]src=(fb|ig|tt|wa)\b/.exec(q), p = /[?&]p=([0-9a-fA-F-]{36})/.exec(q);
  if (!m || !p) return;
  var key = "sb-src-" + p[1] + m[1];
  try { if (sessionStorage.getItem(key)) return; } catch (e) {}
  var n = 0;
  (function go() {
    var c = window.safeBuySupabase;
    if (c && c.rpc) { c.rpc("social_visit", { p_product: p[1], p_src: m[1] }).then(function () { try { sessionStorage.setItem(key, "1"); } catch (e) {} }, function () {}); return; }
    if (++n < 40) setTimeout(go, 500);
  })();
})();
