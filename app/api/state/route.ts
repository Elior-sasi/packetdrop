import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
export const dynamic='force-dynamic';
// What the background check (every 30 minutes) already read from Gmail, so the app does not read the same mail again.
export async function GET(req:NextRequest){const H={'Cache-Control':'private, no-store'};
 if(!dbOn())return Response.json({ok:false},{headers:H});
 try{const u=await identity(req,false);const {sql,ready}=db();await ready;const row=(await sql`select state,seen,checked_at from push_users where user_id=${u.id}`)[0];
  if(!row)return Response.json({ok:false},{headers:H});
  return Response.json({ok:true,parcels:row.state?.parcels||[],seen:row.seen||[],checkedAt:row.checked_at},{headers:H});
 }catch{return Response.json({ok:false},{status:401,headers:H});}}
