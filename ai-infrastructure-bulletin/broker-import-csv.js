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

  function loadLocalFirst(sources, globalName) {
    if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
    return new Promise((resolve, reject) => {
      let index = 0;
      const tryNext = () => {
        if (index >= sources.length) { reject(new Error(`LIBRARY_LOAD_FAILED:${globalName}`)); return; }
        const source = sources[index++];
        const script = document.createElement("script");
        script.src = source;
        script.async = true;
        script.dataset.library = globalName;
        script.onload = () => globalThis[globalName] ? resolve(globalThis[globalName]) : tryNext();
        script.onerror = () => { script.remove(); tryNext(); };
        document.head.appendChild(script);
      };
      tryNext();
    });
  }

  function compactPdfItems(items) {
    const source = (items || []).map(item => ({ str: String(item.str ?? item.text ?? ""), transform: item.transform || [1,0,0,1,item.x || 0,item.y || 0], x: item.x, y: item.y })).filter(item => item.str.trim());
    const rows = BrokerPortfolioImport.groupPdfItems(source, 3.1);
    return rows.flatMap(row => {
      const merged = [];
      for (const item of row.items) {
        const previous = merged.at(-1);
        if (previous && item.x - previous.x < 18 && /^[A-Za-zÇĞİÖŞÜçğıöşü]$/.test(previous.text) && /^[A-Za-zÇĞİÖŞÜçğıöşü]$/.test(item.text)) previous.text += item.text;
        else merged.push({ ...item });
      }
      return merged.map(item => ({ str: item.text, transform: [1,0,0,1,item.x,row.y] }));
    });
  }

  async function parsePdfLocal(file) {
    const pdfjsLib = await loadLocalFirst(PDF_LIBRARY_SOURCES, "pdfjsLib");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SOURCE;
    const data = new Uint8Array(await file.arrayBuffer());
    const documentRef = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= documentRef.numPages; pageNumber += 1) {
      const page = await documentRef.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(compactPdfItems(content.items));
    }
    const folded = BrokerPortfolioImport.fold(pages.flat().map(item => item.str).join(" "));
    if (folded.includes("osmanli yatirim") && folded.includes("hisse portfoyum")) return BrokerPortfolioImport.parseOsmanliPdfItems(pages);
    throw new Error("UNSUPPORTED_PDF_TEMPLATE");
  }

  async function parseSpreadsheetLocal(file) {
    const XLSX = await loadLocalFirst(XLSX_LIBRARY_SOURCES, "XLSX");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
    let best = null;
    const rawSheets = [];
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
      rawSheets.push({ name: sheetName, matrix });
      try {
        const parsed = BrokerPortfolioImport.parseGenericMatrix(matrix, { sourceType: "SPREADSHEET" });
        if (!best || parsed.holdings.length > best.holdings.length) best = { ...parsed, sheetName };
      } catch (_) {}
    }
    return best || { broker: "Generic broker", statementDate: null, sourceType: "SPREADSHEET", holdings: [], warnings: ["COLUMN_MAPPING_REQUIRED"], adapter: "MANUAL_COLUMN_MAPPING", mappingRequired: true, rawSheets };
  }

  const originalParseFile = BrokerPortfolioImport.parseFile;
  BrokerPortfolioImport.detectCsvDelimiter = detectDelimiter;
  BrokerPortfolioImport.parseCsv = parseCsv;
  BrokerPortfolioImport.parseFile = async function parseFileWithLocalReaders(file) {
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".csv")) {
      const matrix = parseCsv(await file.text());
      try { return BrokerPortfolioImport.parseGenericMatrix(matrix, { sourceType: "CSV" }); }
      catch (_) { return { broker: "Generic broker", statementDate: null, sourceType: "CSV", holdings: [], warnings: ["COLUMN_MAPPING_REQUIRED"], adapter: "MANUAL_COLUMN_MAPPING", mappingRequired: true, rawSheets: [{ name: file.name || "CSV", matrix }] }; }
    }
    if (name.endsWith(".pdf")) return parsePdfLocal(file);
    if (/\.(xlsx|xls)$/i.test(name)) return parseSpreadsheetLocal(file);
    return originalParseFile(file);
  };
})();

(function loadLiveMarketLayer() {
  if (document.querySelector("script[data-live-market]")) return;
  const script = document.createElement("script");
  script.src = "./live-market.js?v=2026.08.03.1";
  script.dataset.liveMarket = "true";
  document.head.appendChild(script);
})();
