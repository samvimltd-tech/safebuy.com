/* SafeBuy Protected: fee maths. All money in KOBO (integers), matching price_kobo.
   Browser: display only. Server (Edge Function): the ONLY place that sets what Paystack charges. */
(function (root) {
  var CFG = { inspectionFee: 200000, commissionRate: 0.06 }; // ₦2,000 ; 6%
  var naira = function (k) { return "₦" + (k / 100).toLocaleString("en-NG"); };

  function quote(productKobo, deliveryKobo) {
    var d = deliveryKobo || 0;
    return { product: productKobo, inspection: CFG.inspectionFee, delivery: d,
             total: productKobo + CFG.inspectionFee + d };
  }
  // action: "accept" | "reject" (buyer changed mind) | "reject_seller_fault"
  function settle(order, action) {
    var commission = Math.round(order.amount_kobo * CFG.commissionRate);
    if (action === "accept")
      return { sellerPayout: order.amount_kobo - commission, refund: 0, platform: commission + order.inspection_fee_kobo };
    if (action === "reject_seller_fault")
      return { sellerPayout: 0, refund: order.total_paid_kobo, platform: 0 };
    return { sellerPayout: 0, refund: order.amount_kobo, platform: order.inspection_fee_kobo };
  }
  function renderSummary(el, productKobo, deliveryKobo) {
    var q = quote(productKobo, deliveryKobo);
    el.innerHTML = "";
    [["Product", q.product], ["SafeBuy Protection fee", q.inspection], ["Delivery", q.delivery]].forEach(function (r) {
      var row = document.createElement("div"); row.textContent = r[0] + ": " + naira(r[1]); el.appendChild(row);
    });
    var t = document.createElement("strong"); t.textContent = "Total: " + naira(q.total); el.appendChild(t);
    var s = document.createElement("small"); s.style.display = "block";
    s.textContent = "The protection fee covers rider inspection and the return trip. It is refunded in full if the item is not as described.";
    el.appendChild(s);
  }
  var api = { CFG: CFG, quote: quote, settle: settle, renderSummary: renderSummary, naira: naira };
  if (typeof module !== "undefined") module.exports = api; else root.SafeBuyProtect = api;
})(this);
