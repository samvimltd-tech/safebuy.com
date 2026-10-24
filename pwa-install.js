/* SafeBuy NG - pwa-install.js
   Always-visible "Install app" button for Android and iOS.
   - Android/Chrome/Edge/Samsung: one-tap native install prompt.
   - iOS (Safari/Chrome): step-by-step "Add to Home Screen" sheet (iOS has no install API).
   - Hidden automatically once the app is installed / opened from the home screen.
   Add before </body> on every page:  <script src="./pwa-install.js"></script> */
(function () {
  "use strict";
  if (window.__sbPwaInstall) return;
  window.__sbPwaInstall = true;

  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  if (!isIOS && !isAndroid) return; // phones/tablets only

  function isInstalled() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true ||
      localStorageGet("sb-installed") === "1";
  }
  function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  if (isInstalled()) return;

  /* ---- iOS / PWA meta tags (added only if missing) ---- */
  function meta(name, content) {
    if (document.querySelector('meta[name="' + name + '"]')) return;
    var m = document.createElement("meta");
    m.name = name; m.content = content;
    document.head.appendChild(m);
  }
  meta("apple-mobile-web-app-capable", "yes");
  meta("apple-mobile-web-app-status-bar-style", "default");
  meta("apple-mobile-web-app-title", "SafeBuy NG");
  meta("mobile-web-app-capable", "yes");
  if (!document.querySelector('link[rel="manifest"]')) {
    var l = document.createElement("link");
    l.rel = "manifest"; l.href = "./manifest.webmanifest";
    document.head.appendChild(l);
  }

  /* ---- Capture the native Android prompt ---- */
  var deferred = window.deferredPrompt || null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    window.deferredPrompt = e;
    refreshLabel();
  });
  window.addEventListener("appinstalled", function () {
    localStorageSet("sb-installed", "1");
    deferred = null;
    removeUI();
  });

  /* ---- UI ---- */
  var css =
    ".sb-install{position:fixed;right:14px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:30;display:inline-flex;align-items:center;gap:8px;" +
    "padding:12px 16px;border:0;border-radius:30px;background:#087f5b;color:#fff;font:700 14px Arial,Helvetica,sans-serif;" +
    "box-shadow:0 8px 24px rgba(8,127,91,.38);cursor:pointer;-webkit-tap-highlight-color:transparent;animation:sbPulse 2.4s ease-in-out 3}" +
    ".sb-install:active{transform:scale(.97)}" +
    "@media (min-width:651px){.sb-install{bottom:24px}}" +
    "@keyframes sbPulse{0%,100%{box-shadow:0 8px 24px rgba(8,127,91,.38)}50%{box-shadow:0 8px 30px rgba(8,127,91,.7),0 0 0 8px rgba(8,127,91,.15)}}" +
    ".sb-ins-back{position:fixed;inset:0;z-index:70;display:none;align-items:flex-end;justify-content:center;background:rgba(16,39,29,.8)}" +
    ".sb-ins-back.open{display:flex;animation:sbIFade .2s ease-out}" +
    ".sb-ins{width:min(480px,100%);max-height:88vh;overflow-y:auto;padding:10px 22px calc(24px + env(safe-area-inset-bottom));background:#fff;color:#172b24;" +
    "border-radius:22px 22px 0 0;font-family:Arial,Helvetica,sans-serif;animation:sbIUp .28s cubic-bezier(.2,.8,.2,1)}" +
    ".sb-ins-grab{width:42px;height:5px;margin:0 auto 14px;border-radius:5px;background:#cfd8d2}" +
    ".sb-ins-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}" +
    ".sb-ins-logo{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#087f5b;color:#fff;font-size:26px;font-weight:800;flex-shrink:0}" +
    ".sb-ins h2{margin:0;font-size:20px}" +
    ".sb-ins p{margin:6px 0 0;color:#718078;font-size:14px;line-height:1.6}" +
    ".sb-ins ol{margin:14px 0 4px;padding:0;list-style:none;counter-reset:s}" +
    ".sb-ins li{counter-increment:s;position:relative;padding:12px 0 12px 42px;border-top:1px solid #e6ece8;font-size:14px;line-height:1.5}" +
    ".sb-ins li::before{content:counter(s);position:absolute;left:0;top:11px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e7f7ef;color:#066548;font-weight:800;font-size:13px}" +
    ".sb-ins b{color:#087f5b}" +
    ".sb-ins-btn{display:flex;width:100%;align-items:center;justify-content:center;margin-top:14px;padding:14px;border:0;border-radius:12px;font:700 15px Arial,Helvetica,sans-serif;cursor:pointer}" +
    ".sb-ins-primary{background:#087f5b;color:#fff}" +
    ".sb-ins-ghost{background:#fff;border:1px solid #e6ece8;color:#172b24}" +
    "@keyframes sbIUp{from{transform:translateY(100%)}to{transform:translateY(0)}}" +
    "@keyframes sbIFade{from{opacity:0}to{opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){.sb-install,.sb-ins,.sb-ins-back.open{animation:none}}";

  var styleEl, btn, back;

  function build() {
    styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sb-install";
    btn.setAttribute("aria-label", "Install SafeBuy NG app");
    btn.innerHTML = '<span aria-hidden="true">⬇</span><span class="sb-lbl">Install app</span>';
    btn.addEventListener("click", onInstallClick);
    document.body.appendChild(btn);

    back = document.createElement("div");
    back.className = "sb-ins-back";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-label", "Install SafeBuy NG");
    back.addEventListener("click", function (e) { if (e.target === back) closeSheet(); });
    document.body.appendChild(back);

    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  }

  function removeUI() {
    if (btn) btn.remove();
    if (back) back.remove();
    if (styleEl) styleEl.remove();
  }

  function refreshLabel() {
    if (!btn) return;
    btn.querySelector(".sb-lbl").textContent = "Install app";
  }

  function closeSheet() { if (back) back.classList.remove("open"); }

  function openSheet(html) {
    back.innerHTML =
      '<div class="sb-ins"><div class="sb-ins-grab"></div>' +
      '<div class="sb-ins-head"><div class="sb-ins-logo">S</div><div><h2>Install SafeBuy NG</h2></div></div>' +
      html +
      '<button type="button" class="sb-ins-btn sb-ins-ghost" id="sb-ins-close">Close</button></div>';
    back.classList.add("open");
    document.getElementById("sb-ins-close").addEventListener("click", closeSheet);
  }

  function iosSteps() {
    var chromeIOS = /CriOS|FxiOS|EdgiOS/.test(ua);
    return '<p>Add SafeBuy NG to your home screen to open it like an app, full screen.</p><ol>' +
      '<li>Tap the <b>Share</b> button ' + (chromeIOS ? "in the browser toolbar (⋯ or the share icon)" : "at the bottom of Safari (the square with an arrow ⬆︎)") + '.</li>' +
      '<li>Scroll down and tap <b>Add to Home Screen</b>.</li>' +
      '<li>Tap <b>Add</b> in the top-right corner.</li></ol>' +
      (chromeIOS ? '<p>If you don\'t see it, open this page in <b>Safari</b> and try again.</p>' : "");
  }

  function androidSteps() {
    return '<p>Add SafeBuy NG to your home screen to open it like an app.</p><ol>' +
      '<li>Tap the browser menu <b>⋮</b> (top-right).</li>' +
      '<li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>' +
      '<li>Confirm by tapping <b>Install</b>.</li></ol>' +
      '<p>If you don\'t see it, open this page in <b>Chrome</b>.</p>';
  }

  function onInstallClick() {
    if (deferred && !isIOS) {
      deferred.prompt();
      deferred.userChoice.then(function (choice) {
        if (choice && choice.outcome === "accepted") {
          localStorageSet("sb-installed", "1");
          removeUI();
        }
        deferred = null;
        window.deferredPrompt = null;
      }).catch(function () {});
      return;
    }
    openSheet(isIOS ? iosSteps() : androidSteps());
  }

  /* Auto-open the iOS guide once per session so people notice it */
  function maybeAutoOpen() {
    var key = "sb-ins-seen";
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
    setTimeout(function () {
      if (!document.querySelector(".modal-backdrop.open")) onInstallClick();
    }, 4000);
  }

  function start() {
    build();
    if (isIOS) maybeAutoOpen();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);

  /* Register the service worker if nothing else on the page has */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) navigator.serviceWorker.register("./sw.js").catch(function () {});
    }).catch(function () {});
  }
})();
