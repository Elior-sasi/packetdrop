// One internal status model, whatever wording the store or courier used. The app still shows natural Hebrew.
import type {Parcel} from '@/lib/parcels';
export type Status='ORDERED'|'PROCESSING'|'SHIPPED'|'IN_TRANSIT'|'ARRIVED_IN_DESTINATION_COUNTRY'|'CUSTOMS'|'LOCAL_CARRIER'|'OUT_FOR_DELIVERY'|'READY_FOR_PICKUP'|'DELIVERED'|'EXCEPTION';
export const STATUS_HE:Record<Status,string>={ORDERED:'ההזמנה התקבלה',PROCESSING:'בהכנה',SHIPPED:'נשלחה',IN_TRANSIT:'בדרך',ARRIVED_IN_DESTINATION_COUNTRY:'הגיעה לארץ',CUSTOMS:'במכס',LOCAL_CARRIER:'אצל חברת המסירה',OUT_FOR_DELIVERY:'יצאה למסירה',READY_FOR_PICKUP:'מוכנה לאיסוף',DELIVERED:'נמסרה',EXCEPTION:'בעיה במשלוח'};
// Order matters: the most specific / final wording first.
const RULES:[Status,RegExp][]=[
 ['EXCEPTION',/מוחזרת לשולח|הוחזרה לשולח|חוזרת לשולח|returned? to (?:the )?sender|exception|חריגה|נעצר(?:ה)? במכס|מעוכב(?:ת)? במכס|held (?:by|at|in) customs|address (?:problem|issue|incorrect|incomplete)|כתובת (?:שגויה|חסרה|לא מלאה)|אבד(?:ה)?\b|lost (?:in transit|parcel|package)|damaged|ניזוק(?:ה)?|מסירה נכשל|ניסיון (?:ה)?מסירה|delivery (?:attempt|failed|unsuccessful)|unable to deliver|attempted delivery/i],
 ['DELIVERED',/נמסר(?:ה)?(?![א-ת])(?!\s*ל(?:חברת|שליח|מוביל))|נאספה על ידך|delivered(?! to (?:the )?(?:carrier|airline|courier|local))|picked up by (?:the )?(?:customer|recipient)/i],
 ['READY_FOR_PICKUP',/מוכנה לאיסוף|ממתינה לאיסוף|ממתין לאיסוף|לאיסוף|ready for (?:pick ?up|collection)|available for pick ?up|awaiting (?:pick ?up|collection)/i],
 ['OUT_FOR_DELIVERY',/יצאה למסירה|יצא למסירה|בדרך למסירה|השליח בדרך|out for delivery|with (?:the )?courier for delivery/i],
 ['LOCAL_CARRIER',/חברת המשלוחים המקומית|חברת המסירה המקומית|הועבר(?:ה)? לחברת המסירה|handed (?:over )?to (?:the )?(?:local|last[- ]mile)|local (?:courier|delivery company)/i],
 ['CUSTOMS',/מכס|customs|clearance/i],
 ['ARRIVED_IN_DESTINATION_COUNTRY',/הגיע[הו]? לארץ|הגיע(?:ה)? לישראל|במדינה\/באזור שלכם|באזור שלכם|נחתה|arrived (?:in|at) (?:israel|(?:the )?destination)|arrival at destination/i],
 ['IN_TRANSIT',/יצאה מארץ המוצא|יצאה מאזור המוצא|יצאה בטיסה|בתעבורה|בדרך|in transit|departed|left the origin|מרכז מיון|sorting/i],
 ['SHIPPED',/נשלח(?:ה)?|shipped|dispatched|נמסרה לחברת ההובלה|המוכר שלח/i],
 ['PROCESSING',/בהכנה|נארז(?:ה)?|מוכנה למשלוח|processing|packed|המחסן קיבל/i],
 ['ORDERED',/התקבלה|אושרה|הוזמנ|order (?:placed|confirmed|received)|ordered/i],
];
export function statusOf(label:string):Status|null{for(const [s,r] of RULES)if(r.test(label||''))return s;return null;}
const BY_STAGE:Status[]=['ORDERED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED'];
// The parcel's current status: its latest event that says something, else its step.
export function parcelStatus(p:Pick<Parcel,'stage'|'events'|'pickup'>):Status{
 if(p.stage>=4)return 'DELIVERED';
 for(let i=p.events.length-1;i>=0;i--){const s=statusOf(p.events[i].label);if(s&&s!=='DELIVERED')return s;}
 if(p.stage===3)return p.pickup?.place?'READY_FOR_PICKUP':'OUT_FOR_DELIVERY';
 return BY_STAGE[Math.max(0,Math.min(4,p.stage))];}
