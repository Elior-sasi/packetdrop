import {NextRequest} from 'next/server';import {z} from 'zod';import {driveIdentity} from '@/lib/identity';import {readBackup,writeBackup} from '@/lib/drive';
export const dynamic='force-dynamic';
const ERR:Record<string,[number,string]>={UNAUTHORIZED:[401,'יש להיכנס עם Google'],NO_DRIVE:[403,'הגיבוי בענן עדיין לא הופעל'],RECONNECT:[403,'יש לחדש את הרשאת Google'],DRIVE_API_DISABLED:[503,'Google Drive API כבויה בפרויקט'],DRIVE:[502,'הגיבוי לא זמין כרגע']};
const fail=(e:unknown)=>{const c=e instanceof Error&&ERR[e.message]?e.message:'DRIVE';const [s,m]=ERR[c];return Response.json({error:m,code:c},{status:s,headers:{'Cache-Control':'no-store'}});};
const schema=z.object({titles:z.record(z.string().max(250),z.string().max(180)).optional(),parcels:z.array(z.unknown()).max(400).optional(),seen:z.array(z.string().max(40)).max(5000).optional(),parser:z.number().int().optional(),marks:z.record(z.string().max(250),z.enum(['got','hide'])).optional(),manual:z.array(z.unknown()).max(100).optional(),others:z.array(z.string().max(250)).max(500).optional()});
export async function GET(req:NextRequest){try{const {accessToken}=await driveIdentity(req);return Response.json(await readBackup(accessToken),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return fail(e);}}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 try{const {accessToken}=await driveIdentity(req);const body=schema.parse(await req.json());const old=await readBackup(accessToken);
  const titles={...old.titles,...(body.titles||{})};for(const k of Object.keys(titles))if(!titles[k])delete titles[k];
  const next={version:1 as const,updated:new Date().toISOString(),titles,parcels:body.parcels??old.parcels,seen:body.seen??old.seen??[],parser:body.parser??old.parser,marks:body.marks??old.marks??{},manual:body.manual??old.manual??[],others:body.others??(old as {others?:string[]}).others??[]};
  await writeBackup(accessToken,next);return Response.json({updated:next.updated},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
