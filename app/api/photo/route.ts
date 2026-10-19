import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
import {gemini} from '@/lib/gemini';
export const runtime='nodejs';
// A product photo for orders whose mails carry none: Gemini (with Google Search) finds the product's page,
// and the page's own preview image (og:image) is used. Each product is looked up once; "not found" is remembered too.
const h=(s:string)=>createHash('sha1').update(s).digest('hex');
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function pageImage(url:string){try{const r=await fetch(url,{headers:{'User-Agent':UA,Accept:'text/html'},redirect:'follow',signal:AbortSignal.timeout(9000)});if(!r.ok)return '';
 const html=(await r.text()).slice(0,400000);const m=html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
 if(!m)return '';const img=new URL(m[1].replace(/&amp;/g,'&'),r.url).href;return /^https:\/\//.test(img)&&!/logo|favicon|placeholder|default/i.test(img)?img:'';}catch{return '';}}
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 if(!process.env.GEMINI_API_KEY)return Response.json({photos:{},enabled:false},{headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const body=await req.json().catch(()=>({}));const items=((body.items||[]) as {name?:unknown;shop?:unknown}[]).filter(x=>typeof x?.name==='string'&&x.name.length>3).slice(0,3) as {name:string;shop?:string}[];
 const out:Record<string,string>={};const sql=dbOn()?(await (async()=>{const d=db();await d.ready;await d.sql`create table if not exists product_photos(k text primary key,name text not null,url text not null,created_at timestamptz not null default now())`;return d.sql;})()):null;
 for(const it of items){const key=h((it.shop||'')+'|'+it.name);
  const row=sql?(await sql`select url from product_photos where k=${key}`)[0]:null;if(row){out[it.name]=row.url as string;continue;}
  const g=await gemini({contents:[{parts:[{text:`מצא בגוגל את דף המוצר הזה${it.shop?' (נקנה ב־'+it.shop+')':''}: "${it.name.slice(0,150)}". העדף את אתר החנות או את אתר היצרן. החזר רק כתובת URL אחת של דף המוצר, בלי שום טקסט נוסף. אם לא מצאת דף של המוצר המדויק, החזר: none`}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}},25000);
  if(!g.ok){if(g.status===429)break;continue;}
  const url=g.text.match(/https?:\/\/[^\s"'<>)\]]+/)?.[0]||'';const img=url?await pageImage(url):'';
  out[it.name]=img;if(sql)await sql`insert into product_photos(k,name,url) values(${key},${it.name},${img}) on conflict(k) do update set url=excluded.url`;}
 return Response.json({photos:out,enabled:true},{headers:H});}
