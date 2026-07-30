(() => {
  "use strict";
  if (window.__PM_MARKET_INTEGRATION__) return;
  window.__PM_MARKET_INTEGRATION__ = true;

  const MARKET_URL = "../mic/data/market.json";
  const HISTORY_BASE = "../mic/data/history";
  const RANGE_DAYS = { "1D": 2, "1W": 8, "1M": 32, "3M": 94, "6M": 187, "1Y": 367, "2Y": 735 };
  const marketState = {
    data: null,
    assets: [],
    map: new Map(),
    selected: null,
    filter: "ALL",
    query: "",
    range: "1Y",
    mode: "CANDLE",
    source: "MIC",
    history: [],
    historyMeta: null,
    historyCache: new Map(),
    hoverIndex: null,
    loading: false,
    error: null
  };

  const normalize = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const number = value => { const result = Number(value); return Number.isFinite(result) ? result : null; };
  const lang = () => (typeof state !== "undefined" && state.language === "en" ? "en" : "tr");
  const text = (tr, en) => lang() === "en" ? en : tr;
  const money = (value, currency) => {
    const n = number(value);
    if (n === null) return "—";
    try { return new Intl.NumberFormat(lang() === "en" ? "en-GB" : "tr-TR", { style: "currency", currency: currency || "TRY", maximumFractionDigits: n >= 100 ? 2 : 4 }).format(n); }
    catch (_) { return `${n.toLocaleString(lang() === "en" ? "en-GB" : "tr-TR", { maximumFractionDigits: 4 })} ${currency || ""}`.trim(); }
  };
  const percent = value => { const n = number(value); return n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; };
  const valueClass = value => { const n = number(value); return n === null || n === 0 ? "" : n > 0 ? "up" : "down"; };
  const compact = value => { const n = number(value); return n === null ? "—" : new Intl.NumberFormat(lang() === "en" ? "en-GB" : "tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(n); };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const fetchJson = async url => {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  };

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "pm-market-integration-styles";
    style.textContent = `
      .pm-market-layout{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px}.pm-market-panel{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px 5px 18px 5px;overflow:hidden}.pm-market-sidebar{min-height:760px}.pm-market-search{padding:14px;border-bottom:1px solid var(--line)}.pm-market-filters{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);overflow:auto}.pm-market-chip{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--paper-soft);color:var(--muted);white-space:nowrap;font-size:.72rem}.pm-market-chip.active{background:var(--pine);border-color:var(--pine);color:#fff}.pm-market-list-meta{display:flex;justify-content:space-between;padding:9px 14px;color:var(--muted);font-size:.68rem}.pm-market-list{height:650px;overflow:auto;padding:0 8px 12px}.pm-asset-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid transparent;border-radius:12px;padding:10px;background:transparent;color:var(--ink);text-align:left}.pm-asset-row:hover{background:var(--paper-soft)}.pm-asset-row.active{border-color:var(--pine-2);background:var(--sage-soft)}.pm-asset-row strong{display:block}.pm-asset-row small{display:block;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-asset-price{text-align:right}.pm-asset-price span{display:block;font-weight:750}.pm-asset-price small.up,.pm-market-change.up{color:var(--positive)}.pm-asset-price small.down,.pm-market-change.down{color:var(--negative)}
      .pm-market-main{padding:20px}.pm-market-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.pm-market-head h2{margin:4px 0 5px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.5rem,2.4vw,2.2rem);font-weight:500}.pm-market-head p{margin:0;color:var(--muted)}.pm-market-quote{text-align:right}.pm-market-quote strong{display:block;font-size:1.7rem}.pm-market-quote span{display:block;margin-top:5px}.pm-market-metrics{display:grid;grid-template-columns:repeat(7,minmax(95px,1fr));gap:8px;margin:16px 0}.pm-market-metric,.pm-status-card,.pm-position-card{border:1px solid var(--line);background:var(--paper-soft);border-radius:12px 12px 12px 3px;padding:10px}.pm-market-metric span,.pm-status-card span,.pm-position-card span{display:block;color:var(--muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em}.pm-market-metric strong,.pm-status-card strong,.pm-position-card strong{display:block;margin-top:5px;font-size:.88rem}.pm-market-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.pm-segmented{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-segmented button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-segmented button.active{background:var(--pine);color:#fff}.pm-chart-shell{margin-top:12px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0b1d1a}.pm-chart-wrap{height:520px;position:relative}.pm-chart-wrap canvas{width:100%;height:100%;display:block}.pm-chart-message{position:absolute;inset:0;display:grid;place-items:center;color:#afbeb9;text-align:center;padding:28px}.pm-chart-tooltip{position:absolute;display:none;pointer-events:none;min-width:180px;padding:9px 10px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.94);color:#edf4ef;font-size:.7rem;line-height:1.5;box-shadow:0 12px 35px rgba(0,0,0,.25)}.pm-tv-wrap{height:520px;display:none}.pm-tv-wrap.active{display:block}.pm-custom-wrap.hidden{display:none}.pm-chart-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 11px;border-top:1px solid rgba(255,255,255,.12);background:#102722;color:#afbeb9;font-size:.68rem}.pm-market-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.pm-position-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pm-status-strip{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin-bottom:18px}.pm-status-card.good{border-color:#a9cdbd}.pm-status-card.warn{border-color:#e1c58c}.pm-status-card.bad{border-color:#df9b8c}.pm-status-note{margin:10px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}.pm-drawer-chart{margin-top:20px;padding-top:20px;border-top:1px solid var(--line)}.pm-drawer-chart-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.pm-drawer-chart-head h3{margin:0}.pm-drawer-canvas-wrap{height:280px;position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#0b1d1a}.pm-drawer-canvas-wrap canvas{width:100%;height:100%;display:block}.pm-drawer-chart-status{margin:8px 0 0;color:var(--muted);font-size:.7rem}.pm-holding-open{cursor:pointer}.pm-holding-open:hover td{background:var(--sage-soft)}
      @media(max-width:1180px){.pm-market-layout{grid-template-columns:1fr}.pm-market-sidebar{min-height:0}.pm-market-list{height:320px}.pm-market-metrics{grid-template-columns:repeat(4,1fr)}.pm-status-strip{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.pm-market-main{padding:14px}.pm-market-head{flex-direction:column}.pm-market-quote{text-align:left}.pm-market-metrics{grid-template-columns:repeat(2,1fr)}.pm-market-bottom{grid-template-columns:1fr}.pm-position-grid{grid-template-columns:repeat(2,1fr)}.pm-status-strip{grid-template-columns:repeat(2,1fr)}.pm-chart-wrap,.pm-tv-wrap{height:430px}}
    `;
    document.head.appendChild(style);
  }

  function extendApplication() {
    if (typeof I18N !== "undefined") {
      Object.assign(I18N.tr, { tabMarket: "Piyasa ve Grafik", marketPageTitle: "Piyasa ve grafik", marketPageDescription: "Tüm hisseleri inceleyin; grafiği, portföy maliyetini, işlemleri ve veri durumunu aynı çalışma alanında yönetin." });
      Object.assign(I18N.en, { tabMarket: "Market & Chart", marketPageTitle: "Market and chart", marketPageDescription: "Review all equities and manage charts, portfolio cost, transactions and data status in one workspace." });
    }
    if (typeof VIEW_COPY !== "undefined") VIEW_COPY.market = ["marketPageTitle", "marketPageDescription"];

    const firstTab = document.querySelector('.tab[data-view="briefing"]');
    if (firstTab && !document.querySelector('.tab[data-view="market"]')) {
      const tab = document.createElement("button");
      tab.className = "tab";
      tab.dataset.view = "market";
      tab.type = "button";
      tab.innerHTML = '<span class="nav-glyph">02</span><span data-i18n="tabMarket">Piyasa ve Grafik</span>';
      firstTab.after(tab);
      document.querySelectorAll(".tab").forEach((item, index) => { const glyph = item.querySelector(".nav-glyph"); if (glyph) glyph.textContent = String(index + 1).padStart(2, "0"); });
      tab.onclick = () => navigate("market");
    }

    const main = document.querySelector("main");
    if (main && !document.getElementById("marketView")) {
      const section = document.createElement("section");
      section.id = "marketView";
      section.className = "view";
      section.innerHTML = marketMarkup();
      const briefing = document.getElementById("briefingView");
      if (briefing) briefing.after(section); else main.prepend(section);
    }
  }

  function marketMarkup() {
    return `
      <div class="pm-status-strip">
        <article class="pm-status-card"><span>${text("Toplam hisse", "Total equities")}</span><strong id="pmStatusTotal">—</strong></article>
        <article class="pm-status-card"><span>BIST</span><strong id="pmStatusBist">—</strong></article>
        <article class="pm-status-card"><span>${text("ABD / Diğer", "US / Other")}</span><strong id="pmStatusUs">—</strong></article>
        <article class="pm-status-card"><span>${text("Fiyat kapsamı", "Price coverage")}</span><strong id="pmStatusCoverage">—</strong></article>
        <article class="pm-status-card"><span>${text("Veri zamanı", "Data time")}</span><strong id="pmStatusAge">—</strong></article>
      </div>
      <div class="pm-market-layout">
        <aside class="pm-market-panel pm-market-sidebar">
          <div class="pm-market-search"><input id="pmMarketSearch" type="search" placeholder="${text("Sembol veya şirket ara", "Search symbol or company")}"></div>
          <div class="pm-market-filters" id="pmMarketFilters">
            <button class="pm-market-chip active" data-filter="ALL">${text("Tümü", "All")}</button>
            <button class="pm-market-chip" data-filter="BIST">BIST</button>
            <button class="pm-market-chip" data-filter="US">${text("ABD", "US")}</button>
            <button class="pm-market-chip" data-filter="PORTFOLIO">${text("Portföy", "Portfolio")}</button>
            <button class="pm-market-chip" data-filter="ISSUE">${text("Sorunlu", "Issues")}</button>
          </div>
          <div class="pm-market-list-meta"><span id="pmAssetCount">0</span><span>${text("60 sn kontrol", "60 sec check")}</span></div>
          <div id="pmAssetList" class="pm-market-list"></div>
        </aside>
        <section class="pm-market-panel pm-market-main">
          <div class="pm-market-head"><div><p class="eyebrow">${text("SEÇİLİ VARLIK", "SELECTED ASSET")}</p><h2 id="pmAssetTitle">—</h2><p id="pmAssetSubtitle">—</p></div><div class="pm-market-quote"><strong id="pmAssetPrice">—</strong><span id="pmAssetChange">—</span></div></div>
          <div class="pm-market-metrics">
            <article class="pm-market-metric"><span>1 ${text("Gün", "Day")}</span><strong id="pm1d">—</strong></article>
            <article class="pm-market-metric"><span>1 ${text("Ay", "Month")}</span><strong id="pm1m">—</strong></article>
            <article class="pm-market-metric"><span>3 ${text("Ay", "Months")}</span><strong id="pm3m">—</strong></article>
            <article class="pm-market-metric"><span>1 ${text("Yıl", "Year")}</span><strong id="pm1y">—</strong></article>
            <article class="pm-market-metric"><span>${text("Hacim", "Volume")}</span><strong id="pmVolume">—</strong></article>
            <article class="pm-market-metric"><span>${text("Piyasa değeri", "Market cap")}</span><strong id="pmMarketCap">—</strong></article>
            <article class="pm-market-metric"><span>${text("Veri durumu", "Data status")}</span><strong id="pmDataStatus">—</strong></article>
          </div>
          <div class="pm-market-toolbar">
            <div class="pm-segmented" id="pmSourceTabs"><button class="active" data-source="MIC">MIC / ${text("Portföy", "Portfolio")}</button><button data-source="TV">TradingView Intraday</button></div>
            <div class="pm-segmented" id="pmRangeButtons"><button data-range="1D">1G</button><button data-range="1W">1H</button><button data-range="1M">1A</button><button data-range="3M">3A</button><button data-range="6M">6A</button><button class="active" data-range="1Y">1Y</button><button data-range="2Y">2Y</button></div>
            <div class="pm-segmented" id="pmModeButtons"><button class="active" data-mode="CANDLE">${text("Mum", "Candles")}</button><button data-mode="LINE">${text("Çizgi", "Line")}</button></div>
          </div>
          <div class="pm-chart-shell">
            <div id="pmCustomWrap"><div class="pm-chart-wrap"><canvas id="pmChartCanvas"></canvas><div id="pmChartMessage" class="pm-chart-message">${text("Grafik yükleniyor", "Loading chart")}</div><div id="pmChartTooltip" class="pm-chart-tooltip"></div></div></div>
            <div id="pmTvWrap" class="pm-tv-wrap"></div>
            <div class="pm-chart-footer"><span id="pmHistoryStatus">—</span><span id="pmSourceStatus">—</span></div>
          </div>
          <div class="pm-market-bottom">
            <section><p class="eyebrow">${text("PORTFÖY BAĞLAMI", "PORTFOLIO CONTEXT")}</p><div class="pm-position-grid"><article class="pm-position-card"><span>${text("Adet", "Quantity")}</span><strong id="pmPositionQty">—</strong></article><article class="pm-position-card"><span>${text("Ort. maliyet", "Average cost")}</span><strong id="pmPositionAvg">—</strong></article><article class="pm-position-card"><span>${text("Piyasa değeri", "Market value")}</span><strong id="pmPositionValue">—</strong></article><article class="pm-position-card"><span>${text("Gerçekleşmemiş K/Z", "Unrealized P/L")}</span><strong id="pmPositionPnl">—</strong></article></div><div class="pm-actions"><button id="pmAddTransaction" class="button primary" type="button">${text("Bu hisse için işlem ekle", "Add transaction for this equity")}</button><button id="pmOpenResearch" class="button" type="button">${text("Araştırmayı aç", "Open research")}</button></div></section>
            <section><p class="eyebrow">${text("SİSTEM DURUMU", "SYSTEM STATUS")}</p><p id="pmStatusNote" class="pm-status-note">—</p><div class="pm-actions"><button id="pmReloadMarket" class="button" type="button">${text("Piyasa verisini yenile", "Refresh market data")}</button><button id="pmOpenPortfolio" class="button" type="button">${text("Portföyü aç", "Open portfolio")}</button></div></section>
          </div>
        </section>
      </div>`;
  }

  function assetExchangeGroup(asset) { return String(asset.exchange || "").toUpperCase() === "BIST" ? "BIST" : "US"; }
  function assetStatus(asset) { return number(asset.price) !== null && number(asset.price) > 0 ? "OK" : "ISSUE"; }
  function tradingViewSymbol(asset) {
    if (asset.tradingview_symbol) return asset.tradingview_symbol;
    const exchange = String(asset.exchange || "").toUpperCase();
    const symbol = normalize(asset.symbol);
    if (exchange === "BIST") return `BIST:${symbol}`;
    if (["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "OTC"].includes(exchange)) return `${exchange}:${symbol}`;
    return symbol;
  }
  function dataAge() {
    const raw = marketState.data?.updated_at;
    if (!raw) return { minutes: Infinity, label: text("Zaman yok", "No timestamp"), level: "bad" };
    const minutes = Math.max(0, Math.round((Date.now() - new Date(raw).getTime()) / 60000));
    if (minutes < 2) return { minutes, label: text("Az önce", "Just now"), level: "good" };
    if (minutes < 120) return { minutes, label: `${minutes} ${text("dk önce", "min ago")}`, level: minutes <= 15 ? "good" : "warn" };
    const hours = Math.round(minutes / 60);
    return { minutes, label: `${hours} ${text("saat önce", "hours ago")}`, level: hours <= 3 ? "warn" : "bad" };
  }

  function normalizeAssets() {
    const rows = Array.isArray(marketState.data?.assets) ? marketState.data.assets : [];
    marketState.assets = rows.map(raw => ({ ...raw, symbol: normalize(raw.symbol || raw.ticker), name: raw.name || raw.company || raw.symbol, price: number(raw.price), change: number(raw.change), currency: raw.currency || (String(raw.exchange).toUpperCase() === "BIST" ? "TRY" : "USD") })).filter(asset => asset.symbol);
    marketState.assets.sort((a, b) => assetExchangeGroup(a).localeCompare(assetExchangeGroup(b)) || a.symbol.localeCompare(b.symbol));
    marketState.map = new Map(marketState.assets.map(asset => [asset.symbol, asset]));
    const remembered = normalize(sessionStorage.getItem("pm-selected-market-symbol"));
    const portfolioSymbols = new Set((state?.portfolio?.transactions || []).map(tx => normalize(tx.symbol)));
    marketState.selected = marketState.map.get(remembered) || marketState.assets.find(asset => portfolioSymbols.has(asset.symbol)) || marketState.assets[0] || null;
  }

  async function loadMarket(showToast = false) {
    if (marketState.loading) return;
    marketState.loading = true;
    marketState.error = null;
    try {
      marketState.data = await fetchJson(MARKET_URL);
      normalizeAssets();
      installPortfolioPriceBridge();
      renderMarket();
      if (marketState.selected) await selectAsset(marketState.selected.symbol, true);
      if (typeof renderPortfolio === "function") renderPortfolio();
      if (showToast && typeof showToast === "function") showToast(text("Piyasa verisi yenilendi.", "Market data refreshed."));
    } catch (error) {
      marketState.error = error;
      renderStatus();
      const note = document.getElementById("pmStatusNote");
      if (note) note.textContent = `${text("Piyasa verisi yüklenemedi", "Market data could not be loaded")}: ${error.message}`;
    } finally { marketState.loading = false; }
  }

  function installPortfolioPriceBridge() {
    if (window.__PM_PORTFOLIO_PRICE_BRIDGE__ || typeof reportMarketPrices !== "function") return;
    window.__PM_PORTFOLIO_PRICE_BRIDGE__ = true;
    const original = reportMarketPrices;
    reportMarketPrices = function () {
      const prices = original();
      for (const transaction of state.portfolio.transactions) {
        const asset = marketState.map.get(normalize(transaction.symbol));
        if (!asset || number(asset.price) === null) continue;
        if (typeof PortfolioEngine !== "undefined" && PortfolioEngine.normalizeCurrency(asset.currency) !== PortfolioEngine.normalizeCurrency(transaction.currency)) continue;
        prices[PortfolioEngine.assetKey(transaction)] = { price: Number(asset.price), date: marketState.data?.updated_at || null, source: "automatic" };
      }
      return prices;
    };
  }

  function filteredAssets() {
    const query = marketState.query.toLocaleUpperCase(lang() === "en" ? "en" : "tr");
    const portfolioSymbols = new Set((state?.portfolio?.transactions || []).map(tx => normalize(tx.symbol)));
    return marketState.assets.filter(asset => {
      if (marketState.filter === "BIST" && assetExchangeGroup(asset) !== "BIST") return false;
      if (marketState.filter === "US" && assetExchangeGroup(asset) !== "US") return false;
      if (marketState.filter === "PORTFOLIO" && !portfolioSymbols.has(asset.symbol)) return false;
      if (marketState.filter === "ISSUE" && assetStatus(asset) !== "ISSUE") return false;
      if (query && !`${asset.symbol} ${asset.name} ${asset.sector || ""}`.toLocaleUpperCase(lang() === "en" ? "en" : "tr").includes(query)) return false;
      return true;
    });
  }

  function renderMarket() { renderStatus(); renderAssetList(); renderSelectedHeader(); renderPosition(); }
  function renderStatus() {
    const total = marketState.assets.length;
    const bist = marketState.assets.filter(asset => assetExchangeGroup(asset) === "BIST").length;
    const priceOk = marketState.assets.filter(asset => assetStatus(asset) === "OK").length;
    const age = dataAge();
    const values = { pmStatusTotal: total || "—", pmStatusBist: total ? bist : "—", pmStatusUs: total ? total - bist : "—", pmStatusCoverage: total ? `%${Math.round(priceOk / total * 100)}` : "—", pmStatusAge: marketState.error ? text("Hata", "Error") : age.label };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
    const ageCard = document.getElementById("pmStatusAge")?.closest(".pm-status-card");
    if (ageCard) ageCard.className = `pm-status-card ${marketState.error ? "bad" : age.level}`;
  }
  function renderAssetList() {
    const list = filteredAssets();
    const count = document.getElementById("pmAssetCount");
    const container = document.getElementById("pmAssetList");
    if (!container) return;
    if (count) count.textContent = `${list.length} ${text("hisse", "equities")}`;
    container.innerHTML = list.map(asset => `<button class="pm-asset-row ${marketState.selected?.symbol === asset.symbol ? "active" : ""}" data-pm-symbol="${escapeHtml(asset.symbol)}" type="button"><span><strong>${escapeHtml(asset.symbol)}</strong><small>${escapeHtml(asset.name || "")}</small></span><span class="pm-asset-price"><span>${money(asset.price, asset.currency)}</span><small class="${valueClass(asset.change)}">${percent(asset.change)}</small></span></button>`).join("") || `<div class="empty-state"><strong>${text("Eşleşen hisse yok", "No matching equity")}</strong></div>`;
    container.querySelectorAll("[data-pm-symbol]").forEach(button => button.onclick = () => selectAsset(button.dataset.pmSymbol));
  }

  function selectedResearch() {
    const symbol = marketState.selected?.symbol;
    if (!symbol) return null;
    return (state.report?.company_evaluations || []).find(item => normalize(item.ticker) === symbol) || null;
  }
  function selectedMarketReportRow() {
    const symbol = marketState.selected?.symbol;
    return (state.report?.watchlist || []).find(item => normalize(item.ticker || item.provider_symbol) === symbol) || null;
  }
  function selectedHolding() {
    if (!marketState.selected || typeof portfolioResult !== "function") return null;
    return portfolioResult().holdings.find(holding => normalize(holding.symbol) === marketState.selected.symbol) || null;
  }

  function renderSelectedHeader() {
    const asset = marketState.selected;
    if (!asset) return;
    const age = dataAge();
    const set = (id, value, className) => { const node = document.getElementById(id); if (!node) return; node.textContent = value; if (className !== undefined) node.className = className; };
    set("pmAssetTitle", `${asset.symbol} · ${asset.name}`);
    set("pmAssetSubtitle", `${asset.exchange || "—"} · ${asset.sector || text("Sektör bilgisi yok", "No sector data")} · ${asset.currency || "—"}`);
    set("pmAssetPrice", money(asset.price, asset.currency));
    set("pmAssetChange", `${percent(asset.change)} · ${text("piyasa snapshot", "market snapshot")}`, `pm-market-change ${valueClass(asset.change)}`);
    set("pm1d", percent(asset.change), valueClass(asset.change));
    set("pm1m", percent(asset.performance?.["1A"]), valueClass(asset.performance?.["1A"]));
    set("pm3m", percent(asset.performance?.["3A"]), valueClass(asset.performance?.["3A"]));
    set("pm1y", percent(asset.performance?.["1Y"]), valueClass(asset.performance?.["1Y"]));
    set("pmVolume", compact(asset.volume));
    set("pmMarketCap", compact(asset.market_cap));
    set("pmDataStatus", age.label);
    set("pmSourceStatus", `${marketState.data?.source || text("Kaynak yok", "No source")} · ${marketState.data?.updated_at ? new Date(marketState.data.updated_at).toLocaleString(lang() === "en" ? "en-GB" : "tr-TR") : "—"}`);
    const researchButton = document.getElementById("pmOpenResearch");
    if (researchButton) researchButton.disabled = !selectedResearch() && !selectedMarketReportRow();
    const note = document.getElementById("pmStatusNote");
    if (note) note.textContent = marketState.error ? marketState.error.message : `${marketState.assets.length} ${text("hisse yüklendi", "equities loaded")}. ${text("Fiyat dosyası", "Price file")}: ${age.label}. ${text("MIC grafik günlük OHLC; TradingView sekmesi intraday görünüm sağlar.", "MIC chart uses daily OHLC; the TradingView tab provides intraday view.")}`;
  }

  function renderPosition() {
    const asset = marketState.selected;
    if (!asset) return;
    const holding = selectedHolding();
    const quantity = holding?.quantity || 0;
    const values = {
      pmPositionQty: quantity ? `${quantity.toLocaleString(lang() === "en" ? "en-GB" : "tr-TR", { maximumFractionDigits: 6 })} ${holding.unit || ""}` : "—",
      pmPositionAvg: quantity ? money(holding.averageCost, holding.currency) : "—",
      pmPositionValue: holding?.marketValue == null ? "—" : money(holding.marketValue, holding.currency),
      pmPositionPnl: holding?.unrealizedPnl == null ? "—" : money(holding.unrealizedPnl, holding.currency)
    };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
    const pnl = document.getElementById("pmPositionPnl");
    if (pnl) pnl.className = valueClass(holding?.unrealizedPnl);
  }

  async function selectAsset(symbol, force = false) {
    const asset = marketState.map.get(normalize(symbol));
    if (!asset) return;
    marketState.selected = asset;
    marketState.hoverIndex = null;
    sessionStorage.setItem("pm-selected-market-symbol", asset.symbol);
    renderAssetList(); renderSelectedHeader(); renderPosition();
    await loadHistory(asset.symbol, force);
    if (marketState.source === "TV") mountTradingView();
  }

  async function loadHistory(symbol, force = false) {
    const message = document.getElementById("pmChartMessage");
    if (message) { message.style.display = "grid"; message.textContent = text("Grafik yükleniyor", "Loading chart"); }
    try {
      let data;
      if (!force && marketState.historyCache.has(symbol)) data = marketState.historyCache.get(symbol);
      else { data = await fetchJson(`${HISTORY_BASE}/${encodeURIComponent(symbol)}.json`); marketState.historyCache.set(symbol, data); }
      const rows = Array.isArray(data.history) ? data.history : Array.isArray(data.data) ? data.data : [];
      marketState.history = rows.filter(row => row && row.date && number(row.close) !== null);
      marketState.historyMeta = data;
      const status = document.getElementById("pmHistoryStatus");
      if (status) status.textContent = `${marketState.history.length} ${text("günlük OHLC", "daily OHLC")} · ${data.provider || text("kaynak belirtilmedi", "source not specified")}`;
      if (message) { message.style.display = marketState.history.length ? "none" : "grid"; if (!marketState.history.length) message.textContent = text("Bu hisse için OHLC geçmişi boş. TradingView sekmesini kullanın.", "OHLC history is empty for this equity. Use the TradingView tab."); }
    } catch (error) {
      marketState.history = [];
      marketState.historyMeta = null;
      const status = document.getElementById("pmHistoryStatus");
      if (status) status.textContent = text("Günlük OHLC dosyası bulunamadı", "Daily OHLC file not found");
      if (message) { message.style.display = "grid"; message.textContent = text("MIC geçmişi yok. TradingView intraday sekmesini kullanın.", "No MIC history. Use the TradingView intraday tab."); }
    }
    drawChart();
  }

  function visibleHistory() {
    if (!marketState.history.length) return [];
    const days = RANGE_DAYS[marketState.range] || 367;
    const end = new Date(`${marketState.history.at(-1).date}T00:00:00Z`);
    const start = new Date(end.getTime() - days * 86400000);
    return marketState.range === "1D" ? marketState.history.slice(-2) : marketState.history.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
  }
  function chartTransactions(points) {
    const asset = marketState.selected;
    if (!asset || !points.length) return [];
    const rows = (state.portfolio.transactions || []).filter(tx => normalize(tx.symbol) === asset.symbol);
    return rows.map(tx => {
      const target = new Date(`${tx.date}T00:00:00Z`).getTime();
      let index = 0, diff = Infinity;
      points.forEach((point, i) => { const current = Math.abs(new Date(`${point.date}T00:00:00Z`).getTime() - target); if (current < diff) { diff = current; index = i; } });
      return { ...tx, index };
    });
  }

  function drawChart() {
    const canvas = document.getElementById("pmChartCanvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const points = visibleHistory();
    if (!points.length) return;
    const padding = { left: 62, right: 22, top: 34, bottom: 66 };
    const width = rect.width - padding.left - padding.right, height = rect.height - padding.top - padding.bottom;
    const priceHeight = height * .78, volumeTop = padding.top + height * .84, volumeHeight = height * .14;
    const values = points.flatMap(point => [number(point.high), number(point.low), number(point.open), number(point.close)]).filter(Number.isFinite);
    const holding = selectedHolding();
    [number(marketState.selected?.price), holding?.quantity ? number(holding.averageCost) : null].filter(Number.isFinite).forEach(value => values.push(value));
    let min = Math.min(...values), max = Math.max(...values); if (min === max) { min -= 1; max += 1; } const margin = (max - min) * .08; min -= margin; max += margin;
    const maxVolume = Math.max(1, ...points.map(point => number(point.volume) || 0));
    const x = index => padding.left + (points.length === 1 ? width / 2 : index * width / (points.length - 1));
    const y = value => padding.top + (max - value) * priceHeight / (max - min);
    ctx.font = "11px system-ui"; ctx.fillStyle = "#91a8a0"; ctx.strokeStyle = "rgba(160,190,180,.15)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const yy = padding.top + i * priceHeight / 5, val = max - i * (max - min) / 5; ctx.beginPath(); ctx.moveTo(padding.left, yy); ctx.lineTo(rect.width - padding.right, yy); ctx.stroke(); ctx.fillText(val.toFixed(2), 8, yy + 4); }
    points.forEach((point, index) => { const volume = number(point.volume) || 0, barHeight = volume / maxVolume * volumeHeight; ctx.fillStyle = "rgba(124,165,151,.26)"; ctx.fillRect(x(index) - 1.5, volumeTop + volumeHeight - barHeight, 3, barHeight); });
    if (marketState.mode === "LINE") { ctx.strokeStyle = "#8ecab4"; ctx.lineWidth = 2; ctx.beginPath(); points.forEach((point, index) => { const xx = x(index), yy = y(Number(point.close)); if (index) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }); ctx.stroke(); }
    else { const candleWidth = Math.max(2, Math.min(10, width / Math.max(points.length, 1) * .62)); points.forEach((point, index) => { const open = Number(point.open ?? point.close), close = Number(point.close), high = Number(point.high ?? Math.max(open, close)), low = Number(point.low ?? Math.min(open, close)), xx = x(index), rising = close >= open; ctx.strokeStyle = rising ? "#63d6ad" : "#ef766f"; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(xx, y(high)); ctx.lineTo(xx, y(low)); ctx.stroke(); const top = Math.min(y(open), y(close)), bodyHeight = Math.max(1, Math.abs(y(open) - y(close))); ctx.fillRect(xx - candleWidth / 2, top, candleWidth, bodyHeight); }); }
    const drawLevel = (value, color, dash) => { if (number(value) === null) return; ctx.save(); ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(padding.left, y(Number(value))); ctx.lineTo(rect.width - padding.right, y(Number(value))); ctx.stroke(); ctx.restore(); };
    drawLevel(marketState.selected?.price, "#63d6ad", [5, 4]); if (holding?.quantity) drawLevel(holding.averageCost, "#e7c78f", [8, 5]);
    chartTransactions(points).forEach(tx => { const xx = x(tx.index), yy = y(Number(points[tx.index].close)), buy = tx.side === "BUY"; ctx.fillStyle = buy ? "#9bd7c0" : "#f1a095"; ctx.beginPath(); if (buy) { ctx.moveTo(xx, yy - 12); ctx.lineTo(xx - 6, yy - 3); ctx.lineTo(xx + 6, yy - 3); } else { ctx.moveTo(xx, yy + 12); ctx.lineTo(xx - 6, yy + 3); ctx.lineTo(xx + 6, yy + 3); } ctx.closePath(); ctx.fill(); });
    const tickCount = Math.min(6, points.length); ctx.fillStyle = "#91a8a0"; for (let i = 0; i < tickCount; i++) { const index = Math.round(i * (points.length - 1) / Math.max(1, tickCount - 1)); ctx.fillText(points[index].date.slice(5), Math.max(padding.left, x(index) - 22), rect.height - 18); }
    if (marketState.hoverIndex !== null && points[marketState.hoverIndex]) { const xx = x(marketState.hoverIndex); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xx, padding.top); ctx.lineTo(xx, volumeTop + volumeHeight); ctx.stroke(); ctx.setLineDash([]); }
  }

  function handleChartHover(event) {
    const canvas = document.getElementById("pmChartCanvas"), tooltip = document.getElementById("pmChartTooltip"), points = visibleHistory();
    if (!canvas || !tooltip || !points.length) return;
    const rect = canvas.getBoundingClientRect(), paddingLeft = 62, paddingRight = 22, width = rect.width - paddingLeft - paddingRight;
    const localX = event.clientX - rect.left;
    const index = Math.max(0, Math.min(points.length - 1, Math.round((localX - paddingLeft) / width * (points.length - 1))));
    marketState.hoverIndex = index; drawChart();
    const point = points[index]; tooltip.innerHTML = `<strong>${escapeHtml(point.date)}</strong><br>O ${money(point.open, marketState.selected.currency)} · H ${money(point.high, marketState.selected.currency)}<br>L ${money(point.low, marketState.selected.currency)} · C ${money(point.close, marketState.selected.currency)}<br>${text("Hacim", "Volume")}: ${compact(point.volume)}`;
    tooltip.style.display = "block"; tooltip.style.left = `${Math.min(rect.width - 195, Math.max(8, localX + 12))}px`; tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 78)}px`;
  }
  function clearChartHover() { marketState.hoverIndex = null; const tooltip = document.getElementById("pmChartTooltip"); if (tooltip) tooltip.style.display = "none"; drawChart(); }

  function mountTradingView() {
    const asset = marketState.selected, container = document.getElementById("pmTvWrap");
    if (!asset || !container) return;
    container.innerHTML = '<div class="tradingview-widget-container" style="height:100%"><div class="tradingview-widget-container__widget" style="height:100%"></div></div>';
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.text = JSON.stringify({ autosize: true, symbol: tradingViewSymbol(asset), interval: "15", timezone: "Europe/Istanbul", theme: "light", style: "1", locale: lang(), allow_symbol_change: true, calendar: false, support_host: "https://www.tradingview.com" });
    container.firstElementChild.appendChild(script);
  }

  function openSelectedResearch() {
    const asset = marketState.selected;
    if (!asset) return;
    const row = selectedResearch() || selectedMarketReportRow();
    if (row && typeof openAssetDrawer === "function") openAssetDrawer(row.ticker || asset.symbol);
  }
  function addSelectedTransaction() {
    const asset = marketState.selected;
    if (!asset) return;
    navigate("portfolio");
    setTimeout(() => {
      const fields = { txSymbol: asset.exchange === "BIST" ? `${asset.symbol}.IS` : asset.symbol, txName: asset.name || asset.symbol, txCurrency: asset.currency || "TRY", txUnit: lang() === "en" ? "share" : "lot", txCurrentPrice: asset.price ?? "", txCurrentPriceDate: marketState.data?.updated_at ? String(marketState.data.updated_at).slice(0, 10) : new Date().toISOString().slice(0, 10) };
      Object.entries(fields).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value; });
      document.getElementById("transactionForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
  function openSelectedInMarket(symbol) { const target = normalize(symbol); navigate("market"); setTimeout(() => selectAsset(target), 80); }

  function integrateDrawer() {
    if (typeof openAssetDrawer !== "function" || window.__PM_DRAWER_BRIDGE__) return;
    window.__PM_DRAWER_BRIDGE__ = true;
    const original = openAssetDrawer;
    openAssetDrawer = function (ticker) {
      original(ticker);
      const symbol = normalize(ticker), content = document.getElementById("drawerContent");
      if (!content || content.querySelector(".pm-drawer-chart")) return;
      const section = document.createElement("section");
      section.className = "pm-drawer-chart";
      section.innerHTML = `<div class="pm-drawer-chart-head"><h3>${text("Fiyat grafiği ve portföy", "Price chart and portfolio")}</h3><button class="button" type="button">${text("Tam grafikte aç", "Open full chart")}</button></div><div class="pm-drawer-canvas-wrap"><canvas></canvas><div class="pm-chart-message">${text("Grafik yükleniyor", "Loading chart")}</div></div><p class="pm-drawer-chart-status">—</p>`;
      content.appendChild(section);
      section.querySelector("button").onclick = () => { if (typeof closeAssetDrawer === "function") closeAssetDrawer(); openSelectedInMarket(symbol); };
      loadDrawerChart(symbol, section);
    };
  }
  async function loadDrawerChart(symbol, section) {
    const canvas = section.querySelector("canvas"), message = section.querySelector(".pm-chart-message"), status = section.querySelector(".pm-drawer-chart-status");
    try {
      const data = marketState.historyCache.get(symbol) || await fetchJson(`${HISTORY_BASE}/${encodeURIComponent(symbol)}.json`);
      marketState.historyCache.set(symbol, data);
      const rows = (Array.isArray(data.history) ? data.history : Array.isArray(data.data) ? data.data : []).filter(row => row && row.date && number(row.close) !== null).slice(-180);
      if (!rows.length) throw new Error(text("OHLC geçmişi boş", "OHLC history is empty"));
      message.style.display = "none"; status.textContent = `${rows.length} ${text("günlük OHLC", "daily OHLC")} · ${data.provider || "—"}`; drawMiniChart(canvas, rows, symbol);
    } catch (error) { message.textContent = `${text("Grafik yüklenemedi", "Chart could not be loaded")}: ${error.message}`; status.textContent = text("TradingView için tam grafik bölümünü açın.", "Open the full chart section for TradingView."); }
  }
  function drawMiniChart(canvas, rows, symbol) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.max(1, window.devicePixelRatio || 1); canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const pad = 18, width = rect.width - pad * 2, height = rect.height - pad * 2, closes = rows.map(row => Number(row.close)), min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1, x = index => pad + index * width / Math.max(1, rows.length - 1), y = value => pad + (max - value) * height / span;
    ctx.strokeStyle = "rgba(160,190,180,.16)"; for (let i = 0; i <= 4; i++) { const yy = pad + i * height / 4; ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(rect.width - pad, yy); ctx.stroke(); }
    ctx.strokeStyle = "#8ecab4"; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((row, index) => { if (index) ctx.lineTo(x(index), y(Number(row.close))); else ctx.moveTo(x(index), y(Number(row.close))); }); ctx.stroke();
    const asset = marketState.map.get(symbol); if (asset && number(asset.price) !== null) { ctx.strokeStyle = "#63d6ad"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(pad, y(asset.price)); ctx.lineTo(rect.width - pad, y(asset.price)); ctx.stroke(); }
  }

  function bridgePortfolioRows() {
    const body = document.getElementById("portfolioHoldingsBody");
    if (!body || body.dataset.pmBridge === "1") return;
    body.dataset.pmBridge = "1";
    body.addEventListener("click", event => {
      if (event.target.closest("button, a")) return;
      const row = event.target.closest("tr"); if (!row) return;
      const symbol = row.querySelector(".ticker-name strong")?.textContent; if (symbol) openSelectedInMarket(symbol);
    });
    const observer = new MutationObserver(() => body.querySelectorAll("tr").forEach(row => row.classList.add("pm-holding-open")));
    observer.observe(body, { childList: true });
  }

  function bindIntegrationEvents() {
    const search = document.getElementById("pmMarketSearch"); if (search) search.oninput = event => { marketState.query = event.target.value; renderAssetList(); };
    const filters = document.getElementById("pmMarketFilters"); if (filters) filters.onclick = event => { const button = event.target.closest("[data-filter]"); if (!button) return; marketState.filter = button.dataset.filter; filters.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); renderAssetList(); };
    const sourceTabs = document.getElementById("pmSourceTabs"); if (sourceTabs) sourceTabs.onclick = event => { const button = event.target.closest("[data-source]"); if (!button) return; marketState.source = button.dataset.source; sourceTabs.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); document.getElementById("pmCustomWrap")?.classList.toggle("hidden", marketState.source === "TV"); document.getElementById("pmTvWrap")?.classList.toggle("active", marketState.source === "TV"); if (marketState.source === "TV") mountTradingView(); };
    const ranges = document.getElementById("pmRangeButtons"); if (ranges) ranges.onclick = event => { const button = event.target.closest("[data-range]"); if (!button) return; marketState.range = button.dataset.range; ranges.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); drawChart(); };
    const modes = document.getElementById("pmModeButtons"); if (modes) modes.onclick = event => { const button = event.target.closest("[data-mode]"); if (!button) return; marketState.mode = button.dataset.mode; modes.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); drawChart(); };
    document.getElementById("pmAddTransaction")?.addEventListener("click", addSelectedTransaction);
    document.getElementById("pmOpenResearch")?.addEventListener("click", openSelectedResearch);
    document.getElementById("pmOpenPortfolio")?.addEventListener("click", () => navigate("portfolio"));
    document.getElementById("pmReloadMarket")?.addEventListener("click", () => loadMarket(true));
    const canvas = document.getElementById("pmChartCanvas"); if (canvas) { canvas.addEventListener("mousemove", handleChartHover); canvas.addEventListener("mouseleave", clearChartHover); }
    window.addEventListener("resize", () => { drawChart(); const drawer = document.querySelector(".pm-drawer-chart"); if (drawer && drawer.offsetParent) { const symbol = normalize(document.querySelector(".drawer-symbol")?.textContent); if (symbol) loadDrawerChart(symbol, drawer); } });
    setInterval(() => loadMarket(false), 60000);

    const refresh = document.getElementById("refresh");
    if (refresh && !refresh.dataset.pmBridge) { refresh.dataset.pmBridge = "1"; const original = refresh.onclick; refresh.onclick = async event => { if (original) await original.call(refresh, event); await loadMarket(false); }; }
    const languageButton = document.getElementById("languageToggle");
    if (languageButton && !languageButton.dataset.pmBridge) { languageButton.dataset.pmBridge = "1"; const original = languageButton.onclick; languageButton.onclick = event => { if (original) original.call(languageButton, event); renderMarket(); }; }
  }

  injectStyles();
  extendApplication();
  bindIntegrationEvents();
  integrateDrawer();
  bridgePortfolioRows();
  loadMarket(false);
  if (location.hash === "#market") setTimeout(() => setView("market"), 0);
})();
