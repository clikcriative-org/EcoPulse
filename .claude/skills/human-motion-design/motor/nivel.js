/* nivel.js — recursos de "nível de filme" (api.fx e api.tipo).

   Nasceram do porte das cenas de um filme aprovado para os exemplos de nível
   (exemplos-de-nivel/): é o que aquelas cenas faziam à mão e que toda cena com luz, vidro e
   tipografia viva precisa. Tudo genérico (cores só por token), tudo função pura de t.

   No montar (medem e preparam, uma vez):
     const frente = api.tipo.frenteDeLetras(partes, { distancia: (p) => p.cx - x0, frente: [0.12, 0.27] });
     const od = api.tipo.prepararOdometro(el.$('.data'));
   No quadro:
     frente.quadro(t)                                   letras acendem de um ponto, quentes, e assentam
     api.tipo.odometro(t, od, { inicio: 2.3, trava: 3.0 })
     api.tipo.escorrerDestaque(t, partes, { sobra: 0.12, periodo: 3.4 })
     api.fx.frenteDeLuz(el.$('.onda'), t, { centro, caixa, raio, inicio, fim })
     api.fx.luzDoVidro(card, t, { k, luz })
   Helpers: api.fx.degradeLargo(imagem, W, H, margem), api.fx.tempoDaFrente(dist, { inicio, fim, raio }),
   api.deslize(t, t0, t1, rampa). CSS: .m-vidro / .m-vidro-forte / .m-vidro-heroi em motor/nivel.css. */
(function () {
  'use strict';
  Motion.estender((api, ctx) => {
    const { clamp, lerp, prog, ease, suave5, tw } = api;
    const R = ctx.R;
    const palco = ctx.palco;
    const NS = 'http://www.w3.org/2000/svg';
    const escalaPalco = () => palco.getBoundingClientRect().width / palco.offsetWidth || 1;
    const pxCss = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;

    /** Deriva que não para: a velocidade sobe em `rampa` s e fica constante; vale 0 em t0 e 1 em t1
        (passa pelo valor aprovado em t1 e segue andando). Para derivas lentas que emendam no gesto
        seguinte sem estado parado. */
    function deslize(t, t0, t1, rampa = 0.5) {
      const g = (x) => (x <= 0 ? 0 : x < rampa ? (x * x) / (2 * rampa) : x - rampa / 2);
      return g(t - t0) / (g(t1 - t0) || 1);
    }
    api.deslize = deslize;

    /* ─── degradê largo ───────────────────────────────────────────────────────────────────────
       A mesma pintura de um linear-gradient de caixa W×H, numa imagem (1 + 2m)·W mais larga, com as
       pontas lisas na cor da ponta. Posicionada em −m·W é idêntica ao original; deslocada, o degradê
       deriva sem nunca mostrar a borda da imagem. Paradas em %, convertidas em px ao longo da linha
       do degradê (ângulo e cores não mudam). Use com a imagem COMPUTADA (rgb(...) N%). */
    function degradeLargo(imagem, W, H, m = 0.16) {
      const deg = /(-?[\d.]+)deg/.exec(imagem);
      const a = ((deg ? parseFloat(deg[1]) : 180) * Math.PI) / 180;
      const len = (w) => Math.abs(w * Math.sin(a)) + Math.abs(H * Math.cos(a));
      const W1 = W * (1 + 2 * m), L0 = len(W), pad = (len(W1) - L0) / 2;
      const paradas = [...String(imagem).matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)%/g)].map(([, c, p]) => `${c} ${(pad + (parseFloat(p) / 100) * L0).toFixed(2)}px`);
      if (paradas.length < 2) return { img: imagem, W1: W, m: 0 };
      return { img: `linear-gradient(${deg ? deg[1] : 180}deg, ${paradas.join(', ')})`, W1, m };
    }

    /* ─── o destaque escorre (vida no hold) ───────────────────────────────────────────────────
       Partes divididas de um .destaque (tipo.dividir): cada fatia mostra uma janela (1 + sobra)
       maior do degradê, que oscila devagar. A palavra continua indo da primeira à última cor. */
    function escorrerDestaque(t, partes, { sobra = 0.12, periodo = 3.4, ref = api.ref, amp = 0.45, inicio = null, rampa = 0.8 } = {}) {
      const env = inicio == null ? 1 : suave5(prog(t, inicio, inicio + rampa));
      const d = sobra * (0.5 + amp * env * Math.sin((2 * Math.PI * (t - ref)) / periodo));
      for (const p of partes) {
        const el = p.el || p;
        if (!el.__mEsc) {
          const [bw, bh] = (el.style.backgroundSize || '').split(' ').map(parseFloat);
          const [px, py] = (el.style.backgroundPosition || '').split(' ').map(parseFloat);
          if (!(bw > 0)) continue;
          el.__mEsc = { bw, bh, px, py };
        }
        const b = el.__mEsc;
        el.style.backgroundSize = `${(b.bw * (1 + sobra)).toFixed(2)}px ${b.bh.toFixed(2)}px`;
        el.style.backgroundPosition = `${(b.px - d * b.bw).toFixed(3)}px ${b.py.toFixed(2)}px`;
      }
    }

    /* ─── letras que acendem de um ponto ──────────────────────────────────────────────────────
       Uma frente de luz corre de um ponto (o símbolo da marca, um ponto de luz) para as pontas e
       cada letra acende quando ela passa: nasce do desfoque, quente (mais clara, com halo), um fio
       menor e mais perto do ponto, e assenta para fora enquanto esfria. A mais longe acende por
       último e entra em foco quase junto com as de dentro. distancia(p) em cqw (negativa à esquerda
       do ponto). Devolve { quadro(t, { escala }), recuo(t, d), inicio(d), partes }. */
    function frenteDeLetras(partes, op = {}) {
      const { distancia = (p) => p.cx, frente = [0.12, 0.27], dur = 0.3, assentar = 0.05, calor = 1.3, encolher = 0.06, desfoque = 0.42, halo = 0.6, cor = 'var(--brilho, #fff)' } = op;
      const lista = partes.map((p) => ({ el: p.el || p, d: distancia(p) }));
      const D = Math.max(...lista.map((L) => Math.abs(L.d))) || 1;
      const inicio = (d) => frente[0] + (frente[1] - frente[0]) * Math.pow(Math.min(1, Math.abs(d) / D), 1.2);
      const assentado = (d, t) => ease.forte(prog(t, inicio(d), inicio(d) + 0.45));
      const recuo = (t, d) => -assentar * d * (1 - assentado(d, t));
      // a mais perto do ponto fica por cima: as de fora saem de trás das de dentro
      [...lista].sort((a, b) => Math.abs(a.d) - Math.abs(b.d)).forEach((L, i) => {
        if (getComputedStyle(L.el).position === 'static') L.el.style.position = 'relative';
        L.el.style.zIndex = String(lista.length - i);
      });
      const brilhoCss = (b) => (b > 0.002 ? `drop-shadow(0 0 ${(1.3 * b).toFixed(3)}cqw color-mix(in srgb, ${cor} ${Math.round(85 * Math.min(1, b))}%, transparent))` : '');
      function quadro(t, { escala = 1, aplicar = true } = {}) {
        return lista.map((L) => {
          const s0 = inicio(L.d);
          const quente = 1 - ease.outCubic(prog(t, s0, s0 + lerp(0.45, 0.32, clamp(Math.abs(L.d) / D))));
          const v = (Math.abs(recuo(t + 0.008, L.d) - recuo(t - 0.008, L.d)) / 0.016) * escala;
          const st = {
            pre: '',
            x: recuo(t, L.d),
            s: lerp(1 - encolher, 1, assentado(L.d, t)),
            o: ease.bezier(0.25, 0.1, 0.25, 1)(prog(t, s0, s0 + 0.14)),
            blur: desfoque * (1 - ease.forte(prog(t, s0, s0 + dur))) + Math.min(0.3, v * 0.003),
            bright: 1 + calor * quente,
            filter: brilhoCss(halo * quente),
          };
          if (aplicar) api.set(L.el, st);
          return st;
        });
      }
      return { quadro, recuo, inicio, partes: lista, D };
    }

    /* ─── odômetro ───────────────────────────────────────────────────────────────────────────
       Um número (ou data) cujos algarismos rolam como um tambor e travam um a um, da esquerda para
       a direita, cada um no seu algarismo final. Os algarismos rolam 100 % (sem troca cruzada), cada
       um com a largura dele, centrado na coluna, e o degradê do número segue contínuo; desfoque só
       vertical enquanto a velocidade é alta. O elemento precisa pintar o número com
       background-clip: text (ex.: background-image: var(--destaque-grad)). */
    let contadorOdo = 0;
    function prepararOdometro(el, { passos = (i) => 4 + 2 * i } = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return null;
      const k = escalaPalco();
      const imagem = getComputedStyle(el).backgroundImage;
      el.style.whiteSpace = 'nowrap';
      const letras = api.tipo.dividir(el, { por: 'letra', kerning: false }).map((p) => p.el);
      const texto = letras.map((c) => c.textContent).join('');
      el.style.background = 'none';
      const pad = 0.12 * pxCss(el, 'fontSize');
      let svg = document.getElementById('m-fx-svg');
      if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.id = 'm-fx-svg';
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        palco.appendChild(svg);
      }
      const glifo = (txt) => {
        const s = document.createElement('span');
        s.textContent = txt;
        Object.assign(s.style, { position: 'absolute', left: '50%', top: '0.3em', whiteSpace: 'pre', padding: `0 ${pad.toFixed(2)}px 0.08em`, backgroundRepeat: 'no-repeat', webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent', color: 'transparent' });
        return s;
      };
      const TAMBOR = 'linear-gradient(to bottom, transparent 0.1em, #000 0.44em, #000 1.24em, transparent 1.52em)';
      const cols = [], resto = [];
      let n = 0;
      letras.forEach((c, idx) => {
        const st = c.style;
        const item = { el: c, idx, x: 0, y: 0, w: 0, kern: 0 };
        if (!/\d/.test(c.textContent)) {
          Object.assign(st, { backgroundRepeat: 'no-repeat', webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent', color: 'transparent' });
          resto.push(item);
          return;
        }
        Object.assign(st, { position: 'relative', backgroundImage: 'none', padding: '0.3em', margin: '-0.3em', webkitMaskImage: TAMBOR, maskImage: TAMBOR });
        const alvo = +c.textContent;
        const id = `m-odo-${R.id}-${++contadorOdo}`;
        const f = document.createElementNS(NS, 'filter');
        f.setAttribute('id', id);
        f.setAttribute('x', '-20%');
        f.setAttribute('y', '-60%');
        f.setAttribute('width', '140%');
        f.setAttribute('height', '220%');
        const g = document.createElementNS(NS, 'feGaussianBlur');
        g.setAttribute('stdDeviation', '0 0');
        f.appendChild(g);
        svg.appendChild(f);
        cols.push(Object.assign(item, { alvo, passos: passos(n), i: n, borrao: g, filtro: `url(#${id})` }));
        n++;
      });
      // medidas (fonte já carregada no montar): largura de cada algarismo e o kerning do texto corrido
      const sonda = (txt) => {
        const q = document.createElement('span');
        Object.assign(q.style, { display: 'inline-block', whiteSpace: 'pre' });
        q.textContent = txt;
        el.appendChild(q);
        const w = pxCss(q, 'width');
        q.remove();
        return w;
      };
      const nr = el.getBoundingClientRect();
      let W = pxCss(el, 'width');
      const q = nr.width / W;
      const H = nr.height / q;
      const larg = [...'0123456789'].map((d) => sonda(d));
      const tambor = 0.3 * pxCss(el, 'fontSize');
      const fantasma = document.createElement('span');
      fantasma.textContent = texto;
      Object.assign(fantasma.style, { position: 'absolute', left: '0', top: '0', visibility: 'hidden', whiteSpace: 'pre', background: 'none' });
      el.appendChild(fantasma);
      const gr = fantasma.getBoundingClientRect();
      const range = document.createRange();
      const kern = [...texto].map((ch, i) => {
        range.setStart(fantasma.firstChild, i);
        range.setEnd(fantasma.firstChild, i + 1);
        return (range.getBoundingClientRect().left - gr.left) / q;
      });
      const Wk = gr.width / q;
      fantasma.remove();
      resto.concat(cols).forEach((c) => {
        const r = c.el.getBoundingClientRect();
        const ins = c.alvo !== undefined ? tambor : 0;
        const left = (r.left - nr.left) / q + ins;
        c.kern = kern[c.idx] + (W - Wk) / 2 - left;
        c.x = -kern[c.idx];
        c.y = -((r.top - nr.top) / q + ins);
        c.w = pxCss(c.el, 'width') - 2 * ins;
      });
      W = Wk;
      // o algarismo original da coluna vira um espaço invisível; os dois que rolam ficam por cima
      cols.forEach((c) => {
        const txt = c.el.firstChild;
        if (txt && txt.nodeType === 3) {
          const s = document.createElement('span');
          s.style.visibility = 'hidden';
          s.textContent = txt.textContent;
          txt.replaceWith(s);
        }
        c.a = glifo(String(c.alvo));
        c.b = glifo(String(c.alvo));
        c.el.appendChild(c.a);
        c.el.appendChild(c.b);
      });
      void k;
      return { el, cols, resto, W, H, larg, pad, largo: degradeLargo(imagem, W, H, 0.16) };
    }

    /** Odômetro no tempo t. A coluna i parte em inicio + i·cascata e trava em trava − (n−1−i)·passo;
        depois de travado o degradê deriva devagar (passa pelo aprovado em ref). brilho: [t0, t1] de
        um reflexo que atravessa os algarismos uma vez. oResto: opacidade do que não é algarismo. */
    function odometro(t, od, { inicio = 0, trava = 0.7, cascata = 0.03, passo = 0.1, brilho = null, deriva = 0.1, ref = api.ref, oResto = 1, cor = 'var(--brilho, #fff)' } = {}) {
      if (!od) return;
      const PASSO = 1.2; // em: distância entre algarismos no tambor
      const W = od.W;
      const gq = brilho ? prog(t, brilho[0], brilho[1]) : 0;
      const gx = gq > 0 && gq < 1 ? lerp(-0.25, 1.25, ease.inOutSine(gq)) * W : -2 * W;
      const L = gx - 1.5 * W;
      const rd = deriva * W * (deslize(t, trava, Math.max(trava + 0.01, ref), 0.5) - 1);
      const R0 = rd - od.largo.m * W;
      const img = `linear-gradient(100deg, transparent 43%, color-mix(in srgb, ${cor} 85%, transparent) 50%, transparent 57%), ${od.largo.img}`;
      const tam = `${(3 * W).toFixed(2)}px ${od.H.toFixed(2)}px, ${od.largo.W1.toFixed(2)}px ${od.H.toFixed(2)}px`;
      const pintar = (e, bx, by) => {
        e.style.backgroundImage = img;
        e.style.backgroundSize = tam;
        e.style.backgroundPosition = `${(L + bx).toFixed(2)}px ${by.toFixed(2)}px, ${(R0 + bx).toFixed(2)}px ${by.toFixed(2)}px`;
      };
      const u = api.pxPorCqw;
      od.resto.forEach((c) => {
        pintar(c.el, c.x, c.y);
        api.set(c.el, { pre: '', x: c.kern / u, o: oResto });
      });
      const n = od.cols.length;
      od.cols.forEach((c) => {
        const a0 = inicio + c.i * cascata, z = trava - (n - 1 - c.i) * passo;
        const P = (x) => c.passos * ease.outCubic(prog(x, a0, z));
        const p = P(t);
        const i0 = Math.floor(p + 1e-6);
        const fr = Math.max(0, p - i0);
        const dig = (j) => (((c.alvo - c.passos + j) % 10) + 10) % 10;
        const v = Math.abs(P(t + 0.004) - P(t - 0.004)) / 0.008;
        const por = (e, d, y, mostra) => {
          if (e.textContent !== String(d)) e.textContent = String(d);
          e.style.transform = `translate(-50%, ${y.toFixed(4)}em)`;
          e.style.opacity = mostra ? '1' : '0';
          pintar(e, c.x + (od.larg[d] - c.w) / 2 + od.pad, c.y);
        };
        por(c.a, dig(i0), -fr * PASSO, true);
        por(c.b, dig(i0 + 1), (1 - fr) * PASSO, fr > 0.0005);
        const sd = Math.min(16, v * 0.42);
        c.el.style.transform = `translateX(${c.kern.toFixed(3)}px)`;
        c.borrao.setAttribute('stdDeviation', `0 ${sd.toFixed(2)}`);
        c.el.style.filter = sd > 0.3 ? c.filtro : 'none';
      });
    }

    /* ─── frente de luz por trás do vidro ─────────────────────────────────────────────────────
       Um anel largo de luz sai de um ponto e atravessa uma grade (bento, mosaico) por trás do vidro;
       existe só dentro da caixa da grade (aparece nos vãos e através dos cards, nunca no vazio em
       volta). el: um span absoluto em left/top 0 dentro da grade. Medidas em px da grade. Use
       tempoDaFrente para acender cada card quando a frente alcança a borda mais próxima dele. */
    function tempoDaFrente(dist, { inicio = 0, fim = 0.95, raio = 1250 } = {}) {
      return inicio + (fim - inicio) * (1 - Math.sqrt(Math.max(0, 1 - dist / raio)));
    }
    function frenteDeLuz(el, t, { centro, caixa, raio = 1250, inicio = 0, fim = 0.95, banda = 240, cor = 'var(--luz-3)', nucleo = 'var(--brilho, #fff)', apagar = [0.42, 0.8], desfoque = '0.7cqw' } = {}) {
      if (!el || !centro || !caixa) return;
      const q = prog(t, inicio, fim);
      const Rr = raio * (1 - (1 - q) ** 2);
      const bw = Math.min(Rr, banda);
      const o = q <= 0 ? 0 : ease.outCubic(prog(t, inicio, inicio + 0.08)) * (1 - ease.inOutSine(prog(Rr, apagar[0] * raio, apagar[1] * raio)));
      const ci = [Rr - centro.y, centro.x + Rr - caixa.w, centro.y + Rr - caixa.h, Rr - centro.x].map((v) => Math.max(0, v).toFixed(1) + 'px');
      api.set(el, {
        pre: `translate(${(centro.x - Rr).toFixed(1)}px, ${(centro.y - Rr).toFixed(1)}px)`,
        o,
        clip: Rr < 1 ? 'none' : `inset(${ci.join(' ')})`,
        style: {
          width: `${(2 * Rr).toFixed(1)}px`,
          height: `${(2 * Rr).toFixed(1)}px`,
          borderRadius: '50%',
          mixBlendMode: 'screen',
          background: Rr < 1 ? 'none'
            : `radial-gradient(closest-side, transparent ${(Rr - bw).toFixed(1)}px, color-mix(in srgb, ${cor} 22%, transparent) ${(Rr - bw * 0.35).toFixed(1)}px, color-mix(in srgb, ${nucleo} 30%, transparent) ${(Rr - 10).toFixed(1)}px, transparent ${Rr.toFixed(1)}px)`,
          filter: `blur(${desfoque})`,
        },
      });
    }

    /* ─── a luz atrás do vidro (.m-vidro) ─────────────────────────────────────────────────────
       As duas manchas de luz do card (--x1 --y1 / --x2 --y2) circulam devagar em sentidos opostos e
       a intensidade (--mo) respira para BAIXO (nunca passa da aprovada), cada card no seu período;
       no quadro aprovado (ref) tudo está exatamente onde o CSS pôs. k: envelope da vida (0..1, entre
       com suave5); luz: acendimento do card (0..1); fator: multiplica a intensidade final. */
    function luzDoVidro(el, t, { k = 1, luz = 1, fator = 1, fase = 0, periodo = 3.6, ref = api.ref, raio = [6, 5, 5, 4], respira = 0.07 } = {}) {
      if (!el) return;
      if (!el.__mVidro) {
        const cs = getComputedStyle(el);
        const v = ['--x1', '--y1', '--x2', '--y2', '--mo'].map((p) => parseFloat(cs.getPropertyValue(p)));
        el.__mVidro = { x1: v[0], y1: v[1], x2: v[2], y2: v[3], mo: isNaN(v[4]) ? 0.7 : v[4] };
      }
      const g = el.__mVidro;
      const TAU = 2 * Math.PI;
      const a = (TAU * (t - ref)) / 4.6 + fase, b = (TAU * (t - ref)) / 5.4 - fase;
      if (!isNaN(g.x1) && !isNaN(g.y1)) {
        el.style.setProperty('--x1', `${(g.x1 + raio[0] * k * (Math.sin(a) - Math.sin(fase))).toFixed(3)}%`);
        el.style.setProperty('--y1', `${(g.y1 + raio[1] * k * (Math.cos(a) - Math.cos(fase))).toFixed(3)}%`);
      }
      if (!isNaN(g.x2) && !isNaN(g.y2)) {
        el.style.setProperty('--x2', `${(g.x2 - raio[2] * k * (Math.sin(b) + Math.sin(fase))).toFixed(3)}%`);
        el.style.setProperty('--y2', `${(g.y2 + raio[3] * k * (Math.cos(b) - Math.cos(fase))).toFixed(3)}%`);
      }
      const dip = 1 - respira * (1 - Math.cos((TAU * (t - ref)) / periodo));
      el.style.setProperty('--mo', (g.mo * luz * lerp(1, dip, k) * fator).toFixed(4));
    }

    Object.assign(api.fx, { degradeLargo, frenteDeLuz, tempoDaFrente, luzDoVidro });
    Object.assign(api.tipo, { escorrerDestaque, frenteDeLetras, prepararOdometro, odometro });
    void tw;
  });
})();
