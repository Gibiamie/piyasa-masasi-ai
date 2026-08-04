import fs from 'node:fs/promises';
import path from 'node:path';

const KAP_URL = 'https://www.kap.org.tr/en/Pazarlar';
const MARKET_FILE = 'mic/data/market.json';
const OUTPUT_DIR = 'audit-results';

function decodeEscapedJsonString(value) {
  try { return JSON.parse(`"${value.replaceAll('"', '\\"')}"`); }
  catch (_) {
    return value
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function parseKapEquities(html) {
  const equityStartToken = '\\"title\\":\\"EQUITY MARKET\\"';
  const structuredStartToken = 'STRUCTURED PRODUCTS AND FUND MARKET';
  const start = html.indexOf(equityStartToken);
  const end = html.indexOf(structuredStartToken, start + equityStartToken.length);
  if (start < 0 || end < 0) throw new Error(`KAP embedded market payload boundaries not found (start=${start}, end=${end})`);

  const segment = html.slice(start, end);
  const tokenPattern = /\\"marketName\\":\\"([^"\\]+)\\"|\\"stockCode\\":\\"([A-Z0-9]{3,8})\\",\\"title\\":\\"((?:\\.|[^"\\])*)\\"/g;
  const allowedMarkets = new Set(['BIST STAR', 'BIST MAIN', 'SUBMARKET', 'WATCHLIST MARKET', 'PRE-MARKET TRADING PLATFORM']);
  const byCode = new Map();
  let currentMarket = null;
  let match;

  while ((match = tokenPattern.exec(segment)) !== null) {
    if (match[1]) {
      const market = decodeEscapedJsonString(match[1]).toUpperCase();
      currentMarket = allowedMarkets.has(market) ? market : null;
      continue;
    }
    if (!currentMarket || !match[2]) continue;
    byCode.set(match[2], {
      code: match[2],
      company: decodeEscapedJsonString(match[3]),
      market: currentMarket
    });
  }

  const equities = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  if (equities.length < 600 || equities.length > 700) throw new Error(`Unexpected KAP equity count: ${equities.length}`);
  if (!byCode.has('BURCE')) throw new Error('KAP parser did not find BURCE');
  return equities;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/\.IS$/, '');
}

function markdownTable(rows, columns) {
  if (!rows.length) return '_Yok._';
  const header = `| ${columns.map(column => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(column => String(row[column.key] ?? '').replaceAll('|', '\\|')).join(' | ')} |`).join('\n');
  return `${header}\n${divider}\n${body}`;
}

async function main() {
  const [marketRaw, kapResponse] = await Promise.all([
    fs.readFile(MARKET_FILE, 'utf8'),
    fetch(KAP_URL, { headers: { 'user-agent': 'Mozilla/5.0 Piyasa-Masasi-Audit/1.0', accept: 'text/html' } })
  ]);
  if (!kapResponse.ok) throw new Error(`KAP HTTP ${kapResponse.status}`);

  const marketJson = JSON.parse(marketRaw);
  const appRows = (marketJson.assets || [])
    .filter(asset => String(asset.exchange || '').toUpperCase() === 'BIST')
    .map(asset => ({ code: normalizeSymbol(asset.symbol || asset.ticker || asset.provider_symbol), name: asset.name || asset.company || '', price: asset.price ?? null }))
    .filter(asset => asset.code);
  const appMap = new Map(appRows.map(row => [row.code, row]));
  const officialRows = parseKapEquities(await kapResponse.text());
  const officialMap = new Map(officialRows.map(row => [row.code, row]));
  const missing = officialRows.filter(row => !appMap.has(row.code));
  const extra = [...appMap.values()].filter(row => !officialMap.has(row.code)).sort((a, b) => a.code.localeCompare(b.code));
  const common = officialRows.filter(row => appMap.has(row.code));

  const report = {
    generated_at: new Date().toISOString(),
    official_source: KAP_URL,
    app_market_file: MARKET_FILE,
    counts: {
      kap_equities: officialRows.length,
      app_bist_symbols: appMap.size,
      matched: common.length,
      missing_from_app: missing.length,
      app_only_not_in_current_kap_equity_markets: extra.length
    },
    missing_from_app: missing,
    app_only_not_in_current_kap_equity_markets: extra
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'bist-universe-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = `# BIST Universe Audit\n\nGenerated: ${report.generated_at}\n\n- KAP current equity symbols: **${report.counts.kap_equities}**\n- Application BIST symbols: **${report.counts.app_bist_symbols}**\n- Matched: **${report.counts.matched}**\n- Missing from application: **${report.counts.missing_from_app}**\n- Application-only / not in current KAP equity markets: **${report.counts.app_only_not_in_current_kap_equity_markets}**\n\n## Missing from application\n\n${markdownTable(missing, [{ key: 'code', label: 'Code' }, { key: 'company', label: 'Company' }, { key: 'market', label: 'KAP market' }])}\n\n## Application-only / not in current KAP equity markets\n\n${markdownTable(extra, [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Application name' }, { key: 'price', label: 'Price' }])}\n`;
  await fs.writeFile(path.join(OUTPUT_DIR, 'bist-universe-audit.md'), markdown);
  console.log(JSON.stringify(report, null, 2));
  if (!missing.some(row => row.code === 'BURCE')) throw new Error('Expected BURCE to be missing from application, but comparison did not show it');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
