// Coulisses : cache du code seulement. L'état (etat.json) n'est jamais mis en cache ici.
const C="coulisses-v3";   // ne supprime que ses propres caches (coulisses-…) : la carte et LIFE vivent à la même adresse
const FILES=["./","./index.html","./app.js","./style.css","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith("coulisses-")&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// Le code (page, app.js, style.css) vient d'abord du réseau, pour qu'une correction arrive tout de suite ;
// la copie en cache ne sert que hors ligne. Les adresses avec « ?… » ne sont jamais gardées.
const CODE=/\/(index\.html|app\.js|style\.css)?$/;
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
  if(e.request.mode==="navigate"||CODE.test(u.pathname)){
    e.respondWith(fetch(new Request(e.request.url,{cache:"no-store",credentials:"same-origin"})).then(r=>{if(r.status===200&&!u.search){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;})
      .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||caches.match("./index.html"))));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window"}).then(l=>l.length?l[0].focus():self.clients.openWindow("./")));});
