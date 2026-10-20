  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.name)} | SafeBuy NG</title>
<link rel="canonical" href="${BASE}/p/${p.slug}/">
<meta property="og:title" content="${esc(p.name)} – ${price}">
<meta property="og:description" content="${esc((p.description || "").slice(0,150))}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f7f9f7;color:#172b24}
main{max-width:560px;margin:auto;padding:16px}
.hero{position:relative;cursor:pointer}
.hero img{width:100%;border-radius:16px;display:block}
.more{position:absolute;right:10px;bottom:10px;background:#000a;color:#fff;font-size:13px;font-weight:700;padding:6px 10px;border-radius:20px}
.btn{display:block;text-align:center;background:#087f5b;color:#fff;padding:14px;border-radius:12px;font-weight:700;text-decoration:none;margin:16px 0}
.note{background:#fff8e8;border:1px solid #f1d69a;padding:12px;border-radius:12px;font-size:13px}
#gal{position:fixed;inset:0;background:#000e;z-index:50;display:none;flex-direction:column}
#gal.open{display:flex}
#gal .strip{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory}
#gal .strip img{flex:0 0 100%;width:100%;object-fit:contain;scroll-snap-align:center}
#gal button{align-self:flex-end;margin:12px;border:0;background:#fff;border-radius:20px;padding:8px 14px;font-weight:700}
#gal .count{color:#fff;text-align:center;padding:10px;font-size:13px}
</style></head>
<body data-id="${esc(p.id)}"><main><a href="../../">← SafeBuy NG</a>
${img ? `<div class="hero" id="hero"><img id="main" src="${esc(img)}" alt="${esc(p.name)}"><span class="more" id="more" hidden></span></div>` : ""}
<h1>${esc(p.name)}</h1><h2>${price}</h2>
<p>${esc(p.shop_name)} · ${p.verified ? "✓ Verified" : "Unverified"} · ${esc(p.category)} · ${p.in_stock === false ? "Sold out" : "In stock"}</p>
<p>${esc(p.description)}</p>
<a class="btn" href="../../#shop">View on SafeBuy NG to chat the seller</a>
<p class="note">SafeBuy NG does not handle payments or delivery yet. Meet in a public place and inspect the item before you pay.</p>
</main>
<div id="gal"><button type="button" id="gclose">Close ✕</button><div class="strip" id="strip"></div><div class="count" id="gcount"></div></div>
<script src="../../supabase-config.js"></script>
<script>
(async function(){
  var c=window.SAFEbuySupabaseConfig, id=document.body.dataset.id;
  var main=document.getElementById("main"); if(!c||!main) return;
  var urls=[main.src], h={apikey:c.publishableKey,Authorization:"Bearer "+c.publishableKey};
  var keys=["product_id","seller_product_id"], rows=[];
  for(var i=0;i<keys.length;i++){
    try{
      var r=await fetch(c.url+"/rest/v1/product_images?select=*&"+keys[i]+"=eq."+encodeURIComponent(id),{headers:h});
      var d=await r.json(); if(r.ok&&Array.isArray(d)){rows=d;break;}
    }catch(e){}
  }
  rows.sort(function(a,b){return (a.position||a.sort_order||0)-(b.position||b.sort_order||0);});
  rows.forEach(function(x){var u=x.image_url||x.url; if(u&&urls.indexOf(u)<0) urls.push(u);});
  if(urls.length<2) return;
  var more=document.getElementById("more"); more.hidden=false; more.textContent="+"+(urls.length-1)+" photos";
  var strip=document.getElementById("strip"), gal=document.getElementById("gal");
  strip.innerHTML=urls.map(function(u){return '<img src="'+u.replace(/"/g,"&quot;")+'" alt="">';}).join("");
  var cnt=document.getElementById("gcount");
  strip.addEventListener("scroll",function(){cnt.textContent=(Math.round(strip.scrollLeft/strip.clientWidth)+1)+" / "+urls.length;});
  document.getElementById("hero").addEventListener("click",function(){gal.classList.add("open");strip.scrollLeft=0;cnt.textContent="1 / "+urls.length;});
  document.getElementById("gclose").addEventListener("click",function(){gal.classList.remove("open");});
})();
</script></body></html>`;
