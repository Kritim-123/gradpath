'use strict';
const paperClient=OpenAlex.createClient();
let paperSearch={query:'',openOnly:false,sort:'relevance',status:'idle',result:null,error:'',request:null};
let paperRequest=0,paperController;

function paperSearchPanel(){
 const query=paperSearch.query||OpenAlex.suggestQuery(state.idea?.question||'',state.idea?.field||'');
 const interests=ResearchMatch.list(state.profile.interests).slice(0,8);
 return `<section class="panel paper-search" aria-labelledby="paper-heading"><div class="paper-heading"><div><span class="light-label">READ BEYOND THE CATALOG</span><h2 id="paper-heading">Find real research papers.</h2><p>Search OpenAlex with your question, a few keywords, or an interest from your profile.</p></div><span class="paper-provider">${icon('book')} OpenAlex</span></div>
 <p id="paper-privacy" class="form-note">Searching sends the terms below to OpenAlex. Your name, messages, and full profile stay in this browser.</p>
 <form id="paper-search-form" aria-describedby="paper-privacy"><label class="field-label" for="paper-query">Paper search terms</label><div class="paper-query-row"><input id="paper-query" class="field" name="query" type="search" required minlength="2" maxlength="320" value="${esc(query)}" placeholder="e.g. 3D projection mapping" autocomplete="off"><button class="btn primary" type="submit">${icon('search')} Search papers</button></div>
 <div class="paper-filters"><label class="paper-checkbox"><input type="checkbox" name="openOnly" ${paperSearch.openOnly?'checked':''}> Open access only</label><label class="paper-sort">Sort by <select name="sort" class="field"><option value="relevance" ${paperSearch.sort==='relevance'?'selected':''}>Relevance</option><option value="newest" ${paperSearch.sort==='newest'?'selected':''}>Newest first</option></select></label></div></form>
 ${interests.length?`<div class="paper-interests"><span>${state.profile.customized?'Search an interest':'Try a sample interest'}</span>${interests.map(i=>button(esc(i),'paper-interest',i,'small')).join('')}</div>`:''}
 <div id="paper-results" aria-busy="${paperSearch.status==='loading'}">${paperResults()}</div></section>`;
}
function paperCard(p){
 const authors=p.authors.slice(0,3).join(', ')+(p.authors.length>3?' et al.':'');
 return `<article class="paper-card"><div class="paper-meta"><span>${esc([p.year,p.type].filter(Boolean).join(' · ')||'Publication details unavailable')}</span><span class="paper-access ${p.openAccess?'open':''}">${p.openAccess?'Open access':'Access varies'}</span></div><h3>${external(p.url,esc(p.title))}</h3><p class="paper-authors">${esc(authors||'Authors unavailable')}</p>${p.venue?`<p class="paper-venue">${esc(p.venue)}</p>`:''}${p.abstract?`<details class="paper-abstract"><summary>Read abstract</summary><p>${esc(p.abstract)}</p></details>`:'<p class="paper-missing">No abstract available in OpenAlex.</p>'}<div class="paper-links">${external(p.openURL||p.url,p.openURL?'Read open version':'View publication')}${external(p.id,'OpenAlex record')}</div></article>`;
}
function paperResults(){
 if(paperSearch.status==='idle')return '<div class="paper-placeholder" role="status">Choose an interest or enter search terms to start reading. Papers are retrieved when you search.</div>';
 if(paperSearch.status==='loading')return `<div class="paper-placeholder" role="status">${icon('search')} Searching OpenAlex for “${esc(paperSearch.request.query)}”…</div>`;
 if(paperSearch.status==='error')return `<div class="paper-feedback" role="status"><h3>Paper search is unavailable right now</h3><p>${esc(paperSearch.error)}</p><div class="action-row">${button('Try again','paper-retry','','small')}${external(OpenAlex.websiteURL(paperSearch.request),'Open search on OpenAlex')}</div><p class="form-note">Your idea and the curated GradPath connections below are still available.</p></div>`;
 const r=paperSearch.result;
 if(!r.papers.length)return `<div class="paper-feedback" role="status"><h3>No papers found for “${esc(r.query)}”</h3><p>Try fewer keywords, a different phrase, or turn off the open access filter, then search again.</p>${external(OpenAlex.websiteURL(r),'Search on OpenAlex')}</div>`;
 return `<div class="paper-results-heading"><p role="status">${r.papers.length} ${r.papers.length===1?'paper':'papers'} for <strong>“${esc(r.query)}”</strong>${r.openOnly?' · open access':''} · ${r.sort==='newest'?'newest first':'by relevance'}</p>${button('Download reading list','paper-download','','small','download')}</div><div class="paper-grid">${r.papers.map(paperCard).join('')}</div><div class="paper-results-footer">${external(OpenAlex.websiteURL(r),'Explore more on OpenAlex')}<span>${r.cached?'Retrieved earlier this visit':'Retrieved'} ${esc(new Date(r.fetchedAt).toLocaleDateString())}</span></div><p class="form-note">Publication details come from OpenAlex and may be incomplete. Results can include preprints; check the publication and its relevance before citing. Author listings do not indicate availability to supervise.</p>`;
}
function refreshPaperResults(){
 const target=document.getElementById('paper-results');if(!target)return;
 target.setAttribute('aria-busy',String(paperSearch.status==='loading'));target.innerHTML=paperResults();
}
async function runPaperSearch(query,filters={}){
 const request={query:String(query).trim(),openOnly:filters.openOnly??paperSearch.openOnly,sort:filters.sort||paperSearch.sort};
 if(request.query.length<2||request.query.length>320){notify('Use between 2 and 320 characters for your paper search.');return;}
 paperController?.abort();paperController=new AbortController();const sequence=++paperRequest;
 Object.assign(paperSearch,request,{request,status:'loading',result:null,error:''});
 const form=document.getElementById('paper-search-form');if(form){form.elements.query.value=request.query;form.elements.openOnly.checked=request.openOnly;form.elements.sort.value=request.sort;}
 refreshPaperResults();
 try{
  const result=await paperClient.search(request,{signal:paperController.signal});
  if(sequence!==paperRequest)return;
  Object.assign(paperSearch,{status:'ready',result});
 }catch(error){if(sequence!==paperRequest||error.name==='AbortError')return;Object.assign(paperSearch,{status:'error',error:error.message});}
 refreshPaperResults();
}
function resetPaperSearch(){
 paperController?.abort();++paperRequest;paperClient.clear();
 paperSearch={query:'',openOnly:false,sort:'relevance',status:'idle',result:null,error:'',request:null};
}
function paperReadingList(){
 const r=paperSearch.result;if(!r)return '';
 return ['GRADPATH · OPENALEX READING LIST','Search: '+r.query,'Order: '+r.sort+(r.openOnly?' · open access only':''),'Retrieved: '+new Date(r.fetchedAt).toISOString(),'',...r.papers.map(p=>[p.title,p.authors.join(', '),[p.year,p.venue].filter(Boolean).join(' · '),p.url,p.openURL?'Open version: '+p.openURL:'','OpenAlex: '+p.id,''].filter(Boolean).join('\n')),'','Publication metadata supplied by OpenAlex. Verify each source before citing; this list is not a complete literature review.'].join('\n');
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='paper-search-form')return;event.preventDefault();
 const form=new FormData(event.target);runPaperSearch(form.get('query'),{openOnly:form.has('openOnly'),sort:form.get('sort')});
});
document.addEventListener('input',event=>{if(event.target.id==='paper-query')paperSearch.query=event.target.value;});
document.addEventListener('change',event=>{
 if(event.target.form?.id!=='paper-search-form')return;
 if(event.target.name==='openOnly')paperSearch.openOnly=event.target.checked;
 if(event.target.name==='sort')paperSearch.sort=event.target.value;
});
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 if(el.dataset.action==='paper-interest')runPaperSearch(el.dataset.value);
 if(el.dataset.action==='paper-retry'&&paperSearch.request)runPaperSearch(paperSearch.request.query,paperSearch.request);
 if(el.dataset.action==='paper-download'&&paperSearch.result)download('GradPath-OpenAlex-reading-list.txt',paperReadingList());
});
