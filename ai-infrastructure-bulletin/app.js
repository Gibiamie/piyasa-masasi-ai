"use strict";

const DATA_URL = "./data/report.json";
const APP_VERSION = "2026.08.03.1";
const REPO_ISSUES_URL = "https://github.com/Gibiamie/piyasa-masasi-ai/issues/new";
const PORTFOLIO_KEY = "ai-infrastructure-bulletin.portfolio.v1";
const LANGUAGE_KEY = "ai-infrastructure-bulletin.language";
const EXPERIENCE_KEY = "piyasa-masasi-ai.experience-level";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const I18N = {
  tr: {
    tabBriefing: "Genel Bakış", tabPerformance: "Araştırma Evreni", tabPortfolio: "Portföyüm", tabSources: "Kaynaklar", tabUniverse: "Ayarlar",
    brandPromise: "Sinyal değil; veri, analiz ve gerekçe.", researchNotAdvice: "Kişisel yatırım tavsiyesi değildir.",
    overviewTitle: "Piyasa görünümü", overviewDescription: "Önemli gelişmeler, varlık görüşleri ve portföy bağlamı tek çalışma alanında.",
    universeTitle: "Araştırma evreni", universeDescription: "Fiyat performansını, risk sınıfını ve araştırma görüşünü karşılaştırın.",
    portfolioPageTitle: "Portföy çalışma alanı", portfolioPageDescription: "Gerçek işlem fiyatlarıyla maliyeti, açık pozisyonları ve gerçekleşen sonuçları yönetin.",
    sourcesPageTitle: "Kaynak şeffaflığı", sourcesPageDescription: "Araştırma görüşlerinin dayandığı haberleri ve yayın zamanlarını inceleyin.",
    settingsPageTitle: "Çalışma alanı ayarları", settingsPageDescription: "Araştırma evrenini genişletin ve veri kullanım ilkelerini görün.",
    searchPlaceholder: "Sembol, şirket veya tema ara", refresh: "Yenile", loading: "Yükleniyor", freshData: "Fiyat güncel", staleData: "Fiyat güncelliği kontrol edilmeli", dataError: "Veri hatası",
    todayBrief: "BUGÜNÜN ARAŞTIRMA NOTU", preparingEvaluation: "Değerlendirme hazırlanıyor", loadingData: "Veri yükleniyor.", mainRisk: "Ana risk",
    exploreResearch: "Araştırmayı incele", openPortfolio: "Portföyü aç", reportTime: "Rapor zamanı", companiesEvaluated: "Değerlendirilen varlık", materialEvents: "Önemli gelişme", leadingCompany: "Öne çıkan varlık",
    focusRadar: "ODAK RADARI", researchPriority: "Araştırma önceliği", viewAll: "Tümünü gör", portfolioSnapshot: "PORTFÖY ÖZETİ", yourPositions: "Pozisyonlarınız", manage: "Yönet",
    byCompany: "VARLIK BAZINDA", dailyResearchViews: "Günlük araştırma görüşleri", last24Hours: "SON 24 SAAT", companyMaterialEvents: "Önemli gelişmeler",
    noMaterialEvent: "Önem eşiğini geçen gelişme yok", noMaterialEventDetail: "Haber bulunmaması fiyat ve temel risk değerlendirmesini durdurmaz.",
    all: "Tümü", positive: "Pozitif", negative: "Negatif", neutral: "Nötr", uncertain: "Belirsiz", speculative: "Spekülatif",
    fullUniverse: "TÜM ARAŞTIRMA EVRENİ", companyPerformance: "Varlık performansı ve görüşler", marketDataLoading: "Piyasa verisi yükleniyor.", marketClose: "Son fiyat zamanı: {date}", marketUnavailable: "Piyasa verisi mevcut değil.",
    filter: "Filtre", sort: "Sırala", searchAssets: "Varlık ara", sortTicker: "Sembol", sortMomentum: "21 günlük performans", sortRating: "Araştırma görüşü", sortRisk: "Risk",
    company: "Varlık", researchView: "Araştırma görüşü", price: "Fiyat", oneDay: "1 Gün", twentyOneDays: "21 Gün", twoFiftyTwoDays: "252 Gün", fiftyTwoWeekHigh: "52H Zirve", risk: "Risk",
    strongPositive: "Güçlü Pozitif", highUncertainty: "Yüksek Belirsizlik", highConfidence: "Yüksek Güven", mediumConfidence: "Orta Güven", lowConfidence: "Düşük Güven", unverified: "Doğrulanmadı",
    openResearch: "Araştırmayı aç", priceContext: "Fiyat bağlamı", keyDrivers: "Ana sürücüler", keyRisks: "Ana riskler", evaluation: "Değerlendirme", whatHappened: "Ne oldu?", whyImportant: "Neden önemli?", investmentMeaning: "Yatırım açısından anlamı", openSource: "Kaynağı aç ↗",
    personalPortfolio: "KİŞİSEL PORTFÖY", portfolioTitle: "Sepetim ve işlem defterim", privacyNote: "Portföy verileri yalnız bu cihazın tarayıcısında saklanır.", exportBackup: "Yedeği indir", importBackup: "Yedek yükle",
    remainingCost: "Kalan maliyet", marketValue: "Piyasa değeri", unrealizedPnl: "Gerçekleşmemiş K/Z", realizedPnl: "Gerçekleşen K/Z",
    newTransaction: "YENİ İŞLEM", recordBuySell: "Alış veya satış kaydet", editTransaction: "İşlemi düzenle", weightedAverage: "Ağırlıklı ortalama", costMethodNote: "Alış komisyonu maliyete eklenir; satış komisyonu gerçekleşen sonuçtan düşülür.",
    assetType: "Varlık türü", assetStock: "Hisse", assetEtf: "ETF", assetFund: "Fon", assetCommodity: "Emtia", assetCrypto: "Kripto", assetFx: "Döviz", assetOther: "Diğer", symbol: "Sembol", assetName: "Varlık adı", transactionType: "İşlem türü", buy: "Alış", sell: "Satış", quantity: "Adet / lot", unitPrice: "Birim fiyat", currency: "Para birimi", unit: "Birim", fee: "Komisyon / masraf", transactionDate: "İşlem tarihi", optionalCurrentPrice: "Güncel fiyat (opsiyonel)", currentPriceDate: "Güncel fiyat tarihi", notes: "Not", notesPlaceholder: "Banka, emir veya lot açıklaması", saveTransaction: "İşlemi kaydet", updateTransaction: "İşlemi güncelle", cancel: "Vazgeç",
    manualPrice: "MANUEL FİYAT", updateUnsupportedPrice: "Otomatik fiyatı olmayan varlık", manualPriceDetail: "Emtia, kripto veya desteklenmeyen semboller için güncel fiyatı siz kaydedebilirsiniz.", currentPrice: "Güncel fiyat", priceDate: "Fiyat tarihi", savePrice: "Fiyatı kaydet", calculationRules: "Hesaplama disiplini", ruleBuy: "Alış masrafları maliyete eklenir.", ruleSell: "Satış masrafları gerçekleşen sonuçtan düşülür.", ruleNoOversell: "Mevcut miktardan fazla satış yapılamaz.", ruleCurrencies: "Para birimleri ayrı raporlanır.",
    openPositions: "AÇIK POZİSYONLAR", portfolioHoldings: "Portföy varlıkları", asset: "Varlık", type: "Tür", averageCost: "Ort. maliyet", emptyPortfolio: "Portföy henüz boş", emptyPortfolioDetail: "İlk alış işleminizi yukarıdaki formdan kaydedin.", transactionLedger: "İŞLEM DEFTERİ", allBuysSells: "Tüm alış ve satışlar", date: "Tarih", grossValue: "Brüt tutar", action: "İşlem", edit: "Düzenle", delete: "Sil",
    evidenceChain: "KANIT ZİNCİRİ", newsSources: "Araştırmada kullanılan kaynaklar", sourceTransparency: "Her değerlendirme, erişilebilen kaynak ve yayın zamanı ile birlikte gösterilir.", sourceUnavailable: "Kaynak bulunamadı",
    addNewStock: "YENİ VARLIK EKLE", centralUniverse: "Merkezî araştırma evreni", additionDetail: "Talep doğrulandıktan sonra varlık günlük fiyat ve haber değerlendirmesine alınır.", providerSymbol: "Sağlayıcı sembolü", companyName: "Varlık / şirket adı", requestAddition: "Ekleme talebi oluştur", universeLoading: "Araştırma evreni yükleniyor.", evaluatedUniverse: "{count} varlık merkezî araştırma evreninde.", requestOpened: "{symbol} için ekleme talebi açıldı.",
    experienceMode: "GÖRÜNÜM SEVİYESİ", adaptComplexity: "Karmaşıklığı deneyiminize göre ayarlayın", adaptComplexityDetail: "Araştırmanın temel verileri değişmez; yalnızca açıklama yoğunluğu ve teknik ayrıntı seviyesi uyarlanır.", levelBeginner: "Başlangıç", levelStandard: "Standart", levelAdvanced: "Gelişmiş", levelProfessional: "Profesyonel", evaluationLogic: "DEĞERLENDİRME MANTIĞI", eachAssetSeparate: "Her varlık ayrı incelenir", evaluationLogicDetail: "Fiyat trendi, güncel gelişmeler, temel sürücüler, özel riskler ve tez etkisi birlikte değerlendirilir.", privacy: "GİZLİLİK", localPortfolio: "Portföy cihazınızda kalır", localPortfolioDetail: "İşlem kayıtları sunucuya gönderilmez. Yedekleme ve cihaz değişimi kullanıcı kontrolündedir.", riskLanguage: "RİSK DİLİ", researchNotOrder: "Araştırma görüşü, emir değildir", riskLanguageDetail: "Sistem araştırma sınıfları üretir; kişisel alım veya satım talimatı oluşturmaz.",
    footer: "Yatırım araştırması ve finansal okuryazarlık içindir; kişiselleştirilmiş yatırım danışmanlığı veya işlem emri vermez.",
    evaluationUnavailable: "Değerlendirme verisi açılamadı", noResearchMatch: "Arama ve filtreyle eşleşen varlık yok.", portfolioEmptyPreview: "Henüz pozisyon yok", portfolioEmptyPreviewDetail: "İlk alışınızı kaydettiğinizde maliyet ve performans burada görünür.", positions: "pozisyon", totalTransactions: "işlem", automatic: "Otomatik", manual: "Manuel", noCurrentPrice: "Güncel fiyat yok", noTransactions: "Henüz işlem kaydı yok.",
    transactionSaved: "İşlem kaydedildi.", transactionUpdated: "İşlem güncellendi.", priceSaved: "Piyasa fiyatı kaydedildi.", invalidTransaction: "İşlem bilgileri geçersiz.", oversell: "Satış miktarı mevcut {available} birimden fazla olamaz.", matchingHoldingMissing: "Bu sembol, para birimi ve birimle eşleşen pozisyon bulunamadı.", transactionDeleteBlocked: "Bu kayıt silinirse sonraki satışlardan biri mevcut miktarı aşacak.", confirmDelete: "Bu işlem kaydı silinsin mi?", confirmImport: "Yüklenen yedek mevcut portföyün yerini alacak. Devam edilsin mi?", importSuccess: "Portföy yedeği yüklendi.", importError: "Yedek dosyası geçersiz veya tutarsız.", backupExported: "Portföy yedeği indirildi.", portfolioValueIncomplete: "Bazı açık pozisyonlarda güncel fiyat bulunmadığı için piyasa değeri eksiktir.",
    close: "Kapat", thesis: "Araştırma tezi", relatedEvents: "İlgili gelişmeler", noRelatedEvents: "Son 24 saatte ilgili gelişme yok.", sector: "Sektör"
  },
  en: {
    tabBriefing: "Overview", tabPerformance: "Research Universe", tabPortfolio: "My Portfolio", tabSources: "Sources", tabUniverse: "Settings",
    brandPromise: "Not signals; data, analysis and rationale.", researchNotAdvice: "Not personalized investment advice.",
    overviewTitle: "Market overview", overviewDescription: "Material developments, asset views and portfolio context in one workspace.",
    universeTitle: "Research universe", universeDescription: "Compare price performance, risk classification and research view.",
    portfolioPageTitle: "Portfolio workspace", portfolioPageDescription: "Manage cost, open positions and realized outcomes using actual transaction prices.",
    sourcesPageTitle: "Source transparency", sourcesPageDescription: "Review the news and publication times supporting each research view.",
    settingsPageTitle: "Workspace settings", settingsPageDescription: "Expand the research universe and review data-use principles.",
    searchPlaceholder: "Search symbol, company or theme", refresh: "Refresh", loading: "Loading", freshData: "Price current", staleData: "Price freshness requires checking", dataError: "Data error",
    todayBrief: "TODAY'S RESEARCH NOTE", preparingEvaluation: "Preparing evaluation", loadingData: "Loading data.", mainRisk: "Main risk",
    exploreResearch: "Explore research", openPortfolio: "Open portfolio", reportTime: "Report time", companiesEvaluated: "Assets evaluated", materialEvents: "Material events", leadingCompany: "Leading asset",
    focusRadar: "FOCUS RADAR", researchPriority: "Research priority", viewAll: "View all", portfolioSnapshot: "PORTFOLIO SNAPSHOT", yourPositions: "Your positions", manage: "Manage",
    byCompany: "BY ASSET", dailyResearchViews: "Daily research views", last24Hours: "LAST 24 HOURS", companyMaterialEvents: "Material developments",
    noMaterialEvent: "No event passed the materiality threshold", noMaterialEventDetail: "The absence of news does not stop the price and fundamental-risk assessment.",
    all: "All", positive: "Positive", negative: "Negative", neutral: "Neutral", uncertain: "Uncertain", speculative: "Speculative",
    fullUniverse: "FULL RESEARCH UNIVERSE", companyPerformance: "Asset performance and views", marketDataLoading: "Loading market data.", marketClose: "Last price time: {date}", marketUnavailable: "Market data is unavailable.",
    filter: "Filter", sort: "Sort", searchAssets: "Search assets", sortTicker: "Symbol", sortMomentum: "21-day performance", sortRating: "Research view", sortRisk: "Risk",
    company: "Asset", researchView: "Research view", price: "Price", oneDay: "1 Day", twentyOneDays: "21 Days", twoFiftyTwoDays: "252 Days", fiftyTwoWeekHigh: "52W High", risk: "Risk",
    strongPositive: "Strong Positive", highUncertainty: "High Uncertainty", highConfidence: "High Confidence", mediumConfidence: "Medium Confidence", lowConfidence: "Low Confidence", unverified: "Unverified",
    openResearch: "Open research", priceContext: "Price context", keyDrivers: "Key drivers", keyRisks: "Key risks", evaluation: "Assessment", whatHappened: "What happened?", whyImportant: "Why does it matter?", investmentMeaning: "Investment implication", openSource: "Open source ↗",
    personalPortfolio: "PERSONAL PORTFOLIO", portfolioTitle: "My basket and transaction ledger", privacyNote: "Portfolio data is stored only in this device's browser.", exportBackup: "Download backup", importBackup: "Import backup",
    remainingCost: "Remaining cost", marketValue: "Market value", unrealizedPnl: "Unrealized P/L", realizedPnl: "Realized P/L",
    newTransaction: "NEW TRANSACTION", recordBuySell: "Record a purchase or sale", editTransaction: "Edit transaction", weightedAverage: "Weighted average", costMethodNote: "Purchase fees are capitalized into cost; sale fees reduce the realized outcome.",
    assetType: "Asset type", assetStock: "Stock", assetEtf: "ETF", assetFund: "Fund", assetCommodity: "Commodity", assetCrypto: "Crypto", assetFx: "FX", assetOther: "Other", symbol: "Symbol", assetName: "Asset name", transactionType: "Transaction type", buy: "Buy", sell: "Sell", quantity: "Quantity / lots", unitPrice: "Unit price", currency: "Currency", unit: "Unit", fee: "Commission / fee", transactionDate: "Transaction date", optionalCurrentPrice: "Current price (optional)", currentPriceDate: "Current-price date", notes: "Notes", notesPlaceholder: "Broker, order or lot note", saveTransaction: "Save transaction", updateTransaction: "Update transaction", cancel: "Cancel",
    manualPrice: "MANUAL PRICE", updateUnsupportedPrice: "Asset without an automatic quote", manualPriceDetail: "Store a current price for commodities, crypto or unsupported symbols.", currentPrice: "Current price", priceDate: "Price date", savePrice: "Save price", calculationRules: "Calculation discipline", ruleBuy: "Purchase expenses are added to cost.", ruleSell: "Sale expenses reduce the realized result.", ruleNoOversell: "A sale cannot exceed the available quantity.", ruleCurrencies: "Currencies are reported separately.",
    openPositions: "OPEN POSITIONS", portfolioHoldings: "Portfolio holdings", asset: "Asset", type: "Type", averageCost: "Avg. cost", emptyPortfolio: "The portfolio is empty", emptyPortfolioDetail: "Record the first purchase using the form above.", transactionLedger: "TRANSACTION LEDGER", allBuysSells: "All purchases and sales", date: "Date", grossValue: "Gross value", action: "Action", edit: "Edit", delete: "Delete",
    evidenceChain: "EVIDENCE CHAIN", newsSources: "Sources used in research", sourceTransparency: "Each assessment is shown with the accessible source and publication time.", sourceUnavailable: "No source available",
    addNewStock: "ADD A NEW ASSET", centralUniverse: "Central research universe", additionDetail: "After validation, the asset enters the daily price and news assessment.", providerSymbol: "Provider symbol", companyName: "Asset / company name", requestAddition: "Create addition request", universeLoading: "Loading research universe.", evaluatedUniverse: "{count} assets are in the central research universe.", requestOpened: "An addition request was opened for {symbol}.",
    experienceMode: "VIEW LEVEL", adaptComplexity: "Match complexity to your experience", adaptComplexityDetail: "The underlying research does not change; only explanation density and technical detail are adapted.", levelBeginner: "Beginner", levelStandard: "Standard", levelAdvanced: "Advanced", levelProfessional: "Professional", evaluationLogic: "EVALUATION LOGIC", eachAssetSeparate: "Each asset is assessed separately", evaluationLogicDetail: "Price trend, current developments, fundamental drivers, specific risks and thesis impact are assessed together.", privacy: "PRIVACY", localPortfolio: "Your portfolio stays on your device", localPortfolioDetail: "Transaction records are not sent to a server. Backup and device transfer remain under user control.", riskLanguage: "RISK LANGUAGE", researchNotOrder: "A research view is not an order", riskLanguageDetail: "The system produces research classifications; it does not create a personal buy or sell instruction.",
    footer: "For investment research and financial literacy; it does not provide personalized investment advice or an execution order.",
    evaluationUnavailable: "Evaluation data could not be opened", noResearchMatch: "No asset matches the search and filters.", portfolioEmptyPreview: "No positions yet", portfolioEmptyPreviewDetail: "Cost and performance will appear here after the first purchase.", positions: "positions", totalTransactions: "transactions", automatic: "Automatic", manual: "Manual", noCurrentPrice: "No current price", noTransactions: "No transaction records yet.",
    transactionSaved: "Transaction saved.", transactionUpdated: "Transaction updated.", priceSaved: "Market price saved.", invalidTransaction: "The transaction data is invalid.", oversell: "The sale quantity cannot exceed the available {available} units.", matchingHoldingMissing: "No position matches this symbol, currency and unit.", transactionDeleteBlocked: "Deleting this record would make a later sale exceed the available quantity.", confirmDelete: "Delete this transaction record?", confirmImport: "The uploaded backup will replace the current portfolio. Continue?", importSuccess: "Portfolio backup imported.", importError: "The backup file is invalid or inconsistent.", backupExported: "Portfolio backup downloaded.", portfolioValueIncomplete: "Market value is incomplete because some open positions have no current price.",
    close: "Close", thesis: "Research thesis", relatedEvents: "Related developments", noRelatedEvents: "No related development in the last 24 hours.", sector: "Sector"
  }
};

const VIEW_COPY = {
  briefing: ["overviewTitle", "overviewDescription"],
  watchlist: ["universeTitle", "universeDescription"],
  portfolio: ["portfolioPageTitle", "portfolioPageDescription"],
  sources: ["sourcesPageTitle", "sourcesPageDescription"],
  settings: ["settingsPageTitle", "settingsPageDescription"]
};

const RATING_SCORE = { STRONG_POSITIVE: 5, POSITIVE: 4, NEUTRAL: 3, HIGH_UNCERTAINTY: 2, NEGATIVE: 1 };
const state = {
  report: null,
  language: localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "tr",
  view: VIEW_COPY[location.hash.slice(1)] ? location.hash.slice(1) : "briefing",
  experience: ["beginner", "standard", "advanced", "professional"].includes(localStorage.getItem(EXPERIENCE_KEY)) ? localStorage.getItem(EXPERIENCE_KEY) : "standard",
  researchFilter: "all",
  query: "",
  marketSearch: "",
  marketSort: "ticker",
  editingTransactionId: null,
  portfolio: loadPortfolio()
};
let toastTimer = null;

function loadPortfolio() {
  try {
    const value = JSON.parse(localStorage.getItem(PORTFOLIO_KEY));
    if (value && Array.isArray(value.transactions) && value.manualPrices && typeof value.manualPrices === "object") return value;
  } catch (_) {}
  return { version: 1, transactions: [], manualPrices: {} };
}

function savePortfolio() { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state.portfolio)); }
function t(key, params = {}) { let value = I18N[state.language]?.[key] ?? I18N.tr[key] ?? key; for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, replacement); return value; }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function localizedField(object, key) { if (!object) return ""; if (state.language === "en" && object[`${key}_en`] !== undefined && object[`${key}_en`] !== null) return object[`${key}_en`]; return object[key] ?? ""; }
function localizedArray(object, key) { if (!object) return []; if (state.language === "en" && Array.isArray(object[`${key}_en`])) return object[`${key}_en`]; return Array.isArray(object[key]) ? object[key] : []; }
function locale() { return state.language === "tr" ? "tr-TR" : "en-GB"; }
function today() { return new Date().toISOString().slice(0, 10); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function fmtNumber(value, digits = 2) { const number = finite(value); return number === null ? "—" : new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(number); }
function fmtMoney(value, currency) { const number = finite(value); if (number === null) return "—"; try { return new Intl.NumberFormat(locale(), { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(number); } catch (_) { return `${fmtNumber(number, 2)} ${currency || ""}`.trim(); } }
function fmtPct(value) { const number = finite(value); return number === null ? "—" : `${number > 0 ? "+" : ""}${fmtNumber(number, 1)}%`; }
function pctClass(value) { const number = finite(value); return number === null || number === 0 ? "" : number > 0 ? "up" : "down"; }
function fmtDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" }).format(date); }
function fmtDateOnly(value) { if (!value) return "—"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(date); }

function ratingInfo(rating) {
  const map = { STRONG_POSITIVE: [t("strongPositive"), "positive"], POSITIVE: [t("positive"), "positive"], NEUTRAL: [t("neutral"), "neutral"], NEGATIVE: [t("negative"), "negative"], HIGH_UNCERTAINTY: [t("highUncertainty"), "warning"] };
  return map[rating] || [rating || t("neutral"), "neutral"];
}
function cardClass(rating) { if (["STRONG_POSITIVE", "POSITIVE"].includes(rating)) return "positive"; if (rating === "NEGATIVE") return "negative"; if (rating === "HIGH_UNCERTAINTY") return "uncertain"; return "neutral"; }
function confidence(value) { const labels = { HIGH: t("highConfidence"), MEDIUM: t("mediumConfidence"), LOW: t("lowConfidence"), UNVERIFIED: t("unverified") }; const className = value === "HIGH" ? "blue" : ["LOW", "UNVERIFIED"].includes(value) ? "warning" : "neutral"; return `<span class="badge ${className}">${esc(labels[value] || value || t("unverified"))}</span>`; }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800); }

function setView(view) {
  if (!VIEW_COPY[view]) return;
  state.view = view;
  $$(".tab").forEach(tab => { const active = tab.dataset.view === view; tab.classList.toggle("active", active); tab.setAttribute("aria-current", active ? "page" : "false"); });
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `${view}View`));
  const [titleKey, descriptionKey] = VIEW_COPY[view];
  $("#viewTitle").textContent = t(titleKey);
  $("#viewDescription").textContent = t(descriptionKey);
  if (view === "portfolio") renderPortfolio();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.documentElement.dataset.experience = state.experience;
  $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  $("#languageToggle").textContent = state.language === "tr" ? "EN" : "TR";
  document.title = "Piyasa Masası AI";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = state.language === "tr" ? "Piyasa araştırması, varlık değerlendirmesi ve gerçek işlem maliyetli kişisel portföy çalışma alanı." : "Market research, asset assessment and personal portfolio workspace with actual transaction cost.";
  $("#experienceLevel").value = state.experience;
  setView(state.view);
  if (state.report) render(); else renderPortfolio();
}

async function load() {
  $("#freshness").textContent = t("loading");
  $("#freshness").className = "status-pill neutral";
  try {
    const response = await fetch(`${DATA_URL}?app=${APP_VERSION}&v=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.report = await response.json();
    render();
  } catch (error) {
    $("#freshness").textContent = t("dataError");
    $("#freshness").className = "status-pill negative";
    $("#summaryTitle").textContent = t("evaluationUnavailable");
    $("#summaryText").textContent = error.message;
    renderPortfolio();
  }
}

function render() {
  const data = state.report;
  const report = data.report || {};
  const summary = data.executive_summary || {};
  const events = data.events || [];
  const evaluations = data.company_evaluations || [];
  $("#generatedAt").textContent = fmtDate(report.generated_at);
  $("#companyCount").textContent = String(report.company_count ?? evaluations.length ?? data.watchlist?.length ?? 0);
  $("#eventCount").textContent = String(report.material_event_count ?? events.length);
  $("#dominantTheme").textContent = summary.dominant_theme || "—";
  $("#mainRiskValue").textContent = localizedField(summary, "main_risk") || "—";
  $("#summaryTitle").textContent = localizedField(summary, "headline") || t("preparingEvaluation");
  $("#summaryText").textContent = localizedField(summary, "summary") || t("noMaterialEvent");
  $("#marketAsOf").textContent = report.market_data_as_of ? t("marketClose", { date: fmtDate(report.market_data_as_of) }) : t("marketUnavailable");
  const marketTimestamp = new Date(report.market_data_as_of || report.generated_at).getTime();
  const ageMinutes = Number.isFinite(marketTimestamp) ? Math.max(0, (Date.now() - marketTimestamp) / 6e4) : Infinity;
  $("#freshness").textContent = ageMinutes <= 30 ? t("freshData") : t("staleData");
  $("#freshness").className = `status-pill ${ageMinutes <= 30 ? "positive" : "warning"}`;
  $("#appVersion").textContent = `v${APP_VERSION}`;
  renderTrackedSymbols(data.watchlist || []);
  renderFocus(evaluations);
  renderPortfolioPreview();
  renderResearchFilters();
  renderEvaluations(evaluations);
  renderEvents(events);
  renderWatchlist(data.watchlist || [], evaluations);
  renderSources(events);
  renderUniverse(data.watchlist || []);
  renderPortfolio();
}

function renderTrackedSymbols(items) { $("#trackedSymbols").innerHTML = items.map(item => `<option value="${esc(item.provider_symbol || item.ticker)}">${esc(item.company || item.ticker)}</option>`).join(""); }
function evaluationMatchesQuery(item) { const query = state.query.trim().toLocaleLowerCase(state.language === "tr" ? "tr" : "en"); if (!query) return true; const haystack = [item.ticker, item.company, localizedField(item, "sector"), localizedField(item, "summary"), ...localizedArray(item, "key_drivers"), ...localizedArray(item, "key_risks")].join(" ").toLocaleLowerCase(state.language === "tr" ? "tr" : "en"); return haystack.includes(query); }
function filterMatches(item) { if (state.researchFilter === "all") return true; if (state.researchFilter === "positive") return ["STRONG_POSITIVE", "POSITIVE"].includes(item.rating); if (state.researchFilter === "negative") return item.rating === "NEGATIVE"; if (state.researchFilter === "uncertain") return item.rating === "HIGH_UNCERTAINTY"; if (state.researchFilter === "speculative") return item.risk_badge === "SPECULATIVE"; return true; }

function renderFocus(evaluations) {
  const ranked = [...evaluations].sort((a, b) => { const rating = (RATING_SCORE[b.rating] || 0) - (RATING_SCORE[a.rating] || 0); if (rating) return rating; return Math.abs(finite(b.price_context?.return_21d_pct) || 0) - Math.abs(finite(a.price_context?.return_21d_pct) || 0); }).slice(0, 5);
  $("#focusList").innerHTML = ranked.map((item, index) => { const price = item.price_context || {}; return `<button class="focus-item open-asset" data-ticker="${esc(item.ticker)}" type="button"><span class="focus-rank">${String(index + 1).padStart(2, "0")}</span><span class="focus-copy"><strong>${esc(item.ticker)} · ${esc(item.company)}</strong><span>${esc(localizedField(item, "summary"))}</span></span><span class="focus-price"><strong>${price.price == null ? "—" : fmtMoney(price.price, price.currency)}</strong><small class="${pctClass(price.return_21d_pct)}">${fmtPct(price.return_21d_pct)}</small></span></button>`; }).join("");
  bindAssetOpeners();
}

function renderPortfolioPreview() {
  const result = portfolioResult();
  if (!result.openHoldings.length) {
    $("#portfolioPreview").innerHTML = `<div class="preview-empty"><strong>${esc(t("portfolioEmptyPreview"))}</strong><p>${esc(t("portfolioEmptyPreviewDetail"))}</p><button class="text-action" type="button" data-open-view="portfolio">${esc(t("openPortfolio"))}</button></div>`;
    bindViewOpeners();
    return;
  }
  const totals = Object.values(result.totalsByCurrency);
  const totalLines = totals.map(item => fmtMoney(item.marketValue, item.currency)).join(" · ");
  const positions = result.openHoldings.slice(0, 3).map(holding => `<div class="preview-position"><div><strong>${esc(holding.symbol)}</strong><span>${fmtNumber(holding.quantity)} ${esc(holding.unit)}</span></div><strong class="${pctClass(holding.unrealizedPnl)}">${holding.unrealizedPnl == null ? "—" : fmtMoney(holding.unrealizedPnl, holding.currency)}</strong></div>`).join("");
  $("#portfolioPreview").innerHTML = `<div class="preview-total"><span>${esc(t("marketValue"))}</span><strong>${esc(totalLines || "—")}</strong></div>${positions}<div class="meta">${result.openHoldings.length} ${esc(t("positions"))} · ${result.ledger.length} ${esc(t("totalTransactions"))}</div>`;
}

function renderResearchFilters() {
  const filters = [["all", t("all")], ["positive", t("positive")], ["negative", t("negative")], ["uncertain", t("uncertain")], ["speculative", t("speculative")]];
  $("#filters").innerHTML = filters.map(([value, label]) => `<button class="filter ${state.researchFilter === value ? "active" : ""}" data-filter="${value}" type="button">${esc(label)}</button>`).join("");
  $$("#filters .filter").forEach(button => { button.onclick = () => { state.researchFilter = button.dataset.filter; renderResearchFilters(); renderEvaluations(state.report?.company_evaluations || []); }; });
}

function renderEvaluations(evaluations) {
  const list = evaluations.filter(item => evaluationMatchesQuery(item) && filterMatches(item));
  if (!list.length) { $("#evaluations").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><strong>${esc(t("noResearchMatch"))}</strong></div>`; return; }
  $("#evaluations").innerHTML = list.map(item => {
    const price = item.price_context || {};
    const [ratingLabel, ratingClass] = ratingInfo(item.rating);
    return `<article class="research-card ${cardClass(item.rating)}"><div class="research-card-body" data-rating="${esc(item.rating || "NEUTRAL")}"><div class="research-meta"><span class="research-symbol">${esc(item.ticker)}</span><span>${esc(localizedField(item, "sector"))}</span></div><h3>${esc(item.company)}</h3><p class="summary-line">${esc(localizedField(item, "summary"))}</p><p class="professional-only research-context">${esc(localizedField(item, "performance_context"))}</p><div class="research-price-row"><div><span>${esc(t("price"))}</span><strong>${price.price == null ? "—" : fmtMoney(price.price, price.currency)}</strong></div><div><span>21D</span><strong class="${pctClass(price.return_21d_pct)}">${fmtPct(price.return_21d_pct)}</strong></div><div><span>252D</span><strong class="${pctClass(price.return_252d_pct)}">${fmtPct(price.return_252d_pct)}</strong></div></div><div class="card-footer"><div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${item.risk_badge === "SPECULATIVE" ? `<span class="badge warning">${esc(t("speculative"))}</span>` : ""}</div><button class="open-research open-asset" data-ticker="${esc(item.ticker)}" type="button">${esc(t("openResearch"))} →</button></div></div></article>`;
  }).join("");
  bindAssetOpeners();
}

function renderEvents(events) {
  const query = state.query.trim().toLowerCase();
  const list = events.filter(event => !query || [event.headline, localizedField(event, "why_it_matters"), ...(event.companies || [])].join(" ").toLowerCase().includes(query));
  $("#empty").classList.toggle("hidden", list.length > 0);
  $("#events").innerHTML = list.map(event => { const source = event.sources?.[0]; return `<article class="timeline-item"><time class="timeline-time">${esc(fmtDate(event.published_time))}<br>${esc((event.companies || []).join(", ") || event.primary_theme || "")}</time><span class="timeline-node" aria-hidden="true"></span><div class="timeline-content"><h3>${esc(event.headline)}</h3><p>${esc(localizedField(event, "why_it_matters"))}</p></div>${source ? `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a>` : ""}</article>`; }).join("");
}

function renderWatchlist(items, evaluations) {
  const evaluationMap = new Map(evaluations.map(item => [item.ticker, item]));
  const search = `${state.marketSearch} ${state.query}`.trim().toLowerCase();
  let rows = items.filter(item => !search || [item.ticker, item.provider_symbol, item.company, item.sector].join(" ").toLowerCase().includes(search));
  rows = [...rows].sort((a, b) => { if (state.marketSort === "return21") return (finite(b.return_21d_pct) ?? -Infinity) - (finite(a.return_21d_pct) ?? -Infinity); if (state.marketSort === "rating") return (RATING_SCORE[evaluationMap.get(b.ticker)?.rating] || 0) - (RATING_SCORE[evaluationMap.get(a.ticker)?.rating] || 0); if (state.marketSort === "risk") return String(b.risk_badge || "").localeCompare(String(a.risk_badge || "")); return String(a.ticker).localeCompare(String(b.ticker)); });
  $("#watchlistBody").innerHTML = rows.length ? rows.map(item => { const evaluation = evaluationMap.get(item.ticker) || {}; const [ratingLabel] = ratingInfo(evaluation.rating); return `<tr data-ticker="${esc(item.ticker)}"><td><div class="ticker-name"><strong>${esc(item.ticker)}</strong><span>${esc(item.company || "")} · ${esc(fmtDateOnly(item.price_as_of))}</span></div></td><td><span class="table-rating ${cardClass(evaluation.rating)}">${esc(ratingLabel)}</span></td><td>${item.price == null ? "—" : fmtMoney(item.price, item.currency)}</td><td class="${pctClass(item.return_1d_pct)}">${fmtPct(item.return_1d_pct)}</td><td class="${pctClass(item.return_21d_pct)}">${fmtPct(item.return_21d_pct)}</td><td class="${pctClass(item.return_252d_pct)}">${fmtPct(item.return_252d_pct)}</td><td class="${pctClass(item.distance_from_52w_high_pct)}">${fmtPct(item.distance_from_52w_high_pct)}</td><td><span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></td></tr>`; }).join("") : `<tr><td colspan="8" class="table-empty">${esc(t("noResearchMatch"))}</td></tr>`;
  $$("#watchlistBody tr[data-ticker]").forEach(row => row.onclick = () => openAssetDrawer(row.dataset.ticker));
}

function renderSources(events) {
  const sources = [];
  events.forEach(event => (event.sources || []).forEach(source => sources.push({ ...source, event: event.headline, tickers: event.companies || [] })));
  $("#sourcesList").innerHTML = sources.length ? sources.map(source => `<article class="source"><div class="meta"><span>${esc(source.tickers.join(", "))}</span><span>•</span><span>${esc(source.source_type || "SECONDARY")}</span><span>•</span><span>${esc(source.publisher || "")}</span><span>•</span><span>${esc(fmtDate(source.published_at))}</span></div><h3>${esc(source.title)}</h3><p>${esc(source.event)}</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a></article>`).join("") : `<div class="empty-state"><strong>${esc(t("sourceUnavailable"))}</strong></div>`;
}
function renderUniverse(items) { $("#tickerChips").innerHTML = items.map(item => `<span class="chip">${esc(item.ticker)}</span>`).join(""); $("#tickerStatus").textContent = t("evaluatedUniverse", { count: items.length }); }
function bindAssetOpeners() { $$(".open-asset").forEach(element => element.onclick = event => { event.preventDefault(); openAssetDrawer(element.dataset.ticker); }); }
function bindViewOpeners() { $$('[data-open-view]').forEach(element => element.onclick = () => navigate(element.dataset.openView)); }

function openAssetDrawer(ticker) {
  const evaluation = (state.report?.company_evaluations || []).find(item => item.ticker === ticker);
  const market = (state.report?.watchlist || []).find(item => item.ticker === ticker);
  if (!evaluation && !market) return;
  const item = evaluation || { ticker, company: market?.company || ticker, price_context: market || {} };
  const price = market || item.price_context || {};
  const events = (state.report?.events || []).filter(event => (event.companies || []).includes(ticker));
  const [ratingLabel, ratingClass] = ratingInfo(item.rating);
  const drivers = localizedArray(item, "key_drivers").map(value => `<li>${esc(value)}</li>`).join("");
  const risks = localizedArray(item, "key_risks").map(value => `<li>${esc(value)}</li>`).join("");
  const eventHtml = events.length ? events.map(event => { const source = event.sources?.[0]; return `<div class="drawer-event"><strong>${esc(event.headline)}</strong><span class="meta">${esc(fmtDate(event.published_time))}</span>${source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a>` : ""}</div>`; }).join("") : `<p>${esc(t("noRelatedEvents"))}</p>`;
  $("#drawerContent").innerHTML = `<header class="drawer-header"><span class="drawer-symbol">${esc(ticker)}</span><h2 id="drawerTitle">${esc(item.company || ticker)}</h2><p>${esc(localizedField(item, "sector"))}</p><div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${confidence(item.confidence)}<span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></div></header><div class="drawer-metrics"><div><span>${esc(t("price"))}</span><strong>${price.price == null ? "—" : fmtMoney(price.price, price.currency)}</strong></div><div><span>21D</span><strong class="${pctClass(price.return_21d_pct)}">${fmtPct(price.return_21d_pct)}</strong></div><div><span>252D</span><strong class="${pctClass(price.return_252d_pct)}">${fmtPct(price.return_252d_pct)}</strong></div><div><span>${esc(t("fiftyTwoWeekHigh"))}</span><strong class="${pctClass(price.distance_from_52w_high_pct)}">${fmtPct(price.distance_from_52w_high_pct)}</strong></div><div><span>${esc(t("materialEvents"))}</span><strong>${item.material_event_count ?? events.length}</strong></div><div><span>${esc(t("priceDate"))}</span><strong>${esc(fmtDateOnly(price.price_as_of))}</strong></div></div><section class="drawer-section"><h3>${esc(t("thesis"))}</h3><p>${esc(localizedField(item, "summary"))}</p></section><section class="drawer-section"><h3>${esc(t("priceContext"))}</h3><p>${esc(localizedField(item, "performance_context"))}</p></section><section class="drawer-section"><h3>${esc(t("keyDrivers"))}</h3><ul>${drivers || "<li>—</li>"}</ul></section><section class="drawer-section"><h3>${esc(t("keyRisks"))}</h3><ul>${risks || "<li>—</li>"}</ul></section><section class="drawer-section"><h3>${esc(t("relatedEvents"))}</h3>${eventHtml}</section>`;
  $("#assetDrawer").classList.add("open");
  $("#assetDrawer").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("#closeDrawer").focus();
}
function closeAssetDrawer() { $("#assetDrawer").classList.remove("open"); $("#assetDrawer").setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }

function reportMarketPrices() {
  const prices = {};
  const rows = state.report?.watchlist || [];
  for (const transaction of state.portfolio.transactions) {
    const symbol = PortfolioEngine.normalizeSymbol(transaction.symbol);
    const row = rows.find(candidate => [candidate.ticker, candidate.provider_symbol].map(value => String(value || "").toUpperCase()).includes(symbol));
    if (!row || row.price == null) continue;
    if (PortfolioEngine.normalizeCurrency(row.currency) !== PortfolioEngine.normalizeCurrency(transaction.currency)) continue;
    prices[PortfolioEngine.assetKey(transaction)] = { price: Number(row.price), date: row.price_as_of || null, source: "automatic" };
  }
  return prices;
}
function portfolioMarketPrices() { return { ...reportMarketPrices(), ...state.portfolio.manualPrices }; }
function portfolioResult() { return PortfolioEngine.calculate(state.portfolio.transactions, portfolioMarketPrices()); }
function formatTotals(totalsByCurrency, field) { const entries = Object.values(totalsByCurrency); if (!entries.length) return "—"; return entries.map(item => fmtMoney(item[field], item.currency)).join(" · "); }
function aggregateClass(totalsByCurrency, field) { const values = Object.values(totalsByCurrency).map(item => finite(item[field])).filter(value => value !== null); if (!values.length) return ""; if (values.every(value => value > 0)) return "up"; if (values.every(value => value < 0)) return "down"; return ""; }

function renderPortfolio() {
  const result = portfolioResult();
  $("#portfolioCostTotals").textContent = formatTotals(result.totalsByCurrency, "remainingCost");
  $("#portfolioMarketTotals").textContent = formatTotals(result.totalsByCurrency, "marketValue");
  $("#portfolioUnrealizedTotals").textContent = formatTotals(result.totalsByCurrency, "unrealizedPnl");
  $("#portfolioRealizedTotals").textContent = formatTotals(result.totalsByCurrency, "realizedPnl");
  $("#portfolioUnrealizedTotals").className = aggregateClass(result.totalsByCurrency, "unrealizedPnl");
  $("#portfolioRealizedTotals").className = aggregateClass(result.totalsByCurrency, "realizedPnl");
  const open = result.openHoldings;
  $("#portfolioEmpty").classList.toggle("hidden", open.length > 0);
  $("#portfolioHoldingsBody").innerHTML = open.map(holding => `<tr><td><div class="ticker-name"><strong>${esc(holding.symbol)}</strong><span>${esc(holding.name)} · ${esc(holding.unit)}</span></div></td><td>${esc(holding.assetType)}</td><td>${fmtNumber(holding.quantity)}</td><td>${fmtMoney(holding.averageCost, holding.currency)}</td><td>${holding.currentPrice == null ? `<span class="badge warning">${esc(t("noCurrentPrice"))}</span>` : `${fmtMoney(holding.currentPrice, holding.currency)}<span class="price-source">${esc(holding.currentPriceSource === "automatic" ? t("automatic") : t("manual"))} · ${esc(fmtDateOnly(holding.currentPriceDate))}</span>`}</td><td>${fmtMoney(holding.remainingCost, holding.currency)}</td><td>${holding.marketValue == null ? "—" : fmtMoney(holding.marketValue, holding.currency)}</td><td class="${pctClass(holding.unrealizedPnl)}">${holding.unrealizedPnl == null ? "—" : fmtMoney(holding.unrealizedPnl, holding.currency)}</td><td class="${pctClass(holding.realizedPnl)}">${fmtMoney(holding.realizedPnl, holding.currency)}</td></tr>`).join("");
  const ledger = [...result.ledger].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  $("#portfolioTransactionsBody").innerHTML = ledger.length ? ledger.map(tx => `<tr><td>${esc(fmtDateOnly(tx.date))}</td><td><span class="badge ${tx.side === "BUY" ? "positive" : "negative"}">${esc(tx.side === "BUY" ? t("buy") : t("sell"))}</span></td><td><div class="ticker-name"><strong>${esc(tx.symbol)}</strong><span>${esc(tx.name)} · ${esc(tx.unit)}</span></div></td><td>${fmtNumber(tx.quantity)}</td><td>${fmtMoney(tx.unitPrice, tx.currency)}</td><td>${fmtMoney(tx.fee, tx.currency)}</td><td>${fmtMoney(tx.gross, tx.currency)}</td><td class="${pctClass(tx.realizedPnl)}">${tx.side === "SELL" ? fmtMoney(tx.realizedPnl, tx.currency) : "—"}</td><td><div class="row-actions"><button class="icon-button edit-transaction" data-id="${esc(tx.id)}" type="button">${esc(t("edit"))}</button><button class="icon-button delete-transaction" data-id="${esc(tx.id)}" type="button">${esc(t("delete"))}</button></div></td></tr>`).join("") : `<tr><td colspan="9" class="table-empty">${esc(t("noTransactions"))}</td></tr>`;
  $$(".delete-transaction").forEach(button => button.onclick = () => deleteTransaction(button.dataset.id));
  $$(".edit-transaction").forEach(button => button.onclick = () => beginEditTransaction(button.dataset.id));
  const hasMissing = Object.values(result.totalsByCurrency).some(item => item.missingMarketValueCount > 0);
  $("#priceFormStatus").textContent = hasMissing ? t("portfolioValueIncomplete") : "";
  renderPortfolioPreview();
}

function formTransaction() {
  const symbol = PortfolioEngine.normalizeSymbol($("#txSymbol").value);
  const reportRow = (state.report?.watchlist || []).find(row => [row.ticker, row.provider_symbol].map(value => String(value || "").toUpperCase()).includes(symbol));
  return { id: state.editingTransactionId || makeId(), createdAt: state.editingTransactionId ? (state.portfolio.transactions.find(item => item.id === state.editingTransactionId)?.createdAt || new Date().toISOString()) : new Date().toISOString(), date: $("#txDate").value, assetType: $("#txAssetType").value, symbol, name: $("#txName").value.trim() || reportRow?.company || symbol, currency: PortfolioEngine.normalizeCurrency($("#txCurrency").value || reportRow?.currency), unit: PortfolioEngine.normalizeUnit($("#txUnit").value), side: $("#txSide").value, quantity: Number($("#txQuantity").value), unitPrice: Number($("#txUnitPrice").value), fee: Number($("#txFee").value || 0), notes: $("#txNotes").value.trim() };
}
function makeId() { return globalThis.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function resetTransactionForm() { state.editingTransactionId = null; $("#transactionForm").reset(); $("#txCurrency").value = "TRY"; $("#txUnit").value = "lot"; $("#txFee").value = "0"; $("#txDate").value = today(); $("#txCurrentPriceDate").value = today(); $("#transactionFormTitle").textContent = t("recordBuySell"); $("#transactionForm button[type='submit']").textContent = t("saveTransaction"); $("#cancelEdit").classList.add("hidden"); }
function beginEditTransaction(id) { const tx = state.portfolio.transactions.find(item => item.id === id); if (!tx) return; state.editingTransactionId = id; $("#txAssetType").value = tx.assetType; $("#txSymbol").value = tx.symbol; $("#txName").value = tx.name; $("#txCurrency").value = tx.currency; $("#txUnit").value = tx.unit; $("#txSide").value = tx.side; $("#txQuantity").value = tx.quantity; $("#txUnitPrice").value = tx.unitPrice; $("#txFee").value = tx.fee; $("#txDate").value = tx.date; $("#txNotes").value = tx.notes || ""; $("#transactionFormTitle").textContent = t("editTransaction"); $("#transactionForm button[type='submit']").textContent = t("updateTransaction"); $("#cancelEdit").classList.remove("hidden"); $("#transactionForm").scrollIntoView({ behavior: "smooth", block: "start" }); }
function deleteTransaction(id) { if (!window.confirm(t("confirmDelete"))) return; const candidate = state.portfolio.transactions.filter(transaction => transaction.id !== id); const result = PortfolioEngine.calculate(candidate, portfolioMarketPrices()); if (!result.isValid) { $("#txFormStatus").textContent = t("transactionDeleteBlocked"); return; } state.portfolio.transactions = candidate; savePortfolio(); if (state.editingTransactionId === id) resetTransactionForm(); $("#txFormStatus").textContent = ""; renderPortfolio(); }
function exportPortfolio() { const payload = { version: 1, exportedAt: new Date().toISOString(), costMethod: "WEIGHTED_AVERAGE", transactions: state.portfolio.transactions, manualPrices: state.portfolio.manualPrices }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `piyasa-masasi-portfolio-${today()}.json`; anchor.click(); URL.revokeObjectURL(url); showToast(t("backupExported")); }
async function importPortfolio(file) { try { const payload = JSON.parse(await file.text()); if (!payload || payload.version !== 1 || !Array.isArray(payload.transactions)) throw new Error("invalid"); const result = PortfolioEngine.calculate(payload.transactions, payload.manualPrices || {}); if (!result.isValid) throw new Error("inconsistent"); if (!window.confirm(t("confirmImport"))) return; state.portfolio = { version: 1, transactions: payload.transactions, manualPrices: payload.manualPrices || {} }; savePortfolio(); renderPortfolio(); showToast(t("importSuccess")); } catch (_) { showToast(t("importError")); } }
function autofillAsset() { const symbol = PortfolioEngine.normalizeSymbol($("#txSymbol").value); const row = (state.report?.watchlist || []).find(item => [item.ticker, item.provider_symbol].map(value => String(value || "").toUpperCase()).includes(symbol)); if (!row) return; if (!$("#txName").value.trim()) $("#txName").value = row.company || row.ticker; $("#txCurrency").value = row.currency || $("#txCurrency").value; if ($("#txAssetType").value === "STOCK") $("#txUnit").value = state.language === "tr" ? "lot" : "share"; }
function navigate(view) { if (!VIEW_COPY[view]) return; if (location.hash.slice(1) === view) setView(view); else location.hash = view; }

function wireEvents() {
  $$(".tab").forEach(tab => tab.onclick = () => navigate(tab.dataset.view));
  bindViewOpeners();
  $("#experienceLevel").onchange = event => { state.experience = event.target.value; localStorage.setItem(EXPERIENCE_KEY, state.experience); document.documentElement.dataset.experience = state.experience; renderEvaluations(state.report?.company_evaluations || []); };
  window.addEventListener("hashchange", () => { const view = location.hash.slice(1); if (VIEW_COPY[view]) setView(view); });
  $("#languageToggle").onclick = () => { state.language = state.language === "tr" ? "en" : "tr"; localStorage.setItem(LANGUAGE_KEY, state.language); applyLanguage(); };
  $("#refresh").onclick = async () => { if ("serviceWorker" in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map(registration => registration.update().catch(() => null))); } await load(); };
  $("#globalSearch").oninput = event => { state.query = event.target.value; if (state.report) { renderEvaluations(state.report.company_evaluations || []); renderEvents(state.report.events || []); renderWatchlist(state.report.watchlist || [], state.report.company_evaluations || []); } };
  $("#globalSearch").onkeydown = event => { if (event.key === "Enter") navigate("watchlist"); };
  $("#marketSearch").oninput = event => { state.marketSearch = event.target.value; renderWatchlist(state.report?.watchlist || [], state.report?.company_evaluations || []); };
  $("#marketSort").onchange = event => { state.marketSort = event.target.value; renderWatchlist(state.report?.watchlist || [], state.report?.company_evaluations || []); };
  $("#drawerBackdrop").onclick = closeAssetDrawer;
  $("#closeDrawer").onclick = closeAssetDrawer;
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeAssetDrawer(); });
  $("#txSymbol").addEventListener("change", autofillAsset);
  $("#cancelEdit").onclick = () => { resetTransactionForm(); $("#txFormStatus").textContent = ""; };

  $("#transactionForm").onsubmit = event => {
    event.preventDefault();
    const transaction = formTransaction();
    const base = state.editingTransactionId ? state.portfolio.transactions.filter(item => item.id !== state.editingTransactionId) : state.portfolio.transactions;
    const result = PortfolioEngine.calculate([...base, transaction], portfolioMarketPrices());
    const errors = result.errors.filter(error => error.transactionId === transaction.id);
    if (errors.length) { const oversell = errors.find(error => error.codes.includes("SELL_EXCEEDS_HOLDING")); $("#txFormStatus").textContent = oversell ? t("oversell", { available: fmtNumber(oversell.availableQuantity) }) : t("invalidTransaction"); return; }
    if (state.editingTransactionId) state.portfolio.transactions = state.portfolio.transactions.map(item => item.id === state.editingTransactionId ? transaction : item); else state.portfolio.transactions.push(transaction);
    const currentPrice = Number($("#txCurrentPrice").value);
    if (Number.isFinite(currentPrice) && currentPrice >= 0) state.portfolio.manualPrices[PortfolioEngine.assetKey(transaction)] = { price: currentPrice, date: $("#txCurrentPriceDate").value || today(), source: "manual" };
    const message = state.editingTransactionId ? t("transactionUpdated") : t("transactionSaved");
    savePortfolio(); resetTransactionForm(); $("#txFormStatus").textContent = message; renderPortfolio();
  };

  $("#priceForm").onsubmit = event => {
    event.preventDefault();
    const symbol = PortfolioEngine.normalizeSymbol($("#priceSymbol").value);
    const currency = PortfolioEngine.normalizeCurrency($("#priceCurrency").value);
    const unit = PortfolioEngine.normalizeUnit($("#priceUnit").value);
    const holding = portfolioResult().holdings.find(item => item.symbol === symbol && item.currency === currency && item.unit === unit);
    if (!holding) { $("#priceFormStatus").textContent = t("matchingHoldingMissing"); return; }
    state.portfolio.manualPrices[holding.key] = { price: Number($("#priceValue").value), date: $("#priceDate").value, source: "manual" };
    savePortfolio(); $("#priceFormStatus").textContent = t("priceSaved"); renderPortfolio();
  };

  $("#exportPortfolio").onclick = exportPortfolio;
  $("#importPortfolioBtn").onclick = () => $("#importPortfolioFile").click();
  $("#importPortfolioFile").onchange = event => { const file = event.target.files?.[0]; if (file) importPortfolio(file); event.target.value = ""; };
  $("#tickerForm").onsubmit = event => { event.preventDefault(); const providerSymbol = $("#ticker").value.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, ""); const company = $("#company").value.trim(); if (!providerSymbol) return; const title = `[AI-BULLETIN] ADD ${providerSymbol}`; const body = `Provider symbol: ${providerSymbol}\nCompany: ${company || providerSymbol}\n\nPlease add this asset to the central evaluation universe.`; window.open(`${REPO_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, "_blank", "noopener"); $("#tickerStatus").textContent = t("requestOpened", { symbol: providerSymbol }); };
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(registration => registration.update()).catch(() => null));
wireEvents();
resetTransactionForm();
$("#priceDate").value = today();
applyLanguage();
load();
