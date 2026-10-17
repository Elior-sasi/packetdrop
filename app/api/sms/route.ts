import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn,smsToken} from '@/lib/push';
export const dynamic='force-dynamic';
const H={'Cache-Control':'private, no-store'};
// The app picks up SMS that the Shortcut delivered, and shows the personal Shortcut link.
export async function GET(req:NextRequest){
 let id='';try{id=(await identity(req,false)).id;}catch{return Response.json({error:'unauthorized'},{status:401});}
 if(!dbOn())return Response.json({enabled:false,items:[]},{headers:H});
 const {sql,ready}=db();await ready;
 const rows=await sql`delete from sms_inbox where user_id=${id} returning text,created_at`;
 const seen=await sql`select k,v from push_meta where k like ${'smsin:'+id+':%'} order by v desc limit 1`;const last=seen[0]?{at:seen[0].v,kind:String(seen[0].k).split(':').pop()}:null;
 return Response.json({enabled:true,last,link:req.nextUrl.origin+'/api/sms/in?t='+smsToken(id),items:rows.map(r=>({text:r.text,at:r.created_at}))},{headers:H});}
