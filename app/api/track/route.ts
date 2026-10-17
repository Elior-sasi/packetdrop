import {NextRequest} from 'next/server';import {z} from 'zod';import {identity} from '@/lib/identity';import {trackSources} from '@/lib/track';
export const dynamic='force-dynamic';export const maxDuration=30;
const schema=z.object({numbers:z.array(z.string().max(40)).max(40)});
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 const key=process.env.TRACK17_KEY;
 try{await identity(req,false);}catch{return Response.json({error:'יש להיכנס עם Google'},{status:401});}
 try{const {numbers}=schema.parse(await req.json());const {tracks,sources}=await trackSources(numbers,key);return Response.json({enabled:true,tracks,sources},{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){const m=e instanceof Error?e.message:'';return Response.json({enabled:true,tracks:{},error:m.includes('401')||m.includes('403')?'מפתח 17TRACK לא תקין':'חברות השילוח לא ענו כרגע'},{status:502,headers:{'Cache-Control':'no-store'}});}}
