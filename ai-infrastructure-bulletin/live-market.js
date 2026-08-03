(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PiyasaLiveMarket = api;
  if (root.document) api.install();
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const REFRESH_MS = 30_000;
  const QUOTE_TIMEOUT_MS = 12_000;
  const QUOTE_CACHE_KEY = "piyasa-masasi-ai.live-quotes.v1";
  const HISTORY_CACHE_KEY = "piyasa-masasi-ai.chart-history.v1";
  const RANGE_CONFIG = {
    "1D": { range: "1d", interval: "5m", ttl: 120_000 },
    "1W": { range: "5d", interval: "30m", ttl: 300_000 },
    "1M": { range: "1mo", interval: "1d", ttl: 900_000 },
    "3M": { range: "3mo", interval: "1d", ttl: 1_800_000 },
    "6M": { range: "6mo", interval: "1d", ttl: 1_800_000 },
    "1Y": { range: "1y", interval: "1d", ttl: 3_600_000 },
    "2Y": { range: "2y", interval: "1d", ttl: 3_600_000 }
  };

  const COPY = {
    tr: {
      autoRefresh: "30 sn otomatik yenileme", live: "Canlı akış", nearLive: "Yakın zamanlı", delayed: "{minutes} dk gecikmeli", cache: "Önbellek", unavailable: "Canlı veri alınamadı",
      source: "Kaynak", lastTrade: "Son işlem", loadingQuote: "Fiyatlar yenileniyor…", chartLoading: "Grafik yükleniyor…", chartUnavailable: "Grafik verisi alınamadı.",
      line: "Çizgi", candle: "Mum", volume: "Hacim", periodReturn: "Dönem getirisi", periodHigh: "Dönem zirvesi", periodLow: "Dönem dibi", averageCost: "Ort. maliyet",
      buy: "Alış", sell: "Satış", openChart: "Grafiği aç", marketMayDelay: "Veri sağlayıcısına ve borsaya göre gecikme olabilir.", noHistory: "Bu dönem için fiyat geçmişi yok.",
      open: "Açılış", high: "Yüksek", low: "Düşük", close: "Kapanış"
    },
    en: {
      autoRefresh: "30-sec automatic refresh", live: "Live feed", nearLive: "Near real time", delayed: "{minutes}-min delayed", cache: "Cached", unavailable: "Live data unavailable",
      source: "Source", lastTrade: "Last trade", loadingQuote: "Refreshing prices…", chartLoading: "Loading chart…", chartUnavailable: "Chart data is unavailable.",
      line: "Line", candle: "Candles", volume: "Volume", periodReturn: "Period return", periodHigh: "Period high", periodLow: "Period low", averageCost: "Avg. cost",
      buy: "Buy", sell: "Sell", openChart: "Open chart", marketMayDelay: "Delay depends on the exchange and data provider.", noHistory: "No price history is available for this range.",
      open: "Open", high: "High", low: "Low", close: "Close"
    }
  };

  function safeJson(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
  function readStorage(key, fallback = {}) { if (!root.localStorage) return fallback; return safeJson(root.localStorage.getItem(key), fallback) || fallback; }
  function writeStorage(key, value) { try { root.localStorage?.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function numeric(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  function normalizeSymbol(value) { return String(value || "").trim().toUpperCase().replace(/\s+/g, ""); }

  function providerSymbol(record) {
    const symbol = normalizeSymbol(record?.provider_symbol || record?.providerSymbol || record?.symbol || record?.ticker);
    if (!symbol) return "";
    if (/[.=^-]/.test(symbol)) return symbol;
    const currency = String(record?.currency || "").toUpperCase();
    const assetType = String(record?.assetType || "STOCK").toUpperCase();
    if (assetType === "CRYPTO") return `${symbol}-USD`;
    if (assetType === "STOCK" && currency === "TRY") return `${symbol}.IS`;
    return symbol;
  }

  function symbolAliases(record) {
    const ticker = normalizeSymbol(record?.ticker || record?.symbol);
    const provider = providerSymbol(record);
    return unique([ticker, provider, provider.replace(/\.IS$/, "")]);
  }

  function epochMs(value) { const number = numeric(value); if (number === null) return null; return number < 10_000_000_000 ? number * 1000 : number; }

  function quoteFreshness(quote, now = Date.now()) {
    const timestamp = epochMs(quote?.timestamp || quote?.regularMarketTime || quote?.time);
    const ageMs = timestamp === null ? Infinity : Math.max(0, now - timestamp);
    const delayedMinutes = Math.max(0, numeric(quote?.delayMinutes ?? quote?.exchangeDataDelayedBy) || 0);
    if (quote?.fromCache) return { code: "cache", ageMs, delayedMinutes };
    if (delayedMinutes > 0) return { code: "delayed", ageMs, delayedMinutes };
    if (ageMs <= 120_000) return { code: "live", ageMs, delayedMinutes: 0 };
    if (ageMs <= 15 * 60_000) return { code: "nearLive", ageMs, delayedMinutes: 0 };
    return { code: "cache", ageMs, delayedMinutes: 0 };
  }

  function parseQuoteResult(item, source = "Yahoo Finance") {
    const price = numeric(item?.regularMarketPrice ?? item?.postMarketPrice ?? item?.preMarketPrice);
    if (price === null) return null;
    return {
      symbol: normalizeSymbol(item.symbol), price, currency: String(item.currency || "USD").toUpperCase(), change: numeric(item.regularMarketChange),
      changePercent: numeric(item.regularMarketChangePercent), previousClose: numeric(item.regularMarketPreviousClose), timestamp: epochMs(item.regularMarketTime) || Date.now(),
      marketState: String(item.marketState || "UNKNOWN"), exchange: String(item.fullExchangeName || item.exchange || ""),
      delayMinutes: Math.max(0, numeric(item.exchangeDataDelayedBy) || 0), source, fromCache: false
    };
  }

  function parseChartPayload(payload, source = "Yahoo Finance chart") {
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_CHART");
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const rows = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const close = numeric(quote.close?.[index]);
      if (close === null) continue;
      rows.push({ time: timestamps[index] * 1000, open: numeric(quote.open?.[index]) ?? close, high: numeric(quote.high?.[index]) ?? close, low: numeric(quote.low?.[index]) ?? close, close, volume: numeric(quote.volume?.[index]) || 0 });
    }
    const meta = result.meta || {};
    return {
      symbol: normalizeSymbol(meta.symbol), currency: String(meta.currency || "USD").toUpperCase(), exchange: String(meta.fullExchangeName || meta.exchangeName || ""),
      delayMinutes: Math.max(0, numeric(meta.exchangeDataDelayedBy) || 0), marketState: String(meta.marketState || "UNKNOWN"), source, rows,
      timestamp: rows.at(-1)?.time || epochMs(meta.regularMarketTime) || Date.now(), price: numeric(meta.regularMarketPrice) ?? rows.at(-1)?.close ?? null,
      previousClose: numeric(meta.chartPreviousClose ?? meta.previousClose)
    };
  }

  function quoteFromChart(parsed) {
    if (parsed.price === null) return null;
    const previous = parsed.previousClose;
    const change = previous === null || previous === undefined ? null : parsed.price - previous;
    return {
      symbol: parsed.symbol, price: parsed.price, currency: parsed.currency, change,
      changePercent: previous ? (parsed.price / previous - 1) * 100 : null, previousClose: previous, timestamp: parsed.timestamp,
      marketState: parsed.marketState, exchange: parsed.exchange, delayMinutes: parsed.delayMinutes, source: parsed.source, fromCache: false
    };
  }

  function timeoutSignal(milliseconds = QUOTE_TIMEOUT_MS) {
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(milliseconds);
    const controller = new AbortController(); setTimeout(() => controller.abort(), milliseconds); return controller.signal;
  }

  async function fetchJsonDirect(url) {
    const response = await fetch(url, { cache: "no-store", signal: timeoutSignal(), headers: { Accept: "application/json,text/plain,*/*" } });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function fetchJsonProxy(url) {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxy, { cache: "no-store", signal: timeoutSignal() });
    if (!response.ok) throw new Error(`PROXY_HTTP_${response.status}`);
    return response.json();
  }

  async function fetchJson(url) {
    const hosts = unique([url, url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com")]);
    let lastError = null;
    for (const candidate of hosts) {
      for (const reader of [fetchJsonDirect, fetchJsonProxy]) {
        try { return await reader(candidate); } catch (error) { lastError = error; }
      }
    }
    throw lastError || new Error("FETCH_FAILED");
  }

  async function fetchQuoteBatch(symbols) {
    const clean = unique(symbols.map(normalizeSymbol));
    if (!clean.length) return [];
    const chunks = [];
    for (let index = 0; index < clean.length; index += 20) chunks.push(clean.slice(index, index + 20));
    const quotes = [];
    for (const chunk of chunks) {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(","))}`;
      try {
        const payload = await fetchJson(url);
        for (const item of payload?.quoteResponse?.result || []) { const quote = parseQuoteResult(item); if (quote) quotes.push(quote); }
      } catch (_) {}
    }
    return quotes;
  }

  async function fetchChart(symbol, range = "1d", interval = "5m") {
    const clean = normalizeSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=true`;
    return parseChartPayload(await fetchJson(url));
  }

  async function fetchQuotes(symbols, cached = {}) {
    const wanted = unique(symbols.map(normalizeSymbol));
    const result = new Map();
    const batch = await fetchQuoteBatch(wanted);
    batch.forEach(quote => result.set(quote.symbol, quote));
    const queue = wanted.filter(symbol => !result.has(symbol));
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length) {
        const symbol = queue.shift();
        try { const quote = quoteFromChart(await fetchChart(symbol, "1d", "5m")); if (quote) result.set(symbol, quote); } catch (_) {}
      }
    });
    await Promise.all(workers);
    for (const symbol of wanted) { if (!result.has(symbol) && cached[symbol]?.price != null) result.set(symbol, { ...cached[symbol], fromCache: true }); }
    return result;
  }

  function historyCacheKey(symbol, range) { return `${normalizeSymbol(symbol)}|${range}`; }
  function readHistoryCache(symbol, range) { return readStorage(HISTORY_CACHE_KEY, {})[historyCacheKey(symbol, range)] || null; }
  function writeHistoryCache(symbol, range, data) {
    const cache = readStorage(HISTORY_CACHE_KEY, {});
    cache[historyCacheKey(symbol, range)] = { savedAt: Date.now(), data };
    writeStorage(HISTORY_CACHE_KEY, Object.fromEntries(Object.entries(cache).sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0)).slice(0, 80)));
  }

  async function fetchHistory(symbol, range, force = false) {
    const config = RANGE_CONFIG[range] || RANGE_CONFIG["1M"];
    const cached = readHistoryCache(symbol, range);
    if (!force && cached?.data?.rows?.length && Date.now() - cached.savedAt < config.ttl) return { ...cached.data, fromCache: true };
    try { const data = await fetchChart(symbol, config.range, config.interval); writeHistoryCache(symbol, range, data); return data; }
    catch (error) { if (cached?.data?.rows?.length) return { ...cached.data, fromCache: true }; throw error; }
  }

  function installStyles() {
    if (document.getElementById("liveMarketStyles")) return;
    const style = document.createElement("style");
    style.id = "liveMarketStyles";
    style.textContent = `
      .live-market-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:.7rem}.live-market-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:var(--sage-soft);color:var(--positive);font-weight:750}.live-market-badge::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.live-market-badge.delayed{background:var(--sand-soft);color:var(--warning)}.live-market-badge.cache{background:var(--paper-soft);color:var(--muted)}.live-market-badge.unavailable{background:var(--clay-soft);color:var(--negative)}
      .live-price-flash{animation:live-price-flash .75s ease}@keyframes live-price-flash{0%{background:var(--sage-soft)}100%{background:transparent}}
      .asset-live-chart{margin:18px 0 22px;border:1px solid var(--line);border-radius:4px 22px 4px 22px;background:var(--paper);overflow:hidden}.chart-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--paper-soft)}.chart-quote{display:grid;gap:3px}.chart-quote-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.chart-quote-row strong{font-family:Georgia,serif;font-size:1.55rem;font-weight:500}.chart-quote-row span{font-weight:750}.chart-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.chart-control-group{display:flex;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}.chart-control{min-height:32px;border:0;border-radius:7px;padding:5px 9px;background:transparent;color:var(--muted);font-size:.68rem;font-weight:750}.chart-control.active{background:var(--pine);color:#fff}.chart-body{position:relative;min-height:360px;padding:8px 10px 4px}.chart-svg{display:block;width:100%;height:auto;min-height:330px;touch-action:none}.chart-grid{stroke:var(--line);stroke-width:1}.chart-axis-text{fill:var(--muted);font-size:11px}.chart-line{fill:none;stroke:var(--pine-2);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}.chart-area{fill:rgba(36,81,72,.08)}.chart-volume{fill:var(--sky);opacity:.45}.chart-candle-up{fill:var(--positive);stroke:var(--positive)}.chart-candle-down{fill:var(--negative);stroke:var(--negative)}.chart-cost{stroke:var(--clay);stroke-width:1.5;stroke-dasharray:6 5}.chart-cost-label{fill:var(--clay);font-size:11px;font-weight:750}.chart-marker-buy{fill:var(--positive);stroke:var(--paper);stroke-width:2}.chart-marker-sell{fill:var(--negative);stroke:var(--paper);stroke-width:2}.chart-crosshair{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 4;pointer-events:none}.chart-tooltip{position:absolute;z-index:3;pointer-events:none;min-width:170px;padding:10px 12px;border:1px solid var(--line);border-radius:12px 12px 12px 3px;background:rgba(255,253,248,.96);box-shadow:var(--shadow);font-size:.7rem;color:var(--ink)}.chart-tooltip.hidden{display:none}.chart-tooltip strong,.chart-tooltip span{display:block}.chart-tooltip span{margin-top:3px;color:var(--muted)}.chart-state{min-height:350px;display:grid;place-items:center;color:var(--muted);text-align:center;padding:24px}.chart-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);background:var(--paper-soft)}.chart-stat{padding:12px 14px;border-right:1px solid var(--line)}.chart-stat:last-child{border-right:0}.chart-stat span,.chart-stat strong{display:block}.chart-stat span{color:var(--muted);font-size:.65rem}.chart-stat strong{margin-top:4px;font-size:.8rem}.chart-footnote{padding:10px 16px;color:var(--muted);font-size:.66rem;border-top:1px solid var(--line)}.portfolio-chart-button{margin-top:4px;border:0;background:transparent;color:var(--pine-2);font-size:.67rem;font-weight:750;padding:0;text-decoration:underline;text-underline-offset:3px}
      @media(max-width:700px){.chart-toolbar{display:grid}.chart-controls{justify-content:flex-start}.chart-stats{grid-template-columns:1fr 1fr}.chart-stat:nth-child(2){border-right:0}.chart-stat:nth-child(-n+2){border-bottom:1px solid var(--line)}.chart-body{min-height:300px;padding:4px}.chart-svg{min-height:280px}.asset-live-chart{margin-left:-4px;margin-right:-4px}}
    `;
    document.head.appendChild(style);
  }

  const runtime = { quotes: new Map(), timer: null, activeChart: null, original: {}, installed: false, refreshing: false, lastRefresh: null };
  function language() { try { return state.language === "en" ? "en" : "tr"; } catch (_) { return document.documentElement.lang === "en" ? "en" : "tr"; } }
  function copy(key, params = {}) { let value = COPY[language()][key] || COPY.tr[key] || key; for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement)); return value; }
  function locale() { return language() === "tr" ? "tr-TR" : "en-GB"; }
  function money(value, currency) { const number = numeric(value); if (number === null) return "—"; try { return new Intl.NumberFormat(locale(), { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(number); } catch (_) { return `${number.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${currency || ""}`.trim(); } }
  function percent(value) { const number = numeric(value); if (number === null) return "—"; return `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`; }
  function dateTime(value) { const time = epochMs(value); if (time === null) return "—"; return new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "medium" }).format(new Date(time)); }
  function statusLabel(quote) { const status = quoteFreshness(quote); return status.code === "delayed" ? copy("delayed", { minutes: status.delayedMinutes }) : copy(status.code); }
  function statusClass(quote) { return quoteFreshness(quote).code; }

  function configuredAssets() {
    const reportRows = state.report?.watchlist || [];
    const transactions = state.portfolio?.transactions || [];
    const map = new Map();
    reportRows.forEach(row => { const provider = providerSymbol(row); if (provider) map.set(provider, { ...row, provider_symbol: provider }); });
    transactions.forEach(tx => {
      const report = reportRows.find(row => symbolAliases(row).includes(normalizeSymbol(tx.symbol)));
      const record = report || tx;
      const provider = providerSymbol(record);
      if (provider && !map.has(provider)) map.set(provider, { ...record, provider_symbol: provider });
    });
    return [...map.values()];
  }

  function findQuote(recordOrSymbol) {
    const records = typeof recordOrSymbol === "string" ? [{ ticker: normalizeSymbol(recordOrSymbol), symbol: normalizeSymbol(recordOrSymbol) }] : [recordOrSymbol];
    for (const record of records) for (const alias of symbolAliases(record)) if (runtime.quotes.has(alias)) return runtime.quotes.get(alias);
    return null;
  }

  function applyQuoteToReport(asset, quote) {
    const row = (state.report?.watchlist || []).find(item => symbolAliases(item).some(alias => alias === quote.symbol || alias === normalizeSymbol(asset.ticker || asset.symbol)));
    if (!row) return;
    row.price = quote.price; row.currency = quote.currency || row.currency; row.return_1d_pct = quote.changePercent ?? row.return_1d_pct;
    row.price_as_of = new Date(quote.timestamp).toISOString(); row.provider = quote.source; row.data_status = quote.fromCache ? "CACHE" : "LIVE_BROWSER";
    row.live_market_state = quote.marketState; row.live_delay_minutes = quote.delayMinutes;
    const evaluation = (state.report?.company_evaluations || []).find(item => item.ticker === row.ticker);
    if (evaluation?.price_context) Object.assign(evaluation.price_context, { price: quote.price, currency: quote.currency || row.currency, return_1d_pct: quote.changePercent ?? evaluation.price_context.return_1d_pct, price_as_of: row.price_as_of, data_status: row.data_status });
  }

  function livePortfolioPrices() {
    const prices = {};
    for (const transaction of state.portfolio?.transactions || []) {
      const report = (state.report?.watchlist || []).find(row => symbolAliases(row).includes(normalizeSymbol(transaction.symbol)));
      const quote = findQuote(report || transaction);
      if (!quote) continue;
      if (quote.currency && PortfolioEngine.normalizeCurrency(quote.currency) !== PortfolioEngine.normalizeCurrency(transaction.currency)) continue;
      prices[PortfolioEngine.assetKey(transaction)] = { price: quote.price, date: new Date(quote.timestamp).toISOString(), source: "automatic" };
    }
    return prices;
  }

  function updateFreshness() {
    const badge = document.getElementById("freshness");
    if (!badge || !runtime.quotes.size) return;
    const statuses = [...runtime.quotes.values()].map(quoteFreshness);
    const delayed = statuses.filter(item => item.code === "delayed").length;
    const cached = statuses.filter(item => item.code === "cache").length;
    badge.textContent = delayed ? copy("delayed", { minutes: Math.max(...statuses.map(item => item.delayedMinutes || 0)) }) : cached === statuses.length ? copy("cache") : copy("autoRefresh");
    badge.className = `status-pill ${cached === statuses.length ? "warning" : "positive"}`;
    badge.title = `${copy("lastTrade")}: ${dateTime(runtime.lastRefresh)} · ${copy("marketMayDelay")}`;
  }

  function renderLiveAnnotations() {
    updateFreshness();
    const marketAsOf = document.getElementById("marketAsOf");
    if (marketAsOf && runtime.lastRefresh) marketAsOf.innerHTML = `${copy("autoRefresh")} · ${copy("lastTrade")}: ${dateTime(runtime.lastRefresh)}<br><small>${copy("marketMayDelay")}</small>`;
    document.querySelectorAll("#watchlistBody tr[data-ticker]").forEach(row => {
      const quote = findQuote(row.dataset.ticker);
      if (!quote) return;
      const priceCell = row.children[2];
      if (priceCell) { priceCell.innerHTML = `${money(quote.price, quote.currency)}<span class="price-source"><span class="live-market-badge ${statusClass(quote)}">${statusLabel(quote)}</span></span>`; priceCell.classList.add("live-price-flash"); }
      const dayCell = row.children[3];
      if (dayCell && quote.changePercent != null) { dayCell.textContent = percent(quote.changePercent); dayCell.className = quote.changePercent > 0 ? "up" : quote.changePercent < 0 ? "down" : ""; }
    });
  }

  function enhancePortfolioRows() {
    const result = portfolioResult();
    const rows = [...document.querySelectorAll("#portfolioHoldingsBody tr")];
    result.openHoldings.forEach((holding, index) => {
      const row = rows[index]; if (!row) return;
      const quote = findQuote({ symbol: holding.symbol, currency: holding.currency, assetType: holding.assetType });
      const cell = row.children[4];
      if (cell && quote) cell.innerHTML = `${money(quote.price, quote.currency)}<span class="price-source"><span class="live-market-badge ${statusClass(quote)}">${statusLabel(quote)}</span> · ${dateTime(quote.timestamp)}</span><button class="portfolio-chart-button" data-live-chart-symbol="${holding.symbol}" type="button">${copy("openChart")}</button>`;
      row.querySelector("[data-live-chart-symbol]")?.addEventListener("click", event => { event.stopPropagation(); openChartForSymbol(holding.symbol); });
    });
  }

  async function refreshQuotes(force = false) {
    if (runtime.refreshing || (!force && document.hidden)) return;
    const assets = configuredAssets(); if (!assets.length) return;
    runtime.refreshing = true;
    const refreshButton = document.getElementById("refresh"); if (refreshButton) refreshButton.setAttribute("aria-busy", "true");
    try {
      const quotes = await fetchQuotes(assets.map(providerSymbol), readStorage(QUOTE_CACHE_KEY, {}));
      runtime.quotes = quotes;
      const persisted = {};
      for (const [symbol, quote] of quotes) { persisted[symbol] = quote; const asset = assets.find(item => providerSymbol(item) === symbol); if (asset) applyQuoteToReport(asset, quote); }
      writeStorage(QUOTE_CACHE_KEY, persisted); runtime.lastRefresh = Date.now();
      if (state.report) { renderWatchlist(state.report.watchlist || [], state.report.company_evaluations || []); renderFocus(state.report.company_evaluations || []); renderEvaluations(state.report.company_evaluations || []); }
      renderPortfolio(); renderLiveAnnotations(); if (runtime.activeChart) updateActiveChartQuote();
    } finally { runtime.refreshing = false; if (refreshButton) refreshButton.removeAttribute("aria-busy"); }
  }

  function chartAsset(ticker) {
    const report = (state.report?.watchlist || []).find(row => symbolAliases(row).includes(normalizeSymbol(ticker)));
    if (report) return report;
    return portfolioResult().openHoldings.find(item => normalizeSymbol(item.symbol) === normalizeSymbol(ticker)) || { symbol: ticker, ticker };
  }
  function chartTransactions(ticker) { const target = normalizeSymbol(ticker).replace(/\.IS$/, ""); return (state.portfolio?.transactions || []).filter(tx => normalizeSymbol(tx.symbol).replace(/\.IS$/, "") === target); }
  function chartHolding(ticker) { const target = normalizeSymbol(ticker).replace(/\.IS$/, ""); return portfolioResult().openHoldings.find(item => normalizeSymbol(item.symbol).replace(/\.IS$/, "") === target) || null; }

  function createChartShell(ticker) {
    const section = document.createElement("section"); section.id = "assetLiveChart"; section.className = "asset-live-chart"; section.dataset.ticker = ticker;
    section.innerHTML = `<div class="chart-toolbar"><div class="chart-quote"><div class="chart-quote-row"><strong data-chart-price>—</strong><span data-chart-change>—</span></div><div class="live-market-meta" data-chart-meta>${copy("loadingQuote")}</div></div><div class="chart-controls"><div class="chart-control-group" aria-label="Range">${Object.keys(RANGE_CONFIG).map(range => `<button class="chart-control ${range === "1M" ? "active" : ""}" type="button" data-chart-range="${range}">${range}</button>`).join("")}</div><div class="chart-control-group" aria-label="Chart type"><button class="chart-control active" type="button" data-chart-type="line">${copy("line")}</button><button class="chart-control" type="button" data-chart-type="candle">${copy("candle")}</button></div></div></div><div class="chart-body"><div class="chart-state">${copy("chartLoading")}</div><div class="chart-tooltip hidden"></div></div><div class="chart-stats" data-chart-stats></div><div class="chart-footnote">${copy("marketMayDelay")}</div>`;
    return section;
  }

  function updateActiveChartQuote() {
    const active = runtime.activeChart; if (!active?.host?.isConnected) return;
    const quote = findQuote(active.asset), price = active.host.querySelector("[data-chart-price]"), change = active.host.querySelector("[data-chart-change]"), meta = active.host.querySelector("[data-chart-meta]");
    if (!quote) { if (meta) meta.innerHTML = `<span class="live-market-badge unavailable">${copy("unavailable")}</span>`; return; }
    if (price) price.textContent = money(quote.price, quote.currency);
    if (change) { change.textContent = percent(quote.changePercent); change.className = quote.changePercent > 0 ? "up" : quote.changePercent < 0 ? "down" : ""; }
    if (meta) meta.innerHTML = `<span class="live-market-badge ${statusClass(quote)}">${statusLabel(quote)}</span><span>${copy("source")}: ${quote.source}</span><span>${copy("lastTrade")}: ${dateTime(quote.timestamp)}</span>`;
  }

  function minMax(rows, averageCost) {
    const values = rows.flatMap(row => [row.low, row.high]).filter(value => numeric(value) !== null); if (numeric(averageCost) !== null) values.push(averageCost);
    let min = Math.min(...values), max = Math.max(...values); if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }; if (min === max) { min *= .99; max *= 1.01; }
    const pad = (max - min) * .08; return { min: min - pad, max: max + pad };
  }
  function formatAxisPrice(value, currency) { return `${Number(value).toLocaleString(locale(), { maximumFractionDigits: Math.abs(value) < 10 ? 3 : 2 })}${currency ? ` ${currency}` : ""}`; }
  function dateLabel(time, range) { const options = range === "1D" ? { hour: "2-digit", minute: "2-digit" } : range === "1W" ? { weekday: "short", hour: "2-digit" } : range === "1M" || range === "3M" ? { day: "2-digit", month: "short" } : { month: "short", year: "2-digit" }; return new Intl.DateTimeFormat(locale(), options).format(new Date(time)); }

  function renderChart(active) {
    const { host, data, range, type, asset } = active, body = host.querySelector(".chart-body"), rows = data?.rows || [];
    if (!rows.length) { body.innerHTML = `<div class="chart-state">${copy("noHistory")}</div><div class="chart-tooltip hidden"></div>`; return; }
    const holding = chartHolding(asset.ticker || asset.symbol), averageCost = numeric(holding?.averageCost), transactions = chartTransactions(asset.ticker || asset.symbol);
    const width = 920, height = 390, margin = { left: 12, right: 76, top: 14 }, plotBottom = 295, volumeTop = 315, volumeBottom = 365, plotWidth = width - margin.left - margin.right;
    const bounds = minMax(rows, averageCost), maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => margin.left + (index / Math.max(1, rows.length - 1)) * plotWidth;
    const y = value => margin.top + ((bounds.max - value) / (bounds.max - bounds.min)) * (plotBottom - margin.top);
    const yVolume = value => volumeBottom - (value / maxVolume) * (volumeBottom - volumeTop);
    const grid = Array.from({ length: 5 }, (_, index) => { const value = bounds.max - index * (bounds.max - bounds.min) / 4, yy = y(value); return `<line class="chart-grid" x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}"/><text class="chart-axis-text" x="${width - margin.right + 8}" y="${yy + 4}">${formatAxisPrice(value, data.currency)}</text>`; }).join("");
    const linePoints = rows.map((row, index) => `${x(index).toFixed(2)},${y(row.close).toFixed(2)}`).join(" ");
    const areaPath = `M ${x(0)} ${plotBottom} L ${linePoints.replaceAll(" ", " L ")} L ${x(rows.length - 1)} ${plotBottom} Z`;
    const candleWidth = Math.max(1.2, Math.min(7, plotWidth / Math.max(rows.length, 1) * .64));
    const candles = rows.map((row, index) => { const xx = x(index), up = row.close >= row.open, top = y(Math.max(row.open, row.close)), bottom = y(Math.min(row.open, row.close)); return `<g class="${up ? "chart-candle-up" : "chart-candle-down"}"><line x1="${xx}" y1="${y(row.high)}" x2="${xx}" y2="${y(row.low)}"/><rect x="${xx - candleWidth / 2}" y="${top}" width="${candleWidth}" height="${Math.max(1, bottom - top)}" rx="1"/></g>`; }).join("");
    const volume = rows.map((row, index) => `<rect class="chart-volume" x="${x(index) - Math.max(1, candleWidth / 2)}" y="${yVolume(row.volume)}" width="${Math.max(1.5, candleWidth)}" height="${Math.max(0, volumeBottom - yVolume(row.volume))}"/>`).join("");
    const cost = averageCost === null ? "" : `<line class="chart-cost" x1="${margin.left}" y1="${y(averageCost)}" x2="${width - margin.right}" y2="${y(averageCost)}"/><text class="chart-cost-label" x="${margin.left + 6}" y="${y(averageCost) - 6}">${copy("averageCost")}: ${formatAxisPrice(averageCost, holding.currency)}</text>`;
    const startTime = rows[0].time, endTime = rows.at(-1).time;
    const markers = transactions.filter(tx => { const time = new Date(`${tx.date}T12:00:00`).getTime(); return time >= startTime - 86_400_000 && time <= endTime + 86_400_000; }).map(tx => {
      const time = new Date(`${tx.date}T12:00:00`).getTime(); let index = 0, distance = Infinity;
      rows.forEach((row, rowIndex) => { const next = Math.abs(row.time - time); if (next < distance) { distance = next; index = rowIndex; } });
      return `<circle class="${tx.side === "BUY" ? "chart-marker-buy" : "chart-marker-sell"}" cx="${x(index)}" cy="${y(rows[index].close)}" r="5"><title>${tx.side === "BUY" ? copy("buy") : copy("sell")} · ${tx.quantity} · ${money(tx.unitPrice, tx.currency)}</title></circle>`;
    }).join("");
    const tickIndexes = unique([0, Math.round((rows.length - 1) * .25), Math.round((rows.length - 1) * .5), Math.round((rows.length - 1) * .75), rows.length - 1]);
    const xLabels = tickIndexes.map(index => `<text class="chart-axis-text" x="${x(index)}" y="382" text-anchor="${index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}">${dateLabel(rows[index].time, range)}</text>`).join("");
    body.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${asset.ticker || asset.symbol} ${range} chart">${grid}${type === "candle" ? candles : `<path class="chart-area" d="${areaPath}"/><polyline class="chart-line" points="${linePoints}"/>`}${volume}${cost}${markers}${xLabels}<line class="chart-crosshair" data-cross-x x1="0" y1="${margin.top}" x2="0" y2="${volumeBottom}" visibility="hidden"/><line class="chart-crosshair" data-cross-y x1="${margin.left}" y1="0" x2="${width - margin.right}" y2="0" visibility="hidden"/><rect data-chart-overlay x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${volumeBottom - margin.top}" fill="transparent"/></svg><div class="chart-tooltip hidden"></div>`;
    const first = rows[0].close, last = rows.at(-1).close, periodReturn = first ? (last / first - 1) * 100 : null, high = Math.max(...rows.map(row => row.high)), low = Math.min(...rows.map(row => row.low));
    const stats = host.querySelector("[data-chart-stats]");
    if (stats) stats.innerHTML = `<div class="chart-stat"><span>${copy("periodReturn")}</span><strong class="${periodReturn > 0 ? "up" : periodReturn < 0 ? "down" : ""}">${percent(periodReturn)}</strong></div><div class="chart-stat"><span>${copy("periodHigh")}</span><strong>${money(high, data.currency)}</strong></div><div class="chart-stat"><span>${copy("periodLow")}</span><strong>${money(low, data.currency)}</strong></div><div class="chart-stat"><span>${copy("volume")}</span><strong>${Math.round(rows.at(-1).volume || 0).toLocaleString(locale())}</strong></div>`;
    const svg = body.querySelector("svg"), overlay = body.querySelector("[data-chart-overlay]"), tooltip = body.querySelector(".chart-tooltip"), crossX = body.querySelector("[data-cross-x]"), crossY = body.querySelector("[data-cross-y]");
    const hide = () => { tooltip.classList.add("hidden"); crossX.setAttribute("visibility", "hidden"); crossY.setAttribute("visibility", "hidden"); };
    overlay.addEventListener("pointermove", event => {
      const rect = svg.getBoundingClientRect(), localX = (event.clientX - rect.left) / rect.width * width, index = Math.max(0, Math.min(rows.length - 1, Math.round((localX - margin.left) / plotWidth * (rows.length - 1)))), row = rows[index], xx = x(index), yy = y(row.close);
      crossX.setAttribute("x1", xx); crossX.setAttribute("x2", xx); crossX.setAttribute("visibility", "visible"); crossY.setAttribute("y1", yy); crossY.setAttribute("y2", yy); crossY.setAttribute("visibility", "visible");
      tooltip.innerHTML = `<strong>${dateTime(row.time)}</strong><span>${copy("open")}: ${money(row.open, data.currency)}</span><span>${copy("high")}: ${money(row.high, data.currency)}</span><span>${copy("low")}: ${money(row.low, data.currency)}</span><span>${copy("close")}: ${money(row.close, data.currency)}</span><span>${copy("volume")}: ${Math.round(row.volume || 0).toLocaleString(locale())}</span>`;
      tooltip.classList.remove("hidden"); const px = event.clientX - body.getBoundingClientRect().left, py = event.clientY - body.getBoundingClientRect().top; tooltip.style.left = `${Math.min(Math.max(8, px + 14), body.clientWidth - 190)}px`; tooltip.style.top = `${Math.max(8, py - 20)}px`;
    });
    overlay.addEventListener("pointerleave", hide);
  }

  async function loadActiveChart(force = false) {
    const active = runtime.activeChart; if (!active?.host?.isConnected) return;
    const body = active.host.querySelector(".chart-body"); body.innerHTML = `<div class="chart-state">${copy("chartLoading")}</div><div class="chart-tooltip hidden"></div>`;
    try { active.data = await fetchHistory(providerSymbol(active.asset), active.range, force); renderChart(active); updateActiveChartQuote(); }
    catch (_) { body.innerHTML = `<div class="chart-state">${copy("chartUnavailable")}</div><div class="chart-tooltip hidden"></div>`; }
  }

  function wireChart(host) {
    host.querySelectorAll("[data-chart-range]").forEach(button => button.addEventListener("click", () => { host.querySelectorAll("[data-chart-range]").forEach(item => item.classList.toggle("active", item === button)); runtime.activeChart.range = button.dataset.chartRange; loadActiveChart(false); }));
    host.querySelectorAll("[data-chart-type]").forEach(button => button.addEventListener("click", () => { host.querySelectorAll("[data-chart-type]").forEach(item => item.classList.toggle("active", item === button)); runtime.activeChart.type = button.dataset.chartType; if (runtime.activeChart.data) renderChart(runtime.activeChart); }));
  }

  function injectChart(ticker) {
    const drawer = document.getElementById("drawerContent"); if (!drawer) return;
    drawer.querySelector("#assetLiveChart")?.remove();
    const asset = chartAsset(ticker), host = createChartShell(ticker), anchor = drawer.querySelector(".drawer-metrics") || drawer.querySelector(".drawer-header");
    anchor?.insertAdjacentElement("afterend", host); runtime.activeChart = { ticker, asset, host, range: "1M", type: "line", data: null }; wireChart(host); updateActiveChartQuote(); loadActiveChart(false);
  }

  function openChartForSymbol(symbol) {
    const report = (state.report?.watchlist || []).find(row => symbolAliases(row).includes(normalizeSymbol(symbol))), ticker = report?.ticker || symbol;
    openAssetDrawer(ticker); setTimeout(() => { if (!document.getElementById("assetLiveChart")) injectChart(ticker); }, 0);
  }

  function patchApplication() {
    runtime.original.portfolioMarketPrices = portfolioMarketPrices;
    portfolioMarketPrices = function liveAwarePortfolioMarketPrices() { return { ...state.portfolio.manualPrices, ...runtime.original.portfolioMarketPrices(), ...livePortfolioPrices() }; };
    runtime.original.renderWatchlist = renderWatchlist;
    renderWatchlist = function liveAwareRenderWatchlist(items, evaluations) { runtime.original.renderWatchlist(items, evaluations); renderLiveAnnotations(); };
    runtime.original.renderPortfolio = renderPortfolio;
    renderPortfolio = function liveAwareRenderPortfolio() { runtime.original.renderPortfolio(); enhancePortfolioRows(); };
    runtime.original.openAssetDrawer = openAssetDrawer;
    openAssetDrawer = function liveAwareOpenAssetDrawer(ticker) { runtime.original.openAssetDrawer(ticker); injectChart(ticker); };
    const refresh = document.getElementById("refresh");
    if (refresh) refresh.onclick = async () => { await load(); await refreshQuotes(true); if (runtime.activeChart?.host?.isConnected) await loadActiveChart(true); };
    const originalApplyLanguage = applyLanguage;
    applyLanguage = function liveAwareApplyLanguage() { originalApplyLanguage(); if (runtime.activeChart?.host?.isConnected) injectChart(runtime.activeChart.ticker); renderLiveAnnotations(); };
  }

  function schedule() {
    clearInterval(runtime.timer); runtime.timer = setInterval(() => refreshQuotes(false), REFRESH_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (runtime.lastRefresh || 0) > REFRESH_MS) refreshQuotes(false); });
  }

  function waitForReport() {
    if (state.report) { refreshQuotes(true); return; }
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (state.report) { clearInterval(timer); refreshQuotes(true); } else if (attempts > 80) clearInterval(timer); }, 250);
  }

  function install() {
    if (runtime.installed || typeof document === "undefined") return;
    if (typeof state === "undefined" || typeof portfolioResult !== "function" || typeof openAssetDrawer !== "function") { setTimeout(install, 50); return; }
    runtime.installed = true; installStyles(); patchApplication(); schedule(); waitForReport();
  }

  return { REFRESH_MS, RANGE_CONFIG, normalizeSymbol, providerSymbol, symbolAliases, quoteFreshness, parseQuoteResult, parseChartPayload, quoteFromChart, fetchHistory, fetchQuotes, install, runtime };
});