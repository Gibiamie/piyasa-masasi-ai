(() => {
  "use strict";

  if (window.__PM_NATIVE_INTRADAY_CORE__) return;
  window.__PM_NATIVE_INTRADAY_CORE__ = true;

  const INTERVALS = { "1m": "1d", "5m": "5d", "15m": "1mo" };
  const REFRESH_MS = 30_000;
  const runtime = {
    active: false,
    interval: "5m",
    asset: null,
    rows: [],
    meta: null,
    mode: "CANDLE",
    requestId: 0,
    controller: null,
    timer: null
  };

  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const text = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const providerSymbol = asset => asset?.market === "BIST" ? `${String(asset.symbol || "").replace(/\.IS$/i, "")}.IS` : String(asset?.symbol || "").replace(/\.IS$/i, "");
  const currency = () => runtime.asset?.currency || (runtime.asset?.market === "BIST" ? "TRY" : "USD");
  const money = value => {
    const number = finite(value);
    if (number === null) return "—";
    return new Intl.NumberFormat(locale(), { style: "currency", currency: currency(), maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number);
  };
  const percent = value => {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  function formatTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(locale(), {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: runtime.asset?.market === "BIST" ? "Europe/Istanbul" : "America/New_York"
    }).format(new Date(value));
  }

  function injectStyles() {
    if ($("pm-native-intraday-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-native-intraday-styles";
    style.textContent = `
      .pm-native-shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0b1d1a;color:#e7f0ec}.pm-native-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;background:#102722;border-bottom:1px solid rgba(255,255,255,.12)}.pm-native-meta{display:flex;gap:9px;flex-wrap:wrap;color:#a9bbb4;font-size:.68rem}.pm-native-badge{padding:4px 8px;border-radius:999px;background:rgba(99,214,173,.12);color:#82dfbd;font-weight:700}.pm-native-badge.delayed{background:rgba(231,199,143,.13);color:#e7c78f}.pm-native-badge.error{background:rgba(239,118,111,.13);color:#ef8d87}.pm-native-chart{position:relative;min-height:390px}.pm-native-chart canvas{display:block;width:100%;height:100%}.pm-native-message{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:28px;background:#0b1d1a;color:#b4c3bd}.pm-native-tooltip{position:absolute;display:none;pointer-events:none;min-width:190px;padding:9px 11px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.96);font-size:.7rem;line-height:1.55}.pm-native-foot{display:grid;grid-template-columns:repeat(4,1fr);background:#102722;border-top:1px solid rgba(255,255,255,.12)}.pm-native-stat{padding:9px 12px;border-right:1px solid rgba(255,255,255,.1)}.pm-native-stat:last-child{border-right:0}.pm-native-stat span,.pm-native-stat strong{display:block}.pm-native-stat span{color:#91a8a0;font-size:.62rem}.pm-native-stat strong{margin-top:3px;font-size:.76rem}.pm-native-intervals{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-native-intervals button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-native-intervals button.active{background:var(--pine);color:#fff}@media(max-width:720px){.pm-native-chart{min-height:340px}.pm-native-foot{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureIntervals() {
    let controls = $("pmNativeIntervals");
    if (controls) return controls;
    const ranges = $("pmRangeButtons");
    if (!ranges) return null;
    controls = document.createElement("div");
    controls.id = "pmNativeIntervals";
    controls.className = "pm-native-intervals";
    controls.style.display = "none";
    controls.innerHTML = Object.keys(INTERVALS).map(interval => `<button type="button" data-interval="${interval}" class="${interval === runtime.interval ? "active" : ""}">${interval.replace("m", language() === "en" ? " min" : " dk")}</button>`).join("");
    ranges.before(controls);
    controls.onclick = event => {
      const button = event.target.closest("[data-interval]");
      if (!button) return;
      runtime.interval = button.dataset.interval;
      controls.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      refresh();
    };
    return controls;
  }

  function renderShell() {
    const host = $("pmIntradayWrap");
    if (!host) return;
    host.innerHTML = `
      <div class="pm-native-shell">
        <div class="pm-native-head"><strong id="pmNativeTitle">—</strong><div class="pm-native-meta"><span id="pmNativeBadge" class="pm-native-badge">${text("Yükleniyor", "Loading")}</span><span id="pmNativeSource">—</span><span id="pmNativeTime">—</span></div></div>
        <div class="pm-native-chart"><canvas id="pmNativeCanvas"></canvas><div id="pmNativeMessage" class="pm-native-message">${text("İşlem içi veri yükleniyor…", "Loading intraday data…")}</div><div id="pmNativeTooltip" class="pm-native-tooltip"></div></div>
        <div id="pmNativeFoot" class="pm-native-foot"></div>
      </div>`;
    $("pmNativeCanvas")?.addEventListener("mousemove", hover);
    $("pmNativeCanvas")?.addEventListener("mouseleave", () => { if ($("pmNativeTooltip")) $("pmNativeTooltip").style.display = "none"; });
  }

  function abortRequest() {
    runtime.requestId += 1;
    if (runtime.controller) runtime.controller.abort();
    runtime.controller = null;
  }

  async function fetchJson(url, signal) {
    const response = await fetch(url, { cache: "no-store", signal, headers: { Accept: "application/json,text/plain,*/*" } });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function fetchChart(symbol, signal) {
    const range = INTERVALS[runtime.interval] || "5d";
    const direct = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${runtime.interval}&events=history&includePrePost=false`;
    const candidates = [
      direct,
      direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
      `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`
    ];
    let lastError = null;
    for (const url of candidates) {
      try { return await fetchJson(url, signal); }
      catch (error) {
        if (error.name === "AbortError") throw error;
        lastError = error;
      }
    }
    throw lastError || new Error("INTRADAY_FETCH_FAILED");
  }

  function parse(payload, expectedSymbol) {
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_INTRADAY_CHART");
    const returned = String(result.meta?.symbol || expectedSymbol).toUpperCase();
    if (returned !== expectedSymbol.toUpperCase()) throw new Error(`SYMBOL_MISMATCH:${returned}`);
    const quote = result.indicators?.quote?.[0] || {};
    const rows = (result.timestamp || []).map((timestamp, index) => {
      const close = finite(quote.close?.[index]);
      if (close === null) return null;
      return {
        time: Number(timestamp) * 1000,
        open: finite(quote.open?.[index]) ?? close,
        high: finite(quote.high?.[index]) ?? close,
        low: finite(quote.low?.[index]) ?? close,
        close,
        volume: finite(quote.volume?.[index]) || 0
      };
    }).filter(Boolean);
    if (!rows.length) throw new Error("EMPTY_INTRADAY_ROWS");
    const meta = result.meta || {};
    return {
      rows,
      meta: {
        symbol: returned,
        price: finite(meta.regularMarketPrice) ?? rows.at(-1).close,
        previousClose: finite(meta.chartPreviousClose ?? meta.previousClose),
        marketTime: (finite(meta.regularMarketTime) || rows.at(-1).time / 1000) * 1000,
        delayMinutes: Math.max(0, finite(meta.exchangeDataDelayedBy) || 0),
        source: "MIC browser feed · Yahoo Finance chart"
      }
    };
  }

  function showMessage(message, retry = false) {
    const node = $("pmNativeMessage");
    if (!node) return;
    node.style.display = "grid";
    node.innerHTML = retry ? `<div><strong>${escapeHtml(message)}</strong><br><button id="pmNativeRetry" class="button" type="button">${text("Yeniden dene", "Retry")}</button></div>` : escapeHtml(message);
    $("pmNativeRetry")?.addEventListener("click", refresh, { once: true });
  }

  async function refresh() {
    if (!runtime.active || !runtime.asset) return;
    const symbol = providerSymbol(runtime.asset);
    if (!symbol) return;
    abortRequest();
    const requestId = runtime.requestId;
    runtime.controller = new AbortController();
    if (!$("pmNativeCanvas")) renderShell();
    showMessage(text("İşlem içi veri yükleniyor…", "Loading intraday data…"));
    try {
      const parsed = parse(await fetchChart(symbol, runtime.controller.signal), symbol);
      if (requestId !== runtime.requestId || providerSymbol(runtime.asset) !== symbol) return;
      runtime.rows = parsed.rows;
      runtime.meta = parsed.meta;
      if ($("pmNativeMessage")) $("pmNativeMessage").style.display = "none";
      $("pmNativeTitle").textContent = `${runtime.asset.symbol} · ${runtime.asset.exchange} · ${runtime.interval.replace("m", language() === "en" ? " min" : " dk")}`;
      const badge = $("pmNativeBadge");
      badge.textContent = parsed.meta.delayMinutes ? text(`${parsed.meta.delayMinutes} dk kaynak gecikmesi`, `${parsed.meta.delayMinutes}-min source delay`) : text("Son işlem verisi", "Last trade data");
      badge.className = `pm-native-badge ${parsed.meta.delayMinutes ? "delayed" : ""}`;
      $("pmNativeSource").textContent = parsed.meta.source;
      $("pmNativeTime").textContent = `${text("Son bar", "Last bar")}: ${formatTime(parsed.rows.at(-1).time)}`;
      const change = parsed.meta.previousClose ? (parsed.meta.price / parsed.meta.previousClose - 1) * 100 : null;
      window.dispatchEvent(new CustomEvent("piyasa-market-quotes", { detail: { quotes: { [symbol]: { symbol, price: parsed.meta.price, changePercent: change, timestamp: parsed.meta.marketTime, source: parsed.meta.source } } } }));
      draw();
    } catch (error) {
      if (error.name === "AbortError" || requestId !== runtime.requestId) return;
      runtime.rows = [];
      const badge = $("pmNativeBadge");
      if (badge) { badge.textContent = text("Veri alınamadı", "Data unavailable"); badge.className = "pm-native-badge error"; }
      showMessage(text("İşlem içi veri geçici olarak alınamadı.", "Intraday data is temporarily unavailable."), true);
    }
  }

  function draw() {
    const canvas = $("pmNativeCanvas");
    const rows = runtime.rows;
    if (!canvas || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    const p = { l: 62, r: 18, t: 22, b: 58 };
    const width = rect.width - p.l - p.r;
    const height = rect.height - p.t - p.b;
    const priceHeight = height * .8;
    const volumeTop = p.t + height * .85;
    const volumeHeight = height * .13;
    let min = Math.min(...rows.map(row => row.low));
    let max = Math.max(...rows.map(row => row.high));
    const padding = (max - min || 1) * .06;
    min -= padding; max += padding;
    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => p.l + index * width / Math.max(1, rows.length - 1);
    const y = value => p.t + (max - value) * priceHeight / (max - min);

    context.font = "11px system-ui";
    context.fillStyle = "#91a8a0";
    context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) {
      const yy = p.t + index * priceHeight / 5;
      const value = max - index * (max - min) / 5;
      context.beginPath(); context.moveTo(p.l, yy); context.lineTo(rect.width - p.r, yy); context.stroke();
      context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4);
    }
    rows.forEach((row, index) => {
      const bar = (row.volume || 0) / maxVolume * volumeHeight;
      context.fillStyle = "rgba(124,165,151,.25)";
      context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar);
    });
    if (runtime.mode === "LINE") {
      context.strokeStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath();
      rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close)));
      context.stroke();
    } else {
      const candleWidth = Math.max(1, Math.min(8, width / rows.length * .62));
      rows.forEach((row, index) => {
        const rising = row.close >= row.open;
        const xx = x(index);
        context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f";
        context.beginPath(); context.moveTo(xx, y(row.high)); context.lineTo(xx, y(row.low)); context.stroke();
        context.fillRect(xx - candleWidth / 2, Math.min(y(row.open), y(row.close)), candleWidth, Math.max(1, Math.abs(y(row.open) - y(row.close))));
      });
    }
    const first = rows[0].close;
    const last = rows.at(-1).close;
    const high = Math.max(...rows.map(row => row.high));
    const low = Math.min(...rows.map(row => row.low));
    $("pmNativeFoot").innerHTML = `<div class="pm-native-stat"><span>${text("Dönem getirisi", "Period return")}</span><strong>${percent((last / first - 1) * 100)}</strong></div><div class="pm-native-stat"><span>${text("Yüksek", "High")}</span><strong>${money(high)}</strong></div><div class="pm-native-stat"><span>${text("Düşük", "Low")}</span><strong>${money(low)}</strong></div><div class="pm-native-stat"><span>${text("Son hacim", "Last volume")}</span><strong>${Math.round(rows.at(-1).volume || 0).toLocaleString(locale())}</strong></div>`;
  }

  function hover(event) {
    const canvas = $("pmNativeCanvas");
    const tooltip = $("pmNativeTooltip");
    if (!canvas || !tooltip || !runtime.rows.length) return;
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const index = Math.max(0, Math.min(runtime.rows.length - 1, Math.round((localX - 62) / Math.max(1, rect.width - 80) * (runtime.rows.length - 1))));
    const row = runtime.rows[index];
    tooltip.innerHTML = `<strong>${escapeHtml(formatTime(row.time))}</strong><br>O ${money(row.open)} · H ${money(row.high)}<br>L ${money(row.low)} · C ${money(row.close)}<br>${text("Hacim", "Volume")}: ${Math.round(row.volume || 0).toLocaleString(locale())}`;
    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(rect.width - 205, Math.max(8, localX + 12))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 85)}px`;
  }

  function schedule() {
    clearInterval(runtime.timer);
    runtime.timer = setInterval(() => {
      if (runtime.active && !document.hidden && window.PiyasaMarketLive?.isActive?.()) refresh();
    }, REFRESH_MS);
  }

  function activate(asset) {
    if (!asset) return;
    runtime.active = true;
    runtime.asset = { ...asset };
    runtime.rows = [];
    abortRequest();
    const controls = ensureIntervals();
    if (controls) controls.style.display = "flex";
    renderShell();
    refresh();
    schedule();
  }

  function deactivate() {
    runtime.active = false;
    abortRequest();
    clearInterval(runtime.timer);
    runtime.timer = null;
    const controls = ensureIntervals();
    if (controls) controls.style.display = "none";
    if ($("pmIntradayWrap")) $("pmIntradayWrap").innerHTML = "";
  }

  function install() {
    injectStyles();
    ensureIntervals();
    window.addEventListener("pm-market-source-change", event => event.detail?.source === "INTRADAY" ? activate(event.detail.asset) : deactivate());
    window.addEventListener("pm-market-asset-change", event => {
      runtime.asset = event.detail?.asset ? { ...event.detail.asset } : null;
      if (runtime.active) activate(runtime.asset);
    });
    window.addEventListener("pm-market-mode-change", event => { runtime.mode = event.detail?.mode || "CANDLE"; if (runtime.active) draw(); });
    window.addEventListener("resize", () => { if (runtime.active) draw(); });
    document.addEventListener("visibilitychange", () => { if (runtime.active && !document.hidden && window.PiyasaMarketLive?.isActive?.()) refresh(); });
  }

  window.PiyasaNativeIntraday = { runtime, activate, deactivate, refresh };
  install();
})();
