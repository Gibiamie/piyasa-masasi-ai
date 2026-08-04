import fs from 'node:fs/promises';
import path from 'node:path';

const NASDAQ_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true';
const LIVE_MARKET_URL = 'https://gibiamie.github.io/piyasa-masasi-ai/ai-infrastructure-bulletin/mic/data/market.json';
const REPO_MARKET_FILE = 'mic/data/market.json';
const OUTPUT_DIR = 'audit-results';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function isUsAsset(asset) {
  return normalize(asset.exchange) !== 'BIST' && normalize(asset.currency) === 'USD';
}

function mapAssets(json) {
  const rows = (json.assets || [])
    .filter(isUsAsset)
    .map(asset => ({
      symbol: normalize(asset.symbol || asset.ticker || asset.provider_symbol),
      name: asset.name || asset.company || '',
      exchange: normalize(asset.exchange),
      price: asset.price ?? null
    }))
    .filter(row => row.symbol);
  return new Map(rows.map(row => [row.symbol, row]));
}

function parseNasdaq(payload) {
  const rows = payload?.data?.table?.rows;
  if (!Array.isArray(rows)) throw new Error('Nasdaq screener rows not found');
  const mapped = rows
    .map(row => ({
      symbol: normalize(row.symbol),
      name: row.name || '',
      marketCap: row.marketCap || '',
      country: row.country || '',
      sector: row.sector || '',
      industry: row.industry || ''
    }))
    .filter(row => row.symbol);
  return new Map(mapped.map(row => [row.symbol, row]));
}

function markdownTable(rows) {
  if (!rows.length) return '_Yok._';
  return [
    '| Symbol | Company | Market cap | Country | Sector |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.symbol} | ${String(row.name).replaceAll('|', '\\|')} | ${row.marketCap || ''} | ${row.country || ''} | ${row.sector || ''} |`)
  ].join('\n');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://www.nasdaq.com',
      referer: 'https://www.nasdaq.com/'
    }
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const [nasdaqPayload, repoRaw, liveJson] = await Promise.all([
    fetchJson(NASDAQ_URL),
    fs.readFile(REPO_MARKET_FILE, 'utf8'),
    fetchJson(LIVE_MARKET_URL)
  ]);

  const official = parseNasdaq(nasdaqPayload);
  const repo = mapAssets(JSON.parse(repoRaw));
  const live = mapAssets(liveJson);

  if (official.size < 6000) throw new Error(`Unexpected Nasdaq universe count: ${official.size}`);

  const missingRepo = [...official.values()].filter(row => !repo.has(row.symbol));
  const missingLive = [...official.values()].filter(row => !live.has(row.symbol));
  const liveOnly = [...live.values()].filter(row => !official.has(row.symbol));

  const report = {
    generated_at: new Date().toISOString(),
    official_source: NASDAQ_URL,
    live_market_url: LIVE_MARKET_URL,
    counts: {
      nasdaq_screener_symbols: official.size,
      repo_us_symbols: repo.size,
      live_us_symbols: live.size,
      missing_from_repo: missingRepo.length,
      missing_from_live: missingLive.length,
      live_only_not_in_nasdaq_screener: liveOnly.length
    },
    rdw: {
      official: official.get('RDW') || null,
      in_repo: repo.get('RDW') || null,
      in_live: live.get('RDW') || null
    },
    missing_from_live: missingLive,
    missing_from_repo: missingRepo,
    live_only_not_in_nasdaq_screener: liveOnly
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'us-universe-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const md = `# US Universe Audit\n\nGenerated: ${report.generated_at}\n\n- Nasdaq screener symbols: **${official.size}**\n- Repository US symbols: **${repo.size}**\n- Live US symbols: **${live.size}**\n- Missing from live application data: **${missingLive.length}**\n- RDW in Nasdaq source: **${Boolean(report.rdw.official)}**\n- RDW in repository: **${Boolean(report.rdw.in_repo)}**\n- RDW in live data: **${Boolean(report.rdw.in_live)}**\n\n## Missing from live application data\n\n${markdownTable(missingLive)}\n`;
  await fs.writeFile(path.join(OUTPUT_DIR, 'us-universe-audit.md'), md);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
