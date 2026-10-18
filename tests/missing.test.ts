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
