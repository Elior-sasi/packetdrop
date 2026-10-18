import {test} from 'node:test';import assert from 'node:assert/strict';import {parseSms} from '../lib/parcels';
test('Israel Post pickup SMS',()=>{const p=parseSms('דואר ישראל: דבר דואר RR123456789IL ממתין לאיסופך בסניף סופר יודה, יפו 97 ירושלים. קוד איסוף: 4821')!;
 assert.equal(p.tracking,'RR123456789IL');assert.equal(p.stage,3);assert.equal(p.pickup?.code,'4821');assert.match(p.pickup!.place,/סופר יודה/);assert.equal(p.carrier,'דואר ישראל');});
test('courier out for delivery',()=>{const p=parseSms('HFD: המשלוח 123456789012 יצא למסירה היום, מספר מעקב HF12345678')!;assert.equal(p.tracking,'HF12345678');});
test('no tracking -> null',()=>{assert.equal(parseSms('שלום, קוד אימות 1234'),null);});
test('K Express SMS: shipment + store order, stages, returns skipped',()=>{
 const a=parseSms('שלום אליאור, משלוח מספר 7482743 מספר 302828582 מחברת URBANICA נקלט במחסני חברת המשלוחים K.EXPRESS וישלח לכתובת רחמילביץ משה 134 ירושלים. לינק למעקב https://ilto.run/x')!;
 assert.equal(a.tracking,'7482743');assert.equal(a.order,'302828582');assert.equal(a.shop,'Urbanica');assert.equal(a.carrier,'K Express');assert.equal(a.stage,2);
 assert.equal(parseSms('משלוח מספר 7482743 מחברת URBANICA בדרכו לכתובת רחמילביץ משה 134 ירושלים.השליח יצור קשר במהלך היום. בברכה, K.EXPRESS')!.stage,3);
 assert.equal(parseSms('משלוח 7482743 מ- URBANICA נמסרה ל אליאור , בהצלחה , בברכה, K.EXPRESS')!.stage,4);
 {const r=parseSms("שלום, נתבקשנו לאסוף ממך משלוח מס' 7554453 מאורבניקה. בבקשה לארוז")!;assert.ok(r.ret);assert.equal(r.name,'החזרה ל־Urbanica');assert.deepEqual(r.keys,['return:7554453']);assert.equal(r.tracking,'');}});
