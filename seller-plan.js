/* SafeBuy NG seller-plan.js: "List free" + Verified badge subscription card in the seller dashboard.
   Card payments stay OFF until PAY_URL (your Paystack server function address) is filled in. */
(function () {
  "use strict";
  var PAY_URL = "";   // e.g. "https://YOURPROJECT.supabase.co/functions/v1/paystack-plans". Empty = card payments not open yet.
  var body = document.getElementById("seller-body");
  if (!body) return;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(k) { return "₦" + (Number(k || 0) / 100).toLocaleString("en-NG"); }
  var busy = false;

  function draw(host, s) {
    var P = s.plans || {}, m = P.monthly_kobo || 100000, y = P.yearly_kobo || 1200000;
    var html = '<div id="plan-card" style="border:1px solid #cfe3d6;background:#f4fbf6;border-radius:14px;padding:14px;margin:12px 0">' +
      '<strong>✅ Listing is free</strong><p class="muted" style="margin:4px 0 10px">List as many products as you like at no cost. The Verified seller badge is a paid extra.</p>';
    if (s.active) {
      html += '<p class="status-pill ok" style="margin:0 0 6px">✓ Badge active until ' + esc(new Date(s.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })) + " (" + (s.plan === "yearly" ? "12-month" : "monthly") + " plan)</p>" +
        (s.auto_renew ? '<p class="muted" style="margin:0 0 8px">Renews automatically from your card. You can stop it any time.</p><button type="button" class="button button-outline" id="plan-cancel">Stop automatic renewal</button>'
                      : '<p class="muted" style="margin:0">Automatic renewal is off. The badge ends on that date unless you renew.</p>');
    } else if (!s.app) {
      html += '<p class="muted">Create your shop first, then you can add the badge.</p>';
    } else {
      html += '<strong>Verified seller badge</strong>' +
        '<label style="display:flex;gap:8px;margin:8px 0"><input type="radio" name="plan-pick" value="monthly" checked> <span>' + naira(m) + " per month</span></label>" +
        '<label style="display:flex;gap:8px;margin:8px 0"><input type="radio" name="plan-pick" value="yearly"> <span>' + naira(y) + " for 12 months</span></label>" +
        '<label style="display:flex;gap:8px;margin:8px 0;align-items:flex-start"><input type="checkbox" id="plan-ok"> <span class="muted">I agree SafeBuy NG may charge my card automatically each period until I cancel. I can cancel here at any time.</span></label>' +
        '<button type="button" class="button button-primary" id="plan-pay">Subscribe with card</button>';
    }
    html += '<p class="form-message" id="plan-msg" role="status" aria-live="polite"></p></div>';
    host.innerHTML = html;
    var say = function (t, bad) { var el = host.querySelector("#plan-msg"); el.textContent = t; el.style.color = bad ? "#b42318" : ""; };
    var cancel = host.querySelector("#plan-cancel");
    if (cancel) cancel.onclick = async function () {
      if (!window.confirm("Stop automatic renewal? Your badge stays until the date shown.")) return;
      try { var r = await window.safeBuySupabase.rpc("seller_cancel_renewal"); if (r.error) throw r.error; load(host); } catch (e) { say("Could not save. Try again.", true); }
    };
    var pay = host.querySelector("#plan-pay");
    if (pay) pay.onclick = async function () {
      if (!host.querySelector("#plan-ok").checked) { say("Please tick the box to agree to automatic renewal.", true); return; }
      if (!PAY_URL) { say("Card payment is opening soon. Your shop stays listed for free in the meantime.", false); return; }
      var plan = host.querySelector('input[name="plan-pick"]:checked').value; pay.disabled = true; say("Opening secure payment…");
      try {
        var ses = await window.safeBuySupabase.auth.getSession(), tok = ses.data.session.access_token;
        var r = await fetch(PAY_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "init", plan: plan, back: location.href.split("#")[0] }) });
        var j = await r.json(); if (!r.ok || !j.url) throw new Error(j.error || "failed"); location.href = j.url;
      } catch (e) { pay.disabled = false; say("Could not start payment. Please try again.", true); }
    };
  }
  async function load(host) {
    var c = window.safeBuySupabase; if (!c || !c.rpc || busy) return; busy = true;
    try { var r = await c.rpc("seller_subscription"); if (!r.error && r.data) draw(host, r.data); else host.innerHTML = ""; }
    catch (e) { host.innerHTML = ""; } busy = false;
  }
  function inject() {
    if (document.getElementById("plan-host") || !body.querySelector(".status-pill") || !body.querySelector("#product-form")) return;
    var host = document.createElement("div"); host.id = "plan-host";
    body.querySelector("#product-form").parentNode.insertBefore(host, body.querySelector("#product-form"));
    load(host);
  }
  new MutationObserver(inject).observe(body, { childList: true });
  inject();
})();
