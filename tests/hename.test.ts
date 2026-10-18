import {test} from 'node:test';import assert from 'node:assert/strict';import {heName} from '../lib/hename';
const cases:[string,string][]=[
 ['למארז AirPods 5 (2026) /4/Pro 3','מארז ל־AirPods 5'],
 ['עבור Logitech F710 USB Nano Dongle','דונגל ל־Logitech F710'],
 ['משחקי איבל סט שחמט נייד משחק לוח','סט שחמט נייד'],
 ['שקע חכם WiFi 16A שקע ישראל','שקע חכם WiFi'],
 ["קיץ לגברים בגדי אנימה קז'ואל לילדים חולצ…",'בגדי אנימה לגברים'],
 ['כיסוי אוזניות מגנטי + מכנסי קארגו לגברים קיץ אביב','כיסוי אוזניות מגנטי + מכנסי קארגו לגברים'],
 ['שעון דיגיטלי לגברים NORTH EDGE','שעון דיגיטלי לגברים NORTH EDGE'],
 ['תחפושת איש כריש לווייתן, גיבור ים','תחפושת איש כריש לווייתן'],
 ['אוזניות בלוטות\'','אוזניות בלוטות\''],
 ['Smart watch','Smart watch'],
 ['7 יחידות / מערכת חיתוך עוגיות + כבל טעינה לעכבר Type-C','מערכת חיתוך עוגיות + כבל טעינה לעכבר Type-C'],
];
test('hebrew names',()=>{for(const [a,b] of cases)assert.equal(heName(a),b,a);});
test('trailing catalog number after Hebrew is dropped',()=>{assert.equal(heName('מארז 4 כוסות מאג זכוכית 246'),'מארז 4 כוסות מאג זכוכית');assert.equal(heName('iPhone 15 Pro 256'),'iPhone 15 Pro 256');});
import {tidyName} from '../lib/parcels';
test('AliExpress title fixes',()=>{
 assert.equal(tidyName('אנימה וואן 1 פיס סנג\'י קוספלי...'),'תחפושת One Piece סנג\'י');
 assert.equal(tidyName('חולצת הוואי של פרנקי וואן פיס...'),'חולצת הוואי של פרנקי One Piece');
 assert.equal(tidyName('תחפושת קוספליי של רורונואה זו...'),'תחפושת רורונואה');
 assert.equal(tidyName('פרוק קוספלי מותאם אישית למסיב...'),'פאה');
 assert.equal(tidyName('2187172 דלת מקרר תואמת למקרר ...'),'דלת מקרר');
 assert.equal(tidyName('לווייתן כריש איש ג \'ינב קוספל...'),'תחפושת לווייתן כריש איש ג\'ינב');});
