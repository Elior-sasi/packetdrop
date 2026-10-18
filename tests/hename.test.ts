import {test} from 'node:test';import assert from 'node:assert/strict';import {heName} from '../lib/hename';
const cases:[string,string][]=[
 ['למארז AirPods 5 (2026) /4/Pro 3','מארז ל־AirPods 5'],
 ['עבור Logitech F710 USB Nano Dongle','דונגל ל־Logitech F710'],
 ['משחקי איבל סט שחמט נייד משחק לוח','סט שחמט נייד'],
 ['שקע חכם WiFi 16A שקע ישראל','שקע חכם WiFi'],
 ["קיץ לגברים בגדי אנימה קז'ואל לילדים חולצ…",'בגדי אנימה לגברים'],
 ['כיסוי אוזניות מגנטי + מכנסי קארגו לגברים קיץ אביב','כיסוי אוזניות מגנטי + מכנסי קארגו לגברים'],
 ['שעון דיגיטלי לגברים NORTH EDGE','שעון דיגיטלי לגברים NORTH EDGE'],
 ['תחפושת איש כריש לווייתן, גיבור ים','תחפושת איש כריש לווייתן, גיבור ים'],
 ['אוזניות בלוטות\'','אוזניות בלוטות\''],
 ['Smart watch','Smart watch'],
 ['7 יחידות / מערכת חיתוך עוגיות + כבל טעינה לעכבר Type-C','מערכת חיתוך עוגיות + כבל טעינה לעכבר Type-C'],
];
test('hebrew names',()=>{for(const [a,b] of cases)assert.equal(heName(a),b,a);});
