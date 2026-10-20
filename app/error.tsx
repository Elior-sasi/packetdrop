'use client';
// If a screen ever fails to draw, show a way back instead of a blank page.
export default function Error({reset}:{error:Error;reset:()=>void}){
 return <main className="app" dir="rtl"><section className="panel empty" role="alert"><h2>משהו השתבש בתצוגה</h2><p>החבילות שלך שמורות. אפשר לנסות שוב.</p>
  <button className="primary" onClick={()=>{try{reset();}catch{location.reload();}}}>לנסות שוב</button>
  <button className="ghost" onClick={()=>location.reload()}>טעינה מחדש</button></section></main>;}
