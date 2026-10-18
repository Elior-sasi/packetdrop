import {test} from 'node:test';import assert from 'node:assert/strict';import {diff} from '../lib/notify';
const DAY=864e5;const now=Date.parse('2026-10-18T10:00:00Z');const at=(d:number)=>new Date(now-d*DAY).toISOString();
const mk=(id:string,shop:string,stage:number,ev:string[],price='₪150')=>({id,keys:[id],name:'שקע חכם',shop,price,carrier:'',image:'',url:'',tracking:'',order:'1',eta:'',stage,cancelled:false,pickup:null,events:ev.map((t,i)=>({id:id+i,label:'x',time:t}))});
test('a week without shipping: one heads-up',()=>{
 const p=mk('p','AliExpress',0,[at(8)]);const r=diff({parcels:[p],stuck:[]} as never,[p] as never,now);
 assert.equal(r.notes.length,1);assert.match(r.notes[0].title,/עוד לא שלח/);
 assert.equal(diff({parcels:[p],stuck:r.stuck} as never,[p] as never,now).notes.length,0);});
