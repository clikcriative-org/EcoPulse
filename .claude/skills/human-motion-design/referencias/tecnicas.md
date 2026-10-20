# Técnicas que dão vida

Receitas de dinâmica, cada uma com o código. São a "cereja do bolo" em forma de ferramenta: use
como ponto de partida e adapte à ideia e à marca, nunca como desenho pronto. Todas são **funções
puras do tempo** (`t` em segundos dentro da cena) e usam o `api` do motor (`motor/API.md`):
`prog`, `lerp`, `clamp`, `ease`, `spring`, `set`.

Antes, duas ideias que valem para todas:

- **Um fio condutor faz as transições.** As técnicas abaixo rendem mais quando o mesmo elemento
  (uma faísca, uma gota, o símbolo da marca) passa por várias delas: ele escreve a frase, engole a
  frase, vira anel, vira ponto, vira sol. O olho segue o elemento e a troca de tela nem é sentida.
- **Física só em objeto.** Gota, pílula, card, ícone e logo podem amassar, quicar e girar. Texto de
  leitura entra do desfoque para o foco, sem quicar; letras soltas de uma palavra-personagem (uma
  palavra que é o assunto da tela, não frase de leitura) podem pular, como na técnica 6.

---

## 1. Frase que cresce e se recentraliza

As palavras chegam uma a uma (desfoque → foco, vindo de pertinho da direita) e a frase inteira
desliza para continuar centralizada enquanto cresce. Meça a posição final de cada palavra uma vez no
`montar` e, no `quadro`, ande o bloco pela largura visível.

```js
// montar: posições finais (px) e onde a frase termina
el.pos = []; let x = 0;
for (const p of el.palavras) { el.pos.push(x); x += p.offsetWidth + 16; }
el.total = x;

// quadro
const entra = [0.15, 0.95, 1.25, 1.45];               // um tempo por palavra, na batida
let w = 0;
el.palavras.forEach((p, i) => {
  const k = api.ease.outExpo(api.prog(t, entra[i], entra[i] + 0.5));
  api.set(p, { x: (1 - k) * 1.4, y: (1 - k) * 0.3, o: k, blur: (1 - k) * 0.6 });
  const fim = el.pos[i + 1] ?? el.total;
  w = Math.max(w, api.lerp(el.pos[i], fim, api.ease.outCubic(api.prog(t, entra[i], entra[i] + 0.45))));
});
api.set(el.frase, { x: (api.largura - w) / 2, px: true });
```

## 2. Gota que cai, amassa e vira pílula

Uma gota cai esticando, amassa no pouso com mola amortecida e se abre de lado até virar uma pílula
(com texto ou ícone dentro). Num SVG, anime `width` e `rx` de um `rect` e a escala no pé dele.

```js
const POUSO = 2.0;
if (t < POUSO) {
  const k = api.ease.inCubic(api.prog(t, 1.55, POUSO));          // cai acelerando
  y = api.lerp(-220, alvoY, k);
  sx = 1 - 0.18 * k; sy = 1 + 0.45 * k;                          // estica caindo
} else {
  const d = t - POUSO;
  const amassa = Math.exp(-9 * d) * Math.cos(2 * Math.PI * 2.4 * d); // mola que morre
  sx = 1 + 0.28 * amassa; sy = 1 - 0.28 * amassa;
  largura = api.lerp(64, 164, api.ease.outBack(api.prog(t, POUSO + 0.02, POUSO + 0.42)));
}
rect.setAttribute('width', largura); rect.setAttribute('rx', altura / 2);
api.set(pilula, { y, sx, sy, origem: '50% 100%' });             // a origem no pé: amassa no chão
```

Acabamento: fagulhas no pouso (traços curtos e claros saindo em leque, rápidos no começo,
apagando no fim). Use `api.rand` com semente fixa para os ângulos, nunca `Math.random`.

## 3. Letras sugadas para um ponto

Para tirar uma frase da tela por dentro do fio condutor: cada letra corre até o ponto, achatando
na horizontal e sumindo; a ordem vai da mais longe para a mais perto, então a frase "escorre".

```js
const engole = api.prog(t, 3.25, 3.75);
el.letras.forEach((l, i) => {
  const ordem = el.xLetra[i] / el.total;                         // 0 = começo da frase
  const k = api.ease.inCubic(api.clamp((engole - (1 - ordem) * 0.55) / 0.45));
  api.set(l, { x: (pontoX - el.xLetra[i]) * k, px: true, sx: 1 + 0.6 * k, sy: 1 - 0.7 * k, o: 1 - k });
});
```

## 4. Anel que nasce do ponto e se abre num sistema de círculos

O fio condutor vai ao centro e ganha um anel grosso e aceso (entra com `outBack`). Em seguida o
anel se expande muito rápido (`outExpo`) enquanto afina e apaga, e no lugar dele aparecem círculos
finos e grandes que enquadram a tela, com pontinhos correndo por eles.

```js
const abre = api.ease.outExpo(api.prog(t, 4.0, 4.6));
anel.setAttribute('r', api.lerp(10, 58, api.ease.outBack(api.prog(t, 3.7, 4.0))) + abre * 620);
anel.setAttribute('stroke-width', api.lerp(16, 1, abre));
api.set(anel, { o: api.prog(t, 3.7, 3.8) * (1 - api.ease.outCubic(api.prog(t, 4.25, 4.7))) });
const sis = api.ease.outCubic(api.prog(t, 4.05, 4.9));
api.set(circulos, { s: api.lerp(0.55, 1, sis), o: sis });
// pontinhos: ângulo = inicial + velocidade × t, sobre o raio de cada círculo
```

Os círculos são linha fina (1 a 2 px), cor clara com pouca opacidade e um brilho mínimo. Nunca
anel grosso decorativo parado: o anel grosso só existe na passagem.

## 5. Pontos que correm num arco e viram texto curvo

Uma palavra se desfaz em pontos (cada letra encolhe até virar um ponto e some), os pontos correm
numa curva até as posições das letras da palavra nova e, ao chegar, cada letra nasce com mola. A
palavra nova fica num `textPath` sobre um arco (de preferência um dos círculos da cena).

```js
// montar: onde cada letra da palavra nova vai ficar no arco
el.alvos = [...'Sketch'].map((_, i) => {
  const a = el.texto.getStartPositionOfChar(i), b = el.texto.getEndPositionOfChar(i);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
});
// quadro: cada ponto faz uma parábola do centro da letra antiga até o alvo
const k = api.ease.inOutCubic(api.clamp((t - 5.3 - i * 0.05) / 0.55));
const x = api.lerp(de.x, para.x, k), y = api.lerp(de.y, para.y, k) - Math.sin(k * Math.PI) * 140;
```

Uma passagem de luz atravessando a tela (uma elipse clara e desfocada, esticando no meio do
caminho) no mesmo instante esconde a costura entre as duas palavras.

## 6. Letras que pulam com mola (palavra-personagem)

Para a palavra que é o assunto da tela: cada letra entra com mola, alternando a direção do salto e
um pequeno giro. Uma letra de destaque muda de cor ou de peso.

```js
el.letras.forEach((l, i) => {
  const k = api.spring(t - (8.05 + i * 0.07), { rigidez: 2.4, amortecimento: 6.5 });
  const lado = i % 2 ? -1 : 1;
  api.set(l, { y: lado * 1.4 * (1 - api.clamp(k)), s: 0.4 + 0.6 * api.clamp(k, 0, 1.25),
               r: lado * 8 * (1 - api.clamp(k)), o: api.prog(t, 8.05 + i * 0.07, 8.13 + i * 0.07) });
});
```

## 7. Um brilho que apaga a palavra ao passar

O fio condutor acende (cresce e ganha brilho quente) e varre a palavra da esquerda para a direita;
cada letra que ele cruza encolhe, desfoca e some. É uma transição que sai da própria tela.

```js
const varre = api.ease.inOutCubic(api.prog(t, 9.1, 9.9));
const xBrilho = inicio + varre * (larguraDaPalavra + 120);
el.letras.forEach((l, i) => {
  const passou = api.clamp((xBrilho - el.xLetra[i]) / 60);
  api.set(l, { s: 1 - 0.6 * passou, o: 1 - passou, blur: passou * 0.4 });
});
```

## 8. Card de vidro que gira em 3D

Um card de vidro (fundo translúcido, borda acesa, `backdrop-filter`) entra de baixo e da lateral
com mola, desvirando em `rotateY`/`rotateX`; no hold ele respira (giro de poucos graus, inclinação
lenta). O fio condutor fica **por cima** do vidro (z maior), nítido, como se estivesse dentro.

```js
const k = api.spring(t - 9.85, { rigidez: 1.5, amortecimento: 6.5 });
const respira = 4 * Math.sin((t - 10) * 1.8);
api.set(card, {
  x: api.lerp(1750, 1270, api.clamp(k, 0, 1.1)), y: api.lerp(760, 420, api.clamp(k, 0, 1.1)), px: true,
  persp: 900, ry: api.lerp(35, 0, api.clamp(k)), rx: api.lerp(-18, 0, api.clamp(k)) + 3 * Math.sin(t * 1.4),
  r: api.lerp(-28, -6, api.clamp(k, 0, 1.15)) + respira,
});
```

Uma luz grande e desfocada atrás do card (elipse da cor de destaque) entra junto e dá profundidade.
Para sair: o card gira até virar losango, perde o preenchimento e a borda troca para uma cor quente.

## 9. Forma que vira sol de borda ondulada

O fio condutor cresce e vira um sol: um caminho fechado cujo raio ondula (`r + amp·sin(9a + fase)`),
com a fase andando no tempo, então a borda "ferve" sem nunca congelar.

```js
function sol(r, amp, fase) {
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2, rr = r + amp * Math.sin(a * 9 + fase);
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)} `;
  }
  return d + 'Z';
}
forma.setAttribute('d', sol(62, 7 + 3 * Math.sin(t * 4), t * 2.2));
```

## 10. A câmera vira e troca de mundo

Para mudar de cenário sem corte: gire e desloque o sistema inteiro (círculos, texto curvo, luzes)
em 1 s com `inOutCubic`, aumentando um pouco a escala, enquanto ele apaga; o cenário novo (um donut
de luz desfocado, outra cor de fundo) entra do lado para onde a câmera foi.

```js
const vira = api.ease.inOutCubic(api.prog(t, 7.0, 8.0));
api.set(sistema, { x: vira * 220, y: vira * -260, px: true, r: 5 + vira * 48, s: 1 + 0.25 * vira,
                   o: 1 - api.ease.inOutCubic(api.prog(t, 7.7, 8.4)) });
```

---

## Conferir

Toda técnica destas tem um instante crítico: o pouso, a sucção, a abertura do anel, a chegada no
arco, a varredura. Olhe esses trechos quadro a quadro (`scripts/quadros.mjs --de --ate --passo
0.0167 --folha`) e rode o detector de fluidez antes de mostrar.
