import fs from 'node:fs/promises';
import path from 'node:path';

const KAP_URL = 'https://www.kap.org.tr/en/Pazarlar';
const NASDAQ_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true';
const OUTPUT = 'ai-infrastructure-bulletin/data/equity-catalog.json';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function parseKap(html) {
  const normalized = html.replace(/\\"/g, '"');
  const start = normalized.indexOf('"title":"EQUITY MARKET"');
  if (start < 0) throw new Error('KAP embedded EQUITY MARKET payload not found');
  const segment = normalized.slice(start);
  const allowed = new Set(['BIST STAR', 'BIST MAIN', 'SUBMARKET', 'WATCHLIST MARKET', 'PRE-MARKET TRADING PLATFORM']);
  const tokenPattern = /"marketName":"([^"]+)"|"stockCode":"([A-Z0-9]{3,8})","title":"([^"]*)"/g;
  const assets = new Map();
  let marketName = null;
  let match;
  while ((match = tokenPattern.exec(segment)) !== null) {
    if (match[1]) {
      const candidate = normalize(match[1]);
      marketName = allowed.has(candidate) ? candidate : null;
      continue;
    }
    if (!marketName || !match[2]) continue;
    const symbol = normalize(match[2]);
    assets.set(`BIST:${symbol}`, {
      key: `BIST:${symbol}`,
      market: 'BIST',
      exchange: 'BIST',
      market_segment: marketName,
      symbol,
      provider_symbol: `${symbol}.IS`,
      name: match[3] || symbol,
      currency: 'TRY',
      type: 'stock'
    });
  }
  return assets;
}

function isOrdinaryEquity(row) {
  const symbol = normalize(row.symbol);
  const name = String(row.name || '');
  if (!symbol || symbol.includes('^')) return false;
  if (/\b(warrant|warrants|right|rights|unit|units)\b/i.test(name)) return false;
  return true;
}

function parseNasdaq(payload) {
  const rows = payload?.data?.rows || payload?.data?.table?.rows;
  if (!Array.isArray(rows)) throw new Error('Nasdaq screener rows not found');
  const assets = new Map();
  for (const row of rows) {
    if (!isOrdinaryEquity(row)) continue;
    const symbol = normalize(row.symbol);
    assets.set(`US:${symbol}`, {
      key: `US:${symbol}`,
      market: 'US',
      exchange: normalize(row.exchange) || 'US',
      symbol,
      provider_symbol: symbol,
      name: row.name || symbol,
      currency: 'USD',
      type: 'stock',
      country: row.country || '',
      sector: row.sector || '',
      industry: row.industry || ''
    });
  }
  return assets;
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const headers = {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    accept: 'application/json,text/html,text/plain,*/*',
    'accept-language': 'en-US,en;q=0.9'
  };
  const [kapHtml, nasdaqPayload] = await Promise.all([
    fetchText(KAP_URL, headers),
    fetchJson(NASDAQ_URL, { ...headers, origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' })
  ]);

  const bist = parseKap(kapHtml);
  const us = parseNasdaq(nasdaqPayload);
  if (bist.size < 600) throw new Error(`Unexpected KAP equity count: ${bist.size}`);
  if (us.size < 6000) throw new Error(`Unexpected US equity count: ${us.size}`);

  const assets = [...bist.values(), ...us.values()].sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
  const required = ['BIST:BURCE', 'BIST:ISATR', 'BIST:ISKUR', 'BIST:UMPAS', 'US:RDW', 'US:CBOE', 'BIST:LINK', 'US:LINK'];
  const keys = new Set(assets.map(asset => asset.key));
  for (const key of required) if (!keys.has(key)) throw new Error(`Required equity missing from official catalogue: ${key}`);

  const output = {
    generated_at: new Date().toISOString(),
    sources: { KAP: KAP_URL, NASDAQ: NASDAQ_URL },
    counts: { BIST: bist.size, US: us.size, TOTAL: assets.length },
    assets
  };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(output)}\n`);
  console.log(JSON.stringify(output.counts));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
