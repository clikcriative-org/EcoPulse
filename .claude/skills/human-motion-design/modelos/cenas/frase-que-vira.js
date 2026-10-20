/*@ficha
{
  "ideia": "A frase vira a próxima cena: as letras chegam de longe e se aproximam até assentar; no fim, as pontas partem primeiro e tudo converge num ponto de luz, exatamente onde o objeto da próxima vai nascer.",
  "camera": "Push-in contínuo de 1,6 %/s que acelera um fio na convergência; passa por 1,0 no quadro aprovado.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "As letras ainda espaçadas e fora de foco, chegando de longe", "tb": 0.35 },
    { "id": "meio", "rotulo": "A frase", "legenda": "A frase assentada no eixo, o destaque aceso", "tb": 2.4, "aprovado": true },
    { "id": "fim", "rotulo": "Passagem", "legenda": "As letras convergem num ponto de luz, no lugar do objeto da próxima cena", "tb": 4.86 }
  ],
  "batidas": [
    { "tb": 0, "tipo": "tipo", "texto": "As letras chegam de longe, espaçadas e fora de foco, e o espaço entre elas fecha até o aprovado em 2 batidas, quase tudo na primeira." },
    { "tb": 1, "tipo": "luz", "texto": "Na batida, o véu macio acende o degradê do destaque." },
    { "tb": 2, "tipo": "vida", "texto": "Hold: a luz de trás sopra a cada duas batidas e a câmera deriva de lado, devagar; nada fica parado." },
    { "tb": 3, "tipo": "luz", "texto": "Um brilho atravessa o destaque uma vez." },
    { "tb": 4.2, "tipo": "transicao", "texto": "As pontas partem primeiro e todas as letras chegam juntas a um ponto de luz (0,3 s), no lugar exato onde o objeto da próxima nasce." }
  ],
  "saida": { "tipo": "na-cena", "texto": "As letras convergem num ponto de luz; a próxima cena nasce dele." }
}
@*/
/* {{id}} — "{{titulo}}" · Frase que vira ({{dur}} s)
   Ideia: a frase não sai de cena, ela vira o começo da próxima. Camadas: a luz (longe), a frase
   (plano focal), o ponto de luz (perto, no lugar do objeto da próxima).
   Para a próxima nascer do ponto, marque o objeto dela com data-ponte="objeto" (os modelos de
   montagem, aparelho, foto-objeto e marca já marcam) e deixe a saída desta cena como "na-cena".
   ENTRADA: 'aproximar' (as letras chegam de longe, espaçadas, e o espaço fecha: C3.5) ou 'brasa'
   (primeiro a silhueta de luz, depois as letras sobem quentes na cor do destaque e esfriam: C3.8;
   bom para fogo, torra, calor, energia).
   TROQUE: FRASE (um destaque, sem ponto final) e ENTRADA. */
{ // bloco: as constantes desta cena não colidem com as das outras
const FRASE = 'A frase que vira <span class="destaque">luz</span>';
const ENTRADA = 'aproximar';

Motion.cena('{{id}}', {
  render: () => `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="pilha"><h2 class="titulo frase">${FRASE}</h2></div></div>
    <div class="camada c-perto"><div class="ponto" aria-hidden="true"></div></div>`,

  poses: {
    inicio: (el, api) => {
      api.tipo.aproximar(0.25, el.letras, { dur: 1.2 });
      api.tipo.varrerDestaque(0, el.letras, { inicio: 1 });
    },
    fim: (el, api) => {
      api.tipo.sugar(0.27, el.letras, { inicio: 0, dur: 0.3, ponto: el.alvo });
      api.set(el.ponto, { x: el.alvo[0], y: el.alvo[1], s: 1, o: 1 });
    },
  },

  montar(el, api) {
    api.tipo.semViuva(el.$('.frase'));
    el.letras = api.tipo.dividir(el.$('.frase'), { por: 'letra' });
    el.ponto = el.$('.ponto');
    el.luz = el.$('.luz');
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0 },
      ],
    });
    el.alvo = [0, 0];
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, suave, dur } = api;
    // o lugar do objeto da próxima cena (medido pelo motor); sem ele, o centro
    const pr = api.proxima.ponte('objeto');
    const alvo = pr ? [pr.cx, pr.cy] : el.alvo;
    const ini = api.inicioEntrada(0.04);
    const tVira = dur - 0.34;
    const chega = ENTRADA === 'brasa'
      ? tipo.nascerDaLuz(t, el.letras, { inicio: ini, cor: 'var(--destaque)', aplicar: false })
      : tipo.aproximar(t, el.letras, { inicio: ini, dur: b(2), espaco: 0.45, aplicar: false });
    const vira = tipo.sugar(t, el.letras, { inicio: tVira, dur: 0.3, ponto: alvo, aplicar: false });
    tipo.aplicar(el.letras, chega, vira);
    tipo.varrerDestaque(t, el.letras, { inicio: b(1), dur: b(1) });
    tipo.derivaDestaque(t, el.letras, { inicio: b(2) });
    tipo.brilho(t, el.letras.filter((p) => p.destaque), { inicio: b(3), dur: 0.7, forca: 0.4 });
    // o ponto de luz acende 10 ms antes de as letras chegarem e fica aceso até o corte
    const acende = suave(prog(t, tVira + 0.12, tVira + 0.29));
    api.set(el.ponto, { x: alvo[0], y: alvo[1], s: 0.4 + 0.6 * ease.outCubic(prog(t, tVira + 0.12, dur)), o: acende });
    // o hold vive na batida: a luz de trás sopra a cada duas batidas e a câmera deriva de lado
    const nb = api.naBatida(t, { de: b(2), cada: 2, ataque: 0.12 });
    el.cam.pose({ zoom: api.viva(t, { v: 0.016 }) * (1 + 0.02 * ease.inCubic(prog(t, tVira, dur))), x: 0.5 * (t - api.ref) });
    api.fx.respirar(t, el.luz, { periodo: 3.9, amp: 0.07, base: 1 + 0.3 * nb.v });
  },
});
}
