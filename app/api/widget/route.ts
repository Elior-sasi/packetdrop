import {NextRequest} from 'next/server';
import {db,dbOn,smsUser} from '@/lib/push';
import {liveParcels} from '@/lib/live';
import {lines,RENDER} from '@/lib/widget';
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
 return Response.json({ok:true,updated:row?.checked_at||null,lines:lines(list,names,when),transit:list.length-pick.length,pickup:pick.slice(0,3).map(p=>({name:(names[p.id]||(generic(p.name)?(p.shop||'חבילה'):p.name)).slice(0,28),place:p.pickup?.place||'',code:p.pickup?.code||''}))},{headers:{'Cache-Control':'no-store'}});}
