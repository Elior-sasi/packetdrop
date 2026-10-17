import {NextRequest} from 'next/server';
import {z} from 'zod';
import {identity} from '@/lib/identity';
import {QUERY,GmailError,gmailClient} from '@/lib/gmail';
import {parseMessage,mergeParcels,type Message} from '@/lib/parcels';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function client(req:NextRequest){const {accessToken}=await identity(req);return gmailClient(accessToken);}
// Step 1 (fast): just the message IDs for the whole window. The browser then skips mail it already read.
export async function GET(req:NextRequest){try{
 const gmail=await client(req);const since=req.nextUrl.searchParams.get('since');const window=since&&/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(since)?'after:'+since:'newer_than:180d';
 const ids:string[]=[];let token='';
 for(let page=0;page<10;page++){const params=new URLSearchParams({maxResults:'500',q:window+' '+QUERY,fields:'messages/id,nextPageToken'});if(token)params.set('pageToken',token);const list=await gmail('messages?'+params);for(const m of list.messages||[])ids.push(m.id);token=list.nextPageToken||'';if(!token)break;}
 return Response.json({ids,updated:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e);}}
const body=z.object({ids:z.array(z.string().regex(/^[a-zA-Z0-9]{6,40}$/)).min(1).max(40)});
// Step 2: read a batch of messages in full and extract parcels. The browser runs a few of these in parallel.
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return Response.json({error:'בקשה לא מורשית'},{status:403});
 try{const gmail=await client(req);const {ids}=body.parse(await req.json());const messages:Message[]=[];const failed:string[]=[];
  for(let i=0;i<ids.length;i+=6){const chunk=ids.slice(i,i+6);const got=await Promise.allSettled(chunk.map(id=>gmail('messages/'+encodeURIComponent(id)+'?format=full')));got.forEach((g,j)=>{if(g.status==='fulfilled')messages.push(g.value);else{if(g.reason instanceof GmailError&&!['GMAIL','RATE'].includes(g.reason.message))throw g.reason;failed.push(chunk[j]);}});}
  const parcels=mergeParcels(messages.map(parseMessage).filter((p):p is NonNullable<typeof p>=>!!p));
  return Response.json({parcels,read:messages.map(m=>m.id),failed},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e);}}
function fail(e:unknown){try{throw e;}catch(e){const code=e instanceof Error?e.message:'';
  if(!(e instanceof GmailError))console.error('parcels route error',e instanceof Error?e.name+': '+e.message:e);

  const messages:Record<string,string>={
   UNAUTHORIZED:'יש להיכנס עם Google',
   NO_GMAIL:'נכנסת עם Google, אבל לא אישרת קריאת Gmail. לחץ "חידוש הרשאת Google" וסמן את תיבת Gmail.',
   RECONNECT:'ההרשאה ל־Gmail פגה. לחץ "חידוש הרשאת Google".',
   GMAIL_API_DISABLED:'Gmail API כבויה בפרויקט Google Cloud. יש להפעיל אותה ולנסות שוב.',
   RATE:'Google הגבילה זמנית את הסריקה. נסה שוב בעוד דקה.'};
  const status=code==='UNAUTHORIZED'?401:code==='NO_GMAIL'||code==='RECONNECT'||code==='GMAIL_API_DISABLED'?403:code==='RATE'?429:502;
  return Response.json({error:messages[code]||'הסריקה לא הושלמה. נסה שוב.',code},{status,headers:{'Cache-Control':'no-store'}});}}
