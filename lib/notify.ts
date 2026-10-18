// Decides which phone notifications a change in parcels deserves. Pure, so it can be tested without Gmail.
import type {Parcel} from '@/lib/parcels';
import type {TrackInfo} from '@/lib/track';
export type Note={id:string;kind:'new'|'pickup'|'out'|'delivered'|'stuck'|'guard';title:string;body:string;tag:string};
export type State={parcels:Parcel[];stuck:string[];marks?:Record<string,string>;reminded?:Record<string,number[]>;weekly?:string};
const DAY=864e5;
export const GUARD=/בהמתנה לאישור|תסומן בקרוב כהזמנה שהושלמה|will be marked as completed|confirm receipt/i;
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
  // AliExpress is about to close the order while the parcel has not arrived: last chance to open a dispute.
  if(p.stage<4&&p.events.some(e=>GUARD.test(e.label)&&now-new Date(e.time).getTime()<3*DAY&&!o.events.some(x=>x.id===e.id)))notes.push({id:p.id,kind:'guard',title:'ההזמנה תיסגר בקרוב והחבילה לא הגיעה',body:name+' · אפשר עדיין לפתוח מחלוקת ולקבל החזר',tag:'g:'+p.id});
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

// Pickup points send parcels back after about two weeks: nudge after 2 days, and again at day 10.
const waitingAtPickup=(p:Parcel)=>p.stage===3&&!p.cancelled&&(!!p.pickup?.place||/לאיסוף|איסוף|pick ?up|collection/i.test(latestLabel(p))&&!OUT.test(latestLabel(p)));
const pickupSince=(p:Parcel)=>{const e=[...p.events].find(e=>/לאיסוף|איסוף|pick ?up|collection/i.test(e.label));return new Date((e||p.events.at(-1))?.time||0).getTime();};
export function reminders(state:State,now=Date.now()):{notes:Note[];reminded:Record<string,number[]>}{
 const reminded={...(state.reminded||{})};const notes:Note[]=[];const marks=state.marks||{};
 for(const p of state.parcels){if(!waitingAtPickup(p)||p.keys.some(k=>marks[k])||marks[p.id])continue;
  const days=Math.floor((now-pickupSince(p))/DAY);const done=reminded[p.id]||[];const where=p.pickup?.place?' ב'+p.pickup.place:'';const code=p.pickup?.code?' · קוד '+p.pickup.code:'';
  for(const d of [2,10])if(days>=d&&days<16&&!done.includes(d)){reminded[p.id]=[...done,d];
   notes.push(d===2?{id:p.id,kind:'pickup',title:'מחכה לך'+where+' כבר יומיים',body:nameOf(p)+code,tag:'r2:'+p.id}:{id:p.id,kind:'pickup',title:'בקרוב החבילה חוזרת לשולח',body:nameOf(p)+where+code,tag:'r10:'+p.id});break;}}
 for(const id of Object.keys(reminded))if(!state.parcels.some(p=>p.id===id&&waitingAtPickup(p)))delete reminded[id];
 return {notes,reminded};}
// Sunday morning (Israel time) summary, once a week.
export function weekly(state:State,now=new Date()):{note:Note|null;week:string}{
 const il=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Jerusalem'}));const week=il.getFullYear()+'-'+Math.floor((il.getTime()-new Date(il.getFullYear(),0,1).getTime())/(7*DAY));
 if(il.getDay()!==0||il.getHours()<8||il.getHours()>=11||state.weekly===week)return {note:null,week:state.weekly||''};
 const marks=state.marks||{};const live=state.parcels.filter(p=>p.stage<4&&!p.cancelled&&!marks[p.id]&&!p.keys.some(k=>marks[k])&&now.getTime()-last(p)<30*DAY);
 const pick=live.filter(waitingAtPickup);if(!live.length)return {note:null,week};
 const body=[live.length-pick.length?(live.length-pick.length)+' בדרך':'',pick.length?pick.length+' מחכות לאיסוף'+(pick[0].pickup?.place?' ('+pick[0].pickup.place+')':''):''].filter(Boolean).join(' · ');
 return {note:{id:'weekly',kind:'new',title:'החבילות שלך השבוע',body,tag:'w:'+week},week};}
