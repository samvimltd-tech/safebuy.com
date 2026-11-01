/* SafeBuy NG service worker.
   Pages and scripts always come from the network (revalidated, so GitHub's 10 minute cache cannot show an old version);
   the saved copy is only used when the phone is offline. Raise CACHE on each release to drop old saved files. */
const CACHE = "safebuy-v4";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});
function fresh(req) {
  // a page navigation cannot be re-wrapped with options, so build a plain request for it
  var r = req.mode === "navigate"
    ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" })
    : new Request(req, { cache: "no-cache" });
  return fetch(r);
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fresh(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
