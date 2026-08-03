(() => {
  "use strict";
  if (window.__PM_US_NATIVE_INTRADAY__) return;
  window.__PM_US_NATIVE_INTRADAY__ = true;

  const INTERVALS = { "1m": "1d", "5m": "5d", "15m": "1mo" };
  const REFRESH_MS = 30_000;
  const state = { active: false, interval: "5m", symbol: "", rows: [], meta: null, requestId: 0, timer: null, original: null };
  const $ = id => document.getElementById(id);
  const tr = () => document.documentElement.lang !== "en";
  const t = (trText, enText) => tr() ? trText : enText;
  const n = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function selectedSymbol() {
    return String(document.querySelector("#pmAssetList .pm-asset-row.active[data-pm-symbol]")?.dataset.pmSymbol
      || $("pmAssetTitle")?.textContent?.split("·")[0] || "").trim().toUpperCase().replace(/\.IS$/, "");
  }

  function selectedExchange() {
    return String($("pmAssetSubtitle")?.textContent || "").split("·")[0].trim().toUpperCase();
  }

  function isUs() { return ["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "US"].includes(selectedExchange()); }
  function locale() { return tr() ? "tr-TR" : "en-GB"; }
  function money(value) { return n(value) === null ? "—" : new Intl.NumberFormat(locale(), { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value)); }
  function pct(value) { return n(value) === null ? "—" : `${Number(value) > 0 ? "+" : ""}${Number(value).toLocaleString(locale(), { maximumFractionDigits: 2 })}%`; }
  function time(value) { return value ? new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "medium", timeZone: "America/New_York" }).format(new Date(value)) : "—"; }

  function ensureStyles() {
    if ($("pm-us-native-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-us-native-styles";
    style.textContent = `
      .pm-us-intervals{display:none}.pm-us-intervals.active{display:flex}
      .pm-us-native{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0b1d1a;color:#e7f0ec}
      .pm-us-native-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 14px;background:#102722;border-bottom:1px solid rgba(255,255,255,.12)}
      .pm-us-native-meta{display:flex;gap:9px;flex-wrap:wrap;color:#a9bbb4;font-size:.68rem}.pm-us-native-chart{position:relative;min-height:390px}
      .pm-us-native-chart canvas{width:100%;height:100%;display:block}.pm-us-native-message{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:28px;background:#0b1d1a;color:#b4c3bd}
      .pm-us-native-tooltip{position:absolute;display:none;pointer-events:none;padding:8px 10px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:rgba(7,25,22,.96);font-size:.7rem;line-height:1.5}
      .pm-us-native-foot{display:grid;grid-template-columns:repeat(4,1fr);background:#102722;border-top:1px solid rgba(255,255,255,.12)}
      .pm-us-native-stat{padding:9px 11px;border-right:1px solid rgba(255,255,255,.1)}.pm-us-native-stat:last-child{border-right:0}.pm-us-native-stat span,.pm-us-native-stat strong{display:block}.pm-us-native-stat span{color:#91a8a0;font-size:.62rem}.pm-us-native-stat strong{margin-top:3px;font-size:.76rem}
      @media(max-width:720px){.pm-us-native-chart{min-height:340px}.pm-us-native-foot{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureIntervals() {
    let controls = $("pmUsIntervals");
    if (controls) return controls;
    const ranges = $("pmRangeButtons");
    if (!ranges) return null;
    controls = document.createElement("div");
    controls.id = "pmUsIntervals";
    controls.className = "pm-segmented pm-us-intervals";
    controls.innerHTML = Object.keys(INTERVALS).map(value => `<button type="button" data-us-interval="${value}" class="${value === state.interval ? "active" : ""}">${value.replace("m", tr() ? " dk" : " min")}</button>`).join("");
    ranges.before(controls);
    controls.onclick = event => {
      const button = event.target.closest("[data-us-interval]");
      if (!button) return;
      state.interval = button.dataset.usInterval;
      controls.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      load(true);
    };
    return controls;
  }

  async function read(url) {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout?.(12000) });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function fetchChart(symbol) {
    const range = INTERVALS[state.interval];
    const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${state.interval}&events=history&includePrePost=false`;
    const urls = [base, base.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"), `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`];
    let last;
    for (const url of urls) { try { return await read(url); } catch (error) { last = error; } }
    throw last || new Error("US_INTRADAY_FETCH_FAILED");
  }

  function parse(payload, symbol) {
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error(payload?.chart?.error?.description || "EMPTY_CHART");
    const quote = result.indicators?.quote?.[0] || {};
    const rows = (result.timestamp || []).map((timestamp, index) => {
      const close = n(quote.close?.[index]);
      if (close === null) return null;
      return { time: Number(timestamp) * 1000, open: n(quote.open?.[index]) ?? close, high: n(quote.high?.[index]) ?? close, low: n(quote.low?.[index]) ?? close, close, volume: n(quote.volume?.[index]) || 0 };
    }).filter(Boolean);
    if (!rows.length) throw new Error("EMPTY_ROWS");
    const meta = result.meta || {};
    return { rows, meta: { symbol: String(meta.symbol || symbol).toUpperCase(), price: n(meta.regularMarketPrice) ?? rows.at(-1).close, previousClose: n(meta.chartPreviousClose ?? meta.previousClose), marketTime: (n(meta.regularMarketTime) || rows.at(-1).time / 1000) * 1000, delay: Math.max(0, n(meta.exchangeDataDelayedBy) || 0), source: "MIC browser feed · Yahoo Finance chart" } };
  }

  function shell() {
    const host = $("pmTvWrap");
    if (!host) return;
    host.innerHTML = `<div class="pm-us-native"><div class="pm-us-native-head"><strong id="pmUsTitle">${selectedSymbol()} · ${t("MIC işlem içi", "MIC intraday")}</strong><div class="pm-us-native-meta"><span id="pmUsStatus">${t("Yükleniyor", "Loading")}</span><span id="pmUsSource">—</span><span id="pmUsTime">—</span></div></div><div class="pm-us-native-chart"><canvas id="pmUsCanvas"></canvas><div id="pmUsMessage" class="pm-us-native-message">${t("İşlem içi veri yükleniyor…", "Loading intraday data…")}</div><div id="pmUsTooltip" class="pm-us-native-tooltip"></div></div><div id="pmUsFoot" class="pm-us-native-foot"></div></div>`;
    $("pmUsCanvas")?.addEventListener("mousemove", hover);
    $("pmUsCanvas")?.addEventListener("mouseleave", () => { if ($("pmUsTooltip")) $("pmUsTooltip").style.display = "none"; });
  }

  async function load() {
    if (!state.active || !isUs()) return;
    const symbol = selectedSymbol();
    if (!symbol) return;
    const requestId = ++state.requestId;
    state.symbol = symbol;
    if (!$("pmUsCanvas")) shell();
    if ($("pmUsMessage")) { $("pmUsMessage").style.display = "grid"; $("pmUsMessage").textContent = t("İşlem içi veri yükleniyor…", "Loading intraday data…"); }
    try {
      const parsed = parse(await fetchChart(symbol), symbol);
      if (requestId !== state.requestId || selectedSymbol() !== symbol) return;
      state.rows = parsed.rows; state.meta = parsed.meta;
      if ($("pmUsMessage")) $("pmUsMessage").style.display = "none";
      if ($("pmUsTitle")) $("pmUsTitle").textContent = `${symbol} · ${state.interval.replace("m", tr() ? " dk" : " min")}`;
      if ($("pmUsStatus")) $("pmUsStatus").textContent = parsed.meta.delay ? t(`${parsed.meta.delay} dk kaynak gecikmesi`, `${parsed.meta.delay}-min source delay`) : t("Son işlem verisi", "Last trade data");
      if ($("pmUsSource")) $("pmUsSource").textContent = parsed.meta.source;
      if ($("pmUsTime")) $("pmUsTime").textContent = `${t("Son bar", "Last bar")}: ${time(parsed.rows.at(-1).time)}`;
      const change = parsed.meta.previousClose ? (parsed.meta.price / parsed.meta.previousClose - 1) * 100 : null;
      if ($("pmAssetPrice")) $("pmAssetPrice").textContent = money(parsed.meta.price);
      if ($("pmAssetChange") && change !== null) $("pmAssetChange").textContent = `${pct(change)} · ${t("30 sn kontrol", "30-sec check")}`;
      if ($("pmDataStatus")) $("pmDataStatus").textContent = `${state.interval.replace("m", tr() ? " dk" : " min")} · ${t("30 sn kontrol", "30-sec check")}`;
      if ($("pmSourceStatus")) $("pmSourceStatus").textContent = `${parsed.meta.source} · ${time(parsed.meta.marketTime)}`;
      draw();
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.rows = [];
      if ($("pmUsStatus")) $("pmUsStatus").textContent = t("Veri alınamadı", "Data unavailable");
      if ($("pmUsMessage")) $("pmUsMessage").innerHTML = `<div><strong>${t("İşlem içi veri geçici olarak alınamadı.", "Intraday data is temporarily unavailable.")}</strong><br><button id="pmUsRetry" class="button" type="button">${t("Yeniden dene", "Retry")}</button></div>`;
      $("pmUsRetry")?.addEventListener("click", load, { once: true });
    }
  }

  function draw() {
    const canvas = $("pmUsCanvas"), rows = state.rows;
    if (!canvas || !rows.length) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, devicePixelRatio || 1); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const p = { l: 62, r: 18, t: 22, b: 58 }, w = rect.width - p.l - p.r, h = rect.height - p.t - p.b, ph = h * .8, vt = p.t + h * .85, vh = h * .13;
    let min = Math.min(...rows.map(row => row.low)), max = Math.max(...rows.map(row => row.high)); const pad = (max - min || 1) * .06; min -= pad; max += pad;
    const maxVol = Math.max(1, ...rows.map(row => row.volume || 0)), x = i => p.l + i * w / Math.max(1, rows.length - 1), y = v => p.t + (max - v) * ph / (max - min);
    ctx.font = "11px system-ui"; ctx.fillStyle = "#91a8a0"; ctx.strokeStyle = "rgba(160,190,180,.15)";
    for (let i = 0; i <= 5; i += 1) { const yy = p.t + i * ph / 5, value = max - i * (max - min) / 5; ctx.beginPath(); ctx.moveTo(p.l, yy); ctx.lineTo(rect.width - p.r, yy); ctx.stroke(); ctx.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4); }
    rows.forEach((row, i) => { const bar = (row.volume || 0) / maxVol * vh; ctx.fillStyle = "rgba(124,165,151,.25)"; ctx.fillRect(x(i) - 1.5, vt + vh - bar, 3, bar); });
    const line = $("pmModeButtons")?.querySelector("[data-mode].active")?.dataset.mode === "LINE";
    if (line) { ctx.strokeStyle = "#8ecab4"; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((row, i) => i ? ctx.lineTo(x(i), y(row.close)) : ctx.moveTo(x(i), y(row.close))); ctx.stroke(); }
    else { const cw = Math.max(1, Math.min(8, w / rows.length * .62)); rows.forEach((row, i) => { const up = row.close >= row.open, xx = x(i); ctx.strokeStyle = ctx.fillStyle = up ? "#63d6ad" : "#ef766f"; ctx.beginPath(); ctx.moveTo(xx, y(row.high)); ctx.lineTo(xx, y(row.low)); ctx.stroke(); ctx.fillRect(xx - cw / 2, Math.min(y(row.open), y(row.close)), cw, Math.max(1, Math.abs(y(row.open) - y(row.close)))); }); }
    const first = rows[0].close, last = rows.at(-1).close, high = Math.max(...rows.map(row => row.high)), low = Math.min(...rows.map(row => row.low));
    if ($("pmUsFoot")) $("pmUsFoot").innerHTML = `<div class="pm-us-native-stat"><span>${t("Dönem getirisi", "Period return")}</span><strong>${pct((last / first - 1) * 100)}</strong></div><div class="pm-us-native-stat"><span>${t("Yüksek", "High")}</span><strong>${money(high)}</strong></div><div class="pm-us-native-stat"><span>${t("Düşük", "Low")}</span><strong>${money(low)}</strong></div><div class="pm-us-native-stat"><span>${t("Son hacim", "Last volume")}</span><strong>${Math.round(rows.at(-1).volume || 0).toLocaleString(locale())}</strong></div>`;
  }

  function hover(event) {
    const canvas = $("pmUsCanvas"), tip = $("pmUsTooltip"); if (!canvas || !tip || !state.rows.length) return;
    const rect = canvas.getBoundingClientRect(), localX = event.clientX - rect.left, index = Math.max(0, Math.min(state.rows.length - 1, Math.round((localX - 62) / Math.max(1, rect.width - 80) * (state.rows.length - 1)))), row = state.rows[index];
    tip.innerHTML = `<strong>${time(row.time)}</strong><br>O ${money(row.open)} · H ${money(row.high)}<br>L ${money(row.low)} · C ${money(row.close)}<br>${t("Hacim", "Volume")}: ${Math.round(row.volume || 0).toLocaleString(locale())}`;
    tip.style.display = "block"; tip.style.left = `${Math.min(rect.width - 205, Math.max(8, localX + 12))}px`; tip.style.top = `${Math.max(8, event.clientY - rect.top - 85)}px`;
  }

  function activate() {
    if (!isUs()) return;
    const tabs = $("pmSourceTabs"), mic = tabs?.querySelector('[data-source="MIC"]'), tv = tabs?.querySelector('[data-source="TV"]');
    if (state.original && mic) state.original({ target: mic });
    state.active = true; state.symbol = selectedSymbol(); mic?.classList.remove("active"); tv?.classList.add("active");
    $("pmCustomWrap")?.classList.add("hidden"); $("pmTvWrap")?.classList.add("active"); if ($("pmRangeButtons")) $("pmRangeButtons").style.display = "none"; ensureIntervals()?.classList.add("active");
    shell(); load(); clearInterval(state.timer); state.timer = setInterval(load, REFRESH_MS);
  }

  function deactivate() {
    state.active = false; state.requestId += 1; clearInterval(state.timer); state.timer = null; ensureIntervals()?.classList.remove("active"); if ($("pmRangeButtons")) $("pmRangeButtons").style.display = "flex"; if ($("pmTvWrap")) $("pmTvWrap").innerHTML = "";
  }

  function update() {
    const tabs = $("pmSourceTabs"), tv = tabs?.querySelector('[data-source="TV"]'); if (!tv) return;
    if (!isUs()) { if (state.active) deactivate(); return; }
    tv.textContent = t("MIC işlem içi", "MIC intraday"); tv.title = t("Uygulama içi 1, 5 ve 15 dakikalık ABD hisse grafiği", "In-app 1, 5 and 15-minute US equity chart");
    const stale = $("pmTvWrap")?.querySelector("iframe, .tradingview-widget-container");
    if (!state.active && (tv.classList.contains("active") || stale)) { activate(); return; }
    const symbol = selectedSymbol(); if (state.active && symbol && symbol !== state.symbol) { state.symbol = symbol; state.requestId += 1; shell(); load(); }
  }

  function start() {
    ensureStyles();
    const tabs = $("pmSourceTabs"); if (!tabs) { setTimeout(start, 80); return; }
    state.original = tabs.onclick;
    tabs.onclick = event => {
      const button = event.target.closest("[data-source]"); if (!button) return;
      if (button.dataset.source === "TV" && isUs()) { event.preventDefault(); event.stopPropagation(); activate(); return; }
      if (state.active) deactivate();
      state.original?.call(tabs, event);
    };
    $("pmModeButtons")?.addEventListener("click", () => state.active && setTimeout(draw, 0));
    window.addEventListener("resize", () => state.active && draw());
    const observer = new MutationObserver(() => queueMicrotask(update)); [$("pmAssetTitle"), $("pmAssetSubtitle")].filter(Boolean).forEach(node => observer.observe(node, { childList: true, subtree: true, characterData: true }));
    update(); setInterval(update, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
