import {NextRequest} from 'next/server';
import {neon} from '@neondatabase/serverless';
import {db,dbOn,smsUser} from '@/lib/push';
import {speak} from '@/lib/speak';
import {liveParcels} from '@/lib/live';
export const dynamic='force-dynamic';
// Siri shortcut: plain Hebrew text to read aloud. Same personal link as the widget; the link is the credential.
export async function GET(req:NextRequest){
 const H={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'};
 if(!dbOn())return new Response('השרת של Unbox לא מוגדר כרגע.',{status:503,headers:H});
 const user=smsUser(req.nextUrl.searchParams.get('t')||'','widget');if(!user)return new Response('הקישור לא תקין. העתק אותו מחדש מההגדרות של Unbox.',{status:401,headers:H});
 const {sql,ready}=db();await ready;const row=(await sql`select state,checked_at from push_users where user_id=${user}`)[0];
 if(!row)return new Response('צריך להפעיל התראות ב־Unbox כדי שאוכל לדעת על החבילות שלך.',{headers:H});
 let titles:Record<string,string>={};
 if(process.env.TITLES_DATABASE_URL){try{const rows=await neon(process.env.TITLES_DATABASE_URL)`select parcel_key,title from parcel_titles where user_id=${user}`;titles=Object.fromEntries(rows.map(r=>[r.parcel_key,r.title]));}catch{}}
 const {list,names}=liveParcels(row.state||{});
 // AliExpress's own dates (read on the phone) when there are any.
 try{const ae=await sql`select order_no,eta from ae_eta where user_id=${user} and eta<>'' and at>now()-interval '10 days'`;const m=Object.fromEntries(ae.map(r=>[r.order_no,r.eta as string]));for(const p of list)if(/aliexpress/i.test(p.shop)&&p.order&&m[p.order])p.eta=m[p.order];}catch{}
 return new Response(speak(list,{titles:{...names,...titles},checkedAt:row.checked_at}),{headers:H});}
