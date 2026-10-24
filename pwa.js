/* SafeBuy NG: embedded install reminder for Android and iPhone.
   One script does everything: registers the app files, shows an install banner on every visit,
   keeps a small "Get the app" button on screen after the banner is closed, and shows step-by-step help
   (Android menu steps, iPhone Share steps, or "open in Safari/Chrome" for in-app browsers).
   Reminders stop once the app is installed. Preview the iPhone help with ?iosdemo=1 on the site address. */
(function () {
  "use strict";
  if (!document.querySelector('link[rel="manifest"]')) {
    var m = document.createElement("link"); m.rel = "manifest"; m.href = "./manifest.webmanifest"; document.head.appendChild(m);
    var a = document.createElement("link"); a.rel = "apple-touch-icon"; a.href = "./icons/icon-192.png"; document.head.appendChild(a);
  }
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });

  var ua = navigator.userAgent, demo = /[?&]iosdemo/.test(location.search);
  var ios = demo || /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var inApp = /FBAN|FBAV|Instagram|WhatsApp|musical_ly|TikTok|Snapchat|Twitter|Line\/|MicroMessenger/i.test(ua);
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone && !demo) return;
  try { if (localStorage.getItem("sb-installed") && !demo) return; } catch (e) {}

  var deferred = null, bar = null, pill = null, sheet = null;
  var G = "#087f5b", O = "#f97316";
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function drop(e) { if (e && e.parentNode) e.parentNode.removeChild(e); }
  function removeAll() { drop(bar); drop(pill); drop(sheet); bar = pill = sheet = null; }

  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c.outcome === "accepted") removeAll(); deferred = null; });
    } else openSheet();
  }

  /* ---- step-by-step help ---- */
  var SHARE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + G + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9"/></svg>';
  function steps(list) {
    return '<ol style="list-style:none;margin:12px 0 0;padding:0">' + list.map(function (s, i) {
      return '<li style="display:flex;gap:12px;align-items:flex-start;padding:9px 0;font-size:15px;line-height:1.5;color:#3f544a"><span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#fb923c,' + O + ');color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center">' + (i + 1) + "</span><span>" + s + "</span></li>";
    }).join("") + "</ol>";
  }
  function openSheet() {
    if (sheet) return;
    var body;
    if (inApp) body = steps(ios
      ? ["You are inside another app's browser, which cannot install apps.", "Tap the <b>⋯</b> or compass icon and choose <b>Open in Safari</b>.", "Then follow the install steps in Safari."]
      : ["You are inside another app's browser, which cannot install apps.", "Tap the <b>⋮</b> menu and choose <b>Open in Chrome</b>.", "Then tap <b>Install</b> on the banner."]);
    else if (ios) body = steps(["Open this page in <b>Safari</b>.", "Tap the <b>Share</b> button " + SHARE + " at the bottom of the screen.", "Scroll down and tap <b>Add to Home Screen</b>.", "Tap <b>Add</b>. SafeBuy NG now opens like an app."]);
    else body = steps(["Tap the <b>⋮</b> menu at the top right of your browser.", "Tap <b>Install app</b> or <b>Add to Home screen</b>.", "Tap <b>Install</b>. SafeBuy NG now opens like an app."]);
    sheet = el("div", "position:fixed;inset:0;z-index:80;background:rgba(16,39,29,.62);display:flex;align-items:flex-end;justify-content:center");
    var card = el("div", "width:min(480px,100%);background:#fff;border-radius:26px 26px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));font-family:Arial,sans-serif;box-shadow:0 -10px 40px #0004;max-height:88vh;overflow:auto",
      '<div style="display:flex;align-items:center;gap:12px"><span style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#0fa573,#066548);color:#fff;font-weight:800;font-size:23px;display:grid;place-items:center">S</span>' +
      '<div style="flex:1"><div style="font-weight:800;font-size:19px;color:#10231b">Install SafeBuy NG</div><div style="font-size:13px;color:#6b7c73">Faster shopping, one tap from your home screen</div></div></div>' + body);
    var ok = el("button", "width:100%;margin-top:14px;border:0;border-radius:14px;padding:14px;font:700 15px Arial,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,#0fa573," + G + ")", "Got it");
    ok.onclick = function () { drop(sheet); sheet = null; };
    card.appendChild(ok); sheet.appendChild(card);
    sheet.onclick = function (e) { if (e.target === sheet) { drop(sheet); sheet = null; } };
    document.body.appendChild(sheet);
  }

  /* ---- banner (every visit) + floating button (stays after closing) ---- */
  function showPill() {
    if (pill || !document.body) return;
    pill = el("button", "position:fixed;right:12px;bottom:96px;z-index:70;border:0;border-radius:30px;padding:11px 16px;font:700 13px Arial,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,#fb923c," + O + ");box-shadow:0 8px 22px #f9731666", "📲 Get the app");
    pill.onclick = install;
    document.body.appendChild(pill);
  }
  function showBanner() {
    if (bar || !document.body) return;
    bar = el("div", "position:fixed;left:12px;right:12px;bottom:92px;z-index:70;background:linear-gradient(135deg,#0b3d2c,#087f5b);color:#fff;border-radius:18px;padding:14px;display:flex;gap:12px;align-items:center;font:14px/1.4 Arial,sans-serif;box-shadow:0 10px 34px #0005;max-width:480px;margin:auto");
    bar.appendChild(el("span", "font-size:28px", "📲"));
    bar.appendChild(el("span", "flex:1", "<b>Get the SafeBuy NG app</b><br><span style='opacity:.85;font-size:12.5px'>" + (deferred ? "Install it free in one tap." : ios ? "Add it to your home screen in 3 steps." : "Add it to your home screen.") + "</span>"));
    var go = el("button", "border:0;border-radius:12px;padding:10px 14px;font:800 13px Arial,sans-serif;background:linear-gradient(135deg,#fb923c," + O + ");color:#fff;cursor:pointer", deferred ? "Install" : "Show me");
    go.onclick = install;
    var x = el("button", "border:0;background:transparent;color:#fff;font-size:17px;padding:6px;cursor:pointer", "✕");
    x.setAttribute("aria-label", "Close"); x.onclick = function () { drop(bar); bar = null; showPill(); };
    bar.appendChild(go); bar.appendChild(x);
    drop(pill); pill = null;
    document.body.appendChild(bar);
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; drop(bar); bar = null; showBanner(); });
  window.addEventListener("appinstalled", function () { try { localStorage.setItem("sb-installed", "1"); } catch (e) {} removeAll(); });
  setTimeout(showBanner, 2500);
})();
