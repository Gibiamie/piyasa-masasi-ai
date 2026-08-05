const CACHE = "piyasa-masasi-workspace-v24";
const STATIC = [
  "./",
  "./index.html",
  "./styles.css",
  "./portfolio-engine.js",
  "./app.js",
  "./ui-controls.js",
  "./market-integration.js",
  "./market-core-v2.js",
  "./intraday-core.js",
  "./market-live-session.js",
  "./language-portfolio-runtime.js",
  "./research-core-v2.js",
  "./data/equity-catalog.json",
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
  if (url.origin !== self.location.origin) return;

  const marketData = url.pathname.endsWith("/data/report.json")
    || url.pathname.endsWith("/data/equity-catalog.json")
    || url.pathname.endsWith("/mic/data/market.json")
    || url.pathname.endsWith("/mic/data/nasdaq-quotes.json")
    || url.pathname.includes("/mic/data/history/");

  if (marketData) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then(response => {
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
