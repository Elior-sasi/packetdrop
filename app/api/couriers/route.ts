import {NextRequest} from 'next/server';import {z} from 'zod';import {identity} from '@/lib/identity';import {baldarByPhone} from '@/lib/tapuz';
export const dynamic='force-dynamic';export const maxDuration=30;
// Deliveries the user's couriers (Baldar system) have for their phone number. Sent only when the user saved the number in settings.
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 try{await identity(req,false);}catch{return Response.json({error:'יש להיכנס עם Google'},{status:401});}
 try{const {phone}=z.object({phone:z.string().max(20)}).parse(await req.json());return Response.json({parcels:await baldarByPhone(phone)},{headers:{'Cache-Control':'private, no-store'}});}
 catch{return Response.json({parcels:[]},{status:400});}}
