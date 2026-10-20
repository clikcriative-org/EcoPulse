# Human Motion Design

Uma skill para fazer **motion de marca** direto no Claude Code, para qualquer marca. Você dá **uma
referência e uma ideia** (o texto, a frase, o que quer dizer) e, se quiser, imagens, a logo, o design
system, um site, um repositório cheio de assets ou um vídeo de motion que você adora. O Claude monta
um **storyboard rebuscado**, cartela por cartela, você refina até ficar do seu jeito e, só depois, ele
**anima em 16:9, 9:16 ou nos dois** e entrega os vídeos numa página com tudo para baixar.

O segredo do método está na **dinâmica**: como uma tela vira a outra, como a câmera mergulha, como as
letras entram, como os mockups montam. O design das telas deixa bonito; a dinâmica deixa memorável.

## O que você recebe

- **Um storyboard** numa página: cada cartela com o primeiro e o último quadro desenhados com a sua
  marca e as suas imagens, a ideia de movimento, as batidas com tempo ("0,3 s: o título sai do
  desfoque palavra a palavra") e como cada tela passa para a próxima.
- **A animação** em MP4, 60 quadros por segundo (ou 30, se o destino pedir), em 16:9 (1920 × 1080),
  9:16 (1080 × 1920) ou nos dois, recomposta para cada formato, nunca recortada.
- **Uma página de entrega** com os vídeos tocando, as cenas, o storyboard, a capa em PNG, um MP4 por
  cena (se você quiser), as versões anteriores e o "Baixar tudo".
- **Rodadas de ajuste**: você fala do jeito que falaria com quem animou ("segura mais um segundinho no
  fim", "a entrada da logo mais forte") e ele refaz só o que mudou.

## Instalar

1. Baixe a pasta `human-motion-design`.
2. Copie a pasta inteira para a pasta de skills do Claude Code:
   - **macOS e Linux**: `~/.claude/skills/human-motion-design`

     ```bash
     mkdir -p ~/.claude/skills && cp -R human-motion-design ~/.claude/skills/
     ```

   - **Windows**: `%USERPROFILE%\.claude\skills\human-motion-design`

     ```powershell
     New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
     Copy-Item -Recurse human-motion-design "$env:USERPROFILE\.claude\skills\"
     ```

3. Abra uma conversa nova no Claude Code (no app do Claude, aba Code, ou no terminal), dentro da pasta
   onde você quer que os vídeos fiquem, e peça um motion. A skill entra sozinha.

Precisa do **Claude Code**: no claude.ai pelo navegador não dá para renderizar os vídeos.

## O que precisa ter no computador

| O quê | Para quê | Como instalar |
| --- | --- | --- |
| **Node.js 18.17 ou mais novo** | roda o motor | macOS: `brew install node` · Windows: `winget install OpenJS.NodeJS.LTS` · ou o instalador LTS em nodejs.org |
| **Google Chrome** (ou Chromium; no Windows o Edge serve) | desenha cada quadro | macOS: `brew install --cask google-chrome` · Windows: `winget install Google.Chrome` |
| **ffmpeg** | transforma os quadros em vídeo e lê o vídeo de referência | macOS: `brew install ffmpeg` · Windows: `winget install Gyan.FFmpeg` · Linux: `sudo apt install ffmpeg` |
| ~5 GB livres | os quadros ficam guardados enquanto você ajusta | — |

Não precisa instalar nada antes: **na primeira vez, a skill confere a máquina**, diz o que falta, mostra
o comando certo para o seu sistema e oferece rodar para você. Um componente pequeno (o
`playwright-core`) ela instala sozinha, dentro da própria pasta.

## A dica que mais muda o resultado

Use o **Opus 5.5 com o ultracode** (é só escrever *ultracode* no seu pedido). Demora um pouco mais, mas
a primeira versão já sai bem mais acertada: o storyboard vem mais rico e a animação mais fluida.

## Como pedir

Diga **o que é**, **a ideia ou o texto**, **onde vai rodar** e **de onde vem o design**. Uma
referência de motion ajuda muito. Exemplos:

> Quero uma vinheta de 6 segundos para abrir os vídeos do meu canal. A logo está em
> ~/Desktop/logo.svg, as cores são preto e laranja. Gosto muito do ritmo deste vídeo:
> ~/Downloads/referencia.mp4. ultracode

> Motion de lançamento do nosso app, uns 20 segundos, para Reels. O texto é: "Seu dinheiro organizado.
> Sem planilha. Em um toque." Os prints do app estão na pasta ~/Desktop/prints e o repositório do site
> tem as fontes e a logo: https://github.com/minha-empresa/site

> Cartelas animadas para o manifesto da marca, 30 segundos, 16:9, com estas seis frases: (…). O
> design system está neste PDF: ~/Documents/marca.pdf

> Um motion com estas fotos do produto e a frase "Feito à mão, desde 1998". Quero que pareça este
> motion aqui (anexei o vídeo).

> Cartela final de logo animada para o fim dos nossos vídeos. Me mostra três ideias de entrada
> diferentes para eu escolher.

O que funciona como referência de design: a **logo** (SVG de preferência), o **design system** (PDF,
página de guia, Figma com o conector ligado), o **site** da marca, um **repositório Git** com os
assets, **imagens** de peças da marca. Como referência de movimento: o **arquivo** de um vídeo de
motion que você gosta (mp4, mov, webm ou gif).

## Como funciona

1. **Confere a máquina** e diz o que falta, se faltar.
2. **Lê as suas referências de verdade**: o vídeo de motion quadro a quadro (cortes, curvas, como as
   letras entram, como a câmera se move, o ritmo), e o design da sua marca (cores, fontes, logo).
   Pergunta só o que faltar.
3. **Monta o storyboard** e abre a página para você.
4. **Você refina** quanto quiser. Quando aprovar, ele pergunta: **16:9, 9:16 ou os dois?**
5. **Anima**, confere a fluidez quadro a quadro antes de mostrar e abre a **página de entrega**.
6. **Você dá o feedback**; ele ajusta e gera uma versão nova, até ficar pronto.

## Dicas para um resultado melhor

- **Mande o arquivo** do vídeo de referência, não o link (a skill não baixa vídeo de rede social).
- **Diga onde vai rodar** (Reels, YouTube, telão, apresentação) e a duração aproximada.
- **Texto pronto?** Mande. Se não tiver, a skill propõe no storyboard e você aprova; ela nunca inventa
  número, preço, nome ou depoimento.
- **Mande a fonte da marca** (o arquivo), senão ela usa a mais parecida e avisa.
- **Refine no storyboard**: é muito mais rápido mudar o desenho antes de animar.
- No feedback, diga **o que você quer ver** ("quero a logo aparecendo depois da frase, em etapas"), do
  jeito que falaria com um motion designer.

## Onde ficam os arquivos

Na pasta onde você abriu o Claude Code, em `human-output/motion-design/<nome-do-projeto>/`:

- `storyboard/index.html`: o storyboard;
- `previa.html`: a página de entrega;
- `render/v1/`, `render/v2/`…: os vídeos de cada versão, a capa e o pacote `.zip`.

## Perguntas

**Quanto tempo leva?** O storyboard sai em minutos. O render de um filme de 30 segundos a 60 quadros
por segundo leva alguns minutos, dependendo do computador; a skill avisa antes.

**Tem som?** Não. O vídeo sai mudo, pronto para você colocar a trilha. Junto vem um arquivo com o
tempo de cada corte e batida, para quem for sonorizar.

**Quais formatos?** 16:9 e 9:16 (o vertical serve para Reels, Stories, TikTok e Shorts). Quadrado e 4:5
não.

**Serve para qualquer marca?** Sim. A skill não tem marca nenhuma dentro: ela segue o método e veste o
seu design.

**Dá para levar para a edição?** Sim: peça a versão em ProRes (`.mov`) e, se quiser, uma peça por cena.
