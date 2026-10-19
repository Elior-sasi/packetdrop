// The last-mile courier's own delivery day (HFD, Cheetah): read from the public page their mail/SMS links to.
const KEY=/מסירה|יגיע|תגיע|צפי|מתוכנן|מתוכננת|משוער|תאריך|מועד|delivery|expected|scheduled/i;
const TIME=/(\d{1,2}:\d{2})\s*(?:-|–|עד)\s*(\d{1,2}:\d{2})/;
// "24.10 · 10:00-14:00", "24.10", or ''.
export function courierEta(text:string,now=new Date()):string{
 const lines=text.split(/\n|\s\|\s/).map(l=>l.replace(/\s+/g,' ').trim()).filter(l=>l.length>2&&l.length<200);
 for(let i=0;i<lines.length;i++){if(!KEY.test(lines[i])||/הוזמן|נקלט|קליטה|התקבל|order date|הזמנה בוצעה/i.test(lines[i]))continue;
  const near=[lines[i],lines[i+1]||''].join(' ');let d=0,m=0;
  const dm=near.match(/(?<![\d:])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d:])/);
  if(dm){d=+dm[1];m=+dm[2];}else if(/היום|today/i.test(near)){d=now.getDate();m=now.getMonth()+1;}else if(/מחר|tomorrow/i.test(near)){const t=new Date(now.getTime()+864e5);d=t.getDate();m=t.getMonth()+1;}
  if(!(d>=1&&d<=31&&m>=1&&m<=12))continue;
  let t=new Date(now.getFullYear(),m-1,d).getTime();if(t<now.getTime()-120*864e5)t=new Date(now.getFullYear()+1,m-1,d).getTime();
  if(t<now.getTime()-2*864e5||t>now.getTime()+30*864e5)continue;
  const w=near.match(TIME);return d+'.'+m+(w?' · '+w[1]+'-'+w[2]:'');}
 return '';}
export const COURIER_HOST=/^https:\/\/(?:hfd\.sh|[a-z0-9.-]*hfd\.co\.il|[a-z0-9.-]*chita-il\.com)\//i;
export function pageText(html:string){return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h\d|td|span)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ');}
