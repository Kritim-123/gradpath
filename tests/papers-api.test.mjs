import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handlePaperSearch,PAPER_ORIGINS,PAPER_LIMITS} from '../lib/papers-api.mjs';

const secret='server-only-test-secret';
const work={id:'https://openalex.org/W2741809807',title:'A public research paper',publication_year:2018,type:'article',doi:'https://doi.org/10.7717/peerj.4375',open_access:{is_oa:true},authorships:[{author:{display_name:'Author'}}],abstract_inverted_index:{A:[0],study:[1]},api_key:'should-not-forward'};
const success=()=>Response.json({meta:{count:1,api_key:'should-not-forward'},results:[work],debug:secret});
function setup(fetchImpl=async()=>success()){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){const s=sql.prepare(query);return {async first(){return s.get(...args)||null;},async run(){return {meta:{changes:Number(s.run(...args).changes)}};}};}};}};
 let now=Date.UTC(2026,10,13,19,0),calls=0;const seen=[];
 async function upstream(url,options){calls++;seen.push({url,options});return fetchImpl(url,options);}
 async function call(query='robotics',extra={}){
  const params=extra.params||new URLSearchParams({query,openOnly:'0',sort:'relevance'}).toString();
  const request=new Request(PAPER_ORIGINS[1]+'/api/papers?'+params,{method:extra.method||'GET',headers:{Origin:PAPER_ORIGINS[0],'CF-Connecting-IP':'203.0.113.12',...extra.headers}});
  return handlePaperSearch(request,{db,apiKey:secret,fetchImpl:upstream,now:()=>now,...extra.deps});
 }
 return {sql,db,call,seen,get calls(){return calls;},get now(){return now;},advance(ms){now+=ms;}};
}
test('only allowed origins, supported methods, and bounded search parameters reach the provider',async()=>{
 const x=setup();
 for(const extra of [{headers:{Origin:'https://evil.test'}},{headers:{Origin:''}},{method:'POST'},{params:'query=x'},{params:'query=robotics&api_key=client-key'},{params:'query=robotics&query=medicine'},{params:'query=robotics&openOnly=true'},{params:'query=robotics&sort=random'}])assert.ok((await x.call('robotics',extra)).status>=400);
 assert.equal(x.calls,0);
 const preflight=await x.call('robotics',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'GET'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),PAPER_ORIGINS[0]);assert.equal(x.calls,0);
 assert.equal((await x.call('robotics',{headers:{Origin:'','Sec-Fetch-Site':'same-origin'}})).status,200);x.sql.close();
});
test('missing configuration or failed storage never falls back to an anonymous provider request',async()=>{
 const x=setup();
 for(const deps of [{apiKey:''},{db:null},{db:{prepare(){throw Error(secret);}}}]){
  const response=await x.call('robotics',{deps});assert.equal(response.status,503);assert.ok(!(await response.text()).includes(secret));
 }
 assert.equal(x.calls,0);x.sql.close();
});
test('the key is sent only in the backend authorization header and is absent from responses and cache',async()=>{
 const x=setup();const response=await x.call('my draft research idea',{params:'query=my%20draft%20research%20idea&openOnly=1&sort=newest'});
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),PAPER_ORIGINS[0]);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
 const {url,options}=x.seen[0],u=new URL(url);assert.equal(u.origin,'https://api.openalex.org');assert.equal(u.pathname,'/works');assert.equal(u.searchParams.get('per_page'),'6');assert.equal(u.searchParams.get('filter'),'is_retracted:false,is_oa:true');assert.equal(u.searchParams.get('sort'),'publication_date:desc');
 assert.equal(options.headers.Authorization,'Bearer '+secret);assert.equal(options.redirect,'manual');assert.ok(!url.includes(secret));
 const body=await response.text();assert.ok(!body.includes(secret));assert.ok(!body.includes('api_key'));assert.ok(!body.includes('should-not-forward'));
 const cached=x.sql.prepare('SELECT * FROM paper_cache').get();assert.match(cached.id,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(cached).includes('my draft research idea'));assert.ok(!JSON.stringify(cached).includes(secret));
 const limits=x.sql.prepare('SELECT id FROM paper_limits').all();assert.ok(!JSON.stringify(limits).includes('203.0.113.12'));x.sql.close();
});
test('shared cached results do not spend another search and expiry refreshes them',async()=>{
 const x=setup();assert.equal((await x.call()).headers.get('X-GradPath-Cache'),'MISS');
 const second=await x.call('robotics',{headers:{'CF-Connecting-IP':'203.0.113.20'}});assert.equal(second.headers.get('X-GradPath-Cache'),'HIT');assert.equal(x.calls,1);
 x.advance(PAPER_LIMITS.cacheMs+1);assert.equal((await x.call()).headers.get('X-GradPath-Cache'),'MISS');assert.equal(x.calls,2);
 await x.call('ROBOTICS');assert.equal(x.calls,3);x.sql.close();
});
test('daily allowance protects the free key while permitting previously cached searches',async()=>{
 const x=setup();await x.call('cached topic');x.sql.prepare('UPDATE paper_limits SET hits=? WHERE id LIKE ?').run(PAPER_LIMITS.perDay,'day:%');
 const blocked=await x.call('new topic');assert.equal(blocked.status,429);assert.equal((await blocked.json()).error.code,'daily_limit');assert.ok(Number(blocked.headers.get('Retry-After'))>0);assert.equal(x.calls,1);
 assert.equal((await x.call('cached topic')).status,200);assert.equal(x.calls,1);x.sql.close();
});
test('network and short-window limits reject excess calls before they spend provider budget',async()=>{
 const x=setup();await x.call();x.sql.prepare('UPDATE paper_limits SET hits=? WHERE id LIKE ?').run(PAPER_LIMITS.perMinute,'ip:%');
 assert.equal((await x.call('other',{headers:{'X-Forwarded-For':'198.51.100.200'}})).status,429);assert.equal(x.calls,1);
 x.advance(60001);x.sql.prepare('UPDATE paper_limits SET hits=? WHERE id LIKE ?').run(PAPER_LIMITS.perFiveMinutes,'burst:%');
 assert.equal((await x.call('other')).status,429);assert.equal(x.calls,1);x.sql.close();
});
test('concurrent requests cannot spend beyond the atomic daily counter',async()=>{
 const x=setup();await x.call('first');x.sql.prepare('UPDATE paper_limits SET hits=? WHERE id LIKE ?').run(PAPER_LIMITS.perDay-1,'day:%');
 const responses=await Promise.all([x.call('second'),x.call('third')]);assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===429).length,1);assert.equal(x.calls,2);
 assert.equal(x.sql.prepare('SELECT hits FROM paper_limits WHERE id LIKE ?').get('day:%').hits,PAPER_LIMITS.perDay);x.sql.close();
});
test('provider failures, invalid payloads, and timeouts never expose provider error bodies or credentials',async()=>{
 for(const status of [302,401,403,429,500]){
  const x=setup(async()=>new Response(secret,{status,headers:{'Retry-After':'25',Location:'https://unrelated.example'}}));const res=await x.call();assert.equal(res.status,status===429?429:[302,500].includes(status)?502:503);assert.ok(!(await res.text()).includes(secret));assert.equal(res.headers.get('Location'),null);assert.equal(x.calls,1);assert.equal(x.sql.prepare('SELECT count(*) AS n FROM paper_cache').get().n,0);x.sql.close();
 }
 const x=setup(async()=>new Response('{invalid '+secret));assert.equal((await x.call()).status,503);x.sql.close();
 const y=setup(async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error(secret)),{once:true})));
 const slow=await y.call('slow',{deps:{timeoutMs:5}});assert.equal(slow.status,503);assert.ok(!(await slow.text()).includes(secret));y.sql.close();
});
