import {test} from 'node:test';import assert from 'node:assert/strict';
import {alive,refreshShares,type SharedParcel} from '../lib/share';
const sp=(o:Partial<SharedParcel>={}):SharedParcel=>({k:['order:1'],name:'כבל',stage:1,status:'נשלחה',at:'2026-10-20T10:00:00Z',...o});
test('a link stays open while something is on the way, and 3 days after the last delivery',()=>{
 assert.ok(alive({revoked:false,data:[sp()],updated_at:'2020-01-01'}));
 assert.ok(!alive({revoked:true,data:[sp()],updated_at:new Date()}));
 assert.ok(alive({revoked:false,data:[sp({stage:4})],updated_at:new Date()}));
 assert.ok(!alive({revoked:false,data:[sp({stage:4})],updated_at:new Date(Date.now()-4*864e5)}));});
test('the background check moves a shared parcel forward; pickup details only when the link allows them',async()=>{
 const writes:string[]=[];
 const fake=(rows:unknown[])=>((strings:TemplateStringsArray,...v:unknown[])=>{const q=strings.join('?');if(q.startsWith('update shares'))writes.push(String(v[0]));return Promise.resolve(q.startsWith('select')?rows:[]);}) as never;
 const parcel={id:'order:1',keys:['order:1'],name:'x',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'RS1',order:'1',eta:'',stage:3,cancelled:false,pickup:{place:'סופר פארם',address:'הרצל 1',code:'4821',url:''},events:[{id:'e',label:'מוכנה לאיסוף',time:'2026-10-24T10:00:00Z'}]};
 await refreshShares(fake([{token:'a',pickup:false,data:[sp()]}]),'u',[parcel as never]);
 let d=JSON.parse(writes.pop()!)[0];assert.equal(d.stage,3);assert.equal(d.pickup,undefined);assert.equal(d.name,'כבל');
 await refreshShares(fake([{token:'b',pickup:true,data:[sp()]}]),'u',[parcel as never]);
 d=JSON.parse(writes.pop()!)[0];assert.equal(d.pickup.code,'4821');
 await refreshShares(fake([{token:'c',pickup:false,data:[sp({stage:3,at:'2026-10-24T10:00:00Z'})]}]),'u',[parcel as never]);assert.equal(writes.length,0);});
