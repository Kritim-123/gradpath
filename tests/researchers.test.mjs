import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {handleResearcherSearch,handlePaperSearch,PAPER_ORIGINS,PAPER_LIMITS,UNM_ID} from '../lib/papers-api.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const author=(id='A123',institutions=[UNM_ID])=>({id:'https://openalex.org/'+id,display_name:'A Researcher',orcid:'https://orcid.org/0000-0002-0000-000X',works_count:120,last_known_institutions:institutions.map(id=>({id,display_name:id===UNM_ID?'University of New Mexico':'Other university',country_code:'US'})),topics:[{display_name:'Robotics'}],email:'not-provided@example.test',api_key:'must-not-leak'});
const foreign='https://openalex.org/I123';
function backend(){
 const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(read('drizzle/'+f));
 const db={prepare(q){return{bind(...args){return{async first(){return sql.prepare(q).get(...args)||null;},async run(){sql.prepare(q).run(...args);return{};}};}};}};
 const seen=[],secret='private-researcher-test-key',now=Date.UTC(2026,10,13,20,0);
 let results=[author()];
 const deps={db,apiKey:secret,now:()=>now,fetchImpl:async(url,options)=>{seen.push({url:new URL(url),options});return Response.json({results,meta:{count:40},debug:secret});}};
 const request=(params='',headers={},method='GET')=>new Request(PAPER_ORIGINS[1]+'/api/researchers?'+params,{method,headers:{Origin:PAPER_ORIGINS[0],'CF-Connecting-IP':'203.0.113.5',...headers}});
 return {sql,seen,deps,secret,request,set results(v){results=v;},call:(params='',headers={},method='GET')=>handleResearcherSearch(request(params,headers,method),deps)};
}
test('researchers default to verified UNM institution; names, field and pages are encoded separately',async()=>{
 const x=backend();let response=await x.call();assert.equal(response.status,200);let u=x.seen[0].url;
 assert.equal(u.pathname,'/authors');assert.equal(u.searchParams.get('filter'),'last_known_institutions.id:'+UNM_ID);assert.equal(u.searchParams.get('per_page'),'12');assert.equal(u.searchParams.get('sort'),'works_count:desc');assert.equal(u.searchParams.has('search'),false);
 response=await x.call('query=Trilce%20Estrada&field=17&page=2');assert.equal(response.status,200);u=x.seen[1].url;
 assert.equal(u.searchParams.get('search'),'Trilce Estrada');assert.match(u.searchParams.get('filter'),/topics.field.id:17/);assert.equal(u.searchParams.get('page'),'2');assert.equal(u.searchParams.has('sort'),false);x.sql.close();
});
test('outside UNM excludes joint UNM affiliations and unknown institutions; payload cannot claim accounts or email',async()=>{
 const x=backend();x.results=[author(),author('A124',[foreign]),author('A125',[foreign,UNM_ID]),author('A126',[])];
 const response=await x.call('scope=outside');assert.equal(response.status,200);const body=await response.json();assert.equal(body.results.length,1);assert.equal(body.results[0].id,'https://openalex.org/A124');
 assert.match(x.seen[0].url.searchParams.get('filter'),/last_known_institutions.id:!https:\/\/openalex.org\/I169521973/);
 assert.match(x.seen[0].url.searchParams.get('filter'),/last_known_institutions.id:!null/);
 assert.equal(x.seen[0].options.headers.Authorization,'Bearer '+x.secret);assert.equal(x.seen[0].options.redirect,'manual');
 for(const value of [x.secret,'api_key','email','not-provided'])assert.ok(!JSON.stringify(body).includes(value));x.sql.close();
});
test('a UNM affiliation is retained even when a collaboration lists many other institutions first',async()=>{
 const x=backend();x.results=[author('A123',[...Array.from({length:12},(_,i)=>'https://openalex.org/I'+(i+1)),UNM_ID])];
 const body=await (await x.call()).json();assert.equal(body.results[0].last_known_institutions.length,10);assert.equal(body.results[0].last_known_institutions[0].id,UNM_ID);x.sql.close();
});
test('researcher requests reject unsupported scope, arbitrary filters, duplicate parameters and unbounded pages',async()=>{
 const x=backend();
 for(const params of ['scope=elsewhere','field=999','query=x','query='+('x'.repeat(121)),'page=0','page=21','page=1.5','page=01','query=aa&query=bb','filter=arbitrary','api_key=public','url=https://evil.test'])assert.equal((await x.call(params)).status,400,params);
 assert.equal((await x.call('',{Origin:'https://evil.test'})).status,403);assert.equal((await x.call('',{},'POST')).status,405);assert.equal(x.seen.length,0);x.sql.close();
});
test('paper and researcher searches share one atomic daily budget and isolate their cached records',async()=>{
 const x=backend();await x.call('query=robotics');await x.call('query=robotics');assert.equal(x.seen.length,1);
 const paper=new Request(PAPER_ORIGINS[1]+'/api/papers?query=robotics',{headers:{Origin:PAPER_ORIGINS[0],'CF-Connecting-IP':'203.0.113.5'}});
 assert.equal((await handlePaperSearch(paper,x.deps)).headers.get('X-GradPath-Cache'),'MISS');assert.equal(x.seen.length,2);
 x.sql.prepare('UPDATE paper_limits SET hits=? WHERE id LIKE ?').run(PAPER_LIMITS.perDay-1,'day:%');
 const responses=await Promise.all([x.call('scope=outside'),handlePaperSearch(new Request(paper.url+'%20new',{headers:paper.headers}),x.deps)]);
 assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===429).length,1);
 assert.equal((await x.call('query=robotics')).headers.get('X-GradPath-Cache'),'HIT');assert.equal(x.seen.length,3);x.sql.close();
});
test('researcher searches fail closed on missing configuration and never forward provider errors or redirects',async()=>{
 const x=backend();assert.equal((await handleResearcherSearch(x.request(),{...x.deps,apiKey:''})).status,503);assert.equal(x.seen.length,0);
 for(const status of [302,401,403,429,500]){
  const res=await handleResearcherSearch(x.request(),{...x.deps,fetchImpl:async()=>new Response(x.secret,{status,headers:{Location:'https://elsewhere.test'}})});
  assert.ok(res.status>=400);assert.equal(res.headers.get('Location'),null);assert.ok(!(await res.text()).includes(x.secret));
 }x.sql.close();
});
function frontend(extra={}){
 const handlers={},elements=new Map(),storage=new Map();
 function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){}});return elements.get(key);}
 const document={body:element('body'),addEventListener(type,fn){(handlers[type]??=[]).push(fn);},getElementById:element,querySelector:element};
 const app=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,console,crypto:webcrypto,document,
  state:{researcherSaved:[]},current:'faculty',notify(){},render(){},persist(){},esc:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>'',tags:items=>items.join(','),button:label=>label,external:(url,label)=>url+' '+label,
  ...extra});
 vm.runInContext(read('public/researchers.js')+'\nthis.clientAPI=OpenAlexResearchers;',app);
 return {app,handlers,element,document,storage};
}
test('browser client normalizes untrusted authors, isolates scopes in cache and never sends profile data',async()=>{
 let calls=0,time=1000;const {app}=frontend();const api=app.clientAPI;
 const client=api.createClient({now:()=>time,fetchImpl:async(url,opts)=>{
  calls++;assert.equal(new URL(url).origin,PAPER_ORIGINS[1]);assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');assert.ok(!url.includes('private-profile'));
  return Response.json({meta:{count:4},results:[author(),author(),author('A124',[foreign]),author('A125',[])]});
 }});
 const inside=await client.search({query:'',profile:'private-profile'});assert.equal(inside.authors.length,1);
 await client.search({});assert.equal(calls,1);const outside=await client.search({scope:'outside'});assert.equal(calls,2);assert.equal(outside.authors[0].id,'https://openalex.org/A124');
 time+=600001;await client.search({});assert.equal(calls,3);client.clear();await client.search({});assert.equal(calls,4);
 assert.equal(api.author({...author(),orcid:'javascript:alert(1)'}).orcid,null);assert.equal(api.author({...author(),id:'https://attacker.test/A123'}),null);
 assert.throws(()=>api.searchURL({page:21}));assert.throws(()=>api.searchURL({query:'x'}));
});
test('browser search cancellation, timeouts, empty results and quota errors remain distinct',async()=>{
 const {app}=frontend();const api=app.clientAPI;
 assert.equal((await api.createClient({fetchImpl:async()=>Response.json({results:[]})}).search({})).authors.length,0);
 await assert.rejects(api.createClient({fetchImpl:async()=>Response.json({error:{code:'daily_limit'}},{status:429})}).search({}),/midnight UTC/);
 await assert.rejects(api.createClient({fetchImpl:async()=>Response.json({bad:'data'})}).search({}),/could not be read/);
 const stalled=(_u,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError'))));
 await assert.rejects(api.createClient({fetchImpl:stalled,timeoutMs:5}).search({}),/too long/);
 const controller=new AbortController(),task=api.createClient({fetchImpl:stalled}).search({},{signal:controller.signal});controller.abort();await assert.rejects(task,e=>e.name==='AbortError');
});
test('newer scope results win over slow responses; saving escapes markup and reset clears search state',async()=>{
 const responses=[];const {app,handlers}=frontend({fetch:()=>new Promise(resolve=>responses.push(resolve))});
 const first=app.runResearcherSearch({scope:'inside'}),second=app.runResearcherSearch({scope:'outside'});
 responses[1](Response.json({results:[{...author('A124',[foreign]),display_name:'<img src=x onerror=alert(1)>'}]}));await second;
 responses[0](Response.json({results:[author()]}));await first;
 assert.equal(vm.runInContext('researcherSearch.result.scope',app),'outside');assert.equal(vm.runInContext('researcherSearch.result.authors.length',app),1);
 handlers.click[0]({target:{closest:()=>({dataset:{action:'save-researcher',value:'https://openalex.org/A124'}})}});
 assert.equal(app.savedResearchers().length,1);assert.match(app.researcherResults(),/&lt;img/);assert.ok(!app.researcherResults().includes('<img'));
 handlers.click[0]({target:{closest:()=>({dataset:{action:'save-researcher',value:'https://openalex.org/A124'}})}});assert.equal(app.savedResearchers().length,0);
 app.resetResearcherSearch();assert.equal(vm.runInContext('researcherSearch.scope',app),'inside');assert.equal(vm.runInContext('researcherSearch.status',app),'idle');
});
test('full app loads UNM researchers on faculty route, switches outside and keeps the curated demo separate',async()=>{
 let calls=0;const seen=[];const ui=frontend();const {element,document,storage}=ui;
 const app=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,console,crypto:webcrypto,document,location:{hash:'#faculty'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false,addEventListener(){}}),fetch:async(url)=>{calls++;seen.push(new URL(url));return Response.json({results:[author()]});}});app.window=app;
 for(const [,script] of read('app/shell.html').matchAll(/<script src="\/([^"]+)" defer>/g))vm.runInContext(read('public/'+script),app,{filename:script});
 await app.loadCommunity();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,1);assert.equal(seen[0].searchParams.get('scope'),'inside');
 assert.match(element('main').innerHTML,/Outside UNM/);assert.match(element('main').innerHTML,/UNM directory &amp; GradPath demo connections/);assert.match(element('researcher-results').innerHTML,/A Researcher/);
 vm.runInContext("researcherSearch.scope='outside';researcherSearch.status='idle';render()",app);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,2);assert.equal(seen[1].searchParams.get('scope'),'outside');
 app.resetResearcherSearch();
});
