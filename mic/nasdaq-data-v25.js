/* MIC v25 — complete Nasdaq directory with quote snapshots and lazy daily history. */
(() => {
  if(window.__MIC_NASDAQ_DATA_V25)return;
  window.__MIC_NASDAQ_DATA_V25=true;
  const desktop=location.pathname.includes('mic-desktop');
  const base=desktop?'../mic/':'';
  const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const cleanNumber=value=>{
    if(value===null||value===undefined)return null;
    const text=String(value).trim().replace(/[$,%]/g,'').replace(/,/g,'');
    if(!text||['N/A','--','-'].includes(text.toUpperCase()))return null;
    const n=Number(text);return Number.isFinite(n)?n:null;
  };
  const assetClass=a=>a?.type==='etf'?'etf':'stocks';
  const isNasdaq=a=>String(a?.exchange||'').toUpperCase()==='NASDAQ';
  let quotePayload=null;

  function mergeQuote(asset,quote,updatedAt){
    if(!asset||!quote)return asset;
    if(valid(quote.price))asset.price=+quote.price;
    if(valid(quote.change))asset.change=+quote.change;
    if(valid(quote.volume))asset.volume=+quote.volume;
    if(valid(quote.market_cap))asset.market_cap=+quote.market_cap;
    ['sector','industry','country','ipo_year'].forEach(k=>{if(quote[k]!==null&&quote[k]!==undefined&&quote[k]!=='')asset[k]=quote[k]});
    asset.price_as_of=quote.price_as_of||updatedAt||asset.price_as_of;
    asset.quote_source=quote.source||quotePayload?.source||'Nasdaq quote snapshot';
    asset.data_coverage={...(asset.data_coverage||{}),quote_snapshot:valid(asset.price)};
    return asset;
  }

  function applyQuotes(payload){
    quotePayload=payload||{};
    const quotes=payload?.quotes||{};
    (market.assets||[]).forEach(asset=>{if(isNasdaq(asset)&&quotes[asset.symbol])mergeQuote(asset,quotes[asset.symbol],payload.updated_at)});
    if(selected&&isNasdaq(selected)&&quotes[selected.symbol])mergeQuote(selected,quotes[selected.symbol],payload.updated_at);
    renderCoverageCard();
    if(typeof runSearch==='function')runSearch();
    if(typeof renderPortfolio==='function')renderPortfolio();
    if(selected&&typeof renderSelected==='function')renderSelected();
  }

  async function loadQuoteSnapshot(){
    try{
      const r=await fetch(base+'data/nasdaq-quotes.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const payload=await r.json();applyQuotes(payload);return true;
    }catch(error){
      console.error('MIC Nasdaq quote snapshot could not be loaded',error);renderCoverageCard(error.message);return false;
    }
  }

  async function directQuote(asset){
    if(!isNasdaq(asset))return asset;
    const url=`https://api.nasdaq.com/api/quote/${encodeURIComponent(asset.symbol)}/info?assetclass=${assetClass(asset)}`;
    const r=await fetch(url,{headers:{accept:'application/json,text/plain,*/*'},cache:'no-store'});
    if(!r.ok)throw new Error('Nasdaq quote HTTP '+r.status);
    const data=(await r.json()).data||{},p=data.primaryData||{};
    const quote={price:cleanNumber(p.lastSalePrice),change:cleanNumber(p.percentageChange),volume:cleanNumber(p.volume),price_as_of:p.lastTradeTimestamp||new Date().toISOString(),source:'Nasdaq.com quote endpoint'};
    if(!valid(quote.price))throw new Error('Nasdaq fiyat döndürmedi');
    mergeQuote(asset,quote,quote.price_as_of);
    const live=(market.assets||[]).find(x=>x.symbol===asset.symbol&&x.exchange==='NASDAQ');if(live&&live!==asset)mergeQuote(live,quote,quote.price_as_of);
    return asset;
  }

  async function ensureQuote(asset){
    if(!isNasdaq(asset)||valid(asset.price))return asset;
    const q=quotePayload?.quotes?.[asset.symbol];
    if(q){mergeQuote(asset,q,quotePayload.updated_at);return asset}
    try{return await directQuote(asset)}catch(error){console.warn('MIC direct Nasdaq quote unavailable',asset.symbol,error);return asset}
  }

  function parseNasdaqDate(value){
    const text=String(value||'').trim();
    const m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m)return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null;
  }

  async function fetchDirectHistory(asset){
    const end=new Date(),start=new Date();start.setDate(start.getDate()-370);
    const fmt=d=>`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
    const qs=new URLSearchParams({assetclass:assetClass(asset),fromdate:fmt(start),todate:fmt(end),limit:'400'});
    const url=`https://api.nasdaq.com/api/quote/${encodeURIComponent(asset.symbol)}/historical?${qs}`;
    const r=await fetch(url,{headers:{accept:'application/json,text/plain,*/*'},cache:'no-store'});
    if(!r.ok)throw new Error('Nasdaq geçmiş veri HTTP '+r.status);
    const json=await r.json(),rows=json?.data?.tradesTable?.rows||[];
    const history=rows.map(row=>{
      const date=parseNasdaqDate(row.date),close=cleanNumber(row.close);
      return {date,open:cleanNumber(row.open)??close,high:cleanNumber(row.high)??close,low:cleanNumber(row.low)??close,close,volume:cleanNumber(row.volume)||0};
    }).filter(x=>x.date&&valid(x.close)).sort((a,b)=>a.date.localeCompare(b.date));
    if(history.length<2)throw new Error('Nasdaq günlük geçmişi bulunamadı');
    state.settings.historyCache[assetKey(asset)]={updatedAt:new Date().toISOString(),provider:'Nasdaq.com historical endpoint',history};
    asset.history_updated_at=new Date().toISOString();
    if(!valid(asset.price))asset.price=history.at(-1).close;
    save();return history;
  }

  if(typeof fetchHistoryFile==='function'){
    const baseFetchHistoryFile=fetchHistoryFile;
    fetchHistoryFile=async function(asset){
      try{return await baseFetchHistoryFile(asset)}
      catch(error){
        if(!isNasdaq(asset))throw error;
        try{return await fetchDirectHistory(asset)}
        catch(directError){throw new Error(`${error.message}; doğrudan Nasdaq isteği: ${directError.message}`)}
      }
    };
  }

  if(typeof analyzeAsset==='function'){
    const baseAnalyzeAsset=analyzeAsset;
    analyzeAsset=async function(asset){await ensureQuote(asset);return baseAnalyzeAsset(asset)};
  }
  if(typeof addPortfolio==='function'){
    const baseAddPortfolio=addPortfolio;
    addPortfolio=async function(asset){await ensureQuote(asset);return baseAddPortfolio(asset)};
  }
  if(typeof openChart==='function'){
    const baseOpenChart=openChart;
    openChart=async function(asset){await ensureQuote(asset);return baseOpenChart(asset)};
  }

  if(typeof renderSelected==='function'){
    const baseRenderSelected=renderSelected;
    renderSelected=function(){
      baseRenderSelected();
      if(!selected||!isNasdaq(selected))return;
      const card=document.getElementById('selectedCard');if(!card)return;
      const hasPrice=valid(selected.price),hasHistory=(cachedHistory(selected)||[]).length>=2;
      const status=hasPrice?(hasHistory?'FİYAT + GRAFİK HAZIR':'FİYAT HAZIR · GRAFİK İSTEKTE YÜKLENİR'):'NASDAQ KAYDI HAZIR · FİYAT İSTEKTE YÜKLENİR';
      card.insertAdjacentHTML('beforeend',`<div class="priceProvenance"><b>${esc(status)}</b><span>Resmî Nasdaq dizini · ${esc(selected.instrument_class||selected.subtype||label(selected.type))}</span></div>`);
    };
  }

  function renderCoverageCard(error=''){
    const settings=document.getElementById('settings');if(!settings)return;
    let card=document.getElementById('nasdaqWorkingCoverageV25');
    if(!card){card=document.createElement('div');card.id='nasdaqWorkingCoverageV25';card.className='card';const first=settings.querySelector('.card');first?first.insertAdjacentElement('beforebegin',card):settings.appendChild(card)}
    const assets=(market.assets||[]).filter(isNasdaq),priced=assets.filter(a=>valid(a.price)).length,withHistory=assets.filter(a=>(cachedHistory(a)||[]).length>=2).length;
    const updated=quotePayload?.updated_at?new Date(quotePayload.updated_at).toLocaleString('tr-TR'):'bekleniyor';
    card.innerHTML=`<div class="section"><div><h3>NASDAQ çalışma kapsamı</h3><span class="source">V25 · resmî dizin + fiyat snapshot + günlük geçmiş önbelleği</span></div><span class="badge">${assets.length.toLocaleString('tr-TR')}</span></div><div class="analysis"><div class="cell"><span>Katalog</span><strong>${assets.length.toLocaleString('tr-TR')}</strong></div><div class="cell"><span>Fiyat bulunan</span><strong>${priced.toLocaleString('tr-TR')}</strong></div><div class="cell"><span>Bu cihazda grafik</span><strong>${withHistory.toLocaleString('tr-TR')}</strong></div><div class="cell"><span>Snapshot zamanı</span><strong style="font-size:12px">${esc(updated)}</strong></div></div><p class="hint">Sembol seçildiğinde fiyat ve günlük geçmiş otomatik yüklenir. GitHub önbelleği henüz oluşmamışsa uygulama Nasdaq.com günlük veri isteğini dener. ${error?`Son hata: ${esc(error)}`:''}</p>`;
  }

  document.addEventListener('mic:asset-catalog-ready',()=>{loadQuoteSnapshot();renderCoverageCard()});
  setTimeout(()=>{loadQuoteSnapshot();renderCoverageCard()},0);
})();
