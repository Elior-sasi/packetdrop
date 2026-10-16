import {NextRequest} from 'next/server';
import {identity} from '@/lib/identity';
import {parseMessage,mergeParcels,type Message} from '@/lib/parcels';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:NextRequest){try{
 const {accessToken}=await identity(req);const cursor=req.nextUrl.searchParams.get('cursor');if(cursor&&cursor.length>2048)return Response.json({error:'סמן סריקה לא תקין'},{status:400});
 const params=new URLSearchParams({maxResults:'30',q:'newer_than:180d {subject:order subject:shipment subject:delivery subject:tracking subject:הזמנה subject:משלוח subject:חבילה subject:איסוף}'});if(cursor)params.set('pageToken',cursor);
 async function gmail(path:string){const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(18000)});if(r.status===401||r.status===403)throw Error('RECONNECT');if(!r.ok)throw Error('GMAIL');return r.json();}
 const list=await gmail('messages?'+params);const messages:Message[]=[];
 // Bound concurrency, don't fail the entire scan silently if one request fails.
 for(let i=0;i<(list.messages||[]).length;i+=6){messages.push(...await Promise.all(list.messages.slice(i,i+6).map((m:{id:string})=>gmail('messages/'+encodeURIComponent(m.id)+'?format=full'))));}
 const parcels=mergeParcels(messages.map(parseMessage).filter((p):p is NonNullable<typeof p>=>!!p));
 return Response.json({parcels,nextCursor:list.nextPageToken,scanned:messages.length,updated:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const code=e instanceof Error?e.message:'';return Response.json({error:code==='UNAUTHORIZED'?'יש להיכנס עם Google':code==='RECONNECT'?'יש לחדש את ההרשאה ל־Gmail':'הסריקה לא הושלמה. נסה שוב.',code},{status:code==='UNAUTHORIZED'?401:code==='RECONNECT'?403:502,headers:{'Cache-Control':'no-store'}});}}
