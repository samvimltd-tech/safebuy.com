(function () {
  "use strict";
  var deferred = null;
  var btn, tip;

  function installed() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  // Capture early so the event is never missed
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    show();
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    hide();
  });

  function build() {
    if (btn) return;
    var css = document.createElement("style");
    css.textContent =
      "#pwa-btn{position:fixed;right:14px;bottom:84px;z-index:30;border:0;border-radius:30px;padding:12px 18px;" +
      "background:#087f5b;color:#fff;font:700 14px Arial,sans-serif;box-shadow:0 8px 24px #0003;cursor:pointer}" +
      "#pwa-btn:hover{background:#066548}" +
      "#pwa-tip{position:fixed;left:14px;right:14px;bottom:140px;z-index:31;max-width:340px;margin-left:auto;" +
      "background:#fff;border:1px solid #e6ece8;border-radius:14px;padding:14px;font:13px/1.6 Arial,sans-serif;" +
      "color:#172b24;box-shadow:0 8px 30px #0003}" +
      "@media(min-width:651px){#pwa-btn{bottom:20px}#pwa-tip{bottom:76px}}";
    document.head.appendChild(css);

    btn = document.createElement("button");
    btn.id = "pwa-btn";
    btn.type = "button";
    btn.textContent = "⬇ Install app";
    btn.hidden = true;
    btn.addEventListener("click", onClick);
    document.body.appendChild(btn);

    tip = document.createElement("div");
    tip.id = "pwa-tip";
    tip.hidden = true;
    document.body.appendChild(tip);
  }

  function onClick() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        if (c.outcome === "accepted") hide();
        deferred = null; // a new event fires later if still installable
      });
      return;
    }
    tip.innerHTML = isIOS()
      ? "To install: tap the <strong>Share</strong> icon in Safari, then <strong>Add to Home Screen</strong>."
      : "To install: open your browser menu (⋮) and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.";
    tip.hidden = !tip.hidden;
  }

  function show() {
    build();
    if (installed()) return hide();
    btn.hidden = false;
  }
  function hide() {
    if (btn) btn.hidden = true;
    if (tip) tip.hidden = true;
  }

  function refresh() {
    if (installed()) return hide();
    // Show if the browser allows install, or on iOS / other browsers (manual steps)
    if (deferred || isIOS() || true) show();
  }

  function watchAuth() {
    var c = window.safeBuySupabase;
    if (!c) return false;
    c.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        if (tip) tip.hidden = true;
        refresh();
        setTimeout(refresh, 400); // after your goHome() re-render
      }
    });
    return true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    build();
    refresh();
    if (!watchAuth()) {
      var tries = 0, t = setInterval(function () {
        if (watchAuth() || ++tries > 20) clearInterval(t);
      }, 250);
    }
  });
})();
