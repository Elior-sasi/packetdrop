import * as cheerio from 'cheerio';
export type Event={id:string;label:string;time:string};
export type Parcel={id:string;name:string;shop:string;carrier:string;image:string;url:string;tracking:string;eta:string;stage:number;events:Event[]};
export type Message={id:string;threadId?:string;internalDate?:string;snippet?:string;payload?:Part};
type Part={mimeType?:string;body?:{data?:string};parts?:Part[];headers?:{name:string;value:string}[]};
export const stages=['ההזמנה התקבלה','נשלחה','בדרך ליעד','במסירה / איסוף','נמסרה'];
const shops:[RegExp,string][]=[[/aliexpress/i,'AliExpress'],[/amazon\./i,'Amazon'],[/temu/i,'Temu'],[/shein/i,'SHEIN'],[/ebay/i,'eBay'],[/iherb/i,'iHerb'],[/asos/i,'ASOS'],[/zara\./i,'Zara'],[/next\.(?:co\.il|com)/i,'NEXT'],[/ksp\.co\.il/i,'KSP'],[/ivory\.co\.il/i,'Ivory'],[/shufersal/i,'שופרסל'],[/terminalx/i,'Terminal X'],[/apple\.com/i,'Apple']];
const carriers:[RegExp,string][]=[[/israelpost|דואר ישראל/i,'דואר ישראל'],[/\bups\b|ups\.com/i,'UPS'],[/\bdhl\b/i,'DHL'],[/fedex/i,'FedEx'],[/cainiao/i,'Cainiao'],[/yunexpress/i,'YunExpress'],[/\b4px\b/i,'4PX'],[/hfd|אחד עד אחד|epost/i,'HFD'],[/cheetah|צ['׳]יטה/i,"צ'יטה"],[/boxit|בוקסיט/i,'Boxit'],[/yango/i,'Yango'],[/wolt/i,'Wolt']];
function shopFrom(from:string,text:string){for(const [r,n] of shops)if(r.test(from))return n;const dom=from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase()||'';if(dom&&!/israelpost|ups\.|dhl|fedex|cainiao|hfd|cheetah/.test(dom))return dom.replace(/^(mail|email|e|info|noreply|news|orders?|shipping)\./,'');for(const [r,n] of shops)if(r.test(text.slice(0,4000)))return n;return /israelpost/i.test(from)?'דואר ישראל':'הזמנה מהדוא״ל';}
function carrierFrom(t:string,shop:string){for(const [r,n] of carriers)if(r.test(t)&&n!==shop)return n;return '';}
export const brandDomains:Record<string,string>={AliExpress:'aliexpress.com',Amazon:'amazon.com',Temu:'temu.com',SHEIN:'shein.com',eBay:'ebay.com',iHerb:'iherb.com',ASOS:'asos.com',Zara:'zara.com',NEXT:'next.co.il',KSP:'ksp.co.il',Ivory:'ivory.co.il','שופרסל':'shufersal.co.il','Terminal X':'terminalx.com',Apple:'apple.com','דואר ישראל':'israelpost.co.il',UPS:'ups.com',DHL:'dhl.com',FedEx:'fedex.com',Cainiao:'cainiao.com',YunExpress:'yunexpress.com','4PX':'4px.com',HFD:'hfd.co.il',"צ'יטה":'cheetah.co.il',Boxit:'boxit.co.il',Yango:'yango.com',Wolt:'wolt.com'};
export function secureUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}
function body(p?:Part):string{if(!p)return '';const here=p.body?.data?Buffer.from(p.body.data,'base64url').toString('utf8'):'';return [here,...(p.parts||[]).map(body)].join('\n');}
export function parseMessage(m:Message):Parcel|null{
 const h=m.payload?.headers||[];const header=(key:string)=>h.find(x=>x.name.toLowerCase()===key)?.value||'';
 const subject=header('subject'),from=header('from');const html=body(m.payload);const $=cheerio.load(html);$('script,style').remove();
 const text=[subject,$.text(),m.snippet].join(' ').replace(/\s+/g,' ').slice(0,100000);
 if(!/order|shipment|shipping|shipped|delivery|delivered|tracking|package|parcel|in transit|dispatched|הזמנ|משלוח|חבילה|איסוף|נמסר|נשלח/i.test(text))return null;
 const shop=shopFrom(from,text);const carrier=carrierFrom(from+' '+text,shop);
 const tracking=((text.match(/(?:tracking(?:\s+(?:number|no\.?|id|code))?|מספר\s*(?:ה?מעקב|ה?משלוח)|קוד\s*מעקב)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{7,34})/i)?.[1])||text.match(/\b([A-Z]{2}\d{9}[A-Z]{2}|1Z[0-9A-Z]{16})\b/)?.[1]||'').replace(/[^a-z0-9-]/gi,'');
 const order=text.match(/(?:order(?:\s*(?:number|no\.?|id))?|מספר\s*הזמנה|הזמנה(?:\s*מס['׳]?)?)\s*[:#.]?\s*#?\s*(\d[A-Z0-9-]{5,34})/i)?.[1]||'';
 let name='',image='';
 // Product image alt text is a better title than the generic email subject.
 $('img').each((_,el)=>{if(image)return;const e=$(el),alt=(e.attr('alt')||'').trim(),src=secureUrl(e.attr('src')||'');if(src&&alt.length>8&&alt.length<220&&!/logo|banner|icon|spacer|facebook|instagram|unsubscribe|tracking/i.test(alt+' '+src)&&!/^(amazon|aliexpress|temu|shein)$/i.test(alt)){name=alt;image=src;}});
 if(!name)name=subject.replace(/^(re:|fw:)\s*/i,'').trim()||'חבילה חדשה';
 let stage=0;
 if(/out for delivery|ready for (?:pickup|collection)|מוכנה לאיסוף|ממתינה לאיסוף|בדרך למסירה/i.test(text))stage=3;
 else if(/has been delivered|was delivered|successfully delivered|delivery complete|נמסרה בהצלחה|החבילה נמסרה|נמסר לנמען/i.test(text)&&!/not delivered|לא נמסרה/i.test(text))stage=4;
 else if(/in transit|arrived at|customs|במרכז המיון|הגיע[ה]? לארץ|בדרכה לישראל|במכס/i.test(text))stage=2;
 else if(/has shipped|order shipped|dispatched|shipment sent|המשלוח נשלח|החבילה נשלחה|יצא לדרך/i.test(text))stage=1;
 const eta=text.match(/(?:estimated delivery|expected delivery|arriving|delivery date|הגעה משוערת|מועד הגעה)\s*[:\-]?\s*([^.!?]{4,65})/i)?.[1]?.trim()||'';
 const links=$('a').toArray().map(a=>({text:$(a).text(),url:secureUrl($(a).attr('href')||'')}));
 const url=links.find(l=>l.url&&/track|מעקב/i.test(l.text))?.url||'';
 const time=new Date(Number(m.internalDate)||Date.now()).toISOString();
 return {id:tracking?'tracking:'+tracking.toUpperCase():order?'order:'+shop+':'+order:'thread:'+(m.threadId||m.id),name:name.slice(0,180),shop,carrier,image,url,tracking,eta,stage,events:[{id:m.id,label:subject||stages[stage],time}]};
}
export function mergeParcels(rows:Parcel[]){const map=new Map<string,Parcel>();for(const p of rows){const old=map.get(p.id);if(!old){map.set(p.id,p);continue;}const latest=old.events.at(-1)!.time>p.events.at(-1)!.time?old:p;const events=[...new Map([...old.events,...p.events].map(e=>[e.id,e])).values()].sort((a,b)=>a.time.localeCompare(b.time));map.set(p.id,{...latest,name:old.image?old.name:p.name,image:old.image||p.image,carrier:latest.carrier||old.carrier||p.carrier,tracking:latest.tracking||old.tracking||p.tracking,url:latest.url||old.url||p.url,stage:Math.max(old.stage,p.stage),eta:Math.max(old.stage,p.stage)===4?'':latest.eta||old.eta||p.eta,events});}return [...map.values()].sort((a,b)=>b.events.at(-1)!.time.localeCompare(a.events.at(-1)!.time));}
