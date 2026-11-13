'use strict';
// Public, keyless OpenAlex requests. Never put an API key in a Pages asset.
const OpenAlex = (() => {
 const fields='id,title,doi,publication_year,authorships,primary_location,best_oa_location,open_access,type,is_retracted,abstract_inverted_index';
 const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
 const stop=new Set('a an and are as at be based by can could do does for from help how i in into is it me more my of on or our research should show some study that the their this to use using want we what when where which with would'.split(' '));
 function suggestQuery(question,field=''){
  const words=clean(question).toLowerCase().replace(/[^\p{L}\p{N}+#-]+/gu,' ').split(/\s+/).filter(w=>w&&!stop.has(w));
  const terms=[...new Set(words)].slice(0,12).join(' ');
  return clean(terms+(field&&!terms.includes(field.toLowerCase())?' '+field:'' )).slice(0,320);
 }
 function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 function abstractText(index){
  if(!index||typeof index!=='object'||Array.isArray(index))return '';
  const words=[];
  for(const [word,positions] of Object.entries(index).slice(0,2000)){
   if(!Array.isArray(positions))continue;
   for(const pos of positions.slice(0,500))if(Number.isInteger(pos)&&pos>=0&&pos<1000)words[pos]=word;
  }
  return clean(words.join(' ')).slice(0,6000);
 }
 function paper(work){
  if(!work||work.is_retracted===true||!/^https:\/\/openalex.org\/W\d+$/.test(work.id)||!clean(work.title))return null;
  const authors=(Array.isArray(work.authorships)?work.authorships:[]).map(a=>clean(a?.author?.display_name)).filter(Boolean);
  const doi=safeURL(typeof work.doi==='string'?work.doi.replace(/^http:\/\/doi\.org\//i,'https://doi.org/'):'');
  const oa=work.open_access?.is_oa===true;
  const openURL=oa?(safeURL(work.best_oa_location?.landing_page_url)||safeURL(work.best_oa_location?.pdf_url)||safeURL(work.open_access?.oa_url)):'';
  return {id:work.id,title:clean(work.title),authors,year:Number.isInteger(work.publication_year)?work.publication_year:null,
   venue:clean(work.primary_location?.source?.display_name),type:clean(work.type).replaceAll('-',' '),doi,
   url:doi||safeURL(work.primary_location?.landing_page_url)||work.id,openURL,openAccess:oa,abstract:abstractText(work.abstract_inverted_index)};
 }
 function options(input){
  const query=clean(input?.query);
  if(query.length<2||query.length>320)throw new Error('Use between 2 and 320 characters for your paper search.');
  return {query,openOnly:input.openOnly===true,sort:input.sort==='newest'?'newest':'relevance'};
 }
 function searchURL(input){
  const opt=options(input),url=new URL('https://api.openalex.org/works');
  url.searchParams.set('search',opt.query);
  url.searchParams.set('filter','is_retracted:false'+(opt.openOnly?',is_oa:true':''));
  url.searchParams.set('per_page','6');url.searchParams.set('select',fields);
  if(opt.sort==='newest')url.searchParams.set('sort','publication_date:desc');
  return url.href;
 }
 function websiteURL(input){
  const opt=options(input),url=new URL('https://openalex.org/works');url.searchParams.set('search',opt.query);
  url.searchParams.set('filter','is_retracted:false'+(opt.openOnly?',is_oa:true':''));
  if(opt.sort==='newest')url.searchParams.set('sort','publication_date:desc');return url.href;
 }
 function issue(code,message){const error=new Error(message);error.code=code;return error;}
 function createClient({fetchImpl=(...args)=>fetch(...args),now=Date.now,timeoutMs=12000}={}){
  const cache=new Map();
  return {
   clear(){cache.clear();},
   async search(input,{signal}={}){
    const opt=options(input),url=searchURL(opt),cached=cache.get(url);
    if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
    if(cached&&now()-cached.fetchedAt<600000)return {...cached,cached:true};
    const controller=new AbortController();let timedOut=false;
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
     const response=await fetchImpl(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
     if(response.status===429)throw issue('rate-limit','OpenAlex’s search allowance for this network has been reached. Try again later, or open your search on OpenAlex and sign in there.');
     if(response.status===401||response.status===403)throw issue('access','OpenAlex is requiring authenticated access for this search. You can open it on OpenAlex and sign in there.');
     if(!response.ok)throw issue('service','OpenAlex is temporarily unavailable. Please try again later.');
     let data;try{data=await response.json();}catch{throw issue('response','OpenAlex returned an unreadable response. Please try again.');}
     if(!Array.isArray(data?.results))throw issue('response','OpenAlex returned an unreadable response. Please try again.');
     if(controller.signal.aborted)throw new DOMException('Search cancelled','AbortError');
     const seen=new Set(),papers=data.results.map(paper).filter(p=>p&&!seen.has(p.id)&&seen.add(p.id)).slice(0,6);
     const result={...opt,papers,count:Number.isFinite(data.meta?.count)?data.meta.count:papers.length,fetchedAt:now(),cached:false};
     cache.set(url,result);if(cache.size>12)cache.delete(cache.keys().next().value);
     return result;
    }catch(error){
     if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
     if(timedOut)throw issue('timeout','OpenAlex took too long to respond. Please try again.');
     if(error.code)throw error;
     throw issue('network','We could not reach OpenAlex. Check your connection and try again.');
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
   }
  };
 }
 return {suggestQuery,safeURL,paper,searchURL,websiteURL,createClient};
})();
