(() => {
  "use strict";

  if (window.__PM_NATIVE_INTRADAY_CORE__) return;
  window.__PM_NATIVE_INTRADAY_CORE__ = true;

  const INTERVALS = { "1m": "1d", "5m": "5d", "15m": "1mo" };
  const REFRESH_MS = 30_000;
  const SAMPLE_KEY = "piyasa-masasi-ai.intraday-samples.v2";
  const MAX_SAMPLE_AGE = 2 * 24 * 3600_000;
  const MAX_SAMPLES_PER_SYMBOL = 5000;

  const runtime = {
    active: false,
    interval: "5m",
    asset: null,
    rows: [],
    meta: null,
    mode: "CANDLE",
    requestId: 0,
    controller: null,
    timer: null,
    samples: loadSamples()
  };

  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const providerSymbol = asset => asset?.providerSymbol || (asset?.market === "BIST" ? `${String(asset.symbol || "").replace(/\.IS$/i, "")}.IS` : String(asset?.symbol || "").replace(/\.IS$/i, ""));
  const currency = () => runtime.asset?.currency || (runtime.asset?.market === "BIST" ? "TRY" : "USD");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  function money(value) {
    const number = finite(value);
    if (number === null) return "—";
    return new Intl.NumberFormat(locale(), { style: "currency", currency: currency(), maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number);
  }

  function percent(value) {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  }

  function formatTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(locale(), {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: runtime.asset?.market === "BIST" ? "Europe/Istanbul" : "America/New_York"
    }).format(new Date(value));
  }

  function loadSamples() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SAMPLE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) { return {}; }
  }

  function saveSamples() {
    try { sessionStorage.setItem(SAMPLE_KEY, JSON.stringify(runtime.samples)); } catch (_) {}
  }

  function recordQuote(rawSymbol, quote) {
    const symbol = String(rawSymbol || quote?.symbol || "").toUpperCase();
    const price = finite(quote?.price ?? quote?.regularMarketPrice);
    if (!symbol || price === null) return;
    const time = finite(quote?.timestamp ?? quote?.regularMarketTime) || Date.now();
    const timestamp = time < 1e12 ? time * 1000 : time;
    const cutoff = Date.now() - MAX_SAMPLE_AGE;
    const current = Array.isArray(runtime.samples[symbol]) ? runtime.samples[symbol] : [];
    const last = current.at(-1);
    if (!last || last.time !== timestamp || last.price !== price) current.push({ time: timestamp, price, volume: finite(quote?.volume ?? quote?.regularMarketVolume) || 0 });
    runtime.samples[symbol] = current.filter(item => item.time >= cutoff).slice(-MAX_SAMPLES_PER_SYMBOL);
    saveSamples();
  }

  function aggregateSamples(symbol, interval) {
    const minutes = Math.max(1, Number(String(interval).replace("m", "")) || 5);
    const bucketMs = minutes * 60_000;
    const samples = (runtime.samples[String(symbol).toUpperCase()] || []).filter(item => item.time >= Date.now() - MAX_SAMPLE_AGE);
    const buckets = new Map();
    for (const sample of samples) {
      const bucket = Math.floor(sample.time / bucketMs) * bucketMs;
      const row = buckets.get(bucket);
      if (!row) buckets.set(bucket, { time: bucket, open: sample.price, high: sample.price, low: sample.price, close: sample.price, volume: sample.volume || 0 });
      else {
        row.high = Math.max(row.high, sample.price);
        row.low = Math.min(row.low, sample.price);
        row.close = sample.price;
        row.volume = Math.max(row.volume, sample.volume || 0);
      }
    }
    return [...buckets.values()].sort((a, b) => a.time - b.time);
  }

  function injectStyles() {
    if ($("pm-native-intraday-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-native-intraday-styles";
    style.textContent = `
      .pm-native-shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0b1d1a;color:#e7f0ec}.pm-native-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;background:#102722;border-bottom:1px solid rgba(255,255,255,.12)}.pm-native-meta{display:flex;gap:9px;flex-wrap:wrap;color:#a9bbb4;font-size:.68rem}.pm-native-badge{padding:4px 8px;border-radius:999px;background:rgba(99,214,173,.12);color:#82dfbd;font-weight:700}.pm-native-badge.delayed{background:rgba(231,199,143,.13);color:#e7c78f}.pm-native-badge.session{background:rgba(115,178,231,.13);color:#a9d4f4}.pm-native-badge.error{background:rgba(239,118,111,.13);color:#ef8d87}.pm-native-chart{position:relative;min-height:390px}.pm-native-chart canvas{display:block;width:100%;height:100%}.pm-native-message{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:28px;background:#0b1d1a;color:#b4c3bd}.pm-native-message small{display:block;margin-top:7px;color:#879a93}.pm-native-tooltip{position:absolute;display:none;pointer-events:none;min-width:190px;padding:9px 11px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.96);font-size:.7rem;line-height:1.55}.pm-native-foot{display:grid;grid-template-columns:repeat(4,1fr);background:#102722;border-top:1px solid rgba(255,255,255,.12)}.pm-native-stat{padding:9px 12px;border-right:1px solid rgba(255,255,255,.1)}.pm-native-stat:last-child{border-right:0}.pm-native-stat span,.pm-native-stat strong{display:block}.pm-native-stat span{color:#91a8a0;font-size:.62rem}.pm-native-stat strong{margin-top:3px;font-size:.76rem}.pm-native-intervals{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-native-intervals button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-native-intervals button.active{background:var(--pine);color:#fff}@media(max-width:720px){.pm-native-chart{min-height:340px}.pm-native-foot{grid-template-columns:1fr 1fr}}
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
    ranges.before(controls);
    controls.onclick = event => {
      const button = event.target.closest("[data-interval]");
      if (!button) return;
      runtime.interval = button.dataset.interval;
      renderIntervals();
      refresh();
    };
    renderIntervals();
    return controls;
  }

  function renderIntervals() {
    const controls = $("pmNativeIntervals");
    if (!controls) return;
    controls.innerHTML = Object.keys(INTERVALS).map(interval => `<button type="button" data-interval="${interval}" class="${interval === runtime.interval ? "active" : ""}">${interval.replace("m", language() === "en" ? " min" : " dk")}</button>`).join("");
  }

  function renderShell() {
    const host = $("pmIntradayWrap");
    if (!host) return;
    host.innerHTML = `
      <div class="pm-native-shell">
        <div class="pm-native-head"><strong id="pmNativeTitle">—</strong><div class="pm-native-meta"><span id="pmNativeBadge" class="pm-native-badge">${T("Yükleniyor", "Loading")}</span><span id="pmNativeSource">—</span><span id="pmNativeTime">—</span></div></div>
        <div class="pm-native-chart"><canvas id="pmNativeCanvas"></canvas><div id="pmNativeMessage" class="pm-native-message">${T("İşlem içi veri yükleniyor…", "Loading intraday data…")}</div><div id="pmNativeTooltip" class="pm-native-tooltip"></div></div>
        <div id="pmNativeFoot" class="pm-native-foot"></div>
      </div>`;
    $("pmNativeCanvas")?.addEventListener("mousemove", hover);
    $("pmNativeCanvas")?.addEventListener("mouseleave", () => { if ($("pmNativeTooltip")) $("pmNativeTooltip").style.display = "none"; });
  }

  function abortRequest() {
    runtime.requestId += 1;
    runtime.controller?.abort();
    runtime.controller = null;
  }

  async function fetchWithTimeout(url, signal, timeoutMs = 10_000) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json,text/plain,*/*" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function fetchRemoteChart(symbol, signal) {
    const range = INTERVALS[runtime.interval] || "5d";
    const direct = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${runtime.interval}&events=history&includePrePost=false`;
    const candidates = [
      direct,
      direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
      `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(direct)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(direct)}`
    ];
    const attempts = candidates.map(url => fetchWithTimeout(url, signal).then(payload => parseRemote(payload, symbol)));
    try { return await Promise.any(attempts); }
    catch (error) { throw error?.errors?.at(-1) || error; }
  }

  function parseRemote(payload, expectedSymbol) {
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_INTRADAY_CHART");
    const returned = String(result.meta?.symbol || expectedSymbol).toUpperCase();
    if (returned !== expectedSymbol.toUpperCase()) throw new Error(`SYMBOL_MISMATCH:${returned}`);
    const quote = result.indicators?.quote?.[0] || {};
    const rows = (result.timestamp || []).map((timestamp, index) => {
      const close = finite(quote.close?.[index]);
      if (close === null) return null;
      return { time: Number(timestamp) * 1000, open: finite(quote.open?.[index]) ?? close, high: finite(quote.high?.[index]) ?? close, low: finite(quote.low?.[index]) ?? close, close, volume: finite(quote.volume?.[index]) || 0 };
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
        source: "MIC · Yahoo Finance chart",
        mode: "REMOTE"
      }
    };
  }

  function sessionFallback(symbol) {
    let rows = aggregateSamples(symbol, runtime.interval);
    const assetPrice = finite(runtime.asset?.price);
    const assetTime = finite(runtime.asset?.quoteAt) || Date.now();
    if (!rows.length && assetPrice !== null) rows = [{ time: assetTime < 1e12 ? assetTime * 1000 : assetTime, open: assetPrice, high: assetPrice, low: assetPrice, close: assetPrice, volume: finite(runtime.asset?.volume) || 0 }];
    if (!rows.length) return null;
    const price = rows.at(-1).close;
    return {
      rows,
      meta: {
        symbol,
        price,
        previousClose: null,
        marketTime: rows.at(-1).time,
        delayMinutes: 0,
        source: T("MIC canlı tarayıcı oturumu", "MIC live browser session"),
        mode: "SESSION"
      }
    };
  }

  function showMessage(message, detail = "", retry = false) {
    const node = $("pmNativeMessage");
    if (!node) return;
    node.style.display = "grid";
    node.innerHTML = `<div><strong>${escapeHtml(message)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}${retry ? `<br><button id="pmNativeRetry" class="button" type="button">${T("Yeniden dene", "Retry")}</button>` : ""}</div>`;
    $("pmNativeRetry")?.addEventListener("click", refresh, { once: true });
  }

  async function requestLiveQuote(asset) {
    try { return await window.PiyasaMarketLive?.requestAsset?.(asset); }
    catch (_) { return null; }
  }

  async function refresh() {
    if (!runtime.active || !runtime.asset) return;
    const symbol = providerSymbol(runtime.asset);
    if (!symbol) return;
    abortRequest();
    const requestId = runtime.requestId;
    runtime.controller = new AbortController();
    if (!$("pmNativeCanvas")) renderShell();
    showMessage(T("İşlem içi veri yükleniyor…", "Loading intraday data…"), T("Uzak geçmiş ve açık tarayıcı oturumu birlikte kontrol ediliyor.", "Checking remote history and the active browser session."));

    let parsed = null;
    try { parsed = await fetchRemoteChart(symbol, runtime.controller.signal); }
    catch (_) {
      await requestLiveQuote(runtime.asset);
      parsed = sessionFallback(symbol);
    }
    if (requestId !== runtime.requestId || providerSymbol(runtime.asset) !== symbol) return;

    if (!parsed) {
      runtime.rows = [];
      const badge = $("pmNativeBadge");
      if (badge) { badge.textContent = T("Veri bekleniyor", "Waiting for data"); badge.className = "pm-native-badge error"; }
      showMessage(T("İşlem içi fiyat henüz alınamadı.", "Intraday price is not available yet."), T("Canlı izleme açıkken 30 saniye içinde otomatik yeniden denenecek.", "It will retry automatically within 30 seconds while live monitoring is active."), true);
      return;
    }

    runtime.rows = parsed.rows;
    runtime.meta = parsed.meta;
    if ($("pmNativeMessage")) $("pmNativeMessage").style.display = "none";
    $("pmNativeTitle").textContent = `${runtime.asset.symbol} · ${runtime.asset.exchange} · ${runtime.interval.replace("m", language() === "en" ? " min" : " dk")}`;
    const badge = $("pmNativeBadge");
    if (parsed.meta.mode === "SESSION") {
      badge.textContent = runtime.rows.length > 1 ? T("Canlı oturum mumları", "Live-session bars") : T("Canlı oturum başlatıldı", "Live session started");
      badge.className = "pm-native-badge session";
    } else {
      badge.textContent = parsed.meta.delayMinutes ? T(`${parsed.meta.delayMinutes} dk kaynak gecikmesi`, `${parsed.meta.delayMinutes}-min source delay`) : T("Son işlem verisi", "Last trade data");
      badge.className = `pm-native-badge ${parsed.meta.delayMinutes ? "delayed" : ""}`;
    }
    $("pmNativeSource").textContent = parsed.meta.source;
    $("pmNativeTime").textContent = `${T("Son bar", "Last bar")}: ${formatTime(parsed.rows.at(-1).time)}`;
    const change = parsed.meta.previousClose ? (parsed.meta.price / parsed.meta.previousClose - 1) * 100 : null;
    window.dispatchEvent(new CustomEvent("piyasa-market-quotes", { detail: { quotes: { [symbol]: { symbol, price: parsed.meta.price, changePercent: change, timestamp: parsed.meta.marketTime, source: parsed.meta.source } } } }));
    draw();
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
    const padding = (max - min || Math.max(1, max * .002)) * .06;
    min -= padding; max += padding;
    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => p.l + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
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
    if (runtime.mode === "LINE" || rows.length === 1) {
      context.strokeStyle = "#8ecab4"; context.fillStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath();
      rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close)));
      if (rows.length === 1) { context.arc(x(0), y(rows[0].close), 4, 0, Math.PI * 2); context.fill(); } else context.stroke();
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
    renderFoot();
  }

  function renderFoot() {
    const rows = runtime.rows;
    const host = $("pmNativeFoot");
    if (!host || !rows.length) return;
    const first = rows[0].close, last = rows.at(-1).close;
    const high = Math.max(...rows.map(row => row.high));
    const low = Math.min(...rows.map(row => row.low));
    const volume = rows.reduce((total, row) => total + (row.volume || 0), 0);
    host.innerHTML = `<div class="pm-native-stat"><span>${T("Dönem getirisi", "Period return")}</span><strong>${percent(first ? (last / first - 1) * 100 : null)}</strong></div><div class="pm-native-stat"><span>${T("Yüksek", "High")}</span><strong>${money(high)}</strong></div><div class="pm-native-stat"><span>${T("Düşük", "Low")}</span><strong>${money(low)}</strong></div><div class="pm-native-stat"><span>${T("Hacim / örnek", "Volume / samples")}</span><strong>${volume ? volume.toLocaleString(locale()) : rows.length}</strong></div>`;
  }

  function hover(event) {
    const canvas = $("pmNativeCanvas"), tooltip = $("pmNativeTooltip"), rows = runtime.rows;
    if (!canvas || !tooltip || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    const index = Math.max(0, Math.min(rows.length - 1, Math.round((event.clientX - rect.left - 62) / Math.max(1, rect.width - 80) * (rows.length - 1))));
    const row = rows[index];
    tooltip.innerHTML = `<strong>${escapeHtml(formatTime(row.time))}</strong><br>O ${escapeHtml(money(row.open))} · H ${escapeHtml(money(row.high))}<br>L ${escapeHtml(money(row.low))} · C ${escapeHtml(money(row.close))}<br>${T("Hacim", "Volume")}: ${(row.volume || 0).toLocaleString(locale())}`;
    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(rect.width - 205, Math.max(8, event.clientX - rect.left + 12))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 75)}px`;
  }

  function setActive(active) {
    runtime.active = active;
    const controls = ensureIntervals();
    if (controls) controls.style.display = active ? "flex" : "none";
    if (!active) { abortRequest(); clearInterval(runtime.timer); runtime.timer = null; return; }
    renderIntervals();
    renderShell();
    window.PiyasaMarketLive?.start?.();
    refresh();
    clearInterval(runtime.timer);
    runtime.timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  }

  function bind() {
    injectStyles();
    ensureIntervals();
    window.addEventListener("pm-market-source-change", event => {
      runtime.asset = event.detail?.asset || runtime.asset;
      setActive(event.detail?.source === "INTRADAY");
    });
    window.addEventListener("pm-market-asset-change", event => {
      runtime.asset = event.detail?.asset || null;
      if (runtime.active) { renderShell(); refresh(); }
    });
    window.addEventListener("pm-market-mode-change", event => { runtime.mode = event.detail?.mode === "LINE" ? "LINE" : "CANDLE"; draw(); });
    window.addEventListener("piyasa-market-quotes", event => {
      const quotes = event.detail?.quotes || event.detail || {};
      const entries = quotes instanceof Map ? [...quotes.entries()] : Object.entries(quotes);
      for (const [symbol, quote] of entries) recordQuote(symbol, quote);
      if (runtime.active && runtime.asset && entries.some(([symbol]) => String(symbol).toUpperCase() === providerSymbol(runtime.asset).toUpperCase())) {
        const fallback = sessionFallback(providerSymbol(runtime.asset));
        if (fallback && (!runtime.meta || runtime.meta.mode === "SESSION")) { runtime.rows = fallback.rows; runtime.meta = fallback.meta; if ($("pmNativeMessage")) $("pmNativeMessage").style.display = "none"; draw(); }
      }
    });
    document.addEventListener("visibilitychange", () => { if (runtime.active && !document.hidden) refresh(); });
    window.addEventListener("resize", draw);
  }

  window.PiyasaIntraday = {
    refresh,
    getRows: () => runtime.rows.map(row => ({ ...row })),
    getState: () => ({ active: runtime.active, interval: runtime.interval, asset: runtime.asset ? { ...runtime.asset } : null, meta: runtime.meta ? { ...runtime.meta } : null }),
    _test: { aggregateSamples, parseRemote, providerSymbol }
  };

  bind();
})();
