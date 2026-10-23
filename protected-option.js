/* Checkout "PAYMENT METHOD": 1 Pay at Seller's Location, 2 Pay on Delivery (with an optional SafeBuy Protection add-on).
   The cards drive the original radio buttons, so orders.js keeps working unchanged.
   When the add-on is ticked, a line is added to the order note so the seller and SafeBuy can see it. */
(function () {
  "use strict";
  var FEE = (window.SafeBuyProtect && window.SafeBuyProtect.CFG.inspectionFee) || 200000; // ₦2,000 in kobo
  var DELIVERY = 300000;                                                                   // ₦3,000 in kobo
  var MARK = "[SafeBuy inspection requested: ₦2,000 fee]";
  var protect = false;                                                                     // add-on ticked?

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
  function anchorOf(r) {
    var l = r.closest("label");
    if (l && l.querySelectorAll('input[name="cx-pay"]').length === 1) return l;
    var p = r.parentElement;
    return p && p.querySelectorAll('input[name="cx-pay"]').length === 1 ? p : null;
  }
  function radios() {
    var all = [].slice.call(document.querySelectorAll('input[name="cx-pay"]'));
    return { pod: all.filter(function (r) { return r.value === "pay_on_delivery"; })[0],
             pickup: all.filter(function (r) { return r.value !== "pay_on_delivery"; })[0] };
  }
  function syncNote(podChecked) {                                   // keeps the order note in step with the add-on
    var n = document.getElementById("cx-note");
    if (!n) return;
    var rest = n.value.split("\n").filter(function (l) { return l.indexOf(MARK) !== 0; }).join("\n").trim();
    n.value = protect && podChecked ? MARK + (rest ? "\n" + rest : "") : rest;
  }

  function card(opt, selected, title, lines) {
    var dot = '<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;border:2px solid ' + (selected ? "#087f5b" : "#b9c6bd") +
      ';display:grid;place-items:center;margin-top:2px">' + (selected ? '<span style="width:10px;height:10px;border-radius:50%;background:#087f5b"></span>' : "") + "</span>";
    return '<div data-opt="' + opt + '" role="radio" aria-checked="' + selected + '" tabindex="0"' +
      ' style="display:flex;gap:12px;margin:0 0 12px;padding:14px;border-radius:14px;border:' + (selected ? "2px solid #087f5b" : "1px solid #e6ece8") +
      ';background:' + (selected ? "#e7f7ef" : "#fff") + ';cursor:pointer;font-size:13px;line-height:1.55;color:#52645a">' + dot +
      '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14px;color:#172b24">' + title + "</div>" + lines.join("") + "</div></div>";
  }

  function addon(on) {
    return '<div data-addon="1" role="checkbox" aria-checked="' + on + '" tabindex="0" style="margin-top:10px;padding:10px 12px;border-radius:12px;background:#fff;border:' +
      (on ? "2px solid #087f5b" : "1px solid #cbd9ce") + ';display:flex;gap:10px;align-items:flex-start;cursor:pointer">' +
      '<span style="flex-shrink:0;width:20px;height:20px;border-radius:6px;margin-top:2px;display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;background:' + (on ? "#087f5b" : "#fff") +
      ";border:2px solid " + (on ? "#087f5b" : "#b9c6bd") + '">' + (on ? "✓" : "") + "</span>" +
      '<span><strong style="color:#172b24">🔒 Add SafeBuy Protection</strong> <span style="display:inline-block;margin-left:2px;padding:2px 8px;border-radius:20px;background:#e7f7ef;color:#066548;font-size:10px;font-weight:800">RECOMMENDED</span>' +
      "<br>SafeBuy inspects the item with you. You pay for the item only if you like it. <strong>+" + naira(FEE) + "</strong></span></div>";
  }

  function inject() {
    var r = radios();
    if (!r.pod || !r.pickup) return;
    var aPickup = anchorOf(r.pickup), aPod = anchorOf(r.pod);
    if (!aPickup || !aPod) return;                                  // unknown markup: leave the original options alone

    aPickup.style.display = "none"; aPod.style.display = "none";
    var head = (aPickup.compareDocumentPosition(aPod) & 4 ? aPickup : aPod).previousElementSibling;
    if (head && /^\s*payment\s*$/i.test(head.textContent)) head.style.display = "none";
    syncNote(r.pod.checked);

    var sub = subtotal(), sel = r.pod.checked ? "pod" : r.pickup.checked ? "pickup" : "";
    var key = sub + "|" + sel + "|" + protect;
    var after = aPod.compareDocumentPosition(aPickup) & 4 ? aPickup : aPod;
    var ui = document.getElementById("cx-pay-ui");
    if (ui && ui.dataset.key === key && ui.previousElementSibling === after) return;
    if (!ui) { ui = document.createElement("div"); ui.id = "cx-pay-ui"; ui.setAttribute("role", "radiogroup"); }
    after.insertAdjacentElement("afterend", ui);
    ui.dataset.key = key;
    ui.style.cssText = "margin:8px 0 6px";

    var on = protect && sel === "pod";
    var bold = function (s) { return '<div style="font-weight:700;color:#172b24">' + s + "</div>"; };
    var podTotals = !sub ? [] : on
      ? ["<div>Items: " + naira(sub) + " + Inspection &amp; Protection: " + naira(FEE) + " + Delivery: " + naira(DELIVERY) + "</div>", bold("= Total to Pay: " + naira(sub + FEE + DELIVERY))]
      : [bold("Items: " + naira(sub) + " + Delivery: " + naira(DELIVERY) + " = Total: " + naira(sub + DELIVERY))];

    ui.innerHTML =
      '<div style="font-weight:800;font-size:13px;letter-spacing:.6px;color:#172b24;margin:6px 0 10px">PAYMENT METHOD</div>' +
      card("pickup", sel === "pickup", "1. Pay at Seller's Location (Free)",
        ["<div>Go to seller's shop. See item, then pay cash/transfer.</div>"].concat(sub ? [bold("Total: " + naira(sub))] : [])) +
      card("pod", sel === "pod", "2. Pay on Delivery",
        ["<div>Rider brings item to you. Seller must confirm.</div>"].concat(podTotals, [addon(on)]));
  }

  function choose(e) {
    var t = e.target.closest ? e.target.closest("#cx-pay-ui [data-opt], #cx-pay-ui [data-addon]") : null;
    if (!t) return;
    var r = radios();
    var wantPod = t.hasAttribute("data-addon") || t.dataset.opt === "pod";
    if (t.hasAttribute("data-addon")) protect = !(protect && r.pod && r.pod.checked);   // tick / untick (ticking also selects Pay on Delivery)
    var target = wantPod ? r.pod : r.pickup;
    if (target && !target.checked) target.click();                  // runs the original handlers (e.g. delivery address field)
    inject();
  }
  document.addEventListener("click", choose);
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("#cx-pay-ui [data-opt], #cx-pay-ui [data-addon]")) { e.preventDefault(); choose(e); }
  });
  document.addEventListener("change", function (e) { if (e.target && e.target.name === "cx-pay") inject(); });
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
})();
