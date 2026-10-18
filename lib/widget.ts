// What the home-screen widget shows, line by line (drawn by the Scriptable script).
import type {Parcel} from '@/lib/parcels';
export type Line={t:string;s:'big'|'mid'|'small';c:'white'|'teal'|'light'|'gray';n?:number};
const OUT=/יצאה למסירה|בדרך למסירה|השליח בדרך|out for delivery|בדרכו לכתובת|השליח יצור קשר/i;
const PICK=/לאיסוף|איסוף|pick ?up|collection/i;
const ilDay=(t:number)=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const isPick=(p:Parcel)=>p.stage===3&&(!!p.pickup?.place||PICK.test(p.events.at(-1)?.label||'')&&!OUT.test(p.events.at(-1)?.label||''));
const isOut=(p:Parcel,now:number)=>p.stage===3&&!isPick(p)&&p.events.some(e=>OUT.test(e.label)&&ilDay(new Date(e.time).getTime())===ilDay(now));
function whenText(t:number,now:number){const d=Math.round((new Date(ilDay(t)).getTime()-new Date(ilDay(now)).getTime())/864e5);
 if(d<=0)return 'היום';if(d===1)return 'מחר';if(d<7)return 'בעוד '+d+' ימים';const x=new Date(t);return x.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});}
export function lines(all:Parcel[],names:Record<string,string>,when:Record<string,number>,now=Date.now()):Line[]{
 const list=all.filter(p=>!p.ret);const generic=(n:string)=>/^(?:הזמנה|חבילה)/.test(n);const nm=(p:Parcel)=>(names[p.id]||(generic(p.name)?(p.shop?'הזמנה מ־'+p.shop:'חבילה'):p.name)).slice(0,40);
 const out=list.filter(p=>isOut(p,now)),pick=list.filter(isPick),rest=list.filter(p=>!out.includes(p)&&!pick.includes(p));const L:Line[]=[];
 if(out.length){L.push({t:'למסירה היום',s:'big',c:'teal'});for(const p of out.slice(0,2))L.push({t:nm(p),s:'small',c:'light'});}
 if(pick.length){L.push({t:pick.length+' לאיסוף',s:out.length?'mid':'big',c:'teal'});for(const p of pick.slice(0,2)){L.push({t:p.pickup?.place||nm(p),s:'small',c:'light'});if(p.pickup?.code)L.push({t:'קוד '+p.pickup.code,s:'small',c:'teal'});}}
 if(rest.length)L.push({t:(out.length||pick.length?'עוד ':'')+rest.length+' בדרך',s:out.length||pick.length?'mid':'big',c:'white'});
 if(!out.length&&!pick.length){const next=rest.filter(p=>when[p.id]).sort((a,b)=>when[a.id]-when[b.id])[0];if(next){L.push({t:'הבאה '+whenText(when[next.id],now),s:'mid',c:'teal'});L.push({t:nm(next),s:'small',c:'light',n:2});}}
 if(!L.length)L.push({t:'אין חבילות בדרך',s:'mid',c:'gray'});
 return L;}

// Runs inside Scriptable (fetched by the small script on the phone). `r` is this route's JSON.
// The logo stays where it always was (top left on the phone); texts follow the natural (right) side.
export const RENDER=`
const w=new ListWidget();w.backgroundColor=new Color('#0a0f14');w.url='https://packetdrop.vercel.app';w.setPadding(6,14,12,14)
const img=await new Request('https://packetdrop.vercel.app/wordmark.png').loadImage().catch(()=>null)
if(img){const i=w.addImage(img);i.imageSize=new Size(img.size.width*24/img.size.height,24);i.rightAlignImage()}else{const t=w.addText('Unbox');t.font=Font.boldSystemFont(16);t.textColor=Color.white()}
w.addSpacer(8)
if(!r||!r.ok||!r.lines){const e=w.addText('אין נתונים כרגע');e.textColor=Color.gray();e.font=Font.mediumSystemFont(14)}else{
 const F={big:22,mid:15,small:13},C={white:'#ffffff',teal:'#2ed3c6',light:'#b5fff8',gray:'#8a96a3'}
 const max=config.widgetFamily==='large'?10:4
 r.lines.slice(0,max).forEach((x,i)=>{if(i&&x.s!=='small')w.addSpacer(3);const t=w.addText(x.t);t.font=x.s==='small'?Font.mediumSystemFont(F.small):Font.boldSystemFont(F[x.s]||15);t.textColor=new Color(C[x.c]||'#ffffff');t.lineLimit=x.n||1;t.minimumScaleFactor=0.75})}
w.addSpacer()
w.refreshAfterDate=new Date(Date.now()+15*60000)
if(config.runsInWidget)Script.setWidget(w);else await w.presentSmall()
Script.complete()
`;
