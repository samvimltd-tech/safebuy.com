(function () {
  "use strict";
  var client = window.safeBuySupabase;
  var actions = document.querySelector(".header-actions");
  if (!client || !actions) return;

  var css = document.createElement("style");
  css.textContent =
    "#role-pill{padding:6px 11px;border-radius:30px;font-size:12px;font-weight:800;white-space:nowrap;background:#fff3e0;color:#7a4a05}" +
    "#role-pill.ok{background:#e7f7ef;color:#066548}" +
    "#role-pill.bad{background:#fdeaea;color:#8a1f1f}" +
    "#role-note{margin:0 0 12px;font-size:13px;color:#52645a}";
  document.head.appendChild(css);

  var pill = document.createElement("span");
  pill.id = "role-pill";
  pill.hidden = true;
  actions.insertBefore(pill, actions.firstChild);

  var note = document.createElement("p");
  note.id = "role-note";
  note.hidden = true;
  var top = document.querySelector("#account-backdrop .modal-top");
  if (top) top.parentNode.insertBefore(note, top.nextSibling);

  function set(text, cls, detail) {
    pill.hidden = !text;
    pill.textContent = text || "";
    pill.className = cls || "";
    note.hidden = !detail;
    note.textContent = detail || "";
  }

  async function refresh() {
    var s = await client.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) { set(""); return; }

    var r = await client.from("seller_applications")
      .select("shop_name,verification_status,badge_number,verified_until")
      .eq("user_id", user.id).maybeSingle();
    var a = !r.error ? r.data : null;
    if (!a) { set(""); return; }              // buyers: nothing to show

    var until = a.verified_until ? new Date(a.verified_until) : null;
    var verified = a.verification_status === "approved" && a.badge_number && until && until > new Date();

    if (a.verification_status === "rejected") {
      set("Suspended", "bad", a.shop_name + " is suspended.");
    } else if (verified) {
      set("✓ Verified", "ok",
        a.shop_name + ": verified seller. Badge number " + a.badge_number +
        ", valid until " + until.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) + ".");
    } else {
      set("No badge", "",
        a.shop_name + " has no verified badge yet. Open Start selling and tap Get verified to subscribe (₦5,000).");
    }
  }

  client.auth.onAuthStateChange(function () { setTimeout(refresh, 0); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  refresh();
})();
