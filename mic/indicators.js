const INDICATOR_DEFS=[
  {key:'rsi',label:'RSI 14',directional:true},
  {key:'macd',label:'MACD 12/26/9',directional:true},
  {key:'sma',label:'SMA 20/50',directional:true},
  {key:'ema',label:'EMA 12/26',directional:true},
  {key:'bollinger',label:'Bollinger 20/2',directional:true},
  {key:'stochastic',label:'Stokastik 14/3',directional:true},
  {key:'volume',label:'Hacim teyidi',directional:true},
  {key:'atr',label:'ATR 14 risk',directional:false}
];
const DEFAULT_INDICATORS=INDICATOR_DEFS.map(x=>x.key);
function ensureIndicatorSettings(){
  state.settings=state.settings||{};
  state.settings.indicators={active:[...DEFAULT_INDICATORS],...(state.settings.indicators||{})};
  if(!Array.isArray(state.settings.indicators.active))state.settings.indicators.active=[...DEFAULT_INDICATORS];
  return state.settings.indicators;
}
ensureIndicatorSettings();

function mean(values){return values.length?values.reduce((s,v)=>s+v,0)/values.length:NaN}
function stddev(values){if(!values.length)return NaN;const m=mean(values);return Math.sqrt(mean(values.map(v=>(v-m)**2)))}
function smaAt(values,period,index=values.length-1){if(index+1<period)return NaN;return mean(values.slice(index-period+1,index+1))}
function emaSeries(values,period){
  if(!values.length)return [];
  const alpha=2/(period+1),out=[values[0]];
  for(let i=1;i<values.length;i++)out.push(alpha*values[i]+(1-alpha)*out[i-1]);
  return out;
}
function rsiValue(values,period=14){
  if(values.length<period+1)return NaN;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>=0)gains+=d;else losses-=d}
  let avgGain=gains/period,avgLoss=losses/period;
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1],g=d>0?d:0,l=d<0?-d:0;
    avgGain=(avgGain*(period-1)+g)/period;avgLoss=(avgLoss*(period-1)+l)/period;
  }
  if(avgLoss===0)return 100;
  const rs=avgGain/avgLoss;return 100-(100/(1+rs));
}
function stochasticValue(history,period=14,smooth=3){
  if(history.length<period+smooth-1)return {k:NaN,d:NaN};
  const ks=[];
  for(let end=history.length-smooth;end<history.length;end++){
    const slice=history.slice(end-period+1,end+1),high=Math.max(...slice.map(x=>+x.high||+x.close)),low=Math.min(...slice.map(x=>+x.low||+x.close)),close=+history[end].close;
    ks.push(high===low?50:((close-low)/(high-low))*100);
  }
  return {k:ks.at(-1),d:mean(ks)};
}
function atrValue(history,period=14){
  if(history.length<period+1)return NaN;
  const trs=[];
  for(let i=1;i<history.length;i++){
    const h=+history[i].high||+history[i].close,l=+history[i].low||+history[i].close,pc=+history[i-1].close;
    trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
  }
  let atr=mean(trs.slice(0,period));
  for(let i=period;i<trs.length;i++)atr=((atr*(period-1))+trs[i])/period;
  return atr;
}
function result(key,name,status,value,reason,vote=0){return {key,name,status,value,reason,vote}}
function calculateIndicatorSignals(history,activeKeys){
  const h=[...history].filter(x=>present(x.close)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const closes=h.map(x=>+x.close),last=closes.at(-1),prev=closes.at(-2),results=[];
  if(activeKeys.includes('rsi')){
    const r=rsiValue(closes,14);
    if(!Number.isFinite(r))results.push(result('rsi','RSI 14','NÖTR','—','En az 15 günlük veri gerekir.'));
    else if(r<30)results.push(result('rsi','RSI 14','AL',num(r,1),'30 altı: aşırı satım bölgesi.',1));
    else if(r>70)results.push(result('rsi','RSI 14','SAT',num(r,1),'70 üstü: aşırı alım bölgesi.',-1));
    else results.push(result('rsi','RSI 14','NÖTR',num(r,1),'30–70 aralığında.'));
  }
  if(activeKeys.includes('macd')){
    if(closes.length<35)results.push(result('macd','MACD','NÖTR','—','MACD 12/26/9 için en az 35 günlük veri gerekir.'));
    else{
      const e12=emaSeries(closes,12),e26=emaSeries(closes,26),macd=e12.map((v,i)=>v-e26[i]),sig=emaSeries(macd,9),d=macd.at(-1)-sig.at(-1),pd=macd.at(-2)-sig.at(-2);
      const val=`${num(macd.at(-1),2)} / ${num(sig.at(-1),2)}`;
      if(pd<=0&&d>0)results.push(result('macd','MACD','AL',val,'MACD, sinyal çizgisini yukarı kesti.',1));
      else if(pd>=0&&d<0)results.push(result('macd','MACD','SAT',val,'MACD, sinyal çizgisini aşağı kesti.',-1));
      else if(d>0&&macd.at(-1)>0)results.push(result('macd','MACD','AL',val,'MACD sinyal üstünde ve sıfırın üzerinde.',1));
      else if(d<0&&macd.at(-1)<0)results.push(result('macd','MACD','SAT',val,'MACD sinyal altında ve sıfırın altında.',-1));
      else results.push(result('macd','MACD','NÖTR',val,'Kesin yön teyidi yok.'));
    }
  }
  if(activeKeys.includes('sma')){
    const s20=smaAt(closes,20),s50=smaAt(closes,50);
    if(!Number.isFinite(s50))results.push(result('sma','SMA 20/50','NÖTR','—','En az 50 günlük veri gerekir.'));
    else if(s20>s50&&last>s20)results.push(result('sma','SMA 20/50','AL',`${num(s20)} / ${num(s50)}`,'Kısa ortalama uzun ortalamanın, fiyat da kısa ortalamanın üzerinde.',1));
    else if(s20<s50&&last<s20)results.push(result('sma','SMA 20/50','SAT',`${num(s20)} / ${num(s50)}`,'Kısa ortalama uzun ortalamanın, fiyat da kısa ortalamanın altında.',-1));
    else results.push(result('sma','SMA 20/50','NÖTR',`${num(s20)} / ${num(s50)}`,'Trend ve fiyat aynı yönde teyit vermiyor.'));
  }
  if(activeKeys.includes('ema')){
    const e12=emaSeries(closes,12),e26=emaSeries(closes,26),a=e12.at(-1),b=e26.at(-1);
    if(closes.length<26)results.push(result('ema','EMA 12/26','NÖTR','—','En az 26 günlük veri gerekir.'));
    else if(a>b&&last>a)results.push(result('ema','EMA 12/26','AL',`${num(a)} / ${num(b)}`,'Kısa EMA uzun EMA’nın, fiyat da kısa EMA’nın üzerinde.',1));
    else if(a<b&&last<a)results.push(result('ema','EMA 12/26','SAT',`${num(a)} / ${num(b)}`,'Kısa EMA uzun EMA’nın, fiyat da kısa EMA’nın altında.',-1));
    else results.push(result('ema','EMA 12/26','NÖTR',`${num(a)} / ${num(b)}`,'EMA yapısı karışık.'));
  }
  if(activeKeys.includes('bollinger')){
    const mid=smaAt(closes,20),sd=stddev(closes.slice(-20)),upper=mid+2*sd,lower=mid-2*sd;
    if(closes.length<20)results.push(result('bollinger','Bollinger 20/2','NÖTR','—','En az 20 günlük veri gerekir.'));
    else if(last<lower)results.push(result('bollinger','Bollinger 20/2','AL',`${num(lower)}–${num(upper)}`,'Fiyat alt bandın altında.',1));
    else if(last>upper)results.push(result('bollinger','Bollinger 20/2','SAT',`${num(lower)}–${num(upper)}`,'Fiyat üst bandın üzerinde.',-1));
    else results.push(result('bollinger','Bollinger 20/2','NÖTR',`${num(lower)}–${num(upper)}`,'Fiyat bantların içinde.'));
  }
  if(activeKeys.includes('stochastic')){
    const s=stochasticValue(h,14,3),val=`${num(s.k,1)} / ${num(s.d,1)}`;
    if(!Number.isFinite(s.k))results.push(result('stochastic','Stokastik 14/3','NÖTR','—','En az 16 günlük OHLC veri gerekir.'));
    else if(s.k<20&&s.k>s.d)results.push(result('stochastic','Stokastik 14/3','AL',val,'Aşırı satım bölgesinde %K, %D’nin üzerinde.',1));
    else if(s.k>80&&s.k<s.d)results.push(result('stochastic','Stokastik 14/3','SAT',val,'Aşırı alım bölgesinde %K, %D’nin altında.',-1));
    else results.push(result('stochastic','Stokastik 14/3','NÖTR',val,'Aşırı bölge ve dönüş teyidi birlikte oluşmadı.'));
  }
  if(activeKeys.includes('volume')){
    const vols=h.map(x=>+x.volume||0),avg=mean(vols.slice(-21,-1)),v=vols.at(-1),change=prev?((last/prev)-1)*100:0,ratio=avg>0?v/avg:NaN;
    if(!Number.isFinite(ratio))results.push(result('volume','Hacim teyidi','NÖTR','—','Hacim verisi bulunmuyor.'));
    else if(ratio>=1.5&&change>0)results.push(result('volume','Hacim teyidi','AL',`${num(ratio,2)}x`,'Yükseliş, 20 günlük ortalamanın en az 1,5 katı hacimle teyit edildi.',1));
    else if(ratio>=1.5&&change<0)results.push(result('volume','Hacim teyidi','SAT',`${num(ratio,2)}x`,'Düşüş, 20 günlük ortalamanın en az 1,5 katı hacimle teyit edildi.',-1));
    else results.push(result('volume','Hacim teyidi','NÖTR',`${num(ratio,2)}x`,'Hacim yön teyidi için yeterince yüksek değil.'));
  }
  if(activeKeys.includes('atr')){
    const atr=atrValue(h,14),pct=Number.isFinite(atr)&&last?atr/last*100:NaN;
    results.push(result('atr','ATR 14','RİSK',Number.isFinite(atr)?`${num(atr)} · %${num(pct)}`:'—',Number.isFinite(atr)?`Günlük tipik fiyat hareketi yaklaşık ${num(atr)}; 2 ATR risk mesafesi ${num(atr*2)}.`:'En az 15 günlük OHLC veri gerekir.',0));
  }
  return results;
}
function indicatorActive(){
  const settings=ensureIndicatorSettings();
  return settings.active.filter(k=>INDICATOR_DEFS.some(d=>d.key===k));
}
function saveIndicatorSelection(active){ensureIndicatorSettings().active=active;save();renderIndicatorOptions();renderIndicatorPanel()}
function renderIndicatorOptions(){
  const box=$('indicatorOptions');if(!box)return;const active=indicatorActive();
  box.innerHTML=INDICATOR_DEFS.map(d=>`<button class="indicatorToggle ${active.includes(d.key)?'active':''}" data-indicator="${d.key}">${d.label}</button>`).join('');
}
function consensus(results){
  const directional=results.filter(r=>r.status!=='RİSK'),buy=directional.filter(r=>r.vote===1).length,sell=directional.filter(r=>r.vote===-1).length,neutral=directional.filter(r=>r.vote===0).length,net=buy-sell;
  let label='NÖTR / BEKLE',cls='neutral';
  if(directional.length<2){label='VERİ YETERSİZ';cls='neutral'}else if(net>=2){label='TEKNİK AL';cls='buy'}else if(net<=-2){label='TEKNİK SAT';cls='sell'}
  return {label,cls,buy,sell,neutral,net,total:directional.length};
}
function renderIndicatorPanel(){
  const panel=$('indicatorLab');if(!panel)return;renderIndicatorOptions();
  const a=state.lastAsset;
  if(!a){$('indicatorConsensus').innerHTML='<div class="empty">Önce grafik için bir varlık seç.</div>';$('indicatorResults').innerHTML='';return}
  const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a,hist=cachedHistory(live),active=indicatorActive();
  $('indicatorSymbol').textContent=`${live.symbol} · günlük kapanış verisi`;
  if(hist.length<20){
    $('indicatorConsensus').innerHTML='<div class="empty">Teknik göstergeler için günlük fiyat geçmişi yükleniyor veya henüz mevcut değil.</div>';
    $('indicatorResults').innerHTML='';
    if(!historyLoading.has(assetKey(live)))ensureHistory(live,false);
    return;
  }
  const results=calculateIndicatorSignals(hist,active),c=consensus(results);
  $('indicatorConsensus').innerHTML=`<div class="technicalConsensus ${c.cls}"><div><span>Birleşik teknik sinyal</span><strong>${c.label}</strong></div><div class="voteCounts"><b>${c.buy} AL</b><b>${c.sell} SAT</b><b>${c.neutral} NÖTR</b></div><p>Net skor ${c.net>0?'+':''}${c.net} / ${c.total} yönsel gösterge. Bu sonuç yalnızca seçili teknik göstergelerin oyudur; MIC’in profil ve temel analiz kararı değildir.</p></div>`;
  $('indicatorResults').innerHTML=results.map(r=>`<div class="indicatorResult ${r.status==='AL'?'buy':r.status==='SAT'?'sell':r.status==='RİSK'?'risk':'neutral'}"><div class="indicatorResultTop"><strong>${r.name}</strong><span>${r.status}</span></div><div class="indicatorValue">${esc(r.value)}</div><p>${esc(r.reason)}</p></div>`).join('');
}

$('indicatorOptions').onclick=e=>{
  const b=e.target.closest('[data-indicator]');if(!b)return;
  const key=b.dataset.indicator,active=new Set(indicatorActive());active.has(key)?active.delete(key):active.add(key);saveIndicatorSelection([...active]);
};
$('indicatorAll').onclick=()=>saveIndicatorSelection([...DEFAULT_INDICATORS]);
$('indicatorClear').onclick=()=>saveIndicatorSelection([]);

const originalDrawLastChart=drawLastChart;
drawLastChart=function(){originalDrawLastChart();setTimeout(renderIndicatorPanel,0)};
const originalOpenChart=openChart;
openChart=function(a){originalOpenChart(a);setTimeout(renderIndicatorPanel,0)};
renderIndicatorOptions();renderIndicatorPanel();
