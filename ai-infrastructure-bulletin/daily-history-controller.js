(() => {
  "use strict";

  if (window.__PM_DAILY_HISTORY_CONTROLLER__) return;
  window.__PM_DAILY_HISTORY_CONTROLLER__ = true;

  const INITIAL_CHECK_MS = 1800;
  const RETRY_MS = 60_000;
  let timer = null;
  let expectedVersion = 0;

  const $ = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const workspace = () => window.PiyasaMarketWorkspace || null;

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function dailySelected() {
    const api = workspace();
    return Boolean(api?.state && api.state.source === "DAILY" && api.getSelected?.());
  }

  function hasHistory() {
    const api = workspace();
    return Array.isArray(api?.state?.history) && api.state.history.length > 1;
  }

  function showWaitingState() {
    const api = workspace();
    const asset = api?.getSelected?.();
    if (!api?.state || !asset || api.state.source !== "DAILY" || hasHistory()) return;

    const status = $("pmHistoryStatus");
    const message = $("pmChartMessage");
    if (status) {
      status.textContent = T(
        `${asset.symbol} günlük OHLC geçmişi hazırlanıyor · Portföy grafiği açık kalacak`,
        `${asset.symbol} daily OHLC history is being prepared · Portfolio chart will remain open`
      );
    }
    if (message) {
      message.style.display = "grid";
      message.textContent = T(
        "Günlük fiyat geçmişi henüz hazır değil. Veri oluştuğunda grafik otomatik yüklenecek.",
        "Daily price history is not ready yet. The chart will load automatically when the data becomes available."
      );
    }
  }

  async function retry(version) {
    stopTimer();
    const api = workspace();
    const asset = api?.getSelected?.();
    if (!api?.state || !asset || api.state.source !== "DAILY") return;
    if (hasHistory()) return;
    if (version && Number(api.state.requestVersion || 0) !== Number(version)) return;

    expectedVersion = Number(api.state.requestVersion || 0);
    showWaitingState();
    try {
      await api.select?.(asset.key, true);
    } catch (_) {}

    if (!dailySelected() || hasHistory()) return;
    expectedVersion = Number(api.state.requestVersion || 0);
    showWaitingState();
    timer = setTimeout(() => retry(expectedVersion), RETRY_MS);
  }

  function schedule(version, delay = INITIAL_CHECK_MS) {
    stopTimer();
    expectedVersion = Number(version || workspace()?.state?.requestVersion || 0);
    timer = setTimeout(() => {
      if (!dailySelected() || hasHistory()) return;
      retry(expectedVersion);
    }, delay);
  }

  function bind() {
    window.addEventListener("pm-market-asset-change", event => {
      if (workspace()?.state?.source === "DAILY") schedule(event.detail?.version);
      else stopTimer();
    });

    window.addEventListener("pm-market-source-change", event => {
      if (event.detail?.source === "DAILY") schedule(event.detail?.version, 250);
      else stopTimer();
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && dailySelected() && !hasHistory()) schedule(null, 250);
    });
  }

  window.PiyasaDailyHistory = {
    retry: () => retry(Number(workspace()?.state?.requestVersion || 0)),
    hasHistory,
    showWaitingState,
    _test: { INITIAL_CHECK_MS, RETRY_MS }
  };

  bind();
})();
