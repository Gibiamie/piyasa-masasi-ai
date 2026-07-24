/* MIC v23 — end-user product language and version label */
(() => {
  if (window.__MIC_PRODUCT_LANGUAGE_V23) return;
  window.__MIC_PRODUCT_LANGUAGE_V23 = true;

  const desktop=location.pathname.includes('mic-desktop');
  const setVersion=()=>{
    const sub=document.querySelector('.top .sub');
    if(sub)sub.textContent=desktop?'Laptop web · yatırım karar desteği · v23':'Mobil yatırım karar desteği · v23';
    document.title=desktop?'MIC Laptop Web Beta v23':'MIC Mobile Beta v23';
  };

  function simplifyDataCard(){
    const card=document.getElementById('dataGovernanceCard');
    if(!card)return;
    const heading=card.querySelector('.section h3');if(heading)heading.textContent='Veri Durumu';
    const source=card.querySelector('.section .source');if(source)source.textContent='Varlık bazında otomatik veri kontrolü';
    const badge=card.querySelector('.section .badge');if(badge)badge.textContent='AKTİF';
    const intro=card.querySelector(':scope > p.muted');
    if(intro)intro.textContent='MIC, seçilen varlık için kullanılabilir fiyat ve grafik verisini otomatik yükler. Desteklenmeyen zaman aralıkları kullanıcıyı teknik ayrıntıya boğmadan kapalı gösterilir.';
    const items=card.querySelectorAll('.providerItem');
    if(items[0])items[0].innerHTML='<div class="providerTop"><strong>BIST</strong><span class="providerStatus pending">GÜNLÜK VERİ</span></div><div class="providerMeta"><span>Günlük fiyat ve grafik verileri kullanılabilir.</span><span>Gün içi zaman aralıkları desteklenmeyen varlıklarda otomatik kapalıdır.</span></div>';
    if(items[1])items[1].innerHTML='<div class="providerTop"><strong>ABD Hisse & ETF</strong><span class="providerStatus pending">BAĞLANTIYLA AKTİF</span></div><div class="providerMeta"><span>Günlük grafikler ve uygun varlıklarda 1 saat/4 saat veriler otomatik yüklenir.</span><span>Veri durumu her varlık ekranında açıkça gösterilir.</span></div>';
    if(items[2])items[2].innerHTML='<div class="providerTop"><strong>Kripto</strong><span class="providerStatus pending">BAĞLANTIYLA AKTİF</span></div><div class="providerMeta"><span>Anlık fiyat, günlük grafik ve 1 saat/4 saat veriler otomatik yüklenir.</span><span>İlk istek, ücretsiz sunucu uykudaysa kısa süre gecikebilir.</span></div>';
    const notice=card.querySelector('.dataPolicyNotice');
    if(notice)notice.innerHTML='<strong>Gösterim kuralı:</strong> Kullanılabilir veri gösterilir; eksik veriyle karar üretilmez.';
    const legend=card.querySelector('.dataClassLegend');if(legend)legend.style.display='none';
    const gatewayBadge=card.querySelector('.marketGatewayBadge span');
    if(gatewayBadge){
      const ready=Boolean(state?.settings?.marketGateway?.url);
      gatewayBadge.textContent=ready?'Canlı veri bağlantısı hazır':'Canlı veri bağlantısını Ayarlar bölümünden tamamlayın';
    }
  }

  function simplifyGatewayCard(){
    const card=document.getElementById('intradayGatewayCard');if(!card)return;
    const intro=card.querySelector(':scope > p.muted');
    if(intro)intro.textContent='Canlı ve gün içi veriler bağlantı kurulduğunda otomatik yüklenir. Bu ayar her tarayıcı ve cihaz için bir kez yapılır.';
    const status=card.querySelector('#gatewayStatus');
    if(status&&!status.textContent)status.textContent='Bağlantı bilgileri yalnızca bu tarayıcıda saklanır.';
  }

  const baseShowChartMessage=window.showChartMessage;
  if(typeof baseShowChartMessage==='function'){
    window.showChartMessage=function(text){
      let friendly=String(text||'');
      if(/günlük fiyat dosyası|günlük fiyat serisi/i.test(friendly))friendly='Grafik verisi hazırlanıyor. Aşağıdaki düğmeyle yeniden deneyin.';
      if(/lisans|sağlayıcı|provider/i.test(friendly))friendly='Bu zaman aralığı şu anda bu varlık için kullanılamıyor.';
      return baseShowChartMessage(friendly);
    };
  }

  function apply(){setVersion();simplifyDataCard();simplifyGatewayCard();}
  apply();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  setTimeout(apply,250);
})();
