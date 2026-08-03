(() => {
  "use strict";
  if (window.__PM_LIVE_MARKET_BRIDGE__) return;
  window.__PM_LIVE_MARKET_BRIDGE__ = true;

  let lastRefresh = 0;
  let observer = null;
  let scheduled = false;

  const language = () => (typeof state !== "undefined" && state.language === "en" ? "en" : "tr");
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const text = (tr, en) => language() === "en" ? en : tr;
  const number = value => { const result = Number(value); return Number.isFinite(result) ? result : null; };
  const normalize = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");
  const money = (value, currency) => {
    const amount = number(value);
    if (amount === null) return "—";
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency: currency || "USD", maximumFractionDigits: amount >= 100 ? 2 : 4 }).format(amount); }
    catch (_) { return `${amount.toLocaleString(locale(), { maximumFractionDigits: 4 })} ${currency || ""}`.trim(); }
  };
  const percent = value => {
    const amount = number(value);
    return amount === null ? "—" : `${amount > 0 ? "+" : ""}${amount.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  };
  const valueClass = value => { const amount = number(value); return amount === null || amount === 0 ? "" : amount > 0 ? "up" : "down"; };

  function liveApi() { return window.PiyasaLiveMarket; }
  function quoteFor(symbol) {
    const api = liveApi();
    if (!api?.runtime?.quotes) return null;
    const normalized = normalize(symbol);
    return api.runtime.quotes.get(normalized) || api.runtime.quotes.get(`${normalized}.IS`) || [...api.runtime.quotes.values()].find(quote => normalize(quote.symbol) === normalized) || null;
  }

  function freshness(quote) {
    const api = liveApi();
    return api?.quoteFreshness ? api.quoteFreshness(quote) : { code: "cache", delayedMinutes: 0 };
  }

  function freshnessLabel(quote) {
    const status = freshness(quote);
    if (status.code === "delayed") return language() === "en" ? `${status.delayedMinutes}-min delayed` : `${status.delayedMinutes} dk gecikmeli`;
    if (status.code === "live") return text("Canlı akış", "Live feed");
    if (status.code === "nearLive") return text("Yakın zamanlı", "Near real time");
    return text("Önbellek", "Cached");
  }

  function quoteTime(quote) {
    const raw = number(quote?.timestamp);
    if (raw === null) return "—";
    const milliseconds = raw < 10_000_000_000 ? raw * 1000 : raw;
    return new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "medium" }).format(new Date(milliseconds));
  }

  function selectedSymbol() {
    return document.querySelector("#pmAssetList .pm-asset-row.active")?.dataset.pmSymbol || normalize(document.getElementById("pmAssetTitle")?.textContent?.split("·")[0]);
  }

  function patchAssetList() {
    document.querySelectorAll("#pmAssetList [data-pm-symbol]").forEach(button => {
      const quote = quoteFor(button.dataset.pmSymbol);
      if (!quote) return;
      const price = button.querySelector(".pm-asset-price span");
      const change = button.querySelector(".pm-asset-price small");
      if (price) price.textContent = money(quote.price, quote.currency);
      if (change) { change.textContent = percent(quote.changePercent); change.className = valueClass(quote.changePercent); }
      button.dataset.livePrice = String(quote.price);
      button.title = `${freshnessLabel(quote)} · ${quoteTime(quote)}`;
    });
  }

  function patchSelected() {
    const symbol = selectedSymbol();
    const quote = quoteFor(symbol);
    if (!quote) return;
    const price = document.getElementById("pmAssetPrice");
    const change = document.getElementById("pmAssetChange");
    const oneDay = document.getElementById("pm1d");
    const status = document.getElementById("pmDataStatus");
    const source = document.getElementById("pmSourceStatus");
    if (price) price.textContent = money(quote.price, quote.currency);
    if (change) { change.textContent = `${percent(quote.changePercent)} · ${freshnessLabel(quote)}`; change.className = `pm-market-change ${valueClass(quote.changePercent)}`; }
    if (oneDay) { oneDay.textContent = percent(quote.changePercent); oneDay.className = valueClass(quote.changePercent); }
    if (status) status.textContent = freshnessLabel(quote);
    if (source) source.textContent = `${quote.source || "Yahoo Finance"} · ${quoteTime(quote)}`;
  }

  function patchPortfolioContext() {
    if (typeof portfolioResult !== "function") return;
    const symbol = normalize(selectedSymbol());
    const holding = portfolioResult().openHoldings.find(item => normalize(item.symbol) === symbol);
    if (!holding) return;
    const fields = {
      pmPositionQty: `${holding.quantity.toLocaleString(locale(), { maximumFractionDigits: 6 })} ${holding.unit || ""}`,
      pmPositionAvg: money(holding.averageCost, holding.currency),
      pmPositionValue: holding.marketValue == null ? "—" : money(holding.marketValue, holding.currency),
      pmPositionPnl: holding.unrealizedPnl == null ? "—" : money(holding.unrealizedPnl, holding.currency)
    };
    Object.entries(fields).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
    const pnl = document.getElementById("pmPositionPnl");
    if (pnl) pnl.className = valueClass(holding.unrealizedPnl);
  }

  function patchStatus() {
    const api = liveApi();
    if (!api?.runtime?.quotes?.size) return;
    const label = document.querySelector(".pm-market-list-meta span:last-child");
    if (label) label.textContent = text("30 sn canlı kontrol", "30-sec live check");
    const age = document.getElementById("pmStatusAge");
    if (age) age.textContent = text("30 sn otomatik", "30-sec auto");
    const card = age?.closest(".pm-status-card");
    if (card) card.className = "pm-status-card good";
    const note = document.getElementById("pmStatusNote");
    if (note) note.textContent = `${api.runtime.quotes.size} ${text("varlık tarayıcı akışında yenileniyor", "assets are refreshing in the browser feed")}. ${text("Özel grafik günlük ve dönemsel OHLC; TradingView sekmesi intraday görünüm sağlar.", "The custom chart provides daily and range OHLC; the TradingView tab provides intraday detail.")}`;
  }

  function patchAll() {
    scheduled = false;
    patchAssetList();
    patchSelected();
    patchPortfolioContext();
    patchStatus();
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(patchAll);
  }

  function installObserver() {
    const list = document.getElementById("pmAssetList");
    if (!list || observer) return;
    observer = new MutationObserver(schedulePatch);
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    list.addEventListener("click", () => setTimeout(schedulePatch, 0));
  }

  function loop() {
    const api = liveApi();
    installObserver();
    if (api?.runtime?.lastRefresh && api.runtime.lastRefresh !== lastRefresh) {
      lastRefresh = api.runtime.lastRefresh;
      patchAll();
    }
    setTimeout(loop, 500);
  }

  loop();
})();
