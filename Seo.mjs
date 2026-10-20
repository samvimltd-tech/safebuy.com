#!/usr/bin/env node
// SafeBuy NG SEO generator.
// Reads published products from Supabase (public view only, anon key) and writes:
//   p/<slug>/index.html   one crawlable page per product (SEO tags + structured data)
//   sitemap.xml           eligible products
//   robots.txt
//   feed/google-merchant.xml   Google Merchant Center product feed
// Removed, hidden or suspended products disappear from all of the above.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/build-seo.mjs
//   node scripts/build-seo.mjs --mock scripts/sample-products.json --out ./_test   (offline test)

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const outRoot = path.resolve(arg("--out") || repoRoot);

const CONDITIONS = {
  new: { label: "New", schema: "https://schema.org/NewCondition" },
  used: { label: "Used", schema: "https://schema.org/UsedCondition" },
  refurbished: { label: "Refurbished", schema: "https://schema.org/RefurbishedCondition" }
};

const GOOGLE_CATEGORY = {
  Electronics: "Electronics",
  Fashion: "Apparel & Accessories",
  Home: "Home & Garden",
  Beauty: "Health & Beauty",
  Groceries: "Food, Beverages & Tobacco"
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/* ---------- helpers ---------- */
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function xml(value) {
  return esc(String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""));
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function squash(text) {
  return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
}

function trunc(text, max) {
  const t = squash(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

function plainPrice(kobo) {
  const n = Math.round(Number(kobo));
  return Math.floor(n / 100) + "." + String(n % 100).padStart(2, "0");
}

function httpsUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : "";
}

async function readIfExists(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function writeIfChanged(file, content) {
  const existing = await readIfExists(file);
  if (existing === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return true;
}

/* ---------- data ---------- */
async function fetchProducts() {
  const mock = arg("--mock");
  if (mock) return JSON.parse(await readFile(path.resolve(mock), "utf8"));

  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY || "";
  if (!base || !key) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (or use --mock <file>).");

  const headers = { apikey: key };
  if (!key.startsWith("sb_")) headers.Authorization = "Bearer " + key;

  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = `${base}/rest/v1/seller_products_public?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response from Supabase.");
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function cleanProducts(rows) {
  const seen = new Set();
  const good = [];
  for (const r of rows) {
    const price = Number(r.price_kobo);
    if (!r || !r.id || !SLUG_RE.test(String(r.slug || "")) || !squash(r.name) || !(price > 0)) {
      console.warn("Skipping invalid product row:", r && (r.id || r.name));
      continue;
    }
    if (seen.has(r.slug)) {
      console.warn("Skipping duplicate slug:", r.slug);
      continue;
    }
    seen.add(r.slug);
    good.push({ ...r, name: squash(r.name), price_kobo: Math.round(price) });
  }
  return good;
}

/* ---------- product page ---------- */
const CHAT_JS = String.raw`
(function () {
  var btn = document.getElementById('chat');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    var cfg = window.SAFEbuySupabaseConfig;
    if (!window.supabase || !cfg || !cfg.url || !cfg.publishableKey) {
      alert('Chat is unavailable right now. Please try again later.');
      return;
    }
    var client = window.supabase.createClient(cfg.url, cfg.publishableKey);
    var win = window.open('about:blank', '_blank');
    btn.disabled = true;
    var r = await client.rpc('seller_contact', { p_product: btn.dataset.id });
    btn.disabled = false;
    var d = String(r.data || '').replace(/\D/g, '');
    if (d.indexOf('234') !== 0) {
      if (d.charAt(0) === '0') d = '234' + d.slice(1);
      else if (d.length === 10) d = '234' + d;
    }
    if (r.error || !d) {
      if (win) win.close();
      alert("This seller's contact is not available right now.");
      return;
    }
    var text = 'Hello, I am interested in "' + btn.dataset.name + '" (' + btn.dataset.price + ') on SafeBuy NG. Is it still available?';
    var url = 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
    if (win) win.location.href = url; else window.location.href = url;
  });
})();
`;

const PAGE_CSS = `
:root{--green:#087f5b;--green-dark:#066548;--green-light:#e7f7ef;--ink:#172b24;--muted:#718078;--line:#e6ece8;--bg:#f7f9f7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif;line-height:1.6}
a{color:inherit}
header{background:#fff;border-bottom:1px solid var(--line)}
.bar{width:min(960px,100% - 28px);margin:auto;min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:9px;text-decoration:none;font-size:20px;font-weight:800;letter-spacing:-.6px}
.brand i{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:var(--green);color:#fff;font-style:normal;font-size:20px}
.brand b{color:var(--green)}
.shop-link{font-size:14px;font-weight:700;text-decoration:none;color:var(--green-dark)}
main{width:min(960px,100% - 28px);margin:18px auto 50px}
nav.crumbs{font-size:13px;color:var(--muted);margin-bottom:14px}
nav.crumbs a{color:var(--muted)}
.card{display:grid;grid-template-columns:1fr 1fr;gap:26px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px}
.photo{aspect-ratio:1/1;border-radius:16px;overflow:hidden;background:#edf6ef;display:grid;place-items:center;font-size:80px}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
h1{margin:0 0 8px;font-size:clamp(24px,4vw,32px);line-height:1.2;letter-spacing:-.6px}
.price{font-size:28px;font-weight:800;margin:6px 0 12px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;padding:0;list-style:none}
.meta li{padding:5px 11px;border-radius:30px;background:var(--green-light);color:var(--green-dark);font-size:12px;font-weight:800}
.meta li.warn{background:#fff3e0;color:#7a4a05}
.seller{margin:0 0 14px;color:var(--muted);font-size:14px}
.desc{margin:0 0 16px;font-size:15px}
.button{display:inline-flex;align-items:center;justify-content:center;width:100%;border:0;border-radius:12px;padding:14px 18px;background:var(--green);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.button:disabled{opacity:.6;cursor:default}
.note{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#fff8e8;border:1px solid #f1d69a;color:#79551b;font-size:13px}
footer{width:min(960px,100% - 28px);margin:0 auto 40px;color:var(--muted);font-size:13px}
@media (max-width:700px){.card{grid-template-columns:1fr;padding:16px}}
`;

function pageHtml(p, site, cfg) {
  const url = `${site}/p/${p.slug}/`;
  const cond = CONDITIONS[p.condition] || CONDITIONS.new;
  const inStock = p.in_stock !== false;
  const priceLabel = "₦" + money.format(p.price_kobo / 100);
  const desc = String(p.description || "").trim();
  const image = httpsUrl(p.image_url);
  const shop = squash(p.shop_name) || "Seller";
  const category = squash(p.category) || "Products";

  const title = trunc(`${p.name} - ${priceLabel} | ${cfg.siteName}`, 60);
  const metaDesc = trunc(
    `${p.name} for ${priceLabel} from ${shop} on ${cfg.siteName}. ${desc || "Category: " + category + "."}`,
    155
  );

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: trunc(desc || `${p.name} sold by ${shop} on ${cfg.siteName}.`, 5000),
    sku: String(p.id),
    category,
    url,
    itemCondition: cond.schema,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "NGN",
      price: plainPrice(p.price_kobo),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: cond.schema,
      seller: { "@type": "Organization", name: shop }
    }
  };
  if (image) product.image = [image];

  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${site}/` },
      { "@type": "ListItem", position: 2, name: p.name, item: url }
    ]
  };

  const descHtml = desc
    ? esc(desc).replace(/\r?\n/g, "<br>")
    : `${esc(p.name)} from ${esc(shop)}. Message the seller for details.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n` : ""}<meta property="product:price:amount" content="${esc(plainPrice(p.price_kobo))}">
<meta property="product:price:currency" content="NGN">
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<script type="application/ld+json">${jsonLd(product)}</script>
<script type="application/ld+json">${jsonLd(crumbs)}</script>
<style>${PAGE_CSS}</style>
</head>
<body>
<header>
  <div class="bar">
    <a class="brand" href="${esc(site)}/"><i>S</i><span>SafeBuy <b>NG</b></span></a>
    <a class="shop-link" href="${esc(site)}/#shop">Back to shop</a>
  </div>
</header>
<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${esc(site)}/">Shop</a> &rsaquo; ${esc(category)} &rsaquo; ${esc(p.name)}</nav>
  <article class="card">
    <div class="photo">${image ? `<img src="${esc(image)}" alt="${esc(p.name)}" width="800" height="800" fetchpriority="high">` : "🛍️"}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <div class="price">${esc(priceLabel)}</div>
      <ul class="meta">
        <li>${esc(cond.label)}</li>
        <li class="${inStock ? "" : "warn"}">${inStock ? "In stock" : "Sold out"}</li>
        <li class="${p.verified ? "" : "warn"}">${p.verified ? "✓ Verified seller" : "Unverified seller"}</li>
      </ul>
      <p class="seller">Sold by ${esc(shop)} · ${esc(category)}</p>
      <p class="desc">${descHtml}</p>
      <button class="button" type="button" id="chat" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${esc(priceLabel)}"${inStock ? "" : " disabled"}>${inStock ? "Chat seller on WhatsApp" : "Sold out"}</button>
      <p class="note"><strong>Stay safe:</strong> ${esc(cfg.siteName)} does not handle payments or delivery yet. Agree details with the seller, meet in a public place, and inspect the item before you pay.</p>
    </div>
  </article>
</main>
<footer>&copy; ${new Date().getUTCFullYear()} ${esc(cfg.siteName)}. A Nigerian marketplace prototype in development.</footer>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" defer></script>
<script src="${esc(site)}/supabase-config.js" defer></script>
<script>window.addEventListener('DOMContentLoaded',function(){${CHAT_JS}});</script>
</body>
</html>
`;
}

/* ---------- sitemap, robots, feed ---------- */
function sitemapXml(products, site) {
  const items = products
    .map((p) => {
      const last = new Date(p.updated_at || p.created_at || Date.now());
      const lastmod = isNaN(last) ? "" : `<lastmod>${last.toISOString()}</lastmod>`;
      const image = httpsUrl(p.image_url);
      return `  <url>
    <loc>${xml(`${site}/p/${p.slug}/`)}</loc>
    ${lastmod}
    ${image ? `<image:image><image:loc>${xml(image)}</image:loc></image:image>` : ""}
  </url>`.replace(/\n\s*\n/g, "\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${xml(site + "/")}</loc>
  </url>
${items}
</urlset>
`;
}

function robotsTxt(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
}

function feedXml(products, site, cfg) {
  const eligible = products.filter(
    (p) => httpsUrl(p.image_url) && (cfg.feedVerifiedOnly === false || p.verified)
  );

  const items = eligible
    .map((p) => {
      const cond = p.condition in CONDITIONS ? p.condition : "new";
      const desc = trunc(p.description || `${p.name} sold by ${p.shop_name} on ${cfg.siteName}.`, 5000);
      return `    <item>
      <g:id>${xml(p.id)}</g:id>
      <g:title>${xml(trunc(p.name, 150))}</g:title>
      <g:description>${xml(desc)}</g:description>
      <g:link>${xml(`${site}/p/${p.slug}/`)}</g:link>
      <g:image_link>${xml(httpsUrl(p.image_url))}</g:image_link>
      <g:availability>${p.in_stock === false ? "out_of_stock" : "in_stock"}</g:availability>
      <g:price>${plainPrice(p.price_kobo)} NGN</g:price>
      <g:condition>${cond}</g:condition>
      <g:brand>${xml(trunc(p.shop_name || cfg.siteName, 70))}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${xml(GOOGLE_CATEGORY[p.category] || "")}</g:google_product_category>
    </item>`.replace(/\n\s*<g:google_product_category><\/g:google_product_category>/, "");
    })
    .join("\n");

  return {
    count: eligible.length,
    body: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(cfg.siteName)}</title>
    <link>${xml(site + "/")}</link>
    <description>${xml(cfg.siteDescription || cfg.siteName)}</description>
${items}
  </channel>
</rss>
`
  };
}

/* ---------- homepage tags (between markers in index.html) ---------- */
function homeSeoBlock(site, cfg) {
  const site_ld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: cfg.siteName,
    url: site + "/",
    description: cfg.siteDescription
  };
  const verify = cfg.googleSiteVerification
    ? `\n<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">`
    : "";
  return `<!-- seo:start -->
<link rel="canonical" href="${esc(site)}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(cfg.siteName)} | Shop with Confidence">
<meta property="og:description" content="${esc(cfg.siteDescription)}">
<meta property="og:url" content="${esc(site)}/">
<meta name="twitter:card" content="summary">${verify}
<script type="application/ld+json">${jsonLd(site_ld)}</script>
<!-- seo:end -->`;
}

/* ---------- main ---------- */
async function main() {
  const cfg = JSON.parse(await readFile(path.join(repoRoot, "site.config.json"), "utf8"));
  const site = String(process.env.SITE_URL || cfg.siteUrl || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(site)) throw new Error("siteUrl must start with https://");

  const products = cleanProducts(await fetchProducts());
  console.log(`Eligible products: ${products.length}`);

  let changed = 0;
  const wanted = new Set();

  for (const p of products) {
    wanted.add(p.slug);
    if (await writeIfChanged(path.join(outRoot, "p", p.slug, "index.html"), pageHtml(p, site, cfg))) changed++;
  }

  // Removal handling: delete pages for products that are no longer eligible
  let removed = 0;
  let existing = [];
  try {
    existing = await readdir(path.join(outRoot, "p"), { withFileTypes: true });
  } catch {
    existing = [];
  }
  for (const entry of existing) {
    if (entry.isDirectory() && !wanted.has(entry.name)) {
      await rm(path.join(outRoot, "p", entry.name), { recursive: true, force: true });
      removed++;
    }
  }

  const feed = feedXml(products, site, cfg);
  if (await writeIfChanged(path.join(outRoot, "sitemap.xml"), sitemapXml(products, site))) changed++;
  if (await writeIfChanged(path.join(outRoot, "robots.txt"), robotsTxt(site))) changed++;
  if (await writeIfChanged(path.join(outRoot, "feed", "google-merchant.xml"), feed.body)) changed++;

  const indexFile = path.join(outRoot, "index.html");
  const indexHtml = await readIfExists(indexFile);
  if (indexHtml && /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/.test(indexHtml)) {
    const next = indexHtml.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, () => homeSeoBlock(site, cfg));
    if (next !== indexHtml) {
      await writeFile(indexFile, next, "utf8");
      changed++;
    }
  }

  console.log(`Pages written/updated: ${changed}. Removed pages: ${removed}. Feed items: ${feed.count}.`);
}

main().catch((err) => {
  console.error("SEO build failed:", err.message);
  process.exit(1);
});
