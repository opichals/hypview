const version = 'v0.1.4';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(version).then(function (cache) {
      return cache.addAll([
        'index.html',
        'hypview.js',
        'lha.js',
        'uzip.js',
        'dehyp.js',
        'dehyp.wasm',
        'image/ikat.png',
        'image/iprev.png',
        'image/ixref.png',
        'image/ihelp.png',
        'image/iinfo.png',
        'image/inext.png',
        'image/itoc.png',
        'image/iremarker.png',
        'image/imenu.png',
        'image/iindex.png',
        'image/ihotlist.png',
        'image/iload.png',
        'image/iback.png',
        'image/ix.png',
        'image/github.png',
      ]);
    })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    }).catch(function () {
      return caches.match('index.html');
    })
  );
});
