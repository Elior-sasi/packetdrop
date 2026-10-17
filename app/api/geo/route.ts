import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
export const dynamic='force-dynamic';
// Address -> coordinates for Moovit and the pickup map (OpenStreetMap Nominatim, Israel only, cached by the browser).
export async function GET(req:NextRequest){
 try{await identity(req,false);}catch{return Response.json({error:'unauthorized'},{status:401});}
 const q=(req.nextUrl.searchParams.get('q')||'').slice(0,200).trim();if(q.length<3)return Response.json({found:false});
 try{const r=await fetch('https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q,format:'json',limit:'1',countrycodes:'il','accept-language':'he'}),{headers:{'User-Agent':'Unbox parcel tracker (packetdrop.vercel.app)'},signal:AbortSignal.timeout(8000)});
  const d=await r.json();const hit=d?.[0];if(!hit)return Response.json({found:false},{headers:{'Cache-Control':'private, max-age=86400'}});
  return Response.json({found:true,lat:+hit.lat,lon:+hit.lon},{headers:{'Cache-Control':'private, max-age=604800'}});}catch{return Response.json({found:false});}}
