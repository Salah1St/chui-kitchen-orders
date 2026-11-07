'use strict';
// Bump the version whenever an app-shell file changes. IndexedDB is never cleared.
const CACHE='chui-kitchen-shell-v2';
const BASE=new URL('./',self.location.href);
const FILES=['./','./index.html','./local-data.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const URLS=FILES.map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('chui-kitchen-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const shellURL=new URL(url.pathname,url.origin).href;
  if(request.mode!=='navigate'&&!URLS.includes(shellURL))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request.mode==='navigate'?BASE.href:shellURL,{ignoreSearch:true});
    if(cached)return cached;
    try{return await fetch(request);}catch{return new Response('ยังไม่พร้อมใช้ออฟไลน์ กรุณาเชื่อมอินเทอร์เน็ตแล้วเปิดแอปอีกครั้ง',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  })());
});
