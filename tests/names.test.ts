import {test} from 'node:test';import assert from 'node:assert/strict';import {tidyName,etaOf} from '../lib/parcels';
test('shop-truncated names lose the dots and the half word',()=>{
 assert.equal(tidyName('דפי כביסה לוכדי צבעים, בד לא ארוג, ט...'),'דפי כביסה לוכדי צבעים, בד לא ארוג');
 assert.equal(tidyName('כיסוי אוזניות מגנטי בסגנון חד...'),'כיסוי אוזניות מגנטי');
 assert.equal(tidyName('בקבוק מים טריטן x1'),'בקבוק מים טריטן');
 assert.ok(tidyName('שקע חכם WiFi 16A שקע ישראל שקע חשמל חכם, שלט קולי, אלקסה, גוגל הום').length<=42);});
test('arrival estimate keeps only the date',()=>{
 assert.equal(etaOf('September 6 Elior - your package'),'6.9');
 assert.equal(etaOf('Tuesday, Oct 21 - Oct 24'),'21.10-24.10');
 assert.equal(etaOf('22 October'),'22.10');
 assert.equal(etaOf('24/10/2026'),'24.10');
 assert.equal(etaOf('soon'),'');});
