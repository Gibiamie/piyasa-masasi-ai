(() => {
  "use strict";

  if (window.__PM_MARKET_LIVE_SESSION__) return;
  window.__PM_MARKET_LIVE_SESSION__ = true;

  const SESSION_KEY = "piyasa-masasi-ai.live-session.v2";
  const PRIORITY_INTERVAL = 30_000;
  const FULL_RESCAN_INTERVAL = 10 * 60_000;
  const BATCH_SIZE = 100;
  const CONCURRENCY = 3;

  const live = {
    active: sessionStorage.getItem(SESSION_KEY) === "1",
    scanning: false,
    total: 0,
    processed: 0,
    updated: 0,
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
  const text = (tr, en) => language() === "en" ? en : tr;
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
      pill.textContent = text("Canlı izleme kapalı", "Live monitoring off");
      pill.className = "status-pill neutral";
      if (detail) detail.textContent = text("Yenile'ye basınca sekme açık kaldığı sürece fiyatlar güncellenir.", "Press Refresh to update prices while this tab remains open.");
      if (button) button.textContent = text("Yenile ve izlemeyi başlat", "Refresh and start monitoring");
      if (localButton) localButton.textContent = text("Fiyatları yenile ve izlemeyi başlat", "Refresh and start monitoring");
      return;
    }

    if (live.scanning) {
      pill.textContent = text("Canlı izleme açık · güncelleniyor", "Live monitoring on · updating");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${activity || text("Hisse evreni taranıyor", "Scanning equity universe")} · ${live.processed}/${live.total} · ${text("güncellenen", "updated")}: ${live.updated}`;
    } else if (live.lastError && !live.lastSuccessAt) {
      pill.textContent = text("Canlı izleme açık · veri alınamadı", "Live monitoring on · data unavailable");
      pill.className = "status-pill warning";
      if (detail) detail.textContent = text("Şimdi yenile ile yeniden deneyin.", "Press Refresh now to retry.");
    } else {
      pill.textContent = text("Canlı izleme açık", "Live monitoring on");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${text("Son başarılı kontrol", "Last successful check")}: ${formatTime(live.lastSuccessAt)} · ${text("güncellenen", "updated")}: ${live.updated}/${live.total}`;
    }
    if (button) button.textContent = text("Şimdi yenile", "Refresh now");
    if (localButton) localButton.textContent = text("Şimdi yenile", "Refresh now");
  }

  function chunk(values, size) {
    const output = [];
    for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
    return output;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json,text/plain,*/*" } });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function fetchBatch(symbols) {
    if (!symbols.length) return new Map();
    const joined = symbols.join(",");
    const direct = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joined)}`;
    const candidates = [
      direct,
      direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
      `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`
    ];
    let lastError = null;
    for (const url of candidates) {
      try {
        const payload = await fetchJson(url);
        const rows = payload?.quoteResponse?.result;
        if (!Array.isArray(rows)) throw new Error("INVALID_QUOTE_RESPONSE");
        return new Map(rows.map(row => [normalize(row.symbol), {
          symbol: normalize(row.symbol),
          price: row.regularMarketPrice,
          changePercent: row.regularMarketChangePercent,
          volume: row.regularMarketVolume,
          marketCap: row.marketCap,
          timestamp: Number(row.regularMarketTime || 0) * 1000 || Date.now(),
          source: "MIC browser live feed · Yahoo Finance quote"
        }]));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("QUOTE_FETCH_FAILED");
  }

  function assets() {
    return window.PiyasaMarketWorkspace?.getAssets?.() || [];
  }

  function provider(asset) {
    return asset.providerSymbol || (asset.market === "BIST" ? `${asset.symbol}.IS` : asset.symbol);
  }

  function priorityAssets() {
    const all = assets();
    const keys = new Set();
    const selected = window.PiyasaMarketWorkspace?.getSelected?.();
    if (selected?.key) keys.add(selected.key);

    document.querySelectorAll("#pmAssetList [data-pm-key]").forEach(node => {
      if (node.offsetParent !== null) keys.add(node.dataset.pmKey);
    });

    try {
      const personal = JSON.parse(localStorage.getItem("piyasa-masasi-ai.personal-list.v1") || "[]");
      for (const symbol of Array.isArray(personal) ? personal : []) {
        all.filter(asset => asset.symbol === String(symbol).toUpperCase().replace(/\.IS$/, "")).forEach(asset => keys.add(asset.key));
      }
    } catch (_) {}

    try {
      for (const transaction of state?.portfolio?.transactions || []) {
        const symbol = String(transaction.symbol || "").toUpperCase().replace(/\.IS$/, "");
        all.filter(asset => asset.symbol === symbol).forEach(asset => keys.add(asset.key));
      }
    } catch (_) {}

    return all.filter(asset => keys.has(asset.key)).slice(0, 120);
  }

  function dispatchQuotes(quotes) {
    if (!quotes.size) return 0;
    window.dispatchEvent(new CustomEvent("piyasa-market-quotes", { detail: { quotes } }));
    return quotes.size;
  }

  async function scanAssets(list, generation, activity) {
    const symbols = [...new Set(list.map(provider).map(normalize).filter(Boolean))];
    const batches = chunk(symbols, BATCH_SIZE);
    let updated = 0;
    for (let offset = 0; offset < batches.length; offset += CONCURRENCY) {
      if (!live.active || generation !== live.generation) break;
      const group = batches.slice(offset, offset + CONCURRENCY);
      const results = await Promise.allSettled(group.map(fetchBatch));
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        live.processed += group[index].length;
        if (result.status === "fulfilled") {
          updated += dispatchQuotes(result.value);
          live.lastSuccessAt = Date.now();
        } else {
          live.lastError = result.reason;
        }
      }
      live.updated += updated;
      updateUi(activity);
      await sleep(250);
    }
    return updated;
  }

  async function scanPriority() {
    if (!live.active || live.scanning) return;
    const list = priorityAssets();
    if (!list.length) return;
    const generation = live.generation;
    live.lastAttemptAt = Date.now();
    try {
      const quotes = await fetchBatch([...new Set(list.map(provider))]);
      if (generation !== live.generation) return;
      live.updated = dispatchQuotes(quotes);
      live.total = list.length;
      live.processed = list.length;
      live.lastSuccessAt = Date.now();
      live.lastError = null;
    } catch (error) {
      live.lastError = error;
    }
    updateUi();
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
    updateUi(text("Öncelikli hisseler yenileniyor", "Refreshing priority equities"));
    try {
      await scanAssets(priorityAssets(), generation, text("Öncelikli hisseler yenileniyor", "Refreshing priority equities"));
      await scanAssets(assets(), generation, text("Tüm hisse evreni yenileniyor", "Refreshing the full equity universe"));
      if (generation === live.generation) {
        live.lastSuccessAt = Date.now();
        live.lastError = null;
      }
    } catch (error) {
      live.lastError = error;
    } finally {
      if (generation === live.generation) live.scanning = false;
      updateUi();
    }
  }

  function schedule() {
    clearInterval(live.priorityTimer);
    clearInterval(live.fullTimer);
    live.priorityTimer = setInterval(() => {
      if (live.active && !document.hidden) scanPriority();
    }, PRIORITY_INTERVAL);
    live.fullTimer = setInterval(() => {
      if (live.active && !document.hidden) fullScan();
    }, FULL_RESCAN_INTERVAL);
  }

  async function start() {
    live.active = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    schedule();
    updateUi(text("Piyasa dosyaları yenileniyor", "Refreshing market files"));
    await window.PiyasaMarketWorkspace?.refresh?.(true);
    await fullScan();
  }

  function stop() {
    live.active = false;
    live.generation += 1;
    sessionStorage.removeItem(SESSION_KEY);
    clearInterval(live.priorityTimer);
    clearInterval(live.fullTimer);
    live.priorityTimer = null;
    live.fullTimer = null;
    updateUi();
  }

  function bind() {
    const button = $("refresh");
    if (button) button.onclick = event => { event.preventDefault(); start(); };
    updateUi();
    if (live.active) {
      schedule();
      setTimeout(() => fullScan(), 0);
    }
    document.addEventListener("visibilitychange", () => {
      if (live.active && !document.hidden) scanPriority();
    });
    window.addEventListener("pagehide", () => {
      clearInterval(live.priorityTimer);
      clearInterval(live.fullTimer);
    });
    setInterval(() => {
      const current = $("refresh");
      if (current && current.onclick == null) current.onclick = event => { event.preventDefault(); start(); };
      updateUi();
    }, 5000);
  }

  window.PiyasaMarketLive = {
    state: live,
    start,
    stop,
    refresh: fullScan,
    isActive: () => live.active
  };

  bind();
})();
