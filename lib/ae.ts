// AliExpress's own delivery date, read from the order page in the user's phone (Scriptable, signed in there once).
// The phone sends the page text; reading the date happens here, so the parser can improve without a new phone script.
const MON:Record<string,number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
 'ינו':1,'פבר':2,'מרץ':3,'מרס':3,'אפר':4,'מאי':5,'יונ':6,'יול':7,'אוג':8,'ספט':9,'אוק':10,'נוב':11,'דצמ':12};
const monOf=(s:string)=>{const k=s.toLowerCase().replace(/^ב/,'').slice(0,3);return MON[k]||0;};
const EN='(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const HE='ב?(ינו|פבר|מרץ|מרס|אפר|מאי|יונ|יול|אוג|ספט|אוק|נוב|דצמ)[א-ת]*[׳\'"]?';
// Words around the date that mean "this is when it comes" (not order date, payment date or "ordered on").
const KEY=/(?:תקופת (?:ה)?אספקה|arriving|now expected|estimated delivery|delivery by|deliver(?:ed|y)? (?:by|on|before|between)|arriv(?:e|es|al)(?: by| on| between)?|expected (?:delivery|by)|delivery date|delivery:|guaranteed|זמן אספקה|אספקה עד|צפי (?:ה)?הגעה|צפי (?:ה)?אספקה|יגיע(?:ו)? (?:עד|בין|ב)|תגיע (?:עד|בין|ב)|הגעה (?:עד|משוערת|צפויה)|מסירה (?:עד|משוערת|צפויה)|משלוח (?:עד|צפוי)|צפוי(?:ה)? להגיע)/i;
type D={d:number;m:number};
function datesIn(s:string):D[]{const out:D[]=[];let m:RegExpExecArray|null;
 const rx=[new RegExp(EN+'\\s*(\\d{1,2})','gi'),new RegExp('(\\d{1,2})\\s*'+EN,'gi'),new RegExp('(\\d{1,2})\\s*'+HE,'g'),new RegExp(HE+'\\s*(\\d{1,2})','g'),/(?<![\d.])(\d{1,2})[./](\d{1,2})(?![\d.]*\d{3})/g];
 const hits:{i:number;v:D}[]=[];
 rx.forEach((r,k)=>{while((m=r.exec(s))){let d=0,mo=0;if(k===0||k===3){mo=monOf(m[1]);d=+m[2];}else if(k===1||k===2){d=+m[1];mo=monOf(m[2]);}else{d=+m[1];mo=+m[2];}
  if(mo>=1&&mo<=12&&d>=1&&d<=31)hits.push({i:m.index,v:{d,m:mo}});}});
 // "Oct 24 - 30": the second number borrows the month.
 const r2=new RegExp(EN+'\\s*(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})(?!\\s*[./])','gi');while((m=r2.exec(s))){const mo=monOf(m[1]);hits.push({i:m.index+1,v:{d:+m[3],m:mo}});}
 const r3=new RegExp('(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s*'+HE,'g');while((m=r3.exec(s))){const mo=monOf(m[3]);hits.push({i:m.index-1,v:{d:+m[1],m:mo}});}
 hits.sort((a,b)=>a.i-b.i);for(const h of hits)if(!out.some(x=>x.d===h.v.d&&x.m===h.v.m))out.push(h.v);return out;}
const fmt=(x:D)=>x.d+'.'+x.m;
const at=(x:D,now:Date)=>{let t=new Date(now.getFullYear(),x.m-1,x.d).getTime();if(t<now.getTime()-120*864e5)t=new Date(now.getFullYear()+1,x.m-1,x.d).getTime();return t;};
// "24.10" or "24.10-30.10", or '' when the page holds no delivery date.
// The order page's own line ("תקופת האספקה: Oct 11 - 22") wins over other dated lines (fast-delivery coupon, refund).
const STRONG=/תקופת (?:ה)?אספקה|delivery period|estimated delivery|זמן אספקה משוער/i;
export function aeEta(text:string,now=new Date()):string{const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
 for(const key of [STRONG,KEY])for(let i=0;i<lines.length;i++){if(!key.test(lines[i]))continue;
  const near=[lines[i],lines[i+1]||'',lines[i+2]||''].join(' ').slice(0,200);const ds=datesIn(near).filter(x=>{const t=at(x,now);return t>now.getTime()-30*864e5&&t<now.getTime()+120*864e5;});
  if(!ds.length)continue;const a=ds[0],b=ds[1];if(b&&at(b,now)>at(a,now)&&at(b,now)-at(a,now)<40*864e5)return at(a,now)<now.getTime()-864e5?fmt(b):fmt(a)+'-'+fmt(b);return fmt(a);}

 // Amazon style: "Arriving Thursday" / "Arriving tomorrow" (no date written).
 const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],HED=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
 for(const l of lines){if(!/arriving|expected|יגיע|תגיע|צפוי/i.test(l))continue;const low=l.toLowerCase();let add=-1;
  if(/\btoday\b|היום/.test(low))add=0;else if(/tomorrow|מחר/.test(low))add=1;else{const i=DAYS.findIndex(d=>low.includes(d));const h=HED.findIndex(d=>new RegExp('(?:יום |ב)'+d+'(?![א-ת])').test(l));const k=i>=0?i:h;if(k>=0)add=(k-now.getDay()+7)%7||7;}
  if(add>=0){const t=new Date(now.getTime()+add*864e5);return t.getDate()+'.'+(t.getMonth()+1);}}
 return '';}
// Runs inside the order page: its text, plus each product's photo and title (not the "you may also like" list below).
const GRAB=String.raw`let n=0;
const items=()=>{try{const mk=[...document.querySelectorAll('div,section,h2,h3,span,p')].find(e=>/ייתכן שגם תאהבו|More to love|You may also like|Recommended for you/i.test(e.textContent||'')&&(e.textContent||'').length<60);
 return [...document.images].filter(i=>/alicdn|aliexpress-media/.test(i.currentSrc||i.src)&&Math.max(i.naturalWidth,i.width)>=60&&!/logo|icon|avatar|banner|\.gif|\.svg/i.test(i.src)&&!(mk&&(mk.compareDocumentPosition(i)&4))).slice(0,8).map(i=>{let e=i,t='';for(let k=0;k<6&&e&&!t;k++){e=e.parentElement;const s=((e&&e.innerText)||'').split('\n').map(x=>x.trim()).find(x=>x.length>12&&!/₪|\$|US |^x\d|×|\d+\s*(?:יח|pcs)/i.test(x));if(s)t=s}return {img:(i.currentSrc||i.src).replace(/_\d+x\d+[^/]*$/,''),title:t.slice(0,200)}})}catch(e){return []}};
const f=()=>{const t=document.body?document.body.innerText:'';if((t.length>800&&/\d/.test(t))||n++>45)completion(JSON.stringify({u:location.href,t:t.slice(0,30000),items:items()}));else setTimeout(f,300)};f()`;
// When AliExpress itself will close the order ("המערכת תאשר אוטומטית את הקבלה לאחר 69 ימים"): days from now, or 0.
export function aeCloseDays(text:string):number{const m=text.match(/(?:תאשר\S* (?:אוטומטית )?את (?:ה)?קבלה|אישור (?:קבלה )?אוטומטי|confirm(?:ed|s)? (?:receipt |delivery )?automatically)[^\d\n]{0,25}(\d{1,3})\s*(?:ימים|יום|days?)/i);return m?+m[1]:0;}
// "22.10" / "21.10-28.10" -> the moment to count to (a window already started counts to its end).
export function aeWhen(eta:string,now=new Date()):number{const ds=[...eta.matchAll(/(\d{1,2})\.(\d{1,2})/g)].map(m=>{let t=new Date(now.getFullYear(),+m[2]-1,+m[1],12).getTime();if(t<now.getTime()-120*864e5)t=new Date(now.getFullYear()+1,+m[2]-1,+m[1],12).getTime();return t;});
 if(!ds.length)return NaN;return ds[0]<now.getTime()&&ds[1]?ds[1]:ds[0];}
// Runs inside Scriptable (loaded by the tiny script on the phone). `u` = the personal link.
export const AE_JS=`const log=async m=>{try{const x=new Request(u);x.method='POST';x.headers={'Content-Type':'application/json'};x.body=JSON.stringify({error:m,ctx:config.runsInApp?'app':config.runsWithSiri?'siri':'shortcut'});await x.loadJSON()}catch(_){}}
await log('התחיל')
try{
const r=await new Request(u).loadJSON().catch(()=>null)
// Each job: one open order page in one store (AliExpress, Amazon, iHerb...). Older servers sent only AliExpress order numbers.
const jobs=(r&&r.jobs)||((r&&r.orders)||[]).map(o=>({shop:'AliExpress',order:o,url:'https://www.aliexpress.com/p/order/detail.html?orderId='+o}))
await log('הזמנות: '+jobs.length)
const wv=new WebView()
const grab=${JSON.stringify(GRAB)}
async function page(url){await wv.loadURL(url);try{return JSON.parse(await wv.evaluateJavaScript(grab,true))}catch(e){return {u:'',t:''}}}
const needLogin=p=>/login|passport|signin|sign-in/i.test(p.u)
let done=0,sent=[],failed=new Set(),asked=new Set()
for(const j of jobs.slice(0,15)){if(failed.has(j.shop))continue
 let q=await page(j.url)
 if(needLogin(q)){
  // First time for this store: sign in once inside Scriptable (it remembers), then the same page again.
  if(config.runsInApp&&!asked.has(j.shop)){asked.add(j.shop);const a=new Alert();a.title='התחברות ל־'+j.shop;a.message='התחבר פעם אחת. בסוף ההתחברות סגור את החלון (Close) והסקריפט ימשיך.';a.addAction('אישור');a.addCancelAction('דלג');if(await a.present()===0){await wv.loadURL(j.url);await wv.present(true);q=await page(j.url)}}
  if(needLogin(q)){failed.add(j.shop);continue}}
 if(!q.t)continue
 const res=await (()=>{const x=new Request(u);x.method='POST';x.headers={'Content-Type':'application/json'};x.body=JSON.stringify({order:j.order,shop:j.shop,text:q.t,items:q.items||[]});return x.loadJSON().catch(()=>null)})()
 done++;if(res&&res.eta)sent.push(res.eta)}
const msg=jobs.length?('נבדקו '+done+' הזמנות'+(sent.length?' · נמצאו תאריכים: '+sent.join(', '):' · לא נמצא תאריך')+(failed.size?' · צריך להתחבר ל: '+[...failed].join(', '):'')):'אין הזמנות פתוחות'
// No daily "all fine" notification: delays and closing orders come as Unbox notifications from the server.
if((!sent.length&&jobs.length)||failed.size){const n=new Notification();n.title='Unbox';n.body=msg;await n.schedule()}
await log('סיום: '+msg)
Script.setShortcutOutput(msg)
}catch(e){const m='שגיאה: '+String(e&&e.message||e).slice(0,200);try{const x=new Request(u);x.method='POST';x.headers={'Content-Type':'application/json'};x.body=JSON.stringify({error:m,ctx:config.runsInApp?'app':config.runsWithSiri?'siri':'shortcut'});await x.loadJSON()}catch(_){}
if(config.runsInApp){const a=new Alert();a.title='Unbox';a.message=m;a.addAction('סגור');await a.present()}Script.setShortcutOutput(m)}
Script.complete()`;
export const aeLoader=(url:string)=>`// Unbox · AliExpress delivery dates. Loads its code from Unbox, so updates arrive by themselves.
const u=${JSON.stringify(url)}
const code=await new Request(u+'&js=1').loadString().catch(()=>'')
const AF=Object.getPrototypeOf(async function(){}).constructor
if(code)await new AF('u',code)(u);else Script.complete()`;
