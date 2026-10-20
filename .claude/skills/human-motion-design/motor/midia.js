/* midia.js — fotos, vídeos, SVG da marca e mockups.

   No render(c) da cena:
     c.foto('produto', { classe: 'hero', foco: '50% 30%' })  → <img> da pasta midia/ (ou marca/ativos/)
     c.fundo('textura')                                     → url("…") para usar em style
     c.video('gravacao-de-tela', { inicio: 1.2, velocidade: 1, loop: true })
                                                            → quadro a quadro, preso ao tempo local
     c.svg('logo', { classe: 'logo', viewBox: '0 0 120 40' })  → SVG inline (ids únicos por cópia), recortado na caixa
     c.svg('logo', { so: '.simbolo' })                      → só aquele grupo (o resto sai) e a caixa justa nele
     c.foto('sala', { plano: true, foco: '30% 40%' })       → foto de plano cheio, já com a sobra (classe .plano)
     c.midias()                                             → os nomes das fotos de midia/ (para montagens)
     c.ativo('simbolo')                                     → URL do arquivo
     c.mockup('celular', { tela: c.foto('app'), classe: 'aparelho' })
         tipos: celular · tablet · notebook · navegador · janela · cartao
   No quadro:
     api.midia.mockup(el, { rx, ry, r, s, x, y, z })        → pose 3D com sombra e reflexo coerentes */
(function () {
  'use strict';
  const MIDIA = window.MOTION_MIDIA || {};
  const SVG = window.MOTION_SVG || {};
  let copias = 0;

  const achar = (nome) => MIDIA[nome] || MIDIA[String(nome).replace(/\.[a-z0-9]+$/i, '')] || null;

  Motion.estenderC((c, ctx, R) => {
    const faltou = (nome, tipo) => {
      Motion.erro(R.id, 'render', null, `não achei ${tipo} "${nome}" em midia/ nem em marca/ativos/`);
      return `<div class="m-faltando">${c.esc(nome)}</div>`;
    };
    c.ativo = (nome) => {
      const m = achar(nome);
      return m ? m.url : '';
    };
    c.fundo = (nome) => {
      const m = achar(nome);
      return m ? `url("${m.url}")` : 'none';
    };
    c.foto = (nome, { classe = '', foco = '50% 50%', alt = '', plano = false } = {}) => {
      const m = achar(nome);
      if (!m) return faltou(nome, 'a foto');
      const tag = m.tipo === 'svg' && SVG[m.chave]
        ? c.svg(nome, { classe: `m-foto-svg ${classe}` })
        : `<img class="m-foto ${c.esc(classe)}" src="${m.url}" alt="${c.esc(alt)}" style="object-position:${c.esc(foco)}" draggable="false">`;
      return plano ? `<div class="plano">${tag}</div>` : tag;
    };
    /** Nomes das fotos (imagens) de midia/, em ordem alfabética. */
    c.midias = ({ tipos = ['imagem', 'svg'] } = {}) => {
      const vistos = new Set();
      return Object.values(MIDIA)
        .filter((m) => tipos.includes(m.tipo) && !m.url.includes('/ativos/') && !vistos.has(m.chave) && vistos.add(m.chave))
        .map((m) => m.chave)
        .sort();
    };
    c.video = (nome, { classe = '', inicio = 0, velocidade = 1, loop = true, foco = '50% 50%' } = {}) => {
      const m = achar(nome);
      if (!m || !m.quadros) return faltou(nome, 'o vídeo');
      const q = m.quadros;
      return `<img class="m-foto m-video ${c.esc(classe)}" src="${q.pasta}/${q.prefixo}${String(1).padStart(5, '0')}.${q.ext}" data-m-video="${c.esc(m.chave)}" data-inicio="${+inicio}" data-velocidade="${+velocidade}" data-loop="${loop ? 1 : 0}" style="object-position:${c.esc(foco)}" alt="" draggable="false">`;
    };
    c.svg = (nome, { classe = '', viewBox = null, so = null } = {}) => {
      const m = achar(nome);
      const fonte = m && SVG[m.chave];
      if (!fonte) return faltou(nome, 'o SVG');
      const n = ++copias;
      let s = fonte.replace(/<\?xml[^>]*>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
      const ids = [...s.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
      for (const id of ids) {
        const novo = `${id}-c${n}`;
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        s = s
          .replace(new RegExp(`\\bid="${esc}"`, 'g'), `id="${novo}"`)
          .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${novo})`)
          .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${novo}"`);
      }
      s = s.replace(/<svg\b([^>]*)>/, (all, attrs) => {
        let a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
        if (viewBox) a = a.replace(/\sviewBox="[^"]*"/, '') + ` viewBox="${viewBox}"`;
        const extra = `m-svg${viewBox || so ? ' m-recorte' : ''} ${classe}`;
        if (/\sclass="/.test(a)) a = a.replace(/\sclass="([^"]*)"/, ` class="$1 ${extra}"`);
        else a += ` class="${extra}"`;
        if (so) a += ` data-m-so="${c.esc(so)}"${viewBox ? ' data-m-viewbox="1"' : ''}`;
        return `<svg${a}>`;
      });
      return s;
    };
    c.mockup = (tipo = 'celular', { tela = '', classe = '' } = {}) => {
      const reflexo = '<div class="m-mockup-reflexo"></div>';
      switch (tipo) {
        case 'celular':
          return `<div class="m-mockup m-celular ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-tela">${tela}</div><div class="m-mockup-ilha"></div>${reflexo}</div></div>`;
        case 'tablet':
          return `<div class="m-mockup m-tablet ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-tela">${tela}</div>${reflexo}</div></div>`;
        case 'notebook':
          return `<div class="m-mockup m-notebook ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-tela">${tela}</div>${reflexo}</div><div class="m-mockup-base"></div></div>`;
        case 'navegador':
          return `<div class="m-mockup m-navegador ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-barra"><i></i><i></i><i></i></div><div class="m-mockup-tela">${tela}</div>${reflexo}</div></div>`;
        case 'janela':
          return `<div class="m-mockup m-janela ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-barra"></div><div class="m-mockup-tela">${tela}</div>${reflexo}</div></div>`;
        default:
          return `<div class="m-mockup m-cartao ${classe}"><div class="m-mockup-corpo"><div class="m-mockup-tela">${tela}</div>${reflexo}</div></div>`;
      }
    };
  });

  /* c.svg(nome, { so }): tira tudo que não é o grupo pedido e ajusta a caixa nele (antes do montar) */
  Motion.prepararMidia = function (R) {
    for (const svg of R.conteudo.querySelectorAll('svg[data-m-so]')) {
      const manter = [...svg.querySelectorAll(svg.dataset.mSo)];
      if (!manter.length) {
        Motion.erro(R.id, 'render', null, `c.svg: não achei "${svg.dataset.mSo}" dentro do SVG`);
        continue;
      }
      const fica = (n) => manter.some((k) => k === n || k.contains(n) || n.contains(k));
      const naoDesenha = /^(defs|mask|clippath|lineargradient|radialgradient|filter|pattern|symbol|style|title|desc|metadata)$/i;
      const podar = (pai) => {
        for (const n of [...pai.children]) {
          if (naoDesenha.test(n.tagName)) continue;
          if (!fica(n)) n.remove();
          else if (!manter.includes(n)) podar(n);
        }
      };
      podar(svg);
      if (!svg.dataset.mViewbox) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const k of manter) {
          try {
            const b = k.getBBox();
            x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
          } catch (_) {
            /* sem caixa */
          }
        }
        if (Number.isFinite(x0) && x1 > x0) {
          const f = Math.max(x1 - x0, y1 - y0) * 0.04;
          svg.setAttribute('viewBox', `${(x0 - f).toFixed(2)} ${(y0 - f).toFixed(2)} ${(x1 - x0 + 2 * f).toFixed(2)} ${(y1 - y0 + 2 * f).toFixed(2)}`);
        }
      }
    }
  };

  Motion.estender((api) => {
    api.midia = {
      /** Pose 3D de um mockup: giro, inclinação, escala; a sombra e o reflexo acompanham. */
      mockup(el, { rx = 0, ry = 0, r = 0, s = 1, x = 0, y = 0, z = 0, persp = 160, o } = {}) {
        if (!el) return;
        api.set(el, { pre: '', persp, x, y, z, rx, ry, r, s, ...(o !== undefined ? { o } : {}) });
        el.style.setProperty('--m-sombra-x', `${(-ry * 0.08).toFixed(3)}cqw`);
        el.style.setProperty('--m-sombra-y', `${(1.2 + rx * 0.06).toFixed(3)}cqw`);
        el.style.setProperty('--m-reflexo', `${(50 + ry * 2.2 - rx * 0.8).toFixed(2)}%`);
      },
    };
  });

  /* vídeos: troca o quadro pelo tempo local e espera decodificar */
  Motion.midiaNoQuadro = function (R, tl, pend) {
    if (!R.__videos) R.__videos = [...R.secao.querySelectorAll('img[data-m-video]')];
    for (const img of R.__videos) {
      const m = MIDIA[img.dataset.mVideo];
      if (!m || !m.quadros) continue;
      const q = m.quadros;
      let i = Math.floor(((+img.dataset.inicio || 0) + tl * (+img.dataset.velocidade || 1)) * q.fps + 1e-6);
      if (img.dataset.loop === '1') i = ((i % q.n) + q.n) % q.n;
      else i = Math.max(0, Math.min(q.n - 1, i));
      const src = `${q.pasta}/${q.prefixo}${String(i + 1).padStart(5, '0')}.${q.ext}`;
      if (img.__mSrc !== src) {
        img.__mSrc = src;
        img.src = src;
        if (img.decode) pend.push(img.decode().catch(() => {}));
      }
    }
  };
})();
