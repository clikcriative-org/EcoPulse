# Formatos: 16:9, 9:16 e os dois

O motor trabalha em dois quadros: **16:9** (1920 × 1080, deitado) e **9:16** (1080 × 1920, em pé). O
mesmo arquivo de cena serve aos dois; o que muda é a composição, **nunca o ritmo**: as mesmas batidas,
as mesmas transições, os mesmos tempos.

## O formato base e a pergunta

- O storyboard é desenhado no **formato base**, deduzido do destino:

| Destino | Base |
| --- | --- |
| Reels, Stories, TikTok, Shorts, anúncio vertical, status | 9:16 |
| YouTube, site, apresentação, telão, evento, LinkedIn em paisagem, abertura de vídeo | 16:9 |
| não disse | 16:9 |

- **Só depois do storyboard aprovado** a skill pergunta: "Vamos animar em 16:9, 9:16 ou nos dois?",
  com a recomendação pelo destino primeiro. Se ela escolher o outro formato ou os dois, o outro é
  **recomposto** a partir do base aprovado.
- Quadrado (1:1) e 4:5 não são do motor. Se ela pedir, diga numa frase e ofereça o 9:16 (que cobre
  Reels e Stories) ou o 16:9.

## Recompor, nunca recortar

Recortar o 16:9 para fazer o 9:16 corta letra, empurra a composição para fora da área segura e deixa
a tipografia pequena. **Cada cartela é recomposta** para o quadro em pé, com a mesma ideia, as mesmas
marcas, a mesma copy e a mesma linguagem de movimento.

| No 16:9 | No 9:16 |
| --- | --- |
| faixa horizontal de elementos | coluna |
| grade larga | grade alta (menos colunas, mais linhas) |
| órbita circular | elipse mais alta que larga |
| deslize horizontal (a segunda palavra chega pelo lado e empurra a linha) | deslize vertical (a segunda palavra chega por baixo e empurra a coluna) |
| a marca que abre na horizontal | abre na vertical (as peças dão um quarto de volta em torno do símbolo) |
| texto à esquerda, mockup à direita | texto em cima, mockup embaixo |
| plano para vídeo com pessoas | marca e crédito na metade de baixo, o alto livre para o vídeo |
| frase numa linha | quebra em duas ou três linhas, sem viúva |

- **O gesto escala com a letra.** As distâncias de tipografia do motor são em **em** (fração do corpo
  da letra), então subida, desfoque e espaço acompanham a letra nos dois formatos sozinhos. Distâncias
  em cqw escritas na cena (deriva, deslize, órbita) multiplique pelo fator do formato quando o gesto
  precisa ficar igual em relação à letra (`api.k` = 1 no 16:9 e 1,778 no 9:16, para manter o mesmo
  tamanho em px).
- **Pontos que atravessam cenas são medidos de novo** no layout em pé (o ponto de luz onde uma cena
  converge e a próxima acende, o alvo do mergulho, a ponte). Use `data-ponte` e as medidas do motor,
  nunca coordenadas fixas.
- **Reenquadrar com a câmera** quando a composição em pé não cabe parada: a câmera desliza enquanto a
  marca acende, até ela ficar centrada.

## Escala em cada formato

Tipografia em **`cqmin`** (1 cqmin = 1 % do lado menor: 10,8 px nos dois formatos), então a mesma regra
dá o mesmo tamanho em px deitado e em pé. Posições em `cqw`/`cqh`.

| Elemento | 16:9 | 9:16 |
| --- | --- | --- |
| Frase curta de abertura | 13 a 15 cqmin | 13 a 15 cqmin, quebrando linha se precisar |
| Título de cartela | 10 a 11 cqmin | 9 a 12 cqmin |
| Palavra-manchete | o que couber com folga | o que couber na largura com folga |
| Apoio (quando existe) | 2,4 a 3,6 cqmin | 3 a 4 cqmin |

## Áreas seguras

- **9:16 (Reels, TikTok, Shorts, Stories)**: o essencial entre **12 % e 80 % da altura** e dentro de
  **~86 % da largura** (margem de 7 % de cada lado). Em cima mora o nome do perfil; embaixo, a
  legenda, os botões e a barra do app. `api.seguro` dá as margens em cqw (`x`, `topo`, `base`).
- **16:9**: margem de ~5 % em volta para texto e logo.
- O player do filme desenha a área segura com a tecla **A** (o filme fica em `filme/<montagem>-<formato>.html`).

## Como escrever a recomposição

```css
/* o 16:9 é o natural da cena */
.cena-app .texto { position: absolute; left: 12cqw; top: 50%; translate: 0 -50%; }
.cena-app .aparelho { position: absolute; right: 16cqw; top: 50%; translate: 0 -50%; }

/* o 9:16 recompõe, escopado no formato: o 16:9 aprovado não muda */
[data-formato="9x16"] .cena-app .texto { left: 0; right: 0; top: 13cqh; translate: none; text-align: center; }
[data-formato="9x16"] .cena-app .aparelho { right: auto; left: 50%; top: 57cqh; translate: -50% -50%; }
```

- No `render(c)`, `c.vertical` e `c.porFormato({ '16x9': a, '9x16': b })` trocam a marcação quando a
  composição muda de verdade (uma quebra de linha diferente, uma grade 2 × 3 que vira 3 × 2).
- No `quadro`, `api.vertical` e `api.porFormato({...})` trocam a geometria do gesto (deslize em x vira
  deslize em y).
- **Regras novas ficam escopadas no 9:16.** O formato aprovado não pode mudar: depois de recompor,
  gere o storyboard do base de novo com `--sem-revisao` e compare com `storyboard/aprovado/<base>/`
  (`qualidade.md`, quadro final igual ao aprovado). Diferença = algo vazou para o base; conserte.

## O fluxo com os dois formatos

1. Anime o formato base, cena por cena, até passar na conferência.
2. Recomponha o outro: `storyboard.mjs <projeto> --formato 9x16` para ver os quadros-chave em pé;
   ajuste o CSS e a geometria até cada quadro se sustentar sozinho e respeitar a área segura.
3. Confira o movimento em pé nas cenas que mudaram de geometria (`quadros.mjs --formato 9x16 --cena
   <id> --passo 0.25 --folha`).
4. Renderize os dois juntos (`renderizar.mjs <projeto> --formato ambos --fps 60`): mesma versão, a
   página de entrega mostra os dois lado a lado.

## Quadros por segundo

- **60 qps é o mestre**: o movimento fica liso e o detector de fluidez enxerga os trancos.
- **30 qps** quando o destino pede (anúncio, edição em 30, Stories): **renderizado nativo**
  (`--fps 30`), nunca convertido do 60.
- 24 ou 25 qps só se a edição pedir.
- Os tempos de cena não mudam com a taxa: o mesmo `quadro(t)` é amostrado em outro passo.

## Especificações de destino

| Destino | Arquivo |
| --- | --- |
| Instagram Reels, Stories, TikTok, Shorts | 9:16, 1080 × 1920, MP4 H.264, 30 ou 60 qps |
| YouTube, site, apresentação | 16:9, 1920 × 1080, MP4 H.264, 60 qps |
| Anúncio | o formato do posicionamento; 15 s ou mais; a capa é a versão estática |
| Ilha de edição (Premiere, Resolve, Final Cut) | `.mov` ProRes 422 HQ 10 bits (`--prores`), `--qualidade maxima`, uma peça por cena se a edição pedir (`--por-cena`) |
| Plano para vídeo (o texto vai por cima de filmagem) | `fundoPuro` na cena, para o editor usar mistura de tela (screen/add) |
