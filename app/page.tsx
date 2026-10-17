import {auth,signIn} from '@/auth';
import Dashboard from './ui';
export const dynamic='force-dynamic';
export default async function Page(){const configured=!!(process.env.AUTH_GOOGLE_SECRET&&process.env.AUTH_SECRET);const session=configured?await auth():null;
 return <Dashboard gmail={!!(session as {gmail?:boolean}|null)?.gmail} user={session?.user?{id:session.user.id||'',name:session.user.name||'',email:session.user.email||''}:null} configured={configured} login={async()=>{'use server';await signIn('google',{redirectTo:'/'});}}/>;
}
