/* SafeBuy NG extras: WhatsApp order cart, reviews, reports, extra photos.
   Loaded on index.html (after the main scripts) and on generated product pages. */
(function () {
  "use strict";

  var KEY = "safebuy_cart_v1", BUYER_KEY = "safebuy_buyer_v1";
  var IMG_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  var home = location.pathname.indexOf("/p/") >= 0 ? location.href.split("/p/")[0] + "/" : location.href.split("#")[0];
  var isHome = !!document.getElementById("product-grid");
  var cart = readCart();

  /* ---------- helpers ---------- */
  function readCart() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a.filter(function (i) { return i && i.id && i.qty > 0; }) : [];
    } catch (e) { return []; }
  }
  function saveCart() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function naira(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }
  function waNum(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.indexOf("234") === 0) return d;
    if (d.charAt(0) === "0") return "234" + d.slice(1);
    if (d.length === 10) return "234" + d;
    return d;
  }
  function waLink(phone, text) { return "https://wa.me/" + waNum(phone) + "?text=" + encodeURIComponent(text); }
  function client() {
    if (window.safeBuySupabase) return window.safeBuySupabase;
    var cfg = window.SAFEbuySupabaseConfig;
    if (!window.supabase || !cfg || !cfg.url || !cfg.publishableKey) return null;
    try { window.safeBuySupabase = window.supabase.createClient(cfg.url, cfg.publishableKey); } catch (e) { return null; }
    return window.safeBuySupabase;
  }
  async function getUser() {
    var c = client();
    if (!c) return null;
    var r = await c.auth.getUser();
    return r.data && r.data.user ? r.data.user : null;
  }
  function toast(t) { if (typeof showToast === "function") showToast(t); else alert(t); }
  function refreshCount() {
    var el = document.getElementById("cart-count");
    if (el) el.textContent = cart.reduce(function (t, i) { return t + i.qty; }, 0);
  }
  function addItem(p) {
    var key = [String(p.id), p.color || "", p.size || ""].join("|");
    var e = cart.filter(function (i) { return (i.key || i.id) === key; })[0];
    if (e) e.qty = Math.min(50, e.qty + 1);
    else cart.push({ key: key, id: String(p.id), name: p.name, price: Number(p.price), category: p.category || "", color: p.color || "", size: p.size || "", qty: 1 });
    saveCart();
    refreshCount();
  }

  /* ---------- colour / size options ---------- */
  var optMap = {};
  async function getOpts(id) {
    id = String(id);
    if (optMap[id]) return optMap[id];
    var c = client();
    var empty = { colors: [], sizes: [] };
    if (!c) return empty;
    var r = await c.from("seller_products_public").select("id,colors,sizes").eq("id", id).maybeSingle();
    optMap[id] = r.data ? { colors: r.data.colors || [], sizes: r.data.sizes || [] } : empty;
    return optMap[id];
  }
  function optsHtml(o) {
    function group(name, label, list) {
      if (!list.length) return "";
      return '<div class="sbx-og"><strong>' + label + '</strong><div class="sbx-chips">' + list.map(function (v) {
        return '<label class="sbx-chip"><input type="radio" name="sbx-' + name + '" value="' + esc(v) + '"><span>' + esc(v) + "</span></label>";
      }).join("") + "</div></div>";
    }
    return group("color", "Colour", o.colors) + group("size", "Size", o.sizes);
  }
  function readOpts(root, o) {
    var col = root.querySelector('input[name="sbx-color"]:checked');
    var sz = root.querySelector('input[name="sbx-size"]:checked');
    if (o.colors.length && !col) return { error: "Please choose a colour." };
    if (o.sizes.length && !sz) return { error: "Please choose a size." };
    return { color: col ? col.value : "", size: sz ? sz.value : "" };
  }
  function rid() {
    return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- styles ---------- */
  var st = document.createElement("style");
  st.textContent =
    ".sbx{margin-top:16px;padding-top:14px;border-top:1px solid #e6ece8;font-size:14px;line-height:1.5;color:#172b24}" +
    "#sb-extras.sbx{width:min(960px,100% - 28px);margin:16px auto 40px;background:#fff;border:1px solid #e6ece8;border-radius:16px;padding:18px}" +
    ".sbx-h{margin:0 0 6px;font-size:16px}.sbx-m{color:#718078;font-size:13px}.sbx-m a{color:#087f5b;font-weight:700}" +
    ".sbx-rv{padding:9px 0;border-top:1px solid #e6ece8}.sbx-rv span{color:#a66a0b}" +
    ".sbx select,.sbx textarea{width:100%;margin:6px 0;padding:10px 12px;border:1px solid #dce5de;border-radius:10px;font:inherit;background:#fff;color:inherit}" +
    ".sbx button.sbx-b{border:0;border-radius:10px;padding:10px 14px;background:#087f5b;color:#fff;font:inherit;font-weight:700;cursor:pointer;width:auto;margin:6px 0 0}" +
    ".sbx button.sbx-link{border:0;background:none;color:#8a1f1f;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:10px 0 0}" +
    ".sbx-report{margin-top:6px;padding:10px;border:1px solid #f1d69a;border-radius:12px;background:#fff8e8}" +
    ".sbx-strip{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}" +
    ".sbx-strip img{position:static!important;inset:auto!important;width:64px!important;height:64px!important;flex:0 0 64px;border-radius:10px;border:2px solid transparent;object-fit:cover;cursor:pointer;background:#edf6ef;scroll-snap-align:start}" +
    ".sbx-strip img.on{border-color:#087f5b}" +
    ".sbx-og{margin:0 0 4px;font-size:14px}.sbx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}" +
    ".sbx-chip{position:relative;display:inline-block}.sbx-chip input{position:absolute;opacity:0;pointer-events:none}" +
    ".sbx-chip span{display:inline-block;padding:8px 14px;border:1px solid #dce5de;border-radius:20px;font-size:13px;cursor:pointer;background:#fff;color:#172b24}" +
    ".sbx-chip input:checked+span{background:#087f5b;border-color:#087f5b;color:#fff}.sbx-chip input:checked+span::before{content:'\\2713 '}";
  document.head.appendChild(st);

  /* ---------- product extras: gallery, reviews, report ---------- */
  function stars(n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }

  function gallery(imgs) {
    var main = document.querySelector(".photo img, .modal-art img");
    if (!main || !imgs.length) return;
    var holder = main.parentNode;
    var wrap = holder.parentNode;
    if (!wrap.classList.contains("sbx-wrap")) {
      wrap = document.createElement("div");
      wrap.className = "sbx-wrap";
      holder.parentNode.insertBefore(wrap, holder);
      wrap.appendChild(holder);
    }
    var old = wrap.querySelector(".sbx-strip");
    if (old) old.remove();
    if (!main.dataset.sbx0) main.dataset.sbx0 = main.src;
    var urls = [main.dataset.sbx0].concat(imgs.map(function (i) { return i.image_url; })
      .filter(function (u) { return /^https:\/\//.test(u); }));
    var s = document.createElement("div");
    s.className = "sbx-strip";
    s.innerHTML = urls.map(function (u, i) {
      return '<img src="' + esc(u) + '" alt="Photo ' + (i + 1) + '" data-i="' + i + '"' + (i === 0 ? ' class="on"' : "") + ">";
    }).join("");
    s.style.position = "relative";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var cur = 0, paused = false, resumeT = null;

    function show(i, d) {
      cur = (i + urls.length) % urls.length;
      main.src = urls[cur];
      if (main.animate && !reduce) {
        main.animate(
          [{ opacity: 0.25, transform: "translateX(" + (d < 0 ? -40 : 40) + "px)" }, { opacity: 1, transform: "none" }],
          { duration: 350, easing: "ease-out" }
        );
      }
      [].forEach.call(s.children, function (el, k) { el.classList.toggle("on", k === cur); });
      var el = s.children[cur];
      s.scrollTo({ left: el.offsetLeft - (s.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
    function pause() {
      paused = true;
      clearTimeout(resumeT);
      resumeT = setTimeout(function () { paused = false; }, 8000);
    }

    s.onclick = function (e) {
      var t = e.target.closest("img");
      if (t) { pause(); show(Number(t.dataset.i), 1); }
    };
    s.ontouchstart = pause;
    var x0 = null;
    holder.ontouchstart = function (e) { x0 = e.touches[0].clientX; pause(); };
    holder.ontouchend = function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    };
    holder.onmouseenter = function () { paused = true; };
    holder.onmouseleave = function () { paused = false; };

    /* auto-slide every 3.5 s; pauses while the visitor touches or hovers */
    clearInterval(window.__sbxTimer);
    if (!reduce) {
      window.__sbxTimer = setInterval(function () {
        if (!paused && !document.hidden) show(cur + 1, 1);
      }, 3500);
    }
    wrap.appendChild(s);
  }

  async function mountExtras(box, pid) {
    box.classList.add("sbx");
    box.innerHTML = '<p class="sbx-m">Loading reviews…</p>';
    var c = client();
    if (!c) { box.innerHTML = ""; return; }
    var res = await Promise.all([
      c.from("reviews").select("reviewer_name,rating,comment").eq("product_id", pid).order("created_at", { ascending: false }).limit(20),
      c.from("product_rating_public").select("avg_rating,review_count").eq("product_id", pid).maybeSingle(),
      c.from("product_images").select("image_url,position").eq("product_id", pid).order("position")
    ]);
    var reviews = res[0].data || [], rating = res[1].data, imgs = res[2].data || [];
    gallery(imgs);

    var head = rating && rating.review_count
      ? "★ " + rating.avg_rating + " · " + rating.review_count + " review" + (rating.review_count === 1 ? "" : "s")
      : "No reviews yet";
    box.innerHTML = '<h3 class="sbx-h">Reviews</h3><p><strong>' + esc(head) + "</strong></p>" +
      reviews.map(function (r) {
        return '<div class="sbx-rv"><span>' + stars(r.rating) + "</span> <strong>" + esc(r.reviewer_name) + "</strong>" +
          (r.comment ? "<br>" + esc(r.comment) : "") + "</div>";
      }).join("") +
      '<div class="sbx-form"></div><p class="sbx-m sbx-msg" role="status" aria-live="polite"></p>';

    var form = box.querySelector(".sbx-form"), msg = box.querySelector(".sbx-msg");
    function say(t, bad) { msg.textContent = t; msg.style.color = bad ? "#8a1f1f" : ""; }
    var u = await getUser();
    if (!u) {
      form.innerHTML = '<p class="sbx-m"><a href="' + esc(home) + '#account">Sign in</a> to review or report this listing.</p>';
      return;
    }
    form.innerHTML =
      '<p class="sbx-m">Bought this? Leave a review.</p>' +
      '<select class="sbx-rate" aria-label="Rating"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select>' +
      '<textarea class="sbx-text" maxlength="1000" placeholder="What was it like? (optional)"></textarea>' +
      '<button class="sbx-b" type="button" data-x="review">Post review</button><br>' +
      '<button class="sbx-link" type="button" data-x="toggle">Report this listing</button>' +
      '<div class="sbx-report" hidden><select class="sbx-reason" aria-label="Reason"><option value="scam">Looks like a scam</option><option value="fake">Fake or counterfeit item</option><option value="wrong_info">Wrong price or details</option><option value="prohibited">Prohibited item</option><option value="no_response">Seller does not respond</option><option value="other">Something else</option></select>' +
      '<textarea class="sbx-details" maxlength="1000" placeholder="Tell us what happened"></textarea>' +
      '<button class="sbx-b" type="button" data-x="report">Send report</button></div>';

    box.onclick = async function (e) {
      var b = e.target.closest("[data-x]");
      if (!b) return;
      var x = b.dataset.x;
      if (x === "toggle") { var r = box.querySelector(".sbx-report"); r.hidden = !r.hidden; return; }
      b.disabled = true;
      if (x === "review") {
        var ins = await c.from("reviews").insert({
          product_id: pid, user_id: u.id,
          reviewer_name: String((u.user_metadata && u.user_metadata.full_name) || "Buyer").slice(0, 60),
          rating: Number(box.querySelector(".sbx-rate").value),
          comment: box.querySelector(".sbx-text").value.trim() || null
        });
        b.disabled = false;
        if (ins.error) {
          say(ins.error.code === "23505" ? "You have already reviewed this item."
            : ins.error.code === "42501" ? "Only buyers who ordered this item can review it."
            : ins.error.message, true);
          return;
        }
        mountExtras(box, pid);
      } else if (x === "report") {
        var rep = await c.from("reports").insert({
          reporter_id: u.id, product_id: pid,
          reason: box.querySelector(".sbx-reason").value,
          details: box.querySelector(".sbx-details").value.trim() || null
        });
        b.disabled = false;
        if (rep.error) { say(rep.error.code === "23505" ? "You already reported this listing." : rep.error.message, true); return; }
        box.querySelector(".sbx-report").hidden = true;
        say("Thanks. SafeBuy NG will review this listing.");
      }
    };
  }

  /* ---------- product page (static): add to cart + extras ---------- */
  var addBtn = document.getElementById("sbx-add");
  if (addBtn) {
    var optBox = document.createElement("div");
    addBtn.parentNode.insertBefore(optBox, document.getElementById("chat") || addBtn);
    getOpts(addBtn.dataset.id).then(function (o) { optBox.innerHTML = optsHtml(o); });
    addBtn.addEventListener("click", async function () {
      var o = await getOpts(addBtn.dataset.id);
      var sel = readOpts(optBox, o);
      if (sel.error) { alert(sel.error); return; }
      addItem({ id: addBtn.dataset.id, name: addBtn.dataset.name, price: addBtn.dataset.price, category: addBtn.dataset.category, color: sel.color, size: sel.size });
      addBtn.textContent = "Added ✓";
      if (!document.getElementById("sbx-view")) {
        addBtn.insertAdjacentHTML("afterend",
          '<a id="sbx-view" class="button" style="margin-top:10px;text-decoration:none;background:#fff;color:#172b24;border:1px solid #e6ece8" href="' +
          esc(home) + '#cart">View cart &amp; order →</a>');
      }
    });
  }
  var pageBox = document.getElementById("sb-extras");
  if (pageBox) mountExtras(pageBox, pageBox.dataset.id);

  /* ---------- homepage: cart modal, orders, decoration ---------- */
  if (isHome) initHome();

  function initHome() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(BUYER_KEY) || "null"); } catch (e) {}

    var back = document.createElement("div");
    back.className = "modal-backdrop";
    back.id = "cart-backdrop";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.innerHTML = '<div class="modal"><div class="modal-top"><h2>Your cart</h2>' +
      '<button class="icon-button" type="button" id="cart-close" aria-label="Close">✕</button></div><div id="cart-body"></div></div>';
    document.body.appendChild(back);
    var body = back.querySelector("#cart-body");

    function open() { render(); back.classList.add("open"); }
    function close() { back.classList.remove("open"); }
    function keepDraft() {
      var n = body.querySelector("#cx-name");
      if (n) {
        var pr = body.querySelector('input[name="cx-pay"]:checked'), ad = body.querySelector("#cx-addr");
        draft = { name: n.value, phone: body.querySelector("#cx-phone").value, note: body.querySelector("#cx-note").value,
                  pay: pr ? pr.value : "direct", addr: ad ? ad.value : "" };
      }
    }
    function msg(t, bad) {
      var m = body.querySelector("#cx-msg");
      if (m) { m.textContent = t; m.style.color = bad ? "#8a1f1f" : ""; }
    }

    function render() {
      keepDraft();
      if (!cart.length) {
        body.innerHTML = "<p>Your cart is empty. Tap “Add to cart” on a product.</p>" +
          '<button class="button button-outline" type="button" data-c="orders">My orders</button>';
        return;
      }
      var total = 0;
      var rows = cart.map(function (i) {
        total += i.price * i.qty;
        var k = i.key || i.id, variant = [i.color, i.size].filter(Boolean).join(" · ");
        return '<div class="seller-row"><div><strong>' + esc(i.name) + "</strong>" + (variant ? "<br><span class=\"muted\">" + esc(variant) + "</span>" : "") +
          '<br><span class="muted">' + esc(naira(i.price)) + " each</span></div>" +
          '<div class="seller-actions"><button class="button button-outline" type="button" data-c="dec" data-id="' + esc(k) + '">−</button>' +
          "<strong>" + i.qty + "</strong>" +
          '<button class="button button-outline" type="button" data-c="inc" data-id="' + esc(k) + '">+</button>' +
          '<button class="button button-outline" type="button" data-c="rm" data-id="' + esc(k) + '" aria-label="Remove">✕</button></div></div>';
      }).join("");
      var d = draft || {};
      body.innerHTML = rows +
        "<p><strong>Estimated total: " + esc(naira(total)) + "</strong></p>" +
        '<label for="cx-name">Your name</label><input id="cx-name" type="text" maxlength="80" value="' + esc(d.name || "") + '">' +
        '<label for="cx-phone">Your phone number</label><input id="cx-phone" type="tel" placeholder="08012345678" value="' + esc(d.phone || "") + '">' +
        '<label for="cx-note">Note for sellers (optional)</label><textarea id="cx-note" maxlength="300" placeholder="Delivery area, size, colour…">' + esc(d.note || "") + "</textarea>" +
        "<label>Payment</label>" +
        '<label class="check"><input type="radio" name="cx-pay" value="direct"' + (d.pay === "pay_on_delivery" ? "" : " checked") + "> Pay the seller directly (cash or transfer at pickup)</label>" +
        '<label class="check"><input type="radio" name="cx-pay" value="pay_on_delivery"' + (d.pay === "pay_on_delivery" ? " checked" : "") + "> Request pay on delivery (the seller must confirm)</label>" +
        '<div id="cx-addr-wrap"' + (d.pay === "pay_on_delivery" ? "" : " hidden") + '><label for="cx-addr">Delivery address</label><input id="cx-addr" type="text" maxlength="300" placeholder="Street, area, city" value="' + esc(d.addr || "") + '"></div>' +
        '<p class="modal-note"><strong>How it works:</strong> we save your order, then open WhatsApp with a ready message for each seller. Prices are confirmed by SafeBuy NG when you place the order. Pay the seller directly; online payment is coming soon.</p>' +
        '<button class="button button-primary" type="button" data-c="place">Place order &amp; message sellers</button>' +
        '<button class="button button-outline" type="button" disabled>Pay online (coming soon)</button>' +
        '<button class="button button-outline" type="button" data-c="orders">My orders</button>' +
        '<p class="form-message" id="cx-msg" role="status" aria-live="polite"></p>';
    }

    async function placeOrder() {
      var c = client();
      if (!c) { msg("Orders are unavailable right now.", true); return; }
      var u = await getUser();
      if (!u) {
        keepDraft();
        close();
        toast("Sign in to place your order. Your cart is saved.");
        var sb = document.querySelector('[data-action="account"]');
        if (sb) sb.click();
        return;
      }
      keepDraft();
      var name = (draft.name || "").trim(), phone = (draft.phone || "").trim();
      if (!name || !phone) { msg("Enter your name and phone number.", true); return; }
      if (draft.pay === "pay_on_delivery" && !(draft.addr || "").trim()) { msg("Enter your delivery address.", true); return; }
      var btn = body.querySelector('[data-c="place"]');
      btn.disabled = true;
      msg("Placing your order…");
      var r = await c.rpc("place_order", {
        p_name: name, p_phone: phone, p_note: (draft.note || "").trim(),
        p_items: cart.map(function (i) { return { id: i.id, qty: i.qty, color: i.color || null, size: i.size || null }; }),
        p_pay_method: draft.pay === "pay_on_delivery" ? "pay_on_delivery" : "direct",
        p_address: (draft.addr || "").trim() || null
      });
      if (r.error) { msg(r.error.message, true); btn.disabled = false; return; }
      try { localStorage.setItem(BUYER_KEY, JSON.stringify({ name: name, phone: phone, note: "" })); } catch (e) {}
      var snapshot = cart.slice();
      cart = [];
      saveCart();
      refreshCount();
      renderDone(r.data, snapshot, name, phone, (draft.note || "").trim());
      if (typeof loadProductsAgain === "function") loadProductsAgain();
    }

    function renderDone(o, snapshot, name, phone, note) {
      var html = '<p class="status-pill ok">Order ' + esc(o.order_code) + " saved</p>" +
        "<p>Total " + esc(naira(o.total_kobo / 100)) + ". Tap each seller below to send your order on WhatsApp.</p>";
      (o.groups || []).forEach(function (g) {
        var lines = (g.items || []).map(function (i) { var v = [i.color, i.size].filter(Boolean).join(", "); return "- " + i.qty + " x " + i.name + (v ? " [" + v + "]" : "") + " (" + naira(i.price_kobo / 100) + ")"; }).join("\n");
        var text = "Hello " + g.shop_name + ", I would like to order on SafeBuy NG (order " + o.order_code + "):\n" + lines +
          "\nSubtotal: " + naira(g.subtotal_kobo / 100) + "\nName: " + name + ", phone: " + phone +
          (draft && draft.pay === "pay_on_delivery"
            ? "\nPayment: I would like to PAY ON DELIVERY. Delivery address: " + (draft.addr || "") + "\nPlease confirm if you offer pay on delivery."
            : "\nPayment: directly to you at pickup.") +
          (note ? "\nNote: " + note : "") + "\nPlease confirm availability and delivery.";
        html += '<a class="button button-primary" target="_blank" rel="noopener" href="' + esc(waLink(g.phone, text)) + '">Send to ' + esc(g.shop_name) + " on WhatsApp</a>";
      });
      var also = o.also_notify || [];
      if (also.length) {
        html += "<h3>Ask similar sellers too</h3><p class=\"muted\">These shops sell the same type of product and may also have it.</p>";
        also.forEach(function (s) {
          var names = snapshot.filter(function (i) { return i.category === s.category; }).map(function (i) { return i.name; });
          var text = "Hello " + s.shop_name + ", I am a SafeBuy NG buyer looking for: " + (names.join(", ") || s.category) +
            ". Do you have this in stock, and at what price? (Ref " + o.order_code + ")";
          html += '<a class="button button-light" target="_blank" rel="noopener" href="' + esc(waLink(s.phone, text)) + '">Ask ' + esc(s.shop_name) + "</a>";
        });
      }
      html += '<p class="modal-note">Meet in a public place and inspect the item before you pay. SafeBuy NG does not hold your money yet.</p>';
      body.innerHTML = html;
    }

    async function showOrders() {
      var c = client(), u = await getUser();
      if (!c || !u) { close(); toast("Sign in to see your orders."); var sb = document.querySelector('[data-action="account"]'); if (sb) sb.click(); return; }
      body.innerHTML = "<p>Loading…</p>";
      var r = await c.from("orders").select("code,total_kobo,status,payment_status,created_at")
        .order("created_at", { ascending: false }).limit(10);
      if (r.error) { body.textContent = r.error.message; return; }
      body.innerHTML = (r.data.length ? r.data.map(function (o) {
        return '<div class="seller-row"><div><strong>' + esc(o.code) + '</strong><br><span class="muted">' +
          esc(new Date(o.created_at).toLocaleDateString("en-NG")) + " · " + esc(o.status) + " · " + esc(o.payment_status) + "</span></div><strong>" +
          esc(naira(o.total_kobo / 100)) + "</strong></div>";
      }).join("") : "<p>No orders yet.</p>") + '<button class="button button-outline" type="button" data-c="back">Back</button>';
    }

    body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]");
      if (!b) return;
      var act = b.dataset.c, item = cart.filter(function (i) { return (i.key || i.id) === b.dataset.id; })[0];
      if (act === "inc" && item) item.qty = Math.min(50, item.qty + 1);
      if (act === "dec" && item) item.qty = Math.max(1, item.qty - 1);
      if (act === "rm") cart = cart.filter(function (i) { return (i.key || i.id) !== b.dataset.id; });
      if (act === "place") { placeOrder(); return; }
      if (act === "orders") { showOrders(); return; }
      saveCart(); refreshCount(); render();
    });
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    body.addEventListener("change", function (e) {
      if (e.target.name !== "cx-pay") return;
      var w = body.querySelector("#cx-addr-wrap");
      if (w) w.hidden = e.target.value !== "pay_on_delivery";
    });
    document.getElementById("cart-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    /* take over the cart hooks of the main script */
    window.addToCart = async function (id) {
      var p = findProduct(id);
      if (!p) return;
      if (productSource !== "supabase") { toast("Sample products can't be ordered."); return; }
      if (!p.inStock) { toast("That item is sold out."); return; }
      var o = await getOpts(id);
      var root = document.getElementById("modal-content");
      var inModal = document.getElementById("modal-backdrop").classList.contains("open") && root.querySelector(".sbx-opts");
      var sel = { color: "", size: "" };
      if (o.colors.length || o.sizes.length) {
        if (!inModal) { window.openProduct(id); toast("Choose your options, then tap Add to cart."); return; }
        sel = readOpts(root, o);
        if (sel.error) { toast(sel.error); return; }
      }
      addItem({ id: p.id, name: p.name, price: p.price, category: p.category, color: sel.color, size: sel.size });
      toast(p.name + " added to your cart.");
    };
    window.showCart = open;
    window.updateCartCount = refreshCount;

    /* cards: swap "Chat seller" for "Add to cart" (chat stays on the product page and modal) */
    function decorate() {
      if (productSource !== "supabase") return;
      document.querySelectorAll('.product-actions [data-action="whatsapp"]').forEach(function (b) {
        b.dataset.action = "add";
        var o = optMap[String(b.dataset.id)];
        if (!b.disabled) b.textContent = o && (o.colors.length || o.sizes.length) ? "Choose options" : "Add to cart";
      });
    }
    var origRender = window.renderProducts;
    window.renderProducts = function () { origRender.apply(this, arguments); decorate(); };
    window.renderProducts();
    var c0 = client();
    if (c0) {
      c0.from("seller_products_public").select("id,colors,sizes").then(function (r) {
        (r.data || []).forEach(function (x) { optMap[String(x.id)] = { colors: x.colors || [], sizes: x.sizes || [] }; });
        window.renderProducts();
      });
    }

    /* modal: cart button, gallery, reviews, report */
    var origOpen = window.openProduct;
    window.openProduct = function (id) {
      origOpen(id);
      var p = findProduct(id);
      if (!p || productSource !== "supabase") return;
      var content = document.getElementById("modal-content");
      var chat = content.querySelector('[data-action="whatsapp"]');
      if (chat && !chat.disabled) {
        chat.insertAdjacentHTML("beforebegin", '<button class="button button-light" type="button" data-action="add" data-id="' + esc(p.id) + '">Add to cart</button>');
      }
      getOpts(p.id).then(function (o) {
        if (!o.colors.length && !o.sizes.length) return;
        var holder = document.createElement("div");
        holder.className = "sbx-opts";
        holder.innerHTML = optsHtml(o);
        var anchor = content.querySelector('[data-action="add"]') || content.querySelector('[data-action="whatsapp"]');
        if (anchor) anchor.parentNode.insertBefore(holder, anchor);
      });
      var box = document.createElement("div");
      content.appendChild(box);
      mountExtras(box, String(p.id));
    };

    function fromHash() {
      if (location.hash === "#cart") open();
      if (location.hash === "#account") { var b = document.querySelector('[data-action="account"]'); if (b) b.click(); }
    }
    window.addEventListener("hashchange", fromHash);
    refreshCount();
    fromHash();

    initSellerPhotos();
  }

  /* ---------- seller pickup address (injected into the existing seller modal) ---------- */
  var pendingAddr = "";

  async function loadAddress() {
    var c = client(), u = await getUser();
    var input = document.getElementById("pa-input");
    if (!c || !u || !input) return;
    var r = await c.from("seller_applications").select("pickup_address").eq("user_id", u.id).maybeSingle();
    var cur = r.data && r.data.pickup_address ? r.data.pickup_address : "";
    if (!cur && pendingAddr) {
      cur = pendingAddr;
      pendingAddr = "";
      await c.rpc("set_pickup_address", { p_address: cur });
    }
    input.value = cur;
  }

  function enhanceSeller() {
    var sb = document.getElementById("seller-body");
    if (!sb) return;

    var setup = sb.querySelector("#setup-form");
    if (setup && !sb.querySelector("#su-addr")) {
      var stateEl = sb.querySelector("#su-state");
      if (stateEl) {
        stateEl.insertAdjacentHTML("afterend",
          '<label for="su-addr">Pickup address (shown publicly on your product pages)</label>' +
          '<input id="su-addr" type="text" maxlength="300" placeholder="e.g. 6 Sampson Street, Upper Meniru, Enugu">');
      }
      setup.addEventListener("submit", function () {
        var a = sb.querySelector("#su-addr");
        pendingAddr = a ? a.value.trim() : "";
      }, true);
    }

    var heading = sb.querySelector("#pf-heading");
    if (heading && !sb.querySelector("#pa-input")) {
      heading.insertAdjacentHTML("beforebegin",
        '<h3>Pickup address</h3><p class="muted">Shown publicly on your product pages so buyers know where to collect.</p>' +
        '<input id="pa-input" type="text" maxlength="300" placeholder="e.g. 6 Sampson Street, Upper Meniru, Enugu">' +
        '<button class="button button-outline" type="button" id="pa-save">Save address</button>' +
        '<p class="form-message" id="pa-msg" role="status" aria-live="polite"></p>');
      loadAddress();
    }

    if (!sb.dataset.paBound) {
      sb.dataset.paBound = "1";
      sb.addEventListener("click", async function (e) {
        if (!e.target.closest("#pa-save")) return;
        var c = client(), input = document.getElementById("pa-input"), msg = document.getElementById("pa-msg");
        if (!c || !input) return;
        var r = await c.rpc("set_pickup_address", { p_address: input.value.trim() });
        msg.textContent = r.error ? r.error.message : "Pickup address saved.";
        msg.style.color = r.error ? "#8a1f1f" : "";
      });
    }
  }

  async function editOptions(id) {
    var c = client();
    if (!c) return;
    var r = await c.from("seller_products").select("colors,sizes").eq("id", id).maybeSingle();
    var cur = r.data || {};
    var col = window.prompt("Colours buyers can choose, separated by commas. Leave empty for none.", (cur.colors || []).join(", "));
    if (col === null) return;
    var sz = window.prompt("Sizes buyers can choose, separated by commas, e.g. S, M, L, XL. Leave empty for none.", (cur.sizes || []).join(", "));
    if (sz === null) return;
    function list(t) { return t.split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
    var res = await c.rpc("set_product_options", { p_product: id, p_colors: list(col), p_sizes: list(sz) });
    toast(res.error ? res.error.message : "Colours and sizes saved.");
    if (!res.error) delete optMap[String(id)];
  }

  /* remove a stray "." text node left after the script tag in index.html */
  [].slice.call(document.body.childNodes).forEach(function (n) {
    if (n.nodeType === 3 && n.textContent.trim() === ".") n.remove();
  });

  /* ---------- seller dashboard: extra photos per listing ---------- */
  function initSellerPhotos() {
    var sellerBody = document.getElementById("seller-body");
    if (!sellerBody) return;

    new MutationObserver(function () {
      enhanceSeller();
      sellerBody.querySelectorAll(".seller-actions").forEach(function (a) {
        if (a.querySelector("[data-xp]")) return;
        a.insertAdjacentHTML("beforeend",
          '<button class="button button-outline" type="button" data-xp="opts">Colours &amp; sizes</button>' +
          '<button class="button button-outline" type="button" data-xp="add">+ Photos</button>' +
          '<button class="button button-outline" type="button" data-xp="clear">Clear extra photos</button>');
      });
    }).observe(sellerBody, { childList: true, subtree: true });

    var picker = document.createElement("input");
    picker.type = "file"; picker.multiple = true; picker.accept = "image/jpeg,image/png,image/webp"; picker.hidden = true;
    document.body.appendChild(picker);
    var targetId = null;

    sellerBody.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-xp]");
      if (!b) return;
      var idEl = b.parentNode.querySelector("[data-id]");
      if (!idEl) return;
      targetId = idEl.dataset.id;
      if (b.dataset.xp === "opts") { editOptions(targetId); return; }
      if (b.dataset.xp === "add") { picker.value = ""; picker.click(); return; }
      var c = client();
      if (!c || !window.confirm("Remove all extra photos from this listing? The main photo stays.")) return;
      var r = await c.from("product_images").select("id,image_path").eq("product_id", targetId);
      var rows = r.data || [];
      if (!rows.length) { toast("No extra photos to clear."); return; }
      await c.storage.from("product-images").remove(rows.map(function (x) { return x.image_path; }));
      var d = await c.from("product_images").delete().eq("product_id", targetId);
      toast(d.error ? d.error.message : "Extra photos removed.");
    });

    picker.addEventListener("change", async function () {
      var c = client(), u = await getUser();
      if (!c || !u || !targetId || !picker.files.length) return;
      var ex = await c.from("product_images").select("position").eq("product_id", targetId);
      var have = (ex.data || []).length;
      var room = 5 - have;
      if (room <= 0) { toast("This listing already has 5 extra photos."); return; }
      var pos = have ? Math.max.apply(null, ex.data.map(function (x) { return x.position; })) + 1 : 1;
      var files = [].slice.call(picker.files).slice(0, room), done = 0;
      toast("Uploading " + files.length + " photo" + (files.length === 1 ? "" : "s") + "…");
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!IMG_TYPES[f.type] || f.size > 5 * 1024 * 1024) { toast("Skipped " + f.name + ": JPG, PNG or WebP up to 5 MB."); continue; }
        var path = u.id + "/" + rid() + "." + IMG_TYPES[f.type];
        var up = await c.storage.from("product-images").upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) { toast("Upload failed: " + up.error.message); continue; }
        var url = c.storage.from("product-images").getPublicUrl(path).data.publicUrl;
        var ins = await c.from("product_images").insert({ product_id: targetId, image_path: path, image_url: url, position: pos++ });
        if (ins.error) { await c.storage.from("product-images").remove([path]); toast(ins.error.message); continue; }
        done++;
      }
      if (done) toast(done + " photo" + (done === 1 ? "" : "s") + " added.");
    });
  }
})();
