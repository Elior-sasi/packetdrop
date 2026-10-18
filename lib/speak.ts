// What Siri reads aloud for "where are my parcels". Pure, so it can be tested.
import type {Parcel} from '@/lib/parcels';
const DAY=864e5;
const MONTHS=['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
const OUT=/יצאה למסירה|יצא למסירה|בדרך למסירה|השליח בדרך|במסירה היום|out for delivery|with (?:the )?courier/i;
const PICK=/איסוף|pickup|collection/i;
const ilDay=(t:number)=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const pickup=(p:Parcel)=>p.stage===3&&(!!p.pickup?.place||PICK.test(p.events.at(-1)?.label||'')&&!OUT.test(p.events.at(-1)?.label||''));
const outToday=(p:Parcel,now:number)=>p.stage===3&&!pickup(p)&&p.events.some(e=>OUT.test(e.label)&&ilDay(new Date(e.time).getTime())===ilDay(now));
// Short spoken name: the user's own title, otherwise the first words of the product.
export function spokenName(p:Parcel,titles:Record<string,string>={}){
 const t=titles[p.id]||p.keys.map(k=>titles[k]).find(Boolean);if(t)return t;
 const n=p.name.replace(/[|()[\]{}]/g,' ').replace(/\s+/g,' ').trim();
 if(!n||/^(?:הזמנה|חבילה|משלוח)(?:\s|$)/.test(n))return p.shop?'הזמנה מ־'+p.shop:'חבילה';
 return n.split(' ').slice(0,5).join(' ');}
// "25.10" or "25.10-29.10" -> "25 באוקטובר" / "בין 25 ל־29 באוקטובר".
export function spokenDate(eta:string){
 const m=[...eta.matchAll(/(\d{1,2})\.(\d{1,2})/g)].map(x=>[+x[1],+x[2]]).filter(([d,mo])=>d>=1&&d<=31&&mo>=1&&mo<=12);
 if(!m.length)return '';const [a,b]=[m[0],m.at(-1)!];
 if(a===b||a[0]===b[0]&&a[1]===b[1])return a[0]+' '+MONTHS[a[1]-1];
 return a[1]===b[1]?'בין '+a[0]+' ל־'+b[0]+' '+MONTHS[a[1]-1]:'בין '+a[0]+' '+MONTHS[a[1]-1]+' ל־'+b[0]+' '+MONTHS[b[1]-1];}
const digits=(c:string)=>c.split('').join(' ');
const count=(n:number,one:string,many:string)=>n===1?one:n+' '+many;
export function speak(all:Parcel[],opts:{marks?:Record<string,string>;titles?:Record<string,string>;checkedAt?:string|null;now?:number}={}){
 const now=opts.now??Date.now();const marks=opts.marks||{};const titles=opts.titles||{};
 const live=all.filter(p=>!p.cancelled&&p.stage<4&&!marks[p.id]&&!p.keys.some(k=>marks[k])&&now-new Date(p.events.at(-1)?.time||0).getTime()<30*DAY);
 const pick=live.filter(pickup),out=live.filter(p=>outToday(p,now)),rest=live.filter(p=>!pick.includes(p)&&!out.includes(p));
 const parts:string[]=[];
 if(!live.length)parts.push('אין חבילות בדרך כרגע.');
 if(pick.length){parts.push(count(pick.length,'חבילה אחת מחכה לך לאיסוף.',' חבילות מחכות לך לאיסוף.').trim());
  for(const p of pick.slice(0,3))parts.push(spokenName(p,titles)+(p.pickup?.place?', ב'+p.pickup.place:'')+(p.pickup?.code?', קוד '+digits(p.pickup.code):'')+'.');}
 if(out.length)parts.push((out.length===1?'היום מגיעה: ':'היום מגיעות: ')+out.slice(0,3).map(p=>spokenName(p,titles)).join(', ')+'.');
 if(rest.length){parts.push((pick.length||out.length?'ועוד ':'')+count(rest.length,'חבילה אחת בדרך','חבילות בדרך')+'.');
  const dated=rest.map(p=>({p,d:spokenDate(p.eta)})).filter(x=>x.d);
  if(dated.length)parts.push('הקרובה: '+spokenName(dated[0].p,titles)+', צפויה '+(dated[0].d.startsWith('בין')?dated[0].d:'ב־'+dated[0].d)+'.');}
 const age=opts.checkedAt?now-new Date(opts.checkedAt).getTime():0;
 if(age>3*3600e3)parts.push('המידע עודכן לפני '+(age<DAY?Math.round(age/3600e3)+' שעות':Math.round(age/DAY)+' ימים')+'.');
 return parts.join(' ');}
