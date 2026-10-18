import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {db,dbOn} from '@/lib/push';
import {shortNames} from '@/lib/names';
export const runtime='nodejs';
// Short Hebrew product names from long machine-translated store titles (see lib/names).
export async function POST(req:NextRequest){const H={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'forbidden'},{status:403,headers:H});
 if(!process.env.GEMINI_API_KEY)return Response.json({names:{},enabled:false},{headers:H});
 try{await identity(req,false);}catch{return Response.json({error:'auth'},{status:401,headers:H});}
 const body=await req.json().catch(()=>({}));const titles=((body.titles||[]) as unknown[]).filter((t):t is string=>typeof t==='string');
 let sql:ReturnType<typeof db>['sql']|null=null;if(dbOn()){const d=db();await d.ready;sql=d.sql;}
 return Response.json({names:await shortNames(titles,sql),enabled:true},{headers:H});}
