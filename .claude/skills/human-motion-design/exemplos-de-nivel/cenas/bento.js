/* bento — "Bento que acende" (5 s).
   Ideia: a frase nasce no eixo da cena anterior, ainda dentro da luz dela, e o degradê varre o
   destaque. Na batida 3 as letras são sugadas para um único ponto de luz; o ponto estoura no
   símbolo do card herói e o card se abre a partir dele, grande, e assenta. Do símbolo sai uma
   frente de luz que atravessa a grade por trás do vidro: cada card acende quando ela passa. Cada
   conteúdo trava numa batida (trilha e número em 2,75; infinito e data em 3,0). No fim a grade
   recua e escurece, só o card das capas fica aceso, o leque se recolhe com um clique e a câmera
   mergulha na capa da frente até o estado exato do primeiro quadro da órbita.

   Camadas (de trás para a frente): chão de luz da cena anterior · luz da frase · atmosfera da
   próxima cena · luz de trás da grade · frente de luz · cards de vidro · frase · ponto de luz.
   Câmera: push-in de 3 % até o quadro aprovado (4,25), com paralaxe (símbolo 4,5 %, grade 3 %,
   luz 1,5 %); recuo de 2,5 % na antecipação; mergulho em log na capa (0,58 s).
   Saída: "na-cena" (o mergulho termina no primeiro quadro da órbita, que começa com a mesma capa).

   Em pé (9:16): a frase quebra em duas linhas no centro da área segura e o bento vira uma grade
   alta de 3 colunas: o card herói é o protagonista na coluna do meio (seis linhas), com o card das
   capas em cima dele e o ao vivo embaixo; os outros nas laterais e os pequenos na última faixa.
   Dentro de cada card o texto é maior, para ler no celular; a grade ocupa a área segura (12–80 %
   da altura, 87 % da largura). A frente de luz percorre a mesma fração do raio até o card mais
   longe (a cascata leva o mesmo tempo) e o mergulho leva a capa ao ponto onde a órbita em pé
   começa (NEXT_V). Tempos e curvas iguais aos do 16:9.

   TROQUE: TEXTO (frase, títulos, legendas, número, data). As capas vêm de midia/ (fotos) ou da
   arte de demonstração em _comum.js. O número conta até o valor que está escrito (só número
   verdadeiro); a data rola como um odômetro até o que está escrito. */
(function () {
  const TEXTO = {
    frase: 'E ainda tem <span class="destaque">muito mais</span>',
    acesso: ['Acesso<br>completo', 'No seu tempo,<br>sem prazo'],
    caminhos: ['Novos<br>caminhos', 'Trilhas para<br>ir além'],
    conteudo: 'Conteúdo atual<br>e futuro',
    encontros: 'Encontros<br>ao vivo',
    numero: ['12 mil', 'pessoas na<br>comunidade'],
    data: ['Ao vivo', '20.03', 'Data do<br>lançamento'],
    marcaA: 'Atlas',
    marcaB: 'PRO',
    pequenos: [['intel', 'brilhos', 'Assistente'], ['lib', 'biblioteca', 'Biblioteca'], ['lives', null, 'Aulas ao vivo'], ['cert', 'selo', 'Certificados'], ['career', 'pasta', 'Carreira']],
    capas: [0, 1, 2], // capas do leque (a última é a da frente: a primeira capa da órbita)
  };
  const I = (b) => `<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const ICONES = {
    infinito: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
    brilhos: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4"/><circle cx="4" cy="20" r="2"/>',
    biblioteca: '<path d="m16 6l4 14M12 6v14M8 8v12M4 4v16"/>',
    selo: '<path d="m15.477 12.89l1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    pasta: '<path d="M12 12h.01M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m14 7a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  };

  // Primeiro quadro da órbita (orbita.js em t = 0): a capa da frente no centro com largura
  // capa × 2,6, sem giro, raio e sombra no mesmo fator, e a atmosfera em escala ≈ 0,988.
  const NEXT_16 = { s: 2.6, cy: 0, coreS: 1 + 0.015 * Math.sin(-2.84 * 2.4), coreO: 0.95 + 0.05 * Math.cos((2 * Math.PI * -2.84) / 3.2) };
  // Em pé (orbita.js, VERT): a capa única abre a órbita com 2,6 × 2,2 capas de largura, no meio da
  // largura e 4 cqw acima do meio da altura (CY), com a atmosfera no mesmo eixo.
  const NEXT_V = { ...NEXT_16, s: 2.6 * 2.2, cy: -4 };

  const T = {
    char0: -0.06, // a primeira letra já está se formando no quadro do corte
    charGap: 0.018,
    sweep: [0.3, 0.75], // o degradê varre o destaque
    converge: [1.5, 1.75], // batida 3: as letras são sugadas para o ponto de luz
    star: 1.74, // o ponto estoura no símbolo e o card se abre a partir dele
    open: [1.74, 2.24],
    settle: [1.8, 2.5],
    ring: [2.0, 2.95], // batida 4: a frente de luz sai do símbolo e atravessa a grade
    ringMax: 1250, // px
    cam: [1.75, 4.25], // push-in de 3 % até o quadro aprovado
    trail: 2.2,
    trailPop: 2.75,
    count: [2.15, 2.75], // o número trava
    inf: [2.3, 3.0], // o infinito fecha
    odo: [2.3, 3.0], // a data trava (colunas em 2,7 · 2,8 · 2,9 · 3,0)
    glint: [3.0, 3.36],
    antic: [4.25, 4.5], // a grade recua e escurece, só o card das capas fica aceso
    fanClose: [4.25, 4.45],
    coverGlint: [4.3, 4.58],
    dive: [4.42, 5.0], // mergulho na capa da frente
  };
  const smooth5 = (x) => x * x * x * (x * (6 * x - 15) + 10);
  // Deriva que não para: rampa suave em `ramp` s e depois velocidade constante (0 em t0, 1 em t1).
  const glide = (t, t0, t1, ramp) => {
    const g = (x) => (x <= 0 ? 0 : x < ramp ? (x * x) / (2 * ramp) : x - ramp / 2);
    return g(t - t0) / g(t1 - t0);
  };
  const draw = (el, p) => {
    el.style.strokeDasharray = p >= 0.9995 ? 'none' : '1 1';
    el.style.strokeDashoffset = (1 - p).toFixed(4);
  };
  const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const filterOf = (blur, bright = 1) => {
    const f = [];
    if (blur > 0.004) f.push(`blur(${blur.toFixed(3)}cqw)`);
    if (Math.abs(bright - 1) > 0.002) f.push(`brightness(${bright.toFixed(3)})`);
    return f.join(' ') || 'none';
  };
  Motion.cena('bento', {
    render: (c) => {
      const wave = [28, 52, 78, 44, 92, 66, 100, 58, 84, 38, 62, 34, 18].map((h) => `<span style="--h:${h}%"></span>`).join('');
      const fan = TEXTO.capas.map((i, k) => {
        const [fx, fr] = [[-2.6, -10], [2.6, 10], [0, 0]][k] || [0, 0];
        return window.Capas.html(c, i, { classe: k === TEXTO.capas.length - 1 ? 'capa-frente' : '', extra: `style="--fx:${fx}cqw;--fr:${fr}deg"` });
      }).join('');
      const marca = `<span class="heroi-marca"><span class="ha">${c.esc(TEXTO.marcaA)}</span>${c.svg('simbolo')}<span class="hb">${c.esc(TEXTO.marcaB)}</span></span>`;
      const mini = ([k, ic, nome]) => (ic
        ? `<div class="card m-vidro mini c-${k}${k === 'intel' ? ' forte m-vidro-forte' : ''}">${I(ICONES[ic])}<h3>${c.esc(nome)}</h3></div>`
        : `<div class="card m-vidro mini c-${k}"><span class="ao-vivo">${c.esc(nome)}</span></div>`);
      return `
        <svg class="defs" aria-hidden="true"><defs>
          <linearGradient id="bt-aurora" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop offset="0" style="stop-color:var(--brilho)"/><stop offset=".55" style="stop-color:var(--destaque)"/><stop offset="1" style="stop-color:var(--luz-3)"/></linearGradient>
          <linearGradient id="bt-trilha" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0"><stop offset="0" style="stop-color:var(--brilho)"/><stop offset=".6" style="stop-color:var(--destaque)"/><stop offset="1" style="stop-color:var(--luz-3)"/></linearGradient>
          <linearGradient id="bt-simbolo" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brilho)"/><stop offset=".35" style="stop-color:var(--destaque)"/><stop offset=".5" style="stop-color:var(--brilho);stop-opacity:.9"/><stop offset=".65" style="stop-color:var(--destaque)"/><stop offset="1" style="stop-color:var(--luz-3)"/></linearGradient>
          <linearGradient id="bt-reflexo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--brilho);stop-opacity:0"/><stop offset=".42" style="stop-color:var(--brilho);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--brilho);stop-opacity:.55"/><stop offset=".58" style="stop-color:var(--brilho);stop-opacity:0"/><stop offset="1" style="stop-color:var(--brilho);stop-opacity:0"/></linearGradient>
        </defs></svg>
        <div class="camada chao"></div><div class="camada orbe"></div><div class="camada nucleo"></div>
        <div class="bento">
          <span class="bento-luz"></span><span class="onda"></span>
          <div class="card m-vidro c-life"><span class="viz"><span class="neon">${I(ICONES.infinito)}${I(ICONES.infinito)}</span></span><h3>${TEXTO.acesso[0]}</h3><p class="legenda">${TEXTO.acesso[1]}</p></div>
          <div class="card m-vidro c-form"><span class="viz"><svg class="trilha" viewBox="0 0 120 50" aria-hidden="true"><path d="M8 40 C22 40 26 20 42 20 S64 32 80 30 S100 12 112 10"/><circle cx="8" cy="40" r="3"/><circle cx="42" cy="20" r="3"/><circle cx="80" cy="30" r="3"/><circle class="ultimo" cx="112" cy="10" r="4.5"/></svg></span><h3>${TEXTO.caminhos[0]}</h3><p class="legenda">${TEXTO.caminhos[1]}</p></div>
          <div class="card m-vidro c-fut"><span class="fut-vidro"></span><span class="viz"><span class="leque">${fan}</span></span><h3>${TEXTO.conteudo}</h3></div>
          <div class="card m-vidro m-vidro-heroi c-brand"><span class="heroi"><span class="heroi-luz"></span><span class="heroi-aura">${c.svg('simbolo')}</span><span class="heroi-corpo">${c.svg('simbolo')}</span><span class="heroi-reflexo">${c.svg('simbolo')}</span></span>${marca}</div>
          <div class="card m-vidro m-vidro-forte forte c-exp"><span class="viz"><span class="onda-voz">${wave}</span></span><h3>${TEXTO.encontros}</h3></div>
          <div class="card m-vidro c-comm"><span class="numero grad">${c.esc(TEXTO.numero[0])}</span><p class="legenda">${TEXTO.numero[1]}</p></div>
          <div class="card m-vidro c-rev"><span class="ao-vivo">${c.esc(TEXTO.data[0])}</span><span class="data grad">${c.esc(TEXTO.data[1])}</span><p class="legenda">${TEXTO.data[2]}</p></div>
          ${TEXTO.pequenos.map(mini).join('')}
        </div>
        <div class="pilha bento-frase"><h2 class="titulo frase">${TEXTO.frase}</h2></div>
        <span class="faisca"></span>
        <div class="camada vinheta"></div>`;
    },

    montar(el, api) {
      const root = el.raiz;
      const $ = (s, e = root) => e.querySelector(s);
      const $$ = (s, e = root) => [...e.querySelectorAll(s)];
      const palco = Motion.palco;
      const fr = palco.getBoundingClientRect();
      const k = fr.width / palco.offsetWidth;
      const CQ = palco.offsetWidth / 100;
      const C = { x: palco.offsetWidth / 2, y: palco.offsetHeight / 2 };
      const box = (e) => {
        const r = e.getBoundingClientRect();
        const l = (r.left - fr.left) / k, t = (r.top - fr.top) / k, w = r.width / k, h = r.height / k;
        return { l, t, w, h, r: l + w, b: t + h, x: l + w / 2, y: t + h / 2 };
      };
      const svgNS = 'http://www.w3.org/2000/svg';
      const sample = (path, n = 240) => {
        const L = path.getTotalLength();
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const p = path.getPointAtLength((L * i) / n);
          pts.push([p.x, p.y]);
        }
        return pts;
      };
      const drawable = (e) => {
        e.setAttribute('pathLength', '1');
        e.style.strokeDasharray = '1 1';
        e.style.strokeDashoffset = '1';
      };
      const PI2 = Math.PI * 2;
      const V = api.vertical;
      const NEXT = V ? NEXT_V : { ...NEXT_16 };
      const B = (el.b = { CQ, C, V, NEXT });
      B.orb = $('.orbe');
      B.floor = $('.chao');
      B.core = $('.nucleo');
      B.bento = $('.bento');
      B.light = $('.bento-luz');
      B.wave = $('.onda');
      B.lead = $('.bento-frase');
      B.title = $('.frase');
      B.spark = $('.faisca');
      B.vinheta = $('.vinheta');

      // Frase: letras + varredura do degradê (um véu da cor do texto com borda macia desliza para a
      // direita e revela o degradê por baixo, contínuo entre as letras).
      B.chars = api.tipo.dividir(B.title, { por: 'letra' }).map((p) => p.el);
      const accent = $('.destaque', B.title);
      const aw = accent.getBoundingClientRect().width / k;
      B.sweepW = aw;
      B.sweep = $$('.m-letra', accent).map((c) => {
        const [px, py] = c.style.backgroundPosition.split(' ').map(parseFloat);
        const [sw, sh] = c.style.backgroundSize.split(' ').map(parseFloat);
        const wide = api.fx.degradeLargo(c.style.backgroundImage, sw, sh, 0.16);
        c.style.backgroundImage = 'linear-gradient(100deg, transparent 0%, transparent 46%, var(--texto) 54%, var(--texto) 100%), ' + wide.img;
        c.style.backgroundSize = `${(aw * 4).toFixed(2)}px ${sh}px, ${wide.W1.toFixed(2)}px ${sh}px`;
        return { el: c, px, py, off: wide.m * sw };
      });
      const tb = box(B.title);
      B.P = { x: tb.x, y: tb.y };
      // Posição de layout (sem transformações) de cada letra até o centro da frase.
      const page = (e) => {
        let x = 0, y = 0;
        for (let n = e; n && n !== palco; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
        return { x, y };
      };
      const tp = page(B.title);
      const tcx = tp.x + B.title.offsetWidth / 2, tcy = tp.y + B.title.offsetHeight / 2;
      B.charsInfo = B.chars.map((c, i) => {
        const cp = page(c);
        return { el: c, i, dx: (cp.x + c.offsetWidth / 2 - tcx) / CQ, dy: (cp.y + c.offsetHeight / 2 - tcy) / CQ, edge: 0 };
      });
      // em pé a frase tem duas linhas: as pontas são as letras mais longe do centro, nos dois eixos
      const dist = (c) => (V ? Math.hypot(c.dx, c.dy) : Math.abs(c.dx));
      const maxD = Math.max(...B.charsInfo.map(dist)) || 1;
      B.charsInfo.forEach((c) => { c.edge = dist(c) / maxD; });

      const bb = box(B.bento);
      // pivô da escala: o centro do quadro; em pé, o centro da grade (ela fica acima do meio)
      B.O = V ? { x: bb.x, y: bb.y } : C;

      // Card herói e o símbolo (medidos no quadro final).
      const brand = $('.c-brand');
      const bc = box(brand);
      const star = $('.heroi', brand);
      const sc = box(star);
      const sx = sc.x - bc.l, sy = sc.y - bc.t;
      const far = Math.max(...[[0, 0], [bc.w, 0], [0, bc.h], [bc.w, bc.h]].map(([x, y]) => Math.hypot(x - sx, y - sy)));
      B.brand = {
        el: brand, c: bc, star, sx, sy,
        starDy: sc.y - bc.y,
        rMax: far / 0.55 + 4,
        logo: $('.heroi-marca', brand),
        ph: 1.1, per: 3.6,
      };
      B.ringC = { x: sc.x - bb.l, y: sc.y - bb.t };
      B.gridW = bb.w;
      B.gridH = bb.h;
      // em pé a grade é mais estreita e mais alta: a frente percorre a mesma fração do raio até o card
      // mais distante que no 16:9 (≈ 0,56), então a cascata de acender leva o mesmo tempo
      const nearOf = (c) => Math.hypot(Math.max(c.l - sc.x, 0, sc.x - c.r), Math.max(c.t - sc.y, 0, sc.y - c.b));
      B.ringMax = V ? Math.max(...$$('.card').filter((e) => e !== brand).map((e) => nearOf(box(e)))) / 0.56 : T.ringMax;
      B.ringK = B.ringMax / T.ringMax;
      const ringTime = (R) => api.fx.tempoDaFrente(R, { inicio: T.ring[0], fim: T.ring[1], raio: B.ringMax });

      const futEl = $('.c-fut');
      const futC = box(futEl);
      const tiles = $$('.card')
        .filter((e) => e !== brand)
        .map((e, i) => {
          const c = box(e);
          const ddx = Math.max(c.l - sc.x, 0, sc.x - c.r), ddy = Math.max(c.t - sc.y, 0, sc.y - c.b);
          const near = Math.hypot(ddx, ddy);
          const vx = c.x - sc.x, vy = c.y - sc.y, d = Math.hypot(vx, vy) || 1;
          const words = [];
          $$('h3, .legenda', e).forEach((t) => words.push(api.tipo.dividir(t, { por: 'palavra' }).map((p) => p.el)));
          return {
            el: e, c, ux: vx / d, uy: vy / d,
            t0: ringTime(near) - 0.02 + api.rand(i + 3) * 0.012,
            fx: (c.x - futC.x) / CQ, fy: (c.y - futC.y) / CQ,
            fut: e === futEl,
            words, live: $('.ao-vivo', e),
            ph: api.rand(i + 11) * PI2, per: 3.0 + 1.2 * api.rand(i + 23),
          };
        });
      B.tiles = tiles;
      B.brand.fx = (bc.x - futC.x) / CQ;
      B.brand.fy = (bc.y - futC.y) / CQ;
      const byClass = (cls) => tiles.find((t) => t.el.classList.contains(cls));

      // Infinito de neon: duas cópias (brilho borrado e traço nítido) + cabeça de luz que corre o traço.
      const life = byClass('c-life');
      const neon = $$('.neon .icone', life.el);
      life.neon = neon.map((svg) => {
        const p = $('path', svg);
        drawable(p);
        return { svg, p };
      });
      life.pts = sample(life.neon[1].p);
      const head = document.createElementNS(svgNS, 'circle');
      head.setAttribute('r', '1.05');
      Object.assign(head.style, { fill: 'var(--brilho)', stroke: 'none' });
      neon[1].appendChild(head);
      life.head = head;
      B.life = life;

      // Trilha: o traço se desenha, os pontos acendem quando a luz passa.
      const form = byClass('c-form');
      const route = $('.trilha', form.el);
      form.path = $('path', route);
      drawable(form.path);
      form.pts = sample(form.path);
      form.dots = $$('circle', route).map((c) => {
        const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy');
        let best = 0, bd = Infinity;
        form.pts.forEach(([x, y], i) => {
          const d = Math.hypot(x - cx, y - cy);
          if (d < bd) { bd = d; best = i; }
        });
        Object.assign(c.style, { transformBox: 'fill-box', transformOrigin: 'center' });
        return { el: c, f: best / (form.pts.length - 1) };
      });
      const fhead = document.createElementNS(svgNS, 'circle');
      fhead.setAttribute('r', '2.6');
      Object.assign(fhead.style, { fill: 'var(--brilho)' });
      const ping = document.createElementNS(svgNS, 'circle');
      const last = form.dots[form.dots.length - 1].el;
      ping.setAttribute('cx', last.getAttribute('cx'));
      ping.setAttribute('cy', last.getAttribute('cy'));
      Object.assign(ping.style, { fill: 'none', stroke: 'var(--destaque)', strokeWidth: '1.2' });
      form.path.after(ping);
      form.path.after(fhead);
      form.head = fhead;
      form.ping = ping;
      form.end = T.trail + (T.trailPop - T.trail) / 0.8043; // p = 0,97 cai na batida
      B.form = form;

      // Leque de capas; o vidro do card é uma camada própria para se apagar sem a capa.
      const fut = byClass('c-fut');
      fut.glass = $('.fut-vidro', fut.el);
      fut.viz = $('.viz', fut.el);
      fut.covers = $$('.leque .capa', fut.el).map((e, i) => ({
        el: e, i,
        fx: parseFloat(e.style.getPropertyValue('--fx')) || 0,
        fr: parseFloat(e.style.getPropertyValue('--fr')) || 0,
      }));
      const front = fut.covers.find((c) => c.el.classList.contains('capa-frente')) || fut.covers[fut.covers.length - 1];
      if (V) {
        // em pé as capas do leque são maiores (CSS): o leque abre na mesma proporção da capa
        const fanK = box(front.el).w / (7.4 * CQ);
        fut.covers.forEach((c) => { c.fx *= fanK; });
      }
      front.glint = document.createElement('span');
      front.glint.className = 'capa-reflexo';
      front.el.appendChild(front.glint);
      fut.front = front;
      B.fut = fut;
      const fc = box(front.el);
      const cs = getComputedStyle(root);
      const coverW = parseFloat(cs.getPropertyValue('--bt-capa-orbita')) || 10.5;
      const radius = parseFloat(getComputedStyle(front.el).borderTopLeftRadius) / CQ || 0.5;
      B.zoom = { cx: (fc.x - B.O.x) / CQ, cy: (fc.y - B.O.y) / CQ, w: fc.w / CQ, radius, rEnd: parseFloat(cs.getPropertyValue('--raio-capa')) || radius };
      if (V) {
        // onde a capa termina, em relação ao pivô da grade: o centro do quadro, deslocado como na órbita
        B.zoom.dx = (C.x - B.O.x) / CQ;
        B.zoom.dy = (C.y - B.O.y) / CQ + NEXT.cy;
      }
      B.zoom.s = (coverW * NEXT.s) / B.zoom.w;

      // Onda de voz.
      const exp = byClass('c-exp');
      exp.bars = $$('.onda-voz span', exp.el).map((e, i) => ({ el: e, i, h: parseFloat(e.style.getPropertyValue('--h')) || 50 }));
      B.exp = exp;

      // O número conta dentro de uma coluna de largura fixa, alinhada à direita.
      const comm = byClass('c-comm');
      comm.stat = $('.numero', comm.el);
      const sw = api.tipo.dividir(comm.stat, { por: 'palavra' }).map((p) => p.el);
      comm.num = sw[0];
      comm.num.style.textAlign = 'right';
      comm.target = parseInt(comm.num.textContent, 10) || 0;
      comm.img = getComputedStyle(comm.stat).backgroundImage;
      comm.stat.style.backgroundRepeat = 'no-repeat';
      B.comm = comm;

      // A data: odômetro do motor (os algarismos rolam como um tambor e travam um a um).
      const rev = byClass('c-rev');
      rev.numeral = $('.data', rev.el);
      rev.od = api.tipo.prepararOdometro(rev.numeral);
      B.rev = rev;

      // Medidas que dependem da fonte (já carregada no montar).
      const px = (e, prop) => parseFloat(getComputedStyle(e)[prop]) || 0;
      const probe = (host, text) => {
        const q = document.createElement('span');
        Object.assign(q.style, { display: 'inline-block', whiteSpace: 'pre' });
        q.textContent = text;
        host.appendChild(q);
        const w = px(q, 'width');
        q.remove();
        return w;
      };
      comm.num.style.width = probe(comm.stat, String(comm.target)).toFixed(2) + 'px';
      comm.num.style.display = 'inline-block';
      const st = comm.stat;
      comm.W = px(st, 'width') + px(st, 'paddingLeft') + px(st, 'paddingRight');
      const sH = px(st, 'height') + px(st, 'paddingTop') + px(st, 'paddingBottom');
      comm.wide = api.fx.degradeLargo(comm.img, comm.W, sH, 0.16);
      st.style.backgroundImage = comm.wide.img;
      st.style.backgroundSize = `${comm.wide.W1.toFixed(2)}px ${sH.toFixed(2)}px`;
      // Ícones pequenos: traço que se desenha.
      tiles.forEach((t) => {
        if (!t.el.classList.contains('mini')) return;
        t.icon = $('.icone', t.el);
        t.strokes = t.icon ? $$('path, circle, rect, line, polyline', t.icon) : [];
        t.strokes.forEach(drawable);
      });
    },

    quadro(t, el, api) {
      const B = el.b;
      if (!B) return;
      const NEXT = B.NEXT;
      const { set, tw, ease, prog, clamp, lerp, spring } = api;
      const CQ = B.CQ;
      const PI2 = Math.PI * 2;
      const tileIn = ease.bezier(0.25, 0, 0.25, 1);
      const osc = (period, ph = 0) => Math.sin((PI2 * (t - T.cam[1])) / period + ph);
      const env = (a, b) => smooth5(prog(t, a, b));
      // ── Câmera: push-in de 3 %, recuo de 2,5 % na antecipação, mergulho na capa da frente.
      const camG = (x) => ease.inOutSine(prog(x, T.cam[0], T.cam[0] + 3.75));
      const camN = camG(t) / camG(T.cam[1]);
      const cam = 0.97 + 0.03 * camN;
      const antic = ease.inOutSine(prog(t, T.antic[0], T.antic[1]));
      const S0 = cam * (1 - 0.025 * antic);
      const diveE = ease.bezier(0.45, 0, 0.6, 0.85);
      const zAt = (x) => diveE(prog(x, T.dive[0], T.dive[1]));
      const zp = zAt(t);
      const Z = B.zoom;
      const S = Math.exp(lerp(Math.log(S0), Math.log(Z.s), zp));
      const f = (S - S0) / (Z.s - S0);
      const zRate = ((Math.log(Z.s) - Math.log(S0)) * (zAt(t + 0.004) - zAt(t - 0.004))) / 0.008;
      // Em pé a capa sai do alto da grade e precisa descer até o meio: proporcional à escala (como no
      // 16:9) esse caminho ficaria todo nos últimos quadros e pararia seco no corte; aqui a posição da
      // capa na tela vai do lugar natural dela ao ponto da órbita com a própria curva (começa junto
      // com o mergulho, chega parada) e só a escala chega com embalo.
      const centre = B.V ? ease.bezier(0.42, 0, 0.25, 1)(prog(t, T.dive[0], T.dive[1])) : 0;
      const camX = B.V ? (Z.dx - Z.cx * S) * centre : -Z.cx * Z.s * f;
      const camY = B.V ? (Z.dy - Z.cy * S) * centre : -Z.cy * Z.s * f;
      set(B.bento, { pre: 'translate(-50%,-50%)', x: camX, y: camY, s: S, semEstalo: true });
      const O = B.O;
      const toLocal = (p) => ({ x: O.x + (p.x - O.x) / S, y: O.y + (p.y - O.y) / S });
      const toScreen = (p) => ({ x: O.x + (p.x - O.x) * S + camX * CQ, y: O.y + (p.y - O.y) * S + camY * CQ });
      const parStar = 1 - 0.015 * (1 - camN);
      const parLight = 1 + 0.015 * (1 - camN);

      // ── Luz: começa com o chão da cena anterior e vai à luz da frase em 0,5 s.
      set(B.floor, { pre: '', y: tw(t, 0, 0.6, 0, 3, ease.inOutSine), o: 0.85 * (1 - ease.inOutSine(prog(t, 0, 0.55))) });
      const orbLive = glide(t, 0.25, 1.5, 0.6);
      const orbBreath = 0.5 * (1 - Math.cos(PI2 * prog(t, 0.5, 1.6)));
      set(B.orb, {
        pre: '',
        x: 1.1 * orbLive,
        y: -0.8 * orbLive,
        s: (1 + 0.06 * glide(t, 0, 1.5, 0.5) + 0.02 * orbBreath) * lerp(1, 0.55, ease.inCubic(prog(t, 1.45, 1.9))),
        o: (1 - 0.05 * (1 - Math.cos(PI2 * prog(t, 0.35, 1.75)))) * (1 - ease.inOutSine(prog(t, 1.5, 2.2))),
      });
      const gone = smooth5(prog(t, 4.5, 4.88));
      set(B.core, { pre: '', y: NEXT.cy, s: NEXT.coreS, o: NEXT.coreO * ease.inOutSine(prog(zp, 0.15, 0.88)) });

      // ── A frase: letra a letra, do desfoque; na batida 3 é sugada para o centro (as pontas partem
      //    primeiro), encolhe e acende até virar um ponto de luz.
      set(B.title, {
        pre: '',
        y: tw(t, 0, 1.0, 1.1, 0, ease.forte),
        r: 0.03,
        s: (1 + 0.018 * glide(t, 0.2, 1.5, 0.6)) * lerp(1, 0.9, ease.inCubic(prog(t, 1.4, T.converge[1]))),
      });
      B.lead.style.opacity = t < T.converge[1] + 0.05 ? '1' : '0';
      B.charsInfo.forEach((c) => {
        const d = T.char0 + c.i * T.charGap;
        const c0 = T.converge[0] + 0.08 * (1 - c.edge);
        const q = prog(t, c0, T.converge[1]);
        const kc = ease.inCubic(q);
        const glow = ease.outSine(q);
        const halo = glow > 0.002 ? ` drop-shadow(0 0 ${(0.9 * glow).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${(70 * glow).toFixed(1)}%, transparent))` : '';
        const base = filterOf(tw(t, d, d + 0.48, 0.55, 0, ease.forte) + 0.28 * glow, 1 + 1.4 * glow);
        set(c.el, {
          pre: '',
          x: -c.dx * kc,
          y: tw(t, d, d + 0.55, 1.1, 0, ease.forte) - c.dy * kc,
          s: lerp(1, 0.2, kc),
          o: tw(t, d, d + 0.34, 0, 1, ease.outCubic) * (1 - ease.inOutSine(prog(q, 0.68, 1))),
          style: { filter: halo ? (base === 'none' ? '' : base) + halo : base },
        });
      });
      const e = lerp(-0.3, 1.3, ease.inOutCubic(prog(t, T.sweep[0], T.sweep[1]))) * B.sweepW;
      const auroraDrift = 0.115 * B.sweepW * 0.75 * glide(t, 0.5, 1.5, 0.5);
      B.sweep.forEach((c) => {
        c.el.style.backgroundPosition = `${(e - 2 * B.sweepW + c.px).toFixed(2)}px ${c.py}px, ${(c.px - c.off + auroraDrift).toFixed(2)}px ${c.py}px`;
      });

      // ── Card herói: nasce do símbolo, grande, com o símbolo no ponto de luz, e assenta.
      const br = B.brand;
      const born = t >= T.star;
      const cp = ease.bezier(0.3, 0, 0.12, 1.04)(prog(t, T.settle[0], T.settle[1]));
      const s0 = 1.45;
      const sCard = lerp(s0, 1, cp);
      const P = toLocal(B.P);
      const dx0 = P.x - br.c.x, dy0 = P.y - br.c.y - s0 * br.starDy;
      const cardX = br.c.x + dx0 * (1 - cp), cardY = br.c.y + dy0 * (1 - cp);
      const starNow = toScreen({ x: cardX, y: cardY + sCard * br.starDy });
      const dim = 1 - 0.4 * ease.inOutSine(prog(t, T.antic[0], T.antic[0] + 0.2));
      const push = 0.6 * Math.pow(zp, 1.2);
      const exitBlur = (1.8 * zp) / S;
      const openE = ease.bezier(0.25, 0.5, 0.25, 1);
      const R = br.rMax * openE(prog(t, T.open[0], T.open[1]));
      const opened = R >= br.rMax - 0.5;
      const mask = !born ? 'none' : opened ? 'none'
        : `radial-gradient(circle at ${br.sx.toFixed(1)}px ${br.sy.toFixed(1)}px, #000 ${(0.55 * R).toFixed(1)}px, transparent ${R.toFixed(1)}px)`;
      set(br.el, {
        pre: '',
        x: (dx0 * (1 - cp)) / CQ + br.fx * push,
        y: (dy0 * (1 - cp)) / CQ + br.fy * push,
        s: sCard,
        o: (born ? 1 : 0) * (1 - gone),
        style: { filter: filterOf(exitBlur, tw(t, T.star, T.star + 0.7, 1.4, 1, ease.outCubic) * dim), webkitMaskImage: mask, maskImage: mask },
      });
      const brandLive = env(2.5, 3.3);
      api.fx.luzDoVidro(br.el, t, { k: brandLive, luz: tw(t, T.star + 0.12, T.star + 0.9, 0, 1, tileIn), fase: br.ph, periodo: br.per, ref: T.cam[1] });
      // O símbolo nasce do ponto (0 → 1, −40° → −8°), aceso, e respira devagar.
      const breath = 1 + 0.04 * Math.sin(Math.PI * (t - T.cam[1])) * env(2.6, 3.3);
      set(br.star, {
        pre: 'translate(-50%,-50%)',
        r: tw(t, T.star, T.star + 1.3, -40, -8, ease.outExpo) + 0.4 * (t - T.cam[1]),
        s: Math.max(0, ease.outBack(1.2)(prog(t, T.star, T.star + 0.75))) * parStar * (1 + 0.008 * osc(3.1) * env(2.6, 3.4)),
        o: 0.95 * tw(t, T.star, T.star + 0.1, 0, 1, ease.inOutSine),
        style: { filter: filterOf(0, tw(t, T.star, T.star + 0.9, 1.6, 1, ease.outCubic) * breath) },
      });
      const l0 = 2.25;
      set(br.logo, {
        pre: '',
        y: tw(t, l0, l0 + 0.7, 1, 0, ease.forte),
        o: tw(t, l0, l0 + 0.45, 0, 1, ease.outCubic),
        blur: tw(t, l0, l0 + 0.6, 0.45, 0, ease.forte),
      });

      // ── Ponto de luz: cresce enquanto as letras chegam, estoura no símbolo e se desfaz nele.
      const grow = ease.inCubic(prog(t, T.converge[0] + 0.04, T.converge[1]));
      const burst = openE(prog(t, T.star, T.star + 0.34));
      const sp = t < T.star ? B.P : starNow;
      const spO = grow * (1 - ease.inOutSine(prog(t, T.star - 0.01, T.star + 0.3)));
      set(B.spark, {
        pre: `translate(${sp.x.toFixed(2)}px, ${sp.y.toFixed(2)}px) translate(-50%,-50%)`,
        s: (0.15 + 0.85 * grow) * (1 + 1.6 * burst),
        o: spO,
      });

      // ── Luz de trás: entra com a frente de luz, deriva mais devagar que a câmera e respira.
      const lightLive = env(2.6, 3.5);
      set(B.light, {
        pre: '',
        x: 0.3 * (t - T.cam[1]) + 0.35 * (osc(5.2, 0.9) - Math.sin(0.9)) * lightLive,
        y: 0.45 * (osc(4.4, 2.1) - Math.sin(2.1)) * lightLive,
        s: parLight * (1 + 0.04 * (1 - ease.outCubic(prog(t, T.ring[0], T.ring[0] + 1.2)))) * (1 + 0.015 * osc(3.8) * lightLive),
        o: ease.inOutSine(prog(t, T.ring[0] + 0.1, T.ring[0] + 0.9)) * (1 - 0.06 * (1 - Math.cos((PI2 * (t - T.cam[1])) / 2.8)) * lightLive) * (1 - gone),
        style: { filter: B.V ? 'blur(5cqw)' : 'blur(2.4cqw)' }, // o mesmo desfoque em px nos dois formatos
      });

      // ── Frente de luz: sai do símbolo na batida 4 e atravessa a grade por trás do vidro.
      api.fx.frenteDeLuz(B.wave, t, { centro: B.ringC, caixa: { w: B.gridW, h: B.gridH }, raio: B.ringMax, inicio: T.ring[0], fim: T.ring[1], banda: 240 * B.ringK, desfoque: B.V ? '1.25cqw' : '0.7cqw' });

      // ── Os cards: cada um acende quando a frente passa. Sobe de 96 % com um estalo de refração e a
      //    luz de trás floresce através do vidro depois de ele estar opaco.
      const futFade = 1 - smooth5(prog(t, 4.6, 4.87));
      B.tiles.forEach((tile) => {
        const tau = t - tile.t0;
        const ent = ease.outCubic(prog(tau, 0, 0.5));
        const off = 1.4 * (1 - ent);
        const isFut = tile.fut;
        set(tile.el, {
          pre: '',
          x: -tile.ux * off + (isFut ? 0 : tile.fx * push),
          y: -tile.uy * off + (isFut ? 0 : tile.fy * push),
          s: lerp(0.96, 1, ease.outBack(4)(prog(tau, 0, 0.22))) * (isFut ? 1 + 0.02 * antic * (1 - zp) : 1),
          post: isFut ? 'scale(0.99995)' : '',
          o: tw(tau, 0, 0.26, 0, 1, tileIn) * (isFut ? 1 : 1 - gone),
          style: { filter: filterOf(tw(tau, 0, 0.35, 0.6, 0, ease.outCubic) + (isFut ? 0 : exitBlur), isFut ? 1 : dim) },
        });
        const light = ease.outCubic(prog(tau, 0.04, 0.3)) * (1 + 0.6 * bell(tau, 0.34, 0.13));
        const tl = smooth5(prog(tau, 0.5, 1.3));
        api.fx.luzDoVidro(tile.el, t, { k: tl, luz: light, fator: isFut ? futFade * (1 + 0.35 * antic) : 1, fase: tile.ph, periodo: tile.per, ref: T.cam[1] });
        const wf = isFut ? 1 - ease.inCubic(prog(t, T.dive[0] + 0.05, T.dive[0] + 0.27)) : 1;
        tile.words.forEach((ws, g) => {
          ws.forEach((w, i) => {
            const d = 0.12 + g * 0.12 + i * 0.035;
            set(w, {
              pre: '',
              y: tw(tau, d, d + 0.6, 0.9, 0, ease.forte),
              r: tau < d + 0.6 ? 0.03 : 0,
              o: tw(tau, d, d + 0.4, 0, 1, ease.outCubic) * wf,
              blur: tw(tau, d, d + 0.5, 0.35, 0, ease.forte),
            });
          });
        });
        if (tile.live) {
          const d = 0.1;
          set(tile.live, {
            pre: '',
            y: tw(tau, d, d + 0.6, 0.8, 0, ease.forte),
            r: tau < d + 0.6 ? 0.03 : 0,
            o: tw(tau, d, d + 0.4, 0, 1, ease.outCubic),
            blur: tw(tau, d, d + 0.5, 0.3, 0, ease.forte),
          });
          // Ponto ao vivo: respira a 2 Hz, na fase da batida, e solta um eco em 2,5 · 3,5 · 4,5.
          const on = prog(tau, 0.3, 0.6);
          const beat = 0.5 + 0.5 * Math.cos(PI2 * 2 * (t - 2.5));
          tile.live.style.setProperty('--ponto-s', (1 + 0.12 * on * beat).toFixed(3));
          const ph = (((t - 2.5) % 1) + 1) % 1;
          const hp = ease.outCubic(ph);
          const ha = 42 * on * Math.min(1, ph * 6) * Math.pow(1 - ph, 2);
          tile.live.style.setProperty('--ponto-eco', `0 0 ${(0.4 + 1.2 * hp).toFixed(3)}cqw ${(0.05 + 0.45 * hp).toFixed(3)}cqw color-mix(in srgb, var(--destaque) ${ha.toFixed(1)}%, transparent)`);
        }
        if (tile.icon) {
          tile.strokes.forEach((s, i) => {
            const d = 0.14 + i * 0.09;
            draw(s, ease.inOutCubic(prog(tau, d, d + 0.7)));
          });
          tile.icon.style.opacity = tw(tau, 0.12, 0.22, 0, 1, ease.linear).toFixed(3);
        }
      });

      // Infinito: traço de luz com uma cabeça que corre; fecha na batida 6 com um pico de brilho.
      const life = B.life;
      {
        const ie = ease.bezier(0.4, 0, 0.6, 0.8);
        const p = ie(prog(t, T.inf[0], T.inf[1]));
        draw(life.neon[1].p, p);
        draw(life.neon[0].p, ie(prog(t, T.inf[0] + 0.05, T.inf[1])));
        life.neon[1].svg.style.opacity = tw(t, T.inf[0] - 0.04, T.inf[0] + 0.06, 0, 1, ease.linear).toFixed(3);
        const flash = 1 + 0.2 * Math.sin(Math.PI * prog(t, T.inf[1], T.inf[1] + 0.15));
        const inhale = osc(2.6) * env(3.05, 3.8);
        life.neon[0].svg.style.opacity = (0.9 * tw(t, T.inf[0] + 0.1, T.inf[1], 0.35, 1, ease.inOutSine) * (1 + 0.08 * inhale)).toFixed(3);
        life.neon[0].svg.style.filter = `blur(0.9cqw) brightness(${flash.toFixed(3)})`;
        life.neon[0].svg.style.transform = `scale(${(1 + 0.025 * inhale).toFixed(4)})`;
        const [hx, hy] = life.pts[Math.round(p * (life.pts.length - 1))];
        life.head.setAttribute('cx', hx.toFixed(2));
        life.head.setAttribute('cy', hy.toFixed(2));
        life.head.style.opacity = (prog(t, T.inf[0] - 0.02, T.inf[0] + 0.06) * (1 - prog(p, 0.92, 1))).toFixed(3);
      }

      // Trilha: desenha, cada ponto acende quando a luz chega; o último estoura e solta um eco.
      const form = B.form;
      {
        const p = ease.inOutCubic(prog(t, T.trail, form.end));
        draw(form.path, p);
        const [hx, hy] = form.pts[Math.round(p * (form.pts.length - 1))];
        form.head.setAttribute('cx', hx.toFixed(2));
        form.head.setAttribute('cy', hy.toFixed(2));
        const hs = 1 - ease.inCubic(prog(t, T.trailPop, T.trailPop + 0.09));
        form.head.setAttribute('r', (2.6 * hs).toFixed(3));
        form.head.style.opacity = (prog(t, T.trail - 0.02, T.trail + 0.06) * (hs > 0.001 ? 1 : 0)).toFixed(3);
        form.dots.forEach((d, i) => {
          const lastDot = i === form.dots.length - 1;
          const pop = lastDot
            ? (t < T.trailPop ? 0 : lerp(0.6, 1, ease.outBack(2.4)(prog(t, T.trailPop, T.trailPop + 0.32))) * (1 + 0.07 * osc(1.9) * env(3.1, 3.8)))
            : ease.outBack(2.2)(prog(p, Math.max(0, d.f - 0.02), Math.min(1, d.f + 0.1)));
          d.el.style.transform = `scale(${Math.max(0, pop).toFixed(4)})`;
        });
        const pg = prog(t, T.trailPop + 0.02, T.trailPop + 0.8);
        form.ping.setAttribute('r', (4.5 + 8 * ease.outCubic(pg)).toFixed(2));
        form.ping.style.opacity = (pg > 0 ? 0.9 * Math.pow(1 - pg, 1.5) : 0).toFixed(3);
      }

      // Leque: abre com mola. Na antecipação as laterais se recolhem atrás da da frente, que dá um
      // clique; um brilho passa por ela. No mergulho ela vira a primeira capa da órbita.
      const fut = B.fut;
      {
        const tau = t - fut.t0;
        const close = ease.inOutCubic(prog(t, T.fanClose[0], T.fanClose[1]));
        const click = 0.035 * Math.sin(Math.PI * prog(t, T.fanClose[1] - 0.02, T.fanClose[1] + 0.14));
        const coverBlur = Math.min(0.3, 0.07 * Math.max(0, zRate - 1.2));
        const fanBreath = 1 + 0.05 * osc(3.2) * smooth5(prog(tau, 0.9, 1.7));
        fut.covers.forEach((c) => {
          const side = c !== fut.front;
          const d = 0.14 + (side ? 0.05 : 0);
          const spo = spring(tau - d, { freq: 1.25, damp: 5.6 }) * fanBreath;
          const tuck = 0.08 * Math.sin(Math.PI * prog(t, T.fanClose[1] - 0.06, T.fanClose[1] + 0.1));
          const kk = spo * (1 - close) - (side ? tuck : 0);
          const base = side ? 0.9 + 0.1 * spo * (1 - close) : tw(tau, 0.06, 0.7, 0.9, 1, ease.forte) * (1 + click);
          set(c.el, {
            pre: `translate(-50%,-50%) translateX(${(c.fx * kk).toFixed(3)}cqw) rotate(${(c.fr * kk).toFixed(3)}deg)`,
            y: tw(tau, 0.06, 0.66, 1.2, 0, ease.forte),
            r: side ? 0 : -2 * Math.sin(Math.PI * zp),
            s: base,
            post: side ? '' : 'scale(0.99995)',
            o: tw(tau, 0.06, 0.3, 0, 1, ease.outCubic) * (side ? 1 - prog(close, 0.7, 1) : 1),
            style: side ? { filter: 'none' } : {
              filter: filterOf(coverBlur / S),
              borderRadius: `${lerp(Z.radius, (Z.rEnd * NEXT.s) / Z.s, zp).toFixed(4)}cqw`,
              boxShadow: `0 ${lerp(0.5208, (0.52 * NEXT.s) / Z.s, zp).toFixed(4)}cqw ${(lerp(1.25, (1.25 * NEXT.s) / Z.s, zp) + 1e-4 * t).toFixed(6)}cqw color-mix(in srgb, var(--fundo) 20%, transparent)`,
            },
          });
        });
        const gq = prog(t, T.coverGlint[0], T.coverGlint[1]);
        fut.front.glint.style.opacity = (Math.sin(Math.PI * gq) * 0.9).toFixed(3);
        fut.front.glint.style.backgroundPosition = `${(100 - 100 * ease.inOutSine(gq)).toFixed(2)}% 0`;
        fut.glass.style.opacity = futFade.toFixed(4);
        fut.el.style.setProperty('--borda', futFade.toFixed(4));
        fut.el.style.backdropFilter = fut.el.style.webkitBackdropFilter =
          futFade >= 0.999 ? '' : futFade <= 0.001 ? 'none' : `blur(${((B.V ? 3.9 : 2.2) * futFade).toFixed(3)}cqw) saturate(${(1 + 0.35 * futFade).toFixed(3)})`;
        const gv = 1 - ease.inOutSine(prog(zp, 0, 0.66));
        fut.viz.style.filter = gv >= 0.999 ? '' : gv <= 0.001 ? 'none'
          : `drop-shadow(0 0 0.9cqw color-mix(in srgb, var(--destaque) ${(55 * gv).toFixed(1)}%, transparent))`;
      }

      // Onda de voz: as barras crescem da esquerda para a direita; uma onda de 2 Hz (a batida) viaja
      // por cima, forte no crescimento e leve no hold, sem parar.
      const exp = B.exp;
      {
        const tau = t - exp.t0;
        const amp = 0.3 * smooth5(prog(tau, 0.25, 0.65)) * (1 - 0.7 * ease.inOutSine(prog(t, 2.9, 3.5)));
        exp.bars.forEach((b) => {
          const g = ease.outCubic(prog(tau, 0.12 + b.i * 0.026, 0.5 + b.i * 0.026));
          const v = Math.sin(PI2 * 2 * t - b.i * 0.55);
          b.el.style.height = clamp(b.h * g * (1 + amp * v), 0, 104).toFixed(2) + '%';
        });
      }

      // O número: conta de 0 e trava na batida (2,75), desacelerando; depois o degradê deriva.
      const comm = B.comm;
      {
        const tau = t - comm.t0;
        const x = prog(t, T.count[0], T.count[1]);
        const nv = String(Math.floor(comm.target * (1 - (1 - x) ** 2) + 1e-6));
        if (comm.num.textContent !== nv) comm.num.textContent = nv;
        set(comm.stat, {
          pre: '',
          y: tw(tau, 0.1, 0.7, 0.9, 0, ease.forte),
          o: tw(tau, 0.1, 0.35, 0, 1, ease.outCubic),
          blur: tw(tau, 0.1, 0.5, 0.4, 0, ease.forte),
        });
        const cd = 0.09 * comm.W * 1.15 * (glide(t, T.count[1], T.cam[1], 0.7) - 1);
        comm.stat.style.backgroundPosition = `${(-comm.wide.m * comm.W - cd).toFixed(2)}px 0px`;
      }

      // A data: odômetro de verdade. Cada coluna rola 100 % e trava num algarismo (2,7 · 2,8 · 2,9 ·
      // 3,0); desfoque só vertical enquanto a velocidade é alta; no fecho um brilho atravessa.
      const rev = B.rev;
      {
        const tau = t - rev.t0;
        set(rev.numeral, { pre: '', y: tw(tau, 0.14, 0.8, 0.9, 0, ease.forte), o: tw(tau, 0.14, 0.36, 0, 1, ease.outCubic) });
        api.tipo.odometro(t, rev.od, { inicio: T.odo[0], trava: T.odo[1], brilho: T.glint, ref: T.cam[1], oResto: tw(tau, 0.3, 0.6, 0, 1, ease.outCubic) });
      }

      // A vinheta acompanha a cena (fica no lugar; só some quando a capa toma o quadro).
      set(B.vinheta, { o: 1 - smooth5(prog(zp, 0.3, 0.9)) });
    },
  });
})();
