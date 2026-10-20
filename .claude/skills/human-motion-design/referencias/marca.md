# A marca da pessoa

O motion veste a marca dela. Tudo que é cor, fonte, raio e luz nas cenas vem de **um lugar só**:
`<projeto>/marca/tokens.css`. As cenas só usam `var(--…)`; trocar a marca é trocar os tokens. A skill
não traz marca nenhuma: o `tokens.css` que o `novo-projeto` copia é neutro (cinzas e fonte do sistema)
e **nunca vai para a entrega assim**.

```
<projeto>/marca/
  tokens.css     as variáveis (cor, fonte, forma, luz) e os @font-face
  fontes/        os arquivos de fonte (woff2, woff, ttf, otf)
  ativos/        logo, símbolo, selo, ícones da marca (svg de preferência)
  ativos.json    nome → arquivo (gerado pelo novo-projeto)
  marca.md       a leitura da marca em linguagem de gente
  leitura/       arquivos de tema e tokens achados no repositório, para você ler
```

## O contrato dos tokens

| Token | O que é |
| --- | --- |
| `--fundo` | a base de todas as cenas (e o véu do `esmaecer`) |
| `--texto`, `--texto-suave` | texto principal e de apoio |
| `--destaque` | a cor de destaque (um por filme) |
| `--destaque-grad` | o degradê da palavra de destaque (`class="destaque"`); pode ser uma cor só: `linear-gradient(90deg, var(--destaque), var(--destaque))` |
| `--luz-1`, `--luz-2`, `--luz-3` | as cores da luz de fundo (a classe `.luz` do motor usa a 1 e a 2), do ponto de luz e da lâmina |
| `--brilho` | a cor do reflexo que atravessa a palavra (normalmente branco) |
| `--linha` | fios e bordas finas |
| `--fonte-titulo`, `--fonte-texto` | as famílias |
| `--titulo-peso`, `--titulo-tracking`, `--titulo-entrelinha` | o desenho do título (classe `.titulo`) |
| `--raio` | o raio dos cards |
| `--mockup-moldura`, `--mockup-raio`, `--mockup-sombra` | o corpo dos aparelhos |
| opcionais | `--acao`, `--acao-tinta`, `--vidro`, `--vidro-borda` e qualquer token novo que a marca precise (`--cartao`, `--cartao-borda`…) |

- Transparência sempre com `color-mix(in srgb, var(--token) N%, transparent)`, nunca com uma cor
  nova escrita na cena.
- Marca clara: `--fundo` claro, `--texto` escuro, luzes sutis (luz em fundo claro vira mancha fácil;
  prefira luz quase invisível ou nenhuma). Marca escura: luzes escuras e profundas, nunca saturadas no
  fundo.
- Tokens a mais que a cena precise ficam no próprio `tokens.css`, com nome em português de design.

## Fontes

- **Fonte local é obrigatória para o filme ficar igual em qualquer máquina**: os arquivos em
  `marca/fontes/` e um `@font-face` para cada peso usado. O `novo-projeto --fonte <arquivo>` copia e
  gera o `@font-face` sozinho (confira o nome da família que ele deduziu).
- **De onde vêm**: do design system ou do repositório dela (`.woff2`, `.ttf`, `.otf`); do Google Fonts
  quando a fonte da marca é de lá (baixe os arquivos dos pesos usados para `marca/fontes/`); fonte
  licenciada sem arquivo: peça o arquivo; sem arquivo, escolha a família aberta mais parecida pela
  forma (grotesca, geométrica, humanista, serifa, display) e **diga isso à pessoa**.
- Fonte variável: um `@font-face` com `font-weight: 100 900`.
- O impacto do título vem do tamanho e do espaço entre letras (`--titulo-tracking` negativo, de −0,02
  a −0,045 em em títulos grandes). Peso regular é o gosto da casa; o peso que a marca usa de propósito
  ganha.

## Logo e símbolos

- **SVG sempre que existir.** Coloque em `marca/ativos/` (o `--logo` faz isso) e use com
  `c.svg('logo')` (inline: dá para animar as peças por dentro, com ids únicos por cópia) ou
  `c.foto('logo')` (imagem inteira).
- SVG de uma cor só desenhado com `currentColor` pega a cor do CSS (`color: var(--texto)`); se o
  arquivo vier com a cor gravada errada para o fundo, corrija no arquivo da cópia em `ativos/`.
- Para animar a logo em peças (símbolo, palavra, assinatura), confira se o SVG tem os grupos
  separados; se não tiver, separe a cópia em grupos com `class` (sem redesenhar nada).
- **A logo é sagrada**: separar, mover, girar, mascarar e desfocar as peças, sim; redesenhar letra,
  esticar, trocar a cor no hold, colocar efeito que muda o desenho, nunca.
- Logo só em PNG pequeno: peça o vetor ou um PNG grande; logo pixelada num filme 1080p é defeito.

## De onde vem a marca

### Design system (arquivo, PDF, Notion, página de guia)

Leia as cores com nome, a tipografia (família, pesos, tamanhos, espaçamento), os raios, a luz e as
texturas que a marca usa, e **as peças aprovadas** (são a régua de gosto). Um PDF: abra as páginas como
imagem. Anote no `marca.md` o que é de propósito ("título sempre em caixa baixa", "nunca degradê").

### Figma

Com o conector do Figma ligado: a estrutura do arquivo, as variáveis (cores, tipografia, raios), os
estilos da biblioteca, prints de 3 a 5 frames que mostram o nível, e os logos exportados. Sem o
conector: peça prints dos frames de estilo e de 3 a 5 peças aprovadas, e trate como imagens.

### Site no ar

Abra a página (navegador ou leitura da página), leia as variáveis CSS do `:root`, as famílias de fonte
e as cores mais usadas, pegue o logo do cabeçalho (SVG inline ou arquivo) e tire prints das seções que
mostram o estilo. As fontes do site: se forem do Google Fonts, baixe os pesos; se forem próprias, peça
os arquivos.

### Repositório Git cheio de assets

```bash
git clone --depth 1 <link> human-output/motion-design/.repos/<nome>     # se veio por link
node <skill>/scripts/novo-projeto.mjs --titulo "…" --assets human-output/motion-design/.repos/<nome>
```

O `--assets` varre a pasta (ignora `node_modules`, `.git`, `dist`, `build`) e separa: fontes →
`marca/fontes/` (com `@font-face`), imagens com nome de logo, marca, símbolo, ícone ou selo →
`marca/ativos/`, as outras imagens e os vídeos → `midia/`, arquivos de tema e tokens →
`marca/leitura/`. Depois:

- leia `marca/leitura/` e também procure no repositório o que a varredura não pega pelo nome:
  `tailwind.config.*`, `globals.css`, `theme.*`, `:root { --… }`, `@font-face`, `BRAND.md`, `docs/`;
- **olhe** o que veio para `midia/` e `marca/ativos/` e tire o que não serve (ícones de interface,
  prints de teste, imagens de placeholder): o que fica ali é o que pode aparecer no filme;
- repositório privado: o clone usa o acesso que a pessoa já tem na máquina; sem acesso, peça a pasta.

### Imagens de referência (prints, peças, moodboard)

1. Paleta: o fundo dominante, a cor do texto, uma de destaque (no máximo duas cores fortes).
2. Tipografia: a família aberta mais próxima pela forma, o peso, a caixa e o espaço.
3. A luz e a atmosfera: escura ou clara, de onde vem a luz, que cor tem, se há vidro, grão, textura.
4. A composição (régua de gosto, não molde): onde mora o herói, quanto vazio.
5. **Confirme a leitura numa linha antes de seguir**: "Li assim: fundo grafite, luz âmbar lateral,
   títulos numa grotesca fina, destaque laranja. Sigo?"

### Só a logo

Tire do logo a cor (ou as cores) e a forma; proponha um fundo e uma família que conversem com ele,
numa linha, e confirme.

### Nada

Sem nenhuma fonte de design: proponha uma direção em uma linha (fundo, texto, um destaque, uma
família) coerente com o assunto e o destino, e confirme antes de desenhar. Nunca entregue na marca
neutra da skill.

### Um vídeo de motion de outra marca

Não é fonte de marca. Ele ensina a dinâmica (`analise-de-referencia.md`); as cores, as fontes e as
formas continuam sendo as da pessoa.

## O `marca.md`

Curto, em linguagem de gente, para você e para as rodadas seguintes:

```md
# <Marca>
Para quem fala e com que voz (2 ou 3 linhas).
## Sempre
- …
## Nunca
- …
## Recursos visuais
- a luz: … · o símbolo: … · fotos: tratamento … · materiais: …
## Logos (ativos.json)
- logo: fundo escuro · logo-escuro: fundo claro · simbolo: …
## Régua de gosto
- 3 a 5 peças ou frames aprovados e o que cada um ensina
## De onde veio cada coisa
- cores: … · fontes: … · logo: …
```

## Conferir a marca

O primeiro storyboard é a conferência: se as cartelas não parecem da marca dela, a marca está errada,
não a cartela. Antes de mostrar, olhe se a fonte carregou (letra do sistema no lugar da fonte dela é o
defeito mais comum), se a logo está nítida e na cor certa, se o destaque aparece uma vez por bloco, se
a luz conversa com a atmosfera das peças dela.
