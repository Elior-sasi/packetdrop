// Turns machine-translated store titles into short Hebrew product names. Free and offline: fixed rules only.
const NOUNS=['סט','חולצה','חולצת','חולצות','בגדי','שעון','כיסוי','מארז','נרתיק','מכנסי','מכנסיים','תחפושת','שקע','כבל','מטען','אוזניות','מנורה','מנורת','תיק','נעלי','נעליים','כובע','גרביים','מחזיק','רצועה','רצועת','מגן','מעמד','שטיח','בובה','צעצוע','משחק','דונגל','מקלט','שלט','מקלדת','עכבר','רמקול','סוללה','מתאם','מצלמה','מברשת','בקבוק','כוס','ספל','ארנק','שמיכה','כרית','מדבקה','מדבקות','תכשיט','שרשרת','צמיד','טבעת','עגילים','משקפיים','מעיל','ז\'קט','סווטשירט','קפוצ\'ון','שמלה','חצאית','פיג\'מה','תחתונים','חגורה','מחברת','עט','מספריים','סכין','מזרן','וילון','פנס','נורה','מאוורר','מפזר','כפפות','צעיף','מטריה','תמונה','פוסטר','פאזל','קופסה','קופסת','מגבת','סיר','מחבת'];
const EN:Record<string,string>={dongle:'דונגל',receiver:'מקלט',case:'מארז',cover:'כיסוי',charger:'מטען',cable:'כבל',strap:'רצועה',adapter:'מתאם',stand:'מעמד',holder:'מחזיק',mouse:'עכבר',keyboard:'מקלדת',controller:'שלט',remote:'שלט',battery:'סוללה',speaker:'רמקול',lamp:'מנורה',bag:'תיק',watch:'שעון',headphones:'אוזניות',earphones:'אוזניות'};
const FILL=/^(?:קיץ|אביב|סתיו|חורף|חדש|חדשה|חדשים|חדשות|אופנה|אופנתי|אופנתית|קז'ואל|קזואל|מזדמן|מזדמנת|באיכות|גבוהה|איכותי|איכותית|יוקרה|יוקרתי|יוקרתית|פופולרי|לוהט|מבצע|משלוח|חינם|מקורי|201\d|202\d|new|hot|sale|free|shipping|original|fashion|casual|summer|winter|spring|autumn|usb|nano|mini|portable)$/i;
const AUD=/^(?:לגברים|לנשים|לילדים|לילדות|לבנים|לבנות|לתינוקות|ליוניסקס|לגבר|לאישה|לנשים\/גברים)$/;
const SPEC=/^\d+(?:[.,]\d+)?(?:a|v|w|mah|mm|cm|m|gb|tb|hz|pcs|יח'?)$/i;
const isNoun=(w:string)=>NOUNS.includes(w.replace(/[,،]$/,''));
// "AirPods 5 (2026) /4/Pro 3" -> "AirPods 5"
const model=(s:string)=>s.replace(/\([^)]*\)/g,' ').replace(/\s*\/.*$/,'').replace(/\s+/g,' ').trim();
function part(raw:string){let s=raw.replace(/[|]/g,' ').replace(/\s+/g,' ').trim();if(!s)return s;
 // A title cut with "…": the last word is incomplete, drop it.
 if(/(?:…|\.\.\.)$/.test(s)){s=s.replace(/(?:…|\.\.\.)$/,'').trim();if(s.split(' ').length>2)s=s.replace(/\s+\S+$/,'');}
 // "עבור Logitech F710 USB Nano Dongle" -> "דונגל ל־Logitech F710"
 const f=s.match(/^(?:עבור|for)\s+(.+)$/i);
 if(f){const w=f[1].split(' ');const i=w.findIndex(x=>EN[x.toLowerCase()]);if(i>0){const target=w.slice(0,i).filter(x=>!FILL.test(x)).join(' ');return EN[w[i].toLowerCase()]+' ל־'+model(target);}return model(f[1]);}
 // "למארז AirPods 5 (2026)" (translated "for case ...") -> "מארז ל־AirPods 5"
 const l=s.match(/^ל(מארז|כיסוי|נרתיק|מגן|רצועת|רצועה|מטען|כבל|מחזיק|מעמד)\s+(.+)$/);
 if(l&&/[A-Za-z]/.test(l[2]))return l[1]+' ל־'+model(l[2]);
 let w=s.split(' ').filter(x=>!FILL.test(x)&&!SPEC.test(x));
 // An audience word before the product ("לגברים בגדי…") moves after it; elsewhere it stays.
 const n0=w.findIndex(isNoun);const aud=n0>0?w.slice(0,n0).find(x=>AUD.test(x)):undefined;if(aud)w=w.filter(x=>!AUD.test(x));
 // Leading keywords before the actual product: start at the first product noun when it is near the start.
 const first=w.findIndex(isNoun);if(first>0&&first<=3)w=w.slice(first);
 // A product noun again further on starts a new keyword run ("סט שחמט נייד משחק לוח").
 if(isNoun(w[0]||'')){const again=w.findIndex((x,i)=>i>=3&&isNoun(x));if(again>0)w=w.slice(0,again);}
 // The first word repeated later ("שקע חכם WiFi שקע ישראל").
 const rep=w.findIndex((x,i)=>i>0&&x===w[0]);if(rep>0)w=w.slice(0,rep);
 if(w.length>6)w=w.slice(0,6);
 while(w.length>1&&/^(?:עם|של|עבור|ו|ל|ב|מ|ה|and|with|for|of)$/i.test(w.at(-1)!))w.pop();
 let out=w.join(' ').replace(/[\s,،\-–]+$/,'');
 if(aud&&out&&!out.includes(aud)&&out.split(' ').length<=4)out+=' '+aud;
 return out;}
export function heName(n:string){const src=n.trim();if(!src)return src;
 const out=src.split(/\s+\+\s+/).map(part).filter(Boolean).join(' + ');
 return out.length>=3?out:src;}
