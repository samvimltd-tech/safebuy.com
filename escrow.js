/* SafeBuy NG escrow: Buy with escrow, order list, Accept / Reject.
   Loaded after the main page scripts, so it can use window.safeBuySupabase,
   findProduct(), esc(), money() and showToast() from index.html. */
(function () {
  "use strict";

  /* ---------- Settings ---------- */
  var PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_ME"; // use pk_live_... when you go live
  var INSPECTION_FEE = 2000;                      // naira, must match the database default

  var client = window.safeBuySupabase;
  var cfg = window.SAFEbuySupabaseConfig || {};
  var FN_URL = String(cfg.url || "").replace(/\/+$/, "") + "/functions/v1/release-payout";
  if (!client) return;

  var STATUS = {
    pending: "Waiting for payment",
    paid_to_escrow: "Paid. Waiting for pickup",
    shipped: "On the way. Inspect, then decide",
    processing: "Processing…",
    accepted: "Accepted",
    payout_released: "Completed. Seller paid",
    rejected: "Rejected",
    refunded: "Refunded"
  };

  /* ---------- Buy with escrow ---------- */
  async function buy(productId) {
    var product = findProduct(productId);
    if (!product) return;

    if (typeof PaystackPop === "undefined") {
      showToast("Payments could not load. Check your connection and try again.");
      return;
    }
    if (PAYSTACK_PUBLIC_KEY.indexOf("REPLACE") !== -1) {
      showToast("Escrow is not set up yet: add your Paystack public key in escrow.js.");
      return;
    }

    var u = await client.auth.getUser();
    var user = u.data && u.data.user;
    if (!user) {
      document.querySelector('[data-action="account"]').click();
      document.getElementById("account-message").textContent = "Sign in to buy with escrow.";
      return;
    }

    var price = Math.floor(product.price);
    var total = price + INSPECTION_FEE;
    var ok = window.confirm(
      "Buy with SafeBuy escrow\n\n" +
      "Product: " + money(price) + "\n" +
      "Inspection fee: " + money(INSPECTION_FEE) + "\n" +
      "You pay now: " + money(total) + "\n\n" +
      "The seller is paid only after you accept the item on delivery. " +
      "If you reject it, you get " + money(price) + " back and the inspection fee is kept."
    );
    if (!ok) return;

    var handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: total * 100,
      currency: "NGN",
      ref: "SAFEBUY_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      metadata: { product_id: String(product.id), product_name: product.name },
      callback: function (response) {
        // Must be a plain function (not async) for Paystack
        client.from("marketplace_orders").insert({
          buyer_id: user.id,
          product_id: product.id,
          amount: price,
          inspection_fee: INSPECTION_FEE,
          paystack_reference: response.reference,
          escrow_status: "paid_to_escrow"
        }).select("id").single().then(function (res) {
          if (res.error) {
            window.alert(
              "Your payment went through but we could not save the order.\n" +
              "Please keep this reference and contact SafeBuy NG: " + response.reference
            );
            return;
          }
          showToast("Paid to SafeBuy escrow. We will arrange pickup.");
          openOrders();
        });
      },
      onClose: function () {
        showToast("Payment window closed.");
      }
    });
    handler.openIframe();
  }

  /* ---------- Orders modal ---------- */
  var backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "escrow-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.innerHTML =
    '<div class="modal">' +
    '<div class="modal-top"><h2>Your escrow orders</h2>' +
    '<button class="icon-button" type="button" id="escrow-close" aria-label="Close">✕</button></div>' +
    '<div id="escrow-body"></div></div>';
  document.body.appendChild(backdrop);

  var body = document.getElementById("escrow-body");

  function closeOrders() { backdrop.classList.remove("open"); }

  async function openOrders() {
    var u = await client.auth.getUser();
    var user = u.data && u.data.user;
    if (!user) {
      document.querySelector('[data-action="account"]').click();
      document.getElementById("account-message").textContent = "Sign in to see your orders.";
      return;
    }
    backdrop.classList.add("open");
    body.innerHTML = "<p>Loading…</p>";

    var r = await client.from("marketplace_orders").select("*").eq("buyer_id", user.id);
    if (r.error) { body.innerHTML = "<p>" + esc(r.error.message) + "</p>"; return; }

    var rows = (r.data || []).slice().sort(function (a, b) {
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    if (!rows.length) { body.innerHTML = "<p>No escrow orders yet.</p>"; return; }

    body.innerHTML = rows.map(function (o) {
      var label = STATUS[o.escrow_status] || o.escrow_status;
      var done = o.escrow_status === "payout_released" || o.escrow_status === "accepted";
      var bad = o.escrow_status === "refunded" || o.escrow_status === "rejected";
      var pill = '<span class="status-pill' + (done ? " ok" : bad ? " bad" : "") + '">' + esc(label) + "</span>";
      var buttons = o.escrow_status === "shipped"
        ? '<div class="seller-actions">' +
          '<button class="button button-primary" type="button" data-escrow="accept" data-id="' + esc(o.id) + '">Accept item</button>' +
          '<button class="button button-outline" type="button" data-escrow="reject" data-id="' + esc(o.id) + '">Reject item</button>' +
          "</div>"
        : "";
      return '<div class="seller-item">' + pill +
        "<div><strong>" + esc(money(o.amount)) + "</strong> + " + esc(money(o.inspection_fee)) + " inspection fee</div>" +
        '<div class="muted">Order ' + esc(String(o.id).slice(0, 8)) + "</div>" + buttons + "</div>";
    }).join("");
  }

  async function decide(orderId, action, button) {
    var msg = action === "accept"
      ? "Accept this item? The seller will be paid and this cannot be undone."
      : "Reject this item? You will be refunded the product price. The inspection fee is not refunded.";
    if (!window.confirm(msg)) return;

    button.disabled = true;
    var s = await client.auth.getSession();
    var session = s.data && s.data.session;
    if (!session) { showToast("Please sign in again."); button.disabled = false; return; }

    try {
      var res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.publishableKey,
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({ order_id: orderId, action: action })
      });
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showToast(out.error || "Something went wrong. Please try again.");
        button.disabled = false;
        return;
      }
      showToast(action === "accept" ? "Thanks! The seller has been paid." : "Refund started. It can take a few days to reach you.");
    } catch (e) {
      showToast("Network problem. Please try again.");
      button.disabled = false;
      return;
    }
    openOrders();
  }

  /* ---------- Wiring ---------- */
  document.addEventListener("click", function (event) {
    var buyBtn = event.target.closest('[data-action="escrow-buy"]');
    if (buyBtn) { buy(buyBtn.dataset.id); return; }

    var act = event.target.closest("[data-escrow]");
    if (act) { decide(act.dataset.id, act.dataset.escrow, act); return; }

    if (event.target.closest("#escrow-orders-btn")) { openOrders(); return; }
    if (event.target.closest("#escrow-close") || event.target === backdrop) closeOrders();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeOrders(); });

  // "Orders" button in the header, before the cart
  var actions = document.querySelector(".header-actions");
  var cartBtn = actions && actions.querySelector(".cart-button");
  if (actions && cartBtn) {
    var ordersBtn = document.createElement("button");
    ordersBtn.className = "button button-outline";
    ordersBtn.type = "button";
    ordersBtn.id = "escrow-orders-btn";
    ordersBtn.textContent = "Orders";
    actions.insertBefore(ordersBtn, cartBtn);
  }
})();
