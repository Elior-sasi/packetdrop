// Short Hebrew product names, shared by the app (/api/names) and phone notifications.
// Gemini (Google AI Studio free tier) writes each name once; it is kept in the database. Without a key the app's own rules apply.
import {createHash} from 'node:crypto';
import {polishName,photoKey,type Parcel} from '@/lib/parcels';
import {heName} from '@/lib/hename';
import {gemini} from '@/lib/gemini';
import type {db} from '@/lib/push';
type Sql=ReturnType<typeof db>['sql'];
const PROMPT=`אלה כותרות של מוצרים מחנויות אונליין (לרוב תרגום מכונה גרוע). לכל כותרת כתוב שם קצר, טבעי ומדויק בעברית, 2 עד 7 מילים.
חשוב לשמור את הפרטים שמזהים את המוצר: שם הדמות והסדרה בתחפושות ובמוצרי מעריצים (למשל "תחפושת ג'ינבה מוואן פיס"), הדגם המדויק שהמוצר מתאים לו (למשל "כיסוי ל־AirPods 4", "מגן מסך ל־iPhone 15 Pro"), ושמות מותגים ודגמים (Logitech F710).
אם הכותרת מתארת דמות בלי לכתוב את שמה, זהה אותה מהתיאור אם אתה בטוח. בלי צבע, מידה, כמות, מילות שיווק או פיסוק מיותר.
החזר JSON בלבד: מערך מחרוזות באותו סדר ובאותו מספר כמו הקלט.`;
const h=(s:string)=>createHash('sha1').update('v2|'+s).digest('hex');
export async function shortNames(input:string[],sql:Sql|null):Promise<Record<string,string>>{
 const titles=[...new Set(input.filter(t=>typeof t==='string'&&t.length>3&&t.length<300))].slice(0,25);const out:Record<string,string>={};
 const apiKey=process.env.GEMINI_API_KEY;if(!apiKey||!titles.length)return out;
 if(sql){await sql`create table if not exists name_cache(k text primary key,title text not null,name text not null,created_at timestamptz not null default now())`;
  const rows=await sql`select k,name from name_cache where k = any(${titles.map(h)})`;const got=new Map(rows.map(r=>[r.k as string,r.name as string]));for(const t of titles){const n=got.get(h(t));if(n)out[t]=n;}}
 const todo=titles.filter(t=>!out[t]);
 if(todo.length){try{
  const g=await gemini({contents:[{parts:[{text:PROMPT+'\n\n'+JSON.stringify(todo)}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}});
  if(g.ok){const arr=JSON.parse(g.text.replace(/^```(?:json)?|```$/g,'').trim());
   if(Array.isArray(arr)&&arr.length===todo.length)for(let i=0;i<todo.length;i++){const n=String(arr[i]||'').replace(/\s+/g,' ').trim();if(n&&n.length<=60){out[todo[i]]=n;if(sql)await sql`insert into name_cache(k,title,name) values(${h(todo[i])},${todo[i]},${n}) on conflict(k) do nothing`;}}}
 }catch{}}
 return out;}
const generic=(n:string)=>!n||/^(?:חבילה|הזמנה|משלוח|order|package)$/i.test(n.trim());
const parts=(name:string)=>name.split(' + ').map(x=>{const m=x.match(/^(.*?)( ועוד \d+)?$/)!;return {t:m[1],more:m[2]||''};});
// The same readable name the app shows: Gemini's when it has one, otherwise the app's own clean-up; a photo's name for title-less orders.
export async function prettyNames(ps:Parcel[],sql:Sql|null):Promise<Map<string,string>>{
 const want=ps.filter(p=>!generic(p.name)&&/AliExpress|Temu|SHEIN/i.test(p.shop||'')).flatMap(p=>parts(p.name).map(x=>x.t)).filter(t=>!/^הזמנה …/.test(t));
 const gem=await shortNames(want,sql).catch(()=>({} as Record<string,string>));
 const photo=new Map<string,string>();const img=(p:Parcel)=>p.images?.[0]||p.image||'';const keys=ps.filter(p=>generic(p.name)&&img(p)).map(p=>photoKey(img(p)));
 if(sql&&keys.length){try{const rows=await sql`select k,name from photo_names where k = any(${keys})`;for(const r of rows)photo.set(r.k as string,r.name as string);}catch{}}
 const out=new Map<string,string>();
 for(const p of ps){if(generic(p.name)){const n=img(p)?photo.get(photoKey(img(p))):undefined;if(n)out.set(p.id,n);continue;}
  out.set(p.id,parts(p.name).map(x=>(gem[x.t]||heName(polishName(x.t)))+x.more).join(' + '));}
 return out;}
