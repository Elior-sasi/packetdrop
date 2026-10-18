// The parcels the phone widget and Siri should talk about. The app itself decides what counts as "on the way"
// (couriers paired with orders, silent parcels treated as received, hidden ones); it sends that list as `view`,
// and the server copy is filtered by it so all three always agree. Parcels newer than that list still show up.
import type {Parcel} from '@/lib/parcels';
export type View={at:string;active:{keys:string[];name:string;when?:number}[]};
export function liveParcels(state:{parcels?:Parcel[];marks?:Record<string,string>;view?:View},now=Date.now()):{list:Parcel[];names:Record<string,string>;when:Record<string,number>}{
 const marks=state.marks||{};const view=state.view;const names:Record<string,string>={};const when:Record<string,number>={};
 const base=(state.parcels||[]).filter(p=>!p.cancelled&&p.stage<4&&!marks[p.id]&&!p.keys.some(k=>marks[k])&&now-new Date(p.events.at(-1)?.time||0).getTime()<30*864e5);
 if(!view?.active)return {list:base,names,when};
 const since=new Date(view.at).getTime();const used=new Set<number>();
 const list=base.filter(p=>{const i=view.active.findIndex(v=>v.keys.some(k=>p.keys.includes(k)));
  if(i>=0){if(used.has(i))return false;used.add(i);names[p.id]=view.active[i].name;if(view.active[i].when)when[p.id]=view.active[i].when!;return true;}
  return new Date(p.events[0]?.time||0).getTime()>since;});
 return {list,names,when};}
