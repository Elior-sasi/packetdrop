import {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
// Temporary: checks whether K Express finds a shipment by the store's order number + phone. Shows only that shipment's public status.
export async function GET(req:NextRequest){
 const n=req.nextUrl.searchParams.get('kx')||'',ph=(req.nextUrl.searchParams.get('ph')||'').replace(/\D/g,'');
 if(!/^\d{5,14}$/.test(n)||!/^0\d{8,9}$/.test(ph))return Response.json({error:'bad'});
 const base='https://run10.kexpress.co.il/RunCom.Server/Request.aspx?';
 try{const a=await fetch(base+'APPNAME=RUN&PRGNAME=ship_locate_num_and_phone&ARGUMENTS=-N'+n+',-A'+ph,{signal:AbortSignal.timeout(12000)});
  const xml=new TextDecoder('windows-1255').decode(await a.arrayBuffer());const rand=xml.match(/<ship_rand_num>\s*([^<\s]+)/i)?.[1];
  let page='';if(rand){const b=await fetch(base+'APPNAME=run&PRGNAME=ship_locate_random&ARGUMENTS=-A'+encodeURIComponent(rand),{signal:AbortSignal.timeout(12000)});
   page=new TextDecoder('windows-1255').decode(await b.arrayBuffer()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' | ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').replace(/(\s\|\s)+/g,' | ').slice(0,3000);}
  return Response.json({status:a.status,xml:xml.slice(0,800),page},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:String(e)});}}
