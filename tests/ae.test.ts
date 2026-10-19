import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aeEta,aeCloseDays,aeWhen} from '../lib/ae';
const now=new Date(2026,9,19);
test('AliExpress order page: delivery date read, order and payment dates ignored',()=>{
 assert.equal(aeEta('Order placed on Oct 10, 2026\nEstimated delivery: Oct 24 - 30',now),'24.10-30.10');
 assert.equal(aeEta('משלוח\nצפי הגעה: 24 באוק׳ - 30 באוק׳',now),'24.10-30.10');
 assert.equal(aeEta('יגיע עד 27 באוקטובר',now),'27.10');
 assert.equal(aeEta('משלוח מהיר: פעיל\nאם ההזמנה נמסרה אחרי Oct 22, 2026 אפשר לקבל קופון\n( איסוף עצמי ) תקופת האספקה:Oct 11 - 22\nOct 24, 2026',now),'22.10');
 assert.equal(aeEta('תקופת האספקה: Oct 21 - 28',now),'21.10-28.10');
 assert.equal(aeEta('Paid Oct 12\nTotal ₪72.97',now),'');});
test('AliExpress order page: auto-close days and the moment to count to',()=>{
 assert.equal(aeCloseDays('המערכת תאשר אוטומטית את הקבלה לאחר 69 ימים'),69);
 assert.equal(aeCloseDays('Order will be confirmed automatically in 5 days'),5);
 assert.equal(aeCloseDays('Total 69'),0);
 assert.equal(new Date(aeWhen('11.10-22.10',now)).getDate(),22);
 assert.equal(new Date(aeWhen('21.10-28.10',now)).getDate(),21);});
test('Amazon order page: arriving weekday / tomorrow',()=>{
 assert.equal(aeEta('Arriving Thursday',now),'22.10');
 assert.equal(aeEta('Arriving tomorrow by 10 PM',now),'20.10');
 assert.equal(aeEta('Now expected October 27',now),'27.10');});
