import fs from 'node:fs/promises';
import path from 'node:path';

const KAP_URL = 'https://www.kap.org.tr/en/Pazarlar';
const LOCAL_MARKET_FILE = 'mic/data/market.json';
const LIVE_MARKET_URL = 'https://gibiamie.github.io/piyasa-masasi-ai/mic/data/market.json';
const OUTPUT_DIR = 'audit-results';

function parseKapEquities(html) {
  const normalized = html.replace(/\\"/g, '"');
  const start = normalized.indexOf('"title":"EQUITY MARKET"');
  if (start < 0) throw new Error('KAP embedded EQUITY MARKET payload not found');

  const segment = normalized.slice(start);
  const tokenPattern = /"marketName":"([^"]+)"|"stockCode":"([A-Z0-9]{3,8})","title":"([^"]*)"/g;
  const allowedMarkets = new Set(['BIST STAR', 'BIST MAIN', 'SUBMARKET', 'WATCHLIST MARKET', 'PRE-MARKET TRADING PLATFORM']);
  const byCode = new Map();
  let currentMarket = null;
  let match;

  while ((match = tokenPattern.exec(segment)) !== null) {
    if (match[1]) {
      const market = match[1].toUpperCase();
      currentMarket = allowedMarkets.has(market) ? market : null;
      continue;
    }
    if (!currentMarket || !match[2]) continue;
    byCode.set(match[2], { code: match[2], company: match[3], market: currentMarket });
  }

  const equities = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  if (equities.length < 600 || equities.length > 700) throw new Error(`Unexpected KAP equity count: ${equities.length}`);
  if (!byCode.has('BURCE')) throw new Error('KAP parser did not find BURCE');
  return equities;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/\.IS$/, '');
}

function buildApplicationMap(marketJson) {
  const rows = (marketJson.assets || [])
    .filter(asset => String(asset.exchange || '').toUpperCase() === 'BIST')
    .map(asset => ({
      code: normalizeSymbol(asset.symbol || asset.ticker || asset.provider_symbol),
      name: asset.name || asset.company || '',
      price: asset.price ?? null
    }))
    .filter(asset => asset.code);
  return new Map(rows.map(row => [row.code, row]));
}

function compareUniverse(officialRows, applicationMap) {
  const officialMap = new Map(officialRows.map(row => [row.code, row]));
  const missing = officialRows.filter(row => !applicationMap.has(row.code));
  const extra = [...applicationMap.values()]
    .filter(row => !officialMap.has(row.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return {
    counts: {
      app_bist_symbols: applicationMap.size,
      matched: officialRows.length - missing.length,
      missing_from_app: missing.length,
      app_only_not_in_current_kap_equity_markets: extra.length
    },
    missing_from_app: missing,
    app_only_not_in_current_kap_equity_markets: extra,
    contains_burce: applicationMap.has('BURCE')
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return '_Yok._';
  const header = `| ${columns.map(column => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(column => String(row[column.key] ?? '').replaceAll('|', '\\|')).join(' | ')} |`).join('\n');
  return `${header}\n${divider}\n${body}`;
}

function reportSection(title, result) {
  return `## ${title}\n\n- Application BIST symbols: **${result.counts.app_bist_symbols}**\n- Matched with KAP: **${result.counts.matched}**\n- Missing from application: **${result.counts.missing_from_app}**\n- Application-only / not in current KAP equity markets: **${result.counts.app_only_not_in_current_kap_equity_markets}**\n- BURCE present: **${result.contains_burce ? 'yes' : 'no'}**\n\n### Missing from application\n\n${markdownTable(result.missing_from_app, [{ key: 'code', label: 'Code' }, { key: 'company', label: 'Company' }, { key: 'market', label: 'KAP market' }])}\n\n### Application-only / not in current KAP equity markets\n\n${markdownTable(result.app_only_not_in_current_kap_equity_markets, [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Application name' }, { key: 'price', label: 'Price' }])}\n`;
}

async function main() {
  const [localRaw, kapResponse, liveResponse] = await Promise.all([
    fs.readFile(LOCAL_MARKET_FILE, 'utf8'),
    fetch(KAP_URL, { headers: { 'user-agent': 'Mozilla/5.0 Piyasa-Masasi-Audit/1.0', accept: 'text/html' } }),
    fetch(`${LIVE_MARKET_URL}?audit=${Date.now()}`, { cache: 'no-store', headers: { 'user-agent': 'Mozilla/5.0 Piyasa-Masasi-Audit/1.0', accept: 'application/json' } })
  ]);
  if (!kapResponse.ok) throw new Error(`KAP HTTP ${kapResponse.status}`);
  if (!liveResponse.ok) throw new Error(`Live market HTTP ${liveResponse.status}`);

  const officialRows = parseKapEquities(await kapResponse.text());
  const localMarket = JSON.parse(localRaw);
  const liveMarket = await liveResponse.json();
  const local = compareUniverse(officialRows, buildApplicationMap(localMarket));
  const live = compareUniverse(officialRows, buildApplicationMap(liveMarket));

  const report = {
    generated_at: new Date().toISOString(),
    official_source: KAP_URL,
    kap_equities: officialRows.length,
    local_source: LOCAL_MARKET_FILE,
    live_source: LIVE_MARKET_URL,
    local_market_updated_at: localMarket.updated_at || null,
    live_market_updated_at: liveMarket.updated_at || null,
    local,
    live
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'bist-universe-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = `# BIST Universe Audit\n\nGenerated: ${report.generated_at}\n\n- KAP current equity symbols: **${report.kap_equities}**\n- Local market updated at: **${report.local_market_updated_at || 'unknown'}**\n- Live Pages market updated at: **${report.live_market_updated_at || 'unknown'}**\n\n${reportSection('Repository market.json', local)}\n${reportSection('Live GitHub Pages market.json', live)}\n`;
  await fs.writeFile(path.join(OUTPUT_DIR, 'bist-universe-audit.md'), markdown);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
