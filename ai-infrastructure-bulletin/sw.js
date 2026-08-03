const CACHE = "piyasa-masasi-workspace-v13";
const STATIC = [
  "./",
  "./index.html",
  "./styles.css",
  "./portfolio-engine.js",
  "./app.js",
  "./market-integration.js",
  "./ui-controls.js",
  "./broker-import.js",
  "./broker-import-csv.js",
  "./portfolio-import-ui.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/xlsx.full.min.js",
  "./manifest.webmanifest",
  "./icon.svg"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(STATIC.map(url => cache.add(url).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.pathname.endsWith("/data/report.json") || url.pathname.endsWith("/mic/data/market.json") || url.pathname.endsWith("/mic/data/nasdaq-quotes.json") || url.pathname.includes("/mic/data/history/")) {
    event.respondWith(fetch(event.request, { cache: "no-cache" }).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true })));
    return;
  }

  event.respondWith(fetch(event.request, { cache: "no-cache" }).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
