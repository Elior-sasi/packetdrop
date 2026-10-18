import {test} from 'node:test';import assert from 'node:assert/strict';import {parseMessage,mergeParcels} from '../lib/parcels';
const m=(id:string,body:string,code:string)=>({id,internalDate:String(Date.parse('2026-10-13T05:33:36Z')),payload:{mimeType:'text/html',headers:[{name:'Subject',value:'הודעה על משלוח שמספרו '+code},{name:'From',value:'noReply@postil.co.il'}],body:{data:Buffer.from('<div>'+body+'</div><div>בברכה, דואר ישראל</div>').toString('base64url')}}});
test('Israel Post (postil) notices are read and join the AliExpress parcel',()=>{
 const a=parseMessage(m('p1','לקוח יקר, משלוח מספר RS1343135466Y מחברת מחו"ל הגיע לארץ ובדרכו אליך.','RS1343135466Y') as any)!;assert.equal(a.tracking,'RS1343135466Y');assert.equal(a.stage,2);
 const b=parseMessage(m('p2','שלום Elior Sasi, משלוח RS1344385286Y מחו"ל בדרכו לארץ. לאחר שחרורו ממכס, הוא ישלח לנקודת האיסוף.','RS1344385286Y') as any)!;assert.equal(b.tracking,'RS1344385286Y');assert.equal(b.stage,2);
 const ali={id:'order:1',keys:['order:1','tracking:RS1343135466Y'],name:'שחמט',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'RS1343135466Y',order:'1',eta:'',stage:1,cancelled:false,pickup:null,events:[{id:'x',label:'נשלחה',time:'2026-10-09T00:00:00Z'}]};
 const out=mergeParcels([ali,a]);assert.equal(out.length,1);assert.equal(out[0].name,'שחמט');assert.equal(out[0].stage,2);});
