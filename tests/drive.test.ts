import {test} from 'node:test';import assert from 'node:assert/strict';import {readBackup,writeBackup} from '../lib/drive';
test('creates the backup file in appDataFolder, then updates the same file',async()=>{
 const calls:{url:string;method:string;body?:string}[]=[];let stored='';let created=false;
 globalThis.fetch=(async(url:string,init:RequestInit={})=>{calls.push({url,method:init.method||'GET',body:init.body as string});
  if(url.includes('alt=media'))return new Response(stored);
  if(url.includes('/upload/')){created=true;stored=String(init.body).split('\r\n\r\n')[2].split('\r\n--')[0];return new Response('{}');}
  if(url.includes('/drive/v3/files?'))return new Response(JSON.stringify({files:created?[{id:'F1'}]:[]}));
  return new Response('',{status:404});}) as typeof fetch;
 assert.deepEqual((await readBackup('t')).parcels,[]);
 await writeBackup('t',{version:1,updated:'x',titles:{'order:1':'שעון'},parcels:[{id:'order:1'}]});
 const post=calls.find(c=>c.url.includes('/upload/'))!;assert.equal(post.method,'POST');assert.match(post.body!,/"parents":\["appDataFolder"\]/);
 assert.equal((await readBackup('t')).titles['order:1'],'שעון');
 await writeBackup('t',{version:1,updated:'y',titles:{},parcels:[]});
 assert.equal(calls.filter(c=>c.url.includes('/upload/')).at(-1)!.method,'PATCH');assert.match(calls.filter(c=>c.url.includes('/upload/')).at(-1)!.url,/files\/F1\?/);});
