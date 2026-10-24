(function () {
  "use strict";

  /* ===== EDIT THESE: where sellers send the N5,000 ===== */
  var BANK = { bank: "YOUR BANK NAME", number: "0000000000", name: "SAFEBUY NG" };
  var PRICE = "₦5,000";
  var PERIOD = "12 months";
  /* ===================================================== */

  var client = window.safeBuySupabase;
  var body = document.getElementById("seller-body");
  if (!client || !body) return;

  var busy = false, again = false;

  var css = document.createElement("style");
  css.textContent =
    ".vf-box{margin:14px 0;padding:16px;border:1px solid #bfe6d1;border-radius:16px;background:#f2fbf6}" +
    ".vf-box h3{margin:0 0 6px!important}" +
    ".vf-box p{margin:6px 0;font-size:13px}" +
    ".vf-box .vf-bank{padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #e6ece8;font-size:13px;line-height:1.7}" +
    ".vf-badge{display:inline-block;padding:6px 12px;border-radius:30px;background:#087f5b;color:#fff;font-weight:800;font-size:13px}" +
    ".vf-box .vf-err{color:#8a1f1f}";
  document.head.appendChild(css);

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(d) {
    return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }

  function formHtml(intro) {
    return (
      (intro || "") +
      "<p>Verified shops show a green badge, so shoppers trust them more. Cost: <strong>" + PRICE + "</strong> for " + PERIOD + ".</p>" +
      '<p class="vf-bank"><strong>1. Pay ' + PRICE + " by bank transfer</strong><br>" +
      esc(BANK.bank) + " · " + esc(BANK.number) + "<br>Account name: " + esc(BANK.name) + "</p>" +
      "<p><strong>2. Send your business number and payment reference</strong></p>" +
      '<form id="vf-form">' +
      '<label for="vf-type">Number type</label>' +
      '<select id="vf-type"><option value="RC">RC number (business registration)</option><option value="TIN">Tax Identification Number (TIN)</option></select>' +
      '<label for="vf-num">Your RC number or TIN</label><input id="vf-num" type="text" required maxlength="25" autocomplete="off">' +
      '<label for="vf-ref">Payment reference / transfer ID</label><input id="vf-ref" type="text" required maxlength="60" autocomplete="off">' +
      '<button class="button button-primary" type="submit" id="vf-btn">Submit for verification</button>' +
      '<p class="form-message vf-err" id="vf-msg" role="status" aria-live="polite"></p>' +
      "</form>"
    );
  }

  function view(app, req) {
    var verified = app.verification_status === "approved";
    var until = app.verified_until ? new Date(app.verified_until) : null;
    var soon = until && until - Date.now() < 30 * 86400000;

    if (req && (req.status === "submitted" || req.status === "paid")) {
      return "<h3>Get verified</h3>" +
        '<p><span class="vf-badge">' + (req.status === "paid" ? "Payment confirmed · under review" : "Waiting for payment check") + "</span></p>" +
        "<p>" + esc(req.id_type) + ": " + esc(req.id_number) + "<br>Payment reference: " + esc(req.payment_reference) + "</p>" +
        '<p class="muted">We confirm your payment, check your number, then issue your badge number.</p>';
    }
    if (verified) {
      var head = "<h3>Verified badge</h3><p><span class=\"vf-badge\">✓ " + esc(app.badge_number || "Verified") + "</span></p>" +
        (until ? '<p class="muted">Valid until ' + esc(fmt(until)) + "</p>" : "");
      return soon ? head + formHtml("<p><strong>Renew your badge</strong></p>") : head;
    }
    var note = "";
    if (req && req.status === "rejected") {
      note = '<p class="vf-err"><strong>Your last request was rejected.</strong>' + (req.admin_note ? " Reason: " + esc(req.admin_note) : "") + "</p>";
    } else if (req && req.status === "expired") {
      note = "<p><strong>Your badge expired.</strong> Renew to show it again.</p>";
    }
    return "<h3>Get verified</h3>" + formHtml(note);
  }

  function wire(box) {
    var form = box.querySelector("#vf-form");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = box.querySelector("#vf-msg");
      var btn = box.querySelector("#vf-btn");
      var type = box.querySelector("#vf-type").value;
      var num = box.querySelector("#vf-num").value.replace(/\s+/g, "").toUpperCase();
      var ref = box.querySelector("#vf-ref").value.trim();

      var ok = type === "RC" ? /^(RC|BN|IT)?[0-9]{5,8}$/.test(num) : /^[0-9-]{8,15}$/.test(num);
      if (!ok) { msg.textContent = type === "RC" ? "Check your RC number, for example RC1234567." : "Check your TIN. Use digits only."; return; }
      if (ref.length < 4) { msg.textContent = "Enter your payment reference."; return; }

      btn.disabled = true;
      msg.textContent = "Submitting…";
      var u = await client.auth.getUser();
      var a = await client.from("seller_applications").select("id").eq("user_id", u.data.user.id).maybeSingle();
      if (a.error || !a.data) { msg.textContent = "Could not find your shop."; btn.disabled = false; return; }

      var r = await client.from("verification_requests").insert({
        seller_application_id: a.data.id, id_type: type, id_number: num, payment_reference: ref
      });
      if (r.error) {
        msg.textContent = r.error.code === "23505"
          ? "That payment reference was already used, or you already have a request open."
          : "Could not submit: " + r.error.message;
        btn.disabled = false;
        return;
      }
      box.remove();
      inject();
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
      if (a.error || !a.data || a.data.verification_status === "rejected") return; // suspended shops see nothing
      var r = await client.from("verification_requests").select("*")
        .eq("seller_application_id", a.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

      var anchor = document.getElementById("pf-heading");
      if (!anchor || document.getElementById("vf-box")) return;
      var box = document.createElement("div");
      box.id = "vf-box";
      box.className = "vf-box";
      box.innerHTML = view(a.data, r.data || null);
      anchor.parentNode.insertBefore(box, anchor);
      wire(box);
    } finally {
      busy = false;
      if (again) { again = false; inject(); }
    }
  }

  new MutationObserver(function () { inject(); }).observe(body, { childList: true });
})();
