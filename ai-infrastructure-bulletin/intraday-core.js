(() => {
  "use strict";

  if (window.__PM_NATIVE_INTRADAY_CORE__) return;
  window.__PM_NATIVE_INTRADAY_CORE__ = true;

  const INTERVALS = ["1m", "5m", "15m"];
  const REFRESH_MS = 30_000;
  const SAMPLE_KEY = "piyasa-masasi-ai.intraday-samples.v3";
  const MAX_SAMPLE_AGE = 2 * 24 * 3600_000;

  const runtime = {
    active: false,
    interval: "5m",
    asset: null,
    rows: [],
    mode: "CANDLE",
    timer: null,
    samples: loadSamples(),
    source: ""
  };

  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const providerSymbol = asset => asset?.providerSymbol || (asset?.market === "BIST" ? `${asset.symbol}.IS` : asset?.symbol);
  const currency = () => runtime.asset?.currency || (runtime.asset?.market === "BIST" ? "TRY" : "USD");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  function loadSamples() {
    try { const value = JSON.parse(sessionStorage.getItem(SAMPLE_KEY) || "{}"); return value && typeof value === "object" ? value : {}; }
    catch (_) { return {}; }
  }

  function saveSamples() {
    try { sessionStorage.setItem(SAMPLE_KEY, JSON.stringify(runtime.samples)); } catch (_) {}
  }

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
    return new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "medium", timeZone: runtime.asset?.market === "BIST" ? "Europe/Istanbul" : "America/New_York" }).format(new Date(value));
  }

  function recordQuote(rawSymbol, quote) {
    const symbol = String(rawSymbol || quote?.symbol || "").toUpperCase();
    const price = finite(quote?.price);
    if (!symbol || price === null) return;
    const rawTime = finite(quote?.timestamp) || Date.now();
    const time = rawTime < 1e12 ? rawTime * 1000 : rawTime;
    const cutoff = Date.now() - MAX_SAMPLE_AGE;
    const rows = Array.isArray(runtime.samples[symbol]) ? runtime.samples[symbol].filter(item => item.time >= cutoff) : [];
    const last = rows.at(-1);
    if (!last || last.time !== time || last.price !== price) rows.push({ time, price, volume: finite(quote?.volume) || 0 });
    runtime.samples[symbol] = rows.slice(-6000);
    runtime.source = quote?.source || runtime.source;
    saveSamples();
  }

  function aggregate(symbol, interval) {
    const minutes = Math.max(1, Number(String(interval).replace("m", "")) || 5);
    const bucketMs = minutes * 60_000;
    const rows = runtime.samples[String(symbol || "").toUpperCase()] || [];
    const buckets = new Map();
    for (const sample of rows) {
      if (sample.time < Date.now() - MAX_SAMPLE_AGE) continue;
      const bucket = Math.floor(sample.time / bucketMs) * bucketMs;
      const current = buckets.get(bucket);
      if (!current) buckets.set(bucket, { time: bucket, open: sample.price, high: sample.price, low: sample.price, close: sample.price, volume: sample.volume || 0, samples: 1 });
      else {
        current.high = Math.max(current.high, sample.price);
        current.low = Math.min(current.low, sample.price);
        current.close = sample.price;
        current.volume = Math.max(current.volume, sample.volume || 0);
        current.samples += 1;
      }
    }
    return [...buckets.values()].sort((a, b) => a.time - b.time);
  }

  function seedFromAsset() {
    if (!runtime.asset) return;
    const symbol = providerSymbol(runtime.asset).toUpperCase();
    const price = finite(runtime.asset.price);
    if (price === null) return;
    recordQuote(symbol, { price, volume: runtime.asset.volume, timestamp: finite(runtime.asset.quoteAt) || Date.now(), source: runtime.asset.source || T("MIC yayımlanmış fiyat", "MIC published price") });
  }

  function injectStyles() {
    if ($("pm-native-intraday-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-native-intraday-styles";
    style.textContent = `
      .pm-native-shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0b1d1a;color:#e7f0ec}.pm-native-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;background:#102722;border-bottom:1px solid rgba(255,255,255,.12)}.pm-native-meta{display:flex;gap:9px;flex-wrap:wrap;color:#a9bbb4;font-size:.68rem}.pm-native-badge{padding:4px 8px;border-radius:999px;background:rgba(115,178,231,.13);color:#a9d4f4;font-weight:700}.pm-native-chart{position:relative;min-height:390px}.pm-native-chart canvas{display:block;width:100%;height:100%}.pm-native-message{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:28px;background:#0b1d1a;color:#b4c3bd}.pm-native-message small{display:block;margin-top:7px;color:#879a93}.pm-native-tooltip{position:absolute;display:none;pointer-events:none;min-width:190px;padding:9px 11px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(7,25,22,.96);font-size:.7rem;line-height:1.55}.pm-native-foot{display:grid;grid-template-columns:repeat(4,1fr);background:#102722;border-top:1px solid rgba(255,255,255,.12)}.pm-native-stat{padding:9px 12px;border-right:1px solid rgba(255,255,255,.1)}.pm-native-stat:last-child{border-right:0}.pm-native-stat span,.pm-native-stat strong{display:block}.pm-native-stat span{color:#91a8a0;font-size:.62rem}.pm-native-stat strong{margin-top:3px;font-size:.76rem}.pm-native-intervals{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.pm-native-intervals button{border:0;border-radius:8px;padding:7px 9px;background:transparent;color:var(--muted);font-size:.7rem}.pm-native-intervals button.active{background:var(--pine);color:#fff}@media(max-width:720px){.pm-native-chart{min-height:340px}.pm-native-foot{grid-template-columns:1fr 1fr}}
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
      render();
    };
    renderIntervals();
    return controls;
  }

  function renderIntervals() {
    const controls = $("pmNativeIntervals");
    if (!controls) return;
    controls.innerHTML = INTERVALS.map(interval => `<button type="button" data-interval="${interval}" class="${runtime.interval === interval ? "active" : ""}">${interval.replace("m", language() === "en" ? " min" : " dk")}</button>`).join("");
  }

  function renderShell() {
    const host = $("pmIntradayWrap");
    if (!host) return;
    host.innerHTML = `<div class="pm-native-shell"><div class="pm-native-head"><strong id="pmNativeTitle">—</strong><div class="pm-native-meta"><span id="pmNativeBadge" class="pm-native-badge">${T("Canlı oturum", "Live session")}</span><span id="pmNativeSource">—</span><span id="pmNativeTime">—</span></div></div><div class="pm-native-chart"><canvas id="pmNativeCanvas"></canvas><div id="pmNativeMessage" class="pm-native-message">—</div><div id="pmNativeTooltip" class="pm-native-tooltip"></div></div><div id="pmNativeFoot" class="pm-native-foot"></div></div>`;
    $("pmNativeCanvas")?.addEventListener("mousemove", hover);
    $("pmNativeCanvas")?.addEventListener("mouseleave", () => { if ($("pmNativeTooltip")) $("pmNativeTooltip").style.display = "none"; });
  }

  async function refresh() {
    if (!runtime.active || !runtime.asset) return;
    seedFromAsset();
    await window.PiyasaMarketLive?.requestAsset?.(runtime.asset);
    render();
  }

  function render() {
    if (!runtime.asset) return;
    const symbol = providerSymbol(runtime.asset).toUpperCase();
    runtime.rows = aggregate(symbol, runtime.interval);
    if (!$("pmNativeCanvas")) renderShell();
    $("pmNativeTitle").textContent = `${runtime.asset.symbol} · ${runtime.asset.exchange} · ${runtime.interval.replace("m", language() === "en" ? " min" : " dk")}`;
    $("pmNativeSource").textContent = runtime.source || T("MIC açık tarayıcı oturumu", "MIC open-browser session");
    $("pmNativeTime").textContent = runtime.rows.length ? `${T("Son örnek", "Last sample")}: ${formatTime(runtime.rows.at(-1).time)}` : "—";
    const message = $("pmNativeMessage");
    if (!runtime.rows.length) {
      message.style.display = "grid";
      message.innerHTML = `<div><strong>${T("İlk fiyat örneği bekleniyor.", "Waiting for the first price sample.")}</strong><small>${T("Canlı izleme açıkken otomatik yeniden denenecek.", "It will retry automatically while live monitoring is on.")}</small></div>`;
      return;
    }
    message.style.display = runtime.rows.length === 1 ? "grid" : "none";
    if (runtime.rows.length === 1) message.innerHTML = `<div><strong>${T("Canlı oturum başladı.", "Live session started.")}</strong><small>${T("Yeni fiyatlar geldikçe 1/5/15 dakikalık mumlar oluşacak. İlk fiyat grafikte işaretlendi.", "1/5/15-minute bars will form as new prices arrive. The first price is plotted.")}</small></div>`;
    draw();
  }

  function draw() {
    const canvas = $("pmNativeCanvas"), rows = runtime.rows;
    if (!canvas || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, rect.width, rect.height);
    const p = { l: 62, r: 18, t: 22, b: 58 }, width = rect.width - p.l - p.r, height = rect.height - p.t - p.b, priceHeight = height * .8, volumeTop = p.t + height * .85, volumeHeight = height * .13;
    let min = Math.min(...rows.map(row => row.low)), max = Math.max(...rows.map(row => row.high));
    const padding = (max - min || Math.max(0.01, max * .002)) * .08; min -= padding; max += padding;
    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => p.l + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
    const y = value => p.t + (max - value) * priceHeight / (max - min);
    context.font = "11px system-ui"; context.fillStyle = "#91a8a0"; context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) { const yy = p.t + index * priceHeight / 5, value = max - index * (max - min) / 5; context.beginPath(); context.moveTo(p.l, yy); context.lineTo(rect.width - p.r, yy); context.stroke(); context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4); }
    rows.forEach((row, index) => { const bar = (row.volume || 0) / maxVolume * volumeHeight; context.fillStyle = "rgba(124,165,151,.25)"; context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar); });
    if (runtime.mode === "LINE" || rows.length === 1) {
      context.strokeStyle = context.fillStyle = "#8ecab4"; context.lineWidth = 2; context.beginPath(); rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.close)) : context.moveTo(x(index), y(row.close))); if (rows.length === 1) { context.arc(x(0), y(rows[0].close), 4, 0, Math.PI * 2); context.fill(); } else context.stroke();
    } else {
      const candleWidth = Math.max(1, Math.min(8, width / rows.length * .62));
      rows.forEach((row, index) => { const rising = row.close >= row.open, xx = x(index); context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f"; context.beginPath(); context.moveTo(xx, y(row.high)); context.lineTo(xx, y(row.low)); context.stroke(); context.fillRect(xx - candleWidth / 2, Math.min(y(row.open), y(row.close)), candleWidth, Math.max(1, Math.abs(y(row.open) - y(row.close)))); });
    }
    renderFoot();
  }

  function renderFoot() {
    const rows = runtime.rows, host = $("pmNativeFoot");
    if (!host || !rows.length) return;
    const first = rows[0].close, last = rows.at(-1).close, high = Math.max(...rows.map(row => row.high)), low = Math.min(...rows.map(row => row.low)), samples = rows.reduce((total, row) => total + (row.samples || 1), 0);
    host.innerHTML = `<div class="pm-native-stat"><span>${T("Oturum getirisi", "Session return")}</span><strong>${percent(first ? (last / first - 1) * 100 : null)}</strong></div><div class="pm-native-stat"><span>${T("Yüksek", "High")}</span><strong>${money(high)}</strong></div><div class="pm-native-stat"><span>${T("Düşük", "Low")}</span><strong>${money(low)}</strong></div><div class="pm-native-stat"><span>${T("Fiyat örneği", "Price samples")}</span><strong>${samples}</strong></div>`;
  }

  function hover(event) {
    const canvas = $("pmNativeCanvas"), tooltip = $("pmNativeTooltip"), rows = runtime.rows;
    if (!canvas || !tooltip || !rows.length) return;
    const rect = canvas.getBoundingClientRect();
    const index = Math.max(0, Math.min(rows.length - 1, Math.round((event.clientX - rect.left - 62) / Math.max(1, rect.width - 80) * (rows.length - 1))));
    const row = rows[index];
    tooltip.innerHTML = `<strong>${escapeHtml(formatTime(row.time))}</strong><br>O ${escapeHtml(money(row.open))} · H ${escapeHtml(money(row.high))}<br>L ${escapeHtml(money(row.low))} · C ${escapeHtml(money(row.close))}<br>${T("Örnek", "Samples")}: ${row.samples || 1}`;
    tooltip.style.display = "block"; tooltip.style.left = `${Math.min(rect.width - 205, Math.max(8, event.clientX - rect.left + 12))}px`; tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 75)}px`;
  }

  function setActive(active) {
    runtime.active = active;
    const controls = ensureIntervals();
    if (controls) controls.style.display = active ? "flex" : "none";
    clearInterval(runtime.timer); runtime.timer = null;
    if (!active) return;
    renderIntervals(); renderShell(); seedFromAsset(); render();
    window.PiyasaMarketLive?.start?.();
    refresh();
    runtime.timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  }

  function bind() {
    injectStyles(); ensureIntervals();
    window.addEventListener("pm-market-source-change", event => { runtime.asset = event.detail?.asset || runtime.asset; setActive(event.detail?.source === "INTRADAY"); });
    window.addEventListener("pm-market-asset-change", event => { runtime.asset = event.detail?.asset || null; if (runtime.active) { renderShell(); seedFromAsset(); refresh(); } });
    window.addEventListener("pm-market-mode-change", event => { runtime.mode = event.detail?.mode === "LINE" ? "LINE" : "CANDLE"; draw(); });
    window.addEventListener("piyasa-market-quotes", event => {
      const quotes = event.detail?.quotes || event.detail || {}, entries = quotes instanceof Map ? [...quotes.entries()] : Object.entries(quotes);
      for (const [symbol, quote] of entries) recordQuote(symbol, quote);
      if (runtime.active && runtime.asset && entries.some(([symbol]) => String(symbol).toUpperCase() === providerSymbol(runtime.asset).toUpperCase())) render();
    });
    document.addEventListener("visibilitychange", () => { if (runtime.active && !document.hidden) refresh(); });
    window.addEventListener("resize", draw);
  }

  window.PiyasaIntraday = {
    refresh,
    getRows: () => runtime.rows.map(row => ({ ...row })),
    getState: () => ({ active: runtime.active, interval: runtime.interval, asset: runtime.asset ? { ...runtime.asset } : null, source: runtime.source }),
    _test: { aggregate, providerSymbol, recordQuote }
  };

  bind();
})();
