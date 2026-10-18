import * as cheerio from 'cheerio';
export const dynamic='force-dynamic';
// Temporary: shows how the Tapuz (Baldar) status page is built, so automatic tracking can be wired to it. No user data involved.
export async function GET(){
 const url='https://crm.tapuzdelivery.co.il/Baldar/deliverystatus.aspx';
 try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},signal:AbortSignal.timeout(15000)});const html=await r.text();const $=cheerio.load(html);
  const forms=$('form').toArray().map(f=>({action:$(f).attr('action'),method:$(f).attr('method'),id:$(f).attr('id')}));
  const inputs=$('input,select,textarea,button').toArray().map(i=>({tag:i.tagName,name:$(i).attr('name'),id:$(i).attr('id'),type:$(i).attr('type'),value:($(i).attr('value')||'').length>60?'['+($(i).attr('value')||'').length+' chars]':$(i).attr('value'),onclick:$(i).attr('onclick')}));
  const scripts=$('script[src]').toArray().map(s=>$(s).attr('src'));
  const inline=$('script:not([src])').toArray().map(s=>$(s).html()||'').filter(t=>/ajax|url\s*:|asmx|ashx|PageMethods|WebMethod|\.aspx\/|__doPostBack|function/i.test(t)).map(t=>t.replace(/\s+/g,' ').slice(0,2500));
  return new Response(JSON.stringify({status:r.status,length:html.length,forms,inputs,scripts,inline},null,1),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:String(e)});}}
