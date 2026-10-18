// Gmail access shared by the scan route and the notification check.
// Subjects plus common shop/carrier senders and body phrases, so orders whose subject lacks a keyword are not missed.
export const QUERY='-in:spam -in:trash -category:promotions -subject:פרסומת -from:wolt.com {'+[
 'subject:order','subject:shipped','subject:shipment','subject:delivery','subject:delivered','subject:tracking','subject:package','subject:parcel','subject:dispatched',
 'subject:הזמנה','subject:הזמנתך','subject:משלוח','subject:חבילה','subject:איסוף','subject:נשלח','subject:נמסר',
 'from:aliexpress.com','from:amazon.com','from:temu.com','from:shein.com','from:ebay.com','from:iherb.com','from:israelpost.co.il','from:postil.co.il','from:ups.com','from:dhl.com','from:fedex.com','from:cainiao.com','from:hfd.co.il','from:chita-il.com','from:tapuzdelivery.co.il','from:ksp.co.il','from:urbanica-wh.com','from:payngo.co.il','from:ivory.co.il','from:bug.co.il','from:terminalx.com','from:next.co.il','from:shufersal.co.il','from:castro.com','from:foxhome.co.il',
 '"tracking number"','"out for delivery"','"מספר מעקב"','"מוכנה לאיסוף"','"ממתין לאיסוף"','"יצאה למשלוח"','"בדרך אליך"','"נקודת איסוף"','subject:מכס','subject:מסים','subject:זיכוי','subject:refund','subject:בוטלה','"הזמנתך זוכתה"','"הנה המספר שלה"','"תשלום מסים"','"customs duty"'
].join(' ')+'}';
export class GmailError extends Error{}
export function gmailClient(accessToken:string){
 return async function gmail(path:string,attempt=0):Promise<any>{const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(18000)});
  if(r.ok)return r.json();
  const detail=await r.text().catch(()=>'');
  if(r.status===403&&/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(detail))throw new GmailError('GMAIL_API_DISABLED');
  if(r.status===403&&/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(detail))throw new GmailError('NO_GMAIL');
  if(r.status===401)throw new GmailError('RECONNECT');
  if((r.status===429||(r.status===403&&/rateLimitExceeded|userRateLimitExceeded/i.test(detail)))&&attempt<4){await new Promise(res=>setTimeout(res,500*2**attempt+Math.random()*300));return gmail(path,attempt+1);}
  if(r.status===429)throw new GmailError('RATE');
  throw new GmailError('GMAIL');};}
