(() => {
  "use strict";

  if (window.__PM_MARKET_LIVE_SESSION__) return;
  window.__PM_MARKET_LIVE_SESSION__ = true;

  const SESSION_KEY = "piyasa-masasi-ai.live-session.v3";
  const PRIORITY_INTERVAL = 30_000;
  const FULL_RESCAN_INTERVAL = 10 * 60_000;
  const BATCH_SIZE = 40;
  const CONCURRENCY = 4;
  const REQUEST_TIMEOUT = 10_000;

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
  const normalize = value => String(value || "").trim().toUpperCase();
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
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
    const pill = $("freshness");
    const detail = ensureDetail();
    const button = $("refresh");
    const localButton = $("pmReloadMarket");
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
      pill.textContent = T("Canlı izleme açık · yeniden deneniyor", "Live monitoring on · retrying");
      pill.className = "status-pill warning";
      if (detail) detail.textContent = T("Öncelikli hisseler için alternatif veri yolları deneniyor.", "Alternative data routes are being tried for priority equities.");
    } else {
      pill.textContent = T("Canlı izleme açık", "Live monitoring on");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${T("Son başarılı kontrol", "Last successful check")}: ${formatTime(live.lastSuccessAt)} · ${T("öncelikli", "priority")}: ${live.priorityUpdated}/${live.priorityTotal}${live.scanning ? ` · ${live.updated}/${live.total}` : ""}`;
    }
    if (button) button.textContent = T("Şimdi yenile", "Refresh now");
    if (localButton) localButton.textContent = T("Şimdi yenile", "Refresh now");
  }

  function assets() { return window.PiyasaMarketWorkspace?.getAssets?.() || []; }
  function provider(asset) { return asset?.providerSymbol || (asset?.market === "BIST" ? `${asset.symbol}.IS` : asset?.symbol); }
  function chunk(values, size) { const output = []; for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size)); return output; }

  async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json,text/plain,*/*" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function firstSuccessful(urls) {
    const attempts = urls.map(url => fetchWithTimeout(url));
    try { return await Promise.any(attempts); }
    catch (error) { throw error?.errors?.at(-1) || error; }
  }

  function quoteCandidates(symbols) {
    const joined = symbols.join(",");
    const direct = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joined)}`;
    return [direct, direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"), `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, `https://corsproxy.io/?url=${encodeURIComponent(direct)}`];
  }

  async function fetchBatch(symbols) {
    if (!symbols.length) return new Map();
    const payload = await firstSuccessful(quoteCandidates(symbols));
    const rows = payload?.quoteResponse?.result;
    if (!Array.isArray(rows)) throw new Error("INVALID_QUOTE_RESPONSE");
    return new Map(rows.map(row => [normalize(row.symbol), {
      symbol: normalize(row.symbol),
      price: row.regularMarketPrice,
      changePercent: row.regularMarketChangePercent,
      volume: row.regularMarketVolume,
      marketCap: row.marketCap,
      timestamp: Number(row.regularMarketTime || 0) * 1000 || Date.now(),
      source: "MIC · Yahoo Finance quote"
    }]).filter(([, quote]) => Number.isFinite(Number(quote.price))));
  }

  async function fetchChartQuote(symbol) {
    const direct = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&events=history&includePrePost=false`;
    const payload = await firstSuccessful([direct, direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"), `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, `https://corsproxy.io/?url=${encodeURIComponent(direct)}`, `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(direct)}`]);
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_CHART_QUOTE");
    const close = result.indicators?.quote?.[0]?.close || [];
    let last = null;
    for (let index = close.length - 1; index >= 0; index -= 1) if (Number.isFinite(Number(close[index]))) { last = Number(close[index]); break; }
    const meta = result.meta || {};
    const price = Number.isFinite(Number(meta.regularMarketPrice)) ? Number(meta.regularMarketPrice) : last;
    if (!Number.isFinite(price)) throw new Error("CHART_PRICE_MISSING");
    const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
    return new Map([[normalize(symbol), {
      symbol: normalize(symbol),
      price,
      changePercent: Number.isFinite(previous) && previous ? (price / previous - 1) * 100 : null,
      volume: null,
      marketCap: null,
      timestamp: Number(meta.regularMarketTime || 0) * 1000 || Date.now(),
      source: "MIC · Yahoo Finance chart"
    }]]);
  }

  function dispatchQuotes(quotes) {
    if (!quotes?.size) return 0;
    window.dispatchEvent(new CustomEvent("piyasa-market-quotes", { detail: { quotes } }));
    live.lastSuccessAt = Date.now();
    return quotes.size;
  }

  async function requestAsset(asset) {
    if (!asset) return null;
    const symbol = normalize(provider(asset));
    if (!symbol) return null;
    live.lastAttemptAt = Date.now();
    try {
      let quotes = await fetchBatch([symbol]);
      if (!quotes.has(symbol)) quotes = await fetchChartQuote(symbol);
      dispatchQuotes(quotes);
      live.lastError = null;
      updateUi();
      return quotes.get(symbol) || null;
    } catch (batchError) {
      try {
        const quotes = await fetchChartQuote(symbol);
        dispatchQuotes(quotes);
        live.lastError = null;
        updateUi();
        return quotes.get(symbol) || null;
      } catch (chartError) {
        live.lastError = chartError || batchError;
        updateUi();
        return null;
      }
    }
  }

  function priorityAssets() {
    const all = assets();
    const keys = new Set();
    const selected = window.PiyasaMarketWorkspace?.getSelected?.();
    if (selected?.key) keys.add(selected.key);
    document.querySelectorAll("#pmAssetList [data-pm-key]").forEach(node => { if (node.offsetParent !== null) keys.add(node.dataset.pmKey); });
    for (const asset of window.PiyasaResearchIntelligence?.getPersonalAssets?.() || []) keys.add(asset.key);
    try {
      for (const transaction of state?.portfolio?.transactions || []) {
        const symbol = normalize(transaction.symbol).replace(/\.IS$/, "");
        all.filter(asset => asset.symbol === symbol && (String(transaction.currency).toUpperCase() === "TRY" ? asset.market === "BIST" : true)).forEach(asset => keys.add(asset.key));
      }
    } catch (_) {}
    return all.filter(asset => keys.has(asset.key)).slice(0, 120);
  }

  async function refreshPriority() {
    if (!live.active) return;
    const list = priorityAssets();
    live.priorityTotal = list.length;
    live.priorityUpdated = 0;
    if (!list.length) { updateUi(); return; }
    const symbols = [...new Set(list.map(provider).map(normalize).filter(Boolean))];
    const batches = chunk(symbols, 20);
    for (const batch of batches) {
      try {
        const quotes = await fetchBatch(batch);
        live.priorityUpdated += dispatchQuotes(quotes);
        const missing = batch.filter(symbol => !quotes.has(symbol));
        for (const symbol of missing.slice(0, 8)) {
          try { live.priorityUpdated += dispatchQuotes(await fetchChartQuote(symbol)); } catch (_) {}
        }
      } catch (_) {
        for (const symbol of batch.slice(0, 12)) {
          try { live.priorityUpdated += dispatchQuotes(await fetchChartQuote(symbol)); } catch (error) { live.lastError = error; }
        }
      }
      updateUi(T("Öncelikli hisseler yenileniyor", "Refreshing priority equities"));
    }
  }

  async function fullScan() {
    if (!live.active || live.scanning) return;
    live.scanning = true;
    live.generation += 1;
    const generation = live.generation;
    live.processed = 0;
    live.updated = 0;
    live.total = assets().length;
    live.lastAttemptAt = Date.now();
    updateUi(T("Öncelikli hisseler yenileniyor", "Refreshing priority equities"));
    await refreshPriority();
    const symbols = [...new Set(assets().map(provider).map(normalize).filter(Boolean))];
    const batches = chunk(symbols, BATCH_SIZE);
    let consecutiveFailures = 0;
    for (let offset = 0; offset < batches.length; offset += CONCURRENCY) {
      if (!live.active || generation !== live.generation) break;
      const group = batches.slice(offset, offset + CONCURRENCY);
      const results = await Promise.allSettled(group.map(fetchBatch));
      for (let index = 0; index < results.length; index += 1) {
        live.processed += group[index].length;
        if (results[index].status === "fulfilled") {
          const count = dispatchQuotes(results[index].value);
          live.updated += count;
          consecutiveFailures = count ? 0 : consecutiveFailures + 1;
        } else {
          live.lastError = results[index].reason;
          consecutiveFailures += 1;
        }
      }
      updateUi(T("Tüm hisse evreni yenileniyor", "Refreshing full equity universe"));
      if (consecutiveFailures >= 12) break;
      await sleep(180);
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
    schedule();
    updateUi(T("Piyasa dosyaları yenileniyor", "Refreshing market files"));
    await window.PiyasaMarketWorkspace?.refresh?.(true);
    await refreshPriority();
    fullScan();
  }

  function stop() {
    live.active = false;
    live.generation += 1;
    sessionStorage.removeItem(SESSION_KEY);
    clearInterval(live.priorityTimer); clearInterval(live.fullTimer);
    live.priorityTimer = null; live.fullTimer = null;
    updateUi();
  }

  function bind() {
    const button = $("refresh");
    if (button) button.onclick = event => { event.preventDefault(); start(); };
    const localButton = $("pmReloadMarket");
    if (localButton) localButton.onclick = event => { event.preventDefault(); start(); };
    window.addEventListener("pm-market-asset-change", event => { if (live.active && event.detail?.asset) requestAsset(event.detail.asset); });
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
    _test: { fetchBatch, fetchChartQuote, priorityAssets }
  };

  bind();
})();
