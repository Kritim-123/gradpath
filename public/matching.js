'use strict';
// Transparent catalog matching. These scores describe overlap, not research quality.
const ResearchMatch = (() => {
 const aliases = {'ml':'machine learning','ai':'machine learning','artificial intelligence':'machine learning','hci':'human computer interaction','cs':'computer science','xr':'immersive','llm':'language models','llms':'language models'};
 const normalize = value => String(value || '').toLowerCase().replace(/[-–—]/g,' ').replace(/[^a-z0-9 +]/g,' ').replace(/\s+/g,' ').trim();
 const canonical = value => aliases[normalize(value)] || normalize(value);
 const list = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(s=>String(s).trim()).filter(Boolean))];
 const overlap = (left,right) => {const seen=new Set();return list(left).filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return list(right).some(other=>key===canonical(other));});};
 function fit(profile,item){
  const interests=overlap(profile.interests,item.interests || item.field || []);
  const skills=overlap(profile.skills,item.skills || []);
  const major=overlap(profile.major || profile.department,item.majors || item.department || []);
  const time=Number(item.weeks)>0 && Number(item.weeks)<=Number(profile.weeks);
  return {score:interests.length*4+skills.length+major.length*2+(time?1:0),interests,skills,major,time,
   reasons:[interests.length?'Shared interests: '+interests.join(', '):'',skills.length?'Shared skills: '+skills.join(', '):'',major.length?'Related major: '+major.join(', '):''].filter(Boolean)};
 }
 const stop=new Set('a an and are as at be better by can clearly could do does for from help how i in into is it less make more my of on or our research show study students that the their this to use using want what when where which with would'.split(' '));
 function keywords(query){return [...new Set(normalize(query).split(' ').flatMap(w=>(aliases[w]||w).split(' ')).filter(w=>w.length>2&&!stop.has(w)))];}
 function searchScore(query,text){const words=keywords(query),haystack=' '+normalize(text)+' ';return words.reduce((n,w)=>n+(haystack.includes(' '+w+' ')?1:0),0);}
 function explore(question,field,topics,faculty,papers,posts=[]){
  const query=[question,field].filter(Boolean).join(' ');
  const minimum=Math.min(2,keywords(query).length)||1;
  const ranked=topics.map(topic=>({topic,score:searchScore(query,[topic.title,topic.description,topic.question,...topic.interests,...topic.skills,...topic.learn].join(' '))+(field&&overlap([field],topic.interests).length?4:0)})).filter(r=>r.score>=minimum).sort((a,b)=>b.score-a.score).slice(0,3);
  const facultyIds=new Set(ranked.flatMap(r=>r.topic.faculty));
  const researchers=faculty.map(person=>({person,score:searchScore(query,[person.name,person.bio,...person.tags].join(' '))+(facultyIds.has(person.id)?minimum:0)})).filter(r=>r.score>=minimum).sort((a,b)=>b.score-a.score).map(r=>r.person);
  const sources=[...new Set(ranked.flatMap(r=>r.topic.resources))].map(id=>papers[id]).filter(Boolean);
  const opportunities=posts.filter(p=>p.status==='open'&&searchScore(query,[p.title,p.description,p.field,p.skills].join(' '))>=minimum);
  return {topics:ranked.map(r=>r.topic),researchers,sources,opportunities};
 }
 function portfolioURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
 return {list,fit,explore,searchScore,portfolioURL};
})();
