import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
export const {handlers,auth,signIn,signOut}=NextAuth({
  providers:[Google({authorization:{params:{scope:'openid email profile https://www.googleapis.com/auth/gmail.readonly',access_type:'offline',prompt:'consent'}}})],
  session:{strategy:'jwt',maxAge:30*24*60*60},
  callbacks:{
    async jwt({token,account,profile}){if(account){token.accessToken=account.access_token;token.refreshToken=account.refresh_token;token.expiresAt=account.expires_at;token.googleId=profile?.sub;}return token;},
    async session({session,token}){if(session.user)session.user.id=String(token.googleId||token.sub);return session;}
  }
});
