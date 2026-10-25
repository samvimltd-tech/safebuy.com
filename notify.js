/* SafeBuy NG notification bell: numbered badge (1, 2, 3...) for sellers AND buyers.
   Load AFTER messages.js on index.html:  <script src="./notify.js"></script> */
(function () {
  "use strict";
  if (window.__sbNotify) return;
  window.__sbNotify = true;

  var cli = null, me = null, count = 0, isOpen = false, chan = null;
  var baseTitle = document.title.replace(/^\(\d+\)\s*/, "");

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function client() {
    if (window.safeBuySupabase) return window.safeBuySupabase;
    var cfg = window.SAFEbuySupabaseConfig;
    if (!window.supabase || !cfg || !cfg.url || !cfg.publishableKey) return null;
    try { window.safeBuySupabase = window.supabase.createClient(cfg.url, cfg.publishableKey); } catch (e) { return null; }
    return window.safeBuySupabase;
  }
  function say(t) { if (typeof showToast === "function") showToast(t); }
  function fmt(iso) {
    var d = new Date(iso), now = new Date();
    var time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === now.toDateString() ? time : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) + ", " + time;
  }

  /* ---------- styles + DOM ---------- */
  var st = document.createElement("style");
  st.textContent =
    "#sbn-fab{position:fixed;right:14px;bottom:148px;z-index:90;width:54px;height:54px;border-radius:50%;border:1px solid #e6ece8;background:#fff;color:#087f5b;font-size:24px;box-shadow:0 6px 20px #0003;cursor:pointer}" +
    "#sbn-fab .sbn-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#d63b3b;color:#fff;font:700 12px/20px Arial,sans-serif}" +
    "#sbn{position:fixed;inset:0;z-index:310;display:none;flex-direction:column;background:#f7f9f7;color:#172b24;font-family:Arial,Helvetica,sans-serif}" +
    "#sbn.open{display:flex}" +
    ".sbn-top{display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));background:#fff;border-bottom:1px solid #e6ece8}" +
    ".sbn-top strong{flex:1;font-size:17px}" +
    ".sbn-top button{width:40px;height:40px;border:0;border-radius:50%;background:#edf6ef;color:#066548;font-size:20px;cursor:pointer}" +
    ".sbn-body{flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}" +
    ".sbn-empty{padding:30px 10px;text-align:center;color:#718078;font-size:14px}" +
    ".sbn-item{display:block;width:100%;margin:0 0 8px;padding:12px;border:1px solid #e6ece8;border-radius:14px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer}" +
    ".sbn-item.new{background:#e7f7ef;border-color:#bfe6d1}" +
    ".sbn-item b{display:block;font-size:14px}" +
    ".sbn-item span{display:block;margin-top:2px;color:#52675c;font-size:13px;line-height:1.4}" +
    ".sbn-item small{display:block;margin-top:5px;color:#718078;font-size:11px}" +
    ".sbn-pill{display:inline-block;margin-right:6px;padding:2px 8px;border-radius:20px;background:#fff3e0;color:#7a4a05;font:700 10px Arial,sans-serif;vertical-align:1px}" +
    ".sbn-pill.seller{background:#e0ecff;color:#1b4a9c}";
  document.head.appendChild(st);

  var fab = document.createElement("button");
  fab.id = "sbn-fab"; fab.type = "button"; fab.hidden = true; fab.setAttribute("aria-label", "Notifications");
  fab.innerHTML = '🔔<span class="sbn-badge" hidden></span>';
  document.body.appendChild(fab);
  var badge = fab.querySelector(".sbn-badge");

  var root = document.createElement("div");
  root.id = "sbn"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.innerHTML = '<div class="sbn-top"><strong>Notifications</strong><button type="button" aria-label="Close">✕</button></div><div class="sbn-body"></div>';
  document.body.appendChild(root);
  var bodyEl = root.querySelector(".sbn-body");

  /* ---------- badge ---------- */
  function setCount(n) {
    count = Math.max(0, n);
    badge.hidden = !count;
    badge.textContent = count > 9 ? "9+" : String(count);
    document.title = count ? "(" + count + ") " + baseTitle : baseTitle;
    try {
      if (count && navigator.setAppBadge) navigator.setAppBadge(count);
      else if (!count && navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) {}
  }
  async function refresh() {
    if (!cli || !me) { fab.hidden = true; setCount(0); return; }
    fab.hidden = false;
    if (isOpen) return;
    var r = await cli.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    if (!r.error) setCount(r.count || 0);
  }

  function beep() {
    try {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      var ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.18);
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 400);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
  }

  /* ---------- panel ---------- */
  function itemHtml(n, isNew) {
    return '<button type="button" class="sbn-item' + (isNew ? " new" : "") + '" data-role="' + esc(n.role) + '">' +
      '<b><span class="sbn-pill ' + esc(n.role) + '">' + (n.role === "seller" ? "Seller" : "Buyer") + "</span>" + esc(n.title) + "</b>" +
      (n.body ? "<span>" + esc(n.body) + "</span>" : "") + "<small>" + esc(fmt(n.created_at)) + "</small></button>";
  }
  async function openPanel() {
    if (!me) return;
    isOpen = true;
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    bodyEl.innerHTML = '<p class="sbn-empty">Loading…</p>';
    var r = await cli.from("notifications").select("id,role,title,body,read_at,created_at")
      .order("created_at", { ascending: false }).limit(50);
    if (r.error) { bodyEl.innerHTML = '<p class="sbn-empty">' + esc(r.error.message) + "</p>"; return; }
    var rows = r.data || [];
    bodyEl.innerHTML = rows.length
      ? rows.map(function (n) { return itemHtml(n, !n.read_at); }).join("")
      : '<p class="sbn-empty">No notifications yet.<br>New orders and order updates will show here.</p>';
    setCount(0);
    cli.rpc("mark_notifications_read");
  }
  function closePanel() {
    isOpen = false;
    root.classList.remove("open");
    document.body.style.overflow = "";
    refresh();
  }
  function go(role) {
    closePanel();
    if (role === "seller") {
      var b = document.querySelector('[data-action="sell"]');
      if (b) b.click();
    } else if (typeof window.showCart === "function") {
      window.showCart();
      setTimeout(function () {
        var o = document.querySelector('#cart-body [data-c="orders"]');
        if (o) o.click();
      }, 150);
    }
  }

  fab.addEventListener("click", openPanel);
  root.querySelector(".sbn-top button").addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) closePanel(); });
  bodyEl.addEventListener("click", function (e) {
    var b = e.target.closest(".sbn-item");
    if (b) go(b.dataset.role);
  });

  /* ---------- live updates ---------- */
  function onNew(payload) {
    var n = payload.new;
    if (!n) return;
    beep();
    say(n.title + (n.body ? ": " + n.body : ""));
    if (isOpen) {
      var empty = bodyEl.querySelector(".sbn-empty"); if (empty) empty.remove();
      bodyEl.insertAdjacentHTML("afterbegin", itemHtml(n, true));
      cli.rpc("mark_notifications_read");
    } else {
      setCount(count + 1);
    }
  }
  function subscribe() {
    try { if (chan) cli.removeChannel(chan); } catch (e) {}
    chan = null;
    if (!me) return;
    try {
      chan = cli.channel("sbn-" + me.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + me.id }, onNew)
        .subscribe();
    } catch (e) {}
  }

  async function loadMe() {
    try { var r = await cli.auth.getUser(); me = r.data && r.data.user ? r.data.user : null; } catch (e) { me = null; }
  }

  async function init() {
    cli = client();
    if (!cli) return;
    await loadMe();
    await refresh();
    subscribe();
    setInterval(function () { if (!document.hidden) refresh(); }, 30000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    cli.auth.onAuthStateChange(function () {
      loadMe().then(function () { subscribe(); refresh(); });
    });
  }
  init();
})();
