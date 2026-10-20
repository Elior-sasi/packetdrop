// Unbox service worker: phone notifications only (no offline caching, so updates always load fresh).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch{d={body:e.data&&e.data.text()};}
 e.waitUntil(self.registration.showNotification(d.title||'Unbox',{body:d.body||'',tag:d.tag,renotify:true,silent:false,icon:'/icon-v3-192.png',badge:'/icon-v3-192.png',lang:'he',dir:'rtl',data:{url:d.url||'/'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'/',self.location.origin).href;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const c=list[0];if(c){c.postMessage({type:'open',url});return c.focus().catch(()=>{});}return self.clients.openWindow(url);}));});
