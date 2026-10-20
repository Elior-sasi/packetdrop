// Unbox service worker v5: phone notifications only (no offline caching, so updates always load fresh).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch{d={body:e.data&&e.data.text()};}
 e.waitUntil(self.registration.showNotification(d.title||'Unbox',{body:d.body||'',tag:d.tag,renotify:true,silent:false,icon:'/icon-v3-192.png',badge:'/icon-v3-192.png',lang:'he',dir:'rtl',data:{url:d.url||'/'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'/',self.location.origin).href;
 // iPhone may freeze the page before a message arrives, and may open the app on its last screen: the wanted parcel is also left
 // in a small cache entry that the page reads when it comes to the front.
 let pid=null;try{pid=new URL(url).searchParams.get('p');}catch{}
 fetch('/api/push?step=click&v=5&p='+encodeURIComponent(pid||'-'),{credentials:'include'}).catch(()=>{});
 const told=pid?fetch('/api/push?step=want&p='+encodeURIComponent(pid),{credentials:'include'}).catch(()=>{}):Promise.resolve();
 const keep=caches.open('unbox-open').then(c=>c.put('/__open',new Response(JSON.stringify({url,at:Date.now()})))).catch(()=>{});
 e.waitUntil(Promise.all([keep,told]).then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true})).then(list=>{const c=list[0];if(c){try{c.postMessage({type:'open',url});}catch{}return c.focus().catch(()=>{});}return self.clients.openWindow(url);}));});
