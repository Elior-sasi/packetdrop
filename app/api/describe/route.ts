import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
export const runtime='nodejs';
// A short Hebrew description of a product photo, so VoiceOver can tell what the item looks like.
// Asked only for the parcel the user opens; each photo once, kept in the database, with a daily cap inside the free quota.
const HOSTS=/(?:^|\.)(?:aliexpress-media\.com|alicdn\.com|media-amazon\.com|ssl-images-amazon\.com|cdn\.shopify\.com|temu\.com|kwcdn\.com|ltwebstatic\.com|ebayimg\.com)$/i;
const key=(u:string)=>(u.match(/\/kf\/([A-Za-z0-9]+)/)?.[1]||u.replace(/[?#].*$/,'')).toLowerCase().slice(0,200);
const PROMPT='תאר את המוצר שבתמונה בעברית, למי שלא רואה אותה: מה המוצר, צבע, צורה, הדפס או כיתוב בולט. משפט אחד או שניים, עד 25 מילים. בלי "בתמונה רואים", בלי מחיר ובלי שיווק.';
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return Response.json({desc:{},enabled:false},{headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const body=await req.json().catch(()=>({}));const urls=[...new Set(((body.images||[]) as unknown[]).filter((u):u is string=>typeof u==='string'))].slice(0,6);
 const desc:Record<string,string>={};const sql=dbOn()?(await (async()=>{const d=db();await d.ready;await d.sql`create table if not exists photo_desc(k text primary key,text text not null,created_at timestamptz not null default now())`;return d.sql;})()):null;
 const todo:string[]=[];
 for(const u of urls){let h:URL;try{h=new URL(u);}catch{continue;}if(h.protocol!=='https:'||!HOSTS.test(h.hostname))continue;const k=key(u);
  const row=sql?(await sql`select text from photo_desc where k=${k}`)[0]:null;if(row)desc[u]=row.text as string;else todo.push(u);}
 const used=sql&&todo.length?Number((await sql`select count(*)::int as n from photo_desc where created_at>now()-interval '1 day'`)[0]?.n||0):0;
 await Promise.all(todo.slice(0,Math.max(0,60-used)).map(async u=>{try{
   const img=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!img.ok)return;const buf=Buffer.from(await img.arrayBuffer());if(buf.length>4_000_000)return;
   const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:img.headers.get('content-type')?.split(';')[0]||'image/jpeg',data:buf.toString('base64')}},{text:PROMPT}]}],generationConfig:{temperature:0.2,maxOutputTokens:120,thinkingConfig:{thinkingBudget:0}}})});
   if(!r.ok)return;const j=await r.json();const t=String(j?.candidates?.[0]?.content?.parts?.[0]?.text||'').replace(/\s+/g,' ').trim();
   if(!t||t.length>220||!/[֐-׿]/.test(t))return;desc[u]=t;if(sql)await sql`insert into photo_desc(k,text) values(${key(u)},${t}) on conflict(k) do nothing`;
  }catch{}}));
 return Response.json({desc,enabled:true},{headers:H});}
