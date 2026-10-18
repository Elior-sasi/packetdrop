'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {heName} from '@/lib/hename';
import {signOut} from 'next-auth/react';
import {Package,CheckCircle2,Settings,RefreshCw,Pencil,ChevronRight,ExternalLink,Search,Mail,Copy,MapPin,Navigation,KeyRound,Cloud,CloudUpload,Bell,Plus,CalendarCheck,MapIcon,ChartColumn,EyeOff,PackageCheck,Undo2,ShieldAlert,RotateCcw,Smartphone,Plane,Mic,Volume2,X,Share2,Wallet,Users} from 'lucide-react';
import {mergeParcels,brandDomains,polishName,parseSms,photoKey,type Parcel as MailParcel,type Event as MailEvent} from '@/lib/parcels';
import {heEvent,tidyPlace,type TrackInfo} from '@/lib/track';
type Event=MailEvent&{src?:string};type Parcel=Omit<MailParcel,'events'>&{events:Event[];carrierStatus?:string;trackPending?:boolean;stale?:boolean;got?:boolean;manual?:boolean;ask?:boolean;real?:number;returned?:boolean};
type Geo=Record<string,{lat:number;lon:number}|null>;
type User={id:string;name:string;email:string};type Scan={parcels:MailParcel[];nextCursor?:string;scanned:number;failed?:number;updated:string};
// Product photos are shown exactly as the store serves them.
function trimmed(src:string,_f='w'){return src;}
const STATUS=['ההזמנה התקבלה','נשלחה','בדרך','מוכנה לאיסוף / במסירה','נמסרה'];
const STEP=['התקבלה','נשלחה','בדרך','לאיסוף','נמסרה'];
// A parcel that went quiet is not delivered; its steps stay where the last real update left them.
const step=(p:Parcel)=>p.stale||p.returned?(p.real??p.stage):p.stage;
const tone=(p:Parcel)=>p.stale?'unk':p.cancelled||p.returned||(p.stage<4&&/Exception|DeliveryFailure/.test(p.carrierStatus||''))?'bad':p.stage===4?'ok':p.stage===3&&(isPickup(p)||outToday(p))?'warn':'';
// Waiting at a pickup point (as opposed to a courier bringing it to the door).
// Search by meaning, not only by spelling: stores name the same thing differently ("חולצה" / "בגדי אנימה" / "T-shirt").
const SYN:string[][]=[['חולצ','shirt','טישרט','טי-שירט','טי שירט','בגדי'],['מכנס','pants','trousers','קארגו','ג\'ינס','jeans','shorts'],['אוזני','airpods','earbuds','headphone','earphone','buds'],['שעון','watch'],['נעל','shoe','sneaker','סניקרס','סנדל'],['תיק','bag','backpack','ארנק','wallet'],['כבל','cable','usb'],['מטען','charger'],['כיסוי','case','cover','מגן'],['שקע','plug','socket','מתאם','adapter'],['טלפון','phone','iphone','סמארטפון'],['מקלדת','keyboard'],['עכבר','mouse'],['שלט','remote','controller','בקר','gamepad'],['מנורה','lamp','light','תאורה']];
function searchTerms(q:string){if(!q)return [];const g=SYN.find(list=>list.some(t=>q.startsWith(t)||t.startsWith(q)&&q.length>=3));return g?[...new Set([q,...g])]:[q];}
// The day a calendar entry is for: today for a parcel waiting at a pickup point, else the first day of the expected window ("25.10-29.10").
function calDay(p:Parcel):{date:string;title:string}|null{if(p.cancelled||p.got||p.stage>=4)return null;const iso=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 if(isPickup(p))return {date:iso(new Date()),title:'לאסוף חבילה: '+p.name};
 const m=p.eta?.match(/(\d{1,2})\.(\d{1,2})/);if(!m)return null;const now=new Date();let y=now.getFullYear();if(+m[2]<now.getMonth()+1-2)y++;const d=new Date(y,+m[2]-1,+m[1]);if(isNaN(d.getTime())||d.getTime()<now.getTime()-864e5)return null;
 return {date:iso(d),title:'צפי הגעה: '+p.name};}
function addToCalendar(p:Parcel){const c=calDay(p);if(!c)return;const f=document.createElement('form');f.method='POST';f.action='/api/ics';
 const v:Record<string,string>={date:c.date,title:c.title,place:p.pickup?.place||'',address:p.pickup?.address||'',code:p.pickup?.code||'',hours:p.pickup?.hours||'',tracking:p.tracking||''};
 for(const [k,val] of Object.entries(v)){const i=document.createElement('input');i.type='hidden';i.name=k;i.value=val;f.appendChild(i);}document.body.appendChild(f);f.submit();f.remove();}
const isPickup=(p:Parcel)=>p.stage===3&&!p.cancelled&&(p.carrierStatus==='AvailableForPickup'||p.carrierStatus!=='OutForDelivery'&&(!!p.pickup?.place||p.events.some(e=>/איסוף|pickup|collection/i.test(e.label))));
// Latin runs (model names, sizes) are isolated so a Hebrew title does not scramble them, e.g. "AirPods 5/4/Pro (2026)".
const bidi=(t:string)=>t.replace(/[A-Za-z0-9][A-Za-z0-9 .\/()+&'"-]*[A-Za-z0-9)]/g,m=>'\u2066'+m+'\u2069');
// "Out for delivery" only means today; after a day without news the courier is just holding it.
const lastAt=(p:Parcel)=>new Date(p.events.at(-1)?.time||0).getTime();
const OUT_RE=/יצאה למסירה|יצא למסירה|בדרך למסירה|השליח בדרך|במסירה היום|out for delivery|with (?:the )?courier/i;
const PICK_RE=/לאיסוף|איסוף|pick ?up|collection/i;
// "Out for delivery today" needs an actual out-for-delivery update dated today, not just any update today.
const outToday=(p:Parcel)=>p.stage===3&&!p.cancelled&&!isPickup(p)&&p.events.some(e=>OUT_RE.test(e.label)&&new Date(e.time).toDateString()===new Date().toDateString());
const RETURNED=/יוחזר לשולח|הוחזר(?:ה)? לשולח|הוחזר(?:ה)? לשולח|return(?:ed)? to (?:the )?sender|לא נדרש בידי הנמען/i;
const statusText=(p:Parcel)=>p.ret?(p.stage>=4?'ההחזרה הגיעה לחנות':'החזרה, השליח יאסוף ממך'):p.cancelled&&p.refund?'ההזמנה זוכתה':p.cancelled?'ההזמנה בוטלה':p.returned?'הוחזרה לשולח':p.got?'התקבלה':p.stale?'בלי עדכון מ־'+day(p.events.at(-1)?.time):p.stage<4&&p.carrierStatus==='Exception'?'בעיה במשלוח':p.stage<4&&p.carrierStatus==='DeliveryFailure'?'המסירה נכשלה':p.stage===3&&p.carrierStatus==='AvailableForPickup'?'מוכנה לאיסוף':p.stage===3&&!isPickup(p)?(outToday(p)?'יצאה למסירה היום':'אצל חברת המסירה'):p.stage===3&&p.carrierStatus==='AvailableForPickup'?'מוכנה לאיסוף':p.stage===3?'מוכנה לאיסוף':STATUS[p.stage];
// Mail subjects repeat the number before the status ("חבילה מס' RS…: במכס"); keep the status part.
// Mail subjects are long ("הזמנתך 21327277 בחנות X - המוצר נשלח"); the history shows just what happened.
const SHORT:[RegExp,string][]=[[/בוטל|cancel/i,'ההזמנה בוטלה'],[/נמסר|delivered/i,'נמסרה'],[/לאיסוף|ready for pick ?up/i,'מוכנה לאיסוף'],[/יצא[הו]? למסירה|בדרך למסירה|out for delivery/i,'יצאה למסירה'],
 [/במכס|customs/i,'במכס'],[/במדינה|באזור שלכם|הגיע[הו]? לארץ|arrived in/i,'הגיעה לארץ'],[/יצאה מאזור המוצא|בתעבורה|in transit/i,'בדרך לארץ'],[/עם חברת המשלוחים המקומית|local delivery/i,'בדרך למרכז המסירה'],
 [/נשלח|shipped|dispatched/i,'נשלחה'],[/נאספ|נארז|packed/i,'נארזה ויצאה'],[/אושר|מאושרת|התקבל|confirmed|received/i,'ההזמנה התקבלה']];
const shortLabel=(s:string)=>{if(s.length<=22&&!/\d{5,}/.test(s))return s;for(const [r,t] of SHORT)if(r.test(s))return t;return s;};
const cleanLabel=(s:string)=>s.replace(/^(?:ל?חבילה|הזמנה|your order|order)\s*(?:מס['׳]?|מספר|no\.?|#)?\s*[A-Z0-9-]{6,}\s*[:：-]?\s*/i,'').trim()||s;
const isGeneric=(name:string)=>/^(?:ל?חבילה|הזמנה|הזמנתך|your order|order|הודעה (?:מ|ב))(?=[\s:'׳]|$)/i.test(name)||/^(?:תודה|אישור (?:ה)?הזמנה|order confirm|thank you for your order|thanks for your order)/i.test(name)||/^\S*\d{8,}/.test(name)||/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name.trim());
const isGenericName=(p:{name:string})=>/^(?:הזמנה מ־|חבילה|הזמנה …)/.test(p.name);
// Names Gemini wrote for store titles (when it is on); each part of a "A + B" title is looked up on its own.
const GEM:Record<string,string>={};
// Photo descriptions for VoiceOver (from /api/describe), by image URL.
const DESC:Record<string,string>={};
const nice=(raw:string)=>raw.split(' + ').map(x=>{const m=x.match(/^(.*?)( ועוד \d+)?$/)!;return (GEM[m[1]]||heName(polishName(m[1])))+(m[2]||'');}).join(' + ');
const displayName=(p:Parcel)=>isGeneric(p.name)?(p.shop&&!/הזמנה מהדוא|^דואר ישראל$/.test(p.shop)?'הזמנה מ־'+p.shop:p.order?'הזמנה …'+p.order.slice(-6):'חבילה '+p.tracking):nice(p.name)+(p.qty&&p.qty>1?' ×'+p.qty:'');
// Bump when mail parsing changes: mail from the last 180 days is then read again with the new rules.
const PARSER=5;
const keepOld=(list:MailParcel[])=>list.filter(p=>Date.now()-new Date(p.events.at(-1)?.time||0).getTime()>175*864e5);
const NOISE=/(?:^|\s)יש עדכון\s*$|has an update|^עדכון$|איך הלך|בהמתנה לאישור|ביקורת|review|rate your|תסומן בקרוב|how was/i;
const timeline=(evs:Event[])=>{const out:Event[]=[];for(const e of evs){if(NOISE.test(e.label))continue;const l=cleanLabel(e.label);if(out.length&&cleanLabel(out[out.length-1].label)===l)continue;out.push(e);}return out.length?out:evs.slice(-1);};
const when=(iso:string)=>{const d=new Date(iso);return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})+' · '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};
const ago=(iso:string)=>{const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);return m<1?'עודכן עכשיו':m<60?'עודכן לפני '+m+' דק׳':'עודכן ב־'+new Date(iso).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};

const day=(d?:string)=>{if(!d)return '';const x=new Date(d);return isNaN(+x)?'':x.getDate()+'.'+(x.getMonth()+1);};
const etaText=(e:TrackInfo['eta'])=>{if(!e)return '';const a=day(e.from),b=day(e.to);return a&&b&&a!==b?a+'-'+b:a||b;};
// Carrier data (17TRACK) refines what the mails say: later step, carrier name, estimate, extra timeline events.
function withCarrier(p:MailParcel,t?:TrackInfo):Parcel{if(!t||!p.tracking&&!t.number.startsWith('TZ:'))return p;
 const stage=p.cancelled?p.stage:Math.max(p.stage,t.stage);
 const events:Event[]=[...p.events,...t.events.map(e=>({id:'trk:'+e.time+e.text,label:[heEvent(e.text).replace(/\s*[•·]\s*([^•·]*,[^•·]*)$/,(m,pl)=>tidyPlace(pl)?' · '+tidyPlace(pl):''),tidyPlace(e.location||'')].filter(Boolean).filter((x,i,a)=>i===0||!a[0].includes(x)).join(' · '),time:new Date(e.time).toISOString(),src:t.carrier||'חברת השילוח'}))].sort((a,b)=>a.time.localeCompare(b.time));
 return {...p,stage,carrier:p.carrier||t.carrier,eta:stage>=4?'':etaText(t.eta)||p.eta,events,carrierStatus:t.status,trackPending:t.pending};}
// Navigation to a pickup point: Google Maps, Waze and Moovit (Moovit needs coordinates, looked up once per address).
const placeQuery=(pk:{place:string;address:string})=>[pk.place,pk.address].filter(Boolean).join(' ');
function NavLinks({pk,geo}:{pk:{place:string;address:string};geo?:{lat:number;lon:number}|null}){const q=placeQuery(pk);
 return <div className="navLinks"><a className="ghost" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)} target="_blank" rel="noopener noreferrer">Google Maps</a>
  <a className="ghost" href={'https://moovit.com/?to='+encodeURIComponent(pk.place||pk.address)+(geo?'&tll='+geo.lat+'_'+geo.lon:'')+'&lang=he'} target="_blank" rel="noopener noreferrer">Moovit</a>
  <a className="ghost" href={'https://waze.com/ul?navigate=yes&q='+encodeURIComponent(q)} target="_blank" rel="noopener noreferrer">Waze</a></div>;}
const domainOf=(name:string)=>brandDomains[name]||(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(name)?name:'');
// Same white Google sign-in button as TAB: official four-colour G, dark label, white pill.
function GoogleButton({label,disabled}:{label:string;disabled?:boolean}){return <button className="gbtn" disabled={disabled}><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg><span>{label}</span></button>;}
function Favicon({name,size=18}:{name:string;size?:number}){const [failed,setFailed]=useState(false);const d=domainOf(name);if(!d||failed)return null;return <img className="fav" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=64'} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;}
function Mark({cls,anim}:{cls?:string;anim?:'bob'|'open'}){return <svg className={cls} viewBox="100 76 312 386" aria-hidden="true"><defs><linearGradient id="ug" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#2ed3c6"/><stop offset="1" stopColor="#4aa8ff"/></linearGradient></defs><path d="M150 214 V320 a106 106 0 0 0 212 0 V210" fill="none" stroke="url(#ug)" strokeWidth="58" strokeLinecap="round"/><g className="lid">{anim==="bob"&&<animateTransform attributeName="transform" type="translate" values="0 40;0 -26;0 40" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>}{anim==="open"&&<animateTransform attributeName="transform" type="translate" values="0 56;0 0" dur=".9s" begin=".2s" fill="freeze" calcMode="spline" keySplines=".2 .9 .3 1"/>}<rect x="112" y="112" width="288" height="48" rx="16" fill="#4aa8ff" transform="rotate(-10 112 160)"/></g></svg>;}
// Full-screen photo: pinch with two fingers to zoom, drag to move, double-tap to zoom in or back, ✕ to close.
function Zoom({src,alt,onClose}:{src:string;alt:string;onClose:()=>void}){const [t,setT]=useState({s:1,x:0,y:0});const pts=useRef(new Map<number,{x:number;y:number}>());const start=useRef<{d:number;s:number;mx:number;my:number;x:number;y:number}|null>(null);const last=useRef(0);
 const img=useRef<HTMLImageElement>(null);
 // The photo never slides past its own edge into the black: it can move only as far as its zoomed size overflows the screen.
 const clamp=(v:{s:number;x:number;y:number})=>{const s=Math.min(5,Math.max(1,v.s));if(s===1)return {s,x:0,y:0};const el=img.current;if(!el)return {s,x:v.x,y:v.y};
  const mx=Math.max(0,(el.offsetWidth*s-innerWidth)/2),my=Math.max(0,(el.offsetHeight*s-innerHeight)/2);return {s,x:Math.max(-mx,Math.min(mx,v.x)),y:Math.max(-my,Math.min(my,v.y))};};
 const begin=()=>{const a=[...pts.current.values()];if(a.length===2){start.current={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s:t.s,mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,x:t.x,y:t.y};}else if(a.length===1){start.current={d:0,s:t.s,mx:a[0].x,my:a[0].y,x:t.x,y:t.y};}};
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};addEventListener('keydown',k);return()=>removeEventListener('keydown',k);},[onClose]);
 return <div className="zoom" role="dialog" aria-modal="true" aria-label={alt}>
  <button className="zoomX" aria-label="סגירה" onClick={onClose}><X size={26}/></button>
  <div className="zoomArea" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();
    if(pts.current.size===1){const now=Date.now();if(now-last.current<300)setT(v=>{if(v.s>1)return {s:1,x:0,y:0};const el=img.current;const fill=el?Math.max(innerHeight/el.offsetHeight,innerWidth/el.offsetWidth):2.5;return clamp({s:Math.max(1.5,fill),x:0,y:0});});last.current=now;}}}
   onPointerMove={e=>{if(!pts.current.has(e.pointerId)||!start.current)return;pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pts.current.values()];const st=start.current;
    if(a.length===2&&st.d){const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;setT(clamp({s:st.s*d/st.d,x:st.x+mx-st.mx,y:st.y+my-st.my}));}
    else if(a.length===1&&t.s>1)setT(clamp({s:t.s,x:st.x+a[0].x-st.mx,y:st.y+a[0].y-st.my}));}}
   onPointerUp={e=>{pts.current.delete(e.pointerId);begin();}} onPointerCancel={e=>{pts.current.delete(e.pointerId);begin();}}>
   <img ref={img} src={src} alt={alt} referrerPolicy="no-referrer" draggable={false} style={{transform:`translate(${t.x}px,${t.y}px) scale(${t.s})`}}/></div></div>;}
// Several photos: one at a time, swiped sideways, with dots that show where you are.
function Gallery({imgs}:{imgs:string[]}){const [at,setAt]=useState(0);const [big,setBig]=useState<number|null>(null);
 return <div className="gal"><div className="galTrack" onScroll={e=>{const el=e.currentTarget;const i=Math.round(Math.abs(el.scrollLeft)/el.clientWidth);if(i!==at)setAt(i);}}>{imgs.map((src,i)=><img key={src} src={trimmed(src)} alt={'תמונה '+(i+1)+' מתוך '+imgs.length+(DESC[src]?': '+DESC[src]:'')} loading={i<2?'eager':'lazy'} referrerPolicy="no-referrer" role="button" tabIndex={0} onClick={()=>setBig(i)}/>)}</div>{big!==null&&<Zoom src={imgs[big]} alt={'תמונה '+(big+1)+' מתוך '+imgs.length+(DESC[imgs[big]]?': '+DESC[imgs[big]]:'')} onClose={()=>setBig(null)}/>}
  <div className="dots" aria-hidden="true">{imgs.map((_,i)=><i key={i} className={i===at?'on':''}/>)}</div></div>;}
function Thumb({p,big}:{p:Parcel;big?:boolean}){if(p.images&&p.images.length>1){
 // Card: the first item fills the square, the second sits as a small inset so neither is cut in half.
 if(!big)return <div className="thumb multi n2">{p.images.slice(0,2).map(src=><img key={src} src={trimmed(src,'sq')} alt="" loading="lazy" referrerPolicy="no-referrer"/>)}</div>;
 return <Gallery imgs={p.images.slice(0,12)}/>;}
 return <ThumbOne p={p} big={big}/>;}
function ThumbOne({p,big}:{p:Parcel;big?:boolean}){const [failed,setFailed]=useState(false),[brandFailed,setBrandFailed]=useState(false);const [zoom,setZoom]=useState(false);const d=domainOf(p.shop)||domainOf(p.carrier);
 return <div className={big?'hero':'thumb'}>{p.image&&!failed?<>{<img className={'photo'+(big?' fill':'')} src={trimmed(p.image,big?'w':'sq')} alt={big?'תמונת המוצר'+(DESC[p.image]?': '+DESC[p.image]:''):''} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} {...(big?{role:'button',tabIndex:0,onClick:()=>setZoom(true)}:{})}/>}{big&&zoom&&<Zoom src={p.image} alt={'תמונת המוצר'+(DESC[p.image]?': '+DESC[p.image]:'')} onClose={()=>setZoom(false)}/>}</>:d&&!brandFailed?<img className="brandThumb" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=128'} alt="" referrerPolicy="no-referrer" onError={()=>setBrandFailed(true)}/>:<Package size={big?72:34}/>}</div>;}
function Meta({p}:{p:Parcel}){return <div className="meta"><Favicon name={p.shop}/><span dir="auto">{p.shop}</span>{p.carrier&&<><span className="sep">·</span><span dir="auto">{p.carrier}</span></>}</div>;}
// Detailed route, like the carrier sites: each milestone is lit by a real event (or by a later one), with its date.
const ROUTE:[string,RegExp][]=[
 ['ההזמנה התקבלה',/./],
 ['נארזה במחסן',/נארז|מוכנה למשלוח|המחסן קיבל|נקלטו|ready for shipping|packed/i],
 ['יצאה מהמחסן',/יצאה מהמחסן|נאספה|נשלח|מרכז מיון|מרכז המיון|shipped|dispatched/i],
 ['מכס יצוא',/מכס יצוא|הגיעה למרכז השילוח בארץ המוצא/i],
 ['טסה לישראל',/יצאה מארץ המוצא|יצאה בטיסה|בדרך לארץ|נמסרה לחברת ההובלה|בתעבורה|יצאה מאזור המוצא/i],
 ['הגיעה לישראל',/הגיעה לארץ|נחתה|הגיעה לחברת ההובלה|במדינה|באזור שלכם/i],
 ['שחרור ממכס',/שוחררה מהמכס|במכס|שחרור מהמכס/i],
 ['בדרך למרכז המסירה',/חברת המסירה|חברת המשלוחים המקומית|המקומית/i],
 ['במסירה / לאיסוף',/יצאה למסירה|לאיסוף|מוכנה למסירה/i],
 ['נמסרה',/נמסרה|נמסר|delivered/i]];
// Orders from abroad get the full route; Israeli shops skip the warehouse-abroad, customs and flight steps.
const abroad=(p:Parcel)=>/AliExpress|Temu|SHEIN|Amazon|eBay|iHerb|ASOS|Banggood|Wish|Zara/i.test(p.shop)||/Cainiao|YunExpress|4PX/i.test(p.carrier)||p.events.some(e=>/מכס|customs|ארץ המוצא|מדינת המוצא|טיסה|flight/i.test(e.label));
const LOCAL=[0,2,7,8,9];
function Route({p}:{p:Parcel}){if(p.cancelled)return null;const evs=[...p.events].sort((a,b)=>a.time.localeCompare(b.time));const steps=abroad(p)?ROUTE.map((_,i)=>i):LOCAL;
 const hit=ROUTE.map(([,r],i)=>i===0?evs[0]:i===9&&p.stage>=4?(evs.find(e=>r.test(e.label))||evs.at(-1)):i===8&&p.stage>=3?(evs.find(e=>r.test(e.label))||null):evs.find(e=>r.test(e.label))||null);
 let last=-1;hit.forEach((h,i)=>{if(h)last=i;});if(p.stage>=4)last=9;
 return <section className="box"><h3>מסלול</h3><ol className="route">{steps.map(i=>{const label=i===2&&!abroad(p)?'נשלחה':ROUTE[i][0];const done=i<=last;const h=hit[i];return <li key={label} className={(done?'d ':'')+(i===last?'c':'')}><span className="rdot"/><b>{label}</b>{done&&h&&<time>{new Date(h.time).toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}</time>}</li>;})}</ol></section>;}
// Steps still ahead, shown greyed at the bottom of the timeline.
function upcoming(p:Parcel){if(p.cancelled||p.stage>=4)return [] as string[];const evs=p.events;const steps=abroad(p)?ROUTE.map((_,i)=>i):LOCAL;
 let last=0;ROUTE.forEach(([,r],i)=>{if(i>0&&i<9&&evs.some(e=>r.test(e.label)))last=Math.max(last,i);});if(p.stage>=3)last=Math.max(last,8);else if(p.stage>=1)last=Math.max(last,2);
 return steps.filter(i=>i>last).map(i=>i===2&&!abroad(p)?'נשלחה':ROUTE[i][0]);}
// Courier mails (HFD, Cheetah...) often lack the product: pair each with a different AliExpress order that was on its way just before
// (closest first, one order per courier parcel) and show the two as one parcel.
function pairCouriers<T extends Parcel&{stale?:boolean}>(P:T[],titles:Record<string,string>):T[]{
 const generic=(x:T)=>/^(?:הזמנה מ־|חבילה|הזמנה …)/.test(x.name);
 const need=(x:T)=>!x.image&&generic(x)&&/AliExpress/i.test(x.shop)&&!!x.carrier&&!/AliExpress|Cainiao/i.test(x.carrier);
 const t0=(x:T)=>new Date(x.events[0]?.time||0).getTime();
 const pairs:[number,number,number][]=[];
 const tLast=(x:T)=>new Date(x.events.at(-1)?.time||0).getTime();
 // Only orders that are clearly still waiting for a courier: not cancelled, no tracking of their own, no news after the courier's notice.
 P.forEach((c,ci)=>{if(!need(c))return;P.forEach((o,oi)=>{if(oi===ci||need(o)||generic(o)||!/AliExpress/i.test(o.shop)||o.pickup||!o.events.length||o.cancelled||o.tracking||o.stage>=4&&!o.stale||o.events.some(e=>/בוטל|cancel/i.test(e.label)))return;
  const gap=t0(c)-t0(o);if(gap<=0||gap>30*864e5||tLast(o)>t0(c)+864e5)return;pairs.push([gap,ci,oi]);});});
 pairs.sort((x,y)=>x[0]-y[0]);const usedC=new Set<number>(),usedO=new Set<number>(),map=new Map<number,number>();
 for(const [,ci,oi] of pairs){if(usedC.has(ci)||usedO.has(oi))continue;usedC.add(ci);usedO.add(oi);map.set(ci,oi);}
 return P.flatMap((x,i)=>{if(usedO.has(i))return [];const oi=map.get(i);if(oi===undefined)return [x];const o=P[oi];
  return [{...x,name:titles[x.id]||o.name,image:o.image,order:x.order||o.order,events:[...o.events,...x.events].sort((a,b)=>a.time.localeCompare(b.time))}];});}
// ---- Arrival estimate learned from the user's own delivered parcels (no outside guessing) ----
const SHIP_RE=/נשלח|יצאה מהמחסן|shipped|dispatched|נאספ/i;
const shippedAt=(p:Parcel)=>new Date((p.events.find(e=>SHIP_RE.test(e.label))||p.events[0])?.time||0).getTime();
const routeKey=(p:Parcel)=>p.shop+'|'+(p.carrier&&!/AliExpress|Cainiao/i.test(p.carrier)?p.carrier:'');
type Est={from:number;to:number;n:number;avg:number;late:boolean;scope:'route'|'shop';stage:string};
// Milestones along the way; the estimate starts from the latest one the parcel has reached, using how long YOUR past parcels took from there.
const MILES:[string,RegExp][]=[['מהמשלוח',SHIP_RE],['מיציאה מארץ המוצא',/יצאה מארץ המוצא|יצאה בטיסה|נמסרה לחברת ההובלה|יצאה מאזור המוצא|בתעבורה/i],['מההגעה לישראל',/הגיעה לארץ|נחתה|הגיעה לחברת ההובלה|במדינה|באזור שלכם|הגיע לארץ/i],['מהשחרור ממכס',/שוחררה מהמכס/i],['מחברת המסירה',/חברת המסירה|חברת המשלוחים המקומית|המקומית/i]];
const mileAt=(p:Parcel,k:number)=>{if(k===0)return shippedAt(p);const e=p.events.find(e=>MILES[k][1].test(e.label));return e?new Date(e.time).getTime():0;};
function learn(all:Parcel[]){const days:Record<string,number[]>={};
 for(const p of all){if(p.stage<4||p.cancelled||(p as {stale?:boolean}).stale||(p as {got?:boolean}).got||(p as {returned?:boolean}).returned)continue;const end=new Date(p.events.at(-1)!.time).getTime();
  MILES.forEach((_,k)=>{const t=mileAt(p,k);if(!t)return;const d=(end-t)/864e5;if(!(d>0.1&&d<90))return;for(const key of [routeKey(p),p.shop+'|*'])(days[key+'#'+k]??=[]).push(d);});}
 return days;}
const pct=(a:number[],q:number)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.round(q*(s.length-1))))];};
// Israel Post and couriers do not deliver on Saturday.
const noSat=(t:number)=>{const d=new Date(t);return d.getDay()===6?t+864e5:t;};
function estimate(p:Parcel,days:Record<string,number[]>):Est|null{if(p.stage>=3||p.cancelled||p.stage<1)return null;
 for(let k=MILES.length-1;k>=0;k--){const t0=mileAt(p,k);if(!t0)continue;
  let a=days[routeKey(p)+'#'+k],scope:'route'|'shop'='route';if(!a||a.length<3){a=days[p.shop+'|*#'+k];scope='shop';}if(!a||a.length<3)continue;
  let from=t0+pct(a,.25)*864e5,to=t0+pct(a,.75)*864e5;const now=Date.now();const late=now>t0+pct(a,.9)*864e5+864e5;
  if(from<now)from=now+864e5/2;if(to<from)to=from;return {from:noSat(from),to:noSat(to),n:a.length,avg:Math.round(a.reduce((x,y)=>x+y,0)/a.length),late,scope,stage:MILES[k][0]};}
 return null;}
// The store's delivery window is written when the parcel leaves China and is often far too cautious.
// Once the parcel is in Israel, YOUR past parcels from the same point say better: if they say it comes sooner, that wins.
const ISRAEL_MILES=new Set(['מההגעה לישראל','מהשחרור ממכס','מחברת המסירה']);let learnCache:{all:Parcel[];days:Record<string,number[]>}|null=null;
function freshEta(p:Parcel,all:Parcel[]):Parcel{if(!p.eta||p.stage>=3||p.cancelled)return p;const m=p.eta.match(/(\d{1,2})\.(\d{1,2})/);if(!m)return p;
 if(learnCache?.all!==all)learnCache={all,days:learn(all)};const e=estimate({...p,eta:''},learnCache.days);if(!e||e.late||!ISRAEL_MILES.has(e.stage))return p;
 const y=new Date().getFullYear();let start=new Date(y,+m[2]-1,+m[1]).getTime();if(start<Date.now()-60*864e5)start=new Date(y+1,+m[2]-1,+m[1]).getTime();
 return e.to<start-864e5?{...p,eta:''}:p;}
const dd=(t:number)=>{const d=new Date(t);return d.getDate()+'.'+(d.getMonth()+1);};
const estText=(e:Est)=>e.late?'מתעכבת מהרגיל':dd(e.from)===dd(e.to)?dd(e.from):dd(e.from)+'-'+dd(e.to);
// ---- AliExpress buyer protection: the order is about to be closed but the parcel has not arrived ----
const GUARD_RE=/בהמתנה לאישור|תסומן בקרוב כהזמנה שהושלמה|will be marked as completed|confirm receipt/i;
const guardOf=(p:Parcel)=>{if(p.stage>=4||p.cancelled||!/AliExpress/i.test(p.shop))return null;const e=[...p.events].reverse().find(e=>GUARD_RE.test(e.label));if(!e)return null;const age=(Date.now()-new Date(e.time).getTime())/864e5;return age<15?{since:e.time,age}:null;};
// Customs is open while nothing later than the customs notice happened.
// Text for whoever collects a parcel on the user's behalf: what, where, the code and the hours.
function sharePickup(p:Parcel){const k=p.pickup;if(!k)return;const text=['חבילה לאיסוף: '+p.name,k.place?'איפה: '+k.place+(k.address?', '+k.address:''):'',k.code?'קוד איסוף: '+k.code:'',k.hours?'שעות: '+k.hours:'',p.tracking?'מספר מעקב: '+p.tracking:''].filter(Boolean).join('\n');
 const nav=navigator as Navigator&{share?:(d:{text:string})=>Promise<void>};if(nav.share)void nav.share({text}).catch(()=>{});else void navigator.clipboard?.writeText(text).catch(()=>{});}
// Money: "₪49.95", "49.95₪", "$5" -> shekels (dollars are left out rather than guessed).
const shekels=(v?:string)=>{if(!v||!/₪/.test(v))return 0;const n=parseFloat(v.replace(/[^\d.]/g,''));return Number.isFinite(n)?n:0;};
const refundText=(p:Parcel)=>!p.refund?'':(p.refund.bonus?'הוחזר כבונוס באתר':p.refund.amount?'הוחזרו':'בוצע החזר כספי')+(p.refund.amount?' '+p.refund.amount:'')+' · '+day(p.refund.at);
const customsDue=(p:Parcel)=>p.customs&&p.stage<3&&!p.cancelled&&!p.events.some(e=>e.time>p.customs!.at&&/שוחררה|נמסר|לאיסוף|יצאה למסירה|released|delivered/i.test(e.label))?p.customs:null;
const orderUrl=(p:Parcel)=>p.order&&/AliExpress/i.test(p.shop)?'https://www.aliexpress.com/p/order/detail.html?orderId='+p.order:'';
const disputeText=(p:Parcel)=>{const last=[...p.events].reverse().find(e=>!GUARD_RE.test(e.label));return 'Hello, I have not received my order '+(p.order||'')+'. '+(p.tracking?'Tracking number '+p.tracking+' shows no delivery':'There has been no delivery')+(last?' (last update '+new Date(last.time).toLocaleDateString('en-GB')+')':'')+'. Please extend the buyer protection or issue a full refund. Thank you.';};
// ---- Journey: where the parcel is on the way from abroad, from the route milestones ----
function Journey({p}:{p:Parcel}){if(p.cancelled||!/AliExpress|Temu|SHEIN|Amazon|eBay|iHerb|ASOS|Banggood/i.test(p.shop)&&!/Cainiao|YunExpress|4PX/i.test(p.carrier))return null;
 const evs=p.events;const has=(r:RegExp)=>evs.some(e=>r.test(e.label));
 const customs=has(ROUTE[6][1]);const step=p.stage>=4?5:p.stage>=3||has(ROUTE[7][1])?4:customs||has(ROUTE[5][1])?3:has(ROUTE[4][1])?2:has(ROUTE[2][1])||has(ROUTE[3][1])?1:0;
 const labels=['במחסן המוכר','יצאה מהמחסן','בדרך לישראל',customs?'בישראל, במכס':'הגיעה לישראל','בדרך למרכז המסירה','אצלך'];
 const T=[0,.18,.5,.78,.9,1][step];const P0=[318,160],C1=[250,40],C2=[130,30],P1=[56,120];
 const bz=(t:number,i:number)=>(1-t)**3*P0[i]+3*(1-t)**2*t*C1[i]+3*(1-t)*t*t*C2[i]+t**3*P1[i];const x=bz(T,0),y=bz(T,1);
 return <details className="box journey fold"><summary><span>איפה החבילה</span><b>{labels[step]}</b></summary><svg viewBox="0 0 360 200" width="100%" role="img" aria-label={'מיקום החבילה: '+labels[step]}>
  <defs><linearGradient id="jg" x1="1" x2="0"><stop offset="0" stopColor="#4aa8ff"/><stop offset="1" stopColor="#2ed3c6"/></linearGradient></defs>
  <rect width="360" height="200" rx="16" fill="#0d141b"/>
  <path d={`M${P0} C${C1} ${C2} ${P1}`} fill="none" stroke="#2a3a4c" strokeWidth="3" strokeDasharray="6 7"/>
  <path d={`M${P0} C${C1} ${C2} ${P1}`} fill="none" stroke="url(#jg)" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${T*100} 100`}/>
  <circle cx={P0[0]} cy={P0[1]} r="7" fill="#4aa8ff"/><text x={P0[0]} y={P0[1]+24} fill="#b4bdca" fontSize="13" textAnchor="middle">סין</text>
  <circle cx={P1[0]} cy={P1[1]} r="7" fill={step>=5?'#3fd49a':'#33414f'}/><text x={P1[0]} y={P1[1]+24} fill="#b4bdca" fontSize="13" textAnchor="middle">ישראל</text>
  {step<5&&<><circle cx={x} cy={y} r="18" fill="#2ed3c6" opacity=".22"><animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite"/></circle><circle cx={x} cy={y} r="9" fill="#2ed3c6"/></>}
  <text x="180" y="186" fill="#fff" fontSize="15" fontWeight="700" textAnchor="middle">{labels[step]}</text></svg></details>;}
// Scriptable widget source with the personal link inside.
const widgetScript=(url:string)=>`// Unbox widget: loads its drawing code from Unbox, so updates arrive by themselves.
const u=${JSON.stringify(url)}
const r=await new Request(u).loadJSON().catch(()=>null)
const code=await new Request(u+'&js=1').loadString().catch(()=>'')
const AF=Object.getPrototypeOf(async function(){}).constructor
if(code&&code.includes('ListWidget')){await new AF('r',code)(r)}else{const w=new ListWidget();w.backgroundColor=new Color('#0a0f14');const t=w.addText(r&&r.lines?r.lines.map(x=>x.t).join('\\n'):'אין נתונים כרגע');t.textColor=Color.white();t.font=Font.boldSystemFont(15);if(config.runsInWidget)Script.setWidget(w);else await w.presentSmall();Script.complete()}`;
// Hero card: the next parcel to reach you, with a countdown and its place on the way.
function NextCard({p,when,onOpen}:{p:Parcel;when:number;onOpen:()=>void}){
 const pick=isPickup(p),today=outToday(p);const days=Math.max(0,Math.round((when-Date.now())/864e5));
 const has=(r:RegExp)=>p.events.some(e=>r.test(e.label));
 const T=pick||today||p.stage>=3?1:has(ROUTE[7][1])?.85:has(ROUTE[6][1])?.75:has(ROUTE[5][1])?.65:has(ROUTE[4][1])?.42:p.stage>=1?.15:.05;
 const k=pick?'מחכה לך לאיסוף':today?'מגיעה היום':'החבילה הבאה שמגיעה';
 const big=pick?(p.pickup?.code||'✓'):today||days<=0?'היום':days===1?'מחר':String(days);
 const unit=pick?(p.pickup?.code?'קוד':''):today||days<=0||days===1?'':'ימים';
 const label='החבילה הבאה: '+p.name+'. '+(pick?'מחכה לאיסוף'+(p.pickup?.code?' קוד '+p.pickup.code:'')+(p.pickup?.place?' ב'+p.pickup.place:''):big+' '+unit+(today?'':' צפי '+dd(when)));
 if(!pick){const C=2*Math.PI*40;return <button className="nextCard nc-ring" onClick={onOpen} aria-label={label}>
  <div className="nc-k nc-top">{k}</div>
  <div className="nc-row"><svg className="ring" viewBox="0 0 92 92" aria-hidden="true"><defs><linearGradient id="ncg"><stop offset="0" stopColor="#2ed3c6"/><stop offset="1" stopColor="#4aa8ff"/></linearGradient></defs>
   <circle cx="46" cy="46" r="40" fill="none" stroke="#ffffff18" strokeWidth="8"/><circle cx="46" cy="46" r="40" fill="none" stroke="url(#ncg)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-T)} transform="rotate(-90 46 46)"/>
   <text x="46" y={unit?50:55} fill="#fff" fontSize={big.length>3?20:big.length>2?26:34} fontWeight="700" textAnchor="middle">{big}</text>{unit&&<text x="46" y="68" fill="#9fd2ff" fontSize="12" textAnchor="middle">{unit}</text>}</svg>
   <div className="nc-info"/><Thumb p={p}/></div>
  <div className="nc-nm nc-full">{bidi(p.name)}</div>
  <div className="nc-chips" aria-hidden="true"><span>{statusText(p)}</span>{!today&&<span>{'צפי '+dd(when)}</span>}</div></button>;}
 const x=348-T*338;
 return <button className="nextCard nc-ring" onClick={onOpen} aria-label={label}>
  <div className="nc-row"><Thumb p={p}/><div className="nc-info"><div className="nc-k">{k}</div><div className="nc-nm">{bidi(p.name)}</div>
   <div className="nc-cd">{pick?<><b>{p.pickup?.code||'✓'}</b>{p.pickup?.place&&<span>{p.pickup.place}</span>}</>:today||days<=0?<b>היום</b>:days===1?<><b>מחר</b><span>{'צפי '+dd(when)}</span></>:<><b>{days}</b><span>{'ימים · צפי '+dd(when)}</span></>}</div></div></div>
  <svg className="nc-trk" viewBox="0 0 358 40" aria-hidden="true"><line x1="10" y1="16" x2="348" y2="16" stroke="#2a4a66" strokeWidth="3" strokeDasharray="6 6"/><line x1="348" y1="16" x2={x} y2="16" stroke="#2ed3c6" strokeWidth="4" strokeLinecap="round"/>
   <circle cx="348" cy="16" r="6" fill="#4aa8ff"/><circle cx="10" cy="16" r="6" fill={T>=1?'#3fd49a':'#33414f'}/><circle cx={x} cy="16" r="9" fill="#2ed3c6"><animate attributeName="r" values="7;10;7" dur="1.8s" repeatCount="indefinite"/></circle>
   <text x="348" y="37" fill="#9fb4c8" fontSize="11" textAnchor="middle">{abroad(p)?'חו"ל':'החנות'}</text><text x="12" y="37" fill="#9fb4c8" fontSize="11" textAnchor="middle">אתה</text></svg></button>;}
function Bar({p}:{p:Parcel}){return <div className={'bar '+tone(p)} aria-hidden="true">{STEP.map((_,i)=><i key={i} className={!p.cancelled&&i<=step(p)?'on':''}/>)}</div>;}

// Bottom sheet chrome: a grab bar you can pull down to close, and a close button.
function swipeClose(close:()=>void){let y0=0,dy=0;return {
 onTouchStart:(e:React.TouchEvent<HTMLElement>)=>{const el=e.currentTarget;y0=el.scrollTop>0?-1:e.touches[0].clientY;dy=0;},
 onTouchMove:(e:React.TouchEvent<HTMLElement>)=>{if(y0<0)return;dy=Math.max(0,e.touches[0].clientY-y0);e.currentTarget.style.transform=dy?'translateY('+dy+'px)':'';},
 onTouchEnd:(e:React.TouchEvent<HTMLElement>)=>{const el=e.currentTarget;if(dy>90){close();}else{el.style.transition='transform .2s';el.style.transform='';setTimeout(()=>{el.style.transition='';},220);}y0=0;dy=0;}};}
function SheetTop({close}:{close:()=>void}){return <><div className="grab" aria-hidden="true"/><button type="button" className="sheetX" aria-label="סגירה" onClick={close}><X size={20}/></button></>;}
export default function Dashboard({user,gmail,drive,configured,login}:{user:User|null;gmail:boolean;drive?:boolean;configured:boolean;login:()=>Promise<void>}){
 const [view,setView]=useState<'active'|'done'|'account'>('active'),[size,setSize]=useState(0),[auto,setAuto]=useState(true),[splash,setSplash]=useState<'on'|'out'|'off'>('on'),[search,setSearch]=useState(''),[data,setData]=useState<Scan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[openId,setOpenId]=useState<string|null>(null),[edit,setEdit]=useState<Parcel|null>(null),[draft,setDraft]=useState(''),[titles,setTitles]=useState<Record<string,string>>({}),[storage,setStorage]=useState(false),[saving,setSaving]=useState(false),[editError,setEditError]=useState(''),[copied,setCopied]=useState(''),[progress,setProgress]=useState<{pct:number;label:string}|null>(null),[filter,setFilter]=useState<'all'|'pickup'>('all'),[backup,setBackup]=useState<{state:'off'|'on'|'error'|'saving';updated?:string;msg?:string}>({state:drive?'on':'off'}),saved=useRef<MailParcel[]>([]),backupOn=useRef(!!drive),seen=useRef<Set<string>>(new Set()),[tracks,setTracks]=useState<Record<string,TrackInfo>>({}),[trackState,setTrackState]=useState<'off'|'on'|'error'>('off'),[sources,setSources]=useState<{t17:boolean;cainiao:string}|null>(null),[section,setSection]=useState<'list'|'today'|'stats'>('list'),[marks,setMarks]=useState<Record<string,'got'|'hide'>>({}),[manual,setManual]=useState<MailParcel[]>([]),[adding,setAdding]=useState(false),[addNum,setAddNum]=useState(''),[addName,setAddName]=useState(''),[addErr,setAddErr]=useState(''),[menu,setMenu]=useState<Parcel|null>(null),[geo,setGeo]=useState<Geo>({}),[month,setMonth]=useState(0),[reading,setReading]=useState(false),[addSms,setAddSms]=useState(''),[smsLink,setSmsLink]=useState(''),[toast,setToast]=useState(''),[smsLast,setSmsLast]=useState<{at:string;kind:string}|null>(null),[widgetUrl,setWidgetUrl]=useState(''),[showEst,setShowEst]=useState(true),[showMap,setShowMap]=useState(true),[foldCourier,setFoldCourier]=useState(true),[showNext,setShowNext]=useState(true),[snooze,setSnooze]=useState<Record<string,number>>({}),[phone,setPhone]=useState(''),[phoneEdit,setPhoneEdit]=useState(false),[sound,setSound]=useState(true),[others,setOthers]=useState<string[]>([]),[heard,setHeard]=useState(''),[heardSay,setHeardSay]=useState(''),[listening,setListening]=useState(false),[phoneDraft,setPhoneDraft]=useState(''),[phoneParcels,setPhoneParcels]=useState<MailParcel[]>([]),phoneRef=useRef('');phoneRef.current=phone;
 const marksRef=useRef(marks);marksRef.current=marks;const othersRef=useRef<string[]>([]);const manualRef=useRef(manual);manualRef.current=manual;
 const controller=useRef<AbortController|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{try{const v=localStorage.getItem('pd_size');setSize(v?Math.min(2,+v||0):localStorage.getItem('pd_large')==='1'?1:0);setAuto(localStorage.getItem('pd_auto')!=='0');setShowEst(localStorage.getItem('pd_est')!=='0');try{const t=JSON.parse(localStorage.getItem('pd_tracks')||'{}');if(t&&typeof t==='object')setTracks(t);}catch{}setShowMap(localStorage.getItem('pd_map')!=='0');setFoldCourier(localStorage.getItem('pd_fold')!=='0');setShowNext(localStorage.getItem('pd_next')!=='0');try{setSnooze(JSON.parse(localStorage.getItem('pd_snooze')||'{}'));}catch{}setSound(localStorage.getItem('pd_sound')!=='0');try{setOthers(JSON.parse(localStorage.getItem('pd_others')||'[]'));}catch{}{const ph=localStorage.getItem('pd_phone')||'';setPhone(ph);setPhoneDraft(ph);try{setPhoneParcels(JSON.parse(localStorage.getItem('pd_phone_parcels')||'[]'));}catch{}}setMarks(JSON.parse(localStorage.getItem('pd_marks')||'{}'));setManual(JSON.parse(localStorage.getItem('pd_manual')||'[]'));setGeo(JSON.parse(localStorage.getItem('pd_geo')||'{}'));}catch{}},[]);
 const setPref=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{}};
 const autoRef=useRef(true);autoRef.current=auto;
 // Opening screen: shown on launch, then fades out.
 useEffect(()=>{const a=setTimeout(()=>setSplash('out'),1400),b=setTimeout(()=>setSplash('off'),1800);return()=>{clearTimeout(a);clearTimeout(b);};},[]);
 async function sync(){if(!user||controller.current)return;setSlow(false);void smsRef.current?.();lastSync.current=Date.now();const c=new AbortController();controller.current=c;setBusy(true);setError('');setErrorCode('');setProgress({pct:3,label:'מתחבר ל־Gmail…'});const timeout=setTimeout(()=>c.abort(),300000);
  // No single request may hang the whole check: each one gets its own time limit.
  const lim=(ms:number)=>typeof AbortSignal!=='undefined'&&'any' in AbortSignal&&'timeout' in AbortSignal?(AbortSignal as unknown as {any:(a:AbortSignal[])=>AbortSignal}).any([c.signal,AbortSignal.timeout(ms)]):c.signal;
  let fix7=false;try{fix7=localStorage.getItem('pd_fix_v20')!=='1';}catch{}const listUrl='/api/parcels'+(fix7?'?recheck=1':'');
  try{let r=await fetch(listUrl,{signal:lim(25000),cache:'no-store'});if(r.status>=500&&!c.signal.aborted){await new Promise(res=>setTimeout(res,1500));r=await fetch(listUrl,{signal:lim(25000),cache:'no-store'});}const d=await r.json().catch(()=>({error:'הסריקה לא הושלמה. נסה שוב.'}));if(!r.ok){setErrorCode(d.code||'');throw Error(d.error);}
   // Only mail that was never read before is fetched; everything older comes from the cloud backup.
   // One-time repair: parcels whose shop was saved as a web address are read again to pick up the shop's real name.
   let fixShop=false;try{fixShop=localStorage.getItem('pd_fix_shop')!=='1';}catch{}
   if(fixShop){const inWindow=new Set(d.ids as string[]);const bad=saved.current.filter(p=>/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(p.shop)&&p.events.every(e=>inWindow.has(e.id)));if(bad.length){const ids=new Set(bad.flatMap(p=>p.events.map(e=>e.id)));saved.current=saved.current.filter(p=>!bad.includes(p));seen.current=new Set([...seen.current].filter(id=>!ids.has(id)));}}
   // One-time: active orders without a price re-read their own mails (the price is in the order mails), nothing else.
   let fixPrice=false;try{fixPrice=localStorage.getItem('pd_fix_price')!=='1'||localStorage.getItem('pd_fix_img2')!=='1';}catch{}
   if(fixPrice){const inWindow=new Set(d.ids as string[]);const need=saved.current.filter(p=>p.events.every(e=>inWindow.has(e.id))&&(!p.price&&p.stage<4&&!p.cancelled&&!!p.order||!p.images&&p.keys.filter(k=>k.startsWith('order:')).length>1));if(need.length){const ids=new Set(need.flatMap(p=>p.events.map(e=>e.id)));saved.current=saved.current.filter(p=>!need.includes(p));seen.current=new Set([...seen.current].filter(id=>!ids.has(id)));}}
   // One-time: orders still on the way re-read their own mails (quantity ×2, refunds), and Israel Post notices named after the accessibility icon.
   let fixQty=false;try{fixQty=localStorage.getItem('pd_fix_qty')!=='1';}catch{}
   // One-time: refunds, Israeli store confirmations and Israel Post notices that older rules skipped are read again.
   // The parcels being re-read stay on screen until their fresh copy arrives, so the list never empties out.
   let held:MailParcel[]=[],reread:string[]=[];const gotIds=new Set<string>();
   if(fix7&&Array.isArray(d.recheck)&&d.recheck.length){
    // Only parcels still on the way are read again (and mail never read before); delivered history is left alone, so a repair takes seconds, not minutes.
    const old=new Map<string,MailParcel>();for(const p of saved.current)for(const e of p.events)old.set(e.id,p);
    const re=new Set((d.recheck as string[]).filter(id=>{const p=old.get(id);return !p||p.stage<4&&!p.cancelled;}));d.recheck=[...re];const hit=saved.current.filter(p=>p.events.some(e=>re.has(e.id)));for(const p of hit)for(const e of p.events)if(!e.id.startsWith('t:')&&!e.id.startsWith('sms:')&&!e.id.startsWith('manual:'))re.add(e.id);held=hit;reread=[...re];saved.current=saved.current.filter(p=>!hit.includes(p));seen.current=new Set([...seen.current].filter(id=>!re.has(id)));}
   const waiting=()=>held.filter(p=>!p.events.some(e=>gotIds.has(e.id)));const shown=(ps:MailParcel[])=>held.length?mergeParcels([...ps,...waiting()]):ps;
   if(fixQty){const inWindow=new Set(d.ids as string[]);const need=saved.current.filter(p=>(p.stage<4&&!p.cancelled&&!!p.order||/נגישות/.test(p.name))&&p.events.every(e=>inWindow.has(e.id)));if(need.length){const ids=new Set(need.flatMap(p=>p.events.map(e=>e.id)));saved.current=saved.current.filter(p=>!need.includes(p));seen.current=new Set([...seen.current].filter(id=>!ids.has(id)));}}
   // Mail the background check already read (notifications server) is taken from there instead of reading it again.
   else if(pushOn.current&&!fix7){try{setProgress({pct:4,label:'מביא עדכונים מהשרת…'});const s=await fetch('/api/state',{signal:lim(10000),cache:'no-store'}).then(r=>r.json());
    if(s.ok&&Array.isArray(s.parcels)){const have=new Set(saved.current.flatMap(p=>p.events.map(e=>e.id)));const add=(s.parcels as MailParcel[]).filter(p=>Array.isArray(p.events)&&Array.isArray(p.keys)).map(p=>({...p,events:p.events.filter(e=>!e.id.startsWith('t:'))})).filter(p=>p.events.length&&p.events.some(e=>!have.has(e.id)));
     if(add.length){saved.current=mergeParcels([...saved.current,...add]);setData(old=>old?{...old,parcels:mergeParcels([...old.parcels,...add])}:{parcels:saved.current,scanned:0,updated:s.checkedAt||new Date().toISOString()});}
     // Mail being repaired stays unread here, even if the background check already read it with the older rules.
     const again=new Set(reread);for(const id of (s.seen||[]) as string[])if(!again.has(id))seen.current.add(id);}}catch{}}
   const known=new Set([...seen.current,...saved.current.flatMap(p=>p.events.map(e=>e.id))]);
   const todo:string[]=[...new Set([...(d.ids as string[]),...(fix7&&Array.isArray(d.recheck)?d.recheck as string[]:[]),...reread])].filter(id=>!known.has(id));const total=todo.length;setReading(total>0);let done=0,failed=0;
   let acc:Scan={parcels:mergeParcels([...saved.current]),scanned:0,updated:d.updated};setData(old=>old&&!saved.current.length&&!held.length?old:{...acc,parcels:shown(acc.parcels)});
   const step=()=>setProgress({pct:total?Math.min(90,Math.round(5+85*done/total)):90,label:total?'נקראו '+done+' מתוך '+total+' מיילים חדשים':'אין מיילים חדשים'});step();
   const chunks:string[][]=[];for(let i=0;i<todo.length;i+=12)chunks.push(todo.slice(i,i+12));const retry:string[]=[];let second=false;let chunkCount=0;
   const worker=async()=>{for(let ch=chunks.shift();ch&&!c.signal.aborted;ch=chunks.shift()){const r2=await fetch('/api/parcels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ch}),signal:lim(45000),cache:'no-store'}).catch(e=>{if(c.signal.aborted)throw e;return new Response('{}',{status:504});});const d2=await r2.json().catch(()=>({error:'',code:''}));
     if(!r2.ok){if(['NO_GMAIL','RECONNECT','UNAUTHORIZED','GMAIL_API_DISABLED'].includes(d2.code)){setErrorCode(d2.code);throw Error(d2.error);}if(second)failed+=ch.length;else{retry.push(...ch);}done+=second?0:ch.length;step();continue;}
     for(const id of d2.read as string[]){seen.current.add(id);gotIds.add(id);}if(second)failed+=(d2.failed as string[]).length;else retry.push(...(d2.failed as string[]));done+=second?0:ch.length;acc={...acc,scanned:acc.scanned+(d2.read as string[]).length,failed,parcels:mergeParcels([...acc.parcels,...d2.parcels])};saved.current=acc.parcels;setData({...acc,parcels:shown(acc.parcels)});step();
     // Keep progress, so an interrupted first scan continues where it stopped next time.
     saveCache(shown(acc.parcels),acc.updated);
     if(++chunkCount%8===0&&backupOn.current)void saveBackup(acc.parcels);}};
   await Promise.all([worker(),worker()]);
   // Mail Google refused to hand over (usually a short rate limit) gets one slower second try.
   if(retry.length&&!c.signal.aborted){second=true;setProgress({pct:92,label:'משלים '+retry.length+' מיילים שלא נקראו…'});await new Promise(res=>setTimeout(res,1500));for(let i=0;i<retry.length;i+=10)chunks.push(retry.slice(i,i+10));await worker();}
   // Anything that could not be read again keeps its old copy.
   if(held.length){acc={...acc,parcels:shown(acc.parcels)};saved.current=acc.parcels;}acc={...acc,updated:new Date().toISOString()};setData(acc);
   if(!c.signal.aborted){retried.current=false;try{localStorage.setItem('pd_fix_shop','1');localStorage.setItem('pd_fix_price','1');localStorage.setItem('pd_fix_img2','1');localStorage.setItem('pd_fix_qty','1');localStorage.setItem('pd_fix_v20','1');}catch{}setBusy(false);setReading(false);setProgress(null);await Promise.all([loadTracks([...acc.parcels,...manualRef.current]),saveBackup(acc.parcels)]);if(pushOn.current)void pushPost({parcels:[...acc.parcels,...manualRef.current],marks:marksRef.current}).catch(()=>{});}
  }catch(e){
   // A dropped connection ("Load failed" on iPhone) or a slow reply is not an error to show: try once more quietly, then say it in plain Hebrew.
   const net=e instanceof TypeError||(e instanceof Error&&/load failed|failed to fetch|network|timeout/i.test(e.name+' '+e.message));
   if(net&&!retried.current){retried.current=true;setTimeout(()=>void syncRef.current(),4000);}
   else setError(net?'אין חיבור כרגע. החבילות שמורות, ננסה שוב בפתיחה הבאה.':e instanceof Error&&e.name!=='AbortError'?e.message:'הסריקה נעצרה. אפשר לנסות שוב.');}finally{clearTimeout(timeout);controller.current=null;setBusy(false);setReading(false);setTimeout(()=>setProgress(null),700);}}
 // Safety net: if nothing has started 6 seconds after opening (a stuck request), start reading anyway; after 15 seconds offer a retry.
 // Every short message at the bottom goes away by itself (longer text stays a little longer).
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),Math.min(9000,3500+toast.length*40));return()=>clearTimeout(t);},[toast]);
 const [slow,setSlow]=useState(false);const retried=useRef(false);
 // iOS still pinch-zooms the whole screen despite the viewport setting; stop it everywhere except the photo viewer.
 useEffect(()=>{const stop=(e:globalThis.Event)=>{if(!(e.target as Element)?.closest?.('.zoomArea'))e.preventDefault();};document.addEventListener('gesturestart',stop,{passive:false});document.addEventListener('gesturechange',stop,{passive:false});return()=>{document.removeEventListener('gesturestart',stop);document.removeEventListener('gesturechange',stop);};},[]);
 useEffect(()=>{if(!user)return;const a=setTimeout(()=>{if(!controller.current&&!lastSync.current)void syncRef.current();},6000),b=setTimeout(()=>setSlow(true),15000);return()=>{clearTimeout(a);clearTimeout(b);};},[user?.id]);
 useEffect(()=>{if(!user)return;void loadBackup().finally(()=>void sync());fetch('/api/titles',{cache:'no-store'}).then(async r=>{const d=await r.json();if(r.ok){setTitles(d.titles||{});setStorage(!!d.storage);}}).catch(()=>{});return()=>controller.current?.abort();},[user?.id]);
 useEffect(()=>{if(edit)dialog.current?.showModal();else dialog.current?.close();},[edit]);
 // While a sheet or menu is open the page behind it must not scroll (iOS needs the body pinned in place).
 const locked=!!(openId||menu||adding);
 useEffect(()=>{if(!locked)return;const y=window.scrollY;const b=document.body.style;b.position='fixed';b.top=-y+'px';b.left='0';b.right='0';b.overflow='hidden';
  return()=>{b.position='';b.top='';b.left='';b.right='';b.overflow='';window.scrollTo(0,y);};},[locked]);
 // Refresh again whenever the app comes back to the screen (iPhone keeps home-screen apps alive in the background).
 // A home-screen app can stay open for days; when a newer version is live, reload once to pick it up.
 useEffect(()=>{const mine=process.env.NEXT_PUBLIC_BUILD;if(!mine)return;const check=()=>{if(document.visibilityState!=='visible')return;fetch('/api/version',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.build&&d.build!==mine){let last=0;try{last=+(sessionStorage.getItem('pd_reload')||0);}catch{}if(Date.now()-last>60000){try{sessionStorage.setItem('pd_reload',String(Date.now()));}catch{}location.reload();}}}).catch(()=>{});};check();document.addEventListener('visibilitychange',check);return()=>document.removeEventListener('visibilitychange',check);},[]);
 const lastSync=useRef(0);const syncRef=useRef(sync);syncRef.current=sync;
 useEffect(()=>{if(!user)return;const onShow=()=>{if(autoRef.current&&document.visibilityState==='visible'&&Date.now()-lastSync.current>60000)void syncRef.current();};document.addEventListener('visibilitychange',onShow);window.addEventListener('pageshow',onShow);return()=>{document.removeEventListener('visibilitychange',onShow);window.removeEventListener('pageshow',onShow);};},[user?.id]);
 // Pull down at the top of the list to refresh.
 const [pull,setPull]=useState(0);const pullStart=useRef<number|null>(null);const pullRef=useRef(0);
 useEffect(()=>{if(!user)return;const PULL=80;
  const start=(e:TouchEvent)=>{pullStart.current=window.scrollY<=0&&!document.body.style.overflow?e.touches[0].clientY:null;};
  const move=(e:TouchEvent)=>{if(pullStart.current===null)return;const dy=e.touches[0].clientY-pullStart.current;if(dy<=0||window.scrollY>0){pullRef.current=0;setPull(0);return;}pullRef.current=Math.min(130,dy*.55);setPull(pullRef.current);};
  const end=()=>{if(pullStart.current!==null&&pullRef.current>=PULL&&!controller.current)void syncRef.current();pullStart.current=null;pullRef.current=0;setPull(0);};
  window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});window.addEventListener('touchend',end);window.addEventListener('touchcancel',end);
  return()=>{window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end);};},[user?.id]);
 async function save(reset=false){if(!edit)return;setSaving(true);setEditError('');try{const r=await fetch('/api/titles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:edit.id,title:reset?'':draft.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error);setTitles(old=>({...old,[d.key]:d.title}));setEdit(null);}catch(e){setEditError(e instanceof Error?e.message:'שמירת השם נכשלה');}finally{setSaving(false);}}
 // The phone's copy opens the app instantly; if it is too big for storage, a smaller one is kept rather than none.
 function saveCache(list:MailParcel[],updated:string){const put=(ps:MailParcel[],n:number)=>localStorage.setItem('pd_cache',JSON.stringify({parser:PARSER,parcels:ps,seen:[...seen.current].slice(-n),updated}));
  try{put(list.slice(0,300),4000);}catch{try{put(list.slice(0,150).map(p=>({...p,images:p.images?.slice(0,6),events:p.events.slice(-8)})),2000);}catch{}}}
 function loadLocal(){try{const c=JSON.parse(localStorage.getItem('pd_cache')||'null');if(c&&Array.isArray(c.parcels)){const fresh=c.parser>=4;saved.current=fresh?c.parcels:keepOld(c.parcels);seen.current=new Set(fresh?c.seen||[]:[]);setData(old=>old||{parcels:c.parcels,scanned:0,updated:c.updated||new Date().toISOString()});}}catch{}}
 // A slow connection must not hold the whole app: the backup gets 8 seconds, then Gmail is read without it.
 async function loadBackup(){loadLocal();const ac=new AbortController();const t=setTimeout(()=>ac.abort(),8000);try{const r=await fetch('/api/backup',{cache:'no-store',signal:ac.signal});const d=await r.json();
   if(!r.ok){backupOn.current=d.code!=='NO_DRIVE';setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.code==='NO_DRIVE'?undefined:d.error});return;}
   backupOn.current=true;const fresh=d.parser>=4;seen.current=new Set(fresh&&Array.isArray(d.seen)?d.seen:[]);saved.current=Array.isArray(d.parcels)?(fresh?d.parcels:keepOld(d.parcels)):[];setBackup({state:'on',updated:d.updated});if(d.titles)setTitles(t=>({...d.titles,...t}));if(d.marks)setMarks(m=>({...d.marks,...m}));if(Array.isArray(d.others))setOthers(o=>[...new Set([...(d.others as string[]),...o])]);if(Array.isArray(d.manual)&&d.manual.length)setManual(m=>{const have=new Set(m.flatMap(x=>x.keys));return [...m,...(d.manual as MailParcel[]).filter(x=>!x.keys.some(k=>have.has(k)))];});
   // Open instantly with the last backup while Gmail is being read.
   setData(old=>old||(saved.current.length?{parcels:saved.current,scanned:0,updated:d.updated||new Date().toISOString()}:old));}catch{setBackup({state:'error',msg:'הגיבוי לא זמין כרגע'});}finally{clearTimeout(t);}}
 async function saveBackup(list:MailParcel[]){saveCache(list,new Date().toISOString());
  if(!backupOn.current)return;setBackup(b=>({...b,state:'saving'}));
  try{const r=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parser:PARSER,parcels:list.slice(0,400),seen:[...seen.current].slice(-5000),marks:marksRef.current,manual:manualRef.current,others:othersRef.current})});const d=await r.json();if(!r.ok){setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.error});return;}saved.current=list;setBackup({state:'on',updated:d.updated});}catch{setBackup({state:'error',msg:'הגיבוי לא נשמר. ינסה שוב ברענון הבא.'});}}
 async function loadTracks(list:MailParcel[]){const numbers=[...list.filter(p=>p.tracking&&p.stage<4&&!p.cancelled).map(p=>p.tracking).slice(0,36),...list.filter(p=>!p.tracking&&p.order&&p.via?.length&&!p.cancelled&&Date.now()-new Date(p.events.at(-1)?.time||0).getTime()<60*864e5).flatMap(p=>p.via!.map(h=>'TZ:'+h+':'+p.order)).slice(0,6),...(phoneRef.current?list.filter(p=>p.tracking&&p.carrier==='K Express'&&p.stage<4&&!p.cancelled).map(p=>'KX:'+p.tracking).slice(0,4):[])];void loadByPhone();if(!numbers.length)return;
  try{const r=await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numbers,phone:phoneRef.current||undefined}),cache:'no-store'});const d=await r.json();if(d.sources)setSources(d.sources);if(!d.enabled){setTrackState('off');return;}if(!r.ok)throw Error();setTracks(old=>{const n={...old,...d.tracks};try{localStorage.setItem('pd_tracks',JSON.stringify(n));}catch{}return n;});setTrackState('on');}catch{setTrackState('error');}}
 // Deliveries couriers have for the user's phone (only when the user saved it in settings).
 async function loadByPhone(){const ph=phoneRef.current;if(!ph)return;try{const r=await fetch('/api/couriers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:ph}),cache:'no-store'});const d=await r.json();if(Array.isArray(d.parcels)){setPhoneParcels(d.parcels);try{localStorage.setItem('pd_phone_parcels',JSON.stringify(d.parcels));}catch{}}}catch{}}
 async function copy(v:string){try{await navigator.clipboard.writeText(v);setCopied(v);setTimeout(()=>setCopied(''),1500);}catch{}}
 // Photos named in one mail (a package notice) name the same photo in another mail that came without a title.
 const photoNames=useMemo(()=>{const m:Record<string,string>={};for(const p of data?.parcels||[])Object.assign(m,p.named||{});return m;},[data]);
 // Still no name: ask the server once to recognise the photo (Gemini); answers are remembered on the phone too.
 const [visionNames,setVisionNames]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem('pd_vision')||'{}');}catch{return {};}});const asked=useRef(new Set<string>());
 useEffect(()=>{const want:string[]=[];for(const m of data?.parcels||[]){if(!isGeneric(m.name)||m.stage>=4||m.cancelled)continue;const imgs=[m.image,...(m.images||[])].filter(Boolean) as string[];if(!imgs.length||imgs.some(u=>photoNames[photoKey(u)]))continue;for(const u of imgs)if(!visionNames[photoKey(u)]&&!asked.current.has(u)&&/aliexpress-media|alicdn|media-amazon|cdn\.shopify/.test(u))want.push(u);}
  if(!want.length)return;want.forEach(u=>asked.current.add(u));
  fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:want.slice(0,6)})}).then(r=>r.json()).then(d=>{if(d?.names&&Object.keys(d.names).length)setVisionNames(v=>{const n={...v,...d.names};try{localStorage.setItem('pd_vision',JSON.stringify(n));}catch{}return n;});}).catch(()=>{});},[data,photoNames,visionNames]);
 const [,setDescTick]=useState(()=>{try{Object.assign(DESC,JSON.parse(localStorage.getItem('pd_desc')||'{}'));}catch{}return 0;});const descAsked=useRef(new Set<string>());
 useEffect(()=>{if(!openId)return;const p=(data?.parcels||[]).find(x=>x.id===openId);if(!p)return;const want=[...new Set([...(p.images||[]),p.image].filter(u=>u&&!DESC[u]&&!descAsked.current.has(u)))].slice(0,6);if(!want.length)return;want.forEach(u=>descAsked.current.add(u));
  fetch('/api/describe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:want}),signal:AbortSignal.timeout(40000)}).then(r=>r.json()).then(d=>{if(d?.desc&&Object.keys(d.desc).length){Object.assign(DESC,d.desc);try{const keep=Object.fromEntries(Object.entries(DESC).slice(-300));localStorage.setItem('pd_desc',JSON.stringify(keep));}catch{}setDescTick(x=>x+1);}}).catch(()=>{});},[openId,data]);
 const [gemTick,setGemTick]=useState(()=>{try{Object.assign(GEM,JSON.parse(localStorage.getItem('pd_gem')||'{}'));}catch{}return 0;});const gemAsked=useRef(new Set<string>());
 useEffect(()=>{const want:string[]=[];for(const m of data?.parcels||[]){if(isGeneric(m.name)||!/AliExpress|Temu|SHEIN/i.test(m.shop))continue;for(const t of [...m.name.replace(/ ועוד \d+$/,'').split(' + '),...(m.items||[])])if(t&&!GEM[t]&&!gemAsked.current.has(t)&&!/^הזמנה …/.test(t))want.push(t);}
  if(!want.length)return;const batch=[...new Set(want)].slice(0,25);batch.forEach(t=>gemAsked.current.add(t));
  fetch('/api/names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titles:batch})}).then(r=>r.json()).then(d=>{if(d?.names&&Object.keys(d.names).length){Object.assign(GEM,d.names);try{localStorage.setItem('pd_gem',JSON.stringify(GEM));}catch{}setGemTick(x=>x+1);}}).catch(()=>{});},[data,gemTick]);
 const byPhoto=(m:MailParcel)=>{if(!isGeneric(m.name))return '';const imgs=[m.image,...(m.images||[])].filter(Boolean).map(photoKey);const all=imgs.map(k=>photoNames[k]||visionNames[k]).filter(Boolean);const names=[...new Set(all)];if(!names.length)return '';const n=names.length===1&&all.length>1?' ×'+all.length:'';return heName(names.slice(0,4).join(' + '))+n;};
 const parcels=useMemo(()=>pairCouriers((manual.length||phoneParcels.length?mergeParcels([...(data?.parcels||[]),...manual,...phoneParcels]):(data?.parcels||[])).filter(m=>!/eventbuzz|smarticket|tickchak/i.test(m.shop)&&!/^\s*(?:re|fwd?)\s*:|^ביטול ה?הזמנה/i.test(m.name)&&!/בוטל|ביטול ה?הזמנה|cancel/i.test(m.events.at(-1)?.label||'')).filter(m=>!(marks[m.id]==='hide'||m.keys.some(k=>marks[k]==='hide'))).map(m=>{const got=marks[m.id]==='got'||m.keys.some(k=>marks[k]==='got');const p={...withCarrier(m,tracks[m.tracking]||(m.tracking?tracks['KX:'+m.tracking]:undefined)||(m.order&&!m.tracking?(m.via||[]).map(h=>tracks['TZ:'+h+':'+m.order]).find(Boolean):undefined))};const last=new Date(p.events.at(-1)?.time||0).getTime();
  // Pickup points return parcels after ~2 weeks and shops stop writing once it arrives: after 21 days of silence treat it as received.
  // Step 4 (pickup / delivery) only when an update actually says so; otherwise it is still on its way.
  if(p.stage===3&&!p.carrierStatus?.match(/OutForDelivery|AvailableForPickup/)&&!p.pickup&&!p.events.some(e=>OUT_RE.test(e.label)||PICK_RE.test(e.label)))p.stage=2;
  // Israeli stores track by SMS only: after the promised time the card asks "הגיעה?" instead of guessing; 30 days of silence = received.
  const local=!abroad(p)&&!p.tracking&&p.stage<3;const age=Date.now()-last;
  const em=[...p.eta.matchAll(/(\d{1,2})\.(\d{1,2})/g)].at(-1);let due=last+9*864e5;if(em){const y=new Date(last).getFullYear();let t=new Date(y,+em[2]-1,+em[1]).getTime();if(t<last-60*864e5)t=new Date(y+1,+em[2]-1,+em[1]).getTime();due=t+864e5;}
  const ask=local&&!got&&!p.cancelled&&Date.now()>due&&age<30*864e5&&!((snooze[p.id]||0)>Date.now());
  const stale=p.stage<4&&!p.cancelled&&age>(p.stage===3?14:abroad(p)?30:local?30:p.stage>=1?10:21)*864e5;
  // A parcel nobody collected goes back to the sender: that is the end of it, not "on the way".
  const returned=!got&&RETURNED.test(p.events.at(-1)?.label||'');
  return {...p,got,returned,manual:m.keys.some(k=>manual.some(x=>x.keys.includes(k))),stale:stale&&!got&&!returned,ask:ask&&!returned,last,stage:stale||got||returned?4:p.stage,real:p.stage,name:titles[p.id]||byPhoto(m)||displayName(m)};}),titles)
  // Ready for pickup / out for delivery first, then the most recent update; parcels with no tracking number go last.
  .sort((a,b)=>{const urgent=(p:Parcel)=>isPickup(p)||outToday(p)?0:1;return urgent(a)-urgent(b)||(a.tracking?0:1)-(b.tracking?0:1)||b.last-a.last;}).map((p,_,all)=>freshEta(p,all)),[data,titles,tracks,marks,manual,snooze,phoneParcels,photoNames,visionNames]);
 const learned=useMemo(()=>learn(parcels),[parcels]);const est=(p:Parcel)=>p.eta?null:estimate(p,learned);
 const active=parcels.filter(p=>p.stage<4&&!p.cancelled),done=parcels.filter(p=>p.stage===4&&!p.cancelled||p.cancelled&&!!p.refund);
 // On the way: what is due first comes first (carrier date, else your own estimate); pickups and today's deliveries stay on top.
 const etaAt=(p:Parcel)=>{const m=p.eta.match(/(\d{1,2})\.(\d{1,2})/);if(m){const y=new Date().getFullYear();let t=new Date(y,+m[2]-1,+m[1]).getTime();if(t<Date.now()-60*864e5)t=new Date(y+1,+m[2]-1,+m[1]).getTime();return t;}const e=est(p);return e&&!e.late?e.from:e?.late?Date.now():Infinity;};
 const byEta=(list:Parcel[])=>[...list].sort((a,b)=>{const u=(p:Parcel)=>isPickup(p)||outToday(p)?0:1;return u(a)-u(b)||etaAt(a)-etaAt(b)||(b as {last?:number}).last!-(a as {last?:number}).last!;});
 const nextP=(()=>{const l=byEta(active).filter(p=>isPickup(p)||outToday(p)||!!p.eta||(est(p)&&!est(p)!.late));const p=l[0];if(!p)return null;const t=isPickup(p)||outToday(p)?Date.now():etaAt(p);return Number.isFinite(t)?{p,t}:null;})();
 const q=search.trim().toLowerCase();const qs=searchTerms(q);// A search looks through everything, delivered parcels included.
 const shownAll=(q?[...byEta(active),...done]:view==='done'?done:filter==='pickup'?active.filter(isPickup):byEta(active)).filter(p=>{if(!q)return true;const hay=[p.name,p.shop,p.carrier,p.tracking,p.order,...(p.items||[]),...p.keys].join(' ').toLowerCase();return qs.some(t=>hay.includes(t));});
 // Delivered courier notices with no product (HFD etc.) fold into one row at the bottom of "נמסרו".
 const nameless=(p:Parcel)=>!p.image&&!p.images&&/^(?:הזמנה מ־|חבילה|הזמנה …)/.test(p.name)&&!!p.carrier&&!titles[p.id];
 const heroId=showNext&&view==='active'&&filter==='all'&&!q&&nextP?nextP.p.id:'';
 const folded=view==='done'&&foldCourier&&!q?shownAll.filter(nameless):[];const shown=(folded.length?shownAll.filter(p=>!folded.includes(p)):shownAll).filter(p=>p.id!==heroId);
 const pickup=active.filter(isPickup).length;const open=parcels.find(p=>p.id===openId)||null;
 // Phone notifications (Web Push through the service worker).
 const [push,setPush]=useState<'checking'|'install'|'unsupported'|'nodb'|'denied'|'off'|'on'|'busy'>('checking'),[pushMsg,setPushMsg]=useState('');const pushKey=useRef('');const pushOn=useRef(false);pushOn.current=push==='on';
 useEffect(()=>{if(!user)return;void (async()=>{const ios=/iPhone|iPad|iPod/.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||(navigator as {standalone?:boolean}).standalone===true;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setPush(ios&&!standalone?'install':'unsupported');return;}
  try{const reg=await navigator.serviceWorker.register('/sw.js');const s=await fetch('/api/push',{cache:'no-store'}).then(r=>r.json()).catch(()=>({enabled:false}));pushKey.current=s.publicKey||'';
   if(!s.enabled){setPush('nodb');return;}if(Notification.permission==='denied'){setPush('denied');return;}
   const sub=await reg.pushManager.getSubscription();setPush(sub&&Notification.permission==='granted'?'on':'off');}catch{setPush('unsupported');}})();},[user?.id]);
 // Widget and Siri use the app's own idea of what is on the way (see lib/live.ts).
 const viewSent=useRef('');
 useEffect(()=>{if(push!=='on'||busy||!data)return;const v=JSON.stringify(active.map(p=>{const e=p.eta?null:est(p);const t=isPickup(p)||outToday(p)?Date.now():p.eta?etaAt(p):e&&!e.late?e.from:NaN;return {keys:p.keys.slice(0,30),name:p.name.slice(0,200),...(Number.isFinite(t)?{when:Math.round(t)}:{})};}));if(v===viewSent.current)return;
  const id=setTimeout(()=>{void pushPost({view:{at:new Date().toISOString(),active:JSON.parse(v)}}).then(()=>{viewSent.current=v;}).catch(()=>{});},1500);return ()=>clearTimeout(id);},[push,busy,data,active]);
 // Slide a finger along the tab bar to move between tabs, like the iOS tab bars.
 const [navDrag,setNavDrag]=useState<number|null>(null);
 // Slide a finger along a row of options (like the bottom bar): the option under the finger is picked. Right-to-left order.
 const slideX=useRef<number|null>(null);
 function rowSlide(e:React.TouchEvent<HTMLElement>,count:number,pick:(i:number)=>void,moving:boolean){const x=e.touches[0]?.clientX;if(x===undefined)return;
  if(!moving){slideX.current=x;return;}if(slideX.current!==null&&Math.abs(x-slideX.current)<12)return;slideX.current=null;
  const r=e.currentTarget.getBoundingClientRect();pick(Math.min(count-1,Math.max(0,Math.floor((r.right-x)/(r.width/count)))));}
 function navSlide(e:React.TouchEvent<HTMLElement>,moving:boolean){const r=e.currentTarget.getBoundingClientRect();const x=e.touches[0]?.clientX;if(x===undefined)return;
  const pos=Math.min(2,Math.max(0,(r.right-x)/(r.width/3)-0.5));if(!moving){setNavDrag(null);return;}setNavDrag(pos);
  const key=(['list','today','stats'] as const)[Math.round(pos)];if(key!==section){setSection(key);setOpenId(null);}}
 // A short chime while the app is open and a parcel moves forward (iOS lets sound start only after a first tap).
 const audio=useRef<AudioContext|null>(null),stages=useRef<Map<string,number>|null>(null);
 useEffect(()=>{const unlock=()=>{try{audio.current??=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();void audio.current.resume();}catch{}};window.addEventListener('touchend',unlock,{once:true});window.addEventListener('click',unlock,{once:true});return ()=>{window.removeEventListener('touchend',unlock);window.removeEventListener('click',unlock);};},[]);
 function chime(){const ctx=audio.current;if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime;[[880,0],[1318.5,0.12]].forEach(([f,d])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.25,t+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d+0.45);o.connect(g).connect(ctx.destination);o.start(t+d);o.stop(t+d+0.5);});}
 useEffect(()=>{if(busy||!data)return;const now=new Map(parcels.map(p=>[p.id,p.stage]));const before=stages.current;stages.current=now;
  if(!before||!sound||document.visibilityState!=='visible')return;if(parcels.some(p=>!p.cancelled&&(before.get(p.id)??p.stage)<p.stage))chime();},[parcels,busy,data,sound]);
 async function pushPost(b:object){const r=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'הפעולה נכשלה');return d;}
 async function enablePush(){setPushMsg('');const perm=await Notification.requestPermission();if(perm!=='granted'){setPush(perm==='denied'?'denied':'off');return;}setPush('busy');
  try{const reg=await navigator.serviceWorker.ready;const key=Uint8Array.from(atob(pushKey.current.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await pushPost({subscription:sub.toJSON(),parcels:saved.current});setPush('on');}catch(e){setPush('off');setPushMsg(e instanceof Error?e.message:'לא ניתן להפעיל התראות');}}
 async function disablePush(){setPush('busy');setPushMsg('');try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await pushPost({remove:sub.endpoint}).catch(()=>{});await sub.unsubscribe();}}finally{setPush('off');}}
 async function testPush(){setPushMsg('');try{await pushPost({test:true});setPushMsg('נשלחה התראת בדיקה.');}catch(e){setPushMsg(e instanceof Error?e.message:'השליחה נכשלה');}}
 // Opening a notification lands on that parcel.
 const want=useRef<string|null>(null);useEffect(()=>{try{want.current=new URLSearchParams(location.search).get('p');}catch{}},[]);
 useEffect(()=>{const id=want.current;if(id&&data?.parcels.some(p=>p.id===id)){want.current=null;setOpenId(id);history.replaceState(null,'','/');}},[data]);
 const go=(v:typeof view)=>{setView(v);setOpenId(null);window.scrollTo({top:0,behavior:'smooth'});};
 // Manual corrections: "received" / "hide", kept on the phone, in the cloud backup and on the notification server.
 function persist(nextMarks:Record<string,'got'|'hide'>,nextManual:MailParcel[]){try{localStorage.setItem('pd_marks',JSON.stringify(nextMarks));localStorage.setItem('pd_manual',JSON.stringify(nextManual));}catch{}
  marksRef.current=nextMarks;manualRef.current=nextManual;void saveBackup(saved.current);if(pushOn.current)void pushPost({marks:nextMarks}).catch(()=>{});}
 function mark(p:Parcel,kind:'got'|'hide'|null){const next={...marks};for(const k of [p.id,...p.keys])delete next[k];if(kind)next[p.id]=kind;
  const nextManual=kind==='hide'&&p.manual?manual.filter(m=>!m.keys.some(k=>p.keys.includes(k))):manual;setMarks(next);setManual(nextManual);persist(next,nextManual);setMenu(null);if(kind==='hide')setOpenId(null);}
 function addManual(){const num=addNum.trim().toUpperCase().replace(/\s+/g,'');if(!/^[A-Z0-9-]{8,40}$/.test(num)){setAddErr('מספר מעקב צריך להיות 8-40 אותיות באנגלית ומספרים');return;}
  if(parcels.some(p=>p.tracking===num||p.keys.includes('tracking:'+num))){setAddErr('החבילה הזו כבר ברשימה');return;}
  const now=new Date().toISOString();const p:MailParcel={id:'tracking:'+num,keys:['tracking:'+num],name:addName.trim()||'חבילה '+num,shop:'',carrier:'',image:'',url:'',tracking:num,order:'',eta:'',stage:0,cancelled:false,pickup:null,events:[{id:'manual:'+num,label:'נוספה ידנית',time:now}]};
  const nextManual=[p,...manual].slice(0,100);const nextMarks={...marks};for(const m of data?.parcels||[])if(m.keys.includes('tracking:'+num))for(const k of [m.id,...m.keys])delete nextMarks[k];setMarks(nextMarks);setManual(nextManual);persist(nextMarks,nextManual);if(pushOn.current)void pushPost({parcels:[...saved.current,...nextManual],marks:nextMarks}).catch(()=>{});setAdding(false);setAddNum('');setAddName('');setAddErr('');void loadTracks([p]);}
 // SMS from the post office or a courier: pasted in the add form, or forwarded by the iPhone Shortcut.
 function applySms(texts:string[]){let cur=manualRef.current,curMarks=marksRef.current,added=0;let lastP:MailParcel|null=null;
  for(const t of texts){const p=parseSms(t);if(!p)continue;added++;lastP=p;const key=p.keys[0];
   const old=cur.find(m=>m.keys.includes(key));const base=(data?.parcels||[]).find(m=>m.keys.includes(key));
   const next=old?mergeParcels([old,p])[0]:base?{...p,name:base.name}:p;cur=[next,...cur.filter(m=>m!==old)].slice(0,100);
   curMarks={...curMarks};for(const m of [...(data?.parcels||[]),...cur])if(m.keys.includes(key))for(const k of [m.id,...m.keys])delete curMarks[k];}
  if(!added)return false;setManual(cur);setMarks(curMarks);persist(curMarks,cur);if(pushOn.current)void pushPost({parcels:[...saved.current,...cur],marks:curMarks}).catch(()=>{});
  if(lastP){void loadTracks([lastP]);setToast(added>1?'נוספו '+added+' עדכונים מ־SMS':'נקלט SMS: '+(lastP.pickup?.code?'קוד '+lastP.pickup.code:lastP.tracking));setTimeout(()=>setToast(''),4000);}return true;}
 async function pullSms(){try{const r=await fetch('/api/sms',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d.link)setSmsLink(d.link);if(d.widget)setWidgetUrl(d.widget);setSmsLast(d.last||null);if(d.items?.length)applySms(d.items.map((x:{text:string})=>x.text));}catch{}}
 const smsRef=useRef(pullSms);smsRef.current=pullSms;
 useEffect(()=>{if(!user||!data)return;void smsRef.current();let t='';try{t=new URLSearchParams(location.search).get('sms')||'';}catch{}if(t){applySms([t]);history.replaceState(null,'','/');}},[user?.id,!!data]);
 // Long press on a card opens quick actions.
 const press=useRef<{t:ReturnType<typeof setTimeout>|null;fired:boolean}>({t:null,fired:false});
 const longPress=(p:Parcel)=>({onTouchStart:()=>{press.current.fired=false;press.current.t=setTimeout(()=>{press.current.fired=true;try{navigator.vibrate?.(15);}catch{}setMenu(p);},480);},
  onTouchMove:()=>{if(press.current.t)clearTimeout(press.current.t);},onTouchEnd:()=>{if(press.current.t)clearTimeout(press.current.t);},
  onContextMenu:(e:React.MouseEvent)=>{e.preventDefault();setMenu(p);},onClick:()=>{if(press.current.fired){press.current.fired=false;return;}setOpenId(p.id);}});
 // Coordinates for Moovit, looked up once per pickup address.
 const pickPoints=active.filter(p=>isPickup(p)&&(p.pickup?.place||p.pickup?.address));
 useEffect(()=>{const need=[...new Set([...pickPoints,...(open?.pickup?[open]:[])].map(p=>placeQuery(p.pickup!)))].filter(q=>q&&!(q in geo)).slice(0,6);if(!need.length)return;
  void Promise.all(need.map(q=>fetch('/api/geo?q='+encodeURIComponent(q)).then(r=>r.json()).then(d=>[q,d.found?{lat:d.lat,lon:d.lon}:null] as const).catch(()=>[q,null] as const))).then(rows=>setGeo(g=>{const n={...g,...Object.fromEntries(rows)};try{localStorage.setItem('pd_geo',JSON.stringify(n));}catch{}return n;}));},[pickPoints.length,open?.id]);
 // Today: pickups waiting and couriers on the way.
 const todayStr=(()=>{const d=new Date();return d.getDate()+'.'+(d.getMonth()+1);})();
 const today=active.filter(p=>isPickup(p)||outToday(p)||p.eta.split('-').includes(todayStr));
 // Monthly summary from the parcels themselves.
 // Parcels ordered for someone else: tracked as usual, left out of the summary and spending.
 // Voice search: "איפה השקע?" -> the matching parcel and where it is, read out by VoiceOver (live region) or the phone's voice.
 const [canListen,setCanListen]=useState(false);useEffect(()=>{const w=window as unknown as {webkitSpeechRecognition?:unknown;SpeechRecognition?:unknown};setCanListen(!!(w.webkitSpeechRecognition||w.SpeechRecognition));},[]);
 const answerFor=(p:Parcel)=>{const n=nice(p.name);if(p.cancelled&&p.refund)return n+': ההזמנה זוכתה, '+refundText(p);if(p.stage>=4||p.got)return n+': התקבלה'+(p.events.at(-1)?' ב־'+day(p.events.at(-1)!.time):'');if(isPickup(p))return n+': מחכה לאיסוף'+(p.pickup?.place?' ב'+p.pickup.place:'')+(p.pickup?.code?', קוד '+p.pickup.code:'');if(outToday(p))return n+': יצאה למסירה היום';const e=p.eta?null:est(p);return n+': '+statusText(p)+(p.eta?', הגעה '+p.eta:e&&!e.late?', צפי '+estText(e):'');};
 const listen=()=>{const W=window as unknown as {webkitSpeechRecognition?:new()=>any;SpeechRecognition?:new()=>any};const R=W.SpeechRecognition||W.webkitSpeechRecognition;if(!R||listening)return;
  const r=new R();r.lang='he-IL';r.interimResults=false;r.maxAlternatives=1;setListening(true);setHeard('');setHeardSay('');
  r.onresult=(ev:any)=>{const said=String(ev.results?.[0]?.[0]?.transcript||'');const term=said.replace(/[?؟.!]/g,' ').replace(/^\s*(?:איפה|מה עם|מה קורה עם|מתי (?:מגיע|מגיעה|יגיע|תגיע)|תגיד(?: לי)? איפה)\s+/,'').replace(/^(?:ה)(?=[א-ת]{3,})/,'').trim();
   setSearch(term);const t=term.toLowerCase();const terms=searchTerms(t);const hits=[...byEta(active),...done].filter(p=>{const hay=[p.name,nice(p.name),p.shop,p.carrier,p.tracking,p.order,...(p.items||[])].join(' ').toLowerCase();return terms.some(x=>hay.includes(x));});
   const msg=!hits.length?'לא מצאתי חבילה בשם '+term:hits.length===1?answerFor(hits[0]):'מצאתי '+hits.length+'. '+hits.slice(0,2).map(answerFor).join('. ');setHeard(msg);
   // Spoken version: pickup codes letter by letter ("ב 214" -> "ב 2 1 4"), so they are read clearly.
   setHeardSay(msg.replace(/קוד ([^,.]+)/g,(_,c:string)=>'קוד '+c.replace(/\s+/g,'').split('').join(' ')));};
  r.onerror=()=>{setListening(false);setHeardSay('');setHeard('לא שמעתי. נסה שוב.');};r.onend=()=>setListening(false);try{r.start();}catch{setListening(false);}};
 othersRef.current=others;
 const isOther=(p:Parcel)=>others.includes(p.id)||p.keys.some(k=>others.includes(k));
 const toggleOther=(p:Parcel)=>{const on=!isOther(p);const next=on?[...others,p.id,...p.keys.slice(0,5)]:others.filter(k=>k!==p.id&&!p.keys.includes(k));const uniq=[...new Set(next)].slice(-500);setOthers(uniq);setPref('pd_others',JSON.stringify(uniq));};
 const stats=useMemo(()=>{const d=new Date();const ref=new Date(d.getFullYear(),d.getMonth()-month,1);const end=new Date(ref.getFullYear(),ref.getMonth()+1,1);
  const inMonth=(t:string)=>{const x=new Date(t);return x>=ref&&x<end;};const first=(p:Parcel)=>p.events[0]?.time||'';
  const all=parcels.filter(p=>!p.cancelled&&!isOther(p));const ordered=all.filter(p=>inMonth(first(p)));const delivered=all.filter(p=>p.stage===4&&!p.stale&&inMonth(p.events.at(-1)?.time||''));
  const shops=Object.entries(ordered.reduce((m,p)=>{const k=p.shop||'אחר';m[k]=(m[k]||0)+1;return m;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const durs=all.filter(p=>p.stage===4&&!p.stale&&!p.got&&!p.returned&&p.events.length>1).map(p=>(new Date(p.events.at(-1)!.time).getTime()-new Date(first(p)).getTime())/864e5).filter(x=>x>0.5&&x<120);
  const avg=durs.length?Math.round(durs.reduce((a,b)=>a+b,0)/durs.length):0;
  // Spending: orders placed this month (cancelled ones too) minus money that came back this month.
  const paid=parcels.filter(p=>!p.ret&&!isOther(p)&&inMonth(first(p)));const spent=paid.reduce((a,p)=>a+shekels(p.price),0);const byShop=Object.entries(paid.reduce((m,p)=>{const v=shekels(p.price);if(v){const k=p.shop||'אחר';m[k]=(m[k]||0)+v;}return m;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const back=parcels.filter(p=>p.refund&&!isOther(p)&&inMonth(p.refund.at));const refunded=back.filter(p=>!p.refund!.bonus).reduce((a,p)=>a+shekels(p.refund!.amount),0),bonus=back.filter(p=>p.refund!.bonus).reduce((a,p)=>a+shekels(p.refund!.amount),0);const unknown=paid.filter(p=>!shekels(p.price)).length;
  return {spent,byShop,refunded,bonus,unknown,label:ref.toLocaleDateString('he-IL',{month:'long',year:'numeric'}),ordered:ordered.length,delivered:delivered.length,shops,avg,fast:durs.length?Math.round(Math.min(...durs)):0,slow:durs.length?Math.round(Math.max(...durs)):0,n:durs.length};},[parcels,month,others]);
// The animation replaces the list on first load and while new mail is read; a quick check on return keeps the list.
 // The loader only covers an empty screen; parcels already known stay visible while new mail is read.
 const waiting=(!data&&!error)||(busy&&!data?.parcels.length);
 const hiddenCount=Object.values(marks).filter(v=>v==='hide').length;

 return <main className={['app','app large','app xlarge'][size]+(view==='account'||open?' nonav':'')}>
 {splash!=='off'&&<div className={'splash'+(splash==='out'?' out':'')} aria-hidden="true"><Mark cls="smark" anim="open"/><div className="sname" dir="ltr">Unbox</div></div>}
 {user&&pull>0&&view!=='account'&&<div className={'ptr'+(pull>=80?' ready':'')} style={{transform:'translate(-50%,'+Math.max(0,pull-46)+'px)',opacity:Math.min(1,pull/80)}} aria-hidden="true"><RefreshCw style={{transform:'rotate('+pull*3+'deg)'}}/></div>}
 <header className="top">
  <div className="row"><span className="brand" dir="ltr" aria-label="Unbox"><Mark/><span aria-hidden="true">nbox</span></span>
   <div className="actions">{user&&view!=='account'&&<button className="ib" aria-label="הוספת חבילה לפי מספר מעקב" onClick={()=>{setAdding(true);setAddErr('');}}><Plus/></button>}<button className="ib" aria-label="הגדרות" aria-pressed={view==='account'} onClick={()=>go(view==='account'?'active':'account')}><Settings/></button></div></div>
  <h1>{view==='account'?'הגדרות':section==='today'?'איסוף':section==='stats'?'סיכום':view==='done'?'נמסרו':filter==='pickup'?'לאיסוף':'החבילות שלי'}</h1>
  {user&&view!=='account'&&progress&&busy&&<div className="progress"><div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct} aria-label="התקדמות הסריקה"><i style={{width:progress.pct+'%'}}/></div><div className="plabel" aria-live="polite"><span>{progress.label}</span><b>{progress.pct}%</b></div></div>}
  {user&&view!=='account'&&!(progress&&busy)&&<p className="sub" role="status">{busy?(progress?.label&&progress.label!=='אין מיילים חדשים'?progress.label:'בודק את Gmail…'):error?(!gmail||errorCode==='NO_GMAIL'?'קריאת Gmail לא אושרה':'הסריקה לא הושלמה'):data?ago(data.updated):'ממתין לסריקה'}</p>}
 </header>
 {user&&view!=='account'&&section==='list'&&data&&!waiting&&<div className="tiles" role="tablist" aria-label="סינון חבילות" onTouchStart={e=>rowSlide(e,3,()=>{},false)} onTouchMove={e=>rowSlide(e,3,i=>{const [k,f]=([['active','all'],['active','pickup'],['done','all']] as const)[i];if(!(view===k&&(k==='done'||filter===f))){setFilter(f);go(k);}},true)}>{([['active','all','בדרך',active.length],['active','pickup','לאיסוף',pickup],['done','all','נמסרו',done.length]] as const).map(([key,f,label,n])=>{const on=view===key&&(key==='done'||filter===f);return <button key={label} role="tab" aria-selected={on} className={'tile'+(on?' on':'')+(f==='pickup'?' p':'')} onClick={()=>{setFilter(f);go(key);}}><b>{data?n:'–'}</b><span>{label}</span></button>;})}</div>}

 {view==='account'?<div className="settings">
  <section className="set"><h3>תצוגה</h3>
   <div className="setRow"><span>גודל טקסט</span></div>
   <div className="seg" role="radiogroup" aria-label="גודל טקסט" style={{marginBottom:8}}>{['רגיל','גדול','גדול מאוד'].map((l,i)=><button key={i} role="radio" aria-checked={size===i} className={size===i?'on':''} onClick={()=>{setSize(i);setPref('pd_size',String(i));}}>{l}</button>)}</div>
   <label className="setRow"><span>צפי הגעה</span><input type="checkbox" className="sw" checked={showEst} onChange={e=>{setShowEst(e.target.checked);setPref('pd_est',e.target.checked?'1':'0');}}/></label>
   <label className="setRow"><span>צליל כשיש עדכון</span><input type="checkbox" className="sw" checked={sound} onChange={e=>{setSound(e.target.checked);setPref('pd_sound',e.target.checked?'1':'0');if(e.target.checked){try{audio.current??=new AudioContext();void audio.current.resume().then(chime);}catch{}}}}/></label>
   <label className="setRow"><span>כרטיס "החבילה הבאה"</span><input type="checkbox" className="sw" checked={showNext} onChange={e=>{setShowNext(e.target.checked);setPref('pd_next',e.target.checked?'1':'0');}}/></label>
   <label className="setRow"><span>לקפל הודעות שליח בלי שם ב"נמסרו"</span><input type="checkbox" className="sw" checked={foldCourier} onChange={e=>{setFoldCourier(e.target.checked);setPref('pd_fold',e.target.checked?'1':'0');}}/></label>
   <label className="setRow"><span>מפת "איפה החבילה"</span><input type="checkbox" className="sw" checked={showMap} onChange={e=>{setShowMap(e.target.checked);setPref('pd_map',e.target.checked?'1':'0');}}/></label></section>
  {user&&<section className="set"><h3>סנכרון</h3>
   <label className="setRow"><span>רענון אוטומטי בכל כניסה</span><input type="checkbox" className="sw" checked={auto} onChange={e=>{setAuto(e.target.checked);setPref('pd_auto',e.target.checked?'1':'0');}}/></label>
   <p className="setNote">{data?ago(data.updated):'עדיין לא נסרק'}. אפשר גם למשוך את הרשימה למטה.</p>
   <button className="ghost" disabled={busy} onClick={()=>{seen.current=new Set();saved.current=[];setData(null);go('active');void sync();}}><RefreshCw size={18}/> סריקה מחדש של כל המיילים</button></section>}
  {user&&<section className="set backupCard"><div className="row"><h3><Cloud size={20}/> גיבוי בענן</h3><span className={'bstate '+backup.state}>{backup.state==='on'?'פעיל ✓':backup.state==='saving'?'שומר…':backup.state==='error'?'שגיאה':'כבוי'}</span></div>
   {backup.state==='off'?<><p className="setNote">החבילות והשמות שערכת יישמרו בתיקייה נסתרת ב־Google Drive שלך, ויחזרו בכל מכשיר.</p><form action={login}><GoogleButton label="הפעל גיבוי עם Google" disabled={!configured}/></form></>
   :<><p className="setNote">{backup.msg||('נשמר בתיקייה נסתרת ב־Google Drive שלך.'+(backup.updated?' גיבוי אחרון: '+new Date(backup.updated).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):''))}</p>
    <button className="ghost" disabled={backup.state==='saving'||busy} onClick={()=>saveBackup(data?.parcels||[])}><CloudUpload size={18}/> גבה עכשיו</button></>}</section>}
  {user&&<section className="set"><h3>מקורות מעקב</h3>
   <div className="setRow"><span>17TRACK</span><span className={'bstate '+(sources?.t17?'on':'off')}>{sources?(sources.t17?'עובד ✓':'לא ענה'):'ייבדק ברענון'}</span></div>
   <div className="setRow"><span>Cainiao</span><span className={'bstate '+(sources?.cainiao==='ok'?'on':'off')}>{!sources?'ייבדק ברענון':sources.cainiao==='ok'?'עובד ✓':sources.cainiao==='blocked'?'חסום':'אין חבילות לבדוק'}</span></div>
   <p className="setNote">המידע מחברות השילוח משלים את מה שכתוב במיילים.</p></section>}
  {user&&<section className="set"><div className="row"><h3><Bell size={20}/> התראות</h3><span className={'bstate '+(push==='on'?'on':'off')}>{push==='on'?'פעיל ✓':push==='busy'||push==='checking'?'…':'כבוי'}</span></div>
   <p className="setNote">מוכנה לאיסוף עם הקוד, יצאה למסירה, נמסרה, הזמנה חדשה, וחבילה בלי עדכון 10 ימים. נבדק כל חצי שעה בערך, גם כשהאפליקציה סגורה.</p>
   {push==='install'?<p className="setNote">באייפון התראות עובדות רק מהאפליקציה במסך הבית. פתח את Unbox מהאייקון ונסה שוב.</p>
   :push==='unsupported'?<p className="setNote">המכשיר או הדפדפן לא תומכים בהתראות.</p>
   :push==='nodb'?<p className="setNote">ההתראות עוד לא הוגדרו בשרת.</p>
   :push==='denied'?<p className="setNote">ההתראות חסומות. אפשר לאפשר ב: הגדרות האייפון ← התראות ← Unbox.</p>
   :push==='on'?<><button className="ghost" onClick={testPush}><Bell size={18}/> שלח התראת בדיקה</button><button className="ghost" onClick={disablePush}>כבה התראות</button></>
   :<button className="primary wide" disabled={push!=='off'} onClick={enablePush}><Bell size={18}/> הפעל התראות</button>}
   {pushMsg&&<p className="setNote" role="status">{pushMsg}</p>}</section>}
  {user&&smsLink&&<section className="set"><h3>SMS אוטומטי</h3>
   <p className="setNote">הודעות מהדואר, HFD, צ'יטה, תפוז ושאר השליחים ייכנסו לבד, עם מספר המעקב וקוד האיסוף. מגדירים פעם אחת באפליקציית קיצורי הדרך:</p>
   <ol className="steps2"><li>קיצורים ← אוטומציה ← אוטומציה חדשה ← <b>הודעה</b>.</li><li>"ההודעה מכילה": <b>חבילה</b>. בחר <b>הרץ מיד</b>. כדאי ליצור עוד שתיים, ל<b>משלוח</b> ול<b>שליח</b>, כדי שגם הודעות מתפוז, KSP ואורבניקה ייכנסו.</li><li>פעולה: <b>קבל תוכן של URL</b>. בכתובת הדבק את הקישור האישי, שיטה <b>POST</b>, גוף בקשה <b>טקסט</b> = תוכן ההודעה.</li></ol>
   <button className="ghost" onClick={()=>copy(smsLink)}><Copy size={18}/> {copied===smsLink?'הקישור הועתק ✓':'העתקת הקישור האישי'}</button>
   <p className="setNote" role="status">{smsLast?'הודעה אחרונה הגיעה ב־'+new Date(smsLast.at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})+(smsLast.kind==='parcel'?' וזוהתה כחבילה ✓':smsLast.kind==='empty'?', אבל בלי טקסט':', אבל לא נמצא בה מספר מעקב'):'עדיין לא הגיעה אף הודעה מהקיצור.'}</p>
   <p className="setNote">הקישור אישי. אל תשתף אותו.</p></section>}
  {user&&widgetUrl&&<section className="set"><h3><Smartphone size={20}/> ווידג'ט למסך הבית</h3>
   <p className="setNote">{push==='on'?'עובד דרך אפליקציית Scriptable, ומתעדכן עם ההתראות.':'עובד דרך Scriptable ומתעדכן מהשרת של ההתראות, אז צריך שההתראות יהיו פעילות.'}</p>
   <ol className="steps2"><li>העתק את הסקריפט.</li><li>ב־Scriptable: <b>+</b>, הדבק, ושמור בשם <b>Unbox</b>.</li><li>במסך הבית: לחיצה ארוכה ← <b>+</b> ← Scriptable ← גודל קטן או בינוני. בהגדרות הווידג'ט בחר את הסקריפט <b>Unbox</b>.</li></ol>
   <button className="ghost" onClick={()=>copy(widgetScript(widgetUrl))}><Copy size={18}/> {copied===widgetScript(widgetUrl)?'הסקריפט הועתק ✓':'העתקת הסקריפט'}</button></section>}
  {user&&<section className="set"><h3>מעקב אצל חברות השליחויות</h3>
   {phone&&!phoneEdit?<><div className="setRow"><span>טלפון <b dir="ltr">{phone.replace(/^(\d{3})(\d{3})(\d+)$/,'$1-$2$3')}</b></span><button className="linkBtn" onClick={()=>{setPhoneDraft(phone);setPhoneEdit(true);}}>עריכה</button></div>
    <p className="setNote">השרת בודק לפי המספר משלוחים אצל חברות משלוחים בארץ.</p></>
   :<><p className="setNote">עם מספר הטלפון שלך, השרת בודק בעצמו משלוחים אצל חברות משלוחים בארץ, גם כשלא הגיע עליהם מייל. המספר נשלח רק אליהן.</p>
   <label className="setRow" htmlFor="phoneIn"><span>מספר טלפון</span></label>
   <input id="phoneIn" className="phoneIn" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={phoneDraft} onChange={e=>setPhoneDraft(e.target.value)}/>
   <button className="ghost" onClick={()=>{const v=phoneDraft.replace(/\D/g,'');if(v&&!/^0\d{8,9}$/.test(v)){setToast('מספר לא תקין');return;}setPhoneEdit(false);if(v===phone)return;setPhone(v);phoneRef.current=v;setPref('pd_phone',v);if(!v){setPhoneParcels([]);setPref('pd_phone_parcels','[]');}if(pushOn.current)void pushPost({phone:v}).catch(()=>{});if(v)void loadByPhone();setToast(v?'נשמר ✓':'המספר הוסר');}}>{phone&&!phoneDraft.trim()?'הסרת המספר':'שמירה'}</button></>}</section>}
  {user&&widgetUrl&&<section className="set"><h3><Mic size={20}/> לשאול את Siri</h3>
   <p className="setNote">אומרים "היי Siri, איפה החבילות שלי" ושומעים מה מחכה לאיסוף ועם איזה קוד, מה מגיע היום ומה בדרך. {push==='on'?'':'צריך שההתראות יהיו פעילות.'}</p>
   <ol className="steps2"><li>העתק את הקישור האישי.</li><li>באפליקציית קיצורים: <b>+</b> ← הוסף פעולה <b>קבל תוכן של URL</b> והדבק את הקישור.</li><li>הוסף פעולה <b>דבר טקסט</b>.</li><li>שמור את הקיצור בשם <b>איפה החבילות שלי</b>.</li></ol>
   <button className="ghost" onClick={()=>copy(widgetUrl.replace('/api/widget','/api/speak'))}><Copy size={18}/> {copied===widgetUrl.replace('/api/widget','/api/speak')?'הקישור הועתק ✓':'העתקת הקישור האישי'}</button>
   <button className="ghost" onClick={async()=>{try{const t=await (await fetch(widgetUrl.replace('/api/widget','/api/speak'),{cache:'no-store'})).text();const u=new SpeechSynthesisUtterance(t);u.lang='he-IL';speechSynthesis.cancel();speechSynthesis.speak(u);setToast(t);}catch{setToast('לא הצלחתי להשמיע כרגע');}}}><Volume2 size={18}/> השמע עכשיו</button>
   <p className="setNote">הקישור אישי. אל תשתף אותו.</p></section>}
  {user&&hiddenCount>0&&<section className="set"><h3>חבילות מוסתרות</h3><p className="setNote">הסתרת {hiddenCount} פריטים שזוהו בטעות כחבילות.</p><button className="ghost" onClick={()=>{const next=Object.fromEntries(Object.entries(marks).filter(([,v])=>v!=='hide')) as Record<string,'got'|'hide'>;setMarks(next);persist(next,manual);}}><Undo2 size={18}/> החזר את כולם</button></section>}
  <section className="set"><h3>חשבון</h3>
   {user?<><div className="setRow"><span>{user.name||'Google'}</span></div><p className="setNote mono" dir="ltr">{user.email}</p>
    <p className="setNote">קריאה בלבד מ־Gmail. תוכן המיילים לא נשמר.</p>
    <button className="ghost" onClick={()=>signOut({callbackUrl:'/'})}>יציאה מהחשבון</button></>
   :<form action={login}><GoogleButton label="התחבר עם Google" disabled={!configured}/></form>}</section>
  <section className="set"><h3>אודות</h3>
   <p className="setNote">להתקנה: Safari ← שיתוף ← הוספה למסך הבית.</p>
   <p className="setNote"><a href="/privacy">מדיניות פרטיות</a></p></section>
 </div>:<>
  {!configured&&<section className="notice"><h2>Unbox מוכנה לחיבור</h2><p>חיבור Google עדיין לא הוגדר. נתוני הדגמה אינם מוצגים.</p></section>}
  {!user?<section className="panel empty"><Mail size={44}/><h2>כל החבילות שלך במקום אחד</h2><p>התחבר עם Google כדי לאסוף את הודעות ההזמנה והמשלוח מ־Gmail.</p><form action={login}><GoogleButton label="התחבר עם Google" disabled={!configured}/></form></section>:<>
   {(waiting)&&<div className="loader" role="status"><Mark cls="lmark" anim="bob"/><p>{progress?'מביא את החבילות שלך…':'בודק את Gmail…'}</p>{slow&&!progress&&<button className="ghost" onClick={()=>location.reload()}>לוקח יותר מדי זמן? נסה שוב</button>}</div>}
   {!(waiting)&&section==='today'&&<div className="list">{today.length?<>{pickPoints.map(p=>{const pk=p.pickup!;const q=placeQuery(pk);return <section key={p.id} className="box mapCard">
     <iframe title={'מפה: '+pk.place} src={'https://maps.google.com/maps?q='+encodeURIComponent(q)+'&hl=iw&z=16&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
     <p className="place">{pk.place||pk.address}</p>{pk.place&&pk.address&&<p className="addr">{pk.address}</p>}{pk.hours&&<p className="addr">שעות: {pk.hours}</p>}
     <p className="addr">{bidi(p.name)}</p>{pk.code&&<button className="code" onClick={()=>copy(pk.code)}><KeyRound size={20}/><span>קוד איסוף</span><b dir="ltr">{pk.code}</b>{copied===pk.code?' ✓':<Copy size={17}/>}</button>}
     <NavLinks pk={pk} geo={geo[q]}/></section>;})}
    {today.filter(p=>isPickup(p)&&!pickPoints.includes(p)).map(p=><button key={p.id} className="card focus" {...longPress(p)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><div className="st"><span className={'pill '+tone(p)}>{isPickup(p)||outToday(p)?statusText(p):'צפויה היום'}</span></div>
     {isPickup(p)&&p.pickup?.place&&<p className="todayWhere">איסוף ב<b>{p.pickup.place}</b></p>}{isPickup(p)&&p.pickup?.code&&<p className="todayCode">קוד <b dir="ltr">{p.pickup.code}</b></p>}</div></div></button>)}
    {today.some(p=>!isPickup(p))&&<h3 className="listH">מגיעות היום</h3>}{today.filter(p=>!isPickup(p)).map(p=><button key={p.id} className="card focus" {...longPress(p)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><div className="st"><span className={'pill '+tone(p)}>{isPickup(p)||outToday(p)?statusText(p):'צפויה היום'}</span></div>
     {isPickup(p)&&p.pickup?.place&&<p className="todayWhere">איסוף ב<b>{p.pickup.place}</b></p>}{isPickup(p)&&p.pickup?.code&&<p className="todayCode">קוד <b dir="ltr">{p.pickup.code}</b></p>}</div></div></button>)}</>
    :<section className="panel empty"><MapPin size={40}/><h2>אין חבילות לאיסוף</h2><p>כשחבילה תגיע לנקודת איסוף, תופיע כאן עם מפה, קוד וניווט.</p></section>}</div>}
   {!(waiting)&&section==='stats'&&<div className="statsWrap">
    <div className="seg" role="radiogroup" aria-label="חודש" onTouchStart={e=>rowSlide(e,2,setMonth,false)} onTouchMove={e=>rowSlide(e,2,i=>{if(i!==month)setMonth(i);},true)}>{['החודש','החודש שעבר'].map((l,i)=><button key={i} role="radio" aria-checked={month===i} className={month===i?'on':''} onClick={()=>setMonth(i)}>{l}</button>)}</div>
    <div className="statGrid"><div className="stat"><b>{stats.ordered}</b><span>הזמנות</span></div><div className="stat"><b>{stats.delivered}</b><span>הגיעו</span></div><div className="stat" aria-label={stats.avg?'בממוצע '+stats.avg+' ימים להגעה':'אין עדיין ממוצע'}><b>{stats.avg||'–'}{stats.avg?<small> ימים</small>:null}</b><span>בממוצע</span></div></div>
    {(stats.spent>0||stats.refunded>0)&&<section className="box money"><h3><Wallet size={18}/> הוצאות ב{stats.label}</h3>
     <p className="moneyBig" aria-label={'הוצאת '+Math.round(stats.spent)+' שקלים'+(stats.refunded?', הוחזרו '+Math.round(stats.refunded)+' שקלים':'')}><b>₪{Math.round(stats.spent).toLocaleString('he-IL')}</b>{stats.refunded>0&&<span>הוחזרו ₪{Math.round(stats.refunded).toLocaleString('he-IL')}</span>}</p>
     {stats.byShop.map(([shop,v])=><div key={shop} className="shopRow"><span dir="auto">{shop}</span><i style={{width:Math.max(8,100*v/stats.byShop[0][1])+'%'}}/><b>₪{Math.round(v)}</b></div>)}
     {(stats.bonus>0||stats.unknown>0)&&<p className="setNote">{stats.bonus>0?'עוד ₪'+Math.round(stats.bonus)+' הוחזרו כבונוס באתר. ':''}{stats.unknown>0?stats.unknown+' הזמנות בלי סכום בשקלים לא נספרו.':''}</p>}</section>}
    {stats.shops.length>0&&<section className="box"><h3>חנויות ב{stats.label}</h3>{stats.shops.map(([shop,n])=><div key={shop} className="shopRow"><span dir="auto">{shop}</span><i style={{width:Math.max(8,100*n/stats.shops[0][1])+'%'}}/><b>{n}</b></div>)}</section>}
    {stats.n>0&&<section className="box"><h3>זמן הגעה</h3><p className="setNote">מההזמנה ועד שהחבילה אצלך: בממוצע {stats.avg} ימים. הכי מהירה {stats.fast}, הכי איטית {stats.slow}. לפי {stats.n} חבילות שהגיעו.</p></section>}
    {!stats.ordered&&!stats.delivered&&<section className="panel empty"><ChartColumn size={40}/><h2>אין הזמנות ב{stats.label}</h2></section>}</div>}
   {!(waiting)&&section==='list'&&<><label className="search"><Search size={20}/><input aria-label="חיפוש חבילות" placeholder="חיפוש מוצר, חנות או מספר מעקב" value={search} onChange={e=>{setSearch(e.target.value);setHeard('');}}/>{canListen&&<button type="button" className={'micBtn'+(listening?' on':'')} aria-label={listening?'מקשיב, דבר עכשיו':'חיפוש בקול: שאל איפה חבילה'} onClick={listen}><Mic size={20}/></button>}</label>
   {heard&&<p className="voiceAnswer" role="status" aria-live="assertive"><span aria-hidden="true">{heard}</span><span className="sr">{heardSay||heard}</span></p>}
   {showNext&&view==='active'&&filter==='all'&&!search&&nextP&&<NextCard p={nextP.p} when={nextP.t} onOpen={()=>setOpenId(nextP.p.id)}/>}
   {error&&<div className="error" role="alert"><span>{error}</span>{['NO_GMAIL','RECONNECT','UNAUTHORIZED'].includes(errorCode)?<form action={login}><button className="primary">חידוש הרשאת Google</button></form>:<button className="ghost" onClick={()=>sync()}>נסה שוב</button>}</div>}
   <div className="list">{shown.map(p=><button key={p.id} className={'card '+(isPickup(p)||outToday(p)?'focus':'')} {...longPress(p)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><Meta p={p}/><div className="st"><span className={'pill '+tone(p)}>{statusText(p)}</span>{p.stage===3&&p.pickup?.place&&!p.cancelled?<span className="eta">איסוף ב<b>{p.pickup.place}</b></span>:p.eta&&!p.cancelled?<span className="eta">הגעה <b>{p.eta}</b></span>:showEst&&(()=>{const e=est(p);return e&&<span className="eta">{e.late?<b>{estText(e)}</b>:<>צפי <b>{estText(e)}</b></>}</span>;})()}</div>{customsDue(p)&&<div className="guardTag customsTag"><ShieldAlert size={16}/> לתשלום מכס{p.customs!.amount?' '+p.customs!.amount:''}</div>}{p.refund&&<div className="guardTag refundTag"><Undo2 size={16}/> {refundText(p)}</div>}{p.missing?.length&&p.stage>=2?<div className="guardTag"><ShieldAlert size={16}/> לא בחבילה: {p.missing.map(nice).join(', ')}</div>:null}{isOther(p)&&<div className="otherTag"><Users size={15}/> בשביל מישהו אחר</div>}{guardOf(p)&&<div className="guardTag"><ShieldAlert size={16}/> ההזמנה תיסגר בקרוב, החבילה לא הגיעה</div>}{p.ask&&<div className="askRow" onClick={e=>e.stopPropagation()}><span>הגיעה?</span><span role="button" tabIndex={0} className="askYes" onClick={()=>mark(p,'got')}>כן</span><span role="button" tabIndex={0} className="askNo" onClick={()=>{const n={...snooze,[p.id]:Date.now()+5*864e5};setSnooze(n);setPref('pd_snooze',JSON.stringify(n));}}>עדיין לא</span></div>}</div></div>
    <Bar p={p}/></button>)}</div>
   {folded.length>0&&<details className="box fold foldList"><summary><span>{folded.length} הודעות שליח בלי שם</span><b>הצג</b></summary><div className="list">{folded.map(p=><button key={p.id} className="card" {...longPress(p)} aria-label={p.name+', '+statusText(p)}><div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><Meta p={p}/><div className="st"><span className={'pill '+tone(p)}>{statusText(p)}</span></div></div></div></button>)}</div></details>}

   {!shown.length&&!busy&&data&&<section className="panel empty"><Package size={40}/><h2>{q?'לא נמצאו חבילות':view==='done'?'אין חבילות שנמסרו':filter==='pickup'?'אין חבילות לאיסוף':'אין חבילות בדרך'}</h2><p>{q?'נסה מילה אחרת.':'חבילות חדשות יופיעו כאן אחרי רענון.'}</p></section>}
   </>}
  </>}
 </>}

 {open&&<div className="sheet" role="dialog" aria-modal="true" aria-label={open.name}>
  <div className="sheetTop"><button className="ib" aria-label="חזרה" onClick={()=>setOpenId(null)}><ChevronRight/></button><button className="ib" aria-label="עריכת שם" disabled={!storage} title={!storage?'שמירת שמות דורשת גיבוי בענן':undefined} onClick={()=>{setEdit(open);setDraft(open.name);setEditError('');}}><Pencil size={20}/></button></div>
  <Thumb p={open} big/>{(()=>{const d=DESC[open.image]||(open.images?.[0]&&DESC[open.images[0]]);return d?<p className="photoDesc">{d}</p>:null;})()}
  <div className="dt"><h2>{bidi(open.name)}</h2><Meta p={open}/></div>
  {open.items&&open.items.length>1&&<section className="box items"><h3>מה בחבילה</h3><ul>{open.items.map(n=><li key={n}>{bidi(nice(n))}</li>)}</ul></section>}
  <section className="box"><div className="row"><span className={'pill '+tone(open)}>{statusText(open)}</span>{open.eta&&!open.cancelled?<span className="eta">הגעה <b>{open.eta}</b></span>:showEst&&(()=>{const e=est(open);return e&&<span className="eta" title={'לפי '+e.n+' חבילות קודמות שלך, '+e.stage}>{e.late?<b>{estText(e)}</b>:<>צפי <b>{estText(e)}</b></>}</span>;})()}</div>{open.refund&&<div className="guardTag refundTag"><Undo2 size={16}/> {refundText(open)}</div>}{open.missing?.length?<div className="guardTag"><ShieldAlert size={16}/> לפי מייל החבילה, אלה לא נשלחו בה: {open.missing.map(nice).join(', ')}. ייתכן שיגיעו בנפרד.</div>:null}
   {!open.cancelled&&<div className={'steps '+tone(open)} style={{'--p':step(open)/4} as React.CSSProperties}>{STEP.map((s,i)=><div key={s} className={'sp '+(i<step(open)?'d':i===step(open)?'c':'')}><span/>{i===3&&step(open)>=3&&!isPickup(open)?'במסירה':s}</div>)}</div>}</section>
  {(()=>{const c=customsDue(open);if(!c)return null;return <section className="box guardBox customsBox"><h3><ShieldAlert size={18}/> לתשלום מכס ומסים</h3>
   <p className="setNote">החבילה מחכה לתשלום לפני שחרור{c.amount?': '+c.amount:''}. בלי תשלום היא לא תמשיך ועלולה לחזור לשולח.</p>
   <a className="primary" href={c.url||'https://doar.israelpost.co.il/'} target="_blank" rel="noopener noreferrer">{c.url?'לתשלום באתר הרשמי':'לאתר דואר ישראל'}</a>
   <p className="setNote">שלם רק דרך האתר הרשמי. הודעות SMS עם קישור לתשלום מכס הן לרוב הונאה.</p></section>;})()}
  {(()=>{const g=guardOf(open);if(!g)return null;return <section className="box guardBox"><h3><ShieldAlert size={18}/> שומר החזר כספי</h3>
   <p className="setNote">AliExpress הודיעה ב־{new Date(g.since).toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})} שההזמנה תסומן בקרוב כהושלמה. אם החבילה לא אצלך, פתח מחלוקת לפני שזה קורה.{open.price?' שילמת '+open.price+'.':''}</p>
   <div className="msg" dir="ltr">{disputeText(open)}</div>
   <button className="primary" onClick={()=>{void copy(disputeText(open));const u=orderUrl(open);if(u)window.open(u,'_blank','noopener');}}>{copied===disputeText(open)?'הועתק ✓ ':''}העתק הודעה ופתח את ההזמנה</button>
   <button className="ghost" onClick={()=>mark(open,'got')}>החבילה הגיעה</button></section>;})()}
  {showMap&&<Journey p={open}/>}
  {open.pickup&&open.stage<4&&!open.cancelled&&<section className="box pickup"><h3><MapPin size={18}/> נקודת איסוף</h3>
   {open.pickup.place&&<p className="place">{open.pickup.place}</p>}{open.pickup.address&&<p className="addr">{open.pickup.address}</p>}{open.pickup.hours&&<p className="addr">שעות: {open.pickup.hours}</p>}
   {open.pickup.code&&<button className="code" onClick={()=>copy(open.pickup!.code)} aria-label={'קוד איסוף '+open.pickup.code.split('').join(' ')+', העתקה'}><KeyRound size={20}/><span>קוד איסוף</span><b dir="ltr">{open.pickup.code}</b>{copied===open.pickup.code?' ✓':<Copy size={17}/>}</button>}
   {(open.pickup.address||open.pickup.place)&&<NavLinks pk={open.pickup} geo={geo[placeQuery(open.pickup)]}/>}
   <div className="pickActions"><button className="ghost" onClick={()=>sharePickup(open)}><Share2 size={18}/> שליחה למי שיאסוף</button>{open.pickup.url&&<a className="ghost" href={open.pickup.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/> שעות פתיחה</a>}</div></section>}
  {open.tracking&&trackState==='on'&&open.trackPending&&open.stage<4&&<p className="trackNote">מספר המעקב נרשם אצל חברת השילוח. העדכונים שלה יופיעו כאן בדקות הקרובות.</p>}
  <section className="box"><h3>מסלול</h3>{[...timeline(open.events)].reverse().map((e,i)=><div key={e.id} className={'ev '+(!i?'l':'')}><span className="dot"/><div><strong dir="auto">{e.src?cleanLabel(e.label):shortLabel(cleanLabel(e.label))}</strong>{e.src?<span className="src">מ־{e.src}</span>:/^(?:manual|bd|sms|t|trk):/.test(e.id)?null:<a href={'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(user?.email||'')+'#all/'+encodeURIComponent(e.id)} target="_blank" rel="noopener noreferrer">המייל המקורי <ExternalLink size={13}/></a>}</div><time dateTime={e.time}>{when(e.time)}</time></div>)}{upcoming(open).length>0&&<div className="ahead" aria-label={'השלבים הבאים: '+upcoming(open).join(', ')}>{upcoming(open).map((l,i)=><div key={l} className={'ev f'+(!i?' n':'')}><span className="dot"/><div><strong>{!i?'הבא: '+l:l}</strong></div></div>)}</div>}</section>
  {(open.tracking||open.order||open.url)&&<section className="box">
   {open.tracking&&<div className="kv"><span>מספר מעקב</span><button className="copy" onClick={()=>copy(open.tracking)}><b dir="ltr">{open.tracking}</b>{copied===open.tracking?' ✓':<Copy size={15}/>}</button></div>}
   {open.order&&<div className="kv"><span>מספר הזמנה</span><button className="copy" onClick={()=>copy(open.order)}><b dir="ltr">{open.order}</b>{copied===open.order?' ✓':<Copy size={15}/>}</button></div>}
   {open.url&&<a className="link" href={open.url} target="_blank" rel="noopener noreferrer">מעקב באתר החנות <ExternalLink size={15}/></a>}
  </section>}
  <div className="sheetActions">{calDay(open)&&<button className="ghost" onClick={()=>addToCalendar(open)}><CalendarCheck size={18}/> הוספה ליומן</button>}{open.got?<button className="ghost" onClick={()=>mark(open,null)}><Undo2 size={18}/> בטל "קיבלתי"</button>:open.stage<4&&<button className="primary" onClick={()=>mark(open,'got')}><PackageCheck size={18}/> קיבלתי</button>}
   {open.stage>=4&&!open.cancelled&&<a className="ghost" href={orderUrl(open)||'https://www.google.com/search?q='+encodeURIComponent((open.shop||'')+' '+open.name)} target="_blank" rel="noopener noreferrer"><RotateCcw size={18}/> הזמן שוב</a>}
   <button className="ghost" onClick={()=>mark(open,'hide')}><EyeOff size={18}/> הסתר, זו לא חבילה</button></div>
 </div>}


 <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!saving)setEdit(null);}} onClose={()=>setEdit(null)}><form onSubmit={e=>{e.preventDefault();void save();}}><h2>שם החבילה</h2><label htmlFor="title" className="sr">שם החבילה</label><input id="title" autoFocus maxLength={180} value={draft} onChange={e=>setDraft(e.target.value)} disabled={saving}/>{editError&&<p className="error" role="alert">{editError}</p>}<div className="dialogActions"><button className="primary" disabled={saving||!draft.trim()}>{saving?'שומר…':'שמירה'}</button><button type="button" className="ghost" disabled={saving} onClick={()=>setEdit(null)}>ביטול</button></div><button type="button" className="textBtn" disabled={saving} onClick={()=>save(true)}>חזרה לשם המקורי</button></form></dialog>
 {toast&&<div className="toast" role="status">{toast}</div>}
 {menu&&<div className="menuWrap" onClick={()=>setMenu(null)}><div className="menu" role="dialog" aria-modal="true" aria-label={'פעולות: '+menu.name} onClick={e=>e.stopPropagation()} {...swipeClose(()=>setMenu(null))}><SheetTop close={()=>setMenu(null)}/>
  <p className="menuTitle">{bidi(menu.name)}</p>
  {menu.pickup?.code&&<button onClick={()=>{void copy(menu.pickup!.code);setMenu(null);}}><KeyRound size={20}/> העתק קוד איסוף <b dir="ltr">{menu.pickup.code}</b></button>}
  {menu.pickup&&(menu.pickup.address||menu.pickup.place)&&<div className="menuNav"><NavLinks pk={menu.pickup} geo={geo[placeQuery(menu.pickup)]}/></div>}
  {menu.tracking&&<button onClick={()=>{void copy(menu.tracking);setMenu(null);}}><Copy size={20}/> העתק מספר מעקב</button>}
  <button onClick={()=>{toggleOther(menu);setMenu(null);}}><Users size={20}/> {isOther(menu)?'זו הזמנה שלי':'הזמנתי בשביל מישהו אחר'}</button>
  {menu.got?<button onClick={()=>mark(menu,null)}><Undo2 size={20}/> בטל "קיבלתי"</button>:menu.stage<4&&<button onClick={()=>mark(menu,'got')}><PackageCheck size={20}/> קיבלתי</button>}
  <button onClick={()=>mark(menu,'hide')}><EyeOff size={20}/> הסתר, זו לא חבילה</button></div></div>}
 {adding&&<div className="menuWrap" onClick={()=>setAdding(false)}><form className="menu addForm" role="dialog" aria-modal="true" aria-label="הוספת חבילה" onClick={e=>e.stopPropagation()} {...swipeClose(()=>setAdding(false))} onSubmit={e=>{e.preventDefault();addManual();}}>
  <SheetTop close={()=>setAdding(false)}/><p className="menuTitle">הוספת חבילה</p>
  <label htmlFor="addSms">הדבקת SMS מהדואר או מהשליח</label><textarea id="addSms" rows={3} value={addSms} onChange={e=>setAddSms(e.target.value)}/>
  {addSms.trim()?<><button type="button" className="primary" onClick={()=>{if(applySms([addSms])){setAddSms('');setAdding(false);setAddErr('');}else setAddErr('לא נמצא מספר מעקב בהודעה');}}>הוספה מה־SMS</button>{addErr&&<p className="error" role="alert">{addErr}</p>}</>:<>
  <p className="orLine">או לפי מספר מעקב</p>
  <label htmlFor="addNum">מספר מעקב</label><input id="addNum" dir="ltr" autoFocus autoCapitalize="characters" autoComplete="off" value={addNum} onChange={e=>setAddNum(e.target.value)}/>
  <label htmlFor="addName">שם (לא חובה)</label><input id="addName" value={addName} onChange={e=>setAddName(e.target.value)}/>
  {addErr&&<p className="error" role="alert">{addErr}</p>}
  <button className="primary" disabled={!addNum.trim()}>הוספה למעקב</button></>}</form></div>}
 {user&&!open&&view!=='account'&&<nav aria-label="ניווט ראשי" className={navDrag!==null?'dragging':''} style={{'--tab':navDrag??['list','today','stats'].indexOf(section)} as React.CSSProperties}
  onTouchStart={e=>navSlide(e,false)} onTouchMove={e=>navSlide(e,true)} onTouchEnd={()=>setNavDrag(null)} onTouchCancel={()=>setNavDrag(null)}>{([['list','חבילות',Package,0],['today','איסוף',MapPin,today.length],['stats','סיכום',ChartColumn,0]] as const).map(([key,label,Icon,n])=><button key={key} className={section===key?'selected':''} aria-current={section===key?'page':undefined} aria-label={label+(n?' '+n:'')} onClick={()=>{setSection(key);setOpenId(null);window.scrollTo({top:0});}}><span className="ni"><Icon size={20}/>{data&&!busy&&n>0&&<b className="nb warn">{n}</b>}</span><span>{label}</span></button>)}</nav>}
 </main>;
}
