import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
export const runtime='nodejs';
// Names a product from its photo with Gemini (Google AI Studio free tier), only for orders whose mails carry no product name.
// Each photo is asked once; the answer is kept in the database. A daily cap keeps it inside the free quota.
const HOSTS=/(?:^|\.)(?:aliexpress-media\.com|alicdn\.com|media-amazon\.com|ssl-images-amazon\.com|cdn\.shopify\.com)$/i;
const key=(u:string)=>(u.match(/\/kf\/([A-Za-z0-9]+)/)?.[1]||u.replace(/[?#].*$/,'')).toLowerCase().slice(0,200);
const PROMPT='זו תמונת מוצר מחנות אונליין. כתוב רק את שם המוצר בעברית, 2 עד 4 מילים, כמו שאדם היה קורא לו (למשל "חולצת אנימה", "מקלט USB אלחוטי", "שקע חכם"). בלי מותג, בלי צבע, בלי מידה, בלי פיסוק.';
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return Response.json({names:{},enabled:false},{headers:H});
 let user:{id:string};try{user=await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const body=await req.json().catch(()=>({}));const urls=[...new Set(((body.images||[]) as unknown[]).filter((u):u is string=>typeof u==='string'))].slice(0,6);
 const names:Record<string,string>={};const sql=dbOn()?(await (async()=>{const d=db();await d.ready;await d.sql`create table if not exists photo_names(k text primary key,name text not null,created_at timestamptz not null default now())`;return d.sql;})()):null;
 const todo:string[]=[];
 for(const u of urls){let h:URL;try{h=new URL(u);}catch{continue;}if(h.protocol!=='https:'||!HOSTS.test(h.hostname))continue;const k=key(u);
  const row=sql?(await sql`select name from photo_names where k=${k}`)[0]:null;if(row)names[k]=row.name as string;else todo.push(u);}
 // Daily cap per user (free tier): at most 40 new photos a day.
 const day='vision:'+user.id+':'+new Date().toISOString().slice(0,10);let used=0;
 if(sql&&todo.length){used=Number((await sql`select count(*)::int as n from photo_names where created_at>now()-interval '1 day'`)[0]?.n||0);}
 for(const u of todo.slice(0,Math.max(0,40-used))){try{
   const img=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!img.ok)continue;const buf=Buffer.from(await img.arrayBuffer());if(buf.length>4_000_000)continue;
   const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:img.headers.get('content-type')?.split(';')[0]||'image/jpeg',data:buf.toString('base64')}},{text:PROMPT}]}],generationConfig:{temperature:0.2,maxOutputTokens:40,thinkingConfig:{thinkingBudget:0}}})});
   if(!r.ok)continue;const j=await r.json();const t=String(j?.candidates?.[0]?.content?.parts?.[0]?.text||'').replace(/["'״׳.\n]/g,' ').replace(/\s+/g,' ').trim();
   if(!t||t.length>40||!/[֐-׿]/.test(t))continue;const k=key(u);names[k]=t;if(sql)await sql`insert into photo_names(k,name) values(${k},${t}) on conflict(k) do nothing`;
  }catch{}}
 void day;return Response.json({names,enabled:true},{headers:H});}
