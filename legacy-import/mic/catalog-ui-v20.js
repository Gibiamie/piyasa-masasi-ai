/* MIC v21 — multi-asset search and title corrections without DOM mutation loop */
(() => {
  if (window.__MIC_CATALOG_UI_V21) return;
  window.__MIC_CATALOG_UI_V21 = true;

  function correctCommitteeTitle(){
    document.querySelectorAll('.sideTitle').forEach(el=>{
      const correct='MIC Investment Committee';
      if(el.textContent!==correct)el.textContent=correct;
      if(el.getAttribute('aria-label')!==correct)el.setAttribute('aria-label',correct);
    });
  }

  function normalizeText(value){
    return String(value||'')
      .toLocaleUpperCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'');
  }

  const baseSearchMatches=window.searchMatches;
  window.searchMatches=function(asset,query){
    if(typeof baseSearchMatches==='function'&&baseSearchMatches(asset,query))return true;
    const aliases=Array.isArray(asset?.search_aliases)?asset.search_aliases.join(' '):'';
    const haystack=normalizeText(`${asset?.symbol||''} ${asset?.name||''} ${asset?.provider_symbol||''} ${aliases}`);
    const clean=normalizeText(query).replace(/[—–-]/g,' ');
    const terms=clean.split(/\s+/).filter(Boolean);
    return terms.length>0&&terms.every(term=>haystack.includes(term));
  };

  function refreshSearch(){
    correctCommitteeTitle();
    if(typeof runSearch==='function')runSearch();
  }

  correctCommitteeTitle();
  document.addEventListener('mic:asset-catalog-ready',refreshSearch,{once:false});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshSearch,{once:true});
  else setTimeout(refreshSearch,0);
})();