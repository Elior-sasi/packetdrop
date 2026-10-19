// One place that talks to Gemini (Google AI Studio free tier). Google retires model names over time, so it tries
// the "latest flash" alias first and then named models, and keeps whichever answered. Thinking is switched off where
// the model allows it (it would eat the short answer), and dropped from the request if a model rejects the setting.
// Flash-Lite first: on the free tier it has a much larger daily quota, and it is quick with photos.
const MODELS=['gemini-flash-lite-latest','gemini-flash-latest','gemini-3.8-flash','gemini-2.5-flash-lite'];
let good='';
// Free-tier limits are per model: after a 429 that model rests (the retry time Google gives, else a minute) and the next one is tried.
const rest:Record<string,number>={};
export async function gemini(body:{contents:unknown[];generationConfig?:Record<string,unknown>;tools?:unknown[];systemInstruction?:unknown},timeout=25000,prefer?:string[]):Promise<{ok:boolean;status:number;text:string;error:string;tried?:string[]}>{
 const key=process.env.GEMINI_API_KEY;if(!key)return {ok:false,status:0,text:'',error:'no key'};
 let last={ok:false,status:0,text:'',error:''};const tried:string[]=[];
 // Recognising a character from a photo needs the full Flash model (Lite guesses); other jobs start with whatever worked last.
 const list=prefer?[...prefer,...MODELS.filter(m=>!prefer.includes(m))]:good?[good,...MODELS.filter(m=>m!==good)]:MODELS;
 const order=list.filter(m=>!(rest[m]>Date.now()));
 if(!order.length)return {ok:false,status:429,text:'',error:'cooling down',tried:MODELS.map(m=>m+': resting '+Math.ceil(((rest[m]||0)-Date.now())/1000)+'s')};
 for(const model of order){
  for(const thinking of [true,false]){
   const cfg={...(body.generationConfig||{}),...(thinking?{thinkingConfig:{thinkingBudget:0}}:{})};
   try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',signal:AbortSignal.timeout(timeout),headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({...body,generationConfig:cfg})});
    const j=await r.json().catch(()=>({}));const text=String(j?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join('')||'').trim();
    last={ok:r.ok&&!!text,status:r.status,text,error:r.ok?'':String(j?.error?.message||'').slice(0,200)};
    tried.push(model+(thinking?'+t':'')+': '+r.status+' '+last.error.slice(0,90));
    if(last.ok){if(!prefer)good=model;return {...last,tried};}
    if(r.status===429){const sec=Number(String(j?.error?.details?.find?.((d:{retryDelay?:string})=>d.retryDelay)?.retryDelay||'').replace(/s$/,''))||60;rest[model]=Date.now()+Math.min(3600,sec)*1000;break;}
    if(thinking&&r.status===400)continue;   // the thinking setting may be what this model rejects   // try the same model without the thinking setting
    break;                                                        // other errors: next model
   }catch(e){last={ok:false,status:0,text:'',error:String(e).slice(0,120)};tried.push(model+(thinking?'+t':'')+': '+last.error.slice(0,90));break;}}}
 return {...last,tried};}
