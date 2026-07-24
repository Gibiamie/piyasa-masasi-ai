/* MIC v17 quality fixes
 * - Stops missing-history retry loops and chart shaking.
 * - Keeps the indicator menu open during individual selections.
 * - Adds ETF-specific data coverage and scoring instead of company metrics.
 */
(() => {
  if (window.__MIC_QUALITY_V17) return;
  window.__MIC_QUALITY_V17 = true;

  const desktop=location.pathname.includes('mic-desktop');
  const sub=document.querySelector('.top .sub');
  if(sub)sub.textContent=desktop?'Laptop web · yatırım karar desteği · v17':'Mobil yatırım karar desteği · v17';
  document.title=desktop?'MIC Laptop Web Beta v17':'MIC Mobile Beta v17';

  const historyAttempts=window.MIC_HISTORY_ATTEMPTS_V17||(window.MIC_HISTORY_ATTEMPTS_V17=new Map());
  let renderPending=false;
  function queueWorkspaceRender(){
    if(renderPending)return;
    renderPending=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      renderPending=false;
      window.dispatchEvent(new Event('resize'));
    }));
  }
  function setChartMessage(text,visible=true){
    const m=document.getElementById('chartMessage'),c=document.getElementById('chartCanvas');
    if(m){m.textContent=text;m.classList.toggle('hidden',!visible);m.setAttribute('aria-live','polite');}
    if(c)c.classList.remove('hidden');
  }

  const originalEnsureHistory=typeof ensureHistory==='function'?ensureHistory:null;
  if(originalEnsureHistory){
    ensureHistory=async function(a,notify=true){
      if(!a)return false;
      const key=assetKey(a);
      historyAttempts.set(key,{status:'loading',at:Date.now()});
      await originalEnsureHistory(a,notify);
      const ok=cachedHistory(a).length>=2;
      historyAttempts.set(key,{status:ok?'ok':'failed',at:Date.now()});
      return ok;
    };
  }

  drawLastChart=function(){
    try{renderPeriodButtons();}catch{}
    const a=state?.lastAsset,title=document.getElementById('chartTitle');
    if(!a){if(title)title.textContent='';setChartMessage('Önce bir varlık seç.');queueWorkspaceRender();return;}
    const live=(market?.assets||[]).find(x=>x.symbol===a.symbol&&x.type===a.type)||a;
    if(title)title.textContent=`${live.symbol} · ${live.name}`;
    const interval=state?.settings?.chartWorkspace?.interval||'1D';
    if(interval==='1H'||interval==='4H'){setChartMessage('',false);queueWorkspaceRender();return;}
    const hist=cachedHistory(live),key=assetKey(live),loading=typeof historyLoading!=='undefined'&&historyLoading.has(key),attempt=historyAttempts.get(key);
    if(hist.length>=2){
      historyAttempts.set(key,{status:'ok',at:Date.now()});
      setChartMessage('',false);queueWorkspaceRender();
      try{renderIndicatorPanel();}catch{}
      return;
    }
    if(loading||attempt?.status==='loading'){
      setChartMessage(`${live.symbol} günlük fiyat verisi yükleniyor…`);return;
    }
    if(attempt?.status==='failed'){
      setChartMessage(`${live.symbol} için günlük fiyat dosyası alınamadı. Grafik verisini yenile düğmesiyle yeniden deneyin.`);return;
    }
    setChartMessage(`${live.symbol} günlük fiyat verisi yükleniyor…`);
    historyAttempts.set(key,{status:'loading',at:Date.now()});
    if(originalEnsureHistory){
      originalEnsureHistory(live,false).then(()=>{
        const ok=cachedHistory(live).length>=2;
        historyAttempts.set(key,{status:ok?'ok':'failed',at:Date.now()});
        drawLastChart();
      }).catch(()=>{historyAttempts.set(key,{status:'failed',at:Date.now()});drawLastChart();});
    }
  };

  const reload=document.getElementById('loadChartData');
  if(reload&&originalEnsureHistory){
    reload.onclick=async()=>{
      const a=state.lastAsset;if(!a)return toast('Önce varlık seç');
      historyAttempts.delete(assetKey(a));
      reload.disabled=true;const old=reload.textContent;reload.textContent='Grafik verisi yenileniyor…';
      try{await ensureHistory(a,true);}finally{reload.disabled=false;reload.textContent=old;drawLastChart();}
    };
  }

  function installPersistentIndicatorMenu(){
    const popup=document.getElementById('indicatorMenuV13');
    if(!popup){setTimeout(installPersistentIndicatorMenu,80);return;}
    if(popup.dataset.persistentV17)return;
    popup.dataset.persistentV17='1';
    popup.addEventListener('click',e=>{
      if(e.target.closest('[data-indicator],#indicatorEnableAllV16,#indicatorDisableAllV16')){
        e.stopPropagation();
        setTimeout(()=>popup.classList.remove('hidden'),0);
      }
    });
    const header=popup.querySelector('.indicatorMenuHeaderV10 span');
    if(header)header.textContent='Tek tek veya toplu seçim yapın; pencere siz kapatana kadar açık kalır.';
  }
  installPersistentIndicatorMenu();

  function avg(xs){return xs.length?xs.reduce((s,v)=>s+v,0)/xs.length:NaN}
  function stdev(xs){if(xs.length<2)return NaN;const m=avg(xs);return Math.sqrt(avg(xs.map(x=>(x-m)**2)))}
  function maxDrawdown(closes){let peak=-Infinity,dd=0;for(const c of closes){peak=Math.max(peak,c);if(peak>0)dd=Math.min(dd,c/peak-1)}return dd*100}
  function etfAnalytics(a){
    const hist=cachedHistory(a),closes=hist.map(x=>+x.close).filter(Number.isFinite),volumes=hist.map(x=>+x.volume||0);
    const returns=[];for(let i=1;i<closes.length;i++)if(closes[i-1])returns.push(closes[i]/closes[i-1]-1);
    const annualVol=Number.isFinite(stdev(returns))?stdev(returns)*Math.sqrt(252)*100:NaN;
    const dd=closes.length?maxDrawdown(closes):NaN,last=closes.at(-1),s20=closes.length>=20?avg(closes.slice(-20)):NaN,s50=closes.length>=50?avg(closes.slice(-50)):NaN;
    const avgDollar=hist.length?avg(hist.slice(-20).map(x=>(+x.close||0)*(+x.volume||0))):NaN;
    let technical=5;
    if(Number.isFinite(s20)&&last>s20)technical+=2;else if(Number.isFinite(s20))technical-=2;
    if(Number.isFinite(s50)&&s20>s50)technical+=2;else if(Number.isFinite(s50))technical-=1;
    technical=Math.max(1,Math.min(10,technical));
    const structure=(a.underlying_exposure&&a.strategy&&a.fund_inception)?26:18;
    let income=4;
    if(present(a.distribution_rate))income+=4;
    if(a.distribution_frequency)income+=2;
    if(present(a.performance?.['1Y']))income+=Math.max(0,Math.min(10,(+a.performance['1Y'])/3));
    income=Math.round(Math.min(20,income));
    const fee=+a.expense_ratio;
    const valuation=!Number.isFinite(fee)?6:fee<=.25?15:fee<=.50?12:fee<=.75?9:fee<=1?6:3;
    const liquidity=!Number.isFinite(avgDollar)?3:avgDollar>=50_000_000?10:avgDollar>=10_000_000?8:avgDollar>=2_000_000?6:3;
    let risk=7;
    if(Number.isFinite(annualVol))risk=annualVol<15?15:annualVol<25?12:annualVol<35?8:5;
    if(Number.isFinite(dd)&&dd<-20)risk=Math.min(risk,6);
    const modules={history:hist.length>=35,fundIdentity:!!(a.underlying_exposure&&a.fund_inception),expenses:present(a.expense_ratio),distribution:present(a.distribution_rate),liquidity:Number.isFinite(avgDollar),technical:hist.length>=35};
    const known=Object.values(modules).filter(Boolean).length,missing=[];
    if(!modules.history)missing.push(`en az 35 tamamlanmış günlük OHLCV kaydı (${hist.length} mevcut)`);
    if(!modules.fundIdentity)missing.push('fon stratejisi ve dayanak endeks bilgisi');
    if(!modules.expenses)missing.push('gider oranı');
    if(!modules.distribution)missing.push('dağıtım oranı ve sıklığı');
    if(!a.data_coverage?.holdings_concentration)missing.push('güncel portföy yoğunlaşması');
    if(!a.data_coverage?.premium_discount_history)missing.push('NAV prim/iskonto geçmişi');
    const macro=liquidity,total=Math.round(structure+income+valuation+technical+macro+risk);
    return {business:structure,growth:income,valuation,technical,macro,risk,score:Math.max(0,Math.min(100,total)),confidence:Math.min(95,35+known*10),known,historyCount:hist.length,annualVol,maxDrawdown:dd,avgDollar,s20,s50,last,missing,modules,analysisType:'etf'};
  }

  const baseScoreAsset=scoreAsset;
  scoreAsset=function(a){return a?.type==='etf'?etfAnalytics(a):baseScoreAsset(a)};
  const baseDecision=decision;
  decision=function(a,s){
    if(a?.type!=='etf')return baseDecision(a,s);
    if(!profileComplete())return {action:'PROFİL GEREKLİ',summary:'Önce yatırımcı profili tamamlanmalıdır.',details:['Profil olmadan pozisyon kararı üretilmez.'],cls:'warn'};
    const ps=portfolioStats(),held=ps.rows.find(x=>x.symbol===a.symbol&&x.type===a.type),weight=held?.weight||0,cap=profileCap(a),band=+state.profile.rebalanceBand;
    const coverage=`ETF veri kapsamı: ${s.historyCount} günlük OHLCV; fon kimliği, ücret, dağıtım ve likidite modüllerinden ${s.known}/6 mevcut.`;
    if(held&&weight>cap+band){
      const d=baseDecision(a,s);d.details[0]=coverage;return d;
    }
    if(s.historyCount<35){
      return {action:'FİYAT GEÇMİŞİ EKSİK',summary:'Teknik karar üretilmedi',details:[coverage,`Eksik: ${s.missing.join('; ')}.`,'Günlük veriden yapay geçmiş üretilmez.'],cls:'warn'};
    }
    const results=typeof calculateIndicatorSignals==='function'?calculateIndicatorSignals(cachedHistory(a),indicatorActive()):[];
    const c=typeof consensus==='function'?consensus(results):{label:'NÖTR / BEKLE',net:0,total:0};
    const details=[coverage,`ETF puanı ${s.score}/100; veri güveni %${s.confidence}.`,`Teknik gösterge oyu: ${c.label}; net ${c.net>0?'+':''}${c.net}/${c.total}.`,`Eksik fakat kararı engellemeyen alanlar: ${s.missing.join('; ')}.`];
    if(held){details.push(`Mevcut ağırlık %${num(weight)}; profil limiti %${num(cap)} ±%${num(band)}.`);return {action:'TUT / GÖZDEN GEÇİR',summary:'Ağırlık profil bandı içinde',details,cls:''};}
    if(c.label==='TEKNİK SAT')return {action:'İZLE / YENİ POZİSYON AÇMA',summary:'Teknik yapı olumsuz',details,cls:'bad'};
    if(s.score>=75&&c.net>=0)return {action:'ADAY / KADEMELİ İNCELE',summary:'Profil limiti içinde aday',details,cls:''};
    return {action:'İZLE',summary:'Yeni pozisyon için ek teyit bekle',details,cls:'warn'};
  };

  const baseAnalyzeAsset=analyzeAsset;
  analyzeAsset=async function(a){
    if(a?.type!=='etf')return baseAnalyzeAsset(a);
    state.lastAsset=a;save();
    let hist=cachedHistory(a);
    if(hist.length<2&&originalEnsureHistory){
      $('analysisPanel').classList.remove('hidden');
      $('analysisPanel').innerHTML='<div class="empty">ETF günlük fiyat geçmişi yükleniyor…</div>';
      historyAttempts.delete(assetKey(a));
      await ensureHistory(a,false);
      hist=cachedHistory(a);
    }
    const live=(market.assets||[]).find(x=>x.symbol===a.symbol&&x.type===a.type)||a,s=scoreAsset(live),d=decision(live,s);
    state.lastDecision={action:d.action,symbol:live.symbol,summary:d.summary};save();
    const missing=s.missing.length?s.missing.join(' · '):'Yok';
    $('analysisPanel').classList.remove('hidden');
    $('analysisPanel').innerHTML=`<div class="assetTop"><div><div class="symbol">${live.price!=null?money(live.price,live.currency):s.last?money(s.last,live.currency):'Fiyat yok'}</div><div class="assetName">ETF analizi · ${s.historyCount} günlük gerçek OHLCV</div></div><span class="badge">ETF MIC ${s.score}/100</span></div>
      <div class="analysis"><div class="cell"><span>Veri güveni</span><strong>%${s.confidence}</strong></div><div class="cell"><span>Fon yapısı</span><strong>${s.business}/30</strong></div><div class="cell"><span>Gelir / performans</span><strong>${s.growth}/20</strong></div><div class="cell"><span>Ücret yapısı</span><strong>${s.valuation}/15</strong></div><div class="cell"><span>Teknik</span><strong>${s.technical}/10</strong></div><div class="cell"><span>Risk kalitesi</span><strong>${s.risk}/15</strong></div></div>
      <div class="etfCoverageV17"><b>Veri kapsamı</b><span>Gider oranı ${present(live.expense_ratio)?'%'+num(live.expense_ratio,2):'yok'} · Dağıtım ${present(live.distribution_rate)?'%'+num(live.distribution_rate,2):'yok'} · AUM ${present(live.net_assets)?money(live.net_assets,'USD'):'yok'} · Yıllıklaştırılmış oynaklık ${Number.isFinite(s.annualVol)?'%'+num(s.annualVol,1):'hesaplanamadı'}</span><small>Eksik alanlar: ${esc(missing)}</small></div>
      <div class="decision ${d.cls||''}"><div class="decisionTitle">${esc(d.action)}</div><div>${esc(d.summary)}</div><ul class="reason">${d.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  };

  setTimeout(()=>{
    installPersistentIndicatorMenu();
    if(state?.lastAsset?.symbol==='QQQI')drawLastChart();
  },250);
})();
