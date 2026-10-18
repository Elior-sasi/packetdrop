import {NextRequest} from 'next/server';
import {z} from 'zod';
import {pushIdentity} from '@/lib/identity';
import {vapid,seal,send,db,dbOn,type Sub} from '@/lib/push';
import {mergeParcels,type Parcel} from '@/lib/parcels';
export const dynamic='force-dynamic';
const H={'Cache-Control':'private, no-store'};
const sub=z.object({endpoint:z.string().url().max(1000),keys:z.object({p256dh:z.string().max(200),auth:z.string().max(100)})});
const body=z.object({subscription:sub.optional(),parcels:z.array(z.any()).max(400).optional(),test:z.boolean().optional(),remove:z.string().max(1000).optional(),marks:z.record(z.string().max(250),z.enum(['got','hide'])).optional(),view:z.object({at:z.string().max(40),active:z.array(z.object({keys:z.array(z.string().max(250)).max(30),name:z.string().max(200)})).max(200)}).optional()});
const keep=(list:Parcel[])=>list.filter(p=>p&&Array.isArray(p.keys)&&Array.isArray(p.events)&&Date.now()-new Date(p.events.at(-1)?.time||0).getTime()<180*864e5).slice(0,300);
export async function GET(){return Response.json({enabled:dbOn(),publicKey:dbOn()?vapid().publicKey:''},{headers:H});}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 if(!dbOn())return Response.json({error:'ההתראות עוד לא הוגדרו בשרת',code:'NO_DB'},{status:503,headers:H});
 try{const u=await pushIdentity(req);const b=body.parse(await req.json());const {sql,ready}=db();await ready;
  const rows=await sql`select subs,state from push_users where user_id=${u.id}`;const row=rows[0];
  let subs:Sub[]=row?.subs||[];const state=row?.state||{parcels:[],stuck:[]};
  if(b.remove)subs=subs.filter(s=>s.endpoint!==b.remove);
  if(b.subscription)subs=[b.subscription,...subs.filter(s=>s.endpoint!==b.subscription!.endpoint)].slice(0,5);
  // The phone's current list becomes the baseline, so things already seen in the app are not announced again.
  const parcels=b.parcels?keep(mergeParcels([...(state.parcels||[]),...keep(b.parcels as Parcel[])])):state.parcels||[];
  if(!row&&!b.subscription)return Response.json({ok:false},{headers:H});
  await sql`insert into push_users(user_id,email,refresh,subs,state,checked_at) values(${u.id},${u.email},${seal(u.refreshToken)},${JSON.stringify(subs)},${JSON.stringify({...state,parcels,marks:b.marks??state.marks??{},view:b.view??state.view})},now())
   on conflict(user_id) do update set email=excluded.email,refresh=excluded.refresh,subs=excluded.subs,state=excluded.state,updated_at=now()`;
  if(b.test||b.subscription){const target=b.subscription?[b.subscription]:subs;let ok=0;for(const s of target)if(await send(s,{title:'Unbox',body:b.subscription?'ההתראות פעילות ✓':'התראת בדיקה ✓',tag:'test',url:'/'}).catch(()=>false))ok++;
   if(!ok)return Response.json({error:'ההתראה לא נשלחה. נסה לכבות ולהפעיל שוב.'},{status:502,headers:H});}
  return Response.json({ok:true,devices:subs.length},{headers:H});
 }catch(e){const code=e instanceof Error?e.message:'';
  return Response.json({error:code==='RECONNECT'||code==='UNAUTHORIZED'?'צריך לחדש את הרשאת Google ואז להפעיל שוב.':code==='NO_GMAIL'?'צריך לאשר קריאת Gmail.':'לא ניתן להפעיל התראות כרגע. נסה שוב.',code},{status:400,headers:H});}}
