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
    todos('.botao-ampla').forEach(function (botao) {
      botao.setAttribute('aria-pressed', raiz.classList.contains('ampla') ? 'true' : 'false');
    });
  }

  todos('[data-acao="tema"]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      raiz.dataset.tema = raiz.dataset.tema === 'escuro' ? 'claro' : 'escuro';
      gravar('tema', raiz.dataset.tema);
    });
  });

  todos('[data-acao="ampla"]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      raiz.classList.toggle('ampla');
      gravar('ampla', raiz.classList.contains('ampla'));
      marcarAmpla();
    });
  });
  marcarAmpla();

  todos('[data-escala]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      var atual = parseFloat(getComputedStyle(raiz).getPropertyValue('--escala')) || 1;
      var nova = Math.min(1.6, Math.max(0.8, Math.round((atual + parseFloat(botao.dataset.escala)) * 10) / 10));
      raiz.style.setProperty('--escala', nova);
      gravar('escala', nova);
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

  function prepararBusca(caixa) {
    var campo = caixa.querySelector('input');
    if (!campo || caixa.dataset.atalho) return;
    caixa.dataset.atalho = 'sim';
    var atalho = document.createElement('a');
    atalho.className = 'atalho-numero';
    atalho.hidden = true;
    var rotulo = document.createElement('span');
    rotulo.className = 'atalho-numero-rotulo';
    rotulo.textContent = 'Ir para';
    var nome = document.createElement('span');
    nome.className = 'atalho-numero-nome';
    var tecla = document.createElement('kbd');
    tecla.textContent = 'Enter';
    atalho.appendChild(rotulo);
    atalho.appendChild(nome);
    atalho.appendChild(tecla);
    var destino = null;
    var navegou = false;

    function posicionar() {
      var lista = caixa.querySelector('.pf-searchbox-dropdown');
      if (lista && lista.firstChild !== atalho) lista.insertBefore(atalho, lista.firstChild);
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
          nome.textContent = rotuloDoHino(destino);
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

  todos('pagefind-searchbox').forEach(function (caixa) {
    prepararBusca(caixa);
    new MutationObserver(function (mudancas, observador) {
      if (!caixa.querySelector('input')) return;
      observador.disconnect();
      prepararBusca(caixa);
    }).observe(caixa, { childList: true, subtree: true });
  });

  if (window.location.hash === '#numero') {
    var campoInicio = document.getElementById('numero');
    if (campoInicio) campoInicio.focus();
  }

  var paginaHino = document.querySelector('[data-hino]');
  var chaveAtual = paginaHino ? paginaHino.dataset.hino : null;
  var culto = ler('culto', []);

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

  function desenharCulto(lista) {
    todos('[data-culto-lista]').forEach(function (ol) {
      ol.textContent = '';
      culto.forEach(function (chave, posicao) {
        var hino = lista[chave];
        if (!hino) return;
        var li = document.createElement('li');
        var ordem = document.createElement('span');
        ordem.className = 'ordem';
        ordem.textContent = (posicao + 1) + 'º';
        var a = link(hino, ordem);
        if (chave === chaveAtual) a.setAttribute('aria-current', 'page');
        li.appendChild(a);
        if (!chaveAtual) {
          var remover = document.createElement('button');
          remover.type = 'button';
          remover.setAttribute('aria-label', 'Tirar ' + hino.n + ' do culto de hoje');
          remover.textContent = '×';
          remover.addEventListener('click', function () {
            culto = culto.filter(function (item) { return item !== chave; });
            gravar('culto', culto);
            desenharCulto(lista);
          });
          li.appendChild(remover);
        }
        ol.appendChild(li);
      });
    });
    todos('[data-culto-vazio]').forEach(function (p) { p.hidden = culto.length > 0; });
    todos('[data-culto-limpar]').forEach(function (b) { b.hidden = culto.length === 0; });
    todos('[data-culto-lateral]').forEach(function (s) { s.hidden = culto.length === 0; });

    var alternar = document.querySelector('[data-culto-alternar]');
    if (alternar) {
      alternar.textContent = culto.indexOf(chaveAtual) >= 0 ? 'Tirar do culto de hoje' : 'Adicionar ao culto de hoje';
    }

    var faixa = document.querySelector('[data-culto-faixa]');
    if (faixa) {
      var posicao = culto.indexOf(chaveAtual);
      faixa.hidden = posicao < 0;
      if (posicao >= 0) {
        faixa.querySelector('[data-culto-posicao]').textContent = 'Culto de hoje, ' + (posicao + 1) + 'º de ' + culto.length;
        [['[data-culto-anterior]', culto[posicao - 1], '‹ '], ['[data-culto-proximo]', culto[posicao + 1], ' ›']].forEach(function (item) {
          var a = faixa.querySelector(item[0]);
          var hino = item[1] && lista[item[1]];
          a.hidden = !hino;
          if (hino) {
            a.href = hino.u;
            a.textContent = item[2] === '‹ ' ? '‹ ' + hino.n : hino.n + ' ›';
          }
        });
      }
    }
  }

  function desenharRecentes(lista) {
    var recentes = ler('recentes', []).filter(function (chave) { return lista[chave]; });
    todos('[data-recentes]').forEach(function (secao) {
      secao.hidden = recentes.length === 0;
      var ol = secao.querySelector('[data-recentes-lista]');
      ol.textContent = '';
      recentes.forEach(function (chave) {
        var li = document.createElement('li');
        li.appendChild(link(lista[chave]));
        ol.appendChild(li);
      });
    });
  }

  if (document.querySelector('[data-culto-lista], [data-culto-faixa], [data-recentes]')) {
    carregarIndice().then(function (lista) {
      desenharCulto(lista);
      desenharRecentes(lista);

      todos('[data-culto-limpar]').forEach(function (botao) {
        botao.addEventListener('click', function () {
          culto = [];
          gravar('culto', culto);
          desenharCulto(lista);
        });
      });

      var alternar = document.querySelector('[data-culto-alternar]');
      if (alternar) {
        alternar.addEventListener('click', function () {
          culto = culto.indexOf(chaveAtual) >= 0
            ? culto.filter(function (item) { return item !== chaveAtual; })
            : culto.concat([chaveAtual]);
          gravar('culto', culto);
          desenharCulto(lista);
        });
      }
    });
  }

  todos('.letra li').forEach(function (estrofe) {
    estrofe.addEventListener('click', function () {
      var marcada = estrofe.classList.contains('atual');
      todos('.letra li.atual').forEach(function (li) { li.classList.remove('atual'); });
      if (!marcada) estrofe.classList.add('atual');
    });
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
    mostrarAjustes(ler('ajustes', false));
    botao.addEventListener('click', function () {
      var abertos = !player.classList.contains('ajustes-abertos');
      mostrarAjustes(abertos);
      gravar('ajustes', abertos);
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
  if (aviso && !window.consentimento) {
    aviso.hidden = false;
    document.body.classList.add('com-aviso');
    todos('[data-consentimento]', aviso).forEach(function (botao) {
      botao.addEventListener('click', function () {
        var escolha = botao.getAttribute('data-consentimento');
        try { localStorage.setItem('consentimento', escolha); } catch (e) {}
        if (escolha === 'aceito') {
          gtag('consent', 'update', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            analytics_storage: 'granted'
          });
        }
        aviso.hidden = true;
        document.body.classList.remove('com-aviso');
      });
    });
  }
})();
