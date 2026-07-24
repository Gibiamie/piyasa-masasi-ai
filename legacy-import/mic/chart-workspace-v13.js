(() => {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const INTRADAY=new Set(['1H','4H']);
  const runtime={zoom:1,offset:0,hoverIndex:null,drag:null,lastKey:'',rendering:false,loading:false};

  function settings(){
    state.settings=state.settings||{};
    state.settings.chartWorkspace={interval:'1D',chartType:'candles',...(state.settings.chartWorkspace||{})};
    state.settings.intradayCache=state.settings.intradayCache||{};
    state.settings.marketGateway={url:'',token:'',...(state.settings.marketGateway||{})};
    return state.settings.chartWorkspace;
  }
  function active(){try{return indicatorActive()}catch{return state.settings?.indicators?.active||[]}}
  function intervalName(x){return ({'1H':'1 Saatlik','4H':'4 Saatlik','1D':'Günlük','1W':'Haftalık','1M':'Aylık'})[x]||x}
  function isIntraday(x=settings().interval){return INTRADAY.has(x)}
  function marketKind(a){
    if(a.type==='crypto')return 'CRYPTO';
    if(String(a.exchange||'').toUpperCase().includes('BIST'))return 'BIST';
    return 'US';
  }
  function gateway(){return state.settings.marketGateway}
  function intradayKey(a,interval){return `${marketKind(a)}:${a.symbol}:${interval}`}
  function normalizeSymbol(a){
    if(a.type==='crypto')return String(a.symbol).includes('/')?a.symbol:`${a.symbol}/USD`;
    return String(a.symbol||'').toUpperCase();
  }

  function setup(){
    const card=document.querySelector('.chartCard');
    if(!card||document.getElementById('chartWorkspaceToolbarV13'))return;
    ['chartWorkspaceToolbarV10','chartWorkspaceToolbar','chartLegendV10','chartLegend','indicatorPanesV10','indicatorPanes','chartCrosshairTipV10','chartCrosshairTip'].forEach(id=>document.getElementById(id)?.remove());

    document.querySelectorAll('#chartPeriods .period').forEach(b=>{
      const labels={'1H':'1 Hafta','1A':'1 Ay','3A':'3 Ay','6A':'6 Ay','1Y':'1 Yıl','YTD':'YTD'};
      b.textContent=labels[b.dataset.period]||b.textContent;
    });

    const toolbar=document.createElement('div');
    toolbar.id='chartWorkspaceToolbarV13';toolbar.className='chartToolbarV10 chartToolbarV13';
    toolbar.innerHTML=`
      <div class="chartToolbarRow">
        <div class="chartTypeGroup"><button id="chartTypeCandles" class="chartToolV10">Mum</button><button id="chartTypeLine" class="chartToolV10">Çizgi</button></div>
        <div id="chartIntervalButtons" class="chartIntervalButtons" aria-label="Mum aralığı">
          <button data-interval="1H" class="chartToolV10">1 Saat</button>
          <button data-interval="4H" class="chartToolV10">4 Saat</button>
          <button data-interval="1D" class="chartToolV10">1 Gün</button>
          <button data-interval="1W" class="chartToolV10">1 Hafta</button>
          <button data-interval="1M" class="chartToolV10">1 Ay</button>
        </div>
        <button id="chartResetV13" class="chartToolV10">Görünümü sıfırla</button>
        <div class="indicatorMenuWrapV10">
          <button id="indicatorMenuButtonV13" class="chartToolV10">Göstergeler <span id="indicatorMenuCountV13"></span></button>
          <div id="indicatorMenuV13" class="indicatorMenuV10 hidden">
            <div class="indicatorMenuHeaderV10"><div><strong>Göstergeler</strong><span>Grafiğe ekle veya kaldır</span></div><button id="indicatorMenuCloseV13" class="indicatorCloseV10">×</button></div>
            <p>SMA, EMA, Bollinger ve Supertrend ana grafikte; RSI, MACD, Stokastik, Hacim, ATR ve OTTO senkron alt panellerde gösterilir.</p>
          </div>
        </div>
      </div>
      <div id="chartDataClassV13" class="chartDataClassV10"></div>`;
    card.querySelector('.chartHeader').insertAdjacentElement('afterend',toolbar);

    const popup=toolbar.querySelector('#indicatorMenuV13');
    const actions=document.querySelector('#indicatorLab .indicatorActions');
    const options=document.getElementById('indicatorOptions');
    if(actions)popup.appendChild(actions);
    if(options)popup.appendChild(options);

    const legend=document.createElement('div');legend.id='chartLegendV13';legend.className='chartLegendV10';
    document.getElementById('chartCanvas').insertAdjacentElement('afterend',legend);
    const panes=document.createElement('div');panes.id='indicatorPanesV13';panes.className='indicatorPanesV10';
    legend.insertAdjacentElement('afterend',panes);
    const tip=document.createElement('div');tip.id='chartCrosshairTipV13';tip.className='chartCrosshairTipV10 hidden';card.appendChild(tip);

    toolbar.querySelector('#chartTypeCandles').onclick=()=>{settings().chartType='candles';save();paintControls();schedule(true)};
    toolbar.querySelector('#chartTypeLine').onclick=()=>{settings().chartType='line';save();paintControls();schedule(true)};
    toolbar.querySelector('#chartIntervalButtons').onclick=async e=>{
      const b=e.target.closest('[data-interval]');if(!b)return;
      settings().interval=b.dataset.interval;runtime.zoom=1;runtime.offset=0;runtime.hoverIndex=null;runtime.lastKey='';save();paintControls();schedule(true);
      if(isIntraday())await ensureIntraday(state.lastAsset,settings().interval,true);
    };
    toolbar.querySelector('#chartResetV13').onclick=()=>{runtime.zoom=1;runtime.offset=0;runtime.hoverIndex=null;schedule(true)};
    toolbar.querySelector('#indicatorMenuButtonV13').onclick=e=>{e.stopPropagation();popup.classList.toggle('hidden')};
    toolbar.querySelector('#indicatorMenuCloseV13').onclick=()=>popup.classList.add('hidden');
    document.addEventListener('click',e=>{if(!e.target.closest('.indicatorMenuWrapV10'))popup.classList.add('hidden')});
    document.addEventListener('mic:indicators-changed',()=>{paintControls();schedule(true)});
    document.addEventListener('click',e=>{if(e.target.closest('[data-indicator],#indicatorAll,#indicatorClear'))setTimeout(()=>{paintControls();schedule(true)},0)});
    attach(document.getElementById('chartCanvas'));
    addGatewayCard();
    paintControls();
  }

  function addGatewayCard(){
    const section=document.getElementById('settings');
    if(!section||document.getElementById('intradayGatewayCard'))return;
    const card=document.createElement('div');card.id='intradayGatewayCard';card.className='card';
    card.innerHTML=`<div class="section"><div><h3>1 Saat / 4 Saat Veri Bağlantısı</h3><span class="source">Sistem yöneticisi ayarı</span></div><span class="badge">INTRADAY</span></div>
      <p class="muted">ABD ve kripto için MIC Market Gateway adresi bağlandığında gerçek 1s/4s mumlar otomatik açılır. BIST intraday, lisanslı sağlayıcı olmadan açılmaz.</p>
      <label>Gateway adresi<input id="gatewayUrl" type="url" placeholder="https://gateway.example.com" value="${esc(gateway().url||'')}"></label>
      <label style="margin-top:10px">Erişim anahtarı — isteğe bağlı<input id="gatewayToken" type="password" placeholder="Sunucu tokeni" value="${esc(gateway().token||'')}"></label>
      <div class="apiButtons"><button id="saveGateway" class="primary">Kaydet</button><button id="testGateway" class="ghost">Bağlantıyı test et</button></div><div id="gatewayStatus" class="hint"></div>`;
    const first=section.querySelector('.card');first?first.insertAdjacentElement('beforebegin',card):section.appendChild(card);
    card.querySelector('#saveGateway').onclick=()=>{state.settings.marketGateway={url:card.querySelector('#gatewayUrl').value.trim().replace(/\/$/,''),token:card.querySelector('#gatewayToken').value.trim()};save();card.querySelector('#gatewayStatus').textContent=gateway().url?'Bağlantı adresi kaydedildi.':'Gateway adresi silindi.';toast('Intraday bağlantı ayarı kaydedildi')};
    card.querySelector('#testGateway').onclick=async()=>{
      state.settings.marketGateway={url:card.querySelector('#gatewayUrl').value.trim().replace(/\/$/,''),token:card.querySelector('#gatewayToken').value.trim()};save();
      const status=card.querySelector('#gatewayStatus');if(!gateway().url){status.textContent='Önce Gateway adresini gir.';return}
      status.textContent='Bağlantı test ediliyor…';
      try{const r=await fetch(gateway().url+'/health',{headers:gateway().token?{authorization:`Bearer ${gateway().token}`}:{},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();status.textContent=`Bağlantı başarılı: ${j.service||'MIC Market Gateway'}`;toast('Gateway bağlantısı başarılı')}
      catch(e){status.textContent='Bağlantı başarısız: '+e.message;toast('Gateway bağlantısı başarısız')}
    };
  }

  function paintControls(){
    const s=settings();
    document.getElementById('chartTypeCandles')?.classList.toggle('active',s.chartType==='candles');
    document.getElementById('chartTypeLine')?.classList.toggle('active',s.chartType==='line');
    document.querySelectorAll('#chartIntervalButtons [data-interval]').forEach(b=>b.classList.toggle('active',b.dataset.interval===s.interval));
    const c=document.getElementById('indicatorMenuCountV13');if(c)c.textContent=`(${active().length})`;
  }

  function aggregate(rows,interval){
    const source=[...rows].filter(x=>Number.isFinite(+x.close)).sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>({date:String(x.date),open:+x.open||+x.close,high:+x.high||+x.close,low:+x.low||+x.close,close:+x.close,volume:+x.volume||0}));
    if(['1H','4H','1D'].includes(interval))return source;
    const groups=new Map();
    source.forEach(x=>{
      const d=new Date(`${String(x.date).slice(0,10)}T00:00:00Z`);let key;
      if(interval==='1M')key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
      else{const day=(d.getUTCDay()+6)%7,mon=new Date(d);mon.setUTCDate(d.getUTCDate()-day);key=mon.toISOString().slice(0,10)}
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);
    });
    return [...groups.values()].map(g=>({date:g.at(-1).date,open:g[0].open,high:Math.max(...g.map(x=>x.high)),low:Math.min(...g.map(x=>x.low)),close:g.at(-1).close,volume:g.reduce((s,x)=>s+x.volume,0),sourceCount:g.length}));
  }

  function visible(data){
    if(!data.length)return{rows:[],start:0,end:0};
    const minBars=Math.min(8,data.length),count=clamp(Math.round(data.length/runtime.zoom),minBars,data.length),maxOffset=Math.max(0,data.length-count);
    runtime.offset=clamp(Math.round(runtime.offset),0,maxOffset);const end=data.length-runtime.offset,start=Math.max(0,end-count);
    return{rows:data.slice(start,end),start,end};
  }
  function schedule(force=false){if(runtime.rendering&&!force)return;runtime.rendering=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{runtime.rendering=false;render()}))}

  function intradayRows(a,interval){return state.settings.intradayCache?.[intradayKey(a,interval)]?.bars||[]}
  function dataFor(a){
    const interval=settings().interval;
    if(isIntraday(interval))return intradayRows(a,interval);
    return aggregate(filterHistory(cachedHistory(a),chartPeriod),interval);
  }

  async function ensureIntraday(a,interval,notify=false){
    if(!a||!isIntraday(interval)||runtime.loading)return;
    const kind=marketKind(a),status=document.getElementById('chartDataClassV13');
    if(kind==='BIST'){
      if(status)status.innerHTML='<b>BIST INTRADAY KAPALI</b><span>Lisanslı veri sağlayıcısı bağlanmalıdır; günlük veriden 1s/4s üretilmez.</span>';
      showMessage('BIST 1 saatlik/4 saatlik veri, lisanslı sağlayıcı bağlantısı olmadan sunulmaz.');return;
    }
    if(!gateway().url){
      if(status)status.innerHTML='<b>INTRADAY BAĞLANTI BEKLİYOR</b><span>Ayarlar → 1 Saat / 4 Saat Veri Bağlantısı</span>';
      showMessage('Gerçek 1s/4s veri için MIC Market Gateway henüz bağlanmadı. Ayarlar bölümünden bağlantı adresini kaydet.');return;
    }
    runtime.loading=true;showMessage(`${intervalName(interval)} veri yükleniyor…`);
    try{
      const qs=new URLSearchParams({market:kind,symbol:normalizeSymbol(a),interval:interval.toLowerCase(),limit:'2000'});
      const headers=gateway().token?{authorization:`Bearer ${gateway().token}`}:{},r=await fetch(`${gateway().url}/api/v1/bars?${qs}`,{headers,cache:'no-store'}),j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.message||`HTTP ${r.status}`);
      const bars=(j.bars||[]).map(x=>({date:x.timestamp,open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+x.volume||0})).filter(x=>Number.isFinite(x.close));
      if(bars.length<2)throw new Error('Yeterli intraday bar gelmedi');
      state.settings.intradayCache[intradayKey(a,interval)]={bars,provider:j.provider||'MIC_GATEWAY',dataClass:j.data_class||'PROVIDER_NATIVE_BAR',sourceInterval:j.source_interval||interval.toLowerCase(),updatedAt:j.generated_at||new Date().toISOString()};save();
      if(notify)toast(`${intervalName(interval)} veri yüklendi`);
    }catch(e){showMessage('Intraday veri alınamadı: '+e.message);if(notify)toast('Intraday veri alınamadı')}
    finally{runtime.loading=false;schedule(true)}
  }

  function showMessage(text){const m=document.getElementById('chartMessage'),c=document.getElementById('chartCanvas');if(m){m.textContent=text;m.classList.remove('hidden')}if(c)c.classList.add('hidden')}

  function render(){
    setup();paintControls();
    const a=state.lastAsset,canvas=document.getElementById('chartCanvas'),panes=document.getElementById('indicatorPanesV13');if(!canvas||!panes)return;
    if(!a){panes.innerHTML='';return}
    const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a,interval=settings().interval,data=dataFor(live);
    const key=`${assetKey(live)}:${chartPeriod}:${interval}`;if(runtime.lastKey!==key){runtime.lastKey=key;runtime.zoom=1;runtime.offset=0;runtime.hoverIndex=null}
    const status=document.getElementById('chartDataClassV13');
    if(isIntraday(interval)){
      const meta=state.settings.intradayCache?.[intradayKey(live,interval)];
      if(status)status.innerHTML=meta?`<b>${esc(meta.dataClass)}</b><span>${meta.provider} · ${data.length} gerçek ${intervalName(interval).toLowerCase()} bar</span>`:`<b>${intervalName(interval).toUpperCase()} VERİ BEKLİYOR</b><span>Günlük veriden yapay intraday üretilmez</span>`;
      if(data.length<2){panes.innerHTML='';clear(canvas);ensureIntraday(live,interval,false);return}
    }else{
      const daily=filterHistory(cachedHistory(live),chartPeriod);
      if(status){if(interval==='1D')status.innerHTML=`<b>HAM GÜNLÜK OHLCV</b><span>${daily.length} günlük kayıt · ${data.length} mum</span>`;else status.innerHTML=`<b>TOPLULAŞTIRILMIŞ ${intervalName(interval).toUpperCase()} OHLCV</b><span>${daily.length} gerçek günlük kayıttan ${data.length} mum; ortalama alınmaz</span>`}
    }
    const view=visible(data),info=document.getElementById('chartInfo');if(info)info.textContent=`${live.exchange||''} · ${live.currency||''} · ${chartPeriod} görünüm · ${intervalName(interval)} mum · ${view.rows.length}/${data.length} bar`;
    if(!view.rows.length){clear(canvas);panes.innerHTML='';return}
    canvas.classList.remove('hidden');document.getElementById('chartMessage')?.classList.add('hidden');drawPrice(canvas,data,view);renderPanes(data,view);renderLegend();
  }

  function resize(canvas){const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);return{ctx,W:r.width,H:r.height}}
  function clear(canvas){const{ctx,W,H}=resize(canvas);ctx.clearRect(0,0,W,H)}
  function xAt(i,count,left,width){return count<=1?left+width/2:left+i/(count-1)*width}
  function yAt(v,min,max,top,height){return top+(max-v)/(max-min||1)*height}
  function grid(ctx,W,H,b){ctx.strokeStyle='#223650';ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=b.top+b.h*i/5;ctx.beginPath();ctx.moveTo(b.left,y);ctx.lineTo(W-b.right,y);ctx.stroke()}}
  function series(ctx,values,view,color,min,max,b,width=1.7,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();let begun=false;view.rows.forEach((_,j)=>{const v=values[view.start+j];if(!Number.isFinite(v))return;const x=xAt(j,view.rows.length,b.left,b.w),y=yAt(v,min,max,b.top,b.h);begun?ctx.lineTo(x,y):(ctx.moveTo(x,y),begun=true)});if(begun)ctx.stroke();ctx.setLineDash([])}
  function sma(values,p){return values.map((_,i)=>smaAt(values,p,i))}
  function ema(values,p){return emaSeries(values,p).map((v,i)=>i+1<p?NaN:v)}
  function bands(values){return values.map((_,i)=>{if(i<19)return{u:NaN,m:NaN,l:NaN};const s=values.slice(i-19,i+1),m=mean(s),sd=stddev(s);return{u:m+2*sd,m,l:m-2*sd}})}

  function drawPrice(canvas,data,view){
    const{ctx,W,H}=resize(canvas),b={left:56,right:16,top:28,bottom:30};b.w=W-b.left-b.right;b.h=H-b.top-b.bottom;
    const closes=data.map(x=>x.close),act=active(),overlays=[];let st=null;
    if(act.includes('sma'))overlays.push({n:'SMA20',v:sma(closes,20),c:'#65a9ff'},{n:'SMA50',v:sma(closes,50),c:'#f3a657'});
    if(act.includes('ema'))overlays.push({n:'EMA12',v:ema(closes,12),c:'#43d39a'},{n:'EMA26',v:ema(closes,26),c:'#bb8cff'});
    if(act.includes('bollinger')){const bb=bands(closes);overlays.push({n:'BB üst',v:bb.map(x=>x.u),c:'#8395ad',dash:[5,4]},{n:'BB alt',v:bb.map(x=>x.l),c:'#8395ad',dash:[5,4]})}
    if(act.includes('supertrend')&&window.micSupertrendSeries)st=micSupertrendSeries(data,10,3);
    let min=Math.min(...view.rows.map(x=>x.low)),max=Math.max(...view.rows.map(x=>x.high));overlays.forEach(o=>o.v.slice(view.start,view.end).forEach(v=>{if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}}));if(st)st.line.slice(view.start,view.end).forEach(v=>{if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}});
    const pad=(max-min)*.06||1;min-=pad;max+=pad;ctx.clearRect(0,0,W,H);grid(ctx,W,H,b);const spacing=b.w/Math.max(1,view.rows.length),body=clamp(spacing*.62,3,20);
    if(settings().chartType==='line')series(ctx,closes,view,'#42d39a',min,max,b,2.3);else view.rows.forEach((r,j)=>{const x=xAt(j,view.rows.length,b.left,b.w),up=r.close>=r.open,c=up?'#42d39a':'#ff6b78';ctx.strokeStyle=c;ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,yAt(r.high,min,max,b.top,b.h));ctx.lineTo(x,yAt(r.low,min,max,b.top,b.h));ctx.stroke();const yo=yAt(r.open,min,max,b.top,b.h),yc=yAt(r.close,min,max,b.top,b.h);ctx.fillRect(x-body/2,Math.min(yo,yc),body,Math.max(2,Math.abs(yc-yo)))});
    overlays.forEach(o=>series(ctx,o.v,view,o.c,min,max,b,1.6,o.dash||[]));
    if(st){
      for(let j=0;j<view.rows.length-1;j++){const i=view.start+j,n=i+1;if(!Number.isFinite(st.line[i])||!Number.isFinite(st.line[n]))continue;ctx.strokeStyle=st.direction[n]===1?'#2fc786':'#ff5968';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(xAt(j,view.rows.length,b.left,b.w),yAt(st.line[i],min,max,b.top,b.h));ctx.lineTo(xAt(j+1,view.rows.length,b.left,b.w),yAt(st.line[n],min,max,b.top,b.h));ctx.stroke()}
      view.rows.forEach((_,j)=>{const i=view.start+j,x=xAt(j,view.rows.length,b.left,b.w);if(st.buy[i])labelSignal(ctx,x,yAt(view.rows[j].low,min,max,b.top,b.h),'AL','#2fc786',false);if(st.sell[i])labelSignal(ctx,x,yAt(view.rows[j].high,min,max,b.top,b.h),'SAT','#ff5968',true)})
    }
    ctx.fillStyle='#9cabc1';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(num(max),4,b.top+4);ctx.fillText(num(min),4,H-b.bottom);ctx.textAlign='center';const ticks=Math.min(6,view.rows.length);for(let i=0;i<ticks;i++){const j=Math.round((view.rows.length-1)*i/(ticks-1||1));ctx.fillText(formatDate(view.rows[j].date),xAt(j,view.rows.length,b.left,b.w),H-9)}crosshair(ctx,canvas,view,b,min,max)
  }
  function formatDate(v){const s=String(v);return s.includes('T')?s.slice(5,16).replace('T',' '):s.slice(5)}
  function crosshair(ctx,canvas,view,b,min,max){const idx=runtime.hoverIndex;if(idx===null||idx<view.start||idx>=view.end)return;const j=idx-view.start,r=view.rows[j],x=xAt(j,view.rows.length,b.left,b.w);ctx.strokeStyle='rgba(210,225,245,.5)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,b.top);ctx.lineTo(x,b.top+b.h);ctx.stroke();ctx.setLineDash([]);const tip=document.getElementById('chartCrosshairTipV13');if(tip){tip.innerHTML=`<b>${r.date}</b><br>O ${num(r.open)} · H ${num(r.high)} · L ${num(r.low)} · C ${num(r.close)}<br>Hacim ${num(r.volume,0)}`;tip.classList.remove('hidden');const cr=canvas.closest('.chartCard').getBoundingClientRect(),rr=canvas.getBoundingClientRect();tip.style.left=`${clamp(rr.left-cr.left+x+12,8,cr.width-tip.offsetWidth-8)}px`;tip.style.top=`${rr.top-cr.top+12}px`}}

  function paneDef(key,data){
    const closes=data.map(x=>x.close);
    if(key==='rsi'){const a=window.micRsiAnalysis?micRsiAnalysis(data,14):{series:closes.map((_,i)=>i<14?NaN:rsiValue(closes.slice(0,i+1),14)),current:NaN,regime:'RSI'};return{title:`RSI 14 · ${Number.isFinite(a.current)?num(a.current,1):'—'} · ${a.regime}`,kind:'rsi',lines:[{v:a.series,c:'#69aaff'}],min:0,max:100,guides:[30,50,70],analysis:a}}
    if(key==='macd'){const e12=emaSeries(closes,12),e26=emaSeries(closes,26),m=closes.map((_,i)=>i<25?NaN:e12[i]-e26[i]),clean=m.map(v=>Number.isFinite(v)?v:0),sig=emaSeries(clean,9).map((v,i)=>i<33?NaN:v),hist=m.map((v,i)=>Number.isFinite(v)&&Number.isFinite(sig[i])?v-sig[i]:NaN);return{title:'MACD 12/26/9',kind:'macd',lines:[{v:m,c:'#43d39a'},{v:sig,c:'#f3a657'}],bars:hist,zero:true}}
    if(key==='stochastic'){const s=data.map((_,i)=>i<15?{k:NaN,d:NaN}:stochasticValue(data.slice(0,i+1),14,3));return{title:'Stokastik 14/3',kind:'stochastic',lines:[{v:s.map(x=>x.k),c:'#69aaff'},{v:s.map(x=>x.d),c:'#f3a657'}],min:0,max:100,guides:[20,80]}}
    if(key==='volume')return{title:'Hacim',kind:'volume',bars:data.map(x=>x.volume)};
    if(key==='atr')return{title:'ATR 14',kind:'atr',lines:[{v:data.map((_,i)=>i<14?NaN:atrValue(data.slice(0,i+1),14)),c:'#bb8cff'}]};
    if(key==='otto'&&window.micOttoSeries){const o=micOttoSeries(data);return{title:'OTTO 2 / 0.6 · VAR · MPL-2.0',kind:'otto',lines:[{v:o.hott,c:'#ff5a66',name:'HOTT'},{v:o.lott,c:'#22a9ff',name:'LOTT'}],buy:o.buy,sell:o.sell,otto:o}}
    return null;
  }
  function renderPanes(data,view){const box=document.getElementById('indicatorPanesV13');box.innerHTML='';active().filter(k=>['rsi','macd','stochastic','volume','atr','otto'].includes(k)).forEach(key=>{const d=paneDef(key,data);if(!d)return;const pane=document.createElement('div');pane.className='indicatorPaneV10';pane.innerHTML=`<div class="indicatorPaneHeaderV10"><strong>${d.title}</strong><span>${intervalName(settings().interval)} mum · senkron</span><button data-close="${key}" title="Grafikten kaldır">×</button></div><canvas></canvas>${key==='otto'?'<div class="ottoCredit">OTTO uyarlaması: © KivancOzbilgic · OTT @Anil_Ozeksi · OTTO Kamil Hasan Alpay · MPL-2.0</div>':''}`;box.appendChild(pane);drawPane(pane.querySelector('canvas'),d,data,view);attach(pane.querySelector('canvas'))});box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>saveIndicatorSelection(active().filter(k=>k!==b.dataset.close)))}
  function drawPane(canvas,d,data,view){const{ctx,W,H}=resize(canvas),b={left:56,right:16,top:18,bottom:24};b.w=W-b.left-b.right;b.h=H-b.top-b.bottom;ctx.clearRect(0,0,W,H);grid(ctx,W,H,b);let vals=[];(d.lines||[]).forEach(l=>vals.push(...l.v.slice(view.start,view.end).filter(Number.isFinite)));if(d.bars)vals.push(...d.bars.slice(view.start,view.end).filter(Number.isFinite));let min=d.min??Math.min(...vals,0),max=d.max??Math.max(...vals,1);if(d.kind==='volume')min=0;if(d.kind==='macd'){const m=Math.max(Math.abs(min),Math.abs(max),1);min=-m;max=m}if(d.kind==='otto'){const pad=(max-min)*.15||.000001;min-=pad;max+=pad}if(max===min){max+=1;min-=1}if(d.kind==='rsi'){ctx.fillStyle='rgba(255,107,120,.08)';ctx.fillRect(b.left,b.top,b.w,yAt(70,min,max,b.top,b.h)-b.top);ctx.fillStyle='rgba(66,211,154,.08)';const y30=yAt(30,min,max,b.top,b.h);ctx.fillRect(b.left,y30,b.w,b.top+b.h-y30)}(d.guides||[]).forEach(g=>{const y=yAt(g,min,max,b.top,b.h);ctx.strokeStyle=g===50?'#7f91aa':'#53657d';ctx.setLineDash(g===50?[2,3]:[5,4]);ctx.beginPath();ctx.moveTo(b.left,y);ctx.lineTo(W-b.right,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#9cabc1';ctx.font='10px system-ui';ctx.fillText(String(g),6,y+3)});if(d.zero){const y=yAt(0,min,max,b.top,b.h);ctx.strokeStyle='#53657d';ctx.beginPath();ctx.moveTo(b.left,y);ctx.lineTo(W-b.right,y);ctx.stroke()}if(d.kind==='otto'&&d.lines?.length===2){const a=d.lines[0].v,bv=d.lines[1].v;for(let j=0;j<view.rows.length-1;j++){const i=view.start+j,n=i+1;if(!Number.isFinite(a[i])||!Number.isFinite(bv[i])||!Number.isFinite(a[n])||!Number.isFinite(bv[n]))continue;ctx.fillStyle=bv[i]>=a[i]?'rgba(66,211,154,.18)':'rgba(255,107,120,.18)';ctx.beginPath();ctx.moveTo(xAt(j,view.rows.length,b.left,b.w),yAt(a[i],min,max,b.top,b.h));ctx.lineTo(xAt(j+1,view.rows.length,b.left,b.w),yAt(a[n],min,max,b.top,b.h));ctx.lineTo(xAt(j+1,view.rows.length,b.left,b.w),yAt(bv[n],min,max,b.top,b.h));ctx.lineTo(xAt(j,view.rows.length,b.left,b.w),yAt(bv[i],min,max,b.top,b.h));ctx.closePath();ctx.fill()}}if(d.bars){const sp=b.w/Math.max(1,view.rows.length),bw=Math.max(1,sp*.65),zero=yAt(0,min,max,b.top,b.h);view.rows.forEach((r,j)=>{const v=d.bars[view.start+j];if(!Number.isFinite(v))return;const x=xAt(j,view.rows.length,b.left,b.w),y=yAt(v,min,max,b.top,b.h);ctx.fillStyle=d.kind==='volume'?(r.close>=r.open?'rgba(66,211,154,.62)':'rgba(255,107,120,.62)'):(v>=0?'rgba(66,211,154,.68)':'rgba(255,107,120,.68)');ctx.fillRect(x-bw/2,Math.min(y,zero),bw,Math.max(1,Math.abs(zero-y)))})}(d.lines||[]).forEach(l=>series(ctx,l.v,view,l.c,min,max,b,1.8));if(d.kind==='otto'){view.rows.forEach((_,j)=>{const i=view.start+j,x=xAt(j,view.rows.length,b.left,b.w);if(d.buy?.[i])labelSignal(ctx,x,yAt(d.lines[1].v[i],min,max,b.top,b.h),'AL','#2fc786',false);if(d.sell?.[i])labelSignal(ctx,x,yAt(d.lines[1].v[i],min,max,b.top,b.h),'SAT','#ff5968',true)})}ctx.fillStyle='#9cabc1';ctx.font='10px system-ui';ctx.fillText(num(max,4),4,14);ctx.fillText(num(min,4),4,H-8);const idx=runtime.hoverIndex;if(idx!==null&&idx>=view.start&&idx<view.end){const x=xAt(idx-view.start,view.rows.length,b.left,b.w);ctx.strokeStyle='rgba(210,225,245,.45)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,b.top);ctx.lineTo(x,b.top+b.h);ctx.stroke();ctx.setLineDash([])}}
  function labelSignal(ctx,x,y,text,color,above){ctx.font='bold 10px system-ui';const w=ctx.measureText(text).width+10,h=18,yy=above?y-h-5:y+5;ctx.fillStyle=color;ctx.fillRect(x-w/2,yy,w,h);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(text,x,yy+13);ctx.textAlign='left'}
  function renderLegend(){const box=document.getElementById('chartLegendV13'),items=[];if(active().includes('supertrend'))items.push(['Supertrend 10 hl2 3','#2fc786 / #ff5968']);if(active().includes('sma'))items.push(['SMA20','#65a9ff'],['SMA50','#f3a657']);if(active().includes('ema'))items.push(['EMA12','#43d39a'],['EMA26','#bb8cff']);if(active().includes('bollinger'))items.push(['Bollinger','#8395ad']);box.innerHTML=items.map(([n,c])=>`<span><i style="background:${c.includes('/')?'linear-gradient(90deg,#2fc786 50%,#ff5968 50%)':c}"></i>${n}</span>`).join('')}

  function attach(canvas){if(!canvas||canvas.dataset.ws13)return;canvas.dataset.ws13='1';canvas.addEventListener('wheel',e=>{e.preventDefault();runtime.zoom=clamp(runtime.zoom*(e.deltaY<0?1.25:.8),1,12);schedule(true)},{passive:false});canvas.addEventListener('pointerdown',e=>{runtime.drag={x:e.clientX,offset:runtime.offset};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{const a=state.lastAsset;if(!a)return;const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a,data=dataFor(live),view=visible(data),r=canvas.getBoundingClientRect();if(runtime.drag){runtime.offset=runtime.drag.offset+(e.clientX-runtime.drag.x)*(view.rows.length/Math.max(1,r.width-72));schedule(true);return}runtime.hoverIndex=clamp(view.start+Math.round(clamp((e.clientX-56)/Math.max(1,r.width-72),0,1)*(view.rows.length-1)),view.start,view.end-1);schedule(true)});const end=()=>runtime.drag=null;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('pointerleave',()=>{if(!runtime.drag){runtime.hoverIndex=null;document.getElementById('chartCrosshairTipV13')?.classList.add('hidden');schedule(true)}});canvas.addEventListener('dblclick',()=>{runtime.zoom=1;runtime.offset=0;schedule(true)})}

  const original=window.drawLastChart;if(typeof original==='function')window.drawLastChart=function(){original();schedule(true)};
  window.addEventListener('resize',()=>schedule(true));setup();schedule(true);
})();
