import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../lib/gradpath-api.mjs';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){const s=sql.prepare(query);return {async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};},async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
 const faculty={userId:'teacher-1',email:'teacher@example.test',fullName:'Test Faculty'};
 const student={userId:'student-1',email:'student@example.test',fullName:'Test Student'};
 const outsider={userId:'teacher-2',email:'other@example.test',fullName:'Other Faculty'};
 async function call(user,path,body,overrides={}){const headers=body===undefined?{}:{Origin:'https://gradpath.test','Content-Type':'application/json','X-GradPath-Request':'1'};const req=new Request('https://gradpath.test/api/'+path,{method:body===undefined?'GET':'POST',headers:{...headers,...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})});const res=await handleApi(req,{db,user});return {status:res.status,data:await res.json()};}
 async function create(user,role){const r=await call(user,'account',{role,name:user.fullName,institution:'Test University',department:'Computer Science',bio:'A test introduction',interests:'Computing'});assert.equal(r.status,200);return (await call(user,'session')).data.account;}
 const post={title:'Test research opportunity',description:'Explore a reproducible computing experiment with the research group.',field:'Computing',skills:'Python',commitment:'5 hours per week',location:'Remote',status:'open'};
 return {sql,db,faculty,student,outsider,call,create,post};
}
test('role authorization, ownership, and public data privacy',async()=>{
 const x=setup();const {call,faculty,student,outsider,create,post}=x;
 assert.equal((await call(null,'research',post)).status,401);
 const f=await create(faculty,'faculty');await create(student,'student');await create(outsider,'faculty');
 assert.equal((await call(student,'research',post)).status,403);
 assert.equal((await call(faculty,'research',post,{Origin:'https://evil.test'})).status,403);
 assert.equal((await call(faculty,'research',post)).status,200);
 const research=(await call(null,'research')).data.research[0];assert.equal(research.faculty_id,f.id);
 assert.equal((await call(outsider,'research',{...post,id:research.id,title:'Unauthorized replacement'})).status,404);
 const directory=(await call(null,'faculty')).data.faculty;
 assert.ok(directory.every(p=>!('email' in p)&&!('user_id' in p)));assert.ok(directory.every(p=>p.legacy_id===null));
 assert.equal((await call(student,'account',{role:'faculty',name:'Changed',institution:'University',department:'CS',bio:'',interests:''})).status,409);
 x.sql.close();
});
test('requests are unique, faculty-controlled, and reject closed opportunities',async()=>{
 const x=setup();const {call,faculty,student,outsider,create,post}=x;
 await create(faculty,'faculty');const s=await create(student,'student');await create(outsider,'faculty');
 await call(faculty,'research',post);const r=(await call(null,'research')).data.research[0];
 const body={researchId:r.id,message:'I would like to contribute my Python skills to this project.'};
 assert.equal((await call(student,'requests',body)).status,200);assert.equal((await call(student,'requests',body)).status,409);
 const req=(await call(faculty,'requests')).data.requests[0];assert.equal(req.student_id,s.id);assert.equal(req.status,'pending');
 assert.equal((await call(outsider,'requests')).data.requests.length,0);
 assert.equal((await call(outsider,'request/'+req.id,{status:'accepted'})).status,404);
 assert.equal((await call(student,'request/'+req.id,{status:'accepted'})).status,403);
 assert.equal((await call(faculty,'request/'+req.id,{status:'accepted'})).status,200);
 assert.equal((await call(faculty,'request/'+req.id,{status:'declined'})).status,409);
 assert.equal((await call(student,'requests')).data.requests[0].status,'accepted');
 await call(faculty,'research',{...post,status:'closed',id:r.id});assert.equal((await call(student,'requests',body)).status,409);
 x.sql.close();
});
test('only participants can read or send messages; duplicate threads are reused',async()=>{
 const x=setup();const {call,faculty,student,outsider,create}=x;
 const f=await create(faculty,'faculty');const s=await create(student,'student');await create(outsider,'faculty');
 assert.equal((await call(faculty,'threads',{recipientId:s.id})).status,403);
 const thread=(await call(student,'threads',{recipientId:f.id})).data;
 assert.equal((await call(student,'threads',{recipientId:f.id})).data.id,thread.id);
 assert.equal((await call(student,'messages',{threadId:thread.id,body:'Hello, I am interested in your research.'})).status,200);
 assert.equal((await call(faculty,'messages',{threadId:thread.id,body:'Thanks! Let’s discuss your interests.'})).status,200);
 assert.equal((await call(faculty,'conversation/'+thread.id)).data.messages.length,2);
 assert.equal((await call(outsider,'conversation/'+thread.id)).status,404);
 assert.equal((await call(null,'conversation/'+thread.id)).status,401);
 assert.equal((await call(outsider,'messages',{threadId:thread.id,body:'Unauthorized message'})).status,404);
 assert.equal((await call(outsider,'inbox')).data.threads.length,0);
 assert.equal((await call(student,'inbox')).data.threads[0].last_message,'Thanks! Let’s discuss your interests.');
 for(let i=0;i<9;i++)assert.equal((await call(student,'messages',{threadId:thread.id,body:'Rate-limit test '+i})).status,200);
 assert.equal((await call(student,'messages',{threadId:thread.id,body:'Too many messages'})).status,429);
 x.sql.close();
});
test('curated faculty membership is based on identity email, not a claimed name',async()=>{
 const x=setup();const fake={userId:'pretend',email:'unrelated@example.test',fullName:'Trilce Estrada'};
 const actual={userId:'real',email:'Estrada@cs.unm.edu',fullName:'Trilce Estrada'};
 await x.create(fake,'faculty');await x.create(actual,'faculty');
 const directory=(await x.call(null,'faculty')).data.faculty;
 assert.equal(directory.filter(f=>f.legacy_id==='estrada').length,1);
 x.sql.close();
});
