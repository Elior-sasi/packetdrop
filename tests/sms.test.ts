import {test} from 'node:test';import assert from 'node:assert/strict';import {parseSms} from '../lib/parcels';
test('Israel Post pickup SMS',()=>{const p=parseSms('דואר ישראל: דבר דואר RR123456789IL ממתין לאיסופך בסניף סופר יודה, יפו 97 ירושלים. קוד איסוף: 4821')!;
 assert.equal(p.tracking,'RR123456789IL');assert.equal(p.stage,3);assert.equal(p.pickup?.code,'4821');assert.match(p.pickup!.place,/סופר יודה/);assert.equal(p.carrier,'דואר ישראל');});
test('courier out for delivery',()=>{const p=parseSms('HFD: המשלוח 123456789012 יצא למסירה היום, מספר מעקב HF12345678')!;assert.equal(p.tracking,'HF12345678');});
test('no tracking -> null',()=>{assert.equal(parseSms('שלום, קוד אימות 1234'),null);});
