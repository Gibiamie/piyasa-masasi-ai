(() => {
  const POLICY={
    version:'DG-11',
    bist:{market:'BIST',intraday:'disabled',provider:'LICENSED_VENDOR_REQUIRED',publicUse:false,label:'Lisanslı sağlayıcı gerekli'},
    us:{market:'US',intraday:'backend_required',provider:'ALPACA_IEX_BASIC',publicUse:'partner_terms_required',label:'Sunucu bağlantısı gerekli'},
    crypto:{market:'CRYPTO',intraday:'backend_required',provider:'CCXT_EXCHANGE_API',publicUse:'exchange_terms_apply',label:'Sunucu bağlantısı gerekli'}
  };
  window.MIC_DATA_POLICY=POLICY;

  function addCard(){
    const settings=document.getElementById('settings');
    if(!settings||document.getElementById('dataGovernanceCard'))return;
    const cards=settings.querySelectorAll('.card');
    const card=document.createElement('div');
    card.id='dataGovernanceCard';card.className='card dataGovernanceCard';
    card.innerHTML=`
      <div class="section"><div><h3>Veri Kaynağı ve Lisans Durumu</h3><span class="source">RM-CHG-03 · profesyonel veri uyumluluk kapısı</span></div><span class="badge">DG-11</span></div>
      <p class="muted">MIC, veri sağlayıcı lisansı ve kullanım şartları doğrulanmadan herkese açık 1 saatlik/4 saatlik veriyi etkinleştirmez. API anahtarları tarayıcıya yazılmaz.</p>
      <div class="providerGrid">
        <div class="providerItem">
          <div class="providerTop"><strong>BIST</strong><span class="providerStatus blocked">INTRADAY KAPALI</span></div>
          <div class="providerMeta"><span><b>Planlanan kaynak:</b> Borsa İstanbul lisanslı dağıtıcı/alt dağıtıcı</span><span><b>1s/4s:</b> Lisans ve sözleşme tamamlanana kadar sunulmaz</span><span><b>tvDatafeed:</b> Herkese açık ürün kaynağı olarak kullanılmaz</span></div>
        </div>
        <div class="providerItem">
          <div class="providerTop"><strong>ABD Hisse & ETF</strong><span class="providerStatus pending">BACKEND BEKLİYOR</span></div>
          <div class="providerMeta"><span><b>Beta kaynağı:</b> Alpaca Basic / IEX</span><span><b>Ücretsiz sınır:</b> Bütün ABD piyasası değil; IEX kapsamı</span><span><b>Anahtar:</b> Yalnızca sunucuda çevresel değişken</span></div>
        </div>
        <div class="providerItem">
          <div class="providerTop"><strong>Kripto</strong><span class="providerStatus pending">BACKEND BEKLİYOR</span></div>
          <div class="providerMeta"><span><b>Planlanan kaynak:</b> CCXT üzerinden borsa OHLCV</span><span><b>1s/4s:</b> Borsanın doğal mumları; yoksa gerçek 1s mumlardan 4s toplama</span><span><b>Koşul:</b> Borsa kullanım şartları ve oran limitleri</span></div>
        </div>
      </div>
      <div class="dataPolicyNotice"><strong>Profesyonel kullanım kuralı:</strong> Kullanıcıya gösterilen her veri <b>HAM SAĞLAYICI VERİSİ</b>, <b>1 SAATLİK VERİDEN TOPLULAŞTIRILMIŞ</b>, <b>HESAPLANMIŞ GÖSTERGE</b> veya <b>MODEL KARARI</b> olarak sınıflandırılır. Günlük mumdan 1s/4s üretmek yasaktır.</div>
      <div class="dataClassLegend"><span>PROVIDER_NATIVE_BAR</span><span>AGGREGATED_FROM_1H</span><span>CALCULATED_INDICATOR</span><span>MODEL_DECISION</span></div>
      <div class="marketGatewayBadge"><i></i><span>MIC Market Gateway kodu hazır; canlı sunucu dağıtımı yapılmadı</span></div>`;
    if(cards.length)cards[0].insertAdjacentElement('beforebegin',card);else settings.appendChild(card);
  }

  function annotateChart(){
    const info=document.getElementById('chartInfo');
    if(!info||document.getElementById('chartComplianceNote'))return;
    const note=document.createElement('div');note.id='chartComplianceNote';note.className='marketGatewayBadge';
    note.innerHTML='<i></i><span>1s/4s yalnızca lisanslı veya şartları doğrulanmış sunucu sağlayıcısından açılır</span>';
    info.parentElement?.appendChild(note);
  }

  const USER_BASKET=[
    {symbol:'AKBNK',name:'Akbank T.A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:50,avgCost:57.55},
    {symbol:'AKSA',name:'Aksa Akrilik Kimya Sanayii A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:300,avgCost:9.99},
    {symbol:'ALTNY',name:'Altınay Savunma Teknolojileri A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:50.999,avgCost:7.53},
    {symbol:'AYES',name:'Ayes Çelik Hasır ve Çit Sanayi A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:4519.555,avgCost:2.30},
    {symbol:'CEMTS',name:'Çemtaş Çelik Makina Sanayi ve Ticaret A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:253.97,avgCost:10.10},
    {symbol:'EREGL',name:'Ereğli Demir ve Çelik Fabrikaları T.A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:1300,avgCost:20.70},
    {symbol:'FROTO',name:'Ford Otomotiv Sanayi A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:1050,avgCost:40.78},
    {symbol:'GLRMK',name:'Gülermak Ağır Sanayi İnşaat ve Taahhüt A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:35,avgCost:125.00},
    {symbol:'ISCTR',name:'Türkiye İş Bankası A.Ş. C',type:'stock',exchange:'BIST',currency:'TRY',quantity:500,avgCost:13.73},
    {symbol:'ISMEN',name:'İş Yatırım Menkul Değerler A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:41.647,avgCost:25.02},
    {symbol:'KOCMT',name:'Koç Metalurji A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:219.78,avgCost:3.73},
    {symbol:'ODINE',name:'Odine Solutions Teknoloji Ticaret ve Sanayi A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:9,avgCost:30.00},
    {symbol:'OSMEN',name:'Osmanlı Yatırım Menkul Değerler A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:202,avgCost:9.28},
    {symbol:'PGSUS',name:'Pegasus Hava Taşımacılığı A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:10,avgCost:217.19},
    {symbol:'REEDR',name:'Reeder Teknoloji Sanayi ve Ticaret A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:69,avgCost:6.20},
    {symbol:'RUBNS',name:'Rubenis Tekstil Sanayi Ticaret A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:100,avgCost:22.44},
    {symbol:'SAHOL',name:'Hacı Ömer Sabancı Holding A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:62,avgCost:45.63},
    {symbol:'SAYAS',name:'Say Yenilenebilir Enerji Ekipmanları Sanayi ve Ticaret A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:12,avgCost:88.59},
    {symbol:'SDTTR',name:'SDT Uzay ve Savunma Teknolojileri A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:8,avgCost:55.31},
    {symbol:'SELEC',name:'Selçuk Ecza Deposu Ticaret ve Sanayi A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:9,avgCost:26.27},
    {symbol:'SISE',name:'Türkiye Şişe ve Cam Fabrikaları A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:200,avgCost:45.56},
    {symbol:'THYAO',name:'Türk Hava Yolları A.O.',type:'stock',exchange:'BIST',currency:'TRY',quantity:300,avgCost:312.54},
    {symbol:'TTKOM',name:'Türk Telekomünikasyon A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:1400,avgCost:12.46},
    {symbol:'TTRAK',name:'Türk Traktör ve Ziraat Makineleri A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:127,avgCost:245.25},
    {symbol:'TUPRS',name:'Tüpraş Türkiye Petrol Rafinerileri A.Ş.',type:'stock',exchange:'BIST',currency:'TRY',quantity:395,avgCost:63.32},
    {symbol:'LUNR',name:'Intuitive Machines, Inc.',type:'stock',exchange:'NASDAQ',currency:'USD',quantity:285.628571,avgCost:17.50}
  ];

  function installUserBasket(){
    const button=document.getElementById('samplePortfolio');
    if(!button||button.dataset.userBasketInstalled==='1')return;
    button.dataset.userBasketInstalled='1';
    button.textContent='Sepetimi yükle';
    button.title='17 Mayıs 2026 doğrulanmış BIST sepeti ve daha sonra eklenen LUNR pozisyonu';
    button.onclick=()=>{
      if(Array.isArray(state.portfolio)&&state.portfolio.length&&!confirm(`Mevcut gerçek portföyde ${state.portfolio.length} pozisyon var. Sepetindeki 26 pozisyonla değiştirilsin mi?`))return;
      state.portfolio=USER_BASKET.map(position=>({...position}));
      if(state.ui)state.ui.portfolioMode='real';
      save();
      if(typeof setPortfolioMode==='function')setPortfolioMode('real');
      if(typeof nav==='function')nav('portfolio');
      toast('Sepetindeki 26 doğrulanmış pozisyon yüklendi');
    };
  }

  function boot(){addCard();annotateChart();installUserBasket();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  const observer=new MutationObserver(boot);observer.observe(document.body,{childList:true,subtree:true});
})();