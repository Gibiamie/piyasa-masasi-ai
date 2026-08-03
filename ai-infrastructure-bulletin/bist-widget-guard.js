(() => {
  "use strict";

  if (window.__PM_BIST_WIDGET_GUARD__) return;
  window.__PM_BIST_WIDGET_GUARD__ = true;

  let originalSourceHandler = null;
  let guardMode = false;
  let noticeTimer = null;

  const byId = id => document.getElementById(id);
  const tr = () => document.documentElement.lang !== "en";
  const label = (trText, enText) => tr() ? trText : enText;

  function selectedSymbol() {
    const active = document.querySelector(".pm-asset-row.active[data-pm-symbol]");
    if (active?.dataset.pmSymbol) return active.dataset.pmSymbol.trim().toUpperCase().replace(/\.IS$/, "");
    return String(byId("pmAssetTitle")?.textContent || "").split("·")[0].trim().toUpperCase().replace(/\.IS$/, "");
  }

  function isBistSelected() {
    const subtitle = String(byId("pmAssetSubtitle")?.textContent || "").trim().toUpperCase();
    return subtitle === "BIST" || subtitle.startsWith("BIST ·") || subtitle.startsWith("BIST ");
  }

  function tradingViewUrl() {
    const symbol = selectedSymbol();
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`BIST:${symbol}`)}`;
  }

  function injectStyles() {
    if (byId("pm-bist-widget-guard-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-bist-widget-guard-styles";
    style.textContent = `
      .pm-bist-widget-notice{display:none;margin-top:10px;padding:12px 14px;border:1px solid #dfc98f;border-radius:12px;background:#fff7df;color:#5b4a1e;font-size:.74rem;line-height:1.5}
      .pm-bist-widget-notice.show{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .pm-bist-widget-notice strong{display:block;margin-bottom:3px;color:#3d3217}
      .pm-bist-widget-notice-actions{display:flex;gap:8px;flex-wrap:wrap}
      .pm-bist-widget-notice .button{min-height:34px;padding:6px 10px;font-size:.7rem;background:#fffdf8}
      .pm-bist-widget-notice .button.primary{background:var(--pine);color:#fff}
      #pmSourceTabs button[data-source="TV"].bist-limited{border:1px dashed #b9974d;color:#80651f;background:#fff8e5}
      #pmSourceTabs button[data-source="TV"].bist-limited.active{background:#fff8e5;color:#80651f}
    `;
    document.head.appendChild(style);
  }

  function ensureNotice() {
    let notice = byId("pmBistWidgetNotice");
    if (notice) return notice;
    const toolbar = document.querySelector(".pm-market-toolbar");
    if (!toolbar) return null;
    notice = document.createElement("div");
    notice.id = "pmBistWidgetNotice";
    notice.className = "pm-bist-widget-notice";
    toolbar.insertAdjacentElement("afterend", notice);
    return notice;
  }

  function hideNotice() {
    const notice = byId("pmBistWidgetNotice");
    if (notice) notice.classList.remove("show");
    clearTimeout(noticeTimer);
  }

  function showBistNotice() {
    const tabs = byId("pmSourceTabs");
    const micButton = tabs?.querySelector('[data-source="MIC"]');
    const tvButton = tabs?.querySelector('[data-source="TV"]');

    // Reset the private integration state to MIC without calling the guarded handler.
    if (originalSourceHandler && micButton) originalSourceHandler({ target: micButton });
    guardMode = true;

    // Keep the working, application-native OHLC graph visible.
    byId("pmCustomWrap")?.classList.remove("hidden");
    byId("pmTvWrap")?.classList.remove("active");
    if (byId("pmTvWrap")) byId("pmTvWrap").innerHTML = "";
    micButton?.classList.add("active");
    tvButton?.classList.remove("active");

    const symbol = selectedSymbol() || "BIST";
    const price = byId("pmAssetPrice")?.textContent || "—";
    const status = byId("pmDataStatus")?.textContent || "—";
    const source = byId("pmSourceStatus")?.textContent || "—";
    const notice = ensureNotice();
    if (!notice) return;
    notice.innerHTML = `
      <div><strong>${label("BIST işlem içi grafik bu widget içinde kullanılamıyor", "BIST intraday chart is unavailable inside this widget")}</strong>
      ${label("TradingView, BIST sembollerini gömülü grafikte lisans nedeniyle engelliyor. Uygulama boş veya hatalı ekran yerine kendi günlük OHLC grafiğini göstermeye devam ediyor.", "TradingView restricts BIST symbols in embedded charts for licensing reasons. The application keeps its native daily OHLC chart visible instead of showing a broken screen.")}
      <br>${symbol} · ${price} · ${status}<br><span style="opacity:.75">${source}</span></div>
      <div class="pm-bist-widget-notice-actions">
        <button id="pmDismissBistNotice" class="button primary" type="button">${label("Grafikte kal", "Stay on chart")}</button>
        <a class="button" href="${tradingViewUrl()}" target="_blank" rel="noopener noreferrer">${label("TradingView’de harici aç", "Open externally in TradingView")}</a>
      </div>`;
    notice.classList.add("show");
    byId("pmDismissBistNotice")?.addEventListener("click", hideNotice, { once: true });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(hideNotice, 12000);
  }

  function updateTruthfulCopy() {
    const tvButton = byId("pmSourceTabs")?.querySelector('[data-source="TV"]');
    if (!tvButton) return;

    const bist = isBistSelected();
    tvButton.classList.toggle("bist-limited", bist);
    tvButton.textContent = bist
      ? label("BIST işlem içi durumu", "BIST intraday status")
      : label("TradingView işlem içi", "TradingView intraday");
    tvButton.title = bist
      ? label("Gömülü TradingView BIST lisansı mevcut değil; günlük OHLC grafiği korunur.", "Embedded TradingView BIST licensing is unavailable; the daily OHLC chart remains visible.")
      : "";

    const note = byId("pmStatusNote");
    if (bist && note && !note.textContent.includes("gömülü BIST")) {
      const base = note.textContent.replace(/Portföy grafiği günlük OHLC[^.]*\.\s*TradingView sekmesi işlem içi grafiği gösterir\.?/i, "Portföy grafiği günlük OHLC, maliyet çizgisi ve alış/satış noktalarını gösterir.");
      note.textContent = `${base} ${label("TradingView’in gömülü BIST grafiği lisans kısıtı nedeniyle devre dışıdır.", "The embedded TradingView BIST chart is disabled because of licensing restrictions.")}`.trim();
    }

    const message = byId("pmChartMessage");
    if (bist && message && /TradingView/i.test(message.textContent)) {
      message.textContent = label("Bu hisse için MIC günlük OHLC geçmişi mevcut değil.", "MIC daily OHLC history is unavailable for this equity.");
    }

    if (bist && tvButton.classList.contains("active")) showBistNotice();
    if (!bist && guardMode && tvButton.classList.contains("active") && originalSourceHandler) {
      guardMode = false;
      hideNotice();
      originalSourceHandler({ target: tvButton });
    }
  }

  function bindGuard() {
    injectStyles();
    ensureNotice();
    const tabs = byId("pmSourceTabs");
    if (!tabs || tabs.dataset.bistWidgetGuard === "1") return false;

    tabs.dataset.bistWidgetGuard = "1";
    originalSourceHandler = tabs.onclick;
    tabs.onclick = event => {
      const button = event.target.closest("[data-source]");
      if (!button) return;
      if (button.dataset.source === "TV" && isBistSelected()) {
        event.preventDefault();
        event.stopPropagation();
        showBistNotice();
        return;
      }
      guardMode = false;
      hideNotice();
      if (originalSourceHandler) originalSourceHandler.call(tabs, event);
    };
    updateTruthfulCopy();
    return true;
  }

  function start() {
    if (!bindGuard()) {
      setTimeout(start, 80);
      return;
    }

    const observed = [byId("pmAssetTitle"), byId("pmAssetSubtitle"), byId("pmStatusNote"), byId("pmChartMessage")].filter(Boolean);
    const observer = new MutationObserver(() => queueMicrotask(updateTruthfulCopy));
    observed.forEach(node => observer.observe(node, { childList: true, subtree: true, characterData: true }));
    setInterval(updateTruthfulCopy, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();