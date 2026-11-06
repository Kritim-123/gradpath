import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/mock-university.js',import.meta.url),'utf8');
function setup(store=new Map(),unavailable=false){
 const context=vm.createContext({crypto:{randomUUID},localStorage:{
  getItem(k){if(unavailable)throw Error('Storage blocked');return store.get(k)??null;},
  setItem(k,v){if(unavailable)throw Error('Storage blocked');store.set(k,v);}
 }});
 // No network API is supplied: the complete demo must work without one.
 vm.runInContext(source+'\nthis.demo=UniversityDemo;',context);
 return {demo:context.demo,store};
}
const post={title:'Accessible research discovery',description:'Explore how graduate students discover suitable research and understand the next steps.',field:'HCI',skills:'Prototyping',commitment:'5 hours/week',location:'Demo workspace',status:'open'};

test('student request, faculty decision and two-way conversation survive switching roles',async()=>{
 const {demo}=setup();
 assert.equal((await demo.api('session')).auth,null);
 await assert.rejects(demo.api('inbox'),/Choose a mock/);
 demo.signIn('student');
 await demo.api('requests',{researchId:'demo-research',message:'I would like to contribute my Python and user research skills.'});
 const {id}=await demo.api('threads',{recipientId:'demo-faculty'});
 await demo.api('messages',{threadId:id,body:'Hello, what would the first research task involve?'});
 demo.signOut();demo.signIn('faculty');
 const request=(await demo.api('requests')).requests[0];
 assert.equal(request.student_name,'Alex Rivera (demo)');
 await demo.api('request/'+request.id,{status:'accepted'});
 assert.equal((await demo.api('inbox')).threads[0].id,id);
 await demo.api('messages',{threadId:id,body:'Start by comparing two explanations for the same prediction.'});
 demo.signOut();demo.signIn('student');
 assert.equal((await demo.api('requests')).requests[0].status,'accepted');
 const conversation=await demo.api('conversation/'+id);
 assert.equal(conversation.messages.length,2);
 assert.equal(conversation.messages[1].sender_id,'demo-faculty');
 assert.match(conversation.messages[1].body,/comparing two/);
 assert.equal((await demo.api('threads',{recipientId:'demo-faculty'})).id,id);
});

test('faculty posts, edits, closes research; student actions respect roles and duplicate requests',async()=>{
 const {demo}=setup();demo.signIn('student');
 await assert.rejects(demo.api('research',post),/Switch to the faculty/);
 await demo.api('requests',{researchId:'demo-research',message:'I have relevant research interests and experience.'});
 await assert.rejects(demo.api('requests',{researchId:'demo-research',message:'Another request for the same research.'}),/already requested/);
 const request=(await demo.api('requests')).requests[0];
 await assert.rejects(demo.api('request/'+request.id,{status:'accepted'}),/Switch demo roles/);
 demo.signIn('faculty');await demo.api('research',post);
 const created=(await demo.api('research')).research.find(p=>p.title===post.title);
 assert.ok(created);await demo.api('research',{...post,id:created.id,status:'closed'});
 demo.signIn('student');
 await assert.rejects(demo.api('requests',{researchId:created.id,message:'Interested in joining this research project.'}),/closed/);
 await demo.api('request/'+request.id,{status:'withdrawn'});
 demo.signIn('faculty');
 await assert.rejects(demo.api('request/'+request.id,{status:'accepted'}),/already resolved/);
});

test('reload preserves demo, separate visitors are isolated, sign-out retains data, reset spares planning',async()=>{
 const {demo,store}=setup();store.set('gradpath-v1','original planning data');
 demo.signIn('faculty');await demo.api('research',post);
 const reload=setup(store).demo;
 assert.equal((await reload.api('session')).account.role,'faculty');
 assert.equal((await reload.api('research')).research.length,2);
 assert.equal((await setup().demo.api('research')).research.length,1);
 reload.signOut();const signedOut=setup(store).demo;
 assert.equal((await signedOut.api('session')).auth,null);
 assert.equal((await signedOut.api('research')).research.length,2);
 signedOut.reset();
 assert.equal((await setup(store).demo.api('research')).research.length,1);
 assert.equal(store.get('gradpath-v1'),'original planning data');
 assert.equal((await signedOut.api('session')).auth,null);
});

test('unavailable browser storage keeps an honest in-memory demo usable',async()=>{
 const {demo}=setup(new Map(),true);demo.signIn('faculty');
 await demo.api('research',post);
 assert.equal((await demo.api('session')).persistent,false);
 assert.equal((await demo.api('research')).research.length,2);
 demo.signOut();demo.signIn('student');
 assert.equal((await demo.api('research')).research.length,2);
 assert.equal((await setup(new Map(),true).demo.api('research')).research.length,1);
});
