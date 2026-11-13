import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({URL});
vm.runInContext(readFileSync(new URL('../public/data.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../public/matching.js',import.meta.url),'utf8')+'\nthis.match=ResearchMatch;this.topics=TOPICS;this.faculty=FACULTY;this.papers=PAPERS;',context);
const {match,topics,faculty,papers}=context;

test('profile overlap handles case, duplicate entries, and major without overstating interest matches',()=>{
 const profile={major:'CS',interests:'ML, ML, Machine learning, HCI',skills:'python',weeks:12};
 const fit=match.fit(profile,{majors:['Computer Science'],interests:['Machine learning','Human-computer interaction'],skills:['Python'],weeks:8});
 assert.equal(fit.score,12);assert.equal(fit.interests.length,2);assert.equal(fit.skills[0],'python');
 const unrelated=match.fit(profile,{field:'Cybersecurity',department:'Computer Science',skills:'Writing'});
 assert.equal(unrelated.interests.length,0);assert.equal(unrelated.skills.length,0);
});
test('an existing idea leads to catalog sources and researchers, while unknown ideas produce no fabricated results',()=>{
 const result=match.explore('How can machine learning show uncertainty?', '',topics,faculty,papers);
 assert.ok(result.researchers.some(f=>f.id==='estrada'));
 assert.ok(result.sources.some(s=>s.url==='https://arxiv.org/abs/1705.08500'));
 assert.equal(match.explore('Medieval illuminated manuscripts', '',topics,faculty,papers).sources.length,0);
 assert.ok(match.explore('A new question with no familiar vocabulary','Cybersecurity',topics,faculty,papers).topics.some(t=>t.id==='security'));
});
test('new faculty posts participate in matching and closed posts are excluded from idea results',()=>{
 const posts=[{id:'open',status:'open',title:'Machine learning research',field:'Machine learning',skills:'Python'}, {id:'closed',status:'closed',title:'Machine learning research',field:'Machine learning'}];
 assert.equal(match.fit({interests:['machine learning'],skills:['Python']},posts[0]).score,5);
 const result=match.explore('Machine learning research','',topics,faculty,papers,posts);
 assert.equal(result.opportunities.length,1);assert.equal(result.opportunities[0].id,'open');
});
