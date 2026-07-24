import http from 'node:http';
import { URL } from 'node:url';
import ccxt from 'ccxt';

const PORT = Number(process.env.PORT || 8788);
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'https://gibiamie.github.io').split(',').map(x => x.trim()).filter(Boolean));
const GATEWAY_TOKEN = process.env.MIC_GATEWAY_TOKEN || '';
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 90);
const buckets = new Map();

function json(res, status, body, origin = '') {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? 'public, max-age=30' : 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function rateAllowed(ip) {
  const now = Date.now(), minute = Math.floor(now / 60000), key = `${ip}:${minute}`;
  const count = (buckets.get(key) || 0) + 1;
  buckets.set(key, count);
  if (buckets.size > 5000) {
    for (const k of buckets.keys()) if (!k.endsWith(`:${minute}`)) buckets.delete(k);
  }
  return count <= RATE_LIMIT_PER_MINUTE;
}

function authAllowed(req) {
  if (!GATEWAY_TOKEN) return true;
  return req.headers.authorization === `Bearer ${GATEWAY_TOKEN}`;
}

function normalizeInterval(value) {
  const x = String(value || '').toLowerCase();
  if (['1h', '1hour'].includes(x)) return '1h';
  if (['4h', '4hour'].includes(x)) return '4h';
  if (['1d', '1day'].includes(x)) return '1d';
  throw new Error('interval yalnızca 1h, 4h veya 1d olabilir');
}

function aggregateFourHours(bars) {
  const groups = new Map();
  for (const bar of bars) {
    const time = new Date(bar.timestamp);
    const hour = Math.floor(time.getUTCHours() / 4) * 4;
    const key = `${time.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bar);
  }
  return [...groups.entries()].map(([timestamp, rows]) => ({
    timestamp,
    open: rows[0].open,
    high: Math.max(...rows.map(x => x.high)),
    low: Math.min(...rows.map(x => x.low)),
    close: rows.at(-1).close,
    volume: rows.reduce((sum, x) => sum + (x.volume || 0), 0),
    source_bar_count: rows.length
  }));
}

async function alpacaBars(symbol, interval, start, end, limit) {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) {
    const error = new Error('Alpaca sunucu anahtarları yapılandırılmadı');
    error.status = 503;
    throw error;
  }
  const requested = interval === '4h' ? '1h' : interval;
  const timeframe = requested === '1h' ? '1Hour' : '1Day';
  const params = new URLSearchParams({ timeframe, feed: process.env.ALPACA_FEED || 'iex', adjustment: 'all', limit: String(Math.min(limit, 10000)), sort: 'asc' });
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const endpoint = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`;
  const response = await fetch(endpoint, { headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Alpaca HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const native = (payload.bars || []).map(x => ({ timestamp: x.t, open: x.o, high: x.h, low: x.l, close: x.c, volume: x.v, trades: x.n, vwap: x.vw }));
  const bars = interval === '4h' ? aggregateFourHours(native) : native;
  return {
    market: 'US', symbol, interval, provider: 'ALPACA', feed: process.env.ALPACA_FEED || 'iex',
    data_class: interval === '4h' ? 'AGGREGATED_FROM_1H' : 'PROVIDER_NATIVE_BAR',
    source_interval: interval === '4h' ? '1h' : interval, delayed_or_limited: (process.env.ALPACA_FEED || 'iex') === 'iex', bars
  };
}

async function cryptoBars(symbol, interval, since, limit) {
  const exchangeId = process.env.CCXT_EXCHANGE || 'kraken';
  const Exchange = ccxt[exchangeId];
  if (!Exchange) throw Object.assign(new Error(`Desteklenmeyen CCXT borsası: ${exchangeId}`), { status: 400 });
  const exchange = new Exchange({ enableRateLimit: true });
  await exchange.loadMarkets();
  if (!exchange.has.fetchOHLCV) throw Object.assign(new Error(`${exchangeId} OHLCV sağlamıyor`), { status: 503 });
  const nativeTimeframes = exchange.timeframes || {};
  const requestedNative = Boolean(nativeTimeframes[interval]);
  const fetchInterval = requestedNative ? interval : interval === '4h' && nativeTimeframes['1h'] ? '1h' : interval;
  if (!nativeTimeframes[fetchInterval]) throw Object.assign(new Error(`${exchangeId}, ${interval} mumunu desteklemiyor`), { status: 400 });
  const raw = await exchange.fetchOHLCV(symbol, fetchInterval, since ? Date.parse(since) : undefined, Math.min(limit, 1000));
  const native = raw.map(x => ({ timestamp: new Date(x[0]).toISOString(), open: x[1], high: x[2], low: x[3], close: x[4], volume: x[5] }));
  const bars = interval === '4h' && fetchInterval === '1h' ? aggregateFourHours(native) : native;
  return {
    market: 'CRYPTO', symbol, interval, provider: `CCXT:${exchangeId}`,
    data_class: interval === '4h' && fetchInterval === '1h' ? 'AGGREGATED_FROM_1H' : 'PROVIDER_NATIVE_BAR',
    source_interval: fetchInterval, bars
  };
}

async function bistBars(query) {
  const providerUrl = process.env.BIST_LICENSED_PROVIDER_URL;
  const token = process.env.BIST_LICENSED_PROVIDER_TOKEN;
  if (!providerUrl) {
    const error = new Error('BIST 1s/4s herkese açık dağıtımı kapalıdır; lisanslı veri sağlayıcısı yapılandırılmalıdır');
    error.status = 503;
    error.code = 'BIST_LICENSED_PROVIDER_REQUIRED';
    throw error;
  }
  const upstream = new URL(providerUrl);
  for (const [key, value] of query.entries()) upstream.searchParams.set(key, value);
  const response = await fetch(upstream, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.message || `BIST sağlayıcı HTTP ${response.status}`), { status: response.status });
  return { ...payload, market: 'BIST', provider: payload.provider || 'LICENSED_BIST_VENDOR', data_class: payload.data_class || 'PROVIDER_NATIVE_BAR' };
}

async function route(req, res) {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'origin_not_allowed' });
    res.writeHead(204, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'authorization,content-type', vary: 'Origin' });
    return res.end();
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' }, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'origin_not_allowed' });
  if (!authAllowed(req)) return json(res, 401, { error: 'unauthorized' }, origin);
  const ip = req.socket.remoteAddress || 'unknown';
  if (!rateAllowed(ip)) return json(res, 429, { error: 'rate_limit_exceeded' }, origin);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') return json(res, 200, { ok: true, service: 'mic-market-gateway', version: '0.1.0' }, origin);
  if (url.pathname !== '/api/v1/bars') return json(res, 404, { error: 'not_found' }, origin);

  try {
    const market = String(url.searchParams.get('market') || '').toUpperCase();
    const symbol = String(url.searchParams.get('symbol') || '').trim();
    const interval = normalizeInterval(url.searchParams.get('interval'));
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';
    const limit = Math.max(10, Math.min(Number(url.searchParams.get('limit') || 1000), 10000));
    if (!symbol) throw Object.assign(new Error('symbol zorunludur'), { status: 400 });
    let result;
    if (market === 'US') result = await alpacaBars(symbol.toUpperCase(), interval, start, end, limit);
    else if (market === 'CRYPTO') result = await cryptoBars(symbol, interval, start, limit);
    else if (market === 'BIST') result = await bistBars(url.searchParams);
    else throw Object.assign(new Error('market yalnızca US, CRYPTO veya BIST olabilir'), { status: 400 });
    json(res, 200, { ...result, generated_at: new Date().toISOString(), manipulation: false }, origin);
  } catch (error) {
    json(res, Number(error.status || 500), { error: error.code || 'provider_error', message: error.message }, origin);
  }
}

http.createServer(route).listen(PORT, '0.0.0.0', () => console.log(`MIC Market Gateway listening on ${PORT}`));
