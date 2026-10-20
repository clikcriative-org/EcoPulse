# Render, entrega e rodadas

Todo motion termina igual: **renderizar, conferir a fluidez, mostrar a página de entrega, perguntar o
que mudar**. A pessoa nunca recebe só um arquivo solto nem só uma descrição.

## 1. Renderizar

```bash
node <skill>/scripts/renderizar.mjs <projeto> --formato 16x9 --fps 60
node <skill>/scripts/renderizar.mjs <projeto> --formato ambos --fps 60 --nota "entrada da cena 2 mais lenta"
```

| Opção | Para quê |
| --- | --- |
| `--formato 16x9 \| 9x16 \| ambos` | o que ela escolheu depois do storyboard |
| `--fps 30 \| 60` | nativo nessa taxa (nunca converte 60 → 30) |
| `--qualidade final \| rascunho \| maxima` | `rascunho` só para testar trechos; `maxima` captura em 2× (peça para edição) |
| `--cenas a,b` ou `--de 2 --ate 5` | só um trecho, com os mesmos tempos (vai para `render/trechos/`, não vira versão) |
| `--por-cena` | também um MP4 por cena |
| `--prores` | também `.mov` ProRes 422 HQ 10 bits, para a ilha de edição |
| `--montagem B` | outra ordem das cenas definida em `montagens` |
| `--nota "…"` | o que mudou nesta versão (aparece na página de entrega) |
| `--versao N` | grava numa versão já existente (juntar formatos na mesma versão) |
| `--workers 4` | navegadores em paralelo (padrão: metade dos núcleos, até 4) |

- Sai em `render/v<N>/`: `<slug>-<formato>-<fps>fps.mp4`, `capa-<formato>.png` (o quadro escolhido em
  `capa` no `motion.json`, normalmente o final da última cena), `marcas.json` (cortes, batidas e
  transições em tempo global, para som e edição).
- **Cache**: os quadros ficam em `.cache/quadros/`. Numa rodada de ajuste, só as cenas que mudaram são
  renderizadas de novo. Mexeu na marca, no motor ou na mídia, tudo é refeito.
- **Tempo**: antes do primeiro render longo, `checar.mjs --completo` estima (um filme de 30 s a 60 qps
  costuma levar alguns minutos; desfoque pesado leva mais). Diga à pessoa quanto vai demorar.
- O **detector de fluidez** roda no fim e lista os alertas com cena e tempo local. Conserte antes de
  mostrar (`qualidade.md`).

## 2. A página de entrega

```bash
node <skill>/scripts/previa.mjs <projeto> --servir
```

Gera `<projeto>/previa.html` e sobe um servidor local (padrão `http://127.0.0.1:4600/previa.html`;
servida, os botões de baixar funcionam em qualquer navegador). O comando fica rodando enquanto o
servidor estiver no ar: rode em segundo plano e use o endereço que ele imprimir (porta ocupada, ele
pega a seguinte). A página tem:

- o título, a versão e a data, e "Nesta versão: …" (a `--nota`);
- **os vídeos tocando** (16:9 e 9:16 lado a lado quando há os dois), cada um com **MP4**, **Capa PNG**
  e **ProRes** quando houver;
- **Baixar tudo (.zip)**;
- **as cenas** com miniatura (clicar leva o vídeo para aquele tempo) e o **MP4 da cena** quando
  renderizado com `--por-cena`;
- **o storyboard** (quadros e batidas) e o link para a prancha completa;
- **as versões anteriores**;
- **"Quer mudar alguma coisa?"** com exemplos de pedidos.

A página leva só o trabalho: nada de relatório técnico, regra da conversa, nome de comando ou
bastidor. Não escreva nada disso em `--nota` nem nos textos do `motion.json` que aparecem nela.

**Como mostrar**: abra a página para a pessoa (no painel de navegador do app, se houver; senão no
navegador dela) e diga o endereço e a pasta. O servidor fica rodando enquanto a conversa precisa dele;
sem `--servir`, a página abre direto do arquivo, mas os botões de baixar podem não funcionar.

## 3. A mensagem

Duas ou três frases, em linguagem de design:

- o que ficou e o momento mais forte ("a câmera mergulha na tela do app e ela vira a cena do
  benefício");
- o que você decidiu sozinho que ela talvez queira saber ("a fonte da marca não tinha arquivo; usei a
  mais parecida");
- **uma** pergunta objetiva do que ajustar ("Quer o fim segurando mais na marca, ou está bom assim?").

## 4. Rodadas de ajuste

1. **Entenda o pedido** como quem animou: a fala descreve o que ela quer ver (`metodo.md`, seção 6).
   Ambíguo de verdade? Uma pergunta com 2 ou 3 opções.
2. **Mude só o que foi pedido.** O resto continua como aprovado. Registre no `briefing.md`, em
   "Rodadas", e o que ela confirmou vira "mantenha".
3. **Mudou o desenho** (texto, composição, imagem, cena nova): mostre os quadros-chave novos
   (`storyboard.mjs --cenas <id>`) antes de animar. **Mudou movimento ou tempo**: anime direto.
   Pediu mais tempo de leitura: o hold cresce, a entrada fica igual.
4. Confira a cena mexida (folhas, pureza, fluidez do trecho) e renderize com `--nota`.
5. Atualize a página (`previa.mjs <projeto> --servir`); a versão nova aparece em cima e as anteriores
   ficam listadas.
6. Pergunte de novo, até ela dizer que está pronto.

Pedidos comuns e como traduzir:

| Ela diz | Você faz |
| --- | --- |
| "Mais fluido", "tá travando" | encadear gestos, velocidade contínua no corte, rampas de 3 a 5 quadros, pousos sem freada; detector limpo |
| "Tá parado no fim" | vida no hold (luz que respira, degradê que deriva, um brilho que passa, câmera viva) |
| "Não deu para ler" | hold maior (a entrada não muda) ou menos texto na tela |
| "Mais impacto", "mais foda" | uma dinâmica-assinatura mais forte na cena (mergulho, explosão, nascer da luz), escala maior, contraste de ritmo (calmo antes do clímax) |
| "Mais calmo", "mais elegante" | entradas mais longas, cascata maior, menos objetos com mola, transições por eixo e esmaecer |
| "Mais rápido", "mais dinâmico" | cenas mais curtas, cortes na batida, entradas mais secas; nunca à custa do tempo de leitura |
| "Muda a cor", "troca a fonte" | `marca/tokens.css` (tudo muda junto), storyboard da cena mais afetada, render |
| "Faz a versão vertical" | recompor (`formatos.md`) e renderizar o 9:16 na mesma versão (`--versao N`) ou numa nova |

## 5. Depois de pronto

- Ela quer as peças para edição: `--prores --qualidade maxima` (e `--por-cena` se a edição monta).
- Ela quer sonorizar: o filme sai sem som; o `marcas.json` dá os tempos de cada corte, batida e
  transição para o som sincronizar com a animação.
- Limpeza: a pasta `.cache/` do projeto pode ser apagada quando ela não for mais pedir ajuste (guarda
  1 a 2 GB de quadros num filme de 30 s). Pergunte antes de apagar.
