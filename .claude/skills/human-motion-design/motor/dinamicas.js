/* dinamicas.js — física de objeto (api.fisica), efeitos de luz e pintura (api.fx, api.pintura).

   Física é só para OBJETO (card, mockup, selo, ícone, marca): overshoot, quique e mola são
   permitidos aqui e proibidos em texto de leitura. Tudo puro em t. */
(function () {
  'use strict';
  Motion.estender((api, ctx) => {
    const { clamp, lerp, prog, ease, suave, suave5, mola, hermite, rand } = api;
    const R = ctx.R;
    const u = ctx.formato.largura / 100; // px por cqw

    /* ─── física ─── */
    const fisica = {
      /** Quiques de altura decrescente depois do primeiro contato em t0. Devolve a altura (≥ 0, cqw). */
      quique(t, t0, { altura = 4, razao = 0.38, n = 3, dur = 0.32 } = {}) {
        let tt = t - t0;
        if (tt <= 0) return 0;
        let h = altura * razao;
        let d = dur * Math.sqrt(razao);
        for (let i = 0; i < n; i++) {
          if (tt < d) {
            const x = tt / d;
            return 4 * h * x * (1 - x);
          }
          tt -= d;
          h *= razao;
          d *= Math.sqrt(razao);
        }
        return 0;
      },
      /** Cada impacto afunda o conjunto e ele devolve (oscilação amortecida). Devolve o deslocamento (fração). */
      afundar(t, impactos = [], { forca = 0.02, freq = 7, amort = 9 } = {}) {
        let s = 0;
        for (const ti of impactos) s += -forca * 2 * Math.PI * freq * mola(t - ti, 1, { freq, amort });
        return s;
      },
      /** Envelope de impacto: ataque de um quadro e decaimento outExpo (0..1). */
      impacto(t, t0, { ataque = api.umQuadro, decaimento = 0.45 } = {}) {
        if (t <= t0) return 0;
        if (t < t0 + ataque) return (t - t0) / ataque;
        return 1 - ease.outExpo(prog(t, t0 + ataque, t0 + ataque + decaimento));
      },
      /** Tique: passa `passa` graus do ponto e volta, sem quique (giro de chave). Devolve graus extras. */
      tique(t, t0, { passa = 6, dur = 0.28 } = {}) {
        const x = prog(t, t0, t0 + dur);
        return x <= 0 || x >= 1 ? 0 : passa * api.pulsoSemQuique(x, 0.3) * (1 - suave(prog(x, 0.6, 1)));
      },
      /** Amassa no impacto e volta (mola amortecida). Devolve { sx, sy }. */
      amassar(t, t0, { forca = 0.08, freq = 2.4, amort = 6 } = {}) {
        const tau = t - t0;
        if (tau <= 0) return { sx: 1, sy: 1 };
        const s = forca * Math.exp(-amort * tau) * Math.cos(2 * Math.PI * freq * tau);
        return { sx: 1 + s * 0.6, sy: 1 - s };
      },
      /** Arremesso: Hermite até o contato em tc e, depois, mola que herda a velocidade. Escalar ou [x, y]. */
      arremesso(t, { t0 = 0, tc = 0.5, p0 = 0, v0 = 0, contato = 0, vc = null, freq = 2.2, amort = 6 } = {}) {
        const um = (a, va, c, vcc) => {
          const v1 = vcc ?? (c - a) / Math.max(1e-6, tc - t0) * 1.6;
          if (t <= tc) return hermite(t, t0, tc, a, va, c, v1);
          return c + mola(t - tc, v1, { freq, amort });
        };
        if (Array.isArray(p0)) return p0.map((a, i) => um(a, Array.isArray(v0) ? v0[i] : v0, contato[i], vc && vc[i]));
        return um(p0, v0, contato, vc);
      },
      /** Cai de perto da câmera: quase parado no alto, acelera como u⁴. Devolve 0..1. */
      cair(t, t0, t1) {
        const x = prog(t, t0, t1);
        return x * x * x * x;
      },
      spring: api.spring,
    };

    /* ─── efeitos ─── */
    let svgFx = null;
    function svgDoMotor() {
      if (svgFx && svgFx.isConnected) return svgFx;
      svgFx = document.getElementById('m-fx-svg');
      if (!svgFx) {
        svgFx = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgFx.id = 'm-fx-svg';
        svgFx.setAttribute('width', '0');
        svgFx.setAttribute('height', '0');
        svgFx.setAttribute('aria-hidden', 'true');
        svgFx.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        ctx.palco.appendChild(svgFx);
      }
      return svgFx;
    }
    let contadorFiltro = 0;

    /** Perfil de luz sem borda: queda até zero com inclinação zero (1 − smoothstep em muitas paradas). */
    function gradienteDeLuz(cor = 'var(--luz-1)', forca = 1, { forma = 'circle', paradas = 14, ate = 70, cx = 50, cy = 50 } = {}) {
      const ps = [];
      for (let i = 0; i <= paradas; i++) {
        const x = i / paradas;
        const a = forca * (1 - suave5(x));
        ps.push(`color-mix(in srgb, ${cor} ${(a * 100).toFixed(2)}%, transparent) ${(x * ate).toFixed(2)}%`);
      }
      return `radial-gradient(${forma} at ${cx}% ${cy}%, ${ps.join(', ')})`;
    }

    const fx = {
      gradienteDeLuz,
      /** Desfoque direcional de obturador (filtro SVG por elemento), proporcional à velocidade em cqw/s. */
      obturador(el, vx = 0, vy = 0, { fator = 0.006 } = {}) {
        if (!el) return;
        const sx = Math.round(Math.abs(vx) * fator * u * 4) / 4;
        const sy = Math.round(Math.abs(vy) * fator * u * 4) / 4;
        if (!el.__mObt) {
          const svg = svgDoMotor();
          const NS = 'http://www.w3.org/2000/svg';
          const f = document.createElementNS(NS, 'filter');
          const id = `m-obt-${R.id}-${++contadorFiltro}`;
          f.setAttribute('id', id);
          f.setAttribute('x', '-50%');
          f.setAttribute('y', '-50%');
          f.setAttribute('width', '200%');
          f.setAttribute('height', '200%');
          f.setAttribute('color-interpolation-filters', 'sRGB');
          const g = document.createElementNS(NS, 'feGaussianBlur');
          g.setAttribute('stdDeviation', '0 0');
          f.appendChild(g);
          svg.appendChild(f);
          el.__mObt = { id, g };
        }
        el.__mObt.g.setAttribute('stdDeviation', `${sx} ${sy}`);
        el.style.filter = sx > 0 || sy > 0 ? `url(#${el.__mObt.id})` : 'none';
      },
      /** Velocidade (derivada numérica) de uma função de posição, em unidades/s. */
      velocidade(posEm, t, h = 0.008) {
        return (posEm(t + h) - posEm(t - h)) / (2 * h);
      },
      /** Luz macia sem borda visível: pinta o fundo do elemento com um degradê radial de muitas paradas. */
      halo(el, { cor = 'var(--luz-1)', forca = 0.6, forma = 'ellipse', ate = 70 } = {}) {
        if (!el) return;
        el.style.backgroundImage = gradienteDeLuz(cor, forca, { forma, ate });
      },
      /** Luz que respira (opacidade e escala), período longo, sem começo nem fim visíveis; passa pelo
          aprovado em ref. `api.set` substitui o transform inteiro: se o mesmo elemento também deriva,
          passe a deriva em `junto` ({ x, y, r, s }) em vez de chamar set duas vezes. */
      respirar(t, el, { inicio = 0, periodo = 3.5, amp = 0.06, fase = 0, base = 1, junto = null } = {}) {
        if (!el) return;
        const v = api.vida(t, { inicio, periodo, amp: 1, fase });
        const j = junto || {};
        api.set(el, { o: clamp(base * (1 + amp * v)), s: (1 + amp * 0.3 * v) * (j.s ?? 1), x: j.x || 0, y: j.y || 0, r: j.r || 0 });
      },
      /** Nasce quente e esfria até a cor final: q = 1 quente, 0 assentado. Com `cor`, a peça nasce
          na cor de brasa (texto: a cor da letra; objeto: um brilho colorido em volta) em vez de só
          clarear; em texto claro, calor só por brilho vira mancha cinza. */
      calor(el, q, { calor = 2.2, cor = null } = {}) {
        if (!el) return;
        q = clamp(q);
        if (cor && api.tipo) {
          api.tipo.pintarCalor(el, q, cor);
          api.set(el, { bright: 1 + 0.3 * q });
          return;
        }
        api.set(el, { bright: 1 + (calor - 1) * q });
      },
      /** O objeto nasce do ponto de luz em que a cena anterior terminou (entrada por "na-cena" ou
          "ponto-de-luz"): cresce de `de` em log, quente, e esfria. Devolve { s, bright, o } (some ao
          resto do estado do objeto e aplique uma vez). */
      nascerDoPonto(t, { inicio = 0, dur = 0.45, de = 0.22 } = {}) {
        const e = ease.outExpo(prog(t, inicio, inicio + dur));
        return { s: api.logLerp(de, 1, e), bright: 1 + 1.4 * (1 - ease.outCubic(prog(t, inicio, inicio + dur * 1.5))), o: suave(prog(t, inicio, inicio + 0.06)) };
      },
      /** Desenha um traço SVG de 0 a 1 (p) sem o ponto da ponta redonda antes de começar e sem
          pedaço solto: pathLength 1, opacidade com rampa nos primeiros 5 % do desenho. */
      desenharTraco(path, p, { rampa = 0.05 } = {}) {
        if (!path) return;
        if (!path.__mTraco) {
          path.setAttribute('pathLength', '1');
          path.__mTraco = true;
        }
        p = clamp(p);
        path.style.strokeDasharray = p <= 0 ? '0 1' : '1 1';
        path.style.strokeDashoffset = (1 - p).toFixed(5);
        path.style.opacity = suave(prog(p, 0, rampa)).toFixed(4);
      },
      /** Revela no sentido da leitura (marca, palavra, faixa): máscara de borda macia que anda de 0
          (nada) a 1 (tudo), sem nenhuma letra quebrada parada. angulo 90 = da esquerda para a direita.
          fixo: fração (0..1, no sentido da máscara) que fica visível desde o começo, com borda seca
          (ponha a borda no vão entre o símbolo e o nome: ninguém vê a borda num vão vazio). */
      revelarNaLeitura(el, p, { angulo = 90, suavidade = 0.22, fixo = 0 } = {}) {
        if (!el) return;
        p = clamp(p);
        if (p >= 1) return api.set(el, { mask: 'none' });
        const pos = lerp(fixo - suavidade / 2, 1 + suavidade / 2, p);
        const ps = [];
        for (let i = 0; i <= 6; i++) {
          const k = i / 6;
          ps.push(`rgba(0,0,0,${(1 - suave5(k)).toFixed(4)}) ${((pos - suavidade / 2 + suavidade * k) * 100).toFixed(2)}%`);
        }
        const revela = `linear-gradient(${angulo}deg, ${ps.join(', ')})`;
        const f = (fixo * 100).toFixed(2);
        api.set(el, { mask: fixo > 0 ? `linear-gradient(${angulo}deg, #000 0%, #000 ${f}%, transparent ${f}%), ${revela}` : revela });
      },
      /** Envelope de flash sem ataque seco: sobe em `subida` s e decai em `dur` s (0..1). */
      flash(t, t0, { subida = 0.07, dur = 0.9 } = {}) {
        if (t <= t0 - subida) return 0;
        if (t < t0) return suave((t - (t0 - subida)) / subida);
        return 1 - ease.outExpo(prog(t, t0, t0 + dur)) * 0.999;
      },
      /** Máscara linear macia: pos 0..1 ao longo do ângulo; suavidade em fração do quadro. */
      mascaraLinear(el, { angulo = 90, pos = 0.5, suavidade = 0.15, inverter = false } = {}) {
        const a = clamp(pos - suavidade / 2, -1, 2) * 100, b = clamp(pos + suavidade / 2, -1, 2) * 100;
        const [c1, c2] = inverter ? ['transparent', '#000'] : ['#000', 'transparent'];
        const m = `linear-gradient(${angulo}deg, ${c1} ${a.toFixed(2)}%, ${c2} ${b.toFixed(2)}%)`;
        api.set(el, { mask: m });
      },
      /** Máscara radial macia (cx, cy em %; raio em % da diagonal). Prefira bordas largas: nada de íris dura. */
      mascaraRadial(el, { cx = 50, cy = 50, raio = 50, suavidade = 30 } = {}) {
        const r0 = Math.max(0, raio - suavidade / 2), r1 = raio + suavidade / 2;
        const ps = [];
        for (let i = 0; i <= 8; i++) {
          const x = i / 8;
          ps.push(`rgba(0,0,0,${(1 - suave5(x)).toFixed(4)}) ${(r0 + (r1 - r0) * x).toFixed(2)}%`);
        }
        api.set(el, { mask: `radial-gradient(circle at ${cx}% ${cy}%, ${ps.join(', ')})` });
      },
      /** Cada elemento acende quando uma frente vinda do ponto alcança a borda mais próxima dele.
          Devolve os atrasos (s). ponto em cqw a partir do centro; velocidade em cqw/s. */
      ondaDeLuz(ponto, elementos, { velocidade = 120 } = {}) {
        return elementos.map((el) => {
          const b = api.caixa(el.el || el);
          const dx = Math.max(b.x - ponto[0], 0, ponto[0] - (b.x + b.l));
          const dy = Math.max(b.y - ponto[1], 0, ponto[1] - (b.y + b.a));
          return Math.hypot(dx, dy) / velocidade;
        });
      },
      /** Rufar: n tempos com intervalos que encurtam (de → ate). Devolve os instantes relativos. */
      accelerando(n, { de = 0.045, ate = 0.017 } = {}) {
        const out = [0];
        for (let i = 1; i < n; i++) out.push(out[i - 1] + lerp(de, ate, (i - 1) / Math.max(1, n - 2)));
        return out;
      },
      /** O degradê de fundo de um elemento gira um fio (vida), passando pelo aprovado em ref. */
      degradeQueDeriva(el, t, { graus = 4, periodo = 6, ref = api.ref, inicio = 0 } = {}) {
        if (!el) return;
        if (el.__mFundo === undefined) el.__mFundo = getComputedStyle(el).backgroundImage;
        const ang = graus * Math.sin((2 * Math.PI * (t - ref)) / periodo) * suave5(prog(t, inicio, inicio + 0.8));
        el.style.backgroundImage = el.__mFundo.replace(/linear-gradient\((-?[\d.]+)deg/g, (m, a) => `linear-gradient(${(parseFloat(a) + ang).toFixed(3)}deg`);
      },
      rand,
    };

    /* ─── pintura (armadilhas do Chrome que viram trancos) ─── */
    const pintura = {
      /** Camada própria decidida no montar (nunca liga/desliga por quadro). */
      camada(el) {
        if (el) el.style.willChange = 'transform';
      },
      /** O filtro fica ligado a cena toda (blur 0 quando não usa): ligar/desligar muda o desenho. */
      filtroFixo(el) {
        if (el) {
          el.__mFiltroFixo = true;
          if (!el.style.filter) el.style.filter = 'blur(0px)';
        }
      },
      /** Força repintura invisível por quadro (imagem parada que reaproveita pintura antiga). */
      repintar(el, t) {
        if (el) el.style.boxShadow = `0 0 0 ${(0.0001 + t * 0.0001).toFixed(6)}px transparent`;
      },
    };

    api.fisica = fisica;
    api.fx = fx;
    api.pintura = pintura;
  });
})();
