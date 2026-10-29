{{- $css := resources.Get "css/site.css" | minify | fingerprint -}}
{{- $js := resources.Get "js/site.js" | minify | fingerprint -}}
{{- $player := resources.Get "js/player.js" | minify | fingerprint -}}
{{- $indice := partialCached "indice.html" . -}}
{{- $essenciais := slice $css.RelPermalink $js.RelPermalink $player.RelPermalink $indice ("offline/" | relURL) ("fonts/eb-garamond.woff2" | relURL) ("fonts/eb-garamond-italic.woff2" | relURL) ("fonts/nunito.woff2" | relURL) ("pagefind/pagefind-component-ui.css" | relURL) ("pagefind/pagefind-component-ui.js" | relURL) ("favicon.svg" | relURL) ("site.webmanifest" | relURL) -}}
{{- $paginas := slice ("/" | relURL) ("sem-internet/" | relURL) -}}
var ARQUIVOS = 'hinario-arquivos';
var PAGINAS = 'hinario-paginas';
var ESSENCIAIS = {{ $essenciais | jsonify | safeJS }};
var PAGINAS_INICIAIS = {{ $paginas | jsonify | safeJS }};
var RESERVA = '{{ "offline/" | relURL }}';
var ESPERA_DA_REDE = 4000;

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(ARQUIVOS)
      .then(function (cache) { return cache.addAll(ESSENCIAIS); })
      .then(function () { return caches.open(PAGINAS); })
      .then(function (cache) { return cache.addAll(PAGINAS_INICIAIS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(self.clients.claim());
});

function chave(url) {
  return url.origin + url.pathname;
}

function primeiroCache(requisicao) {
  return caches.match(requisicao).then(function (guardada) {
    return guardada || fetch(requisicao).then(function (resposta) {
      if (resposta.ok || resposta.type === 'opaque') {
        var copia = resposta.clone();
        caches.open(ARQUIVOS).then(function (cache) { cache.put(requisicao, copia); });
      }
      return resposta;
    });
  });
}

function guardada(url) {
  return caches.match(chave(url), { ignoreSearch: true });
}

function primeiroRede(requisicao) {
  var url = new URL(requisicao.url);
  return new Promise(function (resolver) {
    var respondido = false;
    function responder(resposta) {
      if (respondido || !resposta) return;
      respondido = true;
      resolver(resposta);
    }
    var espera = setTimeout(function () {
      guardada(url).then(responder);
    }, ESPERA_DA_REDE);
    fetch(requisicao).then(function (resposta) {
      clearTimeout(espera);
      if (resposta.ok && resposta.type === 'basic') {
        var copia = resposta.clone();
        caches.open(PAGINAS).then(function (cache) { cache.put(chave(url), copia); });
      }
      responder(resposta);
    }).catch(function () {
      clearTimeout(espera);
      guardada(url).then(function (resposta) {
        responder(resposta || caches.match(RESERVA));
      });
    });
  });
}

self.addEventListener('fetch', function (evento) {
  var requisicao = evento.request;
  if (requisicao.method !== 'GET') return;
  var url = new URL(requisicao.url);
  if (url.origin === 'https://cdn.jsdelivr.net' && /^\/npm\/(tone|@tonejs\/midi)@/.test(url.pathname)) {
    evento.respondWith(primeiroCache(requisicao));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (requisicao.mode === 'navigate') {
    evento.respondWith(primeiroRede(requisicao));
    return;
  }
  if (url.pathname.indexOf('/pagefind/') === 0 && ESSENCIAIS.indexOf(url.pathname) < 0) return;
  if (/\.(css|js|json|woff2|svg|png|ico|mid|webmanifest)$/.test(url.pathname)) {
    evento.respondWith(primeiroCache(requisicao));
  }
});
