const CACHE = "piyasa-masasi-workspace-v16";
const STATIC = [
  "./",
  "./index.html",
  "./styles.css",
  "./portfolio-engine.js",
  "./app.js",
  "./market-integration.js",
  "./bist-widget-guard.js",
  "./workspace-enhancements.js",
  "./live-market.js",
  "./live-market-core.js",
  "./market-live-bridge.js",
  "./chart-fetch-fallback.js",
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

const MARKET_INTEGRATION = "./market-integration.js";
const BIST_WIDGET_GUARD = "./bist-widget-guard.js";
const WORKSPACE_ENHANCEMENTS = "./workspace-enhancements.js";
const LIVE_MARKET_BOOTSTRAP = "./live-market.js";

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

async function combineMarketIntegration(request) {
  const cache = await caches.open(CACHE);
  try {
    const [baseResponse, guardResponse, enhancementsResponse, liveResponse] = await Promise.all([
      fetch(request, { cache: "no-cache" }),
      fetch(BIST_WIDGET_GUARD, { cache: "no-cache" }),
      fetch(WORKSPACE_ENHANCEMENTS, { cache: "no-cache" }),
      fetch(LIVE_MARKET_BOOTSTRAP, { cache: "no-cache" })
    ]);
    if (!baseResponse.ok || !guardResponse.ok || !enhancementsResponse.ok || !liveResponse.ok) {
      throw new Error("Market workspace files are unavailable");
    }
    const [base, guard, enhancements, live] = await Promise.all([
      baseResponse.text(),
      guardResponse.text(),
      enhancementsResponse.text(),
      liveResponse.text()
    ]);
    const combined = new Response(
      `${base}\n\n/* BIST native intraday workspace */\n${guard}\n\n/* Workspace enhancements */\n${enhancements}\n\n/* MIC live-market bootstrap */\n${live}`,
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache"
        }
      }
    );
    await cache.put(MARKET_INTEGRATION, combined.clone());
    return combined;
  } catch (_) {
    const cached = await cache.match(MARKET_INTEGRATION, { ignoreSearch: true });
    return cached || Response.error();
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Never proxy or cache third-party quote/chart requests. The live layer handles
  // direct, query2 and AllOrigins fallbacks itself.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/ai-infrastructure-bulletin/market-integration.js")) {
    event.respondWith(combineMarketIntegration(event.request));
    return;
  }

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
