/*
 * MIC Indicators v10 enhancement.
 * OTTO adaptation: user-provided Pine Script, Mozilla Public License 2.0.
 * Original credits: OTT @Anil_Ozeksi; OTTO developer Kamil Hasan Alpay;
 * open-source script © KivancOzbilgic.
 */
(() => {
  if (typeof INDICATOR_DEFS === 'undefined') return;

  if (!INDICATOR_DEFS.some(x => x.key === 'otto')) {
    INDICATOR_DEFS.push({key:'otto', label:'OTTO 2 / 0.6', directional:true});
  }

  function finite(v){ return Number.isFinite(Number(v)); }
  function avg(values){
    const xs=values.filter(Number.isFinite);
    return xs.length ? xs.reduce((s,v)=>s+v,0)/xs.length : NaN;
  }

  function rsiSeriesWilder(values, period=14){
    const src=values.map(Number), out=Array(src.length).fill(NaN);
    if(src.length<period+1) return out;
    let gain=0,loss=0;
    for(let i=1;i<=period;i++){
      const d=src[i]-src[i-1];
      if(d>0) gain+=d; else loss-=d;
    }
    let avgGain=gain/period, avgLoss=loss/period;
    out[period]=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
    for(let i=period+1;i<src.length;i++){
      const d=src[i]-src[i-1],g=d>0?d:0,l=d<0?-d:0;
      avgGain=((avgGain*(period-1))+g)/period;
      avgLoss=((avgLoss*(period-1))+l)/period;
      out[i]=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
    }
    return out;
  }

  function pivotIndexes(series, mode, left=2, right=2){
    const out=[];
    for(let i=left;i<series.length-right;i++){
      const v=series[i]; if(!Number.isFinite(v)) continue;
      let ok=true;
      for(let j=i-left;j<=i+right;j++){
        if(j===i||!Number.isFinite(series[j])) continue;
        if(mode==='low' && series[j]<=v){ok=false;break;}
        if(mode==='high'&& series[j]>=v){ok=false;break;}
      }
      if(ok) out.push(i);
    }
    return out;
  }

  function rsiDivergence(closes,rsi,lookback=70){
    const start=Math.max(0,closes.length-lookback);
    const p=closes.slice(start),r=rsi.slice(start);
    const lows=pivotIndexes(p,'low'), highs=pivotIndexes(p,'high');
    const result={bull:false,bear:false,bullAt:null,bearAt:null};
    if(lows.length>=2){
      const a=lows.at(-2),b=lows.at(-1);
      if(p[b]<p[a] && finite(r[a])&&finite(r[b]) && r[b]>r[a]+1){result.bull=true;result.bullAt=start+b;}
    }
    if(highs.length>=2){
      const a=highs.at(-2),b=highs.at(-1);
      if(p[b]>p[a] && finite(r[a])&&finite(r[b]) && r[b]<r[a]-1){result.bear=true;result.bearAt=start+b;}
    }
    return result;
  }

  function rsiAnalysis(history,period=14){
    const closes=history.map(x=>+x.close),series=rsiSeriesWilder(closes,period);
    const current=series.at(-1),previous=series.at(-2),divergence=rsiDivergence(closes,series);
    let regime='Veri yetersiz';
    if(finite(current)){
      if(current>=70) regime='Aşırı alım bölgesi';
      else if(current<=30) regime='Aşırı satım bölgesi';
      else if(current>=50) regime='Pozitif momentum';
      else regime='Negatif momentum';
    }
    return {series,current,previous,regime,divergence};
  }

  function rollingSum(values,period,index){
    let total=0;
    for(let i=Math.max(0,index-period+1);i<=index;i++) total+=Number.isFinite(values[i])?values[i]:0;
    return total;
  }

  function variableMA(src,length){
    const alpha=2/(Number(length)+1),up=Array(src.length).fill(0),down=Array(src.length).fill(0),out=Array(src.length).fill(0);
    for(let i=1;i<src.length;i++){
      const d=(+src[i]||0)-(+src[i-1]||0);
      up[i]=d>0?d:0;down[i]=d<0?-d:0;
      const u=rollingSum(up,9,i),dd=rollingSum(down,9,i),cmo=(u+dd)===0?0:(u-dd)/(u+dd),k=alpha*Math.abs(cmo);
      out[i]=k*(+src[i]||0)+(1-k)*out[i-1];
    }
    return out;
  }

  function ottoSeries(history,params={}){
    const length=params.length??2,percent=params.percent??0.6,fast=params.fast??10,slow=params.slow??25,coco=params.coco??100000;
    const closes=history.map(x=>+x.close);
    const mov1=variableMA(closes,slow/2),mov2=variableMA(closes,slow),mov3=variableMA(closes,slow*fast);
    const src=closes.map((_,i)=>mov1[i]/((mov2[i]-mov3[i])+coco));
    const mavg=variableMA(src,length),longStop=[],shortStop=[],dir=[],hott=[],lott=src.slice(),shifted=Array(src.length).fill(NaN),buy=[],sell=[];
    for(let i=0;i<src.length;i++){
      const m=mavg[i],diff=m*percent*.01,rawLong=m-diff,rawShort=m+diff;
      const prevLong=i?longStop[i-1]:rawLong,prevShort=i?shortStop[i-1]:rawShort;
      longStop[i]=m>prevLong?Math.max(rawLong,prevLong):rawLong;
      shortStop[i]=m<prevShort?Math.min(rawShort,prevShort):rawShort;
      const prevDir=i?dir[i-1]:1;
      dir[i]=prevDir===-1&&m>prevShort?1:prevDir===1&&m<prevLong?-1:prevDir;
      const mt=dir[i]===1?longStop[i]:shortStop[i];
      hott[i]=m>mt?mt*(200+percent)/200:mt*(200-percent)/200;
      if(i>=2) shifted[i]=hott[i-2];
      if(i>0&&finite(shifted[i])&&finite(shifted[i-1])){
        buy[i]=shifted[i-1]>=lott[i-1]&&shifted[i]<lott[i];
        sell[i]=shifted[i-1]<=lott[i-1]&&shifted[i]>lott[i];
      }else{buy[i]=false;sell[i]=false;}
    }
    return {hott:shifted,lott,buy,sell,params:{length,percent,fast,slow,coco,ma:'VAR'}};
  }

  window.micRsiSeries=rsiSeriesWilder;
  window.micRsiAnalysis=rsiAnalysis;
  window.micOttoSeries=ottoSeries;

  const baseCalculate=calculateIndicatorSignals;
  calculateIndicatorSignals=function(history,activeKeys){
    const withoutOtto=activeKeys.filter(k=>k!=='otto');
    let results=baseCalculate(history,withoutOtto).filter(r=>r.key!=='rsi');
    const h=[...history].filter(x=>finite(x.close)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

    if(activeKeys.includes('rsi')){
      const a=rsiAnalysis(h,14),r=a.current,p=a.previous,d=a.divergence;
      let status='NÖTR',vote=0,reason='RSI hesaplanamadı.';
      if(finite(r)){
        if(d.bull){status='AL';vote=1;reason=`Pozitif uyumsuzluk: fiyat daha düşük dip, RSI daha yüksek dip yaptı. ${a.regime}.`;}
        else if(d.bear){status='SAT';vote=-1;reason=`Negatif uyumsuzluk: fiyat daha yüksek tepe, RSI daha düşük tepe yaptı. ${a.regime}.`;}
        else if(finite(p)&&p<30&&r>=30){status='AL';vote=1;reason='RSI 30 seviyesini aşağıdan yukarı geçti; aşırı satımdan çıkış teyidi.';}
        else if(finite(p)&&p>70&&r<=70){status='SAT';vote=-1;reason='RSI 70 seviyesini yukarıdan aşağı geçti; aşırı alımdan çıkış teyidi.';}
        else if(r>70)reason='70 üzerinde; aşırı alım uyarısıdır, tek başına satış sinyali değildir.';
        else if(r<30)reason='30 altında; aşırı satım uyarısıdır, tek başına alış sinyali değildir.';
        else if(r>=50)reason='50 üzerinde; pozitif momentum teyidi, ancak tek başına AL sinyali değildir.';
        else reason='50 altında; negatif momentum, ancak tek başına SAT sinyali değildir.';
      }
      results.unshift(result('rsi','RSI 14',status,finite(r)?`${num(r,1)} · ${a.regime}`:'—',reason,vote));
    }

    if(activeKeys.includes('otto')){
      const o=ottoSeries(h),last=h.length-1;
      let recentBuy=-1,recentSell=-1;
      for(let i=Math.max(0,last-3);i<=last;i++){if(o.buy[i])recentBuy=i;if(o.sell[i])recentSell=i;}
      const hv=o.hott[last],lv=o.lott[last],value=finite(hv)&&finite(lv)?`HOTT ${num(hv,6)} · LOTT ${num(lv,6)}`:'—';
      if(recentBuy>recentSell&&recentBuy>=last-2)results.push(result('otto','OTTO','AL',value,'LOTT, HOTT çizgisini yukarı kesti; OTTO alış kesişimi.',1));
      else if(recentSell>recentBuy&&recentSell>=last-2)results.push(result('otto','OTTO','SAT',value,'LOTT, HOTT çizgisini aşağı kesti; OTTO satış kesişimi.',-1));
      else results.push(result('otto','OTTO','NÖTR',value,finite(hv)&&finite(lv)?(lv>hv?'LOTT HOTT üzerinde; pozitif rejim, yeni kesişim yok.':'LOTT HOTT altında; negatif rejim, yeni kesişim yok.'):'Yeterli veri yok.',0));
    }
    return results;
  };

  renderIndicatorOptions=function(){
    const box=$('indicatorOptions');if(!box)return;const active=indicatorActive();
    box.innerHTML=INDICATOR_DEFS.map(d=>`<button class="indicatorToggle ${active.includes(d.key)?'active':''}" data-indicator="${d.key}">${d.label}</button>`).join('');
  };

  const originalSave=saveIndicatorSelection;
  saveIndicatorSelection=function(active){
    originalSave(active.filter(k=>INDICATOR_DEFS.some(d=>d.key===k)));
    document.dispatchEvent(new CustomEvent('mic:indicators-changed'));
  };

  if($('indicatorAll')) $('indicatorAll').onclick=()=>saveIndicatorSelection(INDICATOR_DEFS.map(x=>x.key));
  if($('indicatorClear')) $('indicatorClear').onclick=()=>saveIndicatorSelection([]);
  renderIndicatorOptions();
  setTimeout(()=>{try{renderIndicatorPanel();}catch{}},0);
})();
