# MIDIs do Hinário 5

Arquivos em `static/midi/5/`, publicados em `/midi/5/`. Um conjunto por hino (1 a 480) e por coro (`coro-1` a `coro-6`); o nome segue o do conteúdo em `content/5/`.

| Arquivo | Conteúdo |
|---|---|
| `<slug>.mid` | Arranjo completo, MIDI tipo 1: faixa 0 de controle (título, armadura de clave, andamento, compassos) e faixas 1 a 4 com soprano, contralto, tenor e baixo |
| `<slug>-soprano.mid`, `-contralto.mid`, `-tenor.mid`, `-baixo.mid` | Uma voz: a faixa de controle do completo mais a faixa da voz, extraídas do arquivo completo |

## Origem

MIDIs do app Android do hinário, pasta `backup/` do arquivo `~/drive/pessoal/hinarioccblofi-masters/fonte-hinario-apk.zip` (desde 29/10/2026 o zip guarda as versões já corrigidas descritas abaixo, as mesmas desta pasta; o zip original do app foi para a Lixeira) (`001.mid` a `480.mid`, `coro1.mid` a `coro6.mid`). É a versão com a introdução (a primeira frase do hino antes da 1ª estrofe), como é tocado no culto. Ficaram de fora os arquivos do Hinário 4 (`*h4.mid`) e as cópias duplicadas (`1.mid` e `01.mid` são iguais a `001.mid`).

**Licença:** decisão do usuário (29/10/2026): o uso dos arquivos no site não é uma preocupação; não tratar como pendência.

## Ajustes feitos sobre os originais

- **Andamento das vozes:** os arquivos por voz do app tinham andamento mais lento que o completo, e 8 tinham arranjo diferente ou estavam quebrados (277 nas 4 vozes, 281 baixo, 303 baixo com 66 de 196 notas, 441 soprano e contralto). Por decisão do usuário, o andamento correto é o do arquivo completo: todas as vozes foram regeradas extraindo a faixa do completo. Notas, andamento e duração conferem com o completo nos 1.944 arquivos de voz.
- **Hino 136:** estava em Ré; transposto meio tom abaixo para o tom oficial, Ré♭ (só alturas; tempos e duração iguais).
- **Metadados** (sem alterar notas): título na faixa 0 (`Hino 314 CCB: O Teu poder supremo`, `Coro 1 CCB: Aleluia! Aleluia!`), armadura de clave do tom oficial e nome de cada faixa (Soprano, Contralto, Tenor, Baixo).
- **Timbre:** as 4 faixas usam coral, General MIDI 52 "Choir Aahs" (no app eram oboé 68, sax soprano 64, trombone 57 e tuba 58). Escolha do usuário em 29/10/2026, depois de ouvir orquestra, órgão, coral, cordas, madeiras e piano. Vale para quem toca o arquivo com um banco General MIDI (GarageBand, FluidSynth, download); o player do site sintetiza com timbre próprio e ignora o programa.
- **Oitava do baixo:** no app a linha do baixo soava uma oitava abaixo da partitura; subida uma oitava (+12) nos 486 arquivos, na altura em que o baixo canta.

Todos os 486 arranjos conferem com o tom oficial (`recursos/guia-hinario5.json` do projeto lofi-ccb).

## Características mantidas do app

- Os hinos 64, 157, 378 e 422 mudam de andamento dentro do arquivo, de propósito.
- Compassos de anacruse aparecem como compassos curtos (`1/4`, `1/8`); 13 hinos diferem do compasso oficial só na notação (por exemplo 2/2 escrito como 4/4), sem efeito no som.

## Marcadores de introdução e estrofes

Cada arquivo (completo e por voz) tem, na faixa 0, eventos MIDI do tipo `marker`. São texto: não produzem som nem alteram o andamento; o player lê para saber onde está.

- `Introdução` no tempo 0 (a primeira frase, antes da 1ª estrofe).
- `Estrofe 1`, `Estrofe 2`… no início de cada estrofe.
- `Repetição` quando a música toca mais passagens do que a letra tem estrofes (hinos 41, 238 e 251: uma passagem a mais no fim).

Como foram calculados (projeto lofi-ccb):

- Fim da introdução: recomeço da melodia depois de um silêncio (`scripts/remover_intro.py`, `inicio_primeira_estrofe`). Confere com `data/introducao.json` nos 486.
- Estrofes: repetição da melodia do soprano em 452 arquivos (exato). Nos outros 34 a melodia não se repete de forma detectável e o início de cada estrofe foi estimado dividindo a duração pelo número de estrofes da letra, alinhado ao compasso (aproximado): 6 21 42 47 50 56 61 63 67 74 92 97 102 105 138 149 162 185 214 215 226 247 268 272 298 316 331 337 347 372 457 459 465 475.
- Contagem: 423 arquivos com 3 seções, 37 com 4 e 26 com 2.

Exemplo, hino 314: `Introdução` em 0, `Estrofe 1` no tempo 18, `Estrofe 2` em 84, `Estrofe 3` em 150.
