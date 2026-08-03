"use strict";

(function extendBrokerImportWithLocalFileReaders() {
  if (typeof BrokerPortfolioImport === "undefined") return;

  const originalParseDate = BrokerPortfolioImport.parseDate;
  BrokerPortfolioImport.parseDate = function parseDateFromCompactText(value) {
    const parsed = originalParseDate(value);
    if (parsed) return parsed;
    const text = String(value ?? "");
    let match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    return null;
  };

  const PDF_LIBRARY_SOURCES = [
    "./vendor/pdf.min.js?v=3.11.174",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
  ];
  const PDF_WORKER_SOURCE = "./vendor/pdf.worker.min.js?v=3.11.174";
  const XLSX_LIBRARY_SOURCES = [
    "./vendor/xlsx.full.min.js?v=0.18.5",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  ];

  function detectDelimiter(text) {
    const sample = String(text || "").split(/\r?\n/).filter(line => line.trim()).slice(0, 12);
    const candidates = [";", ",", "\t", "|"];
    return candidates.map(delimiter => {
      const counts = sample.map(line => {
        let count = 0;
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
          const char = line[index];
          if (char === '"') {
            if (quoted && line[index + 1] === '"') index += 1;
            else quoted = !quoted;
          } else if (!quoted && char === delimiter) count += 1;
        }
        return count;
      });
      const positive = counts.filter(count => count > 0);
      const consistency = positive.length ? positive.length / Math.max(1, counts.length) : 0;
      const average = positive.length ? positive.reduce((sum, count) => sum + count, 0) / positive.length : 0;
      const spread = positive.length ? Math.max(...positive) - Math.min(...positive) : Infinity;
      return { delimiter, score: consistency * 100 + average * 8 - spread * 5 };
    }).sort((a, b) => b.score - a.score)[0]?.delimiter || ";";
  }

  function parseCsv(text, delimiter = detectDelimiter(text)) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') {
        if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = !quoted;
      } else if (!quoted && char === delimiter) {
        row.push(field.trim());
        field = "";
      } else if (!quoted && (char === "\n" || char === "\r")) {
        if (char === "\r" && input[index + 1] === "\n") index += 1;
        row.push(field.trim());
        field = "";
        if (row.some(value => String(value).trim())) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field.trim());
    if (row.some(value => String(value).trim())) rows.push(row);
    return rows;
  }

  function loadScriptSource(src, globalName) {
    if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
    if (typeof document === "undefined") return Promise.reject(new Error(`BROWSER_LIBRARY_REQUIRED:${globalName}`));
    const absolute = new URL(src, document.baseURI).href;
    const existing = [...document.scripts].find(script => script.src === absolute);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (globalThis[globalName]) { resolve(globalThis[globalName]); return; }
        existing.addEventListener("load", () => globalThis[globalName] ? resolve(globalThis[globalName]) : reject(new Error(`LIBRARY_NOT_AVAILABLE:${globalName}`)), { once: true });
        existing.addEventListener("error", () => reject(new Error(`LIBRARY_LOAD_FAILED:${globalName}`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = absolute;
      script.async = true;
      script.dataset.brokerLibrary = globalName;
      script.onload = () => globalThis[globalName] ? resolve(globalThis[globalName]) : reject(new Error(`LIBRARY_NOT_AVAILABLE:${globalName}`));
      script.onerror = () => reject(new Error(`LIBRARY_LOAD_FAILED:${globalName}:${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadFirstAvailable(sources, globalName) {
    let lastError = null;
    for (const source of sources) {
      try { return await loadScriptSource(source, globalName); }
      catch (error) { lastError = error; }
    }
    throw new Error(`IMPORT_LIBRARY_UNAVAILABLE:${globalName}:${lastError?.message || "unknown"}`);
  }

  function itemX(item) { return Number(item?.x ?? item?.transform?.[4] ?? 0); }
  function itemY(item) { return Number(item?.y ?? item?.transform?.[5] ?? item?.top ?? 0); }

  function groupPdfRows(items, tolerance = 2.8) {
    const rows = [];
    for (const item of items || []) {
      const text = String(item?.str ?? item?.text ?? "");
      if (!text.trim()) continue;
      const x = itemX(item);
      const y = itemY(item);
      let row = rows.find(candidate => Math.abs(candidate.y - y) <= tolerance);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, text });
    }
    return rows
      .sort((a, b) => b.y - a.y)
      .map(row => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }));
  }

  function compactColumn(items, minX, maxX = Infinity) {
    return (items || [])
      .filter(item => item.x >= minX && item.x < maxX)
      .sort((a, b) => a.x - b.x)
      .map(item => item.text)
      .join("")
      .replace(/\s+/g, "")
      .trim();
  }

  function compactPdfText(pages) {
    return BrokerPortfolioImport.fold((pages || []).flat().map(item => String(item?.str ?? item?.text ?? "")).join(" ")).replace(/\s+/g, "");
  }

  function findStatementDate(pages) {
    for (const pageItems of pages || []) {
      for (const row of groupPdfRows(pageItems)) {
        const compact = row.items.map(item => item.text).join("").replace(/\s+/g, "");
        const date = BrokerPortfolioImport.parseDate(compact);
        const folded = BrokerPortfolioImport.fold(compact).replace(/\s+/g, "");
        if (date && (folded.includes("duzenlemetarihi") || folded.includes("raportarihi") || folded.includes("statementdate"))) return date;
      }
    }
    const all = (pages || []).flat().map(item => String(item?.str ?? item?.text ?? "")).join("").replace(/\s+/g, "");
    return BrokerPortfolioImport.parseDate(all);
  }

  function parseOsmanliPdfItemsRobust(pages) {
    const compactText = compactPdfText(pages);
    const recognized = (compactText.includes("osmanliyatirim") && compactText.includes("hisseportfoyum")) || compactText.includes("kodadetmaliyetkapanisfiyat");
    if (!recognized) throw new Error("UNSUPPORTED_PDF_TEMPLATE");

    const statementDate = findStatementDate(pages);
    const holdingsBySymbol = new Map();
    let textItemCount = 0;

    for (const pageItems of pages || []) {
      textItemCount += (pageItems || []).length;
      for (const row of groupPdfRows(pageItems)) {
        let symbol = BrokerPortfolioImport.normalizeHolding({ symbol: compactColumn(row.items, 0, 62), quantity: 1, averageCost: 0 }, { currency: "TRY" }).symbol;
        let quantityText = compactColumn(row.items, 62, 112);

        if (!/^[A-Z][A-Z0-9]{1,11}$/.test(symbol)) {
          const firstBand = compactColumn(row.items, 0, 112).toUpperCase();
          const match = firstBand.match(/^([A-Z]{2,12})([0-9].*)$/);
          if (match) { symbol = match[1]; quantityText = quantityText || match[2]; }
        }
        if (!/^[A-Z][A-Z0-9]{1,11}$/.test(symbol)) continue;

        const raw = {
          symbol,
          quantity: quantityText,
          averageCost: compactColumn(row.items, 112, 158),
          currentPrice: compactColumn(row.items, 207, 250),
          marketValue: compactColumn(row.items, 520),
          date: statementDate,
          currency: "TRY",
          assetType: "STOCK",
          unit: "lot"
        };
        const holding = BrokerPortfolioImport.normalizeHolding(raw, { currency: "TRY", date: statementDate, assetType: "STOCK", unit: "lot" });
        if (holding.symbol && holding.quantity > 0 && holding.averageCost >= 0) holdingsBySymbol.set(holding.symbol, holding);
      }
    }

    if (!textItemCount) throw new Error("SCANNED_PDF");
    const holdings = [...holdingsBySymbol.values()];
    if (!holdings.length) throw new Error(`PORTFOLIO_ROWS_NOT_FOUND:TEXT_ITEMS=${textItemCount}`);
    return {
      broker: "Osmanlı Yatırım Menkul Değerler A.Ş.",
      statementDate,
      sourceType: "PDF",
      holdings,
      warnings: holdings.some(row => row.errors.length) ? ["ROWS_REQUIRE_REVIEW"] : [],
      adapter: "OSMANLI_PORTFOLIO_PDF_V2"
    };
  }

  async function parsePdfLocally(file) {
    const pdfjsLib = await loadFirstAvailable(PDF_LIBRARY_SOURCES, "pdfjsLib");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(PDF_WORKER_SOURCE, document.baseURI).href;
    const data = new Uint8Array(await file.arrayBuffer());
    let documentRef;
    try {
      documentRef = await pdfjsLib.getDocument({ data }).promise;
    } catch (error) {
      throw new Error(`PDF_OPEN_FAILED:${error?.message || error}`);
    }
    const pages = [];
    for (let pageNumber = 1; pageNumber <= documentRef.numPages; pageNumber += 1) {
      const page = await documentRef.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false, includeMarkedContent: false });
      pages.push(content.items || []);
    }
    return parseOsmanliPdfItemsRobust(pages);
  }

  async function parseSpreadsheetLocally(file) {
    const XLSX = await loadFirstAvailable(XLSX_LIBRARY_SOURCES, "XLSX");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
    let best = null;
    const rawSheets = [];
    for (const sheetName of workbook.SheetNames || []) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
      rawSheets.push({ name: sheetName, matrix });
      try {
        const parsed = BrokerPortfolioImport.parseGenericMatrix(matrix, { sourceType: "SPREADSHEET" });
        if (!best || parsed.holdings.length > best.holdings.length) best = { ...parsed, sheetName };
      } catch (_) {}
    }
    if (best) return best;
    return {
      broker: "Generic broker",
      statementDate: null,
      sourceType: "SPREADSHEET",
      holdings: [],
      warnings: ["COLUMN_MAPPING_REQUIRED"],
      adapter: "MANUAL_COLUMN_MAPPING",
      mappingRequired: true,
      rawSheets
    };
  }

  const originalParseFile = BrokerPortfolioImport.parseFile;
  BrokerPortfolioImport.detectCsvDelimiter = detectDelimiter;
  BrokerPortfolioImport.parseCsv = parseCsv;
  BrokerPortfolioImport.groupPdfRowsRobust = groupPdfRows;
  BrokerPortfolioImport.compactPdfColumn = compactColumn;
  BrokerPortfolioImport.parseOsmanliPdfItemsRobust = parseOsmanliPdfItemsRobust;

  BrokerPortfolioImport.parseFile = async function parseFileWithLocalReaders(file) {
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return parsePdfLocally(file);
    if (/\.(xlsx|xls)$/i.test(name)) return parseSpreadsheetLocally(file);
    if (!name.endsWith(".csv")) return originalParseFile(file);

    const matrix = parseCsv(await file.text());
    try {
      return BrokerPortfolioImport.parseGenericMatrix(matrix, { sourceType: "CSV" });
    } catch (_) {
      return {
        broker: "Generic broker",
        statementDate: null,
        sourceType: "CSV",
        holdings: [],
        warnings: ["COLUMN_MAPPING_REQUIRED"],
        adapter: "MANUAL_COLUMN_MAPPING",
        mappingRequired: true,
        rawSheets: [{ name: file.name || "CSV", matrix }]
      };
    }
  };
})();

(function loadLiveMarketLayer() {
  if (typeof document === "undefined" || document.querySelector("script[data-live-market]")) return;
  const script = document.createElement("script");
  script.src = "./live-market.js?v=2026.08.03.1";
  script.dataset.liveMarket = "true";
  document.head.appendChild(script);
})();
