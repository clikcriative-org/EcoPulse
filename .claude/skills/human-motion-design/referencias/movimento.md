# A linguagem de movimento

Regras gerais que valem para qualquer marca: a marca muda a cor e a forma, não a física. Os
números são **faixas de referência**, não receita; uma referência de motion que a pessoa trouxe pode
deslocar as faixas (mais lento, mais seco), e aí os números dela ganham, ajustados em `movimento` no
`motion.json` para o filme inteiro mudar junto.

## Ritmo

- **Um BPM para o filme inteiro.** Padrão 120 BPM: uma batida = 0,5 s (`api.batida`, `api.b(n)`).
  Entradas e trocas importantes caem em **batidas ou meias batidas**; "carimbos" rápidos em
  semicolcheias (0,125 s).
- Marque os eventos-chave de cada cena na batida e anote no comentário da cena ("as peças se tocam
  exatamente na batida 3,0", "a frase entra quando a explosão já abriu o centro, batida 4").
- Entradas de 0,6 a 1,2 s; **o que vem depois começa antes de o anterior terminar** (sobreposição de
  0,1 a 0,3 s).
- Se a pessoa tem trilha, o BPM é o da trilha, e os cortes caem nela.

## Curvas

| Uso | Curva | No motor |
| --- | --- | --- |
| Tudo que **entra** (rápido e assenta devagar) | `cubic-bezier(.16, 1, .3, 1)` ou outExpo | `ease.forte`, `ease.outExpo` |
| **Saída** (acelera até o último quadro) | inExpo, inCubic | `ease.inExpo`, `ease.inCubic`, `api.acelerar` |
| Abertura simétrica (algo que se abre pelo centro) | `(0.45, 0, 0.55, 1)` | `ease.simetrica` |
| Giro curto de objeto em que o meio vira risco de luz | inOutExpo em ~240 ms | `ease.inOutExpo` |
| Deriva, respiração, câmera lenta | senoide, inOutSine | `ease.inOutSine`, `api.vida`, `api.wave` |
| Mergulho da câmera | `(0.45, 0, 0.6, 0.85)`, escala em log | `ease.mergulho`, `api.logLerp` |
| Mola com overshoot (**só objeto**) | `1 − e^(−d·t)·cos(2π·f·t)`, f 1,25 a 1,8 Hz, d 5,6 a 7 | `api.spring`, `api.mola`, `ease.outBack(s)` |

- **Nunca** ease-in numa entrada; **nunca** linear em algo que entra.
- Partidas e pousos com forma própria quando a curva padrão não basta: **partida macia** (a
  velocidade sobe de zero em ~50 ms, numa rampa suave, em vez de nascer no máximo) e **pouso em que
  velocidade e desaceleração chegam juntas a zero** (nada de freada no último quadro): `api.trajeto`
  com `pouso`, ou `api.tipo.empurrar`.

## Tipografia

- **Texto entra do desfoque para o foco**, subindo de pertinho (16 a 30 px num quadro de ~1080, ou
  0,18 em do corpo), com opacidade, **por letra ou por palavra, com 18 a 45 ms entre elas** (letra: 19
  a 28 ms; palavra: 35 a 45 ms). Opacidade em 0,1 a 0,22 s; foco em 0,3 a 0,6 s. É o `api.tipo.focar`.
- **Tipografia nunca quica nem estica.** Overshoot só em objeto (capa, card, mockup, logo, ícone).
- O impacto vem do **tamanho e do espaço entre letras**, não do negrito. Peso regular no título é o
  gosto da casa; se a marca dela usa título pesado de propósito, a marca ganha.
- **Uma palavra de destaque por bloco**, na cor ou degradê de destaque; o degradê continua contínuo
  quando a palavra é dividida em letras (o `dividir` cuida disso; marque com `class="destaque"`).
- Divida em letras **preservando o kerning** (o `dividir` mede antes; nunca divida à mão com
  `inline-block`). Rode `api.tipo.semViuva` antes de dividir.
- Sem viúva, sem ponto final em título, cartela ou chamada.

## Câmera viva

- **Nenhum quadro fica parado**: todo plano tem push-in ou deriva contínua bem sutil, escala de 1 a
  1,03 a 1,06 no plano todo. O padrão do motor é `api.viva(t)`: 1,2 % por segundo.
- A câmera **passa pela escala 1,0 no quadro aprovado** (no meio do hold), em movimento: o quadro
  aprovado acontece, não é um ponto de parada.
- **Profundidade**: camadas em velocidades diferentes (paralaxe: o elemento da frente anda mais que a
  grade, que anda mais que a luz de trás), desfoque de profundidade em objetos que passam perto da
  câmera, rastro de movimento direcional em movimentos muito rápidos (`api.camera` com `camadas`,
  `abertura`; `api.fx.obturador`).

## Hold

- O quadro final de cada cartela fica **legível pelo menos 0,8 s** (0,6 s é o mínimo absoluto numa
  frase de duas palavras).
- **A leitura é sagrada**: a saída não rouba tempo do hold. Pediram mais tempo? O hold cresce, a
  entrada fica igual.
- **O hold é a peça parada**: o quadro final é completo e bonito sozinho (é o PNG, a capa).

## Vida no hold (nunca congelar)

Entre a composição montar e a saída começar, **algo sempre se move**, contínuo e muito sutil. Mais
de 0,25 s sem mudança é defeito (o detector acusa "parado"). Quem assiste não vê a animação, sente
que a imagem está viva.

- **Plano com fundo**: o degradê da palavra de destaque deriva (ângulo ±3 a 5°: `tipo.derivaDestaque`,
  `fx.degradeQueDeriva`); a luz de fundo respira (opacidade ±5 a 10 %, escala ±1,5 a 2 %:
  `fx.respirar`); o símbolo pulsa ou gira devagar; um reflexo passa **uma vez** pelos materiais
  (`tipo.brilho`); a luz de trás de cada card circula devagar, cada uma no seu período, sem passar da
  intensidade aprovada.
- **Plano para vídeo** (fundo puro, para blend): nada de luz de fundo; a vida fica na tipografia ou
  na marca: deriva mínima de escala ou posição (até 1 %: `tipo.respirar`), um brilho que atravessa a
  palavra uma vez, o espaço entre letras que "exala" devagar (`tipo.exalar`).
- **Períodos longos (2 a 5 s), senoidais, sem começo nem fim visíveis**: as ondas existem na cena
  inteira; quando precisam nascer, nascem com envelope suave (`api.vida`, que já faz isso).
- **Fases desencontradas**: nenhum par de ondas para junto dentro de um hold; as duas mais fortes em
  quadratura (quando uma está no pico, a outra corre). Períodos que não se dividem um pelo outro, para
  o cintilar não soar como metrônomo.
- **A energia da entrada vira deriva**: o pouso não para em zero, desemboca numa deriva lenta na
  mesma direção do gesto (a linha que deslizou continua deslizando por inércia; a que subiu continua
  subindo um fio). A deriva passa pelo quadro aprovado no meio do hold.
- **Distribua a vida no tempo**: pouso, deriva, brilho, saída; as luzes respiram com picos em
  momentos diferentes, para depois do brilho sempre haver algo subindo até a saída.
- **Nada pisca.**

## Saída

- **Rápida, 150 a 350 ms, acelerando**, com desfoque ou corte seco, e **mais curta que a entrada**
  (`tipo.sair`, ou a transição do motor).
- **O último quadro é o mais rápido**: o corte acontece em movimento, nunca depois de um quadro
  parado.
- **Nada some aceso**: a luz apaga até zero um fio antes de chegar à borda ou ao corte.
- A mudança entre quadros só cai no fim: o último quadro da cena que fecha o filme já é a cor de fundo.

## Luz

- A luz **respira**; um brilho que atravessa uma palavra ou uma logo **uma única vez** é bem-vindo.
- Toda luz e todo halo têm **queda até zero sem borda** (degradê de muitas paradas, desfoque largo):
  **a borda da elipse nunca aparece** (`fx.gradienteDeLuz`, `fx.halo`, a classe `.luz` do motor).
- O brilho **soma** luz à letra (a letra clareia até o branco sem engordar): `tipo.brilho`.
- O que nasce de luz nasce **quente** (brilho alto) e **esfria** até a cor final enquanto assenta
  (`fx.calor`, `tipo.nascerDaLuz`).
- Plano para vídeo: **a cor de fundo pura em todos os quadros**; proibido luz de fundo, halo, grão,
  vinheta, degradê, partícula.

## Fluidez (o que separa o sênior)

- **Encadear**: o próximo movimento começa antes de o anterior terminar; nada de três gestos
  separados quando pode ser um gesto só. Mas etapas que a pessoa quer ver continuam legíveis: o
  estado do meio fica vivo, não parado (`metodo.md`, seção 6).
- **Velocidade contínua**: quando um movimento passa para outro, a velocidade não muda de repente,
  inclusive através do corte (a cena seguinte herda o push da anterior: `corte-no-eixo`).
- **Nada aparece inteiro num quadro**: opacidade, escala, desfoque ou máscara levam pelo menos 3 a 5
  quadros (50 a 80 ms a 60 qps), mesmo nos carimbos. Nada nasce de escala 0: comece em 0,92 a 0,97.
- **Câmera viva no hold, sem roubar leitura.**

## Formatos que não são filme

- **Loop** (story, post, fundo de tela): o último quadro emenda no primeiro. Se a cena montou, ela
  expira nos últimos ~0,7 s; ondas com **número inteiro de ciclos** na duração.
- **Apresentação ou abertura que fica na tela**: a entrada toca uma vez e fica no quadro final vivo;
  sem saída programada.
- **Anúncio animado**: 15 s ou mais, vivo até o último quadro; gancho em 0 a 2 s, mensagem até ~6 s,
  um segundo momento de verdade, chamada até ~11 s, fim vivo. Nunca esticar desacelerando a mesma
  animação.
- Vídeo de rede social começa **na animação de entrada**, nunca no quadro composto. Um começo
  levemente acelerado (até 1,5× nos primeiros 0,4 s, voltando a 1× aos 0,9 s) faz o primeiro
  elemento aparecer logo; mais que isso fica nervoso.

## Os números da casa no `motion.json`

```json
"movimento": {
  "curvaEntrada": [0.16, 1, 0.3, 1],
  "cascataLetra": 0.026, "cascataPalavra": 0.045,
  "entrada": 0.6, "opacidade": 0.18,
  "subida": 0.18, "desfoque": 0.14,
  "saida": 0.25, "camera": 0.012
}
```

`subida` e `desfoque` são em **em** (fração do corpo da letra), então o gesto escala com a letra nos
dois formatos; `camera` é a velocidade do push-in vivo por segundo. Referência mais calma: `entrada`
0,8 a 1,0 e `cascataPalavra` 0,06. Referência mais seca e editorial: `entrada` 0,45, `subida` 0,1,
`desfoque` 0,08. Mude aqui, não cena por cena.
