import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
export const runtime='nodejs';
// Short Hebrew product names from long machine-translated store titles, with Gemini (Google AI Studio free tier).
// Each title is asked once and kept; the app's own rules remain the fallback when this is off or fails.
const PROMPT=`אלה כותרות של מוצרים מחנויות אונליין (לרוב תרגום מכונה גרוע). לכל כותרת כתוב שם קצר וטבעי בעברית, 2 עד 5 מילים, כמו שאדם היה קורא למוצר.
שמור שמות מותגים ודגמים חשובים באנגלית (למשל AirPods, Logitech F710, One Piece). בלי צבע, מידה, כמות, מילות שיווק או פיסוק מיותר.
החזר JSON בלבד: מערך מחרוזות באותו סדר ובאותו מספר כמו הקלט.`;
const h=(s:string)=>createHash('sha1').update(s).digest('hex');
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return Response.json({names:{},enabled:false},{headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const body=await req.json().catch(()=>({}));const titles=[...new Set(((body.titles||[]) as unknown[]).filter((t):t is string=>typeof t==='string'&&t.length>3&&t.length<300))].slice(0,25);
 const out:Record<string,string>={};let sql:ReturnType<typeof db>['sql']|null=null;
 if(dbOn()){const d=db();await d.ready;sql=d.sql;await sql`create table if not exists name_cache(k text primary key,title text not null,name text not null,created_at timestamptz not null default now())`;
  const rows=titles.length?await sql`select k,name from name_cache where k = any(${titles.map(h)})`:[];const got=new Map(rows.map(r=>[r.k as string,r.name as string]));for(const t of titles){const n=got.get(h(t));if(n)out[t]=n;}}
 const todo=titles.filter(t=>!out[t]);
 if(todo.length){try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
   body:JSON.stringify({contents:[{parts:[{text:PROMPT+'\n\n'+JSON.stringify(todo)}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
  if(r.ok){const j=await r.json();const arr=JSON.parse(String(j?.candidates?.[0]?.content?.parts?.[0]?.text||'[]'));
   if(Array.isArray(arr)&&arr.length===todo.length)for(let i=0;i<todo.length;i++){const n=String(arr[i]||'').replace(/\s+/g,' ').trim();if(n&&n.length<=45){out[todo[i]]=n;if(sql)await sql`insert into name_cache(k,title,name) values(${h(todo[i])},${todo[i]},${n}) on conflict(k) do nothing`;}}}
 }catch{}}
 return Response.json({names:out,enabled:true},{headers:H});}
