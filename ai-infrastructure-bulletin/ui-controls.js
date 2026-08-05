"use strict";

(function installInteractiveControls() {
  const LEVELS = ["beginner", "standard", "advanced", "professional"];
  const LEVEL_COPY = {
    tr: {
      beginner: { title: "Başlangıç görünümü uygulandı", detail: "Sade özet, güncel fiyat ve temel 21 günlük hareket gösterilir. Teknik metrikler ve uzun açıklamalar gizlenir." },
      standard: { title: "Standart görünüm uygulandı", detail: "Özet, araştırma görüşü, risk sınıfı ve 21/252 günlük fiyat bağlamı birlikte gösterilir." },
      advanced: { title: "Gelişmiş görünüm uygulandı", detail: "Standart bilgilere ek olarak fiyat bağlamı, temel sürücüler, ana riskler ve olay ayrıntıları gösterilir." },
      professional: { title: "Profesyonel görünüm uygulandı", detail: "Tüm teknik metrikler, güven seviyesi, olay sayısı, fiyat tarihi, sürücüler, riskler ve kaynak ayrıntıları gösterilir." },
      searchResults: "Hisse arama sonuçları",
      noSearchResults: "Eşleşen hisse bulunamadı",
      searchLoading: "KAP ve Nasdaq hisse kataloğu yükleniyor…",
      showUniverse: "Piyasa ve grafikte göster",
      resultCount: "{count} hisse bulundu",
      searchPlaceholder: "Hisse kodu veya şirket adı ara"
    },
    en: {
      beginner: { title: "Beginner view applied", detail: "Shows a concise summary, current price and core 21-day movement. Technical metrics and long explanations are hidden." },
      standard: { title: "Standard view applied", detail: "Shows the summary, research view, risk class and 21/252-day price context together." },
      advanced: { title: "Advanced view applied", detail: "Adds price context, key drivers, principal risks and event detail to the standard view." },
      professional: { title: "Professional view applied", detail: "Shows all technical metrics, confidence, event count, price date, drivers, risks and source detail." },
      searchResults: "Equity search results",
      noSearchResults: "No matching equity found",
      searchLoading: "Loading the KAP and Nasdaq equity catalogue…",
      showUniverse: "Show in market and chart",
      resultCount: "{count} equities found",
      searchPlaceholder: "Search ticker or company name"
    }
  };

  const copy = () => LEVEL_COPY[state.language] || LEVEL_COPY.tr;
  let searchRetryCount = 0;

  function ensureStyles() {
    if (document.getElementById("interactiveControlsStyles")) return;
    const style = document.createElement("style");
    style.id = "interactiveControlsStyles";
    style.textContent = `
      .global-search{z-index:45}.search-results-panel{position:absolute;top:calc(100% + 8px);left:0;right:0;min-width:min(560px,calc(100vw - 32px));max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:16px 16px 16px 5px;background:rgba(255,253,248,.98);box-shadow:var(--shadow-strong);padding:8px;display:none}.search-results-panel.open{display:block}.search-results-head{display:flex;justify-content:space-between;gap:12px;padding:8px 10px 10px;color:var(--muted);font-size:.72rem}.search-result{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center;border:0;border-top:1px solid var(--line);background:transparent;color:var(--ink);padding:12px 10px;text-align:left}.search-result:first-of-type{border-top:0}.search-result:hover,.search-result:focus-visible{background:var(--paper-soft);outline:none}.search-result-symbol{display:inline-flex;min-width:68px;justify-content:center;padding:6px 8px;border-radius:999px;background:var(--sage-soft);color:var(--pine);font-size:.7rem;font-weight:800}.search-result-copy{min-width:0;display:grid;gap:3px}.search-result-copy strong,.search-result-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search-result-copy span{color:var(--muted);font-size:.72rem}.search-result-price{text-align:right;white-space:nowrap}.search-result-price small{display:block;margin-top:3px}.search-empty{padding:24px 14px;text-align:center;color:var(--muted)}.search-universe-action{width:100%;border:0;border-top:1px solid var(--line);background:transparent;color:var(--pine-2);padding:11px;font-weight:750}.experience-status{margin-top:14px;padding:15px 16px;border-left:3px solid var(--pine-2);border-radius:0 12px 12px 0;background:var(--paper-soft)}.experience-status strong{display:block;margin-bottom:5px;color:var(--ink)}.experience-status>span{color:var(--muted);font-size:.78rem;line-height:1.55}.experience-proof{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.experience-proof span{padding:5px 8px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--pine-2);font-size:.65rem;font-weight:750}.experience-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 15px}.experience-detail{padding:10px;background:var(--paper-soft);border-radius:10px 10px 10px 3px}.experience-detail strong{display:block;margin-bottom:5px;font-size:.67rem;text-transform:uppercase;letter-spacing:.08em}.experience-detail ul{margin:0;padding-left:17px;color:var(--muted);font-size:.72rem;line-height:1.45}.professional-meta{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 13px}html[data-experience="beginner"] .market-table-wrap th:nth-child(6),html[data-experience="beginner"] .market-table-wrap td:nth-child(6),html[data-experience="beginner"] .market-table-wrap th:nth-child(7),html[data-experience="beginner"] .market-table-wrap td:nth-child(7),html[data-experience="beginner"] .market-table-wrap th:nth-child(8),html[data-experience="beginner"] .market-table-wrap td:nth-child(8){display:none}html[data-experience="standard"] .market-table-wrap th:nth-child(7),html[data-experience="standard"] .market-table-wrap td:nth-child(7){display:none}@media(max-width:620px){.search-results-panel{position:fixed;left:12px;right:12px;top:82px;min-width:0;max-height:60vh}.experience-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function normalizeSearch(value) {
    return String(value || "").trim().toLocaleLowerCase(state.language === "tr" ? "tr" : "en");
  }

  function marketAssets() {
    try { return window.PiyasaMarketWorkspace?.getAssets?.() || []; }
    catch (_) { return []; }
  }

  function marketSearchScore(asset, normalized) {
    const symbol = normalizeSearch(asset.symbol);
    const provider = normalizeSearch(asset.providerSymbol);
    const name = normalizeSearch(asset.name);
    if (symbol === normalized || provider === normalized) return 0;
    if (symbol.startsWith(normalized) || provider.startsWith(normalized)) return 1;
    if (name.startsWith(normalized)) return 2;
    return 3;
  }

  function assetSearchResults(query, assets = marketAssets()) {
    if (!query.trim() || !assets.length) return [];
    const normalized = normalizeSearch(query);
    return assets.filter(asset => [
      asset.symbol,
      asset.providerSymbol,
      asset.name,
      asset.market,
      asset.exchange,
      asset.sector,
      asset.industry,
      asset.currency
    ].some(value => normalizeSearch(value).includes(normalized))).sort((a, b) => {
      const score = marketSearchScore(a, normalized) - marketSearchScore(b, normalized);
      if (score) return score;
      const symbolOrder = String(a.symbol).localeCompare(String(b.symbol));
      if (symbolOrder) return symbolOrder;
      return String(a.market).localeCompare(String(b.market));
    }).slice(0, 12);
  }

  function ensureSearchPanel() {
    let panel = document.getElementById("globalSearchResults");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "globalSearchResults";
    panel.className = "search-results-panel";
    panel.setAttribute("role", "listbox");
    document.querySelector(".global-search").appendChild(panel);
    return panel;
  }

  function closeSearchPanel() {
    document.getElementById("globalSearchResults")?.classList.remove("open");
    $("#globalSearch")?.setAttribute("aria-expanded", "false");
  }

  async function openMarketAsset(asset, query) {
    closeSearchPanel();
    navigate("market");
    const marketInput = $("#pmMarketSearch");
    if (marketInput) {
      marketInput.value = query;
      marketInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (asset?.key) await window.PiyasaMarketWorkspace?.select?.(asset.key);
  }

  function renderSearchPanel() {
    const input = $("#globalSearch");
    const panel = ensureSearchPanel();
    const query = input.value.trim();
    if (!query) { panel.innerHTML = ""; searchRetryCount = 0; closeSearchPanel(); return []; }

    const labels = copy();
    const assets = marketAssets();
    if (!assets.length) {
      panel.innerHTML = `<div class="search-results-head"><strong>${esc(labels.searchResults)}</strong><span>—</span></div><div class="search-empty">${esc(labels.searchLoading)}</div>`;
      panel.classList.add("open");
      input.setAttribute("aria-expanded", "true");
      if (searchRetryCount < 20) {
        searchRetryCount += 1;
        setTimeout(() => { if (input.value.trim() === query) renderSearchPanel(); }, 250);
      }
      return [];
    }

    searchRetryCount = 0;
    const results = assetSearchResults(query, assets);
    panel.innerHTML = `<div class="search-results-head"><strong>${esc(labels.searchResults)}</strong><span>${esc(labels.resultCount.replace("{count}", String(results.length)))}</span></div>${results.length ? results.map(asset => `<button class="search-result" type="button" role="option" data-key="${esc(asset.key)}"><span class="search-result-symbol">${esc(asset.symbol)}</span><span class="search-result-copy"><strong>${esc(asset.name)}</strong><span>${esc([asset.exchange || asset.market, asset.sector || asset.industry].filter(Boolean).join(" · "))}</span></span><span class="search-result-price"><strong>${asset.price == null ? "—" : fmtMoney(asset.price, asset.currency)}</strong><small class="${pctClass(asset.change)}">${fmtPct(asset.change)}</small></span></button>`).join("") : `<div class="search-empty">${esc(labels.noSearchResults)}</div>`}<button class="search-universe-action" type="button">${esc(labels.showUniverse)} →</button>`;
    panel.classList.add("open");
    input.setAttribute("aria-expanded", "true");
    panel.querySelectorAll(".search-result").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const asset = results.find(item => item.key === button.dataset.key);
        void openMarketAsset(asset, query);
      };
    });
    panel.querySelector(".search-universe-action").onclick = event => {
      event.preventDefault();
      void openMarketAsset(results[0] || null, query);
    };
    return results;
  }

  function experienceLabels(level) {
    const labels = state.language === "tr" ? { beginner: ["Özet", "Fiyat", "21G"], standard: ["Özet", "Risk", "21G", "252G"], advanced: ["Fiyat bağlamı", "Sürücüler", "Riskler", "Olaylar"], professional: ["Tüm metrikler", "Güven", "Fiyat tarihi", "Kaynaklar"] } : { beginner: ["Summary", "Price", "21D"], standard: ["Summary", "Risk", "21D", "252D"], advanced: ["Price context", "Drivers", "Risks", "Events"], professional: ["All metrics", "Confidence", "Price date", "Sources"] };
    return labels[level] || labels.standard;
  }

  function renderExperienceStatus() {
    const select = $("#experienceLevel");
    if (!select) return;
    let status = document.getElementById("experienceStatus");
    if (!status) { status = document.createElement("div"); status.id = "experienceStatus"; status.className = "experience-status"; status.setAttribute("aria-live", "polite"); select.closest("label").insertAdjacentElement("afterend", status); }
    const text = copy()[state.experience];
    status.innerHTML = `<strong>${esc(text.title)}</strong><span>${esc(text.detail)}</span><div class="experience-proof">${experienceLabels(state.experience).map(label => `<span>${esc(label)}</span>`).join("")}</div>`;
  }

  function advancedPreview(item) {
    const limit = state.experience === "professional" ? 4 : 2;
    const drivers = localizedArray(item, "key_drivers").slice(0, limit);
    const risks = localizedArray(item, "key_risks").slice(0, limit);
    if (!drivers.length && !risks.length) return "";
    return `<div class="experience-detail-grid"><div class="experience-detail"><strong>${esc(t("keyDrivers"))}</strong><ul>${drivers.map(value => `<li>${esc(value)}</li>`).join("") || "<li>—</li>"}</ul></div><div class="experience-detail"><strong>${esc(t("keyRisks"))}</strong><ul>${risks.map(value => `<li>${esc(value)}</li>`).join("") || "<li>—</li>"}</ul></div></div>`;
  }

  renderEvaluations = function renderExperienceAwareEvaluations(evaluations) {
    const list = evaluations.filter(item => evaluationMatchesQuery(item) && filterMatches(item));
    if (!list.length) { $("#evaluations").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><strong>${esc(t("noResearchMatch"))}</strong></div>`; return; }
    $("#evaluations").innerHTML = list.map(item => {
      const price = item.price_context || {};
      const [ratingLabel, ratingClass] = ratingInfo(item.rating);
      const isBeginner = state.experience === "beginner";
      const isAdvanced = ["advanced", "professional"].includes(state.experience);
      const isProfessional = state.experience === "professional";
      const performance = isAdvanced ? `<p class="research-context">${esc(localizedField(item, "performance_context"))}</p>` : "";
      const details = isAdvanced ? advancedPreview(item) : "";
      const professionalMeta = isProfessional ? `<div class="professional-meta">${confidence(item.confidence)}<span class="badge neutral">${esc(t("materialEvents"))}: ${esc(item.material_event_count ?? 0)}</span><span class="badge neutral">${esc(t("priceDate"))}: ${esc(fmtDateOnly(price.price_as_of))}</span></div>` : "";
      const thirdMetric = isBeginner ? "" : `<div><span>252D</span><strong class="${pctClass(price.return_252d_pct)}">${fmtPct(price.return_252d_pct)}</strong></div>`;
      return `<article class="research-card ${cardClass(item.rating)}"><div class="research-card-body"><div class="research-meta"><span class="research-symbol">${esc(item.ticker)}</span><span>${esc(localizedField(item, "sector"))}</span></div><h3>${esc(item.company)}</h3><p class="summary-line">${esc(localizedField(item, "summary"))}</p>${performance}${professionalMeta}<div class="research-price-row" style="grid-template-columns:repeat(${isBeginner ? 2 : 3},1fr)"><div><span>${esc(t("price"))}</span><strong>${price.price == null ? "—" : fmtMoney(price.price, price.currency)}</strong></div><div><span>21D</span><strong class="${pctClass(price.return_21d_pct)}">${fmtPct(price.return_21d_pct)}</strong></div>${thirdMetric}</div>${details}<div class="card-footer"><div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${!isBeginner && item.risk_badge === "SPECULATIVE" ? `<span class="badge warning">${esc(t("speculative"))}</span>` : ""}</div><button class="open-research open-asset" data-ticker="${esc(item.ticker)}" type="button">${esc(t("openResearch"))} →</button></div></div></article>`;
    }).join("");
    bindAssetOpeners();
  };

  openAssetDrawer = function openExperienceAwareDrawer(ticker) {
    const evaluation = (state.report?.company_evaluations || []).find(item => item.ticker === ticker);
    const market = (state.report?.watchlist || []).find(item => item.ticker === ticker);
    if (!evaluation && !market) return;
    const item = evaluation || { ticker, company: market?.company || ticker, price_context: market || {} };
    const price = market || item.price_context || {};
    const events = (state.report?.events || []).filter(event => (event.companies || []).includes(ticker));
    const [ratingLabel, ratingClass] = ratingInfo(item.rating);
    const drivers = localizedArray(item, "key_drivers");
    const risks = localizedArray(item, "key_risks");
    const isBeginner = state.experience === "beginner";
    const isStandard = state.experience === "standard";
    const isAdvanced = ["advanced", "professional"].includes(state.experience);
    const isProfessional = state.experience === "professional";
    const metrics = [`<div><span>${esc(t("price"))}</span><strong>${price.price == null ? "—" : fmtMoney(price.price, price.currency)}</strong></div>`, `<div><span>21D</span><strong class="${pctClass(price.return_21d_pct)}">${fmtPct(price.return_21d_pct)}</strong></div>`, !isBeginner ? `<div><span>252D</span><strong class="${pctClass(price.return_252d_pct)}">${fmtPct(price.return_252d_pct)}</strong></div>` : "", isAdvanced ? `<div><span>${esc(t("fiftyTwoWeekHigh"))}</span><strong class="${pctClass(price.distance_from_52w_high_pct)}">${fmtPct(price.distance_from_52w_high_pct)}</strong></div>` : "", isAdvanced ? `<div><span>${esc(t("materialEvents"))}</span><strong>${item.material_event_count ?? events.length}</strong></div>` : "", isProfessional ? `<div><span>${esc(t("priceDate"))}</span><strong>${esc(fmtDateOnly(price.price_as_of))}</strong></div>` : ""].filter(Boolean).join("");
    const driverLimit = isBeginner ? 0 : isStandard ? 3 : drivers.length;
    const riskLimit = isBeginner ? 2 : risks.length;
    const contextSection = isBeginner ? "" : `<section class="drawer-section"><h3>${esc(t("priceContext"))}</h3><p>${esc(localizedField(item, "performance_context"))}</p></section>`;
    const driverSection = driverLimit ? `<section class="drawer-section"><h3>${esc(t("keyDrivers"))}</h3><ul>${drivers.slice(0, driverLimit).map(value => `<li>${esc(value)}</li>`).join("") || "<li>—</li>"}</ul></section>` : "";
    const riskSection = `<section class="drawer-section"><h3>${esc(t("keyRisks"))}</h3><ul>${risks.slice(0, riskLimit).map(value => `<li>${esc(value)}</li>`).join("") || "<li>—</li>"}</ul></section>`;
    const eventHtml = events.length ? events.map(event => { const source = event.sources?.[0]; return `<div class="drawer-event"><strong>${esc(event.headline)}</strong><span class="meta">${esc(fmtDate(event.published_time))}</span>${isProfessional && source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a>` : ""}</div>`; }).join("") : `<p>${esc(t("noRelatedEvents"))}</p>`;
    const eventsSection = isAdvanced ? `<section class="drawer-section"><h3>${esc(t("relatedEvents"))}</h3>${eventHtml}</section>` : "";
    $("#drawerContent").innerHTML = `<header class="drawer-header"><span class="drawer-symbol">${esc(ticker)}</span><h2 id="drawerTitle">${esc(item.company || ticker)}</h2><p>${esc(localizedField(item, "sector"))}</p><div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${isProfessional ? confidence(item.confidence) : ""}<span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></div></header><div class="drawer-metrics">${metrics}</div><section class="drawer-section"><h3>${esc(t("thesis"))}</h3><p>${esc(localizedField(item, "summary"))}</p></section>${contextSection}${driverSection}${riskSection}${eventsSection}`;
    $("#assetDrawer").classList.add("open"); $("#assetDrawer").setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; $("#closeDrawer").focus();
  };

  function applyExperience(level, announce) {
    state.experience = LEVELS.includes(level) ? level : "standard";
    localStorage.setItem(EXPERIENCE_KEY, state.experience);
    document.documentElement.dataset.experience = state.experience;
    $("#experienceLevel").value = state.experience;
    renderExperienceStatus();
    if (state.report) { renderEvaluations(state.report.company_evaluations || []); renderWatchlist(state.report.watchlist || [], state.report.company_evaluations || []); }
    const openTicker = $("#assetDrawer.open .drawer-symbol")?.textContent?.trim();
    if (openTicker) openAssetDrawer(openTicker);
    if (announce) showToast(copy()[state.experience].title);
  }

  function applySearchCopy() {
    const input = $("#globalSearch");
    if (input) input.placeholder = copy().searchPlaceholder;
    document.getElementById("globalSearchResults")?.setAttribute("aria-label", copy().searchResults);
  }

  function wireSearch() {
    const input = $("#globalSearch");
    if (!input) return;
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-controls", "globalSearchResults"); input.setAttribute("aria-expanded", "false");
    input.oninput = () => renderSearchPanel();
    input.onfocus = () => { if (input.value.trim()) renderSearchPanel(); };
    input.onkeydown = event => {
      if (event.key === "Escape") { closeSearchPanel(); return; }
      if (event.key !== "Enter") return;
      event.preventDefault();
      const query = input.value.trim();
      const results = assetSearchResults(query);
      void openMarketAsset(results[0] || null, query);
    };
    document.addEventListener("pointerdown", event => { if (!event.target.closest(".global-search")) closeSearchPanel(); });
    applySearchCopy();
  }

  function wireExperience() {
    const select = $("#experienceLevel");
    if (!select) return;
    select.onchange = event => applyExperience(event.target.value, true);
    applyExperience(state.experience, false);
  }

  ensureStyles(); ensureSearchPanel(); wireSearch(); wireExperience();
  const originalApplyLanguage = applyLanguage;
  applyLanguage = function applyLanguageWithControls() { originalApplyLanguage(); renderExperienceStatus(); applySearchCopy(); if ($("#globalSearch")?.value.trim()) renderSearchPanel(); };
})();


(function loadBrokerPortfolioImport() {
  if (document.querySelector("script[data-broker-import-core]")) return;
  const core = document.createElement("script");
  core.src = "./broker-import.js?v=2026.07.30.3";
  core.dataset.brokerImportCore = "true";
  core.onload = () => {
    const csv = document.createElement("script");
    csv.src = "./broker-import-csv.js?v=2026.07.30.3";
    csv.dataset.brokerImportCsv = "true";
    csv.onload = () => {
      if (document.querySelector("script[data-broker-import-ui]")) return;
      const ui = document.createElement("script");
      ui.src = "./portfolio-import-ui.js?v=2026.07.30.3";
      ui.dataset.brokerImportUi = "true";
      document.head.appendChild(ui);
    };
    document.head.appendChild(csv);
  };
  document.head.appendChild(core);
})();
