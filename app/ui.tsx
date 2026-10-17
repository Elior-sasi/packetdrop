'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {signOut} from 'next-auth/react';
import {Package,CheckCircle2,UserRound,RefreshCw,Type,Pencil,ChevronRight,ExternalLink,Search,Mail,Copy,MapPin,Navigation,KeyRound,Cloud,CloudUpload} from 'lucide-react';
import {mergeParcels,brandDomains,type Parcel as MailParcel,type Event as MailEvent} from '@/lib/parcels';
import type {TrackInfo} from '@/lib/track';
type Event=MailEvent&{src?:string};type Parcel=Omit<MailParcel,'events'>&{events:Event[];carrierStatus?:string;trackPending?:boolean};
type User={id:string;name:string;email:string};type Scan={parcels:MailParcel[];nextCursor?:string;scanned:number;failed?:number;updated:string};
const STATUS=['ההזמנה התקבלה','נשלחה','בדרך ליעד','מוכנה לאיסוף / במסירה','נמסרה'];
const STEP=['התקבלה','נשלחה','בדרך','לאיסוף','נמסרה'];
const tone=(p:Parcel)=>p.cancelled||(p.stage<4&&/Exception|DeliveryFailure/.test(p.carrierStatus||''))?'bad':p.stage===4?'ok':p.stage===3?'warn':'';
const statusText=(p:Parcel)=>p.cancelled?'ההזמנה בוטלה':p.stage<4&&p.carrierStatus==='Exception'?'בעיה במשלוח':p.stage<4&&p.carrierStatus==='DeliveryFailure'?'המסירה נכשלה':p.stage===3&&p.carrierStatus==='AvailableForPickup'?'מוכנה לאיסוף':p.stage===3&&p.carrierStatus==='OutForDelivery'?'יצאה למסירה':p.stage===3?(p.events.some(e=>/איסוף|pickup|collection/i.test(e.label))?'מוכנה לאיסוף':'במסירה'):STATUS[p.stage];
// Mail subjects repeat the number before the status ("חבילה מס' RS…: במכס"); keep the status part.
const cleanLabel=(s:string)=>s.replace(/^(?:ל?חבילה|הזמנה|your order|order)\s*(?:מס['׳]?|מספר|no\.?|#)?\s*[A-Z0-9-]{6,}\s*[:：-]?\s*/i,'').trim()||s;
const isGeneric=(name:string)=>/^(?:ל?חבילה|הזמנה|your order|order|הודעה (?:מ|ב))(?=[\s:'׳]|$)/i.test(name)||/^\S*\d{8,}/.test(name);
const displayName=(p:Parcel)=>isGeneric(p.name)?(p.order?'הזמנה …'+p.order.slice(-6):'חבילה '+p.tracking):p.name;
const when=(iso:string)=>{const d=new Date(iso);return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})+' · '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};
const ago=(iso:string)=>{const m=Math.round((Date.now()-new Date(iso).getTime())/60000);return m<1?'עודכן עכשיו':m<60?'עודכן לפני '+m+' דק׳':'עודכן ב־'+new Date(iso).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});};

const day=(d?:string)=>{if(!d)return '';const x=new Date(d);return isNaN(+x)?'':x.getDate()+'.'+(x.getMonth()+1);};
const etaText=(e:TrackInfo['eta'])=>{if(!e)return '';const a=day(e.from),b=day(e.to);return a&&b&&a!==b?a+'-'+b:a||b;};
// Carrier data (17TRACK) refines what the mails say: later step, carrier name, estimate, extra timeline events.
function withCarrier(p:MailParcel,t?:TrackInfo):Parcel{if(!t||!p.tracking)return p;
 const stage=p.cancelled?p.stage:Math.max(p.stage,t.stage);
 const events:Event[]=[...p.events,...t.events.map(e=>({id:'trk:'+e.time+e.text,label:e.text+(e.location?' · '+e.location:''),time:new Date(e.time).toISOString(),src:t.carrier||'חברת השילוח'}))].sort((a,b)=>a.time.localeCompare(b.time));
 return {...p,stage,carrier:p.carrier||t.carrier,eta:stage>=4?'':p.eta||etaText(t.eta),events,carrierStatus:t.status,trackPending:t.pending};}
const domainOf=(name:string)=>brandDomains[name]||(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(name)?name:'');
// Same white Google sign-in button as TAB: official four-colour G, dark label, white pill.
function GoogleButton({label,disabled}:{label:string;disabled?:boolean}){return <button className="gbtn" disabled={disabled}><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg><span>{label}</span></button>;}
function Favicon({name,size=18}:{name:string;size?:number}){const [failed,setFailed]=useState(false);const d=domainOf(name);if(!d||failed)return null;return <img className="fav" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=64'} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;}
function Thumb({p,big}:{p:Parcel;big?:boolean}){const [failed,setFailed]=useState(false),[brandFailed,setBrandFailed]=useState(false);const d=domainOf(p.shop);
 return <div className={big?'hero':'thumb'}>{p.image&&!failed?<img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:d&&!brandFailed?<img className="brandThumb" src={'https://www.google.com/s2/favicons?domain='+d+'&sz=128'} alt="" referrerPolicy="no-referrer" onError={()=>setBrandFailed(true)}/>:<Package size={big?72:34}/>}</div>;}
function Meta({p}:{p:Parcel}){return <div className="meta"><Favicon name={p.shop}/><span dir="auto">{p.shop}</span>{p.carrier&&<><span className="sep">·</span><span dir="auto">{p.carrier}</span></>}</div>;}
function Bar({p}:{p:Parcel}){return <div className={'bar '+tone(p)} aria-hidden="true">{STEP.map((_,i)=><i key={i} className={!p.cancelled&&i<=p.stage?'on':''}/>)}</div>;}

export default function Dashboard({user,gmail,drive,configured,login}:{user:User|null;gmail:boolean;drive?:boolean;configured:boolean;login:()=>Promise<void>}){
 const [view,setView]=useState<'active'|'done'|'account'>('active'),[large,setLarge]=useState(false),[search,setSearch]=useState(''),[data,setData]=useState<Scan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[openId,setOpenId]=useState<string|null>(null),[edit,setEdit]=useState<Parcel|null>(null),[draft,setDraft]=useState(''),[titles,setTitles]=useState<Record<string,string>>({}),[storage,setStorage]=useState(false),[saving,setSaving]=useState(false),[editError,setEditError]=useState(''),[copied,setCopied]=useState(''),[progress,setProgress]=useState<{pct:number;label:string}|null>(null),[backup,setBackup]=useState<{state:'off'|'on'|'error'|'saving';updated?:string;msg?:string}>({state:drive?'on':'off'}),saved=useRef<MailParcel[]>([]),backupOn=useRef(!!drive),backupAt=useRef(''),[tracks,setTracks]=useState<Record<string,TrackInfo>>({}),[trackState,setTrackState]=useState<'off'|'on'|'error'>('off');
 const controller=useRef<AbortController|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{try{setLarge(localStorage.getItem('pd_large')==='1');}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem('pd_large',large?'1':'0');}catch{}},[large]);
 async function sync(){if(!user||controller.current)return;const c=new AbortController();controller.current=c;setBusy(true);setError('');setErrorCode('');setProgress({pct:3,label:'מתחבר ל־Gmail…'});const timeout=setTimeout(()=>c.abort(),300000);
  const lastBackup=backupAt.current?new Date(new Date(backupAt.current).getTime()-3*864e5):null;const sinceQ=lastBackup?'since='+lastBackup.getFullYear()+'/'+(lastBackup.getMonth()+1)+'/'+lastBackup.getDate():'';const maxPages=lastBackup?8:16;
  try{const r=await fetch('/api/parcels'+(sinceQ?'?'+sinceQ:''),{signal:c.signal,cache:'no-store'});const d=await r.json();if(!r.ok){setErrorCode(d.code||'');throw Error(d.error);}let acc:Scan={...d,parcels:mergeParcels([...saved.current,...d.parcels])};setData(acc);
   // Real progress: messages read out of Gmail's own estimate (capped at the 7 pages we read), mail is 90%, carriers the rest.
   const total=Math.max(1,Math.min(Number(d.estimate)||50,maxPages*50));const step=(n:number)=>setProgress({pct:Math.min(90,Math.round(5+85*n/total)),label:'נסרקו '+n+' מתוך כ־'+total+' מיילים'});step(acc.scanned);
   // Keep reading older pages in the background so the 180-day window is covered without extra taps.
   for(let page=1;page<maxPages&&acc.nextCursor&&!c.signal.aborted;page++){const r2=await fetch('/api/parcels?cursor='+encodeURIComponent(acc.nextCursor)+(sinceQ?'&'+sinceQ:''),{signal:c.signal,cache:'no-store'});const d2=await r2.json();if(!r2.ok)break;acc={...d2,scanned:acc.scanned+d2.scanned,failed:(acc.failed||0)+(d2.failed||0),parcels:mergeParcels([...acc.parcels,...d2.parcels])};setData(acc);step(acc.scanned);}
   if(!c.signal.aborted){setProgress({pct:92,label:'בודק מול חברות השילוח…'});await loadTracks(acc.parcels);setProgress({pct:96,label:'שומר גיבוי בענן…'});await saveBackup(acc.parcels);setProgress({pct:100,label:'הסתיים'});}
  }catch(e){setError(e instanceof Error&&e.name!=='AbortError'?e.message:'הסריקה נעצרה. אפשר לנסות שוב.');}finally{clearTimeout(timeout);controller.current=null;setBusy(false);setTimeout(()=>setProgress(null),700);}}
 useEffect(()=>{if(!user)return;void loadBackup().finally(()=>void sync());fetch('/api/titles',{cache:'no-store'}).then(async r=>{const d=await r.json();if(r.ok){setTitles(d.titles);setStorage(d.storage);}}).catch(()=>{});return()=>controller.current?.abort();},[user?.id]);
 useEffect(()=>{if(edit)dialog.current?.showModal();else dialog.current?.close();},[edit]);
 useEffect(()=>{document.body.style.overflow=openId?'hidden':'';},[openId]);
 async function save(reset=false){if(!edit)return;setSaving(true);setEditError('');try{const r=await fetch('/api/titles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:edit.id,title:reset?'':draft.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error);setTitles(old=>({...old,[d.key]:d.title}));setEdit(null);}catch(e){setEditError(e instanceof Error?e.message:'שמירת השם נכשלה');}finally{setSaving(false);}}
 async function loadBackup(){try{const r=await fetch('/api/backup',{cache:'no-store'});const d=await r.json();
   if(!r.ok){backupOn.current=d.code!=='NO_DRIVE';setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.code==='NO_DRIVE'?undefined:d.error});return;}
   backupOn.current=true;backupAt.current=saved.current&&d.parcels?.length?d.updated||'':'';saved.current=Array.isArray(d.parcels)?d.parcels:[];setBackup({state:'on',updated:d.updated});if(d.titles)setTitles(t=>({...d.titles,...t}));
   // Open instantly with the last backup while Gmail is being read.
   setData(old=>old||(saved.current.length?{parcels:saved.current,scanned:0,updated:d.updated||new Date().toISOString()}:old));}catch{setBackup({state:'error',msg:'הגיבוי לא זמין כרגע'});}}
 async function saveBackup(list:MailParcel[]){if(!backupOn.current)return;setBackup(b=>({...b,state:'saving'}));
  try{const r=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parcels:list.slice(0,400)})});const d=await r.json();if(!r.ok){setBackup({state:d.code==='NO_DRIVE'?'off':'error',msg:d.error});return;}saved.current=list;setBackup({state:'on',updated:d.updated});}catch{setBackup({state:'error',msg:'הגיבוי לא נשמר. ינסה שוב ברענון הבא.'});}}
 async function loadTracks(list:MailParcel[]){const numbers=list.filter(p=>p.tracking&&p.stage<4&&!p.cancelled).map(p=>p.tracking).slice(0,40);if(!numbers.length)return;
  try{const r=await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numbers}),cache:'no-store'});const d=await r.json();if(!d.enabled){setTrackState('off');return;}if(!r.ok)throw Error();setTracks(old=>({...old,...d.tracks}));setTrackState('on');}catch{setTrackState('error');}}
 async function copy(v:string){try{await navigator.clipboard.writeText(v);setCopied(v);setTimeout(()=>setCopied(''),1500);}catch{}}
 const parcels=useMemo(()=>(data?.parcels||[]).map(m=>{const p=withCarrier(m,tracks[m.tracking]);return {...p,name:titles[p.id]||displayName(m)};}),[data,titles,tracks]);
 const active=parcels.filter(p=>p.stage<4&&!p.cancelled),done=parcels.filter(p=>p.stage===4||p.cancelled);
 const q=search.trim().toLowerCase();const shown=(view==='done'?done:active).filter(p=>!q||[p.name,p.shop,p.carrier,p.tracking,p.order].join(' ').toLowerCase().includes(q));
 const pickup=active.filter(p=>p.stage===3).length;const open=parcels.find(p=>p.id===openId)||null;
 const go=(v:typeof view)=>{setView(v);setOpenId(null);window.scrollTo({top:0,behavior:'smooth'});};

 return <main className={large?'app large':'app'}>
 <header className="top">
  <div className="row"><span className="brand" dir="ltr"><img src="/brand.png" alt=""/>PacketDrop</span>
   <div className="actions"><button className="ib" aria-label="הגדלת טקסט" aria-pressed={large} onClick={()=>setLarge(!large)}><Type/></button>{user&&view!=='account'&&<button className="ib" aria-label="רענון חבילות" disabled={busy} onClick={()=>sync()}><RefreshCw className={busy?'spin':''}/></button>}</div></div>
  <h1>{view==='account'?'החשבון':view==='done'?'נמסרו':'החבילות שלי'}</h1>
  {user&&view!=='account'&&progress&&<div className="progress"><div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct} aria-label="התקדמות הסריקה"><i style={{width:progress.pct+'%'}}/></div><div className="plabel" aria-live="polite"><span>{progress.label}</span><b>{progress.pct}%</b></div></div>}
  {user&&view!=='account'&&!progress&&<p className="sub" role="status">{busy?'בודק את Gmail…':error?(!gmail||errorCode==='NO_GMAIL'?'קריאת Gmail לא אושרה':'הסריקה לא הושלמה'):data?ago(data.updated):'ממתין לסריקה'}</p>}
 </header>

 {view==='account'?<section className="panel account">
  <h2>{user?.name||'ברוך הבא'}</h2>{user&&<p className="mono" dir="ltr">{user.email}</p>}
  <p>הכניסה וקריאת עדכוני המשלוח נעשות דרך Google, בהרשאת קריאה בלבד.</p>
  <p>תוכן המיילים לא נשמר. בגיבוי נשמרים רק פרטי החבילות שזוהו ושמות שערכת.</p>
  {user&&<div className="backupCard"><div className="row"><h3><Cloud size={22}/> גיבוי בענן</h3><span className={'bstate '+backup.state}>{backup.state==='on'?'פעיל ✓':backup.state==='saving'?'שומר…':backup.state==='error'?'שגיאה':'כבוי'}</span></div>
   {backup.state==='off'?<><p>החבילות והשמות שערכת יישמרו בתיקייה נסתרת ב־Google Drive שלך. כך הם יחזרו בכל מכשיר, גם אחרי שמיילים נמחקים.</p><form action={login}><GoogleButton label="הפעל גיבוי עם Google" disabled={!configured}/></form></>
   :<><p>{backup.msg||('נשמר ב־Google Drive שלך, בתיקייה נסתרת שרק PacketDrop רואה.'+(backup.updated?' גיבוי אחרון: '+new Date(backup.updated).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}):''))}</p>
    <button className="ghost" disabled={backup.state==='saving'||busy} onClick={()=>saveBackup(data?.parcels||[])}><CloudUpload size={18}/> גבה עכשיו</button></>}</div>}
  {user?<button className="ghost" onClick={()=>signOut({callbackUrl:'/'})}>יציאה מהחשבון</button>:<form action={login}><GoogleButton label="התחבר עם Google" disabled={!configured}/></form>}
  {user&&<form action={login}><button className="textBtn" disabled={!configured}>חידוש הרשאת Google</button></form>}
  <p className="hint">להתקנה: Safari ← שיתוף ← הוספה למסך הבית.</p>
  <p className="hint"><a href="/privacy">מדיניות פרטיות</a></p>
 </section>:<>
  {!configured&&<section className="notice"><h2>PacketDrop מוכנה לחיבור</h2><p>חיבור Google עדיין לא הוגדר. נתוני הדגמה אינם מוצגים.</p></section>}
  {!user?<section className="panel empty"><Mail size={44}/><h2>כל החבילות שלך במקום אחד</h2><p>התחבר עם Google כדי לאסוף את הודעות ההזמנה והמשלוח מ־Gmail.</p><form action={login}><GoogleButton label="התחבר עם Google" disabled={!configured}/></form></section>:<>
   {view==='active'&&data&&<div className="chips"><span className="chip"><b>{active.length}</b> בדרך</span>{pickup>0&&<span className="chip warn"><b>{pickup}</b> מחכות לאיסוף</span>}<span className="chip"><b>{done.length}</b> נמסרו</span></div>}
   <label className="search"><Search size={20}/><input aria-label="חיפוש חבילות" placeholder="חיפוש מוצר, חנות או מספר מעקב" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {error&&<div className="error" role="alert"><span>{error}</span>{['NO_GMAIL','RECONNECT','UNAUTHORIZED'].includes(errorCode)?<form action={login}><button className="primary">חידוש הרשאת Google</button></form>:<button className="ghost" onClick={()=>sync()}>נסה שוב</button>}</div>}
   <div className="list">{shown.map(p=><button key={p.id} className={'card '+(p.stage===3&&!p.cancelled?'focus':'')} onClick={()=>setOpenId(p.id)} aria-label={p.name+', '+statusText(p)}>
    <div className="c"><Thumb p={p}/><div className="info"><div className="nm">{p.name}</div><Meta p={p}/><div className="st"><span className={'pill '+tone(p)}>{statusText(p)}</span>{p.stage===3&&p.pickup?.place&&!p.cancelled?<span className="eta">איסוף ב<b>{p.pickup.place}</b></span>:p.eta&&!p.cancelled&&<span className="eta">הגעה <b>{p.eta}</b></span>}</div></div></div>
    <Bar p={p}/></button>)}</div>
   {busy&&!data&&<div className="list">{[0,1,2].map(i=><div key={i} className="card skel"><div className="c"><div className="thumb"/><div className="info"><i/><i/><i/></div></div></div>)}</div>}
   {!shown.length&&!busy&&data&&<section className="panel empty"><Package size={40}/><h2>{q?'לא נמצאו חבילות':view==='done'?'עדיין אין חבילות שנמסרו':'אין חבילות בדרך'}</h2><p>{q?'נסה מילה אחרת.':'חבילות חדשות יופיעו כאן אחרי רענון.'}</p></section>}
   {data&&<p className="footnote">נסרקו {data.scanned} הודעות מ־180 הימים האחרונים{busy?', ממשיך לסרוק…':'.'}{data.failed?' '+data.failed+' הודעות לא נקראו, רענון ינסה שוב.':''} {trackState==='on'?'עדכונים מחברות השילוח דרך 17TRACK.':trackState==='error'?'חברות השילוח לא ענו כרגע, מוצג המידע מהמיילים.':'מועד הגעה מוצג רק אם מופיע במייל.'}</p>}
  </>}
 </>}

 {open&&<div className="sheet" role="dialog" aria-modal="true" aria-label={open.name}>
  <div className="sheetTop"><button className="ib" aria-label="חזרה" onClick={()=>setOpenId(null)}><ChevronRight/></button><button className="ib" aria-label="עריכת שם" disabled={!storage} title={!storage?'שמירת שמות דורשת גיבוי בענן':undefined} onClick={()=>{setEdit(open);setDraft(open.name);setEditError('');}}><Pencil size={20}/></button></div>
  <Thumb p={open} big/>
  <div className="dt"><h2>{open.name}</h2><Meta p={open}/></div>
  <section className="box"><div className="row"><span className={'pill '+tone(open)}>{statusText(open)}</span>{open.eta&&!open.cancelled&&<span className="eta">הגעה <b>{open.eta}</b></span>}</div>
   {!open.cancelled&&<div className={'steps '+tone(open)} style={{'--p':open.stage/4} as React.CSSProperties}>{STEP.map((s,i)=><div key={s} className={'sp '+(i<open.stage?'d':i===open.stage?'c':'')}><span/>{s}</div>)}</div>}</section>
  {open.pickup&&open.stage<4&&!open.cancelled&&<section className="box pickup"><h3><MapPin size={18}/> נקודת איסוף</h3>
   {open.pickup.place&&<p className="place">{open.pickup.place}</p>}{open.pickup.address&&<p className="addr">{open.pickup.address}</p>}{open.pickup.hours&&<p className="addr">שעות: {open.pickup.hours}</p>}
   {open.pickup.code&&<button className="code" onClick={()=>copy(open.pickup!.code)} aria-label={'קוד איסוף '+open.pickup.code.split('').join(' ')+', העתקה'}><KeyRound size={20}/><span>קוד איסוף</span><b dir="ltr">{open.pickup.code}</b>{copied===open.pickup.code?' ✓':<Copy size={17}/>}</button>}
   <div className="pickActions">{open.pickup.address&&<a className="ghost" href={'https://waze.com/ul?navigate=yes&q='+encodeURIComponent(open.pickup.place+' '+open.pickup.address)} target="_blank" rel="noopener noreferrer"><Navigation size={18}/> ניווט</a>}
    {open.pickup.url&&<a className="ghost" href={open.pickup.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/> שעות פתיחה</a>}</div></section>}
  {open.tracking&&trackState==='on'&&open.trackPending&&open.stage<4&&<p className="trackNote">מספר המעקב נרשם אצל חברת השילוח. העדכונים שלה יופיעו כאן בדקות הקרובות.</p>}
  <section className="box"><h3>היסטוריה</h3>{[...open.events].reverse().map((e,i)=><div key={e.id} className={'ev '+(!i?'l':'')}><span className="dot"/><div><strong dir="auto">{cleanLabel(e.label)}</strong>{e.src?<span className="src">מ־{e.src}</span>:<a href={'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(user?.email||'')+'#all/'+encodeURIComponent(e.id)} target="_blank" rel="noopener noreferrer">המייל המקורי <ExternalLink size={13}/></a>}</div><time dateTime={e.time}>{when(e.time)}</time></div>)}</section>
  {(open.tracking||open.order||open.url)&&<section className="box">
   {open.tracking&&<div className="kv"><span>מספר מעקב</span><button className="copy" onClick={()=>copy(open.tracking)}><b dir="ltr">{open.tracking}</b>{copied===open.tracking?' ✓':<Copy size={15}/>}</button></div>}
   {open.order&&<div className="kv"><span>מספר הזמנה</span><button className="copy" onClick={()=>copy(open.order)}><b dir="ltr">{open.order}</b>{copied===open.order?' ✓':<Copy size={15}/>}</button></div>}
   {open.url&&<a className="link" href={open.url} target="_blank" rel="noopener noreferrer">מעקב באתר החנות <ExternalLink size={15}/></a>}
  </section>}
 </div>}

 {!open&&<nav aria-label="ניווט ראשי" style={{'--tab':view==='account'?2:view==='done'?1:0} as React.CSSProperties}>{([['active','החבילות',Package],['done','נמסרו',CheckCircle2],['account','החשבון',UserRound]] as const).map(([key,label,Icon])=><button key={key} className={view===key?'selected':''} aria-current={view===key?'page':undefined} onClick={()=>go(key)}><Icon size={20}/><span>{label}</span></button>)}</nav>}
 <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!saving)setEdit(null);}} onClose={()=>setEdit(null)}><form onSubmit={e=>{e.preventDefault();void save();}}><h2>שם החבילה</h2><label htmlFor="title" className="sr">שם החבילה</label><input id="title" autoFocus maxLength={180} value={draft} onChange={e=>setDraft(e.target.value)} disabled={saving}/>{editError&&<p className="error" role="alert">{editError}</p>}<div className="dialogActions"><button className="primary" disabled={saving||!draft.trim()}>{saving?'שומר…':'שמירה'}</button><button type="button" className="ghost" disabled={saving} onClick={()=>setEdit(null)}>ביטול</button></div><button type="button" className="textBtn" disabled={saving} onClick={()=>save(true)}>חזרה לשם המקורי</button></form></dialog>
 </main>;
}
