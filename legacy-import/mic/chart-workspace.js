(() => {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const wsRuntime={zoom:1,offset:0,hoverIndex:null,drag:null,lastKey:null};

  function wsSettings(){
    state.settings=state.settings||{};
    state.settings.chartWorkspace={interval:'1D',chartType:'candles',...(state.settings.chartWorkspace||{})};
    return state.settings.chartWorkspace;
  }

  function activeIndicators(){
    try{return indicatorActive()}catch{return state.settings?.indicators?.active||[]}
  }

  function setupWorkspace(){
    const card=document.querySelector('.chartCard');
    if(!card||document.getElementById('chartWorkspaceToolbar'))return;

    document.querySelectorAll('#chartPeriods .period').forEach(b=>{
      const labels={"1H":"1 Hafta","1A":"1 Ay","3A":"3 Ay","6A":"6 Ay","1Y":"1 Yıl","YTD":"YTD"};
      b.textContent=labels[b.dataset.period]||b.textContent;
    });

    const toolbar=document.createElement('div');
    toolbar.id='chartWorkspaceToolbar';toolbar.className='chartToolbar';
    toolbar.innerHTML=`
      <div class="chartToolbarGroup">
        <button id="chartTypeToggle" class="chartToolButton">Mum</button>
        <label class="chartIntervalLabel">Mum aralığı
          <select id="chartIntervalSelect" class="chartIntervalSelect">
            <option value="1D">1 Gün</option>
            <option value="1W">1 Hafta</option>
            <option value="1M">1 Ay</option>
          </select>
        </label>
        <button id="chartResetView" class="chartToolButton">Görünümü sıfırla</button>
      </div>
      <div class="indicatorMenuWrap">
        <button id="indicatorMenuButton" class="chartToolButton">Göstergeler <span id="indicatorMenuCount"></span></button>
        <div id="indicatorMenuPopup" class="indicatorMenu hidden">
          <div class="indicatorMenuHeader"><strong>Grafiğe eklenecek göstergeler</strong><button id="indicatorMenuClose" class="indicatorPaneClose">×</button></div>
          <p class="chartWorkspaceHint">SMA, EMA ve Bollinger fiyat grafiğinin üzerinde; RSI, MACD, Stokastik, Hacim ve ATR senkron alt panellerde gösterilir.</p>
        </div>
      </div>`;
    const chartHeader=card.querySelector('.chartHeader');
    chartHeader.insertAdjacentElement('afterend',toolbar);

    const popup=toolbar.querySelector('#indicatorMenuPopup');
    const actions=document.querySelector('#indicatorLab .indicatorActions');
    const options=document.getElementById('indicatorOptions');
    if(actions)popup.appendChild(actions);
    if(options)popup.appendChild(options);

    const hint=document.createElement('div');hint.className='chartWorkspaceHint';
    hint.textContent='Yakınlaştırmak için fare tekerleği veya iki parmak; yatay hareket için grafiği sürükle. Mum aralıkları günlük veriden oluşturulur.';
    document.getElementById('chartPeriods').insertAdjacentElement('afterend',hint);

    const legend=document.createElement('div');legend.id='chartLegend';legend.className='chartLegend';
    document.getElementById('chartCanvas').insertAdjacentElement('afterend',legend);
    const panes=document.createElement('div');panes.id='indicatorPanes';panes.className='indicatorPanes';
    legend.insertAdjacentElement('afterend',panes);
    const tip=document.createElement('div');tip.id='chartCrosshairTip';tip.className='chartCrosshairTip hidden';
    card.appendChild(tip);

    const settings=wsSettings();
    document.getElementById('chartIntervalSelect').value=settings.interval;
    updateTypeButton();updateIndicatorCount();

    document.getElementById('chartTypeToggle').onclick=()=>{
      settings.chartType=settings.chartType==='candles'?'line':'candles';save();updateTypeButton();renderWorkspace();
    };
    document.getElementById('chartIntervalSelect').onchange=e=>{
      settings.interval=e.target.value;wsRuntime.zoom=1;wsRuntime.offset=0;save();renderWorkspace();
    };
    document.getElementById('chartResetView').onclick=()=>{wsRuntime.zoom=1;wsRuntime.offset=0;wsRuntime.hoverIndex=null;renderWorkspace()};
    document.getElementById('indicatorMenuButton').onclick=e=>{e.stopPropagation();popup.classList.toggle('hidden')};
    document.getElementById('indicatorMenuClose').onclick=()=>popup.classList.add('hidden');
    document.addEventListener('click',e=>{if(!e.target.closest('.indicatorMenuWrap'))popup.classList.add('hidden')});
    document.addEventListener('click',e=>{if(e.target.closest('[data-indicator],#indicatorAll,#indicatorClear'))setTimeout(()=>{updateIndicatorCount();renderWorkspace()},0)});

    attachInteraction(document.getElementById('chartCanvas'));
  }

  function updateTypeButton(){
    const b=document.getElementById('chartTypeToggle');if(!b)return;
    const candle=wsSettings().chartType==='candles';b.textContent=candle?'Mum':'Çizgi';b.classList.toggle('active',candle);
  }
  function updateIndicatorCount(){const x=document.getElementById('indicatorMenuCount');if(x)x.textContent=`(${activeIndicators().length})`}

  function aggregateHistory(history,interval){
    const rows=[...history].filter(x=>present(x.close)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(interval==='1D')return rows.map(x=>({...x,open:+x.open||+x.close,high:+x.high||+x.close,low:+x.low||+x.close,close:+x.close,volume:+x.volume||0}));
    const groups=new Map();
    rows.forEach(x=>{
      const d=new Date(`${x.date}T00:00:00Z`);let key;
      if(interval==='1M')key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
      else{
        const day=(d.getUTCDay()+6)%7,mon=new Date(d);mon.setUTCDate(d.getUTCDate()-day);
        key=mon.toISOString().slice(0,10);
      }
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);
    });
    return [...groups.values()].map(g=>({
      date:g.at(-1).date,open:+g[0].open||+g[0].close,high:Math.max(...g.map(x=>+x.high||+x.close)),
      low:Math.min(...g.map(x=>+x.low||+x.close)),close:+g.at(-1).close,volume:g.reduce((s,x)=>s+(+x.volume||0),0)
    }));
  }

  function visibleWindow(data){
    if(!data.length)return {rows:[],start:0,end:0};
    const minBars=Math.min(20,data.length),visible=clamp(Math.round(data.length/wsRuntime.zoom),minBars,data.length);
    const maxOffset=Math.max(0,data.length-visible);wsRuntime.offset=clamp(Math.round(wsRuntime.offset),0,maxOffset);
    const end=data.length-wsRuntime.offset,start=Math.max(0,end-visible);
    return {rows:data.slice(start,end),start,end};
  }

  function resizeCanvas(canvas){
    const rect=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(rect.width*d));canvas.height=Math.max(1,Math.round(rect.height*d));
    const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);return {ctx,W:rect.width,H:rect.height};
  }

  function lineSeries(values,period,type='sma'){
    if(type==='ema')return emaSeries(values,period).map((v,i)=>i+1<period?NaN:v);
    return values.map((_,i)=>smaAt(values,period,i));
  }
  function bollingerSeries(values){
    return values.map((_,i)=>{
      if(i<19)return {mid:NaN,upper:NaN,lower:NaN};
      const s=values.slice(i-19,i+1),m=mean(s),sd=stddev(s);return {mid:m,upper:m+2*sd,lower:m-2*sd};
    });
  }
  function rsiSeries(values,period=14){return values.map((_,i)=>i<period?NaN:rsiValue(values.slice(0,i+1),period))}
  function stochasticSeries(rows){return rows.map((_,i)=>i<15?{k:NaN,d:NaN}:stochasticValue(rows.slice(0,i+1),14,3))}
  function atrSeries(rows,period=14){return rows.map((_,i)=>i<period?NaN:atrValue(rows.slice(0,i+1),period))}
  function macdSeries(values){
    const e12=emaSeries(values,12),e26=emaSeries(values,26),macd=values.map((_,i)=>i<25?NaN:e12[i]-e26[i]);
    const clean=macd.map(v=>Number.isFinite(v)?v:0),signal=emaSeries(clean,9).map((v,i)=>i<33?NaN:v);
    return {macd,signal,hist:macd.map((v,i)=>Number.isFinite(v)&&Number.isFinite(signal[i])?v-signal[i]:NaN)};
  }

  function renderWorkspace(){
    setupWorkspace();
    const a=state.lastAsset,canvas=document.getElementById('chartCanvas'),panes=document.getElementById('indicatorPanes');
    if(!canvas||!panes)return;
    if(!a){panes.innerHTML='';return}
    const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a,raw=cachedHistory(live);
    if(raw.length<2){panes.innerHTML='';return}
    const filtered=filterHistory(raw,chartPeriod),data=aggregateHistory(filtered,wsSettings().interval),view=visibleWindow(data);
    if(view.rows.length<2)return;
    const key=`${assetKey(live)}:${chartPeriod}:${wsSettings().interval}`;
    if(wsRuntime.lastKey!==key){wsRuntime.lastKey=key;wsRuntime.zoom=1;wsRuntime.offset=0;wsRuntime.hoverIndex=null}
    drawPriceChart(canvas,data,view);
    renderPanes(data,view);
    updateLegend();updateIndicatorCount();
    const info=document.getElementById('chartInfo');
    if(info)info.textContent=`${live.exchange||''} · ${live.currency||''} · ${chartPeriod} görünüm · ${intervalLabel(wsSettings().interval)} mum · ${view.rows.length}/${data.length} bar`;
  }

  function intervalLabel(x){return ({'1D':'Günlük','1W':'Haftalık','1M':'Aylık'})[x]||x}

  function xAt(i,count,left,plotW){return count<=1?left:left+(i/(count-1))*plotW}
  function yScale(value,min,max,top,plotH){return top+(max-value)/(max-min||1)*plotH}
  function drawGrid(ctx,W,H,left,right,top,bottom,steps=5){
    ctx.strokeStyle='#223650';ctx.lineWidth=1;
    for(let i=0;i<=steps;i++){const y=top+(H-top-bottom)*i/steps;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(W-right,y);ctx.stroke()}
  }
  function drawSeries(ctx,series,view,color,min,max,box,width=1.7,dash=[]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();let started=false;
    view.rows.forEach((_,j)=>{const v=series[view.start+j];if(!Number.isFinite(v))return;const x=xAt(j,view.rows.length,box.left,box.plotW),y=yScale(v,min,max,box.top,box.plotH);started?ctx.lineTo(x,y):(ctx.moveTo(x,y),started=true)});
    if(started)ctx.stroke();ctx.setLineDash([]);
  }

  function drawPriceChart(canvas,data,view){
    canvas.classList.remove('hidden');
    const {ctx,W,H}=resizeCanvas(canvas),box={left:54,right:14,top:26,bottom:28};box.plotW=W-box.left-box.right;box.plotH=H-box.top-box.bottom;
    const active=activeIndicators(),closes=data.map(x=>+x.close),overlays=[];
    if(active.includes('sma')){overlays.push({name:'SMA20',series:lineSeries(closes,20),color:'#65a9ff'});overlays.push({name:'SMA50',series:lineSeries(closes,50),color:'#f3a657'})}
    if(active.includes('ema')){overlays.push({name:'EMA12',series:lineSeries(closes,12,'ema'),color:'#43d39a'});overlays.push({name:'EMA26',series:lineSeries(closes,26,'ema'),color:'#bb8cff'})}
    const bb=active.includes('bollinger')?bollingerSeries(closes):null;
    if(bb){overlays.push({name:'BB üst',series:bb.map(x=>x.upper),color:'#8395ad',dash:[5,4]});overlays.push({name:'BB alt',series:bb.map(x=>x.lower),color:'#8395ad',dash:[5,4]})}
    let min=Math.min(...view.rows.map(x=>+x.low||+x.close)),max=Math.max(...view.rows.map(x=>+x.high||+x.close));
    overlays.forEach(o=>o.series.slice(view.start,view.end).forEach(v=>{if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}}));
    const pad=(max-min)*.06||1;min-=pad;max+=pad;
    ctx.clearRect(0,0,W,H);drawGrid(ctx,W,H,box.left,box.right,box.top,box.bottom,5);
    const candleSpace=box.plotW/Math.max(1,view.rows.length),bodyW=clamp(candleSpace*.62,2,18);
    if(wsSettings().chartType==='line'){
      const closeSeries=data.map(x=>+x.close);drawSeries(ctx,closeSeries,view,'#42d39a',min,max,box,2.3);
    }else{
      view.rows.forEach((x,j)=>{
        const xx=xAt(j,view.rows.length,box.left,box.plotW),o=+x.open||+x.close,c=+x.close,h=+x.high||Math.max(o,c),l=+x.low||Math.min(o,c),up=c>=o,color=up?'#42d39a':'#ff6b78';
        ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xx,yScale(h,min,max,box.top,box.plotH));ctx.lineTo(xx,yScale(l,min,max,box.top,box.plotH));ctx.stroke();
        const yo=yScale(o,min,max,box.top,box.plotH),yc=yScale(c,min,max,box.top,box.plotH),y=Math.min(yo,yc),height=Math.max(1.5,Math.abs(yc-yo));ctx.fillRect(xx-bodyW/2,y,bodyW,height);
      });
    }
    overlays.forEach(o=>drawSeries(ctx,o.series,view,o.color,min,max,box,1.6,o.dash||[]));
    ctx.fillStyle='#9cabc1';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(num(max),4,box.top+4);ctx.fillText(num(min),4,H-box.bottom);
    ctx.textAlign='center';const ticks=Math.min(6,view.rows.length);for(let i=0;i<ticks;i++){const j=Math.round((view.rows.length-1)*i/(ticks-1||1)),x=xAt(j,view.rows.length,box.left,box.plotW);ctx.fillText(String(view.rows[j].date).slice(5),x,H-8)}
    drawCrosshair(ctx,canvas,view,box,min,max);
  }

  function drawCrosshair(ctx,canvas,view,box,min,max){
    const idx=wsRuntime.hoverIndex;if(idx===null||idx<view.start||idx>=view.end)return;
    const j=idx-view.start,x=xAt(j,view.rows.length,box.left,box.plotW),row=view.rows[j];
    ctx.strokeStyle='rgba(210,225,245,.5)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,box.top);ctx.lineTo(x,box.top+box.plotH);ctx.stroke();ctx.setLineDash([]);
    const tip=document.getElementById('chartCrosshairTip');if(tip){tip.innerHTML=`<b>${row.date}</b><br>O ${num(row.open)} · H ${num(row.high)} · L ${num(row.low)} · C ${num(row.close)}<br>Hacim ${num(row.volume,0)}`;tip.classList.remove('hidden');const card=canvas.closest('.chartCard').getBoundingClientRect(),rect=canvas.getBoundingClientRect();tip.style.left=`${clamp(rect.left-card.left+x+12,8,card.width-tip.offsetWidth-8)}px`;tip.style.top=`${rect.top-card.top+12}px`}
  }

  function updateLegend(){
    const active=activeIndicators(),legend=document.getElementById('chartLegend');if(!legend)return;
    const items=[];
    if(active.includes('sma'))items.push(['SMA20','#65a9ff'],['SMA50','#f3a657']);
    if(active.includes('ema'))items.push(['EMA12','#43d39a'],['EMA26','#bb8cff']);
    if(active.includes('bollinger'))items.push(['Bollinger','#8395ad']);
    legend.innerHTML=items.map(([n,c])=>`<span class="legendItem"><i class="legendSwatch" style="background:${c}"></i>${n}</span>`).join('');
  }

  function paneDefinition(key,data){
    const closes=data.map(x=>+x.close);
    if(key==='rsi')return {title:'RSI 14',kind:'lines',lines:[{v:rsiSeries(closes),color:'#69aaff'}],min:0,max:100,guides:[30,70]};
    if(key==='macd'){const m=macdSeries(closes);return {title:'MACD 12/26/9',kind:'macd',lines:[{v:m.macd,color:'#43d39a'},{v:m.signal,color:'#f3a657'}],bars:m.hist,zero:true}}
    if(key==='stochastic'){const s=stochasticSeries(data);return {title:'Stokastik 14/3',kind:'lines',lines:[{v:s.map(x=>x.k),color:'#69aaff'},{v:s.map(x=>x.d),color:'#f3a657'}],min:0,max:100,guides:[20,80]}}
    if(key==='volume')return {title:'Hacim',kind:'volume',bars:data.map(x=>+x.volume||0)};
    if(key==='atr')return {title:'ATR 14',kind:'lines',lines:[{v:atrSeries(data),color:'#bb8cff'}],min:null,max:null};
    return null;
  }

  function renderPanes(data,view){
    const container=document.getElementById('indicatorPanes'),paneKeys=activeIndicators().filter(k=>['rsi','macd','stochastic','volume','atr'].includes(k));
    container.innerHTML='';
    paneKeys.forEach(key=>{
      const def=paneDefinition(key,data);if(!def)return;
      const pane=document.createElement('div');pane.className='indicatorPane';pane.dataset.key=key;
      pane.innerHTML=`<div class="indicatorPaneHeader"><strong>${def.title}</strong><span>Senkron görünüm · ${intervalLabel(wsSettings().interval)}</span><button class="indicatorPaneClose" data-close-indicator="${key}" title="Grafikten kaldır">×</button></div><canvas></canvas>`;
      container.appendChild(pane);drawPane(pane.querySelector('canvas'),def,data,view);attachInteraction(pane.querySelector('canvas'));
    });
    container.querySelectorAll('[data-close-indicator]').forEach(b=>b.onclick=()=>{
      const active=activeIndicators().filter(k=>k!==b.dataset.closeIndicator);saveIndicatorSelection(active);setTimeout(renderWorkspace,0);
    });
  }

  function drawPane(canvas,def,data,view){
    const {ctx,W,H}=resizeCanvas(canvas),box={left:54,right:14,top:16,bottom:22};box.plotW=W-box.left-box.right;box.plotH=H-box.top-box.bottom;
    ctx.clearRect(0,0,W,H);drawGrid(ctx,W,H,box.left,box.right,box.top,box.bottom,3);
    let values=[];(def.lines||[]).forEach(l=>values.push(...l.v.slice(view.start,view.end).filter(Number.isFinite)));if(def.bars)values.push(...def.bars.slice(view.start,view.end).filter(Number.isFinite));
    let min=def.min??Math.min(...values,0),max=def.max??Math.max(...values,1);if(def.kind==='volume')min=0;if(def.kind==='macd'){const m=Math.max(Math.abs(min),Math.abs(max),1);min=-m;max=m}
    if(max===min){max+=1;min-=1}
    (def.guides||[]).forEach(g=>{const y=yScale(g,min,max,box.top,box.plotH);ctx.strokeStyle='#53657d';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(box.left,y);ctx.lineTo(W-box.right,y);ctx.stroke();ctx.setLineDash([])});
    if(def.zero){const y=yScale(0,min,max,box.top,box.plotH);ctx.strokeStyle='#53657d';ctx.beginPath();ctx.moveTo(box.left,y);ctx.lineTo(W-box.right,y);ctx.stroke()}
    if(def.bars){
      const space=box.plotW/Math.max(1,view.rows.length),bw=Math.max(1,space*.65),zeroY=yScale(0,min,max,box.top,box.plotH);
      view.rows.forEach((row,j)=>{const v=def.bars[view.start+j];if(!Number.isFinite(v))return;const x=xAt(j,view.rows.length,box.left,box.plotW),y=yScale(v,min,max,box.top,box.plotH);ctx.fillStyle=def.kind==='volume'?(row.close>=row.open?'rgba(66,211,154,.62)':'rgba(255,107,120,.62)'):(v>=0?'rgba(66,211,154,.68)':'rgba(255,107,120,.68)');ctx.fillRect(x-bw/2,Math.min(y,zeroY),bw,Math.max(1,Math.abs(zeroY-y)))});
    }
    (def.lines||[]).forEach(l=>drawSeries(ctx,l.v,view,l.color,min,max,box,1.7));
    ctx.fillStyle='#9cabc1';ctx.font='10px system-ui';ctx.fillText(num(max),4,14);ctx.fillText(num(min),4,H-8);
    const idx=wsRuntime.hoverIndex;if(idx!==null&&idx>=view.start&&idx<view.end){const j=idx-view.start,x=xAt(j,view.rows.length,box.left,box.plotW);ctx.strokeStyle='rgba(210,225,245,.45)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,box.top);ctx.lineTo(x,box.top+box.plotH);ctx.stroke();ctx.setLineDash([])}
  }

  function attachInteraction(canvas){
    if(!canvas||canvas.dataset.wsBound)return;canvas.dataset.wsBound='1';
    canvas.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaY<0?1.25:.8;wsRuntime.zoom=clamp(wsRuntime.zoom*factor,1,12);renderWorkspace()},{passive:false});
    canvas.addEventListener('pointerdown',e=>{wsRuntime.drag={x:e.clientX,offset:wsRuntime.offset};canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{
      const a=state.lastAsset;if(!a)return;const live=market.assets.find(x=>x.symbol===a.symbol&&x.type===a.type)||a,data=aggregateHistory(filterHistory(cachedHistory(live),chartPeriod),wsSettings().interval),view=visibleWindow(data),rect=canvas.getBoundingClientRect();
      if(wsRuntime.drag){const barsPerPx=view.rows.length/Math.max(1,rect.width-68),delta=(e.clientX-wsRuntime.drag.x)*barsPerPx;wsRuntime.offset=wsRuntime.drag.offset+delta;renderWorkspace();return}
      const ratio=clamp((e.clientX-54)/Math.max(1,rect.width-68),0,1);wsRuntime.hoverIndex=clamp(view.start+Math.round(ratio*(view.rows.length-1)),view.start,view.end-1);renderWorkspace();
    });
    const end=()=>{wsRuntime.drag=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('pointerleave',()=>{if(!wsRuntime.drag){wsRuntime.hoverIndex=null;const tip=document.getElementById('chartCrosshairTip');if(tip)tip.classList.add('hidden');renderWorkspace()}});
    canvas.addEventListener('dblclick',()=>{wsRuntime.zoom=1;wsRuntime.offset=0;renderWorkspace()});
  }

  const oldDraw=window.drawLastChart;
  if(typeof oldDraw==='function')window.drawLastChart=function(){oldDraw();requestAnimationFrame(renderWorkspace)};
  const oldSaveIndicators=window.saveIndicatorSelection;
  if(typeof oldSaveIndicators==='function')window.saveIndicatorSelection=function(active){oldSaveIndicators(active);requestAnimationFrame(renderWorkspace)};
  window.addEventListener('resize',()=>requestAnimationFrame(renderWorkspace));
  setupWorkspace();renderWorkspace();
})();