/* SafeBuy NG service worker v2: always asks the network first, so updated files show up immediately.
   Falls back to the saved copy (or the offline page) only when there is no connection. */
const V = "safebuy-v2", SHELL = ["./", "./offline.html", "./manifest.webmanifest", "./icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  // Never touch Supabase, Paystack, WhatsApp or any other site: live data and payments stay uncached.
  if (r.method !== "GET" || u.origin !== location.origin) return;
  const req = r.mode === "navigate" ? r : new Request(r, { cache: "no-cache" });
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === "navigate" ? caches.match("./offline.html") : Response.error()))));
});
