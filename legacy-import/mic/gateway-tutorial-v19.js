/* MIC v19 — Intraday gateway tutorial
 * Clarifies that the gateway URL is created by deployment and the access token is chosen by the administrator.
 */
(() => {
  if (window.__MIC_GATEWAY_TUTORIAL_V19) return;
  window.__MIC_GATEWAY_TUTORIAL_V19 = true;

  const REPO_URL='https://github.com/Gibiamie/Gibiamie.github.io/tree/main/mic-gateway';
  const ALPACA_DOCS='https://docs.alpaca.markets/docs/getting-started-with-alpaca-market-data';
  const RENDER_DASHBOARD='https://dashboard.render.com/';
  let generatedToken='';

  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function randomToken(){
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function copyText(text,notice){
    try{await navigator.clipboard.writeText(text);if(notice)notice.textContent='Kopyalandı.'}
    catch{if(notice)notice.textContent='Otomatik kopyalama engellendi; metni seçip kopyalayın.'}
  }

  function modalHtml(){
    const currentUrl=state?.settings?.marketGateway?.url||'';
    return `<div class="gatewayTutorialOverlay" id="gatewayTutorialOverlayV19" role="dialog" aria-modal="true" aria-labelledby="gatewayTutorialTitleV19">
      <div class="gatewayTutorialModal">
        <div class="gatewayTutorialHeader">
          <div><h2 id="gatewayTutorialTitleV19">1 Saat / 4 Saat Gateway Kurulum Rehberi</h2><p>Normal kullanıcı ve sistem yöneticisi için adım adım açıklama</p></div>
          <button class="gatewayTutorialClose" id="gatewayTutorialCloseV19" aria-label="Kapat">×</button>
        </div>
        <div class="gatewayTutorialBody">
          <div class="gatewayTruthBox">
            <strong>Önce en önemli cevap:</strong>
            <span>Hazır olarak satın alınan veya e-postayla gelen bir “MIC Gateway anahtarı” yoktur.</span>
            <span><b>Gateway adresi</b>, MIC Market Gateway Render üzerinde deploy edildikten sonra oluşan <code>https://...onrender.com</code> adresidir.</span>
            <span><b>Erişim anahtarı</b>, sistem yöneticisinin kendisinin oluşturduğu güvenlik tokenidir. Alpaca API anahtarı değildir.</span>
          </div>

          <div class="gatewayRoleGrid">
            <div class="gatewayRoleCard"><h3>Normal kullanıcı</h3><p>Hiçbir API anahtarı veya gateway adresi girmez. Uygulama yöneticisi bağlantıyı bir kez kurduğunda 1 Saat ve 4 Saat seçenekleri otomatik çalışır.</p></div>
            <div class="gatewayRoleCard"><h3>Uygulama sahibi / yönetici</h3><p>Alpaca sunucu anahtarlarını alır, gateway servisini deploy eder ve oluşan URL ile erişim tokenini MIC Ayarlar bölümüne bir kez kaydeder.</p></div>
          </div>

          <div class="gatewaySteps">
            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">1</span><div><h3>Alpaca Basic hesabını ve sunucu anahtarlarını oluştur</h3><p>ABD hisse ve ETF 1s/4s verisi için Alpaca Dashboard içindeki <b>API Keys</b> bölümünden Key ID ve Secret Key üret. Bu iki değer yalnızca Render sunucusuna girilir; MIC tarayıcısına veya GitHub koduna yazılmaz.</p></div></div>
              <div class="gatewayLinkRow"><a href="${ALPACA_DOCS}" target="_blank" rel="noopener">Alpaca resmî rehberini aç</a></div>
            </div>

            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">2</span><div><h3>Gateway erişim tokenini oluştur</h3><p>Bu tokeni sen belirlersin. Aynı değeri Render'daki <code>GATEWAY_ACCESS_TOKEN</code> ortam değişkenine ve MIC'teki “Erişim anahtarı” alanına gireceksin.</p></div></div>
              <div class="gatewayTokenBox"><input id="gatewayGeneratedTokenV19" readonly placeholder="Token oluştur düğmesine bas"><button class="gatewayActionButton" id="gatewayGenerateTokenV19">Token oluştur</button><button class="gatewayActionButton" id="gatewayCopyTokenV19">Kopyala</button></div>
              <div class="gatewayCopyNotice" id="gatewayCopyNoticeV19"></div>
            </div>

            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">3</span><div><h3>Render üzerinde MIC Market Gateway'i deploy et</h3><ol><li>Render Dashboard'u aç.</li><li><b>New → Blueprint</b> seç.</li><li>GitHub hesabını bağla ve <b>Gibiamie/Gibiamie.github.io</b> reposunu seç.</li><li>Blueprint dosya yolu olarak <code>mic-gateway/render.yaml</code> gir.</li><li>Aşağıdaki gizli ortam değişkenlerini doldur.</li><li>Deploy işlemini başlat.</li></ol></div></div>
              <table class="gatewayEnvTable"><thead><tr><th>Render değişkeni</th><th>Girilecek değer</th></tr></thead><tbody>
                <tr><td>ALPACA_API_KEY_ID</td><td>Alpaca Dashboard'daki API Key ID</td></tr>
                <tr><td>ALPACA_API_SECRET_KEY</td><td>Alpaca Secret Key</td></tr>
                <tr><td>GATEWAY_ACCESS_TOKEN</td><td>2. adımda oluşturduğun token</td></tr>
                <tr><td>ALLOWED_ORIGINS</td><td>Hazır gelir: https://gibiamie.github.io</td></tr>
                <tr><td>CRYPTO_EXCHANGE</td><td>Hazır gelir: kraken</td></tr>
              </tbody></table>
              <div class="gatewayLinkRow"><a href="${RENDER_DASHBOARD}" target="_blank" rel="noopener">Render Dashboard'u aç</a><a href="${REPO_URL}" target="_blank" rel="noopener">Gateway kodunu aç</a></div>
            </div>

            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">4</span><div><h3>Render'ın verdiği gateway adresini kopyala</h3><p>Deploy tamamlandığında servis sayfasında şu biçimde bir URL oluşur:</p><code class="gatewayCode">https://mic-market-gateway-xxxx.onrender.com</code><p>Bu URL “Gateway adresi” alanına girilecek değerdir. Şu an kayıtlı adres: <b>${currentUrl?escHtml(currentUrl):'yok'}</b></p></div></div>
            </div>

            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">5</span><div><h3>MIC'e bağla ve test et</h3><ol><li>Bu rehberi kapat.</li><li>Gateway adresini ilgili alana yapıştır.</li><li>Render'da kullandığın aynı erişim tokenini “Erişim anahtarı” alanına yapıştır.</li><li><b>Kaydet</b> düğmesine bas.</li><li><b>Bağlantıyı test et</b> düğmesine bas.</li></ol><p>Başarılı sonuç: <b>Bağlantı başarılı: MIC Market Gateway</b></p></div></div>
              <div class="gatewayLinkRow"><button class="gatewayActionButton" id="gatewayTransferTokenV19">Oluşturulan tokeni forma aktar</button></div>
            </div>

            <div class="gatewayStep">
              <div class="gatewayStepTop"><span class="gatewayStepNo">6</span><div><h3>1 Saat / 4 Saat grafiğini doğrula</h3><p>ABD hissesi veya ETF seç → Grafik ve Sinyaller → 1 Saat veya 4 Saat. Kaynak etiketi <b>ALPACA_IEX</b> görünmelidir. Kriptoda kaynak <b>CCXT_KRAKEN</b> benzeri görünür.</p></div></div>
            </div>
          </div>

          <div class="gatewayWarning"><b>BIST sınırı:</b> Bu kurulum BIST 1s/4s verisini açmaz. BIST intraday, lisanslı Borsa İstanbul veri sağlayıcısı bağlanana kadar kapalı kalır. Günlük veriden yapay saatlik mum üretilmez.</div>
          <div class="gatewaySuccess"><b>Güvenlik kuralı:</b> Alpaca Secret Key yalnızca Render ortam değişkeninde tutulur. MIC ekranına yalnızca gateway URL'si ve senin oluşturduğun gateway erişim tokeni girilir.</div>
        </div>
        <div class="gatewayTutorialFooter"><button id="gatewayTutorialDoneV19">Rehberi kapat</button></div>
      </div>
    </div>`;
  }

  function close(){document.getElementById('gatewayTutorialOverlayV19')?.remove();}

  function open(){
    close();document.body.insertAdjacentHTML('beforeend',modalHtml());
    const overlay=document.getElementById('gatewayTutorialOverlayV19');
    const tokenInput=document.getElementById('gatewayGeneratedTokenV19');
    const notice=document.getElementById('gatewayCopyNoticeV19');
    document.getElementById('gatewayTutorialCloseV19').onclick=close;
    document.getElementById('gatewayTutorialDoneV19').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',function escHandler(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',escHandler)}});
    document.getElementById('gatewayGenerateTokenV19').onclick=()=>{generatedToken=randomToken();tokenInput.value=generatedToken;notice.textContent='64 karakterlik güvenli token oluşturuldu.'};
    document.getElementById('gatewayCopyTokenV19').onclick=()=>{if(!tokenInput.value){notice.textContent='Önce token oluştur.';return}copyText(tokenInput.value,notice)};
    document.getElementById('gatewayTransferTokenV19').onclick=()=>{
      if(!tokenInput.value){notice.textContent='Önce token oluştur.';return}
      const field=document.getElementById('gatewayToken');
      if(!field){notice.textContent='Erişim anahtarı alanı bulunamadı.';return}
      field.value=tokenInput.value;field.dispatchEvent(new Event('input',{bubbles:true}));notice.textContent='Token erişim anahtarı alanına aktarıldı. Kaydet düğmesine bas.';
    };
  }

  function install(){
    const card=document.getElementById('intradayGatewayCard');if(!card)return;
    const section=card.querySelector('.section');if(!section||document.getElementById('gatewayTutorialButtonV19'))return;
    const badge=section.querySelector('.badge');
    const holder=document.createElement('div');holder.className='intradayHeaderActions';
    const button=document.createElement('button');button.id='gatewayTutorialButtonV19';button.className='gatewayTutorialButton';button.type='button';button.textContent='Kurulum rehberi';button.onclick=open;
    if(badge){badge.replaceWith(holder);holder.append(button,badge)}else{holder.appendChild(button);section.appendChild(holder)}
    const status=card.querySelector('#gatewayStatus');
    if(status&&!status.textContent.trim())status.textContent='Gateway adresi hazır olarak verilmez. INTRADAY yanındaki “Kurulum rehberi” düğmesini aç.';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  const observer=new MutationObserver(install);observer.observe(document.body,{childList:true,subtree:true});
})();
