import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import {GOOGLE_CLIENT_ID} from '@/lib/google';
// Production always signs in on the main address, whatever AUTH_URL says in Vercel (the old value pointed at the alias).
if(process.env.VERCEL_ENV==='production')process.env.AUTH_URL='https://packetdrop.vercel.app';
export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
export const {handlers,auth,signIn,signOut}=NextAuth({
  providers:[Google({clientId:GOOGLE_CLIENT_ID,clientSecret:process.env.AUTH_GOOGLE_SECRET,authorization:{params:{scope:'openid email profile '+GMAIL_SCOPE+' '+DRIVE_SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'true'}}})],
  session:{strategy:'jwt',maxAge:30*24*60*60},
  callbacks:{
    async jwt({token,account,profile}){if(account){token.accessToken=account.access_token;token.refreshToken=account.refresh_token||token.refreshToken;token.expiresAt=account.expires_at;token.googleId=profile?.sub;token.scope=account.scope||'';}return token;},
    // Google lets the user untick the Gmail box on the consent screen, so sign-in alone does not mean mail access.
    async session({session,token}){if(session.user){session.user.id=String(token.googleId||token.sub);(session as {gmail?:boolean}).gmail=String(token.scope||'').includes(GMAIL_SCOPE);(session as {drive?:boolean}).drive=String(token.scope||'').includes(DRIVE_SCOPE);}return session;}
  }
});
