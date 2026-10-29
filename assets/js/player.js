(function () {
  var player = document.querySelector('[data-player]');
  if (!player) return;

  if (navigator.audioSession) {
    try { navigator.audioSession.type = 'playback'; } catch (e) {}
  }

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
  var letra = document.querySelector('.letra');
  var estrofes = Array.prototype.slice.call(document.querySelectorAll('.letra li'));
  var VOGAIS = 'aeiouáàâãéêíóôõúü';
  var DITONGO = /^(ai|au|ei|eu|éi|éu|oi|ói|ou|ui|iu|ão|ãe|õe|ãi)$/;
  var CUSTO_ACEITO = 4;
  var CUSTO_POR_LINHA = 0.7;

  function separarVersos(elemento) {
    return Array.prototype.slice.call(elemento.querySelectorAll('.verso'));
  }

  var versosDasEstrofes = estrofes.map(separarVersos);
  var versosDoCoro = Array.prototype.slice.call(document.querySelectorAll('.letra > p')).reduce(function (versos, p) {
    return versos.concat(separarVersos(p));
  }, []);
  var inicioDosVersos = [];
  var blocosDaLetra = [];
  Array.prototype.slice.call(letra ? letra.children : []).forEach(function (elemento) {
    if (elemento.tagName === 'OL') {
      Array.prototype.slice.call(elemento.children).forEach(function (li) {
        var indice = estrofes.indexOf(li);
        blocosDaLetra.push({ tipo: 'estrofe', estrofe: indice, versos: versosDasEstrofes[indice] });
      });
    } else if (elemento.tagName === 'P') {
      blocosDaLetra.push({ tipo: 'coro', estrofe: -1, versos: Array.prototype.slice.call(elemento.querySelectorAll('.verso')) });
    }
  });
  var linhasDoHino = null;

  function faixaDeSilabas(linha) {
    var texto = linha.toLowerCase()
      .replace(/qu([ei])/g, 'q$1')
      .replace(/gu([ei])/g, 'g$1')
      .replace(/[^a-záàâãéêíóôõúüç\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    var palavras = texto.split(' ').filter(Boolean);
    var maximo = 0;
    var reducoes = 0;
    palavras.forEach(function (palavra, indice) {
      (palavra.match(new RegExp('[' + VOGAIS + ']+', 'g')) || []).forEach(function (grupo) {
        if (grupo.length === 1 || DITONGO.test(grupo)) {
          maximo += 1;
        } else {
          maximo += grupo.length;
          reducoes += grupo.length - 1;
        }
      });
      var seguinte = palavras[indice + 1];
      if (seguinte && new RegExp('[' + VOGAIS + ']$').test(palavra) && new RegExp('^h?[' + VOGAIS + ']').test(seguinte)) reducoes += 1;
    });
    return [Math.max(1, maximo - reducoes), maximo];
  }

  function alinhar(notas, linhas, ppq, limite) {
    var total = notas.length;
    var fimDeFrase = notas.map(function (nota, indice) {
      var seguinte = notas[indice + 1];
      return indice === total - 1 || nota.durationTicks >= 1.5 * ppq || (seguinte && seguinte.ticks - (nota.ticks + nota.durationTicks) >= ppq / 4);
    });
    var faixas = linhas.map(faixaDeSilabas);
    var custo = [];
    var volta = [];
    for (var i = 0; i <= linhas.length; i++) {
      custo.push(new Array(total + 1).fill(Infinity));
      volta.push(new Array(total + 1).fill(-1));
    }
    custo[0][0] = 0;
    for (i = 1; i <= linhas.length; i++) {
      var minimo = faixas[i - 1][0];
      var maximo = faixas[i - 1][1];
      for (var fim = 1; fim <= total; fim++) {
        for (var comeco = Math.max(0, fim - maximo - 6); comeco < fim; comeco++) {
          if (custo[i - 1][comeco] === Infinity) continue;
          var tamanho = fim - comeco;
          var c = tamanho < minimo ? (minimo - tamanho) * 3 : tamanho > maximo ? tamanho - maximo : 0;
          if (!fimDeFrase[fim - 1]) c += 2;
          if (custo[i - 1][comeco] + c < custo[i][fim]) {
            custo[i][fim] = custo[i - 1][comeco] + c;
            volta[i][fim] = comeco;
          }
        }
      }
    }
    if (custo[linhas.length][total] > limite) return null;
    var cortes = [];
    var posicaoCorte = total;
    for (i = linhas.length; i > 0; i--) {
      posicaoCorte = volta[i][posicaoCorte];
      cortes.unshift(posicaoCorte);
    }
    var trechos = cortes.map(function (corte, indice) {
      var proximoCorte = indice + 1 < cortes.length ? cortes[indice + 1] : total;
      var notasDoVerso = notas.slice(corte, proximoCorte);
      var ultima = notasDoVerso[notasDoVerso.length - 1];
      return {
        notas: notasDoVerso.map(function (nota) { return nota.time; }),
        fim: proximoCorte < total ? notas[proximoCorte].time : ultima.time + ultima.duration
      };
    });
    trechos.custo = custo[linhas.length][total];
    return trechos;
  }

  function progressoDoVerso(verso, agora) {
    var total = verso.notas.length;
    for (var i = 0; i < total; i++) {
      var fimDaNota = i + 1 < total ? verso.notas[i + 1] : verso.fim;
      if (agora < fimDaNota) return Math.max(0, (i + (agora - verso.notas[i]) / (fimDaNota - verso.notas[i])) / total);
    }
    return 1;
  }

  function ordensPossiveis() {
    var soEstrofes = blocosDaLetra.filter(function (bloco) { return bloco.tipo === 'estrofe'; });
    var coros = blocosDaLetra.filter(function (bloco) { return bloco.tipo === 'coro'; });
    var ordens = [blocosDaLetra];
    if (!coros.length) return ordens;
    var coroDepoisDeCada = [];
    var coroVigente = null;
    blocosDaLetra.forEach(function (bloco, indice) {
      if (bloco.tipo !== 'estrofe') return;
      var seguintes = [];
      for (var j = indice + 1; j < blocosDaLetra.length && blocosDaLetra[j].tipo === 'coro'; j++) seguintes.push(blocosDaLetra[j]);
      if (seguintes.length) coroVigente = seguintes;
      coroDepoisDeCada = coroDepoisDeCada.concat([bloco], coroVigente || [coros[0]]);
    });
    ordens.push(coroDepoisDeCada, soEstrofes.concat(coros));
    return ordens;
  }

  function alinharHinoInteiro(midi, soprano) {
    var primeira = marcadores.filter(function (marcador) { return /^Estrofe /.test(marcador.texto); })[0];
    if (!primeira) return;
    var notas = soprano.notes.filter(function (nota) { return nota.time >= primeira.tempo - 0.001; });
    var melhor = null;
    ordensPossiveis().forEach(function (ordem) {
      var partes = [];
      ordem.forEach(function (bloco) {
        bloco.versos.forEach(function (verso) { partes.push({ verso: verso, estrofe: bloco.estrofe }); });
      });
      if (!partes.length || notas.length < partes.length) return;
      var trechos = alinhar(notas, partes.map(function (parte) { return parte.verso.textContent; }), midi.header.ppq, partes.length * CUSTO_POR_LINHA);
      if (!trechos) return;
      var custoPorLinha = trechos.custo / partes.length;
      if (melhor && melhor.custoPorLinha <= custoPorLinha) return;
      melhor = { custoPorLinha: custoPorLinha, partes: partes, trechos: trechos };
    });
    if (!melhor) return;
    linhasDoHino = melhor.partes.map(function (parte, indice) {
      return { verso: parte.verso, estrofe: parte.estrofe, notas: melhor.trechos[indice].notas, fim: melhor.trechos[indice].fim };
    });
  }

  function alinharEstrofes(midi) {
    var soprano = vozes[0];
    if (!soprano) return;
    if (estrofes.length) {
      alinharHinoInteiro(midi, soprano);
      if (linhasDoHino) return;
    }
    marcadores.forEach(function (marcador, indice) {
      var numero = /^Estrofe (\d+)$/.exec(marcador.texto);
      if (!numero) return;
      var estrofe = Number(numero[1]) - 1;
      var versos = (versosDasEstrofes[estrofe] || []).concat(versosDoCoro);
      if (!versos.length) return;
      var proximo = marcadores[indice + 1];
      var notas = soprano.notes.filter(function (nota) {
        return nota.time >= marcador.tempo - 0.001 && (!proximo || nota.time < proximo.tempo - 0.001);
      });
      if (notas.length < versos.length) return;
      inicioDosVersos[estrofe] = alinhar(notas, versos.map(function (verso) { return verso.textContent; }), midi.header.ppq, CUSTO_ACEITO);
    });
  }

  var carregado = null;
  var vozes = [];
  var sintetizadores = [];
  var duracao = 0;
  var marcadores = [];
  var andamentoBase = 100;
  var andamento = 100;
  var vozesAtivas = [true, true, true, true];
  var TONS = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Sol♭', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
  var tomOriginal = TONS.indexOf(player.dataset.tomDoHino);
  var transposicao = 0;
  var introducaoBloco = document.querySelector('[data-introducao]');
  var introducaoProgresso = document.querySelector('[data-introducao-progresso]');
  var introducaoFechada = false;
  var ANTECEDENCIA_DO_AVISO = 1.5;
  var ESPERA_ANTES_DA_INTRODUCAO = 800;
  var clique = null;
  var batidas = [];
  var metronomoLigado = false;
  var iniciando = false;
  var barra = player.querySelector('[data-player-barra]');
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
        .then(function () { return arquivoMidi; })
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
          alinharEstrofes(midi);
          sintetizadores = vozes.map(function () {
            return new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'custom', partials: [1, 0.5, 0.3, 0.2, 0.1] },
              envelope: { attack: 0.03, decay: 0.2, sustain: 0.8, release: 0.4 },
              volume: -14
            }).toDestination();
          });
          clique = new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
            volume: -16
          }).toDestination();
          batidas = calcularBatidas(midi);
          Tone.getContext().rawContext.addEventListener('statechange', function () {
            if (tocando && Tone.getContext().rawContext.state !== 'running') pausar();
          });
          tempoTotal.textContent = formatar(duracao);
          mostrarAndamento();
        })
        .catch(function () {
          carregado = null;
          estado.textContent = navigator.onLine ? 'Não foi possível carregar o áudio' : 'O player precisa de internet';
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

  function andamentoGravado(dados) {
    var bytes = new Uint8Array(dados);
    for (var i = 0; i + 5 < bytes.length; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0x51 && bytes[i + 2] === 0x03) {
        return Math.round(60000000 / ((bytes[i + 3] << 16) | (bytes[i + 4] << 8) | bytes[i + 5]));
      }
    }
    return null;
  }

  var arquivoMidi = fetch(player.dataset.midi).then(function (resposta) { return resposta.arrayBuffer(); });
  arquivoMidi.then(function (dados) {
    var gravado = andamentoGravado(dados);
    if (!gravado || carregado) return;
    andamentoBase = gravado;
    andamento = gravado;
    mostrarAndamento();
  }).catch(function () {});

  function soltar() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    sintetizadores.forEach(function (sintetizador) { sintetizador.releaseAll(); });
  }

  function calcularBatidas(midi) {
    var ppq = midi.header.ppq;
    var fimTicks = midi.durationTicks;
    var compassos = midi.header.timeSignatures.length ? midi.header.timeSignatures : [{ ticks: 0, timeSignature: [4, 4] }];
    var lista = [];
    compassos.forEach(function (compasso, indice) {
      var inicioTicks = compasso.ticks;
      var proximo = compassos[indice + 1];
      var limite = proximo ? proximo.ticks : fimTicks;
      var numerador = compasso.timeSignature[0];
      var denominador = compasso.timeSignature[1];
      var tamanho = numerador * ppq * 4 / denominador;
      var batida = denominador === 8 && numerador % 3 === 0 && numerador > 3 ? ppq * 1.5 : ppq * 4 / denominador;
      for (var t = inicioTicks; t < limite; t += batida) {
        lista.push({ tempo: midi.header.ticksToSeconds(t), forte: (t - inicioTicks) % tamanho === 0 });
      }
    });
    return lista;
  }

  function agendar() {
    soltar();
    var r = razao();
    vozes.forEach(function (faixa, indice) {
      if (!vozesAtivas[indice]) return;
      var sintetizador = sintetizadores[indice];
      faixa.notes.forEach(function (nota) {
        if (nota.time < posicao) return;
        Tone.Transport.schedule(function (quando) {
          sintetizador.triggerAttackRelease(Tone.Frequency(nota.midi + transposicao, 'midi').toFrequency(), nota.duration / r, quando, nota.velocity);
        }, (nota.time - posicao) / r);
      });
    });
    if (metronomoLigado) {
      batidas.forEach(function (batida) {
        if (batida.tempo < posicao) return;
        Tone.Transport.schedule(function (quando) {
          clique.triggerAttackRelease(batida.forte ? 2000 : 1400, 0.03, quando);
        }, (batida.tempo - posicao) / r);
      });
    }
    Tone.Transport.schedule(function () {
      Tone.Draw.schedule(terminar, Tone.now());
    }, (duracao - posicao) / r + 0.5);
    inicio = Tone.now();
    Tone.Transport.start();
  }

  var estrofeMarcada = -1;
  var versoMarcado = null;

  function mostrarNaTela(elemento) {
    if (!elemento || !tocando) return;
    var caixa = elemento.getBoundingClientRect();
    if (caixa.top >= 0 && caixa.bottom <= window.innerHeight) return;
    var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elemento.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth', block: 'center' });
  }

  function marcarVerso(verso) {
    if (verso === versoMarcado) return;
    if (versoMarcado) versoMarcado.classList.remove('atual');
    versoMarcado = verso;
    if (verso) {
      verso.classList.add('atual');
      mostrarNaTela(verso);
    }
  }

  function destacarEstrofe(atual, porVerso) {
    var mudou = atual !== estrofeMarcada;
    estrofeMarcada = atual;
    estrofes.forEach(function (li, indice) {
      li.classList.toggle('atual', indice === atual);
      li.classList.toggle('por-verso', indice === atual && porVerso);
    });
    if (mudou) mostrarNaTela(estrofes[atual]);
  }

  function linhaCantada(agora) {
    if (!linhasDoHino || agora < linhasDoHino[0].notas[0]) return null;
    return linhasDoHino.filter(function (linha) { return linha.notas[0] <= agora; }).pop();
  }

  function marcarLinhaDoHino(linha, agora) {
    destacarEstrofe(linha.estrofe, true);
    if (letra) letra.classList.toggle('no-coro', linha.estrofe < 0);
    marcarVerso(linha.verso);
    linha.verso.style.setProperty('--progresso', (progressoDoVerso(linha, agora) * 100).toFixed(1) + '%');
  }

  function marcarEstrofe(atual, agora) {
    var inicios = inicioDosVersos[atual];
    if (letra) letra.classList.remove('no-coro');
    destacarEstrofe(atual, !!inicios);
    if (!inicios) {
      marcarVerso(null);
      return;
    }
    var versos = (versosDasEstrofes[atual] || []).concat(versosDoCoro);
    var indice = -1;
    inicios.forEach(function (verso, posicaoVerso) {
      if (verso.notas[0] <= agora) indice = posicaoVerso;
    });
    marcarVerso(versos[indice] || null);
    if (versoMarcado) {
      versoMarcado.style.setProperty('--progresso', (progressoDoVerso(inicios[indice], agora) * 100).toFixed(1) + '%');
    }
  }

  function atualizar() {
    var agora = Math.min(duracao, posicaoAtual());
    progresso.style.width = (duracao ? (agora / duracao) * 100 : 0) + '%';
    tempoAtual.textContent = formatar(agora);
    barra.setAttribute('aria-valuenow', Math.round(agora));
    barra.setAttribute('aria-valuetext', formatar(agora) + ' de ' + formatar(duracao));
    var marcador = marcadores.filter(function (item) { return item.tempo <= agora; }).pop();
    var texto = marcador ? marcador.texto : '';
    var estrofe = /^Estrofe (\d+)$/.exec(texto);
    var linha = linhaCantada(agora);
    if (linha) {
      marcarLinhaDoHino(linha, agora);
      estado.textContent = linha.estrofe < 0 ? 'Coro' : 'Estrofe ' + (linha.estrofe + 1);
    } else if (estrofe) {
      marcarEstrofe(Number(estrofe[1]) - 1, agora);
      var noCoro = !estrofes.length || versosDoCoro.indexOf(versoMarcado) >= 0;
      estado.textContent = noCoro ? 'Coro' : 'Estrofe ' + estrofe[1];
    } else if (texto === 'Repetição') {
      estado.textContent = 'Repetição';
    } else {
      estado.textContent = texto || 'Tocando';
      var antesDoCanto = texto === 'Introdução' && agora >= fimDoAviso();
      if (antesDoCanto && linhasDoHino) {
        marcarLinhaDoHino(linhasDoHino[0], agora);
      } else {
        marcarEstrofe(antesDoCanto ? 0 : -1, agora);
      }
    }
    mostrarIntroducao(texto === 'Introdução' && tocando && agora < fimDoAviso(), agora);
    if (tocando) quadro = requestAnimationFrame(atualizar);
  }

  function fimDoAviso() {
    var primeiraEstrofe = marcadores.filter(function (item) { return /^Estrofe /.test(item.texto); })[0];
    var inicioDoCanto = primeiraEstrofe ? primeiraEstrofe.tempo : duracao;
    return Math.max(0, inicioDoCanto - ANTECEDENCIA_DO_AVISO * razao());
  }

  function mostrarIntroducao(visivel, agora) {
    if (!introducaoBloco) return;
    visivel = visivel && !introducaoFechada;
    if (introducaoBloco.hidden === visivel) introducaoBloco.hidden = !visivel;
    if (!visivel) return;
    var fim = fimDoAviso();
    introducaoProgresso.style.width = (fim ? Math.min(100, (agora / fim) * 100) : 100).toFixed(1) + '%';
  }

  function nomeDaDistancia(semitons) {
    var meios = Math.abs(semitons);
    var tons = Math.floor(meios / 2);
    var partes = [];
    if (tons) partes.push(tons + (tons === 1 ? ' tom' : ' tons'));
    if (meios % 2) partes.push(tons ? 'meio' : 'meio tom');
    return partes.join(' e ') + (semitons < 0 ? ' abaixo' : ' acima') + ' do original';
  }

  function mostrarTom() {
    var nome = player.querySelector('[data-tom-nome]');
    var legenda = player.querySelector('[data-tom-legenda]');
    var voltar = player.querySelector('[data-tom-voltar]');
    if (tomOriginal >= 0) {
      nome.textContent = TONS[((tomOriginal + transposicao) % 12 + 12) % 12];
    } else {
      nome.textContent = transposicao === 0 ? 'original' : (transposicao > 0 ? '+' : '−') + Math.abs(transposicao);
    }
    legenda.hidden = transposicao === 0;
    voltar.hidden = transposicao === 0;
    if (transposicao !== 0) {
      legenda.textContent = nomeDaDistancia(transposicao) + (tomOriginal >= 0 ? ' (' + TONS[tomOriginal] + ')' : '');
    }
  }

  function tocar() {
    if (iniciando) return;
    if (posicao >= duracao) posicao = 0;
    var doComeco = posicao === 0;
    if (doComeco) {
      introducaoFechada = false;
      introducaoProgresso.style.width = '0%';
      if (introducaoBloco) introducaoBloco.hidden = false;
    }
    var espera = new Promise(function (resolver) {
      setTimeout(resolver, doComeco && introducaoBloco ? ESPERA_ANTES_DA_INTRODUCAO : 0);
    });
    iniciando = true;
    if (window.Tone) Tone.start();
    Promise.all([carregar(), espera]).then(function () {
      return Tone.start();
    }).then(function () {
      iniciando = false;
      if (introducaoFechada && introducaoBloco) introducaoBloco.hidden = true;
      tocando = true;
      player.classList.add('tocando');
      if (letra) letra.classList.add('tocando');
      botaoTocar.setAttribute('aria-label', 'Pausar');
      agendar();
      atualizar();
    }).catch(function () {
      iniciando = false;
      if (introducaoBloco) introducaoBloco.hidden = true;
    });
  }

  function pausar() {
    posicao = posicaoAtual();
    tocando = false;
    soltar();
    cancelAnimationFrame(quadro);
    player.classList.remove('tocando');
    if (letra) letra.classList.remove('tocando');
    botaoTocar.setAttribute('aria-label', 'Tocar');
    estado.textContent = 'Pausado';
    mostrarIntroducao(false, 0);
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

  function irPara(segundos) {
    reiniciarSeTocando(function () {
      posicao = Math.min(duracao, Math.max(0, segundos));
    });
    barra.setAttribute('aria-valuemax', Math.round(duracao));
    atualizar();
    if (!tocando) estado.textContent = 'Pausado';
  }

  barra.addEventListener('click', function (evento) {
    var caixa = barra.getBoundingClientRect();
    var fracao = (evento.clientX - caixa.left) / caixa.width;
    carregar().then(function () {
      irPara(fracao * duracao);
    }).catch(function () {});
  });

  barra.addEventListener('keydown', function (evento) {
    var passos = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 };
    if (!(evento.key in passos) && evento.key !== 'Home' && evento.key !== 'End') return;
    evento.preventDefault();
    carregar().then(function () {
      if (evento.key === 'Home') irPara(0);
      else if (evento.key === 'End') irPara(duracao);
      else irPara(posicaoAtual() + passos[evento.key]);
    }).catch(function () {});
  });

  function fecharIntroducao() {
    introducaoFechada = true;
    if (introducaoBloco) introducaoBloco.hidden = true;
  }

  var botaoFecharIntroducao = document.querySelector('[data-introducao-fechar]');
  if (botaoFecharIntroducao) botaoFecharIntroducao.addEventListener('click', fecharIntroducao);

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && introducaoBloco && !introducaoBloco.hidden) fecharIntroducao();
  });

  Array.prototype.slice.call(player.querySelectorAll('[data-voz]')).forEach(function (botao) {
    botao.addEventListener('click', function () {
      var indice = Number(botao.dataset.voz);
      var ligadas = vozesAtivas.filter(function (ativa) { return ativa; }).length;
      if (vozesAtivas[indice] && ligadas === 1) return;
      reiniciarSeTocando(function () {
        vozesAtivas[indice] = !vozesAtivas[indice];
        botao.setAttribute('aria-pressed', vozesAtivas[indice] ? 'true' : 'false');
      });
    });
  });

  Array.prototype.slice.call(player.querySelectorAll('[data-tom]')).forEach(function (botao) {
    botao.addEventListener('click', function () {
      reiniciarSeTocando(function () {
        transposicao = Math.min(6, Math.max(-6, transposicao + Number(botao.dataset.tom)));
        mostrarTom();
      });
    });
  });

  player.querySelector('[data-tom-voltar]').addEventListener('click', function () {
    reiniciarSeTocando(function () {
      transposicao = 0;
      mostrarTom();
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

  var metronomo = player.querySelector('[data-metronomo]');
  metronomo.addEventListener('change', function () {
    reiniciarSeTocando(function () {
      metronomoLigado = metronomo.checked;
    });
  });

  var telaLigada = player.querySelector('[data-tela-ligada]');
  if (!('wakeLock' in navigator)) {
    player.querySelector('[data-tela-linha]').hidden = true;
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
