/*@ficha
{
  "ideia": "A coleção vira um acontecimento: um item sozinho, os outros caem em pilha um atrás do outro (a pilha afunda e devolve a cada um), a pilha prende o ar e explode em órbita na batida; a frase entra no vazio do centro.",
  "camera": "Começa um fio mais perto da pilha (1,08×) e recua com a onda da explosão; depois push-in vivo, passando por 1,0 no quadro aprovado. A órbita nunca para.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "Um item sozinho, grande, no centro", "tb": 0.5 },
    { "id": "meio", "rotulo": "A pilha", "legenda": "Os itens empilhados, girados, prendendo o ar antes da explosão", "tb": 3.3 },
    { "id": "fim", "rotulo": "Fim", "legenda": "Os itens em órbita, os de baixo maiores (mais perto); a frase no centro", "tb": 7, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "objeto", "texto": "O primeiro item chega sozinho da profundidade, com uma mola curta, e segura uma batida." },
    { "tb": 1, "tipo": "objeto", "texto": "Os outros entram de fora do quadro já em movimento e caem na pilha em accelerando (120 → 50 ms); a cada impacto a pilha afunda 2 % e devolve." },
    { "tb": 2, "tipo": "objeto", "texto": "O rufar continua: os últimos caem mais rápido, e cada um afunda a pilha um pouco menos (\"blub, blub, blub\")." },
    { "tb": 3.25, "tipo": "objeto", "texto": "A pilha prende o ar (encolhe 4 % em 0,16 s)." },
    { "tb": 3.5, "tipo": "objeto", "texto": "Na batida, explode: todos decolam no mesmo quadro e abrem em espiral até a órbita, sem passar do ponto; o primeiro sai por último." },
    { "tb": 4.5, "tipo": "tipo", "texto": "A frase sai do desfoque no vazio do centro, palavra a palavra." },
    { "tb": 6, "tipo": "vida", "texto": "Hold: a órbita continua girando devagar; a cada batida um item dá um pulso pequeno, em roda; a luz de trás respira." },
    { "tb": 7, "tipo": "luz", "texto": "Um brilho atravessa o destaque uma vez." },
    { "tb": 8.5, "tipo": "camera", "texto": "A órbita ganha velocidade um fio e a câmera avança: a travessia da saída já começa em movimento." }
  ],
  "saida": { "tipo": "atravessar" }
}
@*/
/* {{id}} — "{{titulo}}" · Montagem ({{dur}} s)
   Ideia: pilha → explosão → órbita viva (C4.8). O clímax do filme: quantidade, energia e escala.
   Camadas: a luz (longe), a formação (plano focal, data-heroi), a frase (perto).
   Os itens: as fotos de midia/ (até 9), ou o que você desenhar em ITENS (cartões, produtos, ícones,
   palavras, SVG). Mesmo material para todos; varia a luz, não a superfície.
   TROQUE: ITENS, FRASE (um destaque) e, se precisar, a elipse da órbita (ORBITA). */
{ // bloco: as constantes desta cena não colidem com as das outras
const FRASE = 'Tudo o que <span class="destaque">cabe</span> aqui';
const ITENS = (c) => c.midias().slice(0, 9).map((nome) => c.foto(nome));
// a órbita: raios em cqw (16:9 deitada, 9:16 em pé) e quanto os de baixo crescem (perspectiva)
const ORBITA = { '16x9': { rx: 39, ry: 17.5, perto: 0.2 }, '9x16': { rx: 29, ry: 58, perto: 0.16 } };
const GIRO = 0.16; // rad/s: a órbita nunca para
const MINIMO = 4; // com menos itens que isso, completa com peças da superfície da marca (troque por conteúdo)

function orbita(i, n, f, theta) {
  const o = ORBITA[f] || ORBITA['16x9'];
  const a = (2 * Math.PI * i) / n - Math.PI / 2 + theta;
  const sy = Math.sin(a);
  return { a, x: o.rx * Math.cos(a), y: o.ry * sy, s: 1 + o.perto * sy, z: Math.round(60 + 20 * sy) };
}

Motion.cena('{{id}}', {
  render: (c) => {
    // o que faltar até MINIMO vira peça da superfície da marca (troque por conteúdo de verdade)
    const itens = ITENS(c);
    const lista = [...itens, ...Array.from({ length: Math.max(0, MINIMO - itens.length) }, () => '<div class="peca"></div>')];
    const n = lista.length;
    return `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="formacao" data-heroi data-ponte="objeto">${lista
      .map((h, i) => {
        const o = orbita(i, n, c.formato, 0);
        return `<div class="item" style="transform:translate(-50%,-50%) translate(${o.x.toFixed(3)}cqw,${o.y.toFixed(3)}cqw) scale(${o.s.toFixed(4)});z-index:${o.z}">${h}</div>`;
      })
      .join('')}</div></div>
    <div class="camada c-perto"><div class="pilha"><h2 class="titulo frase">${FRASE}</h2></div></div>`;
  },

  poses: {
    inicio: (el, api) => el.estado(api.b(0.5), true),
    meio: (el, api) => el.estado(el.tempos.prende + 0.12, true),
  },

  montar(el, api) {
    const { rand, b, fx } = api;
    api.tipo.semViuva(el.$('.frase'));
    el.palavras = api.tipo.dividir(el.$('.frase'), { por: 'palavra' });
    el.itens = api.$$('.item');
    el.luz = el.$('.luz');
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.3 },
      ],
    });
    const n = el.itens.length;
    const longe = api.vertical ? 105 : 78; // cqw: de onde os itens chegam (fora do quadro)
    // a pilha: cada item com um giro e um desvio próprios (semente fixa)
    el.pilhaDe = el.itens.map((_, i) => ({ x: (rand(i * 3.1 + 1) - 0.5) * 3.2, y: (rand(i * 5.7 + 2) - 0.5) * 2.4, r: (rand(i * 7.3 + 3) - 0.5) * 18, s: api.vertical ? 2.0 : 1.75 }));
    el.origem = el.itens.map((_, i) => {
      const a = rand(i * 11.9 + 4) * Math.PI * 2;
      return { x: Math.cos(a) * longe, y: Math.sin(a) * longe * 0.7, r: (rand(i * 2.3 + 5) - 0.5) * 50 };
    });
    // tempos: o herói sozinho até b(1); os outros pousam em accelerando; a explosão cai na meia batida
    const voo = 0.3;
    const pousos = fx.accelerando(Math.max(1, n - 1), { de: 0.12, ate: 0.05 }).map((x) => b(1) + x + voo);
    const ultimo = pousos[pousos.length - 1] || b(1);
    const explode = Math.max(b(3.5), Math.ceil((ultimo + 0.3) / b(0.5)) * b(0.5));
    el.tempos = { voo, pousos, explode, prende: explode - 0.16, frase: explode + b(1), pulsos: explode + b(2.5) };
    // estado de cada item em t (puro): voo → pilha (afunda a cada impacto) → explosão → órbita
    el.estado = (t, sozinho = false) => {
      const T = el.tempos;
      const theta = GIRO * (t - api.ref) + 0.35 * api.ease.inQuad(api.prog(t, b(8.5), api.dur));
      const afunda = api.fisica.afundar(t, T.pousos, { forca: 0.02 });
      const prende = 1 - 0.04 * api.suave(api.prog(t, T.prende, T.explode));
      const ini = api.inicioEntrada(0);
      const doPonto = api.entrada && ['na-cena', 'ponto-de-luz'].includes(api.entrada.tipo);
      // o BPM na tela: no hold, um item por batida dá um pulso pequeno (objeto), em roda
      const nb = api.naBatida(t, { de: T.pulsos });
      el.itens.forEach((it, i) => {
        const P = el.pilhaDe[i];
        let x, y, s, r, o = 1, bright = 1, z;
        // 1. até a pilha
        if (i === 0) {
          const nasce = doPonto ? fx.nascerDoPonto(t, { inicio: ini }) : null;
          const e = api.ease.forte(api.prog(t, ini, ini + 0.7));
          s = (nasce ? nasce.s : api.lerp(0.8, 1, e) + 0.06 * api.mola(t - ini, 1, { freq: 1.6, amort: 6 })) * P.s;
          x = P.x; y = P.y; r = P.r * e;
          o = nasce ? nasce.o : api.suave(api.prog(t, ini, ini + 0.08));
          bright = nasce ? nasce.bright : 1;
        } else {
          const t1 = T.pousos[i - 1], t0 = t1 - T.voo;
          const q = api.prog(t, t0, t1);
          const O = el.origem[i];
          const k = api.hermite(t, t0, t1, 0, 0, 1, 0.45 / T.voo);
          x = api.lerp(O.x, P.x, k); y = api.lerp(O.y, P.y, k); r = api.lerp(O.r, P.r, k);
          s = P.s * api.lerp(1.15, 1, k);
          if (q <= 0) o = 0;
          // o último quica sozinho na pilha (3 quiques, cada um 38 % do anterior) e a pilha descansa
          if (i === el.itens.length - 1) y -= api.fisica.quique(t, t1, { altura: 1.4, razao: 0.38, n: 3, dur: 0.24 });
        }
        // a pilha afunda e devolve a cada impacto, e prende o ar antes de explodir
        const naPilha = i === 0 || t >= T.pousos[i - 1];
        if (naPilha) { y += afunda * 30; s *= prende * (1 - afunda * 0.5); }
        // 2. explosão → órbita (espiral que abre, sem overshoot; o herói sai por último)
        const ke = api.ease.outCubic(api.prog(t, T.explode + (i === 0 ? 0.07 : 0), T.explode + 0.85));
        if (ke > 0 && !sozinho) {
          const O2 = orbita(i, el.itens.length, api.formato, theta - (1 - ke) * 1.15);
          x = api.lerp(x, O2.x, ke); y = api.lerp(y, O2.y, ke); s = api.lerp(s, O2.s, ke); r = api.lerp(r, 0, ke);
          r += 1.4 * api.vida(t, { inicio: T.explode + 0.6, periodo: 2.6 + 0.41 * i });
          if (!sozinho && nb.k >= 0 && nb.k % el.itens.length === i) s *= 1 + 0.035 * nb.v;
          z = ke > 0.3 ? O2.z : 10 + i;
        } else z = 10 + i;
        it.style.zIndex = String(z);
        api.set(it, { pre: 'translate(-50%, -50%)', x, y, s, r, o, bright });
      });
    };
  },

  quadro(t, el, api) {
    const { tipo, b, prog, ease, lerp, suave } = api;
    const T = el.tempos;
    el.estado(t);
    // a frase entra no vazio do centro, uma batida depois da explosão
    const entra = tipo.focar(t, el.palavras, { inicio: T.frase, aplicar: false });
    const sai = !api.saida || api.saida.tipo === 'corte' ? tipo.sair(t, el.palavras, { aplicar: false }) : null;
    tipo.aplicar(el.palavras, entra, sai);
    tipo.brilho(t, el.palavras.filter((p) => p.destaque), { inicio: b(7), dur: 0.7, forca: 0.4 });
    // câmera: mais perto da pilha, recua com a onda da explosão; depois viva
    const recua = ease.forte(prog(t, T.explode, T.explode + 1.1));
    el.cam.pose({ zoom: lerp(1.08, 1, recua) * api.viva(t) * (1 + 0.035 * ease.inQuad(prog(t, b(8.5), api.dur))) });
    // a luz de trás: respira, e dá um sopro na explosão (sem borda)
    const sopro = api.fx.flash(t, T.explode, { subida: 0.08, dur: 0.9 });
    api.fx.respirar(t, el.luz, { periodo: 4.4, amp: 0.07, base: 1 + 0.35 * sopro });
  },
});
}
