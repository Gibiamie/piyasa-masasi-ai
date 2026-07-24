(() => {
  'use strict';
  if (window.__MIC_FAKEOUT_V28) return;
  window.__MIC_FAKEOUT_V28 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = value => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})
    : '—';
  let active = false;
  let requestId = 0;

  function atr(rows, index, period = 14) {
    const values = [];
    for (let i = Math.max(1, index - period + 1); i <= index; i += 1) {
      const current = rows[i];
      const previous = rows[i - 1];
      values.push(Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      ));
    }
    return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  }

  function normalise(history) {
    return (history || []).map(row => ({
      date: row.date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume) || 0
    })).filter(row => row.date && [row.open, row.high, row.low, row.close].every(Number.isFinite));
  }

  function scanFakeouts(rows) {
    const candidates = [];
    const lookback = 20;
    for (let i = lookback; i < rows.length; i += 1) {
      const previous = rows.slice(i - lookback, i);
      const resistance = Math.max(...previous.map(row => row.high));
      const support = Math.min(...previous.map(row => row.low));
      const sweep = rows[i];
      const volatility = atr(rows, i);
      const buffer = volatility * 0.05;
      const bearish = sweep.high > resistance + buffer && sweep.close < resistance && sweep.close > support;
      const bullish = sweep.low < support - buffer && sweep.close > support && sweep.close < resistance;
      if (!bearish && !bullish) continue;

      const direction = bearish ? 'bearish' : 'bullish';
      const candidate = {
        direction,
        resistance,
        support,
        volatility,
        sweepIndex: i,
        sweepDate: sweep.date,
        breakIndex: null,
        retestIndex: null,
        invalidated: false,
        stage: 1
      };

      const breakLimit = Math.min(rows.length - 1, i + 7);
      for (let j = i + 1; j <= breakLimit; j += 1) {
        const breakBuffer = atr(rows, j) * 0.05;
        const confirmed = direction === 'bearish'
          ? rows[j].close < support - breakBuffer
          : rows[j].close > resistance + breakBuffer;
        if (confirmed) {
          candidate.breakIndex = j;
          candidate.stage = 2;
          break;
        }
      }

      if (candidate.breakIndex !== null) {
        const retestLimit = Math.min(rows.length - 1, candidate.breakIndex + 7);
        for (let k = candidate.breakIndex + 1; k <= retestLimit; k += 1) {
          const tolerance = atr(rows, k) * 0.20;
          const confirmed = direction === 'bearish'
            ? rows[k].high >= support - tolerance && rows[k].close < support
            : rows[k].low <= resistance + tolerance && rows[k].close > resistance;
          if (confirmed) {
            candidate.retestIndex = k;
            candidate.stage = 3;
            break;
          }
        }
      }

      if (candidate.retestIndex !== null) {
        const invalidationLevel = direction === 'bearish'
          ? support + candidate.volatility * 0.10
          : resistance - candidate.volatility * 0.10;
        candidate.invalidated = rows.slice(candidate.retestIndex + 1).some(row =>
          direction === 'bearish' ? row.close > invalidationLevel : row.close < invalidationLevel
        );
      }
      candidates.push(candidate);
    }
    return candidates.reverse();
  }

  function stageText(candidate) {
    if (!candidate) return 'Aktif sahte kırılım adayı bulunamadı';
    if (candidate.invalidated) return 'Kurulum daha sonra geçersiz oldu';
    if (candidate.stage === 3) return 'Kontrollü retest kurulumu oluştu';
    if (candidate.stage === 2) return 'Karşı sınır kırıldı, retest bekleniyor';
    return 'Likidite süpürüldü, karşı sınır kırılımı bekleniyor';
  }

  function directionText(direction) {
    return direction === 'bearish' ? 'Yukarı sahte kırılım → düşüş senaryosu' : 'Aşağı sahte kırılım → yükseliş senaryosu';
  }

  function statusClass(candidate) {
    if (!candidate || candidate.invalidated) return '';
    return candidate.stage === 3 ? 'good' : 'warn';
  }

  function chart(rows, candidate) {
    const end = candidate ? Math.min(rows.length, (candidate.retestIndex ?? candidate.breakIndex ?? candidate.sweepIndex) + 12) : rows.length;
    const start = Math.max(0, end - 55);
    const data = rows.slice(start, end);
    if (!data.length) return '';
    const low = Math.min(...data.map(row => row.low));
    const high = Math.max(...data.map(row => row.high));
    const width = 720;
    const height = 250;
    const x = index => 22 + index * (width - 44) / Math.max(1, data.length - 1);
    const y = price => 18 + (high - price) / Math.max(0.000001, high - low) * (height - 38);
    const indexInView = index => index === null ? -1 : index - start;
    const marker = (index, label, cssClass) => {
      const local = indexInView(index);
      if (local < 0 || local >= data.length) return '';
      return `<g class="${cssClass}"><circle cx="${x(local)}" cy="${Math.max(16, y(data[local].high) - 9)}" r="5"/><text x="${x(local)}" y="${Math.max(11, y(data[local].high) - 18)}" text-anchor="middle">${label}</text></g>`;
    };
    const candles = data.map((row, index) => {
      const up = row.close >= row.open;
      const top = y(Math.max(row.open, row.close));
      const bottom = y(Math.min(row.open, row.close));
      return `<g class="${up ? 'u' : 'd'}"><line x1="${x(index)}" x2="${x(index)}" y1="${y(row.high)}" y2="${y(row.low)}"/><rect x="${x(index) - 3}" y="${top}" width="6" height="${Math.max(2, bottom - top)}"/></g>`;
    }).join('');
    const levels = candidate ? `
      <line class="res" x1="18" x2="702" y1="${y(candidate.resistance)}" y2="${y(candidate.resistance)}"/>
      <text class="level" x="697" y="${y(candidate.resistance) - 5}" text-anchor="end">Direnç ${fmt(candidate.resistance)}</text>
      <line class="sup" x1="18" x2="702" y1="${y(candidate.support)}" y2="${y(candidate.support)}"/>
      <text class="level" x="697" y="${y(candidate.support) - 5}" text-anchor="end">Destek ${fmt(candidate.support)}</text>` : '';
    return `<svg class="fo28chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sahte kırılım grafiği">${levels}${candles}${candidate ? marker(candidate.sweepIndex, 'Süpürme', 'sweep') : ''}${candidate ? marker(candidate.breakIndex, 'Kırılım', 'break') : ''}${candidate ? marker(candidate.retestIndex, 'Retest', 'retest') : ''}</svg>`;
  }

  function flowHtml(candidate) {
    const stage = candidate?.stage || 0;
    const items = [
      ['1', 'Likidite süpürmesi', 'Fiyat range dışına taşar fakat kapanışla içeride kalır.'],
      ['2', 'Karşı sınır kırılımı', 'Sadece geri dönüş değil, desteğin/direncin kapanışla kırılması beklenir.'],
      ['3', 'Retest ve reddetme', 'Kırılan sınır yeniden test edilir ve fiyat tekrar beklenen yönde kapanır.']
    ];
    return `<div class="fo28flow">${items.map((item, index) => `<div class="${stage > index ? 'done' : stage === index ? 'current' : ''}"><b>${item[0]}</b><span><strong>${item[1]}</strong><small>${item[2]}</small></span></div>`).join('')}</div>`;
  }

  function renderResult(symbol, rows) {
    const content = $('tm27content');
    if (!content || !active) return;
    const candidates = scanFakeouts(rows);
    const candidate = candidates[0] || null;
    const riskLevel = candidate
      ? (candidate.direction === 'bearish' ? candidate.resistance : candidate.support)
      : null;
    const controlledLevel = candidate
      ? (candidate.direction === 'bearish' ? candidate.support : candidate.resistance)
      : null;
    content.innerHTML = `<div class="fo28">
      <div class="tm27note"><b>Doğruluk notu:</b> Günlük OHLCV verisiyle aday taraması yapılır. Gerçek işlem kurulumu için 5/15 dakikalık intraday veri ve seans yapısı gerekir.</div>
      <div class="card fo28hero">
        <div><span class="source">${esc(symbol)} · Sahte Kırılım / Likidite Süpürmesi</span><h2>${esc(stageText(candidate))}</h2><p>${candidate ? esc(directionText(candidate.direction)) : 'Son 120 günlük bölümde kuralları karşılayan güncel aday yok.'}</p></div>
        <span class="fo28state ${statusClass(candidate)}">${candidate ? `${candidate.stage}/3 aşama` : '0/3'}</span>
      </div>
      ${flowHtml(candidate)}
      ${candidate ? `<div class="grid4 fo28metrics">
        <div class="card metric"><span>Direnç</span><strong>${fmt(candidate.resistance)}</strong></div>
        <div class="card metric"><span>Destek</span><strong>${fmt(candidate.support)}</strong></div>
        <div class="card metric"><span>Süpürme</span><strong>${esc(candidate.sweepDate)}</strong></div>
        <div class="card metric"><span>Durum</span><strong>${candidate.invalidated ? 'Geçersiz' : candidate.stage === 3 ? 'Retest var' : 'Bekle'}</strong></div>
      </div>` : ''}
      <div class="grid2 fo28entries">
        <div class="card risky"><span>Riskli erken giriş</span><h3>${candidate ? fmt(riskLevel) : 'Range içine ilk dönüş'}</h3><p>Sadece likidite süpürmesi sonrası hemen giriş. Karşı sınır henüz kırılmadığı için sahte sinyal ve stop riski yüksektir.</p></div>
        <div class="card controlled"><span>Daha kontrollü giriş</span><h3>${candidate ? fmt(controlledLevel) : 'Karşı sınır retesti'}</h3><p>Karşı sınır kapanışla kırılır, fiyat geri test eder ve reddetme kapanışı oluşur. Bu da garanti değildir; yalnızca teyit seviyesini yükseltir.</p></div>
      </div>
      <div class="card">${chart(rows, candidate)}</div>
      <div class="tm27disc">MIC bu yöntemde “güvenli giriş” ifadesini kullanmaz. Her kurulum zarar edebilir; tek fitil veya ilk geri dönüş bağımsız işlem sinyali değildir.</div>
    </div>`;
  }

  async function loadAndRender() {
    const symbol = $('tm27sym')?.value || 'THYAO';
    const content = $('tm27content');
    if (!content) return;
    const currentRequest = ++requestId;
    content.innerHTML = '<div class="card empty">Sahte kırılım verisi taranıyor…</div>';
    try {
      const response = await fetch(`data/history/${encodeURIComponent(symbol)}.json?t=${Date.now()}`, {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.history)) throw new Error('Geçmiş veri yok');
      if (currentRequest !== requestId || !active) return;
      renderResult(symbol, normalise(data.history).slice(-180));
    } catch (error) {
      if (currentRequest !== requestId || !active) return;
      content.innerHTML = `<div class="card empty">${esc(symbol)} için sahte kırılım taraması yapılamadı: ${esc(error.message)}</div>`;
    }
  }

  function openFakeout() {
    active = true;
    document.querySelectorAll('[data-tm27]').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('[data-fo28]').forEach(button => button.classList.add('active'));
    loadAndRender();
  }

  function ensureHomeCard() {
    const grid = document.querySelector('#tm27content .tm27grid');
    if (!grid || grid.querySelector('[data-fo28-home]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.fo28Home = '1';
    button.innerHTML = '<b>⇄</b><strong>Sahte Kırılım</strong><small>Likidite süpürmesi + karşı sınır retesti</small><span class="tm27badge w">Günlük önizleme</span>';
    button.addEventListener('click', openFakeout);
    grid.appendChild(button);
  }

  function install() {
    const section = $('methods');
    const tabs = section?.querySelector('.tm27tabs');
    if (!section || !tabs) {
      setTimeout(install, 120);
      return;
    }
    if (!tabs.querySelector('[data-fo28]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.fo28 = 'fakeout';
      button.textContent = 'Sahte Kırılım';
      button.addEventListener('click', openFakeout);
      tabs.appendChild(button);
    }
    const observer = new MutationObserver(() => {
      ensureHomeCard();
      if (active && !$('tm27content')?.querySelector('.fo28')) setTimeout(loadAndRender, 0);
    });
    observer.observe($('tm27content'), {childList: true, subtree: false});
    $('tm27sym')?.addEventListener('change', () => {
      if (active) setTimeout(loadAndRender, 0);
    });
    $('tm27refresh')?.addEventListener('click', () => {
      if (active) setTimeout(loadAndRender, 0);
    });
    section.addEventListener('click', event => {
      if (event.target.closest('[data-tm27],[data-go]')) {
        active = false;
        document.querySelectorAll('[data-fo28]').forEach(button => button.classList.remove('active'));
      }
    });
    ensureHomeCard();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', install, {once: true})
    : install();
})();
