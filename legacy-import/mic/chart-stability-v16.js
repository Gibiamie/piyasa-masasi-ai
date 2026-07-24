/* MIC v16 chart stabilizer
 * Prevents the legacy chart renderer and the v13 workspace from fighting over
 * canvas visibility/size, and adds explicit one-click indicator bulk controls.
 */
(() => {
  if (window.__MIC_CHART_STABILITY_V16) return;
  window.__MIC_CHART_STABILITY_V16 = true;

  const desktop=location.pathname.includes('mic-desktop');
  const sub=document.querySelector('.top .sub');
  if(sub)sub.textContent=desktop?'Laptop web · yatırım karar desteği · v16':'Mobil yatırım karar desteği · v16';
  document.title=desktop?'MIC Laptop Web Beta v16':'MIC Mobile Beta v16';

  let renderQueued=false;
  let lastRenderAt=0;
  const MIN_RENDER_GAP=50;

  function chartVisible(){
    const view=document.getElementById('chart');
    return !!(view&&view.classList.contains('active'));
  }

  function requestWorkspaceRender(){
    if(!chartVisible())return;
    const now=performance.now();
    if(renderQueued)return;
    renderQueued=true;
    const delay=Math.max(0,MIN_RENDER_GAP-(now-lastRenderAt));
    setTimeout(()=>requestAnimationFrame(()=>{
      renderQueued=false;
      lastRenderAt=performance.now();
      window.dispatchEvent(new Event('resize'));
    }),delay);
  }

  function stableMessage(text){
    const message=document.getElementById('chartMessage');
    const canvas=document.getElementById('chartCanvas');
    if(message){message.textContent=text;message.classList.remove('hidden');message.setAttribute('aria-live','polite');}
    if(canvas){
      canvas.classList.remove('hidden');
      const rect=canvas.getBoundingClientRect();
      if(rect.width>0&&rect.height>0){
        const d=window.devicePixelRatio||1;
        const w=Math.max(1,Math.round(rect.width*d)),h=Math.max(1,Math.round(rect.height*d));
        if(canvas.width!==w)canvas.width=w;
        if(canvas.height!==h)canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.setTransform(d,0,0,d,0,0);
        ctx.clearRect(0,0,rect.width,rect.height);
        ctx.strokeStyle='#223650';ctx.lineWidth=1;
        for(let i=1;i<5;i++){
          const y=rect.height*i/5;ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(rect.width-16,y);ctx.stroke();
        }
      }
    }
  }

  function hideStableMessage(){
    document.getElementById('chartMessage')?.classList.add('hidden');
    document.getElementById('chartCanvas')?.classList.remove('hidden');
  }

  // The old renderer hid and resized the same canvas immediately before the
  // workspace renderer drew it. Replace it with one stable render dispatcher.
  showChartMessage=stableMessage;
  drawLastChart=function(){
    try{renderPeriodButtons();}catch{}
    const a=state?.lastAsset;
    const title=document.getElementById('chartTitle');
    if(!a){
      if(title)title.textContent='';
      stableMessage('Önce bir varlık seç.');
      requestWorkspaceRender();
      return;
    }
    const live=(market?.assets||[]).find(x=>x.symbol===a.symbol&&x.type===a.type)||a;
    if(title)title.textContent=`${live.symbol} · ${live.name}`;
    const interval=state?.settings?.chartWorkspace?.interval||'1D';
    const intraday=interval==='1H'||interval==='4H';
    if(!intraday){
      const history=typeof cachedHistory==='function'?cachedHistory(live):[];
      const loading=typeof historyLoading!=='undefined'&&historyLoading.has(assetKey(live));
      if(history.length<2){
        stableMessage(loading?'Günlük fiyat verisi yükleniyor…':'Günlük fiyat verisi hazırlanıyor…');
        if(!loading&&typeof ensureHistory==='function')ensureHistory(live,false);
      }else hideStableMessage();
    }
    requestWorkspaceRender();
    setTimeout(()=>{try{renderIndicatorPanel();}catch{}},0);
  };

  function allIndicatorKeys(){
    return typeof INDICATOR_DEFS==='undefined'?[]:INDICATOR_DEFS.map(x=>x.key);
  }

  function updateBulkStatus(){
    const status=document.getElementById('indicatorBulkStatusV16');
    if(!status)return;
    const all=allIndicatorKeys(),active=typeof indicatorActive==='function'?indicatorActive():[];
    status.textContent=`${active.length}/${all.length} gösterge aktif`;
    document.getElementById('indicatorEnableAllV16')?.toggleAttribute('disabled',all.length>0&&active.length===all.length);
    document.getElementById('indicatorDisableAllV16')?.toggleAttribute('disabled',active.length===0);
  }

  function applyIndicatorSet(keys){
    if(typeof saveIndicatorSelection!=='function')return;
    saveIndicatorSelection(keys);
    document.dispatchEvent(new CustomEvent('mic:indicators-changed'));
    updateBulkStatus();
    requestWorkspaceRender();
  }

  function installBulkControls(){
    const popup=document.getElementById('indicatorMenuV13');
    if(!popup||document.getElementById('indicatorBulkV16'))return false;

    // Remove the older, ambiguous action row after replacing it with explicit controls.
    const oldActions=popup.querySelector('.indicatorActions');
    if(oldActions)oldActions.classList.add('hidden');

    const controls=document.createElement('div');
    controls.id='indicatorBulkV16';
    controls.className='indicatorBulkV16';
    controls.innerHTML=`
      <div class="indicatorBulkHeaderV16">
        <strong>Toplu işlem</strong>
        <span id="indicatorBulkStatusV16"></span>
      </div>
      <div class="indicatorBulkButtonsV16">
        <button id="indicatorEnableAllV16" type="button" class="primary">Tümünü aktif et</button>
        <button id="indicatorDisableAllV16" type="button" class="danger">Tümünü pasif yap</button>
      </div>`;

    const options=popup.querySelector('#indicatorOptions');
    if(options)popup.insertBefore(controls,options);else popup.appendChild(controls);

    controls.querySelector('#indicatorEnableAllV16').onclick=e=>{e.preventDefault();e.stopPropagation();applyIndicatorSet(allIndicatorKeys())};
    controls.querySelector('#indicatorDisableAllV16').onclick=e=>{e.preventDefault();e.stopPropagation();applyIndicatorSet([])};

    // Keep individual selection available; update the bulk counter after each click.
    popup.addEventListener('click',e=>{
      if(e.target.closest('[data-indicator]'))setTimeout(()=>{updateBulkStatus();requestWorkspaceRender()},0);
    });
    updateBulkStatus();
    return true;
  }

  function stabilizeCanvas(){
    const canvas=document.getElementById('chartCanvas');
    if(!canvas||canvas.dataset.stableV16)return;
    canvas.dataset.stableV16='1';
    const observer=new MutationObserver(()=>{
      if(chartVisible()&&canvas.classList.contains('hidden'))canvas.classList.remove('hidden');
    });
    observer.observe(canvas,{attributes:true,attributeFilter:['class']});
  }

  function boot(){
    const toolbar=document.getElementById('chartWorkspaceToolbarV13');
    if(!toolbar){setTimeout(boot,60);return;}
    installBulkControls();
    stabilizeCanvas();
    const button=document.getElementById('indicatorMenuButtonV13');
    if(button&&!button.dataset.bulkV16){
      button.dataset.bulkV16='1';
      button.addEventListener('click',()=>setTimeout(updateBulkStatus,0));
    }
    requestWorkspaceRender();
  }

  document.addEventListener('mic:indicators-changed',()=>{updateBulkStatus();requestWorkspaceRender()});
  window.addEventListener('resize',()=>{
    // v13 already listens to resize. This handler only keeps message/canvas state stable.
    if(chartVisible())document.getElementById('chartCanvas')?.classList.remove('hidden');
  },{passive:true});

  boot();
})();