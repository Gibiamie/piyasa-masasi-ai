const CACHE = "piyasa-masasi-workspace-v16";
const STATIC = [
  "./",
  "./index.html",
  "./styles.css",
  "./portfolio-engine.js",
  "./app.js",
  "./market-integration.js",
  "./market-live-bridge.js",
  "./live-market.js",
  "./live-market-core.js",
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
const REPORT = "./data/report.json";
const APP_SCRIPT = "./app.js";
const INTEGRATED_APP = "./app.integrated.js";
const INTEGRATION_SCRIPT = "./market-integration.js";
const LIVE_BRIDGE_SCRIPT = "./market-live-bridge.js";

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

const LIVE_BOOTSTRAP = `
(function startLiveMarketAfterControls() {
  if (window.PiyasaLiveMarket || document.querySelector("script[data-live-market]")) return;
  let attempts = 0;
  const start = () => {
    attempts += 1;
    const controlsReady = Boolean(document.getElementById("interactiveControlsStyles"));
    const applicationReady = typeof openAssetDrawer === "function" && typeof renderPortfolio === "function" && typeof renderWatchlist === "function";
    if (!controlsReady || !applicationReady) {
      if (attempts < 400) setTimeout(start, 50);
      return;
    }
    const script = document.createElement("script");
    script.src = "./live-market.js?v=2026.08.03.4";
    script.dataset.liveMarket = "true";
    script.async = false;
    document.head.appendChild(script);
  };
  start();
})();`;

async function combineApplication(baseResponse, integrationResponse, bridgeResponse) {
  if (!baseResponse?.ok || !integrationResponse?.ok || !bridgeResponse?.ok) throw new Error("Application integration files are unavailable");
  const [base, integration, bridge] = await Promise.all([baseResponse.text(), integrationResponse.text(), bridgeResponse.text()]);
  return new Response(`${base}\n\n/* The live drawer owns the single asset-detail chart. */\nwindow.__PM_DRAWER_BRIDGE__ = true;\n\n/* Integrated market and chart workspace */\n${integration}\n\n/* Live quote bridge */\n${bridge}\n\n/* Deterministic live-market bootstrap */\n${LIVE_BOOTSTRAP}`, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}

async function integratedApplication(request) {
  const cache = await caches.open(CACHE);
  try {
    const [base, integration, bridge] = await Promise.all([
      fetch(request, { cache: "no-cache" }),
      fetch(INTEGRATION_SCRIPT, { cache: "no-cache" }),
      fetch(LIVE_BRIDGE_SCRIPT, { cache: "no-cache" })
    ]);
    const combined = await combineApplication(base, integration, bridge);
    await cache.put(INTEGRATED_APP, combined.clone());
    return combined;
  } catch (_) {
    const integrated = await cache.match(INTEGRATED_APP, { ignoreSearch: true });
    if (integrated) return integrated;
    const [base, integration, bridge] = await Promise.all([
      cache.match(APP_SCRIPT, { ignoreSearch: true }),
      cache.match(INTEGRATION_SCRIPT, { ignoreSearch: true }),
      cache.match(LIVE_BRIDGE_SCRIPT, { ignoreSearch: true })
    ]);
    return combineApplication(base, integration, bridge);
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.pathname.endsWith("/ai-infrastructure-bulletin/app.js")) {
    event.respondWith(integratedApplication(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/data/report.json") || url.pathname.endsWith("/mic/data/market.json") || url.pathname.includes("/mic/data/history/")) {
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
