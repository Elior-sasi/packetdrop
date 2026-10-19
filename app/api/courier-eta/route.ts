import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {courierEta,COURIER_HOST,pageText} from '@/lib/courier';
export const runtime='nodejs';export const maxDuration=30;
// Delivery day from the courier's own tracking page (links from their mail/SMS). Only HFD and Cheetah pages are fetched.
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const b=await req.json().catch(()=>({}));const links=((b.links||[]) as unknown[]).filter((x):x is string=>typeof x==='string'&&COURIER_HOST.test(x)).slice(0,6);
 const out:Record<string,string>={};const raw:Record<string,string>={};
 await Promise.all(links.map(async l=>{try{const r=await fetch(l,{headers:{'User-Agent':UA,'Accept-Language':'he-IL,he'},redirect:'follow',signal:AbortSignal.timeout(12000),cache:'no-store'});if(!r.ok)return;
  const buf=await r.arrayBuffer();const ct=r.headers.get('content-type')||'';const html=new TextDecoder(/1255/.test(ct)?'windows-1255':'utf-8').decode(buf);
  const text=pageText(html);out[l]=courierEta(text);if(b.debug)raw[l]=text.split('\n').map(x=>x.trim()).filter(x=>/\d/.test(x)).slice(0,60).join('\n');}catch{}}));
 return Response.json({etas:out,...(b.debug?{raw}:{})},{headers:H});}
