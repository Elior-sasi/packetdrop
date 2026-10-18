import {test} from 'node:test';import assert from 'node:assert/strict';
import {liveParcels} from '../lib/live';
const now=new Date('2026-10-18T09:00:00Z').getTime();const iso=(d:number)=>new Date(now-d*864e5).toISOString();
const P=(id:string,first:number,o:object={})=>({id,keys:[id],name:id,shop:'',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:2,cancelled:false,pickup:null,events:[{id:'e'+id,label:'נשלחה',time:iso(first)}],...o}) as never;
test('app view decides; newer parcels still count',()=>{
 const state={parcels:[P('a',5),P('b',20),P('order',12),P('courier',3),P('new',0.1),P('done',2,{stage:4})],view:{at:iso(1),active:[{keys:['a'],name:'שעון'},{keys:['courier'],name:'כיסוי לאוזניות'}]}};
 const r=liveParcels(state,now);assert.deepEqual(r.list.map((p:{id:string})=>p.id),['a','courier','new']);assert.equal(r.names.courier,'כיסוי לאוזניות');});
test('no view: plain filter',()=>{assert.equal(liveParcels({parcels:[P('a',5),P('old',40)]},now).list.length,1);});
