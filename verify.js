(function () {
  "use strict";

  var PRICE = "₦2,000";

  var client = window.safeBuySupabase;
  var cfg = window.SAFEbuySupabaseConfig;
  var body = document.getElementById("seller-body");
  if (!client || !cfg || !body) return;

  var FN = String(cfg.url).replace(/\/+$/, "") + "/functions/v1/";
  var busy = false, again = false;

  var css = document.createElement("style");
  css.textContent =
    ".vf-box{margin:14px 0;padding:16px;border:1px solid #bfe6d1;border-radius:16px;background:#f2fbf6}" +
    ".vf-box h3{margin:0 0 6px!important}" +
    ".vf-box p{margin:6px 0;font-size:13px}" +
    ".vf-badge{display:inline-block;padding:6px 12px;border-radius:30px;background:#087f5b;color:#fff;font-weight:800;font-size:13px}" +
    ".vf-badge.warn{background:#b26a00}" +
    ".vf-box .vf-err{color:#8a1f1f}" +
    ".vf-box .vf-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}" +
    ".vf-box .vf-row .button{width:auto;margin:0}";
  document.head.appendChild(css);

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(d) {
    return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }
  function toast(t) { if (typeof window.showToast === "function") window.showToast(t); }

  async function callFn(name) {
    var s = await client.auth.getSession();
    var token = s.data && s.data.session ? s.data.session.access_token : "";
    try {
      var res = await fetch(FN + name, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: cfg.publishableKey },
        body: "{}"
      });
      var j = await res.json().catch(function () { return {}; });
      return res.ok && j.url ? { ok: true, url: j.url } : { ok: false, error: j.error || "Something went wrong (" + res.status + ")." };
    } catch (e) {
      return { ok: false, error: "Could not reach the payment service. Try again." };
    }
  }

  var SAFE = '<p class="muted">You add your card on Paystack’s secure page. SafeBuy NG never sees or stores your card details.</p>';

  function subscribeBtn(label) {
    return '<div class="vf-row"><button class="button button-primary" type="button" data-vf="subscribe">' + label + "</button></div>" + SAFE;
  }

  function formHtml(intro) {
    return (
      (intro || "") +
      "<p>Verified shops show a green badge and a badge number, so shoppers trust them more. " +
      "Step 1: send your RC number or TIN. Step 2: once we approve it, subscribe for <strong>" + PRICE + " per month</strong>, charged automatically to your card.</p>" +
      '<form id="vf-form">' +
      '<label for="vf-type">Number type</label>' +
      '<select id="vf-type"><option value="RC">RC number (business registration)</option><option value="TIN">Tax Identification Number (TIN)</option></select>' +
      '<label for="vf-num">Your RC number or TIN</label><input id="vf-num" type="text" required maxlength="25" autocomplete="off">' +
      '<button class="button button-primary" type="submit" id="vf-btn">Submit for checking</button>' +
      '<p class="form-message vf-err" id="vf-msg" role="status" aria-live="polite"></p>' +
      "</form>"
    );
  }

  function view(app, req, sub) {
    var until = app.verified_until ? new Date(app.verified_until) : null;
    var verified = app.verification_status === "approved" && app.badge_number && until && until > new Date();

    if (verified) {
      var html = '<h3>Verified badge</h3><p><span class="vf-badge">✓ ' + esc(app.badge_number) + "</span></p>";
      var st = sub ? sub.status : "";
      if (st === "past_due") {
        html += '<p class="vf-err"><strong>Your last payment failed.</strong> Update your card to keep the badge. It stays until ' + esc(fmt(until)) + ".</p>" +
          '<div class="vf-row"><button class="button button-primary" type="button" data-vf="card">Update card</button></div>';
      } else if (st === "cancelling" || st === "canceled") {
        html += '<p class="muted">Auto-renewal is off. Your badge stays until ' + esc(fmt(until)) + ".</p>" +
          subscribeBtn("Turn auto-renewal back on (" + PRICE + "/month)");
      } else {
        html += '<p class="muted">Renews automatically every month · ' + PRICE + "/month · badge valid until " + esc(fmt(until)) + "</p>" +
          '<div class="vf-row"><button class="button button-outline" type="button" data-vf="card">Update card or cancel</button></div>';
      }
      return html;
    }

    if (req && req.status === "docs_approved") {
      return "<h3>Get verified</h3>" +
        '<p><span class="vf-badge">✓ ' + esc(req.id_type) + " number approved</span></p>" +
        "<p>Subscribe for <strong>" + PRICE + " per month</strong>. Your badge number appears as soon as the first payment goes through.</p>" +
        subscribeBtn("Subscribe " + PRICE + "/month");
    }
    if (req && (req.status === "submitted" || req.status === "paid")) {
      return "<h3>Get verified</h3>" +
        '<p><span class="vf-badge warn">Under review</span></p>' +
        "<p>" + esc(req.id_type) + ": " + esc(req.id_number) + "</p>" +
        '<p class="muted">We are checking your number. When it is approved, a Subscribe button appears here.</p>';
    }
    if (req && (req.status === "approved" || req.status === "expired")) {
      return "<h3>Get verified</h3>" +
        "<p><strong>Your badge is not active.</strong> Your number is already approved. Subscribe to switch the badge back on.</p>" +
        subscribeBtn("Subscribe " + PRICE + "/month");
    }
    var note = "";
    if (req && req.status === "rejected") {
      note = '<p class="vf-err"><strong>Your last request was rejected.</strong>' + (req.admin_note ? " Reason: " + esc(req.admin_note) : "") + "</p>";
    }
    return "<h3>Get verified</h3>" + formHtml(note);
  }

  function wire(box) {
    var form = box.querySelector("#vf-form");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var msg = box.querySelector("#vf-msg");
        var btn = box.querySelector("#vf-btn");
        var type = box.querySelector("#vf-type").value;
        var num = box.querySelector("#vf-num").value.replace(/\s+/g, "").toUpperCase();
        var ok = type === "RC" ? /^(RC|BN|IT)?[0-9]{5,8}$/.test(num) : /^[0-9-]{8,15}$/.test(num);
        if (!ok) { msg.textContent = type === "RC" ? "Check your RC number, for example RC1234567." : "Check your TIN. Use digits only."; return; }

        btn.disabled = true;
        msg.textContent = "Saving…";
        var u = await client.auth.getUser();
        var a = await client.from("seller_applications").select("id").eq("user_id", u.data.user.id).maybeSingle();
        if (a.error || !a.data) { msg.textContent = "Could not find your shop."; btn.disabled = false; return; }

        var r = await client.from("verification_requests")
          .insert({ seller_application_id: a.data.id, id_type: type, id_number: num });
        if (r.error) {
          msg.textContent = r.error.code === "23505"
            ? "You already have a request open, or this number is already in use."
            : "Could not save: " + r.error.message;
          btn.disabled = false;
          return;
        }
        toast("Submitted. We will check your number.");
        box.remove();
        inject();
      });
    }

    box.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-vf]");
      if (!b) return;
      b.disabled = true;
      var fn = b.dataset.vf === "subscribe" ? "paystack-checkout" : "paystack-manage";
      toast(b.dataset.vf === "subscribe" ? "Opening secure payment…" : "Opening card settings…");
      var r = await callFn(fn);
      if (r.ok) { window.location.href = r.url; return; }
      toast(r.error);
      b.disabled = false;
    });
  }

  async function inject() {
    if (busy) { again = true; return; }
    if (!document.getElementById("pf-heading") || document.getElementById("vf-box")) return;
    busy = true;
    try {
      var u = await client.auth.getUser();
      var user = u.data && u.data.user;
      if (!user) return;
      var a = await client.from("seller_applications")
        .select("id,verification_status,badge_number,verified_until").eq("user_id", user.id).maybeSingle();
      if (a.error || !a.data || a.data.verification_status === "rejected") return;

      var results = await Promise.all([
        client.from("verification_requests").select("*")
          .eq("seller_application_id", a.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        client.from("my_subscription").select("status,paid_through,current_period_end").maybeSingle()
      ]);

      var anchor = document.getElementById("pf-heading");
      if (!anchor || document.getElementById("vf-box")) return;
      var box = document.createElement("div");
      box.id = "vf-box";
      box.className = "vf-box";
      box.innerHTML = view(a.data, results[0].data || null, results[1].error ? null : results[1].data || null);
      anchor.parentNode.insertBefore(box, anchor);
      wire(box);
    } finally {
      busy = false;
      if (again) { again = false; inject(); }
    }
  }

  new MutationObserver(function () { inject(); }).observe(body, { childList: true });

  // Back from Paystack (it adds ?reference=… to the return address)
  try {
    var q = new URLSearchParams(location.search);
    if ((q.get("reference") || q.get("trxref")) && !q.get("delivery")) {
      setTimeout(function () { toast("Payment received. Your badge turns on within a minute."); }, 600);
      history.replaceState(null, "", location.pathname + location.hash);
    }
  } catch (e) {}
})();
