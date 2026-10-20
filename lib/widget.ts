// What the home-screen widget shows, line by line (drawn by the Scriptable script).
import type {Parcel} from '@/lib/parcels';
export type Line={t:string;s:'big'|'title'|'mid'|'small';c:'white'|'teal'|'light'|'gray'|'red';n?:number};
import {daysLeft} from '@/lib/pickup';
const OUT=/יצאה למסירה|בדרך למסירה|השליח בדרך|out for delivery|בדרכו לכתובת|השליח יצור קשר/i;
const PICK=/לאיסוף|איסוף|pick ?up|collection/i;
const ilDay=(t:number)=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const isPick=(p:Parcel)=>p.stage===3&&(!!p.pickup?.place||PICK.test(p.events.at(-1)?.label||'')&&!OUT.test(p.events.at(-1)?.label||''));
const isOut=(p:Parcel,now:number)=>p.stage===3&&!isPick(p)&&p.events.some(e=>OUT.test(e.label)&&ilDay(new Date(e.time).getTime())===ilDay(now));
function whenText(t:number,now:number){const d=Math.round((new Date(ilDay(t)).getTime()-new Date(ilDay(now)).getTime())/864e5);
 if(d<=0)return 'היום';if(d===1)return 'מחר';if(d<7)return 'בעוד '+d+' ימים';const x=new Date(t);return x.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});}
// Same layout as the Unstage widget: one big coloured line (when / what to do), the product in bold white (up to 2 lines),
// one small grey line with the details. The large widget lists the other parcels under it.
const DAYS=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
function dayText(t:number,now:number){const d=Math.round((new Date(ilDay(t)).getTime()-new Date(ilDay(now)).getTime())/864e5);if(d<=0)return 'היום';if(d===1)return 'מחר';
 const x=new Date(new Date(t).toLocaleString('en-US',{timeZone:'Asia/Jerusalem'}));return 'יום '+DAYS[x.getDay()]+' '+x.getDate()+'.'+(x.getMonth()+1);}
export function lines(all:Parcel[],names:Record<string,string>,when:Record<string,number>,now=Date.now(),closeIn:Record<string,number>={}):Line[]{
 const list=all.filter(p=>!p.ret);const generic=(n:string)=>/^(?:הזמנה|חבילה)/.test(n);const nm=(p:Parcel)=>(names[p.id]||(generic(p.name)?(p.shop?'הזמנה מ־'+p.shop:'חבילה'):p.name)).slice(0,60);
 const out=list.filter(p=>isOut(p,now)),pick=list.filter(isPick),rest=list.filter(p=>!out.includes(p)&&!pick.includes(p)).sort((a,b)=>(when[a.id]||9e15)-(when[b.id]||9e15));
 const card=(head:string,c:Line['c'],p:Parcel|null,sub:string):Line[]=>[{t:head,s:'big',c},...(p?[{t:nm(p),s:'title' as const,c:'white' as const,n:2}]:[]),...(sub?[{t:sub,s:'small' as const,c:'gray' as const}]:[])];
 const where=(p:Parcel)=>[p.pickup?.code?'קוד '+p.pickup.code:'',p.pickup?.place||''].filter(Boolean).join(' · ');
 const others=(n:number)=>n>0?'עוד '+n+' בדרך':'';
 let L:Line[]=[];let top:Parcel|null=null;
 // Urgent first, in red: the last day to collect, or the point closes within 1.5 hours.
 for(const p of pick){const d=daysLeft(p,now),c=closeIn[p.id];const why=c!=null&&c<=90?(p.pickup?.place||'הנקודה')+' נסגרת בעוד '+(c>=60?'שעה':c+' דק׳'):d===0?'היום האחרון לאיסוף':d===1?'מחר היום האחרון לאיסוף':'';
  if(why){L=card(why,'red',p,where(p));top=p;break;}}
 if(!L.length&&out.length){top=out[0];L=card(out.length>1?out.length+' מגיעות היום':'מגיעה היום','teal',top,[top.shop,others(rest.length)].filter(Boolean).join(' · '));}
 if(!L.length&&pick.length){top=pick[0];L=card(pick.length>1?pick.length+' מחכות לאיסוף':'מחכה לאיסוף','teal',top,where(top));}
 if(!L.length){const next=rest.find(p=>when[p.id]);if(next){top=next;L=card(dayText(when[next.id],now),'teal',next,[next.shop,others(rest.length-1)].filter(Boolean).join(' · '));}}
 if(!L.length&&rest.length)L=card(rest.length+' בדרך','teal',null,'עוד אין מועד הגעה');
 if(!L.length)return [{t:'אין חבילות בדרך',s:'mid',c:'gray'}];
 // The rest, for the large widget (small and medium show only the card).
 for(const p of [...pick,...out,...rest].filter(p=>p!==top).slice(0,6))L.push({t:nm(p)+' · '+(pick.includes(p)?'לאיסוף'+(p.pickup?.code?' '+p.pickup.code:''):out.includes(p)?'היום':when[p.id]?dayText(when[p.id],now):'בדרך'),s:'small',c:'light'});
 return L;}

// Lock screen: one line under the clock, and up to 3 short lines in the rectangle.
export function lock(L:Line[]):{inline:string;rect:string[]}{const red=L.find(x=>x.c==='red');const code=L.find(x=>/^קוד /.test(x.t));
 const first=red?red.t:L[0]?.t||'';const inline=(code&&!red?code.t+' · '+(L.find(x=>x.s==='small'&&x!==code)?.t||''):first).slice(0,40);
 return {inline:'📦 '+inline,rect:L.slice(0,3).map(x=>x.t.slice(0,30))};}
// Runs inside Scriptable (fetched by the small script on the phone). `r` is this route's JSON.
// The logo stays where it always was (top left on the phone); texts follow the natural (right) side.
export const RENDER=`
const fam=config.widgetFamily||''
if(fam.startsWith('accessory')){const w=new ListWidget();w.url='https://packetdrop.vercel.app';const lk=(r&&r.lock)||{inline:'Unbox',rect:['Unbox']}
 if(fam==='accessoryInline'){const t=w.addText(lk.inline);t.font=Font.mediumSystemFont(13)}
 else if(fam==='accessoryCircular'){const n=w.addText(String((r&&r.transit)||0));n.font=Font.boldSystemFont(22);n.centerAlignText();const s=w.addText('בדרך');s.font=Font.systemFont(10);s.centerAlignText()}
 else{lk.rect.forEach((x,i)=>{const t=w.addText(x);t.font=i?Font.systemFont(12):Font.boldSystemFont(14);t.lineLimit=1;t.minimumScaleFactor=0.8})}
 w.refreshAfterDate=new Date(Date.now()+15*60000);Script.setWidget(w);Script.complete();return}
const w=new ListWidget();w.backgroundColor=new Color('#0a0f14');w.url='https://packetdrop.vercel.app';w.setPadding(6,14,12,14)
const img=await new Request('https://packetdrop.vercel.app/wordmark.png').loadImage().catch(()=>null)
if(img){const i=w.addImage(img);i.imageSize=new Size(img.size.width*24/img.size.height,24);i.rightAlignImage()}else{const t=w.addText('Unbox');t.font=Font.boldSystemFont(16);t.textColor=Color.white()}
w.addSpacer(8)
if(!r||!r.ok||!r.lines){const e=w.addText('אין נתונים כרגע');e.textColor=Color.gray();e.font=Font.mediumSystemFont(14)}else{
 const F={big:22,title:17,mid:15,small:13},C={white:'#ffffff',teal:'#2ed3c6',light:'#cfe3f2',gray:'#9aa6b2',red:'#ff8a7a'}
 const max=config.widgetFamily==='large'?10:config.widgetFamily==='medium'?4:3
 r.lines.slice(0,max).forEach((x,i)=>{if(i===3)w.addSpacer(6);else if(i)w.addSpacer(2);const t=w.addText(x.t);t.font=x.s==='small'?Font.mediumSystemFont(F.small):Font.boldSystemFont(F[x.s]||15);t.textColor=new Color(C[x.c]||'#ffffff');t.lineLimit=x.n||1;t.minimumScaleFactor=0.75})}
w.addSpacer()
w.refreshAfterDate=new Date(Date.now()+15*60000)
if(config.runsInWidget)Script.setWidget(w);else await w.presentSmall()
Script.complete()
`;
