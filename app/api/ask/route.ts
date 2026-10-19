import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {gemini} from '@/lib/gemini';
export const runtime='nodejs';export const maxDuration=40;
// "שאל את Unbox": free questions about the user's own parcels, answered by Gemini from the list the app sends (nothing is stored).
const H={'Cache-Control':'no-store'};
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const b=await req.json().catch(()=>({}));const q=String(b.q||'').slice(0,400).trim();if(!q)return Response.json({error:'empty'},{status:400,headers:H});
 const data=String(b.data||'').slice(0,24000);const hist=(Array.isArray(b.history)?b.history:[]).slice(-10) as {role?:string;text?:string}[];
 const today=new Date().toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem',weekday:'long',day:'numeric',month:'numeric',year:'numeric'});
 const sys=`אתה העוזר של Unbox, אפליקציית מעקב חבילות. היום ${today}. ענה בעברית, קצר וברור (עד 4 משפטים), בלי טבלאות ובלי כוכביות, כי התשובה מוקראת בקול ב־VoiceOver.
עובדות על חבילות (תאריכים, קודים, סטטוסים, אירועים) - רק מהרשימה שלמטה. אם משהו לא שם, אמור שאין לך מידע על זה, ואל תמציא.
מותר להסביר באופן כללי איך משלוחים עובדים (מכס, דואר ישראל, Cainiao, נקודות איסוף), ולהסיק מסקנות מהאירועים שברשימה - למשל כמה זמן עבר בין שלב לשלב.
איך Unbox מחשב:
- "צפי" הוא תאריך שהחנות או השליח נתנו. המקור כתוב ליד: עמוד ההזמנה בחנות, אתר השליח, או המייל של החנות.
- "הערכה" היא חישוב של Unbox: לוקחים את החבילות הקודמות של המשתמש באותו מסלול (או מאותה חנות), מודדים כמה ימים עברו מאותו שלב (משלוח, יציאה מארץ המוצא, הגעה לישראל) ועד שהחבילה מוכנה לאיסוף או נמסרה, ונותנים את הטווח של רוב החבילות. ליד כל הערכה כתוב על כמה חבילות היא מבוססת ומה הממוצע.
- "מאחרת" אומר שעבר יותר זמן ממה שלקח לכמעט כל החבילות הקודמות.
- ימים לאיסוף נספרים מהיום שהחבילה הגיעה לנקודה, לפי מה שהנקודה או הדואר כתבו.
סכומים בשקלים.
רשימת החבילות (שורה לכל חבילה):
${data}`;
 const contents=[...hist.filter(h=>h.text).map(h=>({role:h.role==='model'?'model':'user',parts:[{text:String(h.text).slice(0,800)}]})),{role:'user',parts:[{text:q}]}];
 const g=await gemini({contents,systemInstruction:{parts:[{text:sys}]},generationConfig:{temperature:0.2,maxOutputTokens:600}},30000);
 if(!g.ok)return Response.json({error:g.status===429?'busy':'fail'},{status:200,headers:H});
 return Response.json({answer:g.text.replace(/\*\*/g,'').trim()},{headers:H});}
