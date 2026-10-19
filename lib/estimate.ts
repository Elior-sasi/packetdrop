// Delivery estimates from the user's own past parcels (shared by the app and the server-side check page).
import type {Parcel as P} from '@/lib/parcels';
type Parcel=P&{stale?:boolean;got?:boolean;returned?:boolean};
export const SHIP_RE=/נשלח|יצאה מהמחסן|shipped|dispatched|נאספ/i;
const shippedAt=(p:Parcel)=>new Date((p.events.find(e=>SHIP_RE.test(e.label))||p.events[0])?.time||0).getTime();
const routeKey=(p:Parcel)=>p.shop+'|'+(p.carrier&&!/AliExpress|Cainiao/i.test(p.carrier)?p.carrier:'');
export type Est={from:number;to:number;n:number;avg:number;late:boolean;scope:'route'|'shop';stage:string};
// Milestones along the way; the estimate starts from the latest one the parcel has reached, using how long YOUR past parcels took from there.
const MILES:[string,RegExp][]=[['מהמשלוח',SHIP_RE],['מיציאה מארץ המוצא',/יצאה מארץ המוצא|יצאה בטיסה|נמסרה לחברת ההובלה|יצאה מאזור המוצא|בתעבורה/i],['מההגעה לישראל',/הגיעה לארץ|נחתה|הגיעה לחברת ההובלה|במדינה|באזור שלכם|הגיע לארץ/i],['מהשחרור ממכס',/שוחררה מהמכס/i],['מחברת המסירה',/חברת המסירה|חברת המשלוחים המקומית|המקומית/i]];
const mileAt=(p:Parcel,k:number)=>{if(k===0)return shippedAt(p);const e=p.events.find(e=>MILES[k][1].test(e.label));return e?new Date(e.time).getTime():0;};
export function learn(all:Parcel[]){const days:Record<string,number[]>={};
 for(const p of all){if(p.stage<4||p.cancelled||(p as {stale?:boolean}).stale||(p as {got?:boolean}).got||(p as {returned?:boolean}).returned)continue;const end=new Date(p.events.at(-1)!.time).getTime();
  MILES.forEach((_,k)=>{const t=mileAt(p,k);if(!t)return;const d=(end-t)/864e5;if(!(d>0.1&&d<90))return;for(const key of [routeKey(p),p.shop+'|*'])(days[key+'#'+k]??=[]).push(d);});}
 return days;}
export const pct=(a:number[],q:number)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.round(q*(s.length-1))))];};
// Israel Post and couriers do not deliver on Saturday.
const noSat=(t:number)=>{const d=new Date(t);return d.getDay()===6?t+864e5:t;};
export function estimate(p:Parcel,days:Record<string,number[]>):Est|null{if(p.stage>=4||p.cancelled||p.stage<1)return null;
 // At stage 3 only while the local courier still has it (not waiting at a pickup point or out for delivery today).
 if(p.stage===3&&(p.pickup||/לאיסוף|איסוף|יצאה למסירה|בדרך למסירה|השליח בדרך|out for delivery/i.test(p.events.at(-1)?.label||'')))return null;
 for(let k=MILES.length-1;k>=0;k--){const t0=mileAt(p,k);if(!t0)continue;
  let a=days[routeKey(p)+'#'+k],scope:'route'|'shop'='route';if(!a||a.length<3){a=days[p.shop+'|*#'+k];scope='shop';}if(!a||a.length<3)continue;
  const now=Date.now();let late=now>t0+pct(a,.9)*864e5+864e5;
  // Already past the usual time: use only your past parcels that also took at least this long from here (still a real range, not a guess).
  if(late){const waited=(now-t0)/864e5;const slow=a.filter(d=>d>=waited);if(slow.length>=3){a=slow;late=false;}}
  let from=t0+pct(a,.25)*864e5,to=t0+pct(a,.75)*864e5;
  if(from<now)from=now+864e5/2;if(to<from)to=from;return {from:noSat(from),to:noSat(to),n:a.length,avg:Math.round(a.reduce((x,y)=>x+y,0)/a.length),late,scope,stage:MILES[k][0]};}
 return null;}
// The store's delivery window is written when the parcel leaves China and is often far too cautious.
// YOUR past parcels from the same point on the way say better: if they say it comes sooner than the store's window ends, that wins.
let learnCache:{all:unknown[];days:Record<string,number[]>}|null=null;
export function freshEta<T extends Parcel>(p:T,all:T[]):T{if(!p.eta||p.stage>=4||p.cancelled)return p;const m=p.eta.match(/(\d{1,2})\.(\d{1,2})/);if(!m)return p;
 if(learnCache?.all!==all)learnCache={all,days:learn(all)};const e=estimate({...p,eta:''},learnCache.days);if(!e||e.late)return p;
 const y=new Date().getFullYear();let start=new Date(y,+m[2]-1,+m[1]).getTime();if(start<Date.now()-60*864e5)start=new Date(y+1,+m[2]-1,+m[1]).getTime();
 const em=p.eta.match(/-(\d{1,2})\.(\d{1,2})/);let end=em?new Date(y,+em[2]-1,+em[1]).getTime():start;if(end<start)end=new Date(y+1,+em![2]-1,+em![1]).getTime();
 return e.to<end?{...p,eta:''}:p;}
