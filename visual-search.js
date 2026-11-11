/* SafeBuy NG - search by photo.
   Buyers: tap the camera button beside Search, choose or take a photo, see the closest products.
   The AI model (MobileNet) runs inside the phone. The photo is never uploaded anywhere. */
(function () {
  "use strict";
  var CFG = { tf: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js", mn: "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js", tag: "mnv2-1.0" };
  for (var k in (window.SAFEBUY_VISION || {})) CFG[k] = window.SAFEBUY_VISION[k];
  var modelP = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.async = true; s.onload = ok; s.onerror = function () { bad(new Error("Could not download the photo search tool. Check your internet and try again.")); }; document.head.appendChild(s); }); }
  function model() {
    if (!modelP) modelP = (window.tf && window.mobilenet ? Promise.resolve() : loadScript(CFG.tf).then(function () { return loadScript(CFG.mn); }))
      .then(function () { return window.mobilenet.load({ version: 2, alpha: 1.0 }); })
      .then(function (m) { try { localStorage.setItem("sb-vs-model", "1"); } catch (e) {} return m; }, function (e) { modelP = null; throw e; });
    return modelP;
  }
  /* same preparation for every photo: centre square crop, 224 x 224 */
  function toCanvas(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h), c = document.createElement("canvas"); c.width = c.height = 224;
    c.getContext("2d").drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 224, 224); return c;
  }
  function embed(m, canvas) {
    var v = window.tf.tidy(function () { var f = m.infer(canvas, true).flatten(); return f.div(f.norm()); });
    var a = Array.prototype.slice.call(v.dataSync()); v.dispose();
    return a.map(function (x) { return Math.round(x * 1e4) / 1e4; });
  }
  function imgFrom(src, cors) { return new Promise(function (ok, bad) { var i = new Image(); if (cors) i.crossOrigin = "anonymous"; i.onload = function () { ok(i); }; i.onerror = function () { bad(new Error("Could not open that image.")); }; i.src = src; }); }
  function fileToImg(file) { var u = URL.createObjectURL(file); return imgFrom(u, false).then(function (i) { i._u = u; return i; }); }

  /* ---- fingerprints for product photos (admin, or a seller's own products) ---- */
  async function indexMissing(o) {
    var m = await model(), rows = await o.list(), done = 0, bad = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      try { var img = await imgFrom(r.image, true), vec = embed(m, toCanvas(img)); await o.save(r.id, vec, r.image); done++; }
      catch (e) { bad++; }
      if (o.progress) o.progress(i + 1, rows.length, done, bad);
      await new Promise(function (ok) { setTimeout(ok, 30); });
    }
    return { done: done, failed: bad, total: rows.length };
  }
  window.sbVision = { tag: CFG.tag, model: model, indexMissing: indexMissing, embed: embed, toCanvas: toCanvas };

  /* ---- buyer page: camera button, results ---- */
  var form = document.getElementById("search-form"), input = document.getElementById("search-input");
  if (!form || !input) { sellerAuto(); return; }
  var btn = document.createElement("button"); btn.type = "button"; btn.id = "sb-photo-btn"; btn.className = "button"; btn.setAttribute("aria-label", "Search with a photo"); btn.title = "Search with a photo";
  btn.innerHTML = "📷"; btn.style.cssText = "flex:none;padding-left:14px;padding-right:14px;background:#e7f7ef;color:#066548;border:1px solid #bfe6d2";
  var sub = form.querySelector("button[type=submit]"); form.insertBefore(btn, sub);
  var file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true; file.id = "sb-photo-file"; form.appendChild(file);
  var cam = document.createElement("input"); cam.type = "file"; cam.accept = "image/*"; cam.setAttribute("capture", "environment"); cam.hidden = true; cam.id = "sb-photo-cam"; form.appendChild(cam);
  var menu = document.createElement("div"); menu.id = "sb-vs-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
  menu.style.cssText = "position:absolute;z-index:50;background:#fff;border:1px solid #cfe3d8;border-radius:14px;box-shadow:0 10px 30px #0003;padding:6px;min-width:210px";
  menu.innerHTML = '<button type="button" role="menuitem" data-pick="cam" style="display:block;width:100%;text-align:left;padding:12px;border:0;background:none;font:inherit;font-weight:700;border-radius:10px">📷 Take a photo</button><button type="button" role="menuitem" data-pick="gallery" style="display:block;width:100%;text-align:left;padding:12px;border:0;background:none;font:inherit;font-weight:700;border-radius:10px">🖼️ Choose from my photos</button>';
  document.body.appendChild(menu);
  var bar = document.createElement("div"); bar.id = "sb-vs-bar"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite"); bar.hidden = true;
  bar.style.cssText = "margin:10px 0;padding:10px 12px;border:1px solid #bfe6d2;background:#f4fbf7;border-radius:14px;display:flex;gap:10px;align-items:center;font-size:14px";
  (form.closest(".search-wrap") || form.parentNode).appendChild(bar);
  function say(html, thumb, clear) {
    bar.hidden = false;
    bar.innerHTML = (thumb ? '<img src="' + thumb + '" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex:none">' : "") + '<div style="flex:1;min-width:0">' + html + "</div>" + (clear ? '<button type="button" id="sb-vs-clear" class="button" style="flex:none;padding:8px 12px">Clear</button>' : "");
    var c = document.getElementById("sb-vs-clear"); if (c) c.onclick = reset;
  }
  function reset() { window.sbVisual = null; bar.hidden = true; if (typeof window.renderProducts === "function") window.renderProducts(); }
  input.addEventListener("input", function () { if (window.sbVisual) { window.sbVisual = null; bar.hidden = true; } });
  document.addEventListener("click", function (e) { if (window.sbVisual && e.target.closest && e.target.closest(".category-button")) { window.sbVisual = null; bar.hidden = true; } }, true);

  btn.onclick = function (e) {
    e.stopPropagation();
    if (!menu.hidden) { menu.hidden = true; return; }
    var r = btn.getBoundingClientRect(); menu.hidden = false; menu.style.top = (window.scrollY + r.bottom + 6) + "px"; menu.style.left = Math.max(8, Math.min(window.scrollX + r.right - 220, window.scrollX + document.documentElement.clientWidth - 228)) + "px";
  };
  document.addEventListener("click", function () { menu.hidden = true; });
  menu.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pick]"); if (!b) return; e.stopPropagation(); menu.hidden = true;
    var first = false; try { first = !localStorage.getItem("sb-vs-model"); } catch (x) {}
    if (first && !window.confirm("Photo search needs a one-time download of about 15 MB. After that it is quick and works with little data. Continue?")) return;
    var inp = b.dataset.pick === "cam" ? cam : file; inp.value = ""; inp.click();
  });
  async function handle(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { say("Please choose a photo."); return; }
    var thumb = URL.createObjectURL(f), c = window.safeBuySupabase;
    if (!c || !c.rpc) { say("Still connecting. Try again in a moment."); return; }
    try {
      say("Getting the photo search ready… this takes a moment the first time.", thumb);
      var m = await model(); say("Looking at your photo…", thumb);
      var img = await fileToImg(f), vec = embed(m, toCanvas(img)); URL.revokeObjectURL(img._u);
      var r = await c.rpc("search_by_photo", { p_vec: vec, p_model: CFG.tag, p_limit: 12 });
      if (r.error) throw new Error(/function/i.test(r.error.message) ? "Photo search is not switched on yet." : r.error.message);
      var rows = r.data || [];
      if (!rows.length) { window.sbVisual = null; say("We have no product photos ready to compare yet. Please try the search box, or check back soon.", thumb); if (typeof window.renderProducts === "function") window.renderProducts(); return; }
      window.sbVisual = { ids: rows.map(function (x) { return x.id; }), score: rows.reduce(function (a, x) { a[x.id] = x.score; return a; }, {}) };
      if (typeof window.renderProducts === "function") window.renderProducts();
      var g = document.getElementById("product-grid"); if (g && g.scrollIntoView) g.scrollIntoView({ behavior: "smooth", block: "start" });
      say("<b>Closest matches to your photo</b><br><span style=\"color:#718078\">Best match first. Not what you wanted? Try a clearer photo on a plain background.</span>", thumb, true);
    } catch (e) { say(esc(e.message || "Photo search did not work. Please try again."), thumb); }
  }
  file.onchange = function () { handle(file.files && file.files[0]); };
  cam.onchange = function () { handle(cam.files && cam.files[0]); };

  /* ---- sellers: keep their product fingerprints up to date, quietly, only when it will not cost them data ---- */
  function sellerAuto() {}
})();
(function () {
  "use strict";
  /* sellers: fingerprint their own new photos in the background (only on wifi, or when the tool is already on the phone) */
  if (!/\/seller\/?(index\.html)?$/.test(location.pathname)) return;
  var ran = false;
  function ok() { var c = navigator.connection || {}; if (c.saveData) return false; var cached = false; try { cached = !!localStorage.getItem("sb-vs-model"); } catch (e) {} return cached || c.type === "wifi" || c.type === "ethernet"; }
  function go() {
    if (ran || !ok()) return; var c = window.safeBuySupabase; if (!c || !c.rpc || !window.sbVision) return;
    c.auth.getSession().then(function (r) {
      if (!(r && r.data && r.data.session)) return; ran = true;
      c.rpc("missing_vectors", { p_model: window.sbVision.tag, p_limit: 8 }).then(function (m) {
        var rows = m && m.data; if (!rows || !rows.length) return;
        window.sbVision.indexMissing({ list: function () { return Promise.resolve(rows); }, save: function (id, vec, src) { return c.rpc("save_product_vector", { p_product: id, p_vec: vec, p_model: window.sbVision.tag, p_src: src }); } }).catch(function () {});
      }, function () {});
    }, function () {});
  }
  setTimeout(function () { var n = 0, iv = setInterval(function () { go(); if (ran || ++n > 20) clearInterval(iv); }, 3000); }, 8000);
})();
