# O storyboard rebuscado

O storyboard é onde a primeira geração de vídeo é ganha. Se cada cartela chega à animação com a
composição aprovada, a ideia de movimento dita numa frase e as batidas escritas com tempo, a
animação só executa o que já foi decidido.

O `storyboard.mjs` monta a prancha (`storyboard/index.html`) a partir do `motion.json` e dos
quadros renderizados das cenas. O seu trabalho é **o conteúdo**: o roteiro, a composição de cada
quadro e a escrita das batidas.

## A prancha (o que a página mostra)

1. **Cabeçalho**: uma linha pequena com o projeto e a revisão; **o título em escala de cartaz** (o
   `cartaz` do `motion.json`: a primeira frase do próprio filme, ou a frase que resume a peça); os
   metadados (peça, duração, número de cenas, formato, ritmo, taxa do mestre).
2. **A linguagem do movimento**: os blocos da `linguagem` (Ritmo, Texto, Câmera, Hold, Saída, Luz…),
   que valem para o filme todo.
3. **Referências**: uma miniatura e uma linha do que se leva de cada vídeo de referência.
4. **Sequência**: a régua do tempo (cada cena numa faixa, as janelas de transição hachuradas) e a
   folha de contato com o quadro final de cada cena.
5. **Uma seção por cena**: número grande (01, 02…), **título que diz o papel narrativo**, a ideia de
   movimento numa frase, etiquetas (fundo puro para edição, mídia da pessoa), o intervalo de tempo e a
   duração; **os quadros-chave grandes** com rótulo e legenda; o bloco **Movimento** (as batidas com
   tempo e tipo); ao lado, a câmera, como entra, como sai e o som; e entre uma cena e outra, a
   passagem com o nome da transição e a duração.
6. **Rodapé** curto.

A página é autossuficiente (abre em qualquer navegador, sem rede) e os quadros são renderizados com
a marca e as imagens reais, nunca desenhados à parte.

## O que cada cartela precisa ter decidido

| Decisão | Onde fica | Exemplo |
| --- | --- | --- |
| **O papel narrativo** | `titulo` | "A pergunta", "O produto", "A prova", "O convite", "A marca" |
| **A ideia de movimento em uma frase** (a metáfora) | `ideia` | "A lente encontra a frase", "O celular chega da profundidade e a tela se monta sozinha", "A frase grande não sai de cena, ela vira o crédito" |
| **Primeiro e último quadro** (e os do meio, se há virada) | `quadros` + o CSS e as `poses` da cena | Início: "uma capa só, grande, no centro"; Fim: "as capas em órbita em volta da frase" |
| **As batidas** (3 a 5) | `batidas` | ver abaixo |
| **A câmera** | `camera` | "Push-in lento e contínuo, passando por 1,0 no quadro aprovado" |
| **Como sai para a próxima** | `saida` | `{ "tipo": "mergulho", "alvo": ".tela-app", "alvoTexto": "na tela do app" }` |
| **Se é plano para vídeo** (fundo puro, a filmagem entra na edição) | `fundoPuro: true` | letra clara sobre a cor de fundo pura, sem luz nem foto |
| **A duração** | `dur` | 2 s para uma frase; 4 a 5 s para uma montagem com clímax |
| **O som** (opcional) | `som` | "um 'tic' seco quando os cards travam" |

A ideia é o que diferencia uma cartela de outra. "O texto aparece e depois some" não é ideia. Uma
ideia boa é física e visual: tem um verbo, uma causa e um efeito ("a resposta empurra a frase", "a
pilha prende o ar e explode em órbita", "a proximidade acontece na tipografia: as letras chegam de
longe e se aproximam").

## Como escrever uma batida

Cada batida tem **um tempo local** (segundos dentro da cena, vírgula decimal na prancha, quase sempre
na batida ou na meia batida do BPM) e **uma frase**. A frase tem:

- **um verbo de movimento concreto**: sai do desfoque para o foco, desliza meia palavra, sobe meia
  altura, chega por baixo, acende do centro para fora, recua e vira, explode, se espalham, se apagam
  em ondas, encolhe até virar um ponto, se recolhe, mergulha, atravessa;
- **o número que importa**: duração ("em 450 ms"), intervalo ("a cada 40 ms", "em ondas de 60 ms"),
  quantidade ("de 96 %", "push-in lento de 3 %"), curva quando ela é a ideia ("com a curva simétrica
  em 900 ms");
- **a ordem**: do centro para as bordas, uma a uma, da esquerda para a direita, primeiro o brilho e
  depois a letra;
- **a intenção**, às vezes com onomatopeia: como um respiro, para dar tempo de ler, com um quique
  pequeno ("blub, blub, blub");
- **na última batida, a ligação com a vizinha**: "corte seco no mesmo eixo", "tudo converge num
  ponto de luz, de onde nasce o símbolo da próxima", "a câmera mergulha na tela, que vira a próxima".

Cada batida tem um **tipo**, que vira uma etiqueta colorida na prancha: `tipo` (Tipografia),
`camera` (Câmera), `transicao` (Transição), `luz` (Luz), `objeto` (Objeto) e `vida` (Vida no hold).
Cartelas de 2 s têm 3 ou 4 batidas; as de 4 a 5 s têm 5.

| Ruim | Bom |
| --- | --- |
| "O texto aparece com uma animação bonita." | "0,0 · A frase sai do desfoque para o foco, letra a letra, 26 ms entre elas, subindo de pertinho." |
| "Os cards entram." | "0,5 · Os cards caem na tela em accelerando (90 → 40 ms), cada um com um estalo pequeno." |
| "Fica parado para leitura." | "1,2 · Hold: a câmera continua chegando e a luz de trás respira; o degradê da palavra deriva devagar." |
| "Transição suave." | "1,9 · As pontas da frase apagam primeiro e o miolo converge num ponto de luz, que vira o símbolo da próxima." |
| "Logo aparece." | "0,1 · O símbolo acende de um ponto de luz, girando um fio; a marca aparece inteira, quente, e esfria até a cor final." |

## Exemplo de uma cena no `motion.json`

```json
{
  "id": "app",
  "titulo": "O produto",
  "dur": 3.4,
  "ideia": "O celular chega da profundidade e a tela se monta sozinha, card a card.",
  "camera": "Herda o embalo do corte e segue em push-in lento; antecipa recuando 2,5 % antes de mergulhar na tela.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "O celular chega girado, da profundidade", "t": 0.25 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "Os cards caem na tela, um a um", "t": 0.62 },
    { "id": "fim", "rotulo": "Fim", "legenda": "O título à esquerda, o app montado à direita", "t": 2.3 }
  ],
  "batidas": [
    { "t": 0.05, "tipo": "objeto", "texto": "O celular chega da profundidade girando 32°, com uma mola curta, e assenta de frente." },
    { "t": 0.25, "tipo": "tipo", "texto": "O título sai do desfoque palavra a palavra, 45 ms entre palavras." },
    { "t": 0.5, "tipo": "objeto", "texto": "Os cards caem na tela em accelerando (90 → 40 ms), cada um com um estalo pequeno." },
    { "t": 1.5, "tipo": "vida", "texto": "Hold: a câmera continua chegando e a luz respira." },
    { "t": 2.65, "tipo": "transicao", "texto": "O resto recua e escurece; a câmera mergulha na tela do app até ela cobrir o quadro." }
  ],
  "saida": { "tipo": "mergulho", "alvo": ".tela-app", "alvoTexto": "na tela do app" }
}
```

O `t` de cada quadro-chave é o instante em que aquele estado acontece na animação. O **último**
quadro é o quadro aprovado: fica no hold, depois de a entrada assentar, e é nele que a câmera viva
passa pela escala 1,0 (`api.ref`). Deixe pelo menos 0,8 s de hold legível depois dele antes da saída.

E a `linguagem` do filme (no topo do `motion.json`), escrita para esta peça, não copiada:

```json
"linguagem": [
  { "titulo": "Ritmo", "texto": "120 BPM: uma batida = 0,5 s. Entradas e trocas na batida ou na meia batida." },
  { "titulo": "Texto", "texto": "Do desfoque para o foco, subindo de pertinho, palavra a palavra. Nunca quica." },
  { "titulo": "Câmera", "texto": "Nunca parada: push-in de 3 a 6 % no plano, passando por 1,0 no quadro aprovado." },
  { "titulo": "Hold", "texto": "Legível por pelo menos 0,8 s e vivo: a luz respira, um brilho passa uma vez." },
  { "titulo": "Saída", "texto": "200 a 300 ms, acelerando até o último quadro; corta em movimento." },
  { "titulo": "Passagens", "texto": "Cortes no mesmo eixo entre frases; mergulho quando a próxima é sobre um elemento desta." }
]
```

## Desenhar os quadros-chave

A cena é um arquivo só, que serve ao storyboard e à animação:

```js
/* app — "O produto" (3,4 s)
   Ideia: o celular chega da profundidade e a tela se monta sozinha, card a card. */
Motion.cena('app', {
  render: (c) => {
    const cards = [0, 1, 2, 3].map(() => `<div class="card"><b></b><span></span></div>`).join('');
    return `
    <div class="luz"></div>
    <div class="mundo">
      <h2 class="titulo chamada">Tudo num<br>lugar só</h2>
      <div class="aparelho">${c.mockup('celular', { tela: `<div class="tela-app">${cards}</div>`, classe: 'fone' })}</div>
    </div>`;
  },
  // o CSS natural da cena é o "fim"; os outros quadros são poses por cima dele
  poses: {
    inicio: (el, api) => api.midia.mockup(el.$('.fone'), { ry: -26, rx: 6, s: 0.9 }),
    meio: (el, api) => api.$$('.card').slice(2).forEach((card) => api.set(card, { o: 0 })),
  },
});
```

- **O CSS natural é o quadro final aprovado.** Escreva o `.css` da cena como se ela fosse uma arte
  parada perfeita: é ela que vira o PNG, a capa e o último quadro do movimento.
- **Os estados do meio são `poses`** (funções que aplicam estilos por cima do natural) ou CSS com a
  classe do quadro: na captura da pose, a seção recebe `q-<id>` (`.cena-app.q-inicio .chamada { … }`).
- Enquanto não houver `quadro(t)`, o storyboard usa as poses. Depois que a cena for animada, ele
  captura do próprio `quadro(t)` nos tempos dos quadros-chave (`--poses` força as poses de novo). O
  modelo de cena que o `novo-projeto` cria já vem com um `montar` e um `quadro` de exemplo: na fase
  do storyboard, escreva a cena sem eles (como acima).
- **Imagens reais**: `c.foto`, `c.video`, `c.svg`, `c.mockup` com os arquivos de `midia/` e
  `marca/ativos/` (a tela do mockup pode ser um print ou uma gravação dela: `tela: c.foto('print-do-app')`).
  Nada de retângulo cinza no lugar da foto quando ela trouxe a imagem; a interface desenhada em
  código, como os cards acima, é para quando não há print e a tela é só sugestão de produto.

## Regras de composição dos quadros

- **Escala de filme, não de site.** Tipografia em `cqmin` (o mesmo tamanho nos dois formatos):
  título de cartela 10 a 11 cqmin; frase curta de abertura 13 a 15 cqmin; a palavra-manchete do
  tamanho que couber com folga; apoio, quando existir, 2,4 a 3,6 cqmin e só se acrescenta algo.
- **Um eixo só** num filme cartelado (tudo centralizado), salvo quando a marca ou a referência pedem
  assimetria; nesse caso, a assimetria é a mesma em todas as cartelas.
- **Um único acento** de cor ou degradê no filme todo, numa palavra de destaque por bloco.
- **Texto de apoio redundante fora.** Se o título já diz, o apoio sai. Cards só com título.
- **Não é site, é design**: nada de botão, pílula de interface, rótulo, título + logo empilhados como
  seção de página, check, cadeado, campo de senha, cantoneira de visor.
- **Materiais de uma família**: todos os cards do mesmo vidro ou da mesma superfície; varia a luz, não
  o material.
- **Luz unificada**: a luz de fundo conversa de uma cartela para a outra.
- **Plano para vídeo** (`fundoPuro`): só a cor de fundo pura e a letra clara, sem símbolo, sem foto,
  sem luz; o vídeo entra por trás na edição.
- Sem viúva, sem ponto final em título, cartela ou chamada.
- O quadro final é **completo e bonito sozinho**: vira a capa do vídeo.

## Gerar, olhar, mostrar

```bash
node <skill>/scripts/storyboard.mjs <projeto>                    # a prancha no formato base
node <skill>/scripts/storyboard.mjs <projeto> --cenas app,fecho  # só essas cenas foram mexidas
node <skill>/scripts/storyboard.mjs <projeto> --formato 9x16     # a recomposição em pé (depois)
node <skill>/scripts/storyboard.mjs <projeto> --pdf              # também storyboard.pdf
node <skill>/scripts/storyboard.mjs <projeto> --aprovar --sem-revisao   # congela a revisão que ela aprovou
```

Antes de mostrar, abra **cada PNG** de `storyboard/quadros/<formato>/` e confira: a composição se
sustenta sozinha; nada cortado nas bordas; viúva; contraste; escala de filme; o eixo; um destaque;
a fonte da marca carregou (letra do sistema no lugar da fonte dela é defeito); as imagens dela
estão lá. Se o motor avisou algo no fim do comando, conserte antes.

Para a pessoa, depois de abrir a prancha: a ideia do filme numa frase, o que torna dois ou três
momentos especiais ("na cena 3 a câmera mergulha na tela do app e ela vira a próxima cena"), e
**uma** pergunta objetiva ("Quer a abertura mais calma, ou seguimos com esse ritmo?").

Na aprovação: `--aprovar --sem-revisao` (a revisão aprovada é a que ela viu), e só então a pergunta do formato (16:9, 9:16 ou os dois).
