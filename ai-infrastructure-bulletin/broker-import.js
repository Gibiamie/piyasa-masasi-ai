(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BrokerPortfolioImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  const HEADER_ALIASES = {
    symbol: ["kod", "sembol", "ticker", "symbol", "hisse kodu", "varlik kodu", "asset code", "security code"],
    name: ["varlik", "varlik adi", "hisse adi", "sirket", "sirket adi", "unvan", "name", "asset", "company", "security"],
    quantity: ["adet", "lot", "miktar", "quantity", "qty", "units", "shares"],
    averageCost: ["maliyet", "ortalama maliyet", "ort maliyet", "average cost", "avg cost", "cost basis", "unit cost"],
    currentPrice: ["fiyat", "son fiyat", "guncel fiyat", "piyasa fiyati", "current price", "last price", "market price"],
    marketValue: ["tutar", "piyasa degeri", "portfoy degeri", "market value", "position value", "total value"],
    currency: ["para birimi", "doviz", "currency", "ccy"],
    assetType: ["varlik turu", "urun turu", "asset type", "security type", "type"],
    date: ["tarih", "duzenleme tarihi", "rapor tarihi", "statement date", "as of date"]
  };

  function fold(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[ıİ]/g, "i")
      .replace(/[şŞ]/g, "s")
      .replace(/[ğĞ]/g, "g")
      .replace(/[üÜ]/g, "u")
      .replace(/[öÖ]/g, "o")
      .replace(/[çÇ]/g, "c")
      .replace(/[^a-z0-9%]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseLocaleNumber(value, options = {}) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let text = String(value ?? "").trim();
    if (!text || /^[-–—]$/.test(text)) return null;
    let negative = false;
    if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
    text = text.replace(/\s/g, "").replace(/[%₺$€£]/g, "").replace(/[−–—]/g, "-");
    if (text.startsWith("-")) { negative = !negative; text = text.slice(1); }
    if (!/[0-9]/.test(text)) return null;

    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");
    let normalized;
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? "," : ".";
      const thousands = decimal === "," ? /\./g : /,/g;
      normalized = text.replace(thousands, "").replace(decimal, ".");
    } else if (comma >= 0) {
      normalized = text.replace(/\./g, "").replace(",", ".");
    } else if (dot >= 0) {
      const parts = text.split(".");
      if (options.dotDecimal) normalized = `${parts.slice(0, -1).join("") || "0"}.${parts.at(-1)}`;
      else if (parts.length > 2) normalized = parts.join("");
      else if (parts.at(-1).length === 3 && options.preferThousands !== false) normalized = parts.join("");
      else normalized = text;
    } else normalized = text;

    const number = Number(normalized.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(number)) return null;
    return negative ? -number : number;
  }

  function quantityCandidates(value) {
    if (typeof value === "number") return [value];
    const text = String(value ?? "").trim();
    const candidates = new Set();
    const standard = parseLocaleNumber(text, { preferThousands: true });
    const decimalDot = parseLocaleNumber(text, { dotDecimal: true, preferThousands: false });
    const plain = Number(text.replace(/[^0-9.-]/g, ""));
    [standard, decimalDot, plain].forEach(number => { if (Number.isFinite(number) && number >= 0) candidates.add(number); });
    return [...candidates];
  }

  function reconcileQuantity(value, currentPrice, marketValue) {
    const candidates = quantityCandidates(value);
    if (!candidates.length) return null;
    const price = finite(currentPrice);
    const total = finite(marketValue);
    if (!(price > 0) || total === null) return candidates[0];
    return candidates.sort((a, b) => Math.abs(a * price - total) - Math.abs(b * price - total))[0];
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && value > 20000 && value < 90000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + value);
      return epoch.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    let match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    match = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9.^=-]/g, "");
  }

  function inferAssetType(value, symbol) {
    const text = fold(value);
    if (/kripto|crypto|coin/.test(text) || /-(USD|USDT|TRY)$/.test(symbol)) return "CRYPTO";
    if (/emtia|commodity|gold|silver|altin|gumus/.test(text)) return "COMMODITY";
    if (/etf/.test(text)) return "ETF";
    if (/fon|fund/.test(text)) return "FUND";
    if (/doviz|forex|currency|fx/.test(text)) return "FX";
    return "STOCK";
  }

  function normalizeHolding(raw, defaults = {}) {
    const symbol = normalizeSymbol(raw.symbol);
    const currentPrice = parseLocaleNumber(raw.currentPrice, { preferThousands: false });
    const marketValue = parseLocaleNumber(raw.marketValue, { preferThousands: true });
    const quantity = reconcileQuantity(raw.quantity, currentPrice, marketValue);
    const averageCost = parseLocaleNumber(raw.averageCost, { preferThousands: false });
    const currency = String(raw.currency || defaults.currency || "TRY").trim().toUpperCase().slice(0, 5);
    const date = parseDate(raw.date) || defaults.date || new Date().toISOString().slice(0, 10);
    const assetType = inferAssetType(raw.assetType || defaults.assetType, symbol);
    const unit = String(raw.unit || defaults.unit || (assetType === "STOCK" ? "lot" : "unit")).trim().toLowerCase();
    const errors = [];
    if (!symbol) errors.push("MISSING_SYMBOL");
    if (!(quantity > 0)) errors.push("INVALID_QUANTITY");
    if (!(averageCost >= 0)) errors.push("INVALID_AVERAGE_COST");
    if (currentPrice !== null && currentPrice < 0) errors.push("INVALID_CURRENT_PRICE");
    return {
      symbol,
      name: String(raw.name || symbol).trim(),
      quantity,
      averageCost,
      currentPrice,
      marketValue,
      currency,
      date,
      assetType,
      unit,
      errors,
      sourceRow: raw.sourceRow ?? null
    };
  }

  function headerField(value) {
    const normalized = fold(value);
    let best = null;
    let bestScore = 0;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        const target = fold(alias);
        const score = normalized === target ? 100 : normalized.includes(target) ? 70 + target.length : 0;
        if (score > bestScore) { best = field; bestScore = score; }
      }
    }
    return best;
  }

  function findHeader(matrix) {
    let best = null;
    for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 40); rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const mapping = {};
      row.forEach((cell, columnIndex) => {
        const field = headerField(cell);
        if (field && mapping[field] === undefined) mapping[field] = columnIndex;
      });
      const required = ["symbol", "quantity", "averageCost"].filter(field => mapping[field] !== undefined).length;
      const score = required * 10 + Object.keys(mapping).length;
      if (!best || score > best.score) best = { rowIndex, mapping, score };
    }
    return best && best.score >= 33 ? best : null;
  }

  function statementDateFromMatrix(matrix) {
    for (const row of matrix.slice(0, 30)) {
      const joined = row.map(value => String(value ?? "")).join(" ");
      const date = parseDate(joined);
      if (date && /(duzenleme|rapor|statement|as of|tarih)/i.test(fold(joined))) return date;
    }
    return null;
  }

  function parseGenericMatrix(matrix, metadata = {}) {
    const header = findHeader(matrix);
    if (!header) throw new Error("PORTFOLIO_COLUMNS_NOT_FOUND");
    const date = metadata.date || statementDateFromMatrix(matrix) || null;
    const rows = [];
    let blankStreak = 0;
    for (let index = header.rowIndex + 1; index < matrix.length; index += 1) {
      const row = matrix[index] || [];
      const cells = row.map(value => String(value ?? "").trim());
      if (cells.every(value => !value)) { blankStreak += 1; if (blankStreak >= 4) break; continue; }
      blankStreak = 0;
      const symbolCell = row[header.mapping.symbol];
      if (/toplam|total/i.test(fold(symbolCell))) break;
      const raw = { sourceRow: index + 1, date };
      for (const [field, columnIndex] of Object.entries(header.mapping)) raw[field] = row[columnIndex];
      const holding = normalizeHolding(raw, { currency: metadata.currency || "TRY", date });
      if (!holding.symbol && holding.quantity === null && holding.averageCost === null) continue;
      rows.push(holding);
    }
    return {
      broker: metadata.broker || "Generic broker",
      statementDate: date,
      sourceType: metadata.sourceType || "SPREADSHEET",
      holdings: rows,
      warnings: rows.some(row => row.errors.length) ? ["ROWS_REQUIRE_REVIEW"] : [],
      adapter: "GENERIC_TABLE"
    };
  }

  function parseMappedMatrix(matrix, mapping, headerRowIndex = 0, metadata = {}) {
    const rows = [];
    const date = metadata.date || statementDateFromMatrix(matrix) || null;
    let blankStreak = 0;
    for (let index = Number(headerRowIndex) + 1; index < matrix.length; index += 1) {
      const row = matrix[index] || [];
      const cells = row.map(value => String(value ?? "").trim());
      if (cells.every(value => !value)) { blankStreak += 1; if (blankStreak >= 4) break; continue; }
      blankStreak = 0;
      const raw = { sourceRow: index + 1, date };
      for (const [field, columnIndex] of Object.entries(mapping || {})) {
        if (columnIndex !== "" && columnIndex !== null && columnIndex !== undefined) raw[field] = row[Number(columnIndex)];
      }
      if (/toplam|total/i.test(fold(raw.symbol))) break;
      const holding = normalizeHolding(raw, { currency: metadata.currency || "TRY", date });
      if (!holding.symbol && holding.quantity === null && holding.averageCost === null) continue;
      rows.push(holding);
    }
    return {
      broker: metadata.broker || "Generic broker",
      statementDate: date,
      sourceType: metadata.sourceType || "SPREADSHEET",
      holdings: rows,
      warnings: rows.some(row => row.errors.length) ? ["ROWS_REQUIRE_REVIEW"] : [],
      adapter: "MANUAL_COLUMN_MAPPING"
    };
  }

  function groupPdfItems(items, tolerance = 2.2) {
    const rows = [];
    for (const item of items) {
      const text = String(item.str ?? item.text ?? "").trim();
      if (!text) continue;
      const x = Number(item.x ?? item.transform?.[4] ?? 0);
      const y = Number(item.y ?? item.transform?.[5] ?? item.top ?? 0);
      let row = rows.find(candidate => Math.abs(candidate.y - y) <= tolerance);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, text });
    }
    return rows.sort((a, b) => b.y - a.y).map(row => ({ ...row, items: row.items.sort((a, b) => a.x - b.x), text: row.items.map(item => item.text).join(" ") }));
  }

  function parseOsmanliPdfItems(pages) {
    const holdings = [];
    let statementDate = null;
    const allText = [];
    for (const pageItems of pages) {
      const rows = groupPdfItems(pageItems);
      allText.push(...rows.map(row => row.text));
      for (const row of rows) {
        const date = parseDate(row.text);
        if (date && /duzenleme|tarihi/i.test(fold(row.text))) statementDate = date;
        const symbolItem = row.items.find(item => item.x < 65 && /^[A-Z0-9]{2,12}$/.test(item.text));
        if (!symbolItem) continue;
        const columns = {
          symbol: symbolItem.text,
          quantity: row.items.find(item => item.x >= 60 && item.x < 116)?.text,
          averageCost: row.items.find(item => item.x >= 116 && item.x < 160)?.text,
          currentPrice: row.items.find(item => item.x >= 205 && item.x < 255)?.text,
          marketValue: row.items.find(item => item.x >= 520)?.text,
          date: statementDate,
          currency: "TRY",
          assetType: "STOCK",
          unit: "lot"
        };
        const holding = normalizeHolding(columns, { currency: "TRY", date: statementDate, assetType: "STOCK", unit: "lot" });
        if (holding.symbol && holding.quantity > 0 && holding.averageCost >= 0) holdings.push(holding);
      }
    }
    const text = allText.join(" ");
    if (!/osmanli yatirim/i.test(fold(text)) || !/hisse portfoyum/i.test(fold(text))) throw new Error("UNSUPPORTED_PDF_TEMPLATE");
    if (!holdings.length) throw new Error("PORTFOLIO_ROWS_NOT_FOUND");
    return {
      broker: "Osmanlı Yatırım Menkul Değerler A.Ş.",
      statementDate,
      sourceType: "PDF",
      holdings,
      warnings: holdings.some(row => row.errors.length) ? ["ROWS_REQUIRE_REVIEW"] : [],
      adapter: "OSMANLI_PORTFOLIO_PDF"
    };
  }

  function loadScript(src, globalName) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-library="${globalName}"]`);
      if (existing) { existing.addEventListener("load", () => resolve(root[globalName]), { once: true }); existing.addEventListener("error", reject, { once: true }); return; }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.library = globalName;
      script.onload = () => root[globalName] ? resolve(root[globalName]) : reject(new Error(`LIBRARY_NOT_AVAILABLE:${globalName}`));
      script.onerror = () => reject(new Error(`LIBRARY_LOAD_FAILED:${globalName}`));
      document.head.appendChild(script);
    });
  }

  async function parsePdf(file) {
    const pdfjsLib = await loadScript(PDFJS_URL, "pdfjsLib");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    const data = new Uint8Array(await file.arrayBuffer());
    const documentRef = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= documentRef.numPages; pageNumber += 1) {
      const page = await documentRef.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items);
    }
    const folded = fold(pages.flat().map(item => item.str).join(" "));
    if (folded.includes("osmanli yatirim") && folded.includes("hisse portfoyum")) return parseOsmanliPdfItems(pages);
    throw new Error("UNSUPPORTED_PDF_TEMPLATE");
  }

  async function parseSpreadsheet(file) {
    const XLSX = await loadScript(XLSX_URL, "XLSX");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
    let best = null;
    const rawSheets = [];
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
      rawSheets.push({ name: sheetName, matrix });
      try {
        const parsed = parseGenericMatrix(matrix, { sourceType: /csv/i.test(file.name) ? "CSV" : "SPREADSHEET" });
        if (!best || parsed.holdings.length > best.holdings.length) best = { ...parsed, sheetName };
      } catch (_) {}
    }
    if (best) return best;
    return {
      broker: "Generic broker",
      statementDate: null,
      sourceType: /csv/i.test(file.name) ? "CSV" : "SPREADSHEET",
      holdings: [],
      warnings: ["COLUMN_MAPPING_REQUIRED"],
      adapter: "MANUAL_COLUMN_MAPPING",
      mappingRequired: true,
      rawSheets
    };
  }

  function parseJson(text) {
    const payload = JSON.parse(text);
    if (!payload || payload.version !== 1 || !Array.isArray(payload.transactions)) throw new Error("INVALID_BACKUP");
    return { sourceType: "JSON", backup: payload, holdings: [], broker: payload.source?.broker || "Piyasa Masası AI", statementDate: payload.source?.statementDate || null, adapter: "PIYASA_MASASI_BACKUP", warnings: [] };
  }

  async function parseFile(file) {
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".json")) return parseJson(await file.text());
    if (name.endsWith(".pdf")) return parsePdf(file);
    if (/\.(xlsx|xls|csv)$/i.test(name)) return parseSpreadsheet(file);
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  function stableId(prefix, holding, index) {
    const text = `${prefix}|${holding.symbol}|${holding.currency}|${holding.unit}|${holding.date}|${index}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return `${prefix}-${holding.symbol.toLowerCase()}-${(hash >>> 0).toString(16)}`;
  }

  function holdingsToPortfolio(holdings, options = {}) {
    const date = options.date || holdings.find(item => item.date)?.date || new Date().toISOString().slice(0, 10);
    const sourceLabel = options.sourceLabel || "Broker portfolio statement";
    const transactions = [];
    const manualPrices = {};
    holdings.forEach((row, index) => {
      const holding = normalizeHolding({ ...row, date: row.date || date }, { currency: options.currency || "TRY", date });
      if (holding.errors.length) return;
      const id = stableId("opening", holding, index);
      transactions.push({
        id,
        createdAt: `${holding.date}T12:00:00.000Z`,
        date: holding.date,
        assetType: holding.assetType,
        symbol: holding.symbol,
        name: holding.name || holding.symbol,
        currency: holding.currency,
        unit: holding.unit,
        side: "BUY",
        quantity: holding.quantity,
        unitPrice: holding.averageCost,
        fee: 0,
        notes: `${sourceLabel} · opening position as of ${holding.date}`
      });
      if (holding.currentPrice !== null) {
        const key = `${holding.assetType}|${holding.symbol}|${holding.currency}|${holding.unit}`;
        manualPrices[key] = { price: holding.currentPrice, date: holding.date, source: "manual" };
      }
    });
    return { version: 1, transactions, manualPrices };
  }

  return {
    HEADER_ALIASES,
    fold,
    parseLocaleNumber,
    reconcileQuantity,
    parseDate,
    normalizeHolding,
    findHeader,
    parseGenericMatrix,
    parseMappedMatrix,
    groupPdfItems,
    parseOsmanliPdfItems,
    parseJson,
    parseFile,
    holdingsToPortfolio
  };
});
