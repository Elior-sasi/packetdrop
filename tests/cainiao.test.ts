import {test} from 'node:test';import assert from 'node:assert/strict';
import {fromCainiao,combine} from '../lib/track';
test('cainiao delivered',()=>{const t=fromCainiao({mailNo:'lp00123456789012',status:'SIGN',detailList:[{time:1760000000000,standerdDesc:'Delivered',actionCode:'GTMS_SIGNED'},{time:1759000000000,standerdDesc:'Departed from sorting center'}]})!;
 assert.equal(t.stage,4);assert.equal(t.number,'LP00123456789012');assert.equal(t.events.at(-1)!.text,'נמסרה');});
test('cainiao in transit + combine keeps further stage',()=>{const c=fromCainiao({mailNo:'LP1',status:'TRANSPORT',detailList:[{time:1759000000000,standerdDesc:'Arrived at destination country'}]})!;
 assert.equal(c.stage,2);const m=combine({number:'LP1',status:'InfoReceived',stage:1,carrier:'Israel Post',eta:null,events:[]},c)!;assert.equal(m.stage,2);assert.equal(m.carrier,'Israel Post');});
