"use strict";

function localizedField(object, key) {
  if (!object) return "";
  if (state.language === "en" && object[`${key}_en`] !== undefined && object[`${key}_en`] !== null) {
    return object[`${key}_en`];
  }
  return object[key];
}

render = function renderLocalizedApplication() {
  const data = state.report;
  const report = data.report;
  const summary = data.executive_summary;
  const events = data.events || [];
  const evaluations = data.company_evaluations || [];
  $("#generatedAt").textContent = fmtDate(report.generated_at);
  $("#companyCount").textContent = String(report.company_count ?? evaluations.length ?? data.watchlist?.length ?? 0);
  $("#eventCount").textContent = String(report.material_event_count ?? events.length);
  $("#dominantTheme").textContent = summary.dominant_theme || "—";
  $("#mainRiskValue").textContent = localizedField(summary, "main_risk") || "—";
  $("#summaryTitle").textContent = localizedField(summary, "headline") || t("generalAssessment");
  $("#summaryText").textContent = localizedField(summary, "summary") || t("noMaterialEvent");
  $("#marketAsOf").textContent = report.market_data_as_of
    ? t("marketClose", {date: fmtDateOnly(report.market_data_as_of)})
    : t("marketUnavailable");
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
};

renderEvaluations = function renderLocalizedEvaluations(evaluations) {
  const list = state.ticker === "all" ? evaluations : evaluations.filter(item => item.ticker === state.ticker);
  $("#evaluations").innerHTML = list.map(item => {
    const [label, badgeClass] = ratingInfo(item.rating);
    const driverValues = state.language === "en" ? (item.key_drivers_en || item.key_drivers || []) : (item.key_drivers || []);
    const riskValues = state.language === "en" ? (item.key_risks_en || item.key_risks || []) : (item.key_risks || []);
    const drivers = driverValues.map(value => `<li>${esc(value)}</li>`).join("");
    const risks = riskValues.map(value => `<li>${esc(value)}</li>`).join("");
    const price = item.price_context || {};
    const sector = localizedField(item, "sector") || "";
    const performance = localizedField(item, "performance_context") || localizedField(item, "summary") || "";
    const summary = localizedField(item, "summary") || "";
    return `<article class="card ${cardClass(item.rating)}">
      <div class="meta"><span>${esc(item.ticker)}</span><span>•</span><span>${esc(item.company)}</span><span>•</span><span>${esc(sector)}</span></div>
      <h3>${esc(item.company)}</h3>
      <div class="badges"><span class="badge ${badgeClass}">${esc(label)}</span>${confidence(item.confidence)}<span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></div>
      <div class="section"><strong>${esc(t("priceContext"))}</strong><p>${esc(performance)}</p><p class="meta">${esc(price.currency || "")} ${price.price == null ? "—" : fmtNumber(price.price, 2)} · 21D ${fmtPct(price.return_21d_pct)} · 252D ${fmtPct(price.return_252d_pct)} · ${esc(t("materialEvents"))} ${esc(item.material_event_count ?? 0)}</p></div>
      <div class="section"><strong>${esc(t("keyDrivers"))}</strong><ul>${drivers}</ul></div>
      <div class="section"><strong>${esc(t("keyRisks"))}</strong><ul>${risks}</ul></div>
      <div class="section"><strong>${esc(t("evaluation"))}</strong><p>${esc(summary)}</p></div>
    </article>`;
  }).join("");
};

renderEvents = function renderLocalizedEvents(events) {
  const list = state.ticker === "all" ? events : events.filter(event => (event.companies || []).includes(state.ticker));
  $("#empty").classList.toggle("hidden", list.length > 0);
  $("#events").innerHTML = list.map(event => {
    const [ratingLabel, ratingClass] = ratingInfo(event.research_view?.rating);
    const facts = (event.facts || []).map(value => `<li>${esc(value)}</li>`).join("");
    const localizedRisks = state.language === "en"
      ? (event.research_view?.risks_en || event.research_view?.risks || [])
      : (event.research_view?.risks || []);
    const risks = localizedRisks.map(value => `<li>${esc(value)}</li>`).join("");
    const source = event.sources?.[0];
    const why = localizedField(event, "why_it_matters") || "";
    const meaning = localizedField(event, "investment_meaning") || localizedField(event.research_view, "summary") || "";
    return `<article class="card ${cardClass(event.research_view?.rating)}">
      <div class="meta"><span>${esc((event.companies || []).join(", ") || event.primary_theme)}</span><span>•</span><span>${esc(fmtDate(event.published_time))}</span></div>
      <h3>${esc(event.headline)}</h3>
      <div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${confidence(event.confidence)}<span class="badge neutral">${esc(event.risk_badge || "STANDARD")}</span></div>
      <div class="section"><strong>${esc(t("whatHappened"))}</strong><ul>${facts}</ul></div>
      <div class="section"><strong>${esc(t("whyImportant"))}</strong><p>${esc(why)}</p></div>
      <div class="section"><strong>${esc(t("investmentMeaning"))}</strong><p>${esc(meaning)}</p>${risks ? `<ul>${risks}</ul>` : ""}</div>
      ${source ? `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("openSource"))}</a>` : ""}
    </article>`;
  }).join("");
};

reportMarketPrices = function reportCurrencySafeMarketPrices() {
  const prices = {};
  const rows = state.report?.watchlist || [];
  for (const transaction of state.portfolio.transactions) {
    const symbol = PortfolioEngine.normalizeSymbol(transaction.symbol);
    const row = rows.find(candidate => [candidate.ticker, candidate.provider_symbol]
      .map(value => String(value || "").toUpperCase())
      .includes(symbol));
    if (!row || row.price == null) continue;
    if (PortfolioEngine.normalizeCurrency(row.currency) !== PortfolioEngine.normalizeCurrency(transaction.currency)) continue;
    prices[PortfolioEngine.assetKey(transaction)] = {
      price: Number(row.price),
      date: row.price_as_of || null,
      source: "automatic",
    };
  }
  return prices;
};

aggregateClass = function aggregateWithoutMixingCurrencies(totalsByCurrency, field) {
  const values = Object.values(totalsByCurrency).map(item => item[field]).filter(Number.isFinite);
  if (!values.length) return "";
  if (values.every(value => value > 0)) return "up";
  if (values.every(value => value < 0)) return "down";
  return "";
};
