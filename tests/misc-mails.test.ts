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
 const p=parseMessage(msg('u1','info@urbanica-wh.com','אישור ההזמנה שלך URBANICA','<p>אנו שמחים להודיע שהזמנתך אושרה. אנחנו מכינים לך את החבילה</p><a href="https://crm.tapuzdelivery.co.il/Baldar/deliverystatus.aspx">סטטוס משלוח</a><p><strong>הנה המספר שלה: </strong><span>#302834565</span></p><img src="https://www.urbanica-wh.com/pub/media/catalog/product/a.jpg" alt="מארז 4 כוסות מאג זכוכית 246 מ”ל"/><td>מארז 4 כוסות מאג זכוכית 246 מ”ל<br/>כמות: 2<br/> ארץ ייצור: הולנד</td> <td><span class="price">40 ₪</span></td>','2026-09-22T18:25:27Z'))!;
 assert.ok(p);assert.equal(p.order,'302834565');assert.equal(p.shop,'Urbanica');assert.ok(p.name.includes('כוסות'));assert.equal(p.qty,2);assert.deepEqual(p.via,['crm.tapuzdelivery.co.il']);});
test('Israel Post notice without an icon is a generic parcel',()=>{
 const p=parseMessage(msg('p2','noReply@postil.co.il','הודעה על משלוח שמספרו RU0140292467Z','<div>משלוח RU0140292467Z מחו"ל בדרכו לארץ.</div>','2026-09-03T08:25:15Z'))!;
 assert.equal(p.name,'חבילה');});
import {parseSms} from '../lib/parcels';
test('courier SMS for an Israeli store joins the order',()=>{
 const s=parseSms('תפוז משלוחים: המשלוח שלך מאורבניקה, הזמנה 302834565, מספר משלוח 7712345 יצא למסירה היום')!;
 assert.ok(s);assert.equal(s.tracking,'7712345');assert.ok(s.keys.includes('order:302834565'));assert.equal(s.shop,'Urbanica');assert.equal(s.stage,3);});
test('KSP order table gives the product name; review request means delivered',()=>{
 const p=parseMessage(msg('k1','noreply@ksp.co.il','תודה שבחרתם KSP - הזמנה מספר: 954662518','<p>הזמנתך מספר 954662518 תטופל בהקדם בין התאריכים 23-09-2026 ועד 04-10-2026</p><table><tr><td>מקט</td><td>תיאור</td><td>מחיר</td></tr><tr><td>402969</td><td>בר מים טאץ\' דגם Spirit מבית HDS Water - צבע לבן</td><td>1290 ₪</td></tr><tr><td>GIFTPACK</td><td>[קמפיין #72583]</td><td>300</td></tr></table>','2026-09-17T11:31:10Z'))!;
 assert.ok(p.name.startsWith("בר מים טאץ'"),p.name);assert.equal(p.eta,'23.9-4.10');
 const r=parseMessage(msg('k2','noreply@ksp.co.il','חוויתכם חשובה לנו! שלחו את דעתכם על KSP','<p>בהמשך להזמנה מספר 954662518</p>','2026-09-22T11:52:00Z'))!;assert.equal(r.stage,4);});
test('a package lists every order in it',()=>{const ev=(id:string,t:string)=>[{id,label:'נשלחה',time:t}];
 const base={shop:'AliExpress',carrier:'',image:'',url:'',tracking:'',eta:'',stage:1,cancelled:false,pickup:null};
 const a={...base,id:'order:1',keys:['order:1','tracking:AP1'],name:'שלט',order:'1',tracking:'AP1',events:ev('a','2026-10-01T00:00:00Z')};
 const b={...base,id:'order:2',keys:['order:2','tracking:AP1'],name:'חולצת BLEACH',order:'2',tracking:'AP1',events:ev('b','2026-10-01T00:00:01Z')};
 const c={...base,id:'order:3',keys:['order:3','tracking:AP1'],name:'הזמנה מ־AliExpress',order:'3',tracking:'AP1',events:ev('c','2026-10-01T00:00:02Z')};
 const [m]=mergeParcels([a,b,c] as never);assert.deepEqual(m.items,['שלט','חולצת BLEACH','הזמנה …3']);});
test('same product cut shorter in another mail is listed once',()=>{const base={shop:'AliExpress',carrier:'',image:'',url:'',eta:'',stage:1,cancelled:false,pickup:null};
 const a={...base,id:'order:1',keys:['order:1','tracking:AP9'],name:'כיסוי',order:'1',tracking:'AP9',items:['כיסוי','מכנסי קארגו לגברים'],events:[{id:'a',label:'x',time:'2026-10-01T00:00:00Z'}]};
 const b={...base,id:'order:2',keys:['order:2','tracking:AP9'],name:'כיסוי',order:'2',tracking:'AP9',items:['כיסוי','מכנסי קארגו לגברים כותנה'],events:[{id:'b',label:'x',time:'2026-10-02T00:00:00Z'}]};
 const [m]=mergeParcels([a,b] as never);assert.deepEqual(m.items,['כיסוי','מכנסי קארגו לגברים כותנה']);});
test('Israel Post notice templates',()=>{const mk=(tr:string,body:string)=>parseMessage({id:'p'+tr+body.length,internalDate:'1790000000000',payload:{mimeType:'text/html',headers:[{name:'Subject',value:'הודעה על משלוח שמספרו '+tr},{name:'From',value:'noReply@postil.co.il'}],body:{data:Buffer.from('<div>תפריט נגישות</div><p>'+body+'</p>').toString('base64url')}}} as never)!;
 const a=mk('RU0140292467Z','משלוח מ- Amazon מספר RU0140292467Z בדרכו לארץ וצפוי להימסר בימים הקרובים ולא יאוחר מתאריך 06/09/2026.');assert.equal(a.tracking,'RU0140292467Z');assert.equal(a.shop,'Amazon');assert.equal(a.eta,'6.9');assert.equal(a.events[0].label,'בדרך לארץ');
 const b=mk('RS1331012086Y','משלוח RS1331012086Y<br>ר 556<br>שנשלח מAliexpress ממתין באופיר דיזיין (בית עסק) בלגרד 5 שדרות. למידע נוסף');assert.equal(b.stage,3);assert.equal(b.pickup?.code,'ר 556');assert.equal(b.pickup?.place,'אופיר דיזיין (בית עסק) בלגרד 5 שדרות');
 const c=mk('RS1331012086Y','לקוח יקר, תודה שאספת את המשלוח RS1331012086Y בדואר ישראל.');assert.equal(c.stage,4);assert.equal(c.events[0].label,'נאספה');});
test('store-side wording is not a pickup for the user',()=>{const mk=(from:string,sub:string,body:string)=>parseMessage({id:'k'+sub.length+body.length,internalDate:'1790000000000',payload:{mimeType:'text/html',headers:[{name:'Subject',value:sub},{name:'From',value:from}],body:{data:Buffer.from('<p>'+body+'</p>').toString('base64url')}}} as never)!;
 assert.equal(mk('noreply@ksp.co.il','KSP.CO.IL - הזמנתך 954662518 נארזה וממתינה לאיסוף על ידי השליח','לקוח יקר, הזמנתך מס\' 954662518 נארזה וממתינה לאיסוף על ידי השליח.').stage,1);
 assert.equal(mk('noreply@ksp.co.il','תודה שבחרתם KSP - הזמנה מספר: 954662518','הזמנתך מספר 954662518 תטופל בהקדם אופן אספקה: דואר שליחים').stage,0);});
