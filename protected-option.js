/* Checkout layout: "Pay at pickup" is separated from "Pay on delivery".
   Under Pay on delivery, the rider-inspection breakdown shows (only while Pay on delivery is selected).
   Display only: orders.js still places orders exactly as before. */
(function () {
  "use strict";
  var FEE = (window.SafeBuyProtect && window.SafeBuyProtect.CFG.inspectionFee) || 200000; // ₦2,000 in kobo
  var DELIVERY = 300000;                                                                   // ₦3,000 in kobo
  function naira(k) { return "₦" + (k / 100).toLocaleString("en-NG"); }

  function subtotal() {
    var items = [], sum = 0;
    try { items = JSON.parse(localStorage.getItem("safebuy_cart_v1") || "[]"); } catch (e) {}
    items.forEach(function (i) {
      var p = i && i.qty > 0 && window.findProduct ? window.findProduct(i.id) : null;
      if (p) sum += Math.round(p.price * 100) * i.qty;
    });
    return sum;
  }

  function row(label, value, bold) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0' +
      (bold ? ';font-weight:800;color:#172b24;font-size:14px' : '') + '"><span>' + label + '</span><span style="white-space:nowrap">' + value + '</span></div>';
  }

  function inject() {
    var pod = document.querySelector('input[name="cx-pay"][value="pay_on_delivery"]');
    if (!pod) return;
    var anchor = pod.closest("label") || pod.parentElement;

    // Separate Pay on delivery from Pay at pickup
    if (!anchor.dataset.sbSep) {
      anchor.dataset.sbSep = "1";
      anchor.style.marginTop = "14px";
      anchor.style.paddingTop = "14px";
      anchor.style.borderTop = "1px solid #e6ece8";
    }

    var sub = subtotal(), key = sub + "|" + pod.checked;
    var box = document.getElementById("cx-protected");
    if (box && box.dataset.key === key && box.previousElementSibling === anchor) return;
    if (!box) { box = document.createElement("div"); box.id = "cx-protected"; }
    anchor.insertAdjacentElement("afterend", box);
    box.dataset.key = key;
    box.style.cssText = "margin:4px 0 16px 34px;padding:4px 0 4px 12px;border-left:3px solid #bfe6d1;font-size:13px;line-height:1.55;color:#52645a;display:" + (pod.checked ? "block" : "none");
    box.innerHTML =
      '<div style="margin-bottom:6px">SafeBuy inspects the item on delivery. Pay for the item only if you like it.</div>' +
      (sub ? row("Items", naira(sub)) : "") +
      row("Inspection &amp; Protection fee", naira(FEE)) +
      row("Delivery fee", naira(DELIVERY)) +
      (sub ? '<div style="border-top:1px solid #e6ece8;margin:4px 0"></div>' + row("Total + delivery", naira(sub + FEE + DELIVERY), true) : "") +
      '<div style="font-size:12px;color:#718078;margin-top:6px">Fees are confirmed by SafeBuy NG when you place your order.</div>';
  }

  document.addEventListener("change", function (e) { if (e.target && e.target.name === "cx-pay") inject(); });
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();
