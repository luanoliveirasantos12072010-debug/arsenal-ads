/* Service worker do Arsenal Ads: guarda só os arquivos do app (nunca dados ou criativos). */
const CACHE="arsenal-v1";
const SHELL=["/","/index.html","/app.css","/app.js","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png","/icons/favicon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;const url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin)return; /* Supabase e outros: direto pela rede */
  e.respondWith(fetch(req).then(res=>{if(res.ok&&res.type==="basic"){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return res}).catch(()=>caches.match(req).then(r=>r||caches.match("/index.html"))));
});
