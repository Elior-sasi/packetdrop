import {NextRequest} from 'next/server';import {neon} from '@neondatabase/serverless';import {z} from 'zod';import {identity,driveIdentity} from '@/lib/identity';import {readBackup,writeBackup} from '@/lib/drive';
export const dynamic='force-dynamic';
const schema=z.object({key:z.string().min(1).max(250),title:z.string().trim().max(180)});
// Custom names live in Postgres when DATABASE_URL is set, otherwise in the user's Google Drive backup.
export async function GET(req:NextRequest){try{
 if(process.env.DATABASE_URL){const user=await identity(req,false);const sql=neon(process.env.DATABASE_URL);const rows=await sql`select parcel_key,title from parcel_titles where user_id=${user.id}`;return Response.json({titles:Object.fromEntries(rows.map(r=>[r.parcel_key,r.title])),storage:true},{headers:{'Cache-Control':'private, no-store'}});}
 try{const {accessToken}=await driveIdentity(req);const b=await readBackup(accessToken);return Response.json({titles:b.titles,storage:true},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({titles:{},storage:false},{headers:{'Cache-Control':'no-store'}});}
}catch{return Response.json({error:'לא ניתן לטעון שמות שמורים'},{status:401});}}
export async function POST(req:NextRequest){
 // Cookie-authenticated writes accept only this app's own Origin.
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 try{const {key,title}=schema.parse(await req.json());
  if(process.env.DATABASE_URL){const user=await identity(req,false);const sql=neon(process.env.DATABASE_URL);if(title)await sql`insert into parcel_titles(user_id,parcel_key,title) values(${user.id},${key},${title}) on conflict(user_id,parcel_key) do update set title=excluded.title,updated_at=now()`;else await sql`delete from parcel_titles where user_id=${user.id} and parcel_key=${key}`;}
  else{const {accessToken}=await driveIdentity(req);const b=await readBackup(accessToken);if(title)b.titles[key]=title;else delete b.titles[key];await writeBackup(accessToken,{...b,updated:new Date().toISOString()});}
  return Response.json({key,title},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error&&e.message==='NO_DRIVE'?'כדי לשמור שמות יש להפעיל גיבוי בענן במסך החשבון':'לא ניתן לשמור את השם. בדוק את החיבור ונסה שוב.'},{status:400});}}
