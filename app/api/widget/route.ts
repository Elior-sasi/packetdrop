import {NextRequest} from 'next/server';
import {db,dbOn,smsUser} from '@/lib/push';
import {liveParcels} from '@/lib/live';
import {lines,RENDER} from '@/lib/widget';
export const dynamic='force-dynamic';
// Home-screen widget (Scriptable): a short summary from the notification server's copy. The personal link is the credential.
// `lines` is what the widget draws, so later changes need no new script; `transit`/`pickup` stay for the first script.
export async function GET(req:NextRequest){
 // The drawing code itself, so the phone's tiny script never needs replacing again.
 if(req.nextUrl.searchParams.get('js'))return new Response(RENDER,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
 if(!dbOn())return Response.json({ok:false},{status:503});
 const user=smsUser(req.nextUrl.searchParams.get('t')||'','widget');if(!user)return Response.json({ok:false},{status:401});
 const {sql,ready}=db();await ready;const row=(await sql`select state,checked_at from push_users where user_id=${user}`)[0];
 const {list,names,when}=liveParcels(row?.state||{});
 const pick=list.filter(p=>p.stage===3&&p.pickup);const generic=(n:string)=>/^(?:הזמנה|חבילה)/.test(n);
 return Response.json({ok:true,updated:row?.checked_at||null,lines:lines(list,names,when),transit:list.length-pick.length,pickup:pick.slice(0,3).map(p=>({name:(names[p.id]||(generic(p.name)?(p.shop||'חבילה'):p.name)).slice(0,28),place:p.pickup?.place||'',code:p.pickup?.code||''}))},{headers:{'Cache-Control':'no-store'}});}
