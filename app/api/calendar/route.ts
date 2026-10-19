import {NextRequest} from 'next/server';
import {db,dbOn,smsUser} from '@/lib/push';
import {liveParcels} from '@/lib/live';
import {mergeParcels,type Parcel} from '@/lib/parcels';
import {learn,estimate} from '@/lib/estimate';
import {pickupDeadline} from '@/lib/pickup';
export const dynamic='force-dynamic';
// Subscribed calendar (iPhone Calendar / Google Calendar "from URL"): expected arrival days and the last day to collect,
// kept up to date by the calendar app itself. The personal link (same as the widget's) is the credential.
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n').slice(0,500);
const fold=(l:string)=>{const out:string[]=[];let cur='';for(const ch of l){if(new TextEncoder().encode(cur+ch).length>73){out.push(cur);cur=' '+ch;}else cur+=ch;}out.push(cur);return out.join('\r\n');};
const ymd=(t:number)=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'}).replace(/-/g,'');
const plus=(t:number,d:number)=>t+d*864e5;
function etaRange(eta:string,now=Date.now()):[number,number]|null{const ds=[...eta.matchAll(/(\d{1,2})\.(\d{1,2})/g)].map(m=>{const y=new Date(now).getFullYear();let t=new Date(y,+m[2]-1,+m[1],12).getTime();if(t<now-120*864e5)t=new Date(y+1,+m[2]-1,+m[1],12).getTime();return t;});return ds.length?[ds[0],ds.at(-1)!]:null;}
export async function GET(req:NextRequest){const H={'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'no-store'};
 if(!dbOn())return new Response('',{status:503});const user=smsUser(req.nextUrl.searchParams.get('t')||'','widget');if(!user)return new Response('',{status:401});
 const {sql,ready}=db();await ready;const row=(await sql`select state from push_users where user_id=${user}`)[0];const st=(row?.state||{}) as {parcels?:Parcel[]};
 const {list,names}=liveParcels(row?.state||{});const all=mergeParcels(st.parcels||[]);const days=learn(all as never);
 let ae:Record<string,string>={};try{ae=Object.fromEntries((await sql`select order_no,eta from ae_eta where user_id=${user} and eta<>'' and at>now()-interval '10 days'`).map(r=>[r.order_no,r.eta as string]));}catch{}
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');const ev:string[][]=[];
 for(const p of list){if(p.ret)continue;const nm=(names[p.id]||p.name).slice(0,60);const uid=(p.id).replace(/[^\w]/g,'');
  if(p.stage===3&&p.pickup&&(p.pickup.place||p.pickup.address)){const dl=pickupDeadline(p);if(Number.isFinite(dl)){const where=[p.pickup.place,p.pickup.address].filter(Boolean).join(', ');
    ev.push(['UID:pk-'+uid+'@unbox','DTSTART;VALUE=DATE:'+ymd(dl),'DTEND;VALUE=DATE:'+ymd(plus(dl,1)),'SUMMARY:'+esc('אחרון לאיסוף: '+nm),'LOCATION:'+esc(where),'DESCRIPTION:'+esc([p.pickup.code&&'קוד איסוף: '+p.pickup.code,p.pickup.hours&&'שעות: '+p.pickup.hours].filter(Boolean).join('\n')),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+esc('אחרון לאיסוף: '+nm),'TRIGGER:PT9H','END:VALARM']);}continue;}
  if(p.stage>=3)continue;
  const eta=(p.order&&ae[p.order])||p.eta;let r=eta?etaRange(eta):null;let label='צפי';
  if(!r){const e=estimate(p as never,days);if(e&&!e.late){r=[e.from,e.to];label='הערכה';}}
  if(!r)continue;const [a,b]=r;ev.push(['UID:eta-'+uid+'@unbox','DTSTART;VALUE=DATE:'+ymd(a),'DTEND;VALUE=DATE:'+ymd(plus(b,1)),'SUMMARY:'+esc('📦 '+nm),'DESCRIPTION:'+esc(label+' '+(eta||'')+(p.shop?'\n'+p.shop:'')+(p.tracking?'\nמספר מעקב: '+p.tracking:''))]);}
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Unbox//HE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Unbox · חבילות','X-WR-TIMEZONE:Asia/Jerusalem','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H',
  ...ev.flatMap(e=>['BEGIN:VEVENT','DTSTAMP:'+stamp,'TRANSP:TRANSPARENT',...e,'END:VEVENT']),'END:VCALENDAR'];
 return new Response(lines.map(fold).join('\r\n')+'\r\n',{headers:H});}
