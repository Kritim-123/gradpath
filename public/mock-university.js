'use strict';
// A self-contained demonstration, not authentication. Never calls the live API.
const UniversityDemo = (() => {
 const key='gradpath-university-demo-v1';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const now=()=>new Date().toISOString();
 const uid=()=>crypto.randomUUID();
 function fresh(){const created=now();return {version:1,activeRole:null,accounts:[
  {id:'demo-student',role:'student',name:'Alex Rivera (demo)',netid:'student.demo',email:'student@gradpath.example',institution:'University of New Mexico (demo)',department:'Computer Science',bio:'A fictional graduate student exploring trustworthy AI and research collaboration.',interests:'Machine learning, Python, Human-computer interaction',created_at:created},
  {id:'demo-faculty',role:'faculty',name:'Dr. Avery Morgan (demo)',netid:'faculty.demo',email:'faculty@gradpath.example',institution:'University of New Mexico (demo)',department:'Computer Science',bio:'Fictional faculty profile for trying research posts, join requests, and messaging. Not an actual UNM professor.',interests:'Machine learning, Data science, Human-computer interaction',created_at:created}
 ],research:[{id:'demo-research',faculty_id:'demo-faculty',title:'Making machine learning explanations easier to understand',description:'Sample project: explore how students interpret model predictions and uncertainty. Try a small Python experiment, compare two explanation designs, and document what makes the results easier to understand. This is a fictional opportunity for demonstrating GradPath.',field:'Machine learning',skills:'Python, prototyping, curiosity about user experience',commitment:'5–8 hours/week for one semester',location:'Hybrid · demo only',status:'open',created_at:created,updated_at:created}],requests:[],threads:[],messages:[]};}
 let data=fresh(),persistent=true;
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&saved.version===1&&['accounts','research','requests','threads','messages'].every(k=>Array.isArray(saved[k]))&&['student','faculty'].every(role=>saved.accounts.some(a=>a.id==='demo-'+role&&a.role===role)))data=saved;}catch{persistent=false;}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(data));}catch{persistent=false;}};
 const current=()=>data.accounts.find(a=>a.id==='demo-'+data.activeRole)||null;
 const requireRole=role=>{const a=current();if(!a)throw Error('Choose a mock university account to continue.');if(role&&a.role!==role)throw Error('Switch to the '+role+' demo account to try this action.');return a;};
 const person=id=>data.accounts.find(a=>a.id===id);
 const text=(body,key,min=0,max=500)=>{if(typeof body[key]!=='string'||body[key].trim().length<min||body[key].trim().length>max)throw Error(key+' must be '+min+'–'+max+' characters.');return body[key].trim();};
 const postView=p=>({...p,faculty_name:person(p.faculty_id)?.name||'Demo faculty',institution:person(p.faculty_id)?.institution||'Demo university',department:person(p.faculty_id)?.department||''});
 const threadView=t=>({...t,student_name:person(t.student_id)?.name||'Demo student',faculty_name:person(t.faculty_id)?.name||'Demo faculty'});
 function signIn(role){if(!['student','faculty'].includes(role))throw Error('Choose student or faculty.');data.activeRole=role;save();}
 function signOut(){data.activeRole=null;save();}
 function reset(){data=fresh();save();}
 async function api(path,body){
  const [resource,id]=path.split('/');const a=current();const created=now();
  if(body===undefined){
   if(resource==='session')return {auth:a?{name:a.name,email:a.email,netid:a.netid}:null,account:a?clone(a):null,demo:true,persistent};
   if(resource==='faculty')return {faculty:data.accounts.filter(a=>a.role==='faculty').map(a=>({...clone(a),legacy_id:null,demo:true}))};
   if(resource==='research')return {research:data.research.map(postView).reverse()};
   requireRole();
   if(resource==='requests')return {requests:data.requests.filter(r=>a.role==='student'?r.student_id===a.id:data.research.some(p=>p.id===r.research_id&&p.faculty_id===a.id)).map(r=>{const p=data.research.find(p=>p.id===r.research_id),student=person(r.student_id);return {...clone(r),title:p.title,faculty_id:p.faculty_id,faculty_name:person(p.faculty_id).name,student_name:student.name,student_bio:student.bio,student_interests:student.interests};}).reverse()};
   if(resource==='inbox')return {threads:data.threads.filter(t=>t.student_id===a.id||t.faculty_id===a.id).map(t=>{const last=data.messages.filter(m=>m.thread_id===t.id).at(-1);return {...threadView(t),last_message:last?.body||'',updated_at:last?.created_at||t.created_at};}).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))};
   if(resource==='conversation'){const t=data.threads.find(t=>t.id===id&&(t.student_id===a.id||t.faculty_id===a.id));if(!t)throw Error('Demo conversation not found.');return {thread:threadView(t),messages:clone(data.messages.filter(m=>m.thread_id===t.id))};}
  }else{
   requireRole();
   if(resource==='account'){
    if(body.role!==a.role)throw Error('Use Switch demo role to try another account.');
    const update={name:text(body,'name',2,80),institution:text(body,'institution',2,120),department:text(body,'department',2,100),bio:text(body,'bio',0,1500),interests:text(body,'interests',0,500)};
    Object.assign(a,update);save();return {ok:true};
   }
   if(resource==='research'){
    requireRole('faculty');const values={title:text(body,'title',5,120),description:text(body,'description',30,4000),field:text(body,'field',2,80),skills:text(body,'skills',0,500),commitment:text(body,'commitment',2,150),location:text(body,'location',2,100),status:text(body,'status',1,10)};
    if(!['open','closed'].includes(values.status))throw Error('Choose open or closed.');
    if(body.id){const p=data.research.find(p=>p.id===body.id&&p.faculty_id===a.id);if(!p)throw Error('Demo research post not found.');Object.assign(p,values,{updated_at:created});}
    else{if(data.research.length>=50)throw Error('Reset the demo to create more research posts.');data.research.push({id:uid(),faculty_id:a.id,...values,created_at:created,updated_at:created});}
    save();return {ok:true};
   }
   if(resource==='requests'){
    requireRole('student');const p=data.research.find(p=>p.id===body.researchId&&p.status==='open');if(!p)throw Error('This demo opportunity is closed.');
    if(data.requests.some(r=>r.research_id===p.id&&r.student_id===a.id))throw Error('You have already requested to join this research.');
    data.requests.push({id:uid(),research_id:p.id,student_id:a.id,message:text(body,'message',20,2000),status:'pending',created_at:created,updated_at:created});save();return {ok:true};
   }
   if(resource==='request'){
    const r=data.requests.find(r=>r.id===id);const p=r&&data.research.find(p=>p.id===r.research_id);if(!r||!p)throw Error('Demo request not found.');
    if(r.status!=='pending')throw Error('This request is already resolved.');
    const allowed=(a.id===r.student_id&&body.status==='withdrawn')||(a.id===p.faculty_id&&['accepted','declined'].includes(body.status));if(!allowed)throw Error('Switch demo roles to make that decision.');
    r.status=body.status;r.updated_at=created;save();return {ok:true};
   }
   if(resource==='threads'){
    const other=person(body.recipientId);if(!other||other.role===a.role)throw Error('Choose a student–faculty demo connection.');
    const student=a.role==='student'?a:other,faculty=a.role==='faculty'?a:other;
    let t=data.threads.find(t=>t.student_id===student.id&&t.faculty_id===faculty.id);
    if(!t){t={id:uid(),student_id:student.id,faculty_id:faculty.id,created_at:created};data.threads.push(t);save();}return {id:t.id};
   }
   if(resource==='messages'){
    const t=data.threads.find(t=>t.id===body.threadId&&(t.student_id===a.id||t.faculty_id===a.id));if(!t)throw Error('Demo conversation not found.');
    if(data.messages.length>=500)throw Error('Reset the demo to make room for more messages.');
    data.messages.push({id:uid(),thread_id:t.id,sender_id:a.id,body:text(body,'body',1,4000),created_at:created});save();return {ok:true};
   }
  }
  throw Error('This demo action is unavailable.');
 }
 return {api,signIn,signOut,reset};
})();
