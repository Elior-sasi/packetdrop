import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {cainiao} from '@/lib/track';
import {gemini} from '@/lib/gemini';
export const runtime='nodejs';
// Signed-in check that the Gemini key works (opened in the browser); never shows the key.
export async function GET(req:NextRequest){const H={'Cache-Control':'no-store'};
 try{await identity(req,false);}catch{return Response.json({ok:false,why:'לא מחובר'},{status:401,headers:H});}
 // ?track=NUMBER: what Cainiao (AliExpress's carrier system) says about it, including its delivery window.
 const n=(req.nextUrl.searchParams.get('track')||'').trim().toUpperCase();
 if(n){const c=await cainiao([n]).catch(()=>null);const t=c?.tracks[n];return Response.json({cainiao:c?.status||'error',found:!!t,eta:t?.eta||null,last:t?.events.at(-1)?.text||null},{headers:H});}
 // ?vision=1: the costume photo test (photo + store title), step by step.
 if(req.nextUrl.searchParams.get('vision')){const u='https://ae-pic-a1.aliexpress-media.com/kf/S09b8d11643714bde9ed1fea85895a021q.jpg';
  const img=await fetch(u,{signal:AbortSignal.timeout(8000)}).catch(e=>({ok:false,status:0,err:String(e)}) as never as Response);if(!img.ok)return Response.json({step:'image',status:img.status},{headers:H});
  const buf=Buffer.from(await img.arrayBuffer());const v=await gemini({contents:[{parts:[{inline_data:{mime_type:img.headers.get('content-type')?.split(';')[0]||'image/jpeg',data:buf.toString('base64')}},{text:'זו תמונה של מוצר. כותרת החנות: "תחפושת איש כריש לווייתן, גיבור ים". קבע מה המוצר וזהה את הדמות והסדרה אם אתה בטוח. כתוב שם קצר בעברית, 2 עד 6 מילים.'}]}],generationConfig:{temperature:0.2,maxOutputTokens:1024}},20000);
  return Response.json({step:'gemini',bytes:buf.length,type:img.headers.get('content-type'),ok:v.ok,status:v.status,answer:v.text,tried:v.tried},{headers:H});}
 const g=await gemini({contents:[{parts:[{text:'כתוב רק את המילה: עובד'}]}],generationConfig:{maxOutputTokens:512}},20000);
 return Response.json({ok:g.ok,status:g.status,answer:g.text||null,error:g.error||null},{headers:H});}
