function present(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function scoreAsset(a){
  let business=15,growth=10,valuation=8,technical=5,risk=8,known=0;
  if(present(a.roe)){business=Math.max(3,Math.min(30,15+(+a.roe-10)*.5));known++}
  if(present(a.revenue_growth)){growth=Math.max(2,Math.min(20,10+(+a.revenue_growth)*.35));known++}
  if(present(a.pe)){valuation=Math.max(2,Math.min(15,16-(+a.pe)*.35));known++}
  if(present(a.change)){technical=Math.max(1,Math.min(10,5+(+a.change)*.25));known++}
  if(present(a.volatility)){risk=Math.max(2,Math.min(15,15-(+a.volatility)*.2));known++}
  const macro=6,total=Math.round(business+growth+valuation+technical+macro+risk);
  return {business:Math.round(business),growth:Math.round(growth),valuation:Math.round(valuation),technical:Math.round(technical),macro,risk:Math.round(risk),score:Math.max(0,Math.min(100,total)),confidence:Math.min(95,35+known*12),known};
}
function fxRate(c){if(c==='TRY')return 1;if(c==='USD')return +market.fx?.USDTRY||40;if(c==='EUR')return +market.fx?.EURTRY||44;return 1}
function portfolioStats(){
  const rows=state.portfolio.map(p=>{
    const a=market.assets.find(x=>x.symbol===p.symbol&&x.type===p.type)||p;
    const price=+a.price||+p.currentPrice||+p.avgCost||0;
    const valueTRY=price*(+p.quantity||0)*fxRate(a.currency||p.currency);
    return {...p,...a,price,valueTRY};
  });
  const total=rows.reduce((s,x)=>s+x.valueTRY,0);
  rows.forEach(x=>x.weight=total?x.valueTRY/total*100:0);
  return {rows,total};
}
function profileCap(a){
  const p=state.profile;let cap=+p.maxPosition;
  const riskCap=p.risk==='low'?6:p.risk==='medium'?10:15;
  cap=Math.min(cap,riskCap);
  if(a.type==='crypto')cap=Math.min(cap,p.risk==='high'?8:3);
  if(p.objective==='preserve')cap=Math.min(cap,5);
  if(p.objective==='speculative'&&p.risk==='high')cap=Math.max(cap,12);
  return cap;
}
function decision(a,s){
  if(!profileComplete())return {action:'PROFİL GEREKLİ',summary:'Önce 7 soruluk profil tamamlanmalıdır.',details:['Profil olmadan AL/AZALT/SAT veya lot önerisi yapılmaz.'],cls:'warn'};
  const ps=portfolioStats();
  if(ps.missing>0){
    return {action:'PORTFÖY AĞIRLIĞI HESAPLANAMADI',summary:`${ps.missing} pozisyonda fiyat eksik — ağırlık ve konsantrasyon kararı kilitli`,details:['Bir veya daha fazla pozisyonun güncel fiyatı yok. Eksik fiyat sıfır değer sayılmaz; bu nedenle ağırlık, konsantrasyon ve lot hesapları üretilmez.','Eksik fiyat(lar) giderilene veya tarihli/tahmini olarak açıkça onaylanana kadar bu ekran karar üretmeyecektir.'],cls:'warn'};
  }
  const held=ps.rows.find(x=>x.symbol===a.symbol&&x.type===a.type),weight=held?.weight||0,cap=profileCap(a),band=+state.profile.rebalanceBand;
  const details=[`MIC puanı ${s.score}/100; veri güveni %${s.confidence}.`,`Profil: ${riskLabel(state.profile.risk)} risk; azami pozisyon %${num(cap)}; tolerans ±%${num(band)}.`];
  if(held&&weight>cap+band){
    details.push(`Mevcut ağırlık %${num(weight)}; limit+tolerans %${num(cap+band)}.`);
    details.push('Portföy ağırlığı tek başına satış sinyali değildir. Şirket tezi, temettü/gelir sağlığı ve kullanıcı stratejisi ayrı ayrı değerlendirilmelidir.');
    details.push('Lot bazlı azaltma rakamı görmek isterseniz "Konsantrasyonu azaltma senaryosunu hesapla" düğmesini kullanın — bu bir tavsiye değil, matematiksel bir senaryodur.');
    return {action:'KONSANTRASYON UYARISI',summary:'SATIŞ SİNYALİ DEĞİLDİR',details,cls:'warn'};
  }
  if(s.known<2){
    details.push('Temel/teknik veri kapsamı karar için yetersiz.');
    return {action:'VERİ YETERSİZ',summary:'AL/SAT kararı üretilmedi',details,cls:'warn'};
  }
  if(held&&s.score<45){
    details.push('Puan 45 altı; doğrudan satış yerine yatırım tezi ve veri kaynakları yeniden incelenmelidir.');
    return {action:'TEZİ YENİLE',summary:'Satış kararı için ilave doğrulama gerekli',details,cls:'bad'};
  }
  if(held){details.push(`Ağırlık %${num(weight)} ve profil bandı içinde.`);return {action:'TUT',summary:'Mevcut miktarı koru',details,cls:''}}
  if(s.score>=75){
    const budget=Math.min(+state.profile.monthlyContribution||0,portfolioStats().total*cap/100||+state.profile.monthlyContribution||0);
    const qty=a.price?Math.floor((budget/fxRate(a.currency))/a.price):0;
    details.push(budget>0?`Aylık katkı ve limit içinde yaklaşık ${num(qty,6)} adet/lot üst sınırdır.`:'Miktar için aylık yatırım tutarını profile gir.');
    return {action:'ADAY / KADEMELİ EKLE',summary:qty>0?`${num(qty,6)} adet/lot üst sınır`:'Miktar hesaplanamadı',details,cls:''};
  }
  return {action:'İZLE',summary:'Yeni pozisyon açma',details,cls:'warn'};
}
function calculateConcentrationScenario(a){
  const ps=portfolioStats();
  if(ps.missing>0)return {error:`PORTFÖY AĞIRLIĞI HESAPLANAMADI: ${ps.missing} pozisyonda fiyat eksik. Senaryo hesaplanamaz.`};
  const held=ps.rows.find(x=>x.symbol===a.symbol&&x.type===a.type);
  if(!held)return {error:'Bu varlık gerçek portföyde bulunamadı.'};
  const cap=profileCap(a),targetValue=ps.total*cap/100,reduceTRY=Math.max(0,held.valueTRY-targetValue),unitTRY=held.price*fxRate(held.currency);
  const scenarioQty=unitTRY>0?Math.min(held.quantity,Math.ceil(reduceTRY/unitTRY)):0;
  return {isScenario:true,symbol:held.symbol,currentWeight:held.weight,targetWeight:cap,scenarioQty,keepQty:held.quantity-scenarioQty,approxReduceTRY:scenarioQty*unitTRY,unit:held.priceUnitLabel||'adet/lot'};
}
function renderConcentrationScenario(a){
  const r=calculateConcentrationScenario(a);
  $('analysisPanel').classList.remove('hidden');
  if(r.error){$('analysisPanel').innerHTML=`<div class="decision warn"><div class="decisionTitle">SENARYO HESAPLANAMADI</div><div>${esc(r.error)}</div></div>`;return}
  $('analysisPanel').innerHTML=`<div class="decision warn"><div class="decisionTitle">MATEMATİKSEL SENARYO — TAVSİYE DEĞİLDİR</div>
    <div>${esc(r.symbol)}: mevcut ağırlık %${num(r.currentWeight)}, hedef ağırlık %${num(r.targetWeight)}.</div>
    <ul class="reason">
      <li>Hedefe ulaşmak için yaklaşık ${num(r.scenarioQty,6)} ${esc(r.unit)} azaltma gerekir; ${num(r.keepQty,6)} ${esc(r.unit)} elde kalır.</li>
      <li>Yaklaşık ${money(r.approxReduceTRY,'TRY')} azaltma tutarı.</li>
      <li>Bu bir emir veya tavsiye değildir; yalnızca kullanıcının açık isteğiyle hesaplanan bir matematik senaryosudur. Şirket tezi, temettü stratejisi ve vergi/komisyon etkisi burada değerlendirilmez.</li>
    </ul></div>`;
}
function analyzeAsset(a){
  const s=scoreAsset(a),d=decision(a,s);
  state.lastDecision={action:d.action,symbol:a.symbol,summary:d.summary};state.lastAsset=a;save();
  $('analysisPanel').classList.remove('hidden');
  $('analysisPanel').innerHTML=`<div class="assetTop"><div><div class="symbol">${a.price!=null?money(a.price,a.currency):'Fiyat yok'}</div><div class="assetName">Günlük değişim <span class="${(+a.change||0)>=0?'positive':'negative'}">${present(a.change)?num(a.change):'—'}%</span></div></div><span class="badge">MIC ${s.score}/100</span></div><div class="analysis"><div class="cell"><span>Güven</span><strong>%${s.confidence}</strong></div><div class="cell"><span>İş kalitesi</span><strong>${s.business}/30</strong></div><div class="cell"><span>Büyüme</span><strong>${s.growth}/20</strong></div><div class="cell"><span>Değerleme</span><strong>${s.valuation}/15</strong></div><div class="cell"><span>Teknik</span><strong>${s.technical}/10</strong></div><div class="cell"><span>Risk kalitesi</span><strong>${s.risk}/15</strong></div></div><div class="decision ${d.cls||''}"><div class="decisionTitle">${esc(d.action)}</div><div>${esc(d.summary)}</div><ul class="reason">${d.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
}
function addPortfolio(a){
  if(state.portfolio.some(x=>x.symbol===a.symbol&&x.type===a.type))return toast('Bu varlık portföyde mevcut');
  const q=prompt(a.symbol+' adet/lot:','10');if(q===null||!(+q>0))return;
  const c=prompt('Ortalama maliyet ('+(a.currency||'TRY')+'): ',String(a.price||0));if(c===null)return;
  state.portfolio.push({symbol:a.symbol,name:a.name,type:a.type,exchange:a.exchange,currency:a.currency,quantity:+q,avgCost:+c||0,currentPrice:+a.price||+c||0});
  save();toast('Portföye eklendi');nav('portfolio');
}
function renderPortfolio(){
  const ps=portfolioStats();$('totalValue').textContent=money(ps.total,'TRY');$('positionCount').textContent=ps.rows.length;
  const box=$('portfolioList');
  if(!ps.rows.length){box.innerHTML='<div class="card empty">Portföy boş. Araştırma ekranından varlık ekle.</div>';return}
  box.innerHTML=ps.rows.map((p,i)=>{
    const pnl=(p.price-p.avgCost)*p.quantity*fxRate(p.currency),s=scoreAsset(p),d=decision(p,s);
    return `<div class="portfolioItem"><div class="assetTop"><div><div class="symbol">${esc(p.symbol)}</div><div class="assetName">${esc(p.name)}</div></div><span class="badge">%${num(p.weight)}</span></div><div class="small"><div><span>Adet</span><strong>${num(p.quantity,6)}</strong></div><div><span>Fiyat</span><strong>${money(p.price,p.currency)}</strong></div><div><span>Açık K/Z</span><strong class="${pnl>=0?'positive':'negative'}">${money(pnl,'TRY')}</strong></div></div><div class="hint"><b>${esc(d.action)}</b> · ${esc(d.summary)}</div><div class="portfolioBtns"><button data-a="analyze" data-i="${i}">Analiz</button><button data-a="chart" data-i="${i}">Grafik</button><button data-a="scenario" data-i="${i}">Senaryo</button><button data-a="delete" data-i="${i}">Sil</button></div></div>`;
  }).join('');
}
$('portfolioList').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;const p=portfolioStats().rows[+b.dataset.i];
  if(b.dataset.a==='delete'){if(confirm(p.symbol+' silinsin mi?')){state.portfolio=state.portfolio.filter(x=>!(x.symbol===p.symbol&&x.type===p.type));save()}}
  else if(b.dataset.a==='chart')openChart(p);
  else if(b.dataset.a==='scenario'){nav('search');renderConcentrationScenario(p);}
  else{selected=p;nav('search');renderSelected();analyzeAsset(p)}
};
$('samplePortfolio').onclick=()=>{
  state.portfolio=[{symbol:'FROTO',name:'Ford Otomotiv Sanayi A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:1050,avgCost:40.78},{symbol:'TUPRS',name:'Tüpraş',type:'stock',exchange:'BIST',currency:'TRY',quantity:395,avgCost:63.32},{symbol:'LUNR',name:'Intuitive Machines, Inc.',type:'stock',exchange:'NASDAQ',currency:'USD',quantity:285.628571,avgCost:17.5}];
  save();toast('Örnek portföy yüklendi');
};

const PROFILE_IDS=['objective','horizon','liquidity','lossReaction','experience','incomeStability','maxDrawdown'];
function updateProfileProgress(){
  const done=PROFILE_IDS.filter(id=>String($(id)?.value||'').trim()).length;
  $('profileProgress').textContent=`${done}/7`;
  $('profileProgress').className=done===7?'pill':'pill warn';
}
PROFILE_IDS.forEach(id=>$(id).addEventListener('change',updateProfileProgress));
function calculateRisk(p){
  let score=0;
  score+=({preserve:0,income:1,balanced:2,growth:3,speculative:4})[p.objective]??0;
  score+=({1:0,3:1,5:2,10:3})[p.horizon]??0;
  score+=({soon:0,medium:1,long:2})[p.liquidity]??0;
  score+=({sell:0,reduce:1,hold:2,buy:3})[p.lossReaction]??0;
  score+=({beginner:0,intermediate:1,advanced:2})[p.experience]??0;
  score+=({low:0,medium:1,high:2})[p.incomeStability]??0;
  score+=Math.max(0,Math.min(4,Math.floor((p.maxDrawdown-5)/10)));
  const risk=score<=5?'low':score<=11?'medium':'high';
  return {score,risk};
}
$('saveProfile').onclick=()=>{
  const p={
    objective:$('objective').value,horizon:$('horizon').value,liquidity:$('liquidity').value,
    lossReaction:$('lossReaction').value,experience:$('experience').value,incomeStability:$('incomeStability').value,
    maxDrawdown:+$('maxDrawdown').value,maxPosition:+$('maxPosition').value,rebalanceBand:+$('rebalanceBand').value,
    monthlyContribution:+$('monthlyContribution').value
  };
  if(!PROFILE_IDS.every(id=>String($(id).value||'').trim()))return toast('7 sorunun tamamını cevapla');
  const r=calculateRisk(p);p.risk=r.risk;p.riskScore=r.score;
  state.profile=p;save();updateProfileProgress();renderProfileResult();toast('Yatırımcı profili oluşturuldu');
};
function loadProfileForm(){
  const p=state.profile;if(!p){updateProfileProgress();return}
  ['objective','horizon','liquidity','lossReaction','experience','incomeStability','maxDrawdown','maxPosition','rebalanceBand','monthlyContribution'].forEach(id=>{if(p[id]!==undefined)$(id).value=p[id]});
  updateProfileProgress();
}
function renderProfileResult(){
  const p=state.profile,box=$('profileResult');
  if(!profileComplete()){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  box.innerHTML=`<div class="assetTop"><div><h3>Oluşturulan profil</h3><div class="assetName">Cevaplardan otomatik hesaplandı</div></div><span class="badge">${riskLabel(p.risk)} risk</span></div><div class="analysis"><div class="cell"><span>Risk puanı</span><strong>${p.riskScore}/20</strong></div><div class="cell"><span>Ufuk</span><strong>${p.horizon==='10'?'5+':p.horizon} yıl</strong></div><div class="cell"><span>Azami düşüş</span><strong>%${num(p.maxDrawdown)}</strong></div><div class="cell"><span>Pozisyon limiti</span><strong>%${num(p.maxPosition)}</strong></div></div><p class="hint">Bu profil her AL/TUT/AZALT/SAT değerlendirmesinde portföy ağırlığı ve varlık riskiyle birlikte kullanılır.</p>`;
}

const PERIOD_DAYS={'1H':7,'1A':31,'3A':93,'6A':186,'1Y':366};
const historyLoading=new Set();
function assetKey(a){return `${a.type||'asset'}:${a.symbol}`}
function renderPeriodButtons(){document.querySelectorAll('.period').forEach(b=>b.classList.toggle('active',b.dataset.period===chartPeriod))}
$('chartPeriods').onclick=e=>{
  const b=e.target.closest('[data-period]');if(!b)return;
  chartPeriod=b.dataset.period;renderPeriodButtons();drawLastChart();
};
function startDate(period){
  const d=new Date();
  if(period==='YTD')return `${d.getFullYear()}-01-01`;
  d.setDate(d.getDate()-(PERIOD_DAYS[period]||31));
  return d.toISOString().slice(0,10);
}
function filterHistory(hist,period){
  const start=startDate(period);
  return [...hist].filter(x=>present(x.close)&&String(x.date)>=start).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function cachedHistory(a){return state.settings.historyCache?.[assetKey(a)]?.history||[]}
function performanceValue(a,period){return present(a.performance?.[period])?+a.performance[period]:null}
function openChart(a){
  state.lastAsset=a;save();nav('chart');
  ensureHistory(a,false);
}
function drawLastChart(){
  const a=state.lastAsset;renderPeriodButtons();
  if(!a){$('chartTitle').textContent='';showChartMessage('Önce bir varlık seç.');return}
  const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a;
  const hist=cachedHistory(live),filtered=filterHistory(hist,chartPeriod),perf=performanceValue(live,chartPeriod);
  $('chartTitle').textContent=live.symbol+' · '+live.name;
  $('chartInfo').textContent=`${live.exchange||''} · ${live.currency||''} · ${chartPeriod}${filtered.length?` · ${filtered.length} günlük veri`:''}`;
  $('performanceSummary').classList.toggle('hidden',perf===null);
  if(perf!==null)$('performanceSummary').innerHTML=`<span>${chartPeriod} özet getirisi</span><strong class="${perf>=0?'positive':'negative'}">${perf>0?'+':''}${num(perf)}%</strong>`;
  if(filtered.length>=2){
    $('chartMessage').classList.add('hidden');$('chartCanvas').classList.remove('hidden');drawLine(filtered);return;
  }
  clearCanvas();$('chartCanvas').classList.add('hidden');
  const loading=historyLoading.has(assetKey(live));
  showChartMessage(loading?'Günlük fiyat verisi yükleniyor…':'Günlük fiyat serisi henüz yüklenmedi. Aşağıdaki düğmeye bas.');
}
function showChartMessage(t){$('chartMessage').textContent=t;$('chartMessage').classList.remove('hidden')}
function clearCanvas(){const c=$('chartCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height)}
function drawLine(hist){
  const c=$('chartCanvas'),r=c.getBoundingClientRect(),d=devicePixelRatio||1;
  c.width=r.width*d;c.height=r.height*d;const ctx=c.getContext('2d');ctx.scale(d,d);
  const W=r.width,H=r.height,p=38,vals=hist.map(x=>+x.close),min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
  ctx.clearRect(0,0,W,H);ctx.strokeStyle='#263b59';ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=p+(H-2*p)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(W-p,y);ctx.stroke()}
  const first=vals[0],last=vals.at(-1);ctx.strokeStyle=last>=first?'#42d39a':'#ff6b78';ctx.lineWidth=2.5;ctx.beginPath();
  hist.forEach((x,i)=>{const xx=p+(W-2*p)*i/(hist.length-1),yy=p+(H-2*p)*(max-(+x.close))/span;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
  ctx.fillStyle='#9cabc1';ctx.font='11px system-ui';ctx.fillText(num(max),4,16);ctx.fillText(num(min),4,H-28);
  ctx.textAlign='center';ctx.fillText(String(hist[0].date).slice(5),p,H-9);ctx.fillText(String(hist.at(-1).date).slice(5),W-p,H-9);
  ctx.fillStyle='#f5f8ff';ctx.textAlign='left';ctx.font='bold 14px system-ui';ctx.fillText('Son: '+num(last),p,22);
}
async function fetchHistoryFile(a){
  const symbol=encodeURIComponent(String(a.symbol||'').toUpperCase());
  const response=await fetch(`data/history/${symbol}.json?t=${Date.now()}`,{cache:'no-store'});
  if(!response.ok){
    if(response.status===404)throw new Error('Bu varlığın günlük grafik dosyası henüz hazırlanmadı');
    throw new Error('Grafik verisi HTTP '+response.status);
  }
  const data=await response.json();
  const history=(data.history||[]).filter(x=>present(x.close)).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  if(history.length<2)throw new Error('Yeterli günlük fiyat verisi bulunamadı');
  state.settings.historyCache[assetKey(a)]={updatedAt:data.updated_at||new Date().toISOString(),provider:data.provider||'GitHub history feed',history};
  save();
  return history;
}
async function ensureHistory(a,notify=true){
  if(!a)return;
  const key=assetKey(a);
  if(historyLoading.has(key))return;
  historyLoading.add(key);
  $('historyStatus').textContent=`${a.symbol} günlük fiyat verisi yükleniyor…`;
  const button=$('loadChartData'),old=button.textContent;button.disabled=true;button.textContent='Grafik verisi yükleniyor…';
  drawLastChart();
  try{
    const history=await fetchHistoryFile(a);
    $('historyStatus').textContent=`${a.symbol}: ${history.length} günlük veri yüklendi.`;
    if(notify)toast('Günlük fiyat grafiği yüklendi');
  }catch(e){
    $('historyStatus').textContent=`${a.symbol}: ${e.message}`;
    showChartMessage(e.message+'. Dönemsel özet getiri üstte gösterilmeye devam eder.');
    if(notify)toast(e.message);
  }finally{
    historyLoading.delete(key);button.disabled=false;button.textContent=old;drawLastChart();
  }
}
$('loadChartData').onclick=()=>{const a=state.lastAsset;if(!a)return toast('Önce varlık seç');ensureHistory(a,true)};

$('clearData').onclick=()=>{
  if(confirm('Profil ve portföy silinsin mi?')){
    localStorage.removeItem(STORE);
    state={profile:null,portfolio:[],lastDecision:null,lastAsset:null,settings:{historyCache:{}}};
    loadProfileForm();save();toast('Yerel veriler temizlendi');
  }
};
loadProfileForm();renderProfileResult();renderPeriodButtons();renderHome();renderPortfolio();loadMarket();
