import {NextRequest} from 'next/server';
import {db,dbOn,smsUser} from '@/lib/push';
import {liveParcels} from '@/lib/live';
import {lines,lock,RENDER} from '@/lib/widget';
import {pointKey,minutesToClose} from '@/lib/pickup';
import {aeWhen} from '@/lib/ae';
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
 // AliExpress's own dates (read on the phone) are fresher than the app's last view.
 try{const ae=await sql`select order_no,eta from ae_eta where user_id=${user} and eta<>'' and at>now()-interval '10 days'`;const m=Object.fromEntries(ae.map(r=>[r.order_no,r.eta as string]));
  for(const p of list)if(p.order&&m[p.order]){const w=aeWhen(m[p.order]);if(Number.isFinite(w))when[p.id]=w;}}catch{}
 const pick=list.filter(p=>p.stage===3&&p.pickup);const generic=(n:string)=>/^(?:הזמנה|חבילה)/.test(n);
 // Minutes until each waiting point closes (Google hours), for the red urgent line.
 const closeIn:Record<string,number>={};try{const il=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Jerusalem'}));for(const p of list){if(p.stage!==3||!p.pickup)continue;const g=(await sql`select periods from geo_points where k=${'v2|'+pointKey(p.pickup)}`)[0];const m=g?.periods?minutesToClose(g.periods,il):null;if(m!=null)closeIn[p.id]=m;}}catch{}
 const L=lines(list,names,when,Date.now(),closeIn);
 return Response.json({ok:true,updated:row?.checked_at||null,lines:L,lock:lock(L),transit:list.length-pick.length,pickup:pick.slice(0,3).map(p=>({name:(names[p.id]||(generic(p.name)?(p.shop||'חבילה'):p.name)).slice(0,28),place:p.pickup?.place||'',code:p.pickup?.code||''}))},{headers:{'Cache-Control':'no-store'}});}
