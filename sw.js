const CACHE='nian-nian-shell-v13-safe-area';
// Static hosting redirects /index.html to /. Cache the canonical URL directly.
const FILES=['./','./styles.css','./light-theme.css?v=safe-area-1','./golden-sanctuary.webp','./app.js?v=share-1','./model.js?v=picker-1','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const ASSET_URLS=new Set(FILES.map(file=>new URL(file,self.location.href).href));
const DOCUMENT_PATHS=new Set(['./','./index.html'].map(file=>new URL(file,self.location.href).pathname));
function appDocument(response){return response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html');}
self.addEventListener('install',event=>{event.waitUntil((async()=>{
  const resources=await Promise.all(FILES.map(async file=>{
    const request=new Request(new URL(file,self.location.href),{credentials:'same-origin',cache:'reload'});
    const response=await fetch(request);
    if(!response.ok||response.redirected)throw new Error('Offline resource unavailable.');
    const html=response.headers.get('content-type')?.includes('text/html');
    if(html!==DOCUMENT_PATHS.has(new URL(request.url).pathname))throw new Error('Unexpected offline resource.');
    return [request,response];
  }));
  const cache=await caches.open(CACHE);
  await Promise.all(resources.map(([request,response])=>cache.put(request,response)));
  await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nian-nian-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Leave sign-in, sign-out and callbacks to the hosting platform.
  if(event.request.mode==='navigate'&&DOCUMENT_PATHS.has(url.pathname))event.respondWith(fetch(event.request).then(response=>{if(appDocument(response)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./',copy)));}return response;}).catch(()=>caches.match('./')));
  else if(ASSET_URLS.has(url.href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
