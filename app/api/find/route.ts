import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {gemini} from '@/lib/gemini';
export const runtime='nodejs';export const maxDuration=30;
// Search by meaning: when no parcel name contains the words ("אנימה", "משהו למטבח"), Gemini picks the parcels that fit.
// Only the names the app sends are used; nothing is stored.
const H={'Cache-Control':'no-store'};
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({ids:[]},{status:403,headers:H});
 try{await identity(req,false);}catch{return Response.json({ids:[]},{status:401,headers:H});}
 const b=await req.json().catch(()=>({}));const q=String(b.q||'').slice(0,100).trim();
 const items=(Array.isArray(b.items)?b.items:[]).slice(0,200).map((x:{id?:unknown;name?:unknown})=>({id:String(x.id||'').slice(0,80),name:String(x.name||'').slice(0,120)})).filter((x:{id:string;name:string})=>x.id&&x.name);
 if(!q||!items.length)return Response.json({ids:[]},{headers:H});
 const list=items.map((x:{name:string},i:number)=>i+': '+x.name).join('\n');
 const prompt=`חיפוש: "${q}"\nאלה מוצרים שהזמנתי (מספר: שם):\n${list}\n\nאילו מהמוצרים מתאימים לחיפוש לפי המשמעות? למשל "אנימה" מתאים למוצר של One Piece או נארוטו, "מטבח" מתאים למשפך או לסכין. בחר רק מוצרים שבאמת מתאימים. החזר JSON בלבד: {"n":[מספרים]}`;
 const g=await gemini({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0,maxOutputTokens:200,responseMimeType:'application/json'}},20000);
 if(!g.ok)return Response.json({ids:[],error:g.status===429?'busy':'fail'},{headers:H});
 let n:number[]=[];try{n=(JSON.parse(g.text.replace(/^```json|```$/g,'')).n||[]).map(Number);}catch{}
 return Response.json({ids:[...new Set(n.filter(i=>Number.isInteger(i)&&items[i]).map(i=>items[i].id))].slice(0,30)},{headers:H});}
