import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function workspace(){
 const context=vm.createContext({community:{account:null},localStorage:{getItem:()=>null},document:{addEventListener(){}},icon:()=>'',heading:()=>''});
 for(const file of ['navigation.js','journeys.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
 return context;
}
test('student and faculty home choices change immediately when the demo role changes',()=>{
 const app=workspace();
 assert.equal((app.journeyChoices().match(/class="journey-card"/g)||[]).length,3);
 app.community.account={role:'student'};
 assert.match(app.journeyChoices(),/I need a research idea/);
 assert.match(app.journeyChoices(),/I already have an idea/);
 assert.doesNotMatch(app.journeyChoices(),/I am looking for students/);
 app.community.account={role:'faculty'};
 assert.match(app.facultyHome(),/I am looking for students/);
 assert.doesNotMatch(app.facultyHome(),/I need a research idea|I already have an idea/);
 app.community.account=null;
 assert.equal((app.journeyChoices().match(/class="journey-card"/g)||[]).length,3);
});
test('navigation keeps only relevant role tasks and retains conversations for both roles',()=>{
 const app=workspace();
 const routes=role=>app.navigationGroups(role).flatMap(g=>g.items.map(item=>item[0]));
 assert.ok(!routes('student').includes('students'));
 for(const task of ['idea','saved','roadmap','profile','faculty']){
  assert.ok(routes('student').includes(task));assert.ok(!routes('faculty').includes(task));
 }
 for(const role of ['student','faculty'])for(const task of ['discover','opportunities','messages','requests'])assert.ok(routes(role).includes(task));
 assert.ok(routes('faculty').includes('students'));
 assert.ok(routes(null).includes('students'));
 assert.equal(new Set(routes(null)).size,routes(null).length);
});
