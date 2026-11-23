const C='xisaab-v6',F=['./','index.html','manifest.json','icon.svg'];
const WAIT=3000; // wait this long for the network before falling back to the saved copy
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
async function saveDoc(c,url,res){
 const b=self.registration.scope;
 for(const u of new Set([url,b,b+'index.html']))await c.put(u,res.clone());
}
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
 const path=new URL(r.url).pathname;
 const isDoc=r.mode==='navigate'||/\/$|index\.html$/.test(path);
 e.respondWith((async()=>{
  const c=await caches.open(C);
  if(isDoc){
   // Page: always try for the newest copy first, but never wait long (offline / weak signal).
   const old=await c.match(r,{ignoreSearch:true})||await c.match('index.html');
   const oldText=old?await old.clone().text():null;
   let late=false;
   const net=fetch(r.url,{cache:'no-cache'}).then(async res=>{
    if(!res||!res.ok)return null;
    const fresh=await res.clone().text();
    if(fresh!==oldText){
     await saveDoc(c,r.url,res);
     if(late&&oldText!==null)(await self.clients.matchAll()).forEach(cl=>cl.postMessage({type:'updated'}));
    }
    return res;
   }).catch(()=>null);
   const first=await Promise.race([net,new Promise(ok=>setTimeout(()=>ok('timeout'),WAIT))]);
   if(first&&first!=='timeout')return first;
   late=first==='timeout';
   if(old){e.waitUntil(net);return old}
   return (await net)||Response.error();
  }
  // Other files (icon, manifest): saved copy first, refreshed quietly.
  const hit=await c.match(r,{ignoreSearch:true});
  const net=fetch(r).then(async res=>{if(res&&res.ok)await c.put(r,res.clone());return res}).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  return (await net)||Response.error();
 })());
});
