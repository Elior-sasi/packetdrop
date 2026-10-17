// Decides which phone notifications a change in parcels deserves. Pure, so it can be tested without Gmail.
import type {Parcel} from '@/lib/parcels';
import type {TrackInfo} from '@/lib/track';
export type Note={id:string;kind:'new'|'pickup'|'out'|'delivered'|'stuck';title:string;body:string;tag:string};
export type State={parcels:Parcel[];stuck:string[];marks?:Record<string,string>};
const DAY=864e5;
const PICKUP=/לאיסוף|איסוף|pick ?up|collection/i;
const OUT=/יצאה למסירה|בדרך למסירה|השליח בדרך|out for delivery/i;
const generic=(n:string)=>!n||/^(?:חבילה|הזמנה|משלוח|order|package)$/i.test(n.trim());
export const nameOf=(p:Parcel)=>generic(p.name)?(p.shop?'הזמנה מ־'+p.shop:'חבילה'):p.name;
const last=(p:Parcel)=>new Date(p.events.at(-1)?.time||0).getTime();
const latestLabel=(p:Parcel)=>p.events.at(-1)?.label||'';
function find(old:Parcel[],p:Parcel){return old.find(o=>o.keys.some(k=>p.keys.includes(k)));}
// Applies 17TRACK carrier status on top of what the mail says.
export function withTrack(p:Parcel,t?:TrackInfo):Parcel{
 if(!t||t.stage<0||t.stage<=p.stage)return p;
 const ev=t.events.at(-1);const label=t.status==='AvailableForPickup'?'מוכנה לאיסוף':t.status==='OutForDelivery'?'יצאה למסירה':t.status==='Delivered'?'נמסרה':(ev?.text||'');
 return {...p,stage:t.stage,events:[...p.events,{id:'t:'+t.number+':'+t.status,label,time:ev?.time||new Date().toISOString()}]};
}
export function diff(before:State,after:Parcel[],now=Date.now()):{notes:Note[];stuck:string[]}{
 const notes:Note[]=[];const stuck=new Set(before.stuck);
 const marked=(p:Parcel)=>p.keys.some(k=>before.marks?.[k])||!!before.marks?.[p.id];
 for(const p of after){
  if(p.cancelled||marked(p))continue;
  const o=find(before.parcels,p);const name=nameOf(p);const recent=now-last(p)<3*DAY;
  if(!o){
   if(!recent)continue;
   if(p.stage===4)notes.push({id:p.id,kind:'delivered',title:'החבילה נמסרה',body:name,tag:'d:'+p.id});
   else if(p.stage===3)notes.push(pickupOrOut(p,name));
   else notes.push({id:p.id,kind:'new',title:'הזמנה חדשה',body:name+(p.shop&&!name.includes(p.shop)?' · '+p.shop:''),tag:'n:'+p.id});
   continue;}
  if(p.stage>o.stage&&recent){
   if(p.stage===4)notes.push({id:p.id,kind:'delivered',title:'החבילה נמסרה',body:name,tag:'d:'+p.id});
   else if(p.stage===3)notes.push(pickupOrOut(p,name));}
  else if(p.stage===3&&o.stage===3&&!o.pickup?.code&&p.pickup?.code&&recent)notes.push(pickupOrOut(p,name));
 }
 // A parcel with no news for 10 days gets one heads-up; 30+ days counts as received, so it is left alone.
 for(const p of after){if(marked(p))continue;const age=now-last(p);
  if(p.stage<3&&!p.cancelled&&age>10*DAY&&age<30*DAY&&!stuck.has(p.id)){stuck.add(p.id);notes.push({id:p.id,kind:'stuck',title:'אין עדכון כבר 10 ימים',body:name10(p),tag:'s:'+p.id});}
  if(p.stage>=3)stuck.delete(p.id);}
 return {notes,stuck:[...stuck].slice(-300)};
}
const name10=(p:Parcel)=>nameOf(p)+(p.tracking?' · '+p.tracking:'');
function pickupOrOut(p:Parcel,name:string):Note{
 const isPickup=!!p.pickup?.place||PICKUP.test(latestLabel(p))&&!OUT.test(latestLabel(p));
 if(isPickup){const where=p.pickup?.place?' ב'+p.pickup.place:'';const code=p.pickup?.code?' · קוד '+p.pickup.code:'';
  return {id:p.id,kind:'pickup',title:'מוכנה לאיסוף'+where,body:name+code,tag:'p:'+p.id};}
 return {id:p.id,kind:'out',title:'יצאה למסירה היום',body:name,tag:'o:'+p.id};
}
