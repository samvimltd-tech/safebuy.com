/* SafeBuy instant-feel layer: immediate tap feedback, no 300ms delay, busy state while the network works. Safe: only adds classes/CSS. */
(function(){
  if (window.__sbInstant) return; window.__sbInstant = 1;
  var css = 'a,button,[role=button],.product-card,.chip,[data-category],[data-action],label,select,summary{touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,.08)}' +
    'button,[role=button],[data-action],.product-card,[data-category]{transition:transform .08s ease,opacity .08s ease}' +
    'button:active,[role=button]:active,[data-action]:active,.product-card:active,[data-category]:active{transform:scale(.96);opacity:.85}' +
    '.sb-busy{pointer-events:none;opacity:.65;position:relative}' +
    '.sb-busy::after{content:"";position:absolute;right:8px;top:50%;width:14px;height:14px;margin-top:-7px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:sbspin .6s linear infinite}' +
    '@keyframes sbspin{to{transform:rotate(360deg)}}' +
    '#sb-topbar{position:fixed;left:0;top:0;height:3px;width:0;background:#16a34a;z-index:99999;transition:width .25s ease,opacity .3s ease;opacity:0;pointer-events:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var bar = document.createElement('div'); bar.id = 'sb-topbar'; document.body.appendChild(bar);
  var pending = 0, hideT;
  function show(){ clearTimeout(hideT); bar.style.opacity = 1; bar.style.width = '70%'; }
  function hide(){ bar.style.width = '100%'; hideT = setTimeout(function(){ bar.style.opacity = 0; setTimeout(function(){ bar.style.width = 0; }, 300); }, 200); }
  // Top progress bar for any network call
  var of = window.fetch;
  if (of) window.fetch = function(){
    pending++; show();
    var p = of.apply(this, arguments);
    var done = function(){ if (--pending <= 0) { pending = 0; hide(); } };
    p.then(done, done); return p;
  };
  // Instant busy state on action buttons; auto-clears when network is quiet again (max 8s)
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('button,[data-action]');
    if (!b || b.disabled || b.classList.contains('sb-busy')) return;
    if (b.matches('[data-category],.sb-nobusy,[type=file],.chip')) return;
    var t0 = pending;
    setTimeout(function(){
      if (pending > 0 && document.body.contains(b)) {
        b.classList.add('sb-busy');
        var n = 0, iv = setInterval(function(){
          if (pending === 0 || ++n > 80 || !document.body.contains(b)) { clearInterval(iv); b.classList.remove('sb-busy'); }
        }, 100);
      }
    }, 0);
  }, true);

  /* ---------- Softer, faster feel ---------- */
  var st2 = document.createElement('style');
  st2.textContent = 'html{scroll-behavior:smooth}img{content-visibility:auto}.product-card{will-change:transform;contain:layout paint;transition:transform .12s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease}' +
    '.product-card:active{transform:scale(.975)}button,.button,[data-action]{transition:transform .1s cubic-bezier(.2,.8,.2,1),opacity .1s,background-color .15s,box-shadow .2s}' +
    '@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}';
  document.head.appendChild(st2);

  /* ---------- Bottom sheets: every pop-up slides up on phones, drag down to close ---------- */
  var st3 = document.createElement('style');
  st3.textContent = '@keyframes sbfade{from{opacity:0}to{opacity:1}}@keyframes sbup{from{transform:translateY(60%);opacity:.4}to{transform:none;opacity:1}}' +
    '.modal-backdrop.open{animation:sbfade .16s ease-out}' +
    '@media (max-width:700px){.modal-backdrop.open .modal{animation:sbup .26s cubic-bezier(.22,1,.36,1);overscroll-behavior:contain}' +
    '.modal-backdrop .modal::before{content:"";display:block;width:46px;height:5px;border-radius:9px;background:#cfd8d3;margin:-8px auto 12px}}' +
    '.modal.sb-drag{transition:none!important;animation:none!important}.modal.sb-snap{transition:transform .2s ease}';
  document.head.appendChild(st3);
  var my0 = null, mdy = 0, mdl = null;
  function openBackdrop(el){ return el && el.closest && el.closest('.modal-backdrop'); }
  document.addEventListener('touchstart', function(e){
    var m = e.target.closest && e.target.closest('.modal'); if (!m || window.innerWidth > 700) { my0 = null; return; }
    // only start a drag from the top handle area or when the sheet is scrolled to the top
    if (m.scrollTop > 0 || e.target.closest('input,textarea,select')) { my0 = null; return; }
    my0 = e.touches[0].clientY; mdy = 0; mdl = m; m.classList.remove('sb-snap');
  }, {passive:true});
  document.addEventListener('touchmove', function(e){
    if (my0 === null || !mdl) return; mdy = e.touches[0].clientY - my0;
    if (mdy > 8) { mdl.classList.add('sb-drag'); mdl.style.transform = 'translateY(' + mdy + 'px)'; }
  }, {passive:true});
  document.addEventListener('touchend', function(){
    if (my0 === null || !mdl) return; var m = mdl; m.classList.remove('sb-drag'); my0 = null; mdl = null;
    if (mdy > 120) {
      var bd = openBackdrop(m), btn = m.querySelector('#close-modal,[data-close],.modal-close,.close,button[aria-label*="lose"]');
      m.style.transform = ''; if (btn) btn.click(); else if (bd) bd.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    } else { m.classList.add('sb-snap'); m.style.transform = ''; }
    mdy = 0;
  });
  // Warm up the full product page the moment a finger touches a link to it
  document.addEventListener('touchstart', function(e){
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.__pf) return;
    try { var u = new URL(a.href, location.href); if (u.origin === location.origin && /\/(p|shop)\//.test(u.pathname)) { a.__pf = 1; var l = document.createElement('link'); l.rel = 'prefetch'; l.href = u.href; document.head.appendChild(l); } } catch(err){}
  }, {passive:true, capture:true});

  // Warm connections to Supabase early
  try {
    var c = window.SAFEbuySupabaseConfig; if (c && c.url) {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = c.url; l.crossOrigin = ''; document.head.appendChild(l);
    }
  } catch(e){}
})();
