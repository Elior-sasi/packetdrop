import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {parseMessage,mergeParcels,type Message} from '@/lib/parcels';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Subjects plus common shop/carrier senders and body phrases, so orders whose subject lacks a keyword are not missed.
const QUERY='newer_than:180d -in:spam -in:trash {'+[
 'subject:order','subject:shipped','subject:shipment','subject:delivery','subject:delivered','subject:tracking','subject:package','subject:parcel','subject:dispatched',
 'subject:הזמנה','subject:הזמנתך','subject:משלוח','subject:חבילה','subject:איסוף','subject:נשלח','subject:נמסר',
 'from:aliexpress.com','from:amazon.com','from:temu.com','from:shein.com','from:ebay.com','from:iherb.com','from:israelpost.co.il','from:ups.com','from:dhl.com','from:fedex.com','from:cainiao.com','from:hfd.co.il',
 '"tracking number"','"out for delivery"','"מספר מעקב"','"מוכנה לאיסוף"'
].join(' ')+'}';
class GmailError extends Error{}
export async function GET(req:NextRequest){try{
 const {accessToken}=await identity(req);const cursor=req.nextUrl.searchParams.get('cursor');if(cursor&&cursor.length>2048)return Response.json({error:'סמן סריקה לא תקין'},{status:400});
 const params=new URLSearchParams({maxResults:'40',q:QUERY});if(cursor)params.set('pageToken',cursor);
 async function gmail(path:string){const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(18000)});
  if(r.ok)return r.json();
  const detail=await r.text().catch(()=>'');
  if(r.status===403&&/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(detail))throw new GmailError('GMAIL_API_DISABLED');
  if(r.status===403&&/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(detail))throw new GmailError('NO_GMAIL');
  if(r.status===401)throw new GmailError('RECONNECT');
  if(r.status===429)throw new GmailError('RATE');
  throw new GmailError('GMAIL');}
 const list=await gmail('messages?'+params);const ids:{id:string}[]=list.messages||[];const messages:Message[]=[];let failed=0;
 // Bounded concurrency; one broken message does not fail the whole scan.
 for(let i=0;i<ids.length;i+=8){const got=await Promise.allSettled(ids.slice(i,i+8).map(m=>gmail('messages/'+encodeURIComponent(m.id)+'?format=full')));for(const g of got){if(g.status==='fulfilled')messages.push(g.value);else{if(g.reason instanceof GmailError&&g.reason.message!=='GMAIL')throw g.reason;failed++;}}}
 const parcels=mergeParcels(messages.map(parseMessage).filter((p):p is NonNullable<typeof p>=>!!p));
 return Response.json({parcels,nextCursor:list.nextPageToken,scanned:messages.length,failed,updated:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const code=e instanceof Error?e.message:'';
  const messages:Record<string,string>={
   UNAUTHORIZED:'יש להיכנס עם Google',
   NO_GMAIL:'נכנסת עם Google, אבל לא אישרת קריאת Gmail. לחץ "חידוש הרשאת Google" וסמן את תיבת Gmail.',
   RECONNECT:'ההרשאה ל־Gmail פגה. לחץ "חידוש הרשאת Google".',
   GMAIL_API_DISABLED:'Gmail API כבויה בפרויקט Google Cloud. יש להפעיל אותה ולנסות שוב.',
   RATE:'Google הגבילה זמנית את הסריקה. נסה שוב בעוד דקה.'};
  const status=code==='UNAUTHORIZED'?401:code==='NO_GMAIL'||code==='RECONNECT'||code==='GMAIL_API_DISABLED'?403:code==='RATE'?429:502;
  return Response.json({error:messages[code]||'הסריקה לא הושלמה. נסה שוב.',code},{status,headers:{'Cache-Control':'no-store'}});}}
