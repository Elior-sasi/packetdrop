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
 const g=await gemini({contents:[{parts:[{text:'כתוב רק את המילה: עובד'}]}],generationConfig:{maxOutputTokens:512}},20000);
 return Response.json({ok:g.ok,status:g.status,answer:g.text||null,error:g.error||null},{headers:H});}
