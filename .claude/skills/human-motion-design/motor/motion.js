/* motion.js — o núcleo do motor no navegador.

   Contratos (valem para toda cena):
   1. Cada quadro é função pura de t: `quadro(t, el, api)` define toda propriedade animada em toda
      chamada e pode ser chamado fora de ordem, por vários navegadores ao mesmo tempo.
   2. O CSS natural da cena é o quadro final aprovado. Animar é ir até ele com estilos inline.
   3. Transição é do motor: ele é dono dos invólucros `.m-cena` e `.m-camera`; a cena mexe só do
      `.m-conteudo` para dentro.
   4. Tudo local e determinístico: fontes embutidas, mídia local, Math.random semeado por quadro,
      relógio virtual na captura.

   O filme montado define window.MOTION_LINHA (linha do tempo calculada no Node), MOTION_FONTES,
   MOTION_MIDIA, MOTION_SVG e MOTION_IMAGENS antes de carregar este arquivo. */
(function () {
  'use strict';
  const TT = window.MotionTempo;
  const { clamp, prog } = TT;
  const EPS = 1e-6;

  const FORMATOS = {
    '16x9': { largura: 1920, altura: 1080, seguro: { x: 0.05, topo: 0.05, base: 0.05 } },
    '9x16': { largura: 1080, altura: 1920, seguro: { x: 0.07, topo: 0.12, base: 0.2 } },
  };

  const ESTILO_PADRAO = {
    curvaEntrada: [0.16, 1, 0.3, 1],
    cascataLetra: 0.026, // s entre letras
    cascataPalavra: 0.045, // s entre palavras
    entrada: 0.6, // s de cada unidade do desfoque para o foco
    opacidade: 0.18, // s da opacidade de cada unidade
    subida: 0.18, // em (fração do corpo da letra)
    desfoque: 0.14, // em
    saida: 0.25, // s
    camera: 0.012, // push-in por segundo (escala)
  };

  const params = new URLSearchParams(location.search);
  const CAPTURA = params.has('captura');
  if (CAPTURA) document.documentElement.classList.add('m-captura');

  /* ─── erros ─── */
  const erros = [];
  function erro(cena, fase, t, e) {
    const mensagem = String((e && (e.stack || e.message)) || e).split('\n').slice(0, 3).join(' | ');
    const item = { cena: cena || null, fase, t: Number.isFinite(t) ? Math.round(t * 1000) / 1000 : null, mensagem };
    if (erros.length < 200 && !erros.some((x) => x.cena === item.cena && x.fase === item.fase && x.mensagem === item.mensagem)) erros.push(item);
    if (!CAPTURA) mostrarErros();
  }
  window.addEventListener('error', (ev) => {
    const arq = String(ev.filename || '');
    const m = /cenas\/([^/?#]+)\.js/.exec(arq);
    erro(m ? m[1].split('@')[0] : null, m ? 'arquivo' : 'motor', null, `${ev.message} (${arq.split('/').pop()}:${ev.lineno})`);
  });
  window.addEventListener('unhandledrejection', (ev) => erro(null, 'motor', null, ev.reason));

  /* ─── determinismo ─── */
  let semente = 1;
  function semear(s) {
    semente = (s >>> 0) || 1;
  }
  Math.random = function () {
    semente = (semente + 0x6d2b79f5) | 0;
    let x = semente;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const hashNum = (a, b) => {
    let h = Math.floor(a * 1e6) ^ Math.imul(b + 1, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  };
  let tempoVirtual = 0;
  if (CAPTURA) {
    let avisou = false;
    const virtual = () => {
      if (!avisou) {
        avisou = true;
        erro(null, 'aviso', null, 'uma cena leu o relógio (Date.now/performance.now); na captura ele segue a linha do tempo. Use t.');
      }
      return tempoVirtual * 1000;
    };
    Date.now = virtual;
    try {
      performance.now = virtual;
    } catch (_) {
      /* alguns navegadores não deixam */
    }
  }

  /* ─── set: o único jeito de animar estilo ─── */
  const n4 = (v) => (Math.round(v * 1e4) / 1e4).toString();
  const n6 = (v) => (Math.round(v * 1e6) / 1e6).toString();
  const temTransform = (p) =>
    'x' in p || 'y' in p || 'z' in p || 'r' in p || 'rx' in p || 'ry' in p || 's' in p || 'sx' in p || 'sy' in p ||
    'pre' in p || 'post' in p || 'persp' in p || 'subpixel' in p;

  function baseDe(el) {
    if (el.__mBase !== undefined) return el.__mBase;
    let b = '';
    if (!el.style.transform) {
      const cs = getComputedStyle(el).transform;
      if (cs && cs !== 'none') b = cs;
    }
    el.__mBase = b;
    return b;
  }

  function criarSet(pxPorCqw) {
    function set(el, p = {}) {
      if (!el) return;
      if (Array.isArray(el) || el instanceof NodeList) {
        for (const e of el) set(e && e.el ? e.el : e, p);
        return;
      }
      if (el.el && !el.style) el = el.el;
      const u = p.px ? 'px' : 'cqw';
      if (temTransform(p)) {
        const tf = [];
        const pre = p.pre !== undefined ? p.pre : baseDe(el);
        if (pre) tf.push(pre);
        if (p.persp) tf.push(`perspective(${n4(p.persp)}${u})`);
        if (p.x || p.y) tf.push(`translate(${n4(p.x || 0)}${u}, ${n4(p.y || 0)}${u})`);
        if (p.z) tf.push(`translateZ(${n4(p.z)}${u})`);
        if (p.rx) tf.push(`rotateX(${n4(p.rx)}deg)`);
        if (p.ry) tf.push(`rotateY(${n4(p.ry)}deg)`);
        if (p.r) tf.push(`rotate(${n4(p.r)}deg)`);
        if (p.subpixel) tf.push('rotate(0.025deg)');
        let s = p.s;
        if (p.semEstalo && (s === undefined || Math.abs(s - 1) < 1e-5) && !p.x && !p.y && !p.r) s = 0.99995;
        if (s !== undefined && Math.abs(s - 1) > 5e-7) tf.push(`scale(${n6(s)})`);
        if ((p.sx !== undefined || p.sy !== undefined) && (Math.abs((p.sx ?? 1) - 1) > 5e-7 || Math.abs((p.sy ?? 1) - 1) > 5e-7)) tf.push(`scale(${n6(p.sx ?? 1)}, ${n6(p.sy ?? 1)})`);
        if (p.post) tf.push(p.post);
        el.style.transform = tf.length ? tf.join(' ') : 'none';
      }
      if (p.origem !== undefined) el.style.transformOrigin = p.origem;
      if (p.o !== undefined) el.style.opacity = n4(clamp(p.o));
      if ('blur' in p || 'bright' in p || 'filter' in p || 'sat' in p || 'contraste' in p) {
        const f = [];
        if ('blur' in p) {
          const px = p.px ? p.blur : p.blur * pxPorCqw;
          const passo = Math.round(Math.max(0, px) * 20) / 20;
          if (passo >= 0.1) f.push(`blur(${passo}px)`);
          else if (el.__mFiltroFixo) f.push('blur(0px)');
        }
        if (p.bright !== undefined && Math.abs(p.bright - 1) > 1e-4) f.push(`brightness(${n4(p.bright)})`);
        if (p.sat !== undefined && Math.abs(p.sat - 1) > 1e-4) f.push(`saturate(${n4(p.sat)})`);
        if (p.contraste !== undefined && Math.abs(p.contraste - 1) > 1e-4) f.push(`contrast(${n4(p.contraste)})`);
        if (p.filter) f.push(p.filter);
        el.style.filter = f.length ? f.join(' ') : el.__mFiltroFixo ? 'blur(0px)' : 'none';
      }
      if (p.ls !== undefined) el.style.letterSpacing = `${n4(p.ls)}em`;
      if (p.clip !== undefined) el.style.clipPath = p.clip;
      if (p.mask !== undefined) {
        el.style.webkitMaskImage = p.mask;
        el.style.maskImage = p.mask;
      }
      if (p.mix !== undefined) el.style.mixBlendMode = p.mix;
      if (p.style) Object.assign(el.style, p.style);
      if (p.vars) for (const k in p.vars) el.style.setProperty(k, String(p.vars[k]));
    }
    return set;
  }

  /* ─── caixas em cqw, a partir do centro do quadro ─── */
  function caixaLayout(el, palco, larguraPalco) {
    // Sem transformações: soma offsets até o palco (puro: não depende do quadro anterior).
    const u = larguraPalco / 100;
    if (!(el instanceof HTMLElement)) return caixaTela(el, palco);
    let x = 0, y = 0, n = el;
    while (n && n !== palco) {
      x += n.offsetLeft || 0;
      y += n.offsetTop || 0;
      const pai = n.offsetParent;
      if (!pai) break;
      n = pai;
    }
    const W = palco.offsetWidth, H = palco.offsetHeight;
    const l = el.offsetWidth / u, a = el.offsetHeight / u;
    const xx = x / u - 50, yy = y / u - (H / W) * 50;
    return { x: xx, y: yy, l, a, cx: xx + l / 2, cy: yy + a / 2 };
  }
  function caixaTela(el, palco) {
    const P = palco.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const u = P.width / 100;
    const xx = (r.left - P.left) / u - 50, yy = (r.top - P.top) / u - (P.height / P.width) * 50;
    return { x: xx, y: yy, l: r.width / u, a: r.height / u, cx: xx + r.width / u / 2, cy: yy + r.height / u / 2 };
  }

  /* ─── o objeto global ─── */
  const Motion = {
    versao: '1.0.0',
    tempo: TT,
    FORMATOS,
    ESTILO_PADRAO,
    captura: CAPTURA,
    cenas: {},
    transicoes: {},
    extensoes: [],
    extensoesC: [],
    cenaR: [],
    linha: null,
    palco: null,
    pronto: false,
    erro,
    semear,
    /** Registra uma cena: { render(c), poses, montar(el, api), quadro(t, el, api) }. */
    cena(id, def) {
      if (this.cenas[id]) erro(id, 'registro', null, `a cena "${id}" foi registrada duas vezes`);
      this.cenas[id] = def || {};
    },
    /** Registra uma transição: { modo, dur, antes, depois, preparar(A,B,op,api), aplicar(e,A,B,op,api) }. */
    transicao(nome, def) {
      this.transicoes[nome] = def;
    },
    /** Acrescenta coisas ao api de cada cena: fn(api, ctx). */
    estender(fn) {
      this.extensoes.push(fn);
    },
    /** Acrescenta coisas ao `c` do render: fn(c, ctx). */
    estenderC(fn) {
      this.extensoesC.push(fn);
    },
    caixaTela: (el) => caixaTela(el, Motion.palco),
  };
  window.Motion = Motion;

  /* ─── camadas do motor (véu, luz) por cima de todas as cenas ─── */
  const camadas = {};
  function camada(nome) {
    if (!camadas[nome]) {
      const d = document.createElement('div');
      d.className = `m-sobre m-sobre-${nome}`;
      d.style.display = 'none';
      Motion.palco.appendChild(d);
      camadas[nome] = d;
    }
    const d = camadas[nome];
    d.__usada = true;
    return d;
  }
  function zerarCamadas() {
    for (const k in camadas) {
      const d = camadas[k];
      if (d.__usada || d.style.display !== 'none') d.style.cssText = 'display:none';
      d.__usada = false;
    }
  }
  Motion.camada = camada;

  /* ─── invólucros ─── */
  function zerarInvolucros(R) {
    R.secao.style.cssText = `z-index:${10 + R.indice}`;
    R.camera.style.cssText = '';
  }
  /** Posição da câmera do motor (transições): p → s·p + (x, y), origem no centro do quadro. */
  function posarCamera(R, { s = 1, x = 0, y = 0, r = 0 } = {}) {
    const tf = [];
    if (x || y) tf.push(`translate(${n4(x)}cqw, ${n4(y)}cqw)`);
    if (r) tf.push(`rotate(${n4(r)}deg)`);
    if (Math.abs(s - 1) > 1e-7) tf.push(`scale(${n6(s)})`);
    R.camera.style.transform = tf.join(' ');
  }
  /* estilo da cena inteira (o .m-cena, com o fundo) e, com `brilho` / `oConteudo`, só do conteúdo
     (o .m-camera: o fundo da cena não clareia nem some junto). */
  function estilizarCena(R, { o, blur, bright, clip, mask, z, mix, filtro, x, y, brilho, oConteudo } = {}) {
    const st = R.secao.style;
    if (brilho !== undefined || oConteudo !== undefined) {
      const cs = R.camera.style;
      if (brilho !== undefined && Math.abs(brilho - 1) > 1e-4) {
        const atual = cs.filter && cs.filter !== 'none' ? cs.filter.replace(/brightness\([^)]*\)/g, '').trim() : '';
        cs.filter = `${atual} brightness(${n4(brilho)})`.trim();
      }
      if (oConteudo !== undefined) cs.opacity = n4(clamp(oConteudo));
    }
    if (o !== undefined) st.opacity = n4(clamp(o));
    // mover a cena inteira (com o fundo): empurrões e chicotes
    if (x || y) st.transform = `translate(${n4(x || 0)}cqw, ${n4(y || 0)}cqw)`;
    const f = [];
    if (blur) {
      const px = Math.round(blur * R.api.pxPorCqw * 20) / 20;
      if (px >= 0.1) f.push(`blur(${px}px)`);
    }
    if (bright !== undefined && Math.abs(bright - 1) > 1e-4) f.push(`brightness(${n4(bright)})`);
    if (filtro) f.push(filtro);
    if (f.length) st.filter = f.join(' ');
    if (clip !== undefined) st.clipPath = clip;
    if (mask !== undefined) {
      st.webkitMaskImage = mask;
      st.maskImage = mask;
    }
    if (mix !== undefined) st.mixBlendMode = mix;
    if (z !== undefined) st.zIndex = String(z);
  }

  /* ─── montagem ─── */
  function criarC(R, ctx) {
    const f = ctx.formato;
    const c = {
      formato: ctx.nomeFormato,
      vertical: ctx.vertical,
      largura: f.largura,
      altura: f.altura,
      k: ctx.k,
      cena: R.id,
      esc: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      porFormato: (obj) => (obj && (obj[ctx.nomeFormato] ?? obj.padrao)),
    };
    for (const fn of Motion.extensoesC) fn(c, ctx, R);
    return c;
  }

  function criarApi(R, ctx) {
    const L = ctx.linha;
    const f = ctx.formato;
    const pxPorCqw = f.largura / 100;
    const H = (f.altura / f.largura) * 100;
    const estilo = Object.assign({}, ESTILO_PADRAO, L.estilo || {});
    const batida = 60 / (L.bpm || 120);
    const umQuadro = 1 / (L.fps || 60);
    const quadros = R.quadros || [];
    // o quadro aprovado: o marcado com "aprovado": true, senão o último quadro-chave
    const qAprovado = quadros.find((q) => q.aprovado) || quadros[quadros.length - 1];
    const ref = qAprovado ? qAprovado.t : Math.max(0, R.dur - umQuadro);
    const api = Object.assign({}, TT);
    Object.assign(api, {
      bpm: L.bpm || 120,
      batida,
      b: (n) => n * batida,
      fps: L.fps || 60,
      umQuadro,
      dur: R.dur,
      ultimo: Math.max(0, R.dur - umQuadro),
      ref,
      formato: ctx.nomeFormato,
      vertical: ctx.vertical,
      largura: f.largura,
      altura: f.altura,
      H,
      k: ctx.k,
      pxPorCqw,
      seguro: { x: f.seguro.x * 100, topo: f.seguro.topo * H, base: f.seguro.base * H },
      porFormato: (obj) => (obj && (obj[ctx.nomeFormato] ?? obj.padrao)),
      estilo,
      set: criarSet(pxPorCqw),
      base: (el, transform) => {
        if (el) el.__mBase = transform || '';
      },
      $: (s) => R.conteudo.querySelector(s),
      $$: (s) => [...R.conteudo.querySelectorAll(s)],
      caixa: (el) => caixaLayout(typeof el === 'string' ? R.conteudo.querySelector(el) : el, ctx.palco, f.largura),
      caixaNaTela: (el) => caixaTela(typeof el === 'string' ? R.conteudo.querySelector(el) : el, ctx.palco),
      cena: { id: R.id, indice: R.indice, inicio: R.inicio, dur: R.dur, titulo: R.titulo },
      entrada: R.entrada || null,
      saida: R.saida || null,
      cortesInternos: R.cortesInternos || [],
      anterior: { ponte: (nome) => (R.vizinhaAntes && R.vizinhaAntes.pontes.fim[nome]) || null },
      proxima: { ponte: (nome) => (R.vizinhaDepois && R.vizinhaDepois.pontes.inicio[nome]) || null },
      /** Push-in que nunca para e passa por 1,0 no quadro aprovado. */
      viva: (t, { v = estilo.camera, ref: r = ref } = {}) => 1 + v * (t - r),
      /** Quando a entrada começa: se a cena entra por corte (corte, corte-no-eixo, avançar-desfocar,
          na-cena), a entrada começa ANTES do corte (padrão −0,12 s), para o corte cair com a frase
          já entrando e nunca num quadro vazio; senão, `padrao`. */
      inicioEntrada: (padrao = 0.1, antesDoCorte = -0.12) =>
        (R.entrada && R.entrada.modo === 'encadeada' && R.entrada.tipo !== 'flash' ? antesDoCorte : padrao),
      /** Vida no hold: onda que nasce sem degrau e passa por zero no quadro aprovado (ref). */
      vida: (t, o = {}) => TT.vida(t, Object.assign({ ref }, o)),
      /** O BPM na tela: a batida mais recente desde `de` (a cada `cada` batidas). Devolve { k, v }:
          k = o número da batida (−1 antes de `de`), v = pulso sem quique 0 → 1 → 0, pico em `ataque` s.
          Ex.: no hold, um item por batida dá um pulso: s *= 1 + 0.03 * (nb.k % n === i ? nb.v : 0). */
      naBatida: (t, { de = 0, cada = 1, ataque = 0.1 } = {}) => {
        if (t < de) return { k: -1, v: 0 };
        const per = cada * batida;
        const k = Math.floor((t - de) / per + 1e-9);
        return { k, v: TT.pulsoSemQuique(t - de - k * per, ataque) };
      },
      /** Tremor de impacto (só objeto/câmera, nunca leitura). Devolve { x, y, giro } em cqw e graus. */
      tremor: (t, t0, { forca = 0.4, freq = 9, amortecimento = 6, semente: sm = 1 } = {}) => {
        const tau = t - t0;
        if (tau <= 0) return { x: 0, y: 0, giro: 0 };
        const env = Math.exp(-amortecimento * tau) * forca;
        return {
          x: env * Math.sin(2 * Math.PI * freq * tau + TT.rand(sm) * 6.28),
          y: env * Math.sin(2 * Math.PI * freq * 1.13 * tau + TT.rand(sm + 1) * 6.28),
          giro: env * 0.6 * Math.sin(2 * Math.PI * freq * 0.87 * tau + TT.rand(sm + 2) * 6.28),
        };
      },
      camada: (nome) => camada(`${R.id}-${nome}`),
    });
    for (const fn of Motion.extensoes) {
      try {
        fn(api, Object.assign({ R }, ctx));
      } catch (e) {
        erro(R.id, 'motor', null, e);
      }
    }
    return api;
  }

  function lado(R) {
    if (!R) return null;
    return {
      id: R.id,
      R,
      cena: R.secao,
      camera: R.camera,
      conteudo: R.conteudo,
      get t() {
        return R.tLocal;
      },
      get ativa() {
        return R.ativa;
      },
      dur: R.dur,
      $: (s) => R.conteudo.querySelector(s),
      pontes: R.pontes,
      api: R.api,
      /** Caixa de um elemento medida no começo ('inicio') ou no fim ('fim') da cena. */
      medida: (sel, quando = 'fim') => (R.medidas[`${quando}|${sel}`] || null),
      posar: (p) => posarCamera(R, p),
      estilo: (p) => estilizarCena(R, p),
    };
  }

  function medirPontes(R, palco) {
    const out = {};
    R.secao.querySelectorAll('[data-ponte]').forEach((el) => {
      const b = caixaTela(el, palco);
      const cs = getComputedStyle(el);
      b.o = parseFloat(cs.opacity);
      b.raio = parseFloat(cs.borderTopLeftRadius) / (palco.getBoundingClientRect().width / 100) || 0;
      out[el.dataset.ponte] = b;
    });
    return out;
  }

  function quadroDaCena(R, tl, tGlobal, pend) {
    semear(hashNum(tGlobal, R.indice));
    tempoVirtual = tGlobal;
    R.tLocal = tl;
    if (R.def.quadro) {
      try {
        R.def.quadro(tl, R.el, R.api);
      } catch (e) {
        erro(R.id, 'quadro', tl, e);
      }
    }
    // Animações CSS (@keyframes) seguem o tempo local: pausadas e posicionadas.
    // (uma cena que volta de display:none recria as animações, então busca a cada quadro)
    if (R.secao.getAnimations) {
      const anims = R.secao.getAnimations({ subtree: true });
      for (const a of anims) {
        try {
          a.pause();
          a.currentTime = tl * 1000;
        } catch (_) {
          /* animação sem tempo */
        }
      }
    }
    if (Motion.midiaNoQuadro) Motion.midiaNoQuadro(R, tl, pend);
  }

  function aplicarTransicao(X, t) {
    const def = Motion.transicoes[X.tipo];
    if (!def || !def.aplicar) return;
    if (t < X.inicio - EPS || t > X.fim + EPS) return;
    const A = Motion.cenaPorId[X.de];
    const B = X.para ? Motion.cenaPorId[X.para] : null;
    const e = { t, tipo: X.tipo };
    if (X.modo === 'sobreposta') {
      e.p = prog(t, X.inicio, X.fim);
      e.lado = 'ambos';
    } else {
      if (t < X.corte - EPS) {
        if (!A.ativa) return;
        e.lado = 'A';
        e.pA = X.antes > 0 ? prog(t, X.corte - X.antes, X.corte) : 1;
      } else {
        if (!B || !B.ativa) return;
        if (t >= X.fim - EPS && X.depois > 0) return;
        e.lado = 'B';
        e.pB = X.depois > 0 ? prog(t, X.corte, X.corte + X.depois) : 1;
      }
      e.p = e.lado === 'A' ? e.pA * 0.5 : 0.5 + e.pB * 0.5;
    }
    try {
      def.aplicar(e, A.lado, B ? B.lado : null, X.opcoes || {}, X.cache || {});
    } catch (err) {
      erro(X.de, 'transicao', t, err);
    }
  }

  /* ─── camada de plano cheio sem sobra ───
     A câmera viva passa por escala < 1 antes do quadro aprovado: uma camada que cobre o quadro
     exatamente (inset: 0) mostra a borda. Medido no montar, com todas as cenas visíveis. */
  function pintaAlgo(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'svg') return true;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
    const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (p.length < 4 || p[3] > 0.02) return true;
    }
    return false;
  }
  function conferirSangria() {
    const P = Motion.palco.getBoundingClientRect();
    const tol = 0.004 * P.width;
    for (const R of Motion.cenaR) {
      const alvos = R.__alvosCamera || [];
      if (!alvos.length) continue;
      const achados = [];
      for (const el of R.conteudo.querySelectorAll('*')) {
        const tag = el.tagName.toLowerCase();
        if (!(el instanceof HTMLElement) && tag !== 'svg') continue;
        if (el.closest('.luz, .m-sem-sangria')) continue;
        if (!alvos.some((a) => a === el || a.contains(el))) continue;
        const r = el.getBoundingClientRect();
        if (r.width < P.width - tol || r.height < P.height - tol) continue;
        const sobra = Math.min(r.left > P.left ? -1 : P.left - r.left, r.top > P.top ? -1 : P.top - r.top, r.right - P.right, r.bottom - P.bottom);
        if (sobra > 0.02 * P.width) continue;
        if (!pintaAlgo(el)) continue;
        const nome = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : tag;
        achados.push(nome);
      }
      if (achados.length) {
        erro(R.id, 'aviso', null, `camada de plano cheio sem sobra (${[...new Set(achados)].slice(0, 3).join(', ')}): com a câmera viva a borda dela aparece no quadro. Use a classe "plano" (sangra 6 %) ou um inset negativo.`);
      }
    }
  }

  /* ─── iniciar ─── */
  Motion.iniciar = async function iniciar() {
    const L = window.MOTION_LINHA;
    if (!L) throw new Error('MOTION_LINHA ausente: abra o filme montado pelos scripts da skill.');
    Motion.linha = L;
    const nomeFormato = L.formato || '16x9';
    const formato = FORMATOS[nomeFormato];
    const palco = document.getElementById('palco');
    palco.dataset.formato = nomeFormato;
    palco.style.width = formato.largura + 'px';
    palco.style.height = formato.altura + 'px';
    document.documentElement.dataset.formato = nomeFormato;
    Motion.palco = palco;
    const vertical = formato.altura > formato.largura;
    const ctx = {
      linha: L,
      formato,
      nomeFormato,
      vertical,
      k: vertical ? 1920 / 1080 : 1,
      palco,
      camada,
    };
    Motion.ctx = ctx;

    // 1. invólucros e render de cada cena
    Motion.cenaPorId = {};
    Motion.cenaR = L.cenas.map((info, i) => {
      const def = Motion.cenas[info.id] || {};
      if (!Motion.cenas[info.id]) erro(info.id, 'registro', null, `a cena "${info.id}" não foi registrada (cenas/${info.id}.js chamou Motion.cena?)`);
      const secao = document.createElement('section');
      secao.className = `m-cena cena-${info.id}`;
      secao.dataset.cena = info.id;
      if (info.fundoPuro) secao.classList.add('m-fundo-puro');
      const cam = document.createElement('div');
      cam.className = 'm-camera';
      const conteudo = document.createElement('div');
      conteudo.className = 'm-conteudo';
      cam.appendChild(conteudo);
      secao.appendChild(cam);
      palco.appendChild(secao);
      const R = Object.assign({}, info, {
        indice: i,
        def,
        secao,
        camera: cam,
        conteudo,
        ultima: i === L.cenas.length - 1,
        ativa: false,
        tLocal: 0,
        pontes: { inicio: {}, fim: {} },
        medidas: {},
      });
      R.el = { raiz: conteudo, cena: secao, $: (s) => conteudo.querySelector(s), $$: (s) => [...conteudo.querySelectorAll(s)] };
      Motion.cenaPorId[info.id] = R;
      return R;
    });
    Motion.cenaR.forEach((R, i) => {
      R.vizinhaAntes = Motion.cenaR[i - 1] || null;
      R.vizinhaDepois = Motion.cenaR[i + 1] || null;
      R.api = criarApi(R, ctx);
      R.lado = lado(R);
      if (typeof R.def.render === 'function') {
        try {
          R.conteudo.innerHTML = R.def.render(criarC(R, ctx)) || '';
        } catch (e) {
          erro(R.id, 'render', null, e);
        }
      }
    });

    // 2. fontes (pedidas antes de medir: a fonte só baixa quando algum texto a usa)
    const fontes = window.MOTION_FONTES || [];
    const amostra = (palco.textContent || '').replace(/\s+/g, ' ').slice(0, 400) || 'Aa';
    await Promise.all(
      fontes.map((f) =>
        document.fonts.load(`${f.estilo || 'normal'} ${f.peso || 400} 64px "${f.familia}"`, amostra).catch((e) => erro(null, 'fonte', null, e)),
      ),
    );
    await document.fonts.ready;
    for (const f of fontes) {
      if (!document.fonts.check(`${f.estilo || 'normal'} ${f.peso || 400} 64px "${f.familia}"`, 'Aa')) {
        erro(null, 'fonte', null, `a fonte "${f.familia}" (${f.peso || 400}) não carregou`);
      }
    }

    // 3. imagens decodificadas
    const imgs = [...palco.querySelectorAll('img')];
    const extras = (window.MOTION_IMAGENS || []).map((src) => {
      const im = new Image();
      im.src = src;
      return im;
    });
    await Promise.all([...imgs, ...extras].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));

    // 4. montar (todas visíveis, para medir texto de verdade)
    palco.classList.add('m-medindo');
    const pose = params.get('pose');
    if (Motion.prepararMidia) {
      for (const R of Motion.cenaR) {
        try {
          Motion.prepararMidia(R);
        } catch (e) {
          erro(R.id, 'render', null, e);
        }
      }
    }
    for (const R of Motion.cenaR) {
      if (typeof R.def.montar === 'function') {
        try {
          R.def.montar(R.el, R.api);
        } catch (e) {
          erro(R.id, 'montar', null, e);
        }
      }
    }
    conferirSangria();

    if (pose) {
      // Storyboard antes da animação: só aquela cena, na pose pedida, sem chamar quadro.
      const [id, q] = pose.split(':');
      palco.classList.remove('m-medindo');
      const R = Motion.cenaPorId[id];
      if (!R) erro(id, 'pose', null, `cena "${id}" não existe neste filme`);
      else {
        R.secao.classList.add('m-ativa', `q-${q}`);
        R.ativa = true;
        zerarInvolucros(R);
        const fn = R.def.poses && R.def.poses[q];
        if (fn) {
          try {
            fn(R.el, R.api);
          } catch (e) {
            erro(id, 'pose', null, e);
          }
        }
        if (Motion.midiaNoQuadro) {
          const pend = [];
          const qd = (R.quadros || []).find((x) => x.id === q);
          Motion.midiaNoQuadro(R, qd ? qd.t : 0, pend);
          await Promise.all(pend);
        }
      }
      Motion.pronto = true;
      document.dispatchEvent(new Event('motion-pronto'));
      return;
    }

    // 5. pontes e medidas: quadro(0) e quadro(último) de cada cena
    const pedidas = {};
    for (const X of L.transicoes) {
      const def = Motion.transicoes[X.tipo];
      if (def && def.medir) {
        for (const [quem, sel, quando] of def.medir(X.opcoes || {}, X) || []) {
          const id = quem === 'A' ? X.de : X.para;
          if (!id || !sel) continue;
          (pedidas[id] = pedidas[id] || []).push([sel, quando]);
        }
      }
    }
    for (const R of Motion.cenaR) {
      const pend = [];
      for (const quando of ['inicio', 'fim']) {
        zerarInvolucros(R);
        const tl = quando === 'inicio' ? 0 : R.api.ultimo;
        quadroDaCena(R, tl, R.inicio + tl, pend);
        if (pend.length) await Promise.all(pend.splice(0));
        R.pontes[quando] = medirPontes(R, palco);
        for (const [sel, q] of pedidas[R.id] || []) {
          if (q !== quando) continue;
          const el = R.conteudo.querySelector(sel);
          if (!el) erro(R.id, 'transicao', null, `não achei "${sel}" para a transição`);
          else R.medidas[`${quando}|${sel}`] = caixaTela(el, palco);
        }
      }
    }
    // 6. transições
    for (const X of L.transicoes) {
      const def = Motion.transicoes[X.tipo];
      if (!def) {
        erro(X.de, 'transicao', null, `transição desconhecida: "${X.tipo}"`);
        continue;
      }
      X.cache = {};
      if (def.preparar) {
        try {
          def.preparar(Motion.cenaPorId[X.de].lado, X.para ? Motion.cenaPorId[X.para].lado : null, X.opcoes || {}, X.cache, X);
        } catch (e) {
          erro(X.de, 'transicao', null, e);
        }
      }
    }
    palco.classList.remove('m-medindo');
    for (const R of Motion.cenaR) R.secao.classList.remove('m-ativa');
    const t0 = parseFloat((params.get('t') || '0').replace(',', '.')) || 0;
    const p = Motion.ir(t0);
    if (p) await p;
    Motion.pronto = true;
    document.dispatchEvent(new Event('motion-pronto'));
  };

  /* ─── ir: posiciona o filme em t global ─── */
  /* Na captura, cada quadro invalida a pintura de todo texto do palco com uma sombra transparente
     que muda com t (não desenha nada). Sem isso o Chrome reaproveita o texto gravado enquanto a
     letra estava ampliada/desfocada e o quadro passa a depender da ordem de render (medido: 1 vs 4
     navegadores davam pixels diferentes nas bordas das letras). */
  function invalidarPintura(t) {
    if (CAPTURA && Motion.palco) Motion.palco.style.textShadow = `${(t * 1e-5 + 1e-7).toFixed(9)}px 0 0 transparent`;
  }

  Motion.ir = function ir(t) {
    const L = Motion.linha;
    t = clamp(+t || 0, 0, L.total);
    Motion.t = t;
    invalidarPintura(t);
    const ativas = [];
    for (const R of Motion.cenaR) {
      const on = t >= R.inicio - EPS && (t < R.fim - EPS || (R.ultima && t <= R.fim + EPS));
      if (on !== R.ativa) {
        R.secao.classList.toggle('m-ativa', on);
        R.ativa = on;
      }
      if (on) ativas.push(R);
    }
    zerarCamadas();
    for (const R of ativas) zerarInvolucros(R);
    const pend = [];
    for (const R of ativas) quadroDaCena(R, clamp(t - R.inicio, 0, R.dur), t, pend);
    for (const X of L.transicoes) aplicarTransicao(X, t);
    return pend.length ? Promise.all(pend).then(() => undefined) : undefined;
  };

  /** Uma cena sozinha, no tempo local, sem transição (storyboard e inspeção). */
  Motion.irCena = function irCena(id, tl) {
    const alvo = Motion.cenaPorId[id];
    if (!alvo) throw new Error(`cena "${id}" não existe neste filme`);
    for (const R of Motion.cenaR) {
      const on = R === alvo;
      if (on !== R.ativa) {
        R.secao.classList.toggle('m-ativa', on);
        R.ativa = on;
      }
    }
    zerarCamadas();
    invalidarPintura(alvo.inicio + tl);
    zerarInvolucros(alvo);
    const pend = [];
    quadroDaCena(alvo, clamp(tl, 0, alvo.dur), alvo.inicio + tl, pend);
    return pend.length ? Promise.all(pend).then(() => undefined) : undefined;
  };

  /* ─── erros visíveis na prévia ─── */
  function mostrarErros() {
    let caixa = document.getElementById('m-erros');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.id = 'm-erros';
      document.body.appendChild(caixa);
    }
    caixa.innerHTML = erros
      .slice(0, 8)
      .map((e) => `<div><b>${e.cena || 'motor'}</b> · ${e.fase}${e.t != null ? ` · t=${e.t}` : ''}<br>${String(e.mensagem).replace(/</g, '&lt;')}</div>`)
      .join('');
  }

  /* ─── medir a composição (o diretor automático do storyboard usa) ───
     Tamanho real das letras (cqmin, com a escala da câmera), área do herói, fotos ampliadas demais
     e as caixas de texto com a cor, para conferir contraste sobre foto. Lê o estado atual da cena. */
  function opacidadeEfetiva(el) {
    let o = 1;
    for (let n = el; n && n !== Motion.palco; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity);
    }
    return o;
  }
  function corDoTexto(el) {
    const cs = getComputedStyle(el);
    const fill = cs.webkitTextFillColor || '';
    const solida = (c) => {
      const m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return p.length < 4 || p[3] > 0.05 ? p.slice(0, 3) : null;
    };
    const direta = solida(fill) || solida(cs.color);
    if (direta) return direta;
    // texto com degradê (background-clip: text): a média das cores do degradê
    for (let n = el; n && n !== Motion.palco; n = n.parentElement) {
      const img = getComputedStyle(n).backgroundImage || '';
      const cores = [...img.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(/[\s,/]+/).filter(Boolean).map(Number).slice(0, 3));
      if (cores.length) return [0, 1, 2].map((k) => cores.reduce((s, c) => s + c[k], 0) / cores.length);
    }
    return [255, 255, 255];
  }
  function medirComposicao(id) {
    const R = Motion.cenaPorId[id];
    if (!R) return null;
    const P = Motion.palco.getBoundingClientRect();
    const W = P.width, H = P.height, um = Math.min(W, H) / 100;
    const recorte = (r) => {
      const l = Math.max(r.left, P.left), t = Math.max(r.top, P.top), d = Math.min(r.right, P.right), b = Math.min(r.bottom, P.bottom);
      return d > l && b > t ? { x: l - P.left, y: t - P.top, l: d - l, a: b - t } : null;
    };
    // blocos de texto
    const blocos = new Map();
    const w = document.createTreeWalker(R.conteudo, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement || n.parentElement.closest('svg')) continue;
      const pai = n.parentElement;
      const bloco = pai.closest('h1,h2,h3,h4,h5,p,li,.titulo,.apoio,.frase,[data-texto]') || pai;
      if (!R.conteudo.contains(bloco)) continue;
      const o = opacidadeEfetiva(pai);
      const atual = blocos.get(bloco) || { o: 0, cores: [], n: 0 };
      atual.o = Math.max(atual.o, o);
      if (o > 0.3) atual.cores.push(corDoTexto(pai));
      blocos.set(bloco, atual);
    }
    const textos = [];
    for (const [el, info] of blocos) {
      const r = el.getBoundingClientRect();
      const c = recorte(r);
      if (!c || info.o < 0.3) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
      const escala = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
      el.setAttribute('data-m-medido', '');
      const cor = info.cores.length ? [0, 1, 2].map((k) => info.cores.reduce((s, x) => s + x[k], 0) / info.cores.length) : [255, 255, 255];
      textos.push({ texto: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60), cqmin: Math.round(((fs * escala) / um) * 10) / 10, caixa: c, cor, o: Math.round(info.o * 100) / 100 });
    }
    // visuais (o herói): imagem, SVG, vídeo, mockup, [data-heroi] e caixas com fundo; planos cheios não contam
    const visuais = [];
    for (const el of R.conteudo.querySelectorAll('img, svg, video, .m-mockup, [data-heroi], div, span')) {
      if (el.closest('.luz, [data-m-medido]') || (el.tagName.toLowerCase() !== 'svg' && el.closest('svg'))) continue;
      const tag = el.tagName.toLowerCase();
      if ((tag === 'div' || tag === 'span') && !el.hasAttribute('data-heroi') && !el.classList.contains('m-mockup') && !pintaAlgo(el)) continue;
      const c = recorte(el.getBoundingClientRect());
      if (!c) continue;
      const area = (c.l * c.a) / (W * H);
      if (area < 0.01 || area > 0.92 || opacidadeEfetiva(el) < 0.3) continue;
      visuais.push({ area, heroi: el.hasAttribute('data-heroi'), caixa: c });
    }
    const maior = visuais.reduce((m, v) => Math.max(m, v.area), 0);
    const declarado = visuais.filter((v) => v.heroi).reduce((m, v) => Math.max(m, v.area), 0);
    // fotos: ampliação real (px na tela ÷ px do arquivo), com o enquadramento cover
    const fotos = [];
    for (const img of R.conteudo.querySelectorAll('img.m-foto')) {
      if (!img.naturalWidth || opacidadeEfetiva(img) < 0.3) continue;
      const r = img.getBoundingClientRect();
      if (!recorte(r)) continue;
      const fit = getComputedStyle(img).objectFit;
      const ex = r.width / img.naturalWidth, ey = r.height / img.naturalHeight;
      const escala = fit === 'contain' ? Math.min(ex, ey) : Math.max(ex, ey);
      fotos.push({ arquivo: decodeURIComponent((img.getAttribute('src') || '').split('/').pop() || ''), escala: Math.round(escala * 100) / 100, natural: [img.naturalWidth, img.naturalHeight] });
    }
    return { largura: W, altura: H, textos, heroi: Math.round(Math.max(maior, declarado) * 1000) / 1000, fotos };
  }
  Motion.medirComposicao = medirComposicao;

  /* ─── o que os scripts da skill usam ─── */
  window.__MOTION__ = {
    versao: Motion.versao,
    get pronto() {
      return Motion.pronto;
    },
    erros: () => erros.slice(),
    linha: () => Motion.linha,
    ir: async (t) => {
      const p = Motion.ir(t);
      if (p) await p;
      return true;
    },
    irCena: async (id, tl) => {
      const p = Motion.irCena(id, tl);
      if (p) await p;
      return true;
    },
    cenas: () =>
      Motion.cenaR.map((R) => ({
        id: R.id,
        inicio: R.inicio,
        dur: R.dur,
        temQuadro: typeof R.def.quadro === 'function',
        poses: Object.keys(R.def.poses || {}),
      })),
    pontes: () => Object.fromEntries(Motion.cenaR.map((R) => [R.id, R.pontes])),
    medirComposicao: (id) => medirComposicao(id),
    /** Esconde (ou mostra de novo) os textos medidos da cena: o fundo por baixo deles, para o contraste. */
    esconderTextos: (id, sim) => {
      const R = Motion.cenaPorId[id];
      if (R) R.secao.classList.toggle('m-sem-texto', !!sim);
      return true;
    },
  };

  Motion.interno = { posarCamera, estilizarCena, caixaTela, caixaLayout, criarSet, zerarInvolucros };
})();
