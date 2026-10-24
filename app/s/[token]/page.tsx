// Read-only tracking page for someone else: opened from a link, no sign-in. Reloads itself every 5 minutes.
import type {Metadata} from 'next';
import {db,dbOn} from '@/lib/push';
import {ready,alive,type SharedParcel} from '@/lib/share';
import ShareView from '../share-view';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'מעקב חבילות',robots:{index:false,follow:false},referrer:'no-referrer'};
async function load(token:string){
 if(!dbOn()||!/^[A-Za-z0-9_-]{8,40}$/.test(token))return null;
 try{const {sql,ready:r}=db();await r;await ready(sql);const row=(await sql`select title,pickup,data,updated_at,revoked from shares where token=${token}`)[0];
  if(!row||!alive(row as never))return null;return {title:String(row.title||''),parcels:row.data as SharedParcel[]};}catch{return null;}}

export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;const s=await load(token);
 if(!s)return <main className="sp-page"><h1>הלינק כבר לא פעיל</h1><p className="sp-note">החבילות נמסרו, או ששולח הלינק ביטל אותו.</p></main>;
 return <ShareView s={s}/>;}
