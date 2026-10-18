import {test} from 'node:test';import assert from 'node:assert/strict';import {parseTapuz} from '../lib/tapuz';
test('Tapuz reply: items + log',()=>{
 const d='302834565|1|24/09/2026 10:15|נמסר|אליאור;^~^{"LogData":[{"DateAdded":"23/09/2026","TimeAdded":"09:01","Comments":"נקלט במחסן"},{"DateAdded":"24/09/2026","TimeAdded":"08:30","Comments":"יצא לחלוקה"},{"DateAdded":"24/09/2026","TimeAdded":"10:15","Comments":"נמסר ללקוח"}],"SmsMessages":[]}';
 const t=parseTapuz(d,'TZ:302834565')!;assert.equal(t.stage,4);assert.equal(t.events.length,3);assert.equal(t.status,'Delivered');assert.equal(t.carrier,'תפוז');assert.ok(t.events[0].time<t.events[2].time);});
test('Tapuz: nothing found',()=>{assert.equal(parseTapuz('','TZ:1'),null);assert.equal(parseTapuz('ERROR','TZ:1'),null);});
import {parseBaldarRows,parseKexpress} from '../lib/tapuz';
test('Baldar by phone: recent rows become parcels keyed by order',()=>{
 const now=new Date('2026-10-18T10:00:00Z').getTime();
 const r=parseBaldarRows('302834565|1|30/09/2026 14:36|נמסר|אליאור;111|1|01/01/2025 10:00|נמסר|x;^~^{}','crm.tapuzdelivery.co.il',now);
 assert.equal(r.length,1);assert.deepEqual(r[0].keys,['order:302834565']);assert.equal(r[0].stage,4);assert.equal(r[0].carrier,'תפוז');assert.deepEqual(r[0].via,['crm.tapuzdelivery.co.il']);});
test('K Express page status words',()=>{
 const t=parseKexpress('<html><body><table><tr><td>מספר משלוח</td><td>123456</td></tr><tr><td>סטטוס</td><td>יצא לחלוקה</td></tr><tr><td>18/10/2026 09:30</td></tr></table></body></html>','123456')!;
 assert.equal(t.stage,3);assert.equal(t.events[0].text,'יצא לחלוקה');});
