'use strict';
// Mock university sessions and all community activity stay in this browser.
let community={ready:false,error:'',auth:null,account:null,faculty:[],students:[],research:[],requests:null,inbox:null,conversation:null};
let opportunityFilter='open',opportunityQuery='',conversationLoading='',communityBusy=false;
const communityPages=['opportunities','account','messages','requests','idea','students','showcase'];
async function api(path,body){return UniversityDemo.api(path,body);}
let mockRole='student';

async function loadCommunity(){
 try{const [session,faculty,research]=await Promise.all([api('session'),api('faculty'),api('research')]);Object.assign(community,session,{faculty:faculty.faculty,research:research.research,ready:true,error:''});}
 catch(error){community.ready=true;community.error=error.message;}
 if(community.account?.role==='faculty'){try{community.students=(await api('students')).students;}catch{community.students=[];}}else{community.students=[];}
 updateAccountChrome();nav();if(communityPages.includes(current)||['faculty','research','discover'].includes(current))render();
}
function updateAccountChrome(){
 const account=community.account;
 const title=account?account.name:'University sign in';
 const note=account?(account.role==='faculty'?'Faculty demo':'Student demo'):'Students & faculty';
 const initials=account?account.name.split(/\s+/).map(x=>x[0]).slice(0,2).join(''):'GP';
 document.querySelector('.profile-link').innerHTML='<span class="avatar">'+esc(initials)+'</span><span class="account-copy"><strong>'+esc(title)+'</strong><small>'+esc(note)+'</small></span><span class="profile-arrow">↗</span>';
 document.querySelector('.profile-link').setAttribute('aria-label',account?'My profile: '+title:'University sign in');
 document.querySelector('.profile-link').title=account?'My profile: '+title:'University sign in';
 document.getElementById('account-top').textContent=account?'My demo account':'University sign in';
 document.getElementById('demo-mode-bar').innerHTML='<span><strong>University sign-in demo</strong> · '+(community.persistent===false?'Storage unavailable; changes last for this visit.':'Activity stays in this browser.')+'</span>'+(account?button('Switch demo role','demo-switch','','small'):'');
}
function heading(kicker,title,description,actions=''){return '<div class="heading-row"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p>'+description+'</p></div>'+actions+'</div>';}
function loading(text='Loading your workspace…'){return '<div class="panel loading-state" role="status">'+icon('clock')+'<p>'+text+'</p></div>';}
function universitySignIn(){
 const faculty=mockRole==='faculty';
 return heading('GRADPATH · INTERACTIVE DEMO','University sign in.','Try the research journey with a sample student or faculty account.')+'<section class="university-signin panel"><div class="mock-login-brand"><img src="/mark.svg" width="42" height="42" alt=""><div><strong>GradPath university access</strong><small>Mock login · not connected to UNM</small></div></div><form method="post" id="mock-login-form"><label class="field-label">University<input class="field" value="University of New Mexico — demo" readonly></label><fieldset class="mock-roles"><legend>Choose a demo role</legend><button type="button" class="mock-role '+(!faculty?'selected':'')+'" data-action="demo-role" data-value="student" aria-pressed="'+!faculty+'">'+icon('compass')+'<span><strong>Student</strong><small>Explore and request to join</small></span></button><button type="button" class="mock-role '+(faculty?'selected':'')+'" data-action="demo-role" data-value="faculty" aria-pressed="'+faculty+'">'+icon('book')+'<span><strong>Faculty / teacher</strong><small>Post research and review requests</small></span></button></fieldset><label class="field-label">Demo NetID<input class="field" value="'+(faculty?'faculty.demo':'student.demo')+'" readonly autocomplete="off"></label><p class="mock-note">No password needed. These are fictional demo accounts. Do not enter real university credentials.</p><p class="form-error" role="alert"></p><button type="submit" class="btn primary full">Continue as '+(faculty?'faculty':'student')+' '+icon('arrow')+'</button></form><p class="sample-note">Switch roles to try both sides of a conversation. Posts, requests, and messages are saved only in this browser.</p><a class="text-link" href="#opportunities">Browse sample research without signing in '+icon('arrow')+'</a></section>';
}
async function resetCommunityView(){
 community={ready:false,error:'',auth:null,account:null,faculty:[],students:[],research:[],requests:null,inbox:null,conversation:null};
 conversationLoading='';selectedFaculty='';opportunityFilter='open';opportunityQuery='';await loadCommunity();
}

function requireProfile(){return community.account?null:empty('Try your GradPath connection','Choose a mock student or faculty account to explore research requests and messages.','University sign in','account','people');}
function communityPage(){
 if(!community.ready)return loading();
 if(community.error)return '<div class="panel"><h2>Connection interrupted</h2><p role="alert">'+esc(community.error)+'</p>'+button('Try again','community-retry','','primary')+'</div>';
 if(current==='account')return accountPage();
 if(current==='opportunities')return opportunitiesPage();
 if(current==='idea')return ideaPage();
 if(current==='students')return studentsPage();
 if(current==='showcase')return showcasePage();
 const gate=requireProfile();if(gate)return gate;
 if(current==='requests')return requestsPage();
 return messagesPage();
}
function accountPage(){
 if(!community.auth)return universitySignIn();
 const a=community.account||{name:community.auth.name,institution:'University of New Mexico',department:'Computer Science',bio:'',interests:state.profile.interests.join(', '),role:new URLSearchParams(location.search).get('role')==='faculty'?'faculty':'student'};
 return heading('YOUR RESEARCH PROFILE','Show what you bring.','Share your interests, skills, and experience with potential collaborators in this browser demo.')+'<div class="profile-grid"><section class="panel"><form method="post" id="account-form"><div class="field-row"><label class="field-label">Account type<select class="field" name="role" '+(community.account?'disabled':'')+'><option value="student" '+(a.role==='student'?'selected':'')+'>Student</option><option value="faculty" '+(a.role==='faculty'?'selected':'')+'>Faculty / teacher</option></select></label><label class="field-label">Your name<input class="field" name="name" autocomplete="name" minlength="2" maxlength="80" required value="'+esc(a.name)+'"></label></div><div class="field-row"><label class="field-label">Institution<input class="field" name="institution" maxlength="120" minlength="2" required value="'+esc(a.institution)+'"></label><label class="field-label">Major or department<input class="field" name="department" maxlength="100" minlength="2" required value="'+esc(a.department)+'"></label></div><label class="field-label">Research interests<input class="field" name="interests" maxlength="500" placeholder="Machine learning, robotics, education…" value="'+esc(a.interests)+'"></label><label class="field-label">A short introduction<textarea class="field" name="bio" maxlength="1500" placeholder="What are you working on, or what would you like to explore?">'+esc(a.bio)+'</textarea></label>'+showcaseFields(a)+'<p class="form-note">This is a fictional demo profile. Profile edits, research posts, requests, and conversations are stored only in this browser, and are visible when you switch demo roles.</p><p class="form-note">Demo profiles are not linked to real professors or university accounts. Use sample information while exploring.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">'+(community.account?'Save profile':'Create GradPath account')+'</button></form></section><aside><section class="panel"><div class="light-label">DEMO NETID</div><p class="break-word">'+esc(community.auth.netid)+'</p>'+(community.account?'<div class="action-stack"><a class="btn primary" href="#showcase/'+esc(a.id)+'">Preview my profile</a>'+(a.role==='faculty'?'<a class="btn" href="#students">Find student collaborators</a>':'<a class="btn" href="#profile">Research preferences</a>')+'<a class="btn" href="#'+(a.role==='faculty'?'opportunities':'requests')+'">'+(a.role==='faculty'?'Manage my research':'My research requests')+'</a><a class="btn" href="#messages">Open messages</a></div>':'<p>Choose your role carefully. It stays fixed after registration.</p>')+'<hr class="divider">'+button('Switch demo role','demo-switch','','small')+button('Sign out of demo','demo-signout','','small')+'</section><section class="hint">All demo activity stays in this browser. Switch between student and faculty to review requests or reply to messages. Clearing browser data removes your demo changes.</section><div class="demo-reset">'+button('Reset demo activity','demo-reset','','small')+'</div></aside></div>';
}
function emailFaculty(f){return 'mailto:'+encodeURIComponent(f.email)+'?subject='+encodeURIComponent('Research interest — GradPath')+'&body='+encodeURIComponent('Dear Professor '+f.name.split(' ').slice(-1).join(' ')+',\n\nI came across your research through GradPath and would like to learn more about opportunities to contribute.\n\nMy research interests:\nRelevant skills or experience:\nAvailability:\n\nThank you,\n'+'[Your name]');}
function registeredFaculty(f){return community.faculty.find(x=>x.legacy_id===f.id);}
function facultyContact(f){
 if(!community.ready)return '<span class="subtle">Loading demo connections…</span>';
 if(community.error)return '<span class="subtle">Membership unavailable. </span><a class="btn small" href="'+esc(emailFaculty(f))+'">Email professor</a>';
 const registered=registeredFaculty(f);
 return registered?button('Message professor','message-person',registered.id,'small primary','people'):'<a class="btn small primary" href="'+esc(emailFaculty(f))+'">Email professor '+icon('external')+'</a>';
}
function extraFacultyCards(){
 if(!community.ready||community.error||facultyTab==='saved')return '';
 return community.faculty.filter(f=>!f.legacy_id&&(!facultyQuery||[f.name,f.interests,f.department].join(' ').toLowerCase().includes(facultyQuery.toLowerCase()))).map(f=>'<article class="faculty-card"><div class="faculty-head"><span class="faculty-avatar mint">'+esc(f.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))+'</span><div><h2>'+esc(f.name)+'</h2><p>'+esc(f.institution)+' · '+esc(f.department)+'</p></div></div><p>'+esc(f.bio||'Visit their research posts to find out what they are working on.')+'</p>'+tags(f.interests.split(',').map(s=>s.trim()).filter(Boolean))+'<div class="availability"><span></span>Fictional demo faculty · browser only</div><div class="action-row">'+'<a class="btn small" href="#showcase/'+esc(f.id)+'">View profile</a>'+button('View research','faculty-posts',f.id,'small')+button('Message professor','message-person',f.id,'small primary')+'</div></article>').join('');
}
let selectedFaculty='';
function opportunitiesPage(){
 const mine=community.account?.role==='faculty';
 return heading('RESEARCH, WITH PEOPLE','Find a project. Make a contribution.','Try sample research opportunities and posts you create in the faculty demo.',mine?button('Post research','new-research','','primary','edit'):'<a class="btn" href="#requests">My requests</a>')+'<div class="filters"><div class="tabs">'+[['open','Open opportunities'],...(!mine?[['matched','Matches for me']]:[]),['all','All research']].concat(mine?[['mine','My research']]:[]).map(([value,label])=>'<button class="tab '+(opportunityFilter===value?'active':'')+'" data-action="opportunity-tab" data-value="'+value+'">'+label+'</button>').join('')+'</div><label class="search">'+icon('search')+'<input id="opportunity-search" aria-label="Search research opportunities" placeholder="Topic, skill, or faculty…" value="'+esc(opportunityQuery)+'"></label></div>'+(selectedFaculty?'<div class="filter-notice">Showing research from one faculty member. '+button('Show all faculty','clear-faculty','','small')+'</div>':'')+'<div id="opportunity-results">'+opportunityResults()+'</div><p class="sample-note">Demo research only. These sample projects and browser-local posts are not actual faculty opportunities.</p>';
}
function opportunityResults(){
 const posts=community.research.filter(p=>(!['open','matched'].includes(opportunityFilter)||p.status==='open')&&(opportunityFilter!=='matched'||postMatch(p).interests.length>0)&&(opportunityFilter!=='mine'||p.faculty_id===community.account?.id)&&(!selectedFaculty||p.faculty_id===selectedFaculty)&&(!opportunityQuery||[p.title,p.description,p.field,p.skills,p.faculty_name].join(' ').toLowerCase().includes(opportunityQuery.toLowerCase())));
 if(!posts.length)return empty(community.research.length?'No opportunities match this view.':'The next research connection starts here.',community.research.length?'Try a different search or switch to all research.':'Faculty can post their current research and invite students to contribute. No faculty-posted opportunities are available yet.',community.account?.role==='faculty'?'View my account':'Join the community','account','book')+(!community.research.length?'<p class="subtle">Looking for inspiration while faculty join? <a class="text-link" href="#discover">Explore curated research directions →</a></p>':'');
 posts.sort((a,b)=>postMatch(b).score-postMatch(a).score);
 return '<div class="opportunity-grid">'+posts.map(p=>'<article class="opportunity-card"><div class="opportunity-meta"><span class="tag">Demo · '+esc(p.field)+'</span><span class="status-pill '+p.status+'">'+(p.status==='open'?'Accepting interest':'Closed')+'</span></div><h2>'+esc(p.title)+'</h2><p class="byline">'+esc(p.faculty_name)+' · '+esc(p.institution)+'</p><p>'+esc(p.description.length>250?p.description.slice(0,250)+'…':p.description)+'</p>'+(community.account?.role==='faculty'?'':fitReasons(postMatch(p)))+'<div class="opportunity-facts"><span>'+icon('clock')+esc(p.commitment)+'</span><span>'+esc(p.location)+'</span></div><div class="action-row">'+button('View opportunity','view-research',p.id,'small primary','arrow')+(p.faculty_id===community.account?.id?button('Edit post','edit-research',p.id,'small','edit'):'')+'</div></article>').join('')+'</div>';
}
function viewOpportunity(id){const p=community.research.find(p=>p.id===id);if(!p)return;openModal(p.title,'<div class="opportunity-meta">'+tags([p.field,p.status==='open'?'Accepting interest':'Closed'])+'</div><p><strong>'+esc(p.faculty_name)+'</strong> · '+esc(p.institution)+'</p><p class="preserve-lines">'+esc(p.description)+'</p><h3>Skills and experience</h3><p>'+esc(p.skills||'Discuss suitable contributions with the faculty member.')+'</p><h3>Time & location</h3><p>'+esc(p.commitment)+' · '+esc(p.location)+'</p><div class="action-row">'+(p.faculty_id===community.account?.id?button('Edit research','edit-research',p.id,'primary'):((p.status==='open')?button('Request to join','join-research',p.id,'primary','arrow'):'<span class="subtle">This opportunity is closed to new requests.</span>'))+button('Message professor','message-person',p.faculty_id,'','people')+'</div><p class="sample-note">A request starts a conversation; it does not automatically enroll you in a lab or course.</p>');}
function researchForm(id){
 if(community.account?.role!=='faculty'){modal.close();go('account');return;}
 const p=community.research.find(p=>p.id===id)||{id:'',title:'',description:'',field:'',skills:'',commitment:'',location:'',status:'open'};
 if(p.id&&p.faculty_id!==community.account.id)return;
 openModal(p.id?'Edit your research':'Share your research','<form method="post" id="research-post-form"><input name="id" type="hidden" value="'+esc(p.id)+'"><label class="field-label">Research title<input class="field" name="title" required minlength="5" maxlength="120" value="'+esc(p.title)+'" placeholder="A clear title for your research project"></label><label class="field-label">What are you working on?<textarea class="field" name="description" minlength="30" maxlength="4000" required placeholder="Describe the research question, what a student could contribute, and what they would learn.">'+esc(p.description)+'</textarea></label><div class="field-row"><label class="field-label">Research field<input class="field" name="field" minlength="2" maxlength="80" required placeholder="e.g. Human-computer interaction" value="'+esc(p.field)+'"></label><label class="field-label">Status<select class="field" name="status"><option value="open" '+(p.status==='open'?'selected':'')+'>Open to student interest</option><option value="closed" '+(p.status==='closed'?'selected':'')+'>Closed to new requests</option></select></label></div><label class="field-label">Helpful skills<input class="field" name="skills" maxlength="500" value="'+esc(p.skills)+'" placeholder="e.g. Python, curiosity about robotics"></label><div class="field-row"><label class="field-label">Time commitment<input class="field" name="commitment" minlength="2" maxlength="150" required value="'+esc(p.commitment)+'" placeholder="e.g. 5–8 hours/week for one semester"></label><label class="field-label">Location / work style<input class="field" name="location" minlength="2" maxlength="100" required value="'+esc(p.location)+'" placeholder="e.g. UNM campus, hybrid"></label></div><p class="form-note">This demo post stays in this browser. Switch to the student demo to explore it and send a join request.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">'+(p.id?'Save research post':'Save demo post')+'</button></form>');
}
function joinForm(id){
 if(!community.account){modal.close();go('account');return;}
 if(community.account.role!=='student'){notify('Research join requests are for student accounts.');return;}
 const p=community.research.find(p=>p.id===id);if(!p)return;
 openModal('Introduce your interest','<p>Request to join <strong>'+esc(p.title)+'</strong> with '+esc(p.faculty_name)+'.</p><form method="post" id="join-form"><input type="hidden" name="researchId" value="'+esc(id)+'"><label class="field-label">Why would you like to contribute?<textarea class="field" name="message" minlength="20" maxlength="2000" required placeholder="Connect your interests, relevant experience, and availability to this project."></textarea></label><p class="form-note">This request stays in this browser. Switch to the faculty demo to review it, then switch back to see the response.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">Send join request</button></form>');
}
function requestsPage(){
 if(community.requests===null){api('requests').then(d=>{community.requests=d.requests;if(current==='requests')render();}).catch(showPageError);return loading('Loading research requests…');}
 const faculty=community.account.role==='faculty';
 return heading('A CONVERSATION, THEN A COLLABORATION',faculty?'Meet your potential collaborators.':'Your research requests.',faculty?'Review students’ interests and experience, then accept, decline, or start a conversation.':'Track the projects you want to join and continue the conversation.')+(community.requests.length?'<div class="request-list">'+community.requests.map(r=>'<article class="panel request-card"><div class="section-heading"><h2>'+esc(r.title)+'</h2><span class="status-pill '+esc(r.status)+'">'+esc(r.status)+'</span></div><p class="byline">'+esc(faculty?r.student_name:r.faculty_name)+'</p>'+(faculty?'<p>'+esc(r.student_bio)+'</p>'+tags(r.student_interests.split(',').filter(Boolean)):'')+'<blockquote class="request-note preserve-lines">'+esc(r.message)+'</blockquote><div class="action-row">'+button(faculty?'Message student':'Message professor','message-person',faculty?r.student_id:r.faculty_id,'small primary')+(r.status==='pending'?(faculty?button('Accept request','request-status',r.id+'|accepted','small')+button('Decline','request-status',r.id+'|declined','small'):button('Withdraw request','request-status',r.id+'|withdrawn','small')):'')+'</div></article>').join('')+'</div>':empty('No requests yet.',faculty?'When students request to join your research, their introductions will appear here.':'Explore faculty-posted research and send an introduction to a project that interests you.','Explore opportunities','opportunities','people'));
}
function showPageError(error){main.innerHTML='<div class="panel"><h2>Unable to load this page</h2><p role="alert">'+esc(error.message)+'</p>'+button('Try again','refresh-community','','primary')+'</div>';}
function messagesPage(){
 if(currentId){
  if(community.conversation?.thread.id!==currentId){if(conversationLoading!==currentId){conversationLoading=currentId;const requested=currentId;api('conversation/'+encodeURIComponent(requested)).then(data=>{community.conversation=data;conversationLoading='';if(current==='messages'&&currentId===requested)render();}).catch(error=>{conversationLoading='';showPageError(error);});}return loading('Opening your conversation…');}
  const {thread,messages}=community.conversation;const other=community.account.role==='student'?thread.faculty_name:thread.student_name;
  return '<a class="back-link" href="#messages">'+icon('back')+'All messages</a>'+heading('DEMO CONVERSATION',esc(other),'Stored in this browser. Switch demo roles to read and reply from the other side.',button('Refresh','refresh-community','','small'))+'<section class="panel conversation"><div class="message-history" aria-label="Conversation history">'+(messages.length?messages.map(m=>'<div class="message '+(m.sender_id===community.account.id?'own':'')+'"><div class="message-meta">'+(m.sender_id===community.account.id?'You':esc(other))+' <time>'+esc(new Date(m.created_at).toLocaleString())+'</time></div><p class="preserve-lines">'+esc(m.body)+'</p></div>').join(''):'<div class="conversation-start"><h2>A good connection starts with hello.</h2><p>Introduce yourself and share what interests you about their work.</p></div>')+'</div><form method="post" id="message-form"><input type="hidden" name="threadId" value="'+esc(thread.id)+'"><label class="field-label">Your message<textarea class="field" name="body" maxlength="4000" required placeholder="Write a thoughtful introduction…"></textarea></label><p class="form-error" role="alert"></p><div class="composer-footer"><span class="subtle">Demo message · stays in this browser; no real person is contacted.</span><button class="btn primary" type="submit">Send message '+icon('arrow')+'</button></div></form></section>';
 }
 if(community.inbox===null){api('inbox').then(d=>{community.inbox=d.threads;if(current==='messages'&&!currentId)render();}).catch(showPageError);return loading('Loading your inbox…');}
 return heading('KEEP THE CONVERSATION GOING','Your messages.','Research connections, one conversation at a time.',button('Refresh','refresh-community','','small'))+(community.inbox.length?'<div class="inbox-list">'+community.inbox.map(t=>'<a class="panel inbox-item" href="#messages/'+t.id+'"><span class="faculty-avatar mint">'+icon('people')+'</span><div><h2>'+esc(community.account.role==='student'?t.faculty_name:t.student_name)+'</h2><p>'+esc(t.last_message||'Start the conversation.')+'</p></div>'+icon('arrow')+'</a>').join('')+'</div>':empty('Your next conversation is ahead.',community.account.role==='faculty'?'Find a student whose interests connect with your research and start a conversation.':'Message the fictional demo professor from Faculty connections or a sample research opportunity.',community.account.role==='faculty'?'Find students':'Find faculty',community.account.role==='faculty'?'students':'faculty','people'));
}
async function startConversation(recipientId){
 if(!community.account){modal.close();go('account');return;}
 if(recipientId===community.account.id){notify('This is your own faculty profile.');return;}
 const thread=await api('threads',{recipientId});community.conversation=null;community.inbox=null;modal.close();go('messages/'+thread.id);
}
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-action]');if(!control)return;const action=control.dataset.action,value=control.dataset.value;
 try{
  if(action==='demo-role'){mockRole=value;render();}
  if(action==='demo-switch'||action==='demo-signout'){mockRole=action==='demo-switch'&&community.account?.role==='student'?'faculty':'student';UniversityDemo.signOut();await resetCommunityView();modal.close();go('account');notify('Signed out of the demo. Your browser-local activity is saved.');}
  if(action==='demo-reset')openModal('Reset demo activity?','<p>This removes the sample accounts’ edits, posts, requests, and messages from this browser and restores the original fictional demo. Your research planning workspace is unchanged.</p><div class="action-row">'+button('Reset demo','demo-reset-confirm','','primary')+button('Cancel','close','','')+'</div>');
  if(action==='demo-reset-confirm'){UniversityDemo.reset();await resetCommunityView();modal.close();go('account');notify('Fresh demo restored.');}
  if(action==='community-retry'){community.ready=false;community.error='';render();await loadCommunity();}
  if(action==='opportunity-tab'){opportunityFilter=value;render();}
  if(action==='faculty-posts'){selectedFaculty=value;opportunityFilter='all';go('opportunities');}
  if(action==='clear-faculty'){selectedFaculty='';render();}
  if(action==='new-research')researchForm();
  if(action==='edit-research')researchForm(value);
  if(action==='view-research')viewOpportunity(value);
  if(action==='join-research')joinForm(value);
  if(action==='message-person'){control.disabled=true;await startConversation(value);}
  if(action==='request-status'){const [id,status]=value.split('|');openModal(status==='accepted'?'Accept this student’s request?':status==='declined'?'Decline this request?':'Withdraw your request?','<p>'+({accepted:'This saves an accepted decision in this browser. Switch to the student demo to see the result.',declined:'The student demo will show this request as declined.',withdrawn:'The faculty demo will show this request as withdrawn.'}[status])+'</p><div class="action-row">'+button('Confirm','confirm-request-status',value,'primary')+button('Cancel','close','','')+'</div>');}
  if(action==='confirm-request-status'){control.disabled=true;const[id,status]=value.split('|');await api('request/'+encodeURIComponent(id),{status});community.requests=null;modal.close();render();notify('Request updated.');}
  if(action==='refresh-community'){community.requests=null;community.inbox=null;community.conversation=null;render();}
 }catch(error){notify(error.message);}finally{control.disabled=false;}
});
document.addEventListener('input',event=>{if(event.target.id==='opportunity-search'){opportunityQuery=event.target.value;document.getElementById('opportunity-results').innerHTML=opportunityResults();}});
document.addEventListener('submit',async event=>{
 const form=event.target,formId=form.getAttribute('id');if(!['mock-login-form','account-form','research-post-form','join-form','message-form'].includes(formId))return;event.preventDefault();if(communityBusy)return;
 const data=Object.fromEntries(new FormData(form)),submit=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');error.textContent='';communityBusy=true;submit.disabled=true;
 try{
  if(formId==='mock-login-form'){UniversityDemo.signIn(mockRole);await resetCommunityView();syncStudentPreferences(community.account);go('discover');notify('You are exploring the '+mockRole+' demo.');}
  if(formId==='account-form'){data.discoverable=form.elements.discoverable.checked;data.role=community.account?.role||data.role;await api('account',data);syncStudentPreferences(data);community.requests=null;community.inbox=null;await loadCommunity();notify('Demo profile saved in this browser.');}
  if(formId==='research-post-form'){await api('research',data);modal.close();await loadCommunity();opportunityFilter='mine';go('opportunities');notify('Demo research saved. Switch to student to explore it.');}
  if(formId==='join-form'){await api('requests',data);community.requests=null;modal.close();go('requests');notify('Demo request saved. Switch to faculty to review it.');}
  if(formId==='message-form'){await api('messages',data);community.inbox=null;community.conversation=await api('conversation/'+encodeURIComponent(data.threadId));render();notify('Demo message saved. Switch roles to reply.');}
 }catch(e){error.textContent=e.message;}finally{communityBusy=false;submit.disabled=false;}
});
window.addEventListener('DOMContentLoaded',loadCommunity);
