"use strict";

(function installBrokerPortfolioImportUI() {
  if (typeof BrokerPortfolioImport === "undefined" || typeof PortfolioEngine === "undefined") return;

  const COPY = {
    tr: {
      importButton: "Portföy içe aktar",
      importTitle: "Aracı kurum portföyünü içe aktar",
      importDetail: "PDF, Excel, CSV veya Piyasa Masası JSON yedeğini seçin. Dosya bu tarayıcıda işlenir; sunucuya gönderilmez.",
      chooseFile: "Dosya seç",
      dropFile: "Dosyayı buraya bırakın",
      supported: "PDF · XLSX · XLS · CSV · JSON",
      privateProcessing: "Yerel ve özel işlem",
      privateDetail: "Portföy dosyası cihazınızdan çıkmaz. Public GitHub deposuna veya araştırma sistemine yüklenmez.",
      verifiedPdf: "Doğrulanmış PDF: Osmanlı Yatırım Hisse Portföyüm. Metin tabanlı diğer PDF şablonları adaptör desteğine göre işlenir.",
      close: "Kapat",
      reading: "Dosya okunuyor…",
      reviewTitle: "İçe aktarma önizlemesi",
      reviewDetail: "Adet, ortalama maliyet, para birimi ve fiyatları kontrol edin. İçe aktarma onaylanmadan portföy değişmez.",
      broker: "Aracı kurum / kaynak",
      statementDate: "Portföy tarihi",
      detectedPositions: "Bulunan pozisyon",
      importMode: "İçe aktarma yöntemi",
      replace: "Mevcut portföyü değiştir",
      merge: "Mevcut portföyle birleştir",
      replaceNote: "Güncel portföy listelerinde önerilir. Mevcut kayıtların yerini dosyadaki açık pozisyonlar alır.",
      mergeNote: "Dosyadaki pozisyonlar yeni açılış işlemleri olarak mevcut kayıtların üzerine eklenir.",
      defaultCurrency: "Varsayılan para birimi",
      selected: "Seçili",
      symbol: "Sembol",
      name: "Varlık adı",
      quantity: "Adet / lot",
      averageCost: "Ortalama maliyet",
      currentPrice: "Güncel fiyat",
      currency: "Para birimi",
      row: "Satır",
      include: "Aktar",
      importNow: "Seçili pozisyonları içe aktar",
      cancel: "Vazgeç",
      jsonBackup: "Piyasa Masası JSON yedeği",
      jsonPositions: "Yedekte {count} açık pozisyon ve {transactions} işlem bulundu.",
      sourcePositions: "{count} açık pozisyon bulundu.",
      importSuccess: "{count} pozisyon portföye aktarıldı.",
      mergeSuccess: "{count} pozisyon mevcut portföye eklendi.",
      noValidRows: "İçe aktarılabilecek geçerli pozisyon yok.",
      invalidFile: "Dosya okunamadı veya desteklenen bir portföy listesi değil.",
      unsupportedPdf: "PDF şablonu otomatik tanınamadı. Metin tabanlı portföy PDF’si veya Excel/CSV dışa aktarımı kullanın.",
      scannedPdf: "Görüntü olarak taranmış PDF’ler metin içermez ve otomatik okunamaz.",
      mappingTitle: "Excel sütunlarını eşleştirin",
      mappingDetail: "Başlıklar otomatik tanınamadı. Portföy sütunlarının hangi kolonda olduğunu seçin.",
      sheet: "Sayfa",
      headerRow: "Başlık satırı",
      notUsed: "Kullanılmıyor",
      applyMapping: "Sütunları uygula",
      requiredMapping: "Sembol, adet/lot ve ortalama maliyet sütunları zorunludur.",
      mappingFailed: "Seçilen sütunlardan geçerli pozisyon üretilemedi.",
      backupReplaceWarning: "Bu işlem tarayıcıdaki mevcut portföyün yerini alır.",
      reviewWarning: "Kırmızı işaretli satırlar aktarılmaz. Yuvarlanmış maliyetler aracı kurum toplamıyla küçük fark oluşturabilir.",
      closePreview: "Önizlemeyi kapat"
    },
    en: {
      importButton: "Import portfolio",
      importTitle: "Import a broker portfolio",
      importDetail: "Choose a PDF, spreadsheet, CSV or Piyasa Masası JSON backup. The file is processed inside this browser and is not uploaded.",
      chooseFile: "Choose file",
      dropFile: "Drop the file here",
      supported: "PDF · XLSX · XLS · CSV · JSON",
      privateProcessing: "Local and private processing",
      privateDetail: "The portfolio file never leaves your device. It is not published to GitHub or sent to the research system.",
      verifiedPdf: "Verified PDF: Osmanlı Yatırım Hisse Portföyüm. Other text-based PDF templates depend on available adapters.",
      close: "Close",
      reading: "Reading file…",
      reviewTitle: "Import preview",
      reviewDetail: "Review quantity, average cost, currency and current prices. The portfolio does not change until you confirm.",
      broker: "Broker / source",
      statementDate: "Portfolio date",
      detectedPositions: "Positions found",
      importMode: "Import mode",
      replace: "Replace current portfolio",
      merge: "Merge with current portfolio",
      replaceNote: "Recommended for current-position statements. Existing records are replaced by the open positions in the file.",
      mergeNote: "Positions are added as new opening transactions on top of existing records.",
      defaultCurrency: "Default currency",
      selected: "Selected",
      symbol: "Symbol",
      name: "Asset name",
      quantity: "Quantity / lots",
      averageCost: "Average cost",
      currentPrice: "Current price",
      currency: "Currency",
      row: "Row",
      include: "Import",
      importNow: "Import selected positions",
      cancel: "Cancel",
      jsonBackup: "Piyasa Masası JSON backup",
      jsonPositions: "The backup contains {count} open positions and {transactions} transactions.",
      sourcePositions: "{count} open positions found.",
      importSuccess: "{count} positions imported into the portfolio.",
      mergeSuccess: "{count} positions added to the current portfolio.",
      noValidRows: "There are no valid positions to import.",
      invalidFile: "The file could not be read or is not a supported portfolio statement.",
      unsupportedPdf: "The PDF template was not recognized. Use a text-based portfolio PDF or the broker's Excel/CSV export.",
      scannedPdf: "Scanned image PDFs contain no extractable text and cannot be read automatically.",
      mappingTitle: "Map spreadsheet columns",
      mappingDetail: "Headers were not recognized automatically. Select the columns containing the portfolio fields.",
      sheet: "Sheet",
      headerRow: "Header row",
      notUsed: "Not used",
      applyMapping: "Apply columns",
      requiredMapping: "Symbol, quantity and average cost columns are required.",
      mappingFailed: "The selected columns did not produce valid positions.",
      backupReplaceWarning: "This action replaces the portfolio currently stored in the browser.",
      reviewWarning: "Rows marked in red are not imported. Rounded broker costs may create a small reconciliation difference.",
      closePreview: "Close preview"
    }
  };

  let parsedFile = null;
  let previewRows = [];
  let activeFile = null;

  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const c = (key, params = {}) => {
    let value = COPY[language()][key] || COPY.tr[key] || key;
    for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
    return value;
  };
  const escHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  function installStyles() {
    if (document.getElementById("brokerImportStyles")) return;
    const style = document.createElement("style");
    style.id = "brokerImportStyles";
    style.textContent = `
      .broker-import-panel{margin:0 0 18px;padding:22px 24px;border:1px solid #cbdde2;border-radius:4px 26px 4px 26px;background:linear-gradient(135deg,var(--sky-soft),rgba(255,253,248,.9));box-shadow:var(--shadow);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center}.broker-import-panel h3{margin:5px 0 7px;font-family:Georgia,serif;font-size:1.35rem;font-weight:500}.broker-import-panel p{margin:0;color:var(--muted);line-height:1.6}.broker-import-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.broker-import-format{font-size:.68rem;color:var(--muted);letter-spacing:.06em}.broker-import-privacy{grid-column:1/-1;display:flex;gap:10px;align-items:flex-start;padding-top:15px;border-top:1px solid rgba(36,81,72,.12);font-size:.72rem;color:var(--muted)}.broker-import-privacy strong{display:block;color:var(--ink);margin-bottom:3px}.broker-import-modal{position:fixed;inset:0;z-index:130;display:none}.broker-import-modal.open{display:block}.broker-import-backdrop{position:absolute;inset:0;background:rgba(10,29,24,.55);backdrop-filter:blur(4px)}.broker-import-dialog{position:relative;width:min(1120px,calc(100% - 24px));max-height:calc(100vh - 28px);margin:14px auto;overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:4px 28px 4px 28px;box-shadow:var(--shadow-strong)}.broker-import-head{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;gap:20px;padding:23px 26px;border-bottom:1px solid var(--line);background:rgba(255,253,248,.96);backdrop-filter:blur(14px)}.broker-import-head h2{margin:5px 0 5px;font-family:Georgia,serif;font-weight:500}.broker-import-head p{margin:0;color:var(--muted);font-size:.8rem}.broker-import-close{width:40px;height:40px;border:0;border-radius:50%;background:var(--paper-soft);font-size:1.4rem;color:var(--ink)}.broker-import-body{padding:24px 26px 30px}.broker-dropzone{min-height:190px;border:1.5px dashed var(--line-strong);border-radius:20px 4px 20px 4px;background:var(--paper-soft);display:grid;place-items:center;text-align:center;padding:26px;transition:.2s}.broker-dropzone.drag{border-color:var(--pine-2);background:var(--sage-soft)}.broker-dropzone strong{display:block;font-family:Georgia,serif;font-size:1.35rem;font-weight:500}.broker-dropzone span{display:block;margin:8px 0 16px;color:var(--muted)}.broker-import-status{min-height:24px;margin-top:12px;color:var(--muted);font-size:.78rem}.broker-import-status.error{color:var(--negative)}.broker-import-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-bottom:18px;border:1px solid var(--line);background:var(--line)}.broker-import-meta>div{padding:14px;background:var(--paper-soft)}.broker-import-meta span,.broker-import-meta strong{display:block}.broker-import-meta span{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.broker-import-meta strong{margin-top:5px;overflow-wrap:anywhere}.broker-import-controls{display:grid;grid-template-columns:1.2fr .8fr .6fr;gap:12px;margin:18px 0}.broker-import-controls label span{display:block;margin-bottom:6px;font-size:.7rem;font-weight:750;color:var(--ink-2)}.broker-mode-note{margin:8px 0 0;color:var(--muted);font-size:.72rem;line-height:1.5}.broker-preview-wrap{overflow:auto;border:1px solid var(--line)}.broker-preview-table{width:100%;min-width:920px;border-collapse:collapse}.broker-preview-table th,.broker-preview-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:.72rem}.broker-preview-table th{position:sticky;top:0;background:var(--paper-soft);z-index:1;text-transform:uppercase;letter-spacing:.05em;font-size:.63rem}.broker-preview-table input[type=text],.broker-preview-table input[type=number]{min-height:36px;padding:7px 8px;border-radius:7px}.broker-preview-table input[type=checkbox]{width:18px;min-height:auto}.broker-preview-table tr.invalid{background:var(--clay-soft)}.broker-preview-table .row-error{display:block;color:var(--negative);font-size:.61rem;margin-top:4px}.broker-import-foot{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:18px;padding-top:17px;border-top:1px solid var(--line)}.broker-import-foot p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.5}.broker-mapping-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.broker-mapping-preview{margin-top:16px;overflow:auto;border:1px solid var(--line);max-height:290px}.broker-mapping-preview table{border-collapse:collapse;min-width:100%}.broker-mapping-preview td{padding:7px 9px;border:1px solid var(--line);white-space:nowrap;font-size:.68rem}.broker-mapping-preview tr.header-candidate{background:var(--sage-soft);font-weight:750}.broker-mapping-actions{display:flex;gap:10px;align-items:center;margin-top:16px}.broker-import-loader{display:inline-block;width:17px;height:17px;border:2px solid var(--line-strong);border-top-color:var(--pine);border-radius:50%;animation:broker-spin .7s linear infinite;vertical-align:middle;margin-right:7px}@keyframes broker-spin{to{transform:rotate(360deg)}}@media(max-width:800px){.broker-import-panel{grid-template-columns:1fr}.broker-import-actions{justify-content:flex-start}.broker-import-meta{grid-template-columns:1fr 1fr}.broker-import-controls,.broker-mapping-grid{grid-template-columns:1fr 1fr}.broker-import-dialog{width:calc(100% - 12px);margin:6px auto;max-height:calc(100vh - 12px)}.broker-import-body,.broker-import-head{padding:18px}.broker-import-foot{align-items:flex-start;flex-direction:column}.broker-import-foot .action-cluster{width:100%;display:grid;grid-template-columns:1fr 1fr}.broker-import-foot .button{width:100%}}@media(max-width:520px){.broker-import-meta,.broker-import-controls,.broker-mapping-grid{grid-template-columns:1fr}.broker-import-actions{display:grid;grid-template-columns:1fr}.broker-import-actions .button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installMarkup() {
    const summary = document.getElementById("portfolioSummaryCards");
    if (!summary || document.getElementById("brokerImportPanel")) return;
    const panel = document.createElement("section");
    panel.id = "brokerImportPanel";
    panel.className = "broker-import-panel";
    panel.innerHTML = `<div><p class="eyebrow">PORTFÖY AKTARIM MERKEZİ</p><h3 data-broker-copy="importTitle"></h3><p data-broker-copy="importDetail"></p></div><div class="broker-import-actions"><button id="brokerImportOpen" class="button primary" type="button" data-broker-copy="chooseFile"></button><span class="broker-import-format" data-broker-copy="supported"></span></div><div class="broker-import-privacy"><span class="pulse-dot" aria-hidden="true"></span><div><strong data-broker-copy="privateProcessing"></strong><span data-broker-copy="privateDetail"></span></div></div>`;
    summary.insertAdjacentElement("afterend", panel);
    const modal = document.createElement("div");
    modal.id = "brokerImportModal";
    modal.className = "broker-import-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="broker-import-backdrop" data-close-import></div><section class="broker-import-dialog" role="dialog" aria-modal="true" aria-labelledby="brokerImportTitle"><header class="broker-import-head"><div><p class="eyebrow" data-broker-copy="privateProcessing"></p><h2 id="brokerImportTitle" data-broker-copy="importTitle"></h2><p data-broker-copy="importDetail"></p></div><button class="broker-import-close" type="button" data-close-import aria-label="Close">×</button></header><div class="broker-import-body"><div id="brokerImportPicker"><div id="brokerDropzone" class="broker-dropzone"><div><strong data-broker-copy="dropFile"></strong><span data-broker-copy="supported"></span><button id="brokerChooseFile" class="button primary" type="button" data-broker-copy="chooseFile"></button><p class="broker-mode-note" data-broker-copy="verifiedPdf"></p></div></div><input id="brokerPortfolioFile" class="hidden" type="file" accept=".pdf,.xlsx,.xls,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"><div id="brokerImportStatus" class="broker-import-status" aria-live="polite"></div></div><div id="brokerMapping" class="hidden"></div><div id="brokerImportReview" class="hidden"></div></div></section>`;
    document.body.appendChild(modal);
  }

  function updateCopy() {
    document.querySelectorAll("[data-broker-copy]").forEach(element => { element.textContent = c(element.dataset.brokerCopy); });
    const legacyButton = document.getElementById("importPortfolioBtn");
    if (legacyButton) legacyButton.textContent = c("importButton");
  }

  function openModal() {
    const modal = document.getElementById("brokerImportModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    resetWizard();
    document.getElementById("brokerChooseFile").focus();
  }

  function closeModal() {
    const modal = document.getElementById("brokerImportModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function resetWizard() {
    parsedFile = null;
    previewRows = [];
    activeFile = null;
    document.getElementById("brokerImportPicker").classList.remove("hidden");
    document.getElementById("brokerMapping").classList.add("hidden");
    document.getElementById("brokerImportReview").classList.add("hidden");
    setStatus("");
    document.getElementById("brokerPortfolioFile").value = "";
  }

  function setStatus(message, error = false, loading = false) {
    const status = document.getElementById("brokerImportStatus");
    status.className = `broker-import-status${error ? " error" : ""}`;
    status.innerHTML = `${loading ? '<span class="broker-import-loader"></span>' : ""}${escHtml(message)}`;
  }

  function fileError(error) {
    const code = String(error?.message || error || "");
    if (code.includes("UNSUPPORTED_PDF_TEMPLATE")) return c("unsupportedPdf");
    if (code.includes("PORTFOLIO_ROWS_NOT_FOUND")) return c("scannedPdf");
    return c("invalidFile");
  }

  async function processFile(file) {
    if (!file) return;
    activeFile = file;
    setStatus(c("reading"), false, true);
    try {
      parsedFile = await BrokerPortfolioImport.parseFile(file);
      if (parsedFile.mappingRequired) { setStatus(""); renderMapping(); return; }
      preparePreview();
      setStatus("");
      renderReview();
    } catch (error) {
      console.error("Portfolio import failed", error);
      setStatus(fileError(error), true);
    }
  }

  function preparePreview() {
    if (parsedFile.backup) {
      const result = PortfolioEngine.calculate(parsedFile.backup.transactions, parsedFile.backup.manualPrices || {});
      previewRows = result.openHoldings.map((holding, index) => ({ id: `backup-${index}`, include: true, symbol: holding.symbol, name: holding.name, quantity: holding.quantity, averageCost: holding.averageCost, currentPrice: holding.currentPrice, marketValue: holding.marketValue, currency: holding.currency, date: parsedFile.statementDate || holding.currentPriceDate || parsedFile.backup.source?.statementDate || new Date().toISOString().slice(0, 10), assetType: holding.assetType, unit: holding.unit, errors: [] }));
    } else previewRows = (parsedFile.holdings || []).map((holding, index) => ({ ...holding, id: `row-${index}`, include: holding.errors.length === 0 }));
  }

  function mappingColumnOptions(matrix) {
    const width = Math.max(0, ...matrix.slice(0, 25).map(row => row.length));
    return `<option value="">${escHtml(c("notUsed"))}</option>${Array.from({ length: width }, (_, index) => `<option value="${index}">${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ""}</option>`).join("")}`;
  }

  function renderMapping() {
    document.getElementById("brokerImportPicker").classList.add("hidden");
    const area = document.getElementById("brokerMapping");
    area.classList.remove("hidden");
    const sheets = parsedFile.rawSheets || [];
    const active = sheets[0] || { name: "Sheet1", matrix: [] };
    area.innerHTML = `<div class="section-head"><div><p class="eyebrow">EXCEL / CSV</p><h2>${escHtml(c("mappingTitle"))}</h2><p class="muted">${escHtml(c("mappingDetail"))}</p></div></div><div class="broker-mapping-grid"><label><span>${escHtml(c("sheet"))}</span><select id="mappingSheet">${sheets.map((sheet, index) => `<option value="${index}">${escHtml(sheet.name)}</option>`).join("")}</select></label><label><span>${escHtml(c("headerRow"))}</span><input id="mappingHeaderRow" type="number" min="1" max="100" value="1"></label>${["symbol","name","quantity","averageCost","currentPrice","marketValue","currency"].map(field => `<label><span>${escHtml(c(field))}${["symbol","quantity","averageCost"].includes(field) ? " *" : ""}</span><select data-map-field="${field}">${mappingColumnOptions(active.matrix)}</select></label>`).join("")}</div><div id="mappingPreview" class="broker-mapping-preview"></div><div class="broker-mapping-actions"><button id="applyMapping" class="button primary" type="button">${escHtml(c("applyMapping"))}</button><button class="button" type="button" data-reset-import>${escHtml(c("cancel"))}</button><span id="mappingStatus" class="form-status"></span></div>`;
    function drawMatrix() {
      const sheet = sheets[Number(document.getElementById("mappingSheet").value)] || active;
      const headerIndex = Math.max(0, Number(document.getElementById("mappingHeaderRow").value || 1) - 1);
      const rows = sheet.matrix.slice(Math.max(0, headerIndex - 2), headerIndex + 8);
      document.getElementById("mappingPreview").innerHTML = `<table>${rows.map((row, offset) => `<tr class="${Math.max(0, headerIndex - 2) + offset === headerIndex ? "header-candidate" : ""}">${row.map(cell => `<td>${escHtml(cell)}</td>`).join("")}</tr>`).join("")}</table>`;
    }
    document.getElementById("mappingSheet").onchange = () => { const sheet = sheets[Number(document.getElementById("mappingSheet").value)] || active; document.querySelectorAll("[data-map-field]").forEach(select => { select.innerHTML = mappingColumnOptions(sheet.matrix); }); drawMatrix(); };
    document.getElementById("mappingHeaderRow").oninput = drawMatrix;
    document.querySelector("[data-reset-import]").onclick = resetWizard;
    document.getElementById("applyMapping").onclick = () => {
      const mapping = {};
      document.querySelectorAll("[data-map-field]").forEach(select => { if (select.value !== "") mapping[select.dataset.mapField] = Number(select.value); });
      if (["symbol","quantity","averageCost"].some(field => mapping[field] === undefined)) { document.getElementById("mappingStatus").textContent = c("requiredMapping"); return; }
      const sheet = sheets[Number(document.getElementById("mappingSheet").value)] || active;
      const headerIndex = Math.max(0, Number(document.getElementById("mappingHeaderRow").value || 1) - 1);
      const result = BrokerPortfolioImport.parseMappedMatrix(sheet.matrix, mapping, headerIndex, { sourceType: parsedFile.sourceType, currency: "TRY" });
      if (!result.holdings.length) { document.getElementById("mappingStatus").textContent = c("mappingFailed"); return; }
      parsedFile = result;
      preparePreview();
      renderReview();
    };
    drawMatrix();
  }

  function rowErrors(row) {
    const errors = [];
    if (!row.symbol) errors.push(c("symbol"));
    if (!(Number(row.quantity) > 0)) errors.push(c("quantity"));
    if (!(Number(row.averageCost) >= 0)) errors.push(c("averageCost"));
    return errors;
  }

  function collectRows() {
    const table = document.getElementById("brokerPreviewBody");
    if (!table) return previewRows;
    return [...table.querySelectorAll("tr[data-row-index]")].map(tr => {
      const index = Number(tr.dataset.rowIndex);
      const original = previewRows[index] || {};
      return { ...original, include: tr.querySelector("[data-field=include]").checked, symbol: tr.querySelector("[data-field=symbol]").value.trim().toUpperCase(), name: tr.querySelector("[data-field=name]").value.trim(), quantity: Number(tr.querySelector("[data-field=quantity]").value), averageCost: Number(tr.querySelector("[data-field=averageCost]").value), currentPrice: tr.querySelector("[data-field=currentPrice]").value === "" ? null : Number(tr.querySelector("[data-field=currentPrice]").value), currency: tr.querySelector("[data-field=currency]").value.trim().toUpperCase() };
    });
  }

  function renderReview() {
    document.getElementById("brokerImportPicker").classList.add("hidden");
    document.getElementById("brokerMapping").classList.add("hidden");
    const review = document.getElementById("brokerImportReview");
    review.classList.remove("hidden");
    const date = parsedFile.statementDate || previewRows[0]?.date || new Date().toISOString().slice(0, 10);
    const isBackup = Boolean(parsedFile.backup);
    const transactionCount = parsedFile.backup?.transactions?.length || 0;
    const sourceText = isBackup ? c("jsonPositions", { count: previewRows.length, transactions: transactionCount }) : c("sourcePositions", { count: previewRows.length });
    review.innerHTML = `<div class="section-head"><div><p class="eyebrow">${escHtml(activeFile?.name || parsedFile.sourceType || "IMPORT")}</p><h2>${escHtml(c("reviewTitle"))}</h2><p class="muted">${escHtml(c("reviewDetail"))}</p></div></div><div class="broker-import-meta"><div><span>${escHtml(c("broker"))}</span><strong>${escHtml(parsedFile.broker || (isBackup ? c("jsonBackup") : "—"))}</strong></div><div><span>${escHtml(c("statementDate"))}</span><strong>${escHtml(date || "—")}</strong></div><div><span>${escHtml(c("detectedPositions"))}</span><strong>${previewRows.length}</strong></div><div><span>${escHtml(c("selected"))}</span><strong id="selectedPositionCount">${previewRows.filter(row => row.include).length}</strong></div></div><p class="broker-mode-note">${escHtml(sourceText)}</p><div class="broker-import-controls"><label><span>${escHtml(c("importMode"))}</span><select id="brokerImportMode"><option value="replace">${escHtml(c("replace"))}</option><option value="merge">${escHtml(c("merge"))}</option></select><p id="brokerModeNote" class="broker-mode-note">${escHtml(c("replaceNote"))}</p></label><label><span>${escHtml(c("statementDate"))}</span><input id="brokerStatementDate" type="date" value="${escHtml(date || "")}"></label><label><span>${escHtml(c("defaultCurrency"))}</span><input id="brokerDefaultCurrency" maxlength="5" value="${escHtml(previewRows[0]?.currency || "TRY")}"></label></div><div class="broker-preview-wrap"><table class="broker-preview-table"><thead><tr><th>${escHtml(c("include"))}</th><th>${escHtml(c("symbol"))}</th><th>${escHtml(c("name"))}</th><th>${escHtml(c("quantity"))}</th><th>${escHtml(c("averageCost"))}</th><th>${escHtml(c("currentPrice"))}</th><th>${escHtml(c("currency"))}</th><th>${escHtml(c("row"))}</th></tr></thead><tbody id="brokerPreviewBody">${previewRows.map((row, index) => { const errors = rowErrors(row); return `<tr data-row-index="${index}" class="${errors.length ? "invalid" : ""}"><td><input data-field="include" type="checkbox" ${row.include && !errors.length ? "checked" : ""} ${errors.length ? "disabled" : ""}></td><td><input data-field="symbol" type="text" value="${escHtml(row.symbol)}"></td><td><input data-field="name" type="text" value="${escHtml(row.name || row.symbol)}"></td><td><input data-field="quantity" type="number" step="any" min="0" value="${escHtml(row.quantity ?? "")}"></td><td><input data-field="averageCost" type="number" step="any" min="0" value="${escHtml(row.averageCost ?? "")}"></td><td><input data-field="currentPrice" type="number" step="any" min="0" value="${escHtml(row.currentPrice ?? "")}"></td><td><input data-field="currency" type="text" maxlength="5" value="${escHtml(row.currency || "TRY")}"></td><td>${escHtml(row.sourceRow || index + 1)}${errors.length ? `<span class="row-error">${escHtml(errors.join(" · "))}</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div><div class="broker-import-foot"><p>${escHtml(c("reviewWarning"))}</p><div class="action-cluster"><button id="confirmBrokerImport" class="button primary" type="button">${escHtml(c("importNow"))}</button><button class="button" type="button" data-reset-import>${escHtml(c("cancel"))}</button></div></div><div id="brokerReviewStatus" class="form-status" aria-live="polite"></div>`;
    document.getElementById("brokerImportMode").onchange = event => { document.getElementById("brokerModeNote").textContent = event.target.value === "merge" ? c("mergeNote") : c("replaceNote"); };
    document.querySelector("#brokerImportReview [data-reset-import]").onclick = resetWizard;
    document.getElementById("brokerPreviewBody").oninput = document.getElementById("brokerPreviewBody").onchange = () => { const rows = collectRows(); document.getElementById("selectedPositionCount").textContent = rows.filter(row => row.include && !rowErrors(row).length).length; };
    document.getElementById("confirmBrokerImport").onclick = confirmImport;
  }

  function uniqueTransactions(existing, additions) {
    const used = new Set(existing.map(item => item.id));
    return additions.map(item => { let id = item.id; let suffix = 2; while (used.has(id)) { id = `${item.id}-${suffix}`; suffix += 1; } used.add(id); return { ...item, id }; });
  }

  function confirmImport() {
    const mode = document.getElementById("brokerImportMode").value;
    const date = document.getElementById("brokerStatementDate").value || new Date().toISOString().slice(0, 10);
    const currency = document.getElementById("brokerDefaultCurrency").value.trim().toUpperCase() || "TRY";
    const selected = collectRows().filter(row => row.include && !rowErrors(row).length).map(row => ({ ...row, date, currency: row.currency || currency }));
    const status = document.getElementById("brokerReviewStatus");
    if (!selected.length) { status.textContent = c("noValidRows"); return; }
    let incoming;
    if (parsedFile.backup && selected.length === previewRows.length) incoming = { version: 1, transactions: parsedFile.backup.transactions, manualPrices: parsedFile.backup.manualPrices || {} };
    else incoming = BrokerPortfolioImport.holdingsToPortfolio(selected, { date, currency, sourceLabel: parsedFile.broker || activeFile?.name || "Broker portfolio statement" });
    let candidate;
    if (mode === "merge") { const additions = uniqueTransactions(state.portfolio.transactions, incoming.transactions); candidate = { version: 1, transactions: [...state.portfolio.transactions, ...additions], manualPrices: { ...state.portfolio.manualPrices, ...incoming.manualPrices } }; }
    else candidate = { version: 1, transactions: incoming.transactions, manualPrices: incoming.manualPrices };
    const result = PortfolioEngine.calculate(candidate.transactions, candidate.manualPrices);
    if (!result.isValid) { status.textContent = c("invalidFile"); return; }
    state.portfolio = candidate;
    savePortfolio();
    renderPortfolio();
    showToast(mode === "merge" ? c("mergeSuccess", { count: selected.length }) : c("importSuccess", { count: selected.length }));
    closeModal();
    navigate("portfolio");
  }

  function wire() {
    const legacyButton = document.getElementById("importPortfolioBtn");
    const legacyInput = document.getElementById("importPortfolioFile");
    if (legacyButton) legacyButton.onclick = openModal;
    if (legacyInput) { legacyInput.accept = ".pdf,.xlsx,.xls,.csv,.json"; legacyInput.onchange = event => { const file = event.target.files?.[0]; if (file) { openModal(); processFile(file); } event.target.value = ""; }; }
    document.getElementById("brokerImportOpen").onclick = openModal;
    document.getElementById("brokerChooseFile").onclick = () => document.getElementById("brokerPortfolioFile").click();
    document.getElementById("brokerPortfolioFile").onchange = event => { const file = event.target.files?.[0]; if (file) processFile(file); event.target.value = ""; };
    document.querySelectorAll("[data-close-import]").forEach(element => element.onclick = closeModal);
    const dropzone = document.getElementById("brokerDropzone");
    ["dragenter","dragover"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add("drag"); }));
    ["dragleave","drop"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove("drag"); }));
    dropzone.addEventListener("drop", event => processFile(event.dataTransfer?.files?.[0]));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && document.getElementById("brokerImportModal").classList.contains("open")) closeModal(); });
    new MutationObserver(updateCopy).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  installStyles();
  installMarkup();
  updateCopy();
  wire();
})();
