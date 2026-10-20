/* transicoes.js — a biblioteca de transições entre cenas (o motor é dono delas).

   Cada transição escreve só nos invólucros: `.m-cena` (A.estilo: opacidade, desfoque, máscara)
   e `.m-camera` (A.posar: escala e posição da câmera do motor, origem no centro do quadro,
   p → s·p + (x, y) em cqw), mais as camadas do motor (Motion.camada('veu'), 'luz'), que ficam por
   cima de tudo e são zeradas a cada quadro. Assim a transição também é pura.

   modo 'sobreposta': as duas cenas tocam juntas; e.p vai de 0 a 1 na janela.
   modo 'encadeada': corte seco no meio; e.lado = 'A' com e.pA (0..1 até o corte) ou 'B' com e.pB.
   B pode ser null (saída final do filme). Uma transição própria do projeto vai em
   cenas/_transicoes.js com Motion.transicao('nome', { medir, preparar, aplicar }) e o modo/dur
   declarados no motion.json. */
(function () {
  'use strict';
  const TT = window.MotionTempo;
  const { clamp, lerp, prog, ease, suave, suave5, logLerp } = TT;
  const NS = 'http://www.w3.org/2000/svg';

  const selPonte = (nome) => `[data-ponte="${nome}"]`;
  const H = () => (Motion.ctx.formato.altura / Motion.ctx.formato.largura) * 100;
  const u = () => Motion.ctx.formato.largura / 100;

  /** Desfoque direcional na câmera do motor (obturador), σ em px. */
  function obturador(L, sx, sy) {
    const R = L.R;
    if (!R.__obt) {
      let svg = document.getElementById('m-fx-svg');
      if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.id = 'm-fx-svg';
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        Motion.palco.appendChild(svg);
      }
      const f = document.createElementNS(NS, 'filter');
      f.id = `m-obt-cam-${R.id}`;
      f.setAttribute('x', '-20%');
      f.setAttribute('y', '-20%');
      f.setAttribute('width', '140%');
      f.setAttribute('height', '140%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      const g = document.createElementNS(NS, 'feGaussianBlur');
      f.appendChild(g);
      svg.appendChild(f);
      R.__obt = g;
    }
    const a = Math.round(Math.max(0, sx) * 4) / 4, b = Math.round(Math.max(0, sy) * 4) / 4;
    R.__obt.setAttribute('stdDeviation', `${a} ${b}`);
    if (a > 0 || b > 0) R.camera.style.filter = `url(#m-obt-cam-${R.id})`;
  }

  function veu(cor, o) {
    const v = Motion.camada('veu');
    v.style.cssText = `display:block;background:${cor};opacity:${clamp(o).toFixed(4)}`;
    return v;
  }

  const DIR = { esquerda: [-1, 0], direita: [1, 0], cima: [0, -1], baixo: [0, 1] };
  const DIR_TEXTO = { esquerda: 'a esquerda', direita: 'a direita', cima: 'cima', baixo: 'baixo' };

  /* ── corte ── */
  Motion.transicao('corte', { aplicar() {} });
  Motion.transicao('na-cena', { aplicar() {} });

  /* ── C1.1 + C1.2: corte seco no mesmo eixo, em movimento, com herança de velocidade ── */
  Motion.transicao('corte-no-eixo', {
    aplicar(e, A, B, op) {
      const forca = op.forca ?? 0.006, desf = op.desfoque ?? 0.42, K = op.K ?? 2.2, tau = op.tau ?? 0.17;
      const antes = op.__antes ?? 0.1, depois = op.__depois ?? 0.3;
      if (e.lado === 'A') {
        const g = (Math.pow(2, K * e.pA) - 1) / (Math.pow(2, K) - 1);
        A.posar({ s: 1 + forca * g });
        A.estilo({ blur: desf * g });
      } else if (B) {
        // velocidade de log-escala de A no último quadro, herdada por B e dissolvida devagar
        const vA = (forca * K * Math.LN2 * Math.pow(2, K)) / (Math.pow(2, K) - 1) / Math.max(0.01, antes) / (1 + forca);
        const D = Math.max(0.01, depois);
        const tB = e.pB * D;
        const ed = Math.exp(-D / tau);
        const a = vA * tau * (1 - ed);
        const f = (Math.exp(-tB / tau) - ed) / (1 - ed);
        B.posar({ s: Math.exp(-a * f) });
        B.estilo({ blur: desf * 0.6 * (1 - suave(tB / 0.09)) });
      }
    },
  });

  /* ── C1.4: avança, desfoca e apaga; a próxima nasce do desfoque no mesmo eixo ── */
  Motion.transicao('avancar-desfocar', {
    aplicar(e, A, B, op) {
      const av = op.avanco ?? 0.07, desf = op.desfoque ?? 0.8;
      if (e.lado === 'A') {
        const x = e.pA;
        A.posar({ s: 1 + av * ease.inCubic(x) });
        A.estilo({ blur: desf * x, o: 1 - x * x });
      } else if (B) {
        const x = ease.outCubic(e.pB);
        B.posar({ s: lerp(0.97, 1, x) });
        B.estilo({ blur: desf * (1 - x), o: suave(e.pB / 0.35) });
      }
    },
  });

  /* ── C1.8: véu uniforme, sem forma ── */
  Motion.transicao('esmaecer', {
    aplicar(e, A, B, op) {
      const cor = op.cor || 'var(--fundo)';
      if (!B) {
        veu(cor, ease.inOutSine(e.p));
        return;
      }
      if (e.p < 0.5) {
        B.estilo({ o: 0 });
        veu(cor, ease.inOutSine(e.p / 0.5));
      } else {
        A.estilo({ o: 0 });
        veu(cor, 1 - ease.inOutSine((e.p - 0.5) / 0.5));
      }
    },
  });

  /* ── crossfade ── */
  Motion.transicao('dissolver', {
    aplicar(e, A, B, op) {
      const x = ease.inOutSine(e.p);
      if (!B) {
        A.estilo({ o: 1 - x });
        return;
      }
      B.estilo({ o: x, blur: (op.desfoque || 0) * (1 - x) });
      if (op.escala) B.posar({ s: 1 + op.escala * (1 - x) });
    },
  });

  /* ── empurrar e chicote: B empurra A, com obturador direcional proporcional à velocidade ── */
  function empurrao(curva, fatorBlur, teto) {
    return {
      aplicar(e, A, B, op) {
        const d = DIR[op.direcao || 'esquerda'] || DIR.esquerda;
        const dist = d[0] ? 100 : H();
        const x = curva(e.p);
        const h = 0.004;
        const v = (Math.abs(curva(clamp(e.p + h)) - curva(clamp(e.p - h))) / (2 * h)) * dist / Math.max(0.05, op.__dur || 0.5);
        const sigma = Math.min(teto, v * fatorBlur * u());
        // a cena inteira anda (fundo junto): B entra colada em A, na mesma velocidade
        A.estilo({ x: d[0] * dist * x, y: d[1] * dist * x });
        obturador(A, d[0] ? sigma : 0, d[1] ? sigma : 0);
        if (B) {
          B.estilo({ x: -d[0] * dist * (1 - x), y: -d[1] * dist * (1 - x) });
          obturador(B, d[0] ? sigma : 0, d[1] ? sigma : 0);
        }
      },
    };
  }
  Motion.transicao('empurrar', empurrao(ease.inOutSine, 0.0028, 40));
  Motion.transicao('chicote', empurrao((p) => (p < 0.5 ? ease.inOutExpo(p) : 0.5 + 0.5 * ease.outExpo((p - 0.5) * 2)), 0.004, 90));

  /* ── C1.5: mergulho no elemento até ele virar o primeiro quadro da próxima ── */
  Motion.transicao('mergulho', {
    medir(op) {
      const m = [['A', op.alvo, 'fim']];
      if (op.ponte) m.push(['B', selPonte(op.ponte), 'inicio']);
      return m;
    },
    preparar(A, B, op, cache) {
      cache.a = op.alvo ? A.medida(op.alvo, 'fim') : null;
      cache.b = op.ponte && B ? B.medida(selPonte(op.ponte), 'inicio') : null;
      if (!cache.a) cache.a = { cx: 0, cy: 0, l: 40, a: 40 * 0.5625 };
    },
    aplicar(e, A, B, op, cache) {
      const a = cache.a, b = cache.b;
      const dur = op.__dur || 0.75;
      const fa = clamp((op.antecipacao ?? 0.2) / dur, 0, 0.6);
      const recuo = op.recuo ?? 0.025;
      const q = prog(e.p, 0, fa);
      const w = prog(e.p, fa * 0.55, 1);
      const ew = ease.mergulho(w);
      const sAnt = 1 - recuo * ease.inOutSine(q);
      const S1 = b ? b.l / a.l : (op.cobrir ?? 1.15) * Math.max(100 / a.l, H() / a.a);
      const S = sAnt * logLerp(1, S1 / (1 - recuo), ew);
      const dest = b ? [b.cx, b.cy] : [0, 0];
      const G = [lerp(a.cx, dest[0], ew), lerp(a.cy, dest[1], ew)];
      A.posar({ s: S, x: G[0] - S * a.cx, y: G[1] - S * a.cy });
      // no fim do mergulho A desfoca e apaga por baixo de B: o rastro rápido não vaza pela fusão
      A.estilo({ blur: 0.25 * ew * ew + 0.9 * suave(prog(e.p, 0.55, 1)), o: B ? 1 - suave(prog(e.p, 0.62, 0.96)) : 1 });
      // o resto escurece; o alvo fica aceso (véu com um buraco macio no alvo)
      const esc = (op.escurecer ?? 0.4) * suave(q) * (1 - suave(prog(w, 0.2, 0.7)));
      if (esc > 0.001) {
        const v = Motion.camada('veu');
        const px = u();
        const cx = (50 + G[0]) * px, cy = (H() / 2 + G[1]) * px;
        const rx = (S * a.l * 0.62 + 2) * px, ry = (S * a.a * 0.62 + 2) * px;
        const m = `radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, transparent 55%, rgba(0,0,0,.6) 80%, #000 100%)`;
        v.style.cssText = `display:block;background:#000;opacity:${esc.toFixed(4)};-webkit-mask-image:${m};mask-image:${m}`;
      }
      if (!B) {
        veu('var(--fundo)', suave(prog(e.p, 0.7, 1)));
        return;
      }
      if (b) {
        // B preso ao alvo: a caixa-ponte de B coincide com o alvo na tela até assentar
        const sB = (S * a.l) / b.l;
        B.posar({ s: sB, x: G[0] - sB * b.cx, y: G[1] - sB * b.cy });
        B.estilo({ o: suave(prog(e.p, 0.55, 0.92)) });
      } else {
        const x = prog(e.p, 0.6, 1);
        B.posar({ s: lerp(1.06, 1, ease.outCubic(x)) });
        B.estilo({ o: suave(x / 0.8), blur: 0.5 * (1 - ease.outCubic(x)) });
      }
    },
  });

  /* ── C7: elemento compartilhado — a câmera leva o lugar dele numa cena até o lugar na outra ── */
  Motion.transicao('ponte', {
    medir(op) {
      return op.nome ? [['A', selPonte(op.nome), 'fim'], ['B', selPonte(op.nome), 'inicio']] : [];
    },
    preparar(A, B, op, cache) {
      cache.a = op.nome ? A.medida(selPonte(op.nome), 'fim') : null;
      cache.b = op.nome && B ? B.medida(selPonte(op.nome), 'inicio') : null;
      if (!cache.a || !cache.b) Motion.erro(A.id, 'transicao', null, `ponte: marque o mesmo data-ponte="${op.nome}" nas duas cenas`);
    },
    aplicar(e, A, B, op, cache) {
      const a = cache.a, b = cache.b;
      if (!a || !b || !B) return;
      const x = ease.simetrica(e.p);
      const arco = (op.arco || 0) * Math.sin(Math.PI * x);
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const len = Math.hypot(dx, dy) || 1;
      const c = [lerp(a.cx, b.cx, x) - (dy / len) * arco, lerp(a.cy, b.cy, x) + (dx / len) * arco];
      const sA = logLerp(1, b.l / a.l, x);
      const sB = logLerp(a.l / b.l, 1, x);
      A.posar({ s: sA, x: c[0] - sA * a.cx, y: c[1] - sA * a.cy });
      B.posar({ s: sB, x: c[0] - sB * b.cx, y: c[1] - sB * b.cy });
      B.estilo({ o: ease.inOutSine(prog(e.p, 0.12, 0.88)) });
    },
  });

  /* ── C1.3: tudo converge num ponto e vira um ponto de luz macio ──
     A luz nasce no ponto exato (op.ponto, ou o centro do data-ponte da próxima). O brilho sobe só
     no conteúdo (o fundo da cena não clareia) e o que sai apaga antes de a convergência parar. */
  Motion.transicao('ponto-de-luz', {
    medir(op) {
      return op.ponte ? [['B', selPonte(op.ponte), 'inicio']] : [];
    },
    preparar(A, B, op, cache) {
      const b = op.ponte && B ? B.medida(selPonte(op.ponte), 'inicio') : null;
      cache.P = op.ponto || (b ? [b.cx, b.cy] : [0, 0]);
    },
    aplicar(e, A, B, op, cache) {
      const P = cache.P;
      const q = prog(e.p, 0, 0.62);
      const S = logLerp(1, 0.14, ease.inCubic(q));
      A.posar({ s: S, x: P[0] - S * P[0], y: P[1] - S * P[1] });
      A.estilo({ blur: 0.7 * q, oConteudo: 1 - suave(prog(q, 0.35, 0.85)), brilho: 1 + 1.3 * suave(q * 1.6) });
      // o ponto de luz: nasce enquanto tudo converge e apaga (ou vira o começo de B)
      const forca = suave(prog(e.p, 0.25, 0.6)) * (1 - suave(prog(e.p, 0.62, 0.98)));
      if (forca > 0.002) {
        const px = u();
        const diam = (6 + 10 * suave(prog(e.p, 0.2, 0.62))) * px;
        const cx = (50 + P[0]) * px, cy = (H() / 2 + P[1]) * px;
        const luz = Motion.camada('luz');
        const grad = A.api.fx.gradienteDeLuz(op.cor || 'var(--luz-1, var(--destaque, #fff))', 1, { forma: 'circle', ate: 50 });
        // inset:auto vem ANTES de left/top (depois, ele zeraria a posição e a luz iria para o canto)
        luz.style.cssText = `display:block;inset:auto;left:${(cx - diam / 2).toFixed(1)}px;top:${(cy - diam / 2).toFixed(1)}px;width:${diam.toFixed(1)}px;height:${diam.toFixed(1)}px;background:${grad};opacity:${forca.toFixed(4)};mix-blend-mode:plus-lighter`;
        luz.dataset.centro = `${cx.toFixed(1)},${cy.toFixed(1)}`;
      }
      if (B) B.estilo({ o: suave(prog(e.p, 0.58, 1)) });
    },
  });

  /* ── C1.6: a câmera atravessa a composição ── */
  Motion.transicao('atravessar', {
    aplicar(e, A, B, op) {
      const ate = op.ate ?? 4;
      const p = e.p;
      const S = Math.exp(Math.log(ate) * (0.3 * p + 0.7 * p * p));
      A.posar({ s: S });
      A.estilo({ blur: 0.9 * p * p, o: 1 - suave(prog(p, 0.5, 0.92)) });
      if (B) {
        const x = prog(p, 0.45, 1);
        B.posar({ s: lerp(0.95, 1, ease.outCubic(x)) });
        B.estilo({ o: suave(x / 0.7) });
      } else veu('var(--fundo)', suave(prog(p, 0.6, 1)));
    },
  });

  /* ── flash sem ataque seco ── */
  Motion.transicao('flash', {
    aplicar(e, A, B, op) {
      const cor = op.cor || 'var(--texto, #fff)';
      const forca = op.forca ?? 0.85;
      const o = e.lado === 'A' ? forca * suave(e.pA) : forca * (1 - ease.outCubic(e.pB));
      const v = Motion.camada('luz');
      v.style.cssText = `display:block;background:${cor};opacity:${clamp(o).toFixed(4)}`;
    },
  });

  /* ── lâmina de luz: luz que SOMA, larga e sem borda, varre o quadro; B aparece presa a ela ──
     O conteúdo de A apaga antes de a lâmina chegar (a lâmina nunca corta uma palavra ao meio). A luz
     é mais forte no primeiro terço do caminho e enfraquece ao atravessar: escolha o ângulo para ela
     chegar ao herói de B (rosto, produto) já fraca. angulo 100 = da esquerda para a direita;
     280 = da direita para a esquerda; 190 = de cima para baixo. */
  Motion.transicao('lamina-de-luz', {
    aplicar(e, A, B, op) {
      const ang = op.angulo ?? 100;
      const larg = op.largura ?? 16; // % do quadro: a meia-largura da luz
      const soft = op.suavidade ?? 16; // % do quadro: a borda da máscara de B
      const forca = op.forca ?? 0.42;
      const x = ease.inOutSine(e.p);
      const pos = lerp(-soft - larg, 100 + soft + larg, x);
      A.estilo({ oConteudo: 1 - suave(prog(e.p, 0.02, 0.32)) });
      if (B) {
        const ps = [];
        for (let i = 0; i <= 8; i++) {
          const k = i / 8;
          ps.push(`rgba(0,0,0,${(1 - suave5(k)).toFixed(4)}) ${(pos - soft + 2 * soft * k).toFixed(2)}%`);
        }
        B.estilo({ mask: `linear-gradient(${ang}deg, ${ps.join(', ')})` });
      }
      const cor = op.cor || 'var(--luz-1, var(--destaque, #fff))';
      const ps = [];
      for (let i = -10; i <= 10; i++) {
        const k = i / 10;
        const a = (Math.exp(-4.5 * k * k) - Math.exp(-4.5)) / (1 - Math.exp(-4.5)); // chega a zero liso na ponta
        ps.push(`color-mix(in srgb, ${cor} ${(a * 100).toFixed(1)}%, transparent) ${(pos + k * larg).toFixed(2)}%`);
      }
      const v = Motion.camada('luz');
      const o = forca * Math.pow(Math.sin(Math.PI * clamp(e.p)), 1.4) * (1 - 0.55 * x);
      v.style.cssText = `display:block;background:linear-gradient(${ang}deg, transparent ${(pos - larg * 1.05).toFixed(2)}%, ${ps.join(', ')}, transparent ${(pos + larg * 1.05).toFixed(2)}%);opacity:${o.toFixed(4)};mix-blend-mode:plus-lighter`;
    },
  });

  /* ── íris muito esfumada (desencorajada: prefira esmaecer) ── */
  Motion.transicao('iris', {
    aplicar(e, A, B, op) {
      if (!B) return;
      const P = op.ponto || [0, 0];
      const cx = 50 + P[0], cy = ((H() / 2 + P[1]) / H()) * 100;
      const raio = lerp(0, 160, ease.inOutCubic(e.p));
      const suav = Math.max(45, raio * 0.6);
      const ps = [];
      for (let i = 0; i <= 8; i++) {
        const x = i / 8;
        ps.push(`rgba(0,0,0,${(1 - suave5(x)).toFixed(4)}) ${(Math.max(0, raio - suav / 2) + suav * x).toFixed(2)}%`);
      }
      B.estilo({ mask: `radial-gradient(circle at ${cx.toFixed(2)}% ${cy.toFixed(2)}%, ${ps.join(', ')})` });
    },
  });
})();
