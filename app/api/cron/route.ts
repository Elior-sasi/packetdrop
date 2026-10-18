import {GOOGLE_CLIENT_ID} from '@/lib/google';
import {QUERY,gmailClient} from '@/lib/gmail';
import {parseMessage,mergeParcels,type Parcel,type Message} from '@/lib/parcels';
import {trackAll} from '@/lib/track';
import {diff,withTrack,reminders,weekly,type State} from '@/lib/notify';
import {open,send,db,dbOn,type Sub} from '@/lib/push';
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
 for(const u of users){try{out.push(await check(u as Row,sql));}catch(e){out.push({sent:0,error:e instanceof Error?e.message:'error'});}}
 return Response.json({ok:true,users:out.length,sent:out.reduce((a,b)=>a+b.sent,0),errors:out.filter(o=>o.error).length},{headers:{'Cache-Control':'no-store'}});
}
type Row={user_id:string;refresh:string;subs:Sub[];state:State;seen:string[];checked_at:string|null};
async function access(refresh:string){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_CLIENT_ID,client_secret:process.env.AUTH_GOOGLE_SECRET!,grant_type:'refresh_token',refresh_token:open(refresh)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('RECONNECT');return String((await r.json()).access_token);}
async function check(u:Row,sql:ReturnType<typeof db>['sql']){
 const gmail=gmailClient(await access(u.refresh));
 const since=Math.floor((u.checked_at?new Date(u.checked_at).getTime()-2*3600e3:Date.now()-2*864e5)/1000);
 const list=await gmail('messages?'+new URLSearchParams({maxResults:'100',q:'after:'+since+' '+QUERY,fields:'messages/id'}));
 const seen=new Set(u.seen||[]);const ids=((list.messages||[]) as {id:string}[]).map(m=>m.id).filter(id=>!seen.has(id)).slice(0,60);
 const msgs:Message[]=[];for(let i=0;i<ids.length;i+=10){const got=await Promise.allSettled(ids.slice(i,i+10).map(id=>gmail('messages/'+encodeURIComponent(id)+'?format=full')));for(const g of got)if(g.status==='fulfilled')msgs.push(g.value);}
 const state:State={parcels:u.state?.parcels||[],stuck:u.state?.stuck||[],marks:u.state?.marks||{},reminded:u.state?.reminded||{},weekly:u.state?.weekly||''};
 let parcels=mergeParcels([...state.parcels,...msgs.map(parseMessage).filter((p):p is Parcel=>!!p)]);
 const numbers=parcels.filter(p=>p.tracking&&p.stage<4&&!p.cancelled).map(p=>p.tracking).slice(0,40);
 if(numbers.length){const t=await trackAll(numbers,process.env.TRACK17_KEY).catch(()=>({} as Awaited<ReturnType<typeof trackAll>>));parcels=parcels.map(p=>withTrack(p,t[p.tracking?.toUpperCase()]));}
 // With no baseline yet, the first check only records the current state.
 const {notes,stuck}=state.parcels.length?diff(state,parcels):{notes:[],stuck:state.stuck};
 const rem=reminders({...state,parcels});const wk=weekly({...state,parcels});const allNotes=[...notes,...rem.notes,...(wk.note?[wk.note]:[])];
 let subs=u.subs;let sent=0;
 const batch=allNotes.length>4?[{title:'Unbox',body:allNotes.length+' עדכונים חדשים בחבילות',tag:'many',url:'/'}]:allNotes.map(n=>({title:n.title,body:n.body,tag:n.tag,url:'/?p='+encodeURIComponent(n.id)}));
 for(const n of batch){const alive:Sub[]=[];for(const s of subs){const ok=await send(s,n).catch(()=>true);if(ok)alive.push(s);}subs=alive;sent++;}
 const keep=parcels.filter(p=>Date.now()-new Date(p.events.at(-1)?.time||0).getTime()<180*864e5).slice(0,300);
 const newSeen=[...seen,...msgs.map(m=>m.id)].slice(-1500);
 await sql`update push_users set state=${JSON.stringify({parcels:keep,stuck,marks:state.marks,reminded:rem.reminded,weekly:wk.week,view:(u.state as {view?:unknown})?.view})},seen=${JSON.stringify(newSeen)},subs=${JSON.stringify(subs)},checked_at=now() where user_id=${u.user_id}`;
 return {sent};
}
