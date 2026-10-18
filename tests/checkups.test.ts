import {test} from 'node:test';import assert from 'node:assert/strict';import {checkups,diff} from '../lib/notify';
const DAY=864e5;const now=Date.parse('2026-10-18T10:00:00Z');const at=(d:number)=>new Date(now-d*DAY).toISOString();
const mk=(id:string,shop:string,stage:number,ev:string[])=>({id,keys:[id],name:'שקע חכם',shop,carrier:'',image:'',url:'',tracking:'',order:'1',eta:'',stage,cancelled:false,pickup:null,events:ev.map((t,i)=>({id:id+i,label:'x',time:t}))});
test('check the item: day 3 for AliExpress, day 10 for an Israeli store, once',()=>{
 const a=mk('a','AliExpress',4,[at(20),at(3.2)]),b=mk('b','KSP',4,[at(15),at(10.1)]),c=mk('c','AliExpress',4,[at(20),at(1)]);
 const r=checkups({parcels:[a,b,c],stuck:[]} as never,now);assert.deepEqual(r.notes.map(n=>n.id),['a','b']);assert.match(r.notes[1].title,/4 ימים/);
 assert.equal(checkups({parcels:[a,b,c],stuck:[],checked:r.checked} as never,now).notes.length,0);});
test('a week without shipping: one heads-up',()=>{
 const p=mk('p','AliExpress',0,[at(8)]);const r=diff({parcels:[p],stuck:[]} as never,[p] as never,now);
 assert.equal(r.notes.length,1);assert.match(r.notes[0].title,/עוד לא שלח/);
 assert.equal(diff({parcels:[p],stuck:r.stuck} as never,[p] as never,now).notes.length,0);});
