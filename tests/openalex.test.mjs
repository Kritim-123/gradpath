import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function environment(extra={}){
 const app=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,console,...extra});
 vm.runInContext(read('public/openalex.js')+'\nthis.api=OpenAlex;',app);return app;
}
const sample={id:'https://openalex.org/W2741809807',title:'The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles',publication_year:2018,doi:'https://doi.org/10.7717/peerj.4375',type:'article',is_retracted:false,
 authorships:[{author:{display_name:'Heather Piwowar'}}],open_access:{is_oa:true},best_oa_location:{landing_page_url:'https://peerj.com/articles/4375/'},primary_location:{source:{display_name:'PeerJ'}},abstract_inverted_index:{Open:[0],access:[1],research:[2]}};
const ok=(results=[sample])=>({ok:true,status:200,json:async()=>({meta:{count:results.length},results})});

test('paper queries preserve 3D and Unicode terms, are editable, and send only explicit search fields',()=>{
 const {api}=environment();
 assert.equal(api.suggestQuery('How can we project in 3D?'),'project 3d');
 assert.match(api.suggestQuery('How can naïve models help?'),/naïve/);
 assert.equal(api.suggestQuery('','Robotics'),'Robotics');
 const url=new URL(api.searchURL({query:'3D projection & vision',openOnly:true,sort:'newest',name:'Private Name',notes:'private notes',api_key:'secret'}));
 assert.equal(url.origin,'https://api.openalex.org');assert.equal(url.searchParams.get('search'),'3D projection & vision');
 assert.equal(url.searchParams.get('sort'),'publication_date:desc');assert.equal(url.searchParams.get('filter'),'is_retracted:false,is_oa:true');
 assert.equal(url.searchParams.get('per_page'),'6');
 assert.ok(!url.href.includes('secret'));assert.ok(!url.href.includes('Private'));assert.ok(!url.href.includes('notes'));
 assert.throws(()=>api.searchURL({query:' '}));assert.throws(()=>api.searchURL({query:'a'.repeat(321)}));
 assert.ok(!new URL(api.searchURL({query:'robotics'})).searchParams.has('sort'));
});
test('paper normalization tolerates missing metadata and rejects unsafe links and retracted work',()=>{
 const {api}=environment();
 const normal=api.paper(sample);assert.equal(normal.abstract,'Open access research');assert.equal(normal.openURL,'https://peerj.com/articles/4375/');
 assert.equal(api.paper({...sample,is_retracted:true}),null);assert.equal(api.paper({...sample,id:'javascript:alert(1)'}),null);
 const partial=api.paper({id:sample.id,title:'Paper',doi:'javascript:alert(1)',primary_location:{landing_page_url:'https://user:password@example.org'},open_access:{is_oa:true,oa_url:'data:text/html,bad'}});
 assert.equal(partial.url,sample.id);assert.equal(partial.openURL,'');assert.equal(partial.year,null);assert.equal(partial.authors.length,0);
 assert.equal(api.paper({id:sample.id,title:'Missing metadata',doi:123}).url,sample.id);
 const bounded=api.paper({...sample,abstract_inverted_index:{Safe:[0],ignored:[-1,10000000],text:[1]}});assert.equal(bounded.abstract,'Safe text');
});
test('search caches only successful responses for ten minutes and isolates filter/order variations',async()=>{
 const {api}=environment();let calls=0,time=1000;
 const client=api.createClient({now:()=>time,fetchImpl:async(url,opts)=>{calls++;assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');return ok([sample,sample,{...sample,is_retracted:true}]);}});
 const first=await client.search({query:'open access'});assert.equal(first.papers.length,1);assert.equal(calls,1);
 assert.equal((await client.search({query:'open access'})).cached,true);assert.equal(calls,1);
 await client.search({query:'open access',openOnly:true});await client.search({query:'open access',sort:'newest'});assert.equal(calls,3);
 time+=600001;await client.search({query:'open access'});assert.equal(calls,4);
 client.clear();await client.search({query:'open access'});assert.equal(calls,5);
});
test('zero results are distinct from rate limits, access failures, malformed data, and offline errors',async()=>{
 const {api}=environment();assert.equal((await api.createClient({fetchImpl:async()=>ok([])}).search({query:'unmatched topic'})).papers.length,0);
 for(const [status,code] of [[429,'rate-limit'],[401,'access'],[403,'access'],[503,'service']]){
  let calls=0;const client=api.createClient({fetchImpl:async()=>{calls++;return {ok:false,status};}});
  await assert.rejects(client.search({query:'robotics'}),e=>e.code===code);
  await assert.rejects(client.search({query:'robotics'}));assert.equal(calls,2);
 }
 await assert.rejects(api.createClient({fetchImpl:async()=>({ok:true,status:200,json:async()=>({})})}).search({query:'robotics'}),e=>e.code==='response');
 await assert.rejects(api.createClient({fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError();}})}).search({query:'robotics'}),e=>e.code==='response');
 await assert.rejects(api.createClient({fetchImpl:async()=>{throw new TypeError('Failed to fetch');}}).search({query:'robotics'}),e=>e.code==='network');
});
test('slow requests time out and explicit cancellation is not reported as a network failure',async()=>{
 const {api}=environment();
 const stalled=(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 await assert.rejects(api.createClient({fetchImpl:stalled,timeoutMs:10}).search({query:'robotics'}),e=>e.code==='timeout');
 const controller=new AbortController(),client=api.createClient({fetchImpl:stalled});
 const task=client.search({query:'robotics'},{signal:controller.signal});controller.abort();await assert.rejects(task,e=>e.name==='AbortError');
});
function uiEnvironment(fetchImpl){
 const document={addEventListener(){},getElementById(){return null;}};
 const app=environment({document,fetch:fetchImpl,notify(){},state:{idea:{question:''},profile:{interests:['Robotics']}},ResearchMatch:{list:x=>x},icon:()=>'',download(){}});
 const helpers=read('public/app.js').split('\n').filter(line=>line.startsWith('const esc =')||line.startsWith('function external(')||line.startsWith('function button(')).join('\n');
 vm.runInContext(helpers+'\n'+read('public/papers.js'),app);return app;
}
test('search UI does not request data on render and escapes hostile publication metadata',()=>{
 let calls=0;const app=uiEnvironment(async()=>{calls++;return ok();});
 assert.match(app.paperSearchPanel(),/Searching sends the terms below to OpenAlex/);assert.equal(calls,0);
 const p=app.api.paper({...sample,title:'<img src=x onerror=alert(1)>',authorships:[{author:{display_name:'<script>bad</script>'}}]});
 const html=app.paperCard(p);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);assert.match(html,/OpenAlex record/);
});
test('an older search cannot overwrite a newer result or restore data after workspace reset',async()=>{
 const pending=[];const app=uiEnvironment(()=>new Promise(resolve=>pending.push(resolve)));
 const old=app.runPaperSearch('old topic'),recent=app.runPaperSearch('new topic');
 pending[1](ok());await recent;pending[0](ok([{...sample,title:'Old paper'}]));await old;
 assert.equal(vm.runInContext('paperSearch.result.query',app),'new topic');assert.ok(!app.paperReadingList().includes('Old paper'));
 const resetTask=app.runPaperSearch('reset topic');app.resetPaperSearch();pending[2](ok());await resetTask;
 assert.equal(vm.runInContext('paperSearch.status',app),'idle');assert.equal(app.paperReadingList(),'');
});
test('reading lists identify the actual query and returned source rather than the curated catalog',async()=>{
 const app=uiEnvironment(async()=>ok());await app.runPaperSearch('open access',{openOnly:true,sort:'newest'});
 const list=app.paperReadingList();assert.match(list,/Search: open access/);assert.match(list,/open access only/);assert.ok(list.includes(sample.doi));assert.ok(list.includes(sample.id));
 assert.match(app.paperResults(),/1 paper for/);assert.match(app.paperResults(),/Publication details come from OpenAlex/);
});
test('the exported script order boots the complete idea workflow without automatic external requests',async()=>{
 let calls=0;
 const elements=new Map(),storage=new Map();
 function element(key){
  if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){}});
  return elements.get(key);
 }
 const document={body:element('body'),addEventListener(){},getElementById:key=>key==='paper-search-form'?null:element(key),querySelector:element};
 const app=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,console,crypto:webcrypto,document,location:{hash:'#idea'},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false,addEventListener(){}}),fetch:async()=>{calls++;return ok();}});
 app.window=app;
 const scripts=[...read('app/shell.html').matchAll(/<script src="\/([^"]+)" defer>/g)].map(m=>m[1]);
 for(const script of scripts)vm.runInContext(read('public/'+script),app,{filename:script});
 await app.loadCommunity();assert.equal(calls,0);assert.match(element('main').innerHTML,/Find real research papers/);
 vm.runInContext("UniversityDemo.signIn('student')",app);await app.loadCommunity();assert.equal(calls,0);
 await app.runPaperSearch('open access');assert.equal(calls,1);assert.match(element('paper-results').innerHTML,/The state of OA/);
 app.resetPaperSearch();assert.equal(vm.runInContext('paperSearch.status',app),'idle');
});
