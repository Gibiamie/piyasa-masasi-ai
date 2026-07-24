/* MIC Investor Profile Model RP-14
 * Separates willingness, financial capacity and experience.
 * Experience improves assessment confidence; it cannot by itself make a user high-risk.
 */
(() => {
  const MODEL='RP-14';
  const REQUIRED=['objective','horizon','liquidity','lossReaction','experience','incomeStability','maxDrawdown'];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  const rounded=v=>Math.round(Number(v)||0);

  const LABELS={
    objective:{preserve:'Sermayeyi koruma',income:'Düzenli gelir',balanced:'Dengeli büyüme',growth:'Uzun vadeli büyüme',speculative:'Yüksek büyüme / spekülatif'},
    horizon:{1:'0–1 yıl',3:'1–3 yıl',5:'3–5 yıl',10:'5+ yıl'},
    liquidity:{soon:'12 ay içinde gerekebilir',medium:'1–3 yıl içinde gerekebilir',long:'3 yıldan uzun süre gerekmez'},
    lossReaction:{sell:'Tamamını satarım',reduce:'Bir kısmını satarım',hold:'Beklerim',buy:'Uygunsa eklerim'},
    experience:{beginner:'0–2 yıl',intermediate:'2–5 yıl',advanced:'5+ yıl'},
    incomeStability:{low:'Düzensiz / belirsiz',medium:'Kısmen istikrarlı',high:'İstikrarlı'}
  };

  const SCORE={
    objective:{preserve:0,income:20,balanced:50,growth:75,speculative:100},
    horizon:{1:10,3:35,5:65,10:90},
    liquidity:{soon:10,medium:50,long:90},
    lossReaction:{sell:0,reduce:25,hold:65,buy:100},
    experience:{beginner:25,intermediate:60,advanced:85},
    incomeStability:{low:20,medium:55,high:85}
  };

  function drawdownScore(value){
    return clamp((clamp(value,5,50)-5)/45*100,0,100);
  }

  function addCap(caps,condition,value,text){
    if(condition)caps.push({value,text});
  }

  function calculateProfileRisk(p){
    const tolerance=(SCORE.objective[p.objective]+SCORE.lossReaction[p.lossReaction]+drawdownScore(p.maxDrawdown))/3;
    const capacity=(SCORE.horizon[p.horizon]+SCORE.liquidity[p.liquidity]+SCORE.incomeStability[p.incomeStability])/3;
    const experience=SCORE.experience[p.experience];

    // Willingness is primary, capacity is the suitability brake; experience has limited weight.
    const rawScore=tolerance*.55+capacity*.35+experience*.10;
    const caps=[];
    addCap(caps,p.objective==='preserve',35,'Sermayeyi koruma amacı yüksek risk sınıfını sınırlar.');
    addCap(caps,p.horizon==='1',42,'0–1 yıllık ufuk, kayıpları telafi süresini sınırlar.');
    addCap(caps,p.liquidity==='soon',45,'Paraya 12 ay içinde ihtiyaç ihtimali yüksek risk kapasitesini sınırlar.');
    addCap(caps,p.lossReaction==='sell',32,'%20 düşüşte tamamen satış eğilimi risk toleransını düşük sınıfta sınırlar.');
    addCap(caps,+p.maxDrawdown<=10,32,'Kabul edilen azami düşüş %10 veya altında.');
    addCap(caps,+p.maxDrawdown>10&&+p.maxDrawdown<=15,45,'Kabul edilen azami düşüş %15 veya altında; yüksek risk uygun değildir.');
    addCap(caps,p.incomeStability==='low'&&p.liquidity==='soon',28,'Düzensiz gelir ve yakın likidite ihtiyacı birlikte güçlü kapasite kısıtı oluşturur.');

    const cap=caps.length?Math.min(...caps.map(x=>x.value)):100;
    const score=clamp(Math.min(rawScore,cap),0,100);
    const risk=score<35?'low':score<60?'medium':'high';

    return {
      model:MODEL,
      score:rounded(score),
      rawScore:rounded(rawScore),
      cap,
      risk,
      tolerance:rounded(tolerance),
      capacity:rounded(capacity),
      experience:rounded(experience),
      constraints:caps.filter(x=>x.value===cap),
      allConstraints:caps
    };
  }

  function formProfile(){
    return {
      objective:$('objective').value,
      horizon:$('horizon').value,
      liquidity:$('liquidity').value,
      lossReaction:$('lossReaction').value,
      experience:$('experience').value,
      incomeStability:$('incomeStability').value,
      maxDrawdown:clamp($('maxDrawdown').value,5,60),
      maxPosition:clamp($('maxPosition').value,1,40),
      rebalanceBand:clamp($('rebalanceBand').value,.5,10),
      monthlyContribution:Math.max(0,Number($('monthlyContribution').value)||0)
    };
  }

  function complete(p){return REQUIRED.every(id=>String(p[id]??'').trim())}
  function riskText(risk){return risk==='low'?'Düşük risk':risk==='high'?'Yüksek risk':'Orta risk'}
  function riskClass(risk){return risk==='low'?'riskLow':risk==='high'?'riskHigh':'riskMedium'}

  function factorsHtml(p,r){
    const items=[
      `<li><b>Risk isteği ${r.tolerance}/100:</b> ${LABELS.objective[p.objective]}, düşüşte “${LABELS.lossReaction[p.lossReaction]}”, azami düşüş %${rounded(p.maxDrawdown)}.</li>`,
      `<li><b>Finansal kapasite ${r.capacity}/100:</b> ufuk ${LABELS.horizon[p.horizon]}, likidite “${LABELS.liquidity[p.liquidity]}”, gelir ${LABELS.incomeStability[p.incomeStability].toLocaleLowerCase('tr-TR')}.</li>`,
      `<li><b>Deneyim ${r.experience}/100:</b> ${LABELS.experience[p.experience]}. Deneyim tek başına risk seviyesini yükseltmez.</li>`
    ];
    if(r.constraints.length)items.push(...r.constraints.map(x=>`<li class="constraint"><b>Uygunluk sınırı:</b> ${x.text} Son skor en fazla ${x.value}/100 olabilir.</li>`));
    else items.push('<li><b>Uygunluk sınırı:</b> Sert bir kapasite kısıtı uygulanmadı.</li>');
    return items.join('');
  }

  function previewHtml(p,r){
    return `<div class="riskPreviewTop"><div><span>Canlı profil sonucu · ${MODEL}</span><strong class="${riskClass(r.risk)}">${riskText(r.risk)}</strong></div><div class="riskScoreCircle ${riskClass(r.risk)}">${r.score}<small>/100</small></div></div>
      <div class="riskMeter"><i style="width:${r.score}%"></i><span class="lowBand">Düşük</span><span class="midBand">Orta</span><span class="highBand">Yüksek</span></div>
      <div class="riskMiniGrid"><div><span>Risk isteği</span><b>${r.tolerance}</b></div><div><span>Finansal kapasite</span><b>${r.capacity}</b></div><div><span>Deneyim</span><b>${r.experience}</b></div><div><span>Ham skor</span><b>${r.rawScore}</b></div></div>`;
  }

  function ensurePreview(){
    let box=document.getElementById('riskPreviewV14');
    if(box)return box;
    const button=$('saveProfile');
    if(!button)return null;
    box=document.createElement('div');box.id='riskPreviewV14';box.className='riskPreviewV14 full';
    button.insertAdjacentElement('beforebegin',box);
    return box;
  }

  function updatePreview(){
    const box=ensurePreview();if(!box)return;
    const p=formProfile();
    if(!complete(p)){
      box.innerHTML='<div class="riskPreviewEmpty"><b>Profil sonucu bekleniyor</b><span>Yedi zorunlu cevabın tamamını girin. Pozisyon limiti ve aylık katkı, risk sınıfını değil portföy kararını etkiler.</span></div>';
      return;
    }
    box.innerHTML=previewHtml(p,calculateProfileRisk(p));
  }

  // Replace the old additive model. Keep the public function name used by the decision engine.
  calculateRisk=calculateProfileRisk;

  const oldRenderHome=renderHome;
  renderHome=function(){
    oldRenderHome();
    if(profileComplete()&&state.profile?.riskScore!==undefined){
      $('homeProfile').textContent=`${riskText(state.profile.risk).replace(' risk','')} · ${state.profile.riskScore}/100`;
    }
  };

  renderProfileResult=function(){
    const p=state.profile,box=$('profileResult');
    if(!profileComplete()){box.classList.add('hidden');return}
    const r=calculateProfileRisk(p);
    box.classList.remove('hidden');
    box.innerHTML=`<div class="assetTop"><div><h3>Oluşturulan profil</h3><div class="assetName">Üç bileşenli uygunluk modeli · ${MODEL}</div></div><span class="badge ${riskClass(r.risk)}">${riskText(r.risk)}</span></div>
      <div class="riskResultHero"><div class="riskScoreCircle large ${riskClass(r.risk)}">${r.score}<small>/100</small></div><div><b>Sonuç: ${riskText(r.risk)}</b><span>Ham skor ${r.rawScore}/100${r.cap<100?`; uygunluk sınırı ${r.cap}/100`:''}</span></div></div>
      <div class="analysis riskAnalysis"><div class="cell"><span>Risk isteği</span><strong>${r.tolerance}/100</strong></div><div class="cell"><span>Finansal kapasite</span><strong>${r.capacity}/100</strong></div><div class="cell"><span>Deneyim</span><strong>${r.experience}/100</strong></div><div class="cell"><span>Pozisyon limiti</span><strong>%${num(p.maxPosition)}</strong></div><div class="cell"><span>Azami düşüş</span><strong>%${num(p.maxDrawdown)}</strong></div></div>
      <ul class="riskFactors">${factorsHtml(p,r)}</ul>
      <p class="hint">Risk sınıfı; AL/TUT/AZALT/SAT kararının kendisi değildir. Karar motoru ayrıca varlık riski, veri kalitesi ve mevcut portföy ağırlığını kullanır.</p>`;
  };

  const saveButton=$('saveProfile');
  if(saveButton){
    saveButton.onclick=()=>{
      const p=formProfile();
      if(!complete(p))return toast('7 sorunun tamamını cevapla');
      const r=calculateProfileRisk(p);
      Object.assign(p,{
        risk:r.risk,riskScore:r.score,riskRawScore:r.rawScore,riskTolerance:r.tolerance,
        riskCapacity:r.capacity,experienceScore:r.experience,riskCap:r.cap,
        riskConstraints:r.allConstraints.map(x=>x.text),riskModel:MODEL
      });
      state.profile=p;
      ['maxDrawdown','maxPosition','rebalanceBand','monthlyContribution'].forEach(id=>{$(id).value=p[id]});
      save();updateProfileProgress();renderProfileResult();updatePreview();
      toast(`${riskText(r.risk)} profili kaydedildi: ${r.score}/100`);
    };
  }

  REQUIRED.concat(['maxPosition','rebalanceBand','monthlyContribution']).forEach(id=>{
    const el=$(id);if(!el)return;
    el.addEventListener(el.tagName==='INPUT'?'input':'change',updatePreview);
  });

  const intro=document.querySelector('#profile .profileIntro p');
  if(intro)intro.textContent='Yedi cevaptan risk isteği, finansal risk kapasitesi ve deneyim ayrı hesaplanır. Kısa ufuk, yakın nakit ihtiyacı veya düşük kayıp toleransı yüksek risk sonucunu sınırlar.';

  // Recalculate profiles saved with the old 20-point additive model.
  if(state.profile&&complete(state.profile)){
    const r=calculateProfileRisk(state.profile);
    Object.assign(state.profile,{
      risk:r.risk,riskScore:r.score,riskRawScore:r.rawScore,riskTolerance:r.tolerance,
      riskCapacity:r.capacity,experienceScore:r.experience,riskCap:r.cap,
      riskConstraints:r.allConstraints.map(x=>x.text),riskModel:MODEL
    });
    save();renderProfileResult();
  }

  // Deterministic regression vectors: low, the user's shown medium case, and high.
  const tests=[
    calculateProfileRisk({objective:'preserve',horizon:'1',liquidity:'soon',lossReaction:'sell',experience:'beginner',incomeStability:'low',maxDrawdown:10}).risk==='low',
    calculateProfileRisk({objective:'income',horizon:'3',liquidity:'long',lossReaction:'reduce',experience:'advanced',incomeStability:'high',maxDrawdown:20}).risk==='medium',
    calculateProfileRisk({objective:'speculative',horizon:'10',liquidity:'long',lossReaction:'buy',experience:'advanced',incomeStability:'high',maxDrawdown:50}).risk==='high'
  ];
  window.MIC_PROFILE_MODEL_TESTS={model:MODEL,passed:tests.filter(Boolean).length,total:tests.length};
  if(tests.some(x=>!x))console.error('MIC RP-14 profile model regression test failed',window.MIC_PROFILE_MODEL_TESTS);

  updatePreview();renderHome();
})();