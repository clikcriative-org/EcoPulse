/* tempo.js — tempo e curvas do motor (sem DOM).
   Tudo aqui é função pura: o mesmo t dá sempre o mesmo número, em qualquer ordem.
   Unidades: segundos para tempo; o resto é adimensional (0..1) salvo quando dito. */
(function (G) {
  'use strict';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  /** 0..1: quanto de [a, b] já passou em t. */
  const prog = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

  /** Curva cúbica de Bézier igual à do CSS (Newton + bisseção). */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-7) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }

  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inQuart: (t) => t * t * t * t,
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inQuint: (t) => t * t * t * t * t,
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutExpo: (t) =>
      t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    /** Só para objeto: passa do ponto e volta. Texto de leitura nunca usa. */
    outBack: (s = 1.70158) => (t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    /** Curva forte de entrada: entra rápido e assenta devagar. A padrão do método. */
    forte: bezier(0.16, 1, 0.3, 1),
    /** Abertura simétrica (algo que se abre pelo centro). */
    simetrica: bezier(0.45, 0, 0.55, 1),
    /** Resposta de interface (mockups, telas). */
    ui: bezier(0.23, 1, 0.32, 1),
    /** Mergulho de câmera: chega ainda com embalo. */
    mergulho: bezier(0.45, 0, 0.6, 0.85),
    bezier,
  };

  /** Mola amortecida 0 → 1 com passagem do ponto. t em segundos desde o início. Só objeto. */
  function spring(t, { freq = 1.8, damp = 7 } = {}) {
    if (t <= 0) return 0;
    return 1 - Math.exp(-damp * t) * Math.cos(freq * 2 * Math.PI * t);
  }

  /** Interpola de → para em [t0, t1] com uma curva (padrão: forte). */
  const tw = (t, t0, t1, de, para, curva = ease.forte) => lerp(de, para, curva(prog(t, t0, t1)));

  /** Seno de período fixo. Para loop, use períodos que dividem a duração. */
  const wave = (t, periodo = 1, fase = 0) => Math.sin(2 * Math.PI * (t / periodo + fase));

  /** Pseudo-aleatório determinístico: mesma semente, mesmo número (0..1). */
  function rand(semente) {
    let h = Math.floor(Number(semente) * 1000003) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** Oscilação a partir do repouso com velocidade inicial v (o "anel" depois de um impacto). */
  function mola(tau, v = 1, { freq = 2.4, amort = 6 } = {}) {
    if (tau <= 0) return 0;
    const w = 2 * Math.PI * freq;
    return (v * Math.exp(-amort * tau) * Math.sin(w * tau)) / w;
  }

  /** Hermite cúbica: sai de p0 com velocidade v0 e chega em p1 com velocidade v1 (por segundo). */
  function hermite(t, t0, t1, p0, v0, p1, v1) {
    const d = t1 - t0 || 1e-9;
    const u = clamp((t - t0) / d);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 * d + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * v1 * d;
  }

  /** Rampas sem "ligar": smoothstep e smootherstep. */
  const suave = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const suave5 = (x) => { x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10); };

  /** Sino gaussiano em torno do centro. */
  const sino = (x, centro = 0, largura = 1) => Math.exp(-0.5 * Math.pow((x - centro) / (largura || 1e-9), 2));

  /** Pulso que sai e volta: sin²(πu) em [0, 1]. */
  const pulso = (u) => (u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 2));
  /** Pulso sem quique: sai e volta com velocidade e aceleração zero; pico 1 em u = tau. */
  const pulsoSemQuique = (u, tau = 0.35) => (u <= 0 ? 0 : Math.pow(u / tau, 3) * Math.exp(3 * (1 - u / tau)));

  /** Deriva que nunca para: velocidade sobe em S de 0 a 1 em `rampa` s e fica constante.
      Devolve o deslocamento em "segundos de deriva": multiplique pela velocidade. */
  function deriva(t, inicio = 0, rampa = 0.6) {
    if (t <= inicio) return 0;
    const R = Math.max(1e-6, rampa);
    const x = (t - inicio) / R;
    return x < 1 ? R * x * x * x * x * (x * (x - 3) + 2.5) : R * 0.5 + (t - inicio - R);
  }

  /** Vida no hold: onda que nasce em smootherstep (sem começo nem fim visíveis). Com `ref`, a onda
      passa por zero em t = ref (o quadro aprovado fica igual ao CSS); `fase` desloca a partir dali.
      Na cena, `api.vida` já usa o ref da cena. */
  function vida(t, { inicio = 0, rampa = 0.6, periodo = 3, amp = 1, fase = 0, ref = 0 } = {}) {
    return amp * suave5(prog(t, inicio, inicio + rampa)) * Math.sin(2 * Math.PI * ((t - ref) / periodo + fase));
  }

  /** Ruído suave 1D determinístico (−1..1) para derivas orgânicas. */
  function ruido(t, semente = 1, { freq = 0.5 } = {}) {
    const x = t * freq;
    const i = Math.floor(x);
    const f = x - i;
    const a = rand(semente * 7.31 + i * 1.0007);
    const b = rand(semente * 7.31 + (i + 1) * 1.0007);
    return lerp(a, b, suave5(f)) * 2 - 1;
  }

  /** Interpolação em log (escala, zoom, mergulho): a velocidade percebida fica constante. */
  const logLerp = (a, b, k) => Math.exp(lerp(Math.log(Math.max(1e-9, a)), Math.log(Math.max(1e-9, b)), k));

  /** Saída que acelera e chega ao máximo de velocidade no último quadro (0..1). */
  function acelerar(t, t0, t1, K = 2.2) {
    const e = prog(t, t0, t1);
    return (Math.pow(2, K * e) - 1) / (Math.pow(2, K) - 1);
  }

  /** Integra um perfil de velocidade e normaliza: devolve pos(t) 0..1 em [t0, t1].
      `pouso` (0..1): da fração dada em diante a velocidade vira uma quártica em que velocidade e
      desaceleração chegam juntas a zero, cobrindo a mesma distância (nada de freada no último quadro).
      Calcule no `montar` e guarde a função. */
  function trajeto(velocidade, t0, t1, { amostras = 2400, pouso = null } = {}) {
    const N = Math.max(16, amostras | 0);
    const L = t1 - t0 || 1e-9;
    let v = (u) => Math.max(0, velocidade(t0 + u * L));
    if (pouso != null && pouso > 0 && pouso < 1) {
      const base = v;
      const LW = 1 - pouso;
      const h = 1e-3;
      const c0 = base(pouso);
      const c1 = ((base(pouso + h) - base(pouso - h)) / (2 * h)) * LW;
      let medio = 0;
      for (let i = 0; i < 2000; i++) medio += base(pouso + (LW * (i + 0.5)) / 2000) / 2000;
      const p = -c0 - c1, q = -c1, r = medio - c0 - c1 / 2;
      const c4 = (5 * q - 30 * p + 60 * r) / 2, c3 = q - 2 * p - 2 * c4, c2 = p - c3 - c4;
      v = (u) => {
        if (u <= pouso) return base(u);
        const x = (u - pouso) / LW;
        return Math.max(0, c0 + x * (c1 + x * (c2 + x * (c3 + x * c4))));
      };
    }
    const acum = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) acum[i] = acum[i - 1] + v((i - 0.5) / N);
    const total = acum[N] || 1;
    return (t) => {
      const x = clamp((t - t0) / L) * N;
      const i = Math.min(N - 1, Math.floor(x));
      return (acum[i] + (acum[i + 1] - acum[i]) * (x - i)) / total;
    };
  }

  G.MotionTempo = {
    clamp, lerp, prog, bezier, ease, spring, tw, wave, rand, mola, hermite, suave, suave5, sino,
    pulso, pulsoSemQuique, deriva, vida, ruido, logLerp, acelerar, trajeto,
  };
})(typeof window !== 'undefined' ? window : globalThis);
