const CACHE = "azucena-t8-movelist-v17";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./data/characters.json",
  "./data/azucena.json",
  "./data/alisa.json",
  "./data/anna.json",
  "./data/armor-king.json",
  "./data/asuka.json",
  "./data/bob.json",
  "./data/bryan.json",
  "./data/claudio.json",
  "./data/clive.json",
  "./data/devil-jin.json",
  "./data/eddy.json",
  "./data/fahkumram.json",
  "./data/feng.json",
  "./data/heihachi.json",
  "./data/hwoarang.json",
  "./data/jack-8.json",
  "./data/jin-kazama.json",
  "./data/jun.json",
  "./data/kazuya.json",
  "./data/king.json",
  "./data/kuma.json",
  "./data/kunimitsu.json",
  "./data/lars.json",
  "./data/law.json",
  "./data/lee.json",
  "./data/leo.json",
  "./data/leroy.json",
  "./data/lidia.json",
  "./data/lili.json",
  "./data/xiaoyu.json",
  "./data/nina.json",
  "./data/panda.json",
  "./data/paul.json",
  "./data/raven.json",
  "./data/reina.json",
  "./data/dragunov.json",
  "./data/shaheen.json",
  "./data/steve.json",
  "./data/victor.json",
  "./data/yoshimitsu.json",
  "./data/zafina.json",
];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});