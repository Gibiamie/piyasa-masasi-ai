(() => {
  "use strict";

  if (window.__PM_DAILY_HISTORY_CONTROLLER__) return;
  window.__PM_DAILY_HISTORY_CONTROLLER__ = true;

  const INITIAL_CHECK_MS = 1800;
  const RETRY_MS = 60_000;
  const RANGE_OPTIONS = [
    ["1D", "1G", "1D"],
    ["1W", "1H", "1W"],
    ["1M", "1A", "1M"],
    ["3M", "3A", "3M"],
    ["6M", "6A", "6M"],
    ["1Y", "1Y", "1Y"],
    ["5Y", "5Y", "5Y"],
    ["YTD", "YTD", "YTD"]
  ];
  const INTERVAL_OPTIONS = [
    ["1h", "1 sa", "1 h"],
    ["2h", "2 sa", "2 h"],
    ["4h", "4 sa", "4 h"],
    ["1d", "1 G", "1 D"],
    ["1wk", "1 H", "1 W"],
    ["1mo", "1 A", "1 M"]
  ];
  const RANGE_TO_YAHOO = {
    "1D": "1d",
    "1W": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
    "YTD": "ytd"
  };
  const DAILY_COVERAGE_RANGE = "5y";
  const DAILY_INTERVALS = new Set(["1d", "1wk", "1mo"]);
  const HOURLY_INTERVALS = new Set(["1h", "2h", "4h"]);

  let timer = null;
  let expectedVersion = 0;
  let chartRequest = 0;
  let selectedRange = "1Y";
  let selectedInterval = "1d";
  let observer = null;
  const providerCache = new Map();
  const dailyCoverageCache = new Map();

  const $ = id => document.getElementById(id);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const workspace = () => window.PiyasaMarketWorkspace || null;
  const selectedAsset = () => workspace()?.getSelected?.() || null;
  const providerSymbol = asset => asset?.providerSymbol || (asset?.market === "BIST" ? `${asset.symbol}.IS` : asset?.symbol || "");
  const timezone = asset => asset?.market === "BIST" ? "Europe/Istanbul" : "America/New_York";

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

  function pct(value) {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  }

  function valueClass(value) {
    const number = finite(value);
    return number === null || number === 0 ? "" : number > 0 ? "up" : "down";
  }

  function money(value, currency = "USD") {
    const number = finite(value);
    if (number === null) return "—";
    try {
      return new Intl.NumberFormat(locale(), {
        style: "currency",
        currency,
        maximumFractionDigits: number >= 100 ? 2 : 4
      }).format(number);
    } catch (_) {
      return `${number.toLocaleString(locale())} ${currency}`;
    }
  }

  function dateLabel(ms, withTime = false) {
    if (!Number.isFinite(ms)) return "—";
    const asset = selectedAsset();
    const options = withTime
      ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: timezone(asset) }
      : { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: timezone(asset) };
    return new Intl.DateTimeFormat(locale(), options).format(new Date(ms));
  }

  function addMonths(date, delta) {
    const result = new Date(date.getTime());
    result.setUTCMonth(result.getUTCMonth() + delta);
    return result;
  }

  function targetStartMs(endMs, range) {
    const end = new Date(endMs);
    if (range === "1D") return endMs - 26 * 3600_000;
    if (range === "1W") return endMs - 8 * 86400_000;
    if (range === "1M") return addMonths(end, -1).getTime();
    if (range === "3M") return addMonths(end, -3).getTime();
    if (range === "6M") return addMonths(end, -6).getTime();
    if (range === "1Y") {
      const start = new Date(end.getTime());
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start.getTime();
    }
    if (range === "5Y") {
      const start = new Date(end.getTime());
      start.setUTCFullYear(start.getUTCFullYear() - 5);
      return start.getTime();
    }
    if (range === "YTD") return Date.UTC(end.getUTCFullYear(), 0, 1);
    return 0;
  }

  function normalizeRow(time, open, high, low, close, volume) {
    const c = finite(close);
    const t = finite(time);
    if (c === null || t === null) return null;
    return {
      time: t < 1e12 ? t * 1000 : t,
      open: finite(open) ?? c,
      high: finite(high) ?? c,
      low: finite(low) ?? c,
      close: c,
      volume: finite(volume) ?? 0
    };
  }

  function rowsFromYahoo(payload) {
    const chart = payload?.chart?.result?.[0];
    if (!chart) return [];
    const timestamps = chart.timestamp || [];
    const quote = chart.indicators?.quote?.[0] || {};
    return timestamps.map((time, index) => normalizeRow(
      time,
      quote.open?.[index],
      quote.high?.[index],
      quote.low?.[index],
      quote.close?.[index],
      quote.volume?.[index]
    )).filter(Boolean);
  }

  function localDailyRows() {
    const history = workspace()?.state?.history || [];
    return history.map(row => {
      const raw = row.date || row.time;
      const ms = typeof raw === "number" ? raw : Date.parse(`${String(raw).slice(0, 10)}T12:00:00Z`);
      return normalizeRow(ms, row.open, row.high, row.low, row.close, row.volume);
    }).filter(Boolean);
  }

  async function fetchYahoo(asset, range, interval) {
    const symbol = providerSymbol(asset);
    if (!symbol) throw new Error("PROVIDER_SYMBOL_MISSING");
    const key = `${symbol}|${range}|${interval}`;
    if (providerCache.has(key)) return providerCache.get(key);

    const encoded = encodeURIComponent(symbol);
    let lastError = null;
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const url = new URL(`https://${host}/v8/finance/chart/${encoded}`);
        url.searchParams.set("range", range);
        url.searchParams.set("interval", interval);
        url.searchParams.set("events", "div,splits");
        url.searchParams.set("includePrePost", "false");
        const response = await fetch(url.href, {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: { Accept: "application/json,text/plain,*/*" }
        });
        if (!response.ok) throw new Error(`${host} HTTP ${response.status}`);
        const payload = await response.json();
        if (payload?.chart?.error) throw new Error(String(payload.chart.error.description || payload.chart.error.code || "Yahoo chart error"));
        const rows = rowsFromYahoo(payload);
        if (!rows.length) throw new Error("NO_VALID_BARS");
        providerCache.set(key, rows);
        return rows;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("CHART_PROVIDER_FAILED");
  }

  function dateKey(ms, asset) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone(asset)
    }).formatToParts(new Date(ms));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function aggregateHourly(rows, hours, asset) {
    if (hours <= 1) return rows;
    const byDay = new Map();
    for (const row of rows) {
      const key = dateKey(row.time, asset);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(row);
    }
    const output = [];
    for (const dayRows of byDay.values()) {
      dayRows.sort((a, b) => a.time - b.time);
      for (let index = 0; index < dayRows.length; index += hours) {
        const chunk = dayRows.slice(index, index + hours);
        if (!chunk.length) continue;
        output.push({
          time: chunk[0].time,
          open: chunk[0].open,
          high: Math.max(...chunk.map(row => row.high)),
          low: Math.min(...chunk.map(row => row.low)),
          close: chunk.at(-1).close,
          volume: chunk.reduce((sum, row) => sum + (row.volume || 0), 0)
        });
      }
    }
    return output.sort((a, b) => a.time - b.time);
  }

  function weekKey(ms) {
    const date = new Date(ms);
    const day = (date.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
    return monday.toISOString().slice(0, 10);
  }

  function monthKey(ms) {
    const date = new Date(ms);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function aggregateDaily(rows, interval) {
    if (interval === "1d") return rows;
    const buckets = new Map();
    for (const row of rows) {
      const key = interval === "1wk" ? weekKey(row.time) : monthKey(row.time);
      const current = buckets.get(key);
      if (!current) {
        buckets.set(key, { ...row });
      } else {
        current.high = Math.max(current.high, row.high);
        current.low = Math.min(current.low, row.low);
        current.close = row.close;
        current.volume += row.volume || 0;
      }
    }
    return [...buckets.values()].sort((a, b) => a.time - b.time);
  }

  function filterRange(rows, range) {
    if (!rows.length) return [];
    const endMs = rows.at(-1).time;
    if (range === "1D") {
      const asset = selectedAsset();
      const lastKey = dateKey(endMs, asset);
      const sameDay = rows.filter(row => dateKey(row.time, asset) === lastKey);
      return sameDay.length ? sameDay : rows.slice(-1);
    }
    const startMs = targetStartMs(endMs, range);
    return rows.filter(row => row.time >= startMs);
  }

  async function ensureDailyCoverage(asset) {
    const symbol = providerSymbol(asset);
    if (!symbol) return localDailyRows();
    if (dailyCoverageCache.has(symbol)) return dailyCoverageCache.get(symbol);
    try {
      const rows = await fetchYahoo(asset, DAILY_COVERAGE_RANGE, "1d");
      dailyCoverageCache.set(symbol, rows);
      return rows;
    } catch (_) {
      const rows = localDailyRows();
      if (rows.length) dailyCoverageCache.set(symbol, rows);
      return rows;
    }
  }

  function intervalSupported(range, interval) {
    if (range === "5Y" && HOURLY_INTERVALS.has(interval)) return false;
    return true;
  }

  function enforceCompatibleInterval() {
    if (intervalSupported(selectedRange, selectedInterval)) return;
    selectedInterval = "1d";
  }

  async function chartRows(asset) {
    enforceCompatibleInterval();
    if (DAILY_INTERVALS.has(selectedInterval)) {
      const dailyRows = await ensureDailyCoverage(asset);
      return filterRange(aggregateDaily(dailyRows, selectedInterval), selectedRange);
    }

    const yahooRange = RANGE_TO_YAHOO[selectedRange];
    if (!yahooRange) throw new Error("HOURLY_RANGE_UNAVAILABLE");
    const hourly = await fetchYahoo(asset, yahooRange, "1h");
    const hours = Number(selectedInterval.replace("h", "")) || 1;
    return filterRange(aggregateHourly(hourly, hours, asset), selectedRange);
  }

  function setMetric(id, value) {
    const node = $(id);
    if (!node) return;
    node.textContent = pct(value);
    node.className = valueClass(value);
  }

  function returnFromRows(rows, months) {
    if (!rows.length) return null;
    const last = rows.at(-1);
    const target = addMonths(new Date(last.time), -months).getTime();
    let base = null;
    for (const row of rows) {
      if (row.time <= target) base = row;
      else break;
    }
    if (!base || !base.close) return null;
    return (last.close / base.close - 1) * 100;
  }

  function returnOneYear(rows) {
    if (!rows.length) return null;
    const last = rows.at(-1);
    const target = new Date(last.time);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    let base = null;
    for (const row of rows) {
      if (row.time <= target.getTime()) base = row;
      else break;
    }
    if (!base || !base.close) return null;
    return (last.close / base.close - 1) * 100;
  }

  async function renderReturns(asset, requestToken = chartRequest) {
    let rows = [];
    try { rows = await ensureDailyCoverage(asset); } catch (_) {}
    if (requestToken !== chartRequest || selectedAsset()?.key !== asset.key) return;

    const fallback = asset.performance || {};
    const oneMonth = returnFromRows(rows, 1) ?? finite(fallback["1A"]);
    const threeMonth = returnFromRows(rows, 3) ?? finite(fallback["3A"]);
    const sixMonth = returnFromRows(rows, 6) ?? finite(fallback["6A"]);
    const oneYear = returnOneYear(rows) ?? finite(fallback["1Y"]);

    setMetric("pm1m", oneMonth);
    setMetric("pm3m", threeMonth);
    setMetric("pm6m", sixMonth);
    setMetric("pm1y", oneYear);
  }

  function renderControls() {
    const rangeHost = $("pmRangeButtons");
    if (rangeHost) {
      rangeHost.innerHTML = RANGE_OPTIONS.map(([key, trLabel, enLabel]) =>
        `<button type="button" data-range="${key}" class="${selectedRange === key ? "active" : ""}">${language() === "en" ? enLabel : trLabel}</button>`
      ).join("");
      rangeHost.style.display = dailySelected() ? "flex" : "none";
    }

    let intervalHost = $("pmCandleIntervals");
    if (!intervalHost && rangeHost) {
      intervalHost = document.createElement("div");
      intervalHost.id = "pmCandleIntervals";
      intervalHost.className = "pm-segmented pm-candle-intervals";
      rangeHost.after(intervalHost);
      intervalHost.addEventListener("click", event => {
        const button = event.target.closest("[data-candle-interval]");
        if (!button || button.disabled) return;
        selectedInterval = button.dataset.candleInterval;
        renderControls();
        refreshChart();
      });
    }

    if (intervalHost) {
      intervalHost.innerHTML = INTERVAL_OPTIONS.map(([key, trLabel, enLabel]) => {
        const disabled = !intervalSupported(selectedRange, key);
        const title = disabled
          ? T("5 yıllık görünümde saatlik veri sağlayıcı sınırı nedeniyle kullanılamaz.", "Hourly provider data is unavailable for the 5-year view.")
          : "";
        return `<button type="button" data-candle-interval="${key}" class="${selectedInterval === key ? "active" : ""}" ${disabled ? "disabled" : ""} title="${title}">${language() === "en" ? enLabel : trLabel}</button>`;
      }).join("");
      intervalHost.style.display = dailySelected() ? "flex" : "none";
    }
  }

  function installMetricCard() {
    if ($("pm6m")) return;
    const oneYear = $("pm1y")?.closest(".pm-market-metric");
    if (!oneYear) return;
    const card = document.createElement("article");
    card.className = "pm-market-metric";
    card.innerHTML = `<span>6 ${T("Ay", "Months")}</span><strong id="pm6m">—</strong>`;
    oneYear.before(card);
  }

  function installStyles() {
    if ($("pm-chart-timeframe-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-chart-timeframe-styles";
    style.textContent = `
      .pm-market-metrics{grid-template-columns:repeat(8,minmax(88px,1fr))}
      .pm-candle-intervals{white-space:nowrap}
      .pm-candle-intervals button:disabled{opacity:.38;cursor:not-allowed}
      .pm-market-toolbar{align-items:center}
      @media(max-width:1320px){.pm-market-metrics{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:720px){.pm-market-metrics{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function drawRows(rows, sourceLabel = "") {
    const canvas = $("pmChartCanvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    const message = $("pmChartMessage");
    if (!rows.length) {
      if (message) {
        message.style.display = "grid";
        message.textContent = T("Seçilen dönem ve mum aralığı için veri bulunamadı.", "No data is available for the selected range and candle interval.");
      }
      if ($("pmChartStats")) $("pmChartStats").textContent = "—";
      return;
    }

    if (message) message.style.display = "none";

    const p = { l: 62, r: 20, t: 30, b: 60 };
    const width = rect.width - p.l - p.r;
    const height = rect.height - p.t - p.b;
    const priceHeight = height * 0.8;
    const volumeTop = p.t + height * 0.85;
    const volumeHeight = height * 0.13;

    let min = Math.min(...rows.map(row => row.low ?? row.close));
    let max = Math.max(...rows.map(row => row.high ?? row.close));
    const padding = (max - min || Math.max(0.01, max * 0.002)) * 0.07;
    min -= padding;
    max += padding;

    const maxVolume = Math.max(1, ...rows.map(row => row.volume || 0));
    const x = index => p.l + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
    const y = value => p.t + (max - value) * priceHeight / Math.max(1e-9, max - min);

    context.font = "11px system-ui";
    context.fillStyle = "#91a8a0";
    context.strokeStyle = "rgba(160,190,180,.15)";
    for (let index = 0; index <= 5; index += 1) {
      const yy = p.t + index * priceHeight / 5;
      const value = max - index * (max - min) / 5;
      context.beginPath();
      context.moveTo(p.l, yy);
      context.lineTo(rect.width - p.r, yy);
      context.stroke();
      context.fillText(value.toFixed(value >= 100 ? 2 : 3), 7, yy + 4);
    }

    rows.forEach((row, index) => {
      const bar = (row.volume || 0) / maxVolume * volumeHeight;
      context.fillStyle = "rgba(124,165,151,.25)";
      context.fillRect(x(index) - 1.5, volumeTop + volumeHeight - bar, 3, bar);
    });

    const mode = workspace()?.state?.mode || "CANDLE";
    if (mode === "LINE" || rows.length === 1) {
      context.strokeStyle = context.fillStyle = "#8ecab4";
      context.lineWidth = 2;
      context.beginPath();
      rows.forEach((row, index) => {
        if (index) context.lineTo(x(index), y(row.close));
        else context.moveTo(x(index), y(row.close));
      });
      if (rows.length === 1) {
        context.arc(x(0), y(rows[0].close), 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.stroke();
      }
    } else {
      const candleWidth = Math.max(1, Math.min(9, width / rows.length * 0.62));
      rows.forEach((row, index) => {
        const rising = row.close >= row.open;
        const xx = x(index);
        context.strokeStyle = context.fillStyle = rising ? "#63d6ad" : "#ef766f";
        context.beginPath();
        context.moveTo(xx, y(row.high));
        context.lineTo(xx, y(row.low));
        context.stroke();
        context.fillRect(
          xx - candleWidth / 2,
          Math.min(y(row.open), y(row.close)),
          candleWidth,
          Math.max(1, Math.abs(y(row.open) - y(row.close)))
        );
      });
    }

    const labelCount = Math.min(6, rows.length);
    context.fillStyle = "#91a8a0";
    context.textAlign = "center";
    for (let index = 0; index < labelCount; index += 1) {
      const rowIndex = Math.round(index * (rows.length - 1) / Math.max(1, labelCount - 1));
      const row = rows[rowIndex];
      context.fillText(dateLabel(row.time, HOURLY_INTERVALS.has(selectedInterval)), x(rowIndex), rect.height - 20);
    }
    context.textAlign = "start";

    const first = rows[0].close;
    const last = rows.at(-1).close;
    const high = Math.max(...rows.map(row => row.high ?? row.close));
    const low = Math.min(...rows.map(row => row.low ?? row.close));
    const asset = selectedAsset();
    if ($("pmChartStats")) {
      $("pmChartStats").textContent = `${T("Dönem", "Period")}: ${pct(first ? (last / first - 1) * 100 : null)} · ${T("Yüksek", "High")}: ${money(high, asset?.currency)} · ${T("Düşük", "Low")}: ${money(low, asset?.currency)}`;
    }
    if ($("pmHistoryStatus")) {
      const intervalLabel = INTERVAL_OPTIONS.find(item => item[0] === selectedInterval);
      $("pmHistoryStatus").textContent = `${rows.length} ${language() === "en" ? intervalLabel?.[2] : intervalLabel?.[1]} OHLC · ${dateLabel(rows[0].time)} → ${dateLabel(rows.at(-1).time)}${sourceLabel ? ` · ${sourceLabel}` : ""}`;
    }
  }

  async function refreshChart() {
    const api = workspace();
    const asset = api?.getSelected?.();
    if (!api?.state || !asset || api.state.source !== "DAILY") return;
    const token = ++chartRequest;

    renderControls();
    const message = $("pmChartMessage");
    if (message) {
      message.style.display = "grid";
      message.textContent = T("Grafik verisi yükleniyor", "Loading chart data");
    }

    try {
      const rows = await chartRows(asset);
      if (token !== chartRequest || selectedAsset()?.key !== asset.key || workspace()?.state?.source !== "DAILY") return;
      drawRows(rows, HOURLY_INTERVALS.has(selectedInterval) ? "Yahoo Finance hourly chart feed" : "Yahoo Finance / MIC daily history");
    } catch (error) {
      if (token !== chartRequest) return;
      const fallbackRows = DAILY_INTERVALS.has(selectedInterval)
        ? filterRange(aggregateDaily(localDailyRows(), selectedInterval), selectedRange)
        : [];
      if (fallbackRows.length) {
        drawRows(fallbackRows, "MIC daily history");
      } else {
        drawRows([], "");
        if (message) {
          message.textContent = HOURLY_INTERVALS.has(selectedInterval)
            ? T("Saatlik mum verisi şu anda veri sağlayıcıdan alınamadı. Günlük/haftalık/aylık mum aralığını deneyin.", "Hourly candle data is currently unavailable from the provider. Try daily, weekly, or monthly candles.")
            : T("Bu dönem için yeterli fiyat geçmişi bulunamadı.", "There is not enough price history for this range.");
        }
      }
    }
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
    try { await api.select?.(asset.key, true); } catch (_) {}

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

  function bindRangeButtons() {
    const host = $("pmRangeButtons");
    if (!host || host.dataset.advancedBound === "1") return;
    host.dataset.advancedBound = "1";
    host.addEventListener("click", event => {
      const button = event.target.closest("[data-range]");
      if (!button) return;
      selectedRange = button.dataset.range;
      if (workspace()?.state) workspace().state.range = selectedRange;
      enforceCompatibleInterval();
      renderControls();
      setTimeout(refreshChart, 0);
    });
  }

  function installObserver() {
    if (observer) observer.disconnect();
    const status = $("pmHistoryStatus");
    if (!status) return;
    observer = new MutationObserver(() => {
      if (!dailySelected()) return;
      const asset = selectedAsset();
      if (!asset) return;
      const token = chartRequest;
      setTimeout(() => {
        renderReturns(asset, token);
        refreshChart();
      }, 0);
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }

  function installUi() {
    installStyles();
    installMetricCard();
    renderControls();
    bindRangeButtons();
    installObserver();
  }

  function bind() {
    window.addEventListener("pm-market-asset-change", event => {
      chartRequest += 1;
      if (workspace()?.state?.source === "DAILY") {
        schedule(event.detail?.version);
        installUi();
        const asset = selectedAsset();
        if (asset) {
          const token = chartRequest;
          renderReturns(asset, token);
          refreshChart();
        }
      } else {
        stopTimer();
      }
    });

    window.addEventListener("pm-market-source-change", event => {
      installUi();
      if (event.detail?.source === "DAILY") {
        schedule(event.detail?.version, 250);
        refreshChart();
      } else {
        stopTimer();
      }
      renderControls();
    });

    window.addEventListener("pm-market-mode-change", () => {
      if (dailySelected()) refreshChart();
    });

    window.addEventListener("piyasa-market-quotes", () => {
      const asset = selectedAsset();
      if (!asset) return;
      const token = chartRequest;
      setTimeout(() => renderReturns(asset, token), 0);
    });

    window.addEventListener("resize", () => {
      if (dailySelected()) setTimeout(refreshChart, 0);
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && dailySelected()) {
        if (!hasHistory()) schedule(null, 250);
        refreshChart();
      }
    });

    new MutationObserver(() => {
      installUi();
      const asset = selectedAsset();
      if (asset) {
        const token = chartRequest;
        renderReturns(asset, token);
        if (dailySelected()) refreshChart();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  window.PiyasaDailyHistory = {
    retry: () => retry(Number(workspace()?.state?.requestVersion || 0)),
    hasHistory,
    showWaitingState,
    refreshChart,
    refreshReturns: () => {
      const asset = selectedAsset();
      if (asset) return renderReturns(asset, chartRequest);
    },
    get range() { return selectedRange; },
    get interval() { return selectedInterval; },
    _test: {
      INITIAL_CHECK_MS,
      RETRY_MS,
      RANGE_OPTIONS,
      INTERVAL_OPTIONS,
      aggregateHourly,
      aggregateDaily,
      filterRange,
      returnFromRows,
      returnOneYear,
      intervalSupported
    }
  };

  installUi();
  bind();
  const asset = selectedAsset();
  if (asset && dailySelected()) {
    renderReturns(asset, chartRequest);
    refreshChart();
  }
})();