/* MEDIX — service worker: abre rápido e funciona com internet fraca.
   - Página (index.html): tenta a rede por até 3s; se demorar/falhar, usa a última versão guardada.
   - Firebase (módulos), fontes e bibliotecas: usa o que está guardado e atualiza em segundo plano.
   - NUNCA intercepta as chamadas de dados/login do Firebase (firestore/identitytoolkit/securetoken). */
const V = 'medix-v3';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const SWR_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req){
  return caches.open(V).then(cache =>
    cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
}
function networkFirst(req){
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then(m => { if(m && !done){ done = true; resolve(m); } return m; });
    const timer = setTimeout(fallback, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if(!done){ done = true; resolve(res); }
      if(res && res.ok){ const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    }).catch(() => { clearTimeout(timer); fallback().then(m => { if(!m && !done){ done = true; resolve(Response.error()); } }); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) e.respondWith(networkFirst(req));
    else e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if(SWR_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(req));
});
