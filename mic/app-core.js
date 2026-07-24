const $=id=>document.getElementById(id);
const TYPES=[['all','Tümü'],['stock','Hisse'],['etf','ETF'],['crypto','Kripto'],['fund','Fon'],['index','Endeks'],['fx','Döviz'],['commodity','Emtia']];
const STORE='mic_mobile_github_v3';
let state={
  profile:null,portfolio:[],lastDecision:null,lastAsset:null,
  settings:{historyCache:{}}
};
try{state={...state,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{}
state.settings={historyCache:{},...(state.settings||{})};
let market={updated_at:null,assets:[],fx:{USDTRY:40}},selected=null,activeType='all',chartPeriod='1A';

function save(){localStorage.setItem(STORE,JSON.stringify(state));renderHome();renderPortfolio();renderProfileResult()}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function num(n,d=2){return Number(n||0).toLocaleString('tr-TR',{maximumFractionDigits:d})}
function money(n,c='TRY'){return new Intl.NumberFormat('tr-TR',{style:'currency',currency:c,maximumFractionDigits:2}).format(n||0)}
function toast(t){$('toast').textContent=t;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2800)}
function nav(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v));
  document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
  if(v==='chart')drawLastChart();
  if(v==='profile')updateProfileProgress();
}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>nav(b.dataset.view));
$('createProfileCta').onclick=()=>nav('profile');

const sideNote=document.querySelector('.sideNote');
if(sideNote)sideNote.textContent='Gerçek portföy ile 100.000 USD sanal portföy ayrı tutulur; ikisi de aynı puanlama, risk limiti ve karar kurallarıyla değerlendirilir.';

function profileComplete(){
  const p=state.profile;
  return !!(p&&p.objective&&p.horizon&&p.liquidity&&p.lossReaction&&p.experience&&p.incomeStability&&p.risk&&p.maxPosition&&p.rebalanceBand);
}
function renderHome(){
  $('homeProfile').textContent=profileComplete()?`${riskLabel(state.profile.risk)} risk`:'Eksik';
  $('homeProfile').className=profileComplete()?'positive':'negative';
  $('homePortfolio').textContent=state.portfolio.length+' varlık';
  $('createProfileCta').classList.toggle('hidden',profileComplete());
  $('lastDecision').innerHTML=state.lastDecision?`<div class="decisionTitle">${esc(state.lastDecision.action)}</div><div class="hint">${esc(state.lastDecision.symbol)} · ${esc(state.lastDecision.summary)}</div>`:'Henüz analiz yapılmadı.';
}
function renderChips(){$('chips').innerHTML=TYPES.map(([k,l])=>`<button class="chip ${activeType===k?'active':''}" data-type="${k}">${l}</button>`).join('')}
$('chips').onclick=e=>{
  const b=e.target.closest('[data-type]');if(!b)return;
  activeType=b.dataset.type;renderChips();
  if(selected&&!matchesType(selected))clearSearchSelection(true);
  else if(selected)$('results').classList.add('hidden');
  else runSearch();
};
renderChips();

async function loadMarket(){
  try{
    const r=await fetch('data/market.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    market=await r.json();
    $('dataStatus').textContent='SON VERİ';
    $('dataStatus').className='pill';
    const d=market.updated_at?new Date(market.updated_at):null;
    $('feedTime').textContent=d?'Güncelleme: '+d.toLocaleString('tr-TR'):'Veri zamanı yok';
    $('settingsStatus').textContent=`${market.assets.length} varlık yüklendi.`;
    if(!selected||$('searchInput').value.trim()!==selectedSearchLabel())runSearch();
    else $('results').classList.add('hidden');
    renderPortfolio();
    return true;
  }catch(e){
    $('dataStatus').textContent='VERİ HATASI';$('dataStatus').className='pill warn';
    $('settingsStatus').textContent='Veri alınamadı: '+e.message;
    return false;
  }
}
$('refreshData').onclick=async()=>{const ok=await loadMarket();toast(ok?'Veri yenilendi':'Veri yenilenemedi')};

function norm(s){return String(s||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function matchesType(a){return activeType==='all'||a.type===activeType}
function selectedSearchLabel(){return selected?`${selected.symbol} — ${selected.name}`:''}
function clearSearchSelection(clearInput=false){
  selected=null;
  if(clearInput)$('searchInput').value='';
  $('results').classList.add('hidden');$('results').innerHTML='';
  $('selectedCard').classList.add('hidden');
  $('analysisPanel').classList.add('hidden');
}
function searchMatches(asset,query){
  const haystack=norm(`${asset.symbol} ${asset.name}`),clean=norm(query).replace(/[—–-]/g,' ');
  const terms=clean.split(/\s+/).filter(Boolean);
  return terms.length>0&&terms.every(term=>haystack.includes(term));
}
function runSearch(){
  const input=$('searchInput'),q=input.value.trim(),box=$('results');
  if(selected&&q===selectedSearchLabel()){box.classList.add('hidden');box.innerHTML='';return}
  if(q.length<3){box.classList.add('hidden');box.innerHTML='';return}
  const items=(market.assets||[]).filter(a=>matchesType(a)&&searchMatches(a,q)).slice(0,30);
  box._items=items;
  box.innerHTML=items.length?items.map((a,i)=>`<div class="result" data-i="${i}"><strong>${esc(a.symbol)} — ${esc(a.name)}</strong><small>${label(a.type)} · ${esc(a.exchange||'')} · ${esc(a.currency||'')}</small></div>`).join(''):'<div class="result muted">Eşleşen varlık bulunamadı.</div>';
  box.classList.remove('hidden');
}
$('searchInput').addEventListener('input',()=>{
  const q=$('searchInput').value.trim();
  if(selected&&q!==selectedSearchLabel()){
    selected=null;
    $('selectedCard').classList.add('hidden');
    $('analysisPanel').classList.add('hidden');
  }
  runSearch();
});
$('searchInput').addEventListener('focus',()=>{if(!selected)runSearch()});
$('searchInput').addEventListener('keydown',e=>{if(e.key==='Escape')$('results').classList.add('hidden')});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))$('results').classList.add('hidden')});
$('results').onclick=e=>{
  const r=e.target.closest('[data-i]');if(!r)return;
  selected=$('results')._items[+r.dataset.i];
  $('searchInput').value=selectedSearchLabel();
  $('results').classList.add('hidden');$('results').innerHTML='';
  renderSelected();
};
function label(t){return ({stock:'Hisse',etf:'ETF',crypto:'Kripto',fund:'Fon',index:'Endeks',fx:'Döviz',commodity:'Emtia'})[t]||t}
function riskLabel(r){return ({low:'Düşük',medium:'Orta',high:'Yüksek'})[r]||'—'}
function renderSelected(){
  $('selectedCard').classList.remove('hidden');
  $('selectedCard').innerHTML=`<div class="assetTop"><div><div class="symbol">${esc(selected.symbol)}</div><div class="assetName">${esc(selected.name)}</div></div><span class="badge">${label(selected.type)}</span></div><div class="hint">${esc(selected.exchange||'')} · ${esc(selected.currency||'')} · Son fiyat ${selected.price!=null?money(selected.price,selected.currency):'yok'}</div><div class="actions"><button id="analyze" class="primary">Analiz et</button><button id="openChart" class="ghost">Grafiği aç</button><button id="addPort" class="ghost wide">Portföye ekle</button></div>`;
  $('analysisPanel').classList.add('hidden');
  $('analyze').onclick=()=>analyzeAsset(selected);
  $('openChart').onclick=()=>openChart(selected);
  $('addPort').onclick=()=>addPortfolio(selected);
}

window.addEventListener('load',()=>{
  const desktop=location.pathname.includes('mic-desktop');
  const base=desktop?'../mic/':'';
  const addCss=(href,key)=>{if(document.querySelector(`link[data-mic-${key}]`))return;const x=document.createElement('link');x.rel='stylesheet';x.href=base+href;x.dataset[`mic${key[0].toUpperCase()+key.slice(1)}`]='1';document.head.appendChild(x)};
  const addScript=(src,key,onload)=>{if(document.querySelector(`script[data-mic-${key}]`))return;const x=document.createElement('script');x.src=base+src;x.dataset[`mic${key[0].toUpperCase()+key.slice(1)}`]='1';if(onload)x.onload=onload;document.body.appendChild(x)};
  addCss('chart-workspace-v10.css?v=11','chart-workspace');
  addCss('data-governance-v11.css?v=11','data-governance');
  addScript('data-governance-v11.js?v=11','data-governance');
  addScript('indicators-v10-patch.js?v=11','indicators-patch',()=>addScript('chart-workspace-v10.js?v=11','chart-workspace'));
});
