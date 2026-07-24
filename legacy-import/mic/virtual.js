const VIRTUAL_INITIAL_USD=100000;
state.virtualPortfolio=state.virtualPortfolio||null;
state.ui={portfolioMode:'real',...(state.ui||{})};

function usd(value){return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0)}
function latestVirtualAsset(position){return market.assets.find(a=>a.symbol===position.symbol&&a.type===position.type)||position}
function priceInUSD(asset){
  const price=Number(asset.price||asset.currentPrice||0);
  if(!(price>0))return 0;
  const currency=String(asset.currency||'USD').toUpperCase();
  const usdtry=Number(market.fx?.USDTRY)||40;
  const eurtry=Number(market.fx?.EURTRY)||44;
  if(currency==='USD')return price;
  if(currency==='TRY')return price/usdtry;
  if(currency==='EUR')return price*eurtry/usdtry;
  return price;
}
function virtualStarted(){return !!state.virtualPortfolio}
function createVirtualPortfolio(){
  if(!state.virtualPortfolio){
    state.virtualPortfolio={initialCash:VIRTUAL_INITIAL_USD,cash:VIRTUAL_INITIAL_USD,realizedPnl:0,positions:[],transactions:[],createdAt:new Date().toISOString()};
    save();
  }
  return state.virtualPortfolio;
}
function virtualStats(){
  const vp=state.virtualPortfolio;
  if(!vp)return {positions:[],cash:0,marketValue:0,equity:0,pnl:0,returnPct:0,unrealized:0};
  const positions=(vp.positions||[]).map(p=>{
    const live=latestVirtualAsset(p),currentPriceUSD=priceInUSD(live)||Number(p.avgCostUSD)||0;
    const marketValueUSD=currentPriceUSD*Number(p.quantity||0);
    const unrealizedUSD=(currentPriceUSD-Number(p.avgCostUSD||0))*Number(p.quantity||0);
    return {...p,...live,currentPriceUSD,marketValueUSD,unrealizedUSD};
  });
  const marketValue=positions.reduce((s,p)=>s+p.marketValueUSD,0);
  const unrealized=positions.reduce((s,p)=>s+p.unrealizedUSD,0);
  const equity=Number(vp.cash||0)+marketValue;
  const pnl=equity-Number(vp.initialCash||VIRTUAL_INITIAL_USD);
  return {positions,cash:Number(vp.cash||0),marketValue,equity,pnl,returnPct:(pnl/Number(vp.initialCash||VIRTUAL_INITIAL_USD))*100,unrealized};
}
function persistUi(){localStorage.setItem(STORE,JSON.stringify(state))}
function setPortfolioMode(mode){
  state.ui.portfolioMode=mode==='virtual'?'virtual':'real';
  persistUi();renderVirtualPortfolio();
}

const baseRenderHome=renderHome;
renderHome=function(){baseRenderHome();renderVirtualHome()};
const baseRenderPortfolio=renderPortfolio;
renderPortfolio=function(){baseRenderPortfolio();renderVirtualPortfolio()};
const baseRenderSelected=renderSelected;
renderSelected=function(){
  baseRenderSelected();
  const actions=$('selectedCard').querySelector('.actions');
  if(!actions||!selected)return;
  const button=document.createElement('button');
  button.id='virtualBuy';button.className='primary wide';button.textContent=virtualStarted()?'Sanal portföyde satın al':'100.000 USD sanal portföyü başlat ve al';
  actions.appendChild(button);
  const box=document.createElement('div');box.id='virtualTradeBox';box.className='virtualTradeBox hidden';$('selectedCard').appendChild(box);
  button.onclick=()=>showVirtualBuyForm(selected);
};

function renderVirtualHome(){
  const el=$('homeVirtual');if(!el)return;
  if(!virtualStarted()){
    el.textContent='Başlatılmadı';el.className='';$('startVirtualCta').classList.remove('hidden');return;
  }
  const s=virtualStats();
  el.textContent=usd(s.equity);el.className=s.pnl>=0?'positive':'negative';
  $('startVirtualCta').classList.add('hidden');
}
function renderVirtualPortfolio(){
  if(!$('virtualPortfolioPanel'))return;
  const mode=state.ui.portfolioMode||'real';
  $('realPortfolioPanel').classList.toggle('hidden',mode!=='real');
  $('virtualPortfolioPanel').classList.toggle('hidden',mode!=='virtual');
  $('realMode').classList.toggle('active',mode==='real');
  $('virtualMode').classList.toggle('active',mode==='virtual');
  if(!virtualStarted()){
    $('virtualEmpty').classList.remove('hidden');$('virtualActive').classList.add('hidden');return;
  }
  $('virtualEmpty').classList.add('hidden');$('virtualActive').classList.remove('hidden');
  const s=virtualStats();
  $('virtualEquity').textContent=usd(s.equity);
  $('virtualCash').textContent=usd(s.cash);
  $('virtualInvested').textContent=usd(s.marketValue);
  $('virtualPnl').textContent=(s.pnl>=0?'+':'')+usd(s.pnl);$('virtualPnl').className=s.pnl>=0?'positive':'negative';
  $('virtualReturn').textContent=(s.returnPct>=0?'+':'')+num(s.returnPct)+'%';$('virtualReturn').className='badge '+(s.returnPct>=0?'positive':'negative');
  const list=$('virtualPortfolioList');
  if(!s.positions.length){list.innerHTML='<div class="card empty">Henüz sanal pozisyon yok. “Varlık ara ve al” düğmesini kullan.</div>'}
  else list.innerHTML=s.positions.map((p,i)=>{
    const weight=s.equity?p.marketValueUSD/s.equity*100:0;
    return `<div class="portfolioItem virtualPosition"><div class="assetTop"><div><div class="symbol">${esc(p.symbol)}</div><div class="assetName">${esc(p.name||'')} · ${esc(p.currency||'')}</div></div><span class="badge">%${num(weight)}</span></div><div class="small"><div><span>Adet</span><strong>${num(p.quantity,6)}</strong></div><div><span>Ort. maliyet</span><strong>${usd(p.avgCostUSD)}</strong></div><div><span>Güncel değer</span><strong>${usd(p.marketValueUSD)}</strong></div></div><div class="virtualPnlLine"><span>Açık K/Z</span><strong class="${p.unrealizedUSD>=0?'positive':'negative'}">${p.unrealizedUSD>=0?'+':''}${usd(p.unrealizedUSD)}</strong></div><div class="portfolioBtns"><button data-v-action="analyze" data-v-i="${i}">Analiz</button><button data-v-action="chart" data-v-i="${i}">Grafik</button><button data-v-action="sell" data-v-i="${i}">Sanal sat</button></div></div>`;
  }).join('');
  const tx=[...(state.virtualPortfolio.transactions||[])].slice(-12).reverse();
  $('virtualTransactions').innerHTML=tx.length?tx.map(t=>`<div class="transaction"><div><strong>${t.type==='BUY'?'ALIM':'SATIŞ'} · ${esc(t.symbol)}</strong><span>${new Date(t.date).toLocaleString('tr-TR')}</span></div><div><strong>${num(t.quantity,6)} adet</strong><span>${usd(t.amountUSD)}${present(t.realizedPnl)?` · K/Z ${t.realizedPnl>=0?'+':''}${usd(t.realizedPnl)}`:''}</span></div></div>`).join(''):'<div class="empty">Henüz işlem yok.</div>';
}

function showVirtualBuyForm(asset){
  if(!profileComplete()){
    nav('profile');toast('Sanal alım öncesinde yatırımcı profilini tamamla');return;
  }
  const priceUSD=priceInUSD(asset);
  if(!(priceUSD>0)){toast('Bu varlık için güncel fiyat bulunmuyor');return}
  const vp=createVirtualPortfolio(),s=virtualStats(),cap=profileCap(asset),existing=s.positions.find(p=>p.symbol===asset.symbol&&p.type===asset.type);
  const existingValue=existing?.marketValueUSD||0;
  const maxPositionUSD=s.equity*cap/100;
  const allowed=Math.max(0,Math.min(vp.cash,maxPositionUSD-existingValue));
  if(allowed<priceUSD&& !['crypto','fx','commodity'].includes(asset.type)){
    toast(`Profil limitine göre ${asset.symbol} için yeni alım kapasitesi yok`);return;
  }
  const box=$('virtualTradeBox');
  const defaultAmount=Math.max(0,Math.min(5000,allowed));
  box.innerHTML=`<h3>Sanal satın al · ${esc(asset.symbol)}</h3><div class="analysis"><div class="cell"><span>Fiyat</span><strong>${usd(priceUSD)}</strong></div><div class="cell"><span>Nakit</span><strong>${usd(vp.cash)}</strong></div><div class="cell"><span>Profil limiti</span><strong>%${num(cap)}</strong></div><div class="cell"><span>Azami yeni alım</span><strong>${usd(allowed)}</strong></div></div><label>Yatırım tutarı (USD)<input id="virtualBuyAmount" type="number" min="1" step="1" value="${Math.floor(defaultAmount)}"></label><div id="virtualBuyHint" class="hint">Hisse ve ETF işlemlerinde tam adet; kripto, döviz ve emtiada küsuratlı adet kullanılır.</div><div class="apiButtons"><button id="confirmVirtualBuy" class="primary">Sanal alımı yap</button><button id="cancelVirtualBuy" class="ghost">Vazgeç</button></div>`;
  box.classList.remove('hidden');
  $('cancelVirtualBuy').onclick=()=>box.classList.add('hidden');
  $('confirmVirtualBuy').onclick=()=>executeVirtualBuy(asset,Number($('virtualBuyAmount').value),allowed,priceUSD);
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function executeVirtualBuy(asset,requestedUSD,allowedUSD,priceUSD){
  if(!(requestedUSD>0))return toast('Yatırım tutarı gir');
  if(requestedUSD>allowedUSD+0.01)return toast(`Profil ve nakit limitine göre azami ${usd(allowedUSD)}`);
  const fractional=['crypto','fx','commodity'].includes(asset.type);
  const quantity=fractional?Number((requestedUSD/priceUSD).toFixed(8)):Math.floor(requestedUSD/priceUSD);
  if(!(quantity>0))return toast('Bu tutar bir tam adet almaya yetmiyor');
  const cost=quantity*priceUSD,vp=state.virtualPortfolio;
  if(cost>vp.cash+0.01)return toast('Sanal nakit yetersiz');
  let p=vp.positions.find(x=>x.symbol===asset.symbol&&x.type===asset.type);
  if(p){
    const oldCost=p.quantity*p.avgCostUSD,newQty=p.quantity+quantity;
    p.avgCostUSD=(oldCost+cost)/newQty;p.quantity=newQty;p.name=asset.name;p.exchange=asset.exchange;p.currency=asset.currency;p.price=asset.price;
  }else{
    p={symbol:asset.symbol,name:asset.name,type:asset.type,exchange:asset.exchange,currency:asset.currency,quantity,avgCostUSD:priceUSD,price:asset.price};vp.positions.push(p);
  }
  vp.cash-=cost;
  vp.transactions.push({type:'BUY',symbol:asset.symbol,quantity,priceUSD,amountUSD:cost,date:new Date().toISOString()});
  state.ui.portfolioMode='virtual';save();$('virtualTradeBox').classList.add('hidden');nav('portfolio');toast(`${asset.symbol}: ${num(quantity,6)} adet sanal alındı`);
}
function sellVirtualPosition(position){
  const live=latestVirtualAsset(position),priceUSD=priceInUSD(live)||position.avgCostUSD;
  const raw=prompt(`${position.symbol} satılacak adet (mevcut ${num(position.quantity,6)}):`,String(position.quantity));
  if(raw===null)return;const quantity=Number(raw);
  if(!(quantity>0)||quantity>position.quantity+1e-8)return toast('Geçerli satış adedi gir');
  const proceeds=quantity*priceUSD,realized=(priceUSD-position.avgCostUSD)*quantity,vp=state.virtualPortfolio;
  vp.cash+=proceeds;vp.realizedPnl=(vp.realizedPnl||0)+realized;
  position.quantity-=quantity;
  if(position.quantity<=1e-8)vp.positions=vp.positions.filter(p=>p!==position);
  vp.transactions.push({type:'SELL',symbol:position.symbol,quantity,priceUSD,amountUSD:proceeds,realizedPnl:realized,date:new Date().toISOString()});
  save();toast(`${position.symbol}: ${num(quantity,6)} adet sanal satıldı`);
}

$('realMode').onclick=()=>setPortfolioMode('real');
$('virtualMode').onclick=()=>setPortfolioMode('virtual');
$('startVirtualPortfolio').onclick=()=>{createVirtualPortfolio();setPortfolioMode('virtual');toast('100.000 USD sanal portföy başlatıldı')};
$('startVirtualCta').onclick=()=>{createVirtualPortfolio();setPortfolioMode('virtual');nav('portfolio');toast('100.000 USD sanal portföy başlatıldı')};
$('virtualFindAsset').onclick=()=>nav('search');
$('resetVirtualPortfolio').onclick=()=>{
  if(confirm('Sanal portföy, tüm sanal pozisyonlar ve işlem geçmişi sıfırlansın mı?')){
    state.virtualPortfolio={initialCash:VIRTUAL_INITIAL_USD,cash:VIRTUAL_INITIAL_USD,realizedPnl:0,positions:[],transactions:[],createdAt:new Date().toISOString()};save();toast('Sanal portföy 100.000 USD olarak sıfırlandı');
  }
};
$('virtualPortfolioList').onclick=e=>{
  const b=e.target.closest('[data-v-action]');if(!b)return;
  const p=virtualStats().positions[Number(b.dataset.vI)];if(!p)return;
  const original=state.virtualPortfolio.positions.find(x=>x.symbol===p.symbol&&x.type===p.type);
  if(b.dataset.vAction==='sell')sellVirtualPosition(original);
  else if(b.dataset.vAction==='chart')openChart(p);
  else{selected=p;nav('search');renderSelected();analyzeAsset(p)}
};

$('clearData').onclick=()=>{
  if(confirm('Profil, gerçek portföy ve sanal portföy silinsin mi?')){
    localStorage.removeItem(STORE);
    state={profile:null,portfolio:[],lastDecision:null,lastAsset:null,virtualPortfolio:null,ui:{portfolioMode:'real'},settings:{historyCache:{}}};
    loadProfileForm();save();toast('Cihaz verileri temizlendi');
  }
};

renderVirtualHome();renderVirtualPortfolio();
