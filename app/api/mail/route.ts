import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {gmailClient} from '@/lib/gmail';
export const dynamic='force-dynamic';
// The original mail behind a route step, shown inside the app (Gmail on the phone cannot open one message from a link).
type Part={filename?:string;mimeType?:string;body?:{data?:string;attachmentId?:string;size?:number};parts?:Part[];headers?:{name:string;value:string}[]};
const dec=(d:string)=>Buffer.from(d.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
function find(p:Part|undefined,type:string):string{if(!p)return '';if(p.mimeType===type&&p.body?.data)return dec(p.body.data);for(const c of p.parts||[]){const r=find(c,type);if(r)return r;}return '';}
// Attached PDFs and pictures (some stores put the whole order in a PDF: "ראה קובץ מצורף").
function files(p:Part|undefined):{id:string;name:string;type:string}[]{if(!p)return [];const here=p.filename&&p.body?.attachmentId&&/\.(pdf|png|jpe?g|gif|webp)$/i.test(p.filename)?[{id:p.body.attachmentId,name:p.filename,type:/\.pdf$/i.test(p.filename)?'application/pdf':'image/'+(p.filename.match(/\.(\w+)$/)![1].toLowerCase().replace('jpg','jpeg'))}]:[];return [...here,...(p.parts||[]).flatMap(files)].slice(0,6);}
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export async function GET(req:NextRequest){const H={'Cache-Control':'private, no-store'};
 const id=req.nextUrl.searchParams.get('id')||'';if(!/^[a-zA-Z0-9]{6,40}$/.test(id))return Response.json({error:'bad id'},{status:400,headers:H});
 try{const {accessToken}=await identity(req);const gmail=gmailClient(accessToken);
  // ?att=<attachment id>: the attached file itself (only one that belongs to this message).
  const att=req.nextUrl.searchParams.get('att');
  if(att){const m=await gmail('messages/'+encodeURIComponent(id)+'?format=full');const f=files(m.payload).find(x=>x.id===att);if(!f)return Response.json({error:'not found'},{status:404,headers:H});
   const a=await gmail('messages/'+encodeURIComponent(id)+'/attachments/'+encodeURIComponent(att));const buf=Buffer.from(String(a.data||'').replace(/-/g,'+').replace(/_/g,'/'),'base64');
   return new Response(buf,{headers:{...H,'Content-Type':f.type,'Content-Disposition':'inline'}});}
  const m=await gmail('messages/'+encodeURIComponent(id)+'?format=full');
  const hs=(m.payload?.headers||[]) as {name:string;value:string}[];const h=(n:string)=>hs.find(x=>x.name.toLowerCase()===n)?.value||'';
  let html=find(m.payload,'text/html');if(!html){const t=find(m.payload,'text/plain')||m.snippet||'';html='<div style="white-space:pre-wrap;font-family:sans-serif">'+esc(t)+'</div>';}
  // No scripts, no forms; links open outside the app.
  html=html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<form[\s\S]*?<\/form>/gi,'');
  const page='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{overflow-x:hidden}body{margin:0;padding:8px;background:#fff;color:#111;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%!important}</style></head><body>'+html+'</body></html>';
  return Response.json({subject:h('subject'),from:h('from').replace(/<[^>]*>/,'').replace(/"/g,'').trim(),date:Number(m.internalDate)||0,html:page,threadId:m.threadId||'',files:files(m.payload),text:(find(m.payload,'text/plain')||m.snippet||'').replace(/\s+/g,' ').trim().length},{headers:H});
 }catch{return Response.json({error:'fail'},{status:500,headers:H});}}
