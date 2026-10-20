/*@ficha
{
  "ideia": "Uma palavra de borda a borda: a lente a encontra de perto, as letras chegam da profundidade e fecham o espaço; quando ela trava, a câmera recebe o peso; o apoio pequeno entra na batida e uma linha de luz corre embaixo dela.",
  "camera": "Nasce em close (1,3×) no miolo da palavra e recua em 2,5 batidas com curva forte; na trava, um empurrão de peso de 1,2 % devolvido devagar; depois push-in vivo, passando por 1,0 no quadro aprovado.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "Close no miolo da palavra: letras enormes, ainda chegando da profundidade", "tb": 0.4 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "A palavra inteira travada, ainda na cor do texto; sem apoio", "tb": 1.6 },
    { "id": "fim", "rotulo": "Fim", "legenda": "A palavra de borda a borda no degradê do destaque, o apoio em cima e a linha de luz embaixo", "tb": 4.2, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "tipo", "texto": "A lente encontra a palavra: cada letra chega da profundidade (ampliada, espaçada e desfocada) e fecha no plano, 26 ms entre elas." },
    { "tb": 0, "tipo": "camera", "texto": "A câmera nasce em close de 1,3× no miolo da palavra e recua em 2,5 batidas." },
    { "tb": 1, "tipo": "camera", "texto": "Na trava, um empurrão de peso de 1,2 % devolvido devagar." },
    { "tb": 2, "tipo": "luz", "texto": "A linha de luz nasce no centro, embaixo da palavra, e corre para as pontas; o apoio sobe palavra a palavra." },
    { "tb": 2.5, "tipo": "luz", "texto": "Um véu macio varre a palavra e acende o degradê do destaque." },
    { "tb": 4.6, "tipo": "luz", "texto": "Um brilho atravessa a palavra uma vez; o degradê deriva um fio até a saída." }
  ]
}
@*/
/* {{id}} — "{{titulo}}" · Palavra gigante ({{dur}} s)
   Ideia: a manchete de borda a borda; a lente a encontra, a câmera recebe o peso, o apoio entra na
   batida. Camadas: a luz (longe), a palavra (plano focal), o eco da primeira letra (perto).
   Batidas: 0 lente + recuo · b(1) trava e peso · b(2) linha de luz e apoio · b(2,5) destaque · b(4,6) brilho.
   O tamanho é medido no montar (tipo.caber): a palavra ocupa LARGURA do quadro em qualquer fonte.
   TROQUE: PALAVRA (uma, ou duas curtas), APOIO (curto; '' tira; é a continuação da frase, então
   fica EMBAIXO, a não ser que a leitura peça em cima: APOIO_EM_CIMA) e LARGURA. */
{ // bloco: as constantes desta cena não colidem com as das outras
const PALAVRA = 'Palavra';
const APOIO = 'uma linha de apoio curta';
const APOIO_EM_CIMA = false;
const LARGURA = { '16x9': 0.84, '9x16': 0.86 }; // fração da largura do quadro que a palavra ocupa

Motion.cena('{{id}}', {
  render: () => {
    const apoio = APOIO ? `<p class="apoio linha-apoio">${APOIO}</p>` : '';
    return `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="pilha">
      ${APOIO_EM_CIMA ? apoio : ''}
      <h2 class="titulo palavra"><span class="destaque">${PALAVRA}</span></h2>
      <div class="horizonte"></div>
      ${APOIO_EM_CIMA ? '' : apoio}
    </div></div>
    <div class="camada c-perto"><div class="eco" aria-hidden="true">${[...PALAVRA.replace(/<[^>]+>/g, '')][0] || ''}</div></div>`;
  },

  poses: {
    inicio: (el, api) => {
      el.cam.pose({ zoom: 1.3, x: el.P[0], y: el.P[1] });
      api.tipo.lente(0.25, el.letras, { eixo: 'quadro' });
      api.tipo.varrerDestaque(0, el.letras, { inicio: 1 });
      api.set([el.apoio, el.horizonte], { o: 0 });
    },
    meio: (el, api) => {
      api.tipo.varrerDestaque(0, el.letras, { inicio: 1 });
      api.set(el.apoio, { o: 0 });
      api.set(el.horizonte, { sx: 0.05, o: 0 });
    },
  },

  montar(el, api) {
    // escala de filme: a palavra de borda a borda, medida na fonte da marca (antes de dividir)
    api.tipo.caber(el.$('.palavra'), { largura: api.porFormato(LARGURA), max: api.vertical ? 40 : 62 });
    el.letras = api.tipo.dividir(el.$('.palavra'), { por: 'letra' });
    el.apoio = el.$('.linha-apoio');
    el.apoioPal = el.apoio ? api.tipo.dividir(el.apoio, { por: 'palavra' }) : [];
    el.horizonte = el.$('.horizonte');
    el.eco = el.$('.eco');
    el.luz = el.$('.luz');
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.5 },
      ],
    });
    el.P = el.cam.centro(el.$('.palavra'));
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, lerp, suave } = api;
    const ini = api.inicioEntrada(0.04);
    // a lente encontra a palavra (letras da profundidade, espaço fechando junto)
    const entra = tipo.lente(t, el.letras, { inicio: ini, eixo: 'quadro', aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.letras, { modo: 'camera', aplicar: false }) : null;
    tipo.aplicar(el.letras, entra, sai);
    tipo.varrerDestaque(t, el.letras, { inicio: b(2.5), dur: b(1) });
    tipo.derivaDestaque(t, el.letras, { inicio: b(3.5) });
    tipo.brilho(t, el.letras, { inicio: b(4.6), dur: 0.8, forca: 0.42 });
    // o apoio sobe palavra a palavra na batida 2
    if (el.apoioPal.length) {
      const a = tipo.focar(t, el.apoioPal, { inicio: b(2) + 0.08, aplicar: false });
      const s2 = sai ? tipo.sair(t, el.apoioPal, { aplicar: false }) : null;
      tipo.aplicar(el.apoioPal, a, s2);
    }
    // a linha de luz nasce no centro e corre para as pontas (sem nunca cruzar letra)
    const h = ease.forte(prog(t, b(2), b(2) + 0.7));
    api.set(el.horizonte, { sx: lerp(0.02, 1, h), o: suave(prog(t, b(2), b(2) + 0.12)) * (sai ? 1 - suave(prog(t, api.dur - 0.25, api.dur)) : 1) });
    // câmera: close → recuo, empurrão de peso na trava, depois viva
    const r = ease.outQuad(prog(t, ini, b(3)));
    const peso = 0.012 * api.pulsoSemQuique(prog(t, b(1), b(1) + 0.9), 0.3);
    el.cam.pose({ zoom: lerp(1.3, 1, r) * (1 + peso) * api.viva(t), x: el.P[0] * (1 - r), y: el.P[1] * (1 - r) });
    // o eco da primeira letra cruza perto da câmera, desfocado
    api.set(el.eco, { x: -6 * (t - api.ref), o: suave(prog(t, b(1), b(2.5))) });
    const nb = api.naBatida(t, { de: b(5.5), cada: 2, ataque: 0.12 });
    api.fx.respirar(t, el.luz, { periodo: 4.6, amp: 0.08, base: 1 + 0.3 * nb.v });
  },
});
}
