(function () {
  var player = document.querySelector('[data-player]');
  if (!player) return;

  var BIBLIOTECAS = [
    'https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js',
    'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.js'
  ];

  var botaoTocar = player.querySelector('[data-player-tocar]');
  var estado = player.querySelector('[data-player-estado]');
  var progresso = player.querySelector('[data-player-progresso]');
  var tempoAtual = player.querySelector('[data-player-atual]');
  var tempoTotal = player.querySelector('[data-player-total]');
  var andamentoTexto = player.querySelector('[data-player-andamento]');
  var estrofes = Array.prototype.slice.call(document.querySelectorAll('.letra li'));

  var carregado = null;
  var vozes = [];
  var sintetizadores = [];
  var duracao = 0;
  var marcadores = [];
  var andamentoBase = 100;
  var andamento = 100;
  var voz = 'todas';
  var posicao = 0;
  var inicio = 0;
  var tocando = false;
  var quadro = null;
  var trava = null;

  function carregarScript(endereco) {
    return new Promise(function (resolver, rejeitar) {
      var script = document.createElement('script');
      script.src = endereco;
      script.onload = resolver;
      script.onerror = rejeitar;
      document.head.appendChild(script);
    });
  }

  function carregar() {
    if (!carregado) {
      estado.textContent = 'Carregando…';
      carregado = BIBLIOTECAS.reduce(function (anterior, endereco) {
        return anterior.then(function () { return carregarScript(endereco); });
      }, Promise.resolve())
        .then(function () { return fetch(player.dataset.midi); })
        .then(function (resposta) { return resposta.arrayBuffer(); })
        .then(function (dados) {
          var midi = new Midi(dados);
          vozes = midi.tracks.filter(function (faixa) { return faixa.notes.length; }).slice(0, 4);
          duracao = midi.duration;
          marcadores = midi.header.meta
            .filter(function (evento) { return evento.type === 'marker'; })
            .map(function (evento) { return { texto: evento.text, tempo: midi.header.ticksToSeconds(evento.ticks) }; })
            .sort(function (a, b) { return a.tempo - b.tempo; });
          andamentoBase = Math.round(midi.header.tempos.length ? midi.header.tempos[0].bpm : 100);
          andamento = andamentoBase;
          sintetizadores = vozes.map(function () {
            return new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'custom', partials: [1, 0.5, 0.3, 0.2, 0.1] },
              envelope: { attack: 0.03, decay: 0.2, sustain: 0.8, release: 0.4 },
              volume: -14
            }).toDestination();
          });
          tempoTotal.textContent = formatar(duracao);
          mostrarAndamento();
        })
        .catch(function () {
          carregado = null;
          estado.textContent = 'Não foi possível carregar o áudio';
          throw new Error('player');
        });
    }
    return carregado;
  }

  function formatar(segundos) {
    var s = Math.max(0, Math.floor(segundos));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function razao() {
    return andamento / andamentoBase;
  }

  function posicaoAtual() {
    return tocando ? posicao + (Tone.now() - inicio) * razao() : posicao;
  }

  function mostrarAndamento() {
    andamentoTexto.textContent = '♩ ' + andamento;
  }

  function soltar() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    sintetizadores.forEach(function (sintetizador) { sintetizador.releaseAll(); });
  }

  function agendar() {
    soltar();
    var r = razao();
    vozes.forEach(function (faixa, indice) {
      if (voz !== 'todas' && Number(voz) !== indice) return;
      var sintetizador = sintetizadores[indice];
      faixa.notes.forEach(function (nota) {
        if (nota.time < posicao) return;
        Tone.Transport.schedule(function (quando) {
          sintetizador.triggerAttackRelease(nota.name, nota.duration / r, quando, nota.velocity);
        }, (nota.time - posicao) / r);
      });
    });
    Tone.Transport.schedule(function () {
      Tone.Draw.schedule(terminar, Tone.now());
    }, (duracao - posicao) / r + 0.5);
    inicio = Tone.now();
    Tone.Transport.start();
  }

  function marcarEstrofe(atual) {
    estrofes.forEach(function (li, indice) {
      li.classList.toggle('atual', indice === atual);
    });
  }

  function atualizar() {
    var agora = Math.min(duracao, posicaoAtual());
    progresso.style.width = (duracao ? (agora / duracao) * 100 : 0) + '%';
    tempoAtual.textContent = formatar(agora);
    var marcador = marcadores.filter(function (item) { return item.tempo <= agora; }).pop();
    var texto = marcador ? marcador.texto : '';
    var estrofe = /^Estrofe (\d+)$/.exec(texto);
    var total = marcadores.filter(function (item) { return /^Estrofe /.test(item.texto); }).length;
    if (estrofe) {
      estado.textContent = 'Tocando a estrofe ' + estrofe[1] + ' de ' + total;
      marcarEstrofe(Number(estrofe[1]) - 1);
    } else {
      estado.textContent = texto || 'Tocando';
      marcarEstrofe(-1);
    }
    if (tocando) quadro = requestAnimationFrame(atualizar);
  }

  function tocar() {
    carregar().then(function () {
      return Tone.start();
    }).then(function () {
      if (posicao >= duracao) posicao = 0;
      tocando = true;
      player.classList.add('tocando');
      botaoTocar.setAttribute('aria-label', 'Pausar');
      agendar();
      atualizar();
    }).catch(function () {});
  }

  function pausar() {
    posicao = posicaoAtual();
    tocando = false;
    soltar();
    cancelAnimationFrame(quadro);
    player.classList.remove('tocando');
    botaoTocar.setAttribute('aria-label', 'Tocar');
    estado.textContent = 'Pausado';
  }

  function terminar() {
    pausar();
    posicao = duracao;
    estado.textContent = 'Fim';
    progresso.style.width = '100%';
    marcarEstrofe(-1);
  }

  function reiniciarSeTocando(mudanca) {
    var estava = tocando;
    if (estava) posicao = posicaoAtual();
    mudanca();
    if (estava) {
      agendar();
    }
  }

  botaoTocar.addEventListener('click', function () {
    if (tocando) pausar(); else tocar();
  });

  Array.prototype.slice.call(player.querySelectorAll('[data-voz]')).forEach(function (botao, _, botoes) {
    botao.addEventListener('click', function () {
      reiniciarSeTocando(function () {
        voz = botao.dataset.voz;
        botoes.forEach(function (outro) {
          outro.setAttribute('aria-pressed', outro === botao ? 'true' : 'false');
        });
      });
    });
  });

  Array.prototype.slice.call(player.querySelectorAll('[data-andamento]')).forEach(function (botao) {
    botao.addEventListener('click', function () {
      carregar().then(function () {
        reiniciarSeTocando(function () {
          andamento = Math.min(160, Math.max(30, andamento + Number(botao.dataset.andamento)));
          mostrarAndamento();
        });
      }).catch(function () {});
    });
  });

  var telaLigada = player.querySelector('[data-tela-ligada]');
  if (!('wakeLock' in navigator)) {
    telaLigada.closest('label').hidden = true;
  }

  function pedirTrava() {
    navigator.wakeLock.request('screen').then(function (nova) {
      trava = nova;
    }).catch(function () {
      telaLigada.checked = false;
    });
  }

  telaLigada.addEventListener('change', function () {
    if (telaLigada.checked) {
      pedirTrava();
    } else if (trava) {
      trava.release();
      trava = null;
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && telaLigada.checked) pedirTrava();
  });
})();
