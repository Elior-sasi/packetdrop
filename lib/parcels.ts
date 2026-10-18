import {baldarHost} from '@/lib/tapuz';
import * as cheerio from 'cheerio';
import {heName} from '@/lib/hename';
export type Event={id:string;label:string;time:string};
export type Pickup={place:string;address:string;code:string;url:string;hours?:string};
export type Parcel={id:string;keys:string[];name:string;shop:string;carrier:string;image:string;url:string;tracking:string;order:string;eta:string;stage:number;cancelled:boolean;pickup:Pickup|null;events:Event[];price?:string;qty?:number;via?:string[];images?:string[];items?:string[];customs?:{amount:string;url:string;at:string}};
export type Message={id:string;threadId?:string;internalDate?:string;snippet?:string;labelIds?:string[];payload?:Part};
type Part={mimeType?:string;body?:{data?:string};parts?:Part[];headers?:{name:string;value:string}[]};
export const stages=['ההזמנה התקבלה','נשלחה','בדרך ליעד','במסירה / איסוף','נמסרה'];

const shops:[RegExp,string][]=[[/aliexpress|עלי ?אקספרס/i,'AliExpress'],[/amazon\.|(?:משלוח מ-?|שנשלח מ)\s?amazon/i,'Amazon'],[/temu/i,'Temu'],[/shein/i,'SHEIN'],[/ebay/i,'eBay'],[/iherb/i,'iHerb'],[/asos/i,'ASOS'],[/zara\./i,'Zara'],[/next\.(?:co\.il|com)/i,'NEXT'],[/ksp\.co\.il/i,'KSP'],[/ivory\.co\.il/i,'Ivory'],[/shufersal/i,'שופרסל'],[/terminalx/i,'Terminal X'],[/urbanica|אורבניקה/i,'Urbanica'],[/apple\.com/i,'Apple'],[/payngo|pay ?& ?go|פיי אנד גו|מחסני חשמל/i,'מחסני חשמל'],[/bug\.co\.il/i,'BUG'],[/castro\.com/i,'Castro'],[/foxhome|פוקס הום/i,'Fox Home']];
const carriers:[RegExp,string][]=[[/israelpost|postil\.co\.il|דואר ישראל/i,'דואר ישראל'],[/\bups\b|ups\.com/i,'UPS'],[/\bdhl\b/i,'DHL'],[/fedex/i,'FedEx'],[/cainiao/i,'Cainiao'],[/yunexpress/i,'YunExpress'],[/\b4px\b/i,'4PX'],[/\bhfd\b|אחד עד אחד|epost/i,'HFD'],[/k[ .]?express|קיי ?אקספרס/i,'K Express'],[/cheetah|chita-il|צ['׳]יטה/i,"צ'יטה"],[/tapuz|תפוז שליחויות|תפוז משלוחים/i,'תפוז'],[/flying ?cargo|פליינג קרגו/i,'Flying Cargo'],[/getpackage|גט ?פאקג/i,'GetPackage'],[/boxit|בוקסיט/i,'Boxit'],[/yango/i,'Yango']];
export const brandDomains:Record<string,string>={'מחסני חשמל':'payngo.co.il',BUG:'bug.co.il',Castro:'castro.com','Fox Home':'foxhome.co.il',AliExpress:'aliexpress.com',Amazon:'amazon.com',Temu:'temu.com',SHEIN:'shein.com',eBay:'ebay.com',iHerb:'iherb.com',ASOS:'asos.com',Zara:'zara.com',NEXT:'next.co.il',KSP:'ksp.co.il',Ivory:'ivory.co.il','שופרסל':'shufersal.co.il','Terminal X':'terminalx.com',Urbanica:'urbanica-wh.com','תפוז':'tapuzdelivery.co.il','Flying Cargo':'flyingcargo.co.il',GetPackage:'getpackage.com',Apple:'apple.com','דואר ישראל':'israelpost.co.il',UPS:'ups.com',DHL:'dhl.com',FedEx:'fedex.com',Cainiao:'cainiao.com',YunExpress:'yunexpress.com','4PX':'4px.com',HFD:'hfd.co.il',"צ'יטה":'chita-il.com',Boxit:'boxit.co.il',Yango:'yango.com',Wolt:'wolt.com'};

// Store platforms send mail for many shops; the shop itself is the sender's display name ("Shop Name <x@konimbo.co.il>").
const PLATFORM=/shopify|konimbo|wix|myshopify|bigcommerce|woocommerce|cashcow|pay\.?plus|icount|greeninvoice|sendgrid|mailchimp|klaviyo|omnisend|mailgun|amazonses|sparkpost|activetrail|smoove|inwise/i;
function senderName(from:string){const m=from.match(/^\s*"?([^"<]+?)"?\s*</);if(!m)return '';const n=m[1].replace(/\s*(?:via|דרך)\s+.*$/i,'').replace(/\s*[|·–-]\s*(?:orders?|הזמנות|shop|store|חנות).*$/i,'').trim();
 return n.length>=2&&n.length<=40&&!/^(?:no-?reply|noreply|orders?|info|support|shop|store|notifications?|הזמנות|שירות לקוחות|customer service)$/i.test(n)&&!/@/.test(n)?n:'';}
function shopFrom(from:string,text:string){for(const [r,n] of shops)if(r.test(from))return n;const dom=from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase()||'';
 if(dom&&!/israelpost|postil|ups\.|dhl|fedex|cainiao|hfd|cheetah|chita-il|tapuz/.test(dom)){const name=senderName(from);if(name&&(PLATFORM.test(dom)||!/\./.test(name)))return name;if(PLATFORM.test(dom)){for(const [r,n] of shops)if(r.test(text.slice(0,4000)))return n;}return dom.replace(/^(mail|email|e|info|noreply|news|orders?|shipping|notice|transaction|t)\./,'');}
 for(const [r,n] of shops)if(r.test(text.slice(0,4000)))return n;return /israelpost|postil/i.test(from)?'דואר ישראל':'הזמנה מהדוא״ל';}
// A store mail that lists several couriers ("track at Tapuz or K Express") names none of them for sure.
function carrierFrom(t:string,shop:string){const hit=carriers.filter(([r,n])=>r.test(t)&&n!==shop).map(([,n])=>n);return hit.length===1?hit[0]:'';}
export function secureUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}
function body(p?:Part):string{if(!p)return '';const here=p.body?.data?Buffer.from(p.body.data,'base64url').toString('utf8'):'';return [here,...(p.parts||[]).map(body)].join('\n');}

// Marketing mail: Israeli law requires the "פרסומת" prefix; promo senders and Gmail's Promotions tab are the other tells.
export function isAd(subject:string,from:string,labels:string[]=[]){return /(?:^|[\s(|])פרסומת(?:[\s)|]|$)/.test(subject)||/^\s*(?:advertisement|ad\s*[:|])/i.test(subject)||/promotion@|promo@|marketing@|newsletter|ae-brief|deals@/i.test(from)||labels.includes('CATEGORY_PROMOTIONS');}

const NOT_PARCEL=/eventbuzz|smarticket|go-out|goout|tickchak|cinema|yesplanet|רב[- ]?חן|lev\.co\.il|eventim|leaan|לאן כרטיסים|tixwise|kartisim|כרטיס(?:ים)? (?:לסרט|להופעה|להצגה|לאירוע)|הקרנה|אולם \d|מושב|wolt\.com|10bis|tenbis|cibus|uber|gett|yango ?ride|booking\.com|airbnb|elal|אל על|טיסה|flight|מלון|hotel|netflix|spotify|disney|youtube premium|google play|app store|חשבון חודשי|תשלום חשבון/i;
// Physical shipping words; unknown senders must mention one of these to count as a parcel.
const SHIPPING=/משלוח|שליח|חבילה|איסוף|נשלח|נארז|נקודת (?:ה)?חלוקה|כתובת למשלוח|shipping|shipped|shipment|delivery|tracking|מעקב|parcel|package/i;
const STAGE_RULES:[number,RegExp][]=[
 [4,/^delivered\s*:|איך הלך|לכתוב ביקורת|חוויתכם חשובה|שלחו את דעתכם|דרגו את החוויה|write a review|leave a review|how was your order|נמסרה|נמסר לנמען|נמסר בהצלחה|has been delivered|was delivered|delivered successfully|successfully delivered|delivery complete/i],
 [3,/^out for delivery\s*:|מוכנה לאיסוף|ממתינה לאיסוף|ממתין לאיסוף|ממתי[ןנ]? לאיסופך|ממתין ב(?!מכס|שחרור|תור)[\u0590-\u05FF]|ממתינה ב(?!מכס|שחרור|תור)[\u0590-\u05FF]|טרם נאסף|בדרכו לכתובת|בדרכה לכתובת|השליח יצור קשר|יצאה למסירה|יצא למסירה|יצא לחלוקה|השליח בדרך|בדרך למסירה|out for delivery|ready for (?:pickup|collection)/i],
 [2,/שוחרר(?:ה)? (?:בהצלחה )?מהמכס|עם חברת המשלוחים המקומית|על ידי חברת המשלוחים המקומית|למרכז המסירה|נקלט במחסני|נקלטה במחסני|במכס|השחרור מהמכס|במדינה|באזור שלכם|בתעבורה|הגיעה לארץ|הגיע לארץ|בדרכה לישראל|בדרכו לישראל|בדרכ[ןוה] לארץ|בדרך לארץ|במרכז המיון|in transit|customs|arrived at/i],
 [1,/^shipped\s*:|נשלחה(?! לאימות)|נשלח(?! SMS| לאימות| קוד| אליך קוד)|נאספה|נארזה|יצאה למשלוח|בדרך אליך|יצאה מאזור המוצא|עדכון ממדינת המוצא|יצא לדרך|יוצ[אר] לדרך|has shipped|order shipped|dispatched|shipment sent|picked up by/i],
 [0,/^ordered\s*:|אושרה|מאושרת|התקבלה|תטופל בהקדם|order confirmed|order placed|thanks for your order|תודה על הזמנתך/i]];
const CANCEL=/is closed|בוטלה|בוטל|ביטול ה?הזמנה|הזמנה בוטלה|order cancel+ed|refund|החזר כספי|הודעה על זיכוי|הזמנתך זוכתה|has been refunded/i;
// "Packed and waiting for the courier to collect it" is the store's side, not a parcel waiting for the user.
function stageOf(s:string){if(/(?:ממתינה|ממתין)\s+לאיסוף\s+(?:על ידי|ע["״']י)\s+ה?שליח/.test(s))return 1;for(const [n,r] of STAGE_RULES)if(r.test(s))return n;return -1;}

// Final touch on any title: no dangling connector word, no lone fragment after the last comma.
export function polishName(n:string){let t=n.trim();
 for(let i=0;i<3;i++){const before=t;
  t=t.replace(/(?:\s+(?:בסגנון|בעל|בעלת|עם|של|עבור|מתאים|מתאימה|תואם|תואמת|עמיד|עמידה|לשימוש|חדש|חדשה|for|with|and|of|the|ל|ב|ו|מ|ה))+$/i,'').trim();
  const m=t.match(/^(.{8,}?)[,،]\s*([^,،\s]+)$/);if(m&&m[2].length<=10)t=m[1].trim();
  t=t.replace(/[\s,،\-–(]+$/,'');if(t===before)break;}
 return t.length>=4?t:n.trim();}
export function tidyName(raw:string){let n=raw.replace(/\s+x\d+$/i,'').trim();
 // AliExpress machine-translation fixes, on the full title before it is shortened.
 n=n.replace(/(\S) '(\S)/g,"$1'$2").replace(/וואן\s*1?\s*פיס/g,'One\u2060Piece').replace(/^\d{5,}\s+/,'').replace(/^פרוק(?=\s)/,'פאה').replace(/\s+(?:מותאם|מותאמת|בהתאמה)\s+אישית/g,'');
 // "Cosplay" titles: the costume is the product ("אנימה X קוספליי…" → "תחפושת X", "תחפושת קוספליי של X" → "תחפושת X").
 n=n.replace(/^(תחפושת|תחפושות|חליפת|חליפה)\s+קוספל\S*\s+(?:של\s+)?/,'$1 ');
 if(!/^(?:תחפושת|תחפושות|חליפת|חליפה|פאה)/.test(n)){const c=n.match(/^(?:אנימה\s+)?(.{3,45}?)\s+קוספל\S*/);if(c){const rest=n.slice(c[0].length);n='תחפושת '+c[1]+(/^\s*(?:\.\.\.|…)\s*$/.test(rest)?'':rest);}}
 n=n.replace(/^(פאה)\s+קוספל\S*/,'$1');
 if(/(\.\.\.|…)\s*$/.test(n)){n=n.replace(/(\.\.\.|…)\s*$/,'').trim();const cut=n.replace(/[\s,،\-–(]+\S+$/,'').replace(/[\s,،\-–(]+$/,'').trim();if((cut.length>=8||/^(?:פאה|תיק|סט|כבל)$/.test(cut))&&!/\u2060\S*$/.test(n))n=cut;n=n.replace(/(?:\s+(?:עם|של|עבור|את|for|with|and|of|the|ל|ב|ו|מ))+$/i,'').trim();}
 // Store titles are keyword lists; keep the part before the second comma so the card reads like a name.
 if(n.length>42){const parts=n.split(/\s*[,،|]\s*/);let out=parts[0];for(const p of parts.slice(1)){if((out+', '+p).length>42)break;out+=', '+p;}n=out.length>=12?out:n.slice(0,42).replace(/\s+\S*$/,'');}
 return polishName(n).replace(/\u2060/g,' ');}
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
// Keep only the date part of "arriving September 6 Elior - ..." and write it the Israeli way (6.9).
export function etaOf(raw:string){const t=raw.trim();
 const en=t.match(/^(?:[a-z]+day,?\s*)?([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:\s*[-–]\s*(?:([a-z]{3})[a-z]*\.?\s+)?(\d{1,2}))?/i);
 if(en&&MONTHS.includes(en[1].toLowerCase())){const m=MONTHS.indexOf(en[1].toLowerCase())+1;const m2=en[3]&&MONTHS.includes(en[3].toLowerCase())?MONTHS.indexOf(en[3].toLowerCase())+1:m;return en[4]?en[2]+'.'+m+'-'+en[4]+'.'+m2:en[2]+'.'+m;}
 const de=t.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*/i);if(de&&MONTHS.includes(de[2].toLowerCase()))return de[1]+'.'+(MONTHS.indexOf(de[2].toLowerCase())+1);
 const d=t.match(/^(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?(?:\s*[-–]\s*(\d{1,2})[./](\d{1,2}))?/);if(d)return (+d[1])+'.'+(+d[2])+(d[3]?'-'+(+d[3])+'.'+(+d[4]):'');
 const h=t.match(/^(\d{1,2})\s+(?:ב)?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);if(h)return h[1]+' ב'+h[2];
 return '';}
export type PdfInfo={order:string;ship:string[];items:string[]};
export function parseMessage(m:Message,pdf?:PdfInfo):Parcel|null{
 const h=m.payload?.headers||[];const header=(key:string)=>h.find(x=>x.name.toLowerCase()===key)?.value||'';
 const subject=header('subject'),from=header('from');
 if(isAd(subject,from,m.labelIds))return null;
 const html=body(m.payload);const $=cheerio.load(html);$('script,style').remove();
 const text=[subject,$.text(),m.snippet].join(' ').replace(/\s+/g,' ').slice(0,100000);
 const shop=shopFrom(from,text);const carrier=carrierFrom(from+' '+text,shop);
 const knownSender=shops.some(([r])=>r.test(from))||carriers.some(([r])=>r.test(from));
 // Replies and forwards are the user's own correspondence, not shipping updates.
 if(!knownSender&&/^\s*(?:re|fw|fwd|השב|הועבר)\s*:/i.test(subject))return null;
 // A refund/cancellation of an order is kept (it closes that order) even without shipping words.
 const closing=/הזמנתך זוכתה|הודעה על זיכוי|order (?:has been )?(?:cancel+ed|refunded)|ההזמנה בוטלה/i.test(subject+' '+text.slice(0,400));
 if(NOT_PARCEL.test(from+' '+subject)||(!knownSender&&!closing&&(NOT_PARCEL.test(text.slice(0,1500))||!SHIPPING.test(text))))return null;
 const hrefs=$('a').toArray().map(a=>$(a).attr('href')||'');
 // Israeli stores link to their courier's Baldar status page; remember which, so the order can be looked up there.
 const via=[...new Set(hrefs.map(baldarHost).filter(Boolean))];
 // Order IDs from text and from order links (AliExpress package mails only carry them as o_ids=...).
 const orders=new Set<string>();
 const orderText=(subject+' '+text).match(/(?:order(?:\s*(?:number|no\.?|id|#))?|מספר\s*הזמנה|הזמנ(?:ה|תכם|תך)(?:\s*(?:מס['׳]?|מספר))?)\s*[:#.]?\s*#?\s*(\d[\d-]{5,34})/i)?.[1];
 if(orderText)orders.add(orderText.replace(/-/g,''));
 // Israeli stores often write just "#302834565" or "המספר שלה: #…".
 if(!orders.size&&knownSender){const h=text.match(/(?:המספר שלה|מספר(?:\s+ה)?הזמנה)\s*:?\s*#?\s*(\d{6,12})/)?.[1]||text.match(/#\s?(\d{6,12})\b/)?.[1];if(h)orders.add(h);}
 for(const href of hrefs){const a=href.match(/[?&]orderId=(\d{8,})/i)?.[1];if(a)orders.add(a);const b=href.match(/[?&]o_ids=([\d,]+)/i)?.[1];if(b)b.split(',').filter(x=>x.length>=8).forEach(x=>orders.add(x));}
 // Summary mails about several packages at once would glue unrelated parcels together.
 if(orders.size>1&&/\d+\s*(?:ה?חבילות|packages|parcels)/i.test(subject))return null;
 const tracking=((subject+' '+text).match(/(?:tracking(?:\s+(?:number|no\.?|id|code))?|מספר\s*(?:ה?מעקב|ה?משלוח)|קוד\s*מעקב)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{7,34})/i)?.[1]
  ||(subject+' '+text).match(/(?:ל?חבילה|החבילה שלכם|החבילה שלך|משלוח|דבר דואר|פריט דואר|package|parcel|shipment)\s*(?:מס['׳]|מספר|שמספרה|שמספרו|no\.?|#)?\s*:?\s*([A-Z]{1,4}\d{6,}[A-Z0-9]*)/i)?.[1]
  ||(subject+' '+text).match(/\b([A-Z]{2}\d{9}[A-Z]{2}|[A-Z]{2}\d{10}[A-Z]|1Z[0-9A-Z]{16}|RS\d{9,12}Y|AP\d{12,16}|LP\d{10,16})\b/)?.[1]||'').replace(/[^a-z0-9-]/gi,'').toUpperCase();
 // Details from a PDF attachment (invoice / order copy) when the mail body has none.
 if(pdf?.order&&!orders.size)orders.add(pdf.order);
 const order=[...orders][0]||'';
 // Israeli last-mile mails (HFD/Epost) list several numbers for one parcel: AP…, Hfd…, and an 8-digit Epost id.
 const extra=new Set<string>();
 if(/hfd\.co\.il|epost/i.test(from+' '+subject))for(const m of text.matchAll(/(?:^|[\s(:])((?:AP|RS)\d{8,}[A-Z]?|Hfd\d{6,}|\d{8,9})(?=[\s).,]|$)/gi))extra.add(m[1].toUpperCase());
 if(/chita-il|cheetah|tapuz/i.test(from))for(const m of text.matchAll(/(?:^|[\s(:])((?:AE|AP|RS|LP)\d{8,}[A-Z]?)(?=[\s).,]|$)/gi))extra.add(m[1].toUpperCase());
 // Cheetah: "ממתין לאיסוף ב <place>,<street>,<city>,פרטים:<hours>. לאישור"
 const chita=text.match(/ממתין לאיסוף ב\s*([^,]{2,50}),([^,]{2,40}),?([^,]{0,30}?),?\s*פרטים\s*:\s*([^]{0,140}?)(?:לאישור|$)/);
 const place=chita?.[1]?.trim()||text.match(/חנות\s*:\s*([^.:|]{2,40}?)\s*(?:\.|בכתובת|קוד|פרטים|$)/)?.[1]?.trim()||'';
 const address=chita?[chita[2],chita[3]].map(x=>x.trim()).filter(Boolean).join(' '):text.match(/בכתובת\s+([^.|]{4,80}?)\s*(?:פרטים|\.|קוד|$)/)?.[1]?.trim()||'';
 const code=text.match(/קוד (?:לקבלת|לאיסוף|איסוף)(?: ה?חבילה)?\s*:?\s*(\d{4,8})/)?.[1]||'';
 const pickupUrl=(text.match(/https?:\/\/(?:hfd\.sh|[a-z0-9.-]*hfd\.co\.il|[a-z0-9.-]*chita-il\.com|[a-z0-9.-]*tapuzdelivery\.co\.il)\/[^\s"'<>]+/i)?.[0]||'').replace(/^http:/,'https:');
 const hours=chita?.[4]?.replace(/\s+/g,' ').trim().replace(/[.\s]+$/,'')||'';
// Israel Post notices: the place it waits at, and the short shelf code ("ג 11") to give at the counter.
 const post=/postil\.co\.il|israelpost/i.test(from);
 const postWait=post?text.match(/ממתין ב\s*(.{3,80}?)\s*\.\s*(?:למידע|לתשומת|$)/):null;
 const postShelf=post?text.match(/[A-Z]{2}\d{8,12}[A-Z]{0,2}\s*([\u05D0-\u05EA]\s?\d{1,4})(?=\s|[\u05D0-\u05EA])/)?.[1]||'':'';
 const pickup:Pickup|null=postWait?{place:postWait[1].trim(),address:'',code:postShelf,url:'',hours:''}:place||code?{place,address,code,url:pickupUrl,hours}:null;
 // No order and no parcel number: newsletters, surveys and receipts without shipping. Not a parcel.
 if(!order&&!tracking&&!extra.size)return null;
 let name='',image='';
 // Product block: the link to the order/package details, not the "you may also like" grid.
 $('a').each((_,el)=>{if(name)return;const a=$(el),href=a.attr('href')||'';if(!/order-details|package-detail|orderdetail|order_detail|\/gp\/your-account\/order|itemDetail/i.test(href)||/productId=/i.test(href))return;
  const bits=a.find('*').addBack().contents().toArray().filter(n=>n.type==='text').map(n=>$(n).text().replace(/\s+/g,' ').trim()).filter(t=>t.length>6&&!/^[₪$€]|\d+[.,]\d{2}\s*$|^x\d+$|משלוח אל|סך הכל|לפרטי|פרטי ה(?:חבילה|הזמנה|משלוח)|order details|package details/i.test(t));
  if(bits[0]){name=tidyName(bits[0]);}});
 // Package notices list every product in the box (AliExpress "פרטי החבילה"); keep them all, not just the first.
 const listed=[...new Set($('.EDM-SYSTEM-TEXT-productName, .order-list__item-title').toArray().map(el=>tidyName($(el).text().replace(/\s+/g,' ').trim().replace(/\s*[x×]\s*\d{1,3}$/,''))).filter(t=>t.length>3))].slice(0,12);
 // The photo often sits in its own anchor next to the title anchor; take the first real product photo from those links (skip tiny badge icons).
 const productImg=(el:any)=>{const src=$(el).attr('src')||$(el).attr('data-src')||'';const u=secureUrl(src.startsWith('//')?'https:'+src:src.replace(/^http:\/\/(?=[^/]*(?:alicdn|aliexpress-media|media-amazon|ssl-images-amazon|temu|shein|ebayimg))/i,'https://'));const w=Number($(el).attr('width')||0);
  return u&&!/\/\d{1,2}x\d{1,2}\.(?:png|gif|jpe?g)(?:$|\?)|logo|icon|spacer|badge/i.test(u)&&!(w>0&&w<40)?u:'';};
 // A photo for each product in a package notice, so the detail page can show them all.
 const listedImgs=[...new Set($('.EDM-SYSTEM-TEXT-productName').toArray().map(el=>{let box=$(el);for(let k=0;k<6&&!box.find('img').length;k++)box=box.parent();return box.find('img').toArray().map(productImg).find(Boolean)||'';}).filter(Boolean))].slice(0,12);
 // Some AliExpress order mails put the product photos on table cells (src on a non-img tag), not in <img>.
 if(!image)$('a').each((_,el)=>{if(image)return;const href=$(el).attr('href')||'';if(!/order-details|orderdetail/i.test(href))return;$(el).find('[src]').each((_,e)=>{if(!image&&/alicdn|aliexpress-media/.test($(e).attr('src')||''))image=productImg(e);});});
 if(!image)$('a').each((_,el)=>{if(image)return;const href=$(el).attr('href')||'';if(!/order-details|package-detail|orderdetail|order_detail|\/gp\/your-account\/order|itemDetail/i.test(href)||/productId=/i.test(href))return;$(el).find('img').each((_,im)=>{if(!image)image=productImg(im);});});
 // Shopify stores: the item title cell ("כסא ארגונומי … × 1").
 if(!name){const t=$('.order-list__item-title').first().text().replace(/\s+/g,' ').trim();if(t.length>3)name=tidyName(t.replace(/\s*[x×]\s*\d{1,3}\s*$/,''));const img=$('.order-list__product-image').first().attr('src');if(name&&img&&!image)image=secureUrl(img);}
 if(!name)$('img').each((_,el)=>{if(image)return;const e=$(el),alt=(e.attr('alt')||'').trim(),src=secureUrl(e.attr('src')||'');if(src&&alt.length>8&&alt.length<220&&!/logo|banner|icon|spacer|facebook|instagram|unsubscribe|tracking|נגישות|accessib|webview|inforu|^תמונה$/i.test(alt+' '+src)&&!/^(amazon|aliexpress|temu|shein|completed|delivered|shipped|ordered|success|check ?mark|in transit)$/i.test(alt)){name=alt;image=src;}});
 // Order tables ("מקט | תיאור | מחיר | כמות", KSP and similar): the description of the first real product row.
 if(!name)$('table').each((_,t)=>{if(name)return;const rows=$(t).children('tbody').children('tr').toArray().concat($(t).children('tr').toArray());
  const cellsOf=(r:any)=>$(r).children('td,th').toArray().map(c=>$(c).text().replace(/\s+/g,' ').trim());let col=-1;
  for(const r of rows){const c=cellsOf(r);if(col<0){col=c.findIndex(x=>/^(?:תיאור(?: פריט| מוצר)?|שם (?:ה)?מוצר|מוצר|פריט)$/.test(x));continue;}
   const d=c[col]||'';if(d.length>4&&!/GIFTPACK|קמפיין|דואר שליחים|משלוח|הובלה|תשלומים|הטבה|סה['"]?כ/i.test(d+' '+c.join(' '))&&c.some(x=>/^\d{4,9}$/.test(x))){const t=tidyName(d);if(!name)name=t;if(!listed.includes(t))listed.push(t);}}if(name)return;});
 if(pdf&&pdf.items.length>1)for(const t of pdf.items)if(!listed.includes(t))listed.push(t);
 if(!name&&pdf?.items.length)name=pdf.items.slice(0,2).join(' + ')+(pdf.items.length>2?' ועוד '+(pdf.items.length-2):'');
 if(!name)name=/^הודעה (?:מ|ב|על)|notification/i.test(subject)?'חבילה':subject.replace(/^(re:|fw:)\s*/i,'').replace(/[\u2066-\u2069\u200e\u200f]/g,'').replace(/^(?:shipped|ordered|delivered|out for delivery|arriving \w+)\s*:\s*(?:\d+\s+)?/i,'').replace(/\s+items?$/i,'').trim()||'חבילה';
 const lead=text.slice(0,700);
 const cancelled=CANCEL.test(subject)||/הזמנתך זוכתה|your order (?:has been|was) (?:cancel+ed|refunded)/i.test(lead);
 let stage=stageOf(subject);if(stage<0)stage=stageOf(lead);
 // Israel Post's own wording, in plain words; "תודה שאספת" means the user already collected it.
 const postBody=post?text.slice(subject.length):'';
 const postSaid=!post?'':/תודה שאספת/.test(postBody)?'נאספה':postWait?'ממתינה לאיסוף ב'+postWait[1].trim():/יוחזר לשולח|הוחזר לשולח|לא נדרש בידי הנמען/.test(postBody)?'הוחזרה לשולח':/הגיע לארץ/.test(postBody)?'הגיעה לארץ ובדרך אליך':/בדרכו לארץ/.test(postBody)?'בדרך לארץ':'';
 if(postSaid==='נאספה')stage=4;else if(postWait)stage=3;else if(postSaid&&stage<2)stage=2;
 const range=text.match(/בין התאריכים\s*(\d{1,2})[./-](\d{1,2})(?:[./-]\d{2,4})?\s*(?:ו?עד|-)\s*(\d{1,2})[./-](\d{1,2})/);
 const eta=range?(+range[1]+'.'+(+range[2])+'-'+(+range[3])+'.'+(+range[4])):etaOf(text.match(/(?:estimated delivery|expected delivery|arriving|delivery date|הגעה משוערת|מועד הגעה|צפויה להגיע)\s*[:\-]?\s*([^.!?|]{4,65})/i)?.[1]||'');
 const late=post?text.match(/לא יאוחר מתאריך\s*(\d{1,2})\/(\d{1,2})/):null;const etaAll=eta||(late?(+late[1])+'.'+(+late[2]):'');
 const url=$('a').toArray().map(a=>({text:$(a).text(),url:secureUrl($(a).attr('href')||'')})).find(l=>l.url&&/track|מעקב|לעקוב/i.test(l.text))?.url||'';
 const time=new Date(Number(m.internalDate)||Date.now()).toISOString();
 const keys=[...new Set([...[...orders].map(o=>'order:'+o),...(tracking?['tracking:'+tracking]:[]),...[...extra].map(x=>'tracking:'+x)])];
 const shownTracking=tracking||[...extra].find(x=>/^(AP|RS)/.test(x))||[...extra].find(x=>/^HFD/.test(x))||[...extra][0]||'';
 // Carrier mails often have a generic subject ("הודעה מחברת המשלוחים"); describe the event instead.
 const genericSubject=(/^הודעה (?:מ|ב)|notification/i.test(subject)&&!/\d{6,}/.test(subject))||/^הודעה על (?:ה?משלוח|דבר דואר|ה?חבילה)/.test(subject);
 // A notice whose subject says only "הודעה על משלוח …": the news is the sentence after the number in the body ("הגיע לארץ ובדרכו אליך").
 const said=genericSubject?(text.slice(subject.length).match(/\b[A-Z]{2}\d{8,}[A-Z]{0,2}\b\s*(?:מחו["״]ל\s*)?([\u0590-\u05FF][^.\n]{3,70})/)?.[1]||'').replace(/\s+/g,' ').trim():'';
 const label=postSaid?postSaid:/^(?:shipped|ordered|delivered|out for delivery)\s*:/i.test(subject)&&stage>=0?stages[stage]:!genericSubject?subject:said?said:stage===3?('ממתינה לאיסוף'+(place?' ב'+place:'')):stage===2?'בדרך לישראל':stage===1?'יצאה לדרך':(lead.replace(/^.*?שלום[^,]*,\s*/,'').replace(/[A-Z]*\d{6,}[A-Z]?/gi,'').replace(/\s+/g,' ').split(/[.!]/)[0].trim().slice(0,90)||'עדכון מחברת השילוח');
 // Customs / VAT to pay before release. Only official payment links are kept (customs-payment scams are common).
 const due=/(?:תשלום|לתשלום|חיוב|לשלם)\s+(?:ה?מסים|ה?מיסים|ה?מכס|מע"?מ|דמי (?:ה)?מכס|דמי טיפול ומסים)|(?:customs|import) (?:duty|duties|tax|fees?|charges?)|duties (?:and|&) taxes|pay (?:the )?(?:customs|duty|vat)/i.test(subject+' '+text.slice(0,3000))&&(knownSender||/postil|israelpost|gov\.il|dhl|ups|fedex|hfd/i.test(from));
 const OFFICIAL=/^https:\/\/(?:[a-z0-9-]+\.)*(?:israelpost\.co\.il|gov\.il|dhl\.co\.il|dhl\.com|ups\.com|fedex\.com|hfd\.co\.il)\//i;
 const customs=due?{amount:(text.match(/(?:סך|סה"?כ|סכום|בסך|לתשלום|amount|total)[^₪$\d]{0,25}(₪\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?(?:₪|ש"ח|שקלים))/i)?.[1]||'').replace(/\s+/g,'').replace(/ש"ח|שקלים/,'₪'),url:$('a').toArray().map(a=>secureUrl($(a).attr('href')||'')).find(u=>OFFICIAL.test(u))||'',at:time}:undefined;
 const pm=text.match(/(?:סך הכל(?:\s*הזמנה)?|סה"?כ(?:\s*לתשלום)?|order total|total)\s*[:|]?\s*(₪\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?₪|(?:US\s?)?\$\s?[\d,]+(?:\.\d{1,2})?)/i);const price=pm?pm[1].replace(/\s+/g,''):undefined;
 // Quantity: AliExpress writes "x2" after each item; only a single item line counts (several lines = several products).
 const qm=[...text.matchAll(/\s[x×]\s?(\d{1,2})(?=\s|$)/g)].map(x=>+x[1]);const qh=[...text.matchAll(/כמות:\s*(\d{1,2})(?!\d)/g)].map(x=>+x[1]);const qa=qm.length?qm:qh;const qty=qa.length===1&&qa[0]>1?qa[0]:undefined;
 return {id:keys[0],keys,name:name.slice(0,180),shop,carrier,image,url,tracking:shownTracking,order,eta:etaAll,stage,cancelled,pickup,price,qty,via:via.length?via:undefined,...(listed.length>1?{items:listed}:{}),...(listedImgs.length>1?{images:listedImgs}:{}),customs,events:[{id:m.id,label:label||(stage>=0?stages[stage]:'עדכון'),time}]};
}

// Mails about the same parcel share an order number or a tracking number; join everything connected.
export function mergeParcels(rows:Parcel[]){
 const parent=new Map<string,string>();const find=(k:string):string=>{const p=parent.get(k)??k;if(p===k)return k;const r=find(p);parent.set(k,r);return r;};
 for(const p of rows){const keys=p.keys?.length?p.keys:[p.id];for(const k of keys)if(!parent.has(k))parent.set(k,k);for(const k of keys.slice(1))parent.set(find(k),find(keys[0]));}
 // AliExpress ships several orders from one checkout in a single package, but its package mails name only one of them.
 // Orders from the same checkout (same id prefix) whose "shipped" mails arrive within 90 seconds are treated as one package.
 const shipped=rows.filter(p=>p.order&&/aliexpress/i.test(p.shop)).map(p=>({p,t:Date.parse(p.events.find(e=>/:\s*נשלחה\s*$|^נשלחה$|has shipped|shipped$/i.test(e.label))?.time||'')})).filter(x=>x.t);
 for(const a of shipped)for(const b of shipped)if(a!==b&&a.p.order.slice(0,10)===b.p.order.slice(0,10)&&a.p.order!==b.p.order&&Math.abs(a.t-b.t)<=90000){const ka=(a.p.keys?.length?a.p.keys:[a.p.id])[0],kb=(b.p.keys?.length?b.p.keys:[b.p.id])[0];parent.set(find(kb),find(ka));}
 const groups=new Map<string,Parcel[]>();for(const p of rows){const root=find((p.keys?.length?p.keys:[p.id])[0]);groups.set(root,[...(groups.get(root)||[]),p]);}
 const out:Parcel[]=[];
 for(const list of groups.values()){
  const sorted=[...list].sort((a,b)=>a.events.at(-1)!.time.localeCompare(b.events.at(-1)!.time));const latest=sorted.at(-1)!;
  const keys=[...new Set(list.flatMap(p=>p.keys?.length?p.keys:[p.id]))].sort((a,b)=>(a.startsWith('order:')?0:1)-(b.startsWith('order:')?0:1)||a.localeCompare(b));
  const events=[...new Map(list.flatMap(p=>p.events).map(e=>[e.id,e])).values()].sort((a,b)=>a.time.localeCompare(b.time));
  const named=sorted.find(p=>p.image)||sorted.find(p=>!/^(?:הזמנה|חבילה|לחבילה|your order|הודעה מ)/i.test(p.name))||latest;
  // Several orders shipped in one package: name the package after all of them ("שחמט + אזעקה").
  const generic=(n:string)=>/^(?:הזמנה|חבילה|לחבילה|your order|הודעה מ)/i.test(n);
  const perOrder=new Map<string,string>();for(const p of sorted)if(p.order&&!generic(p.name)&&!perOrder.has(p.order))perOrder.set(p.order,p.name);
  const items=[...new Set([...[...perOrder.values()].flatMap(n=>n.replace(/\s+ועוד \d+$/,'').split(' + ')),...list.flatMap(p=>p.items||[])])].filter((a,i,all)=>{const n=(t:string)=>heName(polishName(t)).replace(/[.…\s]+$/,'').trim();const na=n(a);return !all.some((b,j)=>{const nb=n(b);return b!==a&&(nb===na?j<i:nb.length>na.length&&(nb.startsWith(na)||nb.startsWith(na.split(' ').slice(0,3).join(' '))&&na.split(' ').length>=3&&nb.split(' ').slice(0,3).join(' ')===na.split(' ').slice(0,3).join(' ')));});});
  // The same product named by two mails, one cut shorter ("מכנסי קארגו לגברים" / "… כותנה"), is listed once.
  // One picture per order in the package.
  const perImg=new Map<string,string>();for(const p of sorted)if(p.order&&p.image&&!perImg.has(p.order))perImg.set(p.order,p.image);const images=[...new Set([...list.flatMap(p=>p.images||[]),...perImg.values()])];
  // Orders in the package whose mails carry no product name still count ("… ועוד 2").
  const orderCount=keys.filter(k=>k.startsWith('order:')).length;const unnamed=items.length?Math.max(0,orderCount-Math.max(perOrder.size,items.length)):0;
  // Up to four products are named on the card; only beyond that does it say "ועוד N".
  const more=Math.max(0,items.length-4)+unnamed;
  // Every order in the package, so each one can be found and listed (unnamed ones by their order number).
  const contents=orderCount>1||items.length>1?[...items,...keys.filter(k=>k.startsWith('order:')).map(k=>k.slice(6)).filter(o=>!perOrder.has(o)).slice(0,unnamed).map(o=>'הזמנה …'+o.slice(-6))]:[];
  const title=items.length>1||unnamed?items.slice(0,4).join(' + ')+(more?' ועוד '+more:''):named.name;
  const stage=Math.max(0,...list.map(p=>p.stage));
  // Cancelled only if the cancellation is the newest news (a later shipping mail means it went out after all).
  const cancelled=latest.cancelled||(list.some(p=>p.cancelled)&&stage<1);
  // The shop comes from the order mails, not from a carrier's notice (Israel Post writes as itself).
  const isCarrier=(n:string)=>!n||n==='הזמנה מהדוא״ל'||carriers.some(([,c])=>c===n);
  const shop=sorted.find(p=>p.order&&!isCarrier(p.shop))?.shop||sorted.find(p=>!isCarrier(p.shop))?.shop||latest.shop;
  out.push({...latest,shop,id:keys[0],keys,name:title,...(contents.length>1?{items:contents}:{}),image:named.image||list.find(p=>p.image)?.image||'',
   carrier:[...sorted].reverse().find(p=>p.carrier)?.carrier||'',tracking:[...sorted].reverse().find(p=>/^(AP|RS|[A-Z]{2}\d{9}[A-Z]{2})/.test(p.tracking))?.tracking||[...sorted].reverse().find(p=>p.tracking)?.tracking||'',pickup:[...sorted].reverse().find(p=>p.pickup?.place)?.pickup||[...sorted].reverse().find(p=>p.pickup)?.pickup||null,order:sorted.find(p=>p.order)?.order||'',
   url:[...sorted].reverse().find(p=>p.url)?.url||'',images:images.length>1?images.slice(0,4):undefined,customs:[...sorted].reverse().find(p=>p.customs)?.customs,price:sorted.find(p=>p.price)?.price,via:[...new Set(list.flatMap(p=>p.via||[]))].length?[...new Set(list.flatMap(p=>p.via||[]))]:undefined,qty:items.length>1||unnamed?undefined:sorted.find(p=>p.qty)?.qty,stage,cancelled,eta:stage===4?'':[...sorted].reverse().find(p=>p.eta)?.eta||'',events});
 }
 return out.sort((a,b)=>b.events.at(-1)!.time.localeCompare(a.events.at(-1)!.time));
}
// An SMS from the post office or a courier (pasted, or sent by an iPhone Shortcut) turned into a parcel update.
export function parseSms(raw:string,now=new Date()):Parcel|null{
 const text=raw.replace(/\s+/g,' ').trim().slice(0,1200);if(text.length<8)return null;
 // A courier asking to collect a return from the user is not an incoming parcel.
 if(/לאסוף ממך|איסוף החזרה|איסוף ה?משלוח ה?חוזר/.test(text))return null;
 const tracking=(text.match(/(?:מספר\s*(?:ה?מעקב|ה?משלוח|ה?חבילה|פריט)|מס['׳]?\s*(?:מעקב|משלוח|חבילה)|tracking(?:\s*(?:number|no\.?))?|פריט)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{5,34})/i)?.[1]
  ||text.match(/\b([A-Z]{2}\d{9}[A-Z]{2}|1Z[0-9A-Z]{16}|RS\d{9,}Y?|LP\d{10,}|AP\d{8,}|AE\d{8,})\b/i)?.[1]||text.match(/משלוח\s*(?:מספר|מס['׳]?)?\s*:?\s*#?\s*(\d{6,14})\b/)?.[1]||'').replace(/[^a-z0-9-]/gi,'').toUpperCase();
 if(!tracking)return null;
 const code=text.match(/(?:קוד(?:\s*(?:ה?איסוף|ה?משיכה|לקבלת\s*ה?חבילה|אישור|סודי))?|code)\s*[:\-]?\s*(\d{4,8})\b/i)?.[1]||'';
 const place=(text.match(/(?:לאיסוף|ממתינה|ממתין|מחכה)[^.]{0,30}?\s(?:בנקודת איסוף|בנקודת|בסניף|בחנות|ב)\s*([^.,\n]{3,40}?)(?=[,.]|\s+(?:ב?כתובת|ברחוב|עד|קוד|לפרטים|שעות)|$)/)?.[1]||'').trim();
 const address=(text.match(/(?:בכתובת|כתובת:?|ברחוב)\s*([^.\n]{4,60}?)(?=[.]|\s+(?:עד|קוד|לפרטים|שעות)|$)/)?.[1]||'').trim();
 const hours=(text.match(/שעות(?:\s*פתיחה)?\s*:?\s*([^.\n]{4,60})/)?.[1]||'').trim();
 let stage=stageOf(text);if((code||place)&&stage<3)stage=3;if(stage<0)stage=2;
 const carrier=carrierFrom(text,'');
 const pickup=place||code?{place,address,code,url:'',hours:hours||undefined}:null;
 const label=stage===3&&pickup?('ממתינה לאיסוף'+(place?' ב'+place:'')):stage===4?'נמסרה':stage===3?'יצאה למסירה':'עדכון מ־SMS';
 // Israeli stores' couriers (Tapuz, KSP…) mention the store's order number; it joins the SMS to the order mail.
 const order=text.match(/הזמנ\S*\s*(?:מס['׳]?|מספר)?\s*:?\s*#?\s*(\d{6,12})/)?.[1]||text.match(new RegExp(tracking+'\\s*(?:מספר|הזמנה|/)\\s*(\\d{6,12})'))?.[1]||'';const shop=shops.find(([r])=>r.test(text))?.[1]||'';
 return {id:'tracking:'+tracking,keys:['tracking:'+tracking,...(order&&order!==tracking?['order:'+order]:[])],name:'חבילה '+tracking,shop,carrier,image:'',url:'',tracking,order,eta:'',stage,cancelled:false,pickup,events:[{id:'sms:'+tracking+':'+stage+':'+now.toISOString().slice(0,13),label,time:now.toISOString()}]};}
