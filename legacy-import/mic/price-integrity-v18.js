/* MIC v18 price integrity layer
 * Makes data freshness and price provenance explicit.
 * MIC is not a broker connection and must not present periodic snapshots as live prices.
 */
(() => {
  if (window.__MIC_PRICE_INTEGRITY_V18) return;
  window.__MIC_PRICE_INTEGRITY_V18 = true;

  const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const parseDate=v=>{const d=v?new Date(v):null;return d&&!Number.isNaN(d.getTime())?d:null};
  const marketDate=()=>parseDate(market?.updated_at);
  const ageMinutes=d=>d?Math.max(0,Math.round((Date.now()-d.getTime())/60000)):null;
  const formatDate=d=>d?d.toLocaleString('tr-TR'):'zaman bilgisi yok';
  const freshnessLabel=(d,explicitDateOnly=false)=>{
    if(!d)return {text:'ZAMAN BİLGİSİ YOK',cls:'warn',detail:'Kaynak zamanı doğrulanamadı'};
    if(explicitDateOnly)return {text:'GÜN SONU / SNAPSHOT',cls:'warn',detail:formatDate(d)};
    const mins=ageMinutes(d);
    if(mins<=5)return {text:'YAKIN ZAMANLI SNAPSHOT',cls:'',detail:`${formatDate(d)} · ${mins} dk önce`};
    if(mins<=30)return {text:'GECİKMELİ SNAPSHOT',cls:'warn',detail:`${formatDate(d)} · ${mins} dk önce`};
    return {text:'ESKİ SNAPSHOT',cls:'warn',detail:`${formatDate(d)} · ${mins} dk önce`};
  };

  function assetPriceMeta(p){
    const live=(market?.assets||[]).find(x=>x.symbol===p.symbol&&x.type===p.type);
    if(live&&valid(live.price)){
      const explicit=live.price_as_of||live.history_updated_at;
      const asOf=parseDate(explicit||market?.updated_at);
      const dateOnly=!!explicit&&!String(explicit).includes('T');
      return {asset:{...p,...live},price:+live.price,source:live.official_source?'Tamamlayıcı fon kataloğu':'MIC periyodik piyasa akışı',asOf,dateOnly,status:'SNAPSHOT',estimated:false};
    }
    if(valid(p.currentPrice)){
      return {asset:p,price:+p.currentPrice,source:'Tarayıcıda daha önce kaydedilmiş fiyat',asOf:parseDate(p.currentPriceAsOf),dateOnly:false,status:'STORED',estimated:true};
    }
    return {asset:p,price:null,source:'Güncel fiyat bulunamadı',asOf:null,dateOnly:false,status:'MISSING',estimated:true};
  }

  // Replace silent average-cost fallback. Average cost is never a market price.
  portfolioStats=function(){
    const rows=state.portfolio.map(p=>{
      const meta=assetPriceMeta(p),a=meta.asset,currency=a.currency||p.currency||'TRY';
      const quantity=+p.quantity||0,price=meta.price;
      const valueTRY=valid(price)?price*quantity*fxRate(currency):0;
      return {...p,...a,quantity,price,valueTRY,priceSource:meta.source,priceAsOf:meta.asOf,priceDateOnly:meta.dateOnly,priceStatus:meta.status,priceEstimated:meta.estimated,priceAvailable:valid(price)};
    });
    const total=rows.reduce((s,x)=>s+x.valueTRY,0),missing=rows.filter(x=>!x.priceAvailable).length,estimated=rows.filter(x=>x.priceEstimated&&x.priceAvailable).length;
    rows.forEach(x=>x.weight=total&&x.priceAvailable?x.valueTRY/total*100:0);
    return {rows,total,missing,estimated,allMarketPriced:missing===0&&estimated===0};
  };

  function ensurePortfolioNotice(){
    const panel=document.getElementById('realPortfolioPanel');
    if(!panel)return null;
    let box=document.getElementById('portfolioPriceNoticeV18');
    if(box)return box;
    box=document.createElement('div');
    box.id='portfolioPriceNoticeV18';box.className='card portfolioPriceNoticeV18';
    panel.insertAdjacentElement('afterbegin',box);
    return box;
  }

  function renderPriceNotice(ps){
    const box=ensurePortfolioNotice();if(!box)return;
    const d=marketDate(),f=freshnessLabel(d),flags=[];
    if(ps.estimated)flags.push(`${ps.estimated} pozisyon eski kaydedilmiş fiyat kullanıyor`);
    if(ps.missing)flags.push(`${ps.missing} pozisyonda fiyat yok`);
    box.innerHTML=`<div class="priceNoticeTop"><div><b>Broker bağlantısı yok · ${f.text}</b><span>${esc(f.detail)}</span></div><span class="priceStatusBadge ${f.cls}">ANLIK DEĞİL</span></div>
      <p>MIC, Osmanlı Menkul hesabına bağlı değildir. Adet ve ortalama maliyet tarayıcıdaki portföy kaydından; fiyatlar GitHub üzerinde periyodik yenilenen piyasa snapshot’ından gelir.</p>
      ${flags.length?`<div class="priceWarning">${flags.map(esc).join(' · ')}. Bu nedenle toplam değer tahmini olabilir.</div>`:'<div class="priceInfo">Tüm pozisyonlarda piyasa snapshot fiyatı bulundu; yine de değerler broker terminalindeki anlık fiyatlarla birebir eşleşmeyebilir.</div>'}`;
  }

  renderPortfolio=function(){
    const ps=portfolioStats();
    $('totalValue').textContent=money(ps.total,'TRY');$('positionCount').textContent=ps.rows.length;
    renderPriceNotice(ps);
    const box=$('portfolioList');
    if(!ps.rows.length){box.innerHTML='<div class="card empty">Portföy boş. Araştırma ekranından varlık ekle.</div>';return}
    box.innerHTML=ps.rows.map((p,i)=>{
      const pnl=p.priceAvailable?(p.price-p.avgCost)*p.quantity*fxRate(p.currency):null;
      const s=scoreAsset(p),d=decision(p,s),f=freshnessLabel(p.priceAsOf,p.priceDateOnly);
      const priceText=p.priceAvailable?money(p.price,p.currency):'Fiyat yok';
      return `<div class="portfolioItem"><div class="assetTop"><div><div class="symbol">${esc(p.symbol)}</div><div class="assetName">${esc(p.name)}</div></div><span class="badge">%${num(p.weight)}</span></div>
        <div class="small"><div><span>Adet</span><strong>${num(p.quantity,6)}</strong></div><div><span>Fiyat</span><strong>${priceText}</strong></div><div><span>Açık K/Z</span><strong class="${pnl===null?'':pnl>=0?'positive':'negative'}">${pnl===null?'Hesaplanamadı':money(pnl,'TRY')}</strong></div></div>
        <div class="priceProvenance ${p.priceEstimated?'estimated':''}"><b>${esc(p.priceSource)}</b><span>${esc(f.detail)} · ${p.priceEstimated?'anlık piyasa fiyatı değil':'piyasa snapshot fiyatı'}</span></div>
        <div class="hint"><b>${esc(d.action)}</b> · ${esc(d.summary)}</div><div class="portfolioBtns"><button data-a="analyze" data-i="${i}">Analiz</button><button data-a="chart" data-i="${i}">Grafik</button><button data-a="delete" data-i="${i}">Sil</button></div></div>`;
    }).join('');
  };

  function updateTopStatus(){
    const el=document.getElementById('dataStatus');if(!el)return;
    const f=freshnessLabel(marketDate());el.textContent=f.text;el.className=`pill ${f.cls}`.trim();el.title=f.detail;
    const ft=document.getElementById('feedTime');if(ft)ft.textContent=`Veri zamanı: ${f.detail}`;
  }

  const baseLoadMarket=loadMarket;
  loadMarket=async function(){const ok=await baseLoadMarket();updateTopStatus();renderPortfolio();return ok};

  // Add source/time explanation to selected assets and analyses.
  const baseRenderSelected=renderSelected;
  renderSelected=function(){
    baseRenderSelected();
    if(!selected)return;
    const meta=assetPriceMeta(selected),f=freshnessLabel(meta.asOf,meta.dateOnly),card=document.getElementById('selectedCard');
    if(card)card.insertAdjacentHTML('beforeend',`<div class="priceProvenance ${meta.estimated?'estimated':''}"><b>${esc(meta.source)}</b><span>${esc(f.detail)} · anlık broker verisi değildir</span></div>`);
  };

  updateTopStatus();
  setTimeout(()=>{updateTopStatus();renderPortfolio();},250);
})();
