import {test} from 'node:test';import assert from 'node:assert/strict';import {reminders,weekly} from '../lib/notify';
const P=(days:number)=>({id:'a',keys:['order:1'],name:'אוזניות',shop:'KSP',carrier:'',image:'',url:'',tracking:'',order:'1',eta:'',stage:3,cancelled:false,pickup:{place:'סופר יודה',address:'',code:'4821',url:''},events:[{id:'e',label:'ממתינה לאיסוף',time:new Date(Date.now()-days*864e5).toISOString()}]});
test('pickup reminder after 2 days, once',()=>{const r=reminders({parcels:[P(2.2)],stuck:[]});assert.equal(r.notes.length,1);assert.match(r.notes[0].body,/4821/);
 assert.equal(reminders({parcels:[P(2.5)],stuck:[],reminded:r.reminded}).notes.length,0);
 const r3=reminders({parcels:[P(11.5)],stuck:[],reminded:r.reminded});assert.match(r3.notes[0].title,/^נשארו [23] ימים לאיסוף$/);
 assert.match(reminders({parcels:[P(13.5)],stuck:[],reminded:r3.reminded}).notes[0].title,/האחרון לאיסוף$/);});
test('weekly only Sunday morning',()=>{const sun=new Date('2026-10-18T06:30:00Z');const w=weekly({parcels:[P(1)],stuck:[]},sun);assert.ok(w.note);assert.match(w.note!.body,/מחכות לאיסוף/);
 assert.equal(weekly({parcels:[P(1)],stuck:[],weekly:w.week},sun).note,null);assert.equal(weekly({parcels:[P(1)],stuck:[]},new Date('2026-10-19T06:30:00Z')).note,null);});
