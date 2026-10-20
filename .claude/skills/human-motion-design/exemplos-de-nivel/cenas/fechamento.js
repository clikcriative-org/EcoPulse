/* fechamento — "Fechamento com luz" (5 s).
   Ideia: o filme fecha como a revelação abriu, com o símbolo como chave. Um ponto de luz acende a
   frase; a câmera chega perto do planeta e a luz nasce símbolo com a mesma meia volta de chave,
   enquanto um brilho corre pelo aro (o amanhecer). No clique, as duas palavras da marca saem de
   dentro do símbolo. O planeta cai, o último fio do aro fica no quadro e dele acendem o convite
   (para cima) e a data (para baixo). No fim, uma segunda meia volta tranca a marca de volta no
   símbolo, que vai ao centro, pulsa uma vez, vira ponto, solta um traço de luz e apaga no preto.

   Linha do tempo: frase 0,1 · luz atrás do destaque 0,6 · a frase passa pela câmera 1,12 · câmera
   no planeta 1,02–1,72 · chave 1,25 · clique 1,75 · planeta cai 2,74 · convite 3,0 · data 3,25 ·
   brilho 3,62 · tranca 4,58 · ponto 4,79 · preto 4,98. Aprovado: 4,1.
   Câmera viva: push-in de 0,6 %/s no plano inteiro.

   Em pé (9:16): a frase em três linhas, grande no centro; símbolo, marca, convite e data em coluna
   no eixo, no tamanho do quadro em pé; o planeta começa mais alto e mais largo e, na aproximação,
   sobe até logo abaixo do símbolo. Os gestos medidos em cqw (subida, desfoque, brilho) crescem com
   a peça em que estão (K). Mesmos tempos e curvas.

   TROQUE: TEXTO. A marca usa marca/ativos/simbolo.svg entre as duas palavras. */
(function () {
  const TEXTO = {
    frase: 'O próximo passo<br><span class="destaque">começa aqui</span>',
    marcaA: 'Atlas',
    marcaB: 'PRO',
    chamada: 'Garanta o seu lugar',
    rotulo: 'Ao vivo · ',
    data: '20 de março',
  };

  const WORDS = 0.1, WORD_GAP = 0.028, WORD_DUR = 0.5;
  const AQUI = [0.6, 1.02];
  const PHRASE_OUT = [1.12, 1.34];
  const PUSH = [1.02, 1.72];
  const BIRTH = [1.25, 1.49];
  const GROW = [1.32, 1.66];
  const DAWN = [1.27, 1.86];
  const CLICK = 1.75;
  const OPEN_A = [1.75, 2.55], OPEN_P = [1.82, 2.55];
  const FALL = [2.74, 3.4];
  const LIFT = [2.84, 3.5];
  const THREAD = 2.84;
  const CTA = 3.0, DATE = 3.25;
  const SHEEN = [3.62, 4.12], DATE_SHEEN = [4.06, 4.42];
  const LOCK = [4.58, 4.82];
  const LABEL_OUT = [4.56, 4.72], CTA_OUT = [4.58, 4.74];
  const BACK_P = [4.6, 4.74], BACK_A = [4.6, 4.76];
  const GLIDE = [4.68, 4.86], ALONE = [4.72, 4.84], PULSE = [4.74, 4.88];
  const TWIST = [4.72, 4.95];
  const POINT = [4.79, 4.905];
  const CORE_ON = [4.83, 4.895], FLARE = [4.84, 4.9], DIE = [4.885, 4.98];
  const STAR_OFF = [4.88, 4.92];
  const HALO_ON = [4.78, 4.89], HALO_K = 0.4;
  const S_REF = 0.9;
  const TEXT_R = 0.02;
  const CTA_REF = 4.1;
  const AURORA_K = 1.1;
  // planeta (em % da altura e cqw de largura)
  // Planeta (em % da altura e cqw de largura) e escala dos gestos por peça: frase (T), marca e
  // símbolo (B), convite (C), data (L). No 16:9 tudo 1; em pé o planeta é mais largo e sobe mais.
  const PLANETA = {
    '16x9': { HZ0: 93, HZ_RISE: 9, HZ_PUSH: 20, HW0: 150, HW_PUSH: 80, PX_PCT: 10.8, HZ_D: 108, HZ_OUT: 101.2 },
    '9x16': { HZ0: 74, HZ_RISE: 5, HZ_PUSH: 11, HW0: 165, HW_PUSH: 85, PX_PCT: 19.2, HZ_D: 108, HZ_OUT: 101.2 },
  };
  const GESTOS = {
    '16x9': { T: 1, B: 1, C: 1, L: 1, fio: 0.34 },
    '9x16': { T: 1.7, B: 1.64, C: 2.3, L: 3, fio: 0.7 },
  };

  Motion.cena('fechamento', {
    render: (c) => `
      <div class="camada orbe"></div>
      <span class="planeta"><span class="amanhecer"></span><span class="ar"></span></span>
      <div class="pilha linha-frase"><h2 class="titulo frase">${TEXTO.frase}</h2></div>
      <span class="simbolo-solo">${c.svg('simbolo')}</span>
      <div class="pilha convite">
        <div class="selo">
          <span class="selo-janela selo-a"><span class="selo-palavra pa">${c.esc(TEXTO.marcaA)}</span></span>
          <span class="selo-simbolo">${c.svg('simbolo')}</span>
          <span class="selo-janela selo-b"><span class="selo-palavra pb">${c.esc(TEXTO.marcaB)}</span></span>
          <span class="selo-brilho" aria-hidden="true"><span class="selo-janela selo-a"><span class="selo-palavra pa">${c.esc(TEXTO.marcaA)}</span></span><span class="selo-simbolo">${c.svg('simbolo')}</span><span class="selo-janela selo-b"><span class="selo-palavra pb">${c.esc(TEXTO.marcaB)}</span></span></span>
        </div>
        <p class="cta"><span class="destaque">${c.esc(TEXTO.chamada)}</span></p>
        <p class="rotulo">${c.esc(TEXTO.rotulo)}<span class="data">${c.esc(TEXTO.data)}</span></p>
      </div>
      <span class="luz-ponto"><span class="luz-halo"></span><span class="luz-nucleo"></span></span>
      <span class="luz-traco"></span>
      <span class="fio"></span>
      <div class="camada vinheta"></div>`,

    montar(el, api) {
      const { ease: E, prog, clamp } = api;
      const $ = el.$;
      const S = (el.s = {});
      S.orb = $('.orbe');
      S.horizon = $('.planeta');
      S.dawn = $('.amanhecer');
      S.air = $('.ar');
      S.line = $('.linha-frase');
      S.title = $('.frase');
      S.star = $('.simbolo-solo');
      S.brand = $('.selo');
      S.brandSym = $('.selo > .selo-simbolo');
      S.winA = $('.selo > .selo-a');
      S.winB = $('.selo > .selo-b');
      S.wordA = $('.selo > .selo-a .pa');
      S.wordB = $('.selo > .selo-b .pb');
      S.sheen = $('.selo-brilho');
      S.cta = $('.cta');
      S.label = $('.rotulo');
      S.date = $('.data');
      S.light = $('.luz-ponto');
      S.halo = $('.luz-halo');
      S.core = $('.luz-nucleo');
      S.flare = $('.luz-traco');
      S.thread = $('.fio');
      S.vinheta = $('.vinheta');
      S.H = api.H;
      const P = (S.P = { ...PLANETA[api.vertical ? '9x16' : '16x9'] });
      P.HZ_C = P.HZ0 - P.HZ_RISE - P.HZ_PUSH - 0.8;
      const K = (S.K = GESTOS[api.vertical ? '9x16' : '16x9']);
      S.cbH = el.raiz.clientHeight;
      S.cqw = el.raiz.clientWidth / 100;

      // linha de base (cqw a partir do centro do quadro): uma caixa vazia inline-block assenta nela
      const baseline = (node) => {
        const p = document.createElement('span');
        p.style.cssText = 'display:inline-block;width:0;height:0';
        node.appendChild(p);
        const y = api.caixaNaTela(p).y;
        p.remove();
        return y;
      };
      S.titleY = api.caixaNaTela(S.title).cy;
      S.words = api.tipo.dividir(S.title, { por: 'palavra' }).map((p, i) => ({ el: p.el, i, d: Math.hypot(p.cx, p.cy * 1.4), base: baseline(p.el) }));
      const dmax = Math.max(...S.words.map((w) => w.d));
      S.words.forEach((w) => (w.dn = w.d / dmax));
      S.aqui = S.words[S.words.length - 1];
      S.ctaWords = api.tipo.dividir(S.cta, { por: 'palavra' }).map((p) => p.el);
      S.aurora = [...el.raiz.querySelectorAll('.m-destaque-dividido .m-bloco')];
      S.ctaBase = baseline(S.cta);
      S.threadY = S.ctaBase + 0.45 * K.C;
      S.labelBase = baseline(S.label);

      // A marca: caixas no layout final (cqw), relativas ao centro dela.
      const bb = api.caixa(S.brand), bs = api.caixa(S.brandSym), ba = api.caixa(S.wordA), bp = api.caixa(S.wordB), so = api.caixa(S.star);
      S.brandY = bb.cy;
      S.starDX = bs.cx - bb.cx;
      S.starFit = bs.l / so.l;
      S.symW = bs.l;
      // cada palavra começa com a ponta escondida no miolo do símbolo e desliza inteira para fora
      S.travelA = bs.cx - 0.08 * bs.l - ba.x;
      S.travelP = bs.cx + 0.08 * bs.l - (bp.x + bp.l);
      // as palavras crescem de 88 % a partir do centro do símbolo
      S.wordA.style.transformOrigin = `${(bs.cx - ba.x).toFixed(3)}cqw 50%`;
      S.wordB.style.transformOrigin = `${(bs.cx - bp.x).toFixed(3)}cqw 50%`;
      // letras de cada palavra, com a distância ao centro do símbolo (para o calor)
      const letras = (w, b) => api.tipo.dividir(w, { por: 'letra' }).map((p) => ({ el: p.el, xc: p.cx - (bb.cx - 0) }));
      S.letA = letras(S.wordA, ba);
      S.letP = letras(S.wordB, bp);
      S.symCx = bs.cx;
      api.tipo.dividir(S.sheen.querySelector('.pa'), { por: 'palavra' });

      // planeta e queda
      const { HZ0, HZ_RISE, HZ_PUSH, HZ_C, HZ_D, HZ_OUT } = P;
      const F1 = (HZ_OUT - HZ_C) / (HZ_D - HZ_C);
      const V_END = (3 * F1) / (FALL[1] - FALL[0]);
      const TAIL = (3 * (1 - F1)) / V_END;
      const fallF = (t) => (t <= FALL[1] ? F1 * E.inCubic(prog(t, FALL[0], FALL[1])) : F1 + (1 - F1) * E.outCubic(prog(t, FALL[1], FALL[1] + TAIL)));
      const pushE = (t) => E.simetrica(prog(t, PUSH[0], PUSH[1]));
      S.pushE = pushE;
      S.hzAt = (t) => HZ0 - HZ_RISE * E.outSine(prog(t, 0, 1.1)) - HZ_PUSH * pushE(t) - 0.8 * prog(t, 1.72, FALL[0]) + (HZ_D - HZ_C) * fallF(t);
      S.hzLag = (t) => { let s = 0; for (let k = 1; k <= 6; k++) s += S.hzAt(t - 0.06 * k); return s / 6; };
      const tick = (x, b) => { const q = prog(x, b - 0.07, b + 0.15); return 12.6 * Math.sin(Math.PI * q) * Math.pow(1 - q, 1.5); };
      S.starRot = (x) => 180 * E.inOutExpo(prog(x, BIRTH[0], BIRTH[1])) + tick(x, BIRTH[1]) + 180 * E.inOutExpo(prog(x, LOCK[0], LOCK[1])) + 36 * E.inCubic(prog(x, TWIST[0], TWIST[1]));
      S.spinSpeed = (x) => Math.abs(S.starRot(x + 1 / 120) - S.starRot(x - 1 / 120)) * 60;
      const ramp = (u, k) => (u <= 0 ? 0 : u >= 1 ? 1 : (u < k ? (u * u) / (2 * k) : u - k / 2) / (1 - k / 2));
      S.ramp = ramp;
      const outB = E.outBack(0.8);
      S.pA = (t) => outB(ramp(prog(t, OPEN_A[0], OPEN_A[1]), 0.05 / (OPEN_A[1] - OPEN_A[0]))) * (1 - E.inCubic(prog(t, BACK_A[0], BACK_A[1])));
      S.pP = (t) => outB(ramp(prog(t, OPEN_P[0], OPEN_P[1]), 0.05 / (OPEN_P[1] - OPEN_P[0]))) * (1 - E.inCubic(prog(t, BACK_P[0], BACK_P[1])));
      S.occA = (t) => (1 - E.inOutSine(prog(t, OPEN_A[0] + 0.4, OPEN_A[0] + 0.56))) + E.inOutSine(prog(t, BACK_A[0] - 0.02, BACK_A[0] + 0.05));
      S.occP = (t) => (1 - E.inOutSine(prog(t, OPEN_P[0] + 0.3, OPEN_P[0] + 0.46))) + E.inOutSine(prog(t, BACK_P[0] - 0.02, BACK_P[0] + 0.04));
      void clamp;
    },

    quadro(t, el, api) {
      const S = el.s;
      if (!S) return;
      const { set, ease: E, prog, lerp, clamp, spring } = api;
      const bell = (x, a, b) => Math.pow(Math.sin(Math.PI * prog(x, a, b)), 2);
      const bump = (x, a, b) => Math.sin(Math.PI * prog(x, a, b));
      const TAU = 2 * Math.PI;
      const wave = (x, period, phase = 0) => Math.sin(TAU * (x / period + phase));
      const breathe = (x) => wave(x - 0.7, 2.0);
      const twinkle = (x) => 0.6 * wave(x, 1.7, 0.1) + 0.4 * wave(x, 2.9, 0.6);
      const K = S.K, P = S.P;
      const glowCss = (b) => (b > 0.002 ? ` drop-shadow(0 0 ${(1.2 * K.B * b).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(80 * Math.min(1, b))}%, transparent))` : '');
      const glyphGlow = 'drop-shadow(0 0 0.9cqw color-mix(in srgb, var(--destaque) 55%, transparent))';
      const { ramp } = S;

      // Câmera viva: push-in contínuo e lento no plano inteiro.
      const sR = 1 + 0.006 * t;
      set(el.raiz, { pre: '', s: sR });
      const dawn = E.outCubic(prog(t, 0.05, 1.0));
      const outro = E.inOutSine(prog(t, 4.58, 4.93));

      // ── Planeta e luz de fundo ──
      const hz = S.hzAt(t);
      const hw = P.HW0 + P.HW_PUSH * S.pushE(t);
      const hzPx = (hz / 100) * S.cbH, hzI = Math.floor(hzPx);
      S.horizon.style.setProperty('--hz', hzI + 'px');
      S.horizon.style.transform = `translateX(-50%) translateY(${(hzPx - hzI).toFixed(3)}px)`;
      S.horizon.style.setProperty('--hw', 2 * Math.round((hw * S.cqw) / 2) + 'px');
      S.horizon.style.opacity = (E.outCubic(prog(t, 0.02, 0.75)) * (1 - outro)).toFixed(4);
      const br = breathe(t);
      const vPx = (Math.abs(S.hzAt(t + 0.005) - S.hzAt(t - 0.005)) / 0.01) * P.PX_PCT;
      const hb = clamp(vPx / 1500, 0, 1) * 0.5 * K.B;
      S.horizon.style.filter = `brightness(${(1 + 0.045 * br).toFixed(4)}) blur(${hb.toFixed(3)}cqw)`;
      const airX = 50 + 6 * wave(t, 4.6, 0.3);
      const airM = `radial-gradient(ellipse 24% 9% at ${airX.toFixed(3)}% 2.1%, #000, transparent)`;
      S.air.style.webkitMaskImage = airM;
      S.air.style.maskImage = airM;
      S.air.style.opacity = (0.5 + 0.4 * br).toFixed(4);
      const orbY = (0.5 * (hz - S.hzLag(t)) * S.H) / 100;
      const brO = wave(t - 3.95, 2.4);
      set(S.orb, {
        pre: '',
        x: 0.6 * wave(t, 4.4, 0.2) + 1.2 * wave(t, 5, 0.1),
        y: orbY + 0.35 * wave(t, 3.7, 0.7),
        s: 1 + 0.05 * bump(t, 1.0, 2.4),
        o: dawn * (1 - outro) * (0.91 + 0.02 * br + 0.07 * brO),
      });
      const dw = E.outCubic(prog(t, DAWN[0], DAWN[1]));
      const dO = E.outCubic(prog(t, DAWN[0], DAWN[0] + 0.08)) * (1 - E.inOutSine(prog(t, DAWN[0] + 0.14, DAWN[1])));
      if (dO > 0.002) {
        const c1 = 50 - 24 * dw, c2 = 50 + 24 * dw, f = 2.5 + 5 * dw;
        const peak = (c) => `linear-gradient(90deg, transparent ${(c - f).toFixed(2)}%, #000 ${c.toFixed(2)}%, transparent ${(c + f).toFixed(2)}%)`;
        const m = `${peak(c1)}, ${peak(c2)}`;
        S.dawn.style.webkitMaskImage = m;
        S.dawn.style.maskImage = m;
      }
      S.dawn.style.opacity = dO.toFixed(4);
      set(S.vinheta, { o: dawn });

      // ── Frase: entra na ordem de leitura, o bloco cresce de 95 %; o miolo acende primeiro.
      //    Sai em bloco, passando pela câmera.
      const blockIn = E.forte(prog(t, WORDS, WORDS + 0.7));
      const ox = prog(t, PHRASE_OUT[0], PHRASE_OUT[1]);
      const oc = E.inCubic(ox);
      S.line.style.opacity = t < PHRASE_OUT[1] + 0.02 ? '1' : '0';
      const sT = (0.95 + 0.05 * blockIn) * (1 + 0.015 * prog(t, 0.5, PHRASE_OUT[0])) * (1 + 0.2 * oc);
      set(S.title, { pre: '', s: sT, style: { filter: `blur(${(1.3 * K.T * oc).toFixed(3)}cqw)` }, o: 1 - Math.pow(ox, 1.5) });
      // trava de linha de base: a linha não pula 1 px no push-in lento
      const sRr = 1 + 0.006 * S_REF, sTr = 1 + 0.015 * prog(S_REF, 0.5, PHRASE_OUT[0]);
      const lockT = 1 - E.inOutSine(prog(t, PHRASE_OUT[0] + 0.05, PHRASE_OUT[0] + 0.19));
      const lockTitle = (base) => {
        const yNow = sR * (S.titleY + sT * (base - S.titleY));
        const yRef = sRr * (S.titleY + sTr * (base - S.titleY));
        return (lockT * (yRef - yNow)) / (sR * sT);
      };
      const flash0 = bell(t, 0.08, 0.62);
      S.words.forEach((w) => {
        const t0 = WORDS + w.i * WORD_GAP;
        const a = E.forte(prog(t, t0, t0 + WORD_DUR));
        const ao = E.outCubic(ramp(prog(t, t0, t0 + 0.28), 0.05 / 0.28));
        const af = E.forte(prog(t, t0 - 0.05 * (1 - w.dn), t0 + WORD_DUR * (0.55 + 0.15 * w.dn)));
        const aq = w === S.aqui ? bell(t, AQUI[0], AQUI[1]) : 0;
        set(w.el, {
          pre: '',
          y: 1.4 * K.T * (1 - a) + lockTitle(w.base),
          r: TEXT_R,
          blur: 1.1 * K.T * (1 - af),
          bright: 1 + 0.8 * (1 - w.dn) * flash0 + 0.28 * aq,
          filter: aq > 0.002 ? `drop-shadow(0 0 ${(1.4 * K.T * aq).toFixed(3)}cqw color-mix(in srgb, var(--destaque) ${Math.round(70 * aq)}%, transparent))` : '',
          o: ao,
        });
      });

      // ── Marca: abre a partir do símbolo (o símbolo sai do centro para o lugar dele na marca) ──
      const open = E.forte(ramp(prog(t, CLICK, 2.6), 0.05 / (2.6 - CLICK)));
      const Sb = lerp(1 / S.starFit, 1, open);
      const bx = -S.starDX * Sb * (1 - open);
      const dip = 0.28 * K.B * bump(t, 2.76, 2.98);
      const lift = E.bezier(0.33, 0, 0.12, 1)(prog(t, LIFT[0], LIFT[1]));
      const by = dip + S.brandY * lift;
      const glide = E.inOutSine(prog(t, GLIDE[0], GLIDE[1]));
      const restX = bx + S.starDX * Sb;
      const glideBlur = 0.25 * K.B * Math.sin(Math.PI * prog(t, GLIDE[0], GLIDE[1]));
      set(S.brand, { pre: '', x: bx - restX * glide, y: by - S.brandY - by * glide, s: Sb });
      // palavras: deslizam inteiras para fora do símbolo (a janela recorta o que ainda está dentro)
      const heat = (1 - E.outCubic(prog(t, CLICK, CLICK + 0.7))) * (t >= CLICK ? 1 : 0) + E.inCubic(prog(t, BACK_A[0], BACK_A[1]));
      const word = (w, win, list, travel, pf, k, lado) => {
        const p = pf(t);
        const sc = 0.88 + 0.12 * p;
        const dx = travel * (1 - p);
        set(w, { pre: '', s: sc, post: `translateX(${dx.toFixed(4)}cqw)` });
        const v = Math.abs(travel * (pf(t + 0.008) - pf(t - 0.008))) / 0.016; // cqw/s
        api.fx.obturador(w, v, 0, { fator: 0.0077 });
        const kk = clamp(k, 0, 1);
        const F = 0.9;
        const m = lado < 0
          ? `linear-gradient(90deg, #000 0, #000 calc(100% - ${F}cqw), rgba(0,0,0,${(1 - kk).toFixed(3)}) 100%)`
          : `linear-gradient(90deg, rgba(0,0,0,${(1 - kk).toFixed(3)}) 0, #000 ${F}cqw, #000 100%)`;
        set(win, { mask: m });
        list.forEach((L) => {
          const x = sc * (L.xc + dx * (1) - S.starDX) ;
          const hot = heat * clamp(1 - (Math.abs(x) - 0.38 * S.symW) / (2.1 * S.symW));
          set(L.el, { bright: hot > 0.01 ? 1 + 0.7 * hot : 1 });
        });
      };
      word(S.wordA, S.winA, S.letA, S.travelA, S.pA, S.occA(t), -1);
      word(S.wordB, S.winB, S.letP, S.travelP, S.pP, S.occP(t), 1);
      // troca cruzada entre o símbolo solo (1) e o da marca (0)
      const handoff = clamp(1 - E.inOutSine(prog(t, 2.34, 2.62)) + E.inOutSine(prog(t, 4.4, 4.54)));
      const tk = twinkle(t), tkP = 0.5 + 0.5 * tk;
      const twS = 1 + 0.024 * tk, twR = 1.4 * wave(t, 3.7, 0.4);
      set(S.brandSym, {
        pre: '',
        r: twR,
        s: twS,
        o: t >= 2.3 && t < LOCK[0] ? 1 : 0,
        filter: `drop-shadow(0 0 ${(0.9 * (0.4 + 0.6 * tkP)).toFixed(3)}cqw color-mix(in srgb, var(--destaque) ${Math.round((15 + 45 * tkP * tkP) * (1 - handoff))}%, transparent))`,
      });

      // ── O símbolo solo: nasce do ponto com a meia volta; respira; no fim tranca, pulsa e vira ponto.
      const grow = t < GROW[0] ? 0 : E.outBack(1.5)(prog(t, GROW[0], GROW[1]));
      const inhale = -0.05 * E.inOutSine(prog(t, 1.6, CLICK)) + (t > CLICK ? 0.05 * spring(t - CLICK, { freq: 2, damp: 9 }) : 0);
      const alone = E.outCubic(prog(t, ALONE[0], ALONE[1]));
      const pulse = bell(t, PULSE[0], PULSE[1]);
      const shrink = E.bezier(0.5, 0, 0.8, 1)(prog(t, POINT[0], POINT[1]));
      const whirl = clamp(S.spinSpeed(t) / 2600, 0, 1);
      const born = t < 1.3 ? 0 : 1 - E.outCubic(prog(t, 1.3, 1.9));
      const click = bell(t, CLICK - 0.05, CLICK + 0.15);
      const emit = bell(t, CLICK, 2.45);
      const charge = bell(t, BACK_A[0] - 0.04, BACK_A[1] + 0.02);
      const sStar = S.starFit * Sb * lerp(1, 1 / S.starFit, alone) * grow * (1 + inhale) * (1 + 0.07 * pulse) * (1 - 0.9 * shrink);
      set(S.star, {
        pre: 'translate(-50%,-50%)',
        x: restX * (1 - glide),
        y: by * (1 - glide),
        r: S.starRot(t) + twR,
        s: Math.max(0, sStar * twS),
        o: (t >= 1.3 ? 1 : 0) * handoff * (1 - E.inOutSine(prog(t, STAR_OFF[0], STAR_OFF[1]))),
        blur: 1.1 * K.B * Math.pow(whirl, 0.8) + glideBlur,
        bright: 1 + 1.3 * born + 1.3 * whirl + 0.9 * click + 0.35 * emit + 0.45 * charge + 0.8 * pulse + 1.2 * shrink,
        filter: glyphGlow + glowCss(0.7 * born + 0.7 * whirl + 0.9 * click + 0.7 * pulse + 0.9 * shrink + 0.3 * tkP * tkP),
      });

      // ── Ponto de luz: abre a cena, vira o símbolo e, no fim, é o que resta dele.
      let cs, co, hs, ho;
      if (t < 0.9) {
        const burst = E.outCubic(prog(t, 0.1, 0.5));
        cs = (1 + 0.15 * E.inOutSine(prog(t, 0, 0.1))) * (1 + 1.2 * burst);
        co = 1 - burst;
        hs = 1 + 1.4 * E.outCubic(prog(t, 0.1, 0.7));
        ho = 1 - E.inOutSine(prog(t, 0.1, 0.7));
      } else if (t < 3) {
        const on = E.outCubic(prog(t, 1.24, 1.3)), off = E.inOutSine(prog(t, 1.31, 1.37));
        cs = 0.3 + 0.9 * on + 0.5 * off;
        co = on * (1 - off);
        hs = 0.5 + 0.5 * on + 0.5 * off;
        ho = 0.85 * on * (1 - off);
      } else {
        const on = E.inOutSine(prog(t, CORE_ON[0], CORE_ON[1])), off = E.outSine(prog(t, DIE[0], DIE[1]));
        const hon = E.inOutSine(prog(t, HALO_ON[0], HALO_ON[1]));
        cs = (0.35 + 0.85 * on) * (1 - 0.6 * off);
        co = on * (1 - off);
        hs = 0.45 + 0.55 * hon + 0.3 * off;
        ho = HALO_K * hon * (1 - off);
      }
      set(S.core, { pre: 'translate(-50%,-50%)', s: cs, o: co });
      set(S.halo, { pre: 'translate(-50%,-50%)', s: hs, o: ho });
      const f1 = E.outCubic(prog(t, 0.1, 0.18)) * (1 - E.outCubic(prog(t, 0.18, 0.6)));
      const f3 = Math.pow(prog(t, FLARE[0], FLARE[1]), 2) * (1 - E.outSine(prog(t, DIE[0], DIE[1])));
      const fsx = t < 3 ? 0.04 + 0.96 * E.outExpo(prog(t, 0.1, 0.48)) : 0.06 + 0.69 * E.outExpo(prog(t, FLARE[0], DIE[1]));
      set(S.flare, { pre: 'translate(-50%,-50%)', sx: fsx, sy: t < 3 ? 1 : 0.7, o: 0.85 * Math.max(f1, f3) });

      // ── O fio do horizonte, o convite e a data: o último fio do aro sobe até a linha de base do
      //    convite; o convite acende dele para cima (primeiro o brilho) e a data cai para baixo.
      const y0 = (S.hzAt(THREAD) / 100) * S.H - S.H / 2;
      const th = E.forte(ramp(prog(t, THREAD, THREAD + 0.32), 0.06 / 0.32));
      set(S.thread, {
        pre: '',
        y: lerp(y0, S.threadY, th),
        sx: lerp(1, K.fio, E.forte(ramp(prog(t, THREAD, THREAD + 0.5), 0.06 / 0.5))),
        sy: lerp(1, 0.45, E.inOutSine(prog(t, 3.1, 3.7))),
        o: E.outCubic(prog(t, THREAD - 0.03, THREAD + 0.08)) * (1 - E.inOutSine(prog(t, 3.28, 3.74))),
      });
      const sCta = 1 + 0.006 * CTA_REF;
      const lockCta = (base) => (base * sCta) / sR - base;
      S.ctaWords.forEach((node, i) => {
        const t0 = CTA + i * WORD_GAP;
        const glow = E.outCubic(prog(t, t0, t0 + 0.06)) * (1 - E.inOutSine(prog(t, t0 + 0.06, t0 + 0.36)));
        const a = E.forte(prog(t, t0 + 0.03, t0 + 0.55));
        const ao = E.outCubic(ramp(prog(t, t0, t0 + 0.26), 0.05 / 0.26));
        const xp = prog(t, CTA_OUT[0] + i * 0.01, CTA_OUT[1]);
        const ex = E.inExpo(xp);
        set(node, { pre: '', y: K.C * (1.1 * (1 - a) + 0.6 * ex) + lockCta(S.ctaBase), r: TEXT_R, blur: K.C * (0.8 * (1 - a) + 0.7 * ex), bright: 1 + 1.3 * glow, o: ao * (1 - E.inCubic(xp)) });
      });
      const la = E.forte(prog(t, DATE, DATE + 0.55));
      const lo = E.outCubic(ramp(prog(t, DATE, DATE + 0.3), 0.05 / 0.3));
      const lex = E.inCubic(prog(t, LABEL_OUT[0], LABEL_OUT[1]));
      set(S.label, { pre: '', y: K.L * (-1.0 * (1 - la) + 0.6 * lex) + lockCta(S.labelBase), r: TEXT_R, blur: K.L * (0.5 * (1 - la) + 0.6 * lex), o: lo * (1 - lex) });

      // ── Brilho do hold: atravessa a marca e desce uma vez pela data ──
      const sw = E.inOutSine(prog(t, SHEEN[0], SHEEN[1]));
      const c = lerp(-24, 124, sw);
      const band = `linear-gradient(104deg, transparent ${(c - 9).toFixed(2)}%, #000 ${c.toFixed(2)}%, transparent ${(c + 9).toFixed(2)}%)`;
      set(S.sheen, { o: t > SHEEN[0] - 0.02 && t < SHEEN[1] + 0.02 ? 0.85 : 0, mask: band });
      const sp = lerp(-30, 130, E.inOutSine(prog(t, DATE_SHEEN[0], DATE_SHEEN[1])));
      S.date.style.backgroundImage = `linear-gradient(100deg, var(--texto-suave) ${(sp - 24).toFixed(2)}%, var(--texto) ${sp.toFixed(2)}%, var(--texto-suave) ${(sp + 24).toFixed(2)}%)`;

      // o degradê escorre: cada fatia mostra uma janela maior do degradê, que oscila devagar
      api.tipo.escorrerDestaque(t, S.aurora, { sobra: AURORA_K - 1, periodo: 3.4, ref: 4.0, amp: 0.5 });
    },
  });
})();
