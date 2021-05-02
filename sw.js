const version = 'v0.0.1';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(version).then(function(cache) {
      return cache.addAll([
        'index.html',
        'hypview.js',
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
        'image/ix.png'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method === 'POST') {
    console.log('event', event);
  }

  event.respondWith(caches.match(event.request).then(function(response) {
    // caches.match() always resolves
    // but in case of success response will have value
    if (response !== undefined) {
      return response;
    } else {
      return fetch(event.request).then(function (response) {
        // response may be used only once
        // we need to save clone to put one copy in cache
        // and serve second one
        let responseClone = response.clone();

        caches.open(version).then(function (cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function () {
        return caches.match('index.html');
      });
    }
  }));
});
