import {test} from 'node:test';import assert from 'node:assert/strict';
test('notification when the local courier picks the parcel up (once)',async()=>{const {diff}=await import('../lib/notify');const now=Date.now();
 const base={id:'a',keys:['a'],name:'כבל',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'RS1',order:'',eta:'',stage:2,cancelled:false,pickup:null,events:[{id:'1',label:'הגיעה לארץ',time:new Date(now-2*864e5).toISOString()}]};
 const next={...base,events:[...base.events,{id:'2',label:'נאספה על ידי חברת המשלוחים המקומית',time:new Date(now-3600e3).toISOString()}]};
 const r=diff({parcels:[base] as never,stuck:[]},[next] as never,now);assert.ok(r.notes.some(n=>n.tag==='lc:a'));
 const again=diff({parcels:[next] as never,stuck:[]},[next] as never,now);assert.ok(!again.notes.some(n=>n.tag==='lc:a'));});
