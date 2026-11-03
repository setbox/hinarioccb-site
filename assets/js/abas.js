(function () {
  var pagina = document.querySelector('.pagina-hino');
  if (!pagina || !window.fetch || !window.DOMParser || !history.pushState) return;

  var hinario = window.Hinario || (window.Hinario = { controle: new AbortController(), modulos: [] });
  var trocando = null;

  function todos(seletor, contexto) {
    return Array.prototype.slice.call((contexto || document).querySelectorAll(seletor));
  }

  function enderecoDoScript(script) {
    return new URL(script.getAttribute('src'), location.href).pathname;
  }

  function carregarScripts(novo) {
    var carregados = todos('script[src]').map(enderecoDoScript);
    return todos('script[src]', novo).filter(function (script) {
      return carregados.indexOf(enderecoDoScript(script)) < 0;
    }).reduce(function (anterior, original) {
      return anterior.then(function () {
        return new Promise(function (resolver) {
          var script = document.createElement('script');
          script.src = original.getAttribute('src');
          if (original.integrity) script.integrity = original.integrity;
          script.onload = resolver;
          script.onerror = resolver;
          document.body.appendChild(script);
        });
      });
    }, Promise.resolve());
  }

  function manterPublicidade(conteudo) {
    todos('[data-vitrine-slot][id]', conteudo).forEach(function (espaco) {
      var atual = document.getElementById(espaco.id);
      if (atual) espaco.replaceWith(atual);
    });
  }

  function trocarMeta(novo, seletor, atributo) {
    var atual = document.querySelector(seletor);
    var outro = novo.querySelector(seletor);
    if (atual && outro) atual.setAttribute(atributo, outro.getAttribute(atributo));
  }

  function trocar(endereco, empilhar) {
    if (trocando) trocando.abort();
    var pedido = new AbortController();
    trocando = pedido;
    pagina.classList.add('trocando-aba');
    return fetch(endereco, { signal: pedido.signal }).then(function (resposta) {
      if (!resposta.ok) throw new Error('aba');
      return resposta.text();
    }).then(function (html) {
      var novo = new DOMParser().parseFromString(html, 'text/html');
      var novaPagina = novo.querySelector('.pagina-hino');
      var novoConteudo = novaPagina && novaPagina.querySelector('.conteudo');
      var conteudo = pagina.querySelector('.conteudo');
      if (!novoConteudo || !conteudo || novaPagina.dataset.hino !== pagina.dataset.hino) throw new Error('aba');
      manterPublicidade(novoConteudo);
      hinario.controle.abort();
      hinario.controle = new AbortController();
      pagina.className = novaPagina.className;
      conteudo.replaceWith(novoConteudo);
      document.title = novo.title;
      trocarMeta(novo, 'meta[name="description"]', 'content');
      trocarMeta(novo, 'link[rel="canonical"]', 'href');
      if (empilhar) history.pushState({ aba: true }, '', endereco);
      hinario.modulos.forEach(function (iniciar) { iniciar(hinario.controle.signal); });
      return carregarScripts(novo).then(function () {
        pagina.classList.remove('trocando-aba');
        document.dispatchEvent(new CustomEvent('hino:aba', { detail: { conteudo: novoConteudo } }));
        var aba = novoConteudo.querySelector('.abas a[aria-current="page"]');
        if (aba && empilhar) aba.focus({ preventScroll: true });
      });
    }).catch(function (erro) {
      if (erro && erro.name === 'AbortError') return;
      location.href = endereco;
    });
  }

  history.replaceState({ aba: true }, '', location.href);

  document.addEventListener('click', function (evento) {
    var link = evento.target.closest('.abas a');
    if (!link || evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    if (link.getAttribute('aria-current') === 'page') return;
    trocar(link.href, true);
  });

  window.addEventListener('popstate', function (evento) {
    if (evento.state && evento.state.aba) trocar(location.href, false);
  });
})();
