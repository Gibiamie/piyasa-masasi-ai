(() => {
  "use strict";

  if (window.__PM_MARKET_WORKSPACE_CORE__) return;
  window.__PM_MARKET_WORKSPACE_CORE__ = true;

  const DATA_URLS = {
    market: "../mic/data/market.json",
    nasdaq: "../mic/data/nasdaq-quotes.json",
    report: "./data/report.json"
  };
  const HISTORY_BASE = "../mic/data/history";
  const RANGE_DAYS = { "1D": 2, "1W": 8, "1M": 32, "3M": 94, "6M": 187, "1Y": 367, "2Y": 735 };
  const MAX_VISIBLE = 500;
  const SUPPLEMENTS = [
    { market: "BIST", exchange: "BIST", symbol: "ISATR", name: "TÜRKİYE İŞ BANKASI A.Ş. A TERTİBİ", currency: "TRY", type: "stock", source: "KAP equity catalogue" },
    { market: "BIST", exchange: "BIST", symbol: "ISKUR", name: "TÜRKİYE İŞ BANKASI A.Ş. KURUCU", currency: "TRY", type: "stock", source: "KAP equity catalogue" },
    { market: "BIST", exchange: "BIST", symbol: "UMPAS", name: "UMPAŞ HOLDİNG A.Ş.", currency: "TRY", type: "stock", source: "KAP equity catalogue" },
    { market: "US", exchange: "CBOE", symbol: "CBOE", name: "Cboe Global Markets Inc. Common Stock", currency: "USD", type: "stock", source: "Nasdaq equity catalogue" }
  ];

  const workspace = {
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
    updatedAt: null,
    loading: false,
    warnings: []
  };

  const $ = id => document.getElementById(id);
  const normalizeSymbol = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const normalizeExchange = value => String(value || "").trim().toUpperCase();
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => (typeof state !== "undefined" && state.language === "en") || document.documentElement.lang === "en" ? "en" : "tr";
  const text = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const marketOf = raw => {
    const exchange = normalizeExchange(raw?.exchange);
    const provider = String(raw?.provider_symbol || raw?.providerSymbol || "").toUpperCase();
    const currency = normalizeExchange(raw?.currency);
    if (exchange === "BIST" || provider.endsWith(".IS") || (currency === "TRY" && String(raw?.type || raw?.asset_type || "stock").toLowerCase() === "stock")) return "BIST";
    return "US";
  };
  const keyOf = (market, symbol) => `${market}:${normalizeSymbol(symbol)}`;
  const providerSymbol = asset => asset.market === "BIST" ? `${asset.symbol}.IS` : asset.symbol;
  const selectedAsset = () => workspace.byKey.get(workspace.selectedKey) || null;
  const money = (value, currency = "TRY") => {
    const number = finite(value);
    if (number === null) return "—";
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number); }
    catch (_) { return `${number.toLocaleString(locale())} ${currency}`; }
  };
  const percent = value => {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
  };
  const compact = value => {
    const number = finite(value);
    return number === null ? "—" : new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };
  const valueClass = value => finite(value) === null || finite(value) === 0 ? "" : finite(value) > 0 ? "up" : "down";

  function assetFrom(raw, priority, fallbackMarket = null) {
    const symbol = normalizeSymbol(raw?.symbol || raw?.ticker || raw?.provider_symbol || raw?.providerSymbol);
    if (!symbol) return null;
    const market = fallbackMarket || marketOf(raw);
    const exchange = normalizeExchange(raw?.exchange) || (market === "BIST" ? "BIST" : "US");
    const currency = normalizeExchange(raw?.currency) || (market === "BIST" ? "TRY" : "USD");
    return {
      key: keyOf(market, symbol),
      market,
      exchange,
      symbol,
      providerSymbol: market === "BIST" ? `${symbol}.IS` : symbol,
      name: raw?.name || raw?.company || raw?.longName || symbol,
      type: String(raw?.type || raw?.asset_type || "stock").toLowerCase(),
      currency,
      price: finite(raw?.price ?? raw?.regularMarketPrice),
      change: finite(raw?.change ?? raw?.change_percent ?? raw?.return_1d_pct ?? raw?.regularMarketChangePercent),
      volume: finite(raw?.volume ?? raw?.regularMarketVolume),
      marketCap: finite(raw?.market_cap ?? raw?.marketCap),
      sector: raw?.sector || "",
      industry: raw?.industry || "",
      performance: { ...(raw?.performance || {}) },
      quoteAt: raw?.price_as_of || raw?.quote_as_of || raw?.updated_at || raw?.regularMarketTime || null,
      source: raw?.source || raw?.provider || raw?.quote_source || "",
      dataStatus: raw?.data_status || raw?.quote_mode || "",
      priority
    };
  }

  function mergeAsset(map, incoming) {
    if (!incoming) return;
    const current = map.get(incoming.key);
    if (!current) {
      map.set(incoming.key, incoming);
      return;
    }
    const higher = incoming.priority >= current.priority ? incoming : current;
    const lower = higher === incoming ? current : incoming;
    map.set(incoming.key, {
      ...lower,
      ...higher,
      price: higher.price ?? lower.price,
      change: higher.change ?? lower.change,
      volume: higher.volume ?? lower.volume,
      marketCap: higher.marketCap ?? lower.marketCap,
      performance: { ...(lower.performance || {}), ...(higher.performance || {}) },
      quoteAt: higher.quoteAt || lower.quoteAt,
      source: higher.source || lower.source
    });
  }

  function mergeFeeds(marketPayload, nasdaqPayload, reportPayload) {
    const map = new Map();
    for (const raw of marketPayload?.assets || []) mergeAsset(map, assetFrom({ ...raw, updated_at: raw.price_as_of || marketPayload.updated_at, source: raw.source || marketPayload.source }, 30));

    for (const raw of reportPayload?.watchlist || []) {
      const asset = assetFrom({
        ...raw,
        symbol: raw.ticker || raw.provider_symbol,
        name: raw.company || raw.ticker,
        exchange: String(raw.provider_symbol || "").toUpperCase().endsWith(".IS") ? "BIST" : raw.exchange,
        change: raw.return_1d_pct,
        performance: { "1A": raw.return_21d_pct, "1Y": raw.return_252d_pct },
        price_as_of: raw.price_as_of || reportPayload.generated_at
      }, 10);
      mergeAsset(map, asset);
    }

    const quoteRows = nasdaqPayload?.quotes || nasdaqPayload?.data || {};
    for (const [symbol, raw] of Object.entries(quoteRows)) {
      mergeAsset(map, assetFrom({ ...raw, symbol, currency: raw.currency || "USD", updated_at: raw.price_as_of || nasdaqPayload.updated_at, source: raw.source || nasdaqPayload.source }, 40, "US"));
    }

    for (const raw of SUPPLEMENTS) mergeAsset(map, assetFrom(raw, 5, raw.market));

    workspace.byKey = map;
    workspace.assets = [...map.values()]
      .filter(asset => asset.type === "stock" || asset.type === "equity" || !asset.type)
      .sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol) || a.exchange.localeCompare(b.exchange));
    workspace.byProvider = new Map(workspace.assets.map(asset => [asset.providerSymbol, asset]));
    workspace.updatedAt = [marketPayload?.updated_at, nasdaqPayload?.updated_at, reportPayload?.generated_at].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;

    const rememberedKey = sessionStorage.getItem("pm-market-selected-key");
    if (rememberedKey && workspace.byKey.has(rememberedKey)) workspace.selectedKey = rememberedKey;
    if (!workspace.selectedKey || !workspace.byKey.has(workspace.selectedKey)) {
      workspace.selectedKey = workspace.byKey.has("BIST:THYAO") ? "BIST:THYAO" : workspace.assets[0]?.key || null;
    }
  }

  function injectStyles() {
    if ($("pm-market-core-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-market-core-styles";
    style.textContent = `
      .pm-status-strip{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin-bottom:18px}.pm-status-card,.pm-position-card,.pm-market-metric{border:1px solid var(--line);background:var(--paper-soft);border-radius:12px 12px 12px 3px;padding:10px}.pm-status-card span,.pm-position-card span,.pm-market-metric span{display:block;color:var(--muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em}.pm-status-card strong,.pm-position-card strong,.pm-market-metric strong{display:block;margin-top:5px;font-size:.88rem}
      .pm-market-layout{display:grid;grid-template-columns:minmax(300px,370px) minmax(0,1fr);gap:18px}.pm-market-panel{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px 5px 18px 5px;overflow:hidden}.pm-market-sidebar{min-height:760px}.pm-market-search{padding:14px;border-bottom:1px solid var(--line)}.pm-market-search input{width:100%}.pm-market-filters{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);overflow:auto}.pm-market-chip{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--paper-soft);color:var(--muted);white-space:nowrap;font-size:.72rem}.pm-market-chip.active{background:var(--pine);border-color:var(--pine);color:#fff}.pm-market-list-meta{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;color:var(--muted);font-size:.68rem}.pm-market-list{height:650px;overflow:auto;padding:0 8px 12px}.pm-asset-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid transparent;border-radius:12px;padding:10px;background:transparent;color:var(--ink);text-align:left}.pm-asset-row:hover{background:var(--paper-soft)}.pm-asset-row.active{border-color:var(--pine-2);background:var(--sage-soft)}.pm-asset-row strong,.pm-asset-row small,.pm-asset-price span{display:block}.pm-asset-row small{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-asset-exchange{display:inline-block;margin-left:6px;padding:2px 5px;border-radius:999px;background:rgba(23,58,51,.08);font-size:.58rem;color:var(--muted)}.pm-asset-price{text-align:right}.pm-asset-price span{font-weight:750}.up{color:var(--positive)}.down{color:var(--negative)}
      .pm-market-main{padding:20px}.pm-market-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.pm-market-head h2{margin:4px 0 5px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.5rem,2.4vw,2.2rem);font-weight:500}.pm-market-head p{margin:0;color:var(--muted)}.pm-market-quote{text-align:right}.pm-market-quote strong{display:block;font-size:1.7rem}.pm-market-quote span{display:block;margin-top:5px}.pm-market-metrics{display:grid;grid-template-columns:repeat(7,minmax(95px,1fr));gap:8px;margin:16px 0}.pm-market-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.pm-segmented{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-segmented button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-segmented button.active{background:var(--pine);color:#fff}.pm-chart-shell{margin-top:12px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0b1d1a}.pm-daily-wrap,.pm-intraday-wrap{height:520px}.pm-daily-wrap{position:relative}.pm-daily-wrap.hidden,.pm-intraday-wrap{display:none}.pm-intraday-wrap.active{display:block}.pm-daily-wrap canvas{width:100%;height:100%;display:block}.pm-chart-message{position:absolute;inset:0;display:grid;place-items:center;color:#afbeb9;text-align:center;padding:28px}.pm-chart-tooltip{position:absolute;display:none;pointer-events:none;min-width:180px;padding:9px 10px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.94);color:#edf4ef;font-size:.7rem;line-height:1.5}.pm-chart-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 11px;border-top:1px solid rgba(255,255,255,.12);background:#102722;color:#afbeb9;font-size:.68rem}.pm-market-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.pm-position-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pm-status-note{margin:10px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}
      @media(max-width:1180px){.pm-market-layout{grid-template-columns:1fr}.pm-market-sidebar{min-height:0}.pm-market-list{height:320px}.pm-market-metrics{grid-template-columns:repeat(4,1fr)}.pm-status-strip{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.pm-market-main{padding:14px}.pm-market-head{flex-direction:column}.pm-market-quote{text-align:left}.pm-market-metrics{grid-template-columns:repeat(2,1fr)}.pm-market-bottom{grid-template-columns:1fr}.pm-position-grid{grid-template-columns:repeat(2,1fr)}.pm-status-strip{grid-template-columns:repeat(2,1fr)}.pm-daily-wrap,.pm-intraday-wrap{height:430px}}
    `;
    document.head.appendChild(style);
  }

  function markup() {
    return `
      <div class="pm-status-strip">
        <article class="pm-status-card"><span>${text("Toplam hisse", "Total equities")}</span><strong id="pmStatusTotal">—</strong></article>
        <article class="pm-status-card"><span>BIST</span><strong id="pmStatusBist">—</strong></article>
        <article class="pm-status-card"><span>${text("ABD hisseleri", "US equities")}</span><strong id="pmStatusUs">—</strong></article>
        <article class="pm-status-card"><span>${text("Fiyat kapsamı", "Price coverage")}</span><strong id="pmStatusCoverage">—</strong></article>
        <article class="pm-status-card"><span>${text("Veri zamanı", "Data time")}</span><strong id="pmStatusAge">—</strong></article>
      </div>
      <div class="pm-market-layout">
        <aside class="pm-market-panel pm-market-sidebar">
          <div class="pm-market-search"><input id="pmMarketSearch" type="search" autocomplete="off" placeholder="${text("Sembol veya şirket ara", "Search symbol or company")}"></div>
          <div class="pm-market-filters" id="pmMarketFilters"><button class="pm-market-chip active" data-filter="ALL">${text("Tümü", "All")}</button><button class="pm-market-chip" data-filter="BIST">BIST</button><button class="pm-market-chip" data-filter="US">${text("ABD", "US")}</button><button class="pm-market-chip" data-filter="PORTFOLIO">${text("Portföy", "Portfolio")}</button><button class="pm-market-chip" data-filter="ISSUE">${text("Fiyatı eksik", "Missing price")}</button></div>
          <div class="pm-market-list-meta"><span id="pmAssetCount">0</span><span id="pmSearchHint">${text("Arama tüm piyasalarda çalışır", "Search covers all markets")}</span></div>
          <div id="pmAssetList" class="pm-market-list"></div>
        </aside>
        <section class="pm-market-panel pm-market-main">
          <div class="pm-market-head"><div><p class="eyebrow">${text("SEÇİLİ VARLIK", "SELECTED ASSET")}</p><h2 id="pmAssetTitle">—</h2><p id="pmAssetSubtitle">—</p></div><div class="pm-market-quote"><strong id="pmAssetPrice">—</strong><span id="pmAssetChange">—</span></div></div>
          <div class="pm-market-metrics"><article class="pm-market-metric"><span>1 ${text("Gün", "Day")}</span><strong id="pm1d">—</strong></article><article class="pm-market-metric"><span>1 ${text("Ay", "Month")}</span><strong id="pm1m">—</strong></article><article class="pm-market-metric"><span>3 ${text("Ay", "Months")}</span><strong id="pm3m">—</strong></article><article class="pm-market-metric"><span>1 ${text("Yıl", "Year")}</span><strong id="pm1y">—</strong></article><article class="pm-market-metric"><span>${text("Hacim", "Volume")}</span><strong id="pmVolume">—</strong></article><article class="pm-market-metric"><span>${text("Piyasa değeri", "Market cap")}</span><strong id="pmMarketCap">—</strong></article><article class="pm-market-metric"><span>${text("Veri durumu", "Data status")}</span><strong id="pmDataStatus">—</strong></article></div>
          <div class="pm-market-toolbar"><div class="pm-segmented" id="pmSourceTabs"><button class="active" data-source="DAILY">${text("Portföy grafiği", "Portfolio chart")}</button><button data-source="INTRADAY">MIC ${text("işlem içi", "intraday")}</button></div><div class="pm-segmented" id="pmRangeButtons"><button data-range="1D">1G</button><button data-range="1W">1H</button><button data-range="1M">1A</button><button data-range="3M">3A</button><button data-range="6M">6A</button><button class="active" data-range="1Y">1Y</button><button data-range="2Y">2Y</button></div><div class="pm-segmented" id="pmModeButtons"><button class="active" data-mode="CANDLE">${text("Mum", "Candles")}</button><button data-mode="LINE">${text("Çizgi", "Line")}</button></div></div>
          <div class="pm-chart-shell"><div id="pmDailyWrap" class="pm-daily-wrap"><canvas id="pmChartCanvas"></canvas><div id="pmChartMessage" class="pm-chart-message">${text("Grafik yükleniyor", "Loading chart")}</div><div id="pmChartTooltip" class="pm-chart-tooltip"></div></div><div id="pmIntradayWrap" class="pm-intraday-wrap"></div><div class="pm-chart-footer"><span id="pmHistoryStatus">—</span><span id="pmChartStats">—</span><span id="pmSourceStatus">—</span></div></div>
          <div class="pm-market-bottom"><section><p class="eyebrow">${text("PORTFÖY BAĞLAMI", "PORTFOLIO CONTEXT")}</p><div class="pm-position-grid"><article class="pm-position-card"><span>${text("Adet", "Quantity")}</span><strong id="pmPositionQty">—</strong></article><article class="pm-position-card"><span>${text("Ort. maliyet", "Average cost")}</span><strong id="pmPositionAvg">—</strong></article><article class="pm-position-card"><span>${text("Piyasa değeri", "Market value")}</span><strong id="pmPositionValue">—</strong></article><article class="pm-position-card"><span>${text("Gerçekleşmemiş K/Z", "Unrealized P/L")}</span><strong id="pmPositionPnl">—</strong></article></div><div class="pm-actions"><button id="pmAddTransaction" class="button primary" type="button">${text("Bu hisse için işlem ekle", "Add transaction")}</button><button id="pmOpenResearch" class="button" type="button">${text("Araştırmayı aç", "Open research")}</button></div></section><section><p class="eyebrow">${text("SİSTEM DURUMU", "SYSTEM STATUS")}</p><p id="pmStatusNote" class="pm-status-note">—</p><div class="pm-actions"><button id="pmReloadMarket" class="button" type="button">${text("Fiyatları yenile ve izlemeyi başlat", "Refresh and start monitoring")}</button><button id="pmOpenPortfolio" class="button" type="button">${text("Portföyü aç", "Open portfolio")}</button></div></section></div>
        </section>
      </div>`;
  }

  function installView() {
    if (typeof I18N !== "undefined") {
      Object.assign(I18N.tr, { tabMarket: "Piyasa ve Grafik", marketPageTitle: "Piyasa ve grafik", marketPageDescription: "BIST ve ABD hisselerini, işlem içi grafikleri ve portföy bağlamını tek çalışma alanında yönetin." });
      Object.assign(I18N.en, { tabMarket: "Market & Chart", marketPageTitle: "Market and chart", marketPageDescription: "Manage BIST and US equities, intraday charts and portfolio context in one workspace." });
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

  async function fetchJson(url, force = false) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${force ? Date.now() : "current"}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function ageLabel(value = workspace.updatedAt) {
    if (!value) return text("Zaman yok", "No timestamp");
    const timestamp = typeof value === "number" && value < 1e12 ? value * 1000 : new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return text("Zaman yok", "No timestamp");
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 2) return text("Az önce", "Just now");
    if (minutes < 120) return `${minutes} ${text("dk önce", "min ago")}`;
    if (minutes < 2880) return `${Math.round(minutes / 60)} ${text("saat önce", "hours ago")}`;
    return `${Math.round(minutes / 1440)} ${text("gün önce", "days ago")}`;
  }

  function searchScore(asset, query) {
    const symbol = asset.symbol.toLocaleUpperCase("en-US");
    const name = String(asset.name || "").toLocaleUpperCase(language() === "en" ? "en-US" : "tr-TR");
    const exchange = asset.exchange.toLocaleUpperCase("en-US");
    if (symbol === query) return 0;
    if (symbol.startsWith(query)) return 1;
    if (symbol.includes(query)) return 2;
    if (name.startsWith(query)) return 3;
    if (name.includes(query)) return 4;
    if (exchange.includes(query)) return 5;
    return 99;
  }

  function portfolioSymbols() {
    try { return new Set((state?.portfolio?.transactions || []).map(item => normalizeSymbol(item.symbol))); }
    catch (_) { return new Set(); }
  }

  function filteredAssets() {
    const query = workspace.query.trim().toLocaleUpperCase(language() === "en" ? "en-US" : "tr-TR");
    const portfolio = portfolioSymbols();
    return workspace.assets
      .filter(asset => {
        if (query) return searchScore(asset, query) < 99;
        if (workspace.filter === "BIST") return asset.market === "BIST";
        if (workspace.filter === "US") return asset.market === "US";
        if (workspace.filter === "PORTFOLIO") return portfolio.has(asset.symbol);
        if (workspace.filter === "ISSUE") return finite(asset.price) === null || finite(asset.price) <= 0;
        return true;
      })
      .sort((a, b) => {
        if (query) {
          const score = searchScore(a, query) - searchScore(b, query);
          if (score) return score;
        }
        return a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol) || a.exchange.localeCompare(b.exchange);
      });
  }

  function renderStatus() {
    const total = workspace.assets.length;
    const bist = workspace.assets.filter(asset => asset.market === "BIST").length;
    const us = workspace.assets.filter(asset => asset.market === "US").length;
    const priced = workspace.assets.filter(asset => finite(asset.price) !== null && finite(asset.price) > 0).length;
    const values = { pmStatusTotal: total || "—", pmStatusBist: total ? bist : "—", pmStatusUs: total ? us : "—", pmStatusCoverage: total ? `%${Math.round(priced / total * 100)}` : "—", pmStatusAge: ageLabel() };
    for (const [id, value] of Object.entries(values)) if ($(id)) $(id).textContent = value;
  }

  function renderList() {
    const rows = filteredAssets();
    const visible = rows.slice(0, workspace.query ? 100 : MAX_VISIBLE);
    const host = $("pmAssetList");
    if (!host) return;
    $("pmAssetCount").textContent = rows.length > visible.length ? `${rows.length} ${text("hisse · ilk", "equities · first")} ${visible.length}` : `${rows.length} ${text("hisse", "equities")}`;
    host.innerHTML = visible.map(asset => `
      <button type="button" class="pm-asset-row ${workspace.selectedKey === asset.key ? "active" : ""}" data-pm-key="${escapeHtml(asset.key)}" data-pm-symbol="${escapeHtml(asset.symbol)}">
        <span><strong>${escapeHtml(asset.symbol)} <em class="pm-asset-exchange">${escapeHtml(asset.exchange)}</em></strong><small>${escapeHtml(asset.name)}</small></span>
        <span class="pm-asset-price"><span>${money(asset.price, asset.currency)}</span><small class="${valueClass(asset.change)}">${percent(asset.change)}</small></span>
      </button>`).join("") || `<div class="empty-state"><strong>${text("Eşleşen hisse yok", "No matching equity")}</strong></div>`;
    host.querySelectorAll("[data-pm-key]").forEach(button => button.onclick = () => selectAsset(button.dataset.pmKey));
  }

  function setText(id, value, className = null) {
    const node = $(id);
    if (!node) return;
    node.textContent = value;
    if (className !== null) node.className = className;
  }

  function renderHeader() {
    const asset = selectedAsset();
    if (!asset) return;
    setText("pmAssetTitle", `${asset.symbol} · ${asset.name}`);
    setText("pmAssetSubtitle", `${asset.exchange} · ${asset.sector || text("Sektör bilgisi yok", "No sector data")} · ${asset.currency}`);
    setText("pmAssetPrice", money(asset.price, asset.currency));
    setText("pmAssetChange", `${percent(asset.change)} · ${ageLabel(asset.quoteAt)}`, valueClass(asset.change));
    setText("pm1d", percent(asset.change), valueClass(asset.change));
    setText("pm1m", percent(asset.performance?.["1A"]), valueClass(asset.performance?.["1A"]));
    setText("pm3m", percent(asset.performance?.["3A"]), valueClass(asset.performance?.["3A"]));
    setText("pm1y", percent(asset.performance?.["1Y"]), valueClass(asset.performance?.["1Y"]));
    setText("pmVolume", compact(asset.volume));
    setText("pmMarketCap", compact(asset.marketCap));
    setText("pmDataStatus", `${workspace.source === "INTRADAY" ? text("İşlem içi", "Intraday") : text("Günlük OHLC", "Daily OHLC")} · ${finite(asset.price) === null ? text("fiyat bekleniyor", "price pending") : ageLabel(asset.quoteAt)}`);
    setText("pmSourceStatus", `${asset.source || "—"}${asset.quoteAt ? ` · ${new Date(typeof asset.quoteAt === "number" && asset.quoteAt < 1e12 ? asset.quoteAt * 1000 : asset.quoteAt).toLocaleString(locale())}` : ""}`);
    setText("pmStatusNote", `${workspace.assets.length} ${text("hisse yüklendi. Arama, seçili filtreden bağımsız olarak tüm BIST ve ABD evreninde çalışır.", "equities loaded. Search always covers the complete BIST and US universe, independent of the selected filter.")}`);
  }

  function currentHolding() {
    const asset = selectedAsset();
    if (!asset || typeof portfolioResult !== "function") return null;
    return portfolioResult().holdings.find(item => normalizeSymbol(item.symbol) === asset.symbol) || null;
  }

  function renderPosition() {
    const holding = currentHolding();
    const quantity = holding?.quantity || 0;
    setText("pmPositionQty", quantity ? `${quantity.toLocaleString(locale(), { maximumFractionDigits: 6 })} ${holding.unit || ""}` : "—");
    setText("pmPositionAvg", quantity ? money(holding.averageCost, holding.currency) : "—");
    setText("pmPositionValue", holding?.marketValue == null ? "—" : money(holding.marketValue, holding.currency));
    setText("pmPositionPnl", holding?.unrealizedPnl == null ? "—" : money(holding.unrealizedPnl, holding.currency));
  }

  function renderAll() {
    renderStatus();
    renderList();
    renderHeader();
    renderPosition();
  }

  async function loadMarket(force = false) {
    if (workspace.loading) return;
    workspace.loading = true;
    workspace.warnings = [];
    try {
      const settled = await Promise.allSettled([
        fetchJson(DATA_URLS.market, force),
        fetchJson(DATA_URLS.nasdaq, force),
        fetchJson(DATA_URLS.report, force)
      ]);
      const payloads = settled.map(result => result.status === "fulfilled" ? result.value : null);
      workspace.warnings = settled.filter(result => result.status === "rejected").map(result => result.reason?.message || String(result.reason));
      if (!payloads.some(Boolean)) throw new Error(text("Piyasa kaynaklarına ulaşılamadı", "Market sources are unavailable"));
      mergeFeeds(payloads[0], payloads[1], payloads[2]);
      installPortfolioBridge();
      renderAll();
      if (workspace.selectedKey) await selectAsset(workspace.selectedKey, force);
    } catch (error) {
      setText("pmStatusNote", `${text("Piyasa verisi yüklenemedi", "Market data could not be loaded")}: ${error.message}`);
    } finally {
      workspace.loading = false;
    }
  }

  async function selectAsset(keyOrSymbol, force = false) {
    let asset = workspace.byKey.get(keyOrSymbol);
    if (!asset) {
      const symbol = normalizeSymbol(keyOrSymbol);
      asset = workspace.assets.find(item => item.symbol === symbol) || null;
    }
    if (!asset) return;
    workspace.selectedKey = asset.key;
    workspace.requestVersion += 1;
    const version = workspace.requestVersion;
    sessionStorage.setItem("pm-market-selected-key", asset.key);
    renderList();
    renderHeader();
    renderPosition();
    window.dispatchEvent(new CustomEvent("pm-market-asset-change", { detail: { asset: { ...asset }, version } }));
    if (workspace.source === "DAILY") await loadHistory(asset, version, force);
  }

  async function loadHistory(asset, version, force = false) {
    const message = $("pmChartMessage");
    if (message) { message.style.display = "grid"; message.textContent = text("Grafik yükleniyor", "Loading chart"); }
    try {
      const cacheKey = asset.providerSymbol;
      let payload = !force ? workspace.historyCache.get(cacheKey) : null;
      if (!payload) {
        const symbols = asset.market === "BIST" ? [asset.symbol, asset.providerSymbol] : [asset.symbol];
        let lastError = null;
        for (const symbol of symbols) {
          try { payload = await fetchJson(`${HISTORY_BASE}/${encodeURIComponent(symbol)}.json`, force); break; }
          catch (error) { lastError = error; }
        }
        if (!payload) throw lastError || new Error("HISTORY_NOT_FOUND");
        workspace.historyCache.set(cacheKey, payload);
      }
      if (version !== workspace.requestVersion || selectedAsset()?.key !== asset.key) return;
      workspace.history = (Array.isArray(payload.history) ? payload.history : Array.isArray(payload.data) ? payload.data : [])
        .map(row => ({ date: row.date || row.time, open: finite(row.open), high: finite(row.high), low: finite(row.low), close: finite(row.close), volume: finite(row.volume) || 0 }))
        .filter(row => row.date && row.close !== null);
      const coverage = workspace.history.length ? `${workspace.history[0].date} → ${workspace.history.at(-1).date}` : "—";
      setText("pmHistoryStatus", `${workspace.history.length} ${text("günlük OHLC", "daily OHLC")} · ${coverage} · ${payload.provider || payload.source || "—"}`);
      if (message) { message.style.display = workspace.history.length ? "none" : "grid"; if (!workspace.history.length) message.textContent = text("Günlük veri yok. MIC işlem içi grafiğini açın.", "Daily data unavailable. Open MIC intraday."); }
    } catch (_) {
      if (version !== workspace.requestVersion) return;
      workspace.history = [];
      setText("pmHistoryStatus", text("Günlük OHLC bulunamadı", "Daily OHLC unavailable"));
      if (message) { message.style.display = "grid"; message.textContent = text("MIC işlem içi grafiğini açın.", "Open MIC intraday."); }
    }
    drawDailyChart();
  }

  function visibleHistory() {
    if (!workspace.history.length) return [];
    if (workspace.range === "1D") return workspace.history.slice(-2);
    const days = RANGE_DAYS[workspace.range] || 367;
    const end = new Date(`${workspace.history.at(-1).date}T00:00:00Z`);
    const start = new Date(end.getTime() - days * 86400000);
    return workspace.history.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
  }

  function drawDailyChart() {
    const canvas = $("pmChartCanvas");
    const rows = visibleHistory();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!rows.length) { setText("pmChartStats", "—"); return; }

    const p = { l: 62, r: 20, t: 30, b: 60 };
    const width = rect.width - p.l - p.r;
    const height = rect.height - p.t - p.b;
    const priceHeight = height * .8;
    const volumeTop = p.t + height * .85;
    const volumeHeight = height * .13;
    let min = Math.min(...rows.map(row => row.low ?? row.close));
    let max = Math.max(...rows.map(row => row.high ?? row.close));
    const padding = (max - min || 1) * .07;
    min -= padding; max += padding;
    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => p.l + index * width / Math.max(1, rows.length - 1);
    const y = value => p.t + (max - value) * priceHeight / (max - min);

    context.font = "11px system-ui";
    context.fillStyle = "#91a8a0";
    context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) {
      const yy = p.t + index * priceHeight / 5;
      const value = max - index * (max - min) / 5;
      context.beginPath(); context.moveTo(p.l, yy); context.lineTo(rect.width - p.r, yy); context.stroke();
      context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4);
    }
    rows.forEach((row, index) => {
      const bar = (row.volume || 0) / maxVolume * volumeHeight;
      context.fillStyle = "rgba(124,165,151,.25)";
      context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar);
    });
    if (workspace.mode === "LINE") {
      context.strokeStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath();
      rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close)));
      context.stroke();
    } else {
      const candleWidth = Math.max(1, Math.min(9, width / rows.length * .62));
      rows.forEach((row, index) => {
        const open = row.open ?? row.close;
        const high = row.high ?? row.close;
        const low = row.low ?? row.close;
        const rising = row.close >= open;
        const xx = x(index);
        context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f";
        context.beginPath(); context.moveTo(xx, y(high)); context.lineTo(xx, y(low)); context.stroke();
        context.fillRect(xx - candleWidth / 2, Math.min(y(open), y(row.close)), candleWidth, Math.max(1, Math.abs(y(open) - y(row.close))));
      });
    }
    const first = rows[0].close;
    const last = rows.at(-1).close;
    const high = Math.max(...rows.map(row => row.high ?? row.close));
    const low = Math.min(...rows.map(row => row.low ?? row.close));
    setText("pmChartStats", `${text("Dönem", "Period")}: ${percent(first ? (last / first - 1) * 100 : null)} · ${text("Yüksek", "High")}: ${money(high, selectedAsset()?.currency)} · ${text("Düşük", "Low")}: ${money(low, selectedAsset()?.currency)}`);
  }

  function installPortfolioBridge() {
    if (window.__PM_PORTFOLIO_PRICE_BRIDGE_V3__ || typeof reportMarketPrices !== "function") return;
    window.__PM_PORTFOLIO_PRICE_BRIDGE_V3__ = true;
    const original = reportMarketPrices;
    reportMarketPrices = function () {
      const prices = original();
      try {
        for (const transaction of state.portfolio.transactions) {
          const symbol = normalizeSymbol(transaction.symbol);
          const market = String(transaction.symbol || "").toUpperCase().endsWith(".IS") || String(transaction.currency || "").toUpperCase() === "TRY" ? "BIST" : "US";
          const asset = workspace.byKey.get(keyOf(market, symbol)) || workspace.assets.find(item => item.symbol === symbol && finite(item.price) !== null);
          if (!asset || finite(asset.price) === null) continue;
          prices[PortfolioEngine.assetKey(transaction)] = { price: asset.price, date: asset.quoteAt || workspace.updatedAt, source: "automatic" };
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
      const asset = workspace.byProvider.get(provider) || workspace.byKey.get(keyOf(provider.endsWith(".IS") ? "BIST" : "US", provider));
      if (!asset) continue;
      const price = finite(quote?.price ?? quote?.regularMarketPrice);
      if (price === null) continue;
      asset.price = price;
      asset.change = finite(quote?.changePercent ?? quote?.regularMarketChangePercent) ?? asset.change;
      asset.volume = finite(quote?.volume ?? quote?.regularMarketVolume) ?? asset.volume;
      asset.marketCap = finite(quote?.marketCap) ?? asset.marketCap;
      asset.quoteAt = quote?.timestamp || quote?.regularMarketTime || Date.now();
      asset.source = quote?.source || "MIC browser live feed";
      changed += 1;
    }
    if (changed) {
      workspace.updatedAt = Date.now();
      renderAll();
      if (typeof renderPortfolio === "function") renderPortfolio();
    }
    return changed;
  }

  function setFilter(filter) {
    workspace.filter = filter;
    document.querySelectorAll("#pmMarketFilters [data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === filter));
    renderList();
  }

  function bindEvents() {
    $("pmMarketSearch").oninput = event => {
      workspace.query = event.target.value;
      if (workspace.query.trim()) setFilter("ALL");
      else renderList();
    };
    $("pmMarketFilters").onclick = event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      workspace.query = "";
      $("pmMarketSearch").value = "";
      setFilter(button.dataset.filter);
    };
    $("pmSourceTabs").onclick = event => {
      const button = event.target.closest("[data-source]");
      if (!button) return;
      workspace.source = button.dataset.source;
      document.querySelectorAll("#pmSourceTabs [data-source]").forEach(item => item.classList.toggle("active", item === button));
      $("pmDailyWrap").classList.toggle("hidden", workspace.source === "INTRADAY");
      $("pmIntradayWrap").classList.toggle("active", workspace.source === "INTRADAY");
      $("pmRangeButtons").style.display = workspace.source === "INTRADAY" ? "none" : "flex";
      renderHeader();
      window.dispatchEvent(new CustomEvent("pm-market-source-change", { detail: { source: workspace.source, asset: selectedAsset() ? { ...selectedAsset() } : null, version: workspace.requestVersion } }));
      if (workspace.source === "DAILY" && selectedAsset()) loadHistory(selectedAsset(), workspace.requestVersion);
    };
    $("pmRangeButtons").onclick = event => {
      const button = event.target.closest("[data-range]");
      if (!button) return;
      workspace.range = button.dataset.range;
      document.querySelectorAll("#pmRangeButtons [data-range]").forEach(item => item.classList.toggle("active", item === button));
      drawDailyChart();
    };
    $("pmModeButtons").onclick = event => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      workspace.mode = button.dataset.mode;
      document.querySelectorAll("#pmModeButtons [data-mode]").forEach(item => item.classList.toggle("active", item === button));
      drawDailyChart();
      window.dispatchEvent(new CustomEvent("pm-market-mode-change", { detail: { mode: workspace.mode } }));
    };
    $("pmReloadMarket").onclick = () => window.PiyasaMarketLive?.start?.();
    $("pmOpenPortfolio").onclick = () => navigate("portfolio");
    $("pmAddTransaction").onclick = () => {
      const asset = selectedAsset();
      if (!asset) return;
      navigate("portfolio");
      setTimeout(() => {
        const values = {
          txSymbol: asset.providerSymbol,
          txName: asset.name,
          txCurrency: asset.currency,
          txUnit: asset.market === "BIST" ? "lot" : "share",
          txCurrentPrice: asset.price ?? "",
          txCurrentPriceDate: String(asset.quoteAt || workspace.updatedAt || new Date().toISOString()).slice(0, 10)
        };
        for (const [id, value] of Object.entries(values)) if ($(id)) $(id).value = value;
      }, 50);
    };
    $("pmOpenResearch").onclick = () => {
      const asset = selectedAsset();
      if (asset && typeof openAssetDrawer === "function") openAssetDrawer(asset.symbol);
    };
    $("globalSearch")?.addEventListener("input", event => {
      const query = event.target.value.trim();
      if (!query) return;
      if (location.hash !== "#market") navigate("market");
      workspace.query = query;
      setFilter("ALL");
      if ($("pmMarketSearch")) $("pmMarketSearch").value = query;
      renderList();
    });
    window.addEventListener("resize", drawDailyChart);
    window.addEventListener("piyasa-market-quotes", event => applyQuotes(event.detail?.quotes || event.detail || {}));
  }

  function install() {
    injectStyles();
    installView();
    bindEvents();
    loadMarket(false);
    if (location.hash === "#market") setTimeout(() => setView("market"), 0);
  }

  window.PiyasaMarketWorkspace = {
    state: workspace,
    getAssets: () => workspace.assets.map(asset => ({ ...asset })),
    getSelected: () => selectedAsset() ? { ...selectedAsset() } : null,
    select: selectAsset,
    refresh: loadMarket,
    applyQuotes,
    providerSymbol,
    keyOf,
    _test: { assetFrom, mergeAsset, mergeFeeds, searchScore, filteredAssets, keyOf }
  };

  if (!window.__PM_TEST__) install();
})();
