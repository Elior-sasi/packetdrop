// Backup file in Google Drive's hidden appDataFolder: only this app can see it, it does not appear in the user's Drive files.
const NAME='packetdrop-backup.json';
export type Backup={version:1;updated:string;titles:Record<string,string>;parcels:unknown[];seen?:string[]};
const empty=():Backup=>({version:1,updated:'',titles:{},parcels:[]});
async function api(token:string,url:string,init:RequestInit={}){const r=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...(init.headers||{})},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(r.status===401)throw new Error('RECONNECT');
 if(r.status===403){const t=await r.text().catch(()=>'');throw new Error(/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(t)?'DRIVE_API_DISABLED':/insufficient/i.test(t)?'NO_DRIVE':'DRIVE');}
 if(!r.ok)throw new Error('DRIVE');return r;}
async function findId(token:string){const q=new URLSearchParams({spaces:'appDataFolder',q:"name='"+NAME+"' and trashed=false",fields:'files(id)',pageSize:'1'});const d=await (await api(token,'https://www.googleapis.com/drive/v3/files?'+q)).json();return (d.files?.[0]?.id as string)||'';}
export async function readBackup(token:string):Promise<Backup>{const id=await findId(token);if(!id)return empty();const d=await (await api(token,'https://www.googleapis.com/drive/v3/files/'+id+'?alt=media')).json().catch(()=>null);return d&&d.version===1?{...empty(),...d}:empty();}
export async function writeBackup(token:string,b:Backup){
 const id=await findId(token);const boundary='pd'+Math.random().toString(36).slice(2);
 const meta=id?{}:{name:NAME,parents:['appDataFolder'],mimeType:'application/json'};
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(b)+'\r\n--'+boundary+'--';
 await api(token,'https://www.googleapis.com/upload/drive/v3/files'+(id?'/'+id:'')+'?uploadType=multipart',{method:id?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
}
