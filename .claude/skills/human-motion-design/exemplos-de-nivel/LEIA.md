# Exemplos de nível

Quatro cenas de um filme de motion aprovado, reescritas no motor da skill com uma marca de
demonstração ("Atlas PRO", aurora verde), em 16:9 e em 9:16. Composição, camadas, luz, escala da
tipografia, tempos, curvas, câmera e transições são os do filme, nos dois formatos; só a marca
mudou. Elas são **a barra**: nenhuma cena que a skill entrega pode ficar abaixo disto em desenho e
em dinâmica.

Use assim: antes de escrever uma cena nova, abra o exemplo mais parecido com o papel dela,
renderize os quadros no mesmo tempo local e compare lado a lado com o que você fez. Se a sua cena
parece um slide perto do exemplo (uma frase sozinha num fundo vazio, ícone de linha solto, foto
chapada com texto por cima, logo centralizada parada no fim), ela não está pronta.

## Como olhar

De dentro da pasta da skill:

```bash
node scripts/quadros.mjs exemplos-de-nivel --cena bento --passo 0.25 --folha        # folha de contato
node scripts/quadros.mjs exemplos-de-nivel --cena orbita --de 1.3 --ate 1.9 --passo 0.033 --folha
node scripts/quadros.mjs exemplos-de-nivel --cena revelacao --passo 0.25 --folha --formato 9x16
node scripts/renderizar.mjs exemplos-de-nivel --formato ambos --fps 30 --por-cena     # MP4 + um por cena
open exemplos-de-nivel/filme/principal-16x9.html                                    # player (tecla A: área segura)
```

Já renderizado: `render/v1/exemplos-de-nivel-16x9-30fps.mp4` e `-9x16-30fps.mp4` (os quatro
encadeados, 19 s) e `render/v1/cenas/` (um MP4 por cena e por formato).

## O que é da marca (troque isto, nada mais)

| O quê | Onde | Observação |
| --- | --- | --- |
| Cores, luzes, vidro, degradê de destaque | `marca/tokens.css` | Nenhuma cena escreve cor: tudo é `var(--token)` ou `color-mix()` dele. As luzes (`--luz-1..4`) entram sempre em degradê sem borda |
| Fontes e pesos | `marca/fontes/` + `@font-face` em `tokens.css` | `--fonte-titulo` (títulos em peso regular, impacto pelo tamanho), `--fonte-texto`, `--fonte-marca`, `--marca-a-peso` / `--marca-b-peso` (o contraste fino × forte das duas palavras da marca) |
| Símbolo | `marca/ativos/simbolo.svg` | Uma forma só, `fill="currentColor"`, viewBox quadrado. É a chave da revelação, o card herói do bento e o ponto de luz do fechamento |
| Textos | objeto `TEXTO` (ou `FRASE`) no topo de cada `cenas/<id>.js` | Mesmo tamanho de texto do exemplo; a palavra gigante da revelação precisa estar escrita num item |
| Imagens | `midia/` | Com fotos lá (qualquer nome, ordem alfabética), as capas do bento e da órbita viram as fotos. Sem fotos, `_comum.js` desenha capas de luz com os tokens `--capa-1..6` |

## A linguagem que os quatro dividem

- **Um eixo só.** Tudo nasce e termina no centro; cada cena entrega para a próxima no mesmo eixo.
- **120 BPM.** Cada evento importante cai numa batida (0,5 s) ou meia batida: tranca em 3,0,
  frente de luz na batida 4, número e data travando em 2,75 e 3,0.
- **Letra não quica.** Tipografia vem do desfoque ao foco, com subida curta e curva forte
  (`.16,1,.3,1`), letra a letra a 18–40 ms. Overshoot, mola e quique só em objeto (símbolo, card, capa).
- **Etapas legíveis.** Nada se monta todo junto: acende, segura legível, abre, tranca.
- **Luz sem borda, que nasce de um objeto.** O símbolo, um ponto ou um horizonte acendem e abrem o
  preto em volta. Toda luz é degradê de queda macia; nada de anel decorativo, halo com contorno,
  textura de cristal ou metal.
- **Vidro escuro de uma família só.** Todos os cards do mesmo material (`.m-vidro`), muda só a
  cor da luz atrás; um protagonista (`.m-vidro-heroi`) e um card na cor da marca (`.m-vidro-forte`).
  Cards são desenho, não interface: sem pílula, botão ou campo.
- **Hold vivo, nunca congelado.** Depois de montar, o degradê escorre, a luz respira, um reflexo
  passa uma vez, a câmera segue empurrando (≤ 1 %). Quem assiste não vê a animação, sente que a
  imagem está viva.
- **Saída rápida e acelerando** (150–350 ms): a leitura acontece no hold, a saída não rouba tempo.
- **Profundidade de verdade.** Camadas com paralaxe, desfoque de profundidade no que passa perto
  da câmera, obturador fingido (`blur` direcional) nos movimentos muito rápidos.

## 1. `revelacao` — Revelação em etapas (5 s)

**Ensina:** a marca como fechadura. Revelar em etapas (acende, aparece inteira e fechada, segura,
abre como chave, tranca) e terminar numa **palavra gigante** que ocupa o quadro, acesa por um
horizonte de luz. É o "nível" da tipografia: frente de luz por letra, sucção para o símbolo,
palavra que nasce do brilho e depois da letra.

**Quando usar:** o gancho ou a revelação de uma oferta, produto ou nome; qualquer momento em que
a marca aparece pela primeira vez e precisa "abrir" uma promessa de uma palavra.

**Batidas:** símbolo acende do preto girando 50° (0,03) · frente de luz acende as letras da
marca, do símbolo para as pontas (0,12–0,4) · marca fechada segura (até 0,8) · meia volta de chave
em 240 ms e a marca abre tirando os itens de dentro, a câmera recua do close (0,8–1,7) · reflexo
corre pelos itens (1,5–2,4) · a palavra-chave brilha (2,06) e é sugada para o símbolo (2,5) ·
tranca no alto na batida 3,0 · o clique solta uma gota de luz até o horizonte (3,03–3,12) · nasce
a palavra gigante, brilho primeiro, letra depois (3,12–3,5) · empurrão de 1,2 % da câmera quando
ela trava (3,46) · brilho especular atravessa a palavra (4,1) · aprovado em 4,3.

**Motor:** `tipo.frenteDeLetras` (letras que acendem quando a luz passa), `tipo.dividir`,
`set` com `persp`/`blur`/`clip`. Saída `avancar-desfocar`.

**Em pé (9:16):** a faixa vira um eixo. A marca fechada aparece grande (~84 % da largura) e a câmera
desliza até centrá-la; na chave, a primeira palavra dá um quarto de volta em torno do símbolo até o
alto e a segunda até embaixo, e os itens saem de dentro do símbolo empilhados entre elas (os da
esquerda sobem, os da direita descem), cada um só aparecendo depois de passar inteiro pela borda
do símbolo. A palavra gigante ocupa no máximo 86 % da largura (o `quadro` encolhe se passar).
Código em `montarV`/`quadroV`, mesmos tempos.

**Cuidado:** os itens são tipografia com ícone desenhado em luz, sem cápsula nem borda. O símbolo
precisa funcionar sozinho como forma (é ele que gira).

## 2. `bento` — Bento que acende (5 s)

**Ensina:** como mostrar muitas coisas sem virar site. Uma frase no eixo é sugada para um ponto
de luz que estoura no símbolo do card herói; o card abre a partir dele; uma **frente de luz**
atravessa a grade por trás do vidro e acende card a card; cada conteúdo trava na sua batida
(trilha que se desenha, número que conta, infinito que fecha, data em odômetro). No fim a grade
recua e escurece, só um card fica aceso e a câmera **mergulha** na capa dele.

**Quando usar:** lista de benefícios, recursos, módulos, números de prova, "tudo o que vem junto".
Também como ponte para uma cena de catálogo (o mergulho entrega a capa para a próxima cena).

**Batidas:** frase letra a letra já no corte (−0,06), degradê varre o destaque (0,3–0,75) ·
batida 3: letras sugadas para o ponto (1,5–1,75) · o ponto estoura no símbolo e o herói abre
(1,74–2,24) · batida 4: frente de luz sai do símbolo e atravessa a grade (2,0–2,95) · número trava
em 2,75, infinito e data em 3,0 · reflexo (3,0–3,36) · aprovado em 4,25 · antecipação: a grade
recua 2,5 % e escurece (4,25–4,5) · o leque de capas fecha com um clique · mergulho em log na capa
da frente (4,42–5,0).

**Câmera:** push-in de 3 % até o aprovado com paralaxe (símbolo 4,5 %, grade 3 %, luz 1,5 %).

**Em pé (9:16):** a frase quebra em duas linhas e a grade vira uma coluna alta de 3 colunas e 9
linhas, com o herói no meio (seis linhas), o card das capas em cima dele e o ao vivo embaixo; texto
dos cards ~2× maior em cqw para ler no celular; grade dentro da área segura (12–80 % da altura, 87 %
da largura). A frente de luz percorre a mesma fração do raio até o card mais longe (a cascata leva
o mesmo tempo) e, no mergulho, a capa desce do alto da grade até o ponto exato onde a órbita em pé
começa, com curva própria (chega parada; só a escala chega com embalo).

**Motor:** `.m-vidro` / `.m-vidro-forte` / `.m-vidro-heroi`, `fx.frenteDeLuz` + `fx.tempoDaFrente`
(o acendimento card a card), `fx.luzDoVidro` (a luz atrás de cada card circula e respira),
`tipo.prepararOdometro` + `tipo.odometro` (data), `fx.degradeLargo` (degradê que deriva sem mostrar
a borda). Saída `na-cena`.

**Cuidado:** o número conta só até o valor escrito e só se for verdadeiro; números inventados não
entram. O mergulho termina exatamente no primeiro quadro da `orbita` (constantes `NEXT_16` e `NEXT_V` no
topo de `bento.js`); se a próxima cena for outra, troque a `saida` no `motion.json` ou faça a próxima
começar com a mesma capa no centro.

## 3. `orbita` — Pilha que vira órbita (4 s)

**Ensina:** peso, física e câmera em 3D de verdade. Uma capa chega no embalo do mergulho; as outras
caem por cima em accelerando (45 → 17 ms, um rufar) e cada impacto afunda a pilha inteira, que
devolve; a pilha prende o ar e **explode em espiral** numa batida, sem pousar: desemboca numa
órbita que nunca para, com a frase no vazio do centro, e a câmera atravessa o anel (dolly) até as
capas saírem pelas bordas.

**Quando usar:** volume e variedade (catálogo, portfólio, coleção, clientes, episódios, cursos);
qualquer "é tudo isto, num lugar só".

**Batidas:** a capa sozinha assenta (0–0,6) · as outras caem em accelerando (0,62–1,2), a última
quica sozinha · antecipação (1,34–1,5) · explosão em espiral na batida 3 (1,5) · frase palavra a
palavra no centro (2,0) · reflexo no destaque (2,2–2,9) · aprovado, em movimento, em 2,84 · a
frase atravessa a câmera (3,44–3,74) · as capas passam pela câmera e o fundo afunda no preto
(3,5–3,97). Corte seco no preto.

**Câmera:** push-in mínimo na pilha; depois da explosão, dolly real através do anel. Cada capa tem
a sua distância (as de baixo, mais perto, crescem mais e saem primeiro); a ordem de camadas passa
da pilha para a do anel por dissolve, nunca uma capa pulando na frente da vizinha.

**Em pé (9:16):** capa única e pilha ocupam a largura (2,2× o tamanho); a órbita vira uma elipse mais
alta que larga em volta da frase (1,75×), um pouco acima do meio. Rente à frase as capas encolhem e
inclinam menos; no alto e embaixo crescem; elas se distribuem pelo comprimento que ocupam no anel
(o mesmo respiro entre vizinhas em toda a volta), não por ângulo.

**Motor:** perspectiva por capa com `set({ persp, z, rx, ry, blur })`, `tipo.escorrerDestaque`
no hold, capas de `_comum.js`.

**Cuidado:** o `fluidez.mjs` aponta um "degrau" em 1,2 s: é o impacto da última capa (um objeto com
peso parando seco), igual no filme de referência. Ele é intencional; fora disso nada pode parar seco.

## 4. `fechamento` — Fechamento com luz (5 s)

**Ensina:** fechar como se abriu. Um ponto de luz acende a frase sobre um horizonte distante; a
câmera chega no planeta e a luz vira o símbolo com a mesma meia volta de chave da revelação; as
duas palavras da marca saem de dentro dele; o planeta cai, o último fio do aro fica e dele nascem
o convite (para cima) e a data (para baixo). No fim, a marca tranca de volta no símbolo, que vai
ao centro, pulsa, vira ponto, solta um traço de luz e apaga.

**Quando usar:** a última cena: assinatura, chamada para ação, data, convite. Substitui a "logo
centralizada parada no fim".

**Batidas:** frase palavra a palavra (0,1) · luz atrás do destaque (0,6) · a frase passa pela
câmera (1,12–1,34) · câmera no planeta (1,02–1,72) · símbolo nasce girando (1,25) · amanhecer corre
pelo aro (1,27–1,86) · clique: a marca sai do símbolo (1,75–2,55) · planeta cai (2,74–3,4) · convite
(3,0) e data (3,25) nascem do fio · brilho no convite (3,62) · aprovado em 4,1 · tranca (4,58) ·
ponto (4,79) · preto (4,98).

**Câmera:** push-in contínuo de 0,6 %/s; aproximação do planeta em 0,7 s (sobe e achata).

**Em pé (9:16):** a frase em três linhas, grande no centro; símbolo, marca, convite e data em coluna
no eixo; o planeta começa mais alto e mais largo e, na aproximação, sobe até logo abaixo do símbolo.
Os gestos medidos em cqw (subida, desfoque, brilho) crescem com a peça em que estão.

**Motor:** `tipo.dividir` por palavra, `tipo.escorrerDestaque`, `fx.obturador` no gesto final.

## Como eles se encadeiam

| De → para | Transição | O que ensina |
| --- | --- | --- |
| `revelacao` → `bento` | `avancar-desfocar` (0,24 s) | a próxima frase nasce no mesmo eixo, ainda dentro da luz da anterior |
| `bento` → `orbita` | `na-cena` (mergulho de 0,58 s) | a câmera entra numa capa até ela virar o primeiro quadro da cena seguinte: corte invisível |
| `orbita` → `fechamento` | `corte` no preto | depois de muito movimento, o preto puro reseta o olho; o fechamento começa de um ponto |
| `fechamento` → fim | a cena apaga sozinha | a marca vira ponto e o ponto apaga: o filme não termina numa cartela parada |

## Como usar num projeto

1. Copie `cenas/<id>.js` e `cenas/<id>.css` (e `_comum.js`/`_comum.css` se usar capas) para
   `cenas/` do projeto. Para mudar o id, troque em `Motion.cena('<id>'…)` e no escopo `.cena-<id>`
   do CSS.
2. Troque só o que está em `TEXTO` e a marca (`tokens.css`, `simbolo.svg`, `fontes/`, `midia/`).
3. Ajuste tempos mantendo as batidas: se a frase for maior, ganhe tempo no hold, não acelere a
   entrada. As constantes de tempo estão todas no topo de cada cena.
4. Renderize os quadros-chave nos mesmos tempos do exemplo e compare lado a lado. Depois
   `fluidez.mjs` e `quadros.mjs --pureza`.

## Recompor para 9:16 (o que os quatro ensinam)

O 9:16 nunca é recorte do 16:9: é a mesma ideia recomposta em pé, com os mesmos tempos e curvas.
Faixa vira eixo (a marca abre na vertical), grade larga vira grade alta, órbita vira elipse em pé,
frase longa quebra em linhas sem viúva, o essencial fica entre 12 % e 80 % da altura. Tipografia
cresce em cqw (~1,7–2,3×) para ler no celular; os gestos medidos em cqw (subida, desfoque, brilho)
crescem junto; desfoques e velocidades são pensados em pixels (o mesmo desfoque nos dois formatos).
As regras de 9:16 ficam escopadas (`[data-formato="9x16"] .cena-<id>` no CSS, `api.vertical` no JS):
o 16:9 não muda um pixel.

## Conferido

- Os quatro são funções puras do tempo nos dois formatos (`quadros.mjs --pureza`).
- Sem erros do motor; a leitura de direção do `renderizar.mjs` não deixou notas.
- Fluidez a 30 qps: 9:16 sem trancos; 16:9 só com o degrau intencional da `orbita` em 1,2 s.
- As transições encadeadas funcionam em pé também (o mergulho do bento cai exatamente no primeiro
  quadro da órbita em 9:16).
