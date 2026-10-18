import {NextRequest} from 'next/server';
import sharp from 'sharp';
export const runtime='nodejs';
// Store photos often come padded with white bars to make them square. This trims the padding so the photo fills its frame.
// Only product-photo hosts are fetched; anything else is refused.
const HOSTS=/(?:^|\.)(?:aliexpress-media\.com|alicdn\.com|aliexpress\.com|media-amazon\.com|ssl-images-amazon\.com|kspimg\.co\.il|ksp\.co\.il|cdn\.shopify\.com)$/i;
export async function GET(req:NextRequest){
 const raw=req.nextUrl.searchParams.get('u')||'';let u:URL;try{u=new URL(raw);}catch{return new Response('bad',{status:400});}
 if(u.protocol!=='https:'||!HOSTS.test(u.hostname))return new Response('host',{status:403});
 try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});if(!r.ok)return Response.redirect(u.toString(),302);
  const buf=Buffer.from(await r.arrayBuffer());if(buf.length>8_000_000)return Response.redirect(u.toString(),302);
  const out=await sharp(buf).rotate().trim({background:'#ffffff',threshold:18}).resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toBuffer();
  return new Response(new Uint8Array(out),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=2592000, s-maxage=2592000, immutable'}});
 }catch{return Response.redirect(u.toString(),302);}}
