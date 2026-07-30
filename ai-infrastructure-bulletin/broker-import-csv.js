"use strict";

(function extendBrokerImportWithNativeCsv() {
  if (typeof BrokerPortfolioImport === "undefined") return;

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

  const originalParseFile = BrokerPortfolioImport.parseFile;
  BrokerPortfolioImport.detectCsvDelimiter = detectDelimiter;
  BrokerPortfolioImport.parseCsv = parseCsv;
  BrokerPortfolioImport.parseFile = async function parseFileWithNativeCsv(file) {
    const name = String(file?.name || "").toLowerCase();
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
