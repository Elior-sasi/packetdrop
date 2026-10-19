// One user's background check (new order/shipping mail, courier tracking, phone notifications).
// Shared by the 30-minute schedule and by Gmail's instant push.
import {GOOGLE_CLIENT_ID} from '@/lib/google';
import {QUERY,gmailClient,pdfInfo} from '@/lib/gmail';
import {parseMessage,mergeParcels,type Parcel,type Message} from '@/lib/parcels';
import {trackAll} from '@/lib/track';
import {baldarByPhone} from '@/lib/tapuz';
import {diff,withTrack,reminders,weekly,morning,nameOf,type State} from '@/lib/notify';
import {daysLeft,pointKey,minutesToClose} from '@/lib/pickup';
import {travelMinutes} from '@/lib/routes';
import {open,send,db,type Sub} from '@/lib/push';
import {prettyNames} from '@/lib/names';
export type Row={user_id:string;refresh:string;subs:Sub[];state:State;seen:string[];checked_at:string|null};
export async function access(refresh:string){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_CLIENT_ID,client_secret:process.env.AUTH_GOOGLE_SECRET!,grant_type:'refresh_token',refresh_token:open(refresh)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('RECONNECT');return String((await r.json()).access_token);}
export async function check(u:Row,sql:ReturnType<typeof db>['sql']){
 const gmail=gmailClient(await access(u.refresh));
 const since=Math.floor((u.checked_at?new Date(u.checked_at).getTime()-2*3600e3:Date.now()-2*864e5)/1000);
 const list=await gmail('messages?'+new URLSearchParams({maxResults:'100',q:'after:'+since+' '+QUERY,fields:'messages/id'}));
 const seen=new Set(u.seen||[]);const ids=((list.messages||[]) as {id:string}[]).map(m=>m.id).filter(id=>!seen.has(id)).slice(0,60);
 const msgs:Message[]=[];for(let i=0;i<ids.length;i+=10){const got=await Promise.allSettled(ids.slice(i,i+10).map(id=>gmail('messages/'+encodeURIComponent(id)+'?format=full')));for(const g of got)if(g.status==='fulfilled')msgs.push(g.value);}
 const state:State={parcels:u.state?.parcels||[],stuck:u.state?.stuck||[],marks:u.state?.marks||{},reminded:u.state?.reminded||{},weekly:u.state?.weekly||'',morning:u.state?.morning||''};
 const phone=String((u.state as {phone?:string})?.phone||'');
 const pdfs=await Promise.all(msgs.map(m=>pdfInfo(gmail,m as never).catch(()=>undefined)));
 let parcels=mergeParcels([...state.parcels,...msgs.map((m,i)=>parseMessage(m,pdfs[i])).filter((p):p is Parcel=>!!p),...(phone?await baldarByPhone(phone).catch(()=>[]):[])]);
 const numbers=[...parcels.filter(p=>p.tracking&&p.stage<4&&!p.cancelled).map(p=>p.tracking).slice(0,36),...(phone?parcels.filter(p=>p.tracking&&p.carrier==='K Express'&&p.stage<4&&!p.cancelled).map(p=>'KX:'+p.tracking).slice(0,4):[]),...parcels.filter(p=>!p.tracking&&p.order&&p.via?.length&&p.stage<4&&!p.cancelled&&Date.now()-new Date(p.events.at(-1)?.time||0).getTime()<45*864e5).flatMap(p=>p.via!.map(h=>'TZ:'+h+':'+p.order)).slice(0,6)];
 if(numbers.length){const t=await trackAll(numbers,process.env.TRACK17_KEY,phone).catch(()=>({} as Awaited<ReturnType<typeof trackAll>>));parcels=parcels.map(p=>withTrack(p,t[p.tracking?.toUpperCase()]||(p.tracking?t['KX:'+p.tracking]:undefined)||(!p.tracking&&p.order?(p.via||[]).map(h=>t['TZ:'+h+':'+p.order]).find(Boolean):undefined)));}
 // With no baseline yet, the first check only records the current state.
 const {notes,stuck}=state.parcels.length?diff(state,parcels):{notes:[],stuck:state.stuck};
 // Time to leave: a parcel waits at a point that closes within 1.5 hours (Google hours) - once a day per parcel, with the way from home.
 const leave:typeof notes=[];
 try{const pref=(await sql`select home,mode,enabled from point_prefs where user_id=${u.user_id}`)[0] as {home?:string;mode?:string;enabled?:boolean}|undefined;
  if(pref?.enabled!==false){const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});const il=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Jerusalem'}));
   for(const p of parcels){if(p.stage!==3||p.cancelled||!p.pickup||!(p.pickup.place||p.pickup.address)||state.marks![p.id]||p.keys.some(k=>state.marks![k])||daysLeft(p)<0)continue;
    const g=(await sql`select lat,lon,periods from geo_points where k=${'v2|'+pointKey(p.pickup)}`)[0];if(!g?.periods)continue;
    const left=minutesToClose(g.periods,il);if(left==null||left>90||left<15)continue;
    const tag='lv:'+p.id+':'+today;if((state.reminded![tag]||[]).length)continue;state.reminded![tag]=[1];
    const min=pref?.home&&g.lat!=null?await travelMinutes(sql,pref.home,pref.mode||'walk',g.lat,g.lon):null;const how=pref?.mode==='drive'?'נסיעה':pref?.mode==='transit'?'בתחבורה ציבורית':'הליכה';
    leave.push({id:p.id,kind:'pickup',title:(p.pickup.place||'נקודת האיסוף')+' נסגרת בעוד '+(left>=60?'שעה'+(left>=75?' וחצי':''):left+' דק׳'),body:nameOf(p)+(min?' · '+min+' דק׳ '+how+' מהבית':'')+(p.pickup.code?' · קוד '+p.pickup.code:''),tag});}}}catch{}
 notes.push(...leave);
 const rem=reminders({...state,parcels});const wk=weekly({...state,parcels});const mo=morning({...state,parcels});const allNotes=[...notes,...rem.notes,...(wk.note?[wk.note]:[]),...(mo.note?[mo.note]:[])];
 // Notifications use the same short Hebrew names the app shows, not the store's long title.
 if(allNotes.length){const ps=parcels.filter(p=>allNotes.some(n=>n.id===p.id)||(mo.note&&p.stage===3)).slice(0,30);const pretty=await prettyNames(ps,sql).catch(()=>new Map<string,string>());
  for(const n of allNotes)for(const p of (n.tag.startsWith('m:')?ps:ps.filter(x=>x.id===n.id))){const v=pretty.get(p.id);const old=nameOf(p);if(v&&old&&old!==v){n.body=n.body.split(old).join(v);n.title=n.title.split(old).join(v);}}}
 let subs=u.subs;let sent=0;
 const batch=allNotes.length>4?[{title:'Unbox',body:allNotes.length+' עדכונים חדשים בחבילות',tag:'many',url:'/'}]:allNotes.map(n=>({title:n.title,body:n.body,tag:n.tag,url:'/?p='+encodeURIComponent(n.id)}));
 for(const n of batch){const alive:Sub[]=[];for(const s of subs){const ok=await send(s,n).catch(()=>true);if(ok)alive.push(s);}subs=alive;sent++;}
 const keep=parcels.filter(p=>Date.now()-new Date(p.events.at(-1)?.time||0).getTime()<180*864e5).slice(0,300);
 const newSeen=[...seen,...msgs.map(m=>m.id)].slice(-1500);
 await sql`update push_users set state=${JSON.stringify({parcels:keep,stuck,marks:state.marks,reminded:rem.reminded,weekly:wk.week,morning:mo.day,view:(u.state as {view?:unknown})?.view,phone})},seen=${JSON.stringify(newSeen)},subs=${JSON.stringify(subs)},checked_at=now() where user_id=${u.user_id}`;
 return {sent};
}
// Gmail instant push: ask Gmail to tell our Pub/Sub topic about new mail. A watch lasts 7 days, so it is renewed every 6.
export async function watch(u:Row,sql:ReturnType<typeof db>['sql']){const topic=process.env.GMAIL_TOPIC;if(!topic)return;
 const k='watch:'+u.user_id;const last=(await sql`select v from push_meta where k=${k}`)[0]?.v;if(last&&Date.now()-new Date(last).getTime()<6*864e5)return;
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch',{method:'POST',headers:{Authorization:'Bearer '+await access(u.refresh),'Content-Type':'application/json'},body:JSON.stringify({topicName:topic,labelIds:['INBOX'],labelFilterBehavior:'include'}),signal:AbortSignal.timeout(15000)});
 if(r.ok)await sql`insert into push_meta(k,v) values(${k},now()) on conflict(k) do update set v=now()`;}
