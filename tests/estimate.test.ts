import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learn} from '../lib/estimate';
const D=864e5,t0=Date.UTC(2026,8,1);
const iso=(d:number)=>new Date(t0+d*D).toISOString();
// A delivered AliExpress parcel: handed to the airline on day 2 (also says נמסרה), ready for pickup on day 14, collected day 18. Events stored out of order.
const past=(i:number)=>({id:'o'+i,keys:['o'+i],name:'x',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:4,cancelled:false,pickup:null,
 events:[{id:'c',label:'נאספה',time:iso(18)},{id:'a',label:'נשלחה',time:iso(0)},{id:'b',label:'נמסרה לחברת ההובלה הבינלאומית',time:iso(2)},{id:'r',label:'מוכנה לאיסוף',time:iso(14)}]});
test('past parcels count until ready for pickup, not until handed to the airline or collected',()=>{
 const days=learn([past(1),past(2),past(3)] as never);
 assert.deepEqual(days['AliExpress|*#0'],[14,14,14]);
 assert.deepEqual(days['AliExpress|*#1'],[12,12,12]);});
