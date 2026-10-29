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
    var compacto = formulario.classList.contains('numero-compacto');
    var encontrado = null;

    function atualizar() {
      carregarIndice().then(function (lista) {
        var chave = chaveDigitada(campo.value);
        encontrado = chave ? lista[chave] : null;
        botao.disabled = !encontrado;
        if (encontrado) {
          titulo.textContent = encontrado.t;
        } else if (compacto) {
          titulo.textContent = 'Abrir';
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
        faixa.querySelector('[data-culto-posicao]').textContent = 'Culto de hoje · ' + (posicao + 1) + 'º de ' + culto.length;
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
