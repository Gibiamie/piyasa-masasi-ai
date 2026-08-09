(() => {
  "use strict";

  if (window.__PM_MARKET_INTEGRATION_BOOTSTRAP__) return;
  window.__PM_MARKET_INTEGRATION_BOOTSTRAP__ = true;
  window.__PM_MARKET_INTEGRATION__ = true;

  const VERSION = "2026.08.09.28";
  const MODULES = [
    ["./market-core-v2.js", "__PM_MARKET_CORE_V2__"],
    ["./intraday-core.js", "__PM_NATIVE_INTRADAY_CORE__"],
    ["./market-live-session.js", "__PM_MARKET_LIVE_SESSION__"],
    ["./language-portfolio-runtime.js", "__PM_LANGUAGE_PORTFOLIO_RUNTIME__"],
    ["./research-core-v2.js", "__PM_RESEARCH_CORE_V2__"]
  ];

  function syncBrand() {
    const brand = document.querySelector(".brand");
    const mark = document.querySelector(".brand-mark");
    const strong = document.querySelector(".brand-text strong");
    const small = document.querySelector(".brand-text small");

    if (brand) brand.setAttribute("aria-label", "Piyasa Masası AI");
    if (mark) {
      mark.innerHTML = '<img src="./icon.svg?v=brand-20260809" alt="" width="48" height="48">';
      mark.style.width = "48px";
      mark.style.height = "48px";
      mark.style.padding = "0";
      mark.style.background = "transparent";
      mark.style.borderRadius = "13px";
      mark.style.overflow = "hidden";
      mark.style.boxShadow = "0 9px 24px rgba(3,18,14,.20)";
      const image = mark.querySelector("img");
      if (image) {
        image.style.display = "block";
        image.style.width = "48px";
        image.style.height = "48px";
        image.style.objectFit = "cover";
      }
    }
    if (strong) strong.textContent = "Piyasa Masası AI";
    if (small) small.textContent = "Market Intelligence";
  }

  function loadScript(path, marker) {
    if (window[marker]) return Promise.resolve();
    const existing = document.querySelector(`script[data-pm-module="${marker}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window[marker]) { resolve(); return; }
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
    syncBrand();
    for (const [path, marker] of MODULES) await loadScript(path, marker);
    syncBrand();
  }

  start().catch(error => {
    console.error("Piyasa Masası workspace failed to start", error);
    const freshness = document.getElementById("freshness");
    if (freshness) {
      freshness.textContent = document.documentElement.lang === "en" ? "Market module could not be loaded" : "Piyasa modülü yüklenemedi";
      freshness.className = "status-pill warning";
    }
  });
})();
