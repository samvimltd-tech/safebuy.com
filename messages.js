/* SafeBuy NG in-app messaging.
   Load AFTER shop-extras.js on index.html and on product pages:
   <script src="./messages.js"></script>  (product pages: ../../messages.js) */
(function () {
  "use strict";
  if (window.__sbMsg) return;
  window.__sbMsg = true;

  var isProductPage = location.pathname.indexOf("/p/") >= 0;
  var home = isProductPage ? location.href.split("/p/")[0] + "/" : location.href.split("#")[0];
  var cli = null, me = null, convId = null, convs = [], seen = {}, lastTs = null, view = "";

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
  function say(t) { if (typeof showToast === "function") showToast(t); else alert(t); }
  function fmt(iso) {
    var d = new Date(iso), now = new Date();
    var time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === now.toDateString() ? time : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) + ", " + time;
  }

  /* ---------- styles + DOM ---------- */
  var st = document.createElement("style");
  st.textContent =
    "#sbm-fab{position:fixed;right:14px;bottom:84px;z-index:90;width:54px;height:54px;border:0;border-radius:50%;background:#087f5b;color:#fff;font-size:24px;box-shadow:0 6px 20px #0003;cursor:pointer}" +
    "#sbm-fab .sbm-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#d63b3b;color:#fff;font:700 12px/20px Arial,sans-serif}" +
    "#sbm{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#f7f9f7;color:#172b24;font-family:Arial,Helvetica,sans-serif}" +
    "#sbm.open{display:flex}" +
    ".sbm-top{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:#fff;border-bottom:1px solid #e6ece8}" +
    ".sbm-top button{width:40px;height:40px;border:0;border-radius:50%;background:#edf6ef;color:#066548;font-size:20px;cursor:pointer}" +
    ".sbm-title{flex:1;min-width:0;display:flex;flex-direction:column;font-size:16px}" +
    ".sbm-title small{color:#718078;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".sbm-body{flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}" +
    ".sbm-empty{padding:30px 10px;text-align:center;color:#718078;font-size:14px}" +
    ".sbm-item{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 8px;padding:12px;border:1px solid #e6ece8;border-radius:14px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer}" +
    ".sbm-item .g{flex:1;min-width:0}.sbm-item strong{display:block;font-size:14px}" +
    ".sbm-item span{display:block;color:#718078;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".sbm-item em{min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#087f5b;color:#fff;font:700 12px/22px Arial,sans-serif;text-align:center;font-style:normal}" +
    ".sbm-note{margin:0 0 10px;padding:9px 12px;border-radius:12px;background:#fff8e8;border:1px solid #f1d69a;color:#79551b;font-size:12px;line-height:1.5}" +
    ".sbm-b{max-width:82%;margin:0 0 8px;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word;overflow-wrap:anywhere}" +
    ".sbm-b small{display:block;margin-top:3px;font-size:10px;opacity:.65}" +
    ".sbm-b.me{margin-left:auto;background:#087f5b;color:#fff;border-bottom-right-radius:4px}" +
    ".sbm-b.them{margin-right:auto;background:#fff;border:1px solid #e6ece8;border-bottom-left-radius:4px}" +
    ".sbm-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e6ece8}" +
    ".sbm-form textarea{flex:1;max-height:120px;min-height:44px;padding:11px 12px;border:1px solid #dce5de;border-radius:14px;font:16px Arial,sans-serif;resize:none;outline:none}" +
    ".sbm-form button{height:44px;padding:0 18px;border:0;border-radius:14px;background:#087f5b;color:#fff;font-weight:700;cursor:pointer}" +
    ".sbm-form button:disabled{opacity:.5}" +
    ".sbm-msg{display:block;width:100%;margin-top:10px;padding:12px;border:0;border-radius:12px;background:#e7f7ef;color:#066548;font:700 14px Arial,sans-serif;cursor:pointer}" +
    ".sbm-form .sbm-att{width:44px;padding:0;background:#edf6ef;color:#066548;font-size:20px}" +
    ".sbm-img{display:block;width:230px;max-width:100%;max-height:260px;min-height:80px;margin-bottom:4px;border-radius:10px;object-fit:cover;cursor:zoom-in;background:#edf6ef}" +
    "#sbm-view{position:fixed;inset:0;z-index:400;display:none;background:#000}#sbm-view.open{display:block}" +
    "#sbm-view button{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;z-index:2;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:22px;cursor:pointer}" +
    ".sbm-vs{width:100%;height:100%;overflow:auto;display:flex;align-items:center;justify-content:center}" +
    ".sbm-vs img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in}" +
    "#sbm-view.z .sbm-vs{display:block}#sbm-view.z .sbm-vs img{max-width:none;max-height:none;width:200%;cursor:zoom-out}";
  document.head.appendChild(st);

  var fab = document.createElement("button");
  fab.id = "sbm-fab"; fab.type = "button"; fab.hidden = true; fab.setAttribute("aria-label", "Messages");
  fab.innerHTML = '💬<span class="sbm-badge" hidden></span>';
  document.body.appendChild(fab);
  var badge = fab.querySelector(".sbm-badge");

  var root = document.createElement("div");
  root.id = "sbm"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.innerHTML =
    '<div class="sbm-top"><button type="button" class="sbm-back" aria-label="Back" hidden>‹</button>' +
    '<div class="sbm-title"><strong>Messages</strong></div>' +
    '<button type="button" class="sbm-x" aria-label="Close">✕</button></div>' +
    '<div class="sbm-body"></div>' +
    '<form class="sbm-form" hidden><button type="button" class="sbm-att" aria-label="Attach photo">📷</button><input type="file" accept="image/*" hidden><textarea rows="1" maxlength="2000" placeholder="Type a message" aria-label="Message"></textarea>' +
    '<button type="submit">Send</button></form>';
  document.body.appendChild(root);
  var backBtn = root.querySelector(".sbm-back"), titleEl = root.querySelector(".sbm-title"),
      bodyEl = root.querySelector(".sbm-body"), form = root.querySelector(".sbm-form"),
      ta = form.querySelector("textarea"), sendBtn = form.querySelector('button[type="submit"]'),
      attachBtn = form.querySelector(".sbm-att"), fileIn = form.querySelector('input[type="file"]');

  /* ---------- auth ---------- */
  async function loadMe() {
    if (!cli) return null;
    try { var r = await cli.auth.getUser(); me = r.data && r.data.user ? r.data.user : null; } catch (e) { me = null; }
    return me;
  }
  async function needUser() {
    if (me || (await loadMe())) return true;
    if (isProductPage) { location.href = home + "#account"; return false; }
    var b = document.querySelector('[data-action="account"]');
    say("Sign in to send and read messages.");
    if (b) b.click();
    return false;
  }

  /* ---------- badge ---------- */
  async function refreshBadge() {
    if (!cli || !me) { fab.hidden = true; return; }
    fab.hidden = false;
    var r = await cli.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", me.id);
    var n = r.count || 0;
    badge.hidden = !n;
    badge.textContent = n > 9 ? "9+" : String(n);
  }

  /* ---------- panel ---------- */
  function show() { root.classList.add("open"); document.body.style.overflow = "hidden"; }
  function hide() {
    root.classList.remove("open"); document.body.style.overflow = "";
    convId = null; view = "";
    if (location.hash === "#messages") history.replaceState(null, "", location.pathname + location.search);
    refreshBadge();
  }
  function otherName(c) { return c.buyer_id === me.id ? c.shop_name : (c.buyer_name || "Buyer"); }

  async function openInbox() {
    if (!(await needUser())) return;
    show(); view = "inbox"; convId = null;
    backBtn.hidden = true; form.hidden = true;
    titleEl.innerHTML = "<strong>Messages</strong>";
    bodyEl.innerHTML = '<p class="sbm-empty">Loading…</p>';
    var r = await cli.from("conversations")
      .select("id,product_name,shop_name,buyer_name,buyer_id,last_message,last_message_at")
      .order("last_message_at", { ascending: false }).limit(50);
    if (view !== "inbox") return;
    if (r.error) { bodyEl.innerHTML = '<p class="sbm-empty">' + esc(r.error.message) + "</p>"; return; }
    var un = await cli.from("messages").select("conversation_id").is("read_at", null).neq("sender_id", me.id);
    var cnt = {};
    (un.data || []).forEach(function (x) { cnt[x.conversation_id] = (cnt[x.conversation_id] || 0) + 1; });
    convs = r.data || [];
    if (!convs.length) {
      bodyEl.innerHTML = '<p class="sbm-empty">No messages yet.<br>Open a product and tap “Message seller”.</p>';
      return;
    }
    bodyEl.innerHTML = convs.map(function (c) {
      return '<button type="button" class="sbm-item" data-cid="' + esc(c.id) + '"><div class="g"><strong>' + esc(otherName(c)) +
        "</strong><span>" + esc(c.product_name) + "</span><span>" + esc(c.last_message || "No messages yet") + "</span></div>" +
        (cnt[c.id] ? "<em>" + cnt[c.id] + "</em>" : "") + "</button>";
    }).join("");
  }

  function addMsg(m) {
    if (seen[m.id]) return;
    seen[m.id] = 1;
    lastTs = m.created_at;
    var empty = bodyEl.querySelector(".sbm-empty"); if (empty) empty.remove();
    var d = document.createElement("div");
    d.className = "sbm-b " + (m.sender_id === me.id ? "me" : "them");
    var stick = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 250;
    var html = "";
    if (m.image_path) html += '<img class="sbm-img" alt="Photo" data-path="' + esc(m.image_path) + '">';
    if (m.body) html += "<div>" + esc(m.body).replace(/\n/g, "<br>") + "</div>";
    d.innerHTML = html + "<small>" + esc(fmt(m.created_at)) + "</small>";
    bodyEl.appendChild(d);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    var im = d.querySelector(".sbm-img");
    if (im) signedUrl(im.dataset.path).then(function (u) {
      if (!u) return;
      im.onload = function () { if (stick) bodyEl.scrollTop = bodyEl.scrollHeight; };
      im.src = u;
    });
  }

  async function openThread(id) {
    if (!(await needUser())) return;
    show(); view = "thread"; convId = id; seen = {}; lastTs = null;
    backBtn.hidden = false; form.hidden = false;
    bodyEl.innerHTML = '<p class="sbm-empty">Loading…</p>';
    var c = convs.filter(function (x) { return x.id === id; })[0];
    if (!c) {
      var cr = await cli.from("conversations").select("id,product_name,shop_name,buyer_name,buyer_id").eq("id", id).maybeSingle();
      c = cr.data;
    }
    if (!c) { bodyEl.innerHTML = '<p class="sbm-empty">Conversation not found.</p>'; return; }
    titleEl.innerHTML = "<strong>" + esc(otherName(c)) + "</strong><small>" + esc(c.product_name) + "</small>";
    var r = await cli.from("messages").select("id,sender_id,body,image_path,created_at")
      .eq("conversation_id", id).order("created_at", { ascending: true }).limit(300);
    if (convId !== id) return;
    if (r.error) { bodyEl.innerHTML = '<p class="sbm-empty">' + esc(r.error.message) + "</p>"; return; }
    bodyEl.innerHTML = '<p class="sbm-note"><strong>Stay safe:</strong> keep your chat here, never send money before you see the item, and meet in a public place.</p>';
    if (!(r.data || []).length) bodyEl.insertAdjacentHTML("beforeend", '<p class="sbm-empty">Say hello 👋</p>');
    (r.data || []).forEach(addMsg);
    cli.rpc("mark_conversation_read", { p_conversation: id }).then(refreshBadge);
    ta.focus();
  }

  async function startChat(productId) {
    if (!(await needUser())) return;
    var r = await cli.rpc("start_conversation", { p_product: productId });
    if (r.error) { say(r.error.message); return; }
    openThread(r.data);
  }

  /* ---------- photos ---------- */
  var urlCache = {};
  function rid() {
    return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  async function signedUrl(path) {
    var c = urlCache[path];
    if (c && c.exp > Date.now()) return c.url;
    var r = await cli.storage.from("chat-images").createSignedUrl(path, 3600);
    if (r.error || !r.data) return "";
    urlCache[path] = { url: r.data.signedUrl, exp: Date.now() + 3000 * 1000 };
    return r.data.signedUrl;
  }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1280 / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        var ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("Could not read that photo.")); }, "image/jpeg", 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error("Could not read that photo.")); };
      img.src = u;
    });
  }

  /* full-screen photo viewer: tap photo to zoom, tap outside or X to close */
  var vw = document.createElement("div");
  vw.id = "sbm-view";
  vw.setAttribute("role", "dialog");
  vw.setAttribute("aria-modal", "true");
  vw.innerHTML = '<button type="button" aria-label="Close">✕</button><div class="sbm-vs"><img alt="Photo"></div>';
  document.body.appendChild(vw);
  var vImg = vw.querySelector("img"), vScroll = vw.querySelector(".sbm-vs");
  function openView(src) { vImg.src = src; vw.classList.remove("z"); vw.classList.add("open"); }
  function closeView() { vw.classList.remove("open", "z"); vImg.removeAttribute("src"); }
  vw.querySelector("button").addEventListener("click", closeView);
  vScroll.addEventListener("click", function (e) {
    if (e.target === vImg) vw.classList.toggle("z"); else closeView();
  });

  attachBtn.addEventListener("click", function () { fileIn.value = ""; fileIn.click(); });
  fileIn.addEventListener("change", async function () {
    var f = fileIn.files[0], cid = convId;
    if (!f || !cid || !me) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { say("Choose a JPG, PNG or WebP photo."); return; }
    if (f.size > 15 * 1024 * 1024) { say("That photo is too large (15 MB max)."); return; }
    attachBtn.disabled = sendBtn.disabled = true;
    say("Sending photo…");
    try {
      var blob = await compress(f);
      var path = me.id + "/" + cid + "-" + rid() + ".jpg";
      var up = await cli.storage.from("chat-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;
      var r = await cli.from("messages").insert({ conversation_id: cid, sender_id: me.id, body: ta.value.trim(), image_path: path })
        .select("id,sender_id,body,image_path,created_at").single();
      if (r.error) throw r.error;
      ta.value = ""; ta.style.height = "auto";
      if (convId === cid) addMsg(r.data);
    } catch (e) {
      say("Could not send photo: " + (e.message || e));
    }
    attachBtn.disabled = sendBtn.disabled = false;
  });

  /* ---------- events ---------- */
  fab.addEventListener("click", openInbox);
  root.querySelector(".sbm-x").addEventListener("click", hide);
  backBtn.addEventListener("click", openInbox);
  bodyEl.addEventListener("click", function (e) {
    var im = e.target.closest(".sbm-img");
    if (im && im.getAttribute("src")) { openView(im.src); return; }
    var b = e.target.closest("[data-cid]");
    if (b) openThread(b.dataset.cid);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (vw.classList.contains("open")) closeView();
    else if (root.classList.contains("open")) hide();
  });
  ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover:hover)").matches) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var t = ta.value.trim();
    if (!t || !convId || !me) return;
    sendBtn.disabled = true;
    var r = await cli.from("messages").insert({ conversation_id: convId, sender_id: me.id, body: t })
      .select("id,sender_id,body,image_path,created_at").single();
    sendBtn.disabled = false;
    if (r.error) { say("Could not send: " + r.error.message); return; }
    ta.value = ""; ta.style.height = "auto";
    addMsg(r.data);
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-sbm-start]");
    if (!b) return;
    e.preventDefault();
    startChat(b.dataset.sbmStart);
  });

  /* "Message seller" buttons */
  function btnHtml(id) {
    return '<button type="button" class="sbm-msg" data-sbm-start="' + esc(id) + '">💬 Message seller</button>';
  }
  var addBtn = document.getElementById("sbx-add");
  if (addBtn && addBtn.dataset.id) addBtn.insertAdjacentHTML("afterend", btnHtml(addBtn.dataset.id));

  if (typeof window.openProduct === "function") {
    var prevOpen = window.openProduct;
    window.openProduct = function (id) {
      prevOpen.apply(this, arguments);
      var content = document.getElementById("modal-content");
      var chat = content && content.querySelector('[data-action="whatsapp"]');
      if (chat && !content.querySelector(".sbm-msg")) chat.insertAdjacentHTML("afterend", btnHtml(chat.dataset.id));
    };
  }

  /* ---------- live updates ---------- */
  function onNew(payload) {
    var m = payload.new;
    if (!m) return;
    if (convId && m.conversation_id === convId) {
      addMsg(m);
      if (m.sender_id !== me.id) cli.rpc("mark_conversation_read", { p_conversation: convId });
    } else if (view === "inbox") openInbox();
    refreshBadge();
  }
  async function poll() {
    if (!me || document.hidden) return;
    if (convId && lastTs) {
      var r = await cli.from("messages").select("id,sender_id,body,image_path,created_at")
        .eq("conversation_id", convId).gt("created_at", lastTs).order("created_at", { ascending: true });
      (r.data || []).forEach(addMsg);
      if ((r.data || []).length) cli.rpc("mark_conversation_read", { p_conversation: convId });
    }
    refreshBadge();
  }

  async function init() {
    cli = client();
    if (!cli) return;
    await loadMe();
    refreshBadge();
    try {
      cli.channel("sbm-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, onNew).subscribe();
    } catch (e) {}
    setInterval(poll, 25000);
    cli.auth.onAuthStateChange(function () { loadMe().then(refreshBadge); });
    if (location.hash === "#messages") openInbox();
    window.addEventListener("hashchange", function () { if (location.hash === "#messages") openInbox(); });
  }
  init();
})();
