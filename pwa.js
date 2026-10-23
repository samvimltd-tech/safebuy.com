(function () {
  "use strict";
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  try { if (localStorage.getItem("sb-install-dismissed")) return; } catch (e) {}
  var deferred = null, ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function banner(text, actionLabel, onAction) {
    var el = document.createElement("div");
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:84px;z-index:70;background:#173b2c;color:#fff;border-radius:16px;padding:14px;display:flex;gap:10px;align-items:center;font:14px/1.4 Arial,sans-serif;box-shadow:0 8px 30px #0003;max-width:460px;margin:auto";
    el.innerHTML = '<span style="font-size:26px">📲</span><span style="flex:1"></span>';
    el.children[1].textContent = text;
    function btn(label, bg, fn) { var b = document.createElement("button"); b.textContent = label; b.style.cssText = "border:0;border-radius:10px;padding:9px 12px;font-weight:700;background:" + bg + ";color:#145338;cursor:pointer"; b.onclick = fn; el.appendChild(b); }
    if (actionLabel) btn(actionLabel, "#d8f5e3", function () { onAction(); el.remove(); });
    btn("✕", "transparent", function () { el.remove(); try { localStorage.setItem("sb-install-dismissed", "1"); } catch (e) {} });
    el.lastChild.style.color = "#fff";
    document.body.appendChild(el);
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    setTimeout(function () { banner("Install SafeBuy NG for faster shopping.", "Install", function () { deferred.prompt(); }); }, 8000);
  });
  if (ios) setTimeout(function () { banner("To install: tap Share, then “Add to Home Screen”."); }, 8000);
})();
