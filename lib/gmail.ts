// Gmail access shared by the scan route and the notification check.
// Subjects plus common shop/carrier senders and body phrases, so orders whose subject lacks a keyword are not missed.
// Refund notices from AliExpress sometimes land in Promotions, so they are let through on their own.
export const QUERY='-in:spam -in:trash -from:wolt.com {(from:aliexpress.com subject:(החזר OR זיכוי OR refund)) (-category:promotions -subject:פרסומת {'+[
 'subject:order','subject:shipped','subject:shipment','subject:delivery','subject:delivered','subject:tracking','subject:package','subject:parcel','subject:dispatched',
 'subject:הזמנה','subject:הזמנתך','subject:משלוח','subject:חבילה','subject:איסוף','subject:נשלח','subject:נמסר',
 'from:aliexpress.com','from:amazon.com','from:temu.com','from:shein.com','from:ebay.com','from:iherb.com','from:israelpost.co.il','from:postil.co.il','from:ups.com','from:dhl.com','from:fedex.com','from:cainiao.com','from:hfd.co.il','from:chita-il.com','from:tapuzdelivery.co.il','from:ksp.co.il','from:urbanica-wh.com','from:payngo.co.il','from:ivory.co.il','from:bug.co.il','from:terminalx.com','from:next.co.il','from:shufersal.co.il','from:super-pharm.co.il','from:castro.com','from:foxhome.co.il',
 '"tracking number"','"out for delivery"','"מספר מעקב"','"מוכנה לאיסוף"','"ממתין לאיסוף"','"יצאה למשלוח"','"בדרך אליך"','"נקודת איסוף"','subject:מכס','subject:מסים','subject:זיכוי','subject:refund','subject:בוטלה','"הזמנתך זוכתה"','"הנה המספר שלה"','"תשלום מסים"','"customs duty"'
].join(' ')+'})}';
export class GmailError extends Error{}
export function gmailClient(accessToken:string){
 return async function gmail(path:string,attempt=0):Promise<any>{const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(18000)});
  // Gmail sometimes answers 200 with an empty body: try again, and never let it stop the whole check.
  if(r.ok){const t=await r.text().catch(()=>'');if(t.trim()){try{return JSON.parse(t);}catch{}}
   if(attempt<2){await new Promise(res=>setTimeout(res,600*(attempt+1)));return gmail(path,attempt+1);}
   if(/^messages\?/.test(path))return {};throw new GmailError('EMPTY '+path.split('?')[0].replace(/[A-Za-z0-9]{12,}/g,'…'));}
  const detail=await r.text().catch(()=>'');
  if(r.status===403&&/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(detail))throw new GmailError('GMAIL_API_DISABLED');
  if(r.status===403&&/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(detail))throw new GmailError('NO_GMAIL');
  if(r.status===401)throw new GmailError('RECONNECT');
  if((r.status===429||(r.status===403&&/rateLimitExceeded|userRateLimitExceeded/i.test(detail)))&&attempt<4){await new Promise(res=>setTimeout(res,500*2**attempt+Math.random()*300));return gmail(path,attempt+1);}
  if(r.status===429)throw new GmailError('RATE');
  throw new GmailError('GMAIL');};}
// Invoices / order copies attached as PDF (מחסני חשמל and other Israeli stores): read the order number and products.
type Part={filename?:string;mimeType?:string;body?:{attachmentId?:string;size?:number};parts?:Part[];headers?:{name:string;value:string}[]};
export async function pdfInfo(gmail:(p:string)=>Promise<any>,m:{id:string;payload?:Part}){
 const subject=m.payload?.headers?.find(h=>/^subject$/i.test(h.name))?.value||'';if(!/חשבונית|הזמנ|invoice|order|קבלה/i.test(subject))return undefined;
 const pdfs:Part[]=[];const walk=(p?:Part)=>{if(!p)return;if(/\.pdf$/i.test(p.filename||'')&&p.body?.attachmentId&&(p.body.size||0)<2_000_000)pdfs.push(p);p.parts?.forEach(walk);};walk(m.payload);
 if(!pdfs.length)return undefined;
 try{const {pdfText,pdfOrder}=await import('@/lib/pdf');const a=await gmail('messages/'+encodeURIComponent(m.id)+'/attachments/'+encodeURIComponent(pdfs[0].body!.attachmentId!));
  const bytes=Uint8Array.from(Buffer.from(String(a.data||''),'base64url'));const info=pdfOrder(await pdfText(bytes));return info.order||info.items.length?info:undefined;}catch{return undefined;}}
