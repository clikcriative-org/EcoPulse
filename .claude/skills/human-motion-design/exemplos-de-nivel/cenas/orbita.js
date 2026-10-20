/* orbita — "Pilha que vira órbita" (4 s).
   Ideia: peso e soltura, com um fio para o olho seguir (a capa da frente). Ela chega no embalo do
   mergulho do bento, ainda empurrando a câmera, e assenta sozinha por uma batida. As outras 19
   entram de fora do quadro já em movimento e caem na pilha em accelerando (45 → 17 ms, um rufar).
   Cada impacto afunda a pilha inteira e ela devolve (blub, blub, blub); a última quica sozinha.
   A pilha prende o ar e EXPLODE na batida 3: abre em espiral (como uma flor, sem capa trocando de
   lugar) e a capa de baixo é a última a sair. A explosão não pousa: desemboca numa órbita que
   nunca para; o anel gira e a câmera avança através dele (dolly). A frase é lida no trecho mais
   calmo (o quadro aprovado passa, em movimento, em 2,84 s). No fim a frase atravessa a câmera, as
   capas passam por ela e saem pelas bordas com rastro, e o fundo afunda no preto.
   Perspectiva de verdade: cada capa tem a sua distância (as de baixo mais perto, crescem mais e
   saem primeiro). A ordem de camadas passa da pilha para a do anel por dissolve (nunca uma capa
   pulando na frente da vizinha) e fica fixa depois.

   Em pé (9:16) é a mesma ideia recomposta, não recortada: a capa única e a pilha ocupam a largura
   (2,2 × o tamanho do 16:9); a órbita vira uma elipse mais alta que larga em volta da frase grande
   (1,75 ×), um pouco acima do meio. Rente à frase as capas encolhem (como se estivessem mais longe)
   e inclinam menos; no alto e embaixo, onde o quadro sobra, crescem. Elas se distribuem pelo
   comprimento que ocupam no anel (não por ângulo): o mesmo respiro entre vizinhas em toda a volta.
   Tempos, curvas e física são os mesmos nos dois formatos.

   TROQUE: FRASE. As capas vêm de midia/ (fotos) ou da arte de demonstração em _comum.js; a capa
   da frente (CAPA_HEROI) é a que o bento entrega no mergulho. */
(function () {
  const FRASE = 'O catálogo inteiro<br><span class="destaque">num único acesso</span>';
  const N = 20;
  const CAPA_HEROI = 2;

  const RX = 32; // raios da órbita (cqw)
  const RY = 21;
  const HERO_S = 2.6; // escalas: capa única e pilha
  const PILE_S = 2.3;
  const W = 10.5; // largura da capa em cqw (só geometria; a real vem de --orb-capa)
  const FX = 50, FY = 28.125; // meio quadro em cqw

  // Em pé: a mesma órbita recomposta (ver o cabeçalho). CY e K abrem o plano exatamente onde o
  // mergulho do bento em pé termina (NEXT_V em bento.js).
  const VERT = {
    RX: 42.5, RY: 55, CY: -4,
    K: 2.2,                // capa única e pilha: escala sobre a do 16:9
    POFF: 2.0,             // desvios de cada capa na pilha
    ORB: 2.3,              // capas no anel
    SIDE: 0.5,             // rente à frase a capa encolhe para esta fração
    B0: 0.3, B1: 0.75,     // faixa da frase em |sen θ|: SIDE abaixo de B0, tamanho cheio acima de B1
    TILT: 0.8,             // inclinação própria de cada capa no anel
    TS: 0.4,               // rente à frase a inclinação cai para esta fração
  };
  // 16:9: os valores de base (multiplicadores 1).
  const G169 = { v: false, RX, RY, CY: 0, HERO: HERO_S, PILE: PILE_S, POFF: 1, ORB: 1, TILT: 1, FX, FY, PX: 1 };
  const T = {
    catchPeak: 0.09,
    land0: 0.62,
    gap0: 0.045,
    gap1: 0.017,
    fall: 0.1,
    antic: [1.34, 1.5],
    burst: 1.5,
    heroDelay: 0.07,
    order: [0.24, 0.6],
    text: 2.0,
    wordGap: 0.04,
    glint: [2.2, 2.9],
    textOut: [3.44, 3.74],
    void: [3.5, 3.9],
    black: [3.93, 3.97],
  };
  const LIFT = 0.35;
  const BOUNCE = { h: 0.08, d: 0.1, q: 0.4 };
  const LAST_BOUNCE = { h: 0.1, d: 0.085, q: 0.36 };
  const SINK = { a: 0.02, zeta: 15, w: 2 * Math.PI * 7 };
  const SWIRL = 1.3;
  const NEAR = 0.4;
  const K_OPEN = 9;
  const K_SWIRL = 6;
  const T_REF = 2.84;
  const SPIN = { a: 0.12, w: 0.22, tau: 0.8 };
  const DOLLY = { a: 0.1, v: 0.12, tau: 0.4 };
  const CAM = 0.012;
  const AURORA = { e: 0.16, period: 3.4 };
  const K_TOP = 0.8;
  const GROW = 1.4;
  const TEXT_K = 0.12;
  const DT = 1 / 60;
  const SHARP = [2, 11, 15]; // pontos de leitura: ficam nítidas durante o voo

  const smooth = (x) => x * x * (3 - 2 * x);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const open = (tau, k) => (tau <= 0 ? 0 : 1 - Math.exp(-k * tau) * (1 + 0.5 * k * tau));
  const RAMP = 0.04;
  const launch = (tau) => {
    if (tau <= 0) return 0;
    if (tau >= RAMP) return tau - RAMP / 2;
    const x = tau / RAMP;
    return RAMP * (x * x * x - 0.5 * x * x * x * x);
  };
  const ANT_END_V = 1.5 / (T.antic[1] - T.antic[0]);
  const ANT_TE = 0.03;
  const anticOf = (t) => {
    if (t <= T.antic[1]) {
      const p = Math.min(1, Math.max(0, (t - T.antic[0]) / (T.antic[1] - T.antic[0])));
      return p * p * (1.5 - 0.5 * p);
    }
    return 1 + ANT_END_V * ANT_TE * (1 - Math.exp(-(t - T.antic[1]) / ANT_TE));
  };
  function bounce(tau, B) {
    let r = tau;
    for (let n = 0; n < 3; n++) {
      const h = B.h * Math.pow(B.q, n);
      const d = B.d * Math.pow(Math.sqrt(B.q), n);
      if (r < d) return h * 4 * (r / d) * (1 - r / d);
      r -= d;
    }
    return 0;
  }
  const impulse = (tau) => (tau <= 0 ? 0 : Math.exp(-SINK.zeta * tau) * Math.sin(SINK.w * tau));
  function filterOf(blur, bright) {
    const f = [];
    if (blur > 0.004) f.push(`blur(${blur.toFixed(3)}cqw)`);
    if (Math.abs(bright - 1) > 0.002) f.push(`brightness(${bright.toFixed(3)})`);
    return f.join(' ') || 'none';
  }
  const depthOf = (theta) => (1 + Math.sin(theta)) / 2;
  const phi = (t) => SPIN.a * (t - T_REF) + SPIN.w * SPIN.tau * (Math.exp((t - T_REF) / SPIN.tau) - 1);
  const dolly = (t) => DOLLY.a * (t - T_REF) + DOLLY.v * DOLLY.tau * (Math.exp((t - T_REF) / DOLLY.tau) - 1);
  const magnify = (z, k) => 1 / Math.max(0.12, 1 - z * k);
  const nearOf = (dep) => K_TOP + (1 - K_TOP) * dep;
  // Em pé: 0 na faixa da frase, 1 da diagonal para cima e para baixo (transição suave).
  const bandOf = (G, th) => smooth(Math.min(1, Math.max(0, (Math.abs(Math.sin(th)) - G.B0) / (G.B1 - G.B0))));
  // Perfil de tamanho e inclinação no anel (1 no 16:9).
  const profOf = (G, th) => (G.v ? G.SIDE + (1 - G.SIDE) * bandOf(G, th) : 1);
  const tiltOf = (G, th) => (G.v ? G.TILT * (G.TS + (1 - G.TS) * bandOf(G, th)) : G.TILT);
  // Em pé, o lugar de cada capa é uma fração u da volta, medida pelo comprimento que ela ocupa ali
  // (largura no alto e embaixo, altura nas laterais, já com perfil e inclinação média): o mesmo
  // respiro em toda a volta. u = 0 no alto, crescendo no sentido do giro (como o ângulo).
  function tabelaDoAnel(G) {
    const M = 4096;
    const ths = [], us = [];
    let acc = 0;
    for (let k = 0; k <= M; k++) {
      const th = -Math.PI / 2 + (2 * Math.PI * k) / M;
      ths.push(th);
      us.push(acc);
      const tm = th + Math.PI / M;
      const dx = -G.RX * Math.sin(tm), dy = G.RY * Math.cos(tm);
      const L = Math.hypot(dx, dy);
      const sc = (0.84 + 0.16 * depthOf(tm)) * profOf(G, tm);
      const al = ((12 * tiltOf(G, tm)) * Math.PI) / 180; // |giro| médio: 12°
      const wr = Math.cos(al) + 0.625 * Math.sin(al), hr = 0.625 * Math.cos(al) + Math.sin(al);
      const ext = sc * Math.min(wr / Math.max(1e-6, Math.abs(dx) / L), hr / Math.max(1e-6, Math.abs(dy) / L));
      acc += (L / ext) * ((2 * Math.PI) / M);
    }
    for (let k = 0; k <= M; k++) us[k] /= acc;
    return (u) => {
      const f = u - Math.floor(u);
      let lo = 0, hi = M;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (us[mid] <= f) lo = mid; else hi = mid;
      }
      const span = us[hi] - us[lo];
      return ths[lo] + (ths[hi] - ths[lo]) * (span > 0 ? (f - us[lo]) / span : 0);
    };
  }
  // Ângulo no anel de uma capa com giro acumulado ph.
  const anguloNoAnel = (G, c, ph) => (G.v ? G.thetaOf(c.u + ph / (2 * Math.PI)) : c.a + ph);

  // Lugar de cada capa no anel (quadro aprovado) e na pilha: fase, giro alternado, a capa herói por
  // cima na ordem da pilha final, desvio próprio de cada uma sem sorteio.
  function lugar(i, total) {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    const x = RX * Math.cos(angle), y = RY * Math.sin(angle);
    const depth = (1 + Math.sin(angle)) / 2;
    const scale = 0.84 + 0.16 * depth;
    const turn = (i % 2 ? 1 : -1) * (10 + 2 * (i % 3));
    const rank = i === CAPA_HEROI ? total - 1 : i > CAPA_HEROI ? i - 1 : i;
    return {
      style: `--x:${x.toFixed(2)}cqw;--y:${y.toFixed(2)}cqw;--r:${turn}deg;--s:${scale.toFixed(3)};--z:${Math.round(depth * 20) + 1};--b:${(0.7 + 0.3 * depth).toFixed(2)}`,
      r: turn,
      rank: rank + 1,
      px: (((i * 37) % 9) - 4) * 1.3,
      py: (((i * 53) % 7) - 3) * 1.2,
      pr: ((i * 29) % 25) - 12,
    };
  }

  Motion.cena('orbita', {
    render: (c) => {
      const capas = Array.from({ length: N }, (_, i) => {
        const L = lugar(i, N);
        return window.Capas.html(c, i, { classe: i === CAPA_HEROI ? 'capa-heroi' : '', extra: `style="${L.style}" data-i="${i}"` });
      }).join('');
      return `<div class="camada nucleo"></div><div class="camada vazio"></div>${capas}
        <div class="camada fantasmas"></div>
        <div class="pilha orbita-frase"><h2 class="titulo frase">${FRASE}</h2></div>
        <div class="camada vinheta"></div><div class="camada cortina"></div>`;
    },

    montar(el, api) {
      const root = el.raiz;
      const G = api.vertical
        ? { v: true, ...VERT, HERO: HERO_S * VERT.K, PILE: PILE_S * VERT.K, FX: 50, FY: api.H / 2, PX: 1080 / 1920 }
        : G169;
      if (G.v) G.thetaOf = tabelaDoAnel(G);
      const els = [...root.querySelectorAll(':scope > .capa')];
      const n = els.length;
      const covers = els.map((e, i) => {
        const L = lugar(i, n);
        return { el: e, i, a: (2 * Math.PI * i) / n - Math.PI / 2, r: L.r, rankVal: L.rank, px: L.px, py: L.py, pr: L.pr, hero: i === CAPA_HEROI };
      });
      covers.forEach((c) => { c.u = c.i / n; c.qx = c.px * G.POFF; c.qy = c.py * G.POFF; });
      const falling = covers.filter((c) => !c.hero).sort((p, q) => p.rankVal - q.rankVal);
      let land = T.land0;
      falling.forEach((c, k) => {
        c.k = k;
        c.last = k === falling.length - 1;
        c.land = land;
        land += api.lerp(T.gap0, T.gap1, k / (falling.length - 2));
        c.tL = T.burst;
        const s = c.i + 1;
        // vem de fora do quadro, do lado para onde desliza na pilha, com um desvio próprio
        const base = Math.hypot(c.px, c.py) > 0.1 ? Math.atan2(c.py, c.px) : api.rand(s * 2.3) * 2 * Math.PI;
        const ang = base + (api.rand(s * 4.9) - 0.5) * 0.7;
        c.ux = Math.cos(ang);
        c.uy = Math.sin(ang);
        c.spin = (api.rand(s * 3.1) - 0.5) * 34;
        const S0 = G.PILE * (1 + LIFT);
        const rr = ((c.pr + c.spin) * Math.PI) / 180;
        const w = W * S0 * 1.35;
        const h = w * 0.625;
        const hx = (w * Math.abs(Math.cos(rr)) + h * Math.abs(Math.sin(rr))) / 2;
        const hy = (w * Math.abs(Math.sin(rr)) + h * Math.abs(Math.cos(rr))) / 2;
        const dx = Math.abs(c.ux) > 1e-3 ? (G.FX + hx + 1 - Math.sign(c.ux) * c.qx) / Math.abs(c.ux) : 1e9;
        const dy = Math.abs(c.uy) > 1e-3 ? (G.FY + hy + 1 - Math.sign(c.uy) * (c.qy + G.CY)) / Math.abs(c.uy) : 1e9;
        c.dist = Math.min(dx, dy);
        c.wob = Math.sign(c.spin || 1) * 2;
      });
      const hero = covers.find((c) => c.hero);
      hero.land = -Infinity;
      hero.tL = T.burst + T.heroDelay;
      covers.forEach((c) => {
        const s = c.i + 1;
        c.fj = (api.rand(s * 11.9) - 0.5) * 0.08;
        c.flip = (api.rand(s * 13.3) - 0.5) * 30;
        c.P = c.hero ? 0 : c.rankVal / 20;
        c.dep = depthOf(anguloNoAnel(G, c, phi(T.text)));
        c.ring = depthOf(anguloNoAnel(G, c, 0));
        c.sharp = SHARP.includes(c.i);
        const g = document.createElement('span');
        g.className = 'capa-reflexo';
        c.el.appendChild(g);
        c.glint = g;
      });
      [...covers].sort((p, q) => p.P - q.P || p.i - q.i).forEach((c, k) => (c.zp = k + 1));
      [...covers].sort((p, q) => p.ring - q.ring || p.i - q.i).forEach((c, k) => (c.zr = k + 1));
      const ghostLayer = root.querySelector('.fantasmas');
      covers.forEach((c) => {
        const g = c.el.cloneNode(true);
        g.setAttribute('aria-hidden', 'true');
        ghostLayer.appendChild(g);
        c.ghost = g;
        c.ghostGlint = g.querySelector('.capa-reflexo');
      });
      const impacts = falling.map((c) => c.land);
      covers.forEach((c) => { c.hits = impacts.filter((L) => L > c.land); });
      const title = root.querySelector('.frase');
      const words = api.tipo.dividir(title, { por: 'palavra' }).map((p) => p.el);
      el.o = {
        G, covers, hero, ghostLayer, title, words,
        core: root.querySelector('.nucleo'),
        vignette: root.querySelector('.vinheta'),
        copy: root.querySelector('.orbita-frase'),
        voidLayer: root.querySelector('.vazio'),
        black: root.querySelector('.cortina'),
        aurora: words.filter((w) => w.closest('.destaque')),
      };
    },

    quadro(t, el, api) {
      const { clamp, lerp, prog, ease, set } = api;
      const { G, covers, hero, core, vignette, copy, title, words, aurora, voidLayer, black, ghostLayer } = el.o;
      const antCore = ease.inOutCubic(prog(t, T.antic[0], T.antic[1]));

      // Estado de uma capa na pilha no tempo tt.
      function pileState(c, tt) {
        let x, y, r, s, blur, lift;
        if (c.hero) {
          // continua o zoom do bento (cresce 3,5 % e assenta), com um assentamento 0° → −1° → 0°
          const u = Math.max(0, tt) / T.catchPeak;
          const k = u <= 1 ? u * Math.exp(1 - u) : Math.exp(-Math.pow((u - 1) / 2, 2));
          x = 0;
          y = 0;
          r = -1 * k;
          s = G.HERO * (1 + 0.035 * k) * (1 + 0.014 * (1 - Math.exp(-Math.max(0, tt) / 0.6)));
          blur = 0;
          lift = 0;
        } else {
          const tau = tt - c.land;
          if (tau < 0) {
            // queda: a lateral entra rápido e freia sobre a pilha; a altura cai com gravidade
            const u = clamp(1 + tau / T.fall);
            const hgt = 1 - u * u;
            const lat = (1 - u) * (1 - u);
            x = c.qx + c.ux * c.dist * lat;
            y = c.qy + c.uy * c.dist * lat;
            r = c.pr + c.spin * lat;
            s = G.PILE * (1 + LIFT * hgt);
            blur = (0.22 * hgt) / G.PX;
            lift = hgt;
          } else {
            const hb = bounce(tau, c.last ? LAST_BOUNCE : BOUNCE);
            x = c.qx;
            y = c.qy;
            r = c.pr + c.wob * Math.exp(-tau / 0.07) * Math.sin((2 * Math.PI * tau) / 0.1);
            s = G.PILE * (1 + hb);
            blur = 0;
            lift = hb / LIFT;
          }
        }
        // a pilha sente o peso: cada impacto por cima afunda o que está embaixo e devolve
        let sink = 0;
        if (c.hero || tt >= c.land) for (const L of c.hits) sink += SINK.a * impulse(tt - L);
        const ant = anticOf(tt);
        const kap = 1 - 0.08 * ant;
        const rho = (-5 * ant * Math.PI) / 180;
        const kp = (1 - sink) * kap * (1 + CAM * clamp(tt, 0, T.burst));
        const cr = Math.cos(rho), sr = Math.sin(rho);
        return { x: (x * cr - y * sr) * kp, y: (x * sr + y * cr) * kp, r: r + (rho * 180) / Math.PI, s: s * kp, blur, b: 1, lift, near: 0, dep: 0, th: c.a, ms: 1, m: 1 };
      }

      // Depois da explosão: espiral que desemboca na órbita viva (giro + dolly, sem pouso).
      function state(c, tt) {
        if (tt < c.tL) return pileState(c, tt);
        const base = pileState(c, c.tL);
        const tau = launch(tt - c.tL);
        const po = open(tau, K_OPEN * (1 + c.fj));
        const pa = open(tau, K_SWIRL);
        const ps = 1 - (1 + 14 * tau) * Math.exp(-14 * tau);
        const th = anguloNoAnel(G, c, phi(tt) - SWIRL * (1 - pa));
        const dep = depthOf(th);
        const z = dolly(tt);
        const m = magnify(z, nearOf(dep));
        const ms = Math.pow(m, GROW);
        const arc = Math.sin(Math.PI * po);
        const near = NEAR * (c.dep - 0.32) * arc;
        return {
          x: base.x * (1 - po) + G.RX * m * Math.cos(th) * po,
          y: base.y * (1 - po) + G.RY * m * Math.sin(th) * po,
          r: lerp(base.r, c.r * tiltOf(G, th), pa) + c.flip * arc,
          s: lerp(base.s, G.ORB * (0.84 + 0.16 * dep) * profOf(G, th) * ms, ps) * (1 + near),
          blur: 0,
          b: lerp(1, 0.7 + 0.3 * dep, po),
          lift: base.lift * (1 - po) + Math.max(0, near),
          near, dep, th, ms, m,
        };
      }

      const states = covers.map((c) => state(c, t));
      const wz = prog(t, T.burst + T.order[0], T.burst + T.order[1]);
      const xf = smooth(wz);
      const mixing = wz > 0 && wz < 1;
      covers.forEach((c) => { c.zi = wz >= 1 ? c.zr : c.zp; });
      ghostLayer.style.display = mixing ? 'block' : 'none';
      ghostLayer.style.opacity = xf.toFixed(4);
      const shadowK = mixing ? 1 - xf : 1;
      const GW = 0.42;
      const gTrip = (2 * Math.PI + 2 * GW) * ease.inOutSine(prog(t, T.glint[0], T.glint[1]));
      const gLive = t > T.glint[0] && t < T.glint[1];
      const exitness = ease.inOutSine(prog(t, 3.1, 3.6));
      const tail = 1 - ease.inOutSine(prog(t, 3.8, 3.93));

      covers.forEach((c, j) => {
        const now = states[j];
        const was = state(c, t - DT);
        // em pé, velocidade e desfoque em pixels equivalentes aos do 16:9 (G.PX = 1 no 16:9)
        const vx = ((now.x - was.x) / DT) * G.PX, vy = ((now.y - was.y) / DT) * G.PX;
        const vs = (Math.abs(now.s - was.s) / DT) * G.PX;
        const vxy = Math.hypot(vx, vy);
        const speed = vxy + vs * 5.25;
        const calm = c.sharp && exitness < 0.5 ? 0.5 : 1;
        const st = Math.min(0.35, Math.max(0, vxy - 60) * 0.001) * calm;
        const burstBlur = c.sharp && exitness < 0.5 ? 0 : Math.min(0.22, Math.max(0, speed - 215) * 0.003);
        const mb = Math.max(burstBlur, exitness * Math.min(0.45, vxy * 0.0018));
        const dof = (c.sharp && exitness < 0.5 ? 0 : Math.max(0, now.near - 0.08) * 0.9) + Math.min(0.6, Math.max(0, now.ms - 2) * 0.16);
        const dir = Math.atan2(vy, vx) * (180 / Math.PI);
        let gpos = wrap(c.a - hero.a);
        if (gpos < 0) gpos += 2 * Math.PI;
        const gb = (gTrip - gpos) / GW - 1;
        const band = clamp(gb, -1, 1);
        const gsign = -Math.sin(now.th) >= 0 ? 1 : -1;
        const gon = gLive && gb > -1 && gb < 1 ? 1 : 0;
        const S = now.s;
        const lift = now.lift;
        const shadow = (k) => `0 ${((0.52 + 1.7 * lift) * S).toFixed(3)}cqw ${((1.25 + 3.2 * lift) * S).toFixed(3)}cqw color-mix(in srgb, var(--fundo) ${((20 + 16 * clamp(lift)) * k).toFixed(1)}%, transparent)`;
        // motion blur fingido: estiramento na direção do movimento
        const pre = `translate(-50%,-50%) translate(${now.x.toFixed(4)}cqw, ${(now.y + G.CY).toFixed(4)}cqw)`
          + (st > 0.002 ? ` rotate(${dir.toFixed(2)}deg) scale(${(1 + st).toFixed(4)}, ${(1 - st * 0.3).toFixed(4)}) rotate(${(-dir).toFixed(2)}deg)` : '');
        // Tamanho pela largura, não por scale(): a capa é rasterizada no tamanho em que aparece.
        set(c.el, {
          pre,
          r: now.r,
          o: Math.min(1 - smooth(prog(now.m, 3.2, 4.5)), tail),
          style: {
            zIndex: String(c.zi),
            width: `calc(var(--orb-capa) * ${S.toFixed(4)})`,
            borderRadius: `calc(var(--raio-capa) * ${S.toFixed(4)})`,
            boxShadow: shadow(shadowK),
            filter: filterOf(now.blur + (mb + dof) / G.PX, now.b * (1 + 0.12 * gon * (1 - band * band))),
          },
        });
        set(c.glint, { o: gon, style: { backgroundPosition: `${(50 - 50 * band * gsign).toFixed(2)}% 0%` } });
        if (mixing) {
          c.ghost.style.cssText = c.el.style.cssText;
          c.ghost.style.zIndex = String(c.zr);
          c.ghost.style.boxShadow = shadow(1);
          c.ghostGlint.style.cssText = c.glint.style.cssText;
        }
      });

      // O fundo afunda no preto por baixo das capas; a vinheta sai junto.
      const vp = ease.inOutSine(prog(t, T.void[0], T.void[1]));
      set(voidLayer, { o: vp });
      set(vignette, { o: 1 - vp });

      // Atmosfera do centro: respira, recolhe com a pilha que prende o ar, pulsa na explosão e cresce
      // com o dolly (fica atrás do anel).
      const tb = t - T.burst;
      const pulse = tb > 0 ? (tb / 0.14) * Math.exp(1 - tb / 0.14) : 0;
      const coreGrow = magnify(dolly(Math.max(t, T.burst)) - dolly(T.burst), 0.45);
      set(core, {
        pre: '',
        y: G.CY,
        s: (1 + 0.015 * Math.sin((t - T_REF) * 2.4)) * (1 - 0.06 * antCore + 0.1 * pulse) * coreGrow,
        o: 0.95 + 0.05 * Math.cos((2 * Math.PI * (t - T_REF)) / 3.2),
      });

      // Frase: palavra por palavra, do desfoque; mais longe que o anel (push-in sutil); no fim
      // atravessa a câmera: cresce, desfoca e some.
      words.forEach((wd, i) => {
        const t0 = T.text + i * T.wordGap;
        const e = ease.forte(prog(t, t0, t0 + 0.7));
        const eo = ease.outCubic(prog(t, t0, t0 + 0.38));
        set(wd, { pre: '', y: 1.5 * (1 - e), o: eo, blur: 0.6 * (1 - e) });
      });
      const xo = ease.inCubic(prog(t, T.textOut[0], T.textOut[1]));
      const push = t > T.burst ? magnify(dolly(t), TEXT_K) : magnify(dolly(T.burst), TEXT_K);
      set(copy, { pre: '', y: G.CY, s: push * (1 + 0.45 * xo), o: 1 });
      // Vida no hold: o degradê escorre devagar pela linha (senoide longa).
      api.tipo.escorrerDestaque(t, aurora, { sobra: AURORA.e, periodo: AURORA.period, ref: T_REF, amp: 0.45 });
      set(title, { pre: '', o: 1 - xo, blur: 0.9 * xo });
      set(black, { o: ease.inOutSine(prog(t, T.black[0], T.black[1])) });
    },
  });
})();
