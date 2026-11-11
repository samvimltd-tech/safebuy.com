#!/usr/bin/env python3
"""SafeBuy NG SEO generator. Reads the PUBLIC product view from Supabase and writes crawlable static pages:
   shop/<shop>/index.html, p/<product>/index.html, sitemap.xml, robots.txt.  Only public data is used (anon key).
   Old shop/ and p/ pages are rebuilt from scratch every run, so removed products disappear automatically."""
import json, os, re, shutil, sys, urllib.request, urllib.parse, html, datetime

BASE = os.environ.get("SB_SITE", "https://samvimltd-tech.github.io/safebuy.com").rstrip("/")
OUT = os.environ.get("SB_OUT", ".")
SITE = "SafeBuy NG"

def cfg():
    url, key = os.environ.get("SB_URL"), os.environ.get("SB_KEY")
    if url and key: return url.rstrip("/"), key
    t = open(os.path.join(OUT, "supabase-config.js"), encoding="utf-8").read()
    u = re.search(r"https://[A-Za-z0-9-]+\.supabase\.co", t)
    k = re.search(r"sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+", t)
    if not u or not k: sys.exit("Could not read supabase-config.js")
    return u.group(0), k.group(0)

def fetch_all():
    url, key = cfg(); rows = []; off = 0
    while True:
        req = urllib.request.Request(url + "/rest/v1/seller_products_public?select=*&order=created_at.desc&limit=1000&offset=%d" % off,
                                     headers={"apikey": key, "Authorization": "Bearer " + key})
        with urllib.request.urlopen(req, timeout=60) as r: part = json.load(r)
        rows += part
        if len(part) < 1000: return rows
        off += 1000

def esc(s): return html.escape(str(s if s is not None else ""), quote=True)
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")
    return s[:60] or "shop"
def clip(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(" ", 1)[0] + "…"
def naira(k): return "₦{:,.0f}".format(float(k or 0) / 100)
def jld(o): return '<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False).replace("</", "<\\/") + "</script>"

CSS = ("body{margin:0;font:19px/1.6 Arial,Helvetica,sans-serif;color:#172b24;background:#f7f9f7}a{color:#066548}"
       "header{background:#087f5b;padding:14px 18px}header a{color:#fff;font-weight:800;font-size:22px;text-decoration:none}"
       "main{max-width:860px;margin:0 auto;padding:18px}h1{font-size:32px;line-height:1.2;margin:.3em 0}"
       ".crumb{font-size:16px;color:#4f5f57}.price{font-size:34px;font-weight:800;color:#066548;margin:.2em 0}"
       "img.hero{width:100%;max-height:520px;object-fit:contain;background:#fff;border-radius:18px}"
       ".btn{display:inline-block;background:#087f5b;color:#fff!important;font-weight:800;padding:14px 22px;border-radius:14px;text-decoration:none;margin:8px 8px 8px 0}"
       ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:0;list-style:none}"
       ".grid li{background:#fff;border:1px solid #e6ece8;border-radius:16px;overflow:hidden}.grid a{display:block;padding:12px;text-decoration:none;color:inherit}"
       ".grid img{width:100%;height:170px;object-fit:cover}.grid b{display:block;font-size:18px}.grid span{color:#066548;font-weight:800}"
       "footer{padding:24px 18px;text-align:center;color:#4f5f57;font-size:16px}")

def page(title, desc, canon, body, ld, img=None, typ="website"):
    og = ('<meta property="og:type" content="%s"><meta property="og:site_name" content="%s"><meta property="og:title" content="%s">'
          '<meta property="og:description" content="%s"><meta property="og:url" content="%s">' % (typ, SITE, esc(title), esc(desc), esc(canon)))
    if img: og += '<meta property="og:image" content="%s"><meta name="twitter:card" content="summary_large_image">' % esc(img)
    return ('<!doctype html><html lang="en-NG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="%s"><meta name="robots" content="index,follow,max-image-preview:large">%s%s'
            '<style>%s</style></head><body><header><a href="%s/">%s</a></header><main>%s</main>'
            '<footer>%s · Nigerian sellers · Prices in Naira · <a href="%s/#shop">Browse all products</a></footer></body></html>'
            % (esc(title), esc(desc), esc(canon), og, "".join(jld(x) for x in ld), CSS, BASE, SITE, body, SITE, BASE))

def build():
    rows = [r for r in fetch_all() if r.get("name") and r.get("shop_name")]
    shops, used_shop, used_prod = {}, set(), set()
    for r in rows:
        shops.setdefault(r["shop_name"].strip(), []).append(r)
    shop_slug = {}
    for name in sorted(shops):
        s = slugify(name); base = s; n = 2
        while s in used_shop: s = "%s-%d" % (base, n); n += 1
        used_shop.add(s); shop_slug[name] = s
    for name, items in shops.items():
        for r in items:
            s = r.get("slug") if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", r.get("slug") or "") else slugify(r["name"]) + "-" + str(r.get("id", ""))[:6]
            if s in used_prod: s = s + "-" + str(r.get("id", ""))[:6]
            used_prod.add(s); r["_slug"] = s

    for d in ("shop", "p"): shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)
    urls = [(BASE + "/", None, "daily", "1.0")]
    def write(rel, text):
        p = os.path.join(OUT, rel, "index.html"); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8").write(text)

    for name, items in shops.items():
        sl = shop_slug[name]; canon = "%s/shop/%s/" % (BASE, sl)
        cats = []; [cats.append(c) for c in (x.get("category") for x in items) if c and c not in cats]
        prices = [float(x.get("price_kobo") or 0) for x in items if x.get("price_kobo")]
        rng = (" from %s" % naira(min(prices))) if prices else ""
        title = clip("%s – %d product%s on %s" % (name, len(items), "" if len(items) == 1 else "s", SITE), 60)
        desc = clip("Shop %s%s on %s: %s. Buy from a Nigerian seller, pay in Naira and chat with the seller directly." % (
            name, rng, SITE, ", ".join(cats[:4]) or "products"), 158)
        verified = any(x.get("verified") for x in items)
        li = "".join('<li><a href="%s/p/%s/">%s<b>%s</b><span>%s</span></a></li>' % (
            BASE, x["_slug"], ('<img loading="lazy" src="%s" alt="%s">' % (esc(x["image_url"]), esc(x["name"]))) if x.get("image_url") else "",
            esc(x["name"]), naira(x.get("price_kobo"))) for x in items)
        body = ('<p class="crumb"><a href="%s/">Home</a> › Shops › %s</p><h1>%s%s</h1><p>%s</p><ul class="grid">%s</ul><a class="btn" href="%s/#shop">Open %s</a>'
                % (BASE, esc(name), esc(name), " ✔" if verified else "", esc(desc), li, BASE, SITE))
        ld = [{"@context": "https://schema.org", "@type": "Store", "name": name, "url": canon, "description": desc, "currenciesAccepted": "NGN",
               "areaServed": {"@type": "Country", "name": "Nigeria"}, **({"image": items[0]["image_url"]} if items[0].get("image_url") else {})},
              {"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
                  {"@type": "ListItem", "position": i + 1, "url": "%s/p/%s/" % (BASE, x["_slug"]), "name": x["name"]} for i, x in enumerate(items[:50])]},
              {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                  {"@type": "ListItem", "position": 1, "name": SITE, "item": BASE + "/"}, {"@type": "ListItem", "position": 2, "name": name, "item": canon}]}]
        write("shop/" + sl, page(title, desc, canon, body, ld, items[0].get("image_url")))
        urls.append((canon, max((x.get("updated_at") or x.get("created_at") or "")[:10] for x in items) or None, "daily", "0.8"))

        for x in items:
            pc = "%s/p/%s/" % (BASE, x["_slug"]); instock = x.get("in_stock") is not False
            ptitle = clip("%s – %s | %s" % (x["name"], naira(x.get("price_kobo")), name), 60)
            pdesc = clip("%s Sold by %s on %s. %s in Naira%s." % (x.get("description") or x["name"], name, SITE, naira(x.get("price_kobo")),
                         "" if instock else ", currently out of stock"), 158)
            offer = {"@type": "Offer", "url": pc, "priceCurrency": "NGN", "price": "%.2f" % (float(x.get("price_kobo") or 0) / 100),
                     "availability": "https://schema.org/InStock" if instock else "https://schema.org/OutOfStock",
                     "itemCondition": "https://schema.org/UsedCondition" if str(x.get("condition") or "").lower() in ("used", "fairly used", "fairly-used") else "https://schema.org/NewCondition",
                     "seller": {"@type": "Organization", "name": name, "url": canon}}
            prod = {"@context": "https://schema.org", "@type": "Product", "name": x["name"], "sku": str(x.get("id", "")), "url": pc,
                    "description": clip(x.get("description") or x["name"], 500), "brand": {"@type": "Brand", "name": name}, "offers": offer}
            if x.get("category"): prod["category"] = x["category"]
            if x.get("image_url"): prod["image"] = [x["image_url"]]
            crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": SITE, "item": BASE + "/"}, {"@type": "ListItem", "position": 2, "name": name, "item": canon},
                {"@type": "ListItem", "position": 3, "name": x["name"], "item": pc}]}
            more = "".join('<li><a href="%s/p/%s/"><b>%s</b><span>%s</span></a></li>' % (BASE, y["_slug"], esc(y["name"]), naira(y.get("price_kobo")))
                           for y in items if y is not x)[:6000]
            pbody = ('<p class="crumb"><a href="%s/">Home</a> › <a href="%s">%s</a> › %s</p>%s<h1>%s</h1><div class="price">%s</div><p><b>%s</b>%s%s</p><p>%s</p>'
                     '<a class="btn" href="%s/#shop">Buy on %s</a><a class="btn" href="%s">More from %s</a>%s'
                     % (BASE, canon, esc(name), esc(x["name"]),
                        ('<img class="hero" src="%s" alt="%s">' % (esc(x["image_url"]), esc(x["name"]))) if x.get("image_url") else "",
                        esc(x["name"]), naira(x.get("price_kobo")), "In stock" if instock else "Out of stock",
                        (" · " + esc(x["condition"])) if x.get("condition") else "", (" · " + esc(x["category"])) if x.get("category") else "",
                        esc(x.get("description") or ""), BASE, SITE, canon, esc(name),
                        ('<h2>More from %s</h2><ul class="grid">%s</ul>' % (esc(name), more)) if more else ""))
            write("p/" + x["_slug"], page(ptitle, pdesc, pc, pbody, [prod, crumbs], x.get("image_url"), "product"))
            if instock: urls.append((pc, (x.get("updated_at") or x.get("created_at") or "")[:10] or None, "weekly", "0.6"))

    sm = ['<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lm, cf, pr in urls:
        sm.append("<url><loc>%s</loc>%s<changefreq>%s</changefreq><priority>%s</priority></url>" % (esc(loc), ("<lastmod>%s</lastmod>" % lm) if lm else "", cf, pr))
    sm.append("</urlset>")
    open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm))
    open(os.path.join(OUT, "robots.txt"), "w").write("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /seller/\nDisallow: /rider/\n\nSitemap: %s/sitemap.xml\n" % BASE)
    print("shops:", len(shops), "products:", len(rows), "sitemap urls:", len(urls))

if __name__ == "__main__": build()
