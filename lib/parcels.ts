import * as cheerio from 'cheerio';
export type Event={id:string;label:string;time:string};
export type Parcel={id:string;name:string;shop:string;image:string;url:string;tracking:string;eta:string;stage:number;events:Event[]};
export type Message={id:string;threadId?:string;internalDate?:string;snippet?:string;payload?:Part};
type Part={mimeType?:string;body?:{data?:string};parts?:Part[];headers?:{name:string;value:string}[]};
export const stages=['ההזמנה התקבלה','נשלחה','בדרך ליעד','במסירה / איסוף','נמסרה'];
export function secureUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}
function body(p?:Part):string{if(!p)return '';const here=p.body?.data?Buffer.from(p.body.data,'base64url').toString('utf8'):'';return [here,...(p.parts||[]).map(body)].join('\n');}
export function parseMessage(m:Message):Parcel|null{
 const h=m.payload?.headers||[];const header=(key:string)=>h.find(x=>x.name.toLowerCase()===key)?.value||'';
 const subject=header('subject'),from=header('from');const html=body(m.payload);const $=cheerio.load(html);$('script,style').remove();
 const text=[subject,$.text(),m.snippet].join(' ').replace(/\s+/g,' ').slice(0,100000);
 if(!/order|shipment|shipping|delivery|tracking|הזמנ|משלוח|חבילה|איסוף|נמסר/i.test(text))return null;
 const shop=/aliexpress/i.test(from)?'AliExpress':/amazon\./i.test(from)?'Amazon':/temu/i.test(from)?'Temu':/shein/i.test(from)?'SHEIN':/ebay/i.test(from)?'eBay':/israelpost/i.test(from)?'דואר ישראל':(from.match(/@([a-z0-9.-]+)/i)?.[1]||'הזמנה מהדוא״ל');
 const tracking=(text.match(/(?:tracking(?:\s+(?:number|no\.?))?|מספר\s*(?:מעקב|משלוח))\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{7,34})/i)?.[1]||'').replace(/[^a-z0-9-]/gi,'');
 const order=text.match(/(?:order(?:\s*(?:number|no\.?|id))?|הזמנה)\s*[:#]\s*([A-Z0-9-]{6,35})/i)?.[1]||'';
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
 return {id:tracking?'tracking:'+tracking.toUpperCase():order?'order:'+shop+':'+order:'thread:'+(m.threadId||m.id),name:name.slice(0,180),shop,image,url,tracking,eta,stage,events:[{id:m.id,label:subject||stages[stage],time}]};
}
export function mergeParcels(rows:Parcel[]){const map=new Map<string,Parcel>();for(const p of rows){const old=map.get(p.id);if(!old){map.set(p.id,p);continue;}const latest=old.events.at(-1)!.time>p.events.at(-1)!.time?old:p;const events=[...new Map([...old.events,...p.events].map(e=>[e.id,e])).values()].sort((a,b)=>a.time.localeCompare(b.time));map.set(p.id,{...latest,name:old.image?old.name:p.name,image:old.image||p.image,eta:latest.eta||old.eta||p.eta,events});}return [...map.values()].sort((a,b)=>b.events.at(-1)!.time.localeCompare(a.events.at(-1)!.time));}
