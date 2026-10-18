import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {pdfText,pdfOrder} from '../lib/pdf';import {parseMessage} from '../lib/parcels';
const dir='/tmp/claude-0/-home-claude/e7220550-537b-5a94-ae5a-bd605048f483/scratchpad/';
test('PDF order copy, logical and visual Hebrew',async t=>{if(!existsSync(dir+'pg_visual.pdf'))return t.skip();
 for(const f of ['pg_logical.pdf','pg_visual.pdf']){const i=pdfOrder(await pdfText(new Uint8Array(readFileSync(dir+f))));assert.equal(i.order,'2010827106');assert.deepEqual(i.ship,['472598857']);assert.equal(i.items.length,1);assert.ok(i.items[0].includes('בר מים'));}});
test('mail without details takes them from the PDF',()=>{
 const m={id:'pg1',internalDate:String(Date.parse('2026-09-04T05:42:39Z')),payload:{mimeType:'text/html',headers:[{name:'Subject',value:'תודה שהזמנת במחסני חשמל , מצ"ב חשבונית להזמנה שביצעת'},{name:'From',value:'sales@payngo.co.il'}],body:{data:Buffer.from('<p>תודה שהזמנת במחסני חשמל , מצ"ב חשבונית להזמנה שביצעת</p>').toString('base64url')}}};
 const p=parseMessage(m as never,{order:'2010833579',ship:['472693276'],items:['מדיח על השיש אלקטרה EL100109S כסוף','מכונת כביסה פתח קידמי אלקטרה 6 ק"ג EL60']})!;
 assert.ok(p);assert.equal(p.order,'2010833579');assert.equal(p.shop,'מחסני חשמל');assert.ok(p.name.startsWith('מדיח על השיש'));});
