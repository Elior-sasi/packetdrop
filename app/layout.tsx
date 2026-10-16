import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'PacketDrop',description:'החבילות שלך, במקום אחד',applicationName:'PacketDrop',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'PacketDrop',statusBarStyle:'black-translucent'},icons:{icon:'/icon-192.png',apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#0e1013'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body>{children}</body></html>}
