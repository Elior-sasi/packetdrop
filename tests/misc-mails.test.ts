import {test} from 'node:test';import assert from 'node:assert/strict';import {parseMessage,mergeParcels} from '../lib/parcels';
const msg=(id:string,from:string,subject:string,html:string,t:string)=>({id,internalDate:String(Date.parse(t)),payload:{mimeType:'text/html',headers:[{name:'Subject',value:subject},{name:'From',value:from}],body:{data:Buffer.from(html).toString('base64url')}}}) as never;
test('Israel Post notice: accessibility icon is not the product',()=>{
 const p=parseMessage(msg('p1','noReply@postil.co.il','הודעה על משלוח שמספרו RS1344385286Y','<a href="https://uclicks.inforu.net/?page=webview" data-linkid="accessibility"><img title="תפריט נגישות" alt="תפריט נגישות" src="https://ufront2.inforu.net//files/Z9A32S/0fu3wp5tn7.png"/></a><img src="https://uclicks.inforu.net/?page=view" alt="תמונה" height="1" width="1"/><div>שלום Elior Sasi,<br/> משלוח RS1344385286Y מחו"ל בדרכו לארץ. לאחר שחרורו ממכס, הוא ישלח לנקודת האיסוף</div><div>בברכה, דואר ישראל</div>','2026-10-16T01:09:37Z'))!;
 assert.ok(p);assert.notEqual(p.name,'תפריט נגישות');assert.equal(p.image,'');});
test('Shopify order: item title, quantity, refund closes it',()=>{
 const a=parseMessage(msg('s1','store+80190144817@t.shopifyemail.com','Order #500078564 confirmed','<img src="https://cdn.shopify.com/logo.png" alt="misradia" width="150"/><span class="order-number__text">Order #500078564</span><h2>תודה על רכישתך!</h2><p>אנחנו מכינים את ההזמנה שלך למשלוח.</p><img src="https://cdn.shopify.com/chair.gif" class="order-list__product-image"/><span class="order-list__item-title">כסא ארגונומי פרמיום עם גב רשת דגם CH05-8 × 1</span><p>798.00 ₪</p>','2026-09-28T10:44:39Z'))!;
 assert.ok(a.name.startsWith('כסא ארגונומי'),a.name);assert.ok(a.image.includes('chair'));
 const b=parseMessage(msg('s2','store+80190144817@t.shopifyemail.com','הודעה על זיכוי','<span class="order-number__text">הזמנה #500078564</span><h2>הזמנתך זוכתה</h2><p>סך הכל זיכוי: 798.00 ₪</p><span class="order-list__item-title">כסא ארגונומי פרמיום עם גב רשת דגם CH05-8 × 1</span>','2026-10-04T11:44:12Z'))!;
 assert.ok(b.cancelled);const m=mergeParcels([a,b]);assert.equal(m.length,1);assert.ok(m[0].cancelled);});
test('shop of a package stays the store when Israel Post writes later',()=>{
 const base={name:'תחפושת',carrier:'',image:'',url:'',eta:'',cancelled:false,pickup:null};
 const a={...base,id:'order:1',keys:['order:1','tracking:RS1'],shop:'AliExpress',tracking:'RS1',order:'1',stage:1,events:[{id:'a',label:'נשלחה',time:'2026-10-10T00:00:00Z'}]};
 const b={...base,id:'tracking:RS1',keys:['tracking:RS1'],name:'חבילה',shop:'דואר ישראל',carrier:'דואר ישראל',tracking:'RS1',order:'',stage:2,events:[{id:'b',label:'בדרך',time:'2026-10-16T00:00:00Z'}]};
 const m=mergeParcels([a,b] as never);assert.equal(m.length,1);assert.equal(m[0].shop,'AliExpress');assert.equal(m[0].carrier,'דואר ישראל');});
test('Urbanica confirmation with "#number" and quantity',()=>{
 const p=parseMessage(msg('u1','info@urbanica-wh.com','אישור ההזמנה שלך URBANICA','<p>אנו שמחים להודיע שהזמנתך אושרה. אנחנו מכינים לך את החבילה</p><p><strong>הנה המספר שלה: </strong><span>#302834565</span></p><img src="https://www.urbanica-wh.com/pub/media/catalog/product/a.jpg" alt="מארז 4 כוסות מאג זכוכית 246 מ”ל"/><td>מארז 4 כוסות מאג זכוכית 246 מ”ל<br/>כמות: 2<br/> ארץ ייצור: הולנד</td> <td><span class="price">40 ₪</span></td>','2026-09-22T18:25:27Z'))!;
 assert.ok(p);assert.equal(p.order,'302834565');assert.equal(p.shop,'Urbanica');assert.ok(p.name.includes('כוסות'));assert.equal(p.qty,2);});
test('Israel Post notice without an icon is a generic parcel',()=>{
 const p=parseMessage(msg('p2','noReply@postil.co.il','הודעה על משלוח שמספרו RU0140292467Z','<div>משלוח RU0140292467Z מחו"ל בדרכו לארץ.</div>','2026-09-03T08:25:15Z'))!;
 assert.equal(p.name,'חבילה');});
import {parseSms} from '../lib/parcels';
test('courier SMS for an Israeli store joins the order',()=>{
 const s=parseSms('תפוז משלוחים: המשלוח שלך מאורבניקה, הזמנה 302834565, מספר משלוח 7712345 יצא למסירה היום')!;
 assert.ok(s);assert.equal(s.tracking,'7712345');assert.ok(s.keys.includes('order:302834565'));assert.equal(s.shop,'Urbanica');assert.equal(s.stage,3);});
