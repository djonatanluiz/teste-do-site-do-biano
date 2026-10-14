const CACHE='copiloto-shell-v14.6-row-sequence';
const HOME=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.add(new Request(HOME,{cache:'reload'})))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('copiloto-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||![HOME,self.registration.scope].includes(url.href.split('?')[0]))return;
  event.respondWith(fetch(event.request).then(response=>{if(!response.ok)throw new Error('offline');const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(HOME,copy)));return response;}).catch(()=>caches.match(HOME)));
});
