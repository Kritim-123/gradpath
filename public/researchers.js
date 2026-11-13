'use strict';
const OpenAlexResearchers=(()=>{
 const institution='https://openalex.org/I169521973';
 const endpoint='https://gradpath-research-journey.raged-rhombus.chatgpt.site/api/researchers';
 const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
 function author(a){
  if(!a||!/^https:\/\/openalex.org\/A\d+$/.test(a.id)||!clean(a.display_name))return null;
  const affiliations=(Array.isArray(a.last_known_institutions)?a.last_known_institutions:[]).filter(i=>/^https:\/\/openalex.org\/I\d+$/.test(i?.id)).slice(0,10).map(i=>({id:i.id,display_name:clean(i.display_name).slice(0,200),country_code:clean(i.country_code).slice(0,2)}));
  if(!affiliations.length)return null;
  return {id:a.id,display_name:clean(a.display_name).slice(0,200),last_known_institutions:affiliations,
   orcid:/^https:\/\/orcid.org\/[\dX-]+$/.test(a.orcid)?a.orcid:null,
   topics:(Array.isArray(a.topics)?a.topics:[]).slice(0,5).map(t=>({display_name:clean(t?.display_name).slice(0,200)})).filter(t=>t.display_name),
   works_count:Number.isSafeInteger(a.works_count)&&a.works_count>=0?a.works_count:0};
 }
 const inside=a=>a.last_known_institutions.some(i=>i.id===institution);
 function options(input={}){
  const query=clean(input.query),scope=input.scope||'inside',field=input.field||'all',page=input.page??1;
  if((query&&query.length<2)||query.length>120||!['inside','outside'].includes(scope)||!['all','17'].includes(field)||!Number.isInteger(page)||page<1||page>20)throw Error('Enter at least two characters for a name, or leave it empty to browse.');
  return {query,scope,field,page};
 }
 function searchURL(input){const url=new URL(endpoint);for(const [key,value] of Object.entries(options(input)))url.searchParams.set(key,value);return url.href;}
 function websiteURL(input){
  const o=options(input),url=new URL('https://openalex.org/authors');if(o.query)url.searchParams.set('search',o.query);
  url.searchParams.set('filter','last_known_institutions.id:'+(o.scope==='outside'?'!':'')+institution+(o.scope==='outside'?',last_known_institutions.id:!null':'')+(o.field==='17'?',topics.field.id:17':''));return url.href;
 }
 function createClient({fetchImpl=(...args)=>fetch(...args),now=Date.now,timeoutMs=12000}={}){
  const cache=new Map();return {clear(){cache.clear();},async search(input,{signal}={}){
   const opt=options(input),url=searchURL(opt),cached=cache.get(url);
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   if(cached&&now()-cached.fetchedAt<600000)return cached;
   const controller=new AbortController();let timedOut=false;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
   try{
    const res=await fetchImpl(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(res.status===429){let code;try{code=(await res.json()).error?.code;}catch{}throw Error(code==='daily_limit'?'GradPath’s daily research-search allowance has been reached. It resets at midnight UTC. Saved connections and cached searches are still available.':'Researcher search has reached its current request allowance. Please try again later.');}
    if(!res.ok)throw Error('Researcher search is temporarily unavailable. Please try again or open OpenAlex.');
    const data=await res.json();if(!Array.isArray(data?.results))throw Error('The researcher response could not be read. Please try again.');
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    const seen=new Set(),authors=data.results.map(author).filter(a=>a&&(opt.scope==='inside'?inside(a):!inside(a))&&!seen.has(a.id)&&seen.add(a.id)).slice(0,12);
    const result={...opt,authors,count:Number.isFinite(data.meta?.count)?data.meta.count:authors.length,fetchedAt:now()};
    cache.set(url,result);if(cache.size>12)cache.delete(cache.keys().next().value);return result;
   }catch(e){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(timedOut)throw Error('OpenAlex took too long to respond. Please try again.');
    if(e instanceof TypeError)throw Error('We could not reach researcher search. Check your connection and try again.');
    throw e;
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }};
 }
 return {author,inside,searchURL,websiteURL,createClient};
})();

const researcherClient=OpenAlexResearchers.createClient();
const newResearcherSearch=()=>({scope:'inside',query:'',field:'all',page:1,view:'browse',status:'idle',result:null,error:'',request:null});
let researcherSearch=newResearcherSearch(),researcherController,researcherSequence=0,facultyDirectoryOpen=false;
function savedResearchers(){return (Array.isArray(state.researcherSaved)?state.researcherSaved:[]).slice(0,100).map(OpenAlexResearchers.author).filter(Boolean);}
function researcherCard(a,savedView=false){
 const saved=savedResearchers().some(x=>x.id===a.id),affiliations=a.last_known_institutions.map(i=>i.display_name+(i.country_code?' · '+i.country_code:''));
 return `<article class="faculty-card researcher-card"><span class="researcher-source">OpenAlex researcher${savedView?' · saved snapshot':''}</span><div class="faculty-head"><span class="faculty-avatar mint" aria-hidden="true">${esc(a.display_name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</span><h2>${esc(a.display_name)}</h2></div><p><strong>Last-known affiliation</strong><br>${esc(affiliations[0])}</p>${affiliations.length>1?'<details class="researcher-affiliations"><summary>Additional indexed affiliations</summary><p>'+affiliations.slice(1).map(esc).join('<br>')+'</p></details>':''}${tags(a.topics.map(t=>t.display_name))}<p class="researcher-count">${a.works_count.toLocaleString()} indexed publications</p><div class="action-row">${external(a.id,'Research & publications')}${a.orcid?external(a.orcid,'ORCID profile'):''}<button class="btn small" data-action="save-researcher" data-value="${esc(a.id)}" aria-pressed="${saved}">${icon('bookmark')}${saved?'Connection saved':'Save connection'}</button></div></article>`;
}
function researcherResults(){
 const s=researcherSearch;
 if(s.view==='saved'){
  const authors=savedResearchers().filter(a=>s.scope==='inside'?OpenAlexResearchers.inside(a):!OpenAlexResearchers.inside(a));
  return authors.length?`<p class="result-count">${authors.length} saved connection${authors.length===1?'':'s'} ${s.scope==='inside'?'at UNM':'outside UNM'}. Saved in this browser; affiliation snapshots may change.</p><div class="faculty-grid">${authors.map(a=>researcherCard(a,true)).join('')}</div>`:'<div class="empty-state"><h2>No saved connections in this view yet.</h2><p>Browse researchers and save someone whose work interests you.</p>'+button('Browse researchers','researcher-view','browse','secondary')+'</div>';
 }
 if(s.status==='idle'||s.status==='loading')return '<div class="researcher-state" role="status">Loading researchers from OpenAlex…</div>';
 if(s.status==='error')return '<div class="researcher-state" role="alert"><h2>Researcher search is unavailable.</h2><p>'+esc(s.error)+'</p><div class="action-row">'+button('Try again','researcher-retry','','secondary')+external(OpenAlexResearchers.websiteURL(s.request||s),'Continue on OpenAlex')+'</div></div>';
 const r=s.result,locationLabel=r.scope==='inside'?'at UNM':'outside UNM';
 const countText=`${r.authors.length} researchers ${locationLabel}${r.query?' matching “'+r.query+'”':''}${r.field==='17'?' · Computer Science':''}`;
 return `<p class="result-count">${esc(countText)} · Page ${r.page}</p>${r.authors.length?'<div class="faculty-grid">'+r.authors.map(a=>researcherCard(a)).join('')+'</div>':'<div class="empty-state"><h2>No researchers found in this view.</h2><p>Try a different name, choose all fields, or switch university scope.</p></div>'}<div class="researcher-pagination" aria-label="Researcher result pages"><button class="btn small" data-action="researcher-page" data-value="${r.page-1}" ${r.page<=1?'disabled':''}>Previous</button><span>Page ${r.page} · ${r.query?'Name relevance':'Most published first'}</span><button class="btn small" data-action="researcher-page" data-value="${r.page+1}" ${r.page>=20||r.page*12>=r.count?'disabled':''}>Next</button></div><p class="sample-note">A selection of indexed researchers, not a complete faculty roster or a ranking of research fit. ${external(OpenAlexResearchers.websiteURL(r),'Explore more on OpenAlex')}</p>`;
}
function researcherPanel(){
 const s=researcherSearch;
 return `<section class="researcher-search" aria-labelledby="researcher-heading"><div class="panel"><div class="section-heading"><div><span class="light-label">DISCOVER THROUGH PUBLISHED RESEARCH</span><h2 id="researcher-heading">Start at UNM. Explore beyond it.</h2></div><span class="paper-provider">OpenAlex</span></div><div class="researcher-scopes" role="group" aria-label="Researcher university scope">${[['inside','At UNM','University of New Mexico'],['outside','Outside UNM','Researchers at other institutions']].map(([value,title,sub])=>`<button class="researcher-scope ${s.scope===value?'active':''}" data-action="researcher-scope" data-value="${value}" aria-pressed="${s.scope===value}"><strong>${title}</strong><span>${sub}</span></button>`).join('')}</div><form id="researcher-search-form" class="researcher-form"><label class="field-label">Researcher name (optional)<input class="field" name="query" id="researcher-query" maxlength="120" value="${esc(s.query)}" placeholder="e.g. Trilce Estrada"></label><label class="field-label">Research field<select class="field" name="field" id="researcher-field"><option value="all" ${s.field==='all'?'selected':''}>All fields</option><option value="17" ${s.field==='17'?'selected':''}>Computer Science</option></select></label><button type="submit" class="btn primary">${icon('search')}Find researchers</button></form><p class="sample-note">UNM is the current workspace university. Name search looks up people; the field filter uses their published research topics. Opening this view loads public UNM records. Searches send only these filters and any name you enter.</p></div><div class="hint researcher-note">${icon('info')}<span>Affiliations come from each author’s most recent indexed publication. They can be outdated. OpenAlex records do not confirm a professor title, current employment, a GradPath account, or availability to supervise. Outside UNM excludes records with a last-known UNM affiliation and records with no known institution.</span></div><div class="researcher-toolbar" role="group" aria-label="Researcher view">${[['browse','Browse researchers'],['saved','Saved connections ('+savedResearchers().length+')']].map(([v,label])=>`<button class="tab ${s.view===v?'active':''}" data-action="researcher-view" data-value="${v}" aria-pressed="${s.view===v}">${label}</button>`).join('')}</div><div id="researcher-results" aria-live="polite" aria-busy="${s.status==='loading'&&s.view==='browse'}">${researcherResults()}</div></section>`;
}
function refreshResearchers(){
 if(current!=='faculty')return;
 const target=document.getElementById('researcher-results');if(!target)return;
 target.setAttribute('aria-busy',String(researcherSearch.status==='loading'&&researcherSearch.view==='browse'));target.innerHTML=researcherResults();
}
async function runResearcherSearch(input){
 const request={query:input.query||'',scope:input.scope||'inside',field:input.field||'all',page:input.page||1};
 try{OpenAlexResearchers.searchURL(request);}catch(e){notify(e.message);return;}
 researcherController?.abort();researcherController=new AbortController();const sequence=++researcherSequence;
 Object.assign(researcherSearch,request,{request,status:'loading',result:null,error:''});refreshResearchers();
 try{const result=await researcherClient.search(request,{signal:researcherController.signal});if(sequence!==researcherSequence)return;Object.assign(researcherSearch,{status:'ready',result});}
 catch(e){if(sequence!==researcherSequence||e.name==='AbortError')return;Object.assign(researcherSearch,{status:'error',error:e.message});}
 refreshResearchers();
}
function ensureResearcherSearch(){if(researcherSearch.status==='idle'&&researcherSearch.view==='browse')void runResearcherSearch(researcherSearch);}
function resetResearcherSearch(){researcherController?.abort();++researcherSequence;researcherClient.clear();researcherSearch=newResearcherSearch();}
document.addEventListener('submit',event=>{
 if(event.target.id!=='researcher-search-form')return;event.preventDefault();
 const form=new FormData(event.target);researcherSearch.view='browse';
 const request={...researcherSearch,query:form.get('query'),field:form.get('field'),page:1};
 void runResearcherSearch(request);render();
});
document.addEventListener('input',event=>{if(event.target.id==='researcher-query')researcherSearch.query=event.target.value;});
document.addEventListener('change',event=>{if(event.target.id==='researcher-field')researcherSearch.field=event.target.value;});
document.addEventListener('toggle',event=>{if(event.target.id==='faculty-directory')facultyDirectoryOpen=event.target.open;},true);
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el)return;const {action,value}=el.dataset;
 if(action==='researcher-scope'&&['inside','outside'].includes(value)&&value!==researcherSearch.scope){
  researcherController?.abort();++researcherSequence;Object.assign(researcherSearch,{scope:value,query:researcherSearch.request?.query||'',field:researcherSearch.request?.field||'all',page:1,status:'idle',result:null,error:''});render();
 }
 if(action==='researcher-view'&&['browse','saved'].includes(value)){researcherSearch.view=value;render();}
 if(action==='researcher-retry')void runResearcherSearch(researcherSearch.request||researcherSearch);
 if(action==='researcher-page'&&!el.disabled&&researcherSearch.result)void runResearcherSearch({...researcherSearch.result,page:Number(value)});
 if(action==='save-researcher'){
  const saved=savedResearchers(),index=saved.findIndex(a=>a.id===value);
  if(index>=0)saved.splice(index,1);else{const a=researcherSearch.result?.authors.find(a=>a.id===value);if(!a)return;if(saved.length>=100){notify('You can save up to 100 researcher connections. Remove one to add another.');return;}saved.push(a);}
  state.researcherSaved=saved;persist();render();notify(index>=0?'Researcher connection removed.':'Researcher connection saved in this browser.');
 }
});
