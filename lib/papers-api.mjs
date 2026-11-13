// A bounded public search endpoint, not an arbitrary OpenAlex proxy.
export const PAPER_ORIGINS = Object.freeze(['https://kritim-123.github.io','https://gradpath-research-journey.raged-rhombus.chatgpt.site']);
export const PAPER_LIMITS = Object.freeze({perMinute:60,perFiveMinutes:90,perDay:900,cacheMs:86400000});
const fields='id,title,doi,publication_year,authorships,primary_location,best_oa_location,open_access,type,is_retracted,abstract_inverted_index';
// Verified against the UNM institution record (ROR 05fs6jp91).
export const UNM_ID='https://openalex.org/I169521973';
const authorFields='id,display_name,orcid,last_known_institutions,topics,works_count';
const encode=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async text=>hex(await crypto.subtle.digest('SHA-256',encode.encode(text)));
function json(body,status,origin,extra={}){
 return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{}),...extra}});
}
function fail(code,message,status,origin,retry){return json({error:{code,message}},status,origin,retry?{'Retry-After':String(retry)}:{});}
const text=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function location(value){return value?{landing_page_url:safeURL(value.landing_page_url),pdf_url:safeURL(value.pdf_url),source:{display_name:text(value.source?.display_name,300)}}:null;}
function cleanWork(work){
 if(!work||!/^https:\/\/openalex.org\/W\d+$/.test(work.id)||!text(work.title)||work.is_retracted===true)return null;
 const abstract={};
 if(work.abstract_inverted_index&&typeof work.abstract_inverted_index==='object')for(const [word,positions] of Object.entries(work.abstract_inverted_index).slice(0,1500)){
  if(Array.isArray(positions))Object.defineProperty(abstract,word.slice(0,120),{value:positions.filter(p=>Number.isInteger(p)&&p>=0&&p<1000).slice(0,1000),enumerable:true,configurable:true});
 }
 return {id:work.id,title:text(work.title),doi:safeURL(text(work.doi).replace(/^http:\/\/doi\.org\//i,'https://doi.org/')),publication_year:Number.isInteger(work.publication_year)?work.publication_year:null,
  type:text(work.type,50),is_retracted:false,authorships:(Array.isArray(work.authorships)?work.authorships:[]).slice(0,100).map(a=>({author:{display_name:text(a?.author?.display_name,200)}})),
  primary_location:location(work.primary_location),best_oa_location:location(work.best_oa_location),open_access:{is_oa:work.open_access?.is_oa===true,oa_url:safeURL(work.open_access?.oa_url)},abstract_inverted_index:abstract};
}
async function ipHash(ip,key){
 const secret=await crypto.subtle.importKey('raw',encode.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',secret,encode.encode(ip)));
}
function cleanAuthor(author,scope){
 if(!author||!/^https:\/\/openalex.org\/A\d+$/.test(author.id)||!text(author.display_name,200).trim())return null;
 const institutions=(Array.isArray(author.last_known_institutions)?author.last_known_institutions:[]).filter(i=>/^https:\/\/openalex.org\/I\d+$/.test(i?.id)).map(i=>({id:i.id,display_name:text(i.display_name,200),country_code:text(i.country_code,2)}));
 const inside=institutions.some(i=>i.id===UNM_ID);
 // Unknown affiliations are not evidence that someone is outside UNM.
 if(!institutions.length||(scope==='inside'?!inside:inside))return null;
 return {id:author.id,display_name:text(author.display_name,200),orcid:/^https:\/\/orcid.org\/[\dX-]+$/.test(author.orcid)?author.orcid:null,
  last_known_institutions:institutions.sort((a,b)=>Number(b.id===UNM_ID)-Number(a.id===UNM_ID)).slice(0,10),topics:(Array.isArray(author.topics)?author.topics:[]).slice(0,5).map(t=>({display_name:text(t?.display_name,200)})),
  works_count:Number.isSafeInteger(author.works_count)&&author.works_count>=0?author.works_count:0};
}
async function reserve(db,id,limit,expiresAt){
 return !!await db.prepare('INSERT INTO paper_limits (id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 WHERE hits<? RETURNING hits').bind(id,expiresAt,limit).first();
}
async function readLimited(response){
 const reader=response.body?.getReader();if(!reader)throw Error('Missing response');
 const parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000)throw Error('Response too large');parts.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export const handlePaperSearch=(request,deps)=>handleSearch(request,deps,'papers');
export const handleResearcherSearch=(request,deps)=>handleSearch(request,deps,'researchers');
async function handleSearch(request,{db,apiKey,fetchImpl=fetch,now=Date.now,timeoutMs=9000}={},kind){
 const researchers=kind==='researchers';
 const url=new URL(request.url),suppliedOrigin=request.headers.get('Origin');
 const origin=suppliedOrigin||(request.headers.get('Sec-Fetch-Site')==='same-origin'?url.origin:null);
 if(!PAPER_ORIGINS.includes(origin))return fail('origin','This origin cannot use GradPath research search.',403,null);
 if(request.method==='OPTIONS'){
  if((request.headers.get('Access-Control-Request-Method')||'GET')!=='GET')return fail('method','Only GET is supported.',405,origin);
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin'}});
 }
 if(request.method!=='GET')return fail('method','Only GET is supported.',405,origin);
 const params=url.searchParams,keys=[...params.keys()],query=(params.get('query')||'').replace(/\s+/g,' ').trim();
 const scope=params.get('scope')||'inside',field=params.get('field')||'all',page=params.get('page')||'1';
 const invalid=researchers?
  keys.some(k=>!['query','scope','field','page'].includes(k))||(query.length>0&&query.length<2)||query.length>120||!['inside','outside'].includes(scope)||!['all','17'].includes(field)||!/^([1-9]|1[0-9]|20)$/.test(page):
  keys.some(k=>!['query','openOnly','sort'].includes(k))||query.length<2||query.length>320||!['0','1'].includes(params.get('openOnly')||'0')||!['relevance','newest'].includes(params.get('sort')||'relevance');
 if(invalid||new Set(keys).size!==keys.length)return fail('invalid_query','Use the supported search fields and filters.',400,origin);
 if(!apiKey||!db)return fail('backend_unconfigured','Research search is being configured. Please try again later.',503,origin);
 const openOnly=params.get('openOnly')==='1',sort=params.get('sort')||'relevance',timestamp=now();
 const minute=Math.floor(timestamp/60000),five=Math.floor(timestamp/300000),day=Math.floor(timestamp/86400000);
 let controller,timer,stage='limits';
 try{
  // Cloudflare supplies this IP header. Ignore client-controlled X-Forwarded-For.
  const network=await ipHash(request.headers.get('CF-Connecting-IP')||'unknown',apiKey);
  if(!await reserve(db,'ip:'+minute+':'+network,PAPER_LIMITS.perMinute,(minute+2)*60000))return fail('rate_limit','Too many searches from this network. Please wait a minute.',429,origin,60);
  const key=await digest(JSON.stringify(researchers?['researchers-v2',query,scope,field,page]:[query,openOnly,sort]));
  const cached=await db.prepare('SELECT payload FROM paper_cache WHERE id=? AND expires_at>?').bind(key,timestamp).first();
  if(cached)return json(JSON.parse(cached.payload),200,origin,{'X-GradPath-Cache':'HIT'});
  if(!await reserve(db,'burst:'+five,PAPER_LIMITS.perFiveMinutes,(five+2)*300000))return fail('rate_limit','GradPath is receiving many research searches. Please try again in a few minutes.',429,origin,Math.ceil(((five+1)*300000-timestamp)/1000));
  if(!await reserve(db,'day:'+day,PAPER_LIMITS.perDay,(day+2)*86400000))return fail('daily_limit','GradPath’s daily research-search allowance has been reached. It resets at midnight UTC. Previously cached searches may still be available.',429,origin,Math.ceil(((day+1)*86400000-timestamp)/1000));
  const upstream=new URL('https://api.openalex.org/'+(researchers?'authors':'works'));
  if(query)upstream.searchParams.set('search',query);
  upstream.searchParams.set('per_page',researchers?'12':'6');upstream.searchParams.set('select',researchers?authorFields:fields);
  if(researchers){
   upstream.searchParams.set('filter','last_known_institutions.id:'+(scope==='inside'?'':'!')+UNM_ID+(scope==='outside'?',last_known_institutions.id:!null':'')+(field==='17'?',topics.field.id:17':''));
   upstream.searchParams.set('page',page);
   if(!query)upstream.searchParams.set('sort','works_count:desc');
  }else{
   upstream.searchParams.set('filter','is_retracted:false'+(openOnly?',is_oa:true':''));
   if(sort==='newest')upstream.searchParams.set('sort','publication_date:desc');
  }
  controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);
  stage='provider-fetch';
  // Workers supports manual/follow, not the Fetch standard's error mode.
  // Manual keeps Authorization on this fixed host; all 3xx responses fail below.
  const response=await fetchImpl(upstream.href,{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},signal:controller.signal,redirect:'manual'});
  if(response.status===429){const retry=Math.max(1,Math.min(86400,Number(response.headers.get('Retry-After'))||300));return fail('upstream_rate_limit','OpenAlex’s allowance is temporarily unavailable. Please try again later.',429,origin,retry);}
  if(response.status===401||response.status===403)return fail('upstream_access','Research search is temporarily unavailable while its service access is checked.',503,origin);
  if(!response.ok)return fail('upstream_unavailable','OpenAlex is temporarily unavailable. Please try again later.',502,origin);
  stage='provider-json';
  const data=await readLimited(response);if(!Array.isArray(data.results))throw Error('Invalid upstream response');
  const payload={meta:{count:Number.isFinite(data.meta?.count)?data.meta.count:0,...(researchers?{page:Number(page),per_page:12,scope,institution:UNM_ID}: {})},results:data.results.slice(0,researchers?12:6).map(item=>researchers?cleanAuthor(item,scope):cleanWork(item)).filter(Boolean)};
  stage='cache-write';
  await db.prepare('INSERT INTO paper_cache (id,payload,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(key,JSON.stringify(payload),timestamp+PAPER_LIMITS.cacheMs).run();
  // Only expired operational data is removed; account and messaging tables are untouched.
  await db.prepare('DELETE FROM paper_cache WHERE expires_at<=?').bind(timestamp).run();
  await db.prepare('DELETE FROM paper_limits WHERE expires_at<=?').bind(timestamp).run();
  return json(payload,200,origin,{'X-GradPath-Cache':'MISS'});
 }catch(error){
  // Never log raw provider errors, request text, headers, or the secret.
  const reason=/redirect/i.test(String(error?.message))?'redirect':error?.name==='SyntaxError'?'invalid-json':controller?.signal.aborted?'timeout':'unavailable';
  console.error('openalex_search_failed',{stage,reason});
  return fail('search_unavailable','Research search could not complete. Please try again later.',503,origin);
 }
 finally{clearTimeout(timer);}
}
