import {db,dbOn} from '@/lib/push';
import {check,watch,type Row} from '@/lib/check';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Called on a schedule (GitHub Actions, every 30 minutes). It only checks for news and never returns mail data,
// so it needs no secret; a short cooldown keeps repeated calls cheap.
export async function GET(){
 if(!dbOn())return Response.json({ok:false,reason:'no-db'});
 const {sql,ready}=db();await ready;
 const last=(await sql`select v from push_meta where k='cron'`)[0]?.v;
 if(last&&Date.now()-new Date(last).getTime()<12*60000)return Response.json({ok:true,skipped:true});
 await sql`insert into push_meta(k,v) values('cron',now()) on conflict(k) do update set v=now()`;
 const users=await sql`select user_id,refresh,subs,state,seen,checked_at from push_users where jsonb_array_length(subs)>0 order by checked_at nulls first limit 40`;
 const out:{sent:number;error?:string}[]=[];
 for(const u of users){try{out.push(await check(u as Row,sql));await watch(u as Row,sql).catch(()=>{});}catch(e){const msg=e instanceof Error?(e.message+(e.stack?' @ '+(e.stack.split('\n')[1]||'').trim():'')):'error';out.push({sent:0,error:msg});}}
 return Response.json({ok:true,users:out.length,sent:out.reduce((a,b)=>a+b.sent,0),errors:out.filter(o=>o.error).length,why:[...new Set(out.filter(o=>o.error).map(o=>String(o.error).replace(/[A-Za-z0-9_\-]{24,}/g,'…').slice(0,140)))]},{headers:{'Cache-Control':'no-store'}});
}
