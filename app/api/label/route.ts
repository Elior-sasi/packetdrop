import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {gemini} from '@/lib/gemini';
export const runtime='nodejs';export const maxDuration=40;
// "צלם חבילה": a photo of a shipping label (or a screenshot) -> what it says, read by Gemini. The photo is not stored.
const H={'Cache-Control':'no-store'};
const PROMPT=`זו תמונה של מדבקת משלוח, קופסה, מעטפה או צילום מסך של משלוח. קרא את מה שכתוב והחזר JSON בלבד, בלי טקסט נוסף, בשדות:
{"tracking":"מספר המעקב הראשי בדיוק כפי שכתוב, בלי רווחים (למשל RS123456789Y, LP..., AP..., UH...). ריק אם אין",
"order":"מספר הזמנה אם מופיע, אחרת ריק","carrier":"חברת המשלוח (דואר ישראל, HFD, צ'יטה, Cainiao, YunExpress...) אחרת ריק",
"shop":"החנות או השולח אם ברור (AliExpress, Amazon, Temu, SHEIN...) אחרת ריק","name":"מה המוצר אם כתוב או נראה, בעברית, קצר. אחרת ריק",
"recipient":"שם הנמען אם כתוב","summary":"משפט אחד או שניים בעברית שמתארים מה כתוב על המדבקה, להקראה בקול"}
אל תמציא מספרים. אם ספרה לא ברורה, השאר את השדה ריק.`;
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const b=await req.json().catch(()=>({}));const img=String(b.image||'');const m=img.match(/^data:(image\/(?:jpeg|png|webp|heic));base64,([A-Za-z0-9+/=]+)$/);
 if(!m||m[2].length>6_000_000)return Response.json({error:'image'},{status:400,headers:H});
 const g=await gemini({contents:[{parts:[{inline_data:{mime_type:m[1],data:m[2]}},{text:PROMPT}]}],generationConfig:{temperature:0,maxOutputTokens:800,responseMimeType:'application/json'}},30000,['gemini-flash-latest','gemini-3.8-flash']);
 if(!g.ok)return Response.json({error:g.status===429?'busy':'fail'},{headers:H});
 let j:Record<string,string>={};try{j=JSON.parse(g.text.replace(/^```(?:json)?|```$/g,'').trim());}catch{return Response.json({error:'fail'},{headers:H});}
 const s=(k:string)=>String(j[k]||'').trim().slice(0,200);const tracking=s('tracking').toUpperCase().replace(/[^A-Z0-9-]/g,'');
 return Response.json({tracking:/^[A-Z0-9-]{8,40}$/.test(tracking)?tracking:'',order:s('order').replace(/[^\w-]/g,''),carrier:s('carrier'),shop:s('shop'),name:s('name'),recipient:s('recipient'),summary:s('summary')},{headers:H});}
