(function installPiyasaChartFallback(root) {
  "use strict";
  if (typeof window === "undefined" || root.__PIYASA_CHART_FETCH_FALLBACK__) return;
  root.__PIYASA_CHART_FETCH_FALLBACK__ = true;

  const originalFetch = root.fetch.bind(root);
  const RANGE_ROWS = {
    "1d": 2,
    "5d": 8,
    "1mo": 60,
    "3mo": 90,
    "6mo": 150,
    "1y": 270,
    "2y": 540
  };

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase();
  }

  function baseSymbol(value) {
    return normalizeSymbol(value).replace(/\.IS$/, "").replace(/-USD$/, "");
  }

  function unwrapPayload(payload) {
    if (payload && typeof payload.content === "string") {
      try { return JSON.parse(payload.content); } catch (_) {}
    }
    return payload || {};
  }

  function normalizeHistoryRow(row) {
    const close = Number(row?.close);
    if (!Number.isFinite(close)) return null;
    const time = Date.parse(`${row.date}T12:00:00Z`);
    if (!Number.isFinite(time)) return null;
    return {
      timestamp: Math.floor(time / 1000),
      open: Number.isFinite(Number(row.open)) ? Number(row.open) : close,
      high: Number.isFinite(Number(row.high)) ? Number(row.high) : close,
      low: Number.isFinite(Number(row.low)) ? Number(row.low) : close,
      close,
      volume: Number.isFinite(Number(row.volume)) ? Number(row.volume) : 0
    };
  }

  function toYahooChart(payload, requestedSymbol, range) {
    const documentData = unwrapPayload(payload);
    const allRows = (documentData.history || []).map(normalizeHistoryRow).filter(Boolean);
    const limit = RANGE_ROWS[range] || RANGE_ROWS["1mo"];
    const rows = allRows.slice(-Math.min(limit, allRows.length));
    if (!rows.length) throw new Error("MIC_HISTORY_EMPTY");
    const symbol = normalizeSymbol(requestedSymbol);
    const last = rows.at(-1);
    const previous = rows.at(-2) || last;
    return {
      chart: {
        result: [{
          meta: {
            symbol,
            currency: symbol.endsWith(".IS") ? "TRY" : "USD",
            regularMarketPrice: last.close,
            chartPreviousClose: previous.close,
            regularMarketTime: last.timestamp,
            marketState: "CACHED_MIC_HISTORY",
            exchangeDataDelayedBy: 0,
            fullExchangeName: symbol.endsWith(".IS") ? "Borsa Istanbul" : "US Market",
            dataSource: documentData.provider || "MIC history cache",
            dataGranularity: "1d"
          },
          timestamp: rows.map(row => row.timestamp),
          indicators: {
            quote: [{
              open: rows.map(row => row.open),
              high: rows.map(row => row.high),
              low: rows.map(row => row.low),
              close: rows.map(row => row.close),
              volume: rows.map(row => row.volume)
            }]
          }
        }],
        error: null
      }
    };
  }

  function chartRequest(url) {
    try {
      const parsed = new URL(typeof url === "string" ? url : url.url, document.baseURI);
      const match = parsed.pathname.match(/\/v8\/finance\/chart\/([^/]+)$/);
      if (!match) return null;
      return {
        url: parsed,
        symbol: decodeURIComponent(match[1]),
        range: parsed.searchParams.get("range") || "1mo",
        interval: parsed.searchParams.get("interval") || "1d"
      };
    } catch (_) {
      return null;
    }
  }

  function activeChartSymbol() {
    const active = root.PiyasaLiveMarket?.runtime?.activeChart;
    if (!active?.host?.isConnected) return "";
    return baseSymbol(
      active.ticker
      || active.asset?.provider_symbol
      || active.asset?.providerSymbol
      || active.asset?.ticker
      || active.asset?.symbol
    );
  }

  function interactiveChartFallbackAllowed(request) {
    return Boolean(activeChartSymbol()) && activeChartSymbol() === baseSymbol(request.symbol);
  }

  async function micHistoryResponse(request) {
    const symbol = baseSymbol(request.symbol);
    const url = new URL(`../mic/data/history/${encodeURIComponent(symbol)}.json`, document.baseURI).href;
    const response = await originalFetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`MIC_HISTORY_HTTP_${response.status}`);
    const transformed = toYahooChart(await response.json(), request.symbol, request.range);
    return new Response(JSON.stringify(transformed), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Piyasa-Chart-Source": "MIC-HISTORY-FALLBACK"
      }
    });
  }

  root.fetch = async function piyasaFetch(input, init) {
    const request = chartRequest(input);
    if (!request) return originalFetch(input, init);

    const isDailyRange = !["1d", "5d"].includes(request.range) || request.interval === "1d";
    if (isDailyRange) {
      try { return await micHistoryResponse(request); }
      catch (_) { return originalFetch(input, init); }
    }

    try {
      const response = await originalFetch(input, init);
      if (response.ok || !interactiveChartFallbackAllowed(request)) return response;
      return await micHistoryResponse(request);
    } catch (error) {
      if (interactiveChartFallbackAllowed(request)) return micHistoryResponse(request);
      throw error;
    }
  };

  root.PiyasaChartFallback = {
    baseSymbol,
    unwrapPayload,
    normalizeHistoryRow,
    toYahooChart,
    chartRequest,
    interactiveChartFallbackAllowed
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
