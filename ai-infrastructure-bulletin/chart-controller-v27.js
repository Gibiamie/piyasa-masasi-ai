(() => {
  "use strict";

  if (window.__PM_CHART_CONTROLLER_V27__) return;
  window.__PM_CHART_CONTROLLER_V27__ = true;

  const FALLBACK_DELAY_MS = 1600;
  const MISSING_DAILY_PATTERN = /Günlük OHLC bulunamadı|Daily OHLC unavailable|MIC işlem içi grafiğini açın|Open MIC intraday/i;
  let pendingTimer = null;
  let pendingVersion = 0;

  const $ = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;

  function workspace() {
    return window.PiyasaMarketWorkspace || null;
  }

  function selectedAsset() {
    return workspace()?.getSelected?.() || null;
  }

  function setSource(source, reason = "") {
    const api = workspace();
    const asset = selectedAsset();
    if (!api?.state || !asset) return false;

    api.state.source = source;
    document.querySelectorAll("#pmSourceTabs [data-source]").forEach(button => {
      button.classList.toggle("active", button.dataset.source === source);
    });

    $("pmDailyWrap")?.classList.toggle("hidden", source === "INTRADAY");
    $("pmIntradayWrap")?.classList.toggle("active", source === "INTRADAY");
    if ($("pmRangeButtons")) $("pmRangeButtons").style.display = source === "INTRADAY" ? "none" : "flex";

    window.dispatchEvent(new CustomEvent("pm-market-source-change", {
      detail: {
        source,
        asset: { ...asset },
        version: api.state.requestVersion,
        reason
      }
    }));

    return true;
  }

  function selectOneMinuteInterval() {
    let attempts = 0;
    const choose = () => {
      attempts += 1;
      const oneMinute = document.querySelector('#pmNativeIntervals [data-interval="1m"]');
      if (oneMinute) {
        oneMinute.click();
        return;
      }
      if (attempts < 20) setTimeout(choose, 100);
    };
    choose();
  }

  function activateIntradayFallback(reason = "daily-history-unavailable") {
    const asset = selectedAsset();
    if (!asset) return false;
    if (!setSource("INTRADAY", reason)) return false;

    const historyStatus = $("pmHistoryStatus");
    if (historyStatus) {
      historyStatus.textContent = T(
        "Günlük geçmiş mevcut değil · MIC işlem içi grafik otomatik açıldı",
        "Daily history unavailable · MIC intraday chart opened automatically"
      );
    }

    window.PiyasaMarketLive?.start?.();
    selectOneMinuteInterval();
    return true;
  }

  function dailyHistoryUnavailable() {
    const api = workspace();
    if (!api?.state || api.state.source !== "DAILY") return false;
    const status = $("pmHistoryStatus")?.textContent || "";
    const message = $("pmChartMessage")?.textContent || "";
    return MISSING_DAILY_PATTERN.test(status) || MISSING_DAILY_PATTERN.test(message);
  }

  function scheduleDailyFallback(version) {
    clearTimeout(pendingTimer);
    pendingVersion = Number(version || workspace()?.state?.requestVersion || 0);
    pendingTimer = setTimeout(() => {
      const api = workspace();
      if (!api?.state || Number(api.state.requestVersion || 0) !== pendingVersion) return;
      if (dailyHistoryUnavailable()) activateIntradayFallback();
    }, FALLBACK_DELAY_MS);
  }

  function bind() {
    window.addEventListener("pm-market-asset-change", event => {
      scheduleDailyFallback(event.detail?.version);
    });

    window.addEventListener("pm-market-source-change", event => {
      if (event.detail?.source === "DAILY") scheduleDailyFallback(event.detail?.version);
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && dailyHistoryUnavailable()) activateIntradayFallback("resume-missing-daily-history");
    });
  }

  window.PiyasaChartController = {
    setSource,
    activateIntradayFallback,
    dailyHistoryUnavailable,
    _test: { MISSING_DAILY_PATTERN, FALLBACK_DELAY_MS }
  };

  bind();
})();
