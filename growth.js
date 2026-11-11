/* SafeBuy NG growth.js: home sections (Featured, Hot, Trending, Best sellers, New, Recently viewed, Saved), hearts, share buttons,
   view/contact/share counting, and shareable product links (?p=ID). Add-on: if anything fails the shop works exactly as before. */
(function () {
  "use strict";
  var cfg = window.SAFEbuySupabaseConfig;
  var base = cfg && cfg.url ? String(cfg.url).replace(/\/+$/, "") : "";
  var KEY = cfg && cfg.publishableKey;
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; }
  function ok() { return typeof products !== "undefined" && products && products.length && typeof productSource !== "undefined" && productSource === "supabase"; }
  function find(id) { try { return findProduct(id); } catch (e) { return null; } }
  function E(s) { return typeof esc === "function" ? esc(s) : String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function M(n) { return typeof money === "function" ? money(n) : "₦" + Number(n).toLocaleString("en-NG"); }

  var st = document.createElement("style");
  st.textContent = "#sb-home{padding:6px 0 0}#sb-home .sbg{margin:14px 0}#sb-home h3{margin:0 0 8px;font-size:17px}#sb-home .sbg-row{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}" +
    ".sbg-card{flex:0 0 138px;scroll-snap-align:start;background:#fff;border:1px solid var(--line,#e6ece8);border-radius:14px;overflow:hidden;cursor:pointer;text-align:left;padding:0;font:inherit;color:inherit}.sbg-card .im{height:104px;background:#edf6ef;display:grid;place-items:center;font-size:34px;overflow:hidden}.sbg-card img{width:100%;height:100%;object-fit:cover}" +
    ".sbg-card .tx{padding:8px 9px}.sbg-card b{display:block;font-size:13px;line-height:1.25;max-height:2.5em;overflow:hidden}.sbg-card span{font-size:13px;color:var(--green,#087f5b);font-weight:800}.sbg-card small{display:block;color:var(--muted,#718078);font-size:11px;margin-top:2px}" +
    ".product-card{position:relative}.sbg-heart{position:absolute;top:8px;right:8px;z-index:2;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.92);box-shadow:0 1px 6px rgba(0,0,0,.2);color:#c2410c;font-size:19px;line-height:1;display:grid;place-items:center;padding:0;cursor:pointer}.sbg-share{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}.sbg-share button,.sbg-share a{border:1px solid var(--line,#e6ece8);background:#fff;border-radius:20px;padding:8px 13px;font:700 13px system-ui;color:var(--ink,#172b24);text-decoration:none;cursor:pointer}";
  document.head.appendChild(st);

  /* ---- counting (once per product per kind per visit, and at most 40 events per visit) ---- */
  var sent = {}, nSent = 0;
  function track(id, kind) {
    if (!base || !KEY || !id) return; var k = kind + id; if (sent[k] || nSent >= 40) return; sent[k] = 1; nSent++;
    try { fetch(base + "/rest/v1/rpc/track_product", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_product: id, p_kind: kind }), keepalive: true }).catch(function () {}); } catch (e) {}
  }

  /* ---- lists kept on this phone ---- */
  function recent() { return store("sb-recent") || []; }
  function pushRecent(id) { var r = recent().filter(function (x) { return x !== id; }); r.unshift(id); store("sb-recent", r.slice(0, 12)); }
  function wish() { return store("sb-wish") || []; }
  function isWish(id) { return wish().indexOf(String(id)) >= 0; }
  function toggleWish(id) { id = String(id); var w = wish(), i = w.indexOf(id); if (i >= 0) w.splice(i, 1); else w.unshift(id); store("sb-wish", w.slice(0, 100)); return i < 0; }

  /* ---- home sections ---- */
  var sections = null, secAt = 0, host = null;
  function loadSections(cb) {
    if (sections && Date.now() - secAt < 60000) return cb();
    if (!base || !KEY) { sections = {}; return cb(); }
    fetch(base + "/rest/v1/rpc/home_sections", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      .then(function (d) { sections = d || {}; secAt = Date.now(); cb(); });
  }
  function card(p) {
    return '<button type="button" class="sbg-card" data-sbg="' + E(p.id) + '"><div class="im">' + (p.image ? '<img src="' + E(p.image) + '" alt="" loading="lazy" decoding="async">' : E(p.emoji || "🛍️")) + '</div><div class="tx"><b>' + E(p.name) + "</b><span>" + M(p.price) + "</span>" + (p.verified ? "<small>✓ Verified</small>" : "") + "</div></button>";
  }
  function pick(ids, max) { var out = []; (ids || []).forEach(function (id) { var p = find(id); if (p && out.length < (max || 12)) out.push(p); }); return out; }
  function build() {
    if (!ok()) { if (host) host.innerHTML = ""; return; }
    var shop = document.getElementById("shop"); if (!shop) return;
    if (!host) { host = document.createElement("div"); host.id = "sb-home"; host.className = "container"; shop.parentNode.insertBefore(host, shop); }
    loadSections(function () {
      var S = sections || {}, seen = {}, html = "";
      function sec(title, list) { if (list.length) html += '<div class="sbg"><h3>' + title + '</h3><div class="sbg-row">' + list.map(card).join("") + "</div></div>"; }
      sec("⭐ Featured", pick(S.featured)); sec("🔥 Hot right now", pick(S.hot)); sec("📈 Trending this week", pick(S.trending));
      sec("🏆 Best sellers", pick(S.best));
      sec("🆕 New arrivals", products.filter(function (p) { return p.inStock; }).slice(0, 10));
      sec("🕘 Recently viewed", pick(recent(), 10)); sec("♥ Your saved items", pick(wish(), 12));
      host.innerHTML = html;
    });
  }

  /* ---- hearts on every product card ---- */
  function hearts() {
    document.querySelectorAll("#product-grid .product-card").forEach(function (c) {
      if (c.querySelector(".sbg-heart")) return;
      var art = c.querySelector(".product-art[data-id]"); if (!art) return;
      var id = art.getAttribute("data-id"), b = document.createElement("button");
      b.type = "button"; b.className = "sbg-heart"; b.dataset.id = id; b.setAttribute("aria-label", "Save for later");
      b.textContent = isWish(id) ? "♥" : "♡"; b.setAttribute("aria-pressed", isWish(id) ? "true" : "false"); c.appendChild(b);
    });
  }
  document.addEventListener("click", function (e) {
    var h = e.target.closest && e.target.closest(".sbg-heart");
    if (h) { var on = toggleWish(h.dataset.id); document.querySelectorAll('.sbg-heart[data-id="' + h.dataset.id + '"]').forEach(function (x) { x.textContent = on ? "♥" : "♡"; x.setAttribute("aria-pressed", on ? "true" : "false"); }); if (typeof showToast === "function") showToast(on ? "Saved. Find it under “Your saved items”." : "Removed from saved items."); build(); return; }
    var c = e.target.closest && e.target.closest("[data-sbg]");
    if (c && typeof openProduct === "function") { openProduct(c.getAttribute("data-sbg")); return; }
    var w = e.target.closest && e.target.closest('[data-action="whatsapp"]');
    if (w) track(w.getAttribute("data-id"), "contact");
  }, true);

  /* ---- share row inside the product pop-up ---- */
  function link(id) { return location.origin + location.pathname + "?p=" + encodeURIComponent(id); }
  function addShare(id) {
    var mc = document.getElementById("modal-content"), p = find(id); if (!mc || !p || mc.querySelector(".sbg-share")) return;
    var text = p.name + " · " + M(p.price) + " on SafeBuy NG", url = link(id), row = document.createElement("div"); row.className = "sbg-share";
    row.innerHTML = '<a target="_blank" rel="noopener" data-sh="wa" href="https://wa.me/?text=' + encodeURIComponent(text + "\n" + url) + '">Share on WhatsApp</a>' +
      '<a target="_blank" rel="noopener" data-sh="fb" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">Facebook</a>' +
      (navigator.share ? '<button type="button" data-sh="native">Share…</button>' : "") + '<button type="button" data-sh="copy">Copy link (TikTok, Instagram)</button>';
    mc.appendChild(row);
    row.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sh]"); if (!b) return; track(id, "share");
      if (b.dataset.sh === "native") { e.preventDefault(); navigator.share({ title: p.name, text: text, url: url }).catch(function () {}); }
      if (b.dataset.sh === "copy") { try { navigator.clipboard.writeText(url).then(function () { b.textContent = "Link copied ✓"; }, function () { window.prompt("Copy this link:", url); }); } catch (er) { window.prompt("Copy this link:", url); } }
    });
  }

  /* ---- hook the shop's own functions (they are called by name, so replacing the global is enough) ---- */
  function hook(name, after, before) {
    var o = window[name]; if (typeof o !== "function" || o.__sbg) return;
    var w = function () { if (before) try { before.apply(null, arguments); } catch (e) {} var r = o.apply(this, arguments); try { after.apply(null, arguments); } catch (e) {} return r; };
    w.__sbg = 1; window[name] = w;
  }
  function install() {
    hook("openProduct", function (id) { addShare(id); }, function (id) { track(id, "view"); pushRecent(String(id)); setTimeout(build, 400); });
    hook("renderProducts", function () { hearts(); });
    hook("setProducts", function () { setTimeout(function () { build(); hearts(); deep(); }, 0); });
  }
  var deepDone = false;
  function deep() {
    if (deepDone || !ok()) return; var m = /[?&]p=([^&#]+)/.exec(location.search); if (!m) { deepDone = true; return; }
    var id = decodeURIComponent(m[1]); if (!find(id)) return; deepDone = true;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    if (typeof openProduct === "function") openProduct(id);
  }
  document.addEventListener("sb:pulse", function () { secAt = 0; build(); setTimeout(hearts, 300); });
  install(); build(); hearts(); deep();
  var tries = 0, iv = setInterval(function () { build(); hearts(); deep(); if ((host && host.innerHTML) || ++tries > 40) clearInterval(iv); }, 500);
  if (typeof products !== "undefined" && products.length) { build(); hearts(); }
})();
