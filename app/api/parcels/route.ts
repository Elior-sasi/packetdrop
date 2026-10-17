import {NextRequest} from 'next/server';
import {z} from 'zod';
import {identity} from '@/lib/identity';
import {parseMessage,mergeParcels,type Message} from '@/lib/parcels';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Subjects plus common shop/carrier senders and body phrases, so orders whose subject lacks a keyword are not missed.
const QUERY='-in:spam -in:trash -category:promotions -subject:פרסומת -from:wolt.com {'+[
 'subject:order','subject:shipped','subject:shipment','subject:delivery','subject:delivered','subject:tracking','subject:package','subject:parcel','subject:dispatched',
 'subject:הזמנה','subject:הזמנתך','subject:משלוח','subject:חבילה','subject:איסוף','subject:נשלח','subject:נמסר',
 'from:aliexpress.com','from:amazon.com','from:temu.com','from:shein.com','from:ebay.com','from:iherb.com','from:israelpost.co.il','from:ups.com','from:dhl.com','from:fedex.com','from:cainiao.com','from:hfd.co.il','from:chita-il.com','from:tapuzdelivery.co.il','from:ksp.co.il','from:urbanica-wh.com',
 '"tracking number"','"out for delivery"','"מספר מעקב"','"מוכנה לאיסוף"','"ממתין לאיסוף"','"יצאה למשלוח"','"בדרך אליך"','"נקודת איסוף"'
].join(' ')+'}';
class GmailError extends Error{}
async function client(req:NextRequest){const {accessToken}=await identity(req);
 return async function gmail(path:string,attempt=0):Promise<any>{const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(18000)});
  if(r.ok)return r.json();
  const detail=await r.text().catch(()=>'');
  if(r.status===403&&/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(detail))throw new GmailError('GMAIL_API_DISABLED');
  if(r.status===403&&/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(detail))throw new GmailError('NO_GMAIL');
  if(r.status===401)throw new GmailError('RECONNECT');
  if((r.status===429||(r.status===403&&/rateLimitExceeded|userRateLimitExceeded/i.test(detail)))&&attempt<4){await new Promise(res=>setTimeout(res,500*2**attempt+Math.random()*300));return gmail(path,attempt+1);}
  if(r.status===429)throw new GmailError('RATE');
  throw new GmailError('GMAIL');};}
// Step 1 (fast): just the message IDs for the whole window. The browser then skips mail it already read.
export async function GET(req:NextRequest){try{
 const gmail=await client(req);const since=req.nextUrl.searchParams.get('since');const window=since&&/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(since)?'after:'+since:'newer_than:180d';
 const ids:string[]=[];let token='';
 for(let page=0;page<10;page++){const params=new URLSearchParams({maxResults:'500',q:window+' '+QUERY,fields:'messages/id,nextPageToken'});if(token)params.set('pageToken',token);const list=await gmail('messages?'+params);for(const m of list.messages||[])ids.push(m.id);token=list.nextPageToken||'';if(!token)break;}
 return Response.json({ids,updated:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e);}}
const body=z.object({ids:z.array(z.string().regex(/^[a-zA-Z0-9]{6,40}$/)).min(1).max(40)});
// Step 2: read a batch of messages in full and extract parcels. The browser runs a few of these in parallel.
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 try{const gmail=await client(req);const {ids}=body.parse(await req.json());const messages:Message[]=[];const failed:string[]=[];
  for(let i=0;i<ids.length;i+=10){const chunk=ids.slice(i,i+10);const got=await Promise.allSettled(chunk.map(id=>gmail('messages/'+encodeURIComponent(id)+'?format=full')));got.forEach((g,j)=>{if(g.status==='fulfilled')messages.push(g.value);else{if(g.reason instanceof GmailError&&!['GMAIL','RATE'].includes(g.reason.message))throw g.reason;failed.push(chunk[j]);}});}
  const parcels=mergeParcels(messages.map(parseMessage).filter((p):p is NonNullable<typeof p>=>!!p));
  return Response.json({parcels,read:messages.map(m=>m.id),failed},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e);}}
function fail(e:unknown){try{throw e;}catch(e){const code=e instanceof Error?e.message:'';

  const messages:Record<string,string>={
   UNAUTHORIZED:'יש להיכנס עם Google',
   NO_GMAIL:'נכנסת עם Google, אבל לא אישרת קריאת Gmail. לחץ "חידוש הרשאת Google" וסמן את תיבת Gmail.',
   RECONNECT:'ההרשאה ל־Gmail פגה. לחץ "חידוש הרשאת Google".',
   GMAIL_API_DISABLED:'Gmail API כבויה בפרויקט Google Cloud. יש להפעיל אותה ולנסות שוב.',
   RATE:'Google הגבילה זמנית את הסריקה. נסה שוב בעוד דקה.'};
  const status=code==='UNAUTHORIZED'?401:code==='NO_GMAIL'||code==='RECONNECT'||code==='GMAIL_API_DISABLED'?403:code==='RATE'?429:502;
  return Response.json({error:messages[code]||'הסריקה לא הושלמה. נסה שוב.',code},{status,headers:{'Cache-Control':'no-store'}});}}
