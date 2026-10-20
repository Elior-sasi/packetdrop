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
// One name per pickup point (place + address), used for the user's on/off choices.
export const pointKey=(pk:{place?:string;address?:string}|null|undefined)=>!pk?'':[pk.place,pk.address].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
// Google's weekly opening periods ({open:{day,hour,minute},close:{...}}, day 0 = Sunday) -> the same text as hoursText.
type GP={open?:{day:number;hour?:number;minute?:number};close?:{day:number;hour?:number;minute?:number}};
export function periodsText(periods:unknown,now=new Date()):string{if(!Array.isArray(periods)||!periods.length)return '';const ps=periods as GP[];
 if(ps.length===1&&ps[0].open&&!ps[0].close)return 'פתוח 24 שעות';
 const W=7*1440,t=now.getDay()*1440+now.getHours()*60+now.getMinutes();const at=(x:{day:number;hour?:number;minute?:number})=>x.day*1440+(x.hour||0)*60+(x.minute||0);
 const hm=(m:number)=>{m=((m%1440)+1440)%1440;return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');};
 for(const p of ps){if(!p.open||!p.close)continue;let a=at(p.open),b=at(p.close);if(b<=a)b+=W;for(const off of [0,-W])if(t>=a+off&&t<b+off)return 'פתוח עכשיו · עד '+hm(b);}
 // Closed: when it opens next (today, else the day).
 let best=Infinity;for(const p of ps){if(!p.open)continue;let a=at(p.open);if(a<=t)a+=W;if(a<best)best=a;}if(!Number.isFinite(best))return '';
 const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];const sameDay=Math.floor(best/1440)%7===now.getDay()&&best-t<1440;
 return 'סגור · נפתח '+(sameDay?'ב־'+hm(best):(best-t<2880&&Math.floor(best/1440)%7===(now.getDay()+1)%7?'מחר ב־'+hm(best):'ביום '+days[Math.floor(best/1440)%7]+' ב־'+hm(best)));}
// Minutes until the point closes, when it is open now (from Google's periods). null when closed or unknown.
export function minutesToClose(periods:unknown,now=new Date()):number|null{if(!Array.isArray(periods))return null;const W=7*1440,t=now.getDay()*1440+now.getHours()*60+now.getMinutes();
 const at=(x:{day:number;hour?:number;minute?:number})=>x.day*1440+(x.hour||0)*60+(x.minute||0);
 for(const p of periods as {open?:{day:number;hour?:number;minute?:number};close?:{day:number;hour?:number;minute?:number}}[]){if(!p.open||!p.close)continue;let a=at(p.open),b=at(p.close);if(b<=a)b+=W;for(const off of [0,-W])if(t>=a+off&&t<b+off)return b+off-t;}
 return null;}
