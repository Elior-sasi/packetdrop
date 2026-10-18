import {test} from 'node:test';import assert from 'node:assert/strict';import {parseMessage,mergeParcels,isAd} from '../lib/parcels';
const msg=(id:string,from:string,subject:string,html:string,t:string,labels:string[]=[])=>({id,labelIds:labels,internalDate:String(Date.parse(t)),payload:{mimeType:'text/html',headers:[{name:'Subject',value:subject},{name:'From',value:from}],body:{data:Buffer.from(html).toString('base64url')}}}) as never;
test('AliExpress cancel refund from a promotions address joins its order',()=>{
 const r=parseMessage(msg('r1','AliExpress <promotion@aliexpress.com>','ההחזר הכספי על ביטול ההזמנה עובד','<p>זיכוי נשלח לאמצעי התשלום שלך</p><p>ההחזר הכספי אושר היי Sasi, עיבדנו את בקשת ההחזר הכספי שלך! סכום של 147.87ILS זוכה לאמצעי התשלום המקורי שלך ב-2026-10-16.</p><a href="https://aliexpress.com/p/reverse-pages/detail.html?tradeOrderId=1123312985126914&refundOnly=1">הצגת פרטים</a>','2026-10-15T23:07:25Z',['CATEGORY_PROMOTIONS']))!;
 assert.ok(r);assert.equal(r.refund?.amount,'₪147.87');assert.ok(r.keys.includes('order:1123312985126914'));assert.equal(r.events[0].label,'הוחזרו ₪147.87');});
test('AliExpress fast refund bonus is store credit',()=>{
 const r=parseMessage(msg('r2','message@info.aliexpress.com','Fast Refund bonus ₪48.93 has arrived!','<p>Hi, The refunded bonus ₪48.93 of order 1121947242226914 has arrived. Go to AliExpress and check the bonus detail.</p>','2025-07-27T14:47:20Z'))!;
 assert.ok(r.refund?.bonus);assert.equal(r.refund?.amount,'₪48.93');assert.ok(r.keys.includes('order:1121947242226914'));});
test('dispute refund attaches to the order and the parcel keeps its name',()=>{
 const o=parseMessage(msg('o1','transaction@notice.aliexpress.com','ההזמנה שלך נשלחה: הזמנה מס\' 1115406731236914','<p>ההזמנה שלך נשלחה</p><a class="EDM-SYSTEM-TEXT-productName">שקע חכם WiFi</a><p>מספר מעקב: LP00123456789012</p>','2025-10-20T10:00:00Z'))!;
 const r=parseMessage(msg('r3','AEBuyerServices@aliexpress.com','A refund has been issued for Order 1115406731236914','<p>עיבדנו החזר עבור ההזמנה שלך 1115406731236914.</p>','2025-11-09T23:27:52Z'))!;
 assert.ok(r.refund);const m=mergeParcels([o,r]);assert.equal(m.length,1);assert.ok(m[0].refund);assert.ok(!m[0].name.startsWith('A refund'),m[0].name);});
test('ordinary promotions are still ads',()=>{assert.ok(isAd('פרסומת | המבחר היומי','promotion@aliexpress.com',['CATEGORY_PROMOTIONS']));assert.ok(!isAd('ההחזר הכספי על ביטול ההזמנה עובד','promotion@aliexpress.com',['CATEGORY_PROMOTIONS']));});
import {diff} from '../lib/notify';
test('a new refund sends one notification, a return sends none',()=>{
 const now=Date.parse('2026-10-16T10:00:00Z');const base={name:'שקע חכם',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'',order:'1',eta:'',stage:1,cancelled:false,pickup:null};
 const before={...base,id:'order:1',keys:['order:1'],events:[{id:'a',label:'נשלחה',time:'2026-10-10T00:00:00Z'}]};
 const after={...before,cancelled:true,refund:{amount:'₪147.87',at:'2026-10-15T23:07:25Z'},events:[...before.events,{id:'b',label:'הוחזרו ₪147.87',time:'2026-10-15T23:07:25Z'}]};
 const ret={...base,id:'return:7554453',keys:['return:7554453'],name:'החזרה ל־Urbanica',ret:true,events:[{id:'c',label:'השליח יאסוף ממך את ההחזרה',time:'2026-10-16T09:00:00Z'}]};
 const {notes}=diff({parcels:[before],stuck:[]} as never,[after,ret] as never,now);
 assert.equal(notes.length,1);assert.equal(notes[0].title,'התקבל החזר כספי ₪147.87');
 assert.equal(diff({parcels:[after],stuck:[]} as never,[after] as never,now).notes.length,0);});
