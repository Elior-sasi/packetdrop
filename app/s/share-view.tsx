// The shared page itself, kept apart so it can be previewed with sample data.
import type {SharedParcel} from '@/lib/share';
const STEP=['התקבלה','נשלחה','בדרך','לאיסוף','נמסרה'];
const when=(iso:string)=>{const d=new Date(iso);if(isNaN(+d))return '';const diff=Date.now()-d.getTime();const h=Math.round(diff/36e5);
 if(diff<36e5)return 'לפני פחות משעה';if(h<24)return h===1?'לפני שעה':h===2?'לפני שעתיים':'לפני '+h+' שעות';
 return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'})+' בשעה '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'});};
export default function ShareView({s}:{s:{title:string;parcels:SharedParcel[]}}){
 const n=s.parcels.length;const head=s.title?(n>1?n+' חבילות ל'+s.title:'חבילה ל'+s.title):(n>1?n+' חבילות בדרך':'חבילה בדרך');
 return <main className="sp-page">
  <meta httpEquiv="refresh" content="300"/>
  <h1>{head}</h1>
  <ul className="sp-list">{s.parcels.map((p,i)=>{const st=Math.min(4,p.stage);return <li key={i} className="sp-card">
   <div className="sp-top">{p.image?<img src={p.image} alt="" referrerPolicy="no-referrer"/>:<span className="sp-ph" aria-hidden="true">📦</span>}
    <div><h2 dir="auto">{p.name}</h2><p className={'sp-status'+(st===3?' pick':st===4?' done':'')}>{p.status}</p></div></div>
   <ol className="sp-steps" aria-label={'שלב '+(st+1)+' מתוך 5: '+STEP[st]}>{STEP.map((t,j)=><li key={t} className={j<=st?'on':''} aria-hidden="true"><span/>{t}</li>)}</ol>
   {p.eta&&st<4&&<p className="sp-eta">צפי הגעה: <b>{p.eta}</b></p>}
   {p.pickup&&st===3&&<div className="sp-pick"><p><b>איפה לאסוף:</b> {p.pickup.place}{p.pickup.address?', '+p.pickup.address:''}</p>{p.pickup.code&&<p><b>קוד איסוף:</b> <span dir="ltr">{p.pickup.code}</span></p>}{p.pickup.hours&&<p><b>שעות:</b> {p.pickup.hours}</p>}
    {(p.pickup.address||p.pickup.place)&&<a className="sp-nav" href={'https://maps.google.com/?q='+encodeURIComponent([p.pickup.place,p.pickup.address].filter(Boolean).join(' '))} target="_blank" rel="noopener noreferrer">ניווט לנקודת האיסוף</a>}</div>}
   <p className="sp-note">עודכן {when(p.at)}</p></li>;})}</ul>
  <p className="sp-foot">הדף מתעדכן לבד · Unbox</p></main>;}
