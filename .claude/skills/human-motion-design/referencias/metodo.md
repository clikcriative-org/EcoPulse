# O método

O processo que faz a primeira geração de motion já sair acertada. Cada passo existe por um motivo;
pular um costuma custar duas rodadas depois.

```
máquina → inputs e leitura das referências → storyboard estático rebuscado → refino até aprovar
→ escolha do formato → uma cena por vez, até o quadro aprovado → crítica e fluidez a 60 qps
→ filme inteiro → página de entrega → rodadas de ajuste
```

## A postura: showreel

Encare todo pedido, do mais simples ao mais ambicioso, como se fosse o showreel do seu currículo:

> Cada cartela precisa de uma ideia de movimento própria, que ninguém esqueça. Mas o filme tem que
> parecer uma peça só: o mesmo ritmo, as mesmas curvas, cortes no mesmo eixo. O quadro final de cada
> cartela foi aprovado no storyboard: anime **até** ele. O movimento é seu, a composição é dela.
> Quem assiste precisa conseguir ler cada frase.

Quando já existe uma versão (uma cartela de logo antiga, a primeira prévia), ela é o **piso**: o
que você fizer precisa ser claramente mais memorável.

## 1. Entender antes de desenhar

- **Leia as referências de verdade** (`analise-de-referencia.md` para vídeo, `marca.md` para design).
  Abra as imagens. Número aponta onde olhar; o olho decide o que é.
- **Decida o esqueleto** e anote no `briefing.md`:
  - duração total e número de cenas;
  - o **papel narrativo** de cada cena (o pedido, a resposta, a promessa, o produto, a prova, o
    convite, a marca): é ele que dá o título da cartela;
  - BPM (o da trilha, se ela tiver; o que o vídeo de referência mostrar; senão 120);
  - formato base (pelo destino);
  - onde entram as imagens, vídeos e mockups dela;
  - o que fica de fora (texto demais, ideia demais para o tempo).
- **Durações de referência** (faixas, não receita):

| Peça | Duração | Cenas |
| --- | --- | --- |
| Cartela de logo / vinheta curta | 4 a 6 s, entrada resolvida até ~2,5 s | 1 |
| Abertura (de vídeo, de evento, de canal) | 6 a 12 s | 2 a 4 |
| Filme cartelado (manifesto, lançamento, showreel) | 20 a 40 s | 6 a 10 |
| Motion de produto ou app com mockup | 15 a 30 s | 4 a 7 |
| Anúncio animado | 15 s ou mais, vivo até o último quadro | 4 a 6 |

Uma frase curta pede ~2 s; uma montagem com clímax (grade que acende, pilha que explode, marca que
se abre) pede 4 a 5 s.

## 2. Storyboard estático primeiro, animação depois

- **Nada de animação nem animatic enquanto o design não estiver certo.** A pessoa decide melhor
  olhando quadros parados grandes do que um vídeo que passa. Pense a animação nas batidas de cada
  cartela, escrita, e só anime depois da aprovação.
- Cada cartela mostra **o primeiro e o último quadro** lado a lado; 3 ou 4 quadros só quando há uma
  virada de estado no meio (frase → símbolo → grade; capa única → pilha → órbita; marca fechada →
  aberta → palavra).
- Embaixo dos quadros, **as batidas de movimento em texto**, com tempo: já são o roteiro da animação.
- Os quadros-chave são **renderizados do mesmo código que depois anima**, com a marca e as imagens
  reais. O CSS natural da cena é o quadro final; animar é ir até ele. Uma fonte de verdade: o que foi
  aprovado no storyboard é, pixel a pixel, o quadro final do filme.
- Na aprovação, `storyboard.mjs --aprovar --sem-revisao` congela os quadros em `storyboard/aprovado/<formato>/`:
  são os PNGs contra os quais a animação é conferida.
- O que costuma mudar nas revisões, e por isso já deve vir certo na primeira: escala de filme e não
  de site; textos de apoio redundantes fora; cards só com título; luz unificada entre as cartelas;
  tudo num eixo só; um único acento de cor para o filme inteiro. Ver `storyboard.md`.

## 3. O brief comum e a vizinhança

Antes de animar, tudo que vale para o filme inteiro fica escrito num lugar só:

- **`linguagem`** no `motion.json`: o ritmo, a entrada de texto, a câmera, o hold, a saída, a luz, o
  corte. Vale para todas as cenas e aparece na prancha (`movimento.md`).
- **`movimento`** no `motion.json`: os números da casa que o motor usa por padrão (curva de entrada,
  cascata por letra e por palavra, duração da entrada, subida, desfoque, saída, câmera). Ajuste aqui
  para o filme todo mudar junto, não cena por cena.
- **A vizinhança**: a `saida` de cada cena diz como ela termina num estado que conversa com a
  próxima, e a próxima começa num estado que conversa com ela (mesmo eixo, mesma direção, um elemento
  que atravessa, a mesma luz). **As transições são decididas no storyboard, antes de animar**, nunca
  inventadas cena a cena.
- **As regras que não se negociam**: copy e marcas exatamente as aprovadas, nada novo escrito na
  tela; cores só da marca; função pura do tempo.
- **"Mantenha"**: correções que a pessoa fez ou confirmou vão para o `briefing.md` e valem para todas
  as rodadas seguintes.

## 4. Uma cena por vez, com instrumentos

- Cada cena é animada isolada, com `quadro(t)` como função pura do tempo (chamada fora de ordem,
  para trás e para frente; toda propriedade animada recebe valor em todo quadro). Proibido
  `Math.random`, `Date`, timers, `requestAnimationFrame` e `transition` de CSS; variação só por
  semente (`api.rand`, `api.ruido`).
- Antes de mostrar qualquer coisa, a conferência de `qualidade.md`: folha de contato a cada 0,25 s,
  instantes pontuais, quadros consecutivos nos trechos rápidos, quadro final igual ao aprovado, motor
  sem erro, render do trecho a 60 qps e detector de fluidez.
- **Abra os PNGs e olhe de verdade.** Julgue por sequências densas de quadros, nunca por um MP4
  assistido de passagem.

## 5. Animador, crítico, finalizador

Para cada cena, três papéis, mesmo que todos sejam você:

1. **Animador** (motion designer sênior): lê a linguagem do filme, o storyboard aprovado e o arquivo
   atual da cena ("você está evoluindo o trabalho, não recomeçando"), mexe só na própria cena e
   itera pelo menos três vezes com o detector e com folhas de quadros consecutivos.
2. **Crítico** (diretor de motion de um estúdio de ponta, exigente; a nota padrão é baixa até provar
   o contrário): não edita. Renderiza a 60 qps, roda o detector, monta folhas e devolve **nota de 0 a
   10, pedidos atendidos (sim/não, um por um), vida no hold (sim/não), resumo do detector e uma lista
   de problemas com severidade (alta, média, baixa), tempo local e correção concreta**.
3. **Finalizador**: resolve tudo de severidade alta e média e confere de novo a 60 qps.

Num filme com muitas cenas, se o ambiente permitir agentes em paralelo, rode uma trilha por cena,
cada uma mexendo só nos arquivos da sua cena (`cenas/<id>.js` e `.css`). Nunca dois agentes na mesma
cena, nunca um agente mexendo no `motion.json` enquanto outros trabalham. Depois junte, renderize o
filme inteiro e passe o crítico no filme todo, olhando principalmente as passagens.

## 6. O filme inteiro, a entrega e as rodadas

- Filme inteiro na taxa de entrega, detector no filme todo, só então a página de entrega
  (`entrega.md`).
- O que a pessoa costuma cobrar depois de ver em movimento, em ordem (antecipe):
  1. **Fluidez**: "bem fluido, de motion designer sênior". Encadear (o próximo movimento começa antes
     de o anterior terminar), velocidade contínua (inclusive através do corte), nada aparecendo
     inteiro num quadro.
  2. **Vida no hold**: depois que monta e a transição passa, alguma coisa sempre se mexendo, bem leve
     (um degradê, a luz, a câmera), para nunca ficar parado.
  3. **Tempo de leitura**: "precisa de mais um segundinho segurando". Quando o tempo cresce, a
     entrada fica igual e **o hold cresce**.
  4. **Pedidos de cena**: um movimento que pode continuar em vez de pousar e virar a transição para a
     próxima; uma revelação que ela quer ver em etapas.
- **Como interpretar um pedido.** A fala descreve a **ordem e o que ela quer ver**. Exemplo real
  generalizado: a pessoa disse "aparece primeiro o símbolo, depois a marca, depois abre"; a rodada
  leu isso como "três etapas separadas com respiros mortos" e fundiu tudo num gesto só; ela pediu as
  etapas de volta. O que incomodava era o **estado parado**, não a etapa. Regra: **cada etapa vira um
  estado que se lê, a passagem entre estados é encadeada, e o estado do meio está vivo** (algo se
  aproxima, junta luz, aperta). Etapa não é pausa.
- **Ordem em dúvida?** Monte duas versões com as mesmas cenas em ordens diferentes (`montagens` no
  `motion.json`), renderize cada uma como uma versão (`--montagem A`, depois `--montagem B`, cada
  uma com `--nota`) e deixe a pessoa escolher. Depois disso, só a escolhida segue.

## 7. Formatos

Só depois de o formato base estar firme, o outro é **recomposto**, cartela por cartela, com a mesma
ideia, as mesmas marcas, a mesma copy e a mesma linguagem de movimento. O formato base aprovado não
muda: regras novas ficam escopadas no outro formato, e o base é conferido de novo no fim
(`formatos.md`).

## 8. Cartela de logo e vinheta

Quando o pedido é (ou termina em) uma cartela de logo e a pessoa quer "uma entrada foda":

- Faça **três ideias de verdade diferentes**, não três variações da mesma (ex.: luz que varre o preto
  e revela a logo; a logo em fatias que deslizam e encaixam na batida; o símbolo como objeto com
  física, que é arremessado e bate; as letras chegando do fundo do espaço ou de trás da câmera; o
  símbolo que nasce de um ponto de luz e abre a marca em etapas). Ver `dinamicas.md` (C9).
- Cada ideia é uma cena própria (`logo-luz`, `logo-fatias`…), cada uma numa montagem
  (`montagens`), renderizada como versão com folha, MP4 e detector. A pessoa escolhe.
- Regras: termina exatamente no quadro aprovado; entrada principal resolvida até ~2,5 s, o resto é
  hold vivo; 5 a 6 s no total; fundo do começo e do hold na cor de fundo da marca (luz durante a
  entrada pode existir, mas se dissolve); a logo é sagrada (separar, mover, girar, mascarar e desfocar
  peças, sim; redesenhar letra ou trocar a cor no hold, nunca).

## 9. Exportação por destino

- Mestre a 60 qps. Outras taxas são **renderizadas nativas**, nunca convertidas de 60.
- Peça que vai para edição: `--prores` (`.mov` ProRes 422 HQ 10 bits) e `--qualidade maxima`.
- **Peças separadas** quando o destino pede (`--por-cena`): a prévia emendada não é entregue como se
  fosse a peça.
- O filme sai sem som. Som genérico gerado por IA soa barato; quem for sonorizar usa o
  `render/v<N>/marcas.json` (cortes, batidas e transições em tempo global) para sincronizar os sons
  aos eventos da animação.

## A pasta do projeto

```
human-output/motion-design/<slug>/
  motion.json          o roteiro: cenas, durações, quadros-chave, batidas, transições, linguagem
  briefing.md          o pedido, as referências lidas, a marca, as decisões, as rodadas, "mantenha"
  marca/               tokens.css, fontes/, ativos/ (logo, símbolos), marca.md, leitura/
  midia/               fotos e vídeos dela que podem aparecer no filme
  referencias/<nome>/  a leitura de cada vídeo de referência
  cenas/<id>.js .css   uma cena (e _comum.css, _comum.js, _transicoes.js, se precisar)
  filme/               o filme montado, com player (abre no navegador; tecla A mostra a área segura)
  storyboard/          index.html (a prancha), quadros/<formato>/, aprovado/<formato>/
  render/v<N>/         os MP4, a capa, marcas.json; render/trechos/ para testes
  previa.html          a página de entrega
  .cache/              quadros renderizados e inspeção (pode apagar quando terminar)
```
