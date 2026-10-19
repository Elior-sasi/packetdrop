import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn,smsUser} from '@/lib/push';
import {mergeParcels,type Parcel} from '@/lib/parcels';
import {pointKey} from '@/lib/pickup';
export const runtime='nodejs';export const dynamic='force-dynamic';
// "Near a pickup point" alerts. The phone (Shortcuts) asks with the personal link for parcels waiting at a point,
// each with the point's coordinates, and turns them into iPhone reminders that fire on arrival.
// Signed in: GET/POST the user's choices (all on/off, and points turned off - e.g. the one in their own building).
const H={'Cache-Control':'no-store'};
async function sql(){const d=db();await d.ready;
 await d.sql`create table if not exists point_prefs(user_id text primary key,enabled boolean not null default true,off jsonb not null default '[]')`;
 await d.sql`create table if not exists geo_points(k text primary key,lat double precision,lon double precision,at timestamptz not null default now())`;await d.sql`alter table geo_points add column if not exists city text`;
 await d.sql`create table if not exists point_sent(user_id text not null,parcel_id text not null,at timestamptz not null default now(),primary key(user_id,parcel_id))`;return d.sql;}
async function geocode(s:Awaited<ReturnType<typeof sql>>,k:string):Promise<{lat:number;lon:number;city:string}|null>{const c=(await s`select lat,lon,city from geo_points where k=${k}`)[0];if(c&&(c.city!=null||c.lat==null))return c.lat==null?null:{lat:c.lat as number,lon:c.lon as number,city:String(c.city||'')};
 let hit:{lat:string;lon:string;address?:{city?:string;town?:string;village?:string;suburb?:string}}|undefined;try{const r=await fetch('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:k,format:'json',limit:'1',countrycodes:'il','accept-language':'he',addressdetails:'1'}),{headers:{'User-Agent':'Unbox parcel tracker (packetdrop.vercel.app)'},signal:AbortSignal.timeout(8000)});hit=(await r.json())?.[0];}catch{return null;}
 const city=hit?.address?.city||hit?.address?.town||hit?.address?.village||'';
 await s`insert into geo_points(k,lat,lon,city) values(${k},${hit?+hit.lat:null},${hit?+hit.lon:null},${city}) on conflict(k) do update set lat=excluded.lat,lon=excluded.lon,city=excluded.city`;return hit?{lat:+hit.lat,lon:+hit.lon,city}:null;}
const waiting=(p:Parcel,marks:Record<string,string>)=>p.stage===3&&!p.cancelled&&!!p.pickup&&!!(p.pickup.place||p.pickup.address)&&!marks[p.id]&&!p.keys.some(k=>marks[k]);
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
 if(Array.isArray(b.cities)){const out:Record<string,string>={};for(const k of (b.cities as unknown[]).filter((x):x is string=>typeof x==='string'&&x.length>2&&x.length<300).slice(0,6)){const g=await geocode(s,k);out[k]=g?.city||'';}return Response.json({ok:true,cities:out},{headers:H});}
 const cur=(await s`select enabled,off from point_prefs where user_id=${me.id}`)[0]||{enabled:true,off:[]};
 let enabled=cur.enabled as boolean,off=new Set<string>(cur.off as string[]);
 if(typeof b.enabled==='boolean')enabled=b.enabled;if(typeof b.key==='string'&&b.key.length<300){if(b.off)off.add(b.key);else off.delete(b.key);}
 await s`insert into point_prefs(user_id,enabled,off) values(${me.id},${enabled},${JSON.stringify([...off])}) on conflict(user_id) do update set enabled=excluded.enabled,off=excluded.off`;
 return Response.json({ok:true,enabled,off:[...off]},{headers:H});}
