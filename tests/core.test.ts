import {test} from 'node:test';import assert from 'node:assert/strict';
import {statusOf,parcelStatus} from '../lib/status';
import {diff} from '../lib/notify';
import {mergeParcels,parseSms,type Parcel} from '../lib/parcels';
import {combine,trackSources,type TrackingProvider,type TrackInfo} from '../lib/track';
import {deliver,type Sub} from '../lib/push';
const now=Date.now();const ago=(h:number)=>new Date(now-h*3600e3).toISOString();
const P=(o:Partial<Parcel>={}):Parcel=>({id:'a',keys:['a'],name:'כבל',shop:'AliExpress',carrier:'',image:'',url:'',tracking:'',order:'',eta:'',stage:1,cancelled:false,pickup:null,events:[{id:'e1',label:'נשלחה',time:ago(48)}],...o});
const T=(n:string,evs:[string,string][]):TrackInfo=>({number:n,status:'InTransit',stage:2,carrier:'',eta:null,events:evs.map(([time,text])=>({time,text,location:''})),pending:false});

test('status normalization: Hebrew and English wording map to one model',()=>{
 const cases:[string,string][]=[['ההזמנה אושרה','ORDERED'],['נשלחה','SHIPPED'],['shipped','SHIPPED'],['יצאה מארץ המוצא','IN_TRANSIT'],['Departed from origin','IN_TRANSIT'],
  ['חבילה מס\' RS1: במדינה/באזור שלכם','ARRIVED_IN_DESTINATION_COUNTRY'],['הגיע לארץ ובדרכו אליך','ARRIVED_IN_DESTINATION_COUNTRY'],['בתהליך שחרור מהמכס','CUSTOMS'],
  ['חבילה מס\' RS1: עם חברת המשלוחים המקומית','LOCAL_CARRIER'],['יצאה למסירה','OUT_FOR_DELIVERY'],['Out for delivery','OUT_FOR_DELIVERY'],['מוכנה לאיסוף','READY_FOR_PICKUP'],
  ['נמסרה','DELIVERED'],['Delivered','DELIVERED'],['החבילה מוחזרת לשולח','EXCEPTION'],['ניסיון מסירה לא הצליח','EXCEPTION']];
 for(const [l,s] of cases)assert.equal(statusOf(l),s,l);
 assert.equal(statusOf('נמסרה לחברת ההובלה'),'SHIPPED');assert.equal(statusOf('שלום'),null);});

test('parcel status: latest meaningful event, delivered wins',()=>{
 assert.equal(parcelStatus(P({stage:2,events:[{id:'1',label:'נשלחה',time:ago(9)},{id:'2',label:'הגיעה לארץ',time:ago(2)}]})),'ARRIVED_IN_DESTINATION_COUNTRY');
 assert.equal(parcelStatus(P({stage:4})),'DELIVERED');
 assert.equal(parcelStatus(P({stage:3,events:[{id:'1',label:'עדכון',time:ago(1)}],pickup:{place:'סופר פארם',address:'',code:'1',url:''}})),'READY_FOR_PICKUP');});

test('deduplication: the same event from two sources appears once',()=>{
 const a=T('RS1',[[ago(5),'Arrived at warehouse'],[ago(3),'Departed']]),b=T('RS1',[[ago(3),'Departed'],[ago(1),'Arrived in Israel']]);
 const c=combine(a,b)!;assert.equal(c.events.filter(e=>e.text==='Departed').length,1);assert.equal(c.events.length,3);});

test('package merging: the store mail and the courier mail with the same tracking number are one parcel',()=>{
 const store=P({id:'order:1',keys:['order:1','tracking:RS123IL'],order:'1',tracking:'RS123IL'});
 const post=P({id:'tracking:RS123IL',keys:['tracking:RS123IL'],tracking:'RS123IL',shop:'',name:'חבילה',stage:2,events:[{id:'p1',label:'הגיע לארץ',time:ago(3)}]});
 const m=mergeParcels([store,post]);assert.equal(m.length,1);assert.equal(m[0].stage,2);assert.ok(m[0].events.length>=2);});

test('tracking-number extraction from a courier SMS',()=>{
 const p=parseSms('דואר ישראל: דבר דואר RR123456789IL ממתין לך לאיסוף בסניף הרצל קוד 4821');
 assert.ok(p);assert.equal(p!.tracking,'RR123456789IL');});

test('transition detection and no duplicate notifications',()=>{
 const before=P({stage:1});const after=P({stage:2,events:[...before.events,{id:'e2',label:'הגיעה לארץ',time:ago(1)}]});
 const r1=diff({parcels:[before],stuck:[]},[after],now);assert.ok(r1.notes.some(n=>n.tag==='il:a'));
 const r2=diff({parcels:[after],stuck:[]},[after],now);assert.equal(r2.notes.length,0);});

test('new tracking number gets one notification; the shipped mail itself does not get two',()=>{
 const r=diff({parcels:[P({stage:1})],stuck:[]},[P({stage:1,tracking:'LP00123',events:[{id:'e1',label:'נשלחה',time:ago(48)},{id:'e2',label:'מספר מעקב',time:ago(1)}]})],now);
 assert.ok(r.notes.some(n=>n.tag==='tn:a'));
 const s=diff({parcels:[P({stage:0,events:[{id:'e0',label:'ההזמנה התקבלה',time:ago(30)}]})],stuck:[]},[P({stage:1,tracking:'LP00123',events:[{id:'e0',label:'ההזמנה התקבלה',time:ago(30)},{id:'e1',label:'נשלחה',time:ago(1)}]})],now);
 assert.ok(s.notes.some(n=>n.tag==='sh:a'));assert.ok(!s.notes.some(n=>n.tag==='tn:a'));});

test('trouble on the way notifies once per event',()=>{
 const b=P({stage:2});const a=P({stage:2,events:[...b.events,{id:'x1',label:'החבילה מוחזרת לשולח',time:ago(1)}]});
 const r=diff({parcels:[b],stuck:[]},[a],now);assert.ok(r.notes.some(n=>n.tag==='ex:a:x1'));
 assert.ok(!diff({parcels:[a],stuck:[]},[a],now).notes.some(n=>n.tag.startsWith('ex:')));});

test('delivered parcels: one notification, then quiet',()=>{
 const b=P({stage:3});const a=P({stage:4,events:[...b.events,{id:'d',label:'נמסרה',time:ago(1)}]});
 assert.ok(diff({parcels:[b],stuck:[]},[a],now).notes.some(n=>n.tag==='d:a'));
 const old=P({stage:4,events:[{id:'d',label:'נמסרה',time:ago(24*20)}]});
 assert.equal(diff({parcels:[old],stuck:[]},[old],now).notes.length,0);});

test('tracking providers: one failing provider does not stop the others',async()=>{
 const ok:TrackingProvider={name:'ok',limit:5,canTrack:()=>true,getTracking:async ns=>({tracks:Object.fromEntries(ns.map(n=>[n,T(n,[[ago(1),'Departed']])]))})};
 const bad:TrackingProvider={name:'bad',limit:5,canTrack:()=>true,getTracking:async()=>{throw new Error('down');}};
 const r=await trackSources(['RS1','RS2'],undefined,'',[bad,ok]);assert.deepEqual(Object.keys(r.tracks).sort(),['RS1','RS2']);});

test('push subscriptions: gone phones are dropped, a passing error keeps the phone',async()=>{
 const subs=[{endpoint:'gone'},{endpoint:'ok'},{endpoint:'flaky'}] as unknown as Sub[];
 const alive=await deliver(subs,{title:'x'},async s=>{const e=(s as unknown as {endpoint:string}).endpoint;if(e==='gone')return false;if(e==='flaky')throw new Error('timeout');return true;});
 assert.deepEqual(alive.map(s=>(s as unknown as {endpoint:string}).endpoint),['ok','flaky']);});
