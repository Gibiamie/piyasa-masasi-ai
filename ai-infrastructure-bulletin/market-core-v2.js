(() => {
  "use strict";

  if (window.__PM_MARKET_CORE_V2__) return;
  window.__PM_MARKET_CORE_V2__ = true;
  window.__PM_MARKET_WORKSPACE_CORE__ = true;

  const URLS = {
    catalog: "./data/equity-catalog.json",
    market: "../mic/data/market.json",
    nasdaq: "../mic/data/nasdaq-quotes.json",
    report: "./data/report.json"
  };
  const HISTORY_BASE = "../mic/data/history";
  const RANGE_DAYS = { "1D": 2, "1W": 8, "1M": 32, "3M": 94, "6M": 187, "1Y": 367, "2Y": 735 };
  const MAX_VISIBLE = 500;

  const model = {
    assets: [],
    byKey: new Map(),
    byProvider: new Map(),
    selectedKey: null,
    filter: "ALL",
    query: "",
    range: "1Y",
    mode: "CANDLE",
    source: "DAILY",
    history: [],
    historyCache: new Map(),
    requestVersion: 0,
    catalogAt: null,
    marketAt: null,
    loading: false,
    warnings: []
  };

  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const symbolOf = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const exchangeOf = value => String(value || "").trim().toUpperCase();
  const lang = () => (typeof state !== "undefined" && state.language === "en") || document.documentElement.lang === "en" ? "en" : "tr";
  const tr = (turkish, english) => lang() === "en" ? english : turkish;
  const locale = () => lang() === "en" ? "en-GB" : "tr-TR";
  const keyOf = (market, symbol) => `${market}:${symbolOf(symbol)}`;
  const cleanSource = value => String(value || "").replace(/TradingView/gi, "MIC").replace(/\s+/g, " ").trim();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const selected = () => model.byKey.get(model.selectedKey) || null;
  const money = (value, currency = "TRY") => {
    const number = finite(value);
    if (number === null) return "—";
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number); }
    catch (_) { return `${number.toLocaleString(locale())} ${currency}`; }
  };
  const pct = value => {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  };
  const compact = value => {
    const number = finite(value);
    return number === null ? "—" : new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };
  const valueClass = value => finite(value) === null || finite(value) === 0 ? "" : finite(value) > 0 ? "up" : "down";

  function marketFrom(raw) {
    const exchange = exchangeOf(raw?.exchange);
    const provider = exchangeOf(raw?.provider_symbol || raw?.providerSymbol);
    const currency = exchangeOf(raw?.currency);
    return exchange === "BIST" || provider.endsWith(".IS") || currency === "TRY" ? "BIST" : "US";
  }

  function ageLabel(value) {
    if (!value) return tr("zaman yok", "no timestamp");
    const timestamp = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return tr("zaman yok", "no timestamp");
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 2) return tr("az önce", "just now");
    if (minutes < 120) return `${minutes} ${tr("dk önce", "min ago")}`;
    if (minutes < 2880) return `${Math.round(minutes / 60)} ${tr("saat önce", "hours ago")}`;
    return `${Math.round(minutes / 1440)} ${tr("gün önce", "days ago")}`;
  }

  async function fetchJson(url, force = false) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${force ? Date.now() : "current"}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Accept: "application/json,text/plain,*/*" }
    });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  function catalogAsset(raw) {
    const market = raw.market === "BIST" ? "BIST" : "US";
    const symbol = symbolOf(raw.symbol);
    return {
      key: keyOf(market, symbol),
      market,
      exchange: exchangeOf(raw.exchange) || market,
      segment: raw.market_segment || "",
      symbol,
      providerSymbol: raw.provider_symbol || (market === "BIST" ? `${symbol}.IS` : symbol),
      name: raw.name || symbol,
      type: "stock",
      currency: raw.currency || (market === "BIST" ? "TRY" : "USD"),
      country: raw.country || "",
      sector: raw.sector || "",
      industry: raw.industry || "",
      price: null,
      change: null,
      volume: null,
      marketCap: null,
      performance: {},
      quoteAt: null,
      source: "",
      dataStatus: "CATALOG_ONLY"
    };
  }

  function overlayAsset(map, raw, explicitMarket = null, priority = 10) {
    const market = explicitMarket || marketFrom(raw);
    const symbol = symbolOf(raw?.symbol || raw?.ticker || raw?.provider_symbol || raw?.providerSymbol);
    const key = keyOf(market, symbol);
    const asset = map.get(key);
    if (!asset) return;
    const nextPriority = Number(asset._priority || 0);
    const overwrite = priority >= nextPriority;
    const price = finite(raw?.price ?? raw?.regularMarketPrice);
    const change = finite(raw?.change ?? raw?.change_percent ?? raw?.return_1d_pct ?? raw?.regularMarketChangePercent);
    if (price !== null && (overwrite || asset.price === null)) asset.price = price;
    if (change !== null && (overwrite || asset.change === null)) asset.change = change;
    const volume = finite(raw?.volume ?? raw?.regularMarketVolume);
    const cap = finite(raw?.market_cap ?? raw?.marketCap);
    if (volume !== null && (overwrite || asset.volume === null)) asset.volume = volume;
    if (cap !== null && (overwrite || asset.marketCap === null)) asset.marketCap = cap;
    if (raw?.name || raw?.company || raw?.longName) asset.name = raw.name || raw.company || raw.longName;
    if (raw?.sector) asset.sector = raw.sector;
    if (raw?.industry) asset.industry = raw.industry;
    if (raw?.exchange && market === "US") asset.exchange = exchangeOf(raw.exchange);
    if (raw?.performance) asset.performance = { ...asset.performance, ...raw.performance };
    if (raw?.return_21d_pct !== undefined) asset.performance["1A"] = finite(raw.return_21d_pct);
    if (raw?.return_252d_pct !== undefined) asset.performance["1Y"] = finite(raw.return_252d_pct);
    asset.quoteAt = raw?.price_as_of || raw?.quote_as_of || raw?.updated_at || (raw?.regularMarketTime ? Number(raw.regularMarketTime) * 1000 : null) || asset.quoteAt;
    asset.source = cleanSource(raw?.source || raw?.provider || raw?.quote_source) || asset.source;
    asset.dataStatus = raw?.data_status || raw?.quote_mode || (price !== null ? "PRICE_AVAILABLE" : asset.dataStatus);
    asset._priority = Math.max(nextPriority, priority);
  }

  function buildUniverse(catalog, marketPayload, nasdaqPayload, reportPayload) {
    if (!Array.isArray(catalog?.assets) || catalog.assets.length < 6000) throw new Error("EQUITY_CATALOG_INVALID");
    const map = new Map(catalog.assets.map(raw => {
      const asset = catalogAsset(raw);
      return [asset.key, asset];
    }));

    for (const raw of marketPayload?.assets || []) {
      overlayAsset(map, { ...raw, updated_at: raw.price_as_of || marketPayload.updated_at, source: raw.source || marketPayload.source }, null, 30);
    }
    for (const raw of reportPayload?.watchlist || []) {
      overlayAsset(map, {
        ...raw,
        symbol: raw.ticker || raw.provider_symbol,
        name: raw.company || raw.ticker,
        exchange: String(raw.provider_symbol || "").toUpperCase().endsWith(".IS") ? "BIST" : raw.exchange,
        price_as_of: raw.price_as_of || reportPayload.generated_at
      }, null, 10);
    }
    const quotes = nasdaqPayload?.quotes || nasdaqPayload?.data || {};
    for (const [symbol, raw] of Object.entries(quotes)) {
      overlayAsset(map, { ...raw, symbol, currency: "USD", updated_at: raw.price_as_of || nasdaqPayload.updated_at, source: raw.source || nasdaqPayload.source }, "US", 40);
    }

    model.byKey = map;
    model.assets = [...map.values()].map(asset => {
      delete asset._priority;
      return asset;
    }).sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol) || a.exchange.localeCompare(b.exchange));
    model.byProvider = new Map(model.assets.map(asset => [String(asset.providerSymbol).toUpperCase(), asset]));
    model.catalogAt = catalog.generated_at || null;
    model.marketAt = [marketPayload?.updated_at, nasdaqPayload?.updated_at, reportPayload?.generated_at].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;

    const remembered = sessionStorage.getItem("pm-market-selected-key");
    if (remembered && map.has(remembered)) model.selectedKey = remembered;
    if (!model.selectedKey || !map.has(model.selectedKey)) model.selectedKey = map.has("BIST:THYAO") ? "BIST:THYAO" : model.assets[0]?.key || null;
  }

  function injectStyles() {
    if ($("pm-market-v2-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-market-v2-styles";
    style.textContent = `
      .pm-status-strip{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin-bottom:18px}.pm-status-card,.pm-position-card,.pm-market-metric{border:1px solid var(--line);background:var(--paper-soft);border-radius:12px 12px 12px 3px;padding:10px}.pm-status-card span,.pm-position-card span,.pm-market-metric span{display:block;color:var(--muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em}.pm-status-card strong,.pm-position-card strong,.pm-market-metric strong{display:block;margin-top:5px;font-size:.88rem}.pm-market-layout{display:grid;grid-template-columns:minmax(300px,370px) minmax(0,1fr);gap:18px}.pm-market-panel{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px 5px 18px 5px;overflow:hidden}.pm-market-sidebar{min-height:760px}.pm-market-search{padding:14px;border-bottom:1px solid var(--line)}.pm-market-search input{width:100%}.pm-market-filters{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);overflow:auto}.pm-market-chip{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--paper-soft);color:var(--muted);white-space:nowrap;font-size:.72rem}.pm-market-chip.active{background:var(--pine);border-color:var(--pine);color:#fff}.pm-market-list-meta{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;color:var(--muted);font-size:.68rem}.pm-market-list{height:650px;overflow:auto;padding:0 8px 12px}.pm-asset-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid transparent;border-radius:12px;padding:10px;background:transparent;color:var(--ink);text-align:left}.pm-asset-row:hover{background:var(--paper-soft)}.pm-asset-row.active{border-color:var(--pine-2);background:var(--sage-soft)}.pm-asset-row strong,.pm-asset-row small,.pm-asset-price span{display:block}.pm-asset-row small{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-asset-exchange{display:inline-block;margin-left:6px;padding:2px 5px;border-radius:999px;background:rgba(23,58,51,.08);font-size:.58rem;color:var(--muted);font-style:normal}.pm-asset-price{text-align:right}.pm-asset-price span{font-weight:750}.up{color:var(--positive)}.down{color:var(--negative)}.pm-market-main{padding:20px}.pm-market-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.pm-market-head h2{margin:4px 0 5px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.5rem,2.4vw,2.2rem);font-weight:500}.pm-market-head p{margin:0;color:var(--muted)}.pm-market-quote{text-align:right}.pm-market-quote strong{display:block;font-size:1.7rem}.pm-market-quote span{display:block;margin-top:5px}.pm-market-metrics{display:grid;grid-template-columns:repeat(7,minmax(95px,1fr));gap:8px;margin:16px 0}.pm-market-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.pm-segmented{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-segmented button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-segmented button.active{background:var(--pine);color:#fff}.pm-chart-shell{margin-top:12px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0b1d1a}.pm-daily-wrap,.pm-intraday-wrap{height:520px}.pm-daily-wrap{position:relative}.pm-daily-wrap.hidden,.pm-intraday-wrap{display:none}.pm-intraday-wrap.active{display:block}.pm-daily-wrap canvas{width:100%;height:100%;display:block}.pm-chart-message{position:absolute;inset:0;display:grid;place-items:center;color:#afbeb9;text-align:center;padding:28px}.pm-chart-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 11px;border-top:1px solid rgba(255,255,255,.12);background:#102722;color:#afbeb9;font-size:.68rem}.pm-market-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.pm-position-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pm-status-note{margin:10px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}@media(max-width:1180px){.pm-market-layout{grid-template-columns:1fr}.pm-market-sidebar{min-height:0}.pm-market-list{height:320px}.pm-market-metrics{grid-template-columns:repeat(4,1fr)}.pm-status-strip{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.pm-market-main{padding:14px}.pm-market-head{flex-direction:column}.pm-market-quote{text-align:left}.pm-market-metrics{grid-template-columns:repeat(2,1fr)}.pm-market-bottom{grid-template-columns:1fr}.pm-position-grid{grid-template-columns:repeat(2,1fr)}.pm-status-strip{grid-template-columns:repeat(2,1fr)}.pm-daily-wrap,.pm-intraday-wrap{height:430px}}
    `;
    document.head.appendChild(style);
  }

  function markup() {
    return `
      <div class="pm-status-strip"><article class="pm-status-card"><span>${tr("Toplam hisse", "Total equities")}</span><strong id="pmStatusTotal">—</strong></article><article class="pm-status-card"><span>BIST</span><strong id="pmStatusBist">—</strong></article><article class="pm-status-card"><span>${tr("ABD hisseleri", "US equities")}</span><strong id="pmStatusUs">—</strong></article><article class="pm-status-card"><span>${tr("Fiyat kapsamı", "Price coverage")}</span><strong id="pmStatusCoverage">—</strong></article><article class="pm-status-card"><span>${tr("Veri zamanı", "Data time")}</span><strong id="pmStatusAge">—</strong></article></div>
      <div class="pm-market-layout"><aside class="pm-market-panel pm-market-sidebar"><div class="pm-market-search"><input id="pmMarketSearch" type="search" autocomplete="off" placeholder="${tr("Sembol veya şirket ara", "Search symbol or company")}"></div><div class="pm-market-filters" id="pmMarketFilters"><button class="pm-market-chip active" data-filter="ALL">${tr("Tümü", "All")}</button><button class="pm-market-chip" data-filter="BIST">BIST</button><button class="pm-market-chip" data-filter="US">${tr("ABD", "US")}</button><button class="pm-market-chip" data-filter="PORTFOLIO">${tr("Portföy", "Portfolio")}</button><button class="pm-market-chip" data-filter="ISSUE">${tr("Fiyatı eksik", "Missing price")}</button></div><div class="pm-market-list-meta"><span id="pmAssetCount">0</span><span>${tr("Arama tüm piyasalarda çalışır", "Search covers all markets")}</span></div><div id="pmAssetList" class="pm-market-list"></div></aside>
      <section class="pm-market-panel pm-market-main"><div class="pm-market-head"><div><p class="eyebrow">${tr("SEÇİLİ VARLIK", "SELECTED ASSET")}</p><h2 id="pmAssetTitle">—</h2><p id="pmAssetSubtitle">—</p></div><div class="pm-market-quote"><strong id="pmAssetPrice">—</strong><span id="pmAssetChange">—</span></div></div><div class="pm-market-metrics"><article class="pm-market-metric"><span>1 ${tr("Gün", "Day")}</span><strong id="pm1d">—</strong></article><article class="pm-market-metric"><span>1 ${tr("Ay", "Month")}</span><strong id="pm1m">—</strong></article><article class="pm-market-metric"><span>3 ${tr("Ay", "Months")}</span><strong id="pm3m">—</strong></article><article class="pm-market-metric"><span>1 ${tr("Yıl", "Year")}</span><strong id="pm1y">—</strong></article><article class="pm-market-metric"><span>${tr("Hacim", "Volume")}</span><strong id="pmVolume">—</strong></article><article class="pm-market-metric"><span>${tr("Piyasa değeri", "Market cap")}</span><strong id="pmMarketCap">—</strong></article><article class="pm-market-metric"><span>${tr("Veri durumu", "Data status")}</span><strong id="pmDataStatus">—</strong></article></div><div class="pm-market-toolbar"><div class="pm-segmented" id="pmSourceTabs"><button class="active" data-source="DAILY">${tr("Portföy grafiği", "Portfolio chart")}</button><button data-source="INTRADAY">MIC ${tr("işlem içi", "intraday")}</button></div><div class="pm-segmented" id="pmRangeButtons"><button data-range="1D">1G</button><button data-range="1W">1H</button><button data-range="1M">1A</button><button data-range="3M">3A</button><button data-range="6M">6A</button><button class="active" data-range="1Y">1Y</button><button data-range="2Y">2Y</button></div><div class="pm-segmented" id="pmModeButtons"><button class="active" data-mode="CANDLE">${tr("Mum", "Candles")}</button><button data-mode="LINE">${tr("Çizgi", "Line")}</button></div></div><div class="pm-chart-shell"><div id="pmDailyWrap" class="pm-daily-wrap"><canvas id="pmChartCanvas"></canvas><div id="pmChartMessage" class="pm-chart-message">${tr("Grafik yükleniyor", "Loading chart")}</div></div><div id="pmIntradayWrap" class="pm-intraday-wrap"></div><div class="pm-chart-footer"><span id="pmHistoryStatus">—</span><span id="pmChartStats">—</span><span id="pmSourceStatus">—</span></div></div><div class="pm-market-bottom"><section><p class="eyebrow">${tr("PORTFÖY BAĞLAMI", "PORTFOLIO CONTEXT")}</p><div class="pm-position-grid"><article class="pm-position-card"><span>${tr("Adet", "Quantity")}</span><strong id="pmPositionQty">—</strong></article><article class="pm-position-card"><span>${tr("Ort. maliyet", "Average cost")}</span><strong id="pmPositionAvg">—</strong></article><article class="pm-position-card"><span>${tr("Piyasa değeri", "Market value")}</span><strong id="pmPositionValue">—</strong></article><article class="pm-position-card"><span>${tr("Gerçekleşmemiş K/Z", "Unrealized P/L")}</span><strong id="pmPositionPnl">—</strong></article></div><div class="pm-actions"><button id="pmAddTransaction" class="button primary" type="button">${tr("Bu hisse için işlem ekle", "Add transaction")}</button><button id="pmOpenResearch" class="button" type="button">${tr("Araştırmayı aç", "Open research")}</button></div></section><section><p class="eyebrow">${tr("SİSTEM DURUMU", "SYSTEM STATUS")}</p><p id="pmStatusNote" class="pm-status-note">—</p><div class="pm-actions"><button id="pmReloadMarket" class="button" type="button">${tr("Fiyatları yenile ve izlemeyi başlat", "Refresh and start monitoring")}</button><button id="pmOpenPortfolio" class="button" type="button">${tr("Portföyü aç", "Open portfolio")}</button></div></section></div></section></div>`;
  }

  function installView() {
    if (typeof I18N !== "undefined") {
      Object.assign(I18N.tr, { tabMarket: "Piyasa ve Grafik", marketPageTitle: "Piyasa ve grafik", marketPageDescription: "KAP ve Nasdaq hisse evreni, işlem içi grafikler ve portföy bağlamı." });
      Object.assign(I18N.en, { tabMarket: "Market & Chart", marketPageTitle: "Market and chart", marketPageDescription: "KAP and Nasdaq equity universe, intraday charts and portfolio context." });
    }
    if (typeof VIEW_COPY !== "undefined") VIEW_COPY.market = ["marketPageTitle", "marketPageDescription"];
    const first = document.querySelector('.tab[data-view="briefing"]');
    if (first && !document.querySelector('.tab[data-view="market"]')) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab";
      tab.dataset.view = "market";
      tab.innerHTML = '<span class="nav-glyph">02</span><span data-i18n="tabMarket">Piyasa ve Grafik</span>';
      first.after(tab);
      tab.onclick = () => navigate("market");
      document.querySelectorAll(".tab").forEach((item, index) => { const glyph = item.querySelector(".nav-glyph"); if (glyph) glyph.textContent = String(index + 1).padStart(2, "0"); });
    }
    if (!$("marketView")) {
      const section = document.createElement("section");
      section.id = "marketView";
      section.className = "view";
      section.innerHTML = markup();
      $("briefingView")?.after(section);
    }
  }

  function searchScore(asset, query) {
    const symbol = asset.symbol.toUpperCase();
    const name = String(asset.name || "").toLocaleUpperCase(locale());
    if (symbol === query) return 0;
    if (symbol.startsWith(query)) return 1;
    if (symbol.includes(query)) return 2;
    if (name.startsWith(query)) return 3;
    if (name.includes(query)) return 4;
    if (asset.exchange.includes(query)) return 5;
    return 99;
  }

  function portfolioSymbols() {
    try { return new Set((state?.portfolio?.transactions || []).map(item => symbolOf(item.symbol))); }
    catch (_) { return new Set(); }
  }

  function filteredAssets() {
    const query = model.query.trim().toLocaleUpperCase(locale());
    const portfolio = portfolioSymbols();
    return model.assets.filter(asset => {
      if (query) return searchScore(asset, query) < 99;
      if (model.filter === "BIST") return asset.market === "BIST";
      if (model.filter === "US") return asset.market === "US";
      if (model.filter === "PORTFOLIO") return portfolio.has(asset.symbol);
      if (model.filter === "ISSUE") return finite(asset.price) === null;
      return true;
    }).sort((a, b) => query ? searchScore(a, query) - searchScore(b, query) || a.market.localeCompare(b.market) : a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
  }

  function setText(id, value, className = null) {
    const node = $(id);
    if (!node) return;
    node.textContent = value;
    if (className !== null) node.className = className;
  }

  function renderStatus() {
    const total = model.assets.length;
    const bist = model.assets.filter(asset => asset.market === "BIST").length;
    const us = total - bist;
    const priced = model.assets.filter(asset => finite(asset.price) !== null).length;
    setText("pmStatusTotal", total || "—");
    setText("pmStatusBist", bist || "—");
    setText("pmStatusUs", us || "—");
    setText("pmStatusCoverage", total ? `%${Math.round(priced / total * 100)}` : "—");
    setText("pmStatusAge", ageLabel(model.marketAt));
  }

  function renderList() {
    const rows = filteredAssets();
    const visible = rows.slice(0, model.query ? 120 : MAX_VISIBLE);
    setText("pmAssetCount", rows.length > visible.length ? `${rows.length} ${tr("hisse · ilk", "equities · first")} ${visible.length}` : `${rows.length} ${tr("hisse", "equities")}`);
    const host = $("pmAssetList");
    if (!host) return;
    host.innerHTML = visible.map(asset => `<button type="button" class="pm-asset-row ${model.selectedKey === asset.key ? "active" : ""}" data-pm-key="${esc(asset.key)}" data-pm-symbol="${esc(asset.symbol)}"><span><strong>${esc(asset.symbol)} <em class="pm-asset-exchange">${esc(asset.exchange)}</em></strong><small>${esc(asset.name)}</small></span><span class="pm-asset-price"><span>${money(asset.price, asset.currency)}</span><small class="${valueClass(asset.change)}">${pct(asset.change)}</small></span></button>`).join("") || `<div class="empty-state"><strong>${tr("Eşleşen hisse yok", "No matching equity")}</strong></div>`;
    host.querySelectorAll("[data-pm-key]").forEach(button => button.onclick = () => selectAsset(button.dataset.pmKey));
  }

  function renderHeader() {
    const asset = selected();
    if (!asset) return;
    setText("pmAssetTitle", `${asset.symbol} · ${asset.name}`);
    setText("pmAssetSubtitle", `${asset.exchange} · ${asset.sector || asset.segment || tr("Sektör bilgisi yok", "No sector data")} · ${asset.currency}`);
    setText("pmAssetPrice", money(asset.price, asset.currency));
    setText("pmAssetChange", `${pct(asset.change)} · ${finite(asset.price) === null ? tr("fiyat bekleniyor", "price pending") : ageLabel(asset.quoteAt)}`, valueClass(asset.change));
    setText("pm1d", pct(asset.change), valueClass(asset.change));
    setText("pm1m", pct(asset.performance?.["1A"]), valueClass(asset.performance?.["1A"]));
    setText("pm3m", pct(asset.performance?.["3A"]), valueClass(asset.performance?.["3A"]));
    setText("pm1y", pct(asset.performance?.["1Y"]), valueClass(asset.performance?.["1Y"]));
    setText("pmVolume", compact(asset.volume));
    setText("pmMarketCap", compact(asset.marketCap));
    setText("pmDataStatus", `${model.source === "INTRADAY" ? tr("İşlem içi", "Intraday") : tr("Günlük OHLC", "Daily OHLC")} · ${finite(asset.price) === null ? tr("fiyat yok", "no price") : ageLabel(asset.quoteAt)}`);
    setText("pmSourceStatus", `${cleanSource(asset.source) || tr("Resmî hisse kataloğu", "Official equity catalogue")}${asset.quoteAt ? ` · ${new Date(typeof asset.quoteAt === "number" && asset.quoteAt < 1e12 ? asset.quoteAt * 1000 : asset.quoteAt).toLocaleString(locale())}` : ""}`);
    setText("pmStatusNote", `${model.assets.length} ${tr("hisse KAP ve Nasdaq resmî kataloglarından yüklendi. Arama seçili filtreden bağımsızdır.", "equities loaded from the official KAP and Nasdaq catalogues. Search is independent of the selected filter.")}`);
  }

  function holding() {
    const asset = selected();
    if (!asset || typeof portfolioResult !== "function") return null;
    return portfolioResult().holdings.find(item => symbolOf(item.symbol) === asset.symbol && exchangeOf(item.currency) === asset.currency) || null;
  }

  function renderPosition() {
    const item = holding();
    const quantity = item?.quantity || 0;
    setText("pmPositionQty", quantity ? `${quantity.toLocaleString(locale(), { maximumFractionDigits: 6 })} ${item.unit || ""}` : "—");
    setText("pmPositionAvg", quantity ? money(item.averageCost, item.currency) : "—");
    setText("pmPositionValue", item?.marketValue == null ? "—" : money(item.marketValue, item.currency));
    setText("pmPositionPnl", item?.unrealizedPnl == null ? "—" : money(item.unrealizedPnl, item.currency));
  }

  function renderAll() { renderStatus(); renderList(); renderHeader(); renderPosition(); }

  async function load(force = false) {
    if (model.loading) return;
    model.loading = true;
    try {
      const catalog = await fetchJson(URLS.catalog, force);
      const settled = await Promise.allSettled([fetchJson(URLS.market, force), fetchJson(URLS.nasdaq, force), fetchJson(URLS.report, force)]);
      const payloads = settled.map(result => result.status === "fulfilled" ? result.value : null);
      model.warnings = settled.filter(result => result.status === "rejected").map(result => result.reason?.message || String(result.reason));
      buildUniverse(catalog, payloads[0], payloads[1], payloads[2]);
      installPortfolioBridge();
      renderAll();
      await selectAsset(model.selectedKey, force);
    } catch (error) {
      setText("pmStatusNote", `${tr("Hisse kataloğu yüklenemedi", "Equity catalogue could not be loaded")}: ${error.message}`);
      console.error(error);
    } finally { model.loading = false; }
  }

  async function selectAsset(keyOrSymbol, force = false) {
    let asset = model.byKey.get(keyOrSymbol);
    if (!asset) asset = model.assets.find(item => item.symbol === symbolOf(keyOrSymbol)) || null;
    if (!asset) return;
    model.selectedKey = asset.key;
    model.requestVersion += 1;
    const version = model.requestVersion;
    sessionStorage.setItem("pm-market-selected-key", asset.key);
    renderList(); renderHeader(); renderPosition();
    window.dispatchEvent(new CustomEvent("pm-market-asset-change", { detail: { asset: { ...asset }, version } }));
    if (model.source === "DAILY") await loadHistory(asset, version, force);
  }

  async function loadHistory(asset, version, force = false) {
    const message = $("pmChartMessage");
    if (message) { message.style.display = "grid"; message.textContent = tr("Grafik yükleniyor", "Loading chart"); }
    try {
      let payload = !force ? model.historyCache.get(asset.providerSymbol) : null;
      if (!payload) {
        let lastError = null;
        for (const symbol of asset.market === "BIST" ? [asset.symbol, asset.providerSymbol] : [asset.symbol]) {
          try { payload = await fetchJson(`${HISTORY_BASE}/${encodeURIComponent(symbol)}.json`, force); break; }
          catch (error) { lastError = error; }
        }
        if (!payload) throw lastError || new Error("HISTORY_NOT_FOUND");
        model.historyCache.set(asset.providerSymbol, payload);
      }
      if (version !== model.requestVersion || selected()?.key !== asset.key) return;
      model.history = (Array.isArray(payload.history) ? payload.history : Array.isArray(payload.data) ? payload.data : []).map(row => ({ date: row.date || row.time, open: finite(row.open), high: finite(row.high), low: finite(row.low), close: finite(row.close), volume: finite(row.volume) || 0 })).filter(row => row.date && row.close !== null);
      setText("pmHistoryStatus", `${model.history.length} ${tr("günlük OHLC", "daily OHLC")} · ${model.history.length ? `${model.history[0].date} → ${model.history.at(-1).date}` : "—"} · ${cleanSource(payload.provider || payload.source) || "MIC"}`);
      if (message) { message.style.display = model.history.length ? "none" : "grid"; if (!model.history.length) message.textContent = tr("Günlük veri yok. MIC işlem içi grafiğini açın.", "Daily data unavailable. Open MIC intraday."); }
    } catch (_) {
      if (version !== model.requestVersion) return;
      model.history = [];
      setText("pmHistoryStatus", tr("Günlük OHLC bulunamadı", "Daily OHLC unavailable"));
      if (message) { message.style.display = "grid"; message.textContent = tr("MIC işlem içi grafiğini açın.", "Open MIC intraday."); }
    }
    drawChart();
  }

  function visibleHistory() {
    if (!model.history.length) return [];
    if (model.range === "1D") return model.history.slice(-2);
    const days = RANGE_DAYS[model.range] || 367;
    const end = new Date(`${model.history.at(-1).date}T00:00:00Z`);
    const start = new Date(end.getTime() - days * 86400000);
    return model.history.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
  }

  function drawChart() {
    const canvas = $("pmChartCanvas");
    const rows = visibleHistory();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, rect.width, rect.height);
    if (!rows.length) { setText("pmChartStats", "—"); return; }
    const p = { l: 62, r: 20, t: 30, b: 60 }, width = rect.width - p.l - p.r, height = rect.height - p.t - p.b, priceHeight = height * .8, volumeTop = p.t + height * .85, volumeHeight = height * .13;
    let min = Math.min(...rows.map(row => row.low ?? row.close)), max = Math.max(...rows.map(row => row.high ?? row.close));
    const padding = (max - min || 1) * .07; min -= padding; max += padding;
    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0)), x = index => p.l + index * width / Math.max(1, rows.length - 1), y = value => p.t + (max - value) * priceHeight / (max - min);
    context.font = "11px system-ui"; context.fillStyle = "#91a8a0"; context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) { const yy = p.t + index * priceHeight / 5, value = max - index * (max - min) / 5; context.beginPath(); context.moveTo(p.l, yy); context.lineTo(rect.width - p.r, yy); context.stroke(); context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4); }
    rows.forEach((row, index) => { const bar = (row.volume || 0) / maxVolume * volumeHeight; context.fillStyle = "rgba(124,165,151,.25)"; context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar); });
    if (model.mode === "LINE") { context.strokeStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath(); rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close))); context.stroke(); }
    else { const candleWidth = Math.max(1, Math.min(9, width / rows.length * .62)); rows.forEach((row, index) => { const open = row.open ?? row.close, rising = row.close >= open, xx = x(index); context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f"; context.beginPath(); context.moveTo(xx, y(row.high ?? row.close)); context.lineTo(xx, y(row.low ?? row.close)); context.stroke(); context.fillRect(xx - candleWidth / 2, Math.min(y(open), y(row.close)), candleWidth, Math.max(1, Math.abs(y(open) - y(row.close)))); }); }
    const first = rows[0].close, last = rows.at(-1).close, high = Math.max(...rows.map(row => row.high ?? row.close)), low = Math.min(...rows.map(row => row.low ?? row.close));
    setText("pmChartStats", `${tr("Dönem", "Period")}: ${pct(first ? (last / first - 1) * 100 : null)} · ${tr("Yüksek", "High")}: ${money(high, selected()?.currency)} · ${tr("Düşük", "Low")}: ${money(low, selected()?.currency)}`);
  }

  function installPortfolioBridge() {
    if (window.__PM_PORTFOLIO_PRICE_BRIDGE_V4__ || typeof reportMarketPrices !== "function") return;
    window.__PM_PORTFOLIO_PRICE_BRIDGE_V4__ = true;
    const original = reportMarketPrices;
    reportMarketPrices = function () {
      const prices = original();
      try {
        for (const transaction of state.portfolio.transactions) {
          const market = String(transaction.symbol || "").toUpperCase().endsWith(".IS") || exchangeOf(transaction.currency) === "TRY" ? "BIST" : "US";
          const asset = model.byKey.get(keyOf(market, transaction.symbol));
          if (!asset || finite(asset.price) === null) continue;
          prices[PortfolioEngine.assetKey(transaction)] = { price: asset.price, date: asset.quoteAt || model.marketAt, source: "automatic" };
        }
      } catch (_) {}
      return prices;
    };
  }

  function applyQuotes(quotes) {
    const entries = quotes instanceof Map ? [...quotes.entries()] : Object.entries(quotes || {});
    let changed = 0;
    for (const [rawSymbol, quote] of entries) {
      const provider = String(rawSymbol || quote?.symbol || "").toUpperCase();
      const asset = model.byProvider.get(provider);
      if (!asset) continue;
      const price = finite(quote?.price ?? quote?.regularMarketPrice);
      if (price === null) continue;
      asset.price = price;
      asset.change = finite(quote?.changePercent ?? quote?.regularMarketChangePercent) ?? asset.change;
      asset.volume = finite(quote?.volume ?? quote?.regularMarketVolume) ?? asset.volume;
      asset.marketCap = finite(quote?.marketCap) ?? asset.marketCap;
      asset.quoteAt = quote?.timestamp || quote?.regularMarketTime || Date.now();
      asset.source = cleanSource(quote?.source) || "MIC canlı fiyat";
      changed += 1;
    }
    if (changed) { model.marketAt = Date.now(); renderAll(); if (typeof renderPortfolio === "function") renderPortfolio(); }
    return changed;
  }

  function setFilter(filter) {
    model.filter = filter;
    document.querySelectorAll("#pmMarketFilters [data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === filter));
    renderList();
  }

  function bindEvents() {
    $("pmMarketSearch").oninput = event => { model.query = event.target.value; if (model.query.trim()) setFilter("ALL"); else renderList(); };
    $("pmMarketFilters").onclick = event => { const button = event.target.closest("[data-filter]"); if (!button) return; model.query = ""; $("pmMarketSearch").value = ""; setFilter(button.dataset.filter); };
    $("pmSourceTabs").onclick = event => { const button = event.target.closest("[data-source]"); if (!button) return; model.source = button.dataset.source; document.querySelectorAll("#pmSourceTabs [data-source]").forEach(item => item.classList.toggle("active", item === button)); $("pmDailyWrap").classList.toggle("hidden", model.source === "INTRADAY"); $("pmIntradayWrap").classList.toggle("active", model.source === "INTRADAY"); $("pmRangeButtons").style.display = model.source === "INTRADAY" ? "none" : "flex"; renderHeader(); window.dispatchEvent(new CustomEvent("pm-market-source-change", { detail: { source: model.source, asset: selected() ? { ...selected() } : null, version: model.requestVersion } })); if (model.source === "DAILY" && selected()) loadHistory(selected(), model.requestVersion); };
    $("pmRangeButtons").onclick = event => { const button = event.target.closest("[data-range]"); if (!button) return; model.range = button.dataset.range; document.querySelectorAll("#pmRangeButtons [data-range]").forEach(item => item.classList.toggle("active", item === button)); drawChart(); };
    $("pmModeButtons").onclick = event => { const button = event.target.closest("[data-mode]"); if (!button) return; model.mode = button.dataset.mode; document.querySelectorAll("#pmModeButtons [data-mode]").forEach(item => item.classList.toggle("active", item === button)); drawChart(); window.dispatchEvent(new CustomEvent("pm-market-mode-change", { detail: { mode: model.mode } })); };
    $("pmReloadMarket").onclick = () => window.PiyasaMarketLive?.start?.();
    $("pmOpenPortfolio").onclick = () => navigate("portfolio");
    $("pmAddTransaction").onclick = () => { const asset = selected(); if (!asset) return; navigate("portfolio"); setTimeout(() => { const values = { txSymbol: asset.providerSymbol, txName: asset.name, txCurrency: asset.currency, txUnit: asset.market === "BIST" ? "lot" : "share", txCurrentPrice: asset.price ?? "", txCurrentPriceDate: String(asset.quoteAt || model.marketAt || new Date().toISOString()).slice(0, 10) }; for (const [id, value] of Object.entries(values)) if ($(id)) $(id).value = value; }, 50); };
    $("pmOpenResearch").onclick = () => { const asset = selected(); if (asset && typeof openAssetDrawer === "function") openAssetDrawer(asset.symbol); };
    $("globalSearch")?.addEventListener("input", event => { const query = event.target.value.trim(); if (!query) return; if (location.hash !== "#market") navigate("market"); model.query = query; setFilter("ALL"); if ($("pmMarketSearch")) $("pmMarketSearch").value = query; renderList(); });
    window.addEventListener("resize", drawChart);
    window.addEventListener("piyasa-market-quotes", event => applyQuotes(event.detail?.quotes || event.detail || {}));
  }

  function install() {
    injectStyles(); installView(); bindEvents(); load(false); if (location.hash === "#market") setTimeout(() => setView("market"), 0);
  }

  window.PiyasaMarketWorkspace = {
    state: model,
    getAssets: () => model.assets.map(asset => ({ ...asset })),
    getSelected: () => selected() ? { ...selected() } : null,
    select: selectAsset,
    refresh: load,
    applyQuotes,
    providerSymbol: asset => asset?.providerSymbol,
    keyOf,
    _test: { catalogAsset, overlayAsset, buildUniverse, searchScore, filteredAssets, cleanSource }
  };

  if (!window.__PM_TEST__) install();
})();
