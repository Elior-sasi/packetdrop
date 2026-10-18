import {NextRequest} from 'next/server';
import {db,dbOn,smsUser} from '@/lib/push';
import type {Parcel} from '@/lib/parcels';
export const dynamic='force-dynamic';
// Home-screen widget (Scriptable): a short summary from the notification server's copy. The personal link is the credential.
export async function GET(req:NextRequest){
 if(!dbOn())return Response.json({ok:false},{status:503});
 const user=smsUser(req.nextUrl.searchParams.get('t')||'','widget');if(!user)return Response.json({ok:false},{status:401});
 const {sql,ready}=db();await ready;const row=(await sql`select state,checked_at from push_users where user_id=${user}`)[0];
 const marks:Record<string,string>=row?.state?.marks||{};const now=Date.now();
 const list=((row?.state?.parcels||[]) as Parcel[]).filter(p=>!p.cancelled&&!marks[p.id]&&!p.keys.some(k=>marks[k])&&p.stage<4&&now-new Date(p.events.at(-1)?.time||0).getTime()<30*864e5);
 const pick=list.filter(p=>p.stage===3&&p.pickup);const generic=(n:string)=>/^(?:הזמנה|חבילה)/.test(n);
 return Response.json({ok:true,updated:row?.checked_at||null,transit:list.length-pick.length,pickup:pick.slice(0,3).map(p=>({name:generic(p.name)?(p.shop||'חבילה'):p.name.slice(0,28),place:p.pickup?.place||'',code:p.pickup?.code||''}))},{headers:{'Cache-Control':'no-store'}});}
