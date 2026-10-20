# Ler um vídeo de referência, quadro a quadro

Quando a pessoa traz um vídeo de motion que ela gosta, a skill **entende esse vídeo de verdade**:
mede tempos, cortes, curvas, câmera, foco, luz, som e cor, e monta as imagens certas para você
**olhar**. O script não descreve o vídeo sozinho: número aponta onde olhar; o olho decide o que é.
O objetivo é sair com **decisões de storyboard** (telas, durações, quadros-chave, batidas com tempo,
transições, linguagem de movimento), não com uma descrição bonita do vídeo dos outros.

## Rodar

```bash
node <skill>/scripts/analisar-referencia.mjs <video> --saida <projeto>/referencias/<nome-curto>
```

| Opção | Para quê |
| --- | --- |
| `--saida <pasta>` | sempre dentro de `<projeto>/referencias/` |
| `--inicio 12,5` `--fim 0:20` | ler só um trecho (showreel longo, vídeo com introdução) |
| `--zoom 4,2-4,8` | folha com **todos os quadros** do trecho, com o tempo em ms; pode repetir. A lupa para medir atraso entre letras, curva e overshoot |
| `--tira-fps 10` | densidade das tiras nas batidas e transições |
| `--sensibilidade 1,5` | acha mais cortes e batidas (referência muito sutil); `0,7` acha menos (referência ruidosa) |
| `--sem-audio` | pula o som |

- Aceita mp4, mov, webm, mkv e gif animado; vídeo girado de celular sai na orientação certa. Acima de
  10 min pede `--inicio`/`--fim`. Precisa só de Node e ffmpeg/ffprobe.
- **Link do YouTube, Instagram, TikTok**: o script não baixa vídeo. Peça o arquivo à pessoa (baixar
  fica por conta dela, respeitando os direitos de quem fez). Gravação de tela serve, mas avise que
  a interface do app gravada e a compressão viram ruído; recorte o trecho com `--inicio`/`--fim`.
- A pessoa disse "gosto do jeito que o texto entra aos 0:12"? Rode já com `--zoom 11,8-12,8`.
- Uma rodada por vídeo de referência, logo depois de receber as referências e antes do primeiro
  storyboard.

## O que sai na pasta

| Arquivo | O que é | Quando abrir |
| --- | --- | --- |
| `relatorio.md` | leitura completa: ficha técnica, resumo, cada plano com suas batidas, transições, som, paleta, um rascunho do roteiro reverso e da linguagem de movimento | sempre, primeiro |
| `00-linha-do-tempo.png` | o vídeo inteiro numa imagem: cor, planos, estado de cada quadro, energia de movimento, foco, luz, câmera e som | sempre: é o eletrocardiograma do ritmo |
| `01-planos-N.jpg` | **storyboard reverso**: para cada plano, o primeiro estado legível (A), o meio (B) e a composição final (C) | sempre |
| `planos/plano-NN.jpg` | folha de cada plano, densa nas batidas e espaçada no hold, com a curva de energia embaixo | nos planos que importam |
| `transicoes/tNN-MM.jpg` | cada transição que não é corte seco, quadro a quadro | para decidir as transições |
| `cortes/cortes-N.jpg` | cada corte seco com os quadros em volta | para ver se corta no movimento e no mesmo eixo |
| `zoom/zoom-A-B.jpg` | todos os quadros do trecho pedido | para medir curva e atraso |
| `paleta.png` | cores dominantes e acentos | para a luz e a cor (da referência, não da marca dela) |
| `dados.json`, `quadros.csv` | tudo em número | para conferir um detalhe |

**Abra as imagens com a ferramenta de leitura de imagem.** O relatório sozinho não basta.

## O roteiro de leitura

**1. O resumo** (`relatorio.md`, "Em uma olhada"). Anote em uma linha cada: formato e quadros por
segundo; quantos planos e a duração típica; o tipo de corte dominante; quanto do tempo é movimento e
quanto é hold; se há música, o BPM e se o corte segue a batida; a cor dominante e os acentos.

**2. A linha do tempo.** A forma do ritmo: picos altos e juntos = trecho acelerado; vales longos =
respiro para leitura; acelera no fim? tem um "drop" isolado? começa calmo? Muito movimento e pouco hold
= motion nervoso; movimento curto e hold longo = motion editorial, de leitura. Vales de foco antes e
depois dos cortes = saídas e entradas com desfoque. Uma tela clara no meio de um filme escuro é virada
de capítulo.

**3. O storyboard reverso: composição e hierarquia.** Para cada plano, olhando A e C: o que é a tela
(frase sozinha, título e apoio, mockup, grade de cards, foto, marca, número, objeto 3D); composição
(eixo central ou assimétrica, quanto a palavra ocupa, margem, quantos elementos); hierarquia (o que se
lê primeiro e por quê); tipografia (serifa ou não, peso, caixa, espaço, palavras por tela, tamanho em
relação ao quadro); imagem e profundidade (camadas, desfoque, sombra, reflexo, luz).

**4. As batidas de cada plano** (`planos/plano-NN.jpg`). O relatório lista as batidas com tempo; para
cada uma, olhando ANTES, MOVE, PICO e FIM, anote:
- **o que** entra, sai ou muda; a **unidade** da tipografia (letra, palavra, linha, bloco);
- **como aparece**: desfoque → foco, opacidade, máscara (wipe, linha que corre), deslize (de onde e
  quanto), escala, rotação 3D, cor ou luz que acende;
- **curva** e **overshoot** (e em quem: objeto ou texto);
- **duração** e **quando começa**; **atraso entre unidades** em ms;
- **hold**: quanto dura e **o que continua vivo**, e se a vida se vê ou só se sente;
- **saída**: duração, para onde, com desfoque, acelerando, ou corta direto do hold.

**A dinâmica dos mockups** (o que mais diferencia um motion bom): de onde o mockup vem (da
profundidade, de baixo, de lado), se inclina em 3D e assenta, se chega com quique pequeno, se os cards
caem em pilha com atraso, se explodem em órbita, se a tela rola por dentro, se a câmera **mergulha** no
mockup e ele vira a próxima tela. Anote o atraso entre cards, o tamanho do quique e o rastro de
desfoque nos objetos que passam perto da câmera.

**5. O zoom nas 2 ou 3 entradas que mais importam.** O relatório sugere os trechos. Com os quadros em
intervalo fixo:
- **curva**: passos grandes no começo e pequenos no fim = saída forte (quanto mais brusca a queda, mais
  "expo"); pequenos e depois grandes = aceleração (típico de saída para corte); pequeno, grande,
  pequeno = simétrica; iguais = linear; passa do ponto e volta = overshoot; oscila = mola;
- **atraso entre letras ou palavras**: quadros entre o começo de uma unidade e a seguinte × duração do
  quadro (17 ms a 60 qps, 33 ms a 30, 42 ms a 24);
- **desfoque**: em quantos quadros a letra fica legível; se o desfoque some antes ou junto com o
  movimento.

**6. As transições** (`transicoes/`, `cortes/`). Para cada passagem: o tipo (corte seco, corte no
movimento, passagem pelo preto ou branco, fusão, mergulho, chicote, cortina, transformação em que um
elemento vira o próximo, match de forma); o eixo (o peso fica no mesmo lugar?); o que liga os dois
lados (forma, cor, direção, um elemento que continua); a duração. Traduza para a biblioteca
(`dinamicas.md`, C1).

**7. A câmera.** Junte os números (push-in de X % no hold, mergulho de Y %) com o olho: viva ou
travada? Paralaxe? Mergulho como transição? Inclinação 3D dos objetos? Câmera na mão?

**8. O ritmo.** A sequência das durações dos planos (2 · 2 · 5 · 5 · 4 · 5), se acelera no fim, onde
estão os respiros, se corta na música, se as durações fecham em batidas inteiras.

**9. Cor e luz.** Fundo, texto, acentos, contraste, onde a luz mora (halo atrás do texto, horizonte,
brilho que atravessa a palavra), grão, vinheta, troca de claro e escuro. **Isso informa a atmosfera,
não a paleta**: as cores vêm da marca dela.

### Ficha de anotação (uma linha por plano)

| Plano | Tempo | Dur. | Tela | Hierarquia | Entrada (unidade · como · curva · ms · atraso) | Hold (dur. · o que vive) | Saída | Câmera | Passagem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3 | 4,1 a 6,5 | 2,4 s | título de 2 linhas sobre um celular inclinado | título > celular > rótulo | palavra · desfoque → foco, sobe 2 % · saída forte · 450 ms · 40 ms; celular vem da profundidade e assenta com quique pequeno | 1,1 s · degradê do fundo deriva | sobe e desfoca · 220 ms · acelerando | push-in de 3 % | corte seco no mesmo eixo |

(Formato de exemplo; os valores vêm do relatório e das folhas.)

## Da leitura para o storyboard

| Leitura | Vira, no storyboard |
| --- | --- |
| Plano (ou estados a/b/c de uma mesma ideia) | uma **cena**; viradas internas viram os quadros do meio |
| Duração do plano | `dur`, arredondada para a batida |
| Quadros A e C do storyboard reverso | os quadros-chave a desenhar, **com a marca e os textos dela** |
| Batidas medidas | as `batidas` da cena, uma frase cada, com tempo, verbo e número |
| Transição | a `saida` da cena (o tipo mais próximo da biblioteca) e a última batida |
| Ritmo, entradas, holds, saídas, câmera, cortes | a `linguagem` do filme e os números de `movimento` |

O relatório já traz um rascunho da linguagem de movimento com os números; complete o que falta
olhando. No `motion.json`, registre a referência em `referencias` com uma linha do que se leva dela
(aparece na prancha):

```json
"referencias": [{ "nome": "ref-lancamento", "leitura": "Cortes secos a cada batida, palavras do desfoque em 40 ms, celular que mergulha na tela." }]
```

## O que copiar e o que não copiar

- **Copie a dinâmica**: tempos, curvas, atrasos, gramática de câmera, tipo de transição, ritmo de
  corte, quanto tempo a tela fica legível.
- **Não copie**: o conteúdo, a marca, as cores, as fontes, as imagens e a composição exata de quem
  fez a referência. O design das telas vem da marca dela.
- **A marca dela ganha da referência**: se a referência usa letra fina e a marca dela é pesada, a
  marca fica e a dinâmica se adapta.
- **As regras da casa calibram a referência**: se a referência corta antes de dar para ler, a tela
  dela segura pelo menos 0,8 s legível; se a referência congela no hold, o hold dela fica vivo; se a
  referência faz o texto quicar, o quique vai para os objetos. Diga isso à pessoa quando acontecer.

## Limites (e o que fazer)

| Limite | O que fazer |
| --- | --- |
| A energia mede **quanto** muda, não **o quê** | abrir a folha do plano no tempo da batida |
| Em cascata, a curva medida é do conjunto, não de cada letra | medir no `--zoom`, letra a letra |
| Câmera e objeto só se separam com textura no fundo | ver se o fundo e o halo também se movem (câmera) ou só o elemento |
| Push-in lento só é medido em hold sem troca de conteúdo | comparar os quadros A e C |
| Movimento muito rápido sai como "energia alta + desfoque", sem direção | olhar o rastro na tira |
| Viradas internas partem uma cena em 2 ou 3 planos | tratar como estados da mesma cena quando a ideia é a mesma |
| BPM pode sair dobrado ou pela metade; batida e contratempo se confundem | confirmar ouvindo quando importar |
| Sem leitura de texto | ler as palavras nas imagens |
| Vídeo de rede social: compressão, legendas, tarjas, interface gravada | pedir o original, ou recortar o trecho |

## Outras referências de motion

- **Gif, clipe curto**: o mesmo script.
- **Prints de quadros, shots de portfólio, um protótipo do Figma**: não passam pelo script; olhe como
  imagens e anote a composição e o que se pode deduzir do movimento (de onde vem, o que é objeto, o que
  é texto). Pergunte só o que a imagem não responde.
- **"Quero algo como o motion da marca tal"** sem arquivo: peça o vídeo ou dois ou três prints; sem
  isso, siga a linguagem da casa e diga que é a sua leitura.

## Como falar com a pessoa

Ela não vê o relatório. Mostre o **storyboard reverso** (e uma ou duas folhas, se ajudar) como prova
do que foi entendido, e resuma em 4 a 6 linhas a dinâmica que vai levar para o motion dela, em
linguagem de design: "Na sua referência as palavras entram uma a uma, saindo do desfoque, bem rápidas
no começo e assentando devagar; cada tela segura quase um segundo para leitura e sai acelerando; entre
as telas a câmera mergulha no próximo elemento." Pergunte só o que o vídeo não responde ("Você quer
esse corte seco a cada meio segundo ou um ritmo mais calmo?").
