(() => {
  "use strict";

  if (window.__PM_MARKET_LIVE_SESSION__) return;
  window.__PM_MARKET_LIVE_SESSION__ = true;

  const SESSION_KEY = "piyasa-masasi-ai.live-session.v4";
  const PRIORITY_INTERVAL = 30_000;
  const FULL_RESCAN_INTERVAL = 10 * 60_000;
  const BATCH_SIZE = 100;
  const CONCURRENCY = 3;
  const REQUEST_TIMEOUT = 12_000;

  const live = {
    active: sessionStorage.getItem(SESSION_KEY) === "1",
    scanning: false,
    total: 0,
    processed: 0,
    updated: 0,
    priorityTotal: 0,
    priorityUpdated: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    priorityTimer: null,
    fullTimer: null,
    generation: 0
  };

  const $ = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const assets = () => window.PiyasaMarketWorkspace?.getAssets?.() || [];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function ensureDetail() {
    const pill = $("freshness");
    if (!pill) return null;
    let detail = $("freshnessDetail");
    if (!detail) {
      detail = document.createElement("span");
      detail.id = "freshnessDetail";
      detail.className = "freshness-detail";
      pill.insertAdjacentElement("afterend", detail);
    }
    return detail;
  }

  function formatTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(language() === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Muscat" }).format(new Date(value));
  }

  function updateUi(activity = "") {
    const pill = $("freshness"), detail = ensureDetail(), button = $("refresh"), localButton = $("pmReloadMarket");
    if (!pill) return;
    if (!live.active) {
      pill.textContent = T("Canlı izleme kapalı", "Live monitoring off");
      pill.className = "status-pill neutral";
      if (detail) detail.textContent = T("Yenile'ye basınca seçili, görünür, liste ve portföy hisseleri 30 saniyede bir güncellenir.", "Press Refresh to update selected, visible, watchlist and portfolio equities every 30 seconds.");
      if (button) button.textContent = T("Yenile ve izlemeyi başlat", "Refresh and start monitoring");
      if (localButton) localButton.textContent = T("Yenile ve izlemeyi başlat", "Refresh and start monitoring");
      return;
    }
    if (live.scanning) {
      pill.textContent = T("Canlı izleme açık · güncelleniyor", "Live monitoring on · updating");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${activity || T("Hisse evreni taranıyor", "Scanning equity universe")} · ${live.processed}/${live.total} · ${T("güncellenen", "updated")}: ${live.updated} · ${T("öncelikli", "priority")}: ${live.priorityUpdated}/${live.priorityTotal}`;
    } else if (live.lastError && !live.lastSuccessAt) {
      pill.textContent = T("Canlı izleme açık · yayımlanmış fiyat kullanılıyor", "Live monitoring on · using published price");
      pill.className = "status-pill warning";
      if (detail) detail.textContent = T("Tarayıcı veri kaynağı yeniden denenecek.", "The browser data source will be retried.");
    } else {
      pill.textContent = T("Canlı izleme açık", "Live monitoring on");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${T("Son başarılı kontrol", "Last successful check")}: ${formatTime(live.lastSuccessAt)} · ${T("öncelikli", "priority")}: ${live.priorityUpdated}/${live.priorityTotal}`;
    }
    if (button) button.textContent = T("Şimdi yenile", "Refresh now");
    if (localButton) localButton.textContent = T("Şimdi yenile", "Refresh now");
  }

  function scannerEndpoint(market) {
    return market === "BIST" ? "https://scanner.tradingview.com/turkey/scan" : "https://scanner.tradingview.com/america/scan";
  }

  function scannerTicker(asset) {
    if (asset.market === "BIST") return `BIST:${asset.symbol}`;
    const exchange = String(asset.exchange || "NASDAQ").toUpperCase();
    const known = ["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "CBOE", "OTC"];
    return `${known.includes(exchange) ? exchange : "NASDAQ"}:${asset.symbol}`;
  }

  function providerSymbol(asset) {
    return asset.providerSymbol || (asset.market === "BIST" ? `${asset.symbol}.IS` : asset.symbol);
  }

  async function postScanner(endpoint, tickers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: ["name", "close", "change", "volume", "market_cap_basic", "update_mode"] })
      });
      if (!response.ok) throw new Error(`SCANNER_HTTP_${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function fetchScanner(list) {
    const output = new Map();
    for (const market of ["BIST", "US"]) {
      const group = list.filter(asset => asset.market === market);
      if (!group.length) continue;
      const tickerToAsset = new Map(group.map(asset => [scannerTicker(asset), asset]));
      const payload = await postScanner(scannerEndpoint(market), [...tickerToAsset.keys()]);
      for (const row of payload?.data || []) {
        const asset = tickerToAsset.get(String(row.s || "").toUpperCase());
        const data = row.d || [];
        const price = finite(data[1]);
        if (!asset || price === null) continue;
        output.set(providerSymbol(asset).toUpperCase(), {
          symbol: providerSymbol(asset).toUpperCase(),
          price,
          changePercent: finite(data[2]),
          volume: finite(data[3]),
          marketCap: finite(data[4]),
          timestamp: Date.now(),
          source: "MIC browser scanner"
        });
      }
    }
    return output;
  }

  function snapshotQuote(asset) {
    const price = finite(asset?.price);
    if (price === null) return null;
    return {
      symbol: providerSymbol(asset).toUpperCase(),
      price,
      changePercent: finite(asset.change),
      volume: finite(asset.volume),
      marketCap: finite(asset.marketCap),
      timestamp: finite(asset.quoteAt) || Date.now(),
      source: T("MIC yayımlanmış fiyat", "MIC published price")
    };
  }

  function dispatchQuotes(quotes) {
    if (!quotes?.size) return 0;
    window.dispatchEvent(new CustomEvent("piyasa-market-quotes", { detail: { quotes } }));
    return quotes.size;
  }

  async function requestAsset(asset) {
    if (!asset) return null;
    live.lastAttemptAt = Date.now();
    try {
      const quotes = await fetchScanner([asset]);
      const quote = quotes.get(providerSymbol(asset).toUpperCase());
      if (!quote) throw new Error("SCANNER_QUOTE_MISSING");
      dispatchQuotes(quotes);
      live.lastSuccessAt = Date.now();
      live.lastError = null;
      updateUi();
      return quote;
    } catch (error) {
      live.lastError = error;
      const fallback = snapshotQuote(asset);
      if (fallback) dispatchQuotes(new Map([[fallback.symbol, fallback]]));
      updateUi();
      return fallback;
    }
  }

  function priorityAssets() {
    const all = assets(), keys = new Set();
    const selected = window.PiyasaMarketWorkspace?.getSelected?.();
    if (selected?.key) keys.add(selected.key);
    document.querySelectorAll("#pmAssetList [data-pm-key]").forEach(node => { if (node.offsetParent !== null) keys.add(node.dataset.pmKey); });
    for (const asset of window.PiyasaResearchIntelligence?.getPersonalAssets?.() || []) keys.add(asset.key);
    try {
      for (const transaction of state?.portfolio?.transactions || []) {
        const symbol = String(transaction.symbol || "").toUpperCase().replace(/\.IS$/, "");
        all.filter(asset => asset.symbol === symbol && (String(transaction.currency).toUpperCase() === "TRY" ? asset.market === "BIST" : true)).forEach(asset => keys.add(asset.key));
      }
    } catch (_) {}
    return all.filter(asset => keys.has(asset.key)).slice(0, 150);
  }

  function chunks(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
    return result;
  }

  async function refreshPriority() {
    if (!live.active) return;
    const list = priorityAssets();
    live.priorityTotal = list.length;
    live.priorityUpdated = 0;
    for (const batch of chunks(list, BATCH_SIZE)) {
      try {
        const quotes = await fetchScanner(batch);
        live.priorityUpdated += dispatchQuotes(quotes);
        live.lastSuccessAt = quotes.size ? Date.now() : live.lastSuccessAt;
        live.lastError = quotes.size ? null : live.lastError;
      } catch (error) {
        live.lastError = error;
        for (const asset of batch) {
          const fallback = snapshotQuote(asset);
          if (fallback) dispatchQuotes(new Map([[fallback.symbol, fallback]]));
        }
      }
      updateUi(T("Öncelikli hisseler yenileniyor", "Refreshing priority equities"));
    }
  }

  async function fullScan() {
    if (!live.active || live.scanning) return;
    live.scanning = true;
    const generation = ++live.generation;
    live.total = assets().length;
    live.processed = 0;
    live.updated = 0;
    await refreshPriority();
    const groups = chunks(assets(), BATCH_SIZE);
    for (let offset = 0; offset < groups.length; offset += CONCURRENCY) {
      if (!live.active || generation !== live.generation) break;
      const block = groups.slice(offset, offset + CONCURRENCY);
      const results = await Promise.allSettled(block.map(fetchScanner));
      results.forEach((result, index) => {
        live.processed += block[index].length;
        if (result.status === "fulfilled") live.updated += dispatchQuotes(result.value);
        else live.lastError = result.reason;
      });
      updateUi(T("Tüm hisse evreni yenileniyor", "Refreshing full equity universe"));
      await sleep(150);
    }
    if (generation === live.generation) live.scanning = false;
    updateUi();
  }

  function schedule() {
    clearInterval(live.priorityTimer); clearInterval(live.fullTimer);
    live.priorityTimer = setInterval(() => { if (live.active && !document.hidden) refreshPriority(); }, PRIORITY_INTERVAL);
    live.fullTimer = setInterval(() => { if (live.active && !document.hidden) fullScan(); }, FULL_RESCAN_INTERVAL);
  }

  async function start() {
    live.active = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    schedule(); updateUi(T("Piyasa dosyaları yenileniyor", "Refreshing market files"));
    await window.PiyasaMarketWorkspace?.refresh?.(true);
    await refreshPriority();
  }

  function stop() {
    live.active = false; live.generation += 1;
    sessionStorage.removeItem(SESSION_KEY);
    clearInterval(live.priorityTimer); clearInterval(live.fullTimer);
    live.priorityTimer = null; live.fullTimer = null;
    updateUi();
  }

  function bind() {
    if ($("refresh")) $("refresh").onclick = event => { event.preventDefault(); start(); };
    if ($("pmReloadMarket")) $("pmReloadMarket").onclick = event => { event.preventDefault(); start(); };
    window.addEventListener("pm-market-asset-change", event => { if (event.detail?.asset) requestAsset(event.detail.asset); });
    window.addEventListener("piyasa-personal-list-change", () => { if (live.active) refreshPriority(); });
    document.addEventListener("visibilitychange", () => { if (live.active && !document.hidden) refreshPriority(); });
    window.addEventListener("pagehide", () => { clearInterval(live.priorityTimer); clearInterval(live.fullTimer); });
    updateUi();
    if (live.active) { schedule(); setTimeout(refreshPriority, 0); }
  }

  window.PiyasaMarketLive = {
    state: live,
    start,
    stop,
    refresh: fullScan,
    requestAsset,
    isActive: () => live.active,
    _test: { scannerTicker, fetchScanner, priorityAssets }
  };

  bind();
})();
