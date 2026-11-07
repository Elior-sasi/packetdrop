// iPhone app sign-in, step 1. Google refuses to sign in inside an app's web view, so the app opens this address in
// Apple's secure sign-in sheet (Safari), which signs in to Google as usual and then comes back through /api/native/done.
import {signIn} from '@/auth';
export const dynamic='force-dynamic';
export async function GET(){await signIn('google',{redirectTo:'/api/native/done'});}
