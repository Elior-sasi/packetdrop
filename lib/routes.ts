// Google Routes: travel minutes from home to a point (walking / driving / public transport), cached 6 hours in the database.
import type {db} from '@/lib/push';
type Sql=ReturnType<typeof db>['sql'];
export const MODES:Record<string,string>={walk:'WALK',drive:'DRIVE',transit:'TRANSIT'};
export async function travelMinutes(s:Sql,home:string,mode:string,lat:number,lon:number):Promise<number|null>{const gk=process.env.GOOGLE_MAPS_KEY;if(!gk||!home)return null;
 const m=MODES[mode]||'WALK';await s`create table if not exists travel_times(k text primary key,minutes int,at timestamptz not null default now())`;
 const ck=m+'|'+home+'|'+lat.toFixed(5)+','+lon.toFixed(5);const c=(await s`select minutes from travel_times where k=${ck} and at>now()-interval '6 hours'`)[0];if(c)return c.minutes as number|null;
 let min:number|null=null;try{const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':gk,'X-Goog-FieldMask':'routes.duration'},body:JSON.stringify({origin:{address:home},destination:{location:{latLng:{latitude:lat,longitude:lon}}},travelMode:m,languageCode:'he',regionCode:'IL'}),signal:AbortSignal.timeout(9000)});
  const d=(await r.json())?.routes?.[0]?.duration;if(d)min=Math.max(1,Math.round(parseInt(String(d))/60));}catch{}
 await s`insert into travel_times(k,minutes) values(${ck},${min}) on conflict(k) do update set minutes=excluded.minutes,at=now()`;return min;}
// One round from home through every point and back: the best order and the total minutes (public transport is ordered as walking - Google does not order stops for it).
export async function planRound(home:string,mode:string,pts:{lat:number;lon:number}[]):Promise<{order:number[];minutes:number}|null>{const gk=process.env.GOOGLE_MAPS_KEY;if(!gk||!home||pts.length<2)return null;
 const m=mode==='drive'?'DRIVE':'WALK';
 try{const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':gk,'X-Goog-FieldMask':'routes.duration,routes.optimizedIntermediateWaypointIndex'},body:JSON.stringify({origin:{address:home},destination:{address:home},intermediates:pts.map(p=>({location:{latLng:{latitude:p.lat,longitude:p.lon}}})),travelMode:m,optimizeWaypointOrder:true,languageCode:'he',regionCode:'IL'}),signal:AbortSignal.timeout(10000)});
  const rt=(await r.json())?.routes?.[0];if(!rt?.duration)return null;const order=(rt.optimizedIntermediateWaypointIndex as number[]|undefined)?.filter(i=>i>=0)||pts.map((_,i)=>i);
  return {order:order.length===pts.length?order:pts.map((_,i)=>i),minutes:Math.max(1,Math.round(parseInt(String(rt.duration))/60))};}catch{return null;}}
