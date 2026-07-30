"use strict";

const assert = require("node:assert/strict");
const Importer = require("../broker-import.js");
global.BrokerPortfolioImport = Importer;
require("../broker-import-csv.js");
const PortfolioEngine = require("../portfolio-engine.js");

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function fragments(text, x, y, step = 4) {
  return [...String(text)].map((character, index) => ({ x: x + index * step, y, text: character }));
}

async function run() {
  assert.equal(Importer.parseLocaleNumber("1.300,00"), 1300);
  assert.equal(Importer.parseLocaleNumber("245,25"), 245.25);
  assert.equal(Importer.reconcileQuantity("4.519.555", 33.98, 153574.48), 4519.555);
  assert.equal(Importer.reconcileQuantity("50.999", 17.47, 890.95), 50.999);
  assert.equal(Importer.parseDate("Düzenleme Tarihi 05/07/2026"), "2026-07-05");

  const matrix = [
    ["Rapor Tarihi", "05/07/2026"],
    [],
    ["Kod", "Varlık Adı", "Adet", "Maliyet", "Fiyat", "Tutar", "Para Birimi"],
    ["ALFA", "Alpha Test", "100", "10,50", "12,00", "1.200,00", "TRY"],
    ["BETA", "Beta Test", "25", "20,00", "18,00", "450,00", "TRY"],
    ["Toplam", "", "", "", "", "1.650,00", ""]
  ];
  const parsedMatrix = Importer.parseGenericMatrix(matrix, { sourceType: "SPREADSHEET" });
  assert.equal(parsedMatrix.holdings.length, 2);
  assert.equal(parsedMatrix.statementDate, "2026-07-05");
  assert.equal(parsedMatrix.holdings[0].symbol, "ALFA");
  close(parsedMatrix.holdings[0].averageCost, 10.5);
  close(parsedMatrix.holdings[0].currentPrice, 12);

  const csv = [
    "Rapor Tarihi;05/07/2026",
    "Kod;Varlık Adı;Adet;Maliyet;Fiyat;Tutar;Para Birimi",
    "ALFA;Alpha Test;100;10,50;12,00;1.200,00;TRY",
    "BETA;Beta Test;25;20,00;18,00;450,00;TRY"
  ].join("\n");
  assert.equal(Importer.detectCsvDelimiter(csv), ";");
  const csvResult = await Importer.parseFile({ name: "portfolio.csv", text: async () => csv });
  assert.equal(csvResult.holdings.length, 2);
  assert.equal(csvResult.holdings[1].symbol, "BETA");

  const osmanliItems = [
    [
      { x: 430, y: 760, text: "Osmanlı Yatırım" },
      { x: 15, y: 730, text: "Hisse Portföyüm / Hisse" },
      { x: 430, y: 690, text: "Düzenleme Tarihi" },
      { x: 520, y: 690, text: "05/07/2026" },
      { x: 20, y: 600, text: "ALFA" },
      { x: 80, y: 600, text: "100" },
      { x: 125, y: 600, text: "10,50" },
      { x: 220, y: 600, text: "12,00" },
      { x: 540, y: 600, text: "1.200,00" },
      { x: 20, y: 580, text: "BETA" },
      { x: 80, y: 580, text: "25" },
      { x: 125, y: 580, text: "20,00" },
      { x: 220, y: 580, text: "18,00" },
      { x: 540, y: 580, text: "450,00" }
    ]
  ];
  const parsedPdf = Importer.parseOsmanliPdfItems(osmanliItems);
  assert.equal(parsedPdf.adapter, "OSMANLI_PORTFOLIO_PDF");
  assert.equal(parsedPdf.statementDate, "2026-07-05");
  assert.equal(parsedPdf.holdings.length, 2);

  const ironPdfItems = [
    [
      ...fragments("Osmanlı Yatırım", 390, 790, 4),
      ...fragments("Hisse Portföyüm / Hisse", 15, 760, 3),
      ...fragments("Düzenleme Tarihi", 360, 730, 3),
      ...fragments("05/07/2026", 520, 730, 4),
      ...fragments("Kod", 21, 700, 4),
      ...fragments("Adet", 85, 700, 4),
      ...fragments("Maliyet", 117, 700, 4),
      ...fragments("Kapanış", 161, 700, 4),
      ...fragments("Fiyat", 222, 700, 4),
      ...fragments("AKBNK", 21, 660, 5),
      ...fragments("50", 95, 660, 4),
      ...fragments("57,55", 126, 660, 4),
      ...fragments("73,75", 221, 660, 4),
      ...fragments("3.687,50", 539, 660, 4),
      ...fragments("ALTNY", 21, 640, 5),
      ...fragments("50.999", 78, 640, 4),
      ...fragments("7,53", 131, 640, 4),
      ...fragments("17,47", 221, 640, 4),
      ...fragments("890,95", 547, 640, 4),
      ...fragments("TTRAK", 21, 620, 5),
      ...fragments("127", 95, 620, 4),
      ...fragments("245,25", 121, 620, 4),
      ...fragments("441,00", 216, 620, 4),
      ...fragments("56.007,00", 534, 620, 4)
    ]
  ];
  const robustPdf = Importer.parseOsmanliPdfItemsRobust(ironPdfItems);
  assert.equal(robustPdf.adapter, "OSMANLI_PORTFOLIO_PDF_V2");
  assert.equal(robustPdf.statementDate, "2026-07-05");
  assert.equal(robustPdf.holdings.length, 3);
  assert.equal(robustPdf.holdings.find(row => row.symbol === "AKBNK").quantity, 50);
  assert.equal(robustPdf.holdings.find(row => row.symbol === "ALTNY").quantity, 50.999);
  assert.equal(robustPdf.holdings.find(row => row.symbol === "TTRAK").averageCost, 245.25);
  assert.equal(robustPdf.holdings.find(row => row.symbol === "TTRAK").currentPrice, 441);

  const payload = Importer.holdingsToPortfolio(robustPdf.holdings, {
    date: robustPdf.statementDate,
    currency: "TRY",
    sourceLabel: "IronPDF broker test"
  });
  assert.equal(payload.transactions.length, 3);
  assert.equal(Object.keys(payload.manualPrices).length, 3);
  const portfolio = PortfolioEngine.calculate(payload.transactions, payload.manualPrices);
  assert.equal(portfolio.isValid, true);
  assert.equal(portfolio.openHoldings.length, 3);

  console.log("Broker portfolio import tests passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
