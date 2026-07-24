/* MIC v13 indicator extension: Supertrend 10 / hl2 / 3. */
(() => {
  if (typeof INDICATOR_DEFS === 'undefined') return;
  if (!INDICATOR_DEFS.some(x => x.key === 'supertrend')) {
    INDICATOR_DEFS.unshift({ key:'supertrend', label:'Supertrend 10 hl2 3', directional:true });
  }

  function finite(v){ return Number.isFinite(Number(v)); }

  function trueRange(rows, i){
    const h=+rows[i].high, l=+rows[i].low;
    if(i===0) return h-l;
    const pc=+rows[i-1].close;
    return Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
  }

  function wilderAtr(rows, period=10){
    const out=Array(rows.length).fill(NaN);
    if(rows.length<period) return out;
    let sum=0;
    for(let i=0;i<period;i++) sum+=trueRange(rows,i);
    out[period-1]=sum/period;
    for(let i=period;i<rows.length;i++) out[i]=((out[i-1]*(period-1))+trueRange(rows,i))/period;
    return out;
  }

  function supertrend(rows, period=10, multiplier=3){
    const src=[...rows].map(x=>({date:x.date,open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+x.volume||0}));
    const atr=wilderAtr(src,period),upper=Array(src.length).fill(NaN),lower=Array(src.length).fill(NaN),line=Array(src.length).fill(NaN),direction=Array(src.length).fill(0),buy=Array(src.length).fill(false),sell=Array(src.length).fill(false);
    for(let i=0;i<src.length;i++){
      if(!finite(atr[i])) continue;
      const hl2=(src[i].high+src[i].low)/2, basicUpper=hl2+multiplier*atr[i], basicLower=hl2-multiplier*atr[i];
      if(i===0||!finite(upper[i-1])){
        upper[i]=basicUpper; lower[i]=basicLower; line[i]=upper[i]; direction[i]=-1; continue;
      }
      upper[i]=(basicUpper<upper[i-1]||src[i-1].close>upper[i-1])?basicUpper:upper[i-1];
      lower[i]=(basicLower>lower[i-1]||src[i-1].close<lower[i-1])?basicLower:lower[i-1];
      if(line[i-1]===upper[i-1]) line[i]=src[i].close<=upper[i]?upper[i]:lower[i];
      else line[i]=src[i].close>=lower[i]?lower[i]:upper[i];
      direction[i]=src[i].close>=line[i]?1:-1;
      buy[i]=direction[i]===1&&direction[i-1]===-1;
      sell[i]=direction[i]===-1&&direction[i-1]===1;
    }
    return {line,direction,buy,sell,atr,period,multiplier,source:'hl2'};
  }

  window.micSupertrendSeries=supertrend;

  const baseCalculate=calculateIndicatorSignals;
  calculateIndicatorSignals=function(history,activeKeys){
    const without=activeKeys.filter(k=>k!=='supertrend');
    const results=baseCalculate(history,without);
    if(!activeKeys.includes('supertrend')) return results;
    const rows=[...history].filter(x=>finite(x.close)&&finite(x.high)&&finite(x.low)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const st=supertrend(rows,10,3),i=rows.length-1,prev=Math.max(0,i-1);
    if(i<10||!finite(st.line[i])){
      results.unshift(result('supertrend','Supertrend 10 hl2 3','NÖTR','—','Hesaplama için yeterli OHLC verisi yok.',0));
      return results;
    }
    const value=`${num(st.line[i],2)} · ${st.direction[i]===1?'Yükseliş':'Düşüş'}`;
    if(st.buy[i]||st.buy[prev]) results.unshift(result('supertrend','Supertrend 10 hl2 3','AL',value,'Fiyat Supertrend çizgisinin üzerine geçti; yeni yükseliş rejimi.',1));
    else if(st.sell[i]||st.sell[prev]) results.unshift(result('supertrend','Supertrend 10 hl2 3','SAT',value,'Fiyat Supertrend çizgisinin altına geçti; yeni düşüş rejimi.',-1));
    else results.unshift(result('supertrend','Supertrend 10 hl2 3','NÖTR',value,st.direction[i]===1?'Yükseliş rejimi sürüyor; yeni AL kesişimi yok.':'Düşüş rejimi sürüyor; yeni SAT kesişimi yok.',0));
    return results;
  };

  renderIndicatorOptions=function(){
    const box=$('indicatorOptions');if(!box)return;const active=indicatorActive();
    box.innerHTML=INDICATOR_DEFS.map(d=>`<button class="indicatorToggle ${active.includes(d.key)?'active':''}" data-indicator="${d.key}">${d.label}</button>`).join('');
  };
  renderIndicatorOptions();
})();
