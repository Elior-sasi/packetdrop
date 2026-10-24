// Tracking links for someone else ("2 חבילות לרועי"): a read-only page with no sign-in.
// Only what the recipient needs is kept: name, photo, step, date estimate, last update - never the store, price, mail or tracking numbers.
// The pickup point and code are included only when the user says the recipient collects it.
import {z} from 'zod';
import type {Parcel} from './parcels';
import type {db} from './push';
type Sql=ReturnType<typeof db>['sql'];

export const SharedParcel=z.object({
 k:z.array(z.string().max(250)).max(12),
 name:z.string().max(200),
 image:z.string().max(1000).optional(),
 stage:z.number().int().min(0).max(4),
 status:z.string().max(80),
 eta:z.string().max(40).optional(),
 at:z.string().max(40),
 pickup:z.object({place:z.string().max(120),address:z.string().max(200).optional(),code:z.string().max(20).optional(),hours:z.string().max(120).optional()}).optional(),
});
export type SharedParcel=z.infer<typeof SharedParcel>;
export type Share={token:string;title:string;pickup:boolean;parcels:SharedParcel[];updated:string};

export async function ready(sql:Sql){
 await sql`create table if not exists shares(token text primary key,user_id text not null,title text not null default '',pickup boolean not null default false,data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revoked boolean not null default false)`;
}
const STAGE=['ההזמנה התקבלה','נשלחה','בדרך','במסירה','נמסרה'];
// A link stays open while something is on its way, and for 3 days after the last parcel arrived.
export function alive(s:{revoked:boolean;data:SharedParcel[];updated_at:string|Date}){
 if(s.revoked)return false;if(s.data.some(p=>p.stage<4))return true;
 return Date.now()-new Date(s.updated_at).getTime()<3*864e5;}

// The background check refreshes the step, date and pickup of each shared parcel from the server's own reading (names stay as the user saw them).
export async function refreshShares(sql:Sql,userId:string,parcels:Parcel[]){
 try{await ready(sql);const rows=await sql`select token,pickup,data from shares where user_id=${userId} and revoked=false`;
  for(const r of rows){const data=r.data as SharedParcel[];let changed=false;
   const next=data.map(s=>{const p=parcels.find(x=>x.keys.some(k=>s.k.includes(k)));if(!p)return s;
    const at=p.events.at(-1)?.time||s.at;if(p.stage<s.stage||(p.stage===s.stage&&at<=s.at&&(p.eta||'')===(s.eta||'')))return s;
    changed=true;const pk=r.pickup&&p.pickup&&(p.pickup.place||p.pickup.address)?{place:p.pickup.place||'',address:p.pickup.address||undefined,code:p.pickup.code||undefined,hours:p.pickup.hours||undefined}:undefined;
    return {...s,stage:p.stage,status:p.stage===3&&pk?'מחכה לאיסוף':STAGE[p.stage],eta:p.stage>=4?undefined:p.eta||s.eta,at,...(pk?{pickup:pk}:{})};});
   if(changed)await sql`update shares set data=${JSON.stringify(next)},updated_at=now() where token=${r.token}`;}}catch{}}
