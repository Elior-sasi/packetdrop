// AliExpress's own delivery date, read from the order page in the user's phone (Scriptable, signed in there once).
// The phone sends the page text; reading the date happens here, so the parser can improve without a new phone script.
const MON:Record<string,number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
 'ינו':1,'פבר':2,'מרץ':3,'מרס':3,'אפר':4,'מאי':5,'יונ':6,'יול':7,'אוג':8,'ספט':9,'אוק':10,'נוב':11,'דצמ':12};
const monOf=(s:string)=>{const k=s.toLowerCase().replace(/^ב/,'').slice(0,3);return MON[k]||0;};
const EN='(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const HE='ב?(ינו|פבר|מרץ|מרס|אפר|מאי|יונ|יול|אוג|ספט|אוק|נוב|דצמ)[א-ת]*[׳\'"]?';
// Words around the date that mean "this is when it comes" (not order date, payment date or "ordered on").
const KEY=/(?:estimated delivery|delivery by|deliver(?:ed|y)? (?:by|on|before|between)|arriv(?:e|es|al)(?: by| on| between)?|expected (?:delivery|by)|delivery date|delivery:|guaranteed|זמן אספקה|אספקה עד|צפי (?:ה)?הגעה|צפי (?:ה)?אספקה|יגיע(?:ו)? (?:עד|בין|ב)|תגיע (?:עד|בין|ב)|הגעה (?:עד|משוערת|צפויה)|מסירה (?:עד|משוערת|צפויה)|משלוח (?:עד|צפוי)|צפוי(?:ה)? להגיע)/i;
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
export function aeEta(text:string,now=new Date()):string{const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
 for(let i=0;i<lines.length;i++){if(!KEY.test(lines[i]))continue;
  const near=[lines[i],lines[i+1]||'',lines[i+2]||''].join(' ').slice(0,200);const ds=datesIn(near).filter(x=>{const t=at(x,now);return t>now.getTime()-30*864e5&&t<now.getTime()+120*864e5;});
  if(!ds.length)continue;const a=ds[0],b=ds[1];if(b&&at(b,now)>at(a,now)&&at(b,now)-at(a,now)<40*864e5)return fmt(a)+'-'+fmt(b);return fmt(a);}
 return '';}
// Runs inside Scriptable (loaded by the tiny script on the phone). `u` = the personal link.
export const AE_JS=`const r=await new Request(u).loadJSON().catch(()=>null)
const orders=(r&&r.orders)||[]
const wv=new WebView()
const grab="let n=0;const f=()=>{const t=document.body?document.body.innerText:'';if((t.length>800&&/\\\\d/.test(t))||n++>45)completion(JSON.stringify({u:location.href,t:t.slice(0,30000)}));else setTimeout(f,300)};f()"
async function page(url){await wv.loadURL(url);try{return JSON.parse(await wv.evaluateJavaScript(grab,true))}catch(e){return {u:'',t:''}}}
const needLogin=p=>/login|passport|signin/i.test(p.u)
let done=0,sent=[]
if(orders.length){
 let p=await page('https://www.aliexpress.com/p/order/index.html')
 if(needLogin(p)){
  if(config.runsInApp){const a=new Alert();a.title='התחברות לעליאקספרס';a.message='התחבר פעם אחת. אחרי ההתחברות סגור את החלון (Close) והסקריפט ימשיך.';a.addAction('אישור');await a.present();await wv.loadURL('https://login.aliexpress.com/');await wv.present(true);p=await page('https://www.aliexpress.com/p/order/index.html')}
  if(needLogin(p)){const n=new Notification();n.title='Unbox';n.body='צריך להתחבר לעליאקספרס: פתח את הסקריפט Unbox AliExpress';if(!config.runsInApp)await n.schedule();else{const a=new Alert();a.title='לא מחובר';a.message='ההתחברות לא הושלמה. נסה שוב.';a.addAction('אישור');await a.present()}Script.complete();return}}
 for(const o of orders.slice(0,12)){const q=await page('https://www.aliexpress.com/p/order/detail.html?orderId='+o);if(!q.t)continue
  const res=await (()=>{const x=new Request(u);x.method='POST';x.headers={'Content-Type':'application/json'};x.body=JSON.stringify({order:o,text:q.t});return x.loadJSON().catch(()=>null)})()
  done++;if(res&&res.eta)sent.push(res.eta)}}
if(config.runsInApp){const a=new Alert();a.title='Unbox';a.message=orders.length?('נבדקו '+done+' הזמנות'+(sent.length?' · נמצאו תאריכים: '+sent.join(', '):' · לא נמצא תאריך')):'אין הזמנות פתוחות מעליאקספרס';a.addAction('סגור');await a.present()}
Script.complete()`;
export const aeLoader=(url:string)=>`// Unbox · AliExpress delivery dates. Loads its code from Unbox, so updates arrive by themselves.
const u=${JSON.stringify(url)}
const code=await new Request(u+'&js=1').loadString().catch(()=>'')
const AF=Object.getPrototypeOf(async function(){}).constructor
if(code)await new AF('u',code)(u);else Script.complete()`;
