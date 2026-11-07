// Identity comes only from Sites dispatch, never from request bodies.
const KNOWN_FACULTY = { 'estrada@cs.unm.edu':'estrada','buechley@unm.edu':'buechley','zhuwang@unm.edu':'wang','tapia@cs.unm.edu':'tapia','afsah@unm.edu':'anwar','bienz@unm.edu':'bienz' };
class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new ApiError(status,message);};
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
function str(body,key,min=0,max=500){const value=body[key];if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(400,`${key} must be ${min}–${max} characters.`);return value.trim();}
const id=()=>crypto.randomUUID();
export async function handleApi(request,{db,user}) {
  try {
    if(!db)fail(503,'Shared accounts are temporarily unavailable. Please try again.');
    const path=new URL(request.url).pathname.replace(/^\/api\//,'').split('/');
    const method=request.method;
    const one=async(sql,...args)=>db.prepare(sql).bind(...args).first();
    const all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
    const run=async(sql,...args)=>db.prepare(sql).bind(...args).run();
    const account=user?await one('SELECT * FROM accounts WHERE user_id = ?',user.userId):null;
    const requireAccount=(role)=>{if(!user)fail(401,'Sign in to continue.');if(!account)fail(403,'Create your GradPath profile first.');if(role&&account.role!==role)fail(403,`This action requires a ${role} account.`);return account;};
    const publicFaculty=(row)=>{const {email,user_id,...safe}=row;return {...safe,legacy_id:KNOWN_FACULTY[email.toLowerCase()]||null};};
    if(method==='GET') {
      if(path[0]==='session')return response({auth:user?{name:user.fullName||'',email:user.email}:null,account:account?(({user_id,email,...safe})=>safe)(account):null});
      if(path[0]==='faculty')return response({faculty:(await all("SELECT id,email,name,institution,department,bio,interests FROM accounts WHERE role='faculty' ORDER BY created_at DESC LIMIT 200")).map(publicFaculty)});
      if(path[0]==='research')return response({research:await all('SELECT r.*,a.name AS faculty_name,a.institution,a.department FROM research r JOIN accounts a ON a.id=r.faculty_id ORDER BY r.created_at DESC LIMIT 200')});
      requireAccount();
      if(path[0]==='requests')return response({requests:await all(`SELECT j.*,r.title,r.faculty_id,a.name AS student_name,a.bio AS student_bio,a.interests AS student_interests,f.name AS faculty_name FROM join_requests j JOIN research r ON r.id=j.research_id JOIN accounts a ON a.id=j.student_id JOIN accounts f ON f.id=r.faculty_id WHERE ${account.role==='faculty'?'r.faculty_id':'j.student_id'}=? ORDER BY j.created_at DESC LIMIT 200`,account.id)});
      if(path[0]==='inbox')return response({threads:await all(`SELECT t.id,t.student_id,t.faculty_id,s.name AS student_name,f.name AS faculty_name,(SELECT body FROM messages WHERE thread_id=t.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS last_message,(SELECT MAX(created_at) FROM messages WHERE thread_id=t.id) AS updated_at FROM threads t JOIN accounts s ON s.id=t.student_id JOIN accounts f ON f.id=t.faculty_id WHERE t.student_id=? OR t.faculty_id=? ORDER BY COALESCE(updated_at,t.created_at) DESC LIMIT 100`,account.id,account.id)});
      if(path[0]==='conversation') {
        const thread=await one('SELECT t.*,s.name AS student_name,f.name AS faculty_name FROM threads t JOIN accounts s ON s.id=t.student_id JOIN accounts f ON f.id=t.faculty_id WHERE t.id=? AND (t.student_id=? OR t.faculty_id=?)',path[1]||'',account.id,account.id);
        if(!thread)fail(404,'Conversation not found.');
        // SQLite insertion order breaks timestamp ties; random UUIDs do not.
        return response({thread,messages:(await all('SELECT id,sender_id,body,created_at FROM messages WHERE thread_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',thread.id)).reverse()});
      }
      fail(404,'Not found.');
    }
    if(method!=='POST')fail(405,'Method not allowed.');
    if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('X-GradPath-Request')!=='1')fail(403,'Please submit this action from GradPath.');
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'Use a JSON request.');
    if(!user)fail(401,'Sign in to continue.');
    const raw=await request.text();if(raw.length>16000)fail(413,'Request is too large.');
    let body;try{body=JSON.parse(raw);}catch{fail(400,'Invalid request.');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'Invalid request.');
    const now=new Date().toISOString();
    if(path[0]==='account') {
      const role=str(body,'role',1,10);if(!['student','faculty'].includes(role))fail(400,'Choose student or faculty.');
      if(account&&account.role!==role)fail(409,'Account roles cannot be changed after registration.');
      const values=[str(body,'name',2,80),str(body,'institution',2,120),str(body,'department',2,100),str(body,'bio',0,1500),str(body,'interests',0,500)];
      if(account)await run('UPDATE accounts SET name=?,institution=?,department=?,bio=?,interests=? WHERE id=?',...values,account.id);
      else {try{await run('INSERT INTO accounts (id,user_id,email,role,name,institution,department,bio,interests,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',id(),user.userId,user.email.toLowerCase(),role,...values,now);}catch(e){if(String(e).includes('UNIQUE'))fail(409,'Your account already exists. Refresh to continue.');throw e;}}
      return response({ok:true});
    }
    requireAccount();
    if(path[0]==='research') {
      requireAccount('faculty');
      const researchId=body.id?str(body,'id',1,60):null;
      if(researchId&&!(await one('SELECT id FROM research WHERE id=? AND faculty_id=?',researchId,account.id)))fail(404,'Research post not found.');
      const values=[str(body,'title',5,120),str(body,'description',30,4000),str(body,'field',2,80),str(body,'skills',0,500),str(body,'commitment',2,150),str(body,'location',2,100),str(body,'status',1,10)];
      if(!['open','closed'].includes(values[6]))fail(400,'Choose open or closed.');
      if(researchId)await run('UPDATE research SET title=?,description=?,field=?,skills=?,commitment=?,location=?,status=?,updated_at=? WHERE id=? AND faculty_id=?',...values,now,researchId,account.id);
      else {const count=await one('SELECT COUNT(*) AS n FROM research WHERE faculty_id=?',account.id);if(count.n>=50)fail(429,'You can manage up to 50 research posts.');await run('INSERT INTO research (id,faculty_id,title,description,field,skills,commitment,location,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id(),account.id,...values,now,now);}
      return response({ok:true});
    }
    if(path[0]==='requests') {
      requireAccount('student');
      const researchId=str(body,'researchId',1,60),message=str(body,'message',20,2000);
      const post=await one("SELECT id FROM research WHERE id=? AND status='open'",researchId);if(!post)fail(409,'This opportunity is no longer open.');
      const existing=await one('SELECT id FROM join_requests WHERE research_id=? AND student_id=?',researchId,account.id);if(existing)fail(409,'You have already requested to join this research.');
      const count=await one('SELECT COUNT(*) AS n FROM join_requests WHERE student_id=? AND created_at>?',account.id,new Date(Date.now()-86400000).toISOString());if(count.n>=10)fail(429,'You can submit up to 10 research requests per day.');
      try{const inserted=await run("INSERT INTO join_requests (id,research_id,student_id,message,status,created_at,updated_at) SELECT ?,?,?,?,'pending',?,? WHERE EXISTS (SELECT 1 FROM research WHERE id=? AND status='open')",id(),researchId,account.id,message,now,now,researchId);if(!inserted.meta.changes)fail(409,'This opportunity is no longer open.');}catch(e){if(String(e).includes('UNIQUE'))fail(409,'You already sent this request.');throw e;}
      return response({ok:true});
    }
    if(path[0]==='request') {
      const requestId=path[1]||'',status=str(body,'status',1,20);
      const row=await one('SELECT j.*,r.faculty_id FROM join_requests j JOIN research r ON r.id=j.research_id WHERE j.id=?',requestId);
      if(!row||(row.student_id!==account.id&&row.faculty_id!==account.id))fail(404,'Request not found.');
      if(row.status!=='pending')fail(409,'This request has already been resolved.');
      if(account.id===row.faculty_id?!['accepted','declined'].includes(status):status!=='withdrawn')fail(403,'You cannot make that change.');
      const changed=await run("UPDATE join_requests SET status=?,updated_at=? WHERE id=? AND status='pending'",status,now,requestId);if(!changed.meta.changes)fail(409,'This request has already been resolved.');
      return response({ok:true});
    }
    if(path[0]==='threads') {
      const recipient=await one('SELECT id,role FROM accounts WHERE id=?',str(body,'recipientId',1,60));
      if(!recipient||recipient.role===account.role)fail(400,'Choose a student–faculty connection.');
      const student=account.role==='student'?account.id:recipient.id,faculty=account.role==='faculty'?account.id:recipient.id;
      // Faculty may contact students who have applied to their research or started a thread.
      if(account.role==='faculty'&&!(await one('SELECT id FROM threads WHERE student_id=? AND faculty_id=?',student,faculty))&&!(await one('SELECT j.id FROM join_requests j JOIN research r ON r.id=j.research_id WHERE j.student_id=? AND r.faculty_id=?',student,faculty)))fail(403,'You can message students who contact you or apply to your research.');
      const count=await one('SELECT COUNT(*) AS n FROM threads WHERE student_id=? AND created_at>?',student,new Date(Date.now()-86400000).toISOString());
      const prior=await one('SELECT id FROM threads WHERE student_id=? AND faculty_id=?',student,faculty);if(prior)return response({id:prior.id});
      if(count.n>=20)fail(429,'Please wait before starting more conversations.');
      await run('INSERT INTO threads (id,student_id,faculty_id,created_at) VALUES (?,?,?,?) ON CONFLICT(student_id,faculty_id) DO NOTHING',id(),student,faculty,now);
      return response(await one('SELECT id FROM threads WHERE student_id=? AND faculty_id=?',student,faculty));
    }
    if(path[0]==='messages') {
      const threadId=str(body,'threadId',1,60),message=str(body,'body',1,4000);
      if(!(await one('SELECT id FROM threads WHERE id=? AND (student_id=? OR faculty_id=?)',threadId,account.id,account.id)))fail(404,'Conversation not found.');
      const count=await one('SELECT COUNT(*) AS n FROM messages WHERE sender_id=? AND created_at>?',account.id,new Date(Date.now()-60000).toISOString());if(count.n>=10)fail(429,'Please wait a minute before sending more messages.');
      await run('INSERT INTO messages (id,thread_id,sender_id,body,created_at) VALUES (?,?,?,?,?)',id(),threadId,account.id,message,now);
      return response({ok:true});
    }
    fail(404,'Not found.');
  } catch(error) {
    if(error instanceof ApiError)return response({error:error.message},error.status);
    console.error('GradPath API request failed',error?.name||'Error');
    return response({error:'We could not complete this request. Please try again.'},500);
  }
}
