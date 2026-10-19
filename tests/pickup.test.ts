import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hoursText,daysLeft} from '../lib/pickup';
const mon10=new Date(2026,9,19,10,0),mon22=new Date(2026,9,19,22,0),fri16=new Date(2026,9,23,16,0),sat=new Date(2026,9,24,12,0);
test('pickup point opening hours',()=>{
 const h="א'-ה' 9:00-21:00, ו' 9:00-14:00";
 assert.equal(hoursText(h,mon10),'פתוח עכשיו · עד 21:00');
 assert.equal(hoursText(h,mon22),'סגור להיום');
 assert.equal(hoursText(h,fri16),'סגור להיום');
 assert.equal(hoursText(h,sat),'סגור היום');
 assert.equal(hoursText('א-ה 8:00-12:00, 16:00-19:00',new Date(2026,9,19,13,0)),'סגור · נפתח ב־16:00');
 assert.equal(hoursText('פתוח 24 שעות'),'');});
test('days left to collect',()=>{
 const p={id:'x',keys:['x'],name:'',shop:'',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:3,cancelled:false,pickup:{place:'סופר פארם',address:'',code:'',url:''},events:[{id:'a',label:'ממתינה לאיסוף',time:new Date(2026,9,10,9).toISOString()}]};
 assert.equal(daysLeft(p as never,mon10.getTime()),5);
 assert.equal(daysLeft({...p,pickup:{...p.pickup,until:'21.10'}} as never,mon10.getTime()),2);});
test('Google opening periods',async()=>{const {periodsText}=await import('../lib/pickup');
 const ps=[0,1,2,3,4].map(d=>({open:{day:d,hour:9,minute:0},close:{day:d,hour:21,minute:0}})).concat([{open:{day:5,hour:9,minute:0},close:{day:5,hour:14,minute:0}}]);
 assert.equal(periodsText(ps,new Date(2026,9,19,10,0)),'פתוח עכשיו · עד 21:00');
 assert.equal(periodsText(ps,new Date(2026,9,19,22,0)),'סגור · נפתח מחר ב־9:00');
 assert.equal(periodsText(ps,new Date(2026,9,19,7,0)),'סגור · נפתח ב־9:00');
 assert.equal(periodsText(ps,new Date(2026,9,24,12,0)),'סגור · נפתח מחר ב־9:00');
 assert.equal(periodsText(ps,new Date(2026,9,23,16,0)),'סגור · נפתח ביום ראשון ב־9:00');
 assert.equal(periodsText([{open:{day:0,hour:0}}]),'פתוח 24 שעות');});
