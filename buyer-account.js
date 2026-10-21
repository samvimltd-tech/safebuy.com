/* SafeBuy NG: buyer account flow. Load after the main inline script. */
(function () {
  "use strict";

  var client = window.safeBuySupabase || null;
  var accountBtn = document.querySelector('.header-actions [data-action="account"]');
  var title = document.getElementById("account-title");
  var submit = document.getElementById("account-submit");
  var toggle = document.getElementById("account-toggle");
  if (!accountBtn || !title || !submit || !toggle) return;

  /* Mobile: keep the header tidy (buyers use the Sign in modal there). */
  var style = document.createElement("style");
  style.textContent = "@media (max-width:650px){.header-actions .buyer-header{display:none}}";
  document.head.appendChild(style);

  /* Header button: opens the account modal on the sign-up form. */
  var buyerBtn = document.createElement("button");
  buyerBtn.type = "button";
  buyerBtn.className = "button button-light buyer-header";
  buyerBtn.textContent = "Create buyer account";
  accountBtn.insertAdjacentElement("afterend", buyerBtn);

  buyerBtn.addEventListener("click", function () {
    accountBtn.click(); // opens the modal in the page's own handler
    if (/sign up/i.test(toggle.textContent)) toggle.click(); // switch to sign-up mode
  });

  /* Keep wording in sync whenever the page switches between sign in and sign up. */
  function syncWording() {
    var signup = /^create/i.test(submit.textContent);
    if (submit.textContent === "Create account") submit.textContent = "Create buyer account";
    title.textContent = signup ? "Create your buyer account" : "Welcome to SafeBuy NG";
  }
  new MutationObserver(syncWording).observe(submit, { childList: true, characterData: true, subtree: true });

  /* Signed-in state: greet by first name, tag the account as a buyer. */
  function refresh(user) {
    var name = user && user.user_metadata && user.user_metadata.full_name;
    accountBtn.textContent = user ? "Hi, " + (name ? String(name).trim().split(" ")[0] : "account") : "Sign in";
    buyerBtn.hidden = !!user;
  }

  function tagBuyer(user) {
    if (!client || !user || (user.user_metadata && user.user_metadata.account_type)) return;
    // Deferred: calling Supabase inside its own auth callback can stall.
    setTimeout(function () {
      client.auth.updateUser({ data: { account_type: "buyer" } }).catch(function () {});
    }, 0);
  }

  if (client) {
    client.auth.getSession().then(function (r) {
      var user = r.data && r.data.session ? r.data.session.user : null;
      refresh(user);
      tagBuyer(user);
    });
    client.auth.onAuthStateChange(function (_event, session) {
      var user = session ? session.user : null;
      refresh(user);
      tagBuyer(user);
    });
  }
})();
