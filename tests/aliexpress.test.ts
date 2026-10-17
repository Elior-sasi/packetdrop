import {test} from 'node:test';import assert from 'node:assert/strict';import {parseMessage,mergeParcels} from '../lib/parcels';
const mail=(id:string,from:string,subject:string,html:string,time:string,labels=['CATEGORY_UPDATES'])=>({id,threadId:id,internalDate:time,labelIds:labels,payload:{headers:[{name:'From',value:from},{name:'Subject',value:subject}],body:{data:Buffer.from(html).toString('base64url')}}});
const TX='AliExpress <transaction@notice.aliexpress.com>';
const orderShipped=mail('m1',TX,"הזמנה מס' 1123312985106914: נשלחה",`<p>הזמנתכם מס' 1123312985106914 נשלחה</p>
 <a href="https://www.aliexpress.com/p/order/detail.html?orderId=1123312985106914&edm_log_data=edm-order-details-v2.order-details-v2-log-link"><table><tr><td><img src="https://ae01.alicdn.com/kf/case.jpg"></td><td>כיסוי אוזניות מגנטי בסגנון חד...</td><td>Black gray, AirPods ...</td><td>x1</td></tr></table></a>
 <p>ייתכן שגם תאהבו</p><a href="https://www.aliexpress.com/ssr/1?productId=1005008092915359"><img src="https://ae01.alicdn.com/kf/ad.jpg"> -59% ₪13.03</a>`,'1792223466000');
const pkgCustoms=mail('m2',TX,"חבילה RS1344385286Y: במכס",`<p>החבילה שלך מס' RS1344385286Y עוברת כרגע במכס.</p>
 <a href="https://www.aliexpress.com/ssr/300002636/x?o_ids=1123312985106914&edm_log_data=gmod-edm-package-detail.edm-package-detail-log-link"><td>כיסוי אוזניות מגנטי בסגנון חד... x1</td></a>`,'1792300000000');
const ad=mail('m3','AliExpress <promotion@aliexpress.com>','פרסומת | הפריטים הכי לוהטים, עכשיו ב-50%+ הנחה','<img alt="Hot deals of the season today" src="https://x.com/a.jpg"> order now','1792000000000',['CATEGORY_PROMOTIONS']);
const nudge=mail('m4','AliExpress <ae-brief-note00@mail.aliexpress.com>','כדי לצרף למה שרכשתם','<p>יש לנו מבחר פריטים בשבילכם ₪90.97</p>','1792000000001',['CATEGORY_PERSONAL']);
const summary=mail('m5',TX,'עדכונים לגבי המשלוח של 3 החבילות שלכם','<a href="https://a.com/?o_ids=1111111111,2222222222">x</a><a href="https://a.com/?o_ids=3333333333">y</a> בתעבורה בינלאומית','1792000000002');
test('ads, promo nudges and multi-package summaries are not parcels',()=>{assert.equal(parseMessage(ad),null);assert.equal(parseMessage(nudge),null);assert.equal(parseMessage(summary),null);});
test('AliExpress order mail: product from the order block, not the recommendation grid',()=>{const p=parseMessage(orderShipped)!;assert.equal(p.order,'1123312985106914');assert.equal(p.name,'כיסוי אוזניות מגנטי');assert.equal(p.image,'https://ae01.alicdn.com/kf/case.jpg');assert.equal(p.stage,1);assert.equal(p.shop,'AliExpress');});
test('package mail joins its order via o_ids and moves it forward',()=>{const q=parseMessage(pkgCustoms)!;assert.equal(q.tracking,'RS1344385286Y');assert.equal(q.stage,2);const rows=mergeParcels([parseMessage(orderShipped)!,q]);assert.equal(rows.length,1);const [m]=rows;assert.equal(m.id,'order:1123312985106914');assert.equal(m.tracking,'RS1344385286Y');assert.equal(m.stage,2);assert.equal(m.image,'https://ae01.alicdn.com/kf/case.jpg');assert.equal(m.events.length,2);});
test('Hebrew delivery and pickup statuses',()=>{const d=parseMessage(mail('m6',TX,"חבילה מס' RS1343135466Y נמסרה",'<p>החבילה שלכם RS1343135466Y נמסרה בהצלחה! Fast delivery</p>','1'))!;assert.equal(d.stage,4);const pk=parseMessage(mail('m7',TX,"חבילה מס' RS1343135466Y מוכנה לאיסוף",'<p>מוכנה לאיסוף</p>','2'))!;assert.equal(pk.stage,3);});
test('closed order is marked cancelled, not delivered',()=>{const c=parseMessage(mail('m8',TX,'Your order 1123312985126914 is closed','<p>closed</p>','3'))!;const [m]=mergeParcels([c]);assert.equal(m.cancelled,true);assert.notEqual(m.stage,4);});
test('review request and delivered package mail both close the order',()=>{const r=parseMessage(mail('r1',TX,"הזמנה מס' 1122877229106914: איך הלך?","<p>תוכלו לכתוב עכשיו ביקורת לגבי הזמנתכם מס' 1122877229106914</p>",'1791286615000'))!;assert.equal(r.stage,4);
 const d=parseMessage(mail('d1',TX,"חבילה מס' RS1339402036Y נמסרה",'<p>החבילה שלכם RS1339402036Y נמסרה בהצלחה</p><a href="https://www.aliexpress.com/x?o_ids=1122877229106914&edm_log_data=package-detail"><table><tr><td>פרטי החבילה</td><td>בקבוק מים טריטן x1</td></tr></table></a>','1790855214000'))!;assert.equal(d.name,'בקבוק מים טריטן');
 const [m]=mergeParcels([r,d]);assert.equal(m.stage,4);});
import {mergeParcels as mp2} from '../lib/parcels';
import {test as t2} from 'node:test';import assert2 from 'node:assert/strict';
t2('orders shipped together from one checkout merge with the package',()=>{
 const base={name:'',shop:'AliExpress',carrier:'',image:'',url:'',eta:'',cancelled:false,pickup:null,tracking:''};
 const chessShip={...base,id:'order:1123351833026914',keys:['order:1123351833026914'],order:'1123351833026914',name:'שחמט',stage:1,events:[{id:'a',label:"הזמנה מס' 1123351833026914: נשלחה",time:'2026-10-09T00:44:24.000Z'}]};
 const alarmShip={...base,id:'order:1123351833046914',keys:['order:1123351833046914'],order:'1123351833046914',name:'אזעקה',stage:1,events:[{id:'b',label:'נשלחה',time:'2026-10-09T00:44:24.000Z'}]};
 const delivered={...base,id:'order:1123351833026914',keys:['order:1123351833026914','tracking:RS1343135466Y'],order:'1123351833026914',tracking:'RS1343135466Y',stage:4,events:[{id:'c',label:'נמסרה',time:'2026-10-15T04:18:28.000Z'}]};
 const other={...base,id:'order:1122868352196914',keys:['order:1122868352196914'],order:'1122868352196914',stage:1,events:[{id:'d',label:'נשלחה',time:'2026-10-09T00:44:24.000Z'}]};
 const out=mp2([chessShip,alarmShip,delivered,other]);assert2.equal(out.length,2);assert2.equal(out.find(p=>p.keys.includes('order:1123351833046914'))!.stage,4);});
