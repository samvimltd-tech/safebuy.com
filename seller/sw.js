/* SafeBuy Seller service worker.
   - Pages are always fetched fresh from the network (so staff never run old admin code); the cache is only a fallback.
   - Only files of this app are touched. Supabase, Paystack and CDN requests are never cached. */
const VERSION = "seller-v1";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("seller-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .catch(() => new Response('<meta name=viewport content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>You are offline</h2><p>Connect to the internet and open the app again.</p>', {headers:{'Content-Type':'text/html'}}))
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req))
  );
});
