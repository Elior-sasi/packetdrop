import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courierEta,pageText} from '../lib/courier';
const now=new Date(2026,9,19,9);
test('courier page: planned delivery day and time window',()=>{
 assert.equal(courierEta(pageText('<div>תאריך קליטה: 17/10/2026</div><div>מועד מסירה משוער: 21/10/2026</div><div>בין השעות 10:00-14:00</div>'),now),'21.10 · 10:00-14:00');
 assert.equal(courierEta('המשלוח יגיע מחר בין 08:00 עד 12:00',now),'20.10 · 08:00-12:00');
 assert.equal(courierEta('נקלט במחסן 18/10',now),'');});
