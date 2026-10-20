# Motor de motion: referência para escrever cenas

Referência técnica do motor da skill (para o Claude, não para a pessoa). A conversa com a pessoa
é sempre de design e motion; isto aqui é como a cena vira código.

## O projeto da pessoa

```
human-output/motion-design/<slug>/
  motion.json          o roteiro: cenas em ordem, durações, quadros-chave, batidas, transições
  briefing.md          pedido, referências lidas, decisões, rodadas
  marca/tokens.css     cores, fontes (@font-face local), raios — da PESSOA; fontes/ ativos/ marca.md
  midia/               fotos e vídeos que podem aparecer no filme
  referencias/<nome>/  leitura de cada vídeo de referência (analisar-referencia.mjs)
  cenas/<id>.js .css   uma cena; _comum.css/_comum.js e _transicoes.js opcionais
  filme/               o filme montado (HTML com player; abre no navegador)
  storyboard/          prancha (index.html), quadros/<formato>/, aprovado/<formato>/
  render/v<N>/         MP4 por formato, capa, marcas.json; render/trechos/ para testes
  previa.html          a página de entrega
  .cache/              quadros renderizados e inspeção (pode apagar)
```

## Comandos (de dentro da pasta de trabalho da pessoa)

| Comando | Faz |
| --- | --- |
| `node <skill>/scripts/checar.mjs [--completo]` | ambiente (Node, Chrome, ffmpeg, playwright-core, disco) e como instalar o que falta |
| `node <skill>/scripts/novo-projeto.mjs --titulo "…" [--ids a,b,c] [--marca pasta] [--logo f] [--fonte f] [--midia f] [--assets repo] [--referencia video]` | cria o projeto |
| `node <skill>/scripts/analisar-referencia.mjs video.mp4 --saida <projeto>/referencias/<nome> [--zoom 4,2-4,8]` | lê um vídeo de referência quadro a quadro |
| `node <skill>/scripts/storyboard.mjs <projeto> [--formato 16x9\|9x16\|ambos] [--poses] [--aprovar] [--pdf]` | quadros-chave em PNG + prancha |
| `node <skill>/scripts/quadros.mjs <projeto> --cena id --passo 0.25 --folha` | folha de contato para olhar o movimento; `--global`, `--tempos`, `--pureza` |
| `node <skill>/scripts/renderizar.mjs <projeto> --formato 16x9\|9x16\|ambos --fps 30\|60 [--nota "…"]` | MP4 determinístico; `--cenas`, `--por-cena`, `--qualidade maxima`, `--prores` |
| `node <skill>/scripts/fluidez.mjs <projeto\|video\|pasta>` | trancos e trechos congelados, com cena e tempo local |
| `node <skill>/scripts/previa.mjs <projeto> [--servir]` | página de entrega com vídeos, storyboard, downloads e zip |

Códigos de saída: 0 ok · 1 erro de uso/ambiente · 2 o motor ou o detector acusaram algo.

## motion.json

```json
{
  "titulo": "…", "cartaz": "frase grande da prancha (opcional)", "slug": "…",
  "fps": 60, "bpm": 120, "formatoBase": "16x9", "formatos": ["16x9"],
  "movimento": { "curvaEntrada": [0.16,1,0.3,1], "cascataLetra": 0.026, "cascataPalavra": 0.045,
                 "entrada": 0.6, "opacidade": 0.18, "subida": 0.18, "desfoque": 0.14, "saida": 0.25, "camera": 0.012 },
  "linguagem": [{ "titulo": "Ritmo", "texto": "…" }],
  "referencias": [{ "nome": "pasta-em-referencias", "leitura": "uma linha do que se leva dela" }],
  "cenas": [{
    "id": "abertura", "titulo": "O papel narrativo", "dur": 2.4,
    "ideia": "a metáfora do movimento em uma frase", "camera": "…", "som": "…",
    "fundoPuro": false, "variante": null, "permitirParado": [[1.2, 1.6]],
    "quadros": [{ "id": "inicio", "rotulo": "Início", "legenda": "…", "t": 0.25 },
                { "id": "fim", "rotulo": "Fim", "legenda": "…", "t": 1.7 }],
    "batidas": [{ "t": 0.0, "tipo": "tipo|camera|transicao|luz|objeto|vida", "texto": "…" }],
    "saida": { "tipo": "corte-no-eixo", "texto": "frase própria para o storyboard (opcional)" }
  }],
  "montagens": { "B": ["c2", "c1", { "cena": "c3", "saida": { "tipo": "esmaecer" } }] },
  "capa": { "cena": "abertura", "quadro": "fim" }
}
```

`movimento.subida` e `movimento.desfoque` são em **em** (fração do corpo da letra): o gesto escala
com a letra nos dois formatos. O último quadro-chave é o quadro aprovado (o CSS natural da cena).

## A cena

```js
/* id — "Título" (2,4 s)
   Ideia: … Linha do tempo: … Saída: … */
Motion.cena('id', {
  render: (c) => `<div class="luz"></div><div class="pilha"><h2 class="titulo frase">…</h2></div>`,
  poses: { inicio: (el, api) => api.set(el.$('.frase'), { o: 0.3, blur: 0.5 }) }, // storyboard sem quadro()
  montar(el, api) { el.letras = api.tipo.dividir(el.$('.frase'), { por: 'letra' }); el.cam = api.camera(); },
  quadro(t, el, api) { api.tipo.focar(t, el.letras, { inicio: 0.1 }); el.cam.pose({ zoom: api.viva(t) }); },
});
```

Regras (o motor e o `quadros.mjs --pureza` conferem):
- `quadro(t)` é função pura: toda propriedade animada recebe valor em toda chamada (nada de
  `if (t > x) set(...)` sem o outro lado); proibidos `Math.random`, `Date`, `performance.now`,
  timers, `requestAnimationFrame` e `transition` de CSS. Variação: `api.rand(semente)`, `api.ruido`.
- O CSS natural da cena é o quadro final aprovado; animar é ir até ele com estilos inline.
- `montar` mede e divide (uma vez por formato, com fontes carregadas e todas as cenas visíveis); não
  depende de tempo e não muda a aparência natural.
- CSS sempre escopado em `.cena-<id>`; 9:16 em `[data-formato="9x16"] .cena-<id>`. Tipografia em
  `cqmin` (mesmo tamanho em px nos dois formatos), posições em `cqw`/`cqh`. Cores só por
  `var(--token)` da marca; transparência por `color-mix(in srgb, var(--x) N%, transparent)`.
- `@keyframes` de CSS podem: o motor pausa e posiciona pelo tempo local.
- O motor é dono de `.m-cena` e `.m-camera`; a cena mexe do `.m-conteudo` (= `el.raiz`) para dentro.

`c` (render): `formato vertical largura altura k cena esc porFormato({ '16x9': a, '9x16': b })`,
`foto(nome, { classe, foco })`, `video(nome, { inicio, velocidade, loop })` (quadro a quadro, preso
ao tempo local), `svg(nome, { classe, viewBox })` (ids únicos por cópia), `fundo(nome)` (url para
CSS), `ativo(nome)`, `mockup('celular'|'tablet'|'notebook'|'navegador'|'janela'|'cartao', { tela, classe })`.
Nomes de mídia: o nome do arquivo em `midia/` ou `marca/ativos/` (com ou sem extensão).

`el`: `{ raiz, cena, $(sel), $$(sel) }` + o que o `montar` pendurar.

## api

| Grupo | Nomes |
| --- | --- |
| Tempo | `clamp lerp prog tw ease spring wave rand mola hermite suave suave5 sino pulso pulsoSemQuique deriva vida ruido logLerp acelerar trajeto` |
| Curvas (`ease.`) | `forte` (.16,1,.3,1) · `simetrica` · `ui` · `mergulho` · `outExpo inExpo inOutExpo outQuart outQuint inCubic outCubic inOutCubic inOutSine outSine outBack(s) bezier(x1,y1,x2,y2) linear` |
| Ritmo e quadro | `bpm batida b(n) fps umQuadro dur ultimo ref` (ref = t do quadro aprovado) |
| Formato | `formato vertical largura altura H k pxPorCqw seguro{x,topo,base} porFormato({...})` |
| Estilo | `estilo` (o `movimento` do motion.json com padrões) |
| DOM | `set(el\|lista, props) base(el, transform) $ $$ caixa(el) caixaNaTela(el)` |
| Vizinhança | `entrada saida anterior.ponte(nome) proxima.ponte(nome) cena{id,indice,inicio,dur}` |
| Câmera | `camera(op) viva(t) tremor(t, t0)` |
| Tipo | `tipo.*` (abaixo), atalhos `dividir revelar` |
| Física | `fisica.quique afundar impacto tique amassar arremesso cair spring` (só objeto) |
| Efeitos | `fx.obturador velocidade halo gradienteDeLuz respirar calor flash mascaraLinear mascaraRadial ondaDeLuz accelerando degradeQueDeriva` · nível: `fx.degradeLargo frenteDeLuz tempoDaFrente luzDoVidro` |
| Nível | `tipo.frenteDeLetras escorrerDestaque prepararOdometro odometro` · `deslize(t, t0, t1, rampa)` · CSS `.m-vidro .m-vidro-forte .m-vidro-heroi` (abaixo) |
| Pintura | `pintura.camada filtroFixo repintar` |
| Mídia | `midia.mockup(el, { rx, ry, r, s, x, y, z })` |

`set(el, props)`: `x y z` (cqw; `px: true` para px), `s sx sy`, `r rx ry` (graus), `persp`, `o`,
`blur` (cqw, arredondado a 0,05 px), `bright sat contraste filter`, `ls` (em), `clip mask origem mix`,
`pre post` (transform antes/depois; a base de transform do CSS é guardada sozinha no primeiro set),
`subpixel: true` (giro invisível contra pulo de 1 px), `semEstalo: true`, `style {}`, `vars {}`.

## Tipografia (`api.tipo`)

`dividir(el, { por: 'letra'|'palavra'|'linha', mascara })` no montar → partes
`{ el, i, n, tipo, palavra, linha, iLinha, nLinha, cx, cy, l, a, x0, corpo, kern, destaque }`
(preserva o kerning, mantém o degradê do `.destaque` contínuo, folga para acento/descendente).
`semViuva(el)` antes de dividir.

Receitas `(t, partes, opções)`, puras; devolvem estados e aplicam. Para somar duas, passe
`{ aplicar: false }` e junte com `tipo.aplicar(partes, a, b)` (x/y/r/blur somam; s/o/bright multiplicam).
Opções comuns: `inicio cascata dur curva ordem ('normal'|'reversa'|'centro'|'pontas'|semente)`.

| Receita | Uso |
| --- | --- |
| `focar` (`revelar`) | desfoque → foco, subida curta, por letra ou palavra (a base de tudo) |
| `lente` | profundidade z por letra: ampliação, tracking e desfoque de profundidade fecham juntos (`foco` número ou função de t, `eixo: 'palavra'|'quadro'`) |
| `mascara` | linhas sobem de trás da própria linha de base (`dividir` por linha com `mascara: true`) |
| `sair` | saída que acelera até o último quadro (`modo: 'desfoque'|'tracking'|'pontas'|'camera'`) |
| `brilho` | reflexo que atravessa a palavra uma vez, soma luz sem engordar (partes por letra) |
| `aproximar` / `exalar` | tracking que fecha ao chegar / abre devagar no hold, passando pelo aprovado em `ref` |
| `sugar` | pontas partem primeiro, todas chegam juntas a um `ponto` [x, y] cqw e viram luz |
| `nascerDaLuz` | silhueta de luz primeiro, depois as letras sobem quentes e esfriam |
| `cinetica` | letras do fundo (vórtice) ou de trás da câmera (enormes, desfocadas) |
| `varrerDestaque` / `derivaDestaque` | o destaque é varrido da cor do texto para o degradê / o degradê gira um fio no hold |
| `contar` | número que conta e trava (só número verdadeiro), formato pt-BR |
| `digitar` | digitação determinística com cursor |
| `respirar` | vida na camada do texto (escala ≤ 1 %) |
| `empurrar` | bloco desliza com arranque macio e pouso sem freada, com obturador direcional |
| `escorrerDestaque` | vida no hold do degradê: cada fatia mostra uma janela `(1 + sobra)` maior, que oscila devagar (`sobra periodo amp ref inicio`) |

## Recursos de nível (`motor/nivel.js`, `motor/nivel.css`)

O que as cenas do filme de referência faziam à mão e toda cena com luz, vidro e tipografia viva
precisa. Uso real nos quatro exemplos de `exemplos-de-nivel/` (ler `LEIA.md` de lá).

| Recurso | Onde | Faz |
| --- | --- | --- |
| `tipo.frenteDeLetras(partes, { distancia, frente, dur, assentar, calor, encolher, desfoque, halo, cor })` | montar → `{ quadro(t, { escala }), recuo(t, d), inicio(d), partes, D }` | uma frente de luz sai de um ponto (o símbolo) e cada letra acende quando ela passa: quente, do desfoque, um fio menor e mais perto do ponto, assentando para fora; a mais longe por último. `distancia(p)` em cqw (negativa à esquerda). `recuo`/`inicio` servem para medir janelas no montar |
| `tipo.prepararOdometro(el, { passos })` + `tipo.odometro(t, od, { inicio, trava, cascata, passo, brilho, deriva, ref, oResto })` | montar + quadro | número ou data em tambor: cada algarismo rola 100 % e trava no seu valor, da esquerda para a direita (a última coluna trava em `trava`), desfoque só vertical na velocidade, degradê contínuo, reflexo opcional em `brilho: [t0, t1]`, deriva lenta do degradê depois de travar. O elemento pinta o número com `background-clip: text` |
| `tipo.escorrerDestaque(t, partes, op)` | quadro | ver tabela acima |
| `fx.degradeLargo(imagem, W, H, margem)` | montar | `{ img, W1, m }`: o mesmo linear-gradient numa imagem mais larga com as pontas lisas; deslocado, deriva sem mostrar a borda (use a imagem computada) |
| `fx.frenteDeLuz(el, t, { centro, caixa, raio, inicio, fim, banda, cor, nucleo, apagar, desfoque })` | quadro | anel largo de luz que sai de um ponto e atravessa uma grade por trás do vidro, recortado na caixa da grade (aparece nos vãos e através dos cards). Medidas em px da grade; `el` é um span absoluto em left/top 0 dentro dela |
| `fx.tempoDaFrente(dist, { inicio, fim, raio })` | montar | quando a frente alcança uma distância (px): acenda cada card ali |
| `fx.luzDoVidro(el, t, { k, luz, fator, fase, periodo, ref, raio, respira })` | quadro | a luz atrás de um `.m-vidro`: as duas manchas circulam devagar e a intensidade respira só para baixo, passando pelo CSS em `ref`; `k` = envelope da vida, `luz` = acendimento |
| `deslize(t, t0, t1, rampa)` | quadro | deriva que nunca para: 0 em t0, 1 em t1 (o aprovado), velocidade constante depois da rampa |

Material `.m-vidro` (CSS do motor): vidro escuro fosco sobre luz (backdrop), luz própria atrás em
duas manchas (`--x1 --y1 --c1`, `--x2 --y2 --c2`, intensidade `--mo`) e fio de borda claro
(`--vidro-borda`, opacidade `--borda`). Uma família só: todos os cards iguais, muda só a cor da luz.
`.m-vidro-forte` = a cor da marca como superfície (sem vidro); `.m-vidro-heroi` = o protagonista.
Tokens opcionais da marca: `--vidro --vidro-reflexo --vidro-borda --cartao-forte --cartao-heroi`.

## Câmera

`api.camera({ alvo, camadas: [{ el, z }], modo: '2.5d'|'3d', perspectiva, abertura, origem })` →
`pose({ zoom, avanco, x, y, giro, rx, ry, foco, desfoque })` (x/y = posição da câmera em cqw),
`mergulho(t, t0, t1, alvoEl, { cobrir, curva, para })` → `{ zoom, x, y }` para passar à pose.
`viva(t)` = push-in que nunca para e passa por 1,0 no quadro aprovado. Camadas: z > 0 perto
(anda mais), z < 0 longe; `abertura` dá profundidade de campo (rack focus animando `foco`).

## Transições (`saida` no motion.json)

| tipo | modo / dur | opções |
| --- | --- | --- |
| `corte` | encadeada / 0 | — |
| `corte-no-eixo` | encadeada / 0,1 + 0,3 | `forca desfoque K tau` (a próxima herda o embalo do push) |
| `avancar-desfocar` | encadeada / 0,24 + 0,3 | `avanco desfoque` |
| `esmaecer` | sobreposta / 0,4 | `cor` (véu uniforme, sem forma) |
| `dissolver` | sobreposta / 0,3 | `desfoque escala` |
| `empurrar` / `chicote` | sobreposta / 0,5 / 0,3 | `direcao: esquerda|direita|cima|baixo` |
| `mergulho` | sobreposta / 0,75 | `alvo` (seletor em A, obrigatório), `ponte` (data-ponte em B), `antecipacao recuo escurecer cobrir`, `alvoTexto` |
| `ponte` | sobreposta / 0,6 | `nome` (mesmo `data-ponte` nas duas cenas), `arco` |
| `ponto-de-luz` | sobreposta / 0,5 | `ponto [x,y]` ou `ponte`, `cor` |
| `atravessar` | sobreposta / 0,5 | `ate` |
| `flash` | encadeada / 0,07 + 0,25 | `cor forca` |
| `lamina-de-luz` | sobreposta / 0,6 | `angulo cor largura` |
| `iris` | sobreposta / 0,5 | `ponto` (desencorajada: prefira esmaecer) |
| `na-cena` | encadeada / 0 | a cena coreografa a passagem com `api.proxima.ponte()` |

`dur`, `antes`, `depois` e `texto` podem ser sobrescritos em cada `saida`. A última cena pode ter
`saida` (ex.: `esmaecer`, `atravessar`) para fechar o filme. Transição própria: `cenas/_transicoes.js`
com `Motion.transicao('nome', { medir, preparar, aplicar(e, A, B, op, cache) })` e `modo`/`dur`
declarados na `saida`. A transição escreve só em `A.posar({ s, x, y })`, `A.estilo({ o, blur, bright,
mask, clip, x, y, z })` e em `Motion.camada('veu'|'luz')`.

## Formatos

16:9 = 1920×1080; 9:16 = 1080×1920. Área segura em pé: o essencial entre 12 % e 80 % da altura e
dentro de ~86 % da largura (`api.seguro`; o player desenha com a tecla A). Os tempos são os mesmos
nos dois formatos: muda a composição, não o ritmo. Recompor, nunca cortar.
