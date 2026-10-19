import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aeEta} from '../lib/ae';
const now=new Date(2026,9,19);
test('AliExpress order page: delivery date read, order and payment dates ignored',()=>{
 assert.equal(aeEta('Order placed on Oct 10, 2026\nEstimated delivery: Oct 24 - 30',now),'24.10-30.10');
 assert.equal(aeEta('משלוח\nצפי הגעה: 24 באוק׳ - 30 באוק׳',now),'24.10-30.10');
 assert.equal(aeEta('יגיע עד 27 באוקטובר',now),'27.10');
 assert.equal(aeEta('Paid Oct 12\nTotal ₪72.97',now),'');});
