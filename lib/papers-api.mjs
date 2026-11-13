// A bounded public search endpoint, not an arbitrary OpenAlex proxy.
export const PAPER_ORIGINS = Object.freeze(['https://kritim-123.github.io','https://gradpath-research-journey.raged-rhombus.chatgpt.site']);
export const PAPER_LIMITS = Object.freeze({perMinute:60,perFiveMinutes:90,perDay:900,cacheMs:86400000});
const fields='id,title,doi,publication_year,authorships,primary_location,best_oa_location,open_access,type,is_retracted,abstract_inverted_index';
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
export async function handlePaperSearch(request,{db,apiKey,fetchImpl=fetch,now=Date.now,timeoutMs=9000}={}){
 const url=new URL(request.url),suppliedOrigin=request.headers.get('Origin');
 const origin=suppliedOrigin||(request.headers.get('Sec-Fetch-Site')==='same-origin'?url.origin:null);
 if(!PAPER_ORIGINS.includes(origin))return fail('origin','This origin cannot use GradPath paper search.',403,null);
 if(request.method==='OPTIONS'){
  if((request.headers.get('Access-Control-Request-Method')||'GET')!=='GET')return fail('method','Only GET is supported.',405,origin);
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin'}});
 }
 if(request.method!=='GET')return fail('method','Only GET is supported.',405,origin);
 const params=url.searchParams,keys=[...params.keys()],query=(params.get('query')||'').replace(/\s+/g,' ').trim();
 if(keys.some(k=>!['query','openOnly','sort'].includes(k))||new Set(keys).size!==keys.length||query.length<2||query.length>320||!['0','1'].includes(params.get('openOnly')||'0')||!['relevance','newest'].includes(params.get('sort')||'relevance'))return fail('invalid_query','Use 2–320 characters and the supported paper filters.',400,origin);
 if(!apiKey||!db)return fail('backend_unconfigured','Paper search is being configured. Please try again later.',503,origin);
 const openOnly=params.get('openOnly')==='1',sort=params.get('sort')||'relevance',timestamp=now();
 const minute=Math.floor(timestamp/60000),five=Math.floor(timestamp/300000),day=Math.floor(timestamp/86400000);
 let controller,timer,stage='limits';
 try{
  // Cloudflare supplies this IP header. Ignore client-controlled X-Forwarded-For.
  const network=await ipHash(request.headers.get('CF-Connecting-IP')||'unknown',apiKey);
  if(!await reserve(db,'ip:'+minute+':'+network,PAPER_LIMITS.perMinute,(minute+2)*60000))return fail('rate_limit','Too many searches from this network. Please wait a minute.',429,origin,60);
  const key=await digest(JSON.stringify([query,openOnly,sort]));
  const cached=await db.prepare('SELECT payload FROM paper_cache WHERE id=? AND expires_at>?').bind(key,timestamp).first();
  if(cached)return json(JSON.parse(cached.payload),200,origin,{'X-GradPath-Cache':'HIT'});
  if(!await reserve(db,'burst:'+five,PAPER_LIMITS.perFiveMinutes,(five+2)*300000))return fail('rate_limit','GradPath is receiving many paper searches. Please try again in a few minutes.',429,origin,Math.ceil(((five+1)*300000-timestamp)/1000));
  if(!await reserve(db,'day:'+day,PAPER_LIMITS.perDay,(day+2)*86400000))return fail('daily_limit','GradPath’s daily paper-search allowance has been reached. It resets at midnight UTC. Previously cached searches may still be available.',429,origin,Math.ceil(((day+1)*86400000-timestamp)/1000));
  const upstream=new URL('https://api.openalex.org/works');
  upstream.searchParams.set('search',query);upstream.searchParams.set('per_page','6');upstream.searchParams.set('select',fields);
  upstream.searchParams.set('filter','is_retracted:false'+(openOnly?',is_oa:true':''));
  if(sort==='newest')upstream.searchParams.set('sort','publication_date:desc');
  controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);
  stage='provider-fetch';
  // Workers supports manual/follow, not the Fetch standard's error mode.
  // Manual keeps Authorization on this fixed host; all 3xx responses fail below.
  const response=await fetchImpl(upstream.href,{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},signal:controller.signal,redirect:'manual'});
  if(response.status===429){const retry=Math.max(1,Math.min(86400,Number(response.headers.get('Retry-After'))||300));return fail('upstream_rate_limit','OpenAlex’s allowance is temporarily unavailable. Please try again later.',429,origin,retry);}
  if(response.status===401||response.status===403)return fail('upstream_access','Paper search is temporarily unavailable while its service access is checked.',503,origin);
  if(!response.ok)return fail('upstream_unavailable','OpenAlex is temporarily unavailable. Please try again later.',502,origin);
  stage='provider-json';
  const data=await readLimited(response);if(!Array.isArray(data.results))throw Error('Invalid upstream response');
  const payload={meta:{count:Number.isFinite(data.meta?.count)?data.meta.count:0},results:data.results.slice(0,6).map(cleanWork).filter(Boolean)};
  stage='cache-write';
  await db.prepare('INSERT INTO paper_cache (id,payload,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(key,JSON.stringify(payload),timestamp+PAPER_LIMITS.cacheMs).run();
  // Only expired operational data is removed; account and messaging tables are untouched.
  await db.prepare('DELETE FROM paper_cache WHERE expires_at<=?').bind(timestamp).run();
  await db.prepare('DELETE FROM paper_limits WHERE expires_at<=?').bind(timestamp).run();
  return json(payload,200,origin,{'X-GradPath-Cache':'MISS'});
 }catch(error){
  // Never log raw provider errors, request text, headers, or the secret.
  const reason=/redirect/i.test(String(error?.message))?'redirect':error?.name==='SyntaxError'?'invalid-json':controller?.signal.aborted?'timeout':'unavailable';
  console.error('paper_search_failed',{stage,reason});
  return fail('search_unavailable','Paper search could not complete. Please try again later.',503,origin);
 }
 finally{clearTimeout(timer);}
}
