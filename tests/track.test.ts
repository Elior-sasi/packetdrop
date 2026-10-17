import {test} from 'node:test';import assert from 'node:assert/strict';import {toInfo} from '../lib/track';
test('17TRACK response maps to step, carrier, estimate and sorted unique events',()=>{
 const t=toInfo({number:'RS1344026176Y',track_info:{latest_status:{status:'AvailableForPickup'},time_metrics:{estimated_delivery_date:{from:'2026-10-24T00:00:00Z',to:'2026-10-27T00:00:00Z'}},tracking:{providers:[{provider:{name:'Israel Post'},events:[
  {time_utc:'2026-10-16T12:36:00Z',description:'Ready for pickup',description_translation:{description:'מוכן לאיסוף בסניף'},location:'Jerusalem'},
  {time_utc:'2026-10-14T10:00:00Z',description:'Customs'},{time_utc:'2026-10-14T10:00:00Z',description:'Customs'}]}]}}});
 assert.equal(t.stage,3);assert.equal(t.carrier,'Israel Post');assert.equal(t.events.length,2);assert.equal(t.events[1].text,'מוכן לאיסוף בסניף');assert.equal(t.events[1].location,'Jerusalem');assert.ok(t.eta?.from);assert.equal(t.pending,false);});
test('unknown number is pending with no step',()=>{const t=toInfo({number:'X12345678'});assert.equal(t.stage,-1);assert.equal(t.pending,true);});
import {heEvent} from '../lib/track';
test('common English carrier events become Hebrew',()=>{
 assert.equal(heEvent('Received by local delivery company'),'הועברה לחברת המסירה המקומית');
 assert.equal(heEvent('Received by'),'נאספה על ידי חברת השילוח');
 assert.equal(heEvent('Delivered, signed by customer'),'נמסרה');
 assert.equal(heEvent('Out for delivery'),'יצאה למסירה');
 assert.equal(heEvent('Import customs clearance started'),'בתהליך שחרור מהמכס');
 assert.equal(heEvent('Released from customs'),'שוחררה מהמכס');
 assert.equal(heEvent('Arrived at destination country'),'הגיעה לארץ היעד');
 assert.equal(heEvent('Delivery attempt failed'),'ניסיון מסירה לא הצליח');
 assert.equal(heEvent('מוכן לאיסוף בסניף'),'מוכן לאיסוף בסניף');
 assert.equal(heEvent('Weird carrier text 123'),'Weird carrier text 123');});
