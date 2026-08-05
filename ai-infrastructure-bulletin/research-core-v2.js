(() => {
  "use strict";

  if (window.__PM_RESEARCH_CORE_V2__) return;
  window.__PM_RESEARCH_CORE_V2__ = true;

  const PERSONAL_KEY = "piyasa-masasi-ai.personal-list.v3";
  const LEGACY_KEYS = ["piyasa-masasi-ai.personal-list.v2", "piyasa-masasi-ai.personal-list.v1"];
  const SCOPE_KEY = "piyasa-masasi-ai.research-scope.v3";
  const SOURCE_SCOPE_KEY = "piyasa-masasi-ai.source-scope.v3";
  const OVERVIEW_SCOPE_KEY = "piyasa-masasi-ai.overview-scope.v3";
  const NEWS_KEY = "piyasa-masasi-ai.personal-news.v2";
  const MAX_ROWS = 500;
  const MAX_NEWS_SYMBOLS = 20;

  const runtime = {
    personal: new Set(),
    scope: localStorage.getItem(SCOPE_KEY) || "ALL",
    sourceScope: localStorage.getItem(SOURCE_SCOPE_KEY) || "MINE",
    overviewScope: localStorage.getItem(OVERVIEW_SCOPE_KEY) || "RESEARCH",
    news: readJson(sessionStorage, NEWS_KEY, []),
    newsLoading: false
  };

  const $ = id => document.getElementById(id);
  const language = () => document.documentElement.lang === "en" ? "en" : "tr";
  const T = (tr, en) => language() === "en" ? en : tr;
  const locale = () => language() === "en" ? "en-GB" : "tr-TR";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const symbolOf = value => String(value || "").trim().toUpperCase().replace(/\.IS$/i, "");
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const keyOf = asset => asset?.key || `${asset?.market === "BIST" ? "BIST" : "US"}:${symbolOf(asset?.symbol)}`;
  const assets = () => window.PiyasaMarketWorkspace?.getAssets?.() || [];
  const report = () => { try { return state?.report || null; } catch (_) { return null; } };
  const evaluations = () => Array.isArray(report()?.company_evaluations) ? report().company_evaluations : [];
  const watchlist = () => Array.isArray(report()?.watchlist) ? report().watchlist : [];
  const events = () => Array.isArray(report()?.events) ? report().events : [];

  function readJson(storage, key, fallback) {
    try { const value = JSON.parse(storage.getItem(key) || "null"); return value ?? fallback; }
    catch (_) { return fallback; }
  }

  function pct(value) {
    const number = finite(value);
    return number === null ? "—" : `${number > 0 ? "+" : ""}${number.toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
  }

  function pctClass(value) {
    const number = finite(value);
    return number === null || number === 0 ? "" : number > 0 ? "up" : "down";
  }

  function money(value, currency = "TRY") {
    const number = finite(value);
    if (number === null) return "—";
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: number >= 100 ? 2 : 4 }).format(number); }
    catch (_) { return `${number.toLocaleString(locale())} ${currency}`; }
  }

  function dateTime(value) {
    if (!value) return "—";
    const timestamp = typeof value === "number" && value < 1e12 ? value * 1000 : value;
    try { return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)); }
    catch (_) { return String(value); }
  }

  function migratePersonal() {
    const valid = new Set(assets().map(keyOf));
    const saved = readJson(localStorage, PERSONAL_KEY, []);
    if (Array.isArray(saved)) saved.filter(key => valid.has(key)).forEach(key => runtime.personal.add(key));
    if (!runtime.personal.size) {
      for (const legacyKey of LEGACY_KEYS) {
        const legacy = readJson(localStorage, legacyKey, []);
        if (!Array.isArray(legacy)) continue;
        for (const raw of legacy) {
          if (valid.has(raw)) { runtime.personal.add(raw); continue; }
          const symbol = symbolOf(raw);
          const matches = assets().filter(asset => asset.symbol === symbol);
          const preferred = matches.find(asset => String(raw).toUpperCase().endsWith(".IS") ? asset.market === "BIST" : asset.market === "US") || matches[0];
          if (preferred) runtime.personal.add(keyOf(preferred));
        }
        if (runtime.personal.size) break;
      }
    }
    persistPersonal(false);
  }

  function persistPersonal(notify = true) {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify([...runtime.personal].sort()));
    localStorage.setItem("piyasa-masasi-ai.personal-list.v2", JSON.stringify([...runtime.personal].sort()));
    localStorage.setItem("piyasa-masasi-ai.personal-list.v1", JSON.stringify([...new Set([...runtime.personal].map(key => key.split(":").slice(1).join(":")))].sort()));
    if (notify) window.dispatchEvent(new CustomEvent("piyasa-personal-list-change", { detail: { keys: [...runtime.personal] } }));
  }

  function personalAssets() {
    return assets().filter(asset => runtime.personal.has(keyOf(asset)));
  }

  function togglePersonal(key, addOnly = false) {
    if (!key) return;
    if (addOnly) runtime.personal.add(key);
    else if (runtime.personal.has(key)) runtime.personal.delete(key);
    else runtime.personal.add(key);
    persistPersonal();
    renderAll();
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

  function assetForTicker(ticker, provider = "") {
    const symbol = symbolOf(ticker || provider);
    const universe = assets();
    if (String(provider).toUpperCase().endsWith(".IS")) return universe.find(asset => asset.market === "BIST" && asset.symbol === symbol) || null;
    const row = watchlist().find(item => symbolOf(item.ticker || item.provider_symbol) === symbol);
    if (String(row?.provider_symbol || "").toUpperCase().endsWith(".IS")) return universe.find(asset => asset.market === "BIST" && asset.symbol === symbol) || null;
    return universe.find(asset => asset.market === "US" && asset.symbol === symbol) || universe.find(asset => asset.symbol === symbol) || null;
  }

  function maps() {
    const evalByKey = new Map(), evalBySymbol = new Map(), watchByKey = new Map(), watchBySymbol = new Map();
    for (const item of evaluations()) {
      const asset = assetForTicker(item.ticker);
      if (asset) evalByKey.set(keyOf(asset), item);
      if (!evalBySymbol.has(symbolOf(item.ticker))) evalBySymbol.set(symbolOf(item.ticker), item);
    }
    for (const row of watchlist()) {
      const asset = assetForTicker(row.ticker, row.provider_symbol);
      if (asset) watchByKey.set(keyOf(asset), row);
      if (!watchBySymbol.has(symbolOf(row.ticker || row.provider_symbol))) watchBySymbol.set(symbolOf(row.ticker || row.provider_symbol), row);
    }
    return { evalByKey, evalBySymbol, watchByKey, watchBySymbol };
  }

  function ratingMeta(value) {
    const table = {
      STRONG_POSITIVE: [T("Güçlü Pozitif", "Strong Positive"), "positive", 35],
      POSITIVE: [T("Pozitif", "Positive"), "positive", 25],
      NEUTRAL: [T("Nötr", "Neutral"), "neutral", 8],
      NEGATIVE: [T("Negatif", "Negative"), "negative", 20],
      HIGH_UNCERTAINTY: [T("Yüksek Belirsizlik", "High Uncertainty"), "warning", 22]
    };
    return table[value] || [T("Araştırma bekliyor", "Research pending"), "neutral", 0];
  }

  function injectStyles() {
    if ($("pm-research-core-v2-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-research-core-v2-styles";
    style.textContent = `
      .ri-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:rgba(255,253,248,.78);flex-wrap:wrap}.ri-tabs{display:flex;gap:5px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}.ri-tabs button{border:0;border-radius:8px;padding:8px 11px;background:transparent;color:var(--muted);font-size:.73rem;font-weight:750}.ri-tabs button.active{background:var(--pine);color:#fff}.ri-add{position:relative;display:flex;align-items:flex-end;gap:7px;min-width:min(430px,100%)}.ri-add label{display:grid;gap:5px;flex:1;color:var(--muted);font-size:.65rem;font-weight:700}.ri-add input{width:100%;min-height:38px}.ri-suggestions{position:absolute;z-index:40;top:100%;left:0;right:74px;margin-top:4px;max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:11px;background:var(--paper);box-shadow:var(--shadow)}.ri-suggestions.hidden{display:none}.ri-suggestion{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px 11px;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink)}.ri-suggestion:hover{background:var(--sage-soft)}.ri-suggestion strong,.ri-suggestion span,.ri-suggestion small{display:block}.ri-suggestion small{color:var(--muted)}.ri-star{width:31px;height:31px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:transparent;color:#9aa79f;font-size:1rem}.ri-star.active{border-color:#d1af65;color:#a67125;background:#fff2cf}.ri-pending{display:block;color:var(--muted);font-size:.66rem;margin-top:4px}.ri-explain{margin:0 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--sage-soft);font-size:.74rem;line-height:1.55;color:var(--muted)}.ri-explain strong{color:var(--ink)}.ri-source-toolbar,.ri-overview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px}.ri-source-reason{margin-top:9px;padding-top:8px;border-top:1px solid var(--line);font-size:.68rem;color:var(--muted)}.ri-source-reason strong{color:var(--ink)}.ri-radar{margin:22px 0}.ri-radar-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ri-radar-panel{border:1px solid var(--line);border-radius:16px 6px 16px 6px;background:var(--paper);padding:15px;box-shadow:var(--shadow)}.ri-radar-list{display:grid;gap:8px;margin-top:12px}.ri-radar-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink)}.ri-radar-item:last-child{border-bottom:0}.ri-radar-score{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--sage-soft);font-size:.68rem;font-weight:800}.ri-radar-item small{display:block;color:var(--muted);margin-top:3px}.ri-focus-note{margin:-5px 0 12px;color:var(--muted);font-size:.7rem}.ri-settings-list{grid-column:1/-1}.ri-list-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ri-list-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 8px 7px 11px;border:1px solid var(--line);border-radius:999px;background:var(--paper-soft);font-size:.72rem;font-weight:750}.ri-list-chip button{width:22px;height:22px;border:0;border-radius:50%;background:rgba(23,58,51,.08);color:var(--pine)}.ri-source-empty{padding:28px;text-align:center;color:var(--muted)}
      @media(max-width:900px){.ri-radar-grid{grid-template-columns:1fr}.ri-add{min-width:100%}.ri-toolbar{align-items:stretch;flex-direction:column}.ri-source-toolbar,.ri-overview-toolbar{align-items:stretch;flex-direction:column}.ri-tabs{width:100%}.ri-tabs button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function ensureResearchToolbar() {
    const table = document.querySelector("#watchlistView .market-table-wrap");
    if (!table) return null;
    let toolbar = $("riResearchToolbar");
    if (!toolbar) { toolbar = document.createElement("div"); toolbar.id = "riResearchToolbar"; toolbar.className = "ri-toolbar"; table.before(toolbar); }
    return toolbar;
  }

  function suggestionMarkup(asset, attr) {
    return `<button class="ri-suggestion" type="button" ${attr}="${esc(keyOf(asset))}"><strong>${esc(asset.symbol)}</strong><span>${esc(asset.name)}<small>${esc(asset.exchange)} · ${esc(asset.currency)}</small></span><small>${runtime.personal.has(keyOf(asset)) ? T("Listede", "Listed") : T("Ekle", "Add")}</small></button>`;
  }

  function bindSuggestionInput(input, suggestions, attr) {
    const show = () => {
      const matches = searchAssets(input.value);
      suggestions.innerHTML = matches.map(asset => suggestionMarkup(asset, attr)).join("");
      suggestions.classList.toggle("hidden", !matches.length);
      suggestions.querySelectorAll(`[${attr}]`).forEach(button => button.onclick = () => { togglePersonal(button.getAttribute(attr), true); input.value = ""; suggestions.classList.add("hidden"); });
    };
    input.oninput = show; input.onfocus = show;
    input.onkeydown = event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const match = searchAssets(input.value, 1)[0];
      if (match) { togglePersonal(keyOf(match), true); input.value = ""; suggestions.classList.add("hidden"); }
    };
  }

  function renderResearchToolbar() {
    const toolbar = ensureResearchToolbar();
    if (!toolbar) return;
    toolbar.innerHTML = `<div class="ri-tabs"><button type="button" data-ri-scope="ALL" class="${runtime.scope === "ALL" ? "active" : ""}">${T("Tüm hisseler", "All equities")}</button><button type="button" data-ri-scope="MINE" class="${runtime.scope === "MINE" ? "active" : ""}">${T("Listem", "My list")} (${runtime.personal.size})</button><button type="button" data-ri-scope="RESEARCH" class="${runtime.scope === "RESEARCH" ? "active" : ""}">${T("Araştırması hazır", "Research available")}</button></div><div class="ri-add"><label>${T("Listeme herhangi bir hisse ekle", "Add any equity to my list")}<input id="riAddSymbol" autocomplete="off" placeholder="LMKDC / RDW / şirket adı"></label><button id="riAddButton" class="button" type="button">${T("Ekle", "Add")}</button><div id="riAddSuggestions" class="ri-suggestions hidden"></div></div>`;
    toolbar.querySelectorAll("[data-ri-scope]").forEach(button => button.onclick = () => { runtime.scope = button.dataset.riScope; localStorage.setItem(SCOPE_KEY, runtime.scope); renderResearchUniverse(); });
    const input = $("riAddSymbol"), suggestions = $("riAddSuggestions");
    bindSuggestionInput(input, suggestions, "data-add-key");
    $("riAddButton").onclick = () => { const match = searchAssets(input.value, 1)[0]; if (match) { togglePersonal(keyOf(match), true); input.value = ""; suggestions.classList.add("hidden"); } };
  }

  function researchRows() {
    const { evalByKey, evalBySymbol, watchByKey, watchBySymbol } = maps();
    const search = `${state?.marketSearch || ""} ${state?.query || ""}`.trim().toLocaleUpperCase(locale());
    let rows = assets().map(asset => ({ asset, evaluation: evalByKey.get(keyOf(asset)) || evalBySymbol.get(asset.symbol) || null, watch: watchByKey.get(keyOf(asset)) || watchBySymbol.get(asset.symbol) || null }));
    if (runtime.scope === "MINE") rows = rows.filter(row => runtime.personal.has(keyOf(row.asset)));
    if (runtime.scope === "RESEARCH") rows = rows.filter(row => row.evaluation || row.watch);
    if (search) rows = rows.filter(row => `${row.asset.symbol} ${row.asset.name} ${row.asset.exchange} ${row.asset.sector}`.toLocaleUpperCase(locale()).includes(search));
    const sort = state?.marketSort || "ticker";
    rows.sort((a, b) => {
      if (sort === "return21") return (finite(b.watch?.return_21d_pct ?? b.asset.performance?.["1A"]) ?? -Infinity) - (finite(a.watch?.return_21d_pct ?? a.asset.performance?.["1A"]) ?? -Infinity);
      if (sort === "rating") return ratingMeta(b.evaluation?.rating)[2] - ratingMeta(a.evaluation?.rating)[2];
      if (sort === "risk") return String(b.watch?.risk_badge || b.evaluation?.risk_badge || "").localeCompare(String(a.watch?.risk_badge || a.evaluation?.risk_badge || ""));
      return a.asset.symbol.localeCompare(b.asset.symbol) || a.asset.market.localeCompare(b.asset.market);
    });
    return rows;
  }

  function openResearchRow(row) {
    if (row.evaluation || row.watch) {
      try { openAssetDrawer(row.asset.symbol); return; } catch (_) {}
    }
    navigate("market");
    setTimeout(() => window.PiyasaMarketWorkspace?.select?.(row.asset.key), 50);
  }

  function renderResearchUniverse() {
    const body = $("watchlistBody");
    if (!body || !assets().length) return;
    renderResearchToolbar();
    const rows = researchRows();
    const shown = rows.slice(0, MAX_ROWS);
    const header = document.querySelector("#watchlistView table thead tr");
    if (header) header.innerHTML = `<th>★</th><th>${T("Varlık", "Asset")}</th><th>${T("Araştırma görüşü", "Research view")}</th><th>${T("Fiyat", "Price")}</th><th>1G</th><th>21G</th><th>252G</th><th>52H</th><th>${T("Risk", "Risk")}</th>`;
    body.innerHTML = shown.length ? shown.map((row, index) => {
      const asset = row.asset, evaluation = row.evaluation, watch = row.watch;
      const [ratingLabel, ratingClass] = ratingMeta(evaluation?.rating);
      const oneDay = finite(watch?.return_1d_pct ?? asset.change), month = finite(watch?.return_21d_pct ?? asset.performance?.["1A"]), year = finite(watch?.return_252d_pct ?? asset.performance?.["1Y"]);
      const risk = watch?.risk_badge || evaluation?.risk_badge || T("Katalog", "Catalogue");
      return `<tr data-ri-index="${index}"><td><button class="ri-star ${runtime.personal.has(keyOf(asset)) ? "active" : ""}" type="button" data-ri-star="${esc(keyOf(asset))}">★</button></td><td><div class="ticker-name"><strong>${esc(asset.symbol)} <small>${esc(asset.exchange)}</small></strong><span>${esc(asset.name)} · ${asset.quoteAt ? esc(dateTime(asset.quoteAt)) : T("Fiyat bekleniyor", "Price pending")}</span></div></td><td><span class="table-rating ${ratingClass}">${esc(ratingLabel)}</span>${!evaluation ? `<span class="ri-pending">${T("Fiyat ve grafik kullanılabilir", "Price and chart available")}</span>` : ""}</td><td>${money(watch?.price ?? asset.price, asset.currency)}</td><td class="${pctClass(oneDay)}">${pct(oneDay)}</td><td class="${pctClass(month)}">${pct(month)}</td><td class="${pctClass(year)}">${pct(year)}</td><td class="${pctClass(watch?.distance_from_52w_high_pct)}">${pct(watch?.distance_from_52w_high_pct)}</td><td><span class="badge ${String(risk).includes("SPEC") ? "warning" : "neutral"}">${esc(risk)}</span></td></tr>`;
    }).join("") : `<tr><td colspan="9" class="table-empty">${T("Eşleşen hisse bulunamadı.", "No matching equity found.")}</td></tr>`;
    body.querySelectorAll("[data-ri-star]").forEach(button => button.onclick = event => { event.preventDefault(); event.stopPropagation(); togglePersonal(button.dataset.riStar); });
    body.querySelectorAll("tr[data-ri-index]").forEach(row => row.onclick = () => openResearchRow(shown[Number(row.dataset.riIndex)]));
    if ($("marketAsOf")) $("marketAsOf").textContent = T(`${rows.length} hisse gösteriliyor · ${evaluations().length} hissede editoryal araştırma hazır`, `${rows.length} equities shown · editorial research available for ${evaluations().length}`);
  }

  function renderSettings() {
    const grid = document.querySelector("#settingsView .settings-grid");
    if (!grid) return;
    const old = grid.querySelector(".primary-settings");
    if (old) old.style.display = "none";
    let panel = $("riSettingsList");
    if (!panel) { panel = document.createElement("article"); panel.id = "riSettingsList"; panel.className = "settings-panel ri-settings-list"; grid.prepend(panel); }
    const list = personalAssets();
    panel.innerHTML = `<p class="eyebrow">${T("KİŞİSEL TAKİP LİSTESİ", "PERSONAL WATCHLIST")}</p><h2>${T("KAP ve Nasdaq kataloğundaki herhangi bir hisseyi ekleyin", "Add any equity in the KAP and Nasdaq catalogues")}</h2><p class="muted">${T("Liste; canlı fiyat, kaynak ve araştırma radarlarının kapsamını belirler ve bu tarayıcıda saklanır.", "The list defines the scope of live prices, sources and research radars and is stored in this browser.")}</p><div class="ri-add"><label>${T("Sembol veya şirket", "Symbol or company")}<input id="riSettingsAdd" autocomplete="off" placeholder="THYAO / RDW / şirket adı"></label><button id="riSettingsAddButton" class="button" type="button">${T("Ekle", "Add")}</button><div id="riSettingsSuggestions" class="ri-suggestions hidden"></div></div>${list.length ? `<div class="ri-list-chips">${list.map(asset => `<span class="ri-list-chip">${esc(asset.symbol)} · ${esc(asset.exchange)}<button type="button" data-ri-remove="${esc(keyOf(asset))}">×</button></span>`).join("")}</div>` : `<p class="muted">${T("Henüz hisse eklenmedi.", "No equity has been added yet.")}</p>`}`;
    panel.querySelectorAll("[data-ri-remove]").forEach(button => button.onclick = () => togglePersonal(button.dataset.riRemove));
    const input = $("riSettingsAdd"), suggestions = $("riSettingsSuggestions");
    bindSuggestionInput(input, suggestions, "data-settings-add");
    $("riSettingsAddButton").onclick = () => { const match = searchAssets(input.value, 1)[0]; if (match) togglePersonal(keyOf(match), true); };
  }

  function personalSymbols() { return new Set(personalAssets().map(asset => asset.symbol)); }
  function filteredEvents(scope) {
    if (scope !== "MINE") return events();
    const symbols = personalSymbols();
    return events().filter(event => (event.companies || []).some(company => symbols.has(symbolOf(company))));
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try { const response = await fetch(url, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(`HTTP_${response.status}`); return await response.json(); }
    finally { clearTimeout(timer); }
  }

  async function fetchNews(asset) {
    const query = asset.providerSymbol || asset.symbol;
    const direct = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=4`;
    const urls = [direct, direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"), `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, `https://corsproxy.io/?url=${encodeURIComponent(direct)}`];
    let payload = null;
    for (const url of urls) { try { payload = await fetchJson(url); break; } catch (_) {} }
    return (payload?.news || []).map(item => ({ id: item.uuid || item.link, title: item.title, publisher: item.publisher, url: item.link, publishedAt: Number(item.providerPublishTime || 0) * 1000 || Date.now(), tickers: [asset.symbol], sourceType: "MARKET_NEWS", reason: T(`${asset.symbol} kişisel listenizde olduğu için getirildi`, `Fetched because ${asset.symbol} is in your personal list`) })).filter(item => item.id && item.title && item.url);
  }

  async function refreshPersonalNews() {
    if (runtime.newsLoading) return;
    runtime.newsLoading = true; renderSourcesView();
    const queue = personalAssets().slice(0, MAX_NEWS_SYMBOLS), collected = [];
    await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) { const asset = queue.shift(); try { collected.push(...await fetchNews(asset)); } catch (_) {} } }));
    runtime.news = [...new Map([...collected, ...runtime.news].map(item => [item.id, item])).values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 200);
    sessionStorage.setItem(NEWS_KEY, JSON.stringify(runtime.news));
    runtime.newsLoading = false; renderSourcesView();
  }

  function renderSourcesView() {
    const host = $("sourcesList");
    if (!host) return;
    let toolbar = $("riSourceToolbar");
    if (!toolbar) { toolbar = document.createElement("div"); toolbar.id = "riSourceToolbar"; toolbar.className = "ri-source-toolbar"; host.before(toolbar); }
    toolbar.innerHTML = `<div class="ri-tabs"><button data-source-scope="MINE" class="${runtime.sourceScope === "MINE" ? "active" : ""}">${T("Listemin kaynakları", "My-list sources")}</button><button data-source-scope="RESEARCH" class="${runtime.sourceScope === "RESEARCH" ? "active" : ""}">${T("Araştırma evreni", "Research universe")}</button><button data-source-scope="ALL" class="${runtime.sourceScope === "ALL" ? "active" : ""}">${T("Tüm kaynaklar", "All sources")}</button></div><button id="riRefreshNews" class="button" type="button" ${runtime.sourceScope !== "MINE" || !runtime.personal.size ? "disabled" : ""}>${runtime.newsLoading ? T("Haberler alınıyor…", "Fetching news…") : T("Listemin haberlerini yenile", "Refresh my-list news")}</button>`;
    toolbar.querySelectorAll("[data-source-scope]").forEach(button => button.onclick = () => { runtime.sourceScope = button.dataset.sourceScope; localStorage.setItem(SOURCE_SCOPE_KEY, runtime.sourceScope); renderSourcesView(); });
    $("riRefreshNews")?.addEventListener("click", refreshPersonalNews);
    let explain = $("riSourceExplanation");
    if (!explain) { explain = document.createElement("div"); explain.id = "riSourceExplanation"; explain.className = "ri-explain"; toolbar.after(explain); }
    explain.innerHTML = `<strong>${T("Kaynaklar nasıl seçiliyor?", "How are sources selected?")}</strong> ${T("Rapor kaynakları; hisse eşleşmesi, yayın zamanı, olayın önem eşiği ve kaynak türüne göre seçilir. “Listemin kaynakları” yalnız kişisel listenizdeki hisselerle eşleşen rapor haberlerini ve talep üzerine getirilen güncel başlıkları gösterir.", "Report sources are selected by ticker match, publication time, materiality threshold and source type. “My-list sources” shows only report news matching your personal list plus current headlines fetched on demand.")}`;
    const sources = [];
    for (const event of filteredEvents(runtime.sourceScope)) for (const source of event.sources || []) sources.push({ title: source.title || event.headline, publisher: source.publisher || "", url: source.url || "", publishedAt: source.published_at || event.published_time, tickers: event.companies || [], sourceType: source.source_type || "SECONDARY_NEWS", event: event.headline, reason: T(`Rapor olayına bağlandı: ${(event.companies || []).join(", ") || "genel piyasa"}`, `Linked to a report event: ${(event.companies || []).join(", ") || "general market"}`) });
    if (runtime.sourceScope === "MINE") sources.push(...runtime.news);
    const deduped = [...new Map(sources.filter(source => source.url).map(source => [source.url, source])).values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    host.innerHTML = deduped.length ? deduped.map(source => `<article class="source"><div class="meta"><span>${esc((source.tickers || []).join(", ") || T("GENEL", "GENERAL"))}</span><span>•</span><span>${esc(source.sourceType)}</span><span>•</span><span>${esc(source.publisher)}</span><span>•</span><span>${esc(dateTime(source.publishedAt))}</span></div><h3>${esc(source.title)}</h3>${source.event ? `<p>${esc(source.event)}</p>` : ""}<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${T("Kaynağı aç ↗", "Open source ↗")}</a><div class="ri-source-reason"><strong>${T("Seçim gerekçesi:", "Selection reason:")}</strong> ${esc(source.reason)}</div></article>`).join("") : `<div class="ri-source-empty">${runtime.sourceScope === "MINE" && !runtime.personal.size ? T("Kişisel listeniz boş. Araştırma Evreni veya Ayarlar bölümünden hisse ekleyin.", "Your personal list is empty. Add equities from Research Universe or Settings.") : T("Bu kapsamda kaynak bulunamadı.", "No sources were found for this scope.")}</div>`;
  }

  function recentEvents(ticker) {
    const cutoff = Date.now() - 72 * 3600_000;
    return events().filter(event => (event.companies || []).map(symbolOf).includes(symbolOf(ticker)) && (!event.published_time || new Date(event.published_time).getTime() >= cutoff)).length;
  }

  function scored(scope) {
    const { watchByKey, watchBySymbol } = maps();
    const allowed = scope === "MINE" ? new Set(personalAssets().map(asset => asset.symbol)) : null;
    return evaluations().map(evaluation => {
      const asset = assetForTicker(evaluation.ticker);
      const row = asset ? watchByKey.get(keyOf(asset)) || watchBySymbol.get(asset.symbol) : watchBySymbol.get(symbolOf(evaluation.ticker));
      const oneDay = finite(row?.return_1d_pct ?? asset?.change) || 0, month = finite(row?.return_21d_pct ?? asset?.performance?.["1A"]) || 0, eventCount = recentEvents(evaluation.ticker), rating = ratingMeta(evaluation.rating)[2], risk = evaluation.risk_badge === "SPECULATIVE" || evaluation.rating === "HIGH_UNCERTAINTY" ? 12 : 0;
      const score = Math.round(rating + eventCount * 12 + Math.min(30, Math.abs(oneDay) * 2.5 + Math.abs(month) * .35) + risk);
      const reasons = [];
      if (eventCount) reasons.push(T(`${eventCount} güncel gelişme`, `${eventCount} recent event(s)`));
      if (Math.abs(oneDay) >= 2) reasons.push(`1G ${pct(oneDay)}`);
      if (Math.abs(month) >= 5) reasons.push(`21G ${pct(month)}`);
      reasons.push(ratingMeta(evaluation.rating)[0]);
      return { evaluation, asset, row, oneDay, month, eventCount, score, reasons };
    }).filter(item => !allowed || allowed.has(symbolOf(item.evaluation.ticker))).sort((a, b) => b.score - a.score);
  }

  function openTicker(ticker) { try { openAssetDrawer(ticker); } catch (_) {} }

  function renderOverview() {
    const focus = $("focusList");
    if (!focus) return;
    const panel = focus.closest(".focus-panel");
    if (panel) {
      let toolbar = panel.querySelector(".ri-overview-toolbar");
      if (!toolbar) { toolbar = document.createElement("div"); toolbar.className = "ri-overview-toolbar"; panel.querySelector(".section-head")?.after(toolbar); }
      toolbar.innerHTML = `<div class="ri-tabs"><button data-overview-scope="RESEARCH" class="${runtime.overviewScope === "RESEARCH" ? "active" : ""}">${T("Araştırma evreni", "Research universe")}</button><button data-overview-scope="MINE" class="${runtime.overviewScope === "MINE" ? "active" : ""}">${T("Listem", "My list")}</button></div>`;
      toolbar.querySelectorAll("[data-overview-scope]").forEach(button => button.onclick = () => { runtime.overviewScope = button.dataset.overviewScope; localStorage.setItem(OVERVIEW_SCOPE_KEY, runtime.overviewScope); renderOverview(); });
      let note = panel.querySelector(".ri-focus-note");
      if (!note) { note = document.createElement("p"); note.className = "ri-focus-note"; toolbar.after(note); }
      note.textContent = T("Otomatik sıralama: güncel gelişme + fiyat hareketi + araştırma görüşü + risk. Bir kişi tarafından elle seçilmez.", "Automatic ranking: recent events + price movement + research view + risk. It is not hand-picked.");
    }
    const ranked = scored(runtime.overviewScope).slice(0, 5);
    focus.innerHTML = ranked.length ? ranked.map((item, index) => `<button class="focus-item" data-focus-ticker="${esc(item.evaluation.ticker)}" type="button"><span class="focus-rank">${String(index + 1).padStart(2, "0")}</span><span class="focus-copy"><strong>${esc(item.evaluation.ticker)} · ${esc(item.evaluation.company)}</strong><span>${esc(item.reasons.join(" · "))}</span></span><span class="focus-price"><strong>${money(item.row?.price ?? item.asset?.price, item.row?.currency || item.asset?.currency)}</strong><small class="${pctClass(item.oneDay)}">${pct(item.oneDay)}</small></span></button>`).join("") : `<div class="empty-state"><strong>${T("Bu kapsamda araştırma verisi yok.", "No research data for this scope.")}</strong></div>`;
    focus.querySelectorAll("[data-focus-ticker]").forEach(button => button.onclick = () => openTicker(button.dataset.focusTicker));
    renderRadar();
  }

  function renderRadar() {
    const anchor = document.querySelector("#briefingView .research-stream");
    if (!anchor) return;
    let section = $("riResearchRadar");
    if (!section) { section = document.createElement("section"); section.id = "riResearchRadar"; section.className = "ri-radar"; anchor.before(section); }
    const data = scored(runtime.overviewScope);
    const opportunities = data.filter(item => item.oneDay > 0 && item.month > -15 && ["POSITIVE", "STRONG_POSITIVE", "NEUTRAL"].includes(item.evaluation.rating)).sort((a, b) => (b.oneDay + b.month * .2 + b.eventCount * 2) - (a.oneDay + a.month * .2 + a.eventCount * 2)).slice(0, 5);
    const notable = [...data].sort((a, b) => (Math.abs(b.oneDay) + b.eventCount * 3 + Math.abs(b.month) * .15) - (Math.abs(a.oneDay) + a.eventCount * 3 + Math.abs(a.month) * .15)).slice(0, 5);
    const list = items => items.map(item => `<button class="ri-radar-item" type="button" data-radar-ticker="${esc(item.evaluation.ticker)}"><span class="ri-radar-score">${item.score}</span><span><strong>${esc(item.evaluation.ticker)} · ${esc(item.evaluation.company)}</strong><small>${esc(item.reasons.join(" · "))}</small></span><strong class="${pctClass(item.oneDay)}">${pct(item.oneDay)}</strong></button>`).join("") || `<p class="muted">${T("Bu kapsamda yeterli veri yok.", "Insufficient data for this scope.")}</p>`;
    section.innerHTML = `<div class="section-head"><div><p class="eyebrow">${T("ARAŞTIRMA RADARLARI", "RESEARCH RADARS")}</p><h2>${T("Günün fırsatları ve göze çarpanlar", "Daily opportunities and notable movers")}</h2><p class="muted">${T("Alım sinyali değildir; nesnel fiyat, olay ve araştırma ölçütleriyle sıralanır.", "Not a buy signal; ranked by objective price, event and research criteria.")}</p></div></div><div class="ri-radar-grid"><article class="ri-radar-panel"><h3>${T("Araştırma fırsatları", "Research opportunities")}</h3><p class="muted">${T("Pozitif/dengeleyici görüş, güncel gelişme ve göreli fiyat gücü.", "Positive/balanced view, recent events and relative price strength.")}</p><div class="ri-radar-list">${list(opportunities)}</div></article><article class="ri-radar-panel"><h3>${T("Göze çarpanlar", "Notable movers")}</h3><p class="muted">${T("Yüksek fiyat hareketi, olay yoğunluğu veya belirsizlik nedeniyle araştırma gerektirenler.", "Assets requiring research due to large price movement, event intensity or uncertainty.")}</p><div class="ri-radar-list">${list(notable)}</div></article></div>`;
    section.querySelectorAll("[data-radar-ticker]").forEach(button => button.onclick = () => openTicker(button.dataset.radarTicker));
  }

  function cleanCards() {
    document.querySelectorAll(".research-card-body").forEach(card => {
      const summary = card.querySelector(".summary-line"), context = card.querySelector(".research-context");
      if (!summary || !context) return;
      const one = summary.textContent.trim().toLocaleLowerCase(locale()), two = context.textContent.trim().toLocaleLowerCase(locale());
      context.style.display = !two || one.includes(two) || two.includes(one) ? "none" : "";
    });
  }

  function renderAll() {
    if (!assets().length || !report()) return;
    renderResearchUniverse(); renderSettings(); renderSourcesView(); renderOverview(); cleanCards();
  }

  function replaceRenderers() {
    renderWatchlist = () => renderResearchUniverse();
    renderSources = () => renderSourcesView();
    renderUniverse = () => renderSettings();
    renderFocus = () => renderOverview();
  }

  function bind() {
    replaceRenderers();
    $("marketSearch")?.addEventListener("input", () => queueMicrotask(renderResearchUniverse));
    $("marketSort")?.addEventListener("change", () => queueMicrotask(renderResearchUniverse));
    $("languageToggle")?.addEventListener("click", () => setTimeout(renderAll, 0));
    window.addEventListener("hashchange", () => setTimeout(renderAll, 30));
    window.addEventListener("piyasa-market-quotes", () => setTimeout(() => { renderResearchUniverse(); renderOverview(); }, 0));
    window.addEventListener("piyasa-personal-list-change", () => setTimeout(renderAll, 0));
    window.addEventListener("pm-market-asset-change", event => window.PiyasaMarketLive?.requestAsset?.(event.detail?.asset));
    setInterval(() => { replaceRenderers(); cleanCards(); }, 30000);
  }

  function start() {
    const waiter = setInterval(() => {
      if (!window.PiyasaMarketWorkspace?.getAssets?.().length || !report()) return;
      clearInterval(waiter);
      injectStyles(); migratePersonal(); bind(); renderAll();
    }, 100);
  }

  window.PiyasaResearchIntelligence = {
    getPersonalAssets: personalAssets,
    getPersonalKeys: () => [...runtime.personal],
    refresh: renderAll,
    refreshPersonalNews,
    score: scored,
    _test: { searchAssets, researchRows, ratingMeta }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
