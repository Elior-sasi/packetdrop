import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
export const runtime='nodejs';
// Signed-in check that the Gemini key works (opened in the browser); never shows the key.
export async function GET(req:NextRequest){const H={'Cache-Control':'no-store'};
 try{await identity(req,false);}catch{return Response.json({ok:false,why:'לא מחובר'},{status:401,headers:H});}
 const k=process.env.GEMINI_API_KEY;if(!k)return Response.json({ok:false,why:'אין מפתח Gemini בשרת'},{headers:H});
 try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','x-goog-api-key':k},body:JSON.stringify({contents:[{parts:[{text:'כתוב רק את המילה: עובד'}]}],generationConfig:{maxOutputTokens:10,thinkingConfig:{thinkingBudget:0}}})});
  const j=await r.json().catch(()=>({}));const text=String(j?.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
  return Response.json({ok:r.ok&&!!text,status:r.status,answer:text||null,error:r.ok?null:String(j?.error?.message||'').slice(0,200)},{headers:H});}
 catch(e){return Response.json({ok:false,why:'לא הצלחתי להגיע ל־Gemini',error:String(e).slice(0,120)},{headers:H});}}
