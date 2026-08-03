"use strict";

(function installLiveMarketAndCharts(root) {
  const MIC_MARKET_URL = "../mic/data/market.json";
  const MIC_HISTORY_URL = symbol => `../mic/data/history/${encodeURIComponent(symbol)}.json`;
  const REFRESH_MS = 60_000;
  const PERIODS = { "1H": 1, "1W": 7, "1A": 31, "3A": 93, "6A": 186, "1Y": 366, "2Y": 732 };
  const TV_EXCHANGE = {
    CEG: "NYSE", DLR: "NYSE", EQIX: "NASDAQ", LUNR: "NASDAQ", SMR: "NYSE", TSM: "NYSE", VRT: "NYSE", VST: "NYSE",
    AMZN: "NASDAQ", AMD: "NASDAQ", GOOGL: "NASDAQ", LRCX: "NASDAQ", MRVL: "NASDAQ", NVDA: "NASDAQ", PLTR: "NASDAQ", SNDK: "NASDAQ", TSLA: "NASDAQ"
  };
  const runtime = { quotes: new Map(), updatedAt: null, timer: null, activeTicker: null, activePeriod: "1Y", activeMode: "portfolio", historyCache: new Map() };

  const lang = () => document.documentElement.lang === "en" ? "en" : "tr";
  const copy = () => lang() === "en" ? {
    title: "Price and portfolio chart", portfolio: "Portfolio chart", intraday: "Intraday · TradingView", loading: "Loading price history…", unavailable: "Price history is unavailable for this asset.",
    source: "MIC market cache", updated: "Updated", periodic: "Periodic market refresh", price: "Price", average: "Average cost", buy: "Buy", sell: "Sell", high: "Period high", low: "Period low", return: "Period return",
    liveHelp: "TradingView determines whether the selected exchange is real-time, delayed or end-of-day. The provider label remains visible.", refresh: "Refresh market data"
  } : {
    title: "Fiyat ve portföy grafiği", portfolio: "Portföy grafiği", intraday: "İşlem içi · TradingView", loading: "Fiyat geçmişi yükleniyor…", unavailable: "Bu varlık için fiyat geçmişi bulunamadı.",
    source: "MIC piyasa önbelleği", updated: "Güncelleme", periodic: "Periyodik piyasa yenilemesi", price: "Fiyat", average: "Ortalama maliyet", buy: "Alış", sell: "Satış", high: "Dönem zirvesi", low: "Dönem dibi", return: "Dönem getirisi",
    liveHelp: "Seçilen borsanın gerçek zamanlı, gecikmeli veya gün sonu veri düzeyi TradingView tarafından belirlenir. Sağlayıcı etiketi görünür kalır.", refresh: "Piyasa verisini yenile"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }

  function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  function formatNumber(value, digits = 2) { const number = finite(value); return number === null ? "—" : new Intl.NumberFormat(lang() === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: digits }).format(number); }
  function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(lang() === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Muscat" }).format(date); }

  function tradingViewSymbol(ticker, providerSymbol) {
    const symbol = String(ticker || "").toUpperCase().replace(/\.IS$/, "");
    if (String(providerSymbol || "").toUpperCase().endsWith(".IS") || !TV_EXCHANGE[symbol]) return `BIST:${symbol}`;
    return `${TV_EXCHANGE[symbol]}:${symbol}`;
  }

  function normalizeMarketPayload(payload) {
    const assets = Array.isArray(payload?.assets) ? payload.assets : Array.isArray(payload?.data?.assets) ? payload.data.assets : [];
    return {
      updatedAt: payload?.updated_at || payload?.data?.updated_at || null,
      assets: assets.map(item => ({
        ticker: String(item.symbol || item.ticker || "").toUpperCase().replace(/\.IS$/, ""),
        price: finite(item.price ?? item.last ?? item.close),
        change: finite(item.change ?? item.change_percent ?? item.change_pct),
        volume: finite(item.volume), currency: String(item.currency || "").toUpperCase(),
        exchange: item.exchange || null
      })).filter(item => item.ticker && item.price !== null)
    };
  }

  function applyQuotesToApplication(normalized) {
    runtime.updatedAt = normalized.updatedAt;
    runtime.quotes = new Map(normalized.assets.map(item => [item.ticker, item]));
    if (!root.state?.report) return;
    const updatedAt = normalized.updatedAt || new Date().toISOString();
    for (const row of root.state.report.watchlist || []) {
      const ticker = String(row.ticker || "").toUpperCase().replace(/\.IS$/, "");
      const quote = runtime.quotes.get(ticker);
      if (!quote) continue;
      row.price = quote.price;
      if (quote.change !== null) row.return_1d_pct = quote.change;
      if (quote.currency) row.currency = quote.currency;
      row.price_as_of = updatedAt;
      row.provider = "MIC periodic market cache";
      row.data_status = "PERIODIC";
    }
    for (const evaluation of root.state.report.company_evaluations || []) {
      const row = (root.state.report.watchlist || []).find(item => item.ticker === evaluation.ticker);
      if (!row) continue;
      evaluation.price_context = { ...(evaluation.price_context || {}), currency: row.currency, price: row.price, return_1d_pct: row.return_1d_pct, price_as_of: row.price_as_of, data_status: row.data_status };
    }
    root.render?.();
    updateMarketStatus();
    if (runtime.activeTicker && document.querySelector("#assetDrawer.open")) enhanceDrawer(runtime.activeTicker, true);
  }

  function updateMarketStatus() {
    const status = document.getElementById("freshness");
    if (!status || !runtime.updatedAt) return;
    status.textContent = `${copy().periodic} · ${formatDateTime(runtime.updatedAt)}`;
    status.className = "status-pill positive";
    status.title = copy().source;
  }

  async function refreshQuotes({ silent = false } = {}) {
    try {
      const response = await fetch(`${MIC_MARKET_URL}?v=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const normalized = normalizeMarketPayload(await response.json());
      if (!normalized.assets.length) throw new Error("EMPTY_MARKET_PAYLOAD");
      applyQuotesToApplication(normalized);
      if (!silent && root.showToast) root.showToast(`${copy().updated}: ${formatDateTime(normalized.updatedAt || new Date())}`);
      return normalized;
    } catch (error) {
      console.warn("MIC market refresh failed", error);
      return null;
    }
  }

  async function loadHistory(ticker) {
    const symbol = String(ticker || "").toUpperCase().replace(/\.IS$/, "");
    if (runtime.historyCache.has(symbol)) return runtime.historyCache.get(symbol);
    const response = await fetch(`${MIC_HISTORY_URL(symbol)}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const history = (payload.history || []).map(item => ({
      date: String(item.date || ""), open: finite(item.open), high: finite(item.high), low: finite(item.low), close: finite(item.close), volume: finite(item.volume) || 0
    })).filter(item => item.date && item.close !== null).sort((a, b) => a.date.localeCompare(b.date));
    const result = { ...payload, history };
    runtime.historyCache.set(symbol, result);
    return result;
  }

  function periodHistory(history, period) {
    if (!history.length) return [];
    if (period === "2Y") return history;
    const days = PERIODS[period] || PERIODS["1Y"];
    const end = new Date(`${history.at(-1).date}T12:00:00Z`).getTime();
    const start = end - days * 86400000;
    return history.filter(item => new Date(`${item.date}T12:00:00Z`).getTime() >= start);
  }

  function portfolioForTicker(ticker) {
    const symbol = String(ticker || "").toUpperCase().replace(/\.IS$/, "");
    const result = root.portfolioResult?.();
    const holding = result?.openHoldings?.find(item => String(item.symbol).toUpperCase().replace(/\.IS$/, "") === symbol) || null;
    const transactions = (result?.ledger || []).filter(item => String(item.symbol).toUpperCase().replace(/\.IS$/, "") === symbol);
    return { holding, transactions };
  }

  function createPortfolioSvg(rows, ticker) {
    if (!rows.length) return "";
    const width = 900, height = 430, left = 62, right = 18, top = 22, priceBottom = 320, volumeTop = 344, volumeBottom = 402;
    const closes = rows.map(row => row.close);
    const { holding, transactions } = portfolioForTicker(ticker);
    const values = [...closes];
    if (holding?.averageCost != null) values.push(holding.averageCost);
    transactions.forEach(tx => values.push(tx.unitPrice));
    let min = Math.min(...values), max = Math.max(...values);
    const padding = Math.max((max - min) * .08, Math.abs(max) * .01, 1);
    min -= padding; max += padding;
    const x = index => left + index / Math.max(1, rows.length - 1) * (width - left - right);
    const y = value => top + (max - value) / Math.max(.000001, max - min) * (priceBottom - top);
    const path = rows.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(row.close).toFixed(2)}`).join(" ");
    const area = `${path} L${x(rows.length - 1)},${priceBottom} L${x(0)},${priceBottom} Z`;
    const maxVolume = Math.max(...rows.map(row => row.volume), 1);
    const bars = rows.map((row, index) => { const barHeight = row.volume / maxVolume * (volumeBottom - volumeTop); return `<rect x="${(x(index) - Math.max(1, (width-left-right)/rows.length*.35)).toFixed(2)}" y="${(volumeBottom-barHeight).toFixed(2)}" width="${Math.max(1, (width-left-right)/rows.length*.7).toFixed(2)}" height="${barHeight.toFixed(2)}" class="live-volume"/>`; }).join("");
    const grid = [0, .25, .5, .75, 1].map(ratio => { const value = max - (max-min)*ratio; const gy = y(value); return `<line x1="${left}" y1="${gy}" x2="${width-right}" y2="${gy}" class="live-grid"/><text x="${left-8}" y="${gy+4}" text-anchor="end" class="live-axis">${escapeHtml(formatNumber(value))}</text>`; }).join("");
    const average = holding?.averageCost != null ? `<line x1="${left}" y1="${y(holding.averageCost)}" x2="${width-right}" y2="${y(holding.averageCost)}" class="live-cost"/><text x="${width-right-4}" y="${y(holding.averageCost)-7}" text-anchor="end" class="live-cost-label">${escapeHtml(copy().average)} ${escapeHtml(formatNumber(holding.averageCost))}</text>` : "";
    const byDate = new Map(rows.map((row, index) => [row.date, index]));
    const markers = transactions.map(tx => { let index = byDate.get(tx.date); if (index === undefined) { index = rows.findIndex(row => row.date >= tx.date); if (index < 0) index = rows.length - 1; } if (index < 0 || index >= rows.length) return ""; const cy = y(tx.unitPrice); const buy = tx.side === "BUY"; return `<g class="live-marker ${buy ? "buy" : "sell"}"><circle cx="${x(index)}" cy="${cy}" r="5"/><title>${escapeHtml(`${buy ? copy().buy : copy().sell)} · ${tx.date} · ${formatNumber(tx.quantity)} @ ${formatNumber(tx.unitPrice)}`)}</title></g>`; }).join("");
    const ticks = [0, Math.floor((rows.length-1)/2), rows.length-1].filter((value, index, array) => array.indexOf(value) === index).map(index => `<text x="${x(index)}" y="${height-6}" text-anchor="${index===0?"start":index===rows.length-1?"end":"middle"}" class="live-axis">${escapeHtml(rows[index].date)}</text>`).join("");
    return `<svg class="live-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${ticker} ${copy().title}`)}"><defs><linearGradient id="liveArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" class="live-area"/><path d="${path}" class="live-line"/>${average}${markers}${bars}${ticks}</svg>`;
  }

  function metrics(rows) {
    if (!rows.length) return { high: null, low: null, change: null };
    const high = Math.max(...rows.map(item => item.high ?? item.close));
    const low = Math.min(...rows.map(item => item.low ?? item.close));
    const first = rows[0].close, last = rows.at(-1).close;
    return { high, low, change: first ? (last / first - 1) * 100 : null };
  }

  function tradingViewFrame(ticker, providerSymbol) {
    const symbol = tradingViewSymbol(ticker, providerSymbol);
    const locale = lang() === "tr" ? "tr" : "en";
    const params = new URLSearchParams({ symbol, interval: "15", hidesidetoolbar: "0", symboledit: "1", saveimage: "0", toolbarbg: "F1F3F6", studies: "[]", theme: "light", style: "1", timezone: "Asia/Muscat", withdateranges: "1", hideideas: "1", locale, enablepublishing: "0", allow_symbol_change: "1" });
    return `<iframe class="tradingview-frame" title="TradingView ${escapeHtml(ticker)}" src="https://s.tradingview.com/widgetembed/?${params.toString()}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="live-chart-note">${escapeHtml(copy().liveHelp)}</p>`;
  }

  function chartShell(ticker, providerSymbol) {
    const periods = Object.keys(PERIODS).map(period => `<button type="button" class="live-period ${runtime.activePeriod === period ? "active" : ""}" data-period="${period}">${period}</button>`).join("");
    return `<section id="liveChartSection" class="drawer-section live-chart-section"><div class="live-chart-head"><div><p class="eyebrow">MIC · MARKET</p><h3>${escapeHtml(copy().title)}</h3><p id="liveQuoteMeta" class="live-quote-meta">${escapeHtml(copy().source)} · ${escapeHtml(formatDateTime(runtime.updatedAt))}</p></div><button id="liveMarketRefresh" class="button" type="button">${escapeHtml(copy().refresh)}</button></div><div class="live-chart-tabs"><button type="button" data-chart-mode="portfolio" class="${runtime.activeMode === "portfolio" ? "active" : ""}">${escapeHtml(copy().portfolio)}</button><button type="button" data-chart-mode="intraday" class="${runtime.activeMode === "intraday" ? "active" : ""}">${escapeHtml(copy().intraday)}</button></div><div id="portfolioChartPanel" class="${runtime.activeMode === "portfolio" ? "" : "hidden"}"><div class="live-periods">${periods}</div><div id="liveChartCanvas" class="live-chart-canvas"><p>${escapeHtml(copy().loading)}</p></div><div id="liveChartMetrics" class="live-chart-metrics"></div></div><div id="intradayChartPanel" class="${runtime.activeMode === "intraday" ? "" : "hidden"}">${tradingViewFrame(ticker, providerSymbol)}</div></section>`;
  }

  async function renderPortfolioChart(ticker) {
    const canvas = document.getElementById("liveChartCanvas");
    if (!canvas) return;
    try {
      const payload = await loadHistory(ticker);
      const rows = periodHistory(payload.history, runtime.activePeriod);
      if (!rows.length) throw new Error("NO_HISTORY");
      canvas.innerHTML = createPortfolioSvg(rows, ticker);
      const summary = metrics(rows);
      const quote = runtime.quotes.get(String(ticker).toUpperCase());
      const holding = portfolioForTicker(ticker).holding;
      document.getElementById("liveChartMetrics").innerHTML = `<div><span>${escapeHtml(copy().price)}</span><strong>${escapeHtml(formatNumber(quote?.price ?? rows.at(-1).close))}</strong></div><div><span>${escapeHtml(copy().high)}</span><strong>${escapeHtml(formatNumber(summary.high))}</strong></div><div><span>${escapeHtml(copy().low)}</span><strong>${escapeHtml(formatNumber(summary.low))}</strong></div><div><span>${escapeHtml(copy().return)}</span><strong class="${summary.change >= 0 ? "up" : "down"}">${summary.change > 0 ? "+" : ""}${escapeHtml(formatNumber(summary.change, 1))}%</strong></div>${holding ? `<div><span>${escapeHtml(copy().average)}</span><strong>${escapeHtml(formatNumber(holding.averageCost))}</strong></div>` : ""}`;
    } catch (error) {
      console.warn("MIC history chart failed", ticker, error);
      canvas.innerHTML = `<p>${escapeHtml(copy().unavailable)}</p>`;
      const metricsArea = document.getElementById("liveChartMetrics"); if (metricsArea) metricsArea.innerHTML = "";
    }
  }

  function wireChart(ticker, providerSymbol) {
    document.querySelectorAll("[data-chart-mode]").forEach(button => button.addEventListener("click", () => {
      runtime.activeMode = button.dataset.chartMode;
      document.querySelectorAll("[data-chart-mode]").forEach(item => item.classList.toggle("active", item === button));
      document.getElementById("portfolioChartPanel").classList.toggle("hidden", runtime.activeMode !== "portfolio");
      document.getElementById("intradayChartPanel").classList.toggle("hidden", runtime.activeMode !== "intraday");
    }));
    document.querySelectorAll(".live-period").forEach(button => button.addEventListener("click", () => { runtime.activePeriod = button.dataset.period; document.querySelectorAll(".live-period").forEach(item => item.classList.toggle("active", item === button)); renderPortfolioChart(ticker); }));
    document.getElementById("liveMarketRefresh")?.addEventListener("click", async () => { await refreshQuotes(); await renderPortfolioChart(ticker); });
  }

  function enhanceDrawer(ticker, preserveMode = false) {
    runtime.activeTicker = ticker;
    if (!preserveMode) { runtime.activePeriod = "1Y"; runtime.activeMode = "portfolio"; }
    const drawer = document.getElementById("drawerContent");
    if (!drawer) return;
    drawer.querySelector("#liveChartSection")?.remove();
    const market = (root.state?.report?.watchlist || []).find(item => item.ticker === ticker) || {};
    drawer.insertAdjacentHTML("afterbegin", chartShell(ticker, market.provider_symbol));
    wireChart(ticker, market.provider_symbol);
    renderPortfolioChart(ticker);
  }

  function installStyles() {
    if (document.getElementById("liveMarketStyles")) return;
    const style = document.createElement("style");
    style.id = "liveMarketStyles";
    style.textContent = `.live-chart-section{margin:0 0 20px;padding:18px;border:1px solid var(--line);border-radius:4px 22px 4px 22px;background:var(--paper-soft)}.live-chart-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.live-chart-head h3{margin:3px 0 4px}.live-quote-meta,.live-chart-note{margin:0;color:var(--muted);font-size:.7rem;line-height:1.5}.live-chart-tabs,.live-periods{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}.live-chart-tabs button,.live-period{border:1px solid var(--line);background:var(--paper);color:var(--ink-2);padding:7px 10px;border-radius:999px;font-size:.7rem;font-weight:750}.live-chart-tabs button.active,.live-period.active{background:var(--pine);border-color:var(--pine);color:#fff}.live-chart-canvas{min-height:270px;display:grid;place-items:center;overflow:hidden}.live-chart-svg{display:block;width:100%;height:auto;max-height:430px;color:var(--pine-2)}.live-line{fill:none;stroke:currentColor;stroke-width:2.4;vector-effect:non-scaling-stroke}.live-area{fill:url(#liveArea);stroke:none}.live-grid{stroke:var(--line);stroke-width:1}.live-axis{fill:var(--muted);font-size:11px}.live-volume{fill:var(--sage);opacity:.58}.live-cost{stroke:var(--clay);stroke-width:2;stroke-dasharray:7 5}.live-cost-label{fill:var(--clay);font-size:11px;font-weight:700}.live-marker circle{stroke:var(--paper);stroke-width:2}.live-marker.buy circle{fill:var(--positive)}.live-marker.sell circle{fill:var(--negative)}.live-chart-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:10px}.live-chart-metrics>div{padding:10px;background:var(--paper)}.live-chart-metrics span,.live-chart-metrics strong{display:block}.live-chart-metrics span{font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.live-chart-metrics strong{margin-top:4px}.tradingview-frame{display:block;width:100%;height:520px;border:0;background:var(--paper)}.live-chart-note{margin-top:8px}.hidden{display:none!important}@media(max-width:720px){.live-chart-head{display:block}.live-chart-head .button{margin-top:10px}.live-chart-metrics{grid-template-columns:1fr 1fr}.tradingview-frame{height:460px}}`;
    document.head.appendChild(style);
  }

  function install() {
    installStyles();
    const previousOpen = root.openAssetDrawer;
    if (typeof previousOpen === "function") root.openAssetDrawer = function openAssetWithLiveChart(ticker) { previousOpen(ticker); enhanceDrawer(ticker); };
    const refreshButton = document.getElementById("refresh");
    if (refreshButton) { const previous = refreshButton.onclick; refreshButton.onclick = async event => { if (typeof previous === "function") await previous.call(refreshButton, event); await refreshQuotes(); }; }
    refreshQuotes({ silent: true });
    runtime.timer = setInterval(() => refreshQuotes({ silent: true }), REFRESH_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshQuotes({ silent: true }); });
  }

  root.LiveMarketCharts = { tradingViewSymbol, normalizeMarketPayload, periodHistory, metrics, refreshQuotes, enhanceDrawer };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})(typeof window !== "undefined" ? window : globalThis);
