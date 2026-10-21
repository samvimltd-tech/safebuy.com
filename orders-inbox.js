/* SafeBuy NG: seller order inbox + buyer "received / not received".
   Load after buyer-account.js. Needs order_status.sql. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  var box = document.getElementById("role-box");
  if (!c || !box) return;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function naira(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  function say(t) { if (typeof showToast === "function") showToast(t); else alert(t); }
  function waLink(phone, text) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.charAt(0) === "0") d = "234" + d.slice(1);
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(text);
  }

  var LABEL = { new: "New", accepted: "Accepted", declined: "Declined", shipped: "Shipped",
                delivered: "Delivered", received: "Received ✓", not_received: "Not received" };
  var SELLER_NEXT = {
    new: [["accepted", "Accept"], ["declined", "Decline"]],
    accepted: [["shipped", "Mark shipped"], ["declined", "Decline"]],
    shipped: [["delivered", "Mark delivered"]]
  };
  var BUYER_NEXT = {
    shipped: [["received", "I received it"], ["not_received", "Not received"]],
    delivered: [["received", "I received it"], ["not_received", "Not received"]],
    not_received: [["received", "I received it"]]
  };

  /* ---------- modal ---------- */
  var back = document.createElement("div");
  back.className = "modal-backdrop";
  back.setAttribute("role", "dialog");
  back.setAttribute("aria-modal", "true");
  back.innerHTML = '<div class="modal"><div class="modal-top"><h2 id="oi-title">Orders</h2>' +
    '<button class="icon-button" type="button" id="oi-close" aria-label="Close">✕</button></div>' +
    '<div id="oi-body"></div></div>';
  document.body.appendChild(back);
  var body = back.querySelector("#oi-body");
  var title = back.querySelector("#oi-title");
  var mode = "buyer";

  function close() { back.classList.remove("open"); }
  back.querySelector("#oi-close").addEventListener("click", close);
  back.addEventListener("click", function (e) { if (e.target === back) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  function pill(s) {
    var cls = s === "received" || s === "delivered" ? "ok" : (s === "declined" || s === "not_received" ? "bad" : "");
    return '<span class="status-pill ' + cls + '">' + esc(LABEL[s] || s) + "</span>";
  }
  function buttons(map, r) {
    return (map[r.status] || []).map(function (a) {
      return '<button class="button ' + (a[0] === "declined" || a[0] === "not_received" ? "button-outline" : "button-primary") +
        '" type="button" data-o="' + esc(r.order_id) + '" data-s="' + esc(r.seller_application_id) +
        '" data-to="' + a[0] + '">' + a[1] + "</button>";
    }).join("");
  }

  async function open(m) {
    mode = m;
    title.textContent = m === "seller" ? "Order inbox" : "My order updates";
    body.innerHTML = "<p>Loading…</p>";
    back.classList.add("open");
    var document_close = document.getElementById("account-close");
    if (document_close) document_close.click();

    var r = await c.rpc(m === "seller" ? "seller_orders" : "buyer_orders");
    if (r.error) { body.textContent = r.error.message; return; }
    if (!r.data.length) { body.innerHTML = "<p>No orders yet.</p>"; return; }

    body.innerHTML = r.data.map(function (o) {
      var when = esc(new Date(o.created_at).toLocaleDateString("en-NG"));
      if (m === "buyer") {
        return '<div class="seller-item"><strong>' + esc(o.code) + "</strong> · " + esc(o.shop_name) +
          '<br><span class="muted">' + when + "</span> " + pill(o.status) +
          '<div class="seller-actions">' + buttons(BUYER_NEXT, o) + "</div>" +
          (o.status === "not_received"
            ? '<p class="muted">Please contact the seller on WhatsApp. SafeBuy NG will review this order.</p>' : "") +
          "</div>";
      }
      var items = (o.items || []).map(function (i) {
        var v = [i.color, i.size].filter(Boolean).join(", ");
        return esc(i.qty + " × " + i.name + (v ? " [" + v + "]" : ""));
      }).join("<br>");
      var hello = "Hello " + o.buyer_name + ", this is about your SafeBuy NG order " + o.code + ".";
      return '<div class="seller-item"><strong>' + esc(o.code) + "</strong> · " + naira(o.subtotal_kobo) +
        '<br><span class="muted">' + when + " · " + esc(o.buyer_name) + " · " +
        (o.pay_method === "pay_on_delivery" ? "Pay on delivery" : "Pay at pickup") + "</span> " + pill(o.status) +
        '<p class="muted">' + items + "</p>" +
        (o.address ? '<p class="muted">Deliver to: ' + esc(o.address) + "</p>" : "") +
        (o.note ? '<p class="muted">Note: ' + esc(o.note) + "</p>" : "") +
        '<div class="seller-actions">' + buttons(SELLER_NEXT, o) +
        '<a class="button button-light" target="_blank" rel="noopener" href="' + esc(waLink(o.buyer_phone, hello)) + '">WhatsApp buyer</a>' +
        "</div></div>";
    }).join("");
  }

  body.addEventListener("click", async function (e) {
    var b = e.target.closest("[data-to]");
    if (!b) return;
    if (b.dataset.to === "declined" && !window.confirm("Decline this order?")) return;
    b.disabled = true;
    var r = await c.rpc("set_fulfilment", { p_order: b.dataset.o, p_seller: b.dataset.s, p_status: b.dataset.to });
    if (r.error) { say(r.error.message); b.disabled = false; return; }
    say("Updated.");
    open(mode);
  });

  /* ---------- entry points inside the account popup's role box ---------- */
  function addButtons() {
    if (box.hidden || box.querySelector("#oi-buyer")) return;
    var isSeller = /Seller account/.test(box.textContent) && !/shop not set up/.test(box.textContent) && !/Suspended/.test(box.textContent);
    box.insertAdjacentHTML("beforeend",
      '<button type="button" class="button button-outline" id="oi-buyer">My order updates</button>' +
      (isSeller ? '<button type="button" class="button button-primary" id="oi-seller">Seller order inbox</button>' : ""));
  }
  box.addEventListener("click", function (e) {
    if (e.target.closest("#oi-buyer")) open("buyer");
    if (e.target.closest("#oi-seller")) open("seller");
  });
  new MutationObserver(addButtons).observe(box, { childList: true, attributes: true, attributeFilter: ["hidden"] });
  addButtons();
})();
