(() => {
  "use strict";

  if (window.__PM_RESEARCH_INTELLIGENCE_CORE__) return;
  window.__PM_RESEARCH_INTELLIGENCE_CORE__ = true;

  const PERSONAL_KEY = "piyasa-masasi-ai.personal-list.v2";
  const LEGACY_PERSONAL_KEY = "piyasa-masasi-ai.personal-list.v1";
  const RESEARCH_SCOPE_KEY = "piyasa-masasi-ai.research-scope.v2";
  const SOURCE_SCOPE_KEY = "piyasa-masasi-ai.source-scope.v2";
  const OVERVIEW_SCOPE_KEY = "piyasa-masasi-ai.overview-scope.v2";
  const NEWS_CACHE_KEY = "piyasa-masasi-ai.personal-news.v1";
  const MAX_RESEARCH_ROWS = 500;
  const NEWS_MAX_SYMBOLS = 20;
  const NEWS_PER_SYMBOL = 4;

  const runtime = {
    personalKeys: new Set(),
    researchScope: localStorage.getItem(RESEARCH_SCOPE_KEY) || "ALL",
    sourceScope: localStorage.getItem(SOURCE_SCOPE_KEY) || "MINE",
    overviewScope: localStorage.getItem(OVERVIEW_SCOPE_KEY) || "RESEARCH",
    lastReportRef: null,
    news: loadNewsCache(),
    newsLoading: false,
    started: false
  };

  const byId = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === "en" ? "en" : "tr";
  const L = (tr, en) => lang() === "en" ? en : tr;
  const locale = () => lang() === "en" ? "en-GB" : "tr-TR";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const symbolOf = value => String(value || "").trim().toUpperCase().replace(/\.IS$/i, "");
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const keyOf = asset => asset?.key || `${asset?.market === "BIST" ? "BIST" : "US"}:${symbolOf(asset?.symbol)}`;
  const pctClass = value => finite(value) === null || finite(value) === 0 ? "" : finite(value) > 0 ? "up" : "down";
  const pct = value => {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  };
  const money = (value, currency = "TRY") => {
    const number = finite(value);
    if (number === null) return "—";
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number); }
    catch (_) { return `${number.toLocaleString(locale())} ${currency}`; }
  };
  const dateTime = value => {
    if (!value) return "—";
    const timestamp = typeof value === "number" && value < 1e12 ? value * 1000 : value;
    try { return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)); }
    catch (_) { return String(value); }
  };

  function assets() { return window.PiyasaMarketWorkspace?.getAssets?.() || []; }
  function report() { try { return typeof state !== "undefined" ? state.report || null : null; } catch (_) { return null; } }
  function evaluations() { return Array.isArray(report()?.company_evaluations) ? report().company_evaluations : []; }
  function reportWatchlist() { return Array.isArray(report()?.watchlist) ? report().watchlist : []; }
  function events() { return Array.isArray(report()?.events) ? report().events : []; }

  function loadNewsCache() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(NEWS_CACHE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function saveNewsCache() {
    sessionStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(runtime.news.slice(0, 200)));
  }

  function loadPersonalList() {
    const valid = new Set(assets().map(asset => keyOf(asset)));
    try {
      const parsed = JSON.parse(localStorage.getItem(PERSONAL_KEY) || "[]");
      if (Array.isArray(parsed)) runtime.personalKeys = new Set(parsed.filter(key => valid.has(key)));
    } catch (_) {}

    if (!runtime.personalKeys.size) {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_PERSONAL_KEY) || "[]");
        if (Array.isArray(legacy)) {
          for (const raw of legacy) {
            const symbol = symbolOf(raw);
            const matches = assets().filter(asset => asset.symbol === symbol);
            const preferred = matches.find(asset => String(raw).toUpperCase().endsWith(".IS") ? asset.market === "BIST" : asset.market === "US") || matches[0];
            if (preferred) runtime.personalKeys.add(keyOf(preferred));
          }
        }
      } catch (_) {}
    }
    savePersonalList();
  }

  function savePersonalList() {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify([...runtime.personalKeys].sort()));
    const legacySymbols = [...runtime.personalKeys].map(key => key.split(":").slice(1).join(":"));
    localStorage.setItem(LEGACY_PERSONAL_KEY, JSON.stringify([...new Set(legacySymbols)].sort()));
    window.dispatchEvent(new CustomEvent("piyasa-personal-list-change", { detail: { keys: [...runtime.personalKeys] } }));
  }

  function personalAssets() {
    const keys = runtime.personalKeys;
    return assets().filter(asset => keys.has(keyOf(asset)));
  }

  function assetForTicker(ticker, provider = "") {
    const symbol = symbolOf(ticker || provider);
    const universe = assets();
    if (String(provider).toUpperCase().endsWith(".IS")) return universe.find(asset => asset.market === "BIST" && asset.symbol === symbol) || null;
    const reportRow = reportWatchlist().find(row => symbolOf(row.ticker || row.provider_symbol) === symbol);
    if (String(reportRow?.provider_symbol || "").toUpperCase().endsWith(".IS")) return universe.find(asset => asset.market === "BIST" && asset.symbol === symbol) || null;
    return universe.find(asset => asset.market === "US" && asset.symbol === symbol) || universe.find(asset => asset.symbol === symbol) || null;
  }

  function evaluationMaps() {
    const byKey = new Map();
    const bySymbol = new Map();
    for (const evaluation of evaluations()) {
      const asset = assetForTicker(evaluation.ticker);
      if (asset) byKey.set(keyOf(asset), evaluation);
      if (!bySymbol.has(symbolOf(evaluation.ticker))) bySymbol.set(symbolOf(evaluation.ticker), evaluation);
    }
    return { byKey, bySymbol };
  }

  function watchMaps() {
    const byKey = new Map();
    const bySymbol = new Map();
    for (const row of reportWatchlist()) {
      const asset = assetForTicker(row.ticker, row.provider_symbol);
      if (asset) byKey.set(keyOf(asset), row);
      if (!bySymbol.has(symbolOf(row.ticker || row.provider_symbol))) bySymbol.set(symbolOf(row.ticker || row.provider_symbol), row);
    }
    return { byKey, bySymbol };
  }

  function ratingMeta(value) {
    const labels = {
      STRONG_POSITIVE: [L("Güçlü Pozitif", "Strong Positive"), "positive", 35],
      POSITIVE: [L("Pozitif", "Positive"), "positive", 25],
      NEUTRAL: [L("Nötr", "Neutral"), "neutral", 8],
      NEGATIVE: [L("Negatif", "Negative"), "negative", 20],
      HIGH_UNCERTAINTY: [L("Yüksek Belirsizlik", "High Uncertainty"), "warning", 22]
    };
    return labels[value] || [L("Araştırma bekliyor", "Research pending"), "neutral", 0];
  }

  function injectStyles() {
    if (byId("pm-research-intelligence-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-research-intelligence-styles";
    style.textContent = `
      .ri-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:rgba(255,253,248,.78);flex-wrap:wrap}.ri-tabs{display:flex;gap:5px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.ri-tabs button{border:0;border-radius:8px;padding:8px 11px;background:transparent;color:var(--muted);font-size:.73rem;font-weight:750}.ri-tabs button.active{background:var(--pine);color:#fff}.ri-add{position:relative;display:flex;align-items:flex-end;gap:7px;min-width:min(430px,100%)}.ri-add label{display:grid;gap:5px;flex:1;color:var(--muted);font-size:.65rem;font-weight:700}.ri-add input{width:100%;min-height:38px}.ri-suggestions{position:absolute;z-index:40;top:100%;left:0;right:74px;margin-top:4px;max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:11px;background:var(--paper);box-shadow:var(--shadow)}.ri-suggestions.hidden{display:none}.ri-suggestion{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px 11px;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink)}.ri-suggestion:hover{background:var(--sage-soft)}.ri-suggestion strong,.ri-suggestion span,.ri-suggestion small{display:block}.ri-suggestion small{color:var(--muted)}.ri-star{width:31px;height:31px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:transparent;color:#9aa79f;font-size:1rem}.ri-star.active{border-color:#d1af65;color:#a67125;background:#fff2cf}.ri-pending{color:var(--muted);font-size:.7rem}.ri-explain{margin:0 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--sage-soft);font-size:.74rem;line-height:1.55;color:var(--muted)}.ri-explain strong{color:var(--ink)}.ri-source-toolbar,.ri-overview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px}.ri-source-reason{margin-top:9px;padding-top:8px;border-top:1px solid var(--line);font-size:.68rem;color:var(--muted)}.ri-source-reason strong{color:var(--ink)}.ri-radar{margin:22px 0}.ri-radar-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ri-radar-panel{border:1px solid var(--line);border-radius:16px 6px 16px 6px;background:var(--paper);padding:15px;box-shadow:var(--shadow)}.ri-radar-list{display:grid;gap:8px;margin-top:12px}.ri-radar-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink)}.ri-radar-item:last-child{border-bottom:0}.ri-radar-score{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--sage-soft);font-size:.68rem;font-weight:800}.ri-radar-item small{display:block;color:var(--muted);margin-top:3px}.ri-focus-note{margin:-5px 0 12px;color:var(--muted);font-size:.7rem}.ri-settings-list{grid-column:1/-1}.ri-list-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ri-list-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 8px 7px 11px;border:1px solid var(--line);border-radius:999px;background:var(--paper-soft);font-size:.72rem;font-weight:750}.ri-list-chip button{width:22px;height:22px;border:0;border-radius:50%;background:rgba(23,58,51,.08);color:var(--pine)}.ri-source-empty{padding:28px;text-align:center;color:var(--muted)}
      @media(max-width:900px){.ri-radar-grid{grid-template-columns:1fr}.ri-add{min-width:100%}.ri-toolbar{align-items:stretch;flex-direction:column}.ri-source-toolbar,.ri-overview-toolbar{align-items:stretch;flex-direction:column}.ri-tabs{width:100%}.ri-tabs button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function updateBrand() {
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.innerHTML = `<svg viewBox="0 0 48 48" role="img" aria-label="Piyasa Masası AI"><path d="M9 37.5h30"/><path d="M13 33V24m8 9V18m8 15V22m8 11V13"/><path d="M11.5 29.5 20 23l8 3 9-10"/><circle cx="37" cy="16" r="3"/><path d="M10 39h28v2H10z"/></svg>`;
    const brandText = document.querySelector(".brand-text");
    if (brandText) brandText.innerHTML = `<strong>Piyasa Masası AI</strong><small>${L("PİYASA ZEKÂSI", "MARKET INTELLIGENCE")}</small>`;
  }

  function ensureResearchToolbar() {
    const table = document.querySelector("#watchlistView .market-table-wrap");
    if (!table) return null;
    let toolbar = byId("riResearchToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "riResearchToolbar";
      toolbar.className = "ri-toolbar";
      table.before(toolbar);
    }
    return toolbar;
  }

  function searchAssets(query, limit = 12) {
    const q = String(query || "").trim().toLocaleUpperCase(locale());
    if (!q) return [];
    const score = asset => {
      const symbol = asset.symbol.toUpperCase();
      const name = String(asset.name || "").toLocaleUpperCase(locale());
      if (symbol === q) return 0;
      if (symbol.startsWith(q)) return 1;
      if (symbol.includes(q)) return 2;
      if (name.startsWith(q)) return 3;
      if (name.includes(q)) return 4;
      return 99;
    };
    return assets().filter(asset => score(asset) < 99).sort((a, b) => score(a) - score(b) || a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol)).slice(0, limit);
  }

  function renderResearchToolbar() {
    const toolbar = ensureResearchToolbar();
    if (!toolbar) return;
    toolbar.innerHTML = `
      <div class="ri-tabs" role="group" aria-label="${L("Araştırma kapsamı", "Research scope")}">
        <button type="button" data-ri-scope="ALL" class="${runtime.researchScope === "ALL" ? "active" : ""}">${L("Tüm hisseler", "All equities")}</button>
        <button type="button" data-ri-scope="MINE" class="${runtime.researchScope === "MINE" ? "active" : ""}">${L("Listem", "My list")} (${runtime.personalKeys.size})</button>
        <button type="button" data-ri-scope="RESEARCH" class="${runtime.researchScope === "RESEARCH" ? "active" : ""}">${L("Araştırması hazır", "Research available")}</button>
      </div>
      <div class="ri-add">
        <label>${L("Listeme herhangi bir hisse ekle", "Add any equity to my list")}
          <input id="riAddSymbol" autocomplete="off" placeholder="LMKDC / RDW / şirket adı">
        </label>
        <button id="riAddButton" class="button" type="button">${L("Ekle", "Add")}</button>
        <div id="riAddSuggestions" class="ri-suggestions hidden"></div>
      </div>`;
    toolbar.querySelectorAll("[data-ri-scope]").forEach(button => button.onclick = () => {
      runtime.researchScope = button.dataset.riScope;
      localStorage.setItem(RESEARCH_SCOPE_KEY, runtime.researchScope);
      renderResearchUniverse();
    });
    const input = byId("riAddSymbol");
    const suggestions = byId("riAddSuggestions");
    const renderSuggestions = () => {
      const matches = searchAssets(input.value);
      suggestions.innerHTML = matches.map(asset => `<button class="ri-suggestion" type="button" data-add-key="${esc(keyOf(asset))}"><strong>${esc(asset.symbol)}</strong><span>${esc(asset.name)}<small>${esc(asset.exchange)} · ${esc(asset.currency)}</small></span><small>${runtime.personalKeys.has(keyOf(asset)) ? L("Listede", "Listed") : L("Ekle", "Add")}</small></button>`).join("");
      suggestions.classList.toggle("hidden", !matches.length);
      suggestions.querySelectorAll("[data-add-key]").forEach(button => button.onclick = () => { togglePersonal(button.dataset.addKey, true); input.value = ""; suggestions.classList.add("hidden"); });
    };
    input.oninput = renderSuggestions;
    input.onfocus = renderSuggestions;
    input.onkeydown = event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const match = searchAssets(input.value, 1)[0];
      if (match) { togglePersonal(keyOf(match), true); input.value = ""; suggestions.classList.add("hidden"); }
    };
    byId("riAddButton").onclick = () => {
      const match = searchAssets(input.value, 1)[0];
      if (match) { togglePersonal(keyOf(match), true); input.value = ""; suggestions.classList.add("hidden"); }
      else if (typeof showToast === "function") showToast(L("Hisse bulunamadı.", "Equity not found."));
    };
  }

  function togglePersonal(key, forceAdd = false) {
    if (!key) return;
    if (forceAdd) runtime.personalKeys.add(key);
    else if (runtime.personalKeys.has(key)) runtime.personalKeys.delete(key);
    else runtime.personalKeys.add(key);
    savePersonalList();
    renderResearchUniverse();
    renderSettingsList();
    renderSourcesView();
    renderOverviewIntelligence();
  }

  function researchRows() {
    const evaluation = evaluationMaps();
    const watch = watchMaps();
    const search = `${typeof state !== "undefined" ? state.marketSearch || "" : ""} ${typeof state !== "undefined" ? state.query || "" : ""}`.trim().toLocaleUpperCase(locale());
    let rows = assets().map(asset => ({ asset, evaluation: evaluation.byKey.get(keyOf(asset)) || evaluation.bySymbol.get(asset.symbol) || null, watch: watch.byKey.get(keyOf(asset)) || watch.bySymbol.get(asset.symbol) || null }));
    if (runtime.researchScope === "MINE") rows = rows.filter(row => runtime.personalKeys.has(keyOf(row.asset)));
    if (runtime.researchScope === "RESEARCH") rows = rows.filter(row => row.evaluation || row.watch);
    if (search) rows = rows.filter(row => `${row.asset.symbol} ${row.asset.name} ${row.asset.exchange} ${row.asset.sector}`.toLocaleUpperCase(locale()).includes(search));
    const sort = typeof state !== "undefined" ? state.marketSort || "ticker" : "ticker";
    rows.sort((a, b) => {
      if (sort === "return21") return (finite(b.watch?.return_21d_pct ?? b.asset.performance?.["1A"]) ?? -Infinity) - (finite(a.watch?.return_21d_pct ?? a.asset.performance?.["1A"]) ?? -Infinity);
      if (sort === "rating") return ratingMeta(b.evaluation?.rating)[2] - ratingMeta(a.evaluation?.rating)[2];
      if (sort === "risk") return String(b.watch?.risk_badge || b.evaluation?.risk_badge || "").localeCompare(String(a.watch?.risk_badge || a.evaluation?.risk_badge || ""));
      return a.asset.symbol.localeCompare(b.asset.symbol) || a.asset.market.localeCompare(b.asset.market);
    });
    return rows;
  }

  function openRow(row) {
    if (row.evaluation || row.watch) {
      try { if (typeof openAssetDrawer === "function") { openAssetDrawer(row.asset.symbol); return; } } catch (_) {}
    }
    if (typeof navigate === "function") navigate("market");
    setTimeout(() => window.PiyasaMarketWorkspace?.select?.(row.asset.key), 60);
  }

  function renderResearchUniverse() {
    if (!byId("watchlistBody") || !assets().length) return;
    renderResearchToolbar();
    const rows = researchRows();
    const shown = rows.slice(0, MAX_RESEARCH_ROWS);
    const body = byId("watchlistBody");
    const header = document.querySelector("#watchlistView table thead tr");
    if (header && !header.querySelector(".ri-fav-header")) {
      const th = document.createElement("th"); th.className = "ri-fav-header"; th.textContent = "★"; header.prepend(th);
    }
    body.innerHTML = shown.length ? shown.map((row, index) => {
      const asset = row.asset;
      const evaluation = row.evaluation;
      const watch = row.watch;
      const [ratingLabel, ratingClass] = ratingMeta(evaluation?.rating);
      const oneDay = finite(watch?.return_1d_pct ?? asset.change);
      const month = finite(watch?.return_21d_pct ?? asset.performance?.["1A"]);
      const year = finite(watch?.return_252d_pct ?? asset.performance?.["1Y"]);
      const price = finite(watch?.price ?? asset.price);
      const risk = watch?.risk_badge || evaluation?.risk_badge || L("Katalog", "Catalogue");
      return `<tr data-ri-index="${index}"><td><button class="ri-star ${runtime.personalKeys.has(keyOf(asset)) ? "active" : ""}" type="button" data-ri-star="${esc(keyOf(asset))}" aria-label="${L("Listeme ekle/çıkar", "Add/remove from my list")}">★</button></td><td><div class="ticker-name"><strong>${esc(asset.symbol)} <small>${esc(asset.exchange)}</small></strong><span>${esc(asset.name)} · ${asset.quoteAt ? esc(dateTime(asset.quoteAt)) : L("Fiyat bekleniyor", "Price pending")}</span></div></td><td><span class="table-rating ${ratingClass}">${esc(ratingLabel)}</span>${!evaluation ? `<span class="ri-pending">${L("Fiyat ve grafik kullanılabilir", "Price and chart available")}</span>` : ""}</td><td>${money(price, asset.currency)}</td><td class="${pctClass(oneDay)}">${pct(oneDay)}</td><td class="${pctClass(month)}">${pct(month)}</td><td class="${pctClass(year)}">${pct(year)}</td><td class="${pctClass(watch?.distance_from_52w_high_pct)}">${pct(watch?.distance_from_52w_high_pct)}</td><td><span class="badge ${String(risk).includes("SPEC") ? "warning" : "neutral"}">${esc(risk)}</span></td></tr>`;
    }).join("") : `<tr><td colspan="9" class="table-empty">${L("Eşleşen hisse bulunamadı.", "No matching equity found.")}</td></tr>`;
    body.querySelectorAll("[data-ri-star]").forEach(button => button.onclick = event => { event.preventDefault(); event.stopPropagation(); togglePersonal(button.dataset.riStar); });
    body.querySelectorAll("tr[data-ri-index]").forEach(tr => tr.onclick = () => openRow(shown[Number(tr.dataset.riIndex)]));
    const marketAsOf = byId("marketAsOf");
    if (marketAsOf) marketAsOf.textContent = L(`${rows.length} hisse gösteriliyor · ${evaluations().length} hissede editoryal araştırma hazır`, `${rows.length} equities shown · editorial research available for ${evaluations().length}`);
  }

  function renderSettingsList() {
    const grid = document.querySelector("#settingsView .settings-grid");
    if (!grid || !assets().length) return;
    const oldPrimary = grid.querySelector(".primary-settings");
    if (oldPrimary) oldPrimary.style.display = "none";
    let panel = byId("riSettingsList");
    if (!panel) {
      panel = document.createElement("article"); panel.id = "riSettingsList"; panel.className = "settings-panel ri-settings-list"; grid.prepend(panel);
    }
    const selectedAssets = personalAssets();
    panel.innerHTML = `<p class="eyebrow">${L("KİŞİSEL TAKİP LİSTESİ", "PERSONAL WATCHLIST")}</p><h2>${L("KAP ve Nasdaq kataloğundaki herhangi bir hisseyi ekleyin", "Add any equity in the KAP and Nasdaq catalogues")}</h2><p class="muted">${L("Liste haber, kaynak ve araştırma radarlarının kapsamını belirler. Bu tarayıcıda saklanır.", "The list defines the scope of news, sources and research radars. It is stored in this browser.")}</p><div class="ri-add"><label>${L("Sembol veya şirket", "Symbol or company")}<input id="riSettingsAdd" autocomplete="off" placeholder="THYAO / RDW / şirket adı"></label><button id="riSettingsAddButton" class="button" type="button">${L("Ekle", "Add")}</button><div id="riSettingsSuggestions" class="ri-suggestions hidden"></div></div>${selectedAssets.length ? `<div class="ri-list-chips">${selectedAssets.map(asset => `<span class="ri-list-chip">${esc(asset.symbol)} · ${esc(asset.exchange)}<button type="button" data-ri-remove="${esc(keyOf(asset))}">×</button></span>`).join("")}</div>` : `<p class="muted">${L("Henüz hisse eklenmedi.", "No equity has been added yet.")}</p>`}`;
    panel.querySelectorAll("[data-ri-remove]").forEach(button => button.onclick = () => togglePersonal(button.dataset.riRemove));
    const input = byId("riSettingsAdd"), suggestions = byId("riSettingsSuggestions");
    const show = () => {
      const matches = searchAssets(input.value);
      suggestions.innerHTML = matches.map(asset => `<button class="ri-suggestion" type="button" data-settings-add="${esc(keyOf(asset))}"><strong>${esc(asset.symbol)}</strong><span>${esc(asset.name)}<small>${esc(asset.exchange)}</small></span></button>`).join("");
      suggestions.classList.toggle("hidden", !matches.length);
      suggestions.querySelectorAll("[data-settings-add]").forEach(button => button.onclick = () => { togglePersonal(button.dataset.settingsAdd, true); });
    };
    input.oninput = show; input.onfocus = show;
    byId("riSettingsAddButton").onclick = () => { const asset = searchAssets(input.value, 1)[0]; if (asset) togglePersonal(keyOf(asset), true); };
  }

  function eventTickers(event) { return new Set((event?.companies || []).map(symbolOf)); }
  function personalSymbols() { return new Set(personalAssets().map(asset => asset.symbol)); }
  function eventsForScope(scope) {
    const all = events();
    if (scope === "ALL" || scope === "RESEARCH") return all;
    const symbols = personalSymbols();
    return all.filter(event => [...eventTickers(event)].some(symbol => symbols.has(symbol)));
  }

  async function fetchJsonCandidates(urls) {
    const errors = [];
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json,text/plain,*/*" } });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return await response.json();
      } catch (error) { errors.push(error); }
    }
    throw errors.at(-1) || new Error("NEWS_FETCH_FAILED");
  }

  async function fetchNewsForAsset(asset) {
    const query = asset.providerSymbol || (asset.market === "BIST" ? `${asset.symbol}.IS` : asset.symbol);
    const direct = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=${NEWS_PER_SYMBOL}`;
    const payload = await fetchJsonCandidates([direct, direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"), `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, `https://corsproxy.io/?url=${encodeURIComponent(direct)}`]);
    return (payload.news || []).map(item => ({
      id: item.uuid || item.link || `${asset.key}-${item.providerPublishTime}`,
      title: item.title || "",
      publisher: item.publisher || "",
      url: item.link || "",
      publishedAt: Number(item.providerPublishTime || 0) * 1000 || Date.now(),
      tickers: [asset.symbol],
      sourceType: "MARKET_NEWS",
      reason: L(`${asset.symbol} kişisel listenizde olduğu için getirildi`, `Fetched because ${asset.symbol} is in your personal list`)
    })).filter(item => item.title && item.url);
  }

  async function refreshPersonalNews() {
    if (runtime.newsLoading) return;
    runtime.newsLoading = true;
    renderSourcesView();
    const list = personalAssets().slice(0, NEWS_MAX_SYMBOLS);
    const queue = [...list];
    const collected = [];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const asset = queue.shift();
        try { collected.push(...await fetchNewsForAsset(asset)); } catch (_) {}
      }
    });
    await Promise.all(workers);
    const map = new Map([...collected, ...runtime.news].map(item => [item.id, item]));
    runtime.news = [...map.values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 200);
    saveNewsCache();
    runtime.newsLoading = false;
    renderSourcesView();
  }

  function renderSourcesView() {
    const host = byId("sourcesList");
    if (!host) return;
    let toolbar = byId("riSourceToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div"); toolbar.id = "riSourceToolbar"; toolbar.className = "ri-source-toolbar"; host.before(toolbar);
    }
    toolbar.innerHTML = `<div class="ri-tabs"><button data-source-scope="MINE" class="${runtime.sourceScope === "MINE" ? "active" : ""}">${L("Listemin kaynakları", "My-list sources")}</button><button data-source-scope="RESEARCH" class="${runtime.sourceScope === "RESEARCH" ? "active" : ""}">${L("Araştırma evreni", "Research universe")}</button><button data-source-scope="ALL" class="${runtime.sourceScope === "ALL" ? "active" : ""}">${L("Tüm kaynaklar", "All sources")}</button></div><button id="riRefreshNews" class="button" type="button" ${runtime.sourceScope !== "MINE" || !runtime.personalKeys.size ? "disabled" : ""}>${runtime.newsLoading ? L("Haberler alınıyor…", "Fetching news…") : L("Listemin haberlerini yenile", "Refresh my-list news")}</button>`;
    toolbar.querySelectorAll("[data-source-scope]").forEach(button => button.onclick = () => { runtime.sourceScope = button.dataset.sourceScope; localStorage.setItem(SOURCE_SCOPE_KEY, runtime.sourceScope); renderSourcesView(); });
    byId("riRefreshNews")?.addEventListener("click", refreshPersonalNews);

    let explanation = byId("riSourceExplanation");
    if (!explanation) { explanation = document.createElement("div"); explanation.id = "riSourceExplanation"; explanation.className = "ri-explain"; toolbar.after(explanation); }
    explanation.innerHTML = `<strong>${L("Kaynaklar nasıl seçiliyor?", "How are sources selected?")}</strong> ${L("Rapor kaynakları; hisse eşleşmesi, yayın zamanı, olayın önem eşiği ve kaynak türüne göre seçilir. “Listemin kaynakları” yalnız kişisel listenizdeki hisselerle eşleşen rapor haberlerini ve talep üzerine getirilen güncel başlıkları gösterir.", "Report sources are selected by ticker match, publication time, materiality threshold and source type. “My-list sources” shows only report news matching your personal list plus current headlines fetched on demand.")}`;

    const scopedEvents = eventsForScope(runtime.sourceScope);
    const sources = [];
    for (const event of scopedEvents) for (const source of event.sources || []) sources.push({
      title: source.title || event.headline,
      publisher: source.publisher || "",
      url: source.url || "",
      publishedAt: source.published_at || event.published_time,
      tickers: event.companies || [],
      sourceType: source.source_type || "SECONDARY_NEWS",
      event: event.headline,
      reason: L(`Rapor olayına bağlandı: ${(event.companies || []).join(", ") || "genel piyasa"}`, `Linked to a report event: ${(event.companies || []).join(", ") || "general market"}`)
    });
    if (runtime.sourceScope === "MINE") sources.push(...runtime.news);
    const deduped = [...new Map(sources.filter(source => source.url).map(source => [source.url, source])).values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    host.innerHTML = deduped.length ? deduped.map(source => `<article class="source"><div class="meta"><span>${esc((source.tickers || []).join(", ") || L("GENEL", "GENERAL"))}</span><span>•</span><span>${esc(source.sourceType)}</span><span>•</span><span>${esc(source.publisher)}</span><span>•</span><span>${esc(dateTime(source.publishedAt))}</span></div><h3>${esc(source.title)}</h3>${source.event ? `<p>${esc(source.event)}</p>` : ""}<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${L("Kaynağı aç ↗", "Open source ↗")}</a><div class="ri-source-reason"><strong>${L("Seçim gerekçesi:", "Selection reason:")}</strong> ${esc(source.reason)}</div></article>`).join("") : `<div class="ri-source-empty">${runtime.sourceScope === "MINE" && !runtime.personalKeys.size ? L("Kişisel listeniz boş. Araştırma Evreni veya Ayarlar bölümünden hisse ekleyin.", "Your personal list is empty. Add equities from Research Universe or Settings.") : L("Bu kapsamda kaynak bulunamadı.", "No sources were found for this scope.")}</div>`;
  }

  function recentEventCount(ticker) {
    const cutoff = Date.now() - 72 * 3600_000;
    return events().filter(event => (event.companies || []).map(symbolOf).includes(symbolOf(ticker)) && (!event.published_time || new Date(event.published_time).getTime() >= cutoff)).length;
  }

  function scoredResearch(scope) {
    const watch = watchMaps();
    const allowed = scope === "MINE" ? new Set(personalAssets().map(asset => asset.symbol)) : null;
    return evaluations().map(evaluation => {
      const asset = assetForTicker(evaluation.ticker);
      const row = asset ? watch.byKey.get(keyOf(asset)) || watch.bySymbol.get(asset.symbol) : watch.bySymbol.get(symbolOf(evaluation.ticker));
      const oneDay = finite(row?.return_1d_pct ?? asset?.change) || 0;
      const month = finite(row?.return_21d_pct ?? asset?.performance?.["1A"]) || 0;
      const eventCount = recentEventCount(evaluation.ticker);
      const rating = ratingMeta(evaluation.rating)[2];
      const riskWeight = evaluation.risk_badge === "SPECULATIVE" || evaluation.rating === "HIGH_UNCERTAINTY" ? 12 : 0;
      const movement = Math.min(30, Math.abs(oneDay) * 2.5 + Math.abs(month) * .35);
      const score = Math.round(rating + eventCount * 12 + movement + riskWeight);
      const reasons = [];
      if (eventCount) reasons.push(L(`${eventCount} güncel gelişme`, `${eventCount} recent event(s)`));
      if (Math.abs(oneDay) >= 2) reasons.push(`1G ${pct(oneDay)}`);
      if (Math.abs(month) >= 5) reasons.push(`21G ${pct(month)}`);
      reasons.push(ratingMeta(evaluation.rating)[0]);
      return { evaluation, asset, row, oneDay, month, eventCount, score, reasons };
    }).filter(item => !allowed || allowed.has(symbolOf(item.evaluation.ticker))).sort((a, b) => b.score - a.score);
  }

  function renderOverviewIntelligence() {
    const focus = byId("focusList");
    if (!focus || !report()) return;
    const panel = focus.closest(".focus-panel");
    if (panel) {
      let toolbar = panel.querySelector(".ri-overview-toolbar");
      if (!toolbar) { toolbar = document.createElement("div"); toolbar.className = "ri-overview-toolbar"; panel.querySelector(".section-head")?.after(toolbar); }
      toolbar.innerHTML = `<div class="ri-tabs"><button data-overview-scope="RESEARCH" class="${runtime.overviewScope === "RESEARCH" ? "active" : ""}">${L("Araştırma evreni", "Research universe")}</button><button data-overview-scope="MINE" class="${runtime.overviewScope === "MINE" ? "active" : ""}">${L("Listem", "My list")}</button></div>`;
      toolbar.querySelectorAll("[data-overview-scope]").forEach(button => button.onclick = () => { runtime.overviewScope = button.dataset.overviewScope; localStorage.setItem(OVERVIEW_SCOPE_KEY, runtime.overviewScope); renderOverviewIntelligence(); });
      let note = panel.querySelector(".ri-focus-note");
      if (!note) { note = document.createElement("p"); note.className = "ri-focus-note"; toolbar.after(note); }
      note.textContent = L("Otomatik sıralama: güncel gelişme + fiyat hareketi + araştırma görüşü + risk. Bir editör tarafından elle seçilmez.", "Automatic ranking: recent events + price movement + research view + risk. It is not hand-picked by an editor.");
    }
    const ranked = scoredResearch(runtime.overviewScope).slice(0, 5);
    focus.innerHTML = ranked.length ? ranked.map((item, index) => `<button class="focus-item" data-focus-ticker="${esc(item.evaluation.ticker)}" type="button"><span class="focus-rank">${String(index + 1).padStart(2, "0")}</span><span class="focus-copy"><strong>${esc(item.evaluation.ticker)} · ${esc(item.evaluation.company)}</strong><span>${esc(item.reasons.join(" · "))}</span></span><span class="focus-price"><strong>${money(item.row?.price ?? item.asset?.price, item.row?.currency || item.asset?.currency)}</strong><small class="${pctClass(item.oneDay)}">${pct(item.oneDay)}</small></span></button>`).join("") : `<div class="empty-state"><strong>${L("Bu kapsamda araştırma verisi yok.", "No research data for this scope.")}</strong></div>`;
    focus.querySelectorAll("[data-focus-ticker]").forEach(button => button.onclick = () => { try { openAssetDrawer(button.dataset.focusTicker); } catch (_) {} });
    renderRadar();
  }

  function renderRadar() {
    const briefing = byId("briefingView");
    const anchor = briefing?.querySelector(".research-stream");
    if (!briefing || !anchor) return;
    let section = byId("riResearchRadar");
    if (!section) { section = document.createElement("section"); section.id = "riResearchRadar"; section.className = "ri-radar"; anchor.before(section); }
    const data = scoredResearch(runtime.overviewScope);
    const opportunities = data.filter(item => item.oneDay > 0 && item.month > -15 && ["POSITIVE", "STRONG_POSITIVE", "NEUTRAL"].includes(item.evaluation.rating)).sort((a, b) => (b.oneDay + b.month * .2 + b.eventCount * 2) - (a.oneDay + a.month * .2 + a.eventCount * 2)).slice(0, 5);
    const notable = [...data].sort((a, b) => (Math.abs(b.oneDay) + b.eventCount * 3 + Math.abs(b.month) * .15) - (Math.abs(a.oneDay) + a.eventCount * 3 + Math.abs(a.month) * .15)).slice(0, 5);
    const list = items => items.map(item => `<button class="ri-radar-item" type="button" data-radar-ticker="${esc(item.evaluation.ticker)}"><span class="ri-radar-score">${item.score}</span><span><strong>${esc(item.evaluation.ticker)} · ${esc(item.evaluation.company)}</strong><small>${esc(item.reasons.join(" · "))}</small></span><strong class="${pctClass(item.oneDay)}">${pct(item.oneDay)}</strong></button>`).join("") || `<p class="muted">${L("Bu kapsamda yeterli veri yok.", "Insufficient data for this scope.")}</p>`;
    section.innerHTML = `<div class="section-head"><div><p class="eyebrow">${L("ARAŞTIRMA RADARLARI", "RESEARCH RADARS")}</p><h2>${L("Günün fırsatları ve göze çarpanlar", "Daily opportunities and notable movers")}</h2><p class="muted">${L("Alım sinyali değildir; nesnel fiyat, olay ve araştırma ölçütleriyle sıralanır.", "Not a buy signal; ranked by objective price, event and research criteria.")}</p></div></div><div class="ri-radar-grid"><article class="ri-radar-panel"><h3>${L("Araştırma fırsatları", "Research opportunities")}</h3><p class="muted">${L("Pozitif/dengeleyici görüş, güncel gelişme ve göreli fiyat gücü.", "Positive/balanced view, recent events and relative price strength.")}</p><div class="ri-radar-list">${list(opportunities)}</div></article><article class="ri-radar-panel"><h3>${L("Göze çarpanlar", "Notable movers")}</h3><p class="muted">${L("Yüksek fiyat hareketi, olay yoğunluğu veya belirsizlik nedeniyle araştırma gerektirenler.", "Assets requiring research due to large price movement, event intensity or uncertainty.")}</p><div class="ri-radar-list">${list(notable)}</div></article></div>`;
    section.querySelectorAll("[data-radar-ticker]").forEach(button => button.onclick = () => { try { openAssetDrawer(button.dataset.radarTicker); } catch (_) {} });
  }

  function cleanDuplicateCards() {
    document.querySelectorAll(".research-card-body").forEach(card => {
      const summary = card.querySelector(".summary-line");
      const context = card.querySelector(".research-context");
      if (!summary || !context) return;
      const one = summary.textContent.trim().toLocaleLowerCase(locale());
      const two = context.textContent.trim().toLocaleLowerCase(locale());
      context.style.display = !two || one.includes(two) || two.includes(one) ? "none" : "";
    });
  }

  function renderAll() {
    if (!assets().length || !report()) return;
    loadPersonalList();
    updateBrand();
    renderResearchUniverse();
    renderSettingsList();
    renderSourcesView();
    renderOverviewIntelligence();
    cleanDuplicateCards();
  }

  function bind() {
    byId("marketSearch")?.addEventListener("input", () => queueMicrotask(renderResearchUniverse));
    byId("marketSort")?.addEventListener("change", () => queueMicrotask(renderResearchUniverse));
    byId("languageToggle")?.addEventListener("click", () => setTimeout(renderAll, 0));
    window.addEventListener("hashchange", () => setTimeout(renderAll, 20));
    window.addEventListener("piyasa-market-quotes", () => setTimeout(() => { renderResearchUniverse(); renderOverviewIntelligence(); }, 0));
    window.addEventListener("piyasa-personal-list-change", () => setTimeout(renderAll, 0));
    const observer = new MutationObserver(() => {
      const current = report();
      if (current && current !== runtime.lastReportRef) { runtime.lastReportRef = current; setTimeout(renderAll, 0); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(renderAll, 30000);
  }

  function start() {
    if (runtime.started) return;
    runtime.started = true;
    injectStyles();
    const wait = setInterval(() => {
      if (!window.PiyasaMarketWorkspace?.getAssets?.().length || !report()) return;
      clearInterval(wait);
      loadPersonalList();
      bind();
      renderAll();
    }, 100);
  }

  window.PiyasaResearchIntelligence = {
    getPersonalAssets: personalAssets,
    getPersonalKeys: () => [...runtime.personalKeys],
    refresh: renderAll,
    refreshPersonalNews,
    score: scoredResearch
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
