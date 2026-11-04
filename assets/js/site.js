(function () {
  var raiz = document.documentElement;

  function ler(chave, padrao) {
    try {
      var valor = localStorage.getItem(chave);
      return valor === null ? padrao : JSON.parse(valor);
    } catch (e) {
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {}
  }

  function todos(seletor, contexto) {
    return Array.prototype.slice.call((contexto || document).querySelectorAll(seletor));
  }

  function marcarAmpla() {
    todos('[data-leitura-ampla]').forEach(function (caixa) {
      caixa.checked = raiz.classList.contains('ampla');
    });
  }

  function alternarAmpla() {
    raiz.classList.toggle('ampla');
    gravar('ampla', raiz.classList.contains('ampla'));
    marcarAmpla();
  }

  todos('[data-acao="tema"]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      raiz.dataset.tema = raiz.dataset.tema === 'escuro' ? 'claro' : 'escuro';
      gravar('tema', raiz.dataset.tema);
    });
  });

  todos('[data-leitura-ampla]').forEach(function (caixa) {
    caixa.addEventListener('change', alternarAmpla);
  });
  marcarAmpla();

  function escalaAtual() {
    return parseFloat(getComputedStyle(raiz).getPropertyValue('--escala')) || 1;
  }

  function mostrarEscala() {
    todos('[data-escala-nome]').forEach(function (nome) {
      nome.textContent = Math.round(escalaAtual() * 100) + '%';
    });
  }

  mostrarEscala();

  todos('[data-tamanho]').forEach(function (tamanho) {
    var botao = tamanho.querySelector('[data-tamanho-botao]');
    var painel = tamanho.querySelector('[data-tamanho-painel]');
    function mostrarPainel(aberto) {
      painel.hidden = !aberto;
      botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    }
    botao.addEventListener('click', function () {
      mostrarPainel(painel.hidden);
    });
    document.addEventListener('click', function (evento) {
      if (!tamanho.contains(evento.target)) mostrarPainel(false);
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && !painel.hidden) {
        mostrarPainel(false);
        botao.focus();
      }
    });
  });

  var indice = null;
  function carregarIndice() {
    if (!indice) {
      indice = fetch(raiz.dataset.indice).then(function (resposta) {
        return resposta.json();
      });
    }
    return indice;
  }

  function chaveDigitada(texto) {
    var valor = texto.trim().toLowerCase().replace(/^coro\s*/, 'c').replace(/\s+/g, '');
    if (/^c[1-6]$/.test(valor)) return valor;
    if (/^\d+$/.test(valor)) return String(Number(valor));
    return null;
  }

  function abrir(hino) {
    var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (semMovimento) {
      window.location.href = hino.u;
      return;
    }
    var coro = hino.n.indexOf('Coro') === 0;
    document.querySelector('[data-transicao-rotulo]').textContent = coro ? 'Coro' : 'Hino';
    document.querySelector('[data-transicao-numero]').textContent = coro ? hino.n.replace('Coro ', '') : hino.n;
    document.querySelector('[data-transicao-titulo]').textContent = hino.t;
    document.getElementById('transicao').hidden = false;
    setTimeout(function () {
      window.location.href = hino.u;
    }, 500);
  }

  todos('[data-numero]').forEach(function (formulario) {
    var campo = formulario.querySelector('[data-numero-campo]');
    var botao = formulario.querySelector('[data-numero-botao]');
    var titulo = formulario.querySelector('[data-numero-titulo]');
    var encontrado = null;

    function atualizar() {
      carregarIndice().then(function (lista) {
        var chave = chaveDigitada(campo.value);
        encontrado = chave ? lista[chave] : null;
        botao.disabled = !encontrado;
        if (encontrado) {
          titulo.textContent = encontrado.t;
        } else if (campo.value.trim() === '') {
          titulo.textContent = 'Digite o número';
        } else {
          titulo.textContent = 'Não há hino ' + campo.value.trim();
        }
      });
    }

    campo.addEventListener('input', atualizar);
    campo.addEventListener('focus', carregarIndice);
    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      if (encontrado) abrir(encontrado);
    });
  });

  function rotuloDoHino(hino) {
    return (hino.n.indexOf('Coro') === 0 ? hino.n : 'Hino ' + hino.n) + ': ' + hino.t;
  }

  function separarNumero(titulo) {
    if (titulo.querySelector('.resultado-numero')) return;
    var partes = titulo.textContent.match(/^(?:Hino (\d+)|(Coro \d)): (.+)$/);
    if (!partes) return;
    var numero = document.createElement('span');
    numero.className = 'resultado-numero';
    numero.textContent = partes[1] || partes[2];
    var texto = document.createElement('span');
    texto.textContent = partes[3];
    titulo.textContent = '';
    titulo.appendChild(numero);
    titulo.appendChild(texto);
  }

  function prepararBusca(caixa) {
    var campo = caixa.querySelector('input');
    if (!campo || caixa.dataset.atalho) return;
    caixa.dataset.atalho = 'sim';
    var atalho = document.createElement('a');
    atalho.className = 'atalho-numero';
    atalho.hidden = true;
    var rotulo = document.createElement('span');
    rotulo.className = 'atalho-numero-rotulo';
    var nome = document.createElement('span');
    nome.className = 'atalho-numero-nome';
    var tecla = document.createElement('kbd');
    tecla.textContent = 'Enter';
    var seta = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    seta.setAttribute('viewBox', '0 0 16 16');
    seta.setAttribute('aria-hidden', 'true');
    seta.setAttribute('class', 'atalho-numero-seta');
    seta.innerHTML = '<path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"></path>';
    atalho.appendChild(rotulo);
    atalho.appendChild(nome);
    atalho.appendChild(tecla);
    atalho.appendChild(seta);
    var destino = null;
    var navegou = false;

    function posicionar() {
      var lista = caixa.querySelector('.pf-searchbox-dropdown');
      if (lista && lista.firstChild !== atalho) lista.insertBefore(atalho, lista.firstChild);
      todos('.pf-searchbox-result-title', caixa).forEach(separarNumero);
    }

    new MutationObserver(posicionar).observe(caixa, { childList: true, subtree: true });

    campo.addEventListener('input', function () {
      navegou = false;
      carregarIndice().then(function (lista) {
        var chave = chaveDigitada(campo.value);
        destino = chave ? lista[chave] : null;
        atalho.hidden = !destino;
        if (destino) {
          atalho.href = destino.u;
          atalho.setAttribute('aria-label', 'Abrir ' + rotuloDoHino(destino));
          rotulo.textContent = destino.n;
          nome.textContent = destino.t;
          posicionar();
        }
      });
    });

    caixa.addEventListener('keydown', function (evento) {
      if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') navegou = true;
      if (evento.key !== 'Enter' || !destino || navegou) return;
      evento.preventDefault();
      evento.stopPropagation();
      abrir(destino);
    }, true);

    atalho.addEventListener('click', function (evento) {
      evento.preventDefault();
      if (destino) abrir(destino);
    });
  }

  if (window.location.hash === '#busca') {
    window.addEventListener('load', function () {
      var campoBusca = document.querySelector('.busca-inicio input');
      if (campoBusca) campoBusca.focus();
    });
  }

  todos('pagefind-searchbox').forEach(function (caixa) {
    prepararBusca(caixa);
    new MutationObserver(function (mudancas, observador) {
      if (!caixa.querySelector('input')) return;
      observador.disconnect();
      prepararBusca(caixa);
    }).observe(caixa, { childList: true, subtree: true });
  });

  var paginaHino = document.querySelector('[data-hino]');
  var chaveAtual = paginaHino ? paginaHino.dataset.hino : null;

  if (chaveAtual) {
    gravar('recentes', [chaveAtual].concat(ler('recentes', []).filter(function (chave) {
      return chave !== chaveAtual;
    })).slice(0, 5));
  }

  function link(hino, extra) {
    var a = document.createElement('a');
    a.href = hino.u;
    var numero = document.createElement('span');
    numero.className = 'numero-lista';
    numero.textContent = hino.n;
    var titulo = document.createElement('span');
    titulo.textContent = hino.t;
    if (extra) a.appendChild(extra);
    a.appendChild(numero);
    a.appendChild(titulo);
    return a;
  }

  function desenharRecentes(lista) {
    var recentes = ler('recentes', []).filter(function (chave) { return lista[chave]; });
    todos('[data-recentes]').forEach(function (secao) {
      secao.hidden = recentes.length === 0;
      var ol = secao.querySelector('[data-recentes-lista]');
      ol.textContent = '';
      var soNumeros = secao.hasAttribute('data-recentes-numeros');
      recentes.forEach(function (chave) {
        var li = document.createElement('li');
        if (soNumeros) {
          var numero = document.createElement('a');
          numero.href = lista[chave].u;
          numero.textContent = lista[chave].n;
          numero.setAttribute('aria-label', rotuloDoHino(lista[chave]));
          li.appendChild(numero);
        } else {
          li.appendChild(link(lista[chave]));
        }
        ol.appendChild(li);
      });
    });
  }

  if (document.querySelector('[data-recentes]')) {
    carregarIndice().then(desenharRecentes);
  }

  function ligarConteudo(contexto) {
    todos('[data-acao="ampla"]', contexto).forEach(function (botao) {
      botao.addEventListener('click', alternarAmpla);
    });

    todos('[data-escala]', contexto).forEach(function (botao) {
      botao.addEventListener('click', function () {
        var nova = Math.min(1.6, Math.max(0.8, Math.round((escalaAtual() + parseFloat(botao.dataset.escala)) * 10) / 10));
        raiz.style.setProperty('--escala', nova);
        gravar('escala', nova);
        mostrarEscala();
      });
    });

    todos('[data-imprimir]', contexto).forEach(function (botao) {
      botao.addEventListener('click', function () {
        window.print();
      });
    });

    todos('.letra li', contexto).forEach(function (estrofe) {
      estrofe.addEventListener('click', function () {
        var marcada = estrofe.classList.contains('atual');
        todos('.letra li.atual').forEach(function (li) { li.classList.remove('atual'); });
        if (!marcada) estrofe.classList.add('atual');
      });
    });
  }

  ligarConteudo(document);
  document.addEventListener('hino:aba', function (evento) {
    ligarConteudo(evento.detail.conteudo);
  });

  function fecharDicas(exceto) {
    todos('[data-dica]').forEach(function (botao) {
      if (botao === exceto) return;
      botao.setAttribute('aria-expanded', 'false');
      document.getElementById(botao.getAttribute('aria-controls')).hidden = true;
    });
  }

  todos('[data-player-ajustes]').forEach(function (botao) {
    var player = botao.closest('[data-player]');
    function mostrarAjustes(abertos) {
      player.classList.toggle('ajustes-abertos', abertos);
      botao.setAttribute('aria-expanded', abertos ? 'true' : 'false');
    }
    botao.addEventListener('click', function () {
      mostrarAjustes(!player.classList.contains('ajustes-abertos'));
    });
    todos('[data-player-fechar]', player).forEach(function (fechar) {
      fechar.addEventListener('click', function () {
        mostrarAjustes(false);
        botao.focus();
      });
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && player.classList.contains('ajustes-abertos')) mostrarAjustes(false);
    });
  });

  todos('[data-dica]').forEach(function (botao) {
    var texto = document.getElementById(botao.getAttribute('aria-controls'));
    botao.addEventListener('click', function (evento) {
      evento.stopPropagation();
      var abrir = texto.hidden;
      fecharDicas(botao);
      texto.hidden = !abrir;
      botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });
  });

  document.addEventListener('click', function () { fecharDicas(null); });
  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') fecharDicas(null);
  });

  function mostrarSinal() {
    raiz.classList.toggle('sem-rede', !navigator.onLine);
    todos('[data-sem-sinal]').forEach(function (elemento) {
      elemento.hidden = navigator.onLine || !!document.querySelector('[data-offline]');
    });
  }
  mostrarSinal();
  window.addEventListener('online', mostrarSinal);
  window.addEventListener('offline', mostrarSinal);

  if ('serviceWorker' in navigator && raiz.dataset.sw) {
    navigator.serviceWorker.register(raiz.dataset.sw).catch(function () {});
  }

  var paginaOffline = document.querySelector('[data-offline]');
  if (paginaOffline) {
    var caminho = location.pathname.match(/\/5\/(\d+|coro-\d)\/?$/);
    if (caminho) {
      var chaveOffline = caminho[1].replace('coro-', 'c');
      carregarIndice().then(function (lista) {
        var hino = lista[chaveOffline];
        if (!hino) return;
        var numero = paginaOffline.querySelector('[data-offline-numero]');
        var nome = paginaOffline.querySelector('[data-offline-nome]');
        numero.textContent = hino.n.replace('Coro ', '');
        nome.textContent = hino.t;
        numero.hidden = false;
        nome.hidden = false;
        paginaOffline.querySelector('[data-offline-titulo]').textContent = 'Este hino não está guardado';
      }).catch(function () {});
    }
  }

  var PAGINAS_GUARDADAS = 'hinario-paginas';
  var blocosSemInternet = todos('[data-sem-internet]');
  var suportaSemInternet = 'serviceWorker' in navigator && 'caches' in window;
  todos('[data-sem-internet-sem-suporte]').forEach(function (aviso) { aviso.hidden = suportaSemInternet; });
  var baixando = null;

  function mostrarSemInternet(estadoAtual, progresso, total) {
    var guardados = ler('hinos-guardados', null);
    blocosSemInternet.forEach(function (bloco) {
      bloco.hidden = !suportaSemInternet;
      bloco.classList.toggle('sem-internet-pronto', estadoAtual === 'guardados');
      todos('[data-sem-internet-estado]', bloco).forEach(function (parte) {
        parte.hidden = parte.getAttribute('data-sem-internet-estado') !== estadoAtual;
      });
      if (total) {
        todos('[data-sem-internet-total]', bloco).forEach(function (campo) { campo.textContent = total; });
      }
      if (estadoAtual === 'baixando') {
        bloco.querySelector('[data-sem-internet-progresso]').textContent = 'Baixando ' + progresso + ' de ' + total + ' hinos';
        bloco.querySelector('[data-sem-internet-barra]').style.width = (total ? progresso / total * 100 : 0) + '%';
      }
      if (estadoAtual === 'guardados' && guardados) {
        bloco.querySelector('[data-sem-internet-resumo]').textContent = 'Os ' + guardados.total + ' hinos abrem sem internet neste aparelho. Guardados em ' + guardados.data + '.';
      }
    });
  }

  function baixarHinos() {
    var execucao = { cancelado: false };
    baixando = execucao;
    Promise.all([carregarIndice(), caches.open(PAGINAS_GUARDADAS)]).then(function (resultado) {
      var enderecos = Object.keys(resultado[0]).map(function (chave) { return resultado[0][chave].u; });
      var cache = resultado[1];
      var total = enderecos.length;
      var feitos = 0;
      var falhas = 0;
      mostrarSemInternet('baixando', 0, total);
      function proximo() {
        if (execucao.cancelado || !enderecos.length) return Promise.resolve();
        var endereco = enderecos.shift();
        var completo = location.origin + endereco;
        return fetch(completo).then(function (resposta) {
          if (!resposta.ok) throw new Error(endereco);
          return cache.put(completo, resposta);
        }).catch(function () { falhas += 1; }).then(function () {
          feitos += 1;
          if (!execucao.cancelado) mostrarSemInternet('baixando', feitos, total);
          return proximo();
        });
      }
      return Promise.all([proximo(), proximo(), proximo(), proximo(), proximo(), proximo()]).then(function () {
        if (execucao.cancelado) return;
        if (falhas) {
          mostrarSemInternet('inicial', 0, total);
          return;
        }
        gravar('hinos-guardados', { total: total, data: new Date().toLocaleDateString('pt-BR') });
        mostrarSemInternet('guardados', total, total);
      });
    }).catch(function () {
      mostrarSemInternet('inicial');
    }).then(function () {
      if (baixando === execucao) baixando = null;
    });
  }

  function removerHinos() {
    caches.open(PAGINAS_GUARDADAS).then(function (cache) {
      return cache.keys().then(function (chaves) {
        return Promise.all(chaves.filter(function (requisicao) {
          return /\/5\/[^/]+\/$/.test(new URL(requisicao.url).pathname);
        }).map(function (requisicao) { return cache.delete(requisicao); }));
      });
    }).catch(function () {}).then(function () {
      try { localStorage.removeItem('hinos-guardados'); } catch (e) {}
      mostrarSemInternet('inicial');
    });
  }

  if (blocosSemInternet.length) {
    mostrarSemInternet(ler('hinos-guardados', null) ? 'guardados' : 'inicial');
    todos('[data-sem-internet-baixar]').forEach(function (botao) {
      botao.addEventListener('click', function () { if (!baixando) baixarHinos(); });
    });
    todos('[data-sem-internet-cancelar]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        if (baixando) baixando.cancelado = true;
        baixando = null;
        mostrarSemInternet('inicial');
      });
    });
    todos('[data-sem-internet-remover]').forEach(function (botao) {
      botao.addEventListener('click', removerHinos);
    });
  }

  var aviso = document.getElementById('aviso-cookies');
  var preferencias = document.getElementById('preferencias-cookies');
  var consentimento = window.hinarioConsentimento;
  if (aviso && preferencias && consentimento) {
    var medicao = preferencias.querySelector('[data-consentimento-medicao]');
    var anuncios = preferencias.querySelector('[data-consentimento-anuncios]');

    var mostrarAviso = function (visivel) {
      aviso.hidden = !visivel;
      document.body.classList.toggle('com-aviso', visivel);
    };

    var escolher = function (escolha) {
      consentimento.gravar(escolha);
      mostrarAviso(false);
      if (preferencias.open) preferencias.close();
    };

    if (!consentimento.guardado) mostrarAviso(true);

    document.addEventListener('click', function (evento) {
      var botao = evento.target.closest('[data-consentimento]');
      if (!botao) return;
      var acao = botao.getAttribute('data-consentimento');
      if (acao === 'aceitar') escolher({ medicao: true, anuncios: true });
      if (acao === 'recusar') escolher({ medicao: false, anuncios: false });
      if (acao === 'salvar') escolher({ medicao: medicao.checked, anuncios: anuncios.checked });
      if (acao === 'abrir') {
        var atual = consentimento.ler() || { medicao: false, anuncios: false };
        medicao.checked = atual.medicao;
        anuncios.checked = atual.anuncios;
        preferencias.showModal();
      }
    });
  }
})();
