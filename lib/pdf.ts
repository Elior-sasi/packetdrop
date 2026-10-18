// Text out of PDF attachments (invoices / order copies), for stores that put the details only there (מחסני חשמל and similar).
import {getDocumentProxy} from 'unpdf';
const HEB=/[֐-׿]/;
// Some PDF writers store Hebrew in visual order ("הנמזה" for "הזמנה"). Detect it with common words and flip those runs.
const FWD=/הזמנה|מספר|תאריך|חשבונית|לקוח|משלוח|טלפון|כתובת|מחיר|כמות|סה"?כ|תיאור|פריט|אספקה/g;
const REV=/הנמזה|רפסמ|ךיראת|תינובשח|חוקל|חולשמ|ןופלט|תבותכ|ריחמ|תומכ|כ"?הס|רואית|טירפ|הקפסא/g;
// Visual order: words are right-to-left and Hebrew letters inside a word are mirrored; numbers and Latin stay as written.
function flipLine(l:string){return l.split(' ¦ ').map(flipCell).join(' ¦ ');}
function flipCell(l:string){return l.split(/(\s+)/).reverse().map(w=>HEB.test(w)?[...w].reverse().join('').replace(/[()]/g,c=>c==='('?')':'('):w).join('');}
export async function pdfText(data:Uint8Array):Promise<string>{
 const pdf=await getDocumentProxy(data);const lines:string[]=[];
 for(let n=1;n<=Math.min(pdf.numPages,3);n++){const page=await pdf.getPage(n);const tc=await page.getTextContent();
  const rows=new Map<number,{x:number;s:string}[]>();
  for(const it of tc.items as {str:string;transform:number[]}[]){if(!it.str?.trim())continue;const y=Math.round(it.transform[5]/3);rows.set(y,[...(rows.get(y)||[]),{x:it.transform[4],s:it.str}]);}
  // Top to bottom; right to left inside a line (Hebrew documents).
  for(const y of [...rows.keys()].sort((a,b)=>b-a))lines.push(rows.get(y)!.sort((a,b)=>b.x-a.x).map(i=>i.s.replace(/\s+/g,' ').trim()).join(' ¦ '));}
 const all=lines.join('\n');const fwd=(all.match(FWD)||[]).length,rev=(all.match(REV)||[]).length;
 return rev>fwd?lines.map(flipLine).join('\n'):all;}
// Some invoices keep each word right but put the runs in display order: "לבן RXS-390-AS בר מים אלקטרה שבת".
// A leading color before a model code is that sign; the runs are put back in reading order.
const COLOR=/^(?:לבן|לבנה|שחור|שחורה|כסוף|כסופה|כסף|אפור|אפורה|נירוסטה|אדום|אדומה|כחול|כחולה|זהב|ירוק|ירוקה|בז'|חום|ורוד|גרפיט|טיטניום)$/;
export function runOrder(c:string){const m=c.match(/^(\S+(?:\s\S+)?)\s+([A-Za-z0-9][A-Za-z0-9\-\/.]*)\s+(.*[֐-׿].*)$/);
 return m&&COLOR.test(m[1])&&/\d/.test(m[2])?m[3]+' '+m[2]+' '+m[1]:c;}
// Order number, product lines and delivery-note numbers from an order copy or invoice.
export function pdfOrder(text:string){
 const order=text.match(/(?:מס['׳]?\s*הזמנה|הזמנה\s*מספר)[\s¦:-]*(?:מס['׳]?[\s¦]*)?(\d{8,12})/)?.[1]||'';
 const ship=[...new Set([...text.matchAll(/ת\.?\s?משלוח[\s¦:]*(\d{7,12})/g)].map(m=>m[1]))];
 // Product rows: a 5-7 digit item code and a price; the description is the longest Hebrew cell that is not a warehouse/agent/payment column.
 const NOISE=/סוכן|אינטרנט|מחסן|הובל|שילוח|אשראי|בנק|התאמות|ספק|שיווק|החזרה|BTB|מבוטל|תשלומים|הטבת|מקט השלמה|התקנה|אחריות|סה"?כ|מע"?מ|^הערות/;
 const items:string[]=[];
 for(const line of text.split('\n')){const cells=line.split(' ¦ ').map(c=>c.trim()).filter(Boolean);const flat=cells.join(' ');
  if(!/\b\d{5,7}\b/.test(flat)||!/\d+\.\d{2}/.test(flat))continue;
  const desc=cells.filter(c=>HEB.test(c)&&c.length>=6&&!NOISE.test(c)&&!/^\d/.test(c)).sort((a,b)=>b.length-a.length)[0];
  const fixed=desc&&runOrder(desc);if(fixed&&!items.includes(fixed))items.push(fixed);}
 return {order,ship,items:items.slice(0,4)};}
