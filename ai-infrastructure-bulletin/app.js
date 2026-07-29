const DATA_URL = "./data/report.json";
const APP_VERSION = "2026.07.29.6";
const REPO_ISSUES_URL = "https://github.com/Gibiamie/piyasa-masasi-ai/issues/new";
const PORTFOLIO_KEY = "ai-infrastructure-bulletin.portfolio.v1";
const LANGUAGE_KEY = "ai-infrastructure-bulletin.language";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const I18N = {
  tr: {
    eyebrow: "ŞİRKET BAZLI PİYASA İSTİHBARATI", appTitle: "AI Altyapısı Piyasa Bülteni",
    appSubtitle: "Takip listesindeki her varlığı haber, fiyat trendi, temel sürücüler ve risklerle değerlendirir; kişisel portföyde gerçek işlem maliyetini takip eder.",
    loading: "Yükleniyor", refresh: "Yenile", tabBriefing: "Günlük Değerlendirme", tabPerformance: "Fiyat Performansı", tabPortfolio: "Portföyüm", tabSources: "Kaynaklar", tabUniverse: "Takip Evreni",
    reportTime: "Rapor zamanı", companiesEvaluated: "Değerlendirilen şirket", materialEvents: "Önemli gelişme", leadingCompany: "Öne çıkan şirket", generalAssessment: "GENEL DEĞERLENDİRME", preparingEvaluation: "Değerlendirme hazırlanıyor", loadingData: "Veri yükleniyor.", mainRisk: "Ana risk:", byCompany: "ŞİRKET BAZINDA", dailyResearchViews: "Günlük araştırma görüşleri", last24Hours: "SON 24 SAAT", companyMaterialEvents: "Şirkete özgü maddi gelişmeler", noMaterialEvent: "Önem eşiğini geçen gelişme yok", noMaterialEventDetail: "Haber bulunmaması şirketin fiyat ve temel risk değerlendirmesini durdurmaz.",
    fullUniverse: "TÜM TAKİP EVRENİ", companyPerformance: "Şirket performansı", marketDataLoading: "Piyasa verisi yükleniyor.", company: "Şirket", price: "Fiyat", oneDay: "1 Gün", twentyOneDays: "21 Gün", twoFiftyTwoDays: "252 Gün", fiftyTwoWeekHigh: "52H Zirve", risk: "Risk",
    personalPortfolio: "KİŞİSEL PORTFÖY", portfolioTitle: "Sepetim ve işlem defterim", exportBackup: "Yedeği indir", importBackup: "Yedek yükle", privacyNote: "Portföy verileri bu cihazın tarayıcısında saklanır; GitHub'a veya haber raporuna gönderilmez.", remainingCost: "Kalan maliyet", marketValue: "Piyasa değeri", unrealizedPnl: "Gerçekleşmemiş K/Z", realizedPnl: "Gerçekleşen K/Z",
    newTransaction: "YENİ İŞLEM", recordBuySell: "Alış veya satış kaydet", costMethodNote: "Maliyet yöntemi: komisyon dahil hareketli ağırlıklı ortalama. Satış, kalan ortalama maliyeti değiştirmez.", assetType: "Varlık türü", assetStock: "Hisse", assetEtf: "ETF", assetFund: "Fon", assetCommodity: "Emtia", assetCrypto: "Kripto", assetFx: "Döviz", assetOther: "Diğer", symbol: "Sembol", assetName: "Varlık adı", currency: "Para birimi", unit: "Birim", transactionType: "İşlem türü", buy: "Alış", sell: "Satış", quantity: "Adet / lot", unitPrice: "İlgili lotun / birimin fiyatı", fee: "Komisyon / masraf", transactionDate: "İşlem tarihi", optionalCurrentPrice: "Güncel fiyat (opsiyonel)", currentPriceDate: "Güncel fiyat tarihi", notes: "Not", saveTransaction: "İşlemi kaydet",
    manualPrice: "MANUEL PİYASA FİYATI", updateUnsupportedPrice: "Otomatik verisi olmayan varlığı güncelle", manualPriceDetail: "Takip raporunda bulunan sembollerin fiyatı otomatik kullanılır. Emtia, kripto veya desteklenmeyen semboller için fiyatı manuel kaydedebilirsiniz.", currentPrice: "Güncel fiyat", priceDate: "Fiyat tarihi", savePrice: "Fiyatı kaydet", calculationRules: "Hesaplama kuralları", ruleBuy: "Alış komisyonu maliyete eklenir.", ruleSell: "Satış komisyonu gerçekleşen kâr/zarardan düşülür.", ruleNoOversell: "Mevcut miktardan fazla satış kaydedilemez.", ruleCurrencies: "Farklı para birimleri birbirine eklenmez; sonuçlar ayrı gösterilir.",
    openPositions: "AÇIK POZİSYONLAR", portfolioHoldings: "Portföy varlıkları", asset: "Varlık", type: "Tür", averageCost: "Ort. maliyet", emptyPortfolio: "Portföy henüz boş", emptyPortfolioDetail: "İlk alış işleminizi yukarıdaki formdan kaydedin.", transactionLedger: "İŞLEM DEFTERİ", allBuysSells: "Tüm alış ve satışlar", date: "Tarih", transaction: "İşlem", grossValue: "Brüt tutar", action: "İşlem", delete: "Sil",
    evidenceChain: "KANIT ZİNCİRİ", newsSources: "Şirket haber kaynakları", addNewStock: "YENİ HİSSE EKLE", centralUniverse: "Merkezî değerlendirme evreni", providerSymbol: "Sağlayıcı sembolü", companyName: "Şirket adı", requestAddition: "Ekleme Talebi", universeLoading: "Takip evreni yükleniyor.", evaluationLogic: "DEĞERLENDİRME MANTIĞI", eachAssetSeparate: "Her varlık ayrı incelenir", evaluationLogicDetail: "Her şirket için 1, 21 ve 252 işlem günlük trend, son haberler, temel sürücüler, özel riskler ve tez etkisi birlikte değerlendirilir.", riskLanguage: "RİSK DİLİ", researchNotOrder: "Araştırma görüşü, emir değildir", riskLanguageDetail: "Uygulama güçlü pozitif, pozitif, nötr, negatif ve yüksek belirsizlik sınıfları üretir. Kullanıcı profili olmadan kişisel al/sat emri oluşturmaz.", footer: "Yatırım araştırması ve finansal okuryazarlık içindir; kişiselleştirilmiş yatırım danışmanlığı veya işlem emri vermez.",
    freshData: "Güncel veri", staleData: "Veri eski olabilir", dataError: "Veri hatası", evaluationUnavailable: "Değerlendirme verisi açılamadı", marketClose: "Piyasa kapanış verisi: {date}", marketUnavailable: "Piyasa verisi mevcut değil.", all: "Tümü", strongPositive: "Güçlü Pozitif", positive: "Pozitif", neutral: "Nötr", negative: "Negatif", highUncertainty: "Yüksek Belirsizlik", highConfidence: "Yüksek Güven", mediumConfidence: "Orta Güven", lowConfidence: "Düşük Güven", unverified: "Doğrulanmadı", priceContext: "FİYAT BAĞLAMI", keyDrivers: "ANA SÜRÜCÜLER", keyRisks: "ANA RİSKLER", evaluation: "DEĞERLENDİRME", whatHappened: "NE OLDU?", whyImportant: "NEDEN ÖNEMLİ?", investmentMeaning: "YATIRIM AÇISINDAN ANLAMI", openSource: "Kaynağı aç ↗", sourceUnavailable: "Kaynak bulunamadı", evaluatedUniverse: "{count} varlık merkezî değerlendirme evreninde. Yeni eklenen her varlık sonraki otomatik çalışmada aynı değerlendirmeden geçer.", requestOpened: "{symbol} için GitHub ekleme talebi açıldı. Talep gönderildiğinde otomasyon varlığı kalıcı evrene ekler ve değerlendirmeyi üretir.",
    transactionSaved: "İşlem kaydedildi.", priceSaved: "Piyasa fiyatı kaydedildi.", invalidTransaction: "İşlem bilgileri geçersiz.", oversell: "Satış miktarı mevcut {available} birimden fazla olamaz.", matchingHoldingMissing: "Bu sembol, para birimi ve birimle eşleşen pozisyon bulunamadı.", transactionDeleteBlocked: "Bu alış silinirse sonraki bir satış mevcut miktarı aşacak. Önce ilgili satış kaydını düzeltin veya silin.", confirmDelete: "Bu işlem kaydı silinsin mi?", confirmImport: "Yüklenen yedek mevcut portföy kayıtlarının yerini alacak. Devam edilsin mi?", importSuccess: "Portföy yedeği yüklendi.", importError: "Yedek dosyası geçersiz veya tutarsız.", backupExported: "Portföy yedeği indirildi.", manual: "Manuel", automatic: "Otomatik", noCurrentPrice: "Güncel fiyat yok", costMethod: "Ağırlıklı ortalama", portfolioValueIncomplete: "Bazı açık pozisyonlarda güncel fiyat bulunmadığı için piyasa değeri eksiktir.", noTransactions: "Henüz işlem kaydı yok.",
  },
  en: {
    eyebrow: "COMPANY-SPECIFIC MARKET INTELLIGENCE", appTitle: "AI Infrastructure Market Bulletin",
    appSubtitle: "Evaluates every tracked asset using news, price trends, fundamental drivers and risks, while maintaining the actual transaction cost of the personal portfolio.",
    loading: "Loading", refresh: "Refresh", tabBriefing: "Daily Evaluation", tabPerformance: "Price Performance", tabPortfolio: "My Portfolio", tabSources: "Sources", tabUniverse: "Tracking Universe",
    reportTime: "Report time", companiesEvaluated: "Companies evaluated", materialEvents: "Material events", leadingCompany: "Leading company", generalAssessment: "GENERAL ASSESSMENT", preparingEvaluation: "Preparing evaluation", loadingData: "Loading data.", mainRisk: "Main risk:", byCompany: "BY COMPANY", dailyResearchViews: "Daily research views", last24Hours: "LAST 24 HOURS", companyMaterialEvents: "Company-specific material events", noMaterialEvent: "No event passed the materiality threshold", noMaterialEventDetail: "The absence of news does not stop the price and fundamental risk assessment.",
    fullUniverse: "FULL TRACKING UNIVERSE", companyPerformance: "Company performance", marketDataLoading: "Loading market data.", company: "Company", price: "Price", oneDay: "1 Day", twentyOneDays: "21 Days", twoFiftyTwoDays: "252 Days", fiftyTwoWeekHigh: "52W High", risk: "Risk",
    personalPortfolio: "PERSONAL PORTFOLIO", portfolioTitle: "My basket and transaction ledger", exportBackup: "Download backup", importBackup: "Import backup", privacyNote: "Portfolio data is stored in this device's browser; it is not sent to GitHub or the news report.", remainingCost: "Remaining cost", marketValue: "Market value", unrealizedPnl: "Unrealized P/L", realizedPnl: "Realized P/L",
    newTransaction: "NEW TRANSACTION", recordBuySell: "Record a purchase or sale", costMethodNote: "Cost method: moving weighted average including purchase fees. A sale does not change the remaining average cost.", assetType: "Asset type", assetStock: "Stock", assetEtf: "ETF", assetFund: "Fund", assetCommodity: "Commodity", assetCrypto: "Crypto", assetFx: "FX", assetOther: "Other", symbol: "Symbol", assetName: "Asset name", currency: "Currency", unit: "Unit", transactionType: "Transaction type", buy: "Buy", sell: "Sell", quantity: "Quantity / lots", unitPrice: "Price of the relevant lot / unit", fee: "Commission / fee", transactionDate: "Transaction date", optionalCurrentPrice: "Current price (optional)", currentPriceDate: "Current-price date", notes: "Notes", saveTransaction: "Save transaction",
    manualPrice: "MANUAL MARKET PRICE", updateUnsupportedPrice: "Update an asset without automatic data", manualPriceDetail: "Symbols in the central report use automatic prices. You can store a manual price for commodities, crypto or unsupported symbols.", currentPrice: "Current price", priceDate: "Price date", savePrice: "Save price", calculationRules: "Calculation rules", ruleBuy: "Purchase fees are capitalized into cost.", ruleSell: "Sale fees reduce realized profit or loss.", ruleNoOversell: "A sale cannot exceed the available quantity.", ruleCurrencies: "Different currencies are never added together; totals are displayed separately.",
    openPositions: "OPEN POSITIONS", portfolioHoldings: "Portfolio holdings", asset: "Asset", type: "Type", averageCost: "Avg. cost", emptyPortfolio: "The portfolio is empty", emptyPortfolioDetail: "Record the first purchase using the form above.", transactionLedger: "TRANSACTION LEDGER", allBuysSells: "All purchases and sales", date: "Date", transaction: "Transaction", grossValue: "Gross value", action: "Action", delete: "Delete",
    evidenceChain: "EVIDENCE CHAIN", newsSources: "Company news sources", addNewStock: "ADD A NEW STOCK", centralUniverse: "Central evaluation universe", providerSymbol: "Provider symbol", companyName: "Company name", requestAddition: "Request Addition", universeLoading: "Loading tracking universe.", evaluationLogic: "EVALUATION LOGIC", eachAssetSeparate: "Each asset is assessed separately", evaluationLogicDetail: "The 1-, 21- and 252-trading-day trends, recent news, fundamental drivers, specific risks and thesis impact are assessed together.", riskLanguage: "RISK LANGUAGE", researchNotOrder: "A research view is not an order", riskLanguageDetail: "The application produces strong-positive, positive, neutral, negative and high-uncertainty classifications. It does not create a personal buy or sell order without a user profile.", footer: "For investment research and financial literacy; it does not provide personalized investment advice or an execution order.",
    freshData: "Current data", staleData: "Data may be stale", dataError: "Data error", evaluationUnavailable: "Evaluation data could not be opened", marketClose: "Market close data: {date}", marketUnavailable: "Market data is unavailable.", all: "All", strongPositive: "Strong Positive", positive: "Positive", neutral: "Neutral", negative: "Negative", highUncertainty: "High Uncertainty", highConfidence: "High Confidence", mediumConfidence: "Medium Confidence", lowConfidence: "Low Confidence", unverified: "Unverified", priceContext: "PRICE CONTEXT", keyDrivers: "KEY DRIVERS", keyRisks: "KEY RISKS", evaluation: "EVALUATION", whatHappened: "WHAT HAPPENED?", whyImportant: "WHY IS IT IMPORTANT?", investmentMeaning: "INVESTMENT IMPLICATION", openSource: "Open source ↗", sourceUnavailable: "No source available", evaluatedUniverse: "{count} assets are in the central evaluation universe. Every subsequently added asset receives the same assessment in the next automated run.", requestOpened: "A GitHub addition request was opened for {symbol}. Once submitted, automation adds it to the permanent universe and produces its evaluation.",
    transactionSaved: "Transaction saved.", priceSaved: "Market price saved.", invalidTransaction: "The transaction data is invalid.", oversell: "The sale quantity cannot exceed the available {available} units.", matchingHoldingMissing: "No position matches this symbol, currency and unit.", transactionDeleteBlocked: "Deleting this purchase would make a later sale exceed the available quantity. Correct or delete that sale first.", confirmDelete: "Delete this transaction record?", confirmImport: "The imported backup will replace the current portfolio records. Continue?", importSuccess: "Portfolio backup imported.", importError: "The backup file is invalid or inconsistent.", backupExported: "Portfolio backup downloaded.", manual: "Manual", automatic: "Automatic", noCurrentPrice: "No current price", costMethod: "Weighted average", portfolioValueIncomplete: "Market value is incomplete because some open positions have no current price.", noTransactions: "No transactions have been recorded yet.",
  },
};

const state = {
  report: null,
  ticker: "all",
  language: localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "tr",
  portfolio: loadPortfolio(),
};

function t(key, values = {}) {
  let value = I18N[state.language][key] || I18N.tr[key] || key;
  Object.entries(values).forEach(([name, replacement]) => { value = value.replace(`{${name}}`, String(replacement)); });
  return value;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);
}

function locale() { return state.language === "en" ? "en-TR" : "tr-TR"; }

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale(), {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Muscat"}).format(date);
}

function fmtDateOnly(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale(), {dateStyle:"medium",timeZone:"UTC"}).format(date);
}

function fmtNumber(value, digits = 8) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(locale(), {maximumFractionDigits:digits}).format(Number(value));
}

function fmtMoney(value, currency) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(locale(), {style:"currency",currency:String(currency || "USD"),maximumFractionDigits:2}).format(Number(value));
  } catch {
    return `${String(currency || "")} ${fmtNumber(value, 2)}`.trim();
  }
}

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function pctClass(value) {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? (number > 0 ? "up" : "down") : "";
}

function ratingInfo(rating) {
  return ({STRONG_POSITIVE:[t("strongPositive"),"positive"],POSITIVE:[t("positive"),"positive"],NEUTRAL:[t("neutral"),"neutral"],NEGATIVE:[t("negative"),"negative"],HIGH_UNCERTAINTY:[t("highUncertainty"),"warning"]})[rating] || [rating || t("neutral"),"neutral"];
}

function cardClass(rating) {
  if (["STRONG_POSITIVE","POSITIVE"].includes(rating)) return "positive";
  if (rating === "NEGATIVE") return "negative";
  if (rating === "HIGH_UNCERTAINTY") return "uncertain";
  return "";
}

function confidence(value) {
  const label = {HIGH:t("highConfidence"),MEDIUM:t("mediumConfidence"),LOW:t("lowConfidence"),UNVERIFIED:t("unverified")}[value] || value;
  const className = value === "HIGH" ? "blue" : value === "LOW" || value === "UNVERIFIED" ? "warning" : "neutral";
  return `<span class="badge ${className}">${esc(label)}</span>`;
}

function loadPortfolio() {
  try {
    const stored = JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || "null");
    if (!stored || stored.version !== 1 || !Array.isArray(stored.transactions)) throw new Error("invalid");
    return {version:1,transactions:stored.transactions,manualPrices:stored.manualPrices || {}};
  } catch {
    return {version:1,transactions:[],manualPrices:{}};
  }
}

function savePortfolio() {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state.portfolio));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() { return new Date().toISOString().slice(0, 10); }

function applyLanguage() {
  document.documentElement.lang = state.language;
  $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  $("#languageToggle").textContent = state.language === "tr" ? "EN" : "TR";
  document.title = t("appTitle");
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = t("appSubtitle");
  if (state.report) render(); else renderPortfolio();
}

async function load() {
  $("#freshness").textContent = t("loading");
  $("#freshness").className = "badge neutral";
  try {
    const response = await fetch(`${DATA_URL}?app=${APP_VERSION}&v=${Date.now()}`, {cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.report = await response.json();
    render();
  } catch (error) {
    $("#freshness").textContent = t("dataError");
    $("#freshness").className = "badge negative";
    $("#evaluations").innerHTML = `<article class="card negative"><h3>${esc(t("evaluationUnavailable"))}</h3><p>${esc(error.message)}</p></article>`;
    renderPortfolio();
  }
}

function render() {
  const data = state.report;
  const report = data.report;
  const summary = data.executive_summary;
  const events = data.events || [];
  const evaluations = data.company_evaluations || [];
  $("#generatedAt").textContent = fmtDate(report.generated_at);
  $("#companyCount").textContent = String(report.company_count ?? evaluations.length ?? data.watchlist?.length ?? 0);
  $("#eventCount").textContent = String(report.material_event_count ?? events.length);
  $("#dominantTheme").textContent = summary.dominant_theme || "—";
  $("#mainRiskValue").textContent = summary.main_risk || "—";
  $("#summaryTitle").textContent = summary.headline || t("generalAssessment");
  $("#summaryText").textContent = summary.summary || t("noMaterialEvent");
  $("#marketAsOf").textContent = report.market_data_as_of ? t("marketClose", {date:fmtDateOnly(report.market_data_as_of)}) : t("marketUnavailable");
  const generatedAt = new Date(report.generated_at).getTime();
  const ageHours = Number.isFinite(generatedAt) ? Math.max(0, (Date.now() - generatedAt) / 36e5) : Infinity;
  $("#freshness").textContent = ageHours <= 30 ? t("freshData") : t("staleData");
  $("#freshness").className = `badge ${ageHours <= 30 ? "positive" : "warning"}`;
  renderTickerFilters(evaluations);
  renderEvaluations(evaluations);
  renderEvents(events);
  renderWatchlist(data.watchlist || []);
  renderSources(events);
  renderUniverse(data.watchlist || []);
  renderPortfolio();
}

function renderTickerFilters(evaluations) {
  const tickers = [{value:"all",label:t("all")}, ...evaluations.map(item => ({value:item.ticker,label:item.ticker}))];
  $("#filters").innerHTML = tickers.map(item => `<button class="filter ${state.ticker === item.value ? "active" : ""}" data-ticker="${esc(item.value)}">${esc(item.label)}</button>`).join("");
  $$("#filters .filter").forEach(button => { button.onclick = () => { state.ticker = button.dataset.ticker; renderTickerFilters(evaluations); renderEvaluations(evaluations); renderEvents(state.report?.events || []); }; });
}

function renderEvaluations(evaluations) {
  const list = state.ticker === "all" ? evaluations : evaluations.filter(item => item.ticker === state.ticker);
  $("#evaluations").innerHTML = list.map(item => {
    const [label,badgeClass] = ratingInfo(item.rating);
    const drivers = (item.key_drivers || []).map(value => `<li>${esc(value)}</li>`).join("");
    const risks = (item.key_risks || []).map(value => `<li>${esc(value)}</li>`).join("");
    const price = item.price_context || {};
    return `<article class="card ${cardClass(item.rating)}"><div class="meta"><span>${esc(item.ticker)}</span><span>•</span><span>${esc(item.company)}</span><span>•</span><span>${esc(item.sector || "")}</span></div><h3>${esc(item.company)}</h3><div class="badges"><span class="badge ${badgeClass}">${esc(label)}</span>${confidence(item.confidence)}<span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></div><div class="section"><strong>${esc(t("priceContext"))}</strong><p>${esc(item.performance_context || item.summary || "")}</p><p class="meta">${esc(price.currency || "")} ${price.price == null ? "—" : fmtNumber(price.price,2)} · 21D ${fmtPct(price.return_21d_pct)} · 252D ${fmtPct(price.return_252d_pct)} · ${esc(t("materialEvents"))} ${esc(item.material_event_count ?? 0)}</p></div><div class="section"><strong>${esc(t("keyDrivers"))}</strong><ul>${drivers}</ul></div><div class="section"><strong>${esc(t("keyRisks"))}</strong><ul>${risks}</ul></div><div class="section"><strong>${esc(t("evaluation"))}</strong><p>${esc(item.summary || "")}</p></div></article>`;
  }).join("");
}

function renderEvents(events) {
  const list = state.ticker === "all" ? events : events.filter(event => (event.companies || []).includes(state.ticker));
  $("#empty").classList.toggle("hidden", list.length > 0);
  $("#events").innerHTML = list.map(event => {
    const [ratingLabel,ratingClass] = ratingInfo(event.research_view?.rating);
    const facts = (event.facts || []).map(value => `<li>${esc(value)}</li>`).join("");
    const risks = (event.research_view?.risks || []).map(value => `<li>${esc(value)}</li>`).join("");
    const source = event.sources?.[0];
    return `<article class="card ${cardClass(event.research_view?.rating)}"><div class="meta"><span>${esc((event.companies || []).join(", ") || event.primary_theme)}</span><span>•</span><span>${esc(fmtDate(event.published_time))}</span></div><h3>${esc(event.headline)}</h3><div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${confidence(event.confidence)}<span class="badge neutral">${esc(event.risk_badge || "STANDARD")}</span></div><div class="section"><strong>${esc(t("whatHappened"))}</strong><ul>${facts}</ul></div><div class="section"><strong>${esc(t("whyImportant"))}</strong><p>${esc(event.why_it_matters)}</p></div><div class="section"><strong>${esc(t("investmentMeaning"))}</strong><p>${esc(event.investment_meaning || event.research_view?.summary || "")}</p>${risks ? `<ul>${risks}</ul>` : ""}</div>${source ? `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a>` : ""}</article>`;
  }).join("");
}

function renderWatchlist(items) {
  $("#watchlistBody").innerHTML = items.map(value => `<tr><td><div class="ticker-name"><strong>${esc(value.ticker)}</strong><span>${esc(value.company || "")} • ${esc(fmtDateOnly(value.price_as_of))}</span></div></td><td>${value.price == null ? "—" : fmtMoney(value.price,value.currency)}</td><td class="${pctClass(value.return_1d_pct)}">${fmtPct(value.return_1d_pct)}</td><td class="${pctClass(value.return_21d_pct)}">${fmtPct(value.return_21d_pct)}</td><td class="${pctClass(value.return_252d_pct)}">${fmtPct(value.return_252d_pct)}</td><td class="${pctClass(value.distance_from_52w_high_pct)}">${fmtPct(value.distance_from_52w_high_pct)}</td><td><span class="badge ${value.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(value.risk_badge || "STANDARD")}</span></td></tr>`).join("");
}

function renderSources(events) {
  const sources = [];
  events.forEach(event => (event.sources || []).forEach(source => sources.push({...source,event:event.headline,tickers:event.companies || []})));
  $("#sourcesList").innerHTML = sources.length ? sources.map(source => `<article class="source"><div class="meta"><span>${esc(source.tickers.join(", "))}</span><span>•</span><span>${esc(source.source_type || "SECONDARY")}</span><span>•</span><span>${esc(source.publisher || "")}</span><span>•</span><span>${esc(fmtDate(source.published_at))}</span></div><h3>${esc(source.title)}</h3><p>${esc(source.event)}</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a></article>`).join("") : `<div class="empty"><h3>${esc(t("sourceUnavailable"))}</h3></div>`;
}

function renderUniverse(items) {
  $("#tickerChips").innerHTML = items.map(item => `<span class="chip">${esc(item.ticker)}</span>`).join("");
  $("#tickerStatus").textContent = t("evaluatedUniverse", {count:items.length});
}

function reportMarketPrices() {
  const prices = {};
  for (const row of state.report?.watchlist || []) {
    if (row.price == null) continue;
    const quote = {price:Number(row.price),date:row.price_as_of || null,source:"automatic"};
    prices[String(row.ticker || "").toUpperCase()] = quote;
    if (row.provider_symbol) prices[String(row.provider_symbol).toUpperCase()] = quote;
  }
  return prices;
}

function portfolioMarketPrices() {
  return {...state.portfolio.manualPrices, ...reportMarketPrices()};
}

function portfolioResult() {
  return PortfolioEngine.calculate(state.portfolio.transactions, portfolioMarketPrices());
}

function formatTotals(totalsByCurrency, field) {
  const entries = Object.values(totalsByCurrency).sort((a,b) => a.currency.localeCompare(b.currency));
  if (!entries.length) return "—";
  return entries.map(item => fmtMoney(item[field],item.currency)).join(" · ");
}

function renderPortfolio() {
  const result = portfolioResult();
  $("#portfolioCostTotals").textContent = formatTotals(result.totalsByCurrency,"remainingCost");
  $("#portfolioMarketTotals").textContent = formatTotals(result.totalsByCurrency,"marketValue");
  $("#portfolioUnrealizedTotals").textContent = formatTotals(result.totalsByCurrency,"unrealizedPnl");
  $("#portfolioRealizedTotals").textContent = formatTotals(result.totalsByCurrency,"realizedPnl");
  $("#portfolioUnrealizedTotals").className = aggregateClass(result.totalsByCurrency,"unrealizedPnl");
  $("#portfolioRealizedTotals").className = aggregateClass(result.totalsByCurrency,"realizedPnl");
  const open = result.openHoldings;
  $("#portfolioEmpty").classList.toggle("hidden", open.length > 0);
  $("#portfolioHoldingsBody").innerHTML = open.map(holding => `<tr><td><div class="ticker-name"><strong>${esc(holding.symbol)}</strong><span>${esc(holding.name)} · ${esc(holding.unit)}</span></div></td><td>${esc(holding.assetType)}</td><td>${fmtNumber(holding.quantity)}</td><td>${fmtMoney(holding.averageCost,holding.currency)}</td><td>${holding.currentPrice == null ? `<span class="badge warning">${esc(t("noCurrentPrice"))}</span>` : `${fmtMoney(holding.currentPrice,holding.currency)}<span class="price-source">${esc(holding.currentPriceSource === "automatic" ? t("automatic") : t("manual"))} · ${esc(fmtDateOnly(holding.currentPriceDate))}</span>`}</td><td>${fmtMoney(holding.remainingCost,holding.currency)}</td><td>${holding.marketValue == null ? "—" : fmtMoney(holding.marketValue,holding.currency)}</td><td class="${pctClass(holding.unrealizedPnl)}">${holding.unrealizedPnl == null ? "—" : fmtMoney(holding.unrealizedPnl,holding.currency)}</td><td class="${pctClass(holding.realizedPnl)}">${fmtMoney(holding.realizedPnl,holding.currency)}</td></tr>`).join("");
  const ledger = [...result.ledger].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  $("#portfolioTransactionsBody").innerHTML = ledger.length ? ledger.map(tx => `<tr><td>${esc(fmtDateOnly(tx.date))}</td><td><span class="badge ${tx.side === "BUY" ? "positive" : "negative"}">${esc(tx.side === "BUY" ? t("buy") : t("sell"))}</span></td><td><div class="ticker-name"><strong>${esc(tx.symbol)}</strong><span>${esc(tx.name)} · ${esc(tx.unit)}</span></div></td><td>${fmtNumber(tx.quantity)}</td><td>${fmtMoney(tx.unitPrice,tx.currency)}</td><td>${fmtMoney(tx.fee,tx.currency)}</td><td>${fmtMoney(tx.gross,tx.currency)}</td><td class="${pctClass(tx.realizedPnl)}">${tx.side === "SELL" ? fmtMoney(tx.realizedPnl,tx.currency) : "—"}</td><td><button class="icon-button delete-transaction" data-id="${esc(tx.id)}" type="button">${esc(t("delete"))}</button></td></tr>`).join("") : `<tr><td colspan="9" class="table-empty">${esc(t("noTransactions"))}</td></tr>`;
  $$(".delete-transaction").forEach(button => { button.onclick = () => deleteTransaction(button.dataset.id); });
  const hasMissing = Object.values(result.totalsByCurrency).some(item => item.missingMarketValueCount > 0);
  $("#priceFormStatus").textContent = hasMissing ? t("portfolioValueIncomplete") : "";
}

function aggregateClass(totalsByCurrency, field) {
  const values = Object.values(totalsByCurrency).map(item => item[field]).filter(Number.isFinite);
  if (!values.length) return "";
  const sum = values.reduce((total,value) => total + value,0);
  return sum > 0 ? "up" : sum < 0 ? "down" : "";
}

function formTransaction() {
  const symbol = PortfolioEngine.normalizeSymbol($("#txSymbol").value);
  const reportRow = (state.report?.watchlist || []).find(row => [row.ticker,row.provider_symbol].map(value => String(value || "").toUpperCase()).includes(symbol));
  return {
    id: makeId(), createdAt:new Date().toISOString(), date:$("#txDate").value,
    assetType:$("#txAssetType").value, symbol,
    name:$("#txName").value.trim() || reportRow?.company || symbol,
    currency:PortfolioEngine.normalizeCurrency($("#txCurrency").value || reportRow?.currency),
    unit:PortfolioEngine.normalizeUnit($("#txUnit").value), side:$("#txSide").value,
    quantity:Number($("#txQuantity").value), unitPrice:Number($("#txUnitPrice").value),
    fee:Number($("#txFee").value || 0), notes:$("#txNotes").value.trim(),
  };
}

function resetTransactionForm() {
  $("#transactionForm").reset();
  $("#txCurrency").value = "TRY";
  $("#txUnit").value = "lot";
  $("#txFee").value = "0";
  $("#txDate").value = today();
  $("#txCurrentPriceDate").value = today();
}

function deleteTransaction(id) {
  if (!window.confirm(t("confirmDelete"))) return;
  const candidate = state.portfolio.transactions.filter(transaction => transaction.id !== id);
  const result = PortfolioEngine.calculate(candidate, portfolioMarketPrices());
  if (!result.isValid) { $("#txFormStatus").textContent = t("transactionDeleteBlocked"); return; }
  state.portfolio.transactions = candidate;
  savePortfolio();
  $("#txFormStatus").textContent = "";
  renderPortfolio();
}

function exportPortfolio() {
  const payload = {version:1,exportedAt:new Date().toISOString(),costMethod:"WEIGHTED_AVERAGE",transactions:state.portfolio.transactions,manualPrices:state.portfolio.manualPrices};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `portfolio-backup-${today()}.json`; anchor.click();
  URL.revokeObjectURL(url);
  $("#txFormStatus").textContent = t("backupExported");
}

async function importPortfolio(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.version !== 1 || !Array.isArray(payload.transactions)) throw new Error("invalid");
    const result = PortfolioEngine.calculate(payload.transactions, payload.manualPrices || {});
    if (!result.isValid) throw new Error("inconsistent");
    if (!window.confirm(t("confirmImport"))) return;
    state.portfolio = {version:1,transactions:payload.transactions,manualPrices:payload.manualPrices || {}};
    savePortfolio(); renderPortfolio(); $("#txFormStatus").textContent = t("importSuccess");
  } catch { $("#txFormStatus").textContent = t("importError"); }
}

$$('.tab').forEach(tab => { tab.onclick = () => { $$('.tab').forEach(item => item.classList.toggle('active',item === tab)); $$('.view').forEach(view => view.classList.remove('active')); $(`#${tab.dataset.view}View`).classList.add('active'); if (tab.dataset.view === "portfolio") renderPortfolio(); }; });

$("#languageToggle").onclick = () => { state.language = state.language === "tr" ? "en" : "tr"; localStorage.setItem(LANGUAGE_KEY,state.language); applyLanguage(); };

$("#refresh").onclick = async () => { if ("serviceWorker" in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map(registration => registration.update().catch(() => null))); } await load(); };

$("#transactionForm").onsubmit = event => {
  event.preventDefault();
  const transaction = formTransaction();
  const errors = PortfolioEngine.validateAddition(state.portfolio.transactions, transaction);
  if (errors.length) {
    const oversell = errors.find(error => error.codes.includes("SELL_EXCEEDS_HOLDING"));
    $("#txFormStatus").textContent = oversell ? t("oversell",{available:fmtNumber(oversell.availableQuantity)}) : t("invalidTransaction");
    return;
  }
  state.portfolio.transactions.push(transaction);
  const currentPrice = Number($("#txCurrentPrice").value);
  if (Number.isFinite(currentPrice) && currentPrice >= 0) {
    state.portfolio.manualPrices[PortfolioEngine.assetKey(transaction)] = {price:currentPrice,date:$("#txCurrentPriceDate").value || today(),source:"manual"};
  }
  savePortfolio(); resetTransactionForm(); $("#txFormStatus").textContent = t("transactionSaved"); renderPortfolio();
};

$("#priceForm").onsubmit = event => {
  event.preventDefault();
  const symbol = PortfolioEngine.normalizeSymbol($("#priceSymbol").value);
  const currency = PortfolioEngine.normalizeCurrency($("#priceCurrency").value);
  const unit = PortfolioEngine.normalizeUnit($("#priceUnit").value);
  const holding = portfolioResult().holdings.find(item => item.symbol === symbol && item.currency === currency && item.unit === unit);
  if (!holding) { $("#priceFormStatus").textContent = t("matchingHoldingMissing"); return; }
  state.portfolio.manualPrices[holding.key] = {price:Number($("#priceValue").value),date:$("#priceDate").value,source:"manual"};
  savePortfolio(); $("#priceFormStatus").textContent = t("priceSaved"); renderPortfolio();
};

$("#exportPortfolio").onclick = exportPortfolio;
$("#importPortfolioBtn").onclick = () => $("#importPortfolioFile").click();
$("#importPortfolioFile").onchange = event => { const file = event.target.files?.[0]; if (file) importPortfolio(file); event.target.value = ""; };

$("#tickerForm").onsubmit = event => {
  event.preventDefault();
  const providerSymbol = $("#ticker").value.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g,"");
  const company = $("#company").value.trim();
  if (!providerSymbol) return;
  const title = `[AI-BULLETIN] ADD ${providerSymbol}`;
  const body = `Provider symbol: ${providerSymbol}\nCompany: ${company || providerSymbol}\n\nPlease add this asset to the central evaluation universe.`;
  window.open(`${REPO_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,"_blank","noopener");
  $("#tickerStatus").textContent = t("requestOpened",{symbol:providerSymbol});
};

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(registration => registration.update()).catch(() => null));

$("#txDate").value = today();
$("#txCurrentPriceDate").value = today();
$("#priceDate").value = today();
applyLanguage();
load();
