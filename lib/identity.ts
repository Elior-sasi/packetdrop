import {getToken} from 'next-auth/jwt';
import type {NextRequest} from 'next/server';
import {GOOGLE_CLIENT_ID} from '@/lib/google';
export async function identity(req:NextRequest,needGmail=true){
 const token=await getToken({req,secret:process.env.AUTH_SECRET,secureCookie:req.nextUrl.protocol==='https:'});
 if(!token?.googleId||!token.accessToken)throw new Error('UNAUTHORIZED');
 if(token.scope!==undefined&&!String(token.scope).includes('gmail.readonly')){if(needGmail)throw new Error('NO_GMAIL');}
 if(!needGmail)return {id:String(token.googleId),accessToken:''};
 let accessToken=String(token.accessToken);
 if(Number(token.expiresAt||0)*1000<Date.now()+30000){
  if(!token.refreshToken)throw new Error('RECONNECT');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_CLIENT_ID,client_secret:process.env.AUTH_GOOGLE_SECRET!,grant_type:'refresh_token',refresh_token:String(token.refreshToken)}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('RECONNECT');const d=await r.json();accessToken=d.access_token;
 }
 return {id:String(token.googleId),accessToken};
}
