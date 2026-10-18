// Tapuz (Baldar) public status lookup: the same JSON call its tracking page makes. Israeli stores (Urbanica and others)
// ship with Tapuz and give no tracking number, but the page accepts the store's order number.
import type {TrackInfo,TrackEvent} from '@/lib/track';
// Courier companies running the Baldar system, all with the same public status call.
export const BALDAR:Record<string,string>={'crm.tapuzdelivery.co.il':'תפוז','focusdelivery.co.il':'פוקוס','pashoot-delivery.co.il':'פשוט משלוחים','manage.hafoz.co.il':'חפוז','portal.hafoz.co.il':'חפוז'};
export const baldarHost=(href:string)=>{const h=href.match(/^https?:\/\/([^/]+)\/baldar\//i)?.[1]?.toLowerCase();return h&&BALDAR[h]?h:'';};
export function tapuzStage(s:string){return /נמסר|נמסרה|delivered/i.test(s)?4:/לאיסוף|בנקודת|ממתין/i.test(s)?3:/יצא|בחלוקה|בדרך ללקוח|אצל השליח|שליח/i.test(s)?3:/נקלט|התקבל|במחסן|במיון|נאסף|בטיפול/i.test(s)?2:1;}
function when(d:string,t:string){const m=d.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);if(!m)return '';const y=+m[3]<100?2000+ +m[3]:+m[3];const [h,mi]=(t.match(/(\d{1,2}):(\d{2})/)||[0,'12','00']).slice(1).map(Number);
 // Israel time; good enough for ordering events (±1h around DST)
 const dt=new Date(Date.UTC(y,+m[2]-1,+m[1],h-3,mi));return isNaN(+dt)?'':dt.toISOString();}
// Parses the page's reply: "num|…|date|status|receiver;…^~^{LogData:[…]}".
export function parseTapuz(d:string,key:string,carrier='תפוז'):TrackInfo|null{if(!d||d==='ERROR')return null;const [items,json]=d.split('^~^');
 const rows=(items||'').split(';').map(x=>x.split('|')).filter(a=>a.length>=4&&a[0].trim());if(!rows.length)return null;const last=rows[rows.length-1];
 const events:TrackEvent[]=[];try{const j=JSON.parse(json||'{}');for(const it of (j.LogData||[]) as {DateAdded?:string;TimeAdded?:string;Comments?:string|null}[]){const time=when(it.DateAdded||'',it.TimeAdded||'');const text=(it.Comments||'').trim();if(time&&text)events.push({time,text,location:''});}}catch{}
 if(!events.length){const time=when(last[2]||'','');if(time)events.push({time,text:last[3].trim(),location:''});}
 events.sort((a,b)=>a.time.localeCompare(b.time));
 const status=last[3].trim();const stage=Math.max(tapuzStage(status),...events.map(e=>/נמסר/.test(e.text)?4:0));
 return {number:key,status:stage===4?'Delivered':stage===3?'OutForDelivery':'InTransit',stage,carrier,eta:null,events};}
// key "TZ:<host>:<number>" (or "TZ:<number>" = Tapuz).
export async function tapuz(ref:string):Promise<TrackInfo|null>{
 const [host,num]=ref.includes(':')?ref.split(':'):['crm.tapuzdelivery.co.il',ref];if(!BALDAR[host]||!/^\d{5,14}$/.test(num))return null;
 const r=await fetch('https://'+host+'/Baldar/DeliveryStatus.aspx/GetStatus',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','User-Agent':'Mozilla/5.0','Referer':'https://'+host+'/Baldar/deliverystatus.aspx'},body:JSON.stringify({deliveryNumber:num,customerCode:-1}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!r.ok)return null;const j=await r.json().catch(()=>null) as {d?:string}|null;return parseTapuz(j?.d||'','TZ:'+ref,BALDAR[host]);}
