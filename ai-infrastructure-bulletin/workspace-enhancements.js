(() => {
  "use strict";

  if (window.__PM_WORKSPACE_ENHANCEMENTS__) return;
  window.__PM_WORKSPACE_ENHANCEMENTS__ = true;

  const PERSONAL_LIST_KEY = "piyasa-masasi-ai.personal-list.v1";
  const PERSONAL_LIST_MODE_KEY = "piyasa-masasi-ai.personal-list-mode.v1";
  const CHECK_TIME_KEY = "piyasa-masasi-ai.last-price-check.v1";
  const byId = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === "en" ? "en" : "tr";
  const label = (tr, en) => lang() === "en" ? en : tr;
  const normalizeSymbol = value => String(value || "").trim().toUpperCase().replace(/\.IS$/, "");

  let personalSymbols = loadPersonalSymbols();
  let listMode = localStorage.getItem(PERSONAL_LIST_MODE_KEY) === "MINE" ? "MINE" : "ALL";
  let lastCheckAt = readLastCheck();
  let checkInProgress = false;
  let freshnessUpdating = false;

  function loadPersonalSymbols() {
    try {
      const raw = JSON.parse(localStorage.getItem(PERSONAL_LIST_KEY));
      if (Array.isArray(raw)) return new Set(raw.map(normalizeSymbol).filter(Boolean));
    } catch (_) {}
    return new Set();
  }

  function savePersonalSymbols() {
    localStorage.setItem(PERSONAL_LIST_KEY, JSON.stringify([...personalSymbols].sort()));
  }

  function readLastCheck() {
    const raw = sessionStorage.getItem(CHECK_TIME_KEY);
    const value = raw ? new Date(raw) : null;
    return value && Number.isFinite(value.getTime()) ? value : null;
  }

  function setLastCheck(value = new Date()) {
    lastCheckAt = value;
    sessionStorage.setItem(CHECK_TIME_KEY, value.toISOString());
  }

  function availableItems() {
    try { return Array.isArray(state?.report?.watchlist) ? state.report.watchlist : []; }
    catch (_) { return []; }
  }

  function availableSymbols() {
    return availableItems().map(item => normalizeSymbol(item.ticker || item.provider_symbol)).filter(Boolean);
  }

  function injectStyles() {
    if (byId("pm-workspace-enhancement-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-workspace-enhancement-styles";
    style.textContent = `
      .brand{gap:13px}.brand-mark{width:48px;height:48px;border-radius:13px;background:#f4ead4;box-shadow:0 8px 24px rgba(4,22,17,.22),inset 0 0 0 1px rgba(23,58,51,.08)}
      .brand-mark svg{width:35px;height:35px;stroke-width:2;overflow:visible}.brand-mark .pm-logo-node{fill:#d18467;stroke:#173a33;stroke-width:1.5}.brand-mark .pm-logo-fill{fill:#173a33;stroke:none}
      .brand-text strong{font-size:1.02rem;letter-spacing:-.025em}.brand-text small{font-size:.61rem;letter-spacing:.12em;color:rgba(246,243,233,.68)}
      .freshness-block{display:grid;gap:3px;justify-items:end;min-width:205px}.freshness-detail{max-width:320px;color:var(--muted);font-size:.62rem;line-height:1.3;text-align:right;white-space:normal}
      .status-pill{justify-self:end}.status-pill.checking{color:#52645d;background:#e8ece5}
      .personal-list-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:rgba(255,253,248,.72)}
      .personal-list-tabs{display:flex;gap:5px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--paper-soft)}
      .personal-list-tabs button{border:0;border-radius:8px;padding:8px 11px;background:transparent;color:var(--muted);font-size:.73rem;font-weight:750}.personal-list-tabs button.active{background:var(--pine);color:#fff}
      .personal-list-add{display:flex;align-items:flex-end;gap:7px}.personal-list-add label{display:grid;gap:5px;color:var(--muted);font-size:.65rem;font-weight:700}.personal-list-add input{width:190px;min-height:38px}.personal-list-add .button{min-height:38px;padding:7px 11px}
      .watchlist-fav-col{width:48px;text-align:center!important}.watchlist-star{width:32px;height:32px;display:inline-grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:transparent;color:#9aa79f;font-size:1.05rem;line-height:1}.watchlist-star:hover{border-color:#b58838;color:#a67125;background:#fff8e8}.watchlist-star.active{border-color:#d1af65;color:#a67125;background:#fff2cf}
      .personal-list-settings{grid-column:1/-1}.personal-list-settings .personal-list-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}.personal-list-settings .personal-list-add{margin-top:4px}.personal-list-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.personal-list-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 8px 7px 11px;border:1px solid var(--line);border-radius:999px;background:var(--paper-soft);font-size:.75rem;font-weight:750}.personal-list-chip button{width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(23,58,51,.08);color:var(--pine);font-size:.9rem}.personal-list-empty{margin:16px 0 0;color:var(--muted);font-size:.76rem}
      .research-card .summary-line{line-height:1.62;margin:0}.research-context{margin:12px 0 16px!important;padding-top:10px;border-top:1px solid var(--line);font-size:.75rem!important;line-height:1.58!important}.research-context.pm-duplicate{display:none!important}
      @media(max-width:980px){.freshness-block{justify-items:start;min-width:0}.freshness-detail{text-align:left}.personal-list-toolbar{align-items:stretch;flex-direction:column}.personal-list-add{align-items:stretch}.personal-list-add label{flex:1}.personal-list-add input{width:100%}}
      @media(max-width:640px){.personal-list-add{flex-direction:column}.personal-list-toolbar{padding:10px}.personal-list-tabs{width:100%}.personal-list-tabs button{flex:1}.freshness-detail{max-width:250px}}
    `;
    document.head.appendChild(style);
  }

  function updateBrand() {
    const mark = document.querySelector(".brand-mark");
    const text = document.querySelector(".brand-text");
    if (mark) {
      mark.innerHTML = `
        <svg viewBox="0 0 48 48" role="img" aria-label="Piyasa Masası AI">
          <path d="M9 37.5h30"/>
          <path d="M13 33V24m8 9V18m8 15V22m8 11V13"/>
          <path d="M11.5 29.5 20 23l8 3 9-10"/>
          <circle class="pm-logo-node" cx="37" cy="16" r="3"/>
          <path class="pm-logo-fill" d="M10 39h28v2H10z"/>
        </svg>`;
    }
    if (text) text.innerHTML = `<strong>Piyasa Masası AI</strong><small>MARKET INTELLIGENCE</small>`;
    const brand = document.querySelector(".brand");
    if (brand) brand.setAttribute("aria-label", label("Piyasa Masası AI ana sayfa", "Piyasa Masası AI home"));
  }

  function ensureFreshnessBlock() {
    const pill = byId("freshness");
    if (!pill) return null;
    let block = pill.closest(".freshness-block");
    if (!block) {
      block = document.createElement("div");
      block.className = "freshness-block";
      pill.before(block);
      block.appendChild(pill);
      const detail = document.createElement("span");
      detail.id = "freshnessDetail";
      detail.className = "freshness-detail";
      detail.setAttribute("aria-live", "polite");
      block.appendChild(detail);
    }
    return block;
  }

  function formatCheckDate(value) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(lang() === "en" ? "en-GB" : "tr-TR", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat"
      }).format(value);
    } catch (_) { return value.toLocaleString(); }
  }

  function ageLabel(minutes) {
    if (!Number.isFinite(minutes)) return label("yaş hesaplanamadı", "age unavailable");
    const rounded = Math.max(0, Math.round(minutes));
    if (rounded < 1) return label("az önce", "just now");
    if (rounded < 60) return label(`${rounded} dk önce`, `${rounded} min ago`);
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return label(`${hours} sa ${rest} dk önce`, `${hours}h ${rest}m ago`);
  }

  function updateFreshness() {
    if (freshnessUpdating) return;
    const pill = byId("freshness");
    if (!pill) return;
    ensureFreshnessBlock();
    freshnessUpdating = true;
    try {
      const detail = byId("freshnessDetail");
      if (checkInProgress) {
        pill.textContent = label("Fiyat dosyası kontrol ediliyor", "Checking price file");
        pill.className = "status-pill checking";
        if (detail) detail.textContent = label("En son yayımlanan veri yeniden okunuyor.", "Re-reading the latest published data.");
        return;
      }

      let report = null;
      try { report = state?.report?.report || null; } catch (_) {}
      if (!report) return;
      if (!lastCheckAt) setLastCheck(new Date());
      const rawPriceTime = report.market_data_as_of || report.generated_at;
      const priceTime = rawPriceTime ? new Date(rawPriceTime) : null;
      const ageMinutes = priceTime && Number.isFinite(priceTime.getTime()) ? (Date.now() - priceTime.getTime()) / 60000 : Infinity;
      const fresh = ageMinutes <= 30;
      const age = ageLabel(ageMinutes);
      pill.textContent = fresh
        ? label("Kontrol tamamlandı · fiyat güncel", "Check complete · price current")
        : label(`Kontrol tamamlandı · fiyat ${age}`, `Check complete · price ${age}`);
      pill.className = `status-pill ${fresh ? "positive" : "warning"}`;
      const detailText = label(
        `Son kontrol: ${formatCheckDate(lastCheckAt)} · Fiyat zamanı: ${formatCheckDate(priceTime)}`,
        `Last check: ${formatCheckDate(lastCheckAt)} · Price time: ${formatCheckDate(priceTime)}`
      );
      if (detail) detail.textContent = detailText;
      pill.title = detailText;
      pill.setAttribute("aria-label", detailText);
    } finally {
      freshnessUpdating = false;
    }
  }

  function normalizeText(value) {
    return String(value || "").toLocaleLowerCase(lang() === "en" ? "en" : "tr")
      .replace(/[^a-z0-9çğıöşü\s]/gi, " ").replace(/\s+/g, " ").trim();
  }

  function similarity(a, b) {
    const one = new Set(normalizeText(a).split(" ").filter(word => word.length > 3));
    const two = new Set(normalizeText(b).split(" ").filter(word => word.length > 3));
    if (!one.size || !two.size) return 0;
    let common = 0;
    one.forEach(word => { if (two.has(word)) common += 1; });
    return common / Math.min(one.size, two.size);
  }

  function cleanEvaluationCards() {
    document.querySelectorAll(".research-card-body").forEach(card => {
      const summary = card.querySelector(".summary-line");
      const context = card.querySelector(".research-context");
      if (!summary || !context) return;
      const one = normalizeText(summary.textContent);
      const two = normalizeText(context.textContent);
      const duplicate = !two || one.includes(two) || two.includes(one) || similarity(one, two) >= .72;
      context.classList.toggle("pm-duplicate", duplicate);
    });
  }

  function ensureWatchlistHeader() {
    const row = document.querySelector("#watchlistView table thead tr");
    if (!row || row.querySelector(".watchlist-fav-col")) return;
    const th = document.createElement("th");
    th.className = "watchlist-fav-col";
    th.textContent = "★";
    th.title = label("Kişisel liste", "Personal list");
    row.prepend(th);
  }

  function ensurePersonalToolbar() {
    const wrap = document.querySelector("#watchlistView .market-table-wrap");
    if (!wrap) return null;
    let toolbar = byId("personalListToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "personalListToolbar";
      toolbar.className = "personal-list-toolbar";
      wrap.before(toolbar);
    }
    return toolbar;
  }

  function renderPersonalToolbar() {
    const toolbar = ensurePersonalToolbar();
    if (!toolbar) return;
    const count = personalSymbols.size;
    toolbar.innerHTML = `
      <div class="personal-list-tabs" role="group" aria-label="${label("Liste görünümü", "List view")}">
        <button type="button" data-list-mode="ALL" class="${listMode === "ALL" ? "active" : ""}">${label("Tüm varlıklar", "All assets")}</button>
        <button type="button" data-list-mode="MINE" class="${listMode === "MINE" ? "active" : ""}">${label("Listem", "My list")} (${count})</button>
      </div>
      <div class="personal-list-add">
        <label>${label("Listeme sembol ekle", "Add symbol to my list")}
          <input id="personalListSymbol" list="personalListOptions" autocomplete="off" placeholder="AMD / THYAO">
          <datalist id="personalListOptions">${availableItems().map(item => `<option value="${String(item.ticker || item.provider_symbol || "").replace(/"/g, "&quot;")}">${String(item.company || "").replace(/</g, "&lt;")}</option>`).join("")}</datalist>
        </label>
        <button id="personalListAddButton" class="button" type="button">${label("Ekle", "Add")}</button>
      </div>`;
    toolbar.querySelectorAll("[data-list-mode]").forEach(button => button.onclick = () => {
      listMode = button.dataset.listMode === "MINE" ? "MINE" : "ALL";
      localStorage.setItem(PERSONAL_LIST_MODE_KEY, listMode);
      rerenderWatchlist();
    });
    byId("personalListAddButton")?.addEventListener("click", addFromInput);
    byId("personalListSymbol")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); addFromInput(); }
    });
  }

  function addFromInput() {
    const input = byId("personalListSymbol");
    const symbol = normalizeSymbol(input?.value);
    if (!symbol) return;
    const allowed = new Set(availableSymbols());
    if (!allowed.has(symbol)) {
      if (typeof showToast === "function") showToast(label("Bu sembol mevcut araştırma evreninde bulunmuyor.", "This symbol is not in the current research universe."));
      return;
    }
    personalSymbols.add(symbol);
    savePersonalSymbols();
    if (input) input.value = "";
    renderPersonalToolbar();
    renderPersonalSettings();
    rerenderWatchlist();
  }

  function togglePersonalSymbol(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    if (personalSymbols.has(normalized)) personalSymbols.delete(normalized);
    else personalSymbols.add(normalized);
    savePersonalSymbols();
    renderPersonalToolbar();
    renderPersonalSettings();
    rerenderWatchlist();
  }

  function decorateWatchlistRows() {
    ensureWatchlistHeader();
    const body = byId("watchlistBody");
    if (!body) return;
    const rows = body.querySelectorAll("tr[data-ticker]");
    rows.forEach(row => {
      const symbol = normalizeSymbol(row.dataset.ticker);
      let cell = row.querySelector(".watchlist-fav-col");
      if (!cell) {
        cell = document.createElement("td");
        cell.className = "watchlist-fav-col";
        row.prepend(cell);
      }
      const active = personalSymbols.has(symbol);
      cell.innerHTML = `<button class="watchlist-star ${active ? "active" : ""}" type="button" aria-pressed="${active}" title="${active ? label("Listemden çıkar", "Remove from my list") : label("Listeme ekle", "Add to my list")}">★</button>`;
      cell.querySelector("button").onclick = event => { event.preventDefault(); event.stopPropagation(); togglePersonalSymbol(symbol); };
    });
    const empty = body.querySelector("tr:not([data-ticker]) td");
    if (empty) {
      empty.colSpan = 9;
      if (listMode === "MINE" && personalSymbols.size === 0) empty.textContent = label("Listeniz boş. Tüm varlıklardan yıldızla ekleyin.", "Your list is empty. Add assets with the star button.");
    }
  }

  function ensurePersonalSettingsPanel() {
    const grid = document.querySelector("#settingsView .settings-grid");
    if (!grid) return null;
    let panel = byId("personalListSettings");
    if (!panel) {
      panel = document.createElement("article");
      panel.id = "personalListSettings";
      panel.className = "settings-panel personal-list-settings";
      grid.prepend(panel);
    }
    return panel;
  }

  function renderPersonalSettings() {
    const panel = ensurePersonalSettingsPanel();
    if (!panel) return;
    const chips = [...personalSymbols].sort().map(symbol => `
      <span class="personal-list-chip">${symbol}<button type="button" data-remove-personal="${symbol}" aria-label="${label(`${symbol} listeden çıkar`, `Remove ${symbol} from list`)}">×</button></span>`).join("");
    panel.innerHTML = `
      <div class="personal-list-settings-head">
        <div><p class="eyebrow">${label("KİŞİSEL LİSTEM", "MY PERSONAL LIST")}</p><h2>${label("İzlemek istediğiniz varlıkları seçin", "Choose the assets you want to follow")}</h2><p class="muted">${label("Liste yalnız bu tarayıcıda saklanır. Merkezi araştırma evrenini değiştirmez.", "The list is stored only in this browser. It does not change the central research universe.")}</p></div>
        <button id="openMyList" class="button" type="button">${label("Listemi aç", "Open my list")} (${personalSymbols.size})</button>
      </div>
      ${chips ? `<div class="personal-list-chips">${chips}</div>` : `<p class="personal-list-empty">${label("Henüz varlık eklenmedi. Araştırma Evreni tablosundaki yıldızları kullanın.", "No assets added yet. Use the stars in the Research Universe table.")}</p>`}`;
    panel.querySelectorAll("[data-remove-personal]").forEach(button => button.onclick = () => togglePersonalSymbol(button.dataset.removePersonal));
    byId("openMyList")?.addEventListener("click", () => {
      listMode = "MINE";
      localStorage.setItem(PERSONAL_LIST_MODE_KEY, listMode);
      if (typeof navigate === "function") navigate("watchlist");
      setTimeout(rerenderWatchlist, 60);
    });
  }

  function rerenderWatchlist() {
    renderPersonalToolbar();
    renderPersonalSettings();
    try {
      if (state?.report && typeof renderWatchlist === "function") renderWatchlist(state.report.watchlist || [], state.report.company_evaluations || []);
    } catch (_) {}
  }

  function installFunctionGuards() {
    if (typeof renderWatchlist === "function" && !renderWatchlist.__personalListWrapped) {
      const originalWatchlist = renderWatchlist;
      const wrapped = function (items, evaluations) {
        const input = Array.isArray(items) ? items : [];
        const visible = listMode === "MINE" ? input.filter(item => personalSymbols.has(normalizeSymbol(item.ticker || item.provider_symbol))) : input;
        const result = originalWatchlist.call(this, visible, evaluations);
        renderPersonalToolbar();
        decorateWatchlistRows();
        return result;
      };
      wrapped.__personalListWrapped = true;
      renderWatchlist = wrapped;
    }

    if (typeof renderEvaluations === "function" && !renderEvaluations.__spacingWrapped) {
      const originalEvaluations = renderEvaluations;
      const wrapped = function (...args) {
        const result = originalEvaluations.apply(this, args);
        cleanEvaluationCards();
        return result;
      };
      wrapped.__spacingWrapped = true;
      renderEvaluations = wrapped;
    }

    if (typeof render === "function" && !render.__freshnessWrapped) {
      const originalRender = render;
      const wrapped = function (...args) {
        const result = originalRender.apply(this, args);
        queueMicrotask(() => { updateFreshness(); renderPersonalToolbar(); renderPersonalSettings(); cleanEvaluationCards(); decorateWatchlistRows(); });
        return result;
      };
      wrapped.__freshnessWrapped = true;
      render = wrapped;
    }

    if (typeof load === "function" && !load.__checkWrapped) {
      const originalLoad = load;
      const wrapped = async function (...args) {
        checkInProgress = true;
        updateFreshness();
        try { return await originalLoad.apply(this, args); }
        finally {
          checkInProgress = false;
          setLastCheck(new Date());
          updateFreshness();
        }
      };
      wrapped.__checkWrapped = true;
      load = wrapped;
    }

    if (typeof applyLanguage === "function" && !applyLanguage.__enhancementWrapped) {
      const originalLanguage = applyLanguage;
      const wrapped = function (...args) {
        const result = originalLanguage.apply(this, args);
        queueMicrotask(() => { updateBrand(); updateFreshness(); renderPersonalToolbar(); renderPersonalSettings(); cleanEvaluationCards(); decorateWatchlistRows(); });
        return result;
      };
      wrapped.__enhancementWrapped = true;
      applyLanguage = wrapped;
    }
  }

  function start() {
    injectStyles();
    updateBrand();
    ensureFreshnessBlock();
    installFunctionGuards();
    renderPersonalToolbar();
    renderPersonalSettings();
    cleanEvaluationCards();
    decorateWatchlistRows();
    updateFreshness();

    setInterval(() => {
      installFunctionGuards();
      updateFreshness();
    }, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
