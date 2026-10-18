import {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
// A calendar file for one parcel (pickup today, or the expected arrival day). The phone opens it as "add to calendar".
// Sent as a form post so the pickup code never appears in a URL.
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n').slice(0,500);
const fold=(l:string)=>{const out:string[]=[];let cur='';for(const ch of l){if(new TextEncoder().encode(cur+ch).length>73){out.push(cur);cur=' '+ch;}else cur+=ch;}out.push(cur);return out.join('\r\n');};
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return new Response('forbidden',{status:403});
 const f=await req.formData();const g=(k:string)=>String(f.get(k)||'').trim();
 const date=g('date');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return new Response('bad date',{status:400});
 const d=date.replace(/-/g,'');const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const end=next.toISOString().slice(0,10).replace(/-/g,'');
 const loc=[g('place'),g('address')].filter(Boolean).join(', ');
 const desc=[g('code')&&'קוד איסוף: '+g('code'),g('hours')&&'שעות: '+g('hours'),g('tracking')&&'מספר מעקב: '+g('tracking')].filter(Boolean).join('\n');
 const uid=d+'-'+(g('tracking')||g('title')).replace(/[^\w]/g,'').slice(0,40)+'@unbox';
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Unbox//HE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+end,'SUMMARY:'+esc(g('title')||'חבילה'),
  ...(loc?['LOCATION:'+esc(loc)]:[]),...(desc?['DESCRIPTION:'+esc(desc)]:[]),'TRANSP:TRANSPARENT',
  // A reminder at 9:00 on the day.
  'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+esc(g('title')||'חבילה'),'TRIGGER:PT9H','END:VALARM','END:VEVENT','END:VCALENDAR'];
 return new Response(lines.map(fold).join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="unbox.ics"','Cache-Control':'no-store'}});}
