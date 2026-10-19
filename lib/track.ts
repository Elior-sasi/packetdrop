// 17TRACK carrier tracking (server side only; the key never reaches the browser).
// "ישראל,ירושלים,מחוז ירושלים" → "ירושלים": no country, no district that repeats the city, spaces after commas.
export function tidyPlace(raw:string){const parts=raw.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean).filter(x=>!/^(?:ישראל|israel|IL)$/i.test(x));
 const out:string[]=[];for(const x of parts){const bare=x.replace(/^(?:מחוז|district of)\s+/i,'').replace(/\s+(?:district|מחוז)$/i,'');if(out.some(o=>o===bare||o===x))continue;out.push(bare===x||!parts.includes(bare)?x:bare);}
 return [...new Set(out.map(x=>x.replace(/^מחוז\s+(.+)$/,(m,c)=>out.includes(c)?'':m)).filter(Boolean))].join(', ');}
export type TrackEvent={time:string;text:string;location:string};
export type TrackInfo={number:string;status:string;stage:number;carrier:string;eta:{from?:string;to?:string}|null;events:TrackEvent[];pending?:boolean};
import {tapuz,kexpress} from '@/lib/tapuz';
const BASE='https://api.17track.net/track/v2.4';
// 17TRACK main statuses mapped onto the app's five steps (-1 = no step information).
export const STATUS_STAGE:Record<string,number>={InfoReceived:1,InTransit:2,AvailableForPickup:3,OutForDelivery:3,Delivered:4,DeliveryFailure:-1,Exception:-1,Expired:-1,NotFound:-1};
export const STATUS_HE:Record<string,string>={InfoReceived:'פרטי המשלוח נקלטו',InTransit:'בדרך',AvailableForPickup:'מוכנה לאיסוף',OutForDelivery:'יצאה למסירה',Delivered:'נמסרה',DeliveryFailure:'המסירה נכשלה',Exception:'בעיה במשלוח',Expired:'אין עדכונים זמן רב',NotFound:'עדיין אין מידע מחברת השילוח'};
type Raw={number:string;track_info?:{latest_status?:{status?:string};time_metrics?:{estimated_delivery_date?:{from?:string|null;to?:string|null}};tracking?:{providers?:{provider?:{name?:string};events?:{time_iso?:string;time_utc?:string;description?:string;description_translation?:{description?:string}|null;location?:string|null}[]}[]}}};
async function call(path:string,body:unknown,key:string){const r=await fetch(BASE+path,{method:'POST',headers:{'17token':key,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('TRACK_HTTP_'+r.status);return r.json();}
// Carrier events usually arrive in English; common phrasings are translated here (no translation quota, no outside service).
const HE:[RegExp,string][]=[
 [/export (?:customs )?(?:clearance )?(?:complete|completed|success)|export clearance success/i,'עברה מכס יצוא'],
 [/export (?:customs )?(?:clearance )?(?:started|start|in progress)/i,'בבדיקת מכס יצוא'],
 [/processing at (?:the )?sorting (?:center|centre)/i,'בטיפול במרכז מיון'],
 [/processing (?:at|in) (?:the )?warehouse/i,'בטיפול במחסן'],
 [/last-?mile delivery forecast|delivery forecast/i,'נקבע מועד מסירה משוער'],
 [/^carrier update$/i,'עדכון מחברת השילוח'],
 [/^\s*(?:in )?processing\s*$/i,'בטיפול'],
 [/shipment information received by (?:the )?warehouse|order received successfully/i,'המחסן קיבל את פרטי ההזמנה'],
 [/ready for shipping|packed (?:at|in) (?:the )?warehouse|warehouse (?:processing|packed)|outbound (?:from |in )?(?:the )?warehouse.*ready/i,'נארזה במחסן ומוכנה למשלוח'],
 [/shipped out from (?:the )?warehouse|left (?:the )?warehouse|departed (?:from )?(?:the )?warehouse|outbound from (?:the )?warehouse/i,'יצאה מהמחסן'],
 [/arrived at (?:the )?warehouse|received (?:at|by) (?:the )?warehouse|inbound (?:at|in) (?:the )?warehouse/i,'הגיעה למחסן'],
 [/(?:departed|leaving|left|depart) (?:from )?(?:the )?departure country|(?:departed|left) (?:the )?(?:country|region) of origin|export (?:customs )?(?:clearance )?(?:completed|success)/i,'יצאה מארץ המוצא'],
 [/arrived at (?:the )?departure (?:transport )?(?:hub|center|centre|facility)|arrived at (?:the )?(?:origin|export) (?:hub|facility|center|centre)/i,'הגיעה למרכז השילוח בארץ המוצא'],
 [/arrived at (?:the )?line-?haul|line-?haul (?:office|arrival)|received by line-?haul/i,'הגיעה לחברת ההובלה הבינלאומית'],
 [/hand(?:ed)? over to (?:the )?line-?haul|line-?haul (?:departure|dispatched)/i,'נמסרה לחברת ההובלה הבינלאומית'],
 [/import customs clearance (?:started|in progress)|import clearance (?:started|in progress)/i,'בתהליך שחרור מהמכס'],
 [/import customs clearance (?:complete|completed|success)|customs released/i,'שוחררה מהמכס'],
 [/arrived at (?:the )?destination (?:country|region|transport hub|airport)|arrived in (?:the )?destination (?:country|region)/i,'הגיעה לארץ היעד'],
 [/(?:outbound|departed) (?:from |in )?(?:the )?sorting (?:center|centre)|left (?:the )?sorting (?:center|centre)/i,'יצאה ממרכז המיון'],
 [/(?:inbound|arrived) (?:in|at) (?:the )?sorting (?:center|centre)/i,'הגיעה למרכז מיון'],
 [/ready for (?:delivery|dispatch)|package (?:is )?ready to be delivered/i,'מוכנה למסירה'],
 [/accepted by (?:the )?carrier|carrier (?:has )?accepted/i,'נאספה על ידי חברת השילוח'],
 [/(?:seller|merchant) (?:has )?(?:shipped|sent)|package (?:has been )?shipped by (?:the )?seller/i,'המוכר שלח את החבילה'],
 [/(?:order|parcel|package) (?:information )?(?:received|created)|awaiting (?:the )?(?:carrier|pick ?up by carrier)/i,'פרטי המשלוח נקלטו אצל חברת השילוח'],
 [/delivery (?:attempt|failed|unsuccessful)|unable to deliver|failed (?:delivery )?attempt|addressee not available/i,'ניסיון מסירה לא הצליח'],
 [/return(?:ed)? to (?:sender|shipper)|being returned/i,'החבילה מוחזרת לשולח'],
 [/\bdelivered\b|delivery completed|signed (?:for|by)/i,'נמסרה'],
 [/out for delivery|with (?:the )?(?:courier|driver)|on (?:its|the) way to (?:you|recipient)/i,'יצאה למסירה'],
 [/(?:available|ready|awaiting) (?:for )?(?:pick ?up|collection)|arrived at (?:the )?(?:pick ?up|collection|parcel) (?:point|locker|station)|at pick-?up point/i,'מוכנה לאיסוף'],
 [/(?:released|cleared) (?:from|by) customs|customs clearance (?:completed|finished|successful)/i,'שוחררה מהמכס'],
 [/customs|import clearance/i,'בתהליך שחרור מהמכס'],
 [/(?:arrived|arrival) (?:at|in) (?:the )?destination (?:country|region)|arrived in (?:the )?(?:destination|israel)|inbound (?:in|into) (?:country|destination)/i,'הגיעה לארץ היעד'],
 [/(?:flight|airline) (?:arrived|landed)|arrived at (?:the )?(?:destination )?airport/i,'נחתה בארץ היעד'],
 [/(?:flight|airline) departed|handed (?:over )?to (?:the )?airline|departed (?:from )?(?:the )?airport|export (?:customs )?clear/i,'יצאה בטיסה'],
 [/(?:left|departed|departure from) (?:the )?(?:origin|country of origin|warehouse|sorting|facility|hub)|leaving (?:the )?origin/i,'יצאה ממרכז המיון'],
 [/(?:arrived|arrival) at (?:the )?(?:sorting|processing|distribution|transit)? ?(?:center|centre|facility|hub|warehouse)|processed at|sorting (?:center|centre)/i,'הגיעה למרכז מיון'],
 [/received by (?:the )?(?:local|last.?mile|domestic|delivery)(?: delivery| shipping)? (?:carrier|company|courier|partner)|handed (?:over )?to (?:the )?(?:local|last.?mile|delivery)/i,'הועברה לחברת המסירה המקומית'],
 [/received by|accepted by|picked up by|collected by|pick-?up (?:completed|successful)|parcel (?:collected|picked up)/i,'נאספה על ידי חברת השילוח'],
 [/shipping (?:information|info) received|electronic (?:information|notification)|order information received|label (?:created|printed)|shipment information|pre-?advice/i,'פרטי המשלוח נקלטו אצל חברת השילוח'],
 [/in transit|on the way|in progress/i,'בדרך'],
];
export function heEvent(text:string):string{const m=text?.match(/^\s*\[([^\]]{1,40})\]\s*(.+)$/);if(m){const t=heEvent(m[2]);return t===m[2]?text:t+' · '+m[1];}if(!text||/[֐-׿]/.test(text))return text;for(const [r,he] of HE)if(r.test(text))return he;return text;}
export function toInfo(a:Raw):TrackInfo{const t=a.track_info||{};const status=t.latest_status?.status||'NotFound';const providers=t.tracking?.providers||[];
 const events=providers.flatMap(p=>(p.events||[]).map(e=>({time:e.time_utc||e.time_iso||'',text:heEvent((e.description_translation?.description||e.description||'').trim()),location:tidyPlace(e.location||'')}))).filter(e=>e.time&&e.text);
 const seen=new Set<string>();const uniq=events.filter(e=>{const k=e.time+e.text;if(seen.has(k))return false;seen.add(k);return true;}).sort((x,y)=>x.time.localeCompare(y.time));
 const ed=t.time_metrics?.estimated_delivery_date;
 return {number:a.number,status,stage:STATUS_STAGE[status]??-1,carrier:providers.at(-1)?.provider?.name||'',eta:ed&&(ed.from||ed.to)?{from:ed.from||undefined,to:ed.to||undefined}:null,events:uniq.slice(-40),pending:!t.latest_status};}
// Carriers sometimes jump to "out for delivery" while the parcel is still in the origin country; trust step 3 only when the latest event says so.
const STEP3=/יצאה למסירה|מוכנה לאיסוף|ממתינה לאיסוף|out for delivery|ready for (?:pick ?up|collection)|available for pick|awaiting (?:pick ?up|collection)|with (?:the )?courier/i;
export function sane(t:TrackInfo):TrackInfo{if(t.stage!==3)return t;const last=t.events.at(-1);if(last&&STEP3.test(last.text))return t;return {...t,stage:t.events.length?2:-1,status:'InTransit'};}
export async function track(numbers:string[],key:string){
 const list=[...new Set(numbers.map(n=>n.trim().toUpperCase()).filter(n=>/^[A-Z0-9-]{8,40}$/.test(n)))].slice(0,40);if(!list.length)return {};
 // Registering a number that is already registered is rejected (-18019901), so repeats do not use quota again.
 await call('/register',list.map(number=>({number,lang:'he'})),key).catch(()=>null);
 const d=await call('/gettrackinfo',list.map(number=>({number})),key);
 const out:Record<string,TrackInfo>={};for(const a of (d?.data?.accepted||[]) as Raw[])out[a.number]=sane(toInfo(a));
 for(const n of list)if(!out[n])out[n]={number:n,status:'NotFound',stage:-1,carrier:'',eta:null,events:[],pending:true};
 return out;}
// Cainiao (AliExpress logistics) public tracking page data. Unofficial and best-effort: any failure just returns nothing.
type CnEvent={time?:number;timeStr?:string;desc?:string;standerdDesc?:string;actionCode?:string;group?:{nodeDesc?:string}};
type CnMod={mailNo?:string;status?:string;statusDesc?:string;detailList?:CnEvent[];globalEtaInfo?:{deliveryMinTime?:number;deliveryMaxTime?:number}};
export function cnStage(status:string,latest:string,action:string){const s=(status+' '+action).toUpperCase();
 if(/SIGN(?!.*FAIL)|DELIVERED/.test(s)||/\bdelivered\b|signed/i.test(latest))return 4;
 if(/WAIT_?4_?PICK|WAIT_?FOR_?PICK|READY_?FOR_?PICK|DELIVERING|OUT_?FOR_?DELIVERY/.test(s)||/out for delivery|ready for (?:pick ?up|collection)|available for pick/i.test(latest))return 3;
 if(/NOT_?FOUND|^\s*$/.test(s))return -1;return 2;}
export function fromCainiao(m:CnMod):TrackInfo|null{if(!m.mailNo)return null;
 const events=(m.detailList||[]).map(e=>({time:e.time?new Date(e.time).toISOString():'',text:heEvent((e.standerdDesc||e.desc||'').trim()),location:''})).filter(e=>e.time&&e.text).sort((a,b)=>a.time.localeCompare(b.time));
 if(!events.length)return null;const top=(m.detailList||[]).slice().sort((a,b)=>(b.time||0)-(a.time||0))[0]||{};
 const stage=cnStage(m.status||'',top.standerdDesc||top.desc||'',top.actionCode||'');const eta=m.globalEtaInfo;
 const status=stage===4?'Delivered':stage===3?(/pick/i.test(top.standerdDesc||top.desc||'')?'AvailableForPickup':'OutForDelivery'):'InTransit';
 return {number:m.mailNo.toUpperCase(),status,stage,carrier:'Cainiao',eta:eta?.deliveryMaxTime?{from:eta.deliveryMinTime?new Date(eta.deliveryMinTime).toISOString():undefined,to:new Date(eta.deliveryMaxTime).toISOString()}:null,events:events.slice(-40)};}
export type CnStatus='ok'|'blocked'|'none';
export async function cainiao(numbers:string[]):Promise<{tracks:Record<string,TrackInfo>;status:CnStatus}>{const out:Record<string,TrackInfo>={};let status:CnStatus='none';
 const list=[...new Set(numbers.map(n=>n.trim().toUpperCase()).filter(n=>/^[A-Z0-9]{8,40}$/.test(n)))].slice(0,40);
 for(let i=0;i<list.length;i+=10){try{const r=await fetch('https://global.cainiao.com/global/detail.json?'+new URLSearchParams({mailNos:list.slice(i,i+10).join(','),lang:'en-US'}),{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',Accept:'application/json',Referer:'https://global.cainiao.com/'},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok){if(status!=='ok')status='blocked';continue;}const d=await r.json().catch(()=>null);if(!d||!Array.isArray(d.module)){if(status!=='ok')status='blocked';continue;}status='ok';for(const m of (d?.module||[]) as CnMod[]){const t=fromCainiao(m);if(t)out[t.number]=sane(t);}}catch{if(status!=='ok')status='blocked';}}
 return {tracks:out,status};}
// Both sources together: the further-along status wins, and the event lists are combined.
export function combine(a?:TrackInfo,b?:TrackInfo):TrackInfo|undefined{if(!a||a.pending&&!a.events.length)return b||a;if(!b)return a;
 const seen=new Set<string>();const events=[...a.events,...b.events].sort((x,y)=>x.time.localeCompare(y.time)).filter(e=>{const k=e.time.slice(0,16)+e.text;if(seen.has(k))return false;seen.add(k);return true;}).slice(-40);
 const lead=b.stage>a.stage?b:a;return {...lead,carrier:a.carrier||b.carrier,eta:a.eta||b.eta,events,pending:false};}
export async function trackSources(all:string[],key?:string,phone=''){let ok17=!!key;
 // "TZ:<order>" = an Israeli store order looked up at Tapuz; everything else goes to 17TRACK / Cainiao.
 const tz=all.filter(n=>n.startsWith('TZ:')).slice(0,8);const kx=phone?all.filter(n=>n.startsWith('KX:')).slice(0,4):[];const numbers=all.filter(n=>!/^(?:TZ|KX):/.test(n));
 const [tzRes,kxRes]=await Promise.all([Promise.all(tz.map(n=>tapuz(n.slice(3)).catch(()=>null))),Promise.all(kx.map(n=>kexpress(n.slice(3),phone).catch(()=>null)))]);
 const [t17,c]=await Promise.all([key&&numbers.length?track(numbers,key).catch(()=>{ok17=false;return {} as Record<string,TrackInfo>;}):Promise.resolve({} as Record<string,TrackInfo>),numbers.length?cainiao(numbers):Promise.resolve({tracks:{} as Record<string,TrackInfo>,status:'idle'})]);const cn=c.tracks;
 const out:Record<string,TrackInfo>={};for(const n of new Set([...Object.keys(t17),...Object.keys(cn)])){const x=combine(t17[n],cn[n]);if(x)out[n]=x;}
 tz.forEach((n,i)=>{const t=tzRes[i];if(t)out[n]=t;});kx.forEach((n,i)=>{const t=kxRes[i];if(t)out[n]=t;});
 return {tracks:out,sources:{t17:ok17,cainiao:c.status}};}
export async function trackAll(numbers:string[],key?:string,phone=''){return (await trackSources(numbers,key,phone)).tracks;}
