/* Shows "SafeBuy Protected (coming soon)" joined directly under "Pay on delivery" in the cart checkout.
   It is plain information (no radio button), so it does not change how orders.js places orders. */
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
    var pod = document.querySelector('input[name="cx-pay"][value="pay_on_delivery"]') || radios[radios.length - 1];
    var sub = subtotal(), box = document.getElementById("cx-protected");
    if (box && box.dataset.sub === String(sub) && box.previousElementSibling === (pod.closest("label") || pod.parentElement)) return;
    var anchor = pod.closest("label") || pod.parentElement;
    if (!box) { box = document.createElement("div"); box.id = "cx-protected"; }
    anchor.insertAdjacentElement("afterend", box);
    box.dataset.sub = String(sub);
    box.style.cssText = "margin:-2px 0 14px 34px;padding:2px 0 2px 12px;border-left:3px solid #bfe6d1;font-size:13px;line-height:1.55;color:#52645a";
    box.innerHTML =
      '<div style="font-weight:700;color:#172b24">SafeBuy Protected ' +
      '<span style="display:inline-block;margin-left:4px;padding:2px 8px;border-radius:20px;background:#fff3e0;color:#7a4a05;font-size:11px;font-weight:800">Coming soon</span></div>' +
      '<div>A rider inspects the item on delivery. Pay for the item only if you like it.</div>' +
      (sub ? '<div>Items: ' + naira(sub) + '</div>' : '') +
      '<div>Protection fee: ' + naira(FEE) + '</div>' +
      '<div>Delivery: confirmed when you order</div>' +
      (sub ? '<div style="font-weight:700;color:#172b24">Total before delivery: ' + naira(sub + FEE) + '</div>' : '') +
      '<div style="font-size:12px;color:#718078">Not available yet. For now, choose one of the options above.</div>';
  }

  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();
