const CACHE = "piyasa-masasi-workspace-v8";
const STATIC = ["./", "./index.html", "./styles.css", "./portfolio-engine.js", "./app.js", "./manifest.webmanifest", "./icon.svg"];
const REPORT = "./data/report.json";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(STATIC.map(url => cache.add(url).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/data/report.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(REPORT, response.clone()));
      return response;
    }).catch(() => caches.match(REPORT, { ignoreSearch: true })));
    return;
  }
  event.respondWith(fetch(event.request, { cache: "no-cache" }).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
