import fs from "fs";
const URL = "YOUR_SUPABASE_URL", KEY = "YOUR_PUBLISHABLE_KEY";
const BASE = "https://samvimltd-tech.github.io/safebuy.com";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const r = await fetch(`${URL}/rest/v1/seller_products_public?select=*`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const rows = await r.json();
if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));

let n = 0;
for (const p of rows) {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(p.slug || "")) continue;
  const price = "₦" + (Number(p.price_kobo) / 100).toLocaleString("en-NG");
  const img = /^https:\/\//.test(p.image_url || "") ? p.image_url : "";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.name)} | SafeBuy NG</title>
<link rel="canonical" href="${BASE}/p/${p.slug}/">
<meta property="og:title" content="${esc(p.name)} – ${price}">
<meta property="og:description" content="${esc((p.description || "").slice(0,150))}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<style>body{font-family:Arial,sans-serif;margin:0;background:#f7f9f7;color:#172b24}
main{max-width:560px;margin:auto;padding:16px}img{width:100%;border-radius:16px}
.btn{display:block;text-align:center;background:#087f5b;color:#fff;padding:14px;border-radius:12px;font-weight:700;text-decoration:none;margin:16px 0}
.note{background:#fff8e8;border:1px solid #f1d69a;padding:12px;border-radius:12px;font-size:13px}</style></head>
<body><main><a href="../../">← SafeBuy NG</a>
${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : ""}
<h1>${esc(p.name)}</h1><h2>${price}</h2>
<p>${esc(p.shop_name)} · ${p.verified ? "✓ Verified" : "Unverified"} · ${esc(p.category)} · ${p.in_stock === false ? "Sold out" : "In stock"}</p>
<p>${esc(p.description)}</p>
<a class="btn" href="../../#shop">View on SafeBuy NG to chat the seller</a>
<p class="note">SafeBuy NG does not handle payments or delivery yet. Meet in a public place and inspect the item before you pay.</p>
</main></body></html>`;
  fs.mkdirSync(`p/${p.slug}`, { recursive: true });
  fs.writeFileSync(`p/${p.slug}/index.html`, html);
  n++;
}
const urls = rows.filter(p => p.slug).map(p => `<url><loc>${BASE}/p/${p.slug}/</loc></url>`).join("");
fs.writeFileSync("sitemap.xml", `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE}/</loc></url>${urls}</urlset>`);
console.log(n + " product pages written");
