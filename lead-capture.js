(function () {
  "use strict";
  var client = window.safeBuySupabase;
  var footer = document.querySelector("footer");
  if (!client || !footer || document.getElementById("lead-section")) return;

  var css = document.createElement("style");
  css.textContent =
    "#lead-section .lead-card{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:clamp(22px,4vw,36px);" +
    "border:1px solid #e6ece8;border-radius:22px;background:#fff}" +
    "#lead-section h2{margin:0 0 8px;font-size:clamp(22px,4vw,28px)}" +
    "#lead-section p{margin:0;color:#718078;font-size:14px;line-height:1.7}" +
    "#lead-section label{display:block;margin:0 0 5px;font-size:13px;font-weight:700}" +
    "#lead-section input[type=email],#lead-section input[type=tel]{width:100%;padding:12px 13px;border:1px solid #dce5de;border-radius:12px;margin-bottom:12px}" +
    "#lead-section .lead-check{display:flex;gap:9px;align-items:flex-start;font-weight:400;font-size:13px;margin:4px 0 12px}" +
    "#lead-section .lead-check input{margin-top:3px}" +
    "#lead-section .lead-hp{position:absolute;left:-9999px;height:0;overflow:hidden}" +
    "#lead-msg{min-height:20px;margin-top:10px!important;font-size:13px!important}" +
    "@media(max-width:650px){#lead-section .lead-card{grid-template-columns:1fr}}";
  document.head.appendChild(css);

  var section = document.createElement("section");
  section.className = "section";
  section.id = "lead-section";
  section.innerHTML =
    '<div class="container"><div class="lead-card">' +
    "<div><h2>Get new deals first</h2><p>Leave your email or phone number and we will tell you when new products and offers go live. Give one or both.</p></div>" +
    '<form id="lead-form" novalidate>' +
    '<label for="lead-email">Email address</label><input id="lead-email" type="email" autocomplete="email" placeholder="you@example.com">' +
    '<label for="lead-phone">Phone number</label><input id="lead-phone" type="tel" autocomplete="tel" placeholder="08012345678">' +
    '<div class="lead-hp" aria-hidden="true"><input id="lead-hp" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<label class="lead-check"><input id="lead-consent" type="checkbox"> I agree that SafeBuy NG may contact me with updates and offers.</label>' +
    '<button class="button button-primary" type="submit" id="lead-btn">Notify me</button>' +
    '<p id="lead-msg" role="status" aria-live="polite"></p></form></div></div>';
  footer.parentNode.insertBefore(section, footer);

  var msg = document.getElementById("lead-msg");
  function say(t, bad) { msg.textContent = t; msg.style.color = bad ? "#8a1f1f" : "#087f5b"; }

  function normPhone(v) {
    var d = String(v || "").replace(/[^\d+]/g, "");
    if (!d) return "";
    if (d.charAt(0) === "+") return "+" + d.slice(1).replace(/\D/g, "");
    d = d.replace(/\D/g, "");
    if (d.indexOf("234") === 0) return "+" + d;
    if (d.charAt(0) === "0" && d.length === 11) return "+234" + d.slice(1);
    if (d.length === 10) return "+234" + d;
    return "+" + d;
  }

  document.getElementById("lead-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("lead-email").value.trim().toLowerCase();
    var phone = normPhone(document.getElementById("lead-phone").value);
    var btn = document.getElementById("lead-btn");

    if (!email && !phone) { say("Enter an email address or a phone number.", true); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("That email address does not look right.", true); return; }
    if (phone && !/^\+\d{10,15}$/.test(phone)) { say("Check your phone number, for example 08012345678.", true); return; }
    if (!document.getElementById("lead-consent").checked) { say("Please tick the box to agree.", true); return; }

    if (document.getElementById("lead-hp").value) { say("Thank you! We will be in touch."); return; } // bot

    btn.disabled = true;
    say("Saving…");
    var r = await client.from("leads").insert({ email: email || null, phone: phone || null, source: "website" });
    btn.disabled = false;

    if (r.error && r.error.code !== "23505") { say("We could not save that. Please try again.", true); return; }
    document.getElementById("lead-form").reset();
    say(r.error ? "You are already on the list. Thank you!" : "Thank you! We will be in touch.");
  });
})();
