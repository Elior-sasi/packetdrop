// iPhone app sign-in, step 2 (still in the sign-in sheet): the new session is handed to the app through a one-time code
// that lives for 2 minutes; the session itself never appears in the address.
import {NextRequest} from 'next/server';
import {randomBytes} from 'node:crypto';
import {db,dbOn} from '@/lib/push';
export const dynamic='force-dynamic';
const SESSION=/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;
export async function GET(req:NextRequest){
 const back=(q:string)=>new Response(null,{status:302,headers:{Location:'unbox://auth?'+q,'Cache-Control':'no-store'}});
 const cookies=req.cookies.getAll().filter(c=>SESSION.test(c.name)).map(c=>({name:c.name,value:c.value}));
 if(!cookies.length||!dbOn())return back('error=1');
 const {sql,ready}=db();await ready;
 await sql`create table if not exists native_codes(code text primary key,cookies jsonb not null,at timestamptz not null default now())`;
 await sql`delete from native_codes where at<now()-interval '10 minutes'`;
 const code=randomBytes(24).toString('base64url');
 await sql`insert into native_codes(code,cookies) values(${code},${JSON.stringify(cookies)})`;
 return back('code='+code);}
