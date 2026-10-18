import {test} from 'node:test';import assert from 'node:assert/strict';import {parseTapuz} from '../lib/tapuz';
test('Tapuz reply: items + log',()=>{
 const d='302834565|1|24/09/2026 10:15|נמסר|אליאור;^~^{"LogData":[{"DateAdded":"23/09/2026","TimeAdded":"09:01","Comments":"נקלט במחסן"},{"DateAdded":"24/09/2026","TimeAdded":"08:30","Comments":"יצא לחלוקה"},{"DateAdded":"24/09/2026","TimeAdded":"10:15","Comments":"נמסר ללקוח"}],"SmsMessages":[]}';
 const t=parseTapuz(d,'TZ:302834565')!;assert.equal(t.stage,4);assert.equal(t.events.length,3);assert.equal(t.status,'Delivered');assert.equal(t.carrier,'תפוז');assert.ok(t.events[0].time<t.events[2].time);});
test('Tapuz: nothing found',()=>{assert.equal(parseTapuz('','TZ:1'),null);assert.equal(parseTapuz('ERROR','TZ:1'),null);});
