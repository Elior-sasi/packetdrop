import {test} from 'node:test';import assert from 'node:assert/strict';
import {liveParcels} from '../lib/live';
const now=new Date('2026-10-18T09:00:00Z').getTime();const iso=(d:number)=>new Date(now-d*864e5).toISOString();
const P=(id:string,first:number,o:object={})=>({id,keys:[id],name:id,shop:'',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:2,cancelled:false,pickup:null,events:[{id:'e'+id,label:'נשלחה',time:iso(first)}],...o}) as never;
test('app view decides; newer parcels still count',()=>{
 const state={parcels:[P('a',5),P('b',20),P('order',12),P('courier',3),P('new',0.1),P('done',2,{stage:4})],view:{at:iso(1),active:[{keys:['a'],name:'שעון'},{keys:['courier'],name:'כיסוי לאוזניות'}]}};
 const r=liveParcels(state,now);assert.deepEqual(r.list.map((p:{id:string})=>p.id),['a','courier','new']);assert.equal(r.names.courier,'כיסוי לאוזניות');});
test('no view: plain filter',()=>{assert.equal(liveParcels({parcels:[P('a',5),P('old',40)]},now).list.length,1);});
test('widget: urgent red line for the last day to collect, lock screen text',async()=>{const {lines,lock}=await import('../lib/widget');
 const now=new Date(2026,9,19,10).getTime();const p={id:'a',keys:['a'],name:'אוזניות',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:3,cancelled:false,pickup:{place:'סופר פארם',address:'',code:'4821',url:''},events:[{id:'e',label:'ממתינה לאיסוף',time:new Date(2026,9,5,12).toISOString()}]};
 const L=lines([p] as never,{},{},now);assert.equal(L[0].c,'red');assert.equal(L[0].t,'היום האחרון לאיסוף');assert.equal(L[1].t,'אוזניות');assert.match(L[2].t,/קוד 4821/);
 const C=lines([{...p,events:[{id:'e',label:'ממתינה לאיסוף',time:new Date(2026,9,18,12).toISOString()}]}] as never,{},{},now,{a:45});assert.equal(C[0].t,'סופר פארם נסגרת בעוד 45 דק׳');
 assert.match(lock(L).inline,/היום האחרון/);});
