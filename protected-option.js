/* Adds a "SafeBuy Protected (coming soon)" option under Payment in the cart checkout.
   It is disabled, so it cannot be chosen and does not change how orders.js places orders. */
(function () {
  "use strict";
  var FEE = (window.SafeBuyProtect && window.SafeBuyProtect.CFG.inspectionFee) || 200000; // kobo = ₦2,000
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

  function inject() {
    var radios = document.querySelectorAll('input[name="cx-pay"]');
    if (!radios.length) return;
    var sub = subtotal(), box = document.getElementById("cx-protected");
    if (box && box.dataset.sub === String(sub)) return;          // already up to date
    var last = radios[radios.length - 1];
    var anchor = last.closest("label") || last.parentElement;
    if (!box) {
      box = document.createElement("div");
      box.id = "cx-protected";
      anchor.insertAdjacentElement("afterend", box);
    }
    box.dataset.sub = String(sub);
    box.style.cssText = "margin:12px 0;padding:12px 14px;border:1px dashed #cbd9ce;border-radius:14px;background:#f7f9f7;font-size:13px;line-height:1.6;color:#52645a";
    box.innerHTML =
      '<label style="display:flex;gap:9px;align-items:flex-start;font-weight:700;color:#172b24"><input type="radio" disabled style="margin-top:3px"> ' +
      '<span>SafeBuy Protected <span style="font-weight:700;color:#7a4a05;background:#fff3e0;border-radius:20px;padding:2px 8px;font-size:11px">Coming soon</span></span></label>' +
      '<div style="margin:6px 0 0 24px">A rider inspects the item on delivery. Pay for the item only if you like it.' +
      (sub ? '<br>Items: ' + naira(sub) + '<br>Protection fee: ' + naira(FEE) + '<br>Delivery: confirmed when you order' +
             '<br><strong style="color:#172b24">Total before delivery: ' + naira(sub + FEE) + '</strong>' : '<br>Protection fee: ' + naira(FEE)) +
      '<br><small>Not available yet. For now, choose one of the options above.</small></div>';
  }

  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();
