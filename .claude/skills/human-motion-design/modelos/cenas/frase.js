/*@ficha
{
  "ideia": "A frase chega de perto: a câmera nasce num close da primeira palavra e recua até o enquadramento enquanto as palavras saem do desfoque; na batida, o destaque acende.",
  "camera": "Nasce num close de 1,4× na primeira palavra e recua em 2 batidas com curva forte; depois push-in vivo, passando por 1,0 no quadro aprovado. O eco desfocado do destaque, perto da câmera, anda mais rápido que a frase.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "Close na primeira palavra, ainda saindo do desfoque", "tb": 0.3 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "A frase inteira no quadro; o destaque ainda na cor do texto", "tb": 1.1 },
    { "id": "fim", "rotulo": "Fim", "legenda": "A frase no eixo, o destaque aceso, o eco desfocado cruzando a frente", "tb": 2.5, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "tipo", "texto": "As palavras saem do desfoque para o foco, uma a uma, 45 ms entre elas, subindo de pertinho." },
    { "tb": 0, "tipo": "camera", "texto": "A câmera nasce num close de 1,4× na primeira palavra e recua até o enquadramento em 2 batidas." },
    { "tb": 1, "tipo": "luz", "texto": "Na batida, um véu de borda macia varre a palavra de destaque e acende o degradê." },
    { "tb": 2, "tipo": "objeto", "texto": "O eco da palavra, gigante e desfocado, cruza a frente do quadro mais rápido que a frase." },
    { "tb": 3, "tipo": "luz", "texto": "Um brilho atravessa o destaque uma vez." }
  ]
}
@*/
/* {{id}} — "{{titulo}}" · Frase ({{dur}} s)
   Ideia: a frase chega de perto; a câmera recua do close da primeira palavra e o destaque acende na
   batida. Três camadas: a luz (longe), a frase (plano focal) e o eco desfocado do destaque (perto).
   Batidas (b(n) = n batidas): 0 palavras e recuo · b(1) destaque acende · b(2) o eco cruza ·
   b(3) brilho · saída pela transição do motor (ou acelerando, se for corte seco).
   Frase só: no máximo 2,5 s. Mais que isso, divida em duas ou use outro tipo.
   TROQUE: FRASE (uma palavra de destaque, sem ponto final) e ECO. */
{ // bloco: as constantes desta cena não colidem com as das outras
const FRASE = 'Uma frase curta com <span class="destaque">destaque</span>';
const ECO = 'destaque'; // a palavra de destaque de novo, gigante e desfocada na frente ('' tira)

Motion.cena('{{id}}', {
  render: () => `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="pilha"><h2 class="titulo frase">${FRASE}</h2></div></div>
    <div class="camada c-perto">${ECO ? `<div class="eco" aria-hidden="true">${ECO}</div>` : ''}</div>`,

  // o CSS natural é o quadro aprovado; estes são os outros estados (storyboard antes de animar)
  poses: {
    inicio: (el, api) => {
      el.cam.pose({ zoom: 1.4, x: el.P[0] * 0.9, y: el.P[1] * 0.9 });
      el.palavras.forEach((p, i) => api.set(p.el, i === 0 ? { y: 0.04 * p.corpo, blur: 0.03 * p.corpo, o: 0.95 } : { o: 0 }));
      if (el.eco) api.set(el.eco, { o: 0 });
    },
    meio: (el, api) => {
      api.tipo.varrerDestaque(0, el.palavras, { inicio: 1, dur: 0.5 });
      if (el.eco) api.set(el.eco, { x: 12 });
    },
  },

  montar(el, api) {
    api.tipo.semViuva(el.$('.frase'));
    el.palavras = api.tipo.dividir(el.$('.frase'), { por: 'palavra' });
    el.eco = el.$('.eco');
    el.luz = el.$('.luz');
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.45 },
      ],
    });
    el.P = el.cam.centro(el.palavras[0].el);
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, lerp, suave } = api;
    const ini = api.inicioEntrada(0.06);
    const entra = tipo.focar(t, el.palavras, { inicio: ini, aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.palavras, { aplicar: false }) : null;
    tipo.aplicar(el.palavras, entra, sai);
    tipo.varrerDestaque(t, el.palavras, { inicio: b(1), dur: b(1) });
    tipo.derivaDestaque(t, el.palavras, { inicio: b(2) });
    tipo.brilho(t, el.palavras.filter((p) => p.destaque), { inicio: b(3), dur: 0.7, forca: 0.4 });
    // câmera: close na primeira palavra → recua; depois viva (passa por 1,0 no aprovado)
    const r = ease.outQuad(prog(t, ini, Math.max(ini + 0.4, b(2.5))));
    el.cam.pose({ zoom: lerp(1.4, 1, r) * api.viva(t), x: el.P[0] * 0.9 * (1 - r), y: el.P[1] * 0.9 * (1 - r) });
    // o eco cruza a frente devagar, passando pelo lugar dele no aprovado
    if (el.eco) api.set(el.eco, { x: -7 * (t - api.ref), o: suave(prog(t, b(1), b(2))) });
    const nb = api.naBatida(t, { de: b(2), cada: 2, ataque: 0.12 });
    api.fx.respirar(t, el.luz, { periodo: 4.2, amp: 0.07, base: 1 + 0.3 * nb.v });
  },
});
}
