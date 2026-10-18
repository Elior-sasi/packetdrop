// Tapuz (Baldar) public status lookup: the same JSON call its tracking page makes. Israeli stores (Urbanica and others)
// ship with Tapuz and give no tracking number, but the page accepts the store's order number.
import type {TrackInfo,TrackEvent} from '@/lib/track';
// Courier companies running the Baldar system, all with the same public status call.
export const BALDAR:Record<string,string>={'crm.tapuzdelivery.co.il':'תפוז','focusdelivery.co.il':'פוקוס','pashoot-delivery.co.il':'פשוט משלוחים','manage.hafoz.co.il':'חפוז','portal.hafoz.co.il':'חפוז'};
export const baldarHost=(href:string)=>{const h=href.match(/^https?:\/\/([^/]+)\/baldar\//i)?.[1]?.toLowerCase();return h&&BALDAR[h]?h:'';};
export function tapuzStage(s:string){return /נמסר|נמסרה|delivered/i.test(s)?4:/לאיסוף|בנקודת|ממתין/i.test(s)?3:/יצא|בחלוקה|בדרך ללקוח|אצל השליח|שליח/i.test(s)?3:/נקלט|התקבל|במחסן|במיון|נאסף|בטיפול/i.test(s)?2:1;}
export function when(d:string,t:string){const m=d.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);if(!m)return '';const y=+m[3]<100?2000+ +m[3]:+m[3];const [h,mi]=(t.match(/(\d{1,2}):(\d{2})/)||[0,'12','00']).slice(1).map(Number);
 // Israel time; good enough for ordering events (±1h around DST)
 const dt=new Date(Date.UTC(y,+m[2]-1,+m[1],h-3,mi));return isNaN(+dt)?'':dt.toISOString();}
// Parses the page's reply: "num|…|date|status|receiver;…^~^{LogData:[…]}".
export function parseTapuz(d:string,key:string,carrier='תפוז'):TrackInfo|null{if(!d||d==='ERROR')return null;const [items,json]=d.split('^~^');
 const rows=(items||'').split(';').map(x=>x.split('|')).filter(a=>a.length>=4&&a[0].trim());if(!rows.length)return null;const last=rows[rows.length-1];
 const events:TrackEvent[]=[];try{const j=JSON.parse(json||'{}');for(const it of (j.LogData||[]) as {DateAdded?:string;TimeAdded?:string;Comments?:string|null}[]){const time=when(it.DateAdded||'',it.TimeAdded||'');const text=(it.Comments||'').trim();if(time&&text)events.push({time,text,location:''});}}catch{}
 if(!events.length){const time=when(last[2]||'',last[2]||'');if(time)events.push({time,text:last[3].trim(),location:''});}
 events.sort((a,b)=>a.time.localeCompare(b.time));
 const status=last[3].trim();const stage=Math.max(tapuzStage(status),...events.map(e=>/נמסר/.test(e.text)?4:0));
 return {number:key,status:stage===4?'Delivered':stage===3?'OutForDelivery':'InTransit',stage,carrier,eta:null,events};}
// key "TZ:<host>:<number>" (or "TZ:<number>" = Tapuz).
export async function tapuz(ref:string):Promise<TrackInfo|null>{
 const [host,num]=ref.includes(':')?ref.split(':'):['crm.tapuzdelivery.co.il',ref];if(!BALDAR[host]||!/^\d{5,14}$/.test(num))return null;
 const r=await fetch('https://'+host+'/Baldar/DeliveryStatus.aspx/GetStatus',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','User-Agent':'Mozilla/5.0','Referer':'https://'+host+'/Baldar/deliverystatus.aspx'},body:JSON.stringify({deliveryNumber:num,customerCode:-1}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!r.ok)return null;const j=await r.json().catch(()=>null) as {d?:string}|null;return parseTapuz(j?.d||'','TZ:'+ref,BALDAR[host]);}

// Search by the user's phone number (with their consent): every delivery this courier has for them, as parcels.
// The first column is the store's order number, so these join the order mails.
export function parseBaldarRows(d:string,host:string,now=Date.now()):import('@/lib/parcels').Parcel[]{if(!d||d==='ERROR')return [];const [items]=d.split('^~^');
 return (items||'').split(';').map(x=>x.split('|')).filter(a=>a.length>=4&&/^\d{4,14}$/.test(a[0].trim())).flatMap(a=>{const num=a[0].trim(),status=(a[3]||'').trim(),time=when(a[2]||'',a[2]||'');
  if(!time||now-new Date(time).getTime()>60*864e5)return [];const stage=tapuzStage(status);
  return [{id:'order:'+num,keys:['order:'+num],name:'חבילה',shop:'',carrier:BALDAR[host],image:'',url:'',tracking:'',order:num,eta:'',stage,cancelled:false,pickup:null,via:[host],events:[{id:'bd:'+host+':'+num+':'+stage,label:status||'עדכון מ'+BALDAR[host],time}]}];});}
export async function baldarByPhone(phone:string){const p=phone.replace(/\D/g,'');if(!/^0\d{8,9}$/.test(p))return [];
 const hosts=['crm.tapuzdelivery.co.il','focusdelivery.co.il','pashoot-delivery.co.il','manage.hafoz.co.il'];
 const res=await Promise.all(hosts.map(async h=>{try{const r=await fetch('https://'+h+'/Baldar/DeliveryStatus.aspx/GetStatus',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','User-Agent':'Mozilla/5.0','Referer':'https://'+h+'/Baldar/deliverystatus.aspx'},body:JSON.stringify({deliveryNumber:p,customerCode:-1}),signal:AbortSignal.timeout(12000),cache:'no-store'});if(!r.ok)return [];const j=await r.json().catch(()=>null) as {d?:string}|null;return parseBaldarRows(j?.d||'',h);}catch{return [];}}));
 return res.flat();}
// K Express (RunCom): shipment number + phone -> public status page. Best effort: the page is read for its status words.
export async function kexpress(ship:string,phone:string):Promise<TrackInfo|null>{const p=phone.replace(/\D/g,'');if(!/^[A-Z0-9-]{5,20}$/i.test(ship)||!/^0\d{8,9}$/.test(p))return null;
 const base='https://run10.kexpress.co.il/RunCom.Server/Request.aspx?';
 const a=await fetch(base+'APPNAME=RUN&PRGNAME=ship_locate_num_and_phone&ARGUMENTS=-N'+encodeURIComponent(ship)+',-A'+p,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!a.ok)return null;
 const xml=new TextDecoder('windows-1255').decode(await a.arrayBuffer());const rand=xml.match(/<ship_rand_num>\s*([^<\s]+)/i)?.[1];if(!rand)return null;
 const b=await fetch(base+'APPNAME=run&PRGNAME=ship_locate_random&ARGUMENTS=-A'+encodeURIComponent(rand),{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!b.ok)return null;
 return parseKexpress(new TextDecoder('windows-1255').decode(await b.arrayBuffer()),ship);}
export function parseKexpress(html:string,ship:string,now=new Date()):TrackInfo|null{
 const text=html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' | ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
 const lines=text.split('|').map(x=>x.trim()).filter(x=>x.length>2&&x.length<120);
 const status=lines.find(l=>/נמסר|יצא|בחלוקה|במחסן|נקלט|נאסף|בדרך|ממתין|לאיסוף/.test(l));if(!status)return null;
 const dm=text.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})(?:\s+(\d{1,2}:\d{2}))?/);const time=dm?when(dm[1],dm[2]||''):now.toISOString();
 const stage=tapuzStage(status);return {number:'KX:'+ship,status:stage===4?'Delivered':stage===3?'OutForDelivery':'InTransit',stage,carrier:'K Express',eta:null,events:[{time:time||now.toISOString(),text:status,location:''}]};}
