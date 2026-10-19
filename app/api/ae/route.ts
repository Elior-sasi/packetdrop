import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn,smsUser,smsToken,send,type Sub} from '@/lib/push';
import {mergeParcels,type Parcel} from '@/lib/parcels';
import {aeEta,AE_JS,aeLoader,aeCloseDays,aeWhen} from '@/lib/ae';
export const runtime='nodejs';export const dynamic='force-dynamic';
// AliExpress delivery dates from the order page, read by a Scriptable script on the user's phone (signed in to AliExpress there).
// ?t=<personal link>: GET lists open AliExpress orders, POST sends one order page's text. Signed in: GET returns the dates and the phone script.
const H={'Cache-Control':'no-store'};
async function sql(){const d=db();await d.ready;await d.sql`create table if not exists ae_eta(user_id text not null,order_no text not null,eta text not null,raw text not null default '',at timestamptz not null default now(),primary key(user_id,order_no))`;await d.sql`alter table ae_eta add column if not exists items jsonb, add column if not exists close_at timestamptz, add column if not exists warned boolean not null default false`;return d.sql;}
export async function GET(req:NextRequest){const q=req.nextUrl.searchParams;
 if(q.get('js'))return new Response(AE_JS,{headers:{'Content-Type':'text/javascript; charset=utf-8',...H}});
 if(!dbOn())return Response.json({ok:false},{status:503,headers:H});const s=await sql();
 const t=q.get('t');
 if(t){const user=smsUser(t,'widget');if(!user)return Response.json({ok:false},{status:401,headers:H});
  const row=(await s`select state from push_users where user_id=${user}`)[0];const all=mergeParcels(((row?.state as {parcels?:Parcel[]})?.parcels)||[]);
  const orders=[...new Set(all.filter(p=>/aliexpress/i.test(p.shop)&&p.stage<4&&!p.cancelled&&/^\d{12,20}$/.test(p.order||'')).map(p=>p.order))];
  return Response.json({ok:true,orders},{headers:H});}
 let me:{id:string};try{me=await identity(req,false) as {id:string};}catch{return Response.json({ok:false},{status:401,headers:H});}
 const rows=await s`select order_no,eta,raw,at,items,close_at from ae_eta where user_id=${me.id} and at>now()-interval '60 days'`;
 if(q.get('log')){const e=rows.find(x=>x.order_no==='error');return Response.json({log:e?.raw||'',at:e?.at||null},{headers:H});}
 const raw=q.get('raw');if(raw){const r=rows.find(x=>x.order_no===raw);return Response.json({order:raw,eta:r?.eta||'',at:r?.at||null,lines:String(r?.raw||'').split('\n').filter(l=>/\d/.test(l)).slice(0,80)},{headers:H});}
 const link=req.nextUrl.origin+'/api/ae?t='+smsToken(me.id,'widget');
 return Response.json({ok:true,etas:Object.fromEntries(rows.filter(r=>r.eta&&r.order_no!=='error').map(r=>[r.order_no,r.eta])),items:Object.fromEntries(rows.filter(r=>Array.isArray(r.items)&&r.items.length).map(r=>[r.order_no,r.items])),closes:Object.fromEntries(rows.filter(r=>r.close_at).map(r=>[r.order_no,new Date(r.close_at).getTime()])),error:rows.find(r=>r.order_no==='error')?.raw||'',checked:rows.length?rows.filter(r=>r.order_no!=='error').map(r=>new Date(r.at).getTime()).sort().at(-1):null,script:aeLoader(link)},{headers:H});}
export async function POST(req:NextRequest){if(!dbOn())return Response.json({ok:false},{status:503,headers:H});
 const user=smsUser(req.nextUrl.searchParams.get('t')||'','widget');if(!user)return Response.json({ok:false},{status:401,headers:H});
 const b=await req.json().catch(()=>({}));
 // The phone script reports a failed run (kept for the check page).
 if(b.error){const s=await sql();await s`insert into ae_eta(user_id,order_no,eta,raw) values(${user},'error','',${String(b.error).slice(0,300)+' · '+String(b.ctx||'')}) on conflict(user_id,order_no) do update set raw=case when ae_eta.at>now()-interval '10 minutes' then right(ae_eta.raw||E'\n'||excluded.raw,2000) else excluded.raw end,at=now()`;return Response.json({ok:true},{headers:H});}
 const order=String(b.order||'');const text=String(b.text||'').slice(0,30000);
 if(!/^\d{12,20}$/.test(order)||!text)return Response.json({ok:false},{status:400,headers:H});
 const eta=aeEta(text);const s=await sql();
 const items=(Array.isArray(b.items)?b.items:[]).filter((x:{img?:unknown;title?:unknown})=>typeof x?.img==='string'&&/^https:\/\//.test(x.img)).slice(0,8).map((x:{img:string;title?:unknown})=>({img:x.img.slice(0,400),title:String(x.title||'').slice(0,200)}));
 const days=aeCloseDays(text);const closeAt=days?new Date(Date.now()+days*864e5):null;
 const prev=(await s`select eta,warned from ae_eta where user_id=${user} and order_no=${order}`)[0];
 await s`insert into ae_eta(user_id,order_no,eta,raw,items,close_at) values(${user},${order},${eta},${text},${items.length?JSON.stringify(items):null},${closeAt}) on conflict(user_id,order_no) do update set eta=case when excluded.eta<>'' then excluded.eta else ae_eta.eta end,raw=excluded.raw,items=coalesce(excluded.items,ae_eta.items),close_at=coalesce(excluded.close_at,ae_eta.close_at),at=now()`;
 // Notifications: the date moved later, or AliExpress is about to close an order that has not arrived (last chance for a dispute).
 const notes:{title:string;body:string;tag:string}[]=[];
 const row=(await s`select state,subs from push_users where user_id=${user}`)[0];const all=mergeParcels(((row?.state as {parcels?:Parcel[]})?.parcels)||[]);
 const p=all.find(x=>x.order===order&&!x.cancelled);const view=(row?.state as {view?:{active?:{keys:string[];name:string}[]}})?.view;
 const name=(p&&view?.active?.find(v=>v.keys.some(k=>p.keys.includes(k)))?.name)||(p&&!/^(?:הזמנה|חבילה)/.test(p.name)?p.name.slice(0,40):'הזמנה מעליאקספרס');
 if(p&&p.stage<4&&eta&&prev?.eta&&prev.eta!==eta){const a=aeWhen(prev.eta),c=aeWhen(eta);if(c-a>864e5)notes.push({title:'הצפי נדחה ל־'+eta.split('-').pop(),body:name+' · עליאקספרס עדכנה את מועד ההגעה',tag:'ad:'+order+':'+eta});}
 if(p&&p.stage<3&&days&&days<=5&&!prev?.warned){notes.push({title:'ההזמנה תיסגר בעוד '+days+(days===1?' יום':' ימים'),body:name+' · החבילה עוד לא הגיעה. אפשר לפתוח מחלוקת לפני הסגירה',tag:'ac:'+order});await s`update ae_eta set warned=true where user_id=${user} and order_no=${order}`;}
 const subs=((row?.subs||[]) as Sub[]);for(const n of notes)for(const sub of subs)await send(sub,{...n,url:'/?p='+encodeURIComponent(p?.id||'')}).catch(()=>{});
 return Response.json({ok:true,eta},{headers:H});}
