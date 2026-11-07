// iPhone app sign-in, step 3 (inside the app): the one-time code becomes the app's own session cookie, then the app opens.
import {NextRequest} from 'next/server';
import {db,dbOn} from '@/lib/push';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const home=new URL('/',req.nextUrl.origin);const code=req.nextUrl.searchParams.get('code')||'';
 if(!dbOn()||!/^[A-Za-z0-9_-]{20,64}$/.test(code))return Response.redirect(home,302);
 const {sql,ready}=db();await ready;
 const row=(await sql`delete from native_codes where code=${code} and at>now()-interval '2 minutes' returning cookies`)[0];
 const res=new Response(null,{status:302,headers:{Location:home.href,'Cache-Control':'no-store'}});
 for(const c of (row?.cookies||[]) as {name:string;value:string}[])
  res.headers.append('Set-Cookie',`${c.name}=${c.value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*3600}`);
 return res;}
