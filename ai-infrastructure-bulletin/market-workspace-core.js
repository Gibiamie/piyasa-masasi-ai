(() => {
  "use strict";

  if (window.__PM_MARKET_WORKSPACE_CORE__) return;
  window.__PM_MARKET_WORKSPACE_CORE__ = true;

  const MARKET_URL = "../mic/data/market.json";
  const NASDAQ_URL = "../mic/data/nasdaq-quotes.json";
  const REPORT_URL = "./data/report.json";
  const HISTORY_BASE = "../mic/data/history";
  const RANGE_DAYS = { "1D": 2, "1W": 8, "1M": 32, "3M": 94, "6M": 187, "1Y": 367, "2Y": 735 };
  const MAX_VISIBLE = 400;

  const workspace = {
    assets: [],
    map: new Map(),
    selected: null,
    filter: "ALL",
    query: "",
    range: "1Y",
    mode: "CANDLE",
    source: "DAILY",
    history: [],
    historyCache: new Map(),
    selectionVersion: 0,
    updatedAt: null,
    sourceLabel: null,
    warnings: [],
    loading: false
  };

  const normalize = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => (typeof state !== "undefined" && state.language === "en") ? "en" : "tr";
  const text = (tr, en) => language() === "en" ? en : tr;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const money = (value, currency = "TRY") => {
    const number = num(value);
    if (number === null) return "—";
    try { return new Intl.NumberFormat(language() === "en" ? "en-GB" : "tr-TR", { style: "currency", currency, maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number); }
    catch (_) { return `${number.toLocaleString(language() === "en" ? "en-GB" : "tr-TR")} ${currency}`; }
  };
  const percent = value => { const number = num(value); return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toFixed(2)}%`; };
  const compact = value => { const number = num(value); return number === null ? "—" : new Intl.NumberFormat(language() === "en" ? "en-GB" : "tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(number); };
  const valueClass = value => num(value) === null || num(value) === 0 ? "" : num(value) > 0 ? "up" : "down";

  function exchangeGroup(asset) {
    const exchange = String(asset?.exchange || "").toUpperCase();
    if (exchange === "BIST") return "BIST";
    if (["US", "NASDAQ", "NYSE", "AMEX", "NYSEARCA", "OTC"].includes(exchange)) return "US";
    return "OTHER";
  }

  function injectStyles() {
    if (document.getElementById("pm-market-workspace-core-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-market-workspace-core-styles";
    style.textContent = `
      .pm-market-layout{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px}.pm-market-panel{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px 5px 18px 5px;overflow:hidden}.pm-market-sidebar{min-height:760px}.pm-market-search{padding:14px;border-bottom:1px solid var(--line)}.pm-market-filters{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);overflow:auto}.pm-market-chip{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--paper-soft);color:var(--muted);white-space:nowrap;font-size:.72rem}.pm-market-chip.active{background:var(--pine);border-color:var(--pine);color:#fff}.pm-market-list-meta{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;color:var(--muted);font-size:.68rem}.pm-market-list{height:650px;overflow:auto;padding:0 8px 12px}.pm-asset-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid transparent;border-radius:12px;padding:10px;background:transparent;color:var(--ink);text-align:left}.pm-asset-row:hover{background:var(--paper-soft)}.pm-asset-row.active{border-color:var(--pine-2);background:var(--sage-soft)}.pm-asset-row strong,.pm-asset-row small,.pm-asset-price span{display:block}.pm-asset-row small{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-asset-price{text-align:right}.pm-asset-price span{font-weight:750}.up{color:var(--positive)}.down{color:var(--negative)}
      .pm-market-main{padding:20px}.pm-market-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.pm-market-head h2{margin:4px 0 5px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.5rem,2.4vw,2.2rem);font-weight:500}.pm-market-head p{margin:0;color:var(--muted)}.pm-market-quote{text-align:right}.pm-market-quote strong{display:block;font-size:1.7rem}.pm-market-quote span{display:block;margin-top:5px}.pm-market-metrics{display:grid;grid-template-columns:repeat(7,minmax(95px,1fr));gap:8px;margin:16px 0}.pm-market-metric,.pm-status-card,.pm-position-card{border:1px solid var(--line);background:var(--paper-soft);border-radius:12px 12px 12px 3px;padding:10px}.pm-market-metric span,.pm-status-card span,.pm-position-card span{display:block;color:var(--muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em}.pm-market-metric strong,.pm-status-card strong,.pm-position-card strong{display:block;margin-top:5px;font-size:.88rem}.pm-market-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.pm-segmented{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-segmented button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-segmented button.active{background:var(--pine);color:#fff}.pm-chart-shell{margin-top:12px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0b1d1a}.pm-daily-wrap,.pm-intraday-wrap{height:520px}.pm-daily-wrap{position:relative}.pm-daily-wrap.hidden,.pm-intraday-wrap{display:none}.pm-intraday-wrap.active{display:block}.pm-daily-wrap canvas{width:100%;height:100%;display:block}.pm-chart-message{position:absolute;inset:0;display:grid;place-items:center;color:#afbeb9;text-align:center;padding:28px}.pm-chart-tooltip{position:absolute;display:none;pointer-events:none;min-width:180px;padding:9px 10px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.94);color:#edf4ef;font-size:.7rem;line-height:1.5}.pm-chart-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 11px;border-top:1px solid rgba(255,255,255,.12);background:#102722;color:#afbeb9;font-size:.68rem}.pm-market-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.pm-position-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pm-status-strip{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin-bottom:18px}.pm-status-note{margin:10px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}
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
          <div class="pm-market-search"><input id="pmMarketSearch" type="search" placeholder="${text("Sembol veya şirket ara", "Search symbol or company")}"></div>
          <div class="pm-market-filters" id="pmMarketFilters"><button class="pm-market-chip active" data-filter="ALL">${text("Tümü", "All")}</button><button class="pm-market-chip" data-filter="BIST">BIST</button><button class="pm-market-chip" data-filter="US">${text("ABD", "US")}</button><button class="pm-market-chip" data-filter="PORTFOLIO">${text("Portföy", "Portfolio")}</button><button class="pm-market-chip" data-filter="ISSUE">${text("Sorunlu", "Issues")}</button></div>
          <div class="pm-market-list-meta"><span id="pmAssetCount">0</span><span>${text("Yenile ile canlı izleme", "Live monitoring after Refresh")}</span></div>
          <div id="pmAssetList" class="pm-market-list"></div>
        </aside>
        <section class="pm-market-panel pm-market-main">
          <div class="pm-market-head"><div><p class="eyebrow">${text("SEÇİLİ VARLIK", "SELECTED ASSET")}</p><h2 id="pmAssetTitle">—</h2><p id="pmAssetSubtitle">—</p></div><div class="pm-market-quote"><strong id="pmAssetPrice">—</strong><span id="pmAssetChange">—</span></div></div>
          <div class="pm-market-metrics"><article class="pm-market-metric"><span>1 ${text("Gün", "Day")}</span><strong id="pm1d">—</strong></article><article class="pm-market-metric"><span>1 ${text("Ay", "Month")}</span><strong id="pm1m">—</strong></article><article class="pm-market-metric"><span>3 ${text("Ay", "Months")}</span><strong id="pm3m">—</strong></article><article class="pm-market-metric"><span>1 ${text("Yıl", "Year")}</span><strong id="pm1y">—</strong></article><article class="pm-market-metric"><span>${text("Hacim", "Volume")}</span><strong id="pmVolume">—</strong></article><article class="pm-market-metric"><span>${text("Piyasa değeri", "Market cap")}</span><strong id="pmMarketCap">—</strong></article><article class="pm-market-metric"><span>${text("Veri durumu", "Data status")}</span><strong id="pmDataStatus">—</strong></article></div>
          <div class="pm-market-toolbar"><div class="pm-segmented" id="pmSourceTabs"><button class="active" data-source="DAILY">${text("Portföy grafiği", "Portfolio chart")}</button><button data-source="INTRADAY">MIC ${text("işlem içi", "intraday")}</button></div><div class="pm-segmented" id="pmRangeButtons"><button data-range="1D">1G</button><button data-range="1W">1H</button><button data-range="1M">1A</button><button data-range="3M">3A</button><button data-range="6M">6A</button><button class="active" data-range="1Y">1Y</button><button data-range="2Y">2Y</button></div><div class="pm-segmented" id="pmModeButtons"><button class="active" data-mode="CANDLE">${text("Mum", "Candles")}</button><button data-mode="LINE">${text("Çizgi", "Line")}</button></div></div>
          <div class="pm-chart-shell"><div id="pmDailyWrap" class="pm-daily-wrap"><canvas id="pmChartCanvas"></canvas><div id="pmChartMessage" class="pm-chart-message">${text("Grafik yükleniyor", "Loading chart")}</div><div id="pmChartTooltip" class="pm-chart-tooltip"></div></div><div id="pmIntradayWrap" class="pm-intraday-wrap"></div><div class="pm-chart-footer"><span id="pmHistoryStatus">—</span><span id="pmChartStats">—</span><span id="pmSourceStatus">—</span></div></div>
          <div class="pm-market-bottom"><section><p class="eyebrow">${text("PORTFÖY BAĞLAMI", "PORTFOLIO CONTEXT")}</p><div class="pm-position-grid"><article class="pm-position-card"><span>${text("Adet", "Quantity")}</span><strong id="pmPositionQty">—</strong></article><article class="pm-position-card"><span>${text("Ort. maliyet", "Average cost")}</span><strong id="pmPositionAvg">—</strong></article><article class="pm-position-card"><span>${text("Piyasa değeri", "Market value")}</span><strong id="pmPositionValue">—</strong></article><article class="pm-position-card"><span>${text("Gerçekleşmemiş K/Z", "Unrealized P/L")}</span><strong id="pmPositionPnl">—</strong></article></div><div class="pm-actions"><button id="pmAddTransaction" class="button primary" type="button">${text("Bu hisse için işlem ekle", "Add transaction for this equity")}</button><button id="pmOpenResearch" class="button" type="button">${text("Araştırmayı aç", "Open research")}</button></div></section><section><p class="eyebrow">${text("SİSTEM DURUMU", "SYSTEM STATUS")}</p><p id="pmStatusNote" class="pm-status-note">—</p><div class="pm-actions"><button id="pmReloadMarket" class="button" type="button">${text("Fiyatları şimdi yenile", "Refresh prices now")}</button><button id="pmOpenPortfolio" class="button" type="button">${text("Portföyü aç", "Open portfolio")}</button></div></section></div>
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
      const tab = document.createElement("button"); tab.type = "button"; tab.className = "tab"; tab.dataset.view = "market"; tab.innerHTML = '<span class="nav-glyph">02</span><span data-i18n="tabMarket">Piyasa ve Grafik</span>'; first.after(tab); tab.onclick = () => navigate("market");
      document.querySelectorAll(".tab").forEach((item, index) => { const glyph = item.querySelector(".nav-glyph"); if (glyph) glyph.textContent = String(index + 1).padStart(2, "0"); });
    }
    if (!document.getElementById("marketView")) {
      const section = document.createElement("section"); section.id = "marketView"; section.className = "view"; section.innerHTML = markup(); document.getElementById("briefingView")?.after(section);
    }
  }

  async function fetchJson(url, force = false) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${force ? Date.now() : "current"}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function upsert(map, raw, priority) {
    const symbol = normalize(raw.symbol || raw.ticker || raw.provider_symbol);
    if (!symbol) return;
    const current = map.get(symbol);
    if (!current || priority >= current._priority) map.set(symbol, { ...current, ...raw, symbol, _priority: priority });
    else map.set(symbol, { ...raw, ...current, symbol, _priority: current._priority });
  }

  function mergeFeeds(mic, nasdaq, report) {
    const map = new Map();
    for (const row of mic?.assets || []) upsert(map, { ...row, quote_as_of: row.price_as_of || mic.updated_at, quote_source: row.source || mic.source, quote_mode: String(row.exchange).toUpperCase() === "BIST" ? "SNAPSHOT" : "EOD" }, 20);
    for (const row of report?.watchlist || []) {
      const provider = String(row.provider_symbol || row.ticker || "").toUpperCase();
      upsert(map, { ...row, symbol: row.ticker || provider, name: row.company || row.ticker, exchange: provider.endsWith(".IS") ? "BIST" : "US", change: row.return_1d_pct, performance: { "1A": row.return_21d_pct, "1Y": row.return_252d_pct }, quote_as_of: row.price_as_of || report.generated_at, quote_source: row.provider, quote_mode: "EOD" }, 10);
    }
    for (const [symbol, row] of Object.entries(nasdaq?.quotes || {})) upsert(map, { ...row, symbol, name: row.name || symbol, exchange: String(row.exchange || "NASDAQ").toUpperCase(), currency: "USD", quote_as_of: row.price_as_of || nasdaq.updated_at, quote_source: row.source || nasdaq.source, quote_mode: "SNAPSHOT" }, 30);
    workspace.updatedAt = [mic?.updated_at, nasdaq?.updated_at, report?.generated_at].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
    workspace.sourceLabel = text("MIC piyasa veri katmanı", "MIC market data layer");
    workspace.assets = [...map.values()].map(({ _priority, ...asset }) => ({ ...asset, symbol: normalize(asset.symbol), name: asset.name || asset.company || asset.symbol, price: num(asset.price), change: num(asset.change), currency: asset.currency || (exchangeGroup(asset) === "BIST" ? "TRY" : "USD") })).filter(asset => asset.symbol && exchangeGroup(asset) !== "OTHER");
    workspace.assets.sort((a, b) => exchangeGroup(a).localeCompare(exchangeGroup(b)) || a.symbol.localeCompare(b.symbol));
    workspace.map = new Map(workspace.assets.map(asset => [asset.symbol, asset]));
    const remembered = normalize(sessionStorage.getItem("pm-selected-market-symbol"));
    workspace.selected = workspace.map.get(remembered) || workspace.selected && workspace.map.get(workspace.selected.symbol) || workspace.assets[0] || null;
  }

  function ageLabel(value = workspace.updatedAt) {
    if (!value) return text("Zaman yok", "No timestamp");
    const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 2) return text("Az önce", "Just now");
    if (minutes < 120) return `${minutes} ${text("dk önce", "min ago")}`;
    return `${Math.round(minutes / 60)} ${text("saat önce", "hours ago")}`;
  }

  function filtered() {
    const query = workspace.query.toLocaleUpperCase(language() === "en" ? "en" : "tr");
    const portfolio = new Set((state?.portfolio?.transactions || []).map(item => normalize(item.symbol)));
    return workspace.assets.filter(asset => {
      const group = exchangeGroup(asset);
      if (workspace.filter === "BIST" && group !== "BIST") return false;
      if (workspace.filter === "US" && group !== "US") return false;
      if (workspace.filter === "PORTFOLIO" && !portfolio.has(asset.symbol)) return false;
      if (workspace.filter === "ISSUE" && num(asset.price) !== null && num(asset.price) > 0) return false;
      return !query || `${asset.symbol} ${asset.name} ${asset.sector || ""}`.toLocaleUpperCase(language() === "en" ? "en" : "tr").includes(query);
    });
  }

  function selectedHolding() {
    if (!workspace.selected || typeof portfolioResult !== "function") return null;
    return portfolioResult().holdings.find(item => normalize(item.symbol) === workspace.selected.symbol) || null;
  }

  function renderStatus() {
    const total = workspace.assets.length, bist = workspace.assets.filter(item => exchangeGroup(item) === "BIST").length, us = workspace.assets.filter(item => exchangeGroup(item) === "US").length, priced = workspace.assets.filter(item => num(item.price) !== null && num(item.price) > 0).length;
    const values = { pmStatusTotal: total || "—", pmStatusBist: total ? bist : "—", pmStatusUs: total ? us : "—", pmStatusCoverage: total ? `%${Math.round(priced / total * 100)}` : "—", pmStatusAge: ageLabel() };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
  }

  function renderList() {
    const rows = filtered(); const visible = rows.slice(0, MAX_VISIBLE); const host = document.getElementById("pmAssetList"); if (!host) return;
    document.getElementById("pmAssetCount").textContent = rows.length > visible.length ? `${rows.length} ${text("hisse · arama ile tamamına ulaşın", "equities · search the full list")}` : `${rows.length} ${text("hisse", "equities")}`;
    host.innerHTML = visible.map(asset => `<button type="button" class="pm-asset-row ${workspace.selected?.symbol === asset.symbol ? "active" : ""}" data-pm-symbol="${escapeHtml(asset.symbol)}"><span><strong>${escapeHtml(asset.symbol)}</strong><small>${escapeHtml(asset.name)}</small></span><span class="pm-asset-price"><span>${money(asset.price, asset.currency)}</span><small class="${valueClass(asset.change)}">${percent(asset.change)}</small></span></button>`).join("") || `<div class="empty-state"><strong>${text("Eşleşen hisse yok", "No matching equity")}</strong></div>`;
    host.querySelectorAll("[data-pm-symbol]").forEach(button => button.onclick = () => selectAsset(button.dataset.pmSymbol));
  }

  function renderHeader() {
    const asset = workspace.selected; if (!asset) return;
    const set = (id, value, className) => { const node = document.getElementById(id); if (!node) return; node.textContent = value; if (className !== undefined) node.className = className; };
    set("pmAssetTitle", `${asset.symbol} · ${asset.name}`); set("pmAssetSubtitle", `${asset.exchange || "—"} · ${asset.sector || text("Sektör bilgisi yok", "No sector data")} · ${asset.currency}`); set("pmAssetPrice", money(asset.price, asset.currency)); set("pmAssetChange", `${percent(asset.change)} · ${ageLabel(asset.quote_as_of)}`, valueClass(asset.change));
    set("pm1d", percent(asset.change), valueClass(asset.change)); set("pm1m", percent(asset.performance?.["1A"]), valueClass(asset.performance?.["1A"])); set("pm3m", percent(asset.performance?.["3A"]), valueClass(asset.performance?.["3A"])); set("pm1y", percent(asset.performance?.["1Y"]), valueClass(asset.performance?.["1Y"])); set("pmVolume", compact(asset.volume)); set("pmMarketCap", compact(asset.market_cap)); set("pmDataStatus", `${workspace.source === "INTRADAY" ? text("İşlem içi", "Intraday") : text("Günlük OHLC", "Daily OHLC")} · ${ageLabel(asset.quote_as_of)}`); set("pmSourceStatus", `${asset.quote_source || workspace.sourceLabel || "—"} · ${asset.quote_as_of ? new Date(asset.quote_as_of).toLocaleString(language() === "en" ? "en-GB" : "tr-TR") : "—"}`);
    const note = document.getElementById("pmStatusNote"); if (note) note.textContent = `${workspace.assets.length} ${text("BIST ve ABD hissesi yüklendi. İşlem içi grafik seçilen sembole doğrudan bağlanır; eski sembol isteği varlık değişince iptal edilir.", "BIST and US equities loaded. The intraday chart binds directly to the selected symbol and cancels the previous request when the asset changes.")}`;
  }

  function renderPosition() {
    const holding = selectedHolding(); const quantity = holding?.quantity || 0;
    const values = { pmPositionQty: quantity ? `${quantity.toLocaleString(language() === "en" ? "en-GB" : "tr-TR", { maximumFractionDigits: 6 })} ${holding.unit || ""}` : "—", pmPositionAvg: quantity ? money(holding.averageCost, holding.currency) : "—", pmPositionValue: holding?.marketValue == null ? "—" : money(holding.marketValue, holding.currency), pmPositionPnl: holding?.unrealizedPnl == null ? "—" : money(holding.unrealizedPnl, holding.currency) };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
  }

  function renderAll() { renderStatus(); renderList(); renderHeader(); renderPosition(); }

  async function loadMarket(force = false) {
    if (workspace.loading) return; workspace.loading = true; workspace.warnings = [];
    try {
      const results = await Promise.allSettled([fetchJson(MARKET_URL, force), fetchJson(NASDAQ_URL, force), fetchJson(REPORT_URL, force)]);
      const feeds = results.map(result => result.status === "fulfilled" ? result.value : null);
      workspace.warnings = results.map((result, index) => result.status === "rejected" ? `${["BIST", "NASDAQ", "RESEARCH"][index]}: ${result.reason?.message || result.reason}` : null).filter(Boolean);
      if (!feeds.some(Boolean)) throw new Error(text("Hiçbir piyasa kaynağına ulaşılamadı", "No market source could be reached"));
      mergeFeeds(feeds[0], feeds[1], feeds[2]); installPortfolioBridge(); renderAll(); if (workspace.selected) await selectAsset(workspace.selected.symbol, force);
    } catch (error) { const note = document.getElementById("pmStatusNote"); if (note) note.textContent = `${text("Piyasa verisi yüklenemedi", "Market data could not be loaded")}: ${error.message}`; }
    finally { workspace.loading = false; }
  }

  async function selectAsset(symbol, force = false) {
    const asset = workspace.map.get(normalize(symbol)); if (!asset) return;
    workspace.selected = asset; workspace.selectionVersion += 1; const version = workspace.selectionVersion; sessionStorage.setItem("pm-selected-market-symbol", asset.symbol); renderList(); renderHeader(); renderPosition();
    window.dispatchEvent(new CustomEvent("pm-market-asset-change", { detail: { asset: { ...asset }, version } }));
    if (workspace.source === "DAILY") await loadHistory(asset.symbol, version, force);
  }

  async function loadHistory(symbol, version, force = false) {
    const message = document.getElementById("pmChartMessage"); if (message) { message.style.display = "grid"; message.textContent = text("Grafik yükleniyor", "Loading chart"); }
    try {
      let payload = !force && workspace.historyCache.get(symbol); if (!payload) { payload = await fetchJson(`${HISTORY_BASE}/${encodeURIComponent(symbol)}.json`, force); workspace.historyCache.set(symbol, payload); }
      if (version !== workspace.selectionVersion || workspace.selected?.symbol !== symbol) return;
      workspace.history = (Array.isArray(payload.history) ? payload.history : Array.isArray(payload.data) ? payload.data : []).filter(row => row?.date && num(row.close) !== null);
      const coverage = workspace.history.length ? `${workspace.history[0].date} → ${workspace.history.at(-1).date}` : "—"; document.getElementById("pmHistoryStatus").textContent = `${workspace.history.length} ${text("günlük OHLC", "daily OHLC")} · ${coverage} · ${payload.provider || "—"}`;
      if (message) { message.style.display = workspace.history.length ? "none" : "grid"; if (!workspace.history.length) message.textContent = text("Günlük OHLC bulunamadı. MIC işlem içi görünümü kullanın.", "Daily OHLC is unavailable. Use MIC intraday."); }
    } catch (_) {
      if (version !== workspace.selectionVersion) return; workspace.history = []; document.getElementById("pmHistoryStatus").textContent = text("Günlük OHLC bulunamadı", "Daily OHLC unavailable"); if (message) { message.style.display = "grid"; message.textContent = text("MIC işlem içi görünümü kullanın.", "Use MIC intraday."); }
    }
    drawChart();
  }

  function visibleHistory() {
    if (!workspace.history.length) return [];
    const days = RANGE_DAYS[workspace.range] || 367; const end = new Date(`${workspace.history.at(-1).date}T00:00:00Z`); const start = new Date(end.getTime() - days * 86400000);
    return workspace.range === "1D" ? workspace.history.slice(-2) : workspace.history.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
  }

  function drawChart() {
    const canvas = document.getElementById("pmChartCanvas"), rows = visibleHistory(); if (!canvas) return; const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, devicePixelRatio || 1); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; const context = canvas.getContext("2d"); context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, rect.width, rect.height);
    const stats = document.getElementById("pmChartStats"); if (!rows.length) { if (stats) stats.textContent = "—"; return; }
    const p = { l: 62, r: 20, t: 30, b: 60 }, width = rect.width - p.l - p.r, height = rect.height - p.t - p.b, priceHeight = height * .8, volumeTop = p.t + height * .85, volumeHeight = height * .13;
    let min = Math.min(...rows.map(row => num(row.low) ?? num(row.close))), max = Math.max(...rows.map(row => num(row.high) ?? num(row.close))); const pad = (max - min || 1) * .07; min -= pad; max += pad;
    const maxVolume = Math.max(1, ...rows.map(row => num(row.volume) || 0)), x = index => p.l + index * width / Math.max(1, rows.length - 1), y = value => p.t + (max - value) * priceHeight / (max - min);
    context.font = "11px system-ui"; context.fillStyle = "#91a8a0"; context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) { const yy = p.t + index * priceHeight / 5, value = max - index * (max - min) / 5; context.beginPath(); context.moveTo(p.l, yy); context.lineTo(rect.width - p.r, yy); context.stroke(); context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4); }
    rows.forEach((row, index) => { const bar = (num(row.volume) || 0) / maxVolume * volumeHeight; context.fillStyle = "rgba(124,165,151,.25)"; context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar); });
    if (workspace.mode === "LINE") { context.strokeStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath(); rows.forEach((row, index) => index ? context.lineTo(x(index), y(Number(row.close))) : context.moveTo(x(index), y(Number(row.close)))); context.stroke(); }
    else { const candleWidth = Math.max(1, Math.min(9, width / rows.length * .62)); rows.forEach((row, index) => { const open = num(row.open) ?? num(row.close), close = num(row.close), high = num(row.high) ?? close, low = num(row.low) ?? close, rising = close >= open, xx = x(index); context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f"; context.beginPath(); context.moveTo(xx, y(high)); context.lineTo(xx, y(low)); context.stroke(); context.fillRect(xx - candleWidth / 2, Math.min(y(open), y(close)), candleWidth, Math.max(1, Math.abs(y(open) - y(close)))); }); }
    const first = num(rows[0].close), last = num(rows.at(-1).close), high = Math.max(...rows.map(row => num(row.high) ?? num(row.close))), low = Math.min(...rows.map(row => num(row.low) ?? num(row.close))); if (stats) stats.textContent = `${text("Dönem", "Period")}: ${percent(first && last !== null ? (last / first - 1) * 100 : null)} · ${text("Yüksek", "High")}: ${money(high, workspace.selected?.currency)} · ${text("Düşük", "Low")}: ${money(low, workspace.selected?.currency)}`;
  }

  function installPortfolioBridge() {
    if (window.__PM_PORTFOLIO_PRICE_BRIDGE_V2__ || typeof reportMarketPrices !== "function") return; window.__PM_PORTFOLIO_PRICE_BRIDGE_V2__ = true; const original = reportMarketPrices;
    reportMarketPrices = function () { const prices = original(); for (const transaction of state.portfolio.transactions) { const asset = workspace.map.get(normalize(transaction.symbol)); if (!asset || num(asset.price) === null) continue; prices[PortfolioEngine.assetKey(transaction)] = { price: asset.price, date: asset.quote_as_of || workspace.updatedAt, source: "automatic" }; } return prices; };
  }

  function bindEvents() {
    document.getElementById("pmMarketSearch").oninput = event => { workspace.query = event.target.value; renderList(); };
    document.getElementById("pmMarketFilters").onclick = event => { const button = event.target.closest("[data-filter]"); if (!button) return; workspace.filter = button.dataset.filter; document.querySelectorAll("#pmMarketFilters button").forEach(item => item.classList.toggle("active", item === button)); renderList(); };
    document.getElementById("pmSourceTabs").onclick = event => { const button = event.target.closest("[data-source]"); if (!button) return; workspace.source = button.dataset.source; document.querySelectorAll("#pmSourceTabs button").forEach(item => item.classList.toggle("active", item === button)); document.getElementById("pmDailyWrap").classList.toggle("hidden", workspace.source === "INTRADAY"); document.getElementById("pmIntradayWrap").classList.toggle("active", workspace.source === "INTRADAY"); document.getElementById("pmRangeButtons").style.display = workspace.source === "INTRADAY" ? "none" : "flex"; renderHeader(); window.dispatchEvent(new CustomEvent("pm-market-source-change", { detail: { source: workspace.source, asset: workspace.selected ? { ...workspace.selected } : null, version: workspace.selectionVersion } })); if (workspace.source === "DAILY" && workspace.selected) loadHistory(workspace.selected.symbol, workspace.selectionVersion); };
    document.getElementById("pmRangeButtons").onclick = event => { const button = event.target.closest("[data-range]"); if (!button) return; workspace.range = button.dataset.range; document.querySelectorAll("#pmRangeButtons button").forEach(item => item.classList.toggle("active", item === button)); drawChart(); };
    document.getElementById("pmModeButtons").onclick = event => { const button = event.target.closest("[data-mode]"); if (!button) return; workspace.mode = button.dataset.mode; document.querySelectorAll("#pmModeButtons button").forEach(item => item.classList.toggle("active", item === button)); drawChart(); window.dispatchEvent(new CustomEvent("pm-market-mode-change", { detail: { mode: workspace.mode } })); };
    document.getElementById("pmReloadMarket").onclick = () => window.PiyasaLiveSession?.start ? window.PiyasaLiveSession.start() : loadMarket(true);
    document.getElementById("pmOpenPortfolio").onclick = () => navigate("portfolio");
    document.getElementById("pmAddTransaction").onclick = () => { const asset = workspace.selected; if (!asset) return; navigate("portfolio"); setTimeout(() => { const values = { txSymbol: exchangeGroup(asset) === "BIST" ? `${asset.symbol}.IS` : asset.symbol, txName: asset.name, txCurrency: asset.currency, txUnit: exchangeGroup(asset) === "BIST" ? "lot" : "share", txCurrentPrice: asset.price ?? "", txCurrentPriceDate: String(asset.quote_as_of || workspace.updatedAt || new Date().toISOString()).slice(0, 10) }; Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.value = value; }); }, 50); };
    document.getElementById("pmOpenResearch").onclick = () => { const symbol = workspace.selected?.symbol; if (symbol && typeof openAssetDrawer === "function") openAssetDrawer(symbol); };
    window.addEventListener("resize", drawChart);
  }

  function install() {
    injectStyles(); installView(); bindEvents(); loadMarket(false); if (location.hash === "#market") setTimeout(() => setView("market"), 0);
  }

  window.PiyasaMarketWorkspace = { state: workspace, getSelected: () => workspace.selected ? { ...workspace.selected } : null, getAssets: () => workspace.assets.map(item => ({ ...item })), select: selectAsset, refresh: loadMarket };
  install();
})();
