(() => {
  if (window.__MIC_IPO_CALENDAR_V26) return;
  window.__MIC_IPO_CALENDAR_V26 = true;

  const MARKET_LABELS={ALL:'Tümü',BIST:'BIST',US:'ABD'};
  const STATUS_LABELS={OPEN:'TALEP AÇIK',UPCOMING:'YAKLAŞAN',CLOSED:'SÜRE KAPANDI',ROADSHOW:'ROADSHOW',FILED:'BAŞVURU YAPILDI',PRICED:'FİYATLANDI'};
  const STATUS_ORDER={OPEN:0,UPCOMING:1,ROADSHOW:2,PRICED:3,FILED:4,CLOSED:5};
  let ipoData={updated_at:null,items:[]};
  let activeMarket='ALL';

  const el=id=>document.getElementById(id);
  const safeUrl=value=>{
    try{const u=new URL(String(value||''));return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return '#'}
  };
  const parseDate=value=>value?new Date(value):null;
  const dateOnly=value=>{
    const d=parseDate(value);return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'}):'Tarih bekleniyor';
  };
  const moneyValue=(value,currency)=>{
    if(value===null||value===undefined||value==='')return 'Açıklanmadı';
    return new Intl.NumberFormat('tr-TR',{style:'currency',currency:currency||'TRY',maximumFractionDigits:2}).format(Number(value)||0);
  };
  const numberValue=value=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(Number(value)||0);

  function liveStatus(item){
    const explicit=String(item.status||'').toUpperCase();
    if(['ROADSHOW','FILED','PRICED'].includes(explicit))return explicit;
    const now=Date.now(),start=parseDate(item.start_at)?.getTime(),end=parseDate(item.end_at)?.getTime();
    if(Number.isFinite(start)&&now<start)return 'UPCOMING';
    if(Number.isFinite(end)&&now>end)return 'CLOSED';
    if(Number.isFinite(start)&&(!Number.isFinite(end)||now<=end))return 'OPEN';
    return explicit||'UPCOMING';
  }

  function timingLabel(item,status){
    if(status==='ROADSHOW')return 'Kesin işlem tarihi açıklanmadı';
    if(status==='FILED')return 'Fiyat aralığı bekleniyor';
    if(status==='PRICED')return 'İşlem başlangıcı bekleniyor';
    const now=new Date(),end=parseDate(item.end_at),start=parseDate(item.start_at);
    if(status==='CLOSED')return 'Başvuru süresi sona erdi';
    if(status==='OPEN'&&end){
      const hours=Math.max(0,Math.ceil((end-now)/36e5));
      if(hours<=24)return hours<=1?'Son saat':'Bugün son gün';
      return `${Math.ceil(hours/24)} gün kaldı`;
    }
    if(status==='UPCOMING'&&start){
      const days=Math.max(1,Math.ceil((start-now)/864e5));return `${days} gün sonra başlıyor`;
    }
    return '';
  }

  function dateRange(item){
    if(!item.start_at&&!item.end_at)return 'Tarih açıklanmadı';
    const a=dateOnly(item.start_at),b=dateOnly(item.end_at);
    return item.end_at&&a!==b?`${a} – ${b}`:a;
  }

  function priceLabel(item){
    if(Array.isArray(item.price_range)&&item.price_range.length===2){
      return `${moneyValue(item.price_range[0],item.currency)} – ${moneyValue(item.price_range[1],item.currency)}`;
    }
    return moneyValue(item.price,item.currency);
  }

  function decisionClass(value){
    const v=String(value||'').toUpperCase();
    if(v.includes('KATILMA')||v.includes('ALMA')||v.includes('UZAK'))return 'bad';
    if(v.includes('KATIL')&&!v.includes('SINIRLI'))return 'good';
    return 'warn';
  }

  function scoreClass(score){
    const n=Number(score);return n>=70?'good':n>=55?'warn':'bad';
  }

  function scenariosHtml(item){
    if(!Array.isArray(item.lot_scenarios)||!item.lot_scenarios.length)return '';
    return `<div class="ipoScenario"><strong>Tahmini bireysel dağıtım</strong><div class="ipoScenarioRows">${item.lot_scenarios.map(row=>`<div><span>${numberValue(row.participants)} kişi</span><b>${numberValue(row.estimated_lots)} lot</b><em>${moneyValue(row.estimated_amount,item.currency)}</em></div>`).join('')}</div></div>`;
  }

  function sourcesHtml(item){
    if(!Array.isArray(item.sources)||!item.sources.length)return '';
    return `<div class="ipoSources">${item.sources.map(source=>`<a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label||'Kaynak')}</a>`).join('')}</div>`;
  }

  function cardHtml(item){
    const status=liveStatus(item),currency=item.currency||'TRY';
    const demand=item.suggested_order?`${numberValue(item.suggested_order)} ${item.market==='BIST'?'lot':'adet'}`:'—';
    const budget=item.max_budget?moneyValue(item.max_budget,currency):'—';
    const issueSize=item.shares_offered?`${numberValue(item.shares_offered)} pay`:'Açıklanmadı';
    const view=item.mic_view||'İZLE';
    return `<article class="ipoCard" data-market="${esc(item.market)}" data-status="${status}">
      <div class="ipoTop">
        <div><div class="ipoTicker">${esc(item.ticker||'—')}</div><div class="ipoName">${esc(item.company||'')}</div></div>
        <div class="ipoBadges"><span class="ipoMarket ${item.market==='US'?'us':''}">${item.market==='US'?'ABD':'BIST'}</span><span class="ipoStatus ${status.toLowerCase()}">${STATUS_LABELS[status]||status}</span></div>
      </div>
      <div class="ipoDate"><strong>${dateRange(item)}</strong><span>${esc(timingLabel(item,status))}</span></div>
      <div class="ipoMetrics">
        <div><span>Fiyat</span><strong>${priceLabel(item)}</strong></div>
        <div><span>Arz büyüklüğü</span><strong>${issueSize}</strong></div>
        <div><span>MIC görüşü</span><strong class="${decisionClass(view)}">${esc(view)}</strong></div>
        <div><span>Kalite puanı</span><strong class="${scoreClass(item.score)}">${item.score??'—'}${item.score!=null?'/100':''}</strong></div>
      </div>
      <div class="ipoPlan"><div><span>Önerilen talep</span><strong>${demand}</strong></div><div><span>Azami bütçe</span><strong>${budget}</strong></div></div>
      <div class="ipoMeta">${esc(item.distribution||item.access||'Dağıtım/erişim bilgisi açıklanmadı')}</div>
      <button class="ghost wide ipoToggle" type="button">Detayları göster</button>
      <div class="ipoDetails hidden">
        <p>${esc(item.summary||'')}</p>
        ${item.main_risk?`<div class="ipoRisk"><b>Ana risk:</b> ${esc(item.main_risk)}</div>`:''}
        ${scenariosHtml(item)}
        ${sourcesHtml(item)}
      </div>
    </article>`;
  }

  function summaryCounts(items){
    const statuses=items.map(liveStatus);
    return {open:statuses.filter(x=>x==='OPEN').length,roadshow:statuses.filter(x=>x==='ROADSHOW'||x==='PRICED').length,filing:statuses.filter(x=>x==='FILED').length};
  }

  function render(){
    const list=el('ipoList');if(!list)return;
    const items=(ipoData.items||[]).filter(item=>activeMarket==='ALL'||item.market===activeMarket).sort((a,b)=>{
      const sa=STATUS_ORDER[liveStatus(a)]??9,sb=STATUS_ORDER[liveStatus(b)]??9;
      if(sa!==sb)return sa-sb;
      return String(a.start_at||'9999').localeCompare(String(b.start_at||'9999'));
    });
    list.innerHTML=items.length?items.map(cardHtml).join(''):'<div class="card empty">Bu filtrede halka arz bulunamadı.</div>';
    const counts=summaryCounts(ipoData.items||[]);
    if(el('ipoOpenCount'))el('ipoOpenCount').textContent=counts.open;
    if(el('ipoRoadshowCount'))el('ipoRoadshowCount').textContent=counts.roadshow;
    if(el('ipoFilingCount'))el('ipoFilingCount').textContent=counts.filing;
    if(el('homeIpoCount'))el('homeIpoCount').textContent=counts.open?`${counts.open} açık halka arz`:'Açık halka arz yok';
    document.querySelectorAll('[data-ipo-market]').forEach(btn=>btn.classList.toggle('active',btn.dataset.ipoMarket===activeMarket));
  }

  async function loadIpos(showToast=false){
    const status=el('ipoUpdated');
    if(status)status.textContent='Yükleniyor…';
    try{
      const response=await fetch(`data/ipo-calendar.json?t=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.items))throw new Error('Geçersiz veri yapısı');
      ipoData=data;
      if(status){const d=parseDate(data.updated_at);status.textContent=d&&!Number.isNaN(d.getTime())?`Doğrulama: ${d.toLocaleString('tr-TR')}`:'Doğrulama zamanı yok';}
      render();
      if(showToast&&typeof toast==='function')toast('Halka arz takvimi yenilendi');
    }catch(error){
      if(status)status.textContent='Takvim verisi alınamadı';
      if(el('ipoList'))el('ipoList').innerHTML=`<div class="card empty">Halka arz verisi yüklenemedi: ${esc(error.message)}</div>`;
      if(showToast&&typeof toast==='function')toast('Halka arz takvimi yenilenemedi');
    }
  }

  function installView(){
    if(el('ipo'))return;
    const main=document.querySelector('main');if(!main)return;
    const section=document.createElement('section');
    section.id='ipo';section.className='view';
    section.innerHTML=`
      <div class="section"><h2>Halka Arz Takvimi</h2><span id="ipoUpdated" class="source">Yükleniyor…</span></div>
      <div class="card ipoHero">
        <div><span class="source">BIST ve ABD · MIC v26</span><h3>Başvuru tarihini, fiyatı ve risk planını tek ekranda gör.</h3></div>
        <button id="refreshIpoData" class="ghost" type="button">Yenile</button>
      </div>
      <div class="grid3 ipoSummary">
        <div class="card metric"><span>Talebi açık</span><strong id="ipoOpenCount">0</strong></div>
        <div class="card metric"><span>ABD roadshow</span><strong id="ipoRoadshowCount">0</strong></div>
        <div class="card metric"><span>Fiyat bekleyen</span><strong id="ipoFilingCount">0</strong></div>
      </div>
      <div class="ipoFilters">${Object.entries(MARKET_LABELS).map(([key,label])=>`<button type="button" class="chip ${key==='ALL'?'active':''}" data-ipo-market="${key}">${label}</button>`).join('')}</div>
      <div class="ipoNotice">Takvim karar desteğidir; tarih ve fiyatlar değişebilir. İşlem öncesinde KAP/SPK veya SEC/NYSE/Nasdaq belgesini kontrol et.</div>
      <div id="ipoList"></div>`;
    const settings=el('settings');
    if(settings)settings.insertAdjacentElement('beforebegin',section);else main.appendChild(section);
  }

  function installNav(){
    const navBar=document.querySelector('.bottom');if(!navBar||navBar.querySelector('[data-view="ipo"]'))return;
    const button=document.createElement('button');button.className='nav';button.dataset.view='ipo';button.innerHTML='<b>▦</b>Halka Arz';
    const settingsButton=navBar.querySelector('[data-view="settings"]');
    if(settingsButton)settingsButton.insertAdjacentElement('beforebegin',button);else navBar.appendChild(button);
    button.addEventListener('click',()=>{if(typeof nav==='function')nav('ipo');loadIpos(false)});
  }

  function installHomeCard(){
    const home=el('home');if(!home||el('homeIpoCard'))return;
    const card=document.createElement('div');card.id='homeIpoCard';card.className='card homeIpoCard';
    card.innerHTML='<div><span class="source">Halka arz takvimi</span><h3 id="homeIpoCount">Yükleniyor…</h3><p class="muted">BIST talep tarihleri ve ABD IPO roadshow durumları.</p></div><button id="openIpoCalendar" class="ghost" type="button">Takvimi aç</button>';
    const last=el('lastDecision')?.closest('.card');
    if(last)last.insertAdjacentElement('beforebegin',card);else home.appendChild(card);
    el('openIpoCalendar')?.addEventListener('click',()=>{if(typeof nav==='function')nav('ipo');loadIpos(false)});
  }

  function bindEvents(){
    el('refreshIpoData')?.addEventListener('click',()=>loadIpos(true));
    el('ipo')?.addEventListener('click',event=>{
      const market=event.target.closest('[data-ipo-market]');
      if(market){activeMarket=market.dataset.ipoMarket;render();return}
      const toggle=event.target.closest('.ipoToggle');
      if(toggle){const details=toggle.nextElementSibling;details?.classList.toggle('hidden');toggle.textContent=details?.classList.contains('hidden')?'Detayları göster':'Detayları gizle';}
    });
  }

  function boot(){installView();installNav();installHomeCard();bindEvents();loadIpos(false)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
