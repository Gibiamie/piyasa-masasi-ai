/* MIC v23 — native daily crypto charts through MIC Market Gateway */
(() => {
  if (window.__MIC_CRYPTO_HISTORY_V23) return;
  window.__MIC_CRYPTO_HISTORY_V23 = true;

  const baseFetchHistoryFile = window.fetchHistoryFile;
  if (typeof baseFetchHistoryFile !== 'function') return;

  function gatewayConfig(){
    return state?.settings?.marketGateway || {url:'',token:''};
  }

  function normalizeDailyBars(rows){
    const byDate=new Map();
    (rows||[]).forEach(row=>{
      const date=String(row.timestamp||row.date||'').slice(0,10);
      const open=Number(row.open),high=Number(row.high),low=Number(row.low),close=Number(row.close),volume=Number(row.volume||0);
      if(!date||![open,high,low,close].every(Number.isFinite))return;
      byDate.set(date,{date,open,high,low,close,volume});
    });
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }

  async function gatewayDailyHistory(asset){
    const gateway=gatewayConfig();
    if(!gateway.url)throw new Error('Canlı veri bağlantısı bu tarayıcıda henüz kurulmadı');
    const symbol=String(asset?.symbol||'').toUpperCase();
    const headers=gateway.token?{authorization:`Bearer ${gateway.token}`}:{},
      qs=new URLSearchParams({market:'CRYPTO',symbol,interval:'1d',limit:'730'}),
      controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70_000);
    try{
      const response=await fetch(`${String(gateway.url).replace(/\/$/,'')}/api/v1/bars?${qs}`,{headers,cache:'no-store',signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.message||`HTTP ${response.status}`);
      const history=normalizeDailyBars(body.bars);
      if(history.length<2)throw new Error('Grafik için yeterli günlük veri gelmedi');
      state.settings.historyCache[assetKey(asset)]={
        updatedAt:body.generated_at||new Date().toISOString(),
        provider:body.provider||'MIC Market Gateway',
        dataClass:body.data_class||'PROVIDER_NATIVE_BAR',
        history
      };
      const latest=history.at(-1);
      if(latest&&Number.isFinite(latest.close)){
        asset.price=latest.close;
        asset.price_as_of=latest.date;
      }
      save();
      return history;
    }catch(error){
      if(error?.name==='AbortError')throw new Error('Grafik yükleme zaman aşımına uğradı');
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  window.fetchHistoryFile=async function(asset){
    if(asset?.type!=='crypto')return baseFetchHistoryFile(asset);
    try{
      return await baseFetchHistoryFile(asset);
    }catch(fileError){
      try{
        return await gatewayDailyHistory(asset);
      }catch(gatewayError){
        const message=String(gatewayError?.message||'');
        if(message.includes('bağlantısı'))throw gatewayError;
        throw new Error('Günlük grafik şu anda yüklenemedi. Birkaç saniye sonra yeniden deneyin');
      }
    }
  };
})();
