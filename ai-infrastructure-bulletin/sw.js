const CACHE = "piyasa-masasi-workspace-v19";
const STATIC = [
  "./",
  "./index.html",
  "./styles.css",
  "./portfolio-engine.js",
  "./app.js",
  "./ui-controls.js",
  "./market-integration.js",
  "./market-workspace-core.js",
  "./native-intraday-core.js",
  "./workspace-enhancements.js",
  "./market-live-bridge.js",
  "./chart-fetch-fallback.js",
  "./live-market.js",
  "./live-market-core.js",
  "./live-session-control.js",
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
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map(client => client.url.includes("/ai-infrastructure-bulletin/") ? client.navigate(client.url).catch(() => null) : null));
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // The browser live layer owns all third-party quote and chart requests.
  if (url.origin !== self.location.origin) return;

  const marketData = url.pathname.endsWith("/data/report.json")
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
