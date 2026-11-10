// שומר את האפליקציה לשימוש גם בלי אינטרנט: קודם רשת, ואם אין, מהמטמון.
const CACHE = "tc-v60";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "tc-img").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== location.origin) {
    if (e.request.destination === "image" && /places\.googleapis\.com|googleusercontent\.com/.test(u.hostname)) e.respondWith(caches.open("tc-img").then(c => c.match(e.request.url).then(hit => hit || fetch(e.request).then(r => { c.put(e.request.url, r.clone()).catch(() => {}); return r; }).catch(() => hit))));
    return;
  }
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
