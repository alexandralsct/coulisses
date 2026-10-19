// Coulisses : cache du code seulement. L'état (etat.json) n'est jamais mis en cache ici.
const C="coulisses-v13";   // ne supprime que ses propres caches (coulisses-…) : la carte et LIFE vivent à la même adresse
const FILES=["./","./index.html","./app.js","./piloter.js","./style.css","./connexion.js","./connexion.css","./qr.js","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg",
  "./fonts/instrument-sans.woff2","./fonts/plex-mono-400.woff2","./fonts/plex-mono-500.woff2","./fonts/plex-mono-600.woff2","./fonts/plex-mono-700.woff2"];   // polices hébergées avec l'app (charte commune)
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith("coulisses-")&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// Le code (page, app.js, style.css) vient d'abord du réseau, pour qu'une correction arrive tout de suite ;
// la copie en cache ne sert que hors ligne. Les adresses avec « ?… » ne sont jamais gardées.
const CODE=/\/(index\.html|app\.js|piloter\.js|style\.css|connexion\.js|connexion\.css)?$/;
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
  if(e.request.mode==="navigate"||CODE.test(u.pathname)){
    e.respondWith(fetch(new Request(e.request.url,{cache:"no-store",credentials:"same-origin"})).then(r=>{if(r.status===200&&!u.search){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;})
      .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||caches.match("./index.html"))));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.url)==="./#piloter"?"./#piloter":"./";
  e.waitUntil(self.clients.matchAll({type:"window"}).then(l=>{if(l.length){l[0].navigate&&u!=="./"&&l[0].navigate(u).catch(()=>{});return l[0].focus();}return self.clients.openWindow(u);}));});
// Alertes envoyées par Cocon (pilotage, 18/10) : { titre, corps, tag, url }.
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{};}catch(x){}
  e.waitUntil(self.registration.showNotification(String(d.titre||"Coulisses").slice(0,80),{body:String(d.corps||"Nouvelle alerte").slice(0,200),tag:String(d.tag||"coulisses"),icon:"icon-192.png",data:{url:"./#piloter"}}));});
