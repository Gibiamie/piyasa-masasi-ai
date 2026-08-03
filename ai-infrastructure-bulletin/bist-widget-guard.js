(() => {
  "use strict";

  if (window.__PM_BIST_NATIVE_INTRADAY__) return;
  window.__PM_BIST_NATIVE_INTRADAY__ = true;

  const REFRESH_MS = 30_000;
  const REQUEST_TIMEOUT_MS = 12_000;
  const INTERVALS = {
    "1m": { range: "1d", labelTr: "1 dk", labelEn: "1 min" },
    "5m": { range: "5d", labelTr: "5 dk", labelEn: "5 min" },
    "15m": { range: "1mo", labelTr: "15 dk", labelEn: "15 min" }
  };

  const state = {
    active: false,
    interval: "5m",
    rows: [],
    meta: null,
    loading: false,
    error: null,
    requestId: 0,
    refreshTimer: null,
    originalSourceHandler: null,
    observedSymbol: ""
  };

  const byId = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const text = (tr, en) => language() === "en" ? en : tr;
  const numeric = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);

  function selectedSymbol() {
    const active = document.querySelector("#pmAssetList .pm-asset-row.active[data-pm-symbol]");
    const raw = active?.dataset.pmSymbol || String(byId("pmAssetTitle")?.textContent || "").split("·")[0];
    return String(raw || "").trim().toUpperCase().replace(/\.IS$/, "");
  }

  function isBistSelected() {
    const subtitle = String(byId("pmAssetSubtitle")?.textContent || "").trim().toUpperCase();
    return subtitle === "BIST" || subtitle.startsWith("BIST ·") || subtitle.startsWith("BIST ");
  }

  function providerSymbol() {
    const symbol = selectedSymbol();
    return symbol ? `${symbol}.IS` : "";
  }

  function locale() {
    return language() === "en" ? "en-GB" : "tr-TR";
  }

  function formatMoney(value) {
    const number = numeric(value);
    if (number === null) return "—";
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: number >= 100 ? 2 : 4
    }).format(number);
  }

  function formatPercent(value) {
    const number = numeric(value);
    if (number === null) return "—";
    return `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale(), {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Europe/Istanbul"
    }).format(date);
  }

  function timeoutSignal() {
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    return controller.signal;
  }

  async function readJson(url, proxy = false) {
    const target = proxy ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` : url;
    const response = await fetch(target, {
      cache: "no-store",
      signal: timeoutSignal(),
      headers: { Accept: "application/json,text/plain,*/*" }
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function fetchYahooChart(symbol, interval) {
    const config = INTERVALS[interval] || INTERVALS["5m"];
    const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(config.range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=false`;
    const candidates = [base, base.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com")];
    let lastError = null;
    for (const candidate of candidates) {
      for (const proxy of [false, true]) {
        try { return await readJson(candidate, proxy); }
        catch (error) { lastError = error; }
      }
    }
    throw lastError || new Error("INTRADAY_FETCH_FAILED");
  }

  function parseChart(payload) {
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_INTRADAY_CHART");
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote = result.indicators?.quote?.[0] || {};
    const rows = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const close = numeric(quote.close?.[index]);
      if (close === null) continue;
      rows.push({
        time: Number(timestamps[index]) * 1000,
        open: numeric(quote.open?.[index]) ?? close,
        high: numeric(quote.high?.[index]) ?? close,
        low: numeric(quote.low?.[index]) ?? close,
        close,
        volume: numeric(quote.volume?.[index]) || 0
      });
    }
    if (!rows.length) throw new Error("EMPTY_INTRADAY_ROWS");
    const meta = result.meta || {};
    return {
      rows,
      meta: {
        symbol: meta.symbol || providerSymbol(),
        price: numeric(meta.regularMarketPrice) ?? rows.at(-1).close,
        previousClose: numeric(meta.chartPreviousClose ?? meta.previousClose),
        marketTime: (numeric(meta.regularMarketTime) || rows.at(-1).time / 1000) * 1000,
        delayMinutes: Math.max(0, numeric(meta.exchangeDataDelayedBy) || 0),
        marketState: meta.marketState || "UNKNOWN",
        exchange: meta.fullExchangeName || meta.exchangeName || "Borsa Istanbul",
        source: "MIC browser feed · Yahoo Finance chart"
      }
    };
  }

  function injectStyles() {
    if (byId("pm-bist-native-intraday-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-bist-native-intraday-styles";
    style.textContent = `
      .pm-bist-intervals{display:none}.pm-bist-intervals.active{display:flex}
      .pm-native-intraday{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0b1d1a;color:#e7f0ec}
      .pm-native-intraday-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.12);background:#102722}
      .pm-native-intraday-head strong{font-size:.82rem}.pm-native-intraday-meta{display:flex;gap:8px;flex-wrap:wrap;color:#a9bbb4;font-size:.68rem}
      .pm-native-intraday-status{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;background:rgba(99,214,173,.12);color:#82dfbd;font-weight:750}
      .pm-native-intraday-status.delayed{background:rgba(231,199,143,.13);color:#e7c78f}.pm-native-intraday-status.error{background:rgba(239,118,111,.13);color:#ef8d87}
      .pm-native-intraday-chart{position:relative;min-height:390px}.pm-native-intraday-chart canvas{display:block;width:100%;height:100%}
      .pm-native-intraday-loading{position:absolute;inset:0;display:grid;place-items:center;padding:30px;text-align:center;color:#b4c3bd;background:#0b1d1a}
      .pm-native-intraday-loading button{margin-top:12px}
      .pm-native-intraday-tooltip{position:absolute;display:none;pointer-events:none;min-width:190px;padding:9px 11px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.96);color:#edf4ef;font-size:.7rem;line-height:1.55;box-shadow:0 12px 35px rgba(0,0,0,.28)}
      .pm-native-intraday-foot{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.12);background:#102722}
      .pm-native-intraday-stat{padding:9px 12px;border-right:1px solid rgba(255,255,255,.1)}.pm-native-intraday-stat:last-child{border-right:0}
      .pm-native-intraday-stat span,.pm-native-intraday-stat strong{display:block}.pm-native-intraday-stat span{color:#91a8a0;font-size:.62rem}.pm-native-intraday-stat strong{margin-top:3px;font-size:.76rem}
      #pmSourceTabs button[data-source="TV"].pm-bist-native{border-color:#4f7b6c;background:#e6efe9;color:#173a33}
      @media(max-width:720px){.pm-native-intraday-chart{min-height:340px}.pm-native-intraday-foot{grid-template-columns:1fr 1fr}.pm-native-intraday-stat:nth-child(2){border-right:0}.pm-native-intraday-stat:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.1)}}
    `;
    document.head.appendChild(style);
  }

  function ensureIntervalControls() {
    let controls = byId("pmBistIntervals");
    if (controls) return controls;
    const ranges = byId("pmRangeButtons");
    if (!ranges) return null;
    controls = document.createElement("div");
    controls.id = "pmBistIntervals";
    controls.className = "pm-segmented pm-bist-intervals";
    controls.innerHTML = Object.entries(INTERVALS).map(([value, config]) => `
      <button type="button" data-bist-interval="${value}" class="${value === state.interval ? "active" : ""}">${language() === "en" ? config.labelEn : config.labelTr}</button>`).join("");
    ranges.before(controls);
    controls.onclick = event => {
      const button = event.target.closest("[data-bist-interval]");
      if (!button) return;
      state.interval = button.dataset.bistInterval;
      controls.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      loadIntraday(true);
    };
    return controls;
  }

  function chartMode() {
    return byId("pmModeButtons")?.querySelector("[data-mode].active")?.dataset.mode === "LINE" ? "LINE" : "CANDLE";
  }

  function currentQuote() {
    const runtime = window.PiyasaLiveMarket?.runtime;
    const symbol = selectedSymbol();
    if (!runtime?.quotes || !symbol) return null;
    return runtime.quotes.get(`${symbol}.IS`) || runtime.quotes.get(symbol) || [...runtime.quotes.values()].find(quote => String(quote.symbol || "").replace(/\.IS$/, "") === symbol) || null;
  }

  function statusLabel(meta) {
    const delay = numeric(meta?.delayMinutes) || 0;
    if (delay > 0) return text(`${delay} dk kaynak gecikmesi`, `${delay}-min source delay`);
    const age = meta?.marketTime ? Math.max(0, Date.now() - meta.marketTime) : Infinity;
    if (age <= 120_000) return text("Yakın zamanlı", "Near real time");
    return text("Son işlem verisi", "Last trade data");
  }

  function renderShell() {
    const container = byId("pmTvWrap");
    if (!container) return null;
    container.innerHTML = `
      <div class="pm-native-intraday">
        <div class="pm-native-intraday-head">
          <strong id="pmNativeIntradayTitle">${escapeHtml(selectedSymbol())} · ${text("MIC işlem içi", "MIC intraday")}</strong>
          <div class="pm-native-intraday-meta"><span id="pmNativeIntradayBadge" class="pm-native-intraday-status">${text("Yükleniyor", "Loading")}</span><span id="pmNativeIntradaySource">—</span><span id="pmNativeIntradayTime">—</span></div>
        </div>
        <div class="pm-native-intraday-chart"><canvas id="pmNativeIntradayCanvas"></canvas><div id="pmNativeIntradayLoading" class="pm-native-intraday-loading">${text("İşlem içi veri yükleniyor…", "Loading intraday data…")}</div><div id="pmNativeIntradayTooltip" class="pm-native-intraday-tooltip"></div></div>
        <div id="pmNativeIntradayFoot" class="pm-native-intraday-foot"></div>
      </div>`;
    const canvas = byId("pmNativeIntradayCanvas");
    canvas?.addEventListener("mousemove", handleHover);
    canvas?.addEventListener("mouseleave", clearHover);
    return container;
  }

  function updateMainQuote(parsed) {
    const quote = currentQuote();
    const price = numeric(quote?.price) ?? numeric(parsed?.meta?.price) ?? parsed?.rows?.at(-1)?.close;
    const previous = numeric(quote?.previousClose) ?? numeric(parsed?.meta?.previousClose);
    const changePercent = numeric(quote?.changePercent) ?? (previous && price ? (price / previous - 1) * 100 : null);
    if (numeric(price) !== null) byId("pmAssetPrice").textContent = formatMoney(price);
    if (numeric(changePercent) !== null) {
      const node = byId("pmAssetChange");
      if (node) {
        node.textContent = `${formatPercent(changePercent)} · ${text("30 sn kontrol", "30-sec check")}`;
        node.className = `pm-market-change ${changePercent > 0 ? "up" : changePercent < 0 ? "down" : ""}`;
      }
      const oneDay = byId("pm1d");
      if (oneDay) { oneDay.textContent = formatPercent(changePercent); oneDay.className = changePercent > 0 ? "up" : changePercent < 0 ? "down" : ""; }
    }
    const status = byId("pmDataStatus");
    if (status) status.textContent = `${INTERVALS[state.interval][language() === "en" ? "labelEn" : "labelTr"]} · ${text("30 sn kontrol", "30-sec check")}`;
    const source = byId("pmSourceStatus");
    if (source && parsed?.meta) source.textContent = `${parsed.meta.source} · ${formatDateTime(parsed.meta.marketTime)} · ${statusLabel(parsed.meta)}`;
  }

  function showLoading(message, retry = false) {
    const loading = byId("pmNativeIntradayLoading");
    if (!loading) return;
    loading.style.display = "grid";
    loading.innerHTML = retry
      ? `<div><strong>${escapeHtml(message)}</strong><br><button id="pmNativeIntradayRetry" class="button" type="button">${text("Yeniden dene", "Retry")}</button></div>`
      : escapeHtml(message);
    byId("pmNativeIntradayRetry")?.addEventListener("click", () => loadIntraday(true), { once: true });
  }

  async function loadIntraday(force = false) {
    if (!state.active || !isBistSelected()) return;
    const symbol = providerSymbol();
    if (!symbol || state.loading) return;
    const requestId = ++state.requestId;
    state.loading = true;
    state.error = null;
    if (!byId("pmNativeIntradayCanvas")) renderShell();
    showLoading(text("İşlem içi veri yükleniyor…", "Loading intraday data…"));
    try {
      const parsed = parseChart(await fetchYahooChart(symbol, state.interval));
      if (requestId !== state.requestId) return;
      state.rows = parsed.rows;
      state.meta = parsed.meta;
      const loading = byId("pmNativeIntradayLoading");
      if (loading) loading.style.display = "none";
      const badge = byId("pmNativeIntradayBadge");
      if (badge) {
        badge.textContent = statusLabel(parsed.meta);
        badge.className = `pm-native-intraday-status ${parsed.meta.delayMinutes > 0 ? "delayed" : ""}`;
      }
      if (byId("pmNativeIntradaySource")) byId("pmNativeIntradaySource").textContent = parsed.meta.source;
      if (byId("pmNativeIntradayTime")) byId("pmNativeIntradayTime").textContent = `${text("Son bar", "Last bar")}: ${formatDateTime(parsed.rows.at(-1).time)}`;
      if (byId("pmNativeIntradayTitle")) byId("pmNativeIntradayTitle").textContent = `${selectedSymbol()} · ${INTERVALS[state.interval][language() === "en" ? "labelEn" : "labelTr"]}`;
      updateMainQuote(parsed);
      drawChart();
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.error = error;
      state.rows = [];
      const badge = byId("pmNativeIntradayBadge");
      if (badge) { badge.textContent = text("Veri alınamadı", "Data unavailable"); badge.className = "pm-native-intraday-status error"; }
      showLoading(text("İşlem içi veri geçici olarak alınamadı.", "Intraday data is temporarily unavailable."), true);
    } finally {
      if (requestId === state.requestId) state.loading = false;
    }
  }

  function drawChart() {
    const canvas = byId("pmNativeIntradayCanvas");
    const rows = state.rows;
    if (!canvas || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    const padding = { left: 62, right: 18, top: 22, bottom: 58 };
    const width = rect.width - padding.left - padding.right;
    const height = rect.height - padding.top - padding.bottom;
    const priceHeight = height * .8;
    const volumeTop = padding.top + height * .85;
    const volumeHeight = height * .13;
    const values = rows.flatMap(row => [row.high, row.low]).filter(Number.isFinite);
    let minimum = Math.min(...values), maximum = Math.max(...values);
    if (minimum === maximum) { minimum -= 1; maximum += 1; }
    const margin = (maximum - minimum) * .06;
    minimum -= margin; maximum += margin;
    const maximumVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => padding.left + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
    const y = value => padding.top + (maximum - value) * priceHeight / (maximum - minimum);

    context.font = "11px system-ui";
    context.fillStyle = "#91a8a0";
    context.strokeStyle = "rgba(160,190,180,.15)";
    context.lineWidth = 1;
    for (let index = 0; index <= 5; index += 1) {
      const yy = padding.top + index * priceHeight / 5;
      const value = maximum - index * (maximum - minimum) / 5;
      context.beginPath(); context.moveTo(padding.left, yy); context.lineTo(rect.width - padding.right, yy); context.stroke();
      context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4);
    }

    rows.forEach((row, index) => {
      const barHeight = (row.volume || 0) / maximumVolume * volumeHeight;
      context.fillStyle = "rgba(124,165,151,.25)";
      context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - barHeight, 3, barHeight);
    });

    if (chartMode() === "LINE") {
      context.strokeStyle = "#8ecab4";
      context.lineWidth = 2;
      context.beginPath();
      rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close)));
      context.stroke();
    } else {
      const candleWidth = Math.max(1, Math.min(8, width / Math.max(rows.length, 1) * .62));
      rows.forEach((row, index) => {
        const rising = row.close >= row.open;
        const xx = x(index);
        context.strokeStyle = rising ? "#63d6ad" : "#ef766f";
        context.fillStyle = context.strokeStyle;
        context.beginPath(); context.moveTo(xx, y(row.high)); context.lineTo(xx, y(row.low)); context.stroke();
        const top = Math.min(y(row.open), y(row.close));
        context.fillRect(xx - candleWidth / 2, top, candleWidth, Math.max(1, Math.abs(y(row.open) - y(row.close))));
      });
    }

    const tickCount = Math.min(6, rows.length);
    context.fillStyle = "#91a8a0";
    for (let index = 0; index < tickCount; index += 1) {
      const rowIndex = Math.round(index * (rows.length - 1) / Math.max(1, tickCount - 1));
      const date = new Date(rows[rowIndex].time);
      const label = new Intl.DateTimeFormat(locale(), state.interval === "15m" ? { day: "2-digit", month: "2-digit", hour: "2-digit" } : { hour: "2-digit", minute: "2-digit" }).format(date);
      context.fillText(label, Math.max(padding.left, x(rowIndex) - 25), rect.height - 18);
    }

    const first = rows[0].close, last = rows.at(-1).close;
    const periodReturn = first ? (last / first - 1) * 100 : null;
    const high = Math.max(...rows.map(row => row.high));
    const low = Math.min(...rows.map(row => row.low));
    const foot = byId("pmNativeIntradayFoot");
    if (foot) foot.innerHTML = `
      <div class="pm-native-intraday-stat"><span>${text("Dönem getirisi", "Period return")}</span><strong>${formatPercent(periodReturn)}</strong></div>
      <div class="pm-native-intraday-stat"><span>${text("Yüksek", "High")}</span><strong>${formatMoney(high)}</strong></div>
      <div class="pm-native-intraday-stat"><span>${text("Düşük", "Low")}</span><strong>${formatMoney(low)}</strong></div>
      <div class="pm-native-intraday-stat"><span>${text("Son hacim", "Last volume")}</span><strong>${Math.round(rows.at(-1).volume || 0).toLocaleString(locale())}</strong></div>`;
  }

  function handleHover(event) {
    const canvas = byId("pmNativeIntradayCanvas");
    const tooltip = byId("pmNativeIntradayTooltip");
    if (!canvas || !tooltip || !state.rows.length) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width - 80;
    const localX = event.clientX - rect.left;
    const index = Math.max(0, Math.min(state.rows.length - 1, Math.round((localX - 62) / width * (state.rows.length - 1))));
    const row = state.rows[index];
    tooltip.innerHTML = `<strong>${escapeHtml(formatDateTime(row.time))}</strong><br>O ${formatMoney(row.open)} · H ${formatMoney(row.high)}<br>L ${formatMoney(row.low)} · C ${formatMoney(row.close)}<br>${text("Hacim", "Volume")}: ${Math.round(row.volume || 0).toLocaleString(locale())}`;
    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(rect.width - 205, Math.max(8, localX + 12))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 85)}px`;
  }

  function clearHover() {
    const tooltip = byId("pmNativeIntradayTooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  function activateIntraday() {
    if (!isBistSelected()) return;
    const tabs = byId("pmSourceTabs");
    const micButton = tabs?.querySelector('[data-source="MIC"]');
    const tvButton = tabs?.querySelector('[data-source="TV"]');
    if (state.originalSourceHandler && micButton) state.originalSourceHandler({ target: micButton });
    state.active = true;
    micButton?.classList.remove("active");
    tvButton?.classList.add("active");
    byId("pmCustomWrap")?.classList.add("hidden");
    byId("pmTvWrap")?.classList.add("active");
    if (byId("pmRangeButtons")) byId("pmRangeButtons").style.display = "none";
    ensureIntervalControls()?.classList.add("active");
    renderShell();
    loadIntraday(true);
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => loadIntraday(true), REFRESH_MS);
  }

  function deactivateIntraday() {
    state.active = false;
    state.requestId += 1;
    state.loading = false;
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
    ensureIntervalControls()?.classList.remove("active");
    if (byId("pmRangeButtons")) byId("pmRangeButtons").style.display = "flex";
    const container = byId("pmTvWrap");
    if (container) container.innerHTML = "";
  }

  function updateSourceButton() {
    const tabs = byId("pmSourceTabs");
    const tvButton = tabs?.querySelector('[data-source="TV"]');
    if (!tvButton) return;
    const bist = isBistSelected();
    tvButton.classList.toggle("pm-bist-native", bist);
    tvButton.textContent = bist ? text("MIC işlem içi", "MIC intraday") : text("TradingView işlem içi", "TradingView intraday");
    tvButton.title = bist ? text("Uygulama içi 1, 5 ve 15 dakikalık BIST grafiği", "In-app 1, 5 and 15-minute BIST chart") : "";
    if (state.active && !bist) {
      deactivateIntraday();
      const micButton = tabs.querySelector('[data-source="MIC"]');
      if (state.originalSourceHandler && micButton) state.originalSourceHandler({ target: micButton });
    }
    if (state.active && bist) {
      const symbol = selectedSymbol();
      if (symbol && symbol !== state.observedSymbol) {
        state.observedSymbol = symbol;
        renderShell();
        loadIntraday(true);
      }
    }
  }

  function bind() {
    injectStyles();
    const tabs = byId("pmSourceTabs");
    if (!tabs || tabs.dataset.pmBistNative === "1") return false;
    tabs.dataset.pmBistNative = "1";
    state.originalSourceHandler = tabs.onclick;
    tabs.onclick = event => {
      const button = event.target.closest("[data-source]");
      if (!button) return;
      if (button.dataset.source === "TV" && isBistSelected()) {
        event.preventDefault();
        event.stopPropagation();
        activateIntraday();
        return;
      }
      if (state.active) deactivateIntraday();
      if (state.originalSourceHandler) state.originalSourceHandler.call(tabs, event);
    };

    byId("pmModeButtons")?.addEventListener("click", () => {
      if (state.active) setTimeout(drawChart, 0);
    });
    window.addEventListener("resize", () => { if (state.active) drawChart(); });

    const observed = [byId("pmAssetTitle"), byId("pmAssetSubtitle")].filter(Boolean);
    const observer = new MutationObserver(() => queueMicrotask(updateSourceButton));
    observed.forEach(node => observer.observe(node, { childList: true, subtree: true, characterData: true }));
    updateSourceButton();
    return true;
  }

  function start() {
    if (!bind()) { setTimeout(start, 80); return; }
    setInterval(updateSourceButton, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
