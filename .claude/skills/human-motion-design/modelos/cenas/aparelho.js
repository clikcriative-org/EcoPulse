/*@ficha
{
  "ideia": "O produto chega da profundidade: o aparelho vem girado, assenta de frente com uma mola curta, a tela se monta card a card num rufar e o título entra ao lado; no fim, a câmera mergulha na tela.",
  "camera": "Push-in vivo de 1,2 %/s, passando por 1,0 no quadro aprovado; o título, mais perto da câmera, anda um fio mais que o aparelho.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "O aparelho chega girado e menor, da profundidade; a tela ainda vazia", "tb": 0.4 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "De frente, os cards caindo na tela; o título começando a entrar", "tb": 1.6 },
    { "id": "fim", "rotulo": "Fim", "legenda": "O título de um lado, o aparelho com a tela montada do outro", "tb": 4.6, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "objeto", "texto": "O aparelho chega da profundidade girado 34° e menor (86 %), sai do desfoque e assenta de frente com uma mola curta; sombra e reflexo acompanham." },
    { "tb": 1, "tipo": "objeto", "texto": "Os cards caem na tela em accelerando (90 → 40 ms), cada um com um estalo pequeno." },
    { "tb": 2, "tipo": "tipo", "texto": "O título sai do desfoque palavra a palavra, 45 ms entre elas." },
    { "tb": 3, "tipo": "objeto", "texto": "O destaque da tela acende e o aparelho respira um fio (±2° em Y, período longo)." },
    { "tb": 5, "tipo": "luz", "texto": "Um brilho atravessa o destaque do título uma vez." },
    { "tb": 7, "tipo": "transicao", "texto": "O resto recua e escurece; a câmera mergulha na tela até ela cobrir o quadro." }
  ],
  "saida": { "tipo": "mergulho", "alvo": ".m-mockup-tela", "alvoTexto": "na tela do aparelho" }
}
@*/
/* {{id}} — "{{titulo}}" · Aparelho ({{dur}} s)
   Ideia: C4.1 a C4.3 mais o mergulho (C1.4). Camadas: a luz (longe), o aparelho (plano focal,
   data-heroi), o título (perto).
   A tela: um print ou uma gravação da pessoa (o nome tem print, tela, app ou screen) ou, sem print,
   a interface sugerida em cards (só sugestão de produto, nunca botão nem texto inventado).
   TROQUE: TITULO (um destaque), APARELHO (celular, tablet, notebook, navegador) e, se houver, TELA. */
{ // bloco: as constantes desta cena não colidem com as das outras
const TITULO = 'O produto <span class="destaque">inteiro</span><br>num lugar só';
const APARELHO = 'celular';
const TELA = (c) => {
  const prints = c.midias().filter((n) => /print|tela|app|screen/i.test(n));
  if (prints.length) return c.foto(prints[0], { classe: 'print' });
  return `<div class="ui"><div class="ui-barra"></div><div class="ui-card ui-heroi"></div><div class="ui-dupla"><div class="ui-card"></div><div class="ui-card"></div></div><div class="ui-card ui-linha"></div><div class="ui-card ui-linha curta"></div></div>`;
};

Motion.cena('{{id}}', {
  render: (c) => `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="aparelho" data-heroi data-ponte="objeto">${c.mockup(APARELHO, { tela: TELA(c), classe: 'fone' })}</div></div>
    <div class="camada c-perto"><div class="bloco-texto"><h2 class="titulo chamada">${TITULO}</h2></div></div>`,

  poses: {
    inicio: (el, api) => {
      api.midia.mockup(el.fone, { ry: -34, rx: 8, s: 0.86 });
      api.set(el.cards, { o: 0 });
      api.set(el.palavras, { o: 0 });
    },
    meio: (el, api) => {
      el.cards.forEach((c, i) => api.set(c, i < 2 ? {} : { o: 0, y: 3 }));
      el.palavras.forEach((p, i) => api.set(p.el, i < 2 ? { blur: 0.05 * p.corpo, o: 0.7, y: 0.06 * p.corpo } : { o: 0 }));
    },
  },

  montar(el, api) {
    api.tipo.semViuva(el.$('.chamada'));
    el.palavras = api.tipo.dividir(el.$('.chamada'), { por: 'palavra' });
    el.fone = el.$('.fone');
    el.cards = api.$$('.ui > *');
    el.luz = el.$('.luz');
    el.tempos = api.fx.accelerando(Math.max(1, el.cards.length), { de: 0.09, ate: 0.04 }).map((x) => api.b(1) + x);
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.2 },
      ],
    });
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, lerp, suave } = api;
    const ini = api.inicioEntrada(0);
    const doPonto = api.entrada && ['na-cena', 'ponto-de-luz'].includes(api.entrada.tipo);
    // o aparelho chega da profundidade e assenta de frente (objeto: a mola pode passar do ponto)
    const chega = ease.outExpo(prog(t, ini, ini + 0.8));
    const mola = api.spring(t - ini, { freq: 1.4, damp: 6 });
    const nasce = doPonto ? api.fx.nascerDoPonto(t, { inicio: ini }) : null;
    const vive = 2 * api.vida(t, { inicio: b(3), periodo: 5.2 });
    api.midia.mockup(el.fone, {
      ry: -34 * (1 - mola) + vive,
      rx: 8 * (1 - chega),
      s: (0.86 + 0.14 * chega) * (nasce ? nasce.s : 1),
      o: nasce ? nasce.o : suave(prog(t, ini, ini + 0.1)),
    });
    api.set(el.$('.aparelho'), { blur: 0.6 * (1 - ease.outCubic(prog(t, ini, ini + 0.45))), bright: nasce ? nasce.bright : 1 });
    // os cards caem num rufar, cada um com um estalo pequeno (objeto)
    el.cards.forEach((c, i) => {
      const t0 = el.tempos[i];
      const p = prog(t, t0, t0 + 0.32);
      api.set(c, { y: 3.2 * (1 - ease.outExpo(p)), s: 0.94 + 0.06 * Math.min(1.04, ease.outBack(2.2)(p)), o: suave(prog(t, t0, t0 + 0.08)) });
    });
    // o título, palavra a palavra, na batida 2
    const entra = tipo.focar(t, el.palavras, { inicio: b(2), aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.palavras, { aplicar: false }) : null;
    tipo.aplicar(el.palavras, entra, sai);
    tipo.brilho(t, el.palavras.filter((p) => p.destaque), { inicio: b(5), dur: 0.7, forca: 0.4 });
    el.cam.pose({ zoom: api.viva(t) });
    api.fx.respirar(t, el.luz, { periodo: 4.8, amp: 0.07 });
  },
});
}
