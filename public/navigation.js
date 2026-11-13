'use strict';

// Navigation is presentation only; demo role checks remain in the data adapter.
function navigationGroups(role){
 const connect={label:'Conversations',items:[['requests','requests','Requests'],['messages','message','Messages']]};
 if(role==='faculty')return [
  {label:'Research',items:[['discover','compass','Overview'],['students','people','Find students'],['opportunities','book','Research posts']]},
  connect
 ];
 return [
  {label:'Research',items:[['discover','compass','Discover'],['idea','search','Explore my idea'],['opportunities','book','Opportunities'],['faculty','people','Faculty connections'],...(role==='student'?[]:[['students','students','Find students']])]},
  {label:'My planning',items:[['saved','bookmark','Saved directions'],['roadmap','route','My roadmap'],['profile','filter','Preferences']]},
  connect
 ];
}
let navigationCollapsed=false;
try{navigationCollapsed=localStorage.getItem('gradpath-navigation-v1')==='collapsed';}catch{}
let navigationMedia;

function applyNavigationLayout(){
 document.body.classList.toggle('navigation-collapsed',navigationCollapsed);
 const toggle=document.getElementById('sidebar-collapse');
 toggle.setAttribute('aria-expanded',String(!navigationCollapsed));
 toggle.setAttribute('aria-label',navigationCollapsed?'Expand navigation':'Collapse navigation');
 toggle.title=navigationCollapsed?'Expand navigation':'Collapse navigation';
 toggle.innerHTML=icon(navigationCollapsed?'expand-panel':'collapse-panel');
}
function setMobileNavigation(open,restoreFocus=false){
 const mobile=navigationMedia?.matches||false;
 const sidebar=document.getElementById('sidebar');
 const show=mobile&&open;
 sidebar.classList.toggle('open',show);
 sidebar.inert=mobile&&!show;
 document.querySelector('.page-shell').inert=show;
 document.body.classList.toggle('navigation-open',show);
 document.getElementById('navigation-backdrop').hidden=!show;
 document.querySelector('.mobile-menu').setAttribute('aria-expanded',String(show));
 if(show)document.querySelector('.mobile-close').focus();
 else if(restoreFocus&&mobile)document.querySelector('.mobile-menu').focus();
}
function initializeNavigation(){
 navigationMedia=window.matchMedia('(max-width: 680px)');
 navigationMedia.addEventListener('change',()=>setMobileNavigation(false));
 applyNavigationLayout();setMobileNavigation(false);
 document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='collapse-navigation'){
   navigationCollapsed=!navigationCollapsed;
   try{localStorage.setItem('gradpath-navigation-v1',navigationCollapsed?'collapsed':'expanded');}catch{}
   applyNavigationLayout();
  }
  if(action==='menu')setMobileNavigation(!document.getElementById('sidebar').classList.contains('open'));
  if(action==='close-menu')setMobileNavigation(false,true);
 });
 document.addEventListener('keydown',event=>{
  if(!navigationMedia.matches||!document.getElementById('sidebar').classList.contains('open'))return;
  if(event.key==='Escape'){event.preventDefault();setMobileNavigation(false,true);return;}
  if(event.key==='Tab'){
   const controls=[...document.getElementById('sidebar').querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 });
}
