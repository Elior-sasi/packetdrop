// Pickup point helpers shared by the app and the notification server.
import type {Parcel} from '@/lib/parcels';
const DAY=864e5;
// When the parcel reached the pickup point.
export const pickupSince=(p:Parcel)=>{const e=[...p.events].filter(e=>/לאיסוף|איסוף|pick ?up|collection/i.test(e.label)).sort((a,b)=>a.time.localeCompare(b.time))[0];return new Date((e||p.events.at(-1))?.time||0).getTime();};
// Last day to collect: the date the notice gives ("ניתן לאסוף עד 25.10"), else 14 days (Israel Post and most points).
export function pickupDeadline(p:Parcel,now=Date.now()):number{const u=p.pickup?.until?.match(/(\d{1,2})[./](\d{1,2})/);
 if(u){const y=new Date(now).getFullYear();let t=new Date(y,+u[2]-1,+u[1],23,59).getTime();if(t<now-60*DAY)t=new Date(y+1,+u[2]-1,+u[1],23,59).getTime();return t;}
 const s=pickupSince(p);return s?s+14*DAY:NaN;}
export const daysLeft=(p:Parcel,now=Date.now())=>{const d=pickupDeadline(p,now);if(!Number.isFinite(d))return NaN;const sod=(t:number)=>{const x=new Date(t);x.setHours(0,0,0,0);return x.getTime();};return Math.round((sod(d)-sod(now))/DAY);};
// Opening hours text ("א-ה 9:00-21:00, ו 9:00-14:00") -> today's state. null when the text can't be read.
const DAYS='אבגדהוש';
export function openNow(hours:string,now=new Date()):{open:boolean;until?:string;opens?:string;today?:string}|null{
 if(!hours)return null;const h=hours.replace(/[׳']/g,'').replace(/–/g,'-').replace(/יום\s*/g,'').replace(/שבת/g,'ש').replace(/שישי/g,'ו').replace(/מוצ"?ש/g,'ש');
 const parts=[...h.matchAll(/([אבגדהוש](?:\s*-\s*[אבגדהוש])?(?:\s*,\s*[אבגדהוש](?:\s*-\s*[אבגדהוש])?)*)\s*:?\s*((?:\d{1,2}(?::\d{2})?\s*-\s*\d{1,2}(?::\d{2})?\s*(?:,|ו|\/)?\s*)+)/g)];
 if(!parts.length){const t=[...h.matchAll(/(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)/g)];if(t.length!==1)return null;parts.push(['', 'אבגדהו'.split('').join(','), t[0][0]] as unknown as RegExpExecArray);}
 const dow=DAYS[now.getDay()];const mins=(s:string)=>{const [a,b]=s.split(':');return +a*60+(+b||0);};const fmt=(s:string)=>s.includes(':')?s:s+':00';
 let today:[string,string][]|null=null;
 for(const p of parts){const ds=new Set<string>();for(const g of p[1].split(',')){const [a,b]=g.split('-').map(x=>x.trim());if(!a)continue;const i=DAYS.indexOf(a),j=b?DAYS.indexOf(b):i;if(i<0||j<0)continue;for(let k=i;k<=j;k++)ds.add(DAYS[k]);}
  if(ds.has(dow))today=[...p[2].matchAll(/(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)/g)].map(m=>[fmt(m[1]),fmt(m[2])] as [string,string]);}
 if(!today)return {open:false,today:'סגור היום'};
 const m=now.getHours()*60+now.getMinutes();for(const [a,b] of today){if(m>=mins(a)&&m<mins(b))return {open:true,until:b};}
 const next=today.find(([a])=>mins(a)>m);return {open:false,...(next?{opens:next[0]}:{today:'סגור להיום'})};}
export const hoursText=(hours:string,now=new Date())=>{const o=openNow(hours,now);if(!o)return '';return o.open?'פתוח עכשיו · עד '+o.until:o.opens?'סגור · נפתח ב־'+o.opens:o.today||'';};
