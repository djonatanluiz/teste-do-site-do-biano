const CACHE='copiloto-shell-v11-1-regions-github';
const ROOT=self.registration.scope;
const FILES=["index.html","assets/xlsx.js","assets/leaflet.js","assets/leaflet-rotate.js","assets/zxing-browser.js","assets/copiloto.js","assets/leaflet.css","assets/copiloto.css","assets/operacao.css"].map(p=>new URL(p,ROOT).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('copiloto-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);url.search='';
 const key=url.href===ROOT?FILES[0]:url.href;
 if(!FILES.includes(key))return;
 e.respondWith(caches.open(CACHE).then(async c=>{const saved=await c.match(key);if(saved)return saved;const response=await fetch(e.request);if(response.ok)await c.put(key,response.clone());return response;}));
});
