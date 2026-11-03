(function () {
  var hinario = window.Hinario || (window.Hinario = { controle: new AbortController(), modulos: [] });

  function iniciar(sinal) {
    var raiz = document.querySelector('[data-partitura]');
    if (!raiz) return;

    var VEROVIO = 'https://cdn.jsdelivr.net/npm/verovio@6.3.0/dist/verovio-toolkit-wasm.js';
    var NOMES_DAS_VOZES = ['Soprano', 'Contralto', 'Tenor', 'Baixo'];
    var ESCALA_MINIMA = 20;
    var ESCALA_MAXIMA = 72;
    var MARGEM_ESQUERDA = 22;
    var MARGEM_DIREITA = 16;
    var MARGEM_VERTICAL = 16;
    var IMPRESSAO = { largura: 680, altura: 900, densidades: [40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20] };
    var SVG = 'http://www.w3.org/2000/svg';

    var folhas = raiz.querySelector('[data-partitura-folhas]');
    var estado = raiz.querySelector('[data-partitura-estado]');
    var seguir = document.querySelector('[data-partitura-seguir]');
    var barraEstudo = raiz.querySelector('[data-estudo-barra]');
    var rotuloEstudo = raiz.querySelector('[data-estudo-rotulo]');
    var afinacoes = Array.prototype.slice.call(document.querySelectorAll('[data-afinacao]'));
    var nomeEscala = document.querySelector('[data-partitura-escala-nome]');

    var toolkit = null;
    var partitura = null;
    var sincronia = null;
    var notas = [];
    var marcadas = [];
    var silabas = [];
    var cursor = null;
    var sistemaAtual = null;
    var largura = 0;
    var imprimindo = false;
    var ultimaPosicao = null;
    var tomDoPlayer = 0;
    var vozesAtivas = Array.prototype.slice.call(document.querySelectorAll('[data-player] [data-voz]')).map(function (botao) {
      return botao.getAttribute('aria-pressed') !== 'false';
    });
    if (vozesAtivas.length !== 4) vozesAtivas = [true, true, true, true];

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

    function afinacaoGuardada() {
      var nome = ler('afinacao', 'Dó');
      return afinacoes.filter(function (botao) { return botao.dataset.afinacao === nome; })[0] || afinacoes[0];
    }

    var afinacao = afinacaoGuardada();
    var escala = ler('partitura-escala', null);
    var marcarLetra = ler('marcar-letra', true) !== false;

    function transposicao() {
      var semitons = ((Number(afinacao.dataset.semitons) + tomDoPlayer) % 12 + 12) % 12;
      if (semitons > 6) semitons -= 12;
      return semitons === 0 ? '' : (semitons > 0 ? '+' : '') + semitons;
    }

    function carregarScript(endereco) {
      return new Promise(function (resolver, rejeitar) {
        var script = document.createElement('script');
        script.src = endereco;
        script.onload = resolver;
        script.onerror = rejeitar;
        document.head.appendChild(script);
      });
    }

    function carregarVerovio() {
      if (!hinario.verovio) {
        hinario.verovio = carregarScript(VEROVIO).then(function () {
          return new Promise(function (resolver) {
            verovio.module.onRuntimeInitialized = resolver;
          });
        }).then(function () {
          verovio.enableLog(verovio.LOG_OFF);
          return new verovio.toolkit();
        });
      }
      return hinario.verovio.then(function (pronto) {
        toolkit = pronto;
      });
    }

    function escalaPadrao() {
      return folhas.clientWidth < 600 ? 30 : 40;
    }

    function escalaAtual() {
      return escala || escalaPadrao();
    }

    function mostrarEscala() {
      nomeEscala.textContent = Math.round(escalaAtual() / escalaPadrao() * 100) + '%';
    }

    function margem(pixels, tamanho) {
      return Math.round(pixels * 100 / tamanho);
    }

    function opcoes(larguraEmPixels, tamanho, alturaEmPixels) {
      var lista = {
        pageWidth: Math.round(larguraEmPixels * 100 / tamanho),
        scale: tamanho,
        adjustPageHeight: true,
        breaks: 'auto',
        header: 'none',
        footer: 'none',
        svgViewBox: true,
        svgAdditionalAttribute: ['staff@n', 'layer@n', 'verse@n'],
        lyricTopMinMargin: 5,
        lyricBottomMinMargin: 5,
        pageMarginLeft: margem(MARGEM_ESQUERDA, tamanho),
        pageMarginRight: margem(MARGEM_DIREITA, tamanho),
        pageMarginTop: margem(MARGEM_VERTICAL, tamanho),
        pageMarginBottom: margem(MARGEM_VERTICAL, tamanho),
        transpose: transposicao()
      };
      if (alturaEmPixels) lista.pageHeight = Math.round(alturaEmPixels * 100 / tamanho);
      return lista;
    }

    function mostrarPaginas() {
      var paginas = [];
      for (var pagina = 1; pagina <= toolkit.getPageCount(); pagina++) {
        paginas.push('<div class="partitura-folha">' + toolkit.renderToSVG(pagina) + '</div>');
      }
      folhas.innerHTML = paginas.join('');
    }

    function desenharParaImprimir() {
      var umaPagina = null;
      var duasPaginas = null;
      IMPRESSAO.densidades.forEach(function (tamanho) {
        if (umaPagina) return;
        toolkit.setOptions(opcoes(IMPRESSAO.largura, tamanho, IMPRESSAO.altura));
        toolkit.loadData(partitura);
        var total = toolkit.getPageCount();
        if (total === 1) umaPagina = tamanho;
        if (total === 2 && !duasPaginas) duasPaginas = tamanho;
      });
      var escolhido = umaPagina || duasPaginas || IMPRESSAO.densidades[IMPRESSAO.densidades.length - 1];
      toolkit.setOptions(opcoes(IMPRESSAO.largura, escolhido, IMPRESSAO.altura));
      toolkit.loadData(partitura);
      mostrarPaginas();
      cursor = null;
      sistemaAtual = null;
    }

    function desenhar() {
      largura = folhas.clientWidth;
      toolkit.setOptions(opcoes(largura, escalaAtual()));
      toolkit.loadData(partitura);
      mostrarPaginas();
      marcadas = [];
      silabas = [];
      cursor = null;
      sistemaAtual = null;
      mapearTempos();
      mapearVozes();
      aplicarEstudo();
      marcar(posicaoNaPartitura(ultimaPosicao));
    }

    function alturaDa(nota) {
      return toolkit.getMIDIValuesForElement(nota.id).pitch;
    }

    function mapearVozes() {
      Array.prototype.slice.call(folhas.querySelectorAll('g.note')).forEach(function (nota) {
        var pauta = nota.closest('g.staff');
        var camada = nota.closest('g.layer');
        if (!pauta || !camada) return;
        var superior = pauta.dataset.n === '1' ? 0 : 2;
        var camadas = Array.prototype.slice.call(pauta.querySelectorAll('g.layer')).filter(function (outra) {
          return outra.querySelector('g.note');
        });
        var vozes;
        if (camadas.length > 1) {
          vozes = [camada === camadas[0] ? superior : superior + 1];
        } else {
          var acorde = nota.closest('g.chord');
          var irmas = acorde ? Array.prototype.slice.call(acorde.querySelectorAll('g.note')) : [nota];
          if (irmas.length < 2) {
            vozes = [superior, superior + 1];
          } else {
            var alturas = irmas.map(alturaDa);
            var minha = alturaDa(nota);
            vozes = [];
            if (minha === Math.max.apply(null, alturas)) vozes.push(superior);
            if (minha === Math.min.apply(null, alturas)) vozes.push(superior + 1);
            if (!vozes.length) vozes = [superior, superior + 1];
          }
        }
        nota.dataset.vozes = vozes.join(' ');
      });
    }

    function mapearTempos() {
      var inicios = {};
      var lista = [];
      toolkit.renderToTimemap().forEach(function (evento) {
        (evento.on || []).forEach(function (id) { inicios[id] = evento.qstamp; });
        (evento.off || []).forEach(function (id) {
          if (!(id in inicios)) return;
          var elemento = document.getElementById(id);
          if (elemento) lista.push({ elemento: elemento, inicio: inicios[id], fim: evento.qstamp });
          delete inicios[id];
        });
      });
      notas = lista.sort(function (a, b) { return a.inicio - b.inicio; });
    }

    function fimDaUltimaNota(inicio) {
      return notas.reduce(function (fim, nota) {
        return Math.abs(nota.inicio - inicio) < 1e-6 ? Math.max(fim, nota.fim) : fim;
      }, inicio + 1e-3);
    }

    function posicaoNaPartitura(seminimas) {
      if (seminimas === null || !sincronia) return null;
      var segmento = sincronia.segmentos.filter(function (item) { return item.inicio <= seminimas && seminimas < item.fim; })[0];
      if (!segmento || !segmento.ancoras.length) return null;
      var anterior = null;
      var seguinte = null;
      for (var i = 0; i < segmento.ancoras.length; i++) {
        if (segmento.ancoras[i][0] <= seminimas + 1e-6) anterior = segmento.ancoras[i];
        else {
          seguinte = segmento.ancoras[i];
          break;
        }
      }
      if (!anterior) return null;
      var posicao = anterior[1] + (seminimas - anterior[0]);
      var limite = seguinte ? seguinte[1] : fimDaUltimaNota(anterior[1]);
      var estrofe = /^Estrofe (\d+)$/.exec(segmento.nome || '');
      return { tempo: Math.min(posicao, limite - 1e-3), estrofe: estrofe ? estrofe[1] : null };
    }

    function mostrarSistema(nota) {
      var sistema = nota.closest('g.system') || nota;
      if (sistema === sistemaAtual) return;
      sistemaAtual = sistema;
      if (!seguir.checked) return;
      var caixa = sistema.getBoundingClientRect();
      var player = document.querySelector('[data-player]');
      var limite = window.innerHeight - (player && getComputedStyle(player).position === 'fixed' ? player.offsetHeight : 0);
      if (caixa.top >= 0 && caixa.bottom <= limite) return;
      var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + caixa.top - Math.max(16, (limite - caixa.height) / 2), behavior: semMovimento ? 'auto' : 'smooth' });
    }

    function silabasDe(elementos, estrofe) {
      var lista = [];
      var donos = [];
      elementos.forEach(function (elemento) {
        var dono = elemento.closest('g.chord') || elemento;
        if (donos.indexOf(dono) < 0) donos.push(dono);
      });
      donos.forEach(function (dono) {
        var versos = Array.prototype.slice.call(dono.querySelectorAll('g.verse'));
        var daEstrofe = versos.filter(function (verso) { return verso.dataset.n === estrofe; });
        lista = lista.concat(daEstrofe.length || !estrofe ? daEstrofe : versos.length === 1 ? versos : []);
      });
      return lista;
    }

    function moverCursor(elementos) {
      if (!elementos.length) {
        if (cursor) cursor.setAttribute('visibility', 'hidden');
        return;
      }
      var sistema = elementos[0].closest('g.system');
      if (!sistema) return;
      var esquerda = Infinity;
      var direita = -Infinity;
      elementos.forEach(function (elemento) {
        var cabeca = elemento.querySelector('.notehead') || elemento;
        var caixa = cabeca.getBBox();
        esquerda = Math.min(esquerda, caixa.x);
        direita = Math.max(direita, caixa.x + caixa.width);
      });
      var area = sistema.getBBox();
      var folga = (direita - esquerda) * 0.6;
      if (!cursor) {
        cursor = document.createElementNS(SVG, 'rect');
        cursor.setAttribute('class', 'partitura-cursor');
      }
      if (cursor.parentNode !== sistema) sistema.insertBefore(cursor, sistema.firstChild);
      cursor.setAttribute('x', esquerda - folga);
      cursor.setAttribute('y', area.y);
      cursor.setAttribute('width', direita - esquerda + 2 * folga);
      cursor.setAttribute('height', area.height);
      cursor.setAttribute('rx', folga);
      cursor.setAttribute('visibility', 'visible');
    }

    function trocarClasse(antes, agora, classe) {
      antes.forEach(function (elemento) {
        if (agora.indexOf(elemento) < 0) elemento.classList.remove(classe);
      });
      agora.forEach(function (elemento) { elemento.classList.add(classe); });
    }

    function marcar(posicao) {
      var agora = posicao === null ? [] : notas.filter(function (nota) {
        return nota.inicio <= posicao.tempo + 1e-6 && posicao.tempo < nota.fim - 1e-6;
      }).map(function (nota) { return nota.elemento; });
      var cantadas = posicao === null || !marcarLetra ? [] : silabasDe(agora, posicao.estrofe);
      trocarClasse(marcadas, agora, 'tocando');
      trocarClasse(silabas, cantadas, 'cantando');
      marcadas = agora;
      silabas = cantadas;
      moverCursor(agora);
      if (agora.length) mostrarSistema(agora[0]);
    }

    function aplicarEstudo() {
      var todas = vozesAtivas.every(function (ativa) { return ativa; });
      folhas.classList.toggle('estudando', !todas);
      Array.prototype.slice.call(folhas.querySelectorAll('g.note[data-vozes]')).forEach(function (nota) {
        var emEstudo = nota.dataset.vozes.split(' ').some(function (voz) { return vozesAtivas[Number(voz)]; });
        nota.classList.toggle('em-estudo', !todas && emEstudo);
        nota.classList.toggle('apagada', !todas && !emEstudo);
      });
      var nomes = NOMES_DAS_VOZES.filter(function (nome, indice) { return vozesAtivas[indice]; });
      var lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
      barraEstudo.hidden = todas;
      rotuloEstudo.textContent = 'Estudando: ' + lista;
    }

    function mostrarAfinacao() {
      afinacoes.forEach(function (botao) { botao.setAttribute('aria-pressed', botao === afinacao ? 'true' : 'false'); });
    }

    afinacoes.forEach(function (botao) {
      botao.addEventListener('click', function () {
        if (botao === afinacao) return;
        afinacao = botao;
        gravar('afinacao', afinacao.dataset.afinacao);
        mostrarAfinacao();
        if (toolkit && partitura) desenhar();
      });
    });

    Array.prototype.slice.call(document.querySelectorAll('[data-partitura-escala]')).forEach(function (botao) {
      botao.addEventListener('click', function () {
        escala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, escalaAtual() + Number(botao.dataset.partituraEscala)));
        gravar('partitura-escala', escala);
        mostrarEscala();
        if (toolkit && partitura) desenhar();
      }, { signal: sinal });
    });

    window.addEventListener('beforeprint', function () {
      if (!toolkit || !partitura || imprimindo) return;
      imprimindo = true;
      desenharParaImprimir();
    }, { signal: sinal });

    window.addEventListener('afterprint', function () {
      if (!imprimindo) return;
      imprimindo = false;
      if (toolkit && partitura) desenhar();
    }, { signal: sinal });

    document.addEventListener('hino:posicao', function (evento) {
      ultimaPosicao = evento.detail.seminimas;
      if (toolkit && partitura && !imprimindo) marcar(posicaoNaPartitura(ultimaPosicao));
    }, { signal: sinal });

    document.addEventListener('hino:marcar-letra', function (evento) {
      marcarLetra = evento.detail;
      if (toolkit && partitura) marcar(posicaoNaPartitura(ultimaPosicao));
    }, { signal: sinal });

    document.addEventListener('hino:vozes', function (evento) {
      vozesAtivas = evento.detail;
      aplicarEstudo();
    }, { signal: sinal });

    document.addEventListener('hino:tom', function (evento) {
      if (tomDoPlayer === evento.detail) return;
      tomDoPlayer = evento.detail;
      if (toolkit && partitura) desenhar();
    }, { signal: sinal });

    var espera = null;
    window.addEventListener('resize', function () {
      clearTimeout(espera);
      espera = setTimeout(function () {
        if (toolkit && partitura && !imprimindo && Math.abs(folhas.clientWidth - largura) > 30) desenhar();
      }, 250);
    }, { signal: sinal });

    mostrarAfinacao();
    mostrarEscala();

    Promise.all([
      carregarVerovio(),
      fetch(raiz.dataset.musicxml).then(function (resposta) { return resposta.text(); }),
      fetch(raiz.dataset.sincronia).then(function (resposta) { return resposta.json(); }).catch(function () { return null; })
    ]).then(function (resultados) {
      if (sinal.aborted) return;
      partitura = resultados[1];
      sincronia = resultados[2];
      desenhar();
    }).catch(function () {
      if (sinal.aborted) return;
      estado.textContent = navigator.onLine ? 'Não foi possível carregar a partitura.' : 'A partitura precisa de internet na primeira vez.';
    });
  }

  hinario.modulos.push(iniciar);
  iniciar(hinario.controle.signal);
})();
