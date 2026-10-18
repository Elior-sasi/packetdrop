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
  // The product is cut out of its white padding, then set in the middle of a frame of the shape it is shown in
  // ("w": the detail photo, 5:4; "sq": the card thumbnail), with the same small white margin on every side.
  const [W,H]=req.nextUrl.searchParams.get('f')==='sq'?[600,600]:[1000,800];const m=0.06;
  let img=sharp(buf).rotate();try{img=sharp(await img.trim({background:'#ffffff',threshold:18}).toBuffer());}catch{}
  const inner=await img.resize({width:Math.round(W*(1-2*m)),height:Math.round(H*(1-2*m)),fit:'inside'}).toBuffer();const meta=await sharp(inner).metadata();
  const left=Math.round((W-(meta.width||0))/2),top=Math.round((H-(meta.height||0))/2);
  const out=await sharp(inner).extend({left,right:W-(meta.width||0)-left,top,bottom:H-(meta.height||0)-top,background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:84,mozjpeg:true}).toBuffer();
  return new Response(new Uint8Array(out),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=2592000, s-maxage=2592000, immutable'}});
 }catch{return Response.redirect(u.toString(),302);}}
