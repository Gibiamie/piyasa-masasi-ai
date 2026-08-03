(() => {
  "use strict";

  if (window.__PM_LIVE_SESSION_CONTROL__) return;
  window.__PM_LIVE_SESSION_CONTROL__ = true;

  const SESSION_KEY = "piyasa-masasi-ai.live-session.active.v1";
  const MARKET_URL = "../mic/data/market.json";
  const QUOTE_CACHE_KEY = "piyasa-masasi-ai.live-quotes.v1";
  const PRIORITY_INTERVAL_MS = 30_000;
  const UNIVERSE_INTERVAL_MS = 30_000;
  const UNIVERSE_BATCH_SIZE = 60;
  const MAX_PRIORITY_SYMBOLS = 60;

  const control = {
    active: sessionStorage.getItem(SESSION_KEY) === "1",
    universe: [],
    universeMap: new Map(),
    universeCursor: 0,
    updatedSymbols: new Set(),
    priorityTimer: null,
    universeTimer: null,
    starting: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    fullScanRunning: false
  };

  const normalize = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const unique = values => [...new Set(values.filter(Boolean))];
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const text = (tr, en) => language() === "en" ? en : tr;

  function providerSymbol(record) {
    const raw = String(record?.provider_symbol || record?.providerSymbol || record?.symbol || record?.ticker || "").trim().toUpperCase();
    if (!raw) return "";
    if (/[.=^-]/.test(raw)) return raw;
    const exchange = String(record?.exchange || "").toUpperCase();
    const currency = String(record?.currency || "").toUpperCase();
    const type = String(record?.type || record?.assetType || "stock").toUpperCase();
    if (type === "CRYPTO") return `${raw}-USD`;
    if (exchange === "BIST" || (type === "STOCK" && currency === "TRY")) return `${raw}.IS`;
    return raw;
  }

  function baseSymbol(value) { return normalize(value); }

  function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function readQuoteCache() {
    return safeJson(localStorage.getItem(QUOTE_CACHE_KEY), {}) || {};
  }

  function writeQuoteCache(quotes) {
    const cache = readQuoteCache();
    for (const [symbol, quote] of quotes) cache[symbol] = quote;
    try { localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function stopCoreAutomaticTimer() {
    const api = window.PiyasaLiveMarket;
    if (!api?.runtime) return;
    if (api.runtime.timer) {
      clearInterval(api.runtime.timer);
      api.runtime.timer = null;
    }
  }

  async function loadUniverse(force = false) {
    if (control.universe.length && !force) return control.universe;
    const response = await fetch(`${MARKET_URL}?session=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error(`MARKET_UNIVERSE_HTTP_${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.assets) ? payload.assets : [];
    control.universe = rows.map(row => ({ ...row, provider_symbol: providerSymbol(row) })).filter(row => row.provider_symbol);
    control.universeMap = new Map();
    for (const row of control.universe) {
      control.universeMap.set(baseSymbol(row.symbol || row.ticker || row.provider_symbol), row);
      control.universeMap.set(row.provider_symbol, row);
    }
    if (control.universeCursor >= control.universe.length) control.universeCursor = 0;
    return control.universe;
  }

  function reportRows() {
    try { return Array.isArray(state?.report?.watchlist) ? state.report.watchlist : []; }
    catch (_) { return []; }
  }

  function selectedSymbol() {
    return baseSymbol(
      document.querySelector("#pmAssetList .pm-asset-row.active[data-pm-symbol]")?.dataset.pmSymbol
      || String(document.getElementById("pmAssetTitle")?.textContent || "").split("·")[0]
    );
  }

  function personalSymbols() {
    const value = safeJson(localStorage.getItem("piyasa-masasi-ai.personal-list.v1"), []);
    return Array.isArray(value) ? value.map(baseSymbol) : [];
  }

  function portfolioSymbols() {
    try { return (state?.portfolio?.transactions || []).map(item => baseSymbol(item.symbol)); }
    catch (_) { return []; }
  }

  function visibleSymbols() {
    return [...document.querySelectorAll("#pmAssetList [data-pm-symbol]")]
      .filter(node => node.offsetParent !== null)
      .map(node => baseSymbol(node.dataset.pmSymbol));
  }

  function resolveRecord(symbol) {
    const normalized = baseSymbol(symbol);
    const universe = control.universeMap.get(normalized) || control.universeMap.get(`${normalized}.IS`);
    if (universe) return universe;
    const report = reportRows().find(row => baseSymbol(row.ticker || row.provider_symbol) === normalized);
    if (report) return { ...report, provider_symbol: providerSymbol(report) };
    return { symbol: normalized, ticker: normalized, provider_symbol: normalized };
  }

  function priorityRecords() {
    const symbols = unique([
      selectedSymbol(),
      ...personalSymbols(),
      ...portfolioSymbols(),
      ...reportRows().map(row => baseSymbol(row.ticker || row.provider_symbol)),
      ...visibleSymbols().slice(0, 24)
    ]).slice(0, MAX_PRIORITY_SYMBOLS);
    return symbols.map(resolveRecord).filter(record => record.provider_symbol);
  }

  function nextUniverseBatch() {
    if (!control.universe.length) return [];
    const result = [];
    for (let index = 0; index < Math.min(UNIVERSE_BATCH_SIZE, control.universe.length); index += 1) {
      result.push(control.universe[control.universeCursor]);
      control.universeCursor = (control.universeCursor + 1) % control.universe.length;
    }
    return result;
  }

  function applyQuoteToReport(quote) {
    const symbol = baseSymbol(quote?.symbol);
    if (!symbol) return;
    const row = reportRows().find(item => baseSymbol(item.ticker || item.provider_symbol) === symbol);
    if (!row) return;
    row.price = quote.price;
    row.currency = quote.currency || row.currency;
    if (Number.isFinite(Number(quote.changePercent))) row.return_1d_pct = Number(quote.changePercent);
    row.price_as_of = new Date(quote.timestamp || Date.now()).toISOString();
    row.provider = quote.source || "MIC browser feed";
    row.data_status = quote.fromCache ? "CACHE" : "LIVE_BROWSER";
    row.live_delay_minutes = Number(quote.delayMinutes || 0);
    try {
      const evaluation = (state.report?.company_evaluations || []).find(item => baseSymbol(item.ticker) === symbol);
      if (evaluation?.price_context) {
        evaluation.price_context.price = quote.price;
        evaluation.price_context.currency = quote.currency || evaluation.price_context.currency;
        evaluation.price_context.return_1d_pct = Number.isFinite(Number(quote.changePercent)) ? Number(quote.changePercent) : evaluation.price_context.return_1d_pct;
        evaluation.price_context.price_as_of = row.price_as_of;
        evaluation.price_context.data_status = row.data_status;
      }
    } catch (_) {}
  }

  function renderUpdatedApplication() {
    try {
      if (state?.report && typeof renderWatchlist === "function") renderWatchlist(state.report.watchlist || [], state.report.company_evaluations || []);
      if (state?.report && typeof renderFocus === "function") renderFocus(state.report.company_evaluations || []);
      if (state?.report && typeof renderEvaluations === "function") renderEvaluations(state.report.company_evaluations || []);
      if (typeof renderPortfolio === "function") renderPortfolio();
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("piyasa-live-quotes-updated", {
      detail: { updated: control.updatedSymbols.size, total: control.universe.length, at: control.lastSuccessAt }
    }));
  }

  async function scan(records, reason) {
    const api = window.PiyasaLiveMarket;
    if (!control.active || !api?.fetchQuotes || !records.length) return new Map();
    const symbols = unique(records.map(providerSymbol));
    if (!symbols.length) return new Map();
    control.lastAttemptAt = Date.now();
    updateStatus(reason);
    const quotes = await api.fetchQuotes(symbols, readQuoteCache());
    if (!(quotes instanceof Map)) throw new Error("LIVE_QUOTES_INVALID_RESULT");
    for (const [symbol, quote] of quotes) {
      api.runtime.quotes.set(symbol, quote);
      control.updatedSymbols.add(baseSymbol(symbol));
      applyQuoteToReport(quote);
    }
    writeQuoteCache(quotes);
    api.runtime.lastRefresh = Date.now();
    control.lastSuccessAt = api.runtime.lastRefresh;
    control.lastError = null;
    renderUpdatedApplication();
    updateStatus();
    return quotes;
  }

  async function refreshPriority() {
    if (!control.active) return;
    try { await scan(priorityRecords(), text("öncelikli hisseler yenileniyor", "refreshing priority assets")); }
    catch (error) { control.lastError = error; updateStatus(); }
  }

  async function refreshUniverseStep() {
    if (!control.active || control.fullScanRunning) return;
    try {
      await loadUniverse();
      await scan(nextUniverseBatch(), text("tüm hisse evreni taranıyor", "scanning the full equity universe"));
    } catch (error) { control.lastError = error; updateStatus(); }
  }

  async function runFullUniverseScan() {
    if (!control.active || control.fullScanRunning) return;
    control.fullScanRunning = true;
    control.updatedSymbols.clear();
    try {
      await loadUniverse();
      for (let offset = 0; offset < control.universe.length && control.active; offset += UNIVERSE_BATCH_SIZE) {
        const batch = control.universe.slice(offset, offset + UNIVERSE_BATCH_SIZE);
        await scan(batch, text("tüm hisseler güncelleniyor", "updating all equities"));
        if (offset > 0 && offset % (UNIVERSE_BATCH_SIZE * 4) === 0) await refreshPriority();
      }
      control.universeCursor = 0;
    } catch (error) {
      control.lastError = error;
    } finally {
      control.fullScanRunning = false;
      updateStatus();
    }
  }

  function formatTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(language() === "en" ? "en-GB" : "tr-TR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Muscat"
    }).format(new Date(value));
  }

  function ensureStatusDetail() {
    const pill = document.getElementById("freshness");
    if (!pill) return null;
    let detail = document.getElementById("freshnessDetail");
    if (!detail) {
      detail = document.createElement("span");
      detail.id = "freshnessDetail";
      detail.className = "freshness-detail";
      pill.insertAdjacentElement("afterend", detail);
    }
    return detail;
  }

  function updateStatus(activity = "") {
    const pill = document.getElementById("freshness");
    const detail = ensureStatusDetail();
    const button = document.getElementById("refresh");
    if (!pill) return;

    if (!control.active) {
      pill.textContent = text("Canlı izleme kapalı", "Live monitoring off");
      pill.className = "status-pill neutral";
      if (detail) detail.textContent = text("Yenile'ye basınca sekme açık kaldığı sürece fiyatlar izlenir.", "Press Refresh to monitor prices while this tab stays open.");
      if (button) button.textContent = text("Yenile ve izlemeyi başlat", "Refresh and start monitoring");
      return;
    }

    const progress = control.universe.length ? `${control.updatedSymbols.size}/${control.universe.length}` : "—";
    if (control.starting || activity) {
      pill.textContent = text("Canlı izleme açık · güncelleniyor", "Live monitoring on · updating");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = `${activity || text("fiyatlar yenileniyor", "refreshing prices")} · ${progress}`;
    } else if (control.lastError && !control.lastSuccessAt) {
      pill.textContent = text("Canlı izleme açık · veri alınamadı", "Live monitoring on · data unavailable");
      pill.className = "status-pill warning";
      if (detail) detail.textContent = text("Yenile ile tekrar deneyin. İzleme sekme açıkken devam eder.", "Press Refresh to retry. Monitoring continues while the tab is open.");
    } else {
      pill.textContent = text("Canlı izleme açık", "Live monitoring on");
      pill.className = "status-pill positive";
      if (detail) detail.textContent = text(
        `Güncellenen: ${progress} · Son başarılı kontrol: ${formatTime(control.lastSuccessAt)}`,
        `Updated: ${progress} · Last successful check: ${formatTime(control.lastSuccessAt)}`
      );
    }
    if (button) button.textContent = text("Şimdi yenile", "Refresh now");
  }

  function clearSessionTimers() {
    clearInterval(control.priorityTimer);
    clearInterval(control.universeTimer);
    control.priorityTimer = null;
    control.universeTimer = null;
  }

  function scheduleSession() {
    clearSessionTimers();
    control.priorityTimer = setInterval(() => refreshPriority(), PRIORITY_INTERVAL_MS);
    control.universeTimer = setInterval(() => refreshUniverseStep(), UNIVERSE_INTERVAL_MS);
  }

  async function waitForCore() {
    const bootstrap = window.PiyasaLiveBootstrap;
    if (!bootstrap?.startCore) throw new Error("LIVE_BOOTSTRAP_NOT_READY");
    await bootstrap.startCore();
    let attempts = 0;
    while (!window.PiyasaLiveMarket?.runtime?.installed && attempts < 200) {
      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!window.PiyasaLiveMarket?.runtime?.installed) throw new Error("LIVE_CORE_NOT_READY");
    stopCoreAutomaticTimer();
  }

  async function forceRefresh() {
    if (control.starting) return;
    control.starting = true;
    updateStatus(text("fiyat ve hisse evreni kontrol ediliyor", "checking prices and the equity universe"));
    try {
      await waitForCore();
      if (typeof load === "function") await load();
      await loadUniverse(true);
      await refreshPriority();
      void runFullUniverseScan();
    } catch (error) {
      control.lastError = error;
    } finally {
      control.starting = false;
      updateStatus();
    }
  }

  async function startMonitoring() {
    control.active = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    scheduleSession();
    await forceRefresh();
  }

  function installRefreshButton() {
    const button = document.getElementById("refresh");
    if (!button) return;
    button.dataset.liveSessionControl = "1";
    button.onclick = event => {
      event?.preventDefault?.();
      if (!control.active) startMonitoring();
      else forceRefresh();
    };
  }

  function install() {
    if (!window.PiyasaLiveBootstrap) {
      setTimeout(install, 100);
      return;
    }
    installRefreshButton();
    updateStatus();
    if (control.active) {
      scheduleSession();
      forceRefresh();
    }

    document.addEventListener("visibilitychange", () => {
      if (control.active && !document.hidden) forceRefresh();
    });
    window.addEventListener("pagehide", clearSessionTimers);
    setInterval(() => {
      stopCoreAutomaticTimer();
      installRefreshButton();
      updateStatus();
    }, 5000);
  }

  window.PiyasaLiveSession = {
    start: startMonitoring,
    refresh: forceRefresh,
    state: control
  };

  install();
})();
