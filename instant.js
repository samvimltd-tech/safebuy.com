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
  // Warm connections to Supabase early
  try {
    var c = window.SAFEbuySupabaseConfig; if (c && c.url) {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = c.url; l.crossOrigin = ''; document.head.appendChild(l);
    }
  } catch(e){}
})();
