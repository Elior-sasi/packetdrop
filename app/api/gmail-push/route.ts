import {NextRequest} from 'next/server';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
import {check,watch,noteError,type Row} from '@/lib/check';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Gmail → Google Pub/Sub → here, the moment new mail arrives, so notifications come in seconds instead of up to 30 minutes.
// The address carries a token derived from AUTH_SECRET, so no extra secret is needed and strangers cannot trigger checks.
const token=()=>createHmac('sha256',process.env.AUTH_SECRET||'').update('gmail-push').digest('base64url').slice(0,32);
// The signed-in owner gets the full address to paste into the Pub/Sub subscription.
export async function GET(req:NextRequest){try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401});}
 return Response.json({url:req.nextUrl.origin+'/api/gmail-push?t='+token(),topic:process.env.GMAIL_TOPIC||null},{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(req:NextRequest){
 const t=req.nextUrl.searchParams.get('t')||'';const want=token();
 if(t.length!==want.length||!timingSafeEqual(Buffer.from(t),Buffer.from(want)))return new Response(null,{status:403});
 if(!dbOn())return new Response(null,{status:204});
 let email='';try{const b=await req.json();email=String(JSON.parse(Buffer.from(b?.message?.data||'','base64').toString('utf8'))?.emailAddress||'').toLowerCase();}catch{}
 const {sql,ready}=db();await ready;
 // Last push seen (for the check page), even before knowing whose mail it was.
 await sql`insert into push_meta(k,v) values('gpush-any',now()) on conflict(k) do update set v=now()`.catch(()=>{});
 if(!email)return new Response(null,{status:204});
 const u=(await sql`select user_id,refresh,subs,state,seen,checked_at from push_users where lower(email)=${email} and jsonb_array_length(subs)>0 limit 1`)[0] as Row|undefined;
 if(!u)return new Response(null,{status:204});
 // Several pushes can arrive for one mail; one check per 20 seconds is enough.
 const k='gpush:'+u.user_id;const last=(await sql`select v from push_meta where k=${k}`)[0]?.v;
 if(last&&Date.now()-new Date(last).getTime()<20000)return new Response(null,{status:204});
 await sql`insert into push_meta(k,v) values(${k},now()) on conflict(k) do update set v=now()`;
 try{await check(u,sql);await watch(u,sql);}catch(e){await noteError(u.user_id,e,sql);}
 return new Response(null,{status:204});}
