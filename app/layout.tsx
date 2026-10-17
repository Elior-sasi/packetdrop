import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Unbox',description:'החבילות שלך, במקום אחד',applicationName:'Unbox',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Unbox',statusBarStyle:'black-translucent'},icons:{icon:'/unbox-192.png',apple:[{url:'/unbox-180.png',sizes:'180x180',type:'image/png'}]}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#0a0f14'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body>{children}</body></html>}
