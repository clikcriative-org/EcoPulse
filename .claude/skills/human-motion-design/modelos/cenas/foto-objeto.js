/*@ficha
{
  "ideia": "A foto vira objeto e depois mundo: chega como um card inclinado, da profundidade, assenta de frente e, na batida, abre até virar o plano cheio; a frase assenta por cima.",
  "camera": "Push-in vivo de 1,4 %/s, passando por 1,0 no quadro aprovado; quando o card abre, a foto dentro dele recua um fio (1,06 → 1), como quem atravessa a janela.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "O card pequeno e inclinado chegando da profundidade, com sombra", "tb": 0.4 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "O card de frente abrindo até virar o plano cheio", "tb": 2.35 },
    { "id": "fim", "rotulo": "Fim", "legenda": "A foto em plano cheio, o véu do lado da frase e a frase assentada", "tb": 4.6, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "objeto", "texto": "O card chega da profundidade inclinado (24° em Y, 8° em X), sai do desfoque e assenta de frente com uma mola curta; a sombra acompanha." },
    { "tb": 1, "tipo": "vida", "texto": "De frente, o card respira um fio e a luz de trás floresce." },
    { "tb": 2, "tipo": "objeto", "texto": "Na batida, o card abre até virar o plano cheio em 0,65 s (curva forte); a foto dentro dele recua 6 %." },
    { "tb": 3, "tipo": "tipo", "texto": "A frase sai do desfoque palavra a palavra no espaço vazio da foto." },
    { "tb": 5, "tipo": "luz", "texto": "Um brilho atravessa o destaque uma vez." }
  ]
}
@*/
/* {{id}} — "{{titulo}}" · Foto como objeto ({{dur}} s)
   Ideia: card → plano cheio (a foto é objeto e depois o mundo). Camadas: a luz (longe), o card e a
   foto (plano focal, data-heroi), a frase (perto).
   O card é a própria foto de plano cheio vista por uma janela (clip-path) que abre: nada pula.
   TROQUE: FOTO, FOCO, FRASE e o tamanho do card (CARTAO, em cqmin). */
{ // bloco: as constantes desta cena não colidem com as das outras
const FOTO = '{{foto}}';
const FOCO = { '16x9': '50% 40%', '9x16': '55% 35%' };
const CARTAO = { '16x9': [46, 57.5], '9x16': [64, 80] }; // largura e altura do card, em cqmin
const FRASE = 'A frase sobre a <span class="destaque">foto</span>';

Motion.cena('{{id}}', {
  render: (c) => `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio">
      <div class="sombra-cartao"></div>
      <div class="plano cartao" data-heroi data-ponte="objeto">${c.foto(FOTO, { foco: c.porFormato(FOCO) })}</div>
      <div class="veu"></div>
    </div>
    <div class="camada c-perto"><div class="bloco-texto"><h2 class="titulo frase">${FRASE}</h2></div></div>`,

  poses: {
    inicio: (el, api) => el.cartaoEm(0.38, api),
    meio: (el, api) => el.cartaoEm(api.b(2.35), api),
  },

  montar(el, api) {
    api.tipo.semViuva(el.$('.frase'));
    el.palavras = api.tipo.dividir(el.$('.frase'), { por: 'palavra' });
    el.cartao = el.$('.cartao');
    el.img = el.$('.cartao > *');
    el.sombra = el.$('.sombra-cartao');
    el.veu = el.$('.veu');
    el.luz = el.$('.luz');
    api.pintura.filtroFixo(el.cartao);
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.2 },
      ],
    });
    // a janela do card, em % da caixa do plano (que sangra 6 %)
    const caixa = api.caixa(el.cartao);
    const um = Math.min(100, api.H) / 100; // 1 cqmin em cqw
    const [cw, ch] = api.porFormato(CARTAO).map((v) => v * um);
    el.janela = {
      t: ((caixa.a / 2 - ch / 2) / caixa.a) * 100,
      l: ((caixa.l / 2 - cw / 2) / caixa.l) * 100,
      raio: 2.4 * um * api.pxPorCqw,
    };
    // estado do card em t (puro): chega inclinado, assenta, abre na batida 2
    el.cartaoEm = (t, a = api) => {
      const { prog, ease, lerp, suave, b } = a;
      const ini = a.inicioEntrada(0);
      const doPonto = a.entrada && ['na-cena', 'ponto-de-luz'].includes(a.entrada.tipo);
      const nasce = doPonto ? a.fx.nascerDoPonto(t, { inicio: ini }) : null;
      const mola = a.spring(t - ini, { freq: 1.3, damp: 6.2 });
      const chega = ease.outExpo(prog(t, ini, ini + 0.9));
      const abre = ease.forte(prog(t, b(2), b(2) + 0.65));
      const J = el.janela;
      const ins = (v) => `${(v * (1 - abre)).toFixed(3)}%`;
      a.set(el.cartao, {
        persp: 140,
        ry: 24 * (1 - mola) * (1 - abre),
        rx: 8 * (1 - chega) * (1 - abre),
        s: (0.82 + 0.18 * chega) * (nasce ? nasce.s : 1),
        o: nasce ? nasce.o : suave(prog(t, ini, ini + 0.1)),
        blur: 0.5 * (1 - ease.outCubic(prog(t, ini, ini + 0.5))),
        bright: nasce ? nasce.bright : 1,
        clip: abre >= 1 ? 'none' : `inset(${ins(J.t)} ${ins(J.l)} ${ins(J.t)} ${ins(J.l)} round ${(J.raio * (1 - abre)).toFixed(1)}px)`,
      });
      a.set(el.img, { s: lerp(1.06, 1, abre) * (1 + 0.004 * a.vida(t, { inicio: b(1), periodo: 2.8 }) * (1 - abre)), semEstalo: true });
      a.set(el.sombra, { o: chega * (1 - suave(prog(abre, 0, 0.6))), s: 0.82 + 0.18 * chega });
      a.set(el.veu, { o: suave(prog(abre, 0.5, 1)) });
    };
  },

  quadro(t, el, api) {
    const { tipo, b } = api;
    el.cartaoEm(t, api);
    const entra = tipo.focar(t, el.palavras, { inicio: b(3), aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.palavras, { aplicar: false }) : null;
    tipo.aplicar(el.palavras, entra, sai);
    tipo.brilho(t, el.palavras.filter((p) => p.destaque), { inicio: b(5), dur: 0.7, forca: 0.4 });
    el.cam.pose({ zoom: api.viva(t, { v: 0.014 }) });
    api.fx.respirar(t, el.luz, { periodo: 4.1, amp: 0.08, base: 1 + 0.25 * api.fx.flash(t, b(1), { dur: 1.2 }) });
  },
});
}
