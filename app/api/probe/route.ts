import {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
// Temporary: shows how courier tracking pages are built (HFD, K Express). No user data involved.
const PAGES:Record<string,string>={hfd:'https://run.hfd.co.il/run_public/pub_random_form.htm',kex:'https://run10.kexpress.co.il/RunCom.Server/www/pub/pub_random_form.htm'};
export async function GET(req:NextRequest){
 const url=PAGES[req.nextUrl.searchParams.get('p')||'hfd'];if(!url)return Response.json({error:'unknown'});
 const get=async(u:string)=>{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},signal:AbortSignal.timeout(15000)});return {status:r.status,ct:r.headers.get('content-type'),text:await r.text()};};
 try{const page=await get(url);const html=page.text;
  const srcs=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],url).href);
  const own=srcs.filter(s=>!/jquery|bootstrap|angular\.min|polyfill/i.test(s)).slice(0,4);
  const js:Record<string,string>={};for(const s of own){try{const t=(await get(s)).text;const hits=[...t.matchAll(/.{0,160}(?:ajax|\$\.post|\$\.get|fetch\(|XMLHttpRequest|\.asmx|\.ashx|\.aspx|RunCom|pub_|\.php|servlet|\?ARGUMENTS|-N)\S*.{0,200}/gi)].map(m=>m[0]).slice(0,12);js[s]=hits.join('\n---\n').slice(0,4000);}catch(e){js[s]='ERR '+String(e);}}
  return new Response(JSON.stringify({status:page.status,ct:page.ct,length:html.length,html:html.replace(/\s+/g,' ').slice(0,6000),srcs,js},null,1),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:String(e)});}}
