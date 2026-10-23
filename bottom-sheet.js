/* SafeBuy NG - bottom-sheet.js
   Turns every modal (.modal-backdrop > .modal) into a bottom sheet on phones.
   Add to every page, just before </body>:
   <script src="./bottom-sheet.js"></script>
   (use "../../bottom-sheet.js" on pages inside p/<slug>/)
   Works for modals added later too. Opt in custom dialogs with data-bottom-sheet. */
(function () {
  "use strict";
  if (window.__sbBottomSheet) return;
  window.__sbBottomSheet = true;

  var css =
    "@media (max-width:650px){" +
    ".modal-backdrop,[data-bottom-sheet]{align-items:flex-end!important;justify-content:center;padding:0!important}" +
    ".modal-backdrop.open{animation:sbFade .2s ease-out}" +
    ".modal-backdrop>.modal,[data-bottom-sheet]>*{width:100%!important;max-width:100%!important;max-height:88vh;max-height:88dvh;" +
    "border-radius:22px 22px 0 0!important;padding:8px 20px calc(24px + env(safe-area-inset-bottom))!important;" +
    "overflow-y:auto;overscroll-behavior:contain;animation:sbUp .28s cubic-bezier(.2,.8,.2,1);" +
    "transition:transform .2s ease-out;will-change:transform}" +
    ".modal-backdrop>.modal.sb-dragging{transition:none}" +
    ".sb-handle{position:sticky;top:0;z-index:2;display:block;height:26px;margin:0 -20px 4px;background:#fff;touch-action:none;cursor:grab}" +
    ".sb-handle::after{content:'';position:absolute;left:50%;top:9px;width:42px;height:5px;margin-left:-21px;border-radius:5px;background:#cfd8d2}" +
    "body.sb-lock{overflow:hidden}" +
    "}" +
    "@keyframes sbUp{from{transform:translateY(100%)}to{transform:translateY(0)}}" +
    "@keyframes sbFade{from{opacity:0}to{opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){.modal-backdrop.open,.modal-backdrop>.modal{animation:none!important}}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var mq = window.matchMedia("(max-width:650px)");

  function sheetOf(backdrop) {
    return backdrop.querySelector(":scope > .modal") || backdrop.firstElementChild;
  }

  function closeSheet(backdrop, sheet) {
    var closeBtn = sheet.querySelector('[aria-label="Close"],[data-close],.icon-button[id$="close"]');
    if (closeBtn) closeBtn.click();
    else backdrop.classList.remove("open");
    sheet.style.transform = "";
  }

  function enhance(backdrop) {
    if (backdrop.__sb) return;
    var sheet = sheetOf(backdrop);
    if (!sheet) return;
    backdrop.__sb = true;

    var handle = document.createElement("div");
    handle.className = "sb-handle";
    handle.setAttribute("aria-hidden", "true");
    sheet.insertBefore(handle, sheet.firstChild);

    var startY = 0, dy = 0, dragging = false;

    function begin(y) {
      if (!mq.matches) return;
      dragging = true; startY = y; dy = 0;
      sheet.classList.add("sb-dragging");
    }
    function move(y) {
      if (!dragging) return;
      dy = Math.max(0, y - startY);
      sheet.style.transform = "translateY(" + dy + "px)";
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove("sb-dragging");
      if (dy > 110) closeSheet(backdrop, sheet);
      else sheet.style.transform = "";
      dy = 0;
    }

    handle.addEventListener("touchstart", function (e) { begin(e.touches[0].clientY); }, { passive: true });
    handle.addEventListener("touchmove", function (e) { move(e.touches[0].clientY); }, { passive: true });
    handle.addEventListener("touchend", end);
    handle.addEventListener("touchcancel", end);

    /* Pull down from anywhere when the sheet is scrolled to the top */
    sheet.addEventListener("touchstart", function (e) {
      if (e.target.closest(".sb-handle") || sheet.scrollTop > 0) return;
      begin(e.touches[0].clientY);
    }, { passive: true });
    sheet.addEventListener("touchmove", function (e) {
      if (!dragging || e.target.closest(".sb-handle")) return;
      move(e.touches[0].clientY);
    }, { passive: true });
    sheet.addEventListener("touchend", end);

    new MutationObserver(function () {
      sheet.style.transform = "";
      syncLock();
    }).observe(backdrop, { attributes: true, attributeFilter: ["class"] });
  }

  function syncLock() {
    var anyOpen = document.querySelector(".modal-backdrop.open");
    document.body.classList.toggle("sb-lock", !!anyOpen && mq.matches);
  }

  function scan(root) {
    (root || document).querySelectorAll(".modal-backdrop,[data-bottom-sheet]").forEach(enhance);
  }

  scan();
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches(".modal-backdrop,[data-bottom-sheet]")) enhance(n);
        else if (n.querySelectorAll) scan(n);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  if (mq.addEventListener) mq.addEventListener("change", syncLock);
})();
