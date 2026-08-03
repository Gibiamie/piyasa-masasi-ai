(() => {
  "use strict";

  if (window.__PM_MARKET_INTEGRATION_BOOTSTRAP__) return;
  window.__PM_MARKET_INTEGRATION_BOOTSTRAP__ = true;
  window.__PM_MARKET_INTEGRATION__ = true;

  const VERSION = "2026.08.04.2";
  const modules = [
    ["./market-workspace-core.js", "__PM_MARKET_WORKSPACE_CORE__"],
    ["./native-intraday-core.js", "__PM_NATIVE_INTRADAY_CORE__"],
    ["./workspace-enhancements.js", "__PM_WORKSPACE_ENHANCEMENTS__"],
    ["./market-live-bridge.js", "__PM_LIVE_MARKET_BRIDGE__"],
    ["./chart-fetch-fallback.js", "__PIYASA_CHART_FETCH_FALLBACK__"],
    ["./live-market.js", "__PIYASA_LIVE_MARKET_BOOTSTRAP__"],
    ["./live-session-control.js", "__PM_LIVE_SESSION_CONTROL__"]
  ];

  function loadScript(path, marker) {
    if (window[marker]) return Promise.resolve();
    const existing = document.querySelector(`script[data-pm-module="${marker}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error(`MODULE_LOAD_FAILED:${path}`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${path}?v=${VERSION}`;
      script.async = false;
      script.dataset.pmModule = marker;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`MODULE_LOAD_FAILED:${path}`));
      document.head.appendChild(script);
    });
  }

  async function waitForApplication() {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (document.getElementById("briefingView") && typeof window.navigate === "function" && typeof window.renderPortfolio === "function") return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error("APPLICATION_NOT_READY");
  }

  async function start() {
    await waitForApplication();
    for (const [path, marker] of modules) await loadScript(path, marker);
  }

  start().catch(error => {
    console.error("Piyasa Masası market workspace failed to start", error);
    const freshness = document.getElementById("freshness");
    if (freshness) {
      freshness.textContent = "Piyasa modülü yüklenemedi";
      freshness.className = "status-pill warning";
    }
  });
})();
