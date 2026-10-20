/* tipo.js — tipografia em movimento (api.tipo).

   Dividir (no montar, nunca no quadro):
     const letras = api.tipo.dividir(el.$('.frase'), { por: 'letra' });   // 'letra' | 'palavra' | 'linha'
     api.tipo.semViuva(el.$('.frase'));                                     // antes de dividir
   Cada parte: { el, i, n, tipo, palavra, linha, iLinha, nLinha, cx, cy, l, a, x0, corpo, kern, destaque }
   (cx, cy, l, a, x0 em cqw a partir do centro do quadro; corpo = tamanho da letra em cqw).

   Receitas (puras, chamadas no quadro): devolvem uma lista de estados { x, y, s, o, blur, r, bright }
   e aplicam nas partes. Para somar duas receitas (entrada + saída), passe { aplicar: false } e junte:
     const a = tipo.focar(t, letras, { inicio: 0.1, aplicar: false });
     const b = tipo.sair(t, letras, { aplicar: false });
     tipo.aplicar(letras, a, b);
   Distâncias de tipografia em em (fração do corpo da letra): o gesto escala com a letra nos dois
   formatos. Texto de leitura nunca tem overshoot. */
(function () {
  'use strict';
  Motion.estender((api, ctx) => {
    const { clamp, lerp, prog, ease, suave, suave5, rand, logLerp, estilo } = api;
    const R = ctx.R;
    const palco = ctx.palco;
    const curvaPadrao = Array.isArray(estilo.curvaEntrada) ? ease.bezier(...estilo.curvaEntrada) : ease.forte;

    /* ─── dividir ─── */
    function semViuva(el) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return;
      const nos = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) nos.push(n);
      let viuPalavra = false;
      for (let i = nos.length - 1; i >= 0; i--) {
        const txt = nos[i].textContent;
        for (let j = txt.length - 1; j >= 0; j--) {
          const ch = txt[j];
          if (/\s/.test(ch) && ch !== ' ') {
            if (viuPalavra) {
              nos[i].textContent = txt.slice(0, j) + ' ' + txt.slice(j + 1);
              return;
            }
          } else if (ch !== ' ') viuPalavra = true;
        }
      }
    }

    function dividir(el, { por = 'letra', kerning = true, mascara = false } = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return [];
      const chave = `__mPartes_${por}`;
      if (el[chave]) return el[chave];
      const P = palco.getBoundingClientRect();
      const escala = P.width / palco.offsetWidth || 1;
      const u = P.width / 100;
      const uLayout = palco.offsetWidth / 100;

      // posição natural de cada letra (com o kerning da fonte), antes de dividir
      const naturais = [];
      if (por === 'letra' && kerning) {
        const range = document.createRange();
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (n.parentElement && n.parentElement.closest('svg')) continue;
          let i = 0;
          for (const ch of n.textContent) {
            if (!/\s/.test(ch)) {
              range.setStart(n, i);
              range.setEnd(n, i + ch.length);
              naturais.push(range.getBoundingClientRect().left);
            }
            i += ch.length;
          }
        }
      }

      const letras = [];
      const palavras = [];
      const andar = (no) => {
        for (const filho of [...no.childNodes]) {
          if (filho.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const pedaco of filho.textContent.split(/(\s+)/)) {
              if (!pedaco) continue;
              if (/^\s+$/.test(pedaco)) {
                frag.appendChild(document.createTextNode(pedaco));
                continue;
              }
              const pal = document.createElement('span');
              pal.className = por === 'letra' ? 'm-palavra' : 'm-palavra m-bloco';
              palavras.push(pal);
              if (por === 'letra') {
                for (const ch of pedaco) {
                  const l = document.createElement('span');
                  l.className = 'm-letra';
                  l.textContent = ch;
                  if (/\s/.test(ch)) l.classList.add('m-espaco');
                  pal.appendChild(l);
                  if (!/\s/.test(ch)) letras.push(l);
                }
              } else pal.textContent = pedaco;
              frag.appendChild(pal);
            }
            filho.replaceWith(frag);
          } else if (filho.nodeType === 1 && filho.tagName !== 'BR' && filho.tagName.toLowerCase() !== 'svg' && !filho.classList.contains('m-palavra')) {
            andar(filho);
          }
        }
      };

      let partesEl;
      if (por === 'linha') {
        // por linha: <br> manda; sem <br>, mede as linhas pelos nós de primeiro nível
        const grupos = [[]];
        const temBr = !!el.querySelector('br');
        if (temBr) {
          for (const n of [...el.childNodes]) {
            if (n.nodeName === 'BR') {
              grupos.push([]);
              n.remove();
            } else grupos[grupos.length - 1].push(n);
          }
        } else {
          andar(el);
          let topoAtual = null;
          for (const n of [...el.childNodes]) {
            const alvo = n.nodeType === 1 ? n : null;
            if (alvo) {
              const r = (alvo.querySelector('.m-palavra') || alvo).getBoundingClientRect();
              const fs = parseFloat(getComputedStyle(alvo).fontSize) * escala;
              if (topoAtual !== null && Math.abs(r.top - topoAtual) > fs * 0.4) grupos.push([]);
              topoAtual = r.top;
            }
            grupos[grupos.length - 1].push(n);
          }
        }
        partesEl = grupos
          .filter((g) => g.some((n) => (n.textContent || '').trim()))
          .map((g) => {
            const linha = document.createElement('span');
            linha.className = 'm-linha' + (mascara ? ' m-mascara' : '');
            const dentro = document.createElement('span');
            dentro.className = 'm-linha-in';
            while (g.length && g[0].nodeType === 3 && !g[0].textContent.trim()) g.shift().remove();
            for (const n of g) dentro.appendChild(n);
            linha.appendChild(dentro);
            return { linha, dentro };
          });
        el.textContent = '';
        for (const { linha } of partesEl) el.appendChild(linha);
        partesEl = partesEl.map((x) => x.dentro);
      } else {
        andar(el);
        partesEl = por === 'letra' ? letras : palavras;
      }

      // medir
      const partes = partesEl.map((pe, i) => {
        const r = pe.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(pe).fontSize) || 16;
        const xx = (r.left - P.left) / u - 50;
        const yy = (r.top - P.top) / u - (P.height / P.width) * 50;
        return {
          el: pe,
          i,
          n: partesEl.length,
          tipo: por,
          l: r.width / u,
          a: r.height / u,
          x0: xx,
          cx: xx + r.width / u / 2,
          cy: yy + r.height / u / 2,
          topo: r.top,
          corpo: fs / uLayout,
          kern: 0,
          destaque: !!pe.closest('.destaque, [data-destaque]'),
        };
      });
      if (por === 'letra' && naturais.length === partes.length) {
        partes.forEach((p, i) => {
          const kpx = naturais[i] - p.el.getBoundingClientRect().left;
          if (Math.abs(kpx) > 0.01) {
            p.el.style.translate = `${(kpx / escala).toFixed(3)}px 0px`;
            p.kern = kpx / u;
            p.x0 += p.kern;
            p.cx += p.kern;
          }
        });
      }
      // palavra e linha de cada parte
      const tops = [];
      for (const p of partes) {
        const lim = p.corpo * u * 0.4;
        let k = tops.findIndex((tp) => Math.abs(tp - p.topo) < lim);
        if (k < 0) {
          tops.push(p.topo);
          k = tops.length - 1;
        }
        p.linha = k;
      }
      const ordemLinhas = tops.map((tp, k) => [tp, k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      for (const p of partes) p.linha = ordemLinhas.indexOf(p.linha);
      const porLinha = {};
      for (const p of partes) (porLinha[p.linha] = porLinha[p.linha] || []).push(p);
      for (const k in porLinha) {
        const lista = porLinha[k].sort((a, b) => a.cx - b.cx);
        lista.forEach((p, j) => {
          p.iLinha = j;
          p.nLinha = lista.length;
        });
      }
      if (por === 'letra') {
        partes.forEach((p) => {
          const pal = p.el.closest('.m-palavra');
          p.palavra = palavras.indexOf(pal);
        });
      } else partes.forEach((p, i) => (p.palavra = i));

      // degradê contínuo nas palavras de destaque: cada parte recebe a sua fatia
      const destaques = new Set(partes.filter((p) => p.destaque).map((p) => p.el.closest('.destaque, [data-destaque]')));
      for (const d of destaques) {
        const cs = getComputedStyle(d);
        const imagem = cs.backgroundImage;
        if (!imagem || imagem === 'none') continue;
        const caixa = d.getBoundingClientRect();
        for (const p of partes) {
          if (!d.contains(p.el)) continue;
          const r = p.el.getBoundingClientRect();
          const s = p.el.style;
          s.backgroundImage = imagem;
          s.backgroundSize = `${(caixa.width / escala).toFixed(2)}px ${(caixa.height / escala).toFixed(2)}px`;
          s.backgroundPosition = `${(-(r.left - caixa.left) / escala).toFixed(2)}px ${(-(r.top - caixa.top) / escala).toFixed(2)}px`;
          s.backgroundRepeat = 'no-repeat';
          s.webkitBackgroundClip = 'text';
          s.backgroundClip = 'text';
          s.webkitTextFillColor = 'transparent';
          s.color = 'transparent';
          p.fundoBase = { imagem, x: -(r.left - caixa.left) / escala, y: -(r.top - caixa.top) / escala };
        }
        d.style.backgroundImage = 'none';
        d.style.webkitTextFillColor = 'initial';
        d.classList.add('m-destaque-dividido');
      }
      el[chave] = partes;
      return partes;
    }

    /* ─── ordem e junção ─── */
    function rank(i, n, ordem = 'normal') {
      const c = (n - 1) / 2;
      if (ordem === 'reversa') return n - 1 - i;
      if (ordem === 'centro') return Math.abs(i - c);
      if (ordem === 'pontas') return c - Math.abs(i - c);
      if (typeof ordem === 'number') return rand(ordem + i * 13.7) * (n - 1);
      if (typeof ordem === 'function') return ordem(i, n);
      return i;
    }
    const rankDe = (p, partes, ordem) => (ordem === 'linha' ? rank(p.iLinha ?? p.i, p.nLinha ?? partes.length) : rank(p.i, partes.length, ordem));
    /** A frase inteira fica legível a tempo: a cascata total não passa de `max` s (comprime a cascata). */
    function limitarCascata(cascata, partes, ordem, max) {
      if (!max || partes.length < 2) return cascata;
      if (!partes.__mRankMax || partes.__mRankMax[0] !== ordem) partes.__mRankMax = [ordem, Math.max(0, ...partes.map((p) => rankDe(p, partes, ordem)))];
      const n = partes.__mRankMax[1];
      return n > 0 ? Math.min(cascata, max / n) : cascata;
    }
    /** Cor de brasa na letra: mistura `cor` na cor natural (q = 1 quente, 0 assentado) e um brilho em
        volta que some junto. Em q = 0 tira tudo (o quadro aprovado é o CSS). Letra de destaque
        (degradê recortado no texto) só recebe o brilho em volta. */
    function pintarCalor(el, q, cor) {
      if (!el) return;
      if (el.__mCorBase === undefined) el.__mCorBase = getComputedStyle(el).color;
      const destaque = el.classList.contains('m-letra') && el.style.webkitTextFillColor === 'transparent';
      if (q <= 0.002) {
        if (!destaque) el.style.color = '';
        el.style.textShadow = '';
        return;
      }
      if (!destaque) el.style.color = `color-mix(in srgb, ${cor} ${(q * 100).toFixed(1)}%, ${el.__mCorBase})`;
      el.style.textShadow = `0 0 ${(0.34 * q).toFixed(3)}em color-mix(in srgb, ${cor} ${(q * 62).toFixed(1)}%, transparent)`;
    }

    function juntar(...listas) {
      const n = Math.max(0, ...listas.filter(Boolean).map((l) => l.length));
      const out = [];
      for (let i = 0; i < n; i++) {
        const e = { x: 0, y: 0, r: 0, blur: 0, s: 1, o: 1, bright: 1 };
        for (const l of listas) {
          const x = l && l[i];
          if (!x) continue;
          if (x.x) e.x += x.x;
          if (x.y) e.y += x.y;
          if (x.r) e.r += x.r;
          if (x.blur) e.blur += x.blur;
          if (x.s !== undefined) e.s *= x.s;
          if (x.o !== undefined) e.o *= x.o;
          if (x.bright !== undefined) e.bright *= x.bright;
          if (x.sx !== undefined) e.sx = (e.sx ?? 1) * x.sx;
          if (x.sy !== undefined) e.sy = (e.sy ?? 1) * x.sy;
        }
        out.push(e);
      }
      return out;
    }

    function aplicar(partes, ...listas) {
      const est = juntar(...listas);
      partes.forEach((p, i) => {
        const e = est[i];
        if (!e) return;
        const o = { x: e.x, y: e.y, r: e.r, s: e.s, o: e.o, blur: e.blur, bright: e.bright, pre: '' };
        if (e.sx !== undefined || e.sy !== undefined) Object.assign(o, { sx: e.sx ?? 1, sy: e.sy ?? 1 });
        api.set(p.el, o);
      });
      return est;
    }
    const fim = (partes, est, op) => {
      if (op.aplicar !== false) aplicar(partes, est);
      return est;
    };

    /* ─── receitas ─── */

    /** C3.1 Desfoque → foco, subida curta, por letra ou palavra. A base de tudo. */
    function focar(t, partes, op = {}) {
      const letra = partes[0] && partes[0].tipo === 'letra';
      const {
        inicio = 0,
        cascata = letra ? estilo.cascataLetra : estilo.cascataPalavra,
        dur = estilo.entrada,
        subida = estilo.subida,
        desfoque = estilo.desfoque,
        opacidade = estilo.opacidade,
        curva = curvaPadrao,
        ordem = 'normal',
        escala = 1,
        lateral = 0,
        cascataMax = 0.5,
      } = op;
      const casc = limitarCascata(cascata, partes, ordem, cascataMax);
      const est = partes.map((p) => {
        const t0 = inicio + casc * rankDe(p, partes, ordem);
        const e = curva(prog(t, t0, t0 + dur));
        return {
          x: lateral * p.corpo * (1 - e),
          y: subida * p.corpo * (1 - e),
          blur: desfoque * p.corpo * (1 - e),
          o: suave(prog(t, t0, t0 + opacidade)),
          s: lerp(escala, 1, e),
        };
      });
      return fim(partes, est, op);
    }

    /** C3.2 A lente encontra a frase: uma profundidade z por letra gera ampliação a partir do eixo,
        tracking proporcional, subida curta e desfoque de profundidade contra o foco. */
    function lente(t, partes, op = {}) {
      const {
        inicio = 0,
        cascata = estilo.cascataLetra,
        z0 = 1,
        mag = 0.32,
        tracking = 0.21,
        plano = 0.4,
        letra = 0.34,
        dof = 0.19,
        foco = 0,
        subida = estilo.subida,
        opacidade = 0.16,
        ordem = 'normal',
        cascataMax = 0.55,
      } = op;
      const cascL = limitarCascata(cascata, partes, ordem, cascataMax);
      const focoT = typeof foco === 'function' ? foco(t) : foco;
      const { eixo = 'palavra' } = op;
      if (!partes.__mLente) {
        // centro e índice de cada letra dentro da palavra: cada palavra é um plano que amplia a
        // partir do próprio centro (amplia a partir do eixo do quadro com eixo: 'quadro')
        const pal = {};
        for (const p of partes) (pal[p.palavra] = pal[p.palavra] || []).push(p);
        for (const k in pal) {
          const l = pal[k].sort((a, b) => a.cx - b.cx);
          const esq = Math.min(...l.map((p) => p.x0)), dir = Math.max(...l.map((p) => p.x0 + p.l));
          const cy = l.reduce((s, p) => s + p.cy, 0) / l.length;
          l.forEach((p, j) => Object.assign(p, { __pc: [(esq + dir) / 2, cy], __pi: j, __pn: l.length }));
        }
        partes.__mLente = true;
      }
      const iniPalavra = {};
      partes.forEach((p) => {
        const t0 = inicio + cascL * rankDe(p, partes, ordem);
        p.__t0 = t0;
        if (iniPalavra[p.palavra] === undefined || t0 < iniPalavra[p.palavra]) iniPalavra[p.palavra] = t0;
      });
      const est = partes.map((p) => {
        const t0 = p.__t0;
        const zl = z0 * (1 - ease.outExpo(prog(t, t0, t0 + letra)));
        const tp = iniPalavra[p.palavra];
        const zp = z0 * (1 - ease.outExpo(prog(t, tp, tp + plano)));
        const c = eixo === 'quadro' ? [0, 0] : p.__pc;
        const trk = eixo === 'quadro'
          ? ((p.iLinha ?? p.i) - ((p.nLinha ?? partes.length) - 1) / 2) * tracking * p.corpo
          : (p.__pi - (p.__pn - 1) / 2) * tracking * p.corpo;
        return {
          x: ((p.cx - c[0]) * mag + trk) * zp,
          y: (p.cy - c[1]) * mag * zp + subida * p.corpo * zl,
          s: 1 + mag * zp,
          blur: dof * p.corpo * Math.abs(zl - focoT),
          o: suave(prog(t, t0, t0 + opacidade)),
        };
      });
      return fim(partes, est, op);
    }

    /** Cada linha sobe de trás de uma máscara na própria linha de base (dividir por 'linha' com mascara: true). */
    function mascara(t, partes, op = {}) {
      const { inicio = 0, cascata = 0.08, dur = 0.7, curva = curvaPadrao, ordem = 'normal', desfoque = 0 } = op;
      const est = partes.map((p) => {
        const t0 = inicio + cascata * rankDe(p, partes, ordem);
        const e = curva(prog(t, t0, t0 + dur));
        return { y: p.a * 1.08 * (1 - e), o: suave(prog(t, t0, t0 + 0.06)), blur: desfoque * p.corpo * (1 - e) };
      });
      return fim(partes, est, op);
    }

    /** Saída rápida que acelera até o último quadro. modo: desfoque | tracking | pontas | camera. */
    function sair(t, partes, op = {}) {
      const dur = op.dur ?? estilo.saida;
      const { inicio = api.dur - dur, modo = 'desfoque', curva = ease.inExpo, desfoque = estilo.desfoque * 1.5 } = op;
      const cascata = op.cascata ?? (modo === 'pontas' ? 0.035 : 0);
      const ordem = op.ordem ?? (modo === 'pontas' ? 'pontas' : 'normal');
      const nMax = Math.max(0, ...partes.map((p) => rankDe(p, partes, ordem)));
      const est = partes.map((p) => {
        // a última parte termina junto com a saída: as outras começam antes
        const t0 = inicio + cascata * (rankDe(p, partes, ordem) - nMax);
        const e = curva(prog(t, t0, t0 + dur));
        const c = ((p.nLinha ?? partes.length) - 1) / 2;
        const d = (p.iLinha ?? p.i) - c;
        if (modo === 'tracking') return { x: d * 0.28 * p.corpo * e, o: 1 - e, blur: desfoque * 0.6 * p.corpo * e };
        if (modo === 'camera') return { s: 1 + 1.4 * e, x: p.cx * 1.4 * e, y: p.cy * 1.4 * e, o: 1 - e * e, blur: desfoque * 1.6 * p.corpo * e };
        return { y: -estilo.subida * 0.6 * p.corpo * e, o: 1 - e, blur: desfoque * p.corpo * e };
      });
      return fim(partes, est, op);
    }

    /** Reflexo de borda nítida que atravessa a palavra uma vez (soma luz, não engorda a letra).
        Precisa de partes por letra. Passe { aplicar } não: o brilho é desenhado por ::after. */
    function brilho(t, partes, op = {}) {
      const { inicio = 0, dur = 0.7, angulo = 104, nucleo = 0.19, borda = 0.13, forca = 0.5, cor = 'var(--brilho, #ffffff)' } = op;
      if (!partes.length) return;
      if (!partes.__mBrilho) {
        const esq = Math.min(...partes.map((p) => p.x0));
        const dir = Math.max(...partes.map((p) => p.x0 + p.l));
        const corpo = partes[0].corpo;
        const meia = (nucleo / 2 + borda) * corpo;
        const caixa = Math.max(meia * 2 + 2 * corpo * 0.6, corpo * 1.2);
        const tinta = `color-mix(in srgb, ${cor} ${Math.round(clamp(forca) * 1000) / 10}%, transparent)`;
        for (const p of partes) {
          p.el.dataset.mCh = p.el.textContent;
          p.el.classList.add('m-brilho');
          const s = p.el.style;
          s.setProperty('--m-brilho-tinta', tinta);
          s.setProperty('--m-brilho-angulo', `${angulo}deg`);
          s.setProperty('--m-brilho-nucleo', `${((nucleo / 2) * corpo).toFixed(4)}cqw`);
          s.setProperty('--m-brilho-meia', `${meia.toFixed(4)}cqw`);
          s.setProperty('--m-brilho-caixa', `${caixa.toFixed(4)}cqw`);
        }
        partes.__mBrilho = { esq, dir, caixa, alcance: meia + corpo * 0.5 };
      }
      const B = partes.__mBrilho;
      const ativo = t > inicio && t < inicio + dur;
      const pos = B.esq - B.alcance + (B.dir - B.esq + 2 * B.alcance) * prog(t, inicio, inicio + dur);
      for (const p of partes) {
        // posição da máscara no ::after (que começa 0,2 em à esquerda da letra)
        const x = ativo ? pos - p.x0 + 0.2 * p.corpo - B.caixa / 2 : -400;
        p.el.style.setProperty('--m-brilho-x', `${x.toFixed(4)}cqw`);
      }
    }

    /** C3.5 Tracking largo e fora de foco que fecha até o aprovado e continua fechando de leve no hold. */
    function aproximar(t, partes, op = {}) {
      const { inicio = 0, dur = 1.0, espaco = 0.5, desfoque = estilo.desfoque, fecha = 0.004, ref = api.ref, curva = ease.outQuart, opacidade = 0.3 } = op;
      const e = curva(prog(t, inicio, inicio + dur));
      const est = partes.map((p) => {
        const d = (p.iLinha ?? p.i) - ((p.nLinha ?? partes.length) - 1) / 2;
        return { x: d * p.corpo * (espaco * (1 - e) - fecha * (t - ref)), blur: desfoque * p.corpo * (1 - e), o: suave(prog(t, inicio, inicio + opacidade)) };
      });
      return fim(partes, est, op);
    }

    /** Depois do pouso o tracking continua abrindo bem devagar o hold inteiro (passa pelo aprovado em ref). */
    function exalar(t, partes, op = {}) {
      const { inicio = 0, velocidade = 0.0055, ref = api.ref } = op;
      const k = api.deriva(t, inicio, 0.6) - api.deriva(ref, inicio, 0.6);
      const est = partes.map((p) => {
        const d = (p.iLinha ?? p.i) - ((p.nLinha ?? partes.length) - 1) / 2;
        return { x: d * p.corpo * velocidade * k };
      });
      return fim(partes, est, op);
    }

    /** C3.9 As pontas partem primeiro e todas chegam juntas a um ponto; viram luz antes de encolher. */
    function sugar(t, partes, op = {}) {
      const { inicio = 0, dur = 0.25, ponto = [0, 0], espera = 0.06, escalaFinal = 0.2, curva = ease.inCubic } = op;
      const dists = partes.map((p) => Math.hypot(p.cx - ponto[0], p.cy - ponto[1]));
      const dMax = Math.max(1e-6, ...dists);
      const est = partes.map((p, i) => {
        const t0 = inicio + (1 - dists[i] / dMax) * espera;
        const e = curva(prog(t, t0, inicio + dur));
        return {
          x: (ponto[0] - p.cx) * e,
          y: (ponto[1] - p.cy) * e,
          s: lerp(1, escalaFinal, e),
          bright: 1 + 1.6 * suave(e * 1.4),
          blur: 0.14 * p.corpo * e,
          o: 1 - suave(prog(e, 0.72, 1)),
        };
      });
      return fim(partes, est, op);
    }

    /** C3.8 Primeiro o brilho da palavra inteira, depois as letras sobem de um horizonte, quentes,
        esfriando. Com `cor` (ex.: 'var(--destaque)'), a letra nasce NA cor de brasa e esfria até a
        cor dela (em letra clara, calor só por brilho vira mancha cinza). Legível em ~0,25 s por letra. */
    function nascerDaLuz(t, partes, op = {}) {
      const { inicio = 0, brilho: tb = 0.2, cascata = estilo.cascataLetra, dur = 0.5, calor = 2.2, subida = 0.35, ordem = 'normal', cor = null, cascataMax = 0.45 } = op;
      const casc = limitarCascata(cascata, partes, ordem, cascataMax);
      const silhueta = suave(prog(t, inicio, inicio + tb * 0.7)) * (cor ? 0.62 : 0.45);
      const est = partes.map((p) => {
        const t0 = inicio + tb + casc * rankDe(p, partes, ordem);
        const e = ease.outExpo(prog(t, t0, t0 + dur));
        const o = lerp(silhueta, 1, suave(prog(t, t0, t0 + 0.12)));
        const quente = 1 - ease.outCubic(prog(t, t0, t0 + dur * 1.6)); // 1 quente → 0 assentado
        if (cor) pintarCalor(p.el, quente, cor);
        return {
          y: subida * p.corpo * (1 - e),
          o,
          bright: cor ? 1 + 0.3 * quente : lerp(calor, 1, 1 - quente),
          // desfoque curto: a silhueta é macia, a letra fica nítida em ~0,2 s depois de nascer
          blur: (cor ? 0.07 : 0.1) * p.corpo * (1 - ease.outCubic(prog(t, t0 - 0.04, t0 + Math.min(0.22, dur * 0.45)))),
        };
      });
      return fim(partes, est, op);
    }

    /** C9.5 Letras vindas do fundo (pequenas, nítidas, em vórtice) ou de trás da câmera (enormes, desfocadas). */
    function cinetica(t, partes, op = {}) {
      const { inicio = 0, semente = 1, cascata = 0.03, dur = 0.8, de = 'misto', perto = 6.5, longe = 0.34, giro = 40, curva = curvaPadrao } = op;
      const est = partes.map((p, i) => {
        const r = rand(semente * 31.7 + i);
        const doFundo = de === 'fundo' || (de === 'misto' && r < 0.5);
        const ang = rand(semente * 17.1 + i * 3.3) * Math.PI * 2;
        const t0 = inicio + cascata * rank(i, partes.length, semente + 0.5);
        const e = curva(prog(t, t0, t0 + dur));
        let s0, dx, dy, r0, b0;
        if (doFundo) {
          s0 = longe;
          dx = Math.cos(ang) * p.corpo * 2.2 - p.cx * (1 - longe);
          dy = Math.sin(ang) * p.corpo * 2.2 - p.cy * (1 - longe);
          r0 = (rand(semente + i * 7.7) - 0.5) * 2 * giro;
          b0 = 0;
        } else {
          s0 = perto;
          dx = p.cx * (perto - 1) * 0.7 + Math.cos(ang) * p.corpo;
          dy = p.cy * (perto - 1) * 0.7 + Math.sin(ang) * p.corpo;
          r0 = (rand(semente + i * 5.1) - 0.5) * giro;
          b0 = 0.5 * p.corpo;
        }
        return {
          x: dx * (1 - e),
          y: dy * (1 - e),
          s: logLerp(s0, 1, e),
          r: r0 * (1 - e),
          blur: b0 * Math.pow(1 - e, 2),
          o: suave(prog(t, t0, t0 + 0.08)),
        };
      });
      return fim(partes, est, op);
    }

    /** C3.8 Letras entram na cor do texto; um véu de borda macia revela o degradê do destaque. */
    function varrerDestaque(t, partes, op = {}) {
      const { inicio = 0, dur = 0.5, suavidade = 0.8, cor = 'var(--texto)', curva = ease.inOutCubic } = op;
      const lista = partes.filter((p) => p.destaque);
      if (!lista.length) return;
      const esq = Math.min(...lista.map((p) => p.x0));
      const dir = Math.max(...lista.map((p) => p.x0 + p.l));
      const corpo = lista[0].corpo;
      const soft = suavidade * corpo;
      const pos = esq - soft + (dir - esq + 2 * soft) * curva(prog(t, inicio, inicio + dur));
      for (const p of lista) {
        const a = 1 - suave((pos - p.cx) / soft + 0.5);
        p.el.style.webkitTextFillColor = a <= 0.001 ? 'transparent' : `color-mix(in srgb, ${cor} ${(a * 100).toFixed(2)}%, transparent)`;
      }
    }

    /** O degradê do destaque gira um fio no hold (vida), passando pelo aprovado em ref. */
    function derivaDestaque(t, partes, op = {}) {
      const { graus = 4, periodo = 5, ref = api.ref, inicio = 0 } = op;
      const ang = graus * Math.sin((2 * Math.PI * (t - ref)) / periodo) * suave5(prog(t, inicio, inicio + 0.8));
      for (const p of partes) {
        if (!p.fundoBase) continue;
        const img = p.fundoBase.imagem.replace(/linear-gradient\((-?[\d.]+)deg/, (m, a) => `linear-gradient(${(parseFloat(a) + ang).toFixed(3)}deg`);
        p.el.style.backgroundImage = img;
      }
    }

    /** Número que conta e trava na batida (1 − (1−x)²). Só número verdadeiro. */
    function contar(t, el, op = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return;
      const { de = 0, ate = 100, inicio = 0, travar = inicio + 1, casas = 0, local = 'pt-BR', prefixo = '', sufixo = '' } = op;
      const x = prog(t, inicio, travar);
      const v = lerp(de, ate, 1 - (1 - x) * (1 - x));
      el.textContent = prefixo + v.toLocaleString(local, { minimumFractionDigits: casas, maximumFractionDigits: casas }) + sufixo;
    }

    /** Digitação determinística (busca, terminal, campo de mockup). */
    function digitar(t, el, op = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return;
      if (el.__mTexto === undefined) el.__mTexto = op.texto ?? el.textContent;
      const { inicio = 0, cps = 18, cursor = true } = op;
      const txt = el.__mTexto;
      const n = clamp(Math.floor((t - inicio) * cps), 0, txt.length);
      const fimDigitar = inicio + txt.length / cps;
      el.textContent = txt.slice(0, n);
      if (cursor) {
        const c = document.createElement('span');
        c.className = 'm-cursor';
        c.style.opacity = String(1 - suave(prog(t, fimDigitar + 0.3, fimDigitar + 0.6)));
        el.appendChild(c);
      }
    }

    /** Vida no hold na camada do texto (escala ≤ 1 %), nunca em letter-spacing. */
    function respirar(t, el, op = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      const { amp = 0.006, periodo = 4, inicio = 0, fase = 0 } = op;
      api.set(el, { s: 1 + api.vida(t, { inicio, periodo, amp, fase }), subpixel: true });
    }

    /** C3.3 Um bloco desliza de `de` a `ate` (cqw) com arranque macio e pouso em que velocidade e
        desaceleração chegam juntas a zero; rastro de obturador na direção do movimento. */
    function empurrar(t, el, op = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return;
      const { de = 0, ate = 0, inicio = 0, fim: tf = inicio + 0.7, eixo = 'x', pouso = 0.5, obturador = true } = op;
      const chave = `${inicio}|${tf}|${pouso}`;
      el.__mTraj = el.__mTraj || {};
      if (!el.__mTraj[chave]) {
        const rampa = Math.min(0.09, (tf - inicio) * 0.2);
        el.__mTraj[chave] = api.trajeto((tt) => suave5(prog(tt, inicio, inicio + rampa)) * (1.15 - 0.6 * prog(tt, inicio, tf)), inicio, tf, { pouso });
      }
      const pos = (tt) => lerp(de, ate, el.__mTraj[chave](tt));
      const v = pos(t);
      api.set(el, eixo === 'x' ? { x: v } : { y: v });
      if (obturador && api.fx) {
        const vel = api.fx.velocidade(pos, t);
        api.fx.obturador(el, eixo === 'x' ? vel : 0, eixo === 'x' ? 0 : vel);
      }
      return v;
    }

    /** Escala de filme sem chute: ajusta o corpo da letra para o texto ocupar `largura` (fração da
        largura do quadro) na linha mais longa, entre `min` e `max` cqmin. Chame no montar, ANTES de
        dividir: é layout (vale para o quadro aprovado e para o storyboard), não tempo. Devolve o
        corpo em cqmin. Ex.: api.tipo.caber(el.$('.palavra'), { largura: 0.84, max: 46 }). */
    function caber(el, { largura = 0.84, max = 60, min = 4 } = {}) {
      if (typeof el === 'string') el = R.conteudo.querySelector(el);
      if (!el) return null;
      const P = palco.getBoundingClientRect();
      const escala = P.width / palco.offsetWidth || 1;
      const um = Math.min(palco.offsetWidth, palco.offsetHeight) / 100;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
      // a linha mais larga (com <br> ou quebra natural): mede cada retângulo de linha do texto
      const range = document.createRange();
      range.selectNodeContents(el);
      const linhas = new Map();
      for (const r of range.getClientRects()) {
        if (r.width < 0.5) continue;
        const k = Math.round(r.top / (fs * escala * 0.5));
        const l = linhas.get(k) || [Infinity, -Infinity];
        linhas.set(k, [Math.min(l[0], r.left), Math.max(l[1], r.right)]);
      }
      let w = 0;
      for (const [a, b] of linhas.values()) w = Math.max(w, (b - a) / escala);
      if (!w) return fs / um;
      const alvo = largura * palco.offsetWidth;
      const novo = clamp((fs * alvo) / w / um, min, max);
      el.style.fontSize = `${novo.toFixed(3)}cqmin`;
      return novo;
    }

    api.tipo = {
      caber,
      dividir, semViuva, aplicar, juntar, rank,
      focar, lente, mascara, sair, brilho, aproximar, exalar, sugar, nascerDaLuz, cinetica,
      varrerDestaque, derivaDestaque, contar, digitar, respirar, empurrar,
      revelar: focar, pintarCalor, limitarCascata,
    };
    // atalhos com os nomes de sempre
    api.dividir = dividir;
    api.revelar = focar;
  });
})();
