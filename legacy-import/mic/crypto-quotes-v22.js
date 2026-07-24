/* MIC v22 — on-demand crypto spot quotes through MIC Market Gateway */
(() => {
  if (window.__MIC_CRYPTO_QUOTES_V22) return;
  window.__MIC_CRYPTO_QUOTES_V22 = true;

  const quoteCache = new Map();
  const inFlight = new Map();
  const originalRenderSelected = window.renderSelected;
  if (typeof originalRenderSelected !== 'function') return;

  function gatewayConfig(){
    return state?.settings?.marketGateway || {url:'',token:''};
  }

  function sameAsset(asset){
    return selected && asset && selected.type === asset.type && selected.symbol === asset.symbol;
  }

  function selectedHint(){
    return document.querySelector('#selectedCard > .hint');
  }

  function showStatus(asset,text){
    if (!sameAsset(asset)) return;
    const hint=selectedHint();
    if(hint)hint.textContent=`${asset.exchange||'CRYPTO'} · ${asset.currency||'USD'} · ${text}`;
  }

  function applyQuote(asset,quote){
    const price=Number(quote?.price);
    if(!Number.isFinite(price))throw new Error('Geçerli fiyat gelmedi');
    const patch={
      price,
      price_as_of:quote.generated_at||new Date().toISOString(),
      quote_provider:quote.provider||'MIC Market Gateway',
      provider_symbol:quote.provider_symbol||asset.provider_symbol
    };
    Object.assign(asset,patch);
    const row=(market.assets||[]).find(x=>x.type==='crypto'&&String(x.symbol).toUpperCase()===String(asset.symbol).toUpperCase());
    if(row)Object.assign(row,patch);
    quoteCache.set(String(asset.symbol).toUpperCase(),{...patch,cachedAt:Date.now()});
  }

  function renderCurrentQuote(asset){
    if(!sameAsset(asset))return;
    originalRenderSelected();
    const hint=selectedHint();
    if(hint){
      const source=asset.quote_provider?` · ${asset.quote_provider}`:'';
      hint.textContent=`${asset.exchange||'CRYPTO'} · ${asset.currency||'USD'} · Anlık fiyat ${money(asset.price,asset.currency||'USD')}${source}`;
    }
  }

  async function loadQuote(asset){
    const symbol=String(asset?.symbol||'').toUpperCase();
    if(!symbol)return;
    const cached=quoteCache.get(symbol);
    if(cached&&Date.now()-cached.cachedAt<30_000){
      Object.assign(asset,cached);renderCurrentQuote(asset);return;
    }
    if(inFlight.has(symbol))return inFlight.get(symbol);

    const gateway=gatewayConfig();
    if(!gateway.url){showStatus(asset,'Anlık fiyat için Ayarlar bölümünde Gateway bağlantısı gerekli');return;}
    showStatus(asset,'Anlık fiyat alınıyor…');

    const task=(async()=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),70_000);
      try{
        const headers=gateway.token?{authorization:`Bearer ${gateway.token}`}:{},
          qs=new URLSearchParams({market:'CRYPTO',symbol});
        const response=await fetch(`${String(gateway.url).replace(/\/$/,'')}/api/v1/quote?${qs}`,{headers,cache:'no-store',signal:controller.signal});
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body.message||`HTTP ${response.status}`);
        applyQuote(asset,body);
        renderCurrentQuote(asset);
      }catch(error){
        const message=error?.name==='AbortError'?'Gateway zaman aşımına uğradı':(error?.message||'Fiyat alınamadı');
        showStatus(asset,`Anlık fiyat alınamadı: ${message}`);
      }finally{
        clearTimeout(timer);inFlight.delete(symbol);
      }
    })();
    inFlight.set(symbol,task);
    return task;
  }

  window.renderSelected=function(){
    const result=originalRenderSelected.apply(this,arguments);
    if(selected?.type==='crypto')void loadQuote(selected);
    return result;
  };
})();
