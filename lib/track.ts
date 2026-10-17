// 17TRACK carrier tracking (server side only; the key never reaches the browser).
export type TrackEvent={time:string;text:string;location:string};
export type TrackInfo={number:string;status:string;stage:number;carrier:string;eta:{from?:string;to?:string}|null;events:TrackEvent[];pending?:boolean};
const BASE='https://api.17track.net/track/v2.4';
// 17TRACK main statuses mapped onto the app's five steps (-1 = no step information).
export const STATUS_STAGE:Record<string,number>={InfoReceived:1,InTransit:2,AvailableForPickup:3,OutForDelivery:3,Delivered:4,DeliveryFailure:-1,Exception:-1,Expired:-1,NotFound:-1};
export const STATUS_HE:Record<string,string>={InfoReceived:'פרטי המשלוח נקלטו',InTransit:'בדרך',AvailableForPickup:'מוכנה לאיסוף',OutForDelivery:'יצאה למסירה',Delivered:'נמסרה',DeliveryFailure:'המסירה נכשלה',Exception:'בעיה במשלוח',Expired:'אין עדכונים זמן רב',NotFound:'עדיין אין מידע מחברת השילוח'};
type Raw={number:string;track_info?:{latest_status?:{status?:string};time_metrics?:{estimated_delivery_date?:{from?:string|null;to?:string|null}};tracking?:{providers?:{provider?:{name?:string};events?:{time_iso?:string;time_utc?:string;description?:string;description_translation?:{description?:string}|null;location?:string|null}[]}[]}}};
async function call(path:string,body:unknown,key:string){const r=await fetch(BASE+path,{method:'POST',headers:{'17token':key,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('TRACK_HTTP_'+r.status);return r.json();}
export function toInfo(a:Raw):TrackInfo{const t=a.track_info||{};const status=t.latest_status?.status||'NotFound';const providers=t.tracking?.providers||[];
 const events=providers.flatMap(p=>(p.events||[]).map(e=>({time:e.time_utc||e.time_iso||'',text:(e.description_translation?.description||e.description||'').trim(),location:(e.location||'').trim()}))).filter(e=>e.time&&e.text);
 const seen=new Set<string>();const uniq=events.filter(e=>{const k=e.time+e.text;if(seen.has(k))return false;seen.add(k);return true;}).sort((x,y)=>x.time.localeCompare(y.time));
 const ed=t.time_metrics?.estimated_delivery_date;
 return {number:a.number,status,stage:STATUS_STAGE[status]??-1,carrier:providers.at(-1)?.provider?.name||'',eta:ed&&(ed.from||ed.to)?{from:ed.from||undefined,to:ed.to||undefined}:null,events:uniq.slice(-40),pending:!t.latest_status};}
export async function track(numbers:string[],key:string){
 const list=[...new Set(numbers.map(n=>n.trim().toUpperCase()).filter(n=>/^[A-Z0-9-]{8,40}$/.test(n)))].slice(0,40);if(!list.length)return {};
 // Registering a number that is already registered is rejected (-18019901), so repeats do not use quota again.
 await call('/register',list.map(number=>({number,lang:'he'})),key).catch(()=>null);
 const d=await call('/gettrackinfo',list.map(number=>({number})),key);
 const out:Record<string,TrackInfo>={};for(const a of (d?.data?.accepted||[]) as Raw[])out[a.number]=toInfo(a);
 for(const n of list)if(!out[n])out[n]={number:n,status:'NotFound',stage:-1,carrier:'',eta:null,events:[],pending:true};
 return out;}
