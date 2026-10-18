// Web Push for Unbox. All keys are derived from AUTH_SECRET on the server, so no extra secret has to be configured.
import {createECDH,createCipheriv,createDecipheriv,hkdfSync,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
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
const DB_URL=()=>process.env.DATABASE_URL||process.env.STORAGE_URL||process.env.POSTGRES_URL||'';
export const dbOn=()=>!!DB_URL();
let ready:Promise<unknown>|null=null;
export function db(){const sql=neon(DB_URL());
 ready??=sql`create table if not exists push_users(
  user_id text primary key,email text not null default '',refresh text not null,subs jsonb not null default '[]',
  state jsonb not null default '{"parcels":[],"stuck":[]}',seen jsonb not null default '[]',
  checked_at timestamptz,updated_at timestamptz not null default now())`.then(()=>sql`create table if not exists push_meta(k text primary key,v timestamptz not null)`).then(()=>sql`create table if not exists sms_inbox(id bigserial primary key,user_id text not null,text text not null,created_at timestamptz not null default now())`);
 return {sql,ready};}

// Personal link for the iPhone Shortcut that forwards delivery SMS: user id + signature, nothing stored.
export function smsToken(userId:string,label='sms-link'){return b64u(Buffer.from(userId))+'.'+b64u(createHmac('sha256',derive(label)).update(userId).digest()).slice(0,22);}
export function smsUser(token:string,label='sms-link'){const [a,sig]=token.split('.');if(!a||!sig)return null;let id='';try{id=Buffer.from(a,'base64url').toString('utf8');}catch{return null;}
 const want=smsToken(id,label).split('.')[1];return want.length===sig.length&&timingSafeEqual(Buffer.from(want),Buffer.from(sig))?id:null;}
