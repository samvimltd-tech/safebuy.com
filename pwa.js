(function () {
  "use strict";
  // Manifest + icon injected here, so index.html only needs this one script.
  if (!document.querySelector('link[rel="manifest"]')) {
    var m = document.createElement("link"); m.rel = "manifest"; m.href = "./manifest.webmanifest"; document.head.appendChild(m);
    var a = document.createElement("link"); a.rel = "apple-touch-icon"; a.href = "./icons/icon-192.png"; document.head.appendChild(a);
  }
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });

  // Preview: add ?iosdemo=1 to the site address to see the iPhone banner on any device.
  var demo = /[?&]iosdemo/.test(location.search);
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone && !demo) return;                          // already running as the installed app
  try { if (localStorage.getItem("sb-installed") && !demo) return; } catch (e) {}

  var deferred = null, bar = null;
  var ios = demo || /iphone|ipad|ipod/i.test(navigator.userAgent);

  function remove() { if (bar) { bar.remove(); bar = null; } }

  function show() {
    if (bar || !document.body) return;
    bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:84px;z-index:70;background:#173b2c;color:#fff;border-radius:16px;padding:14px;display:flex;gap:10px;align-items:center;font:14px/1.4 Arial,sans-serif;box-shadow:0 8px 30px #0004;max-width:460px;margin:auto";
    var icon = document.createElement("span"); icon.textContent = "📲"; icon.style.fontSize = "26px";
    var text = document.createElement("span"); text.style.flex = "1";
    text.textContent = (deferred && !demo) ? "Install SafeBuy NG for faster shopping." :
      ios ? "Install: tap Share, then “Add to Home Screen”." :
      "Install: tap your browser menu ⋮, then “Install app” or “Add to Home screen”.";
    bar.appendChild(icon); bar.appendChild(text);
    if (deferred && !demo) {
      var b = document.createElement("button"); b.textContent = "Install";
      b.style.cssText = "border:0;border-radius:10px;padding:10px 14px;font-weight:700;background:#d8f5e3;color:#145338;cursor:pointer";
      b.onclick = function () {
        deferred.prompt();
        deferred.userChoice.then(function (c) { if (c.outcome === "accepted") remove(); deferred = null; });
      };
      bar.appendChild(b);
    }
    var x = document.createElement("button"); x.textContent = "✕"; x.setAttribute("aria-label", "Hide for now");
    x.style.cssText = "border:0;background:transparent;color:#fff;font-size:16px;padding:6px;cursor:pointer";
    x.onclick = remove;                                      // hides for this visit only; returns on next load
    bar.appendChild(x);
    document.body.appendChild(bar);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e; remove(); show();
  });
  window.addEventListener("appinstalled", function () {
    try { localStorage.setItem("sb-installed", "1"); } catch (e) {}
    remove();
  });

  // Show on every visit until installed. If the browser gives no install event, show manual steps.
  setTimeout(show, 3000);
})();
