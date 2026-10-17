import {NextRequest} from 'next/server';
import {db,dbOn,smsUser,send,type Sub} from '@/lib/push';
import {parseSms} from '@/lib/parcels';
export const dynamic='force-dynamic';
// Called by the iPhone Shortcut with the SMS text. The personal link is the only credential.
export async function POST(req:NextRequest){
 if(!dbOn())return Response.json({ok:false,error:'no-db'},{status:503});
 const user=smsUser(req.nextUrl.searchParams.get('t')||'');if(!user)return Response.json({ok:false,error:'bad link'},{status:401});
 let text='';const type=req.headers.get('content-type')||'';
 try{text=type.includes('json')?String((await req.json()).text||''):await req.text();}catch{}
 text=text.trim().slice(0,1500);if(text.length<8)return Response.json({ok:false,error:'empty'},{status:400});
 const p=parseSms(text);if(!p)return Response.json({ok:true,parcel:false});
 const {sql,ready}=db();await ready;
 const recent=await sql`select count(*)::int as n from sms_inbox where user_id=${user} and created_at>now()-interval '1 hour'`;if(recent[0].n>60)return Response.json({ok:false,error:'too many'},{status:429});
 await sql`insert into sms_inbox(user_id,text) values(${user},${text})`;
 // A pickup SMS also arrives as a notification right away, with the code.
 if(p.stage===3&&p.pickup){const rows=await sql`select subs from push_users where user_id=${user}`;const subs:Sub[]=rows[0]?.subs||[];
  for(const s of subs)await send(s,{title:'מוכנה לאיסוף'+(p.pickup.place?' ב'+p.pickup.place:''),body:(p.pickup.code?'קוד '+p.pickup.code+' · ':'')+p.tracking,tag:'sms:'+p.tracking,url:'/'}).catch(()=>false);}
 return Response.json({ok:true,parcel:true,tracking:p.tracking});}
