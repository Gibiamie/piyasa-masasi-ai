const DATA_URL = "./data/report.json";
const APP_VERSION = "2026.07.29.5";
const REPO_ISSUES_URL = "https://github.com/Gibiamie/piyasa-masasi-ai/issues/new";
const state = { report: null, ticker: "Tümü" };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat"
  }).format(date);
}

function fmtDateOnly(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium", timeZone: "UTC"
  }).format(date);
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
  return ({
    STRONG_POSITIVE: ["Güçlü Pozitif", "positive"],
    POSITIVE: ["Pozitif", "positive"],
    NEUTRAL: ["Nötr", "neutral"],
    NEGATIVE: ["Negatif", "negative"],
    HIGH_UNCERTAINTY: ["Yüksek Belirsizlik", "warning"]
  })[rating] || [rating || "Nötr", "neutral"];
}

function cardClass(rating) {
  if (["STRONG_POSITIVE", "POSITIVE"].includes(rating)) return "positive";
  if (rating === "NEGATIVE") return "negative";
  if (rating === "HIGH_UNCERTAINTY") return "uncertain";
  return "";
}

function confidence(value) {
  const label = {
    HIGH: "Yüksek Güven", MEDIUM: "Orta Güven", LOW: "Düşük Güven", UNVERIFIED: "Doğrulanmadı"
  }[value] || value;
  const className = value === "HIGH" ? "blue" : value === "LOW" || value === "UNVERIFIED" ? "warning" : "neutral";
  return `<span class="badge ${className}">${esc(label)}</span>`;
}

async function load() {
  $("#freshness").textContent = "Yükleniyor";
  $("#freshness").className = "badge neutral";
  try {
    const response = await fetch(`${DATA_URL}?app=${APP_VERSION}&v=${Date.now()}`, {
      cache: "no-store", headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.report = await response.json();
    render();
  } catch (error) {
    $("#freshness").textContent = "Veri hatası";
    $("#freshness").className = "badge negative";
    $("#evaluations").innerHTML = `<article class="card negative"><h3>Değerlendirme verisi açılamadı</h3><p>${esc(error.message)}</p></article>`;
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
  $("#mainRisk").textContent = summary.main_risk || "—";
  $("#summaryTitle").textContent = summary.headline || "Günlük görünüm";
  $("#summaryText").textContent = summary.summary || "Önemli gelişme bulunmadı.";
  $("#marketAsOf").textContent = report.market_data_as_of
    ? `Piyasa kapanış verisi: ${fmtDateOnly(report.market_data_as_of)}`
    : "Piyasa verisi mevcut değil.";
  const generatedAt = new Date(report.generated_at).getTime();
  const ageHours = Number.isFinite(generatedAt) ? Math.max(0, (Date.now() - generatedAt) / 36e5) : Infinity;
  $("#freshness").textContent = ageHours <= 30 ? "Güncel veri" : "Veri eski olabilir";
  $("#freshness").className = `badge ${ageHours <= 30 ? "positive" : "warning"}`;
  renderTickerFilters(evaluations);
  renderEvaluations(evaluations);
  renderEvents(events);
  renderWatchlist(data.watchlist || []);
  renderSources(events);
  renderUniverse(data.watchlist || []);
}

function renderTickerFilters(evaluations) {
  const tickers = ["Tümü", ...evaluations.map(item => item.ticker)];
  $("#filters").innerHTML = tickers.map(ticker =>
    `<button class="filter ${state.ticker === ticker ? "active" : ""}" data-ticker="${esc(ticker)}">${esc(ticker)}</button>`
  ).join("");
  $$("#filters .filter").forEach(button => {
    button.onclick = () => {
      state.ticker = button.dataset.ticker;
      renderTickerFilters(evaluations);
      renderEvaluations(evaluations);
      renderEvents(state.report?.events || []);
    };
  });
}

function renderEvaluations(evaluations) {
  const list = state.ticker === "Tümü" ? evaluations : evaluations.filter(item => item.ticker === state.ticker);
  $("#evaluations").innerHTML = list.map(item => {
    const [label, badgeClass] = ratingInfo(item.rating);
    const drivers = (item.key_drivers || []).map(value => `<li>${esc(value)}</li>`).join("");
    const risks = (item.key_risks || []).map(value => `<li>${esc(value)}</li>`).join("");
    const price = item.price_context || {};
    return `<article class="card ${cardClass(item.rating)}">
      <div class="meta"><span>${esc(item.ticker)}</span><span>•</span><span>${esc(item.company)}</span><span>•</span><span>${esc(item.sector || "")}</span></div>
      <h3>${esc(item.company)} — Günlük araştırma görüşü</h3>
      <div class="badges"><span class="badge ${badgeClass}">${esc(label)}</span>${confidence(item.confidence)}<span class="badge ${item.risk_badge === "SPECULATIVE" ? "warning" : "neutral"}">${esc(item.risk_badge || "STANDARD")}</span></div>
      <div class="section"><strong>FİYAT BAĞLAMI</strong><p>${esc(item.performance_context || item.summary || "")}</p><p class="meta">${esc(price.currency || "")} ${price.price == null ? "—" : Number(price.price).toFixed(2)} · 21G ${fmtPct(price.return_21d_pct)} · 252G ${fmtPct(price.return_252d_pct)} · Haber ${esc(item.material_event_count ?? 0)}</p></div>
      <div class="section"><strong>ANA SÜRÜCÜLER</strong><ul>${drivers}</ul></div>
      <div class="section"><strong>ANA RİSKLER</strong><ul>${risks}</ul></div>
      <div class="section"><strong>DEĞERLENDİRME</strong><p>${esc(item.summary || "")}</p></div>
    </article>`;
  }).join("");
}

function renderEvents(events) {
  const list = state.ticker === "Tümü" ? events : events.filter(event => (event.companies || []).includes(state.ticker));
  $("#empty").classList.toggle("hidden", list.length > 0);
  $("#events").innerHTML = list.map(event => {
    const [ratingLabel, ratingClass] = ratingInfo(event.research_view?.rating);
    const facts = (event.facts || []).map(value => `<li>${esc(value)}</li>`).join("");
    const risks = (event.research_view?.risks || []).map(value => `<li>${esc(value)}</li>`).join("");
    const source = event.sources?.[0];
    return `<article class="card ${cardClass(event.research_view?.rating)}">
      <div class="meta"><span>${esc((event.companies || []).join(", ") || event.primary_theme)}</span><span>•</span><span>${esc(fmtDate(event.published_time))}</span></div>
      <h3>${esc(event.headline)}</h3>
      <div class="badges"><span class="badge ${ratingClass}">${esc(ratingLabel)}</span>${confidence(event.confidence)}<span class="badge neutral">${esc(event.risk_badge || "STANDARD")}</span></div>
      <div class="section"><strong>NE OLDU?</strong><ul>${facts}</ul></div>
      <div class="section"><strong>NEDEN ÖNEMLİ?</strong><p>${esc(event.why_it_matters)}</p></div>
      <div class="section"><strong>YATIRIM AÇISINDAN ANLAMI</strong><p>${esc(event.investment_meaning || event.research_view?.summary || "")}</p>${risks ? `<ul>${risks}</ul>` : ""}</div>
      ${source ? `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>` : ""}
    </article>`;
  }).join("");
}

function renderWatchlist(items) {
  $("#watchlistBody").innerHTML = items.map(value => {
    const badgeClass = value.risk_badge === "SPECULATIVE" ? "warning" : "neutral";
    const detail = value.price_as_of ? `${value.company || ""} • ${fmtDateOnly(value.price_as_of)}` : value.company || "Veri bulunamadı";
    return `<tr>
      <td><div class="ticker-name"><strong>${esc(value.ticker)}</strong><span>${esc(detail)}</span></div></td>
      <td>${value.price == null ? "—" : `${esc(value.currency || "USD")} ${Number(value.price).toFixed(2)}`}</td>
      <td class="${pctClass(value.return_1d_pct)}">${fmtPct(value.return_1d_pct)}</td>
      <td class="${pctClass(value.return_21d_pct)}">${fmtPct(value.return_21d_pct)}</td>
      <td class="${pctClass(value.return_252d_pct)}">${fmtPct(value.return_252d_pct)}</td>
      <td class="${pctClass(value.distance_from_52w_high_pct)}">${fmtPct(value.distance_from_52w_high_pct)}</td>
      <td><span class="badge ${badgeClass}">${esc(value.risk_badge || "STANDARD")}</span></td>
    </tr>`;
  }).join("");
}

function renderSources(events) {
  const sources = [];
  events.forEach(event => (event.sources || []).forEach(source => sources.push({ ...source, event: event.headline, tickers: event.companies || [] })));
  $("#sourcesList").innerHTML = sources.length ? sources.map(source => `<article class="source">
    <div class="meta"><span>${esc(source.tickers.join(", "))}</span><span>•</span><span>${esc(source.source_type || "SECONDARY")}</span><span>•</span><span>${esc(source.publisher || "")}</span><span>•</span><span>${esc(fmtDate(source.published_at))}</span></div>
    <h3>${esc(source.title)}</h3><p>${esc(source.event)}</p>
    <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>
  </article>`).join("") : `<div class="empty"><h3>Kaynak bulunamadı</h3></div>`;
}

function renderUniverse(items) {
  $("#tickerChips").innerHTML = items.map(item => `<span class="chip">${esc(item.ticker)}</span>`).join("");
  $("#tickerStatus").textContent = `${items.length} hisse merkezî değerlendirme evreninde. Yeni eklenen her hisse sonraki otomatik çalışmada aynı değerlendirmeden geçer.`;
}

$$('.tab').forEach(tab => {
  tab.onclick = () => {
    $$('.tab').forEach(item => item.classList.toggle('active', item === tab));
    $$('.view').forEach(view => view.classList.remove('active'));
    $(`#${tab.dataset.view}View`).classList.add('active');
  };
});

$("#refresh").onclick = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.update().catch(() => null)));
  }
  await load();
};

$("#tickerForm").onsubmit = event => {
  event.preventDefault();
  const providerSymbol = $("#ticker").value.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
  const company = $("#company").value.trim();
  if (!providerSymbol) return;
  const title = `[AI-BULLETIN] ADD ${providerSymbol}`;
  const body = `Provider symbol: ${providerSymbol}\nCompany: ${company || providerSymbol}\n\nPlease add this stock to the central evaluation universe.`;
  window.open(`${REPO_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, "_blank", "noopener");
  $("#tickerStatus").textContent = `${providerSymbol} için GitHub ekleme talebi açıldı. Talep gönderildiğinde otomasyon hisseyi kalıcı evrene ekler ve değerlendirmeyi üretir.`;
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js")
    .then(registration => registration.update())
    .catch(() => null));
}

load();
