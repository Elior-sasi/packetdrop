import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn,smsUser} from '@/lib/push';
import {mergeParcels,type Parcel} from '@/lib/parcels';
import {pointKey,daysLeft} from '@/lib/pickup';
import {gemini} from '@/lib/gemini';
import {travelMinutes,planRound} from '@/lib/routes';
export const runtime='nodejs';export const dynamic='force-dynamic';
// "Near a pickup point" alerts. The phone (Shortcuts) asks with the personal link for parcels waiting at a point,
// each with the point's coordinates, and turns them into iPhone reminders that fire on arrival.
// Signed in: GET/POST the user's choices (all on/off, and points turned off - e.g. the one in their own building).
const H={'Cache-Control':'no-store'};
async function sql(){const d=db();await d.ready;
 await d.sql`create table if not exists point_prefs(user_id text primary key,enabled boolean not null default true,off jsonb not null default '[]')`;
 await d.sql`create table if not exists geo_points(k text primary key,lat double precision,lon double precision,at timestamptz not null default now())`;await d.sql`alter table geo_points add column if not exists city text, add column if not exists periods jsonb, add column if not exists phone text, add column if not exists src text`;
 await d.sql`create table if not exists travel_times(k text primary key,minutes int,at timestamptz not null default now())`;
 await d.sql`create table if not exists point_sent(user_id text not null,parcel_id text not null,at timestamptz not null default now(),primary key(user_id,parcel_id))`;return d.sql;}
type Geo={lat:number;lon:number;city:string;periods?:unknown;phone?:string};
async function geocode(s:Awaited<ReturnType<typeof sql>>,k0:string):Promise<Geo|null>{const k='v2|'+k0;const gk=process.env.GOOGLE_MAPS_KEY;const c=(await s`select lat,lon,city,periods,phone,src from geo_points where k=${k}`)[0];
 // A point found before Google was connected is looked up again once in Google (for its hours and phone).
 if(c&&(c.city!=null||c.lat==null)&&!(gk&&c.src!=='g'))return c.lat==null?null:{lat:c.lat as number,lon:c.lon as number,city:String(c.city||''),periods:c.periods||undefined,phone:c.phone||undefined};
 // Google Maps first when a key is set (it knows shop names); the free map otherwise.
 if(gk){try{const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':gk,'X-Goog-FieldMask':'places.location,places.addressComponents,places.regularOpeningHours.periods,places.nationalPhoneNumber'},body:JSON.stringify({textQuery:k0,languageCode:'he',regionCode:'IL',maxResultCount:1}),signal:AbortSignal.timeout(8000)});
  const pl=(await r.json())?.places?.[0];if(pl?.location){const city=String((pl.addressComponents||[]).find((c:{types?:string[]})=>c.types?.includes('locality'))?.longText||'');
   const periods=pl.regularOpeningHours?.periods||null;const phone=String(pl.nationalPhoneNumber||'');
   await s`insert into geo_points(k,lat,lon,city,periods,phone,src) values(${k},${pl.location.latitude},${pl.location.longitude},${city},${periods?JSON.stringify(periods):null},${phone},'g') on conflict(k) do update set lat=excluded.lat,lon=excluded.lon,city=excluded.city,periods=excluded.periods,phone=excluded.phone,src='g'`;return {lat:pl.location.latitude,lon:pl.location.longitude,city,periods:periods||undefined,phone:phone||undefined};}}catch{}
  if(c)return c.lat==null?null:{lat:c.lat as number,lon:c.lon as number,city:String(c.city||'')};}
 // A shop name alone ("סופר הקשתות") is often unknown to the map; then try without the first words, i.e. the street and town.
 let hit:{lat:string;lon:string;address?:{city?:string;town?:string;village?:string;suburb?:string}}|undefined;const words=k0.split(' ');
 const tries=[k0,...[1,2,3].map(n=>words.slice(n).join(' ')).filter(x=>x.length>3&&/\d|\s/.test(x))].filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
 for(const q of tries){try{const r=await fetch('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q,format:'json',limit:'1',countrycodes:'il','accept-language':'he',addressdetails:'1'}),{headers:{'User-Agent':'Unbox parcel tracker (packetdrop.vercel.app)'},signal:AbortSignal.timeout(8000)});hit=(await r.json())?.[0];}catch{return null;}if(hit)break;}
 let city=hit?.address?.city||hit?.address?.town||hit?.address?.village||'';
 // Not on the map by name: ask Google (through Gemini's Google Search) which town this pickup point is in.
 if(!city){try{const g=await gemini({contents:[{parts:[{text:`חפש בגוגל: נקודת איסוף חבילות או חנות בישראל בשם "${k0.slice(0,120)}". באיזו עיר או יישוב היא נמצאת? ענה רק בשם העיר בעברית, בלי שום מילה נוספת. אם לא מצאת, ענה: לא ידוע`}]}],tools:[{google_search:{}}],generationConfig:{temperature:0,maxOutputTokens:256}},20000);
  const a=g.ok?g.text.replace(/[."'\n]/g,' ').trim():'';if(a&&a.length<=25&&!/לא ידוע|unknown/i.test(a)&&/^[\u05D0-\u05EA\s\-־׳]+$/.test(a))city=a;}catch{}}
 await s`insert into geo_points(k,lat,lon,city,src) values(${k},${hit?+hit.lat:null},${hit?+hit.lon:null},${city},${gk?'g':'o'}) on conflict(k) do update set lat=excluded.lat,lon=excluded.lon,city=excluded.city,src=excluded.src`;return hit?{lat:+hit.lat,lon:+hit.lon,city}:null;}
// Still waiting: not marked received, and inside the time the point keeps it (an old one was most likely collected already).
const waiting=(p:Parcel,marks:Record<string,string>)=>p.stage===3&&!p.cancelled&&!!p.pickup&&!!(p.pickup.place||p.pickup.address)&&!marks[p.id]&&!p.keys.some(k=>marks[k])&&daysLeft(p)>=0;
export async function GET(req:NextRequest){if(!dbOn())return Response.json({ok:false},{status:503,headers:H});const s=await sql();const q=req.nextUrl.searchParams;
 const t=q.get('t');
 if(t){const user=smsUser(t,'widget');if(!user)return Response.json({ok:false},{status:401,headers:H});
  const pref=(await s`select enabled,off from point_prefs where user_id=${user}`)[0];if(pref&&!pref.enabled)return Response.json({ok:true,points:[]},{headers:H});
  const off=new Set<string>((pref?.off||[]) as string[]);
  const row=(await s`select state from push_users where user_id=${user}`)[0];const st=(row?.state||{}) as {parcels?:Parcel[];marks?:Record<string,string>;view?:{active?:{keys:string[];name:string}[]}};
  let list=mergeParcels(st.parcels||[]).filter(p=>waiting(p,st.marks||{})&&!off.has(pointKey(p.pickup!)));
  // ?new=1: only parcels not handed to the phone before (so each reminder is created once).
  if(q.get('new')){const sent=new Set((await s`select parcel_id from point_sent where user_id=${user}`).map(r=>r.parcel_id as string));list=list.filter(p=>!sent.has(p.id));}
  const out=[];for(const p of list.slice(0,8)){const k=pointKey(p.pickup!);const g=await geocode(s,k);if(!g)continue;
   const name=st.view?.active?.find(v=>v.keys.some(k2=>p.keys.includes(k2)))?.name||p.name.slice(0,40);
   out.push({id:p.id,title:'מחכה לך כאן: '+name+(p.pickup!.code?' · קוד '+p.pickup!.code:''),place:p.pickup!.place||p.pickup!.address,address:k,lat:g.lat,lon:g.lon});
   if(q.get('new'))await s`insert into point_sent(user_id,parcel_id) values(${user},${p.id}) on conflict do nothing`;}
  // Plain text lines for Shortcuts (one point per line) when asked.
  if(q.get('text'))return new Response(out.map(o=>o.title+'|'+o.address+'|'+o.lat+','+o.lon).join('\n'),{headers:{'Content-Type':'text/plain; charset=utf-8',...H}});
  return Response.json({ok:true,points:out},{headers:H});}
 let me:{id:string};try{me=await identity(req,false) as {id:string};}catch{return Response.json({ok:false},{status:401,headers:H});}
 const pref=(await s`select enabled,off from point_prefs where user_id=${me.id}`)[0];return Response.json({ok:true,enabled:pref?pref.enabled:true,off:pref?.off||[]},{headers:H});}
export async function POST(req:NextRequest){if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({ok:false},{status:403,headers:H});
 if(!dbOn())return Response.json({ok:false},{status:503,headers:H});let me:{id:string};try{me=await identity(req,false) as {id:string};}catch{return Response.json({ok:false},{status:401,headers:H});}
 const b=await req.json().catch(()=>({}));const s=await sql();
 // Cities for the settings list (looked up once per point, a few at a time - OpenStreetMap asks for gentle use).
 // Point details for the app: town, opening hours (Google's weekly periods), phone, coordinates.
 if(Array.isArray(b.cities)){const out:Record<string,string>={};const info:Record<string,Geo|null>={};for(const k of (b.cities as unknown[]).filter((x):x is string=>typeof x==='string'&&x.length>2&&x.length<300).slice(0,6)){const g=await geocode(s,k);out[k]=g?.city||'';info[k]=g;}return Response.json({ok:true,cities:out,info},{headers:H});}
 // Travel time from home to each point (Google Routes): walking, driving or public transport.
 if(b.travel&&typeof b.travel.home==='string'&&b.travel.home.length>4){if(!process.env.GOOGLE_MAPS_KEY)return Response.json({ok:false,why:'no key'},{headers:H});
  const mode=String(b.travel.mode);const home=String(b.travel.home).slice(0,200);const out:Record<string,number|null>={};
  for(const p of (Array.isArray(b.travel.points)?b.travel.points:[]).slice(0,6) as {k?:unknown;lat?:unknown;lon?:unknown}[]){if(typeof p.k!=='string'||typeof p.lat!=='number'||typeof p.lon!=='number')continue;out[p.k]=await travelMinutes(s,home,mode,p.lat,p.lon);}
  return Response.json({ok:true,minutes:out,mode},{headers:H});}
 // One pickup round through several points: best order and total minutes.
 if(b.plan&&typeof b.plan.home==='string'){const pts=(Array.isArray(b.plan.points)?b.plan.points:[]).filter((p:{lat?:unknown;lon?:unknown})=>typeof p?.lat==='number'&&typeof p?.lon==='number').slice(0,8);
  return Response.json({ok:true,plan:await planRound(String(b.plan.home).slice(0,200),String(b.plan.mode),pts)},{headers:H});}
 // Home address and travel mode, kept on the server for the "time to leave" notification.
 if(typeof b.home==='string'||typeof b.mode==='string'){await s`alter table point_prefs add column if not exists home text, add column if not exists mode text`;
  await s`insert into point_prefs(user_id,home,mode) values(${me.id},${typeof b.home==='string'?b.home.slice(0,200):null},${typeof b.mode==='string'?b.mode.slice(0,10):null}) on conflict(user_id) do update set home=coalesce(excluded.home,point_prefs.home),mode=coalesce(excluded.mode,point_prefs.mode)`;
  return Response.json({ok:true},{headers:H});}
 const cur=(await s`select enabled,off from point_prefs where user_id=${me.id}`)[0]||{enabled:true,off:[]};
 let enabled=cur.enabled as boolean,off=new Set<string>(cur.off as string[]);
 if(typeof b.enabled==='boolean')enabled=b.enabled;if(typeof b.key==='string'&&b.key.length<300){if(b.off)off.add(b.key);else off.delete(b.key);}
 await s`insert into point_prefs(user_id,enabled,off) values(${me.id},${enabled},${JSON.stringify([...off])}) on conflict(user_id) do update set enabled=excluded.enabled,off=excluded.off`;
 return Response.json({ok:true,enabled,off:[...off]},{headers:H});}
