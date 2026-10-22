(function () {
  "use strict";
  var client = window.safeBuySupabase;
  if (!client) return;

  var btn = null;
  var sellerId = null;

  var style = document.createElement("style");
  style.textContent =
    ".bell-button{background:#087f5b;color:#fff;border:0;border-radius:12px;padding:10px 13px;font-weight:700;font-size:13px;white-space:nowrap;cursor:pointer}" +
    ".bell-button:hover{background:#066548}";
  document.head.appendChild(style);

  function show(count) {
    var row = document.querySelector(".header-actions");
    if (!row) return;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bell-button";
      btn.addEventListener("click", function () {
        var sell = document.querySelector('[data-action="sell"]');
        if (sell) sell.click();
      });
      row.insertBefore(btn, row.firstChild);
    }
    btn.textContent = "🔔 New orders (" + count + ")";
    btn.hidden = false;
  }

  function hide() {
    if (btn) btn.hidden = true;
  }

  async function findSeller() {
    var u = await client.auth.getUser();
    var user = u.data && u.data.user;
    if (!user) { sellerId = null; return; }
    var r = await client.from("seller_applications").select("id").eq("user_id", user.id).maybeSingle();
    sellerId = r.data ? r.data.id : null;
  }

  async function check() {
    try {
      if (!sellerId) await findSeller();
      if (!sellerId) { hide(); return; }
      var r = await client.from("marketplace_orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_application_id", sellerId)
        .eq("status", "new");
      if (r.error) { hide(); return; }
      if (r.count > 0) show(r.count); else hide();
    } catch (e) {
      hide();
    }
  }

  client.auth.onAuthStateChange(function () {
    sellerId = null;
    setTimeout(check, 300);
  });

  check();
  setInterval(check, 60000);
})();
