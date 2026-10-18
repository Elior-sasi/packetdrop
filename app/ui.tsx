'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {signOut} from 'next-auth/react';
import {Package,CheckCircle2,Settings,RefreshCw,Pencil,ChevronRight,ExternalLink,Search,Mail,Copy,MapPin,Navigation,KeyRound,Cloud,CloudUpload,Bell,Plus,CalendarCheck,MapIcon,ChartColumn,EyeOff,PackageCheck,Undo2} from 'lucide-react';
import {mergeParcels,brandDomains,polishName,parseSms,type Parcel as MailParcel,type Event as MailEvent} from '@/lib/parcels';
import {heEvent,type TrackInfo} from '@/lib/track';
type Event=MailEvent&{src?:string};type Parcel=Omit<MailParcel,'events'>&{events:Event[];carrierStatus?:string;trackPending?:boolean;stale?:boolean;got?:boolean;manual?:boolean};
type Geo=Record<string,{lat:number;lon:number}|null>;
type User={id:string;name:string;email:string};type Scan={parcels:MailParcel[];nextCursor?:string;scanned:number;failed?:number;updated:string};
const STATUS=['ההזמנה התקבלה','נשלחה','בדרך ליעד','מוכנה לאיסוף / במסירה','נמסרה'];
const STEP=['התקבלה','נשלחה','בדרך','לאיסוף','נמסרה'];
const tone=(p:Parcel)=>p.cancelled||(p.stage<4&&/Exception|DeliveryFailure/.test(p.carrierStatus||''))?'bad':p.stage===4?'ok':p.stage===3&&(isPickup(p)||outToday(p))?'warn':'';
// Waiting at a pickup point (as opposed to a courier bringing it to the door).
const isPickup=(p:Parcel)=>p.stage===3&&!p.cancelled&&(p.carrierStatus==='AvailableForPickup'||p.carrierStatus!=='OutForDelivery'&&(!!p.pickup?.place||p.events.some(e=>/איסוף|pickup|collection/i.test(e.label))));
// Latin runs (model names, sizes) are isolated so a Hebrew title does not scramble them, e.g. "AirPods 5/4/Pro (2026)".
const bidi=(t:string)=>t.replace(/[A-Za-z0-9][A-Za-z0-9 .\/()+&'"-]*[A-Za-z0-9)]/g,m=>'\u2066'+m+'\u2069');
// "Out for delivery" only means today; after a day without news the courier is just holding it.
const lastAt=(p:Parcel)=>new Date(p.events.at(-1)?.time||0).getTime();
const OUT_RE=/יצאה למסירה|יצא למסירה|בדרך למסירה|השליח בדרך|במסירה היום|out for delivery|with (?:the )?courier/i;
const PICK_RE=/לאיסוף|איסוף|pick ?up|collection/i;
// "Out for delivery today" needs an actual out-for-delivery update dated today, not just any update today.
const outToday=(p:Parcel)=>p.stage===3&&!p.cancelled&&!isPickup(p)&&p.events.some(e=>OUT_RE.test(e.label)&&new Date(e.time).toDateString()===new Date().toDateString());
const statusText=(p:Parcel)=>p.cancelled?'ההזמנה בוטלה':p.got?'התקבלה':p.stale?'בלי עדכון מ־'+day(p.events.at(-1)?.time):p.stage<4&&p.carrierStatus==='Exception'?'בעיה במשלוח':p.stage<4&&p.carrierStatus==='DeliveryFailure'?'המסירה נכשלה':p.stage===3&&p.carrierStatus==='AvailableForPickup'?'מוכנה לאיסוף':p.stage===3&&!isPickup(p)?(outToday(p)?'יצאה למסירה היום':'אצל חברת המסירה'):p.stage===3&&p.carrierStatus==='AvailableForPickup'?'מוכנה לאיסוף':p.stage===3?'מוכנה לאיסוף':STATUS[p.stage];
// Mail subjects repeat the number before the status ("חבילה מס' RS…: במכס"); keep the status part.
const cleanLabel=(s:string)=>s.replace(/^(?:ל?חבילה|הזמנה|your order|order)\s*(?:מס['׳]?|מספר|no\.?|#)?\s*[A-Z0-9-]{6,}\s*[:：-]?\s*/i,'').trim()||s;
const isGeneric=(name:string)=>/^(?:ל?חבילה|הזמנה|הזמנתך|your order|order|הודעה (?:מ|ב))(?=[\s:'׳]|$)/i.test(name)||/^(?:תודה|אישור (?:ה)?הזמנה|order confirm|thank you for your order|thanks for your order)/i.test(name)||/^\S*\d{8,}/.test(name);
const isGenericName=(p:{name:string})=>/^(?:הזמנה מ־|חבילה|הזמנה …)/.test(p.name);
const displayName=(p:Parcel)=>isGeneric(p.name)?(p.shop&&!/הזמנה מהדוא/.test(p.shop)?'הזמנה מ־'+p.shop:p.order?'הזמנה …'+p.order.slice(-6):'חבילה '+p.tracking):polishName(p.name);
// Bump when mail parsing changes: mail from the last 180 days is then read again with the new rules.
const PARSER=4;
const keepOld=(list:MailParcel[])=>list.filter(p=>Date.now()-new Date(p.events.at(-1)?.time||0).getTime()>175*864e5);
const NOISE=/(?:^|\s)יש עדכון\s*$|has an update|^עדכון$|איך הלך|בהמתנה לאישור|ביקורת|review|rate your|תסומן בקרוב|how was/i;
const timeline=(evs:Event[])=>{const out:Event[]=[];for(const e of evs){if(NOISE.test(e.label))continue;const l=cleanLabel(e.label);if(out.length&&cleanLabel(out[out.length-1].label)===l)continue;out.push(e);}return out.length?out:evs.slice(-1);};
const when=(iso:string)=>{const d=new Date(iso);return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})+' · '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};
const ago=(iso:string)=>{const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);return m<1?'עודכן עכשיו':m<60?'עודכן לפני '+m+' דק׳':'עודכן ב־'+new Date(iso).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};

const day=(d?:string)=>{if(!d)return '';const x=new Date(d);return isNaN(+x)?'':x.getDate()+'.'+(x.getMonth()+1);};
const etaText=(e:TrackInfo['eta'])=>{if(!e)return '';const a=day(e.from),b=day(e.to);return a&&b&&a!==b?a+'-'+b:a||b;};
// Carrier data (17TRACK) refines what the mails say: later step, carrier name, estimate, extra timeline events.
function withCarrier(p:MailParcel,t?:TrackInfo):Parcel{if(!t||!p.tracking)return p;
 const stage=p.cancelled?p.stage:Math.max(p.stage,t.stage);
 const events:Event[]=[...p.events,...t.events.map(e=>({id:'trk:'+e.time+e.text,label:heEvent(e.text)+(e.location?' · '+e.location:''),time:new Date(e.time).toISOString(),src:t.carrier||'חברת השילוח'}))].sort((a,b)=>a.time.localeCompare(b.time));
 return {...p,stage,carrier:p.carrier||t.carrier,eta:stage>=4?'':p.eta||etaText(t.eta),events,carrierStatus:t.status,trackPending:t.pending};}
// Navigation to a pickup point: Google Maps, Waze and Moovit (Moovit needs coordinates, looked up once per address).
const placeQuery=(pk:{place:string;address:string})=>[pk.place,pk.address].filter(Boolean).join(' ');
function NavLinks({pk,geo}:{pk:{place:string;address:string};geo?:{lat:number;lon:number}|null}){const q=placeQuery(pk);
 return <div className="navLinks"><a className="ghost" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)} target="_blank" rel="noopener noreferrer">Google Maps</a>
  <a className="ghost" href={'https://waze.com/ul?navigate=yes&q='+encodeURIComponent(q)} target="_blank" rel="noopener noreferrer">Waze</a>
  <a className="ghost" href={'https://moovit.com/?to='+encodeURIComponent(pk.place||pk.address)+(geo?'&tll='+geo.lat+'_'+geo.lon:'')+'&lang=he'} target="_blank" rel="noopener noreferrer">Moovit</a></div>;}
const domainOf=(name:string)=>brandDomains[name]||(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(name)?name:'');
// Same white Google sign-in button as TAB: official four-colour G, dark label, white pill.
function GoogleButton({label,disabled}:{label:string;disabled?:boolean}){return <button className="gbtn" disabled={disabled}><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg><span>{label}</span></button>;}
function Favicon({name,size=18}:{name:string;size?:number}){const [failed,setFailed]=useState(false);const d=domainOf(name);if(!d||failed)return null;return <img className="fav" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=64'} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;}
function Mark({cls,anim}:{cls?:string;anim?:'bob'|'open'}){return <svg className={cls} viewBox="100 76 312 386" aria-hidden="true"><defs><linearGradient id="ug" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#2ed3c6"/><stop offset="1" stopColor="#4aa8ff"/></linearGradient></defs><path d="M150 214 V320 a106 106 0 0 0 212 0 V210" fill="none" stroke="url(#ug)" strokeWidth="58" strokeLinecap="round"/><g className="lid">{anim==="bob"&&<animateTransform attributeName="transform" type="translate" values="0 40;0 -26;0 40" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>}{anim==="open"&&<animateTransform attributeName="transform" type="translate" values="0 56;0 0" dur=".9s" begin=".2s" fill="freeze" calcMode="spline" keySplines=".2 .9 .3 1"/>}<rect x="112" y="112" width="288" height="48" rx="16" fill="#4aa8ff" transform="rotate(-10 112 160)"/></g></svg>;}
function Thumb({p,big}:{p:Parcel;big?:boolean}){const [failed,setFailed]=useState(false),[brandFailed,setBrandFailed]=useState(false);const d=domainOf(p.shop);
 return <div className={big?'hero':'thumb'}>{p.image&&!failed?<>{big&&<img className="backdrop" src={p.image} alt="" aria-hidden="true" referrerPolicy="no-referrer"/>}<img className="photo" src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></>:d&&!brandFailed?<img className="brandThumb" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=128'} alt="" referrerPolicy="no-referrer" onError={()=>setBrandFailed(true)}/>:<Package size={big?72:34}/>}</div>;}
function Meta({p}:{p:Parcel}){return <div className="meta"><Favicon name={p.shop}/><span dir="auto">{p.shop}</span>{p.carrier&&<><span className="sep">·</span><span dir="auto">{p.carrier}</span></>}</div>;}
function Bar({p}:{p:Parcel}){return <div className={'bar '+tone(p)} aria-hidden="true">{STEP.map((_,i)=><i key={i} className={!p.cancelled&&i<=p.stage?'on':''}/>)}</div>;}

export default function Dashboard({user,gmail,drive,configured,login}:{user:User|null;gmail:boolean;drive?:boolean;configured:boolean;login:()=>Promise<void>}){
 const [view,setView]=useState<'active'|'done'|'account'>('active'),[size,setSize]=useState(0),[auto,setAuto]=useState(true),[splash,setSplash]=useState<'on'|'out'|'off'>('on'),[search,setSearch]=useState(''),[data,setData]=useState<Scan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[openId,setOpenId]=useState<string|null>(null),[edit,setEdit]=useState<Parcel|null>(null),[draft,setDraft]=useState(''),[titles,setTitles]=useState<Record<string,string>>({}),[storage,setStorage]=useState(false),[saving,setSaving]=useState(false),[editError,setEditError]=useState(''),[copied,setCopied]=useState(''),[progress,setProgress]=useState<{pct:number;label:string}|null>(null),[filter,setFilter]=useState<'all'|'pickup'>('all'),[backup,setBackup]=useState<{state:'off'|'on'|'error'|'saving';updated?:string;msg?:string}>({state:drive?'on':'off'}),saved=useRef<MailParcel[]>([]),backupOn=useRef(!!drive),seen=useRef<Set<string>>(new Set()),[tracks,setTracks]=useState<Record<string,TrackInfo>>({}),[trackState,setTrackState]=useState<'off'|'on'|'error'>('off'),[sources,setSources]=useState<{t17:boolean;cainiao:string}|null>(null),[section,setSection]=useState<'list'|'today'|'map'|'stats'>('list'),[marks,setMarks]=useState<Record<string,'got'|'hide'>>({}),[manual,setManual]=useState<MailParcel[]>([]),[adding,setAdding]=useState(false),[addNum,setAddNum]=useState(''),[addName,setAddName]=useState(''),[addErr,setAddErr]=useState(''),[menu,setMenu]=useState<Parcel|null>(null),[geo,setGeo]=useState<Geo>({}),[month,setMonth]=useState(0),[reading,setReading]=useState(false),[addSms,setAddSms]=useState(''),[smsLink,setSmsLink]=useState(''),[toast,setToast]=useState(''),[smsLast,setSmsLast]=useState<{at:string;kind:string}|null>(null);
 const marksRef=useRef(marks);marksRef.current=marks;const manualRef=useRef(manual);manualRef.current=manual;
 const controller=useRef<AbortController|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{try{const v=localStorage.getItem('pd_size');setSize(v?Math.min(2,+v||0):localStorage.getItem('pd_large')==='1'?1:0);setAuto(localStorage.getItem('pd_auto')!=='0');setMarks(JSON.parse(localStorage.getItem('pd_marks')||'{}'));setManual(JSON.parse(localStorage.getItem('pd_manual')||'[]'));setGeo(JSON.parse(localStorage.getItem('pd_geo')||'{}'));}catch{}},[]);
 const setPref=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{}};
 const autoRef=useRef(true);autoRef.current=auto;
 // Opening screen: shown on launch, then fades out.
 useEffect(()=>{const a=setTimeout(()=>setSplash('out'),1400),b=setTimeout(()=>setSplash('off'),1800);return()=>{clearTimeout(a);clearTimeout(b);};},[]);
 async function sync(){if(!user||controller.current)return;void smsRef.current?.();lastSync.current=Date.now();const c=new AbortController();controller.current=c;setBusy(true);setError('');setErrorCode('');setProgress({pct:3,label:'מתחבר ל־Gmail…'});const timeout=setTimeout(()=>c.abort(),300000);
  try{let r=await fetch('/api/parcels',{signal:c.signal,cache:'no-store'});if(r.status>=500&&!c.signal.aborted){await new Promise(res=>setTimeout(res,1500));r=await fetch('/api/parcels',{signal:c.signal,cache:'no-store'});}const d=await r.json().catch(()=>({error:'הסריקה לא הושלמה. נסה שוב.'}));if(!r.ok){setErrorCode(d.code||'');throw Error(d.error);}
   // Only mail that was never read before is fetched; everything older comes from the cloud backup.
   // One-time repair: parcels whose shop was saved as a web address are read again to pick up the shop's real name.
   let fixShop=false;try{fixShop=localStorage.getItem('pd_fix_shop')!=='1';}catch{}
   if(fixShop){const inWindow=new Set(d.ids as string[]);const bad=saved.current.filter(p=>/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(p.shop)&&p.events.every(e=>inWindow.has(e.id)));if(bad.length){const ids=new Set(bad.flatMap(p=>p.events.map(e=>e.id)));saved.current=saved.current.filter(p=>!bad.includes(p));seen.current=new Set([...seen.current].filter(id=>!ids.has(id)));}}
   const known=new Set([...seen.current,...saved.current.flatMap(p=>p.events.map(e=>e.id))]);
   const todo:string[]=(d.ids as string[]).filter(id=>!known.has(id));const total=todo.length;setReading(total>0);let done=0,failed=0;
   let acc:Scan={parcels:mergeParcels([...saved.current]),scanned:0,updated:d.updated};setData(old=>old&&!saved.current.length?old:acc);
   const step=()=>setProgress({pct:total?Math.min(90,Math.round(5+85*done/total)):90,label:total?'נקראו '+done+' מתוך '+total+' מיילים חדשים':'אין מיילים חדשים'});step();
   const chunks:string[][]=[];for(let i=0;i<todo.length;i+=12)chunks.push(todo.slice(i,i+12));const retry:string[]=[];let second=false;let chunkCount=0;
   const worker=async()=>{for(let ch=chunks.shift();ch&&!c.signal.aborted;ch=chunks.shift()){const r2=await fetch('/api/parcels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ch}),signal:c.signal,cache:'no-store'});const d2=await r2.json().catch(()=>({error:'',code:''}));
     if(!r2.ok){if(['NO_GMAIL','RECONNECT','UNAUTHORIZED','GMAIL_API_DISABLED'].includes(d2.code)){setErrorCode(d2.code);throw Error(d2.error);}if(second)failed+=ch.length;else{retry.push(...ch);}done+=second?0:ch.length;step();continue;}
     for(const id of d2.read as string[])seen.current.add(id);if(second)failed+=(d2.failed as string[]).length;else retry.push(...(d2.failed as string[]));done+=second?0:ch.length;acc={...acc,scanned:acc.scanned+(d2.read as string[]).length,failed,parcels:mergeParcels([...acc.parcels,...d2.parcels])};saved.current=acc.parcels;setData(acc);step();
     // Keep progress, so an interrupted first scan continues where it stopped next time.
     try{localStorage.setItem('pd_cache',JSON.stringify({parser:PARSER,parcels:acc.parcels.slice(0,300),seen:[...seen.current].slice(-4000),updated:acc.updated}));}catch{}
     if(++chunkCount%8===0&&backupOn.current)void saveBackup(acc.parcels);}};
   await Promise.all([worker(),worker()]);
   // Mail Google refused to hand over (usually a short rate limit) gets one slower second try.
   if(retry.length&&!c.signal.aborted){second=true;setProgress({pct:92,label:'משלים '+retry.length+' מיילים שלא נקראו…'});await new Promise(res=>setTimeout(res,1500));for(let i=0;i<retry.length;i+=10)chunks.push(retry.slice(i,i+10));await worker();}acc={...acc,updated:new Date().toISOString()};setData(acc);
   if(!c.signal.aborted){try{localStorage.setItem('pd_fix_shop','1');}catch{}setBusy(false);setReading(false);setProgress(null);await Promise.all([loadTracks([...acc.parcels,...manualRef.current]),saveBackup(acc.parcels)]);if(pushOn.current)void pushPost({parcels:[...acc.parcels,...manualRef.current],marks:marksRef.current}).catch(()=>{});}
  }catch(e){setError(e instanceof Error&&e.name!=='AbortError'?e.message:'הסריקה נעצרה. אפשר לנסות שוב.');}finally{clearTimeout(timeout);controller.current=null;setBusy(false);setReading(false);setTimeout(()=>setProgress(null),700);}}
 useEffect(()=>{if(!user)return;void loadBackup().finally(()=>void sync());fetch('/api/titles',{cache:'no-store'}).then(async r=>{const d=await r.json();if(r.ok){setTitles(d.titles);setStorage(d.storage);}}).catch(()=>{});return()=>controller.current?.abort();},[user?.id]);
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
 function loadLocal(){try{const c=JSON.parse(localStorage.getItem('pd_cache')||'null');if(c&&Array.isArray(c.parcels)){const fresh=c.parser===PARSER;saved.current=fresh?c.parcels:keepOld(c.parcels);seen.current=new Set(fresh?c.seen||[]:[]);setData(old=>old||{parcels:c.parcels,scanned:0,updated:c.updated||new Date().toISOString()});}}catch{}}
 async function loadBackup(){loadLocal();try{const r=await fetch('/api/backup',{cache:'no-store'});const d=await r.json();
   if(!r.ok){backupOn.current=d.code!=='NO_DRIVE';setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.code==='NO_DRIVE'?undefined:d.error});return;}
   backupOn.current=true;const fresh=d.parser===PARSER;seen.current=new Set(fresh&&Array.isArray(d.seen)?d.seen:[]);saved.current=Array.isArray(d.parcels)?(fresh?d.parcels:keepOld(d.parcels)):[];setBackup({state:'on',updated:d.updated});if(d.titles)setTitles(t=>({...d.titles,...t}));if(d.marks)setMarks(m=>({...d.marks,...m}));if(Array.isArray(d.manual)&&d.manual.length)setManual(m=>{const have=new Set(m.flatMap(x=>x.keys));return [...m,...(d.manual as MailParcel[]).filter(x=>!x.keys.some(k=>have.has(k)))];});
   // Open instantly with the last backup while Gmail is being read.
   setData(old=>old||(saved.current.length?{parcels:saved.current,scanned:0,updated:d.updated||new Date().toISOString()}:old));}catch{setBackup({state:'error',msg:'הגיבוי לא זמין כרגע'});}}
 async function saveBackup(list:MailParcel[]){try{localStorage.setItem('pd_cache',JSON.stringify({parser:PARSER,parcels:list.slice(0,300),seen:[...seen.current].slice(-4000),updated:new Date().toISOString()}));}catch{}
  if(!backupOn.current)return;setBackup(b=>({...b,state:'saving'}));
  try{const r=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parser:PARSER,parcels:list.slice(0,400),seen:[...seen.current].slice(-5000),marks:marksRef.current,manual:manualRef.current})});const d=await r.json();if(!r.ok){setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.error});return;}saved.current=list;setBackup({state:'on',updated:d.updated});}catch{setBackup({state:'error',msg:'הגיבוי לא נשמר. ינסה שוב ברענון הבא.'});}}
 async function loadTracks(list:MailParcel[]){const numbers=list.filter(p=>p.tracking&&p.stage<4&&!p.cancelled).map(p=>p.tracking).slice(0,40);if(!numbers.length)return;
  try{const r=await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numbers}),cache:'no-store'});const d=await r.json();if(d.sources)setSources(d.sources);if(!d.enabled){setTrackState('off');return;}if(!r.ok)throw Error();setTracks(old=>({...old,...d.tracks}));setTrackState('on');}catch{setTrackState('error');}}
 async function copy(v:string){try{await navigator.clipboard.writeText(v);setCopied(v);setTimeout(()=>setCopied(''),1500);}catch{}}
 const parcels=useMemo(()=>(manual.length?mergeParcels([...(data?.parcels||[]),...manual]):(data?.parcels||[])).filter(m=>!/eventbuzz|smarticket|tickchak/i.test(m.shop)&&!/^\s*(?:re|fwd?)\s*:|^ביטול ה?הזמנה/i.test(m.name)&&!/בוטל|ביטול ה?הזמנה|cancel/i.test(m.events.at(-1)?.label||'')).filter(m=>!(marks[m.id]==='hide'||m.keys.some(k=>marks[k]==='hide'))).map(m=>{const got=marks[m.id]==='got'||m.keys.some(k=>marks[k]==='got');const p={...withCarrier(m,tracks[m.tracking])};const last=new Date(p.events.at(-1)?.time||0).getTime();
  // Pickup points return parcels after ~2 weeks and shops stop writing once it arrives: after 21 days of silence treat it as received.
  // Step 4 (pickup / delivery) only when an update actually says so; otherwise it is still on its way.
  if(p.stage===3&&!p.carrierStatus?.match(/OutForDelivery|AvailableForPickup/)&&!p.pickup&&!p.events.some(e=>OUT_RE.test(e.label)||PICK_RE.test(e.label)))p.stage=2;
  const stale=p.stage<4&&!p.cancelled&&Date.now()-last>(p.stage===3?14:30)*864e5;
  return {...p,got,manual:m.keys.some(k=>manual.some(x=>x.keys.includes(k))),stale:stale&&!got,last,stage:stale||got?4:p.stage,name:titles[p.id]||displayName(m)};})
  // Ready for pickup / out for delivery first, then the most recent update; parcels with no tracking number go last.
  // Courier mails (HFD, Cheetah...) often lack the product: suggest the AliExpress order that was on its way just before, marked as a guess.
  .map((p,_,all)=>{if(p.image||!isGenericName(p)||!/AliExpress/i.test(p.shop)||!p.carrier||/AliExpress|Cainiao/i.test(p.carrier))return p;
   const at=new Date(p.events[0]?.time||0).getTime();
   const cands=all.filter(o=>o!==p&&/AliExpress/i.test(o.shop)&&!isGenericName(o)&&o.events.length&&!o.pickup&&new Date(o.events[0].time).getTime()<at&&at-new Date(o.events[0].time).getTime()<45*864e5&&o.stage>=1);
   if(!cands.length)return p;const best=cands.sort((x,y)=>Math.abs(x.last-at)-Math.abs(y.last-at))[0];
   return {...p,name:titles[p.id]||'כנראה: '+best.name,image:best.image};})
  .sort((a,b)=>{const urgent=(p:Parcel)=>isPickup(p)||outToday(p)?0:1;return urgent(a)-urgent(b)||(a.tracking?0:1)-(b.tracking?0:1)||b.last-a.last;}),[data,titles,tracks,marks,manual]);
 const active=parcels.filter(p=>p.stage<4&&!p.cancelled),done=parcels.filter(p=>p.stage===4&&!p.cancelled);
 const q=search.trim().toLowerCase();const shown=(view==='done'?done:filter==='pickup'?active.filter(isPickup):active).filter(p=>!q||[p.name,p.shop,p.carrier,p.tracking,p.order].join(' ').toLowerCase().includes(q));
 const pickup=active.filter(isPickup).length;const open=parcels.find(p=>p.id===openId)||null;
 // Phone notifications (Web Push through the service worker).
 const [push,setPush]=useState<'checking'|'install'|'unsupported'|'nodb'|'denied'|'off'|'on'|'busy'>('checking'),[pushMsg,setPushMsg]=useState('');const pushKey=useRef('');const pushOn=useRef(false);pushOn.current=push==='on';
 useEffect(()=>{if(!user)return;void (async()=>{const ios=/iPhone|iPad|iPod/.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||(navigator as {standalone?:boolean}).standalone===true;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setPush(ios&&!standalone?'install':'unsupported');return;}
  try{const reg=await navigator.serviceWorker.register('/sw.js');const s=await fetch('/api/push',{cache:'no-store'}).then(r=>r.json()).catch(()=>({enabled:false}));pushKey.current=s.publicKey||'';
   if(!s.enabled){setPush('nodb');return;}if(Notification.permission==='denied'){setPush('denied');return;}
   const sub=await reg.pushManager.getSubscription();setPush(sub&&Notification.permission==='granted'?'on':'off');}catch{setPush('unsupported');}})();},[user?.id]);
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
 async function pullSms(){try{const r=await fetch('/api/sms',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d.link)setSmsLink(d.link);setSmsLast(d.last||null);if(d.items?.length)applySms(d.items.map((x:{text:string})=>x.text));}catch{}}
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
 const stats=useMemo(()=>{const d=new Date();const ref=new Date(d.getFullYear(),d.getMonth()-month,1);const end=new Date(ref.getFullYear(),ref.getMonth()+1,1);
  const inMonth=(t:string)=>{const x=new Date(t);return x>=ref&&x<end;};const first=(p:Parcel)=>p.events[0]?.time||'';
  const all=parcels.filter(p=>!p.cancelled);const ordered=all.filter(p=>inMonth(first(p)));const delivered=all.filter(p=>p.stage===4&&!p.stale&&inMonth(p.events.at(-1)?.time||''));
  const shops=Object.entries(ordered.reduce((m,p)=>{const k=p.shop||'אחר';m[k]=(m[k]||0)+1;return m;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const durs=all.filter(p=>p.stage===4&&!p.stale&&!p.got&&p.events.length>1).map(p=>(new Date(p.events.at(-1)!.time).getTime()-new Date(first(p)).getTime())/864e5).filter(x=>x>0.5&&x<120);
  const avg=durs.length?Math.round(durs.reduce((a,b)=>a+b,0)/durs.length):0;
  return {label:ref.toLocaleDateString('he-IL',{month:'long',year:'numeric'}),ordered:ordered.length,delivered:delivered.length,shops,avg,fast:durs.length?Math.round(Math.min(...durs)):0,slow:durs.length?Math.round(Math.max(...durs)):0,n:durs.length};},[parcels,month]);
// The animation replaces the list on first load and while new mail is read; a quick check on return keeps the list.
 const waiting=(!data&&!error)||(busy&&(reading||!data));
 const hiddenCount=Object.values(marks).filter(v=>v==='hide').length;

 return <main className={['app','app large','app xlarge'][size]}>
 {splash!=='off'&&<div className={'splash'+(splash==='out'?' out':'')} aria-hidden="true"><Mark cls="smark" anim="open"/><div className="sname" dir="ltr">Unbox</div></div>}
 {user&&pull>0&&view!=='account'&&<div className={'ptr'+(pull>=80?' ready':'')} style={{transform:'translate(-50%,'+Math.max(0,pull-46)+'px)',opacity:Math.min(1,pull/80)}} aria-hidden="true"><RefreshCw style={{transform:'rotate('+pull*3+'deg)'}}/></div>}
 <header className="top">
  <div className="row"><span className="brand" dir="ltr" aria-label="Unbox"><Mark/><span aria-hidden="true">nbox</span></span>
   <div className="actions">{user&&view!=='account'&&<button className="ib" aria-label="הוספת חבילה לפי מספר מעקב" onClick={()=>{setAdding(true);setAddErr('');}}><Plus/></button>}<button className="ib" aria-label="הגדרות" aria-pressed={view==='account'} onClick={()=>go(view==='account'?'active':'account')}><Settings/></button></div></div>
  <h1>{view==='account'?'הגדרות':section==='today'?'היום':section==='map'?'נקודות איסוף':section==='stats'?'סיכום':view==='done'?'נמסרו':filter==='pickup'?'לאיסוף':'החבילות שלי'}</h1>
  {user&&view!=='account'&&progress&&waiting&&<div className="progress"><div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct} aria-label="התקדמות הסריקה"><i style={{width:progress.pct+'%'}}/></div><div className="plabel" aria-live="polite"><span>{progress.label}</span><b>{progress.pct}%</b></div></div>}
  {user&&view!=='account'&&!(progress&&waiting)&&<p className="sub" role="status">{busy?'בודק את Gmail…':error?(!gmail||errorCode==='NO_GMAIL'?'קריאת Gmail לא אושרה':'הסריקה לא הושלמה'):data?ago(data.updated):'ממתין לסריקה'}</p>}
 </header>
 {user&&view!=='account'&&section==='list'&&data&&!waiting&&<div className="tiles" role="tablist" aria-label="סינון חבילות">{([['active','all','בדרך',active.length],['active','pickup','לאיסוף',pickup],['done','all','נמסרו',done.length]] as const).map(([key,f,label,n])=>{const on=view===key&&(key==='done'||filter===f);return <button key={label} role="tab" aria-selected={on} className={'tile'+(on?' on':'')+(f==='pickup'?' p':'')} onClick={()=>{setFilter(f);go(key);}}><b>{data?n:'–'}</b><span>{label}</span></button>;})}</div>}

 {view==='account'?<div className="settings">
  <section className="set"><h3>תצוגה</h3>
   <div className="setRow"><span>גודל טקסט</span></div>
   <div className="seg" role="radiogroup" aria-label="גודל טקסט">{['רגיל','גדול','גדול מאוד'].map((l,i)=><button key={i} role="radio" aria-checked={size===i} className={size===i?'on':''} onClick={()=>{setSize(i);setPref('pd_size',String(i));}}>{l}</button>)}</div></section>
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
   <p className="setNote">הודעות מהדואר, HFD, צ'יטה ושאר השליחים ייכנסו לבד, עם מספר המעקב וקוד האיסוף. מגדירים פעם אחת באפליקציית קיצורי הדרך:</p>
   <ol className="steps2"><li>קיצורים ← אוטומציה ← אוטומציה חדשה ← <b>הודעה</b>.</li><li>"ההודעה מכילה": <b>חבילה</b> (אפשר עוד אוטומציה ל"משלוח" ו"איסוף"). בחר <b>הרץ מיד</b>.</li><li>פעולה: <b>קבל תוכן של URL</b>. בכתובת הדבק את הקישור האישי, שיטה <b>POST</b>, גוף בקשה <b>טקסט</b> = תוכן ההודעה.</li></ol>
   <button className="ghost" onClick={()=>copy(smsLink)}><Copy size={18}/> {copied===smsLink?'הקישור הועתק ✓':'העתקת הקישור האישי'}</button>
   <p className="setNote" role="status">{smsLast?'הודעה אחרונה הגיעה ב־'+new Date(smsLast.at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})+(smsLast.kind==='parcel'?' וזוהתה כחבילה ✓':smsLast.kind==='empty'?', אבל בלי טקסט':', אבל לא נמצא בה מספר מעקב'):'עדיין לא הגיעה אף הודעה מהקיצור.'}</p>
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
   {(waiting)&&<div className="loader" role="status"><Mark cls="lmark" anim="bob"/><p>{progress?'מביא את החבילות שלך…':'בודק את Gmail…'}</p></div>}
   {!(waiting)&&section==='today'&&<div className="list">{today.length?today.map(p=><button key={p.id} className="card focus" {...longPress(p)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><div className="st"><span className={'pill '+tone(p)}>{isPickup(p)||outToday(p)?statusText(p):'צפויה היום'}</span></div>
     {isPickup(p)&&p.pickup?.place&&<p className="todayWhere">איסוף ב<b>{p.pickup.place}</b></p>}{isPickup(p)&&p.pickup?.code&&<p className="todayCode">קוד <b dir="ltr">{p.pickup.code}</b></p>}</div></div></button>)
    :<section className="panel empty"><CalendarCheck size={40}/><h2>אין מה לאסוף היום</h2><p>חבילות שמחכות לך או שהשליח מביא היום יופיעו כאן.</p></section>}</div>}
   {!(waiting)&&section==='map'&&<div className="list">{pickPoints.length?pickPoints.map(p=>{const pk=p.pickup!;const q=placeQuery(pk);return <section key={p.id} className="box mapCard">
     <iframe title={'מפה: '+pk.place} src={'https://maps.google.com/maps?q='+encodeURIComponent(q)+'&hl=iw&z=16&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
     <p className="place">{pk.place||pk.address}</p>{pk.place&&pk.address&&<p className="addr">{pk.address}</p>}{pk.hours&&<p className="addr">שעות: {pk.hours}</p>}
     <p className="addr">{bidi(p.name)}</p>{pk.code&&<button className="code" onClick={()=>copy(pk.code)}><KeyRound size={20}/><span>קוד איסוף</span><b dir="ltr">{pk.code}</b>{copied===pk.code?' ✓':<Copy size={17}/>}</button>}
     <NavLinks pk={pk} geo={geo[q]}/></section>;})
    :<section className="panel empty"><MapIcon size={40}/><h2>אין חבילות שמחכות לאיסוף</h2><p>כשחבילה תגיע לנקודת איסוף, המקום יופיע כאן עם ניווט.</p></section>}</div>}
   {!(waiting)&&section==='stats'&&<div className="statsWrap">
    <div className="seg" role="radiogroup" aria-label="חודש">{['החודש','החודש שעבר'].map((l,i)=><button key={i} role="radio" aria-checked={month===i} className={month===i?'on':''} onClick={()=>setMonth(i)}>{l}</button>)}</div>
    <div className="statGrid"><div className="stat"><b>{stats.ordered}</b><span>הזמנות</span></div><div className="stat"><b>{stats.delivered}</b><span>הגיעו</span></div><div className="stat"><b>{stats.avg||'–'}</b><span>ימים בממוצע</span></div></div>
    {stats.shops.length>0&&<section className="box"><h3>חנויות ב{stats.label}</h3>{stats.shops.map(([shop,n])=><div key={shop} className="shopRow"><span dir="auto">{shop}</span><i style={{width:Math.max(8,100*n/stats.shops[0][1])+'%'}}/><b>{n}</b></div>)}</section>}
    {stats.n>0&&<section className="box"><h3>זמן הגעה</h3><p className="setNote">מההזמנה ועד שהחבילה אצלך: בממוצע {stats.avg} ימים. הכי מהירה {stats.fast}, הכי איטית {stats.slow}. לפי {stats.n} חבילות שהגיעו.</p></section>}
    {!stats.ordered&&!stats.delivered&&<section className="panel empty"><ChartColumn size={40}/><h2>אין הזמנות ב{stats.label}</h2></section>}</div>}
   {!(waiting)&&section==='list'&&<><label className="search"><Search size={20}/><input aria-label="חיפוש חבילות" placeholder="חיפוש מוצר, חנות או מספר מעקב" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {error&&<div className="error" role="alert"><span>{error}</span>{['NO_GMAIL','RECONNECT','UNAUTHORIZED'].includes(errorCode)?<form action={login}><button className="primary">חידוש הרשאת Google</button></form>:<button className="ghost" onClick={()=>sync()}>נסה שוב</button>}</div>}
   <div className="list">{shown.map(p=><button key={p.id} className={'card '+(isPickup(p)||outToday(p)?'focus':'')} {...longPress(p)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{bidi(p.name)}</div><Meta p={p}/><div className="st"><span className={'pill '+tone(p)}>{statusText(p)}</span>{p.stage===3&&p.pickup?.place&&!p.cancelled?<span className="eta">איסוף ב<b>{p.pickup.place}</b></span>:p.eta&&!p.cancelled&&<span className="eta">הגעה <b>{p.eta}</b></span>}</div></div></div>
    <Bar p={p}/></button>)}</div>

   {!shown.length&&!busy&&data&&<section className="panel empty"><Package size={40}/><h2>{q?'לא נמצאו חבילות':view==='done'?'עדיין אין חבילות שנמסרו':filter==='pickup'?'אין חבילות לאיסוף':'אין חבילות בדרך'}</h2><p>{q?'נסה מילה אחרת.':'חבילות חדשות יופיעו כאן אחרי רענון.'}</p></section>}
   </>}
  </>}
 </>}

 {open&&<div className="sheet" role="dialog" aria-modal="true" aria-label={open.name}>
  <div className="sheetTop"><button className="ib" aria-label="חזרה" onClick={()=>setOpenId(null)}><ChevronRight/></button><button className="ib" aria-label="עריכת שם" disabled={!storage} title={!storage?'שמירת שמות דורשת גיבוי בענן':undefined} onClick={()=>{setEdit(open);setDraft(open.name);setEditError('');}}><Pencil size={20}/></button></div>
  <Thumb p={open} big/>
  <div className="dt"><h2>{bidi(open.name)}</h2><Meta p={open}/></div>
  <section className="box"><div className="row"><span className={'pill '+tone(open)}>{statusText(open)}</span>{open.eta&&!open.cancelled&&<span className="eta">הגעה <b>{open.eta}</b></span>}</div>
   {!open.cancelled&&<div className={'steps '+tone(open)} style={{'--p':open.stage/4} as React.CSSProperties}>{STEP.map((s,i)=><div key={s} className={'sp '+(i<open.stage?'d':i===open.stage?'c':'')}><span/>{i===3&&open.stage>=3&&!isPickup(open)?'במסירה':s}</div>)}</div>}</section>
  {open.pickup&&open.stage<4&&!open.cancelled&&<section className="box pickup"><h3><MapPin size={18}/> נקודת איסוף</h3>
   {open.pickup.place&&<p className="place">{open.pickup.place}</p>}{open.pickup.address&&<p className="addr">{open.pickup.address}</p>}{open.pickup.hours&&<p className="addr">שעות: {open.pickup.hours}</p>}
   {open.pickup.code&&<button className="code" onClick={()=>copy(open.pickup!.code)} aria-label={'קוד איסוף '+open.pickup.code.split('').join(' ')+', העתקה'}><KeyRound size={20}/><span>קוד איסוף</span><b dir="ltr">{open.pickup.code}</b>{copied===open.pickup.code?' ✓':<Copy size={17}/>}</button>}
   {(open.pickup.address||open.pickup.place)&&<NavLinks pk={open.pickup} geo={geo[placeQuery(open.pickup)]}/>}
   {open.pickup.url&&<div className="pickActions"><a className="ghost" href={open.pickup.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/> שעות פתיחה</a></div>}</section>}
  {open.tracking&&trackState==='on'&&open.trackPending&&open.stage<4&&<p className="trackNote">מספר המעקב נרשם אצל חברת השילוח. העדכונים שלה יופיעו כאן בדקות הקרובות.</p>}
  <section className="box"><h3>היסטוריה</h3>{[...timeline(open.events)].reverse().map((e,i)=><div key={e.id} className={'ev '+(!i?'l':'')}><span className="dot"/><div><strong dir="auto">{cleanLabel(e.label)}</strong>{e.src?<span className="src">מ־{e.src}</span>:e.id.startsWith('manual:')?null:<a href={'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(user?.email||'')+'#all/'+encodeURIComponent(e.id)} target="_blank" rel="noopener noreferrer">המייל המקורי <ExternalLink size={13}/></a>}</div><time dateTime={e.time}>{when(e.time)}</time></div>)}</section>
  {(open.tracking||open.order||open.url)&&<section className="box">
   {open.tracking&&<div className="kv"><span>מספר מעקב</span><button className="copy" onClick={()=>copy(open.tracking)}><b dir="ltr">{open.tracking}</b>{copied===open.tracking?' ✓':<Copy size={15}/>}</button></div>}
   {open.order&&<div className="kv"><span>מספר הזמנה</span><button className="copy" onClick={()=>copy(open.order)}><b dir="ltr">{open.order}</b>{copied===open.order?' ✓':<Copy size={15}/>}</button></div>}
   {open.url&&<a className="link" href={open.url} target="_blank" rel="noopener noreferrer">מעקב באתר החנות <ExternalLink size={15}/></a>}
  </section>}
  <div className="sheetActions">{open.got?<button className="ghost" onClick={()=>mark(open,null)}><Undo2 size={18}/> בטל "קיבלתי"</button>:open.stage<4&&<button className="primary" onClick={()=>mark(open,'got')}><PackageCheck size={18}/> קיבלתי</button>}
   <button className="ghost" onClick={()=>mark(open,'hide')}><EyeOff size={18}/> הסתר, זו לא חבילה</button></div>
 </div>}


 <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!saving)setEdit(null);}} onClose={()=>setEdit(null)}><form onSubmit={e=>{e.preventDefault();void save();}}><h2>שם החבילה</h2><label htmlFor="title" className="sr">שם החבילה</label><input id="title" autoFocus maxLength={180} value={draft} onChange={e=>setDraft(e.target.value)} disabled={saving}/>{editError&&<p className="error" role="alert">{editError}</p>}<div className="dialogActions"><button className="primary" disabled={saving||!draft.trim()}>{saving?'שומר…':'שמירה'}</button><button type="button" className="ghost" disabled={saving} onClick={()=>setEdit(null)}>ביטול</button></div><button type="button" className="textBtn" disabled={saving} onClick={()=>save(true)}>חזרה לשם המקורי</button></form></dialog>
 {toast&&<div className="toast" role="status">{toast}</div>}
 {menu&&<div className="menuWrap" onClick={()=>setMenu(null)}><div className="menu" role="dialog" aria-modal="true" aria-label={'פעולות: '+menu.name} onClick={e=>e.stopPropagation()}>
  <p className="menuTitle">{bidi(menu.name)}</p>
  {menu.pickup?.code&&<button onClick={()=>{void copy(menu.pickup!.code);setMenu(null);}}><KeyRound size={20}/> העתק קוד איסוף <b dir="ltr">{menu.pickup.code}</b></button>}
  {menu.pickup&&(menu.pickup.address||menu.pickup.place)&&<div className="menuNav"><NavLinks pk={menu.pickup} geo={geo[placeQuery(menu.pickup)]}/></div>}
  {menu.tracking&&<button onClick={()=>{void copy(menu.tracking);setMenu(null);}}><Copy size={20}/> העתק מספר מעקב</button>}
  {menu.got?<button onClick={()=>mark(menu,null)}><Undo2 size={20}/> בטל "קיבלתי"</button>:menu.stage<4&&<button onClick={()=>mark(menu,'got')}><PackageCheck size={20}/> קיבלתי</button>}
  <button onClick={()=>mark(menu,'hide')}><EyeOff size={20}/> הסתר, זו לא חבילה</button>
  <button className="menuCancel" onClick={()=>setMenu(null)}>ביטול</button></div></div>}
 {adding&&<div className="menuWrap" onClick={()=>setAdding(false)}><form className="menu addForm" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();addManual();}}>
  <p className="menuTitle">הוספת חבילה</p>
  <label htmlFor="addSms">הדבקת SMS מהדואר או מהשליח</label><textarea id="addSms" rows={3} value={addSms} onChange={e=>setAddSms(e.target.value)} placeholder="המספר והקוד יזוהו לבד"/>
  {addSms.trim()?<><button type="button" className="primary" onClick={()=>{if(applySms([addSms])){setAddSms('');setAdding(false);setAddErr('');}else setAddErr('לא נמצא מספר מעקב בהודעה');}}>הוספה מה־SMS</button>{addErr&&<p className="error" role="alert">{addErr}</p>}</>:<>
  <p className="orLine">או לפי מספר מעקב</p>
  <label htmlFor="addNum">מספר מעקב</label><input id="addNum" dir="ltr" autoFocus autoCapitalize="characters" autoComplete="off" value={addNum} onChange={e=>setAddNum(e.target.value)} placeholder="RR123456789IL"/>
  <label htmlFor="addName">שם (לא חובה)</label><input id="addName" value={addName} onChange={e=>setAddName(e.target.value)} placeholder="למשל: אוזניות"/>
  {addErr&&<p className="error" role="alert">{addErr}</p>}
  <button className="primary" disabled={!addNum.trim()}>הוספה למעקב</button></>}<button type="button" className="menuCancel" onClick={()=>setAdding(false)}>ביטול</button></form></div>}
 {user&&!open&&view!=='account'&&<nav aria-label="ניווט ראשי" style={{'--tab':['list','today','map','stats'].indexOf(section)} as React.CSSProperties}>{([['list','חבילות',Package,0],['today','היום',CalendarCheck,today.length],['map','מפה',MapIcon,pickPoints.length],['stats','סיכום',ChartColumn,0]] as const).map(([key,label,Icon,n])=><button key={key} className={section===key?'selected':''} aria-current={section===key?'page':undefined} aria-label={label+(n?' '+n:'')} onClick={()=>{setSection(key);setOpenId(null);window.scrollTo({top:0});}}><span className="ni"><Icon size={20}/>{data&&!busy&&n>0&&<b className="nb warn">{n}</b>}</span><span>{label}</span></button>)}</nav>}
 </main>;
}
