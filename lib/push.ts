// Web Push for Unbox. All keys are derived from AUTH_SECRET on the server, so no extra secret has to be configured.
import {createECDH,createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import webpush from 'web-push';
import {neon} from '@neondatabase/serverless';
const b64u=(b:Buffer)=>b.toString('base64url');
function derive(label:string){const s=process.env.AUTH_SECRET;if(!s)throw new Error('NO_SECRET');return Buffer.from(hkdfSync('sha256',s,'unbox',label,32));}
export function vapid(){const priv=derive('vapid-p256');const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(priv);return {publicKey:b64u(ecdh.getPublicKey()),privateKey:b64u(priv)};}
// Google refresh tokens are stored encrypted (AES-256-GCM); the database alone cannot read Gmail.
export function seal(text:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',derive('refresh-token'),iv);const out=Buffer.concat([c.update(text,'utf8'),c.final()]);return b64u(Buffer.concat([iv,c.getAuthTag(),out]));}
export function open(sealed:string){const b=Buffer.from(sealed,'base64url');const d=createDecipheriv('aes-256-gcm',derive('refresh-token'),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
export type Sub={endpoint:string;keys:{p256dh:string;auth:string}};
export async function send(sub:Sub,payload:object){const k=vapid();
 try{await webpush.sendNotification(sub,JSON.stringify(payload),{vapidDetails:{subject:'https://packetdrop.vercel.app/privacy',publicKey:k.publicKey,privateKey:k.privateKey},TTL:86400,urgency:'high'});return true;}
 catch(e){const code=(e as {statusCode?:number}).statusCode;if(code===404||code===410)return false;throw e;}}
export const dbOn=()=>!!process.env.DATABASE_URL;
let ready:Promise<unknown>|null=null;
export function db(){const sql=neon(process.env.DATABASE_URL!);
 ready??=sql`create table if not exists push_users(
  user_id text primary key,email text not null default '',refresh text not null,subs jsonb not null default '[]',
  state jsonb not null default '{"parcels":[],"stuck":[]}',seen jsonb not null default '[]',
  checked_at timestamptz,updated_at timestamptz not null default now())`.then(()=>sql`create table if not exists push_meta(k text primary key,v timestamptz not null)`);
 return {sql,ready};}
