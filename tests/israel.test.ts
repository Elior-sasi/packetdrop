import {test} from 'node:test';import assert from 'node:assert/strict';import {parseMessage,mergeParcels} from '../lib/parcels';
const mail=(id:string,from:string,subject:string,body:string,time='1000')=>({id,threadId:id,internalDate:time,payload:{headers:[{name:'From',value:from},{name:'Subject',value:subject}],body:{data:Buffer.from(body).toString('base64url')}}});
test('cinema tickets and Wolt receipts are not parcels',()=>{
 assert.equal(parseMessage(mail('c','Cinema City <noreply@cinema-city.co.il>','סינמה סיטי ירושלים - אישור הזמנה','מספר הזמנה: 12345678. הכרטיסים נשלחו אליך. אולם 5 מושב 12')),null);
 assert.equal(parseMessage(mail('w','Wolt <info@wolt.com>','קבלת רכישה ב-Wolt',"תודה על ההזמנה! הנה הקבלה שלך: צ׳יטה מס' הזמנה: 6953ce5ed7ba7abf172f1349 משלוח")),null);});
test('Cheetah on the way and waiting for pickup with place, address and hours',()=>{
 const a=parseMessage(mail('a',"Cheetah <CheetahDelivery@chita-il.com>",'הודעה בדבר משלוח','שלום Elior משלוח AE038225830 בדרכו לישראל, לאחר שחרורו מהמכס המשלוח ישלח לנקודת האיסוף','1000'))!;
 const b=parseMessage(mail('b',"Cheetah <CheetahDelivery@chita-il.com>",'הודעה בדבר משלוח','שלום Elior, איזה כיף :), משלוח AE038225830 ממתין לאיסוף ב מוצרי חד פעמי וניקיון,אוסלו 2 שדרות,פרטים:מול מסעדה "חיימוס". א\'-ה\' 09:00-18:00, ו\' 09:00-13:00. לאישור ופרטים לחץ','2000'))!;
 assert.equal(a.stage,2);assert.equal(a.carrier,"צ'יטה");assert.equal(a.tracking,'AE038225830');
 assert.equal(b.stage,3);assert.equal(b.pickup?.place,'מוצרי חד פעמי וניקיון');assert.equal(b.pickup?.address,'אוסלו 2 שדרות');assert.match(b.pickup?.hours||'',/09:00-18:00/);
 const [m]=mergeParcels([a,b]);assert.equal(m.events.length,2);assert.equal(m.stage,3);assert.equal(m.name,'חבילה');});
test('KSP: Israeli date range becomes the arrival estimate',()=>{const p=parseMessage(mail('k','KSP <noreply@ksp.co.il>','תודה שבחרתם KSP - הזמנה מספר: 954662518','הזמנתך מספר 954662518 תטופל בהקדם אופן אספקה: דואר שליחים לכתובת שצוינה בתוך 2-9 ימי עסקים כלומר בין התאריכים 23-09-2026 ועד 04-10-2026'))!;assert.equal(p.shop,'KSP');assert.equal(p.order,'954662518');assert.equal(p.eta,'23.9-4.10');});
test('Urbanica shipped with Tapuz',()=>{const p=parseMessage(mail('u','Urbanica <Service@urbanica-wh.com>','הזמנתך מאתר אורבניקה בדרך אליך','הי, הזמנתך נארזה ויצאה למשלוח. ניתן לעקוב אחרי המשלוח בלינק : https://crm.tapuzdelivery.co.il/Baldar/deliverystatus.aspx מספר הזמנה: 1234567'))!;assert.equal(p.shop,'Urbanica');assert.equal(p.carrier,'תפוז');assert.equal(p.stage,1);});
