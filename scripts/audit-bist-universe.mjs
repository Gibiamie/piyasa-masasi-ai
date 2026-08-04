import fs from 'node:fs/promises';
import path from 'node:path';

const KAP_URL = 'https://www.kap.org.tr/en/Pazarlar';
const MARKET_FILE = 'mic/data/market.json';
const OUTPUT_DIR = 'audit-results';

function decodeHtml(value) {
  const entities = {
    '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' '
  };
  return value
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, token => entities[token] || token)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function htmlToLines(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
      .replace(/<(br|\/tr|\/td|\/th|\/div|\/li|\/p|\/a|\/span|\/h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, '\n')
  )
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseKapEquities(html) {
  const lines = htmlToLines(html);
  const sectionStart = lines.findIndex(line => /^BIST STAR(?:\s+\d+.*Found)?$/i.test(line));
  const sectionEnd = lines.findIndex((line, index) => index > sectionStart && /^STRUCTURED PRODUCTS AND FUND MARKET(?:\s+\d+.*Found)?$/i.test(line));
  if (sectionStart < 0 || sectionEnd < 0) {
    throw new Error(`KAP market section boundaries not found (start=${sectionStart}, end=${sectionEnd})`);
  }

  const marketHeading = /^(BIST STAR|BIST MAIN|SUBMARKET|WATCHLIST MARKET|PRE-MARKET TRADING PLATFORM)(?:\s+\d+.*Found)?$/i;
  const codePattern = /^[A-Z0-9]{3,6}$/;
  const numberPattern = /^\d+$/;
  const rows = [];
  let market = null;

  for (let index = sectionStart; index < sectionEnd; index += 1) {
    const heading = lines[index].match(marketHeading);
    if (heading) {
      market = heading[1].toUpperCase();
      continue;
    }
    if (!market || !numberPattern.test(lines[index])) continue;
    const code = lines[index + 1];
    const company = lines[index + 2];
    if (!codePattern.test(code || '') || !company || numberPattern.test(company)) continue;
    rows.push({ code, company, market });
    index += 2;
  }

  const byCode = new Map();
  for (const row of rows) byCode.set(row.code, row);
  const equities = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  if (equities.length < 600 || equities.length > 700) {
    throw new Error(`Unexpected KAP equity count: ${equities.length}`);
  }
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
