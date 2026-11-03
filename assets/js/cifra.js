(function () {
  var hinario = window.Hinario || (window.Hinario = { controle: new AbortController(), modulos: [] });

  function iniciar(sinal) {
    var cifra = document.querySelector('[data-cifra]');
    if (!cifra) return;

    var NOTAS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0 };
    var BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    var SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var MISTO = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    var TONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    var FORMAS_FACEIS = [0, 2, 4, 7, 9];
    var ACORDE = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
    var QUALIDADES = {
      '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6],
      dim7: [0, 3, 6, 9], 'º': [0, 3, 6, 9], '°': [0, 3, 6, 9], sus4: [0, 5, 7], sus2: [0, 2, 7],
      '7M': [0, 4, 7, 11], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 2],
      add9: [0, 4, 7, 2], '7sus4': [0, 5, 7, 10], aug: [0, 4, 8], '+': [0, 4, 8], m7b5: [0, 3, 6, 10]
    };
    var APELIDOS = { M: '', maj: '', min: 'm', '-': 'm', '7+': '7M', 4: 'sus4', '7/4': '7sus4', 'ø': 'm7b5' };
    var ABERTOS = {
      C: [-1, 3, 2, 0, 1, 0], C7: [-1, 3, 2, 3, 1, 0], C7M: [-1, 3, 2, 0, 0, 0],
      D: [-1, -1, 0, 2, 3, 2], Dm: [-1, -1, 0, 2, 3, 1], D7: [-1, -1, 0, 2, 1, 2], Dm7: [-1, -1, 0, 2, 1, 1],
      Dsus4: [-1, -1, 0, 2, 3, 3], D7M: [-1, -1, 0, 2, 2, 2],
      E: [0, 2, 2, 1, 0, 0], Em: [0, 2, 2, 0, 0, 0], E7: [0, 2, 0, 1, 0, 0], Em7: [0, 2, 0, 0, 0, 0], Esus4: [0, 2, 2, 2, 0, 0],
      G: [3, 2, 0, 0, 0, 3], G7: [3, 2, 0, 0, 0, 1],
      A: [-1, 0, 2, 2, 2, 0], Am: [-1, 0, 2, 2, 1, 0], A7: [-1, 0, 2, 0, 2, 0], Am7: [-1, 0, 2, 0, 1, 0],
      Asus4: [-1, 0, 2, 2, 3, 0], A7M: [-1, 0, 2, 1, 2, 0],
      B7: [-1, 2, 1, 2, 0, 2]
    };
    var FORMA_MI = { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
      sus4: [0, 2, 2, 2, 0, 0], '7M': [0, -1, 1, 1, 0, -1], 6: [0, -1, 1, 1, 2, -1], '7sus4': [0, 2, 0, 2, 0, 0] };
    var FORMA_LA = { '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], 7: [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0],
      sus4: [-1, 0, 2, 2, 3, 0], '7M': [-1, 0, 2, 1, 2, 0], dim: [-1, 0, 1, 2, 1, -1], 6: [-1, 0, 2, 2, 2, 2],
      m6: [-1, 0, 2, 2, 1, 2], m7b5: [-1, 0, 1, 0, 1, -1], dim7: [-1, 0, 1, 2, 1, 2], 9: [-1, 0, -1, 0, 0, 0],
      add9: [-1, 0, 2, 4, 2, 0], aug: [-1, 0, 3, 2, 2, -1], sus2: [-1, 0, 2, 2, 0, 0], '7sus4': [-1, 0, 2, 0, 3, 0] };
    var SVG = 'http://www.w3.org/2000/svg';

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

    var tomOriginal = NOTAS[cifra.dataset.tom];
    var deslocamento = 0;
    var capotraste = null;
    var instrumento = ler('cifra-instrumento', 'violao') === 'teclado' ? 'teclado' : 'violao';
    var acordesNaTela = todos('.acorde[data-acorde], .acorde-nome', cifra);
    var cartoes = todos('[data-acorde-cartao]', cifra);
    var linhaCapotraste = document.querySelector('[data-cifra-capotraste]');

    function nomesDoTom(classe) {
      var tom = TONS[classe];
      if (['F', 'Bb', 'Eb', 'Ab', 'Db'].indexOf(tom) >= 0) return BEMOIS;
      if (['G', 'D', 'A', 'E', 'B', 'F#'].indexOf(tom) >= 0) return SUSTENIDOS;
      return MISTO;
    }

    function transpor(acorde, semitons, nomes) {
      var m = ACORDE.exec(acorde);
      if (!m || !(m[1] in NOTAS)) return acorde;
      var raiz = nomes[(NOTAS[m[1]] + semitons + 120) % 12];
      var baixo = m[3] && m[3] in NOTAS ? '/' + nomes[(NOTAS[m[3]] + semitons + 120) % 12] : '';
      return raiz + m[2] + baixo;
    }

    function tomSoando() {
      return (tomOriginal + deslocamento + 120) % 12;
    }

    function capotrasteSugerido() {
      for (var casa = 0; casa <= 5; casa++) {
        if (FORMAS_FACEIS.indexOf((tomSoando() - casa + 12) % 12) >= 0) return casa;
      }
      return 0;
    }

    function casasDoCapotraste() {
      if (instrumento !== 'violao') return 0;
      return capotraste === null ? capotrasteSugerido() : capotraste;
    }

    function atualizar() {
      var casas = casasDoCapotraste();
      var formas = (tomSoando() - casas + 12) % 12;
      var nomes = nomesDoTom(formas);
      acordesNaTela.forEach(function (elemento) {
        elemento.textContent = transpor(elemento.dataset.acorde, deslocamento - casas, nomes);
      });
      if (linhaCapotraste) {
        linhaCapotraste.querySelector('[data-cifra-capo-nome]').textContent = casas ? casas + 'ª casa' : 'sem';
        linhaCapotraste.hidden = instrumento !== 'violao';
      }
      todos('[data-cifra-instrumento]').forEach(function (botao) {
        botao.setAttribute('aria-pressed', botao.dataset.cifraInstrumento === instrumento ? 'true' : 'false');
      });
      desenharAcordes();
    }

    document.addEventListener('hino:tom', function (evento) {
      if (deslocamento === evento.detail) return;
      deslocamento = evento.detail;
      atualizar();
    }, { signal: sinal });

    todos('[data-cifra-capo]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        capotraste = Math.min(9, Math.max(0, casasDoCapotraste() + Number(botao.dataset.cifraCapo)));
        atualizar();
      }, { signal: sinal });
    });

    todos('[data-cifra-instrumento]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        instrumento = botao.dataset.cifraInstrumento;
        gravar('cifra-instrumento', instrumento);
        atualizar();
      }, { signal: sinal });
    });

    function analisar(nome) {
      var m = ACORDE.exec(nome);
      if (!m || !(m[1] in NOTAS)) return null;
      var qualidade = m[2].replace(/[()]/g, '');
      qualidade = qualidade in APELIDOS ? APELIDOS[qualidade] : qualidade;
      if (!(qualidade in QUALIDADES)) return null;
      return { raiz: NOTAS[m[1]], qualidade: qualidade, baixo: m[3] && m[3] in NOTAS ? NOTAS[m[3]] : null, nomeBaixo: m[3] || null };
    }

    function desenhoNoViolao(acorde) {
      var abertos = Object.keys(ABERTOS);
      for (var i = 0; i < abertos.length; i++) {
        var aberto = analisar(abertos[i]);
        if (aberto.raiz === acorde.raiz && aberto.qualidade === acorde.qualidade) return { casas: ABERTOS[abertos[i]], pestana: null };
      }
      var opcoes = [];
      if (acorde.qualidade in FORMA_MI) {
        var casaMi = (acorde.raiz - 4 + 12) % 12 || 12;
        opcoes.push({ pestana: casaMi, casas: FORMA_MI[acorde.qualidade].map(function (c) { return c >= 0 ? c + casaMi : -1; }) });
      }
      if (acorde.qualidade in FORMA_LA) {
        var casaLa = (acorde.raiz - 9 + 12) % 12 || 12;
        opcoes.push({ pestana: casaLa, casas: [-1].concat(FORMA_LA[acorde.qualidade].slice(1).map(function (c) { return c >= 0 ? c + casaLa : -1; })) });
      }
      if (!opcoes.length) return null;
      return opcoes.sort(function (a, b) { return a.pestana - b.pestana; })[0];
    }

    function elemento(nome, atributos, texto) {
      var el = document.createElementNS(SVG, nome);
      Object.keys(atributos).forEach(function (chave) { el.setAttribute(chave, atributos[chave]); });
      if (texto !== undefined) el.textContent = texto;
      return el;
    }

    function svgDoViolao(desenho, nome) {
      var svg = elemento('svg', { viewBox: '0 0 140 170', width: '168', height: '204', role: 'img', 'aria-label': 'Desenho do acorde ' + nome + ' no violão' });
      var tocadas = desenho.casas.filter(function (c) { return c > 0; });
      var inicio = desenho.pestana || (Math.max.apply(null, tocadas.concat([0])) > 4 ? Math.min.apply(null, tocadas) : 1);
      var x = function (corda) { return 25 + corda * 18; };
      var y = function (casa) { return 30 + (casa - inicio + 0.5) * 26; };
      for (var c = 0; c < 6; c++) svg.appendChild(elemento('line', { x1: x(c), y1: 30, x2: x(c), y2: 160, class: 'corda' }));
      for (var t = 0; t <= 5; t++) svg.appendChild(elemento('line', { x1: x(0), y1: 30 + t * 26, x2: x(5), y2: 30 + t * 26, class: t === 0 && inicio === 1 ? 'pestana-zero' : 'traste' }));
      if (inicio > 1) svg.appendChild(elemento('text', { x: 4, y: y(inicio) + 5, class: 'casa' }, inicio + 'ª'));
      if (desenho.pestana) {
        var cordas = desenho.casas.map(function (casa, corda) { return casa === desenho.pestana ? corda : -1; }).filter(function (corda) { return corda >= 0; });
        if (cordas.length > 1) svg.appendChild(elemento('rect', { x: x(cordas[0]) - 7, y: y(desenho.pestana) - 7, width: x(cordas[cordas.length - 1]) - x(cordas[0]) + 14, height: 14, rx: 7, class: 'dedo' }));
      }
      desenho.casas.forEach(function (casa, corda) {
        if (casa < 0) svg.appendChild(elemento('text', { x: x(corda), y: 22, class: 'marca' }, '×'));
        else if (casa === 0) svg.appendChild(elemento('circle', { cx: x(corda), cy: 17, r: 5, class: 'solta' }));
        else svg.appendChild(elemento('circle', { cx: x(corda), cy: y(casa), r: 7, class: 'dedo' }));
      });
      return svg;
    }

    function notasDoAcorde(acorde) {
      var notas = QUALIDADES[acorde.qualidade].map(function (intervalo) { return (acorde.raiz + intervalo) % 12; });
      if (acorde.baixo !== null) notas = [acorde.baixo].concat(notas.filter(function (n) { return n !== acorde.baixo; }));
      return notas;
    }

    function svgDoTeclado(notas, nome) {
      var svg = elemento('svg', { viewBox: '0 0 224 92', width: '268', height: '110', role: 'img', 'aria-label': 'Notas do acorde ' + nome + ' no teclado' });
      var brancas = [0, 2, 4, 5, 7, 9, 11];
      var pretas = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
      var alturas = [];
      var anterior = -1;
      notas.forEach(function (nota) {
        var altura = nota;
        while (altura <= anterior) altura += 12;
        if (altura >= 24) altura -= 12;
        alturas.push(altura);
        anterior = altura;
      });
      for (var tecla = 0; tecla < 14; tecla++) {
        var altura = Math.floor(tecla / 7) * 12 + brancas[tecla % 7];
        svg.appendChild(elemento('rect', { x: tecla * 16, y: 0, width: 16, height: 90, class: alturas.indexOf(altura) >= 0 ? 'tecla-branca marcada' : 'tecla-branca' }));
      }
      for (var oitava = 0; oitava < 2; oitava++) {
        Object.keys(pretas).forEach(function (classe) {
          var alturaPreta = oitava * 12 + Number(classe);
          svg.appendChild(elemento('rect', { x: (oitava * 7 + pretas[classe]) * 16 + 11, y: 0, width: 10, height: 56, class: alturas.indexOf(alturaPreta) >= 0 ? 'tecla-preta marcada' : 'tecla-preta' }));
        });
      }
      return svg;
    }

    function desenhar(cartao) {
      var nome = cartao.querySelector('.acorde-nome').textContent;
      var area = cartao.querySelector('[data-acorde-desenho]');
      var acorde = analisar(nome);
      area.textContent = '';
      cartao.classList.toggle('acorde-teclado', instrumento !== 'violao');
      if (!acorde) return;
      var formaViolao = instrumento === 'violao' ? desenhoNoViolao(acorde) : null;
      area.appendChild(formaViolao ? svgDoViolao(formaViolao, nome) : svgDoTeclado(notasDoAcorde(acorde), nome));
    }

    function desenharAcordes() {
      cartoes.forEach(desenhar);
    }

    atualizar();
  }

  hinario.modulos.push(iniciar);
  iniciar(hinario.controle.signal);
})();
