import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {cainiao,track} from '@/lib/track';
import {gemini} from '@/lib/gemini';
import {db,dbOn} from '@/lib/push';
import {learn,estimate} from '@/lib/estimate';
import {mergeParcels,type Parcel} from '@/lib/parcels';
export const runtime='nodejs';
// Signed-in check that the Gemini key works (opened in the browser); never shows the key.
export async function GET(req:NextRequest){const H={'Cache-Control':'no-store'};
 let me:{id:string};try{me=await identity(req,false) as {id:string};}catch{return Response.json({ok:false,why:'לא מחובר'},{status:401,headers:H});}
 // ?eta=1: why each parcel on the way shows the date it does (from the notification server's copy of the parcels).
 if(req.nextUrl.searchParams.get('eta')&&dbOn()){const {sql,ready}=db();await ready;const row=(await sql`select state from push_users where user_id=${me.id}`)[0];
  const all=mergeParcels(((row?.state as {parcels?:Parcel[]})?.parcels)||[]);const days=learn(all as never);
  const counts=Object.fromEntries(Object.entries(days).map(([k,v])=>[k,v.length]));
  const live=all.filter(p=>p.stage<4&&!p.cancelled).slice(0,12).map(p=>{const e=estimate({...p,eta:''} as never,days);return {name:p.name.slice(0,30),shop:p.shop,carrier:p.carrier,stage:p.stage,eta:p.eta,last:p.events.at(-1)?.label?.slice(0,40),est:e?{from:new Date(e.from).toISOString().slice(0,10),to:new Date(e.to).toISOString().slice(0,10),n:e.n,late:e.late,from_point:e.stage}:null};});
  return Response.json({history:counts,live},{headers:H});}
 // ?track=NUMBER: what Cainiao (AliExpress's carrier system) says about it, including its delivery window.
 const n=(req.nextUrl.searchParams.get('track')||'').trim().toUpperCase();
 if(n){const c=await cainiao([n]).catch(()=>null);const t=c?.tracks[n];const key=process.env.TRACK17_KEY;const s17=key?await track([n],key).catch(e=>({err:String(e)}) as never):null;const t17=s17?(s17 as Record<string,{eta?:unknown;status?:string;pending?:boolean}>)[n]:null;
  return Response.json({cainiao:c?.status||'error',found:!!t,eta:t?.eta||null,t17key:!!key,t17:t17?{status:t17.status,eta:t17.eta||null,pending:!!t17.pending}:null},{headers:H});}
 // ?vision=1: the costume photo test (photo + store title), step by step.
 if(req.nextUrl.searchParams.get('vision')){const u='https://ae-pic-a1.aliexpress-media.com/kf/S09b8d11643714bde9ed1fea85895a021q.jpg';
  const img=await fetch(u,{signal:AbortSignal.timeout(8000)}).catch(e=>({ok:false,status:0,err:String(e)}) as never as Response);if(!img.ok)return Response.json({step:'image',status:img.status},{headers:H});
  const buf=Buffer.from(await img.arrayBuffer());const v=await gemini({contents:[{parts:[{inline_data:{mime_type:img.headers.get('content-type')?.split(';')[0]||'image/jpeg',data:buf.toString('base64')}},{text:'זו תמונה של מוצר. כותרת החנות: "תחפושת איש כריש לווייתן, גיבור ים". קבע מה המוצר וזהה את הדמות והסדרה אם אתה בטוח. כתוב שם קצר בעברית, 2 עד 6 מילים.'}]}],generationConfig:{temperature:0.2,maxOutputTokens:1024}},20000);
  return Response.json({step:'gemini',bytes:buf.length,type:img.headers.get('content-type'),ok:v.ok,status:v.status,answer:v.text,tried:v.tried},{headers:H});}
 const g=await gemini({contents:[{parts:[{text:'כתוב רק את המילה: עובד'}]}],generationConfig:{maxOutputTokens:512}},20000);
 return Response.json({ok:g.ok,status:g.status,answer:g.text||null,error:g.error||null},{headers:H});}
