(function bootstrapPiyasaLiveMarket(root) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = require("./live-market-core.js");
    return;
  }

  if (root.__PIYASA_LIVE_MARKET_BOOTSTRAP__) return;
  root.__PIYASA_LIVE_MARKET_BOOTSTRAP__ = true;

  let preparedPromise = null;
  let corePromise = null;

  function ready() {
    return Boolean(document.getElementById("interactiveControlsStyles"))
      && typeof root.openAssetDrawer === "function"
      && typeof root.renderPortfolio === "function"
      && typeof root.renderWatchlist === "function";
  }

  function waitUntilReady() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts += 1;
        if (ready()) { resolve(); return; }
        if (attempts >= 400) { reject(new Error("APPLICATION_CONTROLS_NOT_READY")); return; }
        setTimeout(check, 50);
      };
      check();
    });
  }

  function attributeName(marker) {
    return `data-${String(marker).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
  }

  function loadScript(src, marker, isReady) {
    if (isReady()) return Promise.resolve();
    const attribute = attributeName(marker);
    const existing = document.querySelector(`script[${attribute}]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (isReady()) { resolve(); return; }
        existing.addEventListener("load", () => isReady() ? resolve() : reject(new Error(`SCRIPT_NOT_READY:${src}`)), { once: true });
        existing.addEventListener("error", () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute(attribute, "true");
      script.onload = () => isReady() ? resolve() : reject(new Error(`SCRIPT_NOT_READY:${src}`));
      script.onerror = () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`));
      document.head.appendChild(script);
    });
  }

  async function prepare() {
    if (preparedPromise) return preparedPromise;
    preparedPromise = (async () => {
      await waitUntilReady();
      root.__PM_DRAWER_BRIDGE__ = true;

      await loadScript(
        "./market-integration.js?v=2026.08.04.1",
        "marketIntegration",
        () => Boolean(root.__PM_MARKET_INTEGRATION__)
      );

      await loadScript(
        "./market-live-bridge.js?v=2026.08.04.1",
        "marketLiveBridge",
        () => Boolean(root.__PM_LIVE_MARKET_BRIDGE__)
      );

      await loadScript(
        "./chart-fetch-fallback.js?v=2026.08.04.1",
        "chartFetchFallback",
        () => Boolean(root.__PIYASA_CHART_FETCH_FALLBACK__)
      );
    })();
    return preparedPromise;
  }

  async function startCore() {
    if (corePromise) return corePromise;
    corePromise = (async () => {
      await prepare();
      await loadScript(
        "./live-market-core.js?v=2026.08.04.1",
        "liveMarketCore",
        () => Boolean(root.PiyasaLiveMarket)
      );
      return root.PiyasaLiveMarket;
    })();
    return corePromise;
  }

  root.PiyasaLiveBootstrap = { prepare, startCore };
  prepare().catch(error => console.error("Piyasa live-market preparation failed", error));
})(typeof globalThis !== "undefined" ? globalThis : this);

// CI verification branch only.
