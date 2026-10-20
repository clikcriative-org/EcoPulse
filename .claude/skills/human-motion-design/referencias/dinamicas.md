# A biblioteca de dinâmicas (a cereja do bolo)

O design das telas deixa o motion bonito; **a dinâmica** deixa memorável: como uma tela vira a
outra, como cada coisa aparece, como a câmera mergulha, como as letras chegam, como os mockups
montam. Esta é a biblioteca: cada dinâmica com **quando usar**, **como acontece** (com os números de
referência) e **como chamar no motor**. Tempos em segundos locais da cena; distâncias em `cqw`
(1 cqw = 1 % da largura do quadro), pontos `[x, y]` em cqw a partir do centro do quadro.

## Como escolher

- **Uma dinâmica-assinatura por cartela** (a ideia da cena), mais as de apoio (entrada de texto,
  câmera viva, vida no hold). Não empilhe três truques numa tela de 2 s.
- **A passagem é decidida pela vizinhança**, no storyboard: o que liga esta tela à próxima? O mesmo
  eixo? Um elemento que continua? Um ponto de luz? A tela seguinte é sobre um elemento desta?
- **Repetir a mesma passagem é linguagem**, não preguiça (cortes no eixo entre frases do mesmo
  bloco); as especiais (mergulho, ponte, ponto de luz, travessia) ficam para os momentos que mudam o
  assunto ou chegam ao clímax.
- **A referência de motion manda na escolha**: se ela corta seco no ritmo da música, corte seco; se
  ela mergulha nas telas, mergulhe. Use esta biblioteca para executar bem o que a referência faz.

| A passagem é… | Use |
| --- | --- |
| frase → frase, mesmo enquadramento | `corte-no-eixo` |
| composição cheia → frase | `avancar-desfocar` |
| tipografia → marca ou símbolo | `ponto-de-luz` (no ponto onde o símbolo vai acender) |
| grade, tela ou coleção → cena sobre um item dela | `mergulho` (com `ponte` se o item reaparece) |
| o mesmo elemento nas duas cenas, em lugares e tamanhos diferentes | `ponte` |
| muitos objetos → frase ou plano para vídeo | `atravessar` |
| entrar e sair de um plano de outra luminosidade (o único plano claro) | `esmaecer` |
| virada de capítulo seca, com energia | `flash` ou `chicote` |
| revelar por luz | `lamina-de-luz` |
| a própria cena coreografa a passagem | `na-cena` (com `api.proxima.ponte`) |

## C1. Transições entre telas

Na cena, `"saida": { "tipo": "…", …opções }`. **Sobreposta**: as duas cenas tocam juntas durante
`dur`. **Encadeada**: corte seco no meio, com `antes` segundos mexendo na que sai e `depois` na que
entra. `dur`, `antes`, `depois` e `texto` (a frase da prancha) podem ser sobrescritos em cada uma.
Quando a transição do motor faz a passagem, a cena não programa saída própria (o modelo de cena já
só chama `tipo.sair` quando a saída é `corte`).

| tipo | modo / dur | Quando | Opções |
| --- | --- | --- | --- |
| `corte` | encadeada / 0 | corte seco no ritmo; a cena faz a própria saída acelerando | — |
| `corte-no-eixo` | encadeada / 0,1 + 0,3 | duas frases seguidas no mesmo enquadramento (pergunta → resposta), sobretudo em plano para vídeo | `forca desfoque K tau` |
| `avancar-desfocar` | encadeada / 0,24 + 0,3 | sair de uma composição cheia para uma frase | `avanco desfoque` |
| `esmaecer` | sobreposta / 0,4 | entrar e sair do plano de outra luminosidade; fechar o filme | `cor` |
| `dissolver` | sobreposta / 0,3 | fusão discreta entre dois planos de foto ou vídeo | `desfoque escala` |
| `empurrar` | sobreposta / 0,5 | a próxima empurra esta, mesma velocidade, rastro de movimento | `direcao` |
| `chicote` | sobreposta / 0,3 | chicote de câmera rápido, o meio vira rastro | `direcao` |
| `mergulho` | sobreposta / 0,75 | a câmera mergulha num elemento até ele virar o primeiro quadro da próxima | `alvo` (obrigatório), `ponte`, `antecipacao recuo escurecer cobrir alvoTexto` |
| `ponte` | sobreposta / 0,6 | o mesmo elemento atravessa a fronteira | `nome` (obrigatório), `arco` |
| `ponto-de-luz` | sobreposta / 0,5 | tudo converge num ponto de luz macio; a próxima acende dali | `ponto [x,y]` ou `ponte`, `cor` |
| `atravessar` | sobreposta / 0,5 | a câmera atravessa a composição, tudo passa rente e sai desfocado | `ate` |
| `flash` | encadeada / 0,07 + 0,25 | a luz sobe em poucos quadros até o corte, sem ataque seco | `cor forca` |
| `lamina-de-luz` | sobreposta / 0,6 | uma lâmina de luz varre o quadro e a próxima aparece presa a ela | `angulo cor largura` |
| `iris` | sobreposta / 0,5 | **desencorajada** (lê como "bola de luz"); prefira `esmaecer` | `ponto` |
| `na-cena` | encadeada / 0 | a cena coreografa a passagem sozinha | — |

**C1.1 Corte seco no mesmo eixo, em movimento** (`corte-no-eixo`). Nos últimos ~0,1 s a câmera dá um
push que acelera com micro-desfoque; o último quadro é o mais rápido; corta; a cena seguinte nasce no
mesmo eixo **herdando a velocidade do push** e dissolvendo devagar, com um respiro de foco de ~0,09 s.
A frase nova nunca fica quase parada logo depois do corte. Para isso funcionar, a frase seguinte
ocupa o mesmo eixo e um tamanho parecido.

**C1.2 Convergência para o ponto de luz** (`ponto-de-luz`, ou coreografada com `tipo.sugar`). Para
passar de uma cena tipográfica a uma de marca: as pontas da frase apagam primeiro, as letras mais
perto do ponto ficam acesas por último, tudo converge para **o ponto exato onde o símbolo da próxima
vai acender** (marque o símbolo da próxima com `data-ponte="simbolo"` e passe `"ponte": "simbolo"`),
encolhe e vira um ponto de luz macio. Preto limpo; a próxima acende dali. Saída inteira ~0,35 a 0,5 s.

**C1.3 Avança, desfoca e nasce do desfoque** (`avancar-desfocar`). Últimos 0,24 s: o quadro avança 7 %
para a câmera, desfoca e apaga; a frase seguinte nasce do desfoque no mesmo eixo. Sem corte seco.

**C1.4 Mergulho no elemento** (`mergulho`). Para uma grade, tela ou coleção cuja próxima cena é sobre
um dos itens. Em quatro tempos: **antecipação** (o resto recua ~2,5 % e escurece ~40 %, só o alvo fica
aceso); **clique** (o conteúdo do alvo se recolhe, um brilho passa uma vez, se a cena quiser);
**mergulho** em escala logarítmica, começando antes de o recuo terminar (a câmera vira como um
pêndulo, sem parar entre os dois); **chegada** com embalo, exatamente no tamanho e no lugar do primeiro
quadro da próxima (`ponte`). A luz da próxima acende por trás do alvo durante o mergulho.

```json
"saida": { "tipo": "mergulho", "alvo": ".tela-app", "ponte": "tela", "alvoTexto": "na tela do app" }
```

**C1.5 Elemento-ponte** (`ponte`). O símbolo pequeno no canto vira o símbolo grande da próxima, a capa
do card vira o herói da próxima: o mesmo `data-ponte="nome"` nas duas cenas; a câmera leva o lugar
dele aqui até o lugar dele lá enquanto o resto se funde. `arco` curva o caminho.

**C1.6 A câmera atravessa a formação** (`atravessar`). Para fechar uma cena de muitos objetos (órbita,
grade, pilha) rumo a uma frase ou a um plano para vídeo: os objetos passam rente e saem pelas bordas
desfocados, o fundo afunda na cor de fundo. Melhor ainda quando a cena já vinha num dolly que nunca
para (C4.5): a travessia é a continuação.

**C1.7 Esmaecer uniforme** (`esmaecer`). Véu da cor de fundo que esmaece **por igual, sem forma**. É o
substituto certo da íris circular (que lê como bola de luz e foi reprovada).

**C1.8 A luz atravessa o corte** (na cena). Duas cenas com fundos de luz diferentes: a cena nova
começa com a mesma luz (cor, força e posição) do fim da anterior e migra para a sua em ~0,5 s
(`ease.inOutSine`). Faça na cena que entra.

**C1.9 Rima de começo e fim** (na cena). O filme tem um gesto-assinatura (o símbolo gira meia volta em
240 ms com `ease.inOutExpo` e passa 6° do ponto, voltando: `fisica.tique`). O mesmo gesto abre a marca
no meio do filme e fecha a marca no fim. Se houver uma cartela de logo depois, ela acende do ponto em
que o filme terminou.

**C1.10 Final em um gesto só** (na cena, saída da última). O símbolo desliza para o centro, pulsa uma
vez, o giro vira uma torção que acelera, encolhe até virar um ponto, solta um traço horizontal de luz
e tudo apaga desacelerando; o último quadro já é a cor de fundo. ~0,4 s.

**C1.11 Tudo é tragado para o símbolo** (na cena). Fecha um lockup (crédito, fio, marca): cascata de
70 ms, cada parte com `ease.inCubic` em ~0,24 s rumo ao símbolo; o símbolo recebe a luz que chega e
apaga por último.

Transição própria do projeto: `cenas/_transicoes.js` com `Motion.transicao('nome', { medir, preparar,
aplicar })`, e `modo`/`dur` declarados na `saida` (ver `motor/API.md`).

## C2. Câmera e mergulhos

```js
montar(el, api) {
  el.cam = api.camera({
    alvo: el.$('.mundo'),
    camadas: [{ el: el.$('.luz'), z: -0.6 }, { el: el.$('.grade'), z: 0 }, { el: el.$('.frente'), z: 0.35 }],
    abertura: 0.6,                       // profundidade de campo (0 = tudo em foco)
  });
},
quadro(t, el, api) {
  el.cam.pose({ zoom: api.viva(t) });    // push-in vivo que passa por 1,0 no quadro aprovado
}
```

`pose({ zoom, avanco, x, y, giro, rx, ry, foco, desfoque })`: `zoom` é lente (tudo junto); `avanco`
é dolly (as camadas de perto crescem mais); `x`/`y` é a posição da câmera em cqw; `foco` é a
profundidade em foco (com `abertura`).

| Dinâmica | Como e quanto | No motor |
| --- | --- | --- |
| Push-in contínuo | 1 → 1,03 a 1,06 no plano, passando por 1,0 no quadro aprovado | `pose({ zoom: api.viva(t) })` |
| Push-in de leitura | 3 % (0,97 → 1) entre a montagem e o quadro aprovado, para dar tempo de ler | `api.tw(t, t0, api.ref, 0.97, 1, api.ease.inOutSine)` |
| Close → recuo | a marca nasce em close (~1,3×) com push lento; ao abrir, a câmera recua junto até o enquadramento aberto e segue recuando ~1,5 %/s (nunca passa por velocidade zero) | `zoom` composto de `tw` + deriva |
| Empurrão de peso | quando algo trava, +1,2 % com curva forte em 0,5 s, devolvido devagar | some um `api.pulsoSemQuique` ao `zoom` |
| Antecipação | recua 2 a 2,5 % antes de mergulhar | `mergulho` já faz; na cena, `tw` antes do mergulho |
| Mergulho em log | a escala cresce em log (velocidade percebida constante) até o alvo cobrir o quadro | `el.cam.mergulho(t, t0, t1, alvo, { cobrir })` → passe para `pose` |
| Dolly | as camadas de perto crescem e passam pela câmera (apagam e desfocam sozinhas) | `pose({ avanco })` com `camadas` |
| Paralaxe | camadas com taxas próprias a partir do centro | `camadas` com `z` |
| Rack focus | o foco sai da primeira palavra e pousa na segunda na batida (`inOutSine`), depois recua com ela | `abertura` > 0 e `pose({ foco })` animado |
| Tremor | **só** no impacto físico de objeto, nunca em leitura | `const tr = api.tremor(t, t0, { forca: 0.3 })` → `pose({ x: tr.x, y: tr.y, giro: tr.giro })` |
| Reenquadramento | no 9:16, a câmera desliza enquanto a marca acende, até ela ficar centrada | `pose({ x })` com `api.porFormato` |

## C3. Tipografia

Divida no `montar`, anime no `quadro`. As receitas são puras e aplicam sozinhas; para somar duas
(entrada + saída, entrada + brilho de calor), passe `{ aplicar: false }` e junte com `tipo.aplicar`.

```js
montar(el, api) {
  api.tipo.semViuva(el.$('.frase'));
  el.letras = api.tipo.dividir(el.$('.frase'), { por: 'letra' });   // 'letra' | 'palavra' | 'linha'
},
quadro(t, el, api) {
  const entra = api.tipo.focar(t, el.letras, { inicio: 0.1, aplicar: false });
  const sai = api.tipo.sair(t, el.letras, { aplicar: false });       // só quando a saída é 'corte'
  api.tipo.aplicar(el.letras, entra, sai);
}
```

Opções comuns: `inicio`, `cascata` (s entre partes), `dur`, `curva`, `ordem` (`'normal'`,
`'reversa'`, `'centro'`, `'pontas'` ou um número de semente).

**C3.1 Desfoque → foco** (`tipo.focar`, atalho `api.revelar`). A base de tudo: por letra ou palavra,
18 a 45 ms entre elas, sobe 0,18 em, foco em 0,6 s com curva forte, sem overshoot. `ordem: 'centro'`
abre do miolo para fora.

**C3.2 A lente encontra a frase** (`tipo.lente`). Frase curta de abertura: uma profundidade por
letra gera o gesto inteiro (ampliação a partir do eixo, espaço entre letras proporcional à
profundidade, subida curta, desfoque de profundidade de campo). Cada letra acende no seu tempo e a
palavra, como plano, recua numa curva mais longa: o espaçamento fecha junto em todos os vãos.
`foco` pode ser uma função do tempo (rack focus entre palavras); `eixo: 'quadro'` amplia a partir do
centro do quadro.

**C3.3 A palavra que empurra a linha** (`tipo.empurrar`). A segunda palavra completa a frase e a
linha precisa recentralizar: a linha começa a ceder enquanto a primeira palavra ainda assenta,
ganha velocidade em ~5 quadros, desliza com rastro direcional e pousa na batida seguinte com
velocidade e desaceleração zerando juntas; então vira deriva.
`api.tipo.empurrar(t, el.$('.linha'), { de: 0, ate: -6, inicio: 0.45, fim: 1.0 })` (cqw).

**C3.4 Pergunta e resposta física** (na cena, com `focar` + `empurrar`). Frase em duas linhas em que
a segunda responde a primeira: a primeira toma impulso (afunda ~0,7 % da largura, 0,22 a 0,44 s),
salta meia linha na batida; a segunda chega de um plano mais perto (8 % maior, fora de foco, ~1,5 %
abaixo) e aterrissa do centro para as pontas (`ordem: 'centro'`, 18 ms) na meia batida; no impacto a
primeira cede ~0,3 % e volta (`api.pulsoSemQuique`, pulso sem quique). "A resposta empurra a frase."

**C3.5 Espaço que fecha ao chegar / abre no hold** (`tipo.aproximar`, `tipo.exalar`). Letras vindas
de longe, espaçadas (+0,5 em) e fora de foco, aproximando-se até o espaçamento aprovado, quase tudo no
primeiro segundo; no hold continuam se aproximando um fio. É como a ideia de "proximidade" acontece na
tipografia, sem enfeite. `exalar`: depois do pouso, o espaço abre bem devagar o hold inteiro.

**C3.6 Linhas que sobem de trás da linha de base** (`tipo.mascara`). Editorial e seco: `dividir` por
`'linha'` com `mascara: true`; cada linha sobe de trás da própria linha de base, 80 ms entre linhas.

**C3.7 A frase vira o crédito** (na cena). Uma frase grande se torna o rótulo de um lockup: antecipa
(cresce 3,5 % e recua, terminando na batida); as letras voam cada uma com atraso e arco próprios (o
miolo sai primeiro, as pontas 130 ms depois, maiores e por fora, como asas se fechando), encolhem como
quem se afasta e **viram versal no topo do próprio arco** (a troca some dentro do movimento); pousam
com o espaço fechado, que depois abre em escala constante.

**C3.8 Primeiro o brilho, depois a letra** (`tipo.nascerDaLuz`). A palavra-manchete, o clímax: um
clique libera luz; uma linha de horizonte nasce logo abaixo da linha de base e corre para as pontas
(nunca atravessando letra); a **silhueta de luz** da palavra acende inteira (~0,2 s); depois as letras
sobem do horizonte, da esquerda para a direita, **quentes**, e esfriam até a cor final. A câmera dá o
empurrão de peso quando a palavra trava. No hold, um brilho atravessa a palavra uma vez.

**C3.9 Varredura do destaque** (`tipo.varrerDestaque`, depois `tipo.derivaDestaque`). As letras
entram na cor do texto; um véu de borda macia desliza (0,3 a 0,75 s) e revela o degradê por baixo,
contínuo entre as letras; no hold o degradê gira um fio.

**C3.10 Letras sugadas para um ponto de luz** (`tipo.sugar`). A frase precisa virar outra coisa (o
símbolo de onde nasce a grade): na batida, **as pontas partem primeiro e todas chegam juntas** (0,25 s,
`inCubic`); no caminho viram luz (brilho e desfoque sobem antes de a letra encolher) para a frase se
desfazer em luz e não se amassar; o ponto **estoura** no símbolo 10 ms antes de as letras chegarem
(nenhum quadro vazio). `api.tipo.sugar(t, el.letras, { inicio: 1.6, ponto: [0, -4] })`.

**C3.11 A frase passa pela câmera** (`tipo.sair` com `modo: 'camera'`). Saída em bloco: avança e
desfoca atravessando a câmera (~0,22 a 0,3 s). Outros modos: `'desfoque'` (padrão), `'tracking'` (o
espaço abre enquanto apaga), `'pontas'` (as pontas saem primeiro).

**C3.12 Tipografia cinética em profundidade** (`tipo.cinetica`). Letras vindas do fundo do espaço
(pequenas, nítidas, em vórtice) ou de trás da câmera (enormes, desfocadas, cruzando o quadro), cada
uma com ângulo e tempo próprios, encaixando no plano final em cascata (`de: 'fundo' | 'perto' |
'misto'`, `semente`). Boa para cartela de logo e abertura de impacto.

**C3.13 Número que conta e trava** (`tipo.contar`). **Só número verdadeiro.** De 0 até o valor,
desacelerando, travando na batida (`travar: api.b(2)`), em formato brasileiro. Odômetro (cada coluna
rola e trava, uma a cada 0,1 s, desfoque só vertical) se escreve na cena com `api.set` por coluna.

**C3.14 Digitação** (`tipo.digitar`). Busca, campo de mockup, terminal: digitação determinística com
cursor (`cps` caracteres por segundo).

**C3.15 Brilho que atravessa uma vez** (`tipo.brilho`, partes por letra). Reflexo de borda nítida,
inclinado, que soma luz sem engordar a letra; atravessa em velocidade constante, entrando e saindo
por fora da palavra, 0,5 a 0,85 s. A vida mais elegante de um hold tipográfico.

## C4. Mockups, cards, grades e coleções

**C4.1 O aparelho chega da profundidade** (`c.mockup` + `api.midia.mockup`). Celular, tablet,
notebook, navegador, janela ou cartão (`c.mockup('celular', { tela, classe })`): chega girado (~30°
em Y, alguns graus em X), menor (0,84 a 0,9), sai do desfoque e assenta de frente com uma mola curta
(objeto pode passar do ponto); sombra e reflexo acompanham a pose.

```js
const chega = api.ease.outExpo(api.prog(t, 0, 0.8));
api.midia.mockup(el.$('.fone'), {
  ry: -32 * (1 - api.spring(t, { freq: 1.4, damp: 6 })), rx: 7 * (1 - chega),
  s: 0.84 + 0.16 * chega, o: api.suave(api.prog(t, 0, 0.1)),
});
```

**C4.2 A tela se monta ou rola por dentro**. Uma gravação de tela dela (`c.video('gravacao', {
inicio })` dentro da `tela`, presa ao tempo da cena) ou a interface montada em cards. A tela do
mockup é o lugar natural do mergulho (C1.4).

**C4.3 Cards em accelerando, com estalo** (`fx.accelerando`). Os cards caem um a um com intervalos
que encurtam (90 → 40 ms: "um rufar"), cada um sobe ~3 cqw, assenta com um estalo pequeno de escala
(objeto: `outBack`, limitado a 1,04) e opacidade em 3 a 5 quadros.

```js
// montar
el.cards = api.$$('.card');
el.tempos = api.fx.accelerando(el.cards.length, { de: 0.09, ate: 0.04 }).map((x) => 0.5 + x);
// quadro
el.cards.forEach((c, i) => {
  const p = api.prog(t, el.tempos[i], el.tempos[i] + 0.32);
  api.set(c, { y: 3.2 * (1 - api.ease.outExpo(p)), s: 0.94 + 0.06 * Math.min(1.04, api.ease.outBack(2.2)(p)),
               o: api.suave(api.prog(t, el.tempos[i], el.tempos[i] + 0.08)) });
});
```

**C4.4 O card-herói nasce do ponto de luz** (`fx.mascaraRadial` + mola de objeto). O ponto que estourou
abre o card central por uma máscara radial macia a partir do símbolo (rampa de 2 a 3 quadros antes do
embalo; 0,5 s); o card nasce grande (~1,45×) e assenta (0,7 s); o símbolo dentro dele nasce do ponto
com `outBack(1.2)`, girando de −40° para a pose.

**C4.5 Uma frente de luz acende a grade** (`fx.ondaDeLuz`). Uma frente sai do símbolo e atravessa a
grade **por trás do vidro** (aparece nos vãos e através dos cards, nunca no vazio em volta); cada card
acende quando a frente alcança a borda mais próxima dele: sobe de 96 % com um estalo de refração
(~1,5 %, `outBack(4)` em 0,22 s), opacidade em 3 a 4 quadros, chega de ~1,4 cqw **vindo da direção do
símbolo**; a luz de trás floresce depois de ele estar opaco; o título do card entra palavra a palavra.
**A frente nunca pode ser lida como um anel desenhado**: é luz que varre, sem contorno.

```js
el.atrasos = api.fx.ondaDeLuz([0, 0], el.cards, { velocidade: 90 });   // montar: atraso de cada card
```

**C4.6 Cada conteúdo trava numa batida**. Ícone desenhado como **traço de luz** (SVG com
`pathLength="1"`; anime `strokeDashoffset` de 1 a 0 com `api.set(el, { style: { strokeDashoffset } })`)
com uma cabeça que corre e fecha na batida, com pico curto de brilho; trilha que se desenha e acende
cada ponto quando a luz chega; barras de áudio que crescem da esquerda para a direita (26 ms) e pulsam
na batida no hold; leque de capas que abre com mola; contador que trava (C3.13).

**C4.7 Peças que saem de dentro da marca**. A marca se abre (as peças deslizam para fora, ~0,9 s,
`bezier(0.35, 0.05, 0.2, 1)`) e **tira de dentro** faixas de conteúdo: uma janela mascarada entre a
peça que desliza e o símbolo faz cada faixa aparecer só onde já foi descoberta (nada por baixo das
letras, nada de meia faixa emoldurando o símbolo); as faixas sobem de 96 % e acendem do centro para
fora; os ícones se desenham como traço de luz; o texto escreve na ordem de leitura.

**C4.8 Pilha → explosão → órbita viva**. Para mostrar quantidade (catálogo, portfólio, coleção de
capas, fotos dela):
1. **um objeto-herói sozinho** por uma batida (chegando no embalo da cena anterior);
2. os outros **entram de fora do quadro já em movimento** e caem na pilha em accelerando (45 → 17 ms);
   **cada impacto afunda a pilha inteira e ela devolve** (`fisica.afundar(t, impactos, { forca: 0.02 })`:
   "blub, blub, blub"); o último **quica sozinho** (`fisica.quique`, razão 0,36 a 0,4) e a pilha
   descansa;
3. **a pilha prende o ar** (antecipação de 0,16 s) e **explode na batida**: todos decolam no mesmo
   quadro, abrem em espiral como uma flor, **sem overshoot** (a explosão entrega a velocidade para a
   órbita); o herói, que estava embaixo, sai por último (+70 ms);
4. a ordem de camadas passa da pilha para a do anel **por dissolve**, nunca uma capa pulando na frente
   da vizinha;
5. **a órbita nunca para**: giro e avanço têm um piso constante mais uma parcela que acelera;
   perspectiva verdadeira (os de baixo mais perto, maiores); a frase entra no vazio central na batida
   seguinte e é lida no trecho mais calmo;
6. saída: `atravessar` (C1.6).

**C4.9 Lockup em cadeia de causa e efeito**. O símbolo **cai de perto da câmera girando**
(`fisica.cair`: quase parado no alto, acelera como u⁴, alinha nos últimos quadros) e **bate no fio na
batida** (`fisica.amassar`: amassa 8 % e volta); o impacto **acende o fio** (a ponta corre do centro
para as bordas com um brilho) e **empurra a marca para cima**; o último elemento desce da câmera em 3
quadros e bate na meia batida. Com a marca em peças, os movimentos se sobrepõem.

**C4.10 Reflexo que corre pelo vidro**. No hold, um reflexo sai do símbolo e corre para fora pelo
vidro dos cards, uma vez só (~0,9 s), medido ao longo da mesma linha inclinada para andar na mesma
velocidade em todos.

**C4.11 Fotos da pessoa**. Foto como objeto (capa, card, polaroide) entra com física de objeto e pode
ir para pilha, órbita ou grade; foto como plano (tela cheia) recebe push lento contínuo e a frase por
cima, com a luz da marca por cima da foto; nunca um corte seco de uma foto parada para outra sem
movimento de câmera.

## C5. Revelação de marca em etapas

Padrão para revelar uma marca com símbolo (a ordem é a que a pessoa quer ver; os tempos são de uma
cena de ~5 s a 120 BPM):

| t (s) | Etapa | Como |
| --- | --- | --- |
| 0,03 a 0,35 | o símbolo acende do escuro | ponto de luz que cresce (`outBack(1.1)`) girando um fio que desacelera; a luz dele abre o fundo em volta, sem borda |
| 0,12 a 0,4 | a marca aparece inteira, fechada | uma frente de luz corre do símbolo para as pontas (as letras de dentro acendem juntas, a mais longe por último); cada letra nasce no lugar, do desfoque, **quente**, 5 % mais perto do símbolo, e assenta para fora **esfriando** |
| 0,4 a 0,8 | segura legível e viva | a câmera se aproxima devagar; o símbolo respira e junta luz; as peças se apertam um fio contra ele |
| 0,8 a 1,05 | o gesto-assinatura | o símbolo gira meia volta em 240 ms (`inOutExpo`, o meio vira risco de luz) e passa 6° do ponto, voltando (`fisica.tique`) |
| 0,82 a 1,7 | abre | as peças deslizam, tirando de dentro o conteúdo (C4.7); a câmera recua junto |
| 1,7 a 2,5 | hold aberto | reflexo pelo vidro, deriva de recuo, luz respirando |
| 2,1 a 3,1 | o clímax | uma palavra brilha e é sugada para o símbolo (C3.10); a marca fecha de novo com o mesmo gesto, as peças se tocam **exatamente na batida**, a marca sobe e abre espaço |
| 3,0 a 3,6 | a palavra-manchete | clique, horizonte, brilho, letra (C3.8); empurrão de peso |
| 4,1 a 4,7 | hold final | um brilho atravessa a palavra; o degradê deriva |
| últimos 0,24 | saída | `avancar-desfocar` |

A lição: **cada etapa é um estado que se lê, a passagem entre estados é encadeada, e o estado do meio
está vivo**. Etapa não é pausa; encadear não é fundir.

## C6. Luz que varre

| Dinâmica | Como | No motor |
| --- | --- | --- |
| Brilho único na palavra | reflexo de borda nítida inclinado (100 a 105°) que soma luz sem engordar; atravessa uma vez em velocidade constante, entrando e saindo por fora | `tipo.brilho` |
| Faixa única que cruza o lockup | crédito, fio e marca leem **a mesma faixa** (um gesto só de luz), com o centro na palavra principal na batida | `tipo.brilho` com o mesmo `inicio`/`dur` em todas as partes, ou `fx.mascaraLinear` |
| Flash do clique | sobe em alguns quadros, pico curto (~0,2 s), sem ataque seco | `fx.flash(t, t0)` (0 a 1) numa camada de luz |
| Amanhecer | quando o símbolo nasce, um brilho fino corre por um horizonte a partir do centro | linha + `fx.mascaraLinear` |
| Luz de horizonte | linha de luz que nasce num ponto e corre para as pontas embaixo da palavra; respira | linha com `clip` animado + `fx.respirar` |
| Lâminas de luz | um ponto nasce no vão entre duas palavras, estica numa linha e abre em duas lâminas que varrem o quadro; a logo aparece por máscara presa às lâminas, o contorno acende antes e a letra esfria até a cor da marca | `fx.mascaraLinear` + `fx.calor`; ou a transição `lamina-de-luz` |
| Corte de luz | um corte de luz atravessa o fundo **no ângulo de um elemento da marca** e se abre em trilhos; por eles a logo chega em fatias que deslizam em sentidos opostos, com rastro direcional, ficam um instante desalinhadas e encaixam secas na batida | fatias com `clip` + `fx.obturador` |
| Calor que esfria | o que nasce de luz nasce quente e esfria até a cor final enquanto assenta | `fx.calor(el, q)` |
| Luz de fundo que respira | duas fontes macias que derivam e respiram, sem forma nem borda | `.luz` do motor + `fx.respirar`; `fx.halo` para uma fonte própria |

## C7. Match cuts (o elemento que atravessa a fronteira)

1. **Ponto de luz**: o fim de uma cena converge num ponto; a próxima acende dele (`ponto-de-luz`).
2. **Objeto**: a câmera mergulha num item e ele vira o primeiro quadro da próxima (`mergulho`).
3. **Eixo**: a frase seguinte nasce no mesmo eixo e no mesmo tamanho (`corte-no-eixo`,
   `avancar-desfocar`).
4. **Elemento compartilhado**: o mesmo símbolo, capa ou foto muda de lugar e tamanho (`ponte`).
5. **Luz de fundo**: a luz da cena anterior é a primeira luz da seguinte (C1.8).
6. **Gesto**: o mesmo gesto-assinatura abre e fecha o filme (C1.9).
7. **Frase → símbolo**: a frase recua e vira o símbolo de onde nasce a próxima composição (C3.10).

Para a cena ler a geometria da vizinha (coreografar a passagem ela mesma, com `na-cena`): marque o
elemento com `data-ponte="nome"` e leia `api.proxima.ponte('nome')` ou `api.anterior.ponte('nome')`
(a caixa medida no começo da próxima ou no fim da anterior, em cqw).

## C8. Física de objeto (nunca em texto de leitura)

| Dinâmica | Referência | No motor |
| --- | --- | --- |
| Mola com overshoot | f 1,25 a 1,8 Hz, amortecimento 5,6 a 7 | `api.spring(t - t0, { freq, damp })`, `ease.outBack(s)` |
| Quique | 3 quiques, altura × 0,36 a 0,4 a cada um | `fisica.quique(t, t0, { altura, razao, n })` → altura |
| Afundar e devolver | oscilação amortecida a cada impacto (2 %, ~7 Hz) | `fisica.afundar(t, [t1, t2…], { forca })` |
| Resposta a impacto | ataque de ~1 quadro e decaimento rápido (o primeiro quadro depois da batida não anda 20 a 37 % do caminho) | `fisica.impacto(t, t0)` → 0 a 1 |
| Pulso sem quique | sai e volta com velocidade e aceleração zero | `api.pulsoSemQuique(u, tau)` |
| Tique | passa 6° do ponto e volta | `fisica.tique(t, t0, { passa: 6 })` → graus extras |
| Amassar no impacto | −8 %, mola de 2,4 Hz | `fisica.amassar(t, t0)` → `{ sx, sy }` |
| Arremesso | trajetória até o contato + mola que herda a velocidade; freia no ar perto da câmera antes de cair; bate com flash e tremor de câmera na batida | `fisica.arremesso(t, { t0, tc, p0, contato })` + `api.tremor` + `fx.flash` |
| Cair de perto da câmera | quase parado no alto, acelera como u⁴, giro que alinha nos últimos quadros | `fisica.cair(t, t0, t1)` |

## C9. Entradas de logo (cartela final, vinheta)

Cinco ideias de verdade diferentes, para concorrer contra o piso "a logo sai do desfoque e a
assinatura sobe":

1. **O símbolo que estoura**: um ponto abre no símbolo, que cresce girando, faz o gesto-assinatura,
   implode e, no pico do giro, estoura num flash; do flash nascem as peças da logo, quentes, de dentro
   para fora, enquanto a câmera recua com a onda de choque; o símbolo desce num arco até o lugar dele
   e encaixa com o tique.
2. **Cortes gráficos editoriais** (C6, corte de luz): fatias grossas e finas em ritmo editorial,
   chegando de lados opostos com distâncias e tempos diferentes, encaixe seco na batida; a assinatura
   entra por uma fatia fina que se abre.
3. **Luz no escuro** (C6, lâminas de luz).
4. **O selo ou símbolo como objeto com física** (C8, arremesso): é arremessado, freia no ar, bate
   com flash e tremor na batida; as letras batem uma a uma, da mais próxima para a mais distante.
5. **Tipografia cinética em profundidade** (C3.12): as letras vêm do fundo do espaço ou de trás da
   câmera e encaixam no plano da logo em duas cascatas (palavra 1 numa batida, palavra 2 na seguinte),
   com desfoque de profundidade proporcional à distância.

Regras comuns: entrada principal até ~2,5 s; hold vivo (deriva mínima de câmera, um brilho que passa,
o símbolo respira); termina exatamente no quadro aprovado, com as peças da logo nas posições
originais.

## Receitas por tipo de pedido

| Pedido | Esqueleto que costuma funcionar |
| --- | --- |
| Vinheta / cartela de logo | uma cena de 5 a 6 s, uma ideia de C9, hold vivo com um brilho que passa; três entradas concorrentes quando ela quer escolher |
| Abertura tipográfica | `lente` ou `focar` por letra na frase de abertura; `corte-no-eixo` entre frases; pergunta e resposta física (C3.4); fecha em `ponto-de-luz` para a marca |
| Lançamento de app ou produto | o aparelho chega da profundidade (C4.1), a tela se monta (C4.3), mergulho na tela (C1.4), o benefício em tipografia, a marca em etapas (C5) |
| Filme cartelado / manifesto | frases em `corte-no-eixo`, um clímax de montagem (grade que acende, C4.5, ou pilha → órbita, C4.8), o lockup ou a marca, um convite final com a rima do gesto (C1.9) |
| Motion com as fotos da pessoa | fotos como objetos em pilha → órbita ou grade; uma foto em plano cheio com push lento e a frase; `ponte` da foto pequena para a grande |
| Anúncio animado | gancho em 0 a 2 s com a dinâmica mais forte; mensagem; prova; chamada até ~11 s; fim vivo (15 s ou mais) |
