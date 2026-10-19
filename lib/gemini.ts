// One place that talks to Gemini (Google AI Studio free tier). Google retires model names over time, so it tries
// the "latest flash" alias first and then named models, and keeps whichever answered. Thinking is switched off where
// the model allows it (it would eat the short answer), and dropped from the request if a model rejects the setting.
const MODELS=['gemini-flash-latest','gemini-3.8-flash','gemini-2.5-flash'];
let good='';
export async function gemini(body:{contents:unknown[];generationConfig?:Record<string,unknown>},timeout=25000):Promise<{ok:boolean;status:number;text:string;error:string}>{
 const key=process.env.GEMINI_API_KEY;if(!key)return {ok:false,status:0,text:'',error:'no key'};
 let last={ok:false,status:0,text:'',error:''};
 for(const model of good?[good,...MODELS.filter(m=>m!==good)]:MODELS){
  for(const thinking of [true,false]){
   const cfg={...(body.generationConfig||{}),...(thinking?{thinkingConfig:{thinkingBudget:0}}:{})};
   try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',signal:AbortSignal.timeout(timeout),headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({...body,generationConfig:cfg})});
    const j=await r.json().catch(()=>({}));const text=String(j?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join('')||'').trim();
    last={ok:r.ok&&!!text,status:r.status,text,error:r.ok?'':String(j?.error?.message||'').slice(0,200)};
    if(last.ok){good=model;return last;}
    if(r.status===400&&/thinking/i.test(last.error))continue;   // try the same model without the thinking setting
    break;                                                        // other errors: next model
   }catch(e){last={ok:false,status:0,text:'',error:String(e).slice(0,120)};break;}}}
 return last;}
