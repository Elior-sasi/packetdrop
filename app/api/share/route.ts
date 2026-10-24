import {NextRequest} from 'next/server';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
import {SharedParcel,ready,alive} from '@/lib/share';
export const dynamic='force-dynamic';
const H={'Cache-Control':'private, no-store'};
const create=z.object({title:z.string().trim().max(40).default(''),pickup:z.boolean().default(false),parcels:z.array(SharedParcel).min(1).max(12)});
const update=z.object({update:z.array(z.object({token:z.string().max(40),parcels:z.array(SharedParcel).min(1).max(12)})).max(20)});
const fail=(msg:string,status=400)=>Response.json({error:msg},{status,headers:H});

// My open links (to refresh them and to cancel them).
export async function GET(req:NextRequest){
 if(!dbOn())return Response.json({shares:[]},{headers:H});
 try{const u=await identity(req,false);const {sql,ready:r}=db();await r;await ready(sql);
  const rows=await sql`select token,title,pickup,data,updated_at,revoked from shares where user_id=${u.id} and revoked=false order by created_at desc limit 20`;
  return Response.json({shares:rows.filter(x=>alive(x as never)).map(x=>({token:x.token,title:x.title,pickup:x.pickup,keys:(x.data as SharedParcel[]).map(p=>p.k),names:(x.data as SharedParcel[]).map(p=>p.name)}))},{headers:H});}
 catch{return fail('לא ניתן לטעון את הלינקים',401);}}

// New link, or fresh data for existing ones (the app sends what it shows whenever it updates).
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return fail('בקשה לא מורשית',403);
 if(!dbOn())return fail('השיתוף עוד לא הוגדר בשרת',503);
 try{const u=await identity(req,false);const body=await req.json();const {sql,ready:r}=db();await r;await ready(sql);
  if(body&&Array.isArray(body.update)){const {update:list}=update.parse(body);
   for(const x of list)await sql`update shares set data=${JSON.stringify(x.parcels)},updated_at=now() where token=${x.token} and user_id=${u.id} and revoked=false and data::text<>${JSON.stringify(x.parcels)}::jsonb::text`;
   return Response.json({ok:true},{headers:H});}
  const b=create.parse(body);const token=randomBytes(12).toString('base64url');
  const parcels=b.parcels.map(p=>b.pickup?p:{...p,pickup:undefined});
  await sql`insert into shares(token,user_id,title,pickup,data) values(${token},${u.id},${b.title},${b.pickup},${JSON.stringify(parcels)})`;
  return Response.json({token,url:req.nextUrl.origin+'/s/'+token},{headers:H});}
 catch{return fail('לא ניתן ליצור לינק. נסה שוב.');}}

// Cancel a link: it stops working at once.
export async function DELETE(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return fail('בקשה לא מורשית',403);
 try{const u=await identity(req,false);const t=req.nextUrl.searchParams.get('t')||'';const {sql,ready:r}=db();await r;await ready(sql);
  await sql`update shares set revoked=true,updated_at=now() where token=${t} and user_id=${u.id}`;return Response.json({ok:true},{headers:H});}
 catch{return fail('לא ניתן לבטל את הלינק');}}
