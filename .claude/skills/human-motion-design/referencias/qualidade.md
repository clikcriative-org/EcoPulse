# Qualidade: a barra, os anti-padrões e a conferência

## A barra

O motion precisa aguentar ficar ao lado do melhor material da referência que a pessoa trouxe, e ao
lado de um showreel de estúdio. Antes de mostrar, cada cena responde sim a tudo:

- tem **uma ideia de movimento** que dá para dizer numa frase, e ela aparece na tela;
- **dá para ler** cada frase (pelo menos 0,8 s de hold legível);
- o **quadro final é igual ao aprovado** e é bonito sozinho;
- **nada aparece inteiro num quadro, nada para seco, nada pisca, nada congela**;
- a passagem para a próxima **conversa** com ela (eixo, ponto, elemento, luz, direção);
- parece **do mesmo filme** que as outras (mesmo ritmo, mesmas curvas, mesma luz);
- tem a **cara da marca dela**, não a da referência nem a da casa.

## Anti-padrões (e o que fazer no lugar)

| Anti-padrão | No lugar |
| --- | --- |
| **Círculos, anéis, bolinhas e órbitas decorativos**; anel de luz numa explosão; "ping" em anel ("cara de IA") | a forma vem da tipografia, da luz que varre ou do próprio objeto |
| **Íris circular, bola de luz** como transição | `esmaecer` (véu uniforme, sem forma) |
| **Halo com borda de elipse visível**, luz com borda dura | luz com queda até zero sem borda, desfoque largo; halos maiores e mais fracos |
| **Manchas de luz soltas** num plano claro | luz de fundo sem forma, que só deriva e respira |
| **Texturas de catálogo** (cristal, líquido, nácar, mármore genérico) como fundo ou card | as imagens da própria marca, luz feita em código |
| Grão, vinheta, glow, degradê ou partícula **em plano para vídeo** | a cor de fundo pura em todos os quadros; vida só na tipografia ou na marca |
| **Glow exagerado** | glow mínimo, sem halo atrás; se chamou atenção, é demais |
| **Cartela no fundo chapado morto** ou de cor forte sem motivo | fundo vivo (luz escura que passeia) até apagar só nos últimos ~0,7 s |
| **Cara de site ou de interface** na composição: botão, pílula de UI, rótulo, título + logo empilhados como seção de página, vidro com cadeado, campo de senha, check, cantoneira de visor, lente de vidro flutuando | cena cinematográfica, imagem forte ou tipografia grande; quase nada além disso (a tela do produto dentro de um mockup é o produto, não é interface de enfeite) |
| Assets da referência colados em **layout inventado** | a referência é inspiração de dinâmica, não colagem |
| **Cards de famílias diferentes**; card branco num bento escuro | todos do mesmo material; varia só a luz |
| **Estado parado entre etapas**, e o erro oposto: fundir etapas que a pessoa queria ver | etapas legíveis, passagens encadeadas, estado do meio vivo |
| **Quadro congelado** no hold | vida leve contínua (`movimento.md`) |
| Tipografia que **quica, estica ou gira sem motivo**; piscar; tremer | overshoot só em objeto; nada pisca; tremor só no impacto físico |
| **Algo aparecendo inteiro num quadro** (carimbo seco, troca instantânea) | 3 a 5 quadros de rampa, mesmo nos carimbos |
| **Movimento forte que para seco** | pouso com velocidade e desaceleração zerando juntas |
| **Texto novo inventado na tela**, número inventado | só a copy aprovada; número só se for verdadeiro |
| **Título em negrito por reflexo**; duas cores de destaque; destaque em itálico; degradê em texto corrido | impacto pelo tamanho e pelo espaço (salvo se a marca é pesada de propósito); um destaque por bloco |
| **Viúva**, ponto final em título | quebras desenhadas (`tipo.semViuva`) |
| **Escala de site** (título pequeno, apoio redundante) | escala de filme (`storyboard.md`) |
| **9:16 recortado do 16:9** | recompor cada cartela (`formatos.md`) |
| **Converter 60 → 30 qps** | renderizar nativo na taxa de entrega |
| **Vídeo que começa no quadro composto** | começar na animação de entrada |
| Começo acelerado demais (acima de 1,5×) | no máximo ~1,5× e só nos primeiros 0,4 s |
| **Prévia emendada entregue como peça** quando o destino pede peças | peças separadas (`--por-cena`) |
| Som genérico gerado por IA | sem som, com as marcas de tempo para quem sonorizar |
| Frase + fundo; meia tela morta; número gigante de enfeite; neon | camadas que servem o herói |

## Os instrumentos de conferência

Rode a partir da pasta da pessoa. As imagens saem em `<projeto>/.cache/inspecao/`. **Abra os PNGs e
olhe de verdade**; julgue por sequências densas de quadros, nunca por um MP4 visto de passagem.

```bash
# folha de contato da cena a cada 0,25 s (o movimento inteiro numa imagem)
node <skill>/scripts/quadros.mjs <projeto> --cena <id> --passo 0.25 --folha

# quadros consecutivos de um trecho rápido (a 60 qps: passo 0.0167)
node <skill>/scripts/quadros.mjs <projeto> --cena <id> --de 0 --ate 0.6 --passo 0.0167 --folha

# instantes pontuais
node <skill>/scripts/quadros.mjs <projeto> --cena <id> --tempos 0.1,0.35,1.2

# uma passagem entre cenas, com a transição, em tempo do filme
node <skill>/scripts/quadros.mjs <projeto> --global --de 1.8 --ate 2.6 --passo 0.033 --folha

# pureza: a cena depende da ordem dos quadros? (tem que dar "pura")
node <skill>/scripts/quadros.mjs <projeto> --pureza [--cena <id>]

# o trecho a 60 qps, com o detector de fluidez no fim
node <skill>/scripts/renderizar.mjs <projeto> --cenas <id> --fps 60
```

Opções úteis do `quadros.mjs`: `--formato 9x16`, `--escala 0.5` (PNG menor), `--colunas 4`.

### O quadro final igual ao aprovado

Depois de animar, gere o storyboard de novo sem subir a revisão (agora ele captura do `quadro(t)` nos
tempos dos quadros-chave) e compare com o que foi aprovado:

```bash
node <skill>/scripts/storyboard.mjs <projeto> --sem-revisao
ffmpeg -hide_banner -i storyboard/quadros/16x9/02-app-fim.png -i storyboard/aprovado/16x9/02-app-fim.png -lavfi ssim -f null - 2>&1 | grep SSIM
```

(os caminhos relativos à pasta do projeto). `All:` de 0,98 para cima é o mesmo quadro (a vida no hold
mexe um fio); abaixo disso, abra os dois lado a lado e veja o que mudou. Nada cortado nas bordas.

### O detector de fluidez

O `renderizar` roda o detector nos quadros exatos e diz a cena e o tempo local de cada alerta. Também
roda sozinho:

```bash
node <skill>/scripts/fluidez.mjs <projeto> [--formato 9x16] [--versao 3]
node <skill>/scripts/fluidez.mjs filme.mp4 --cortes 2.4,4.5
```

Ele mede a diferença entre quadros vizinhos (os cortes da linha do tempo são ignorados) e acusa:

| Alerta | O que é | Conserto típico |
| --- | --- | --- |
| **pico** | salto no meio do movimento | curva sem rampa; propriedade que liga sem transição; troca de estado num quadro |
| **espinho** | um quadro destoa dos vizinhos: algo apareceu, sumiu ou piscou | rampa de 3 a 5 quadros; filtro ligado e desligado (deixe ligado a cena toda); `if (t > x)` sem o outro lado |
| **degrau** | movimento forte que para seco | pouso com velocidade e desaceleração zerando juntas (`api.trajeto` com `pouso`, `tipo.empurrar`, curva forte mais longa) |
| **parado** | 0,25 s ou mais congelado com imagem na tela | vida no hold (deriva, luz que respira, câmera viva) |

Um trecho que deve mesmo ficar parado (raro: uma pausa dramática pedida pela pessoa) vai em
`permitirParado` da cena (`[[1.2, 1.6]]`, tempos locais). **Nada vai para a pessoa com alerta sem
explicação.** O gráfico fica em `render/v<N>/.fluidez/`: um filme fluido tem curvas contínuas, sem
agulhas.

### Erros do motor

Os comandos terminam listando o que o motor avisou (cena, fase e frase). Código de saída 2 = o motor ou
o detector acusaram algo. A lista precisa estar vazia antes de mostrar.

## O crítico (o seu relatório para você mesmo)

Para cada cena, depois de animar e antes de mostrar, escreva (para você, não para a pessoa):

- **nota** de 0 a 10 (comece baixo; 8 só quando aguenta ao lado de um showreel);
- **pedidos atendidos**: cada pedido dela e cada batida do storyboard, sim ou não;
- **vida no hold**: sim ou não, e o que vive;
- **resumo do detector**;
- **problemas**, cada um com severidade (alta, média, baixa), tempo local e correção concreta.

Resolva tudo de severidade alta e média, confira de novo a 60 qps, e só então siga.

## Armadilhas de pintura do navegador (viram trancos)

| Sintoma | Conserto |
| --- | --- |
| A linha de base do texto pula 1 px no meio de um push lento | `subpixel: true` no `api.set` (giro invisível) ou camada própria (`api.pintura.camada(el)` no `montar`) |
| Push lento anda em degraus | o motor já usa 6 casas na escala; não arredonde você |
| Foto "estala" de nitidez quando a escala chega a 1,0 | `semEstalo: true` no `api.set` |
| Imagem parada treme entre quadros renderizados em paralelo | `api.pintura.repintar(el, t)` no `quadro` |
| Ligar ou desligar um filtro muda o desenho num quadro | `api.pintura.filtroFixo(el)` no `montar` (filtro ligado a cena toda) |
| Desfoque anda em degraus | o motor arredonda em passos de 0,05 px e tira o filtro abaixo de 0,1 px; não some desfoques à mão em `filter` |
| `top` em % cai no pixel inteiro | parte inteira no CSS, fração num `translate` (`api.set` com `y`) |
| Divisão em letras corta acento ou descendente, ou o degradê respira | use `tipo.dividir` (folga invisível por letra e degradê realinhado) |
| Fonte medida antes de carregar | declare a fonte com `@font-face` local em `marca/tokens.css`; o motor espera as fontes antes do `montar` |
| Rastro de movimento que parece perda de foco | rastro direcional (`fx.obturador(el, vx, vy)`, proporcional à velocidade), nunca `blur` redondo |
| Luz em `mix-blend` dentro de grupo isolado vira quadrado preto | pinte um fundo antes da luz no mesmo grupo |
| Degradê que deriva mostra a borda da imagem | degradê estendido além da caixa, com as pontas lisas |
