import {test} from 'node:test';import assert from 'node:assert/strict';import {checkups,diff} from '../lib/notify';
const DAY=864e5;const now=Date.parse('2026-10-18T10:00:00Z');const at=(d:number)=>new Date(now-d*DAY).toISOString();
const mk=(id:string,shop:string,stage:number,ev:string[],price='₪150')=>({id,keys:[id],name:'שקע חכם',shop,price,carrier:'',image:'',url:'',tracking:'',order:'1',eta:'',stage,cancelled:false,pickup:null,events:ev.map((t,i)=>({id:id+i,label:'x',time:t}))});
test('check the item: day 3 for AliExpress, day 10 for an Israeli store, once',()=>{
 const a=mk('a','AliExpress',4,[at(20),at(3.2)]),b=mk('b','KSP',4,[at(15),at(10.1)]),c=mk('c','AliExpress',4,[at(20),at(1)]);
 const ra=checkups({parcels:[a,c],stuck:[]} as never,now);assert.deepEqual(ra.notes.map(n=>n.id),['a']);const rb=checkups({parcels:[b],stuck:[]} as never,now);assert.match(rb.notes[0].title,/4 ימים/);
 assert.equal(checkups({parcels:[a,c],stuck:[],checked:ra.checked} as never,now).notes.length,0);});
test('a week without shipping: one heads-up',()=>{
 const p=mk('p','AliExpress',0,[at(8)]);const r=diff({parcels:[p],stuck:[]} as never,[p] as never,now);
 assert.equal(r.notes.length,1);assert.match(r.notes[0].title,/עוד לא שלח/);
 assert.equal(diff({parcels:[p],stuck:r.stuck} as never,[p] as never,now).notes.length,0);});
test('cheap items get no reminder; two on one day become one',()=>{
 const a=mk('a','AliExpress',4,[at(20),at(3.2)],'₪15'),b=mk('b','AliExpress',4,[at(20),at(3.3)]),c=mk('c','Temu',4,[at(20),at(3.1)],'₪220');
 const r=checkups({parcels:[a,b,c],stuck:[]} as never,now);assert.equal(r.notes.length,1);assert.match(r.notes[0].title,/^2 חבילות/);});
