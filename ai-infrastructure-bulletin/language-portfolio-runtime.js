(() => {
  "use strict";

  if (window.__PM_LANGUAGE_PORTFOLIO_RUNTIME__) return;
  window.__PM_LANGUAGE_PORTFOLIO_RUNTIME__ = true;

  const COPY = {
    tr: {
      brandSubtitle: "PİYASA ZEKÂSI",
      marketTab: "Piyasa ve Grafik",
      marketTitle: "Piyasa ve grafik",
      marketDescription: "KAP ve Nasdaq hisse evreni, işlem içi grafikler ve portföy bağlamı.",
      globalPlaceholder: "Hisse kodu veya şirket adı ara",
      totalEquities: "Toplam hisse",
      usEquities: "ABD hisseleri",
      priceCoverage: "Fiyat kapsamı",
      dataTime: "Veri zamanı",
      marketPlaceholder: "Sembol veya şirket ara",
      all: "Tümü",
      us: "ABD",
      portfolio: "Portföy",
      missingPrice: "Fiyatı eksik",
      searchAllMarkets: "Arama tüm piyasalarda çalışır",
      selectedAsset: "SEÇİLİ VARLIK",
      day: "1 Gün",
      month: "1 Ay",
      threeMonths: "3 Ay",
      year: "1 Yıl",
      volume: "Hacim",
      marketCap: "Piyasa değeri",
      dataStatus: "Veri durumu",
      portfolioChart: "Portföy grafiği",
      intraday: "MIC işlem içi",
      candles: "Mum",
      line: "Çizgi",
      portfolioContext: "PORTFÖY BAĞLAMI",
      quantity: "Adet",
      averageCost: "Ort. maliyet",
      marketValue: "Piyasa değeri",
      unrealized: "Gerçekleşmemiş K/Z",
      addTransaction: "Bu hisse için işlem ekle",
      openResearch: "Araştırmayı aç",
      systemStatus: "SİSTEM DURUMU",
      refreshStart: "Fiyatları yenile ve izlemeyi başlat",
      refreshNow: "Şimdi yenile",
      openPortfolio: "Portföyü aç",
      liveOff: "Canlı izleme kapalı",
      liveOn: "Canlı izleme açık",
      liveUpdating: "Canlı izleme açık · güncelleniyor",
      liveUnavailable: "Canlı izleme açık · veri alınamadı",
      pressRefresh: "Yenile'ye basınca sekme açık kaldığı sürece fiyatlar güncellenir.",
      lastSuccessful: "Son başarılı kontrol",
      updated: "güncellenen",
      scanning: "Hisse evreni taranıyor",
      retryRefresh: "Şimdi yenile ile yeniden deneyin.",
      lot: "lot",
      share: "share"
    },
    en: {
      brandSubtitle: "MARKET INTELLIGENCE",
      marketTab: "Market & Chart",
      marketTitle: "Market and chart",
      marketDescription: "KAP and Nasdaq equity universe, intraday charts and portfolio context.",
      globalPlaceholder: "Search ticker or company name",
      totalEquities: "Total equities",
      usEquities: "US equities",
      priceCoverage: "Price coverage",
      dataTime: "Data time",
      marketPlaceholder: "Search symbol or company",
      all: "All",
      us: "US",
      portfolio: "Portfolio",
      missingPrice: "Missing price",
      searchAllMarkets: "Search covers all markets",
      selectedAsset: "SELECTED ASSET",
      day: "1 Day",
      month: "1 Month",
      threeMonths: "3 Months",
      year: "1 Year",
      volume: "Volume",
      marketCap: "Market cap",
      dataStatus: "Data status",
      portfolioChart: "Portfolio chart",
      intraday: "MIC intraday",
      candles: "Candles",
      line: "Line",
      portfolioContext: "PORTFOLIO CONTEXT",
      quantity: "Quantity",
      averageCost: "Average cost",
      marketValue: "Market value",
      unrealized: "Unrealized P/L",
      addTransaction: "Add transaction for this equity",
      openResearch: "Open research",
      systemStatus: "SYSTEM STATUS",
      refreshStart: "Refresh and start monitoring",
      refreshNow: "Refresh now",
      openPortfolio: "Open portfolio",
      liveOff: "Live monitoring off",
      liveOn: "Live monitoring on",
      liveUpdating: "Live monitoring on · updating",
      liveUnavailable: "Live monitoring on · data unavailable",
      pressRefresh: "Press Refresh to update prices while this tab remains open.",
      lastSuccessful: "Last successful check",
      updated: "updated",
      scanning: "Scanning equity universe",
      retryRefresh: "Press Refresh now to retry.",
      lot: "lot",
      share: "share"
    }
  };

  const byId = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const copy = () => COPY[language()];
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  let symbolTimer = null;
  let applyTimer = null;

  function setText(selector, value) {
    const node = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (node && value !== undefined && value !== null) node.textContent = value;
  }

  function formatClock(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(language() === "en" ? "en-GB" : "tr-TR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Muscat"
    }).format(new Date(value));
  }

  function formatInputDate(value) {
    if (!value) return "";
    let timestamp = value;
    if (typeof timestamp === "number" && timestamp < 1e12) timestamp *= 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function marketAssets() {
    try { return window.PiyasaMarketWorkspace?.getAssets?.() || []; }
    catch (_) { return []; }
  }

  function resolveAsset(rawValue) {
    const raw = String(rawValue || "").trim().toUpperCase();
    if (!raw) return null;
    const assets = marketAssets();
    const providerMatch = assets.find(asset => String(asset.providerSymbol || "").toUpperCase() === raw);
    if (providerMatch) return providerMatch;
    const symbol = raw.replace(/\.IS$/, "");
    const matches = assets.filter(asset => String(asset.symbol || "").toUpperCase() === symbol);
    if (!matches.length) return null;
    if (raw.endsWith(".IS")) return matches.find(asset => asset.market === "BIST") || matches[0];
    const selected = window.PiyasaMarketWorkspace?.getSelected?.();
    if (selected?.symbol === symbol) return matches.find(asset => asset.key === selected.key) || matches[0];
    return matches.find(asset => String(asset.providerSymbol || "").toUpperCase() === raw)
      || (matches.length === 1 ? matches[0] : matches.find(asset => asset.market === "US"))
      || matches[0];
  }

  function fillTransactionAsset(asset, force = false) {
    if (!asset) return false;
    const name = byId("txName");
    const currency = byId("txCurrency");
    const unit = byId("txUnit");
    const assetType = byId("txAssetType");
    const currentPrice = byId("txCurrentPrice");
    const currentDate = byId("txCurrentPriceDate");

    if (name && (force || !name.value.trim() || name.dataset.autoFilled === "1")) {
      name.value = asset.name || asset.symbol;
      name.dataset.autoFilled = "1";
    }
    if (currency) currency.value = asset.currency || (asset.market === "BIST" ? "TRY" : "USD");
    if (unit) unit.value = asset.market === "BIST" ? copy().lot : copy().share;
    if (assetType) assetType.value = "STOCK";

    const price = finite(asset.price);
    if (currentPrice) {
      currentPrice.value = price === null ? "" : String(price);
      currentPrice.dataset.autoFilled = price === null ? "0" : "1";
    }
    if (currentDate) {
      const dateValue = formatInputDate(asset.quoteAt || window.PiyasaMarketWorkspace?.state?.marketAt);
      currentDate.value = price === null ? "" : (dateValue || currentDate.value || new Date().toISOString().slice(0, 10));
      currentDate.dataset.autoFilled = price === null ? "0" : "1";
    }
    return true;
  }

  function autofillFromSymbol(force = false) {
    const symbolInput = byId("txSymbol");
    if (!symbolInput) return false;
    return fillTransactionAsset(resolveAsset(symbolInput.value), force);
  }

  function populateSymbolList() {
    const list = byId("trackedSymbols");
    const assets = marketAssets();
    if (!list || !assets.length) return false;
    const fragment = document.createDocumentFragment();
    const seen = new Set();
    for (const asset of assets) {
      const value = String(asset.providerSymbol || asset.symbol || "").toUpperCase();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const option = document.createElement("option");
      option.value = value;
      option.label = `${asset.symbol} · ${asset.name} · ${asset.exchange || asset.market}`;
      fragment.appendChild(option);
    }
    list.replaceChildren(fragment);
    return true;
  }

  function bindTransactionForm() {
    const symbol = byId("txSymbol");
    const name = byId("txName");
    if (!symbol || symbol.dataset.catalogAutofill === "1") return;
    symbol.dataset.catalogAutofill = "1";
    symbol.addEventListener("input", () => {
      clearTimeout(symbolTimer);
      symbolTimer = setTimeout(() => autofillFromSymbol(false), 120);
    });
    symbol.addEventListener("change", () => autofillFromSymbol(true));
    symbol.addEventListener("blur", () => autofillFromSymbol(true));
    name?.addEventListener("input", () => { name.dataset.autoFilled = "0"; });
    window.addEventListener("piyasa-market-quotes", () => autofillFromSymbol(false));
  }

  function applyLiveLanguage() {
    const live = window.PiyasaMarketLive?.state;
    if (!live) return;
    const c = copy();
    const pill = byId("freshness");
    const detail = byId("freshnessDetail");
    const globalButton = byId("refresh");
    const localButton = byId("pmReloadMarket");
    if (!pill) return;

    if (!live.active) {
      pill.textContent = c.liveOff;
      if (detail) detail.textContent = c.pressRefresh;
      if (globalButton) globalButton.textContent = c.refreshStart;
      if (localButton) localButton.textContent = c.refreshStart;
      return;
    }
    if (live.scanning) {
      pill.textContent = c.liveUpdating;
      if (detail) detail.textContent = `${c.scanning} · ${live.processed}/${live.total} · ${c.updated}: ${live.updated}`;
    } else if (live.lastError && !live.lastSuccessAt) {
      pill.textContent = c.liveUnavailable;
      if (detail) detail.textContent = c.retryRefresh;
    } else {
      pill.textContent = c.liveOn;
      if (detail) detail.textContent = `${c.lastSuccessful}: ${formatClock(live.lastSuccessAt)} · ${c.updated}: ${live.updated}/${live.total}`;
    }
    if (globalButton) globalButton.textContent = c.refreshNow;
    if (localButton) localButton.textContent = c.refreshNow;
  }

  function applyMarketLanguage() {
    const c = copy();
    setText(".brand-text small", c.brandSubtitle);
    setText('.tab[data-view="market"] [data-i18n="tabMarket"]', c.marketTab);
    if (location.hash === "#market") {
      setText("#viewTitle", c.marketTitle);
      setText("#viewDescription", c.marketDescription);
    }
    const globalSearch = byId("globalSearch");
    if (globalSearch) globalSearch.placeholder = c.globalPlaceholder;
    const marketSearch = byId("pmMarketSearch");
    if (marketSearch) marketSearch.placeholder = c.marketPlaceholder;

    const statusLabels = [c.totalEquities, "BIST", c.usEquities, c.priceCoverage, c.dataTime];
    document.querySelectorAll("#marketView .pm-status-card > span").forEach((node, index) => { if (statusLabels[index]) node.textContent = statusLabels[index]; });

    const filters = { ALL: c.all, BIST: "BIST", US: c.us, PORTFOLIO: c.portfolio, ISSUE: c.missingPrice };
    document.querySelectorAll("#pmMarketFilters [data-filter]").forEach(button => { button.textContent = filters[button.dataset.filter] || button.textContent; });
    setText("#marketView .pm-market-list-meta span:last-child", c.searchAllMarkets);
    setText("#marketView .pm-market-head .eyebrow", c.selectedAsset);

    const metricLabels = [c.day, c.month, c.threeMonths, c.year, c.volume, c.marketCap, c.dataStatus];
    document.querySelectorAll("#marketView .pm-market-metrics .pm-market-metric > span").forEach((node, index) => { if (metricLabels[index]) node.textContent = metricLabels[index]; });

    setText('#pmSourceTabs [data-source="DAILY"]', c.portfolioChart);
    setText('#pmSourceTabs [data-source="INTRADAY"]', c.intraday);
    const rangeLabels = language() === "en" ? ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"] : ["1G", "1H", "1A", "3A", "6A", "1Y", "2Y"];
    document.querySelectorAll("#pmRangeButtons [data-range]").forEach((node, index) => { if (rangeLabels[index]) node.textContent = rangeLabels[index]; });
    setText('#pmModeButtons [data-mode="CANDLE"]', c.candles);
    setText('#pmModeButtons [data-mode="LINE"]', c.line);

    const bottomSections = document.querySelectorAll("#marketView .pm-market-bottom > section");
    if (bottomSections[0]) {
      setText(bottomSections[0].querySelector(".eyebrow"), c.portfolioContext);
      const labels = [c.quantity, c.averageCost, c.marketValue, c.unrealized];
      bottomSections[0].querySelectorAll(".pm-position-card > span").forEach((node, index) => { if (labels[index]) node.textContent = labels[index]; });
    }
    if (bottomSections[1]) setText(bottomSections[1].querySelector(".eyebrow"), c.systemStatus);
    setText("#pmAddTransaction", c.addTransaction);
    setText("#pmOpenResearch", c.openResearch);
    setText("#pmOpenPortfolio", c.openPortfolio);

    const intervals = byId("pmNativeIntervals");
    intervals?.querySelectorAll("[data-interval]").forEach(button => {
      button.textContent = button.dataset.interval.replace("m", language() === "en" ? " min" : " dk");
    });

    const workspace = window.PiyasaMarketWorkspace;
    const selected = workspace?.getSelected?.();
    if (selected?.key) void workspace.select(selected.key);
    if (window.PiyasaNativeIntraday?.runtime?.active) void window.PiyasaNativeIntraday.refresh();
    applyLiveLanguage();
  }

  function applyPortfolioLanguage() {
    if (typeof window.renderPortfolio === "function") window.renderPortfolio();
    const title = byId("transactionFormTitle");
    const submit = document.querySelector("#transactionForm button[type='submit']");
    if (title) title.textContent = typeof state !== "undefined" && state.editingTransactionId ? t("editTransaction") : t("recordBuySell");
    if (submit) submit.textContent = typeof state !== "undefined" && state.editingTransactionId ? t("updateTransaction") : t("saveTransaction");
    populateSymbolList();
    autofillFromSymbol(false);
  }

  function applyAll() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      applyMarketLanguage();
      applyPortfolioLanguage();
      const panel = byId("globalSearchResults");
      const globalSearch = byId("globalSearch");
      if (panel?.classList.contains("open") && globalSearch?.value.trim()) globalSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }, 0);
  }

  function installLanguageHook() {
    if (window.applyLanguage && !window.applyLanguage.__pmLanguagePortfolioRuntime) {
      const original = window.applyLanguage;
      const wrapped = function applyLanguageWithDynamicModules(...args) {
        const result = original.apply(this, args);
        applyAll();
        return result;
      };
      wrapped.__pmLanguagePortfolioRuntime = true;
      window.applyLanguage = wrapped;
    }
    const toggle = byId("languageToggle");
    if (toggle && toggle.dataset.dynamicLanguageHook !== "1") {
      toggle.dataset.dynamicLanguageHook = "1";
      toggle.addEventListener("click", () => setTimeout(applyAll, 0));
    }
  }

  function install() {
    installLanguageHook();
    bindTransactionForm();
    if (!populateSymbolList()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (populateSymbolList() || attempts >= 80) clearInterval(timer);
      }, 250);
    }
    applyAll();
    window.addEventListener("pm-market-asset-change", () => {
      populateSymbolList();
      if (byId("txSymbol")?.value.trim()) autofillFromSymbol(false);
    });
    setInterval(() => {
      installLanguageHook();
      bindTransactionForm();
    }, 3000);
  }

  window.PiyasaLanguagePortfolioRuntime = {
    apply: applyAll,
    autofill: autofillFromSymbol,
    resolveAsset
  };

  install();
})();
