/*@ficha
{
  "ideia": "A foto vira plano de cinema: nasce num close do sujeito, um fio desfocada, e o foco chega enquanto a câmera abre; a frase assenta no espaço vazio da foto, nunca em cima do rosto.",
  "camera": "Nasce em close (1,16×) no sujeito e abre em 2,5 batidas; depois push-in vivo de 1,8 %/s, passando por 1,0 no quadro aprovado. A frase, mais perto da câmera, anda um fio mais que a foto.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "Close no sujeito, o foco ainda chegando", "tb": 0.4 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "A foto aberta e nítida; a frase começando a entrar no espaço vazio", "tb": 1.5 },
    { "id": "fim", "rotulo": "Fim", "legenda": "A foto em plano cheio, o véu do lado da frase, a frase assentada no vazio", "tb": 4.4, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "camera", "texto": "A foto nasce em close de 1,16× no sujeito, um fio desfocada e mais clara; o foco chega em 1,5 batida enquanto a câmera abre." },
    { "tb": 1, "tipo": "tipo", "texto": "A frase sai do desfoque palavra a palavra no espaço vazio da foto, 45 ms entre elas." },
    { "tb": 1.5, "tipo": "luz", "texto": "Uma luz de janela, larga e sem borda, passa uma vez pela frente do quadro (1,2 s)." },
    { "tb": 3, "tipo": "luz", "texto": "O destaque da frase acende na batida (véu de borda macia)." },
    { "tb": 4, "tipo": "vida", "texto": "Hold: a câmera continua chegando; o véu respira um fio." },
    { "tb": 5, "tipo": "luz", "texto": "Um brilho atravessa o destaque uma vez." }
  ]
}
@*/
/* {{id}} — "{{titulo}}" · Foto em plano ({{dur}} s)
   Ideia: a foto da pessoa como plano de cinema. Camadas: a foto e o véu (longe), a frase (plano
   focal), a luz que passa (perto). A foto já nasce com sobra (classe .plano): a câmera viva nunca
   mostra a borda.
   A frase mora no ESPAÇO VAZIO da foto (nunca sobre rosto ou produto): ajuste .bloco-texto e o véu
   em cada formato. No 9:16, reenquadre no sujeito (foco do plano) e use o vazio de cima ou de baixo.
   MONTAGEM DE FILMAGEM (referência de cortes rápidos): ponha mais planos em PLANOS (outras fotos, ou
   a mesma foto em outro recorte com `zoom`) e os tempos dos cortes em "cortesInternos" no
   motion.json (ex.: [0.75, 1.5]); cada plano entra num corte seco, já em movimento, com o próprio
   push. A frase entra em FRASE_EM batidas (depois do último corte, ou atravessando os cortes se o
   vazio for o mesmo em todos os recortes).
   TROQUE: PLANOS (foto; foco = object-position do sujeito; zoom = recorte, 1 = a foto inteira; foco e
   zoom podem ser { '16x9': …, '9x16': … }), ALVO (o sujeito, em cqw a partir
   do centro, para o close do começo), FRASE e FRASE_EM. */
{ // bloco: as constantes desta cena não colidem com as das outras
const PLANOS = [
  { foto: '{{foto}}', foco: { '16x9': '50% 40%', '9x16': '55% 35%' }, zoom: 1 },
];
const ALVO = { '16x9': [10, -4], '9x16': [4, -18] }; // onde nasce o close (o sujeito), em cqw
const FRASE = 'A frase no espaço <span class="destaque">vazio</span>';
const FRASE_EM = 1; // batidas depois do começo da cena

Motion.cena('{{id}}', {
  render: (c) => `
    <div class="camada c-longe">${PLANOS.map((p, i) => {
      const foco = (typeof p.foco === 'object' ? c.porFormato(p.foco) : p.foco) || '50% 50%';
      const zoom = (typeof p.zoom === 'object' ? c.porFormato(p.zoom) : p.zoom) || 1;
      return `<div class="plano foto foto-${i}" style="--zoom:${zoom};transform-origin:${foco}">${c.foto(p.foto, { foco })}</div>`;
    }).join('')}<div class="veu"></div></div>
    <div class="camada c-meio"><div class="bloco-texto"><h2 class="titulo frase">${FRASE}</h2></div></div>
    <div class="camada c-perto"><div class="luz-passa"></div></div>`,

  poses: {
    inicio: (el, api) => {
      const A = el.alvo;
      el.cam.pose({ zoom: 1.16, x: A[0], y: A[1] });
      api.set(el.fotos[0], { s: el.zoom[0], blur: 0.35, bright: 1.08 });
      el.fotos.slice(1).forEach((f) => api.set(f, { o: 0 }));
      api.set(el.palavras, { o: 0 });
    },
    meio: (el, api) => {
      el.fotos.forEach((f, i) => api.set(f, { s: el.zoom[i], o: i === el.fotos.length - 1 ? 1 : 0 }));
      el.palavras.forEach((p, i) => api.set(p.el, i === 0 ? { blur: 0.05 * p.corpo, o: 0.75, y: 0.06 * p.corpo } : { o: 0 }));
    },
  },

  montar(el, api) {
    api.tipo.semViuva(el.$('.frase'));
    el.palavras = api.tipo.dividir(el.$('.frase'), { por: 'palavra' });
    el.fotos = api.$$('.foto');
    el.zoom = el.fotos.map((f) => parseFloat(f.style.getPropertyValue('--zoom')) || 1);
    el.veu = el.$('.veu');
    el.passa = el.$('.luz-passa');
    el.fotos.forEach((f) => api.pintura.filtroFixo(f));
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.1 },
        { el: el.$('.c-meio'), z: 0.1 },
        { el: el.$('.c-perto'), z: 0.45 },
      ],
    });
    // o close do começo nunca mostra a borda da foto nem a do véu: o ALVO é limitado pela sobra do
    // primeiro plano (com o recorte dele) e do véu, na profundidade da camada e no zoom mais fechado
    const A0 = api.porFormato(ALVO);
    const cx = api.caixa(el.fotos[0]);
    const [fx, fy] = (el.fotos[0].style.transformOrigin || '50% 50%').split(' ').map((v) => (parseFloat(v) || 50) / 100);
    const ox = cx.x + fx * cx.l, oy = cx.y + fy * cx.a, z0 = el.zoom[0];
    const cv = el.veu ? api.caixa(el.veu) : cx;
    const e = {
      l: Math.max(ox + (cx.x - ox) * z0, cv.x), r: Math.min(ox + (cx.x + cx.l - ox) * z0, cv.x + cv.l),
      t: Math.max(oy + (cx.y - oy) * z0, cv.y), b: Math.min(oy + (cx.y + cx.a - oy) * z0, cv.y + cv.a),
    };
    const Z = 1.16 * api.viva(0, { v: 0.018 }), dd = 1.1, folga = 0.6;
    const faixa = (v, a, b) => (a > b ? (a + b) / 2 : api.clamp(v, a, b));
    el.alvo = [faixa(A0[0], dd * (e.l + 50 / Z) + folga, dd * (e.r - 50 / Z) - folga), faixa(A0[1], dd * (e.t + api.H / 2 / Z) + folga, dd * (e.b - api.H / 2 / Z) - folga)];
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, lerp, suave } = api;
    // montagem de filmagem: qual plano está no ar (cortes secos nos tempos de cortesInternos)
    const cortes = api.cortesInternos || [];
    const nCortes = cortes.filter((c) => t >= c).length;
    const k = Math.min(nCortes, el.fotos.length - 1);
    const t0 = nCortes ? cortes[nCortes - 1] : 0;
    const ultimo = k === el.fotos.length - 1;
    el.fotos.forEach((f, i) => {
      const ativa = i === k;
      // cada plano com o próprio movimento: o primeiro ganha o foco que chega; os do meio, um push
      // que já nasce andando (corta em movimento); o último assenta no quadro aprovado
      const foco = i === 0 ? ease.inOutSine(prog(t, 0, b(1.5))) : 1;
      const lado = i % 2 ? -1 : 1;
      const push = i === 0 || (ultimo && i === k) ? 1 : 1.03 + 0.05 * (t - t0);
      api.set(f, {
        o: ativa ? 1 : 0,
        s: el.zoom[i] * push,
        x: i === 0 || i === el.fotos.length - 1 ? 0 : lado * 0.8 * (t - t0),
        blur: 0.35 * (1 - foco),
        bright: 1 + 0.08 * (1 - foco),
        semEstalo: true,
      });
    });
    // a câmera nasce no sujeito e abre; depois viva (mais rápida que o padrão, como em filmagem)
    const A = el.alvo;
    const r = ease.forte(prog(t, 0, b(2.5)));
    el.cam.pose({ zoom: lerp(1.16, 1, r) * api.viva(t, { v: 0.018 }), x: A[0] * (1 - r), y: A[1] * (1 - r) });
    // a frase, palavra a palavra, no espaço vazio
    const t1 = b(FRASE_EM);
    const entra = tipo.focar(t, el.palavras, { inicio: t1, aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.palavras, { aplicar: false }) : null;
    tipo.aplicar(el.palavras, entra, sai);
    tipo.varrerDestaque(t, el.palavras, { inicio: t1 + b(2), dur: b(1) });
    tipo.brilho(t, el.palavras.filter((p) => p.destaque), { inicio: t1 + b(4), dur: 0.7, forca: 0.4 });
    // a luz de janela passa uma vez, larga e sem borda
    const pl = prog(t, t1 + b(0.5), t1 + b(0.5) + 1.2);
    api.set(el.passa, { x: lerp(-70, 70, ease.inOutSine(pl)), o: Math.sin(Math.PI * pl) * 0.9 });
    const v = api.vida(t, { periodo: 4.3 });
    api.set(el.veu, { o: 1 - 0.06 * v * v });
  },
});
}
