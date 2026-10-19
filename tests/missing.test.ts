import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeParcels,type Parcel} from '../lib/parcels';
const base={shop:'AliExpress',carrier:'',image:'',url:'',eta:'',cancelled:false,pickup:null};
const order:Parcel={...base,id:'order:1',keys:['order:1'],name:'מכנסי קארגו לגברים + בגדי אנימה לגברים',items:['מכנסי קארגו לגברים כותנה','בגדי אנימה לגברים'],orderItems:{'1':['מכנסי קארגו לגברים כותנה','בגדי אנימה לגברים']},tracking:'',order:'1',stage:0,events:[{id:'o',label:'הזמנה',time:'2026-10-01T00:00:00Z'}]} as never;
const pkgA:Parcel={...base,id:'tracking:AP1',keys:['tracking:AP1','order:1'],name:'מכנסי קארגו לגברים כותנה',pkgItems:['מכנסי קארגו לגברים כותנה'],pkgByOrder:{'1':['מכנסי קארגו לגברים כותנה']},tracking:'AP1',order:'1',stage:3,events:[{id:'a',label:'נשלחה',time:'2026-10-05T00:00:00Z'}]} as never;
const pkgB:Parcel={...base,id:'tracking:AP2',keys:['tracking:AP2','order:1'],name:'בגדי אנימה לגברים',pkgItems:['בגדי אנימה לגברים'],pkgByOrder:{'1':['בגדי אנימה לגברים']},tracking:'AP2',order:'1',stage:2,events:[{id:'b',label:'נשלחה',time:'2026-10-07T00:00:00Z'}]} as never;
test('an item the package notice did not list is flagged, and stays flagged on re-merge',()=>{
 const m=mergeParcels([order,pkgA]);assert.equal(m.length,1);assert.deepEqual(m[0].missing,['בגדי אנימה לגברים']);
 const again=mergeParcels([...m]);assert.deepEqual(again[0].missing,['בגדי אנימה לגברים']);});
test('the flag clears when the item shows up in another package',()=>{
 const m=mergeParcels([...mergeParcels([order,pkgA]),pkgB]);assert.equal(m[0].missing,undefined);});
test('no flag when the shipping notice does not list contents',()=>{
 const m=mergeParcels([order,{...pkgA,pkgItems:undefined,pkgByOrder:undefined} as never]);assert.equal(m[0].missing,undefined);});
import {diff} from '../lib/notify';
test('one notification when the package arrives without an item',()=>{
 const now=Date.parse('2026-10-05T12:00:00Z');const before=mergeParcels([order,{...pkgA,stage:2} as never]);const after=mergeParcels([order,pkgA]);
 const n=diff({parcels:before,stuck:[]} as never,after,now).notes.filter(x=>x.tag.startsWith('mi:'));assert.equal(n.length,1);assert.equal(n[0].title,'בגדי אנימה לגברים לא היה בחבילה');
 assert.equal(diff({parcels:after,stuck:[]} as never,after,now).notes.filter(x=>x.tag.startsWith('mi:')).length,0);});
test('a single-product order is never flagged, even when the two mails name it differently',()=>{
 const o={...base,id:'order:2',keys:['order:2'],name:'עבור Logitech F710 USB Nano Dongle מקלט',orderItems:{'2':['עבור Logitech F710 USB Nano Dongle מקלט']},tracking:'',order:'2',stage:0,events:[{id:'o2',label:'הזמנה',time:'2026-10-01T00:00:00Z'}]};
 const k={...base,id:'tracking:RS1',keys:['tracking:RS1','order:2'],name:'מקלט אלחוטי USB',pkgItems:['מקלט אלחוטי USB'],pkgByOrder:{'2':['מקלט אלחוטי USB']},tracking:'RS1',order:'2',stage:2,events:[{id:'k2',label:'נשלחה',time:'2026-10-05T00:00:00Z'}]};
 assert.equal(mergeParcels([o,k] as never)[0].missing,undefined);});
test('an old wrong flag is dropped on the next merge',()=>{const stale={...pkgA,missing:['משהו']} as never;assert.equal(mergeParcels([stale])[0].missing,undefined);});
test('order-number placeholders never become product names in the title',()=>{
 const merged={...pkgA,id:'order:9',keys:['order:9','order:8','order:7','tracking:AP9'],name:'שקע + הזמנה …000008',items:['שקע','הזמנה …000008','הזמנה …000007'],pkgByOrder:undefined,pkgItems:undefined} as never;
 const m=mergeParcels([merged]);assert.ok(!/הזמנה …/.test(m[0].name),m[0].name);});
test('photos follow the product order when each order mail has one photo',()=>{
 const mk=(o:string,name:string,img:string,t:string)=>({...base,id:'order:'+o,keys:['order:'+o,'tracking:LP1'],name,image:'https://ae-pic-a1.aliexpress-media.com/kf/'+img+'.jpg',tracking:'',order:o,stage:2,events:[{id:o,label:'נשלחה',time:t}]});
 const m=mergeParcels([mk('3','פאה של סנג\'י','S3','2026-10-03T00:00:00Z'),mk('2','תחפושת זורו','S2','2026-10-02T00:00:00Z'),mk('1','חולצה של פרנקי','S1','2026-10-01T00:00:00Z')] as never);
 assert.deepEqual(m[0].images!.map(u=>u.match(/kf\/(\w+)/)![1]),m[0].items!.map(n=>n.includes('פרנקי')?'S1':n.includes('זורו')?'S2':'S3'));});
test('photos match products even when the two mails word the title differently',()=>{
 const mk=(o:string,name:string,img:string,t:string,extra={})=>({...base,id:'order:'+o,keys:['order:'+o,'tracking:GLS1'],name,image:'https://ae-pic-a1.aliexpress-media.com/kf/'+img+'.jpg',tracking:'',order:o,stage:2,events:[{id:o+t,label:'נשלחה',time:t}],...extra});
 const pkg={...base,id:'tracking:GLS1',keys:['tracking:GLS1','order:1','order:2','order:3'],name:'One Piece כובע קש רשמי',items:['One Piece כובע קש רשמי','תושבת אחסון פשוטה לאוזניות','מרית מטבח 2 ב-1'],tracking:'GLS1',order:'',stage:3,events:[{id:'p',label:'יצאה',time:'2026-10-05T00:00:00Z'}]};
 const m=mergeParcels([mk('3','מרית מטבח','S3','2026-10-03T00:00:00Z'),mk('2','מעמד אוזניות - תושבת אחסון פשוטה לאוזניות שולחני','S2','2026-10-02T00:00:00Z'),mk('1','כובע קש One Piece בעיצוב רשמי','S1','2026-10-01T00:00:00Z'),pkg] as never);
 assert.deepEqual(m[0].images!.map(u=>u.match(/kf\/(\w+)/)![1]),['S1','S2','S3']);});
test('gallery order survives re-merging an already merged package',()=>{
 const mk=(o:string,name:string,img:string,t:string)=>({...base,id:'order:'+o,keys:['order:'+o,'tracking:LP2'],name,image:'https://ae-pic-a1.aliexpress-media.com/kf/'+img+'.jpg',tracking:'',order:o,stage:2,events:[{id:o+'x',label:'נשלחה',time:t}]});
 const once=mergeParcels([mk('3','מרית','S3','2026-10-03T00:00:00Z'),mk('2','מעמד אוזניות','S2','2026-10-02T00:00:00Z'),mk('1','כובע קש','S1','2026-10-01T00:00:00Z')] as never);
 const twice=mergeParcels(JSON.parse(JSON.stringify(once)));const ids=(p:{images?:string[]})=>p.images!.map(u=>u.match(/kf\/(\w+)/)![1]);
 assert.deepEqual(ids(twice[0]),ids(once[0]));assert.equal(ids(twice[0])[twice[0].items!.findIndex(n=>n.includes('כובע'))],'S1');});
