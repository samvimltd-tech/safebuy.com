/* SafeBuy NG: header name, order placing, My orders, seller orders. Needs orders.sql run first. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  if (!c) return;

  function E(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
  function N(k) { return "₦" + (Number(k) / 100).toLocaleString("en-NG"); }
  function T(m) { if (window.showToast) window.showToast(m); else alert(m); }
  function wa(p) { var d = String(p || "").replace(/\D/g, ""); if (d.indexOf("234") === 0) return d; if (d.charAt(0) === "0") return "234" + d.slice(1); if (d.length === 10) return "234" + d; return d; }
  function user() { return c.auth.getUser().then(function (r) { return r.data && r.data.user; }); }
  var STEPS = { placed: "Placed: waiting for seller", paid: "Paid", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  /* ---- modal ---- */
  var back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = '<div class="modal"><div class="modal-top"><h2 id="om-title"></h2><button class="icon-button" type="button" id="om-close" aria-label="Close">✕</button></div><div id="om-body"></div></div>';
  document.body.appendChild(back);
  var body = back.querySelector("#om-body"), title = back.querySelector("#om-title");
  function open(t, html) { title.textContent = t; body.innerHTML = html; back.classList.add("open"); }
  function close() { back.classList.remove("open"); }
  back.querySelector("#om-close").onclick = close;
  back.addEventListener("click", function (e) { if (e.target === back) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  /* ---- header: name + My orders ---- */
  var actions = document.querySelector(".header-actions");
  var ordersBtn = document.createElement("button");
  ordersBtn.className = "button button-outline"; ordersBtn.type = "button"; ordersBtn.textContent = "📦 Orders"; ordersBtn.hidden = true;
  actions.insertBefore(ordersBtn, actions.firstChild);
  ordersBtn.onclick = showMyOrders;

  ordersBtn.id = "mp-orders-btn";
  var shopBtn = document.createElement("button");
  shopBtn.className = "button button-primary"; shopBtn.type = "button"; shopBtn.hidden = true;
  actions.insertBefore(shopBtn, ordersBtn.nextSibling);
  shopBtn.onclick = function () { var b = document.querySelector('[data-action="sell"]'); if (b) b.click(); };
  function refreshShop() {
    user().then(function (u) {
      if (!u) { shopBtn.hidden = true; return; }
      c.from("seller_applications").select("id").eq("user_id", u.id).maybeSingle().then(function (a) {
        if (!a.data) { shopBtn.hidden = true; return; }
        c.from("marketplace_orders").select("id", { count: "exact", head: true })
          .eq("seller_application_id", a.data.id).eq("status", "placed").then(function (r) {
            var n = r.count || 0;
            shopBtn.hidden = n < 1;
            shopBtn.textContent = "🔔 New orders (" + n + ")";
          });
      });
    });
  }
  setInterval(refreshShop, 60000);
  function refreshHeader() { user().then(function (u) { ordersBtn.hidden = !u; }); refreshShop(); }
  c.auth.onAuthStateChange(function () { setTimeout(refreshHeader, 0); });
  refreshHeader();

  /* ---- rename "Chat seller" to "Place order" ---- */
  function relabel() {
    document.querySelectorAll('[data-action="whatsapp"]').forEach(function (b) {
      if (b.disabled) return;
      var t = b.textContent.trim();
      if (t === "Chat seller" || t === "Chat seller on WhatsApp") b.textContent = "Place order";
    });
  }
  new MutationObserver(relabel).observe(document.body, { childList: true, subtree: true });
  relabel();

  /* ---- place an order (replaces the old Chat seller click) ---- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest('[data-action="whatsapp"]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    user().then(function (u) {
      if (!u) { var a = document.querySelector('[data-action="account"]'); if (a) a.click(); T("Sign in to place an order."); return; }
      var id = b.dataset.id;
      var p = (window.findProduct && window.findProduct(id)) || null;
      var name = p ? p.name : "this product", price = p ? Math.round(p.price * 100) : 0;
      var m = document.getElementById("modal-backdrop"); if (m) m.classList.remove("open");
      open("Place order",
        "<p><strong>" + E(name) + "</strong><br>" + N(price) + " each</p>" +
        '<label for="om-qty">Quantity</label><input id="om-qty" type="number" min="1" max="99" value="1">' +
        '<p class="modal-note"><strong>How it works:</strong> your order goes to the seller. Seller contact unlocks once the seller marks it Paid. SafeBuy NG does not process payments yet, so never pay anyone before you are comfortable.</p>' +
        '<button class="button button-primary" type="button" id="om-go">Confirm order</button>' +
        '<p class="form-message" id="om-msg"></p>');
      document.getElementById("om-go").onclick = function () {
        var q = Math.max(1, Math.min(99, parseInt(document.getElementById("om-qty").value, 10) || 1));
        this.disabled = true;
        c.from("marketplace_orders").insert({ buyer_id: u.id, product_id: id, quantity: q }).then(function (r) {
          if (r.error) { document.getElementById("om-msg").textContent = r.error.message; document.getElementById("om-go").disabled = false; return; }
          T("Order placed."); showMyOrders();
        });
      };
    });
  }, true);

  /* ---- buyer: My orders ---- */
  function showMyOrders() {
    open("My orders", "<p>Loading…</p>");
    c.from("marketplace_orders").select("*").order("created_at", { ascending: false }).then(function (r) {
      if (r.error) { body.innerHTML = "<p>" + E(r.error.message) + "</p>"; return; }
      u2();
      function u2() {
        user().then(function (u) {
          var mine = (r.data || []).filter(function (o) { return u && o.buyer_id === u.id; });
          if (!mine.length) { body.innerHTML = "<p>No orders yet.</p>"; return; }
          body.innerHTML = mine.map(function (o) {
            var btns = "";
            if (o.status === "placed") btns += '<button class="button button-outline" data-ob="cancelled" data-id="' + E(o.id) + '">Cancel order</button>';
            if (["paid", "shipped", "delivered"].indexOf(o.status) > -1) btns += '<button class="button button-primary" data-chat="' + E(o.product_id) + '">Chat seller on WhatsApp</button>';
            if (o.status === "shipped") btns += '<button class="button button-light" data-ob="delivered" data-id="' + E(o.id) + '">I received it</button>';
            return '<div class="review-card"><strong>' + E(o.product_name || "Product") + "</strong> × " + o.quantity +
              (o.shop_name ? '<br><span class="muted">Seller: ' + E(o.shop_name) + "</span>" : "") +
              (o.color || o.size ? '<br><span class="muted">' + E([o.color, o.size].filter(Boolean).join(" · ")) + "</span>" : "") + "<br>" + N(o.total_kobo) + ' <span class="status-pill' + (o.status === "delivered" ? " ok" : o.status === "cancelled" ? " bad" : "") + '">' + E(STEPS[o.status] || o.status) + "</span>" +
              '<br><span class="muted">' + new Date(o.created_at).toLocaleDateString("en-NG") + " · #" + E(String(o.id).slice(0, 8)) + "</span>" + btns + "</div>";
          }).join("");
        });
      }
    });
  }
  body.addEventListener("click", function (e) {
    var s = e.target.closest("[data-ob]"), ch = e.target.closest("[data-chat]");
    if (s) { s.disabled = true; setStatus(s.dataset.id, s.dataset.ob, showMyOrders); }
    if (ch) {
      var win = window.open("about:blank", "_blank");
      c.rpc("seller_contact", { p_product: ch.dataset.chat }).then(function (r) {
        var n = r.error ? "" : wa(r.data);
        if (!n) { if (win) win.close(); T("Seller contact is not available yet."); return; }
        var url = "https://wa.me/" + n + "?text=" + encodeURIComponent("Hello, this is about my SafeBuy NG order.");
        if (win) win.location.href = url; else location.href = url;
      });
    }
  });
  function setStatus(id, status, done) {
    c.rpc("mp_update_order_status", { p_order: id, p_status: status }).then(function (r) {
      if (r.error) T(r.error.message); else T("Order updated.");
      refreshShop();
      done();
    });
  }

  /* ---- seller: orders section inside the seller dashboard ---- */
  var sb = document.getElementById("seller-body");
  function sellerOrders() {
    if (!document.getElementById("my-products") || document.getElementById("seller-orders")) return;
    var box = document.createElement("div"); box.id = "seller-orders";
    box.innerHTML = "<h3>Orders received</h3><div id='so-list'>Loading…</div>";
    sb.appendChild(box);
    loadSellerOrders();
  }
  function loadSellerOrders() {
    user().then(function (u) {
      if (!u) return;
      c.from("seller_applications").select("id").eq("user_id", u.id).maybeSingle().then(function (a) {
        if (!a.data) return;
        c.from("marketplace_orders").select("*").eq("seller_application_id", a.data.id).order("created_at", { ascending: false }).then(function (r) {
          var l = document.getElementById("so-list"); if (!l) return;
          if (r.error) { l.textContent = r.error.message; return; }
          if (!(r.data || []).length) { l.textContent = "No orders yet."; return; }
          l.innerHTML = r.data.map(function (o) {
            var b = "";
            if (o.status === "placed") b += '<button class="button button-primary" data-so="paid" data-id="' + E(o.id) + '">Mark paid</button><button class="button button-outline" data-so="cancelled" data-id="' + E(o.id) + '">Cancel</button>';
            if (o.status === "paid") b += '<button class="button button-primary" data-so="shipped" data-id="' + E(o.id) + '">Mark shipped</button>';
            return '<div class="seller-item"><strong>' + E(o.product_name || "Product") + "</strong> × " + o.quantity + " · " + N(o.total_kobo) +
              '<br><span class="muted">Buyer: ' + E(o.buyer_name || "-") + ([o.color, o.size].filter(Boolean).length ? " · " + E([o.color, o.size].filter(Boolean).join(", ")) : "") +
              (o.pay_method === "pay_on_delivery" ? "<br>Pay on delivery to: " + E(o.address || "-") : "") + (o.note ? "<br>Note: " + E(o.note) : "") +
              '</span><br><span class="muted">' + E(STEPS[o.status] || o.status) + " · #" + E(String(o.id).slice(0, 8)) + '</span><div class="seller-actions">' + b + "</div></div>";
          }).join("");
        });
      });
    });
  }
  sb.addEventListener("click", function (e) {
    var s = e.target.closest("[data-so]");
    if (!s) return;
    s.disabled = true;
    setStatus(s.dataset.id, s.dataset.so, loadSellerOrders);
  });
  new MutationObserver(sellerOrders).observe(sb, { childList: true, subtree: true });

  /* ---- old cart: place_order now creates marketplace orders (no WhatsApp numbers shown) ---- */
  function cartBody() { return document.getElementById("cart-body"); }
  function cartMsg(t, bad) { var m = document.getElementById("cx-msg"); if (m) { m.textContent = t; m.style.color = bad ? "#8a1f1f" : ""; } }
  function placeCart() {
    user().then(function (u) {
      if (!u) {
        document.getElementById("cart-backdrop").classList.remove("open");
        T("Sign in to place your order. Your cart is saved.");
        var a = document.querySelector('[data-action="account"]'); if (a) a.click();
        return;
      }
      var items = [];
      try { items = JSON.parse(localStorage.getItem("safebuy_cart_v1") || "[]"); } catch (e) {}
      items = items.filter(function (i) { return i && i.id && i.qty > 0; });
      var name = (document.getElementById("cx-name").value || "").trim();
      var pr = document.querySelector('input[name="cx-pay"]:checked');
      var pay = pr && pr.value === "pay_on_delivery" ? "pay_on_delivery" : "direct";
      var addr = (document.getElementById("cx-addr").value || "").trim();
      var note = (document.getElementById("cx-note").value || "").trim();
      if (!items.length) { cartMsg("Your cart is empty.", true); return; }
      if (!name) { cartMsg("Enter your name.", true); return; }
      if (pay === "pay_on_delivery" && !addr) { cartMsg("Enter your delivery address.", true); return; }
      var btn = document.querySelector('#cart-body [data-c="place"]'); if (btn) btn.disabled = true;
      cartMsg("Placing your order…");
      var rows = items.map(function (i) {
        return { buyer_id: u.id, product_id: i.id, quantity: Math.min(99, i.qty), color: i.color || null, size: i.size || null,
                 buyer_name: name, note: note || null, pay_method: pay, address: addr || null };
      });
      c.from("marketplace_orders").insert(rows).then(function (r) {
        if (r.error) { cartMsg(r.error.message, true); if (btn) btn.disabled = false; return; }
        var rm; while ((rm = cartBody().querySelector('[data-c="rm"]'))) rm.click();
        cartBody().innerHTML = '<p class="status-pill ok">' + rows.length + " order" + (rows.length === 1 ? "" : "s") + ' placed</p>' +
          "<p>Each seller will confirm. Seller contact unlocks once a seller marks your order Paid.</p>" +
          '<button class="button button-primary" type="button" id="mp-view">View my orders</button>';
        document.getElementById("mp-view").onclick = function () { document.getElementById("cart-backdrop").classList.remove("open"); showMyOrders(); };
      });
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest('#cart-body [data-c="place"], #cart-body [data-c="orders"]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (b.dataset.c === "orders") { document.getElementById("cart-backdrop").classList.remove("open"); showMyOrders(); return; }
    placeCart();
  }, true);
})();
