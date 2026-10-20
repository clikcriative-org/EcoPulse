/* revelacao — "Revelação em etapas" (5 s).
   Ideia: a marca é uma fechadura e a palavra gigante é o que ela guarda. A entrada é EM ETAPAS:
   (1) o símbolo acende do preto, um ponto de luz que cresce girando um fio, e a luz dele abre o
   fundo em volta; (2) a marca aparece inteira e FECHADA: uma frente de luz corre do símbolo para
   as pontas e cada letra acende quando ela passa, quente, do desfoque, assentando um fio para fora;
   (3) a marca fechada segura legível e viva (a câmera se aproxima devagar, o símbolo junta luz);
   (4) só então o símbolo gira meia volta como uma chave e a marca se abre, tirando de dentro os
   itens, enquanto a câmera recua do close até a faixa aberta.
   No fim do hold, a palavra que vai virar gigante brilha uma vez e é sugada para o símbolo; meia
   volta de novo, a marca tranca no alto na batida 3,0 e o clique solta a luz: uma gota cai do
   símbolo até um horizonte e dali nasce a palavra gigante, primeiro o brilho, depois a letra.

   Linha do tempo: acende 0,03 · marca inteira 0,12–0,4 · segura até 0,8 · chave 0,8 · abre até
   1,7 · reflexo 1,5–2,4 · brilho na palavra 2,06 · sugada 2,5 · tranca 3,0 · gota 3,03 · horizonte
   3,11 · palavra 3,22 · peso 3,46 · brilho especular 4,1 · aprovado 4,3.
   Saída: avançar-desfocar (motion.json), a próxima nasce no mesmo eixo.

   TROQUE: TEXTO (marca, itens, palavra gigante) e marca/ativos/simbolo.svg. A palavra gigante
   precisa aparecer escrita num item (é ela que o símbolo suga). Cores e fontes: marca/tokens.css.
   O CSS desenha a faixa aberta; o quadro aprovado (fechada no alto) sai do quadro(t).
   Em pé (9:16) a faixa vira um eixo vertical: ver montarV/quadroV abaixo. */
(function () {
  const TEXTO = {
    marcaA: 'Atlas',
    marcaB: 'PRO',
    // da esquerda para a direita; o símbolo fica no meio
    esquerda: [{ icone: 'infinito' }, { texto: 'Acesso completo' }],
    direita: [{ texto: 'Tudo o que vier depois' }, { icone: 'camadas' }],
    gigante: 'Completo',
  };
  const ICONES = {
    infinito: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
    camadas: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  };

  // ── Linha do tempo (s, locais) ─────────────────────────────────────────────
  const IGNITE = [0.03, 0.34];   // o símbolo acende do preto e cresce até o tamanho da marca
  const BIRTH = [0.03, 0.72];    // nasce girando um fio e desacelera até a pose da marca
  const BIRTH_TURN = 50;         // graus
  const FRONT = [0.12, 0.27];    // a luz corre do símbolo até a letra mais longe
  const LETTER = 0.3;            // cada letra, do desfoque ao foco
  const SETTLE = 0.05;           // cada letra nasce 5 % mais perto do símbolo e assenta para fora
  const KEY = [0.8, 1.04];       // meia volta de chave, 240 ms: destranca…
  const OPEN = [0.82, 1.7];      // …e só então a marca abre
  const CLOSE = [2.66, 3.0];     // tranca: as peças se tocam exatamente na batida 3,0
  const RISE = [2.64, 3.12];     // sobe e encolhe enquanto tranca
  const SPIN = [2.76, 3.0];      // meia volta para trancar
  const SEED = 2.06;             // brilho que atravessa a palavra no item
  const SUCK = 2.5;              // a palavra é sugada para dentro do símbolo
  const FLASH = [2.96, 3.16];    // clique
  const DROP = [3.03, 3.12];     // a luz cai do símbolo até o horizonte
  const LINE = 3.11;             // o horizonte nasce quando a gota chega
  const GLOW = 3.12;             // o brilho da palavra
  const GLOW_IN = [GLOW - 0.03, GLOW + 0.19];
  const WORD = 3.22, STAGGER = 0.026;
  const PUSH = 3.46;             // peso: a câmera empurra quando a palavra trava
  const SWEEP = [4.1, 4.66];     // brilho especular atravessa a palavra pronta
  const GLINT = [1.5, 2.42];     // no hold, um reflexo sai do símbolo e corre pelos itens
  const LINE_GAP = 1.2;          // o horizonte fica 1,2 cqw abaixo da linha de base
  const DRIFT_AT = 4.3;          // o degradê passa pelo desenho aprovado aqui
  const FINAL_Y = -11.2;         // a marca trancada, no alto (cqw)
  const CLOSE_W = 46;            // largura da marca fechada no close (cqw)
  const FINAL_W = 30;            // largura da marca trancada no quadro aprovado (cqw)
  const PAD = 0.35, FEATHER = 1.4, STAR_FEATHER = 0.8;

  /* ══ 9:16 (api.vertical) ═════════════════════════════════════════════════════════════════════
     A mesma fechadura, em pé, com a mesma linha do tempo. O símbolo acende perto do meio do
     quadro; a marca fechada aparece inteira e grande (~84 % da largura) enquanto a câmera desliza
     até ela ficar centrada, e segura. A chave gira e a marca abre NA VERTICAL: a primeira palavra
     dá um quarto de volta em torno do símbolo até o alto, a segunda até embaixo, no mesmo sentido
     da chave, e os itens saem de dentro do símbolo empilhados entre elas, no eixo (os da esquerda
     sobem, os da direita descem). Cada item só se materializa depois de passar inteiro da borda do
     símbolo. No fim do hold a palavra-chave é sugada para o símbolo, os itens voltam, a marca gira
     de volta, tranca, sobe e a palavra gigante nasce do horizonte ocupando a largura.
     Tudo em coordenadas da faixa: origem no símbolo, cqw na escala 1 (a coluna aberta). */
  const VT = {
    Y0: -4,            // o símbolo na coluna aberta, 4 cqw acima do meio: a coluna centra na área segura
    YF: 66,            // centro do símbolo na marca trancada (cqw a partir do topo)
    YV: 91.5,          // centro da palavra gigante (cqw a partir do topo)
    CLOSE_W: 84,       // a marca fechada em close ocupa ~84 % da largura
    FINAL_W: 56,       // a marca trancada no quadro aprovado
    GAP_C: -0.75,      // vão entre palavra e símbolo na marca fechada
    GAP: 3.1,          // entre itens, e entre o símbolo e os itens
    GAP_M: 3.6,        // entre a palavra da marca e o item mais de fora
    FEATHER: 5,        // distância em que cada item acende ao sair do símbolo
    SLIT: 3.6,         // borda do símbolo de onde os itens saem (acima e abaixo dele)
    PO: [0.86, 1.74],  // os itens saem (o de fora puxa, os de dentro vêm 60 ms depois)
    PC: [2.6, 2.94],   // e voltam (o de dentro primeiro)
    LAG: 0.06,
    GIG_W: 86,         // a palavra gigante nunca passa disto da largura
  };

  function montarV(el, api) {
    const { ease: E, prog, clamp, lerp, tw } = api;
    const O = (el.o = { V: true });
    O.faixa = el.$('.faixa');
    O.A = el.$('.peca-a');
    O.S = el.$('.peca-simbolo');
    O.B = el.$('.peca-b');
    O.chao = el.$('.chao');
    O.orbe = el.$('.orbe');
    O.halo = el.$('.halo-simbolo');
    O.vinheta = el.$('.vinheta');
    O.gota = el.$('.gota');
    const H = api.H;
    O.Y0 = VT.Y0;
    O.YF = VT.YF - H / 2;
    O.YV = VT.YV - H / 2;

    // ── A marca fechada (medida no layout, sem transformações): centro de cada peça em relação ao símbolo
    const bA = api.caixa(O.A), bS = api.caixa(O.S), bB = api.caixa(O.B);
    const Wc = bA.l + bS.l + bB.l + 2 * VT.GAP_C;
    const L0 = -Wc / 2;
    const cA = L0 + bA.l / 2;
    const cS = L0 + bA.l + VT.GAP_C + bS.l / 2;
    const cB = L0 + bA.l + VT.GAP_C + bS.l + VT.GAP_C + bB.l / 2;
    const xA = cA - cS, xB = cB - cS;
    const ZC = clamp(VT.CLOSE_W / Wc, 0.6, 1.6);
    const ZF = clamp(VT.FINAL_W / Wc, 0.4, 1.2);

    // ── Curvas: as mesmas do 16:9 ──
    const bell = (x, a, b) => Math.pow(Math.sin(Math.PI * prog(x, a, b)), 2);
    const smoothQ = (v) => { const q = clamp(v); return q * q * (3 - 2 * q); };
    const openCurve = E.bezier(0.35, 0.05, 0.2, 1);
    const closeCurve = E.bezier(0.62, 0, 0.18, 1);
    const riseCurve = E.bezier(0.55, 0, 0.12, 1);
    const openE = (x) => openCurve(prog(x, OPEN[0], OPEN[1]));
    const closeE = (x) => closeCurve(prog(x, CLOSE[0], CLOSE[1]));
    const riseE = (x) => riseCurve(prog(x, RISE[0], RISE[1]));
    const openAmt = (x) => openE(x) - closeE(x) - 0.014 * bell(x, 0.62, 0.9) + 0.016 * bell(x, 2.4, 2.76) - 0.012 * bell(x, 2.98, 3.26);
    const push = (x) => 1 + 0.012 * E.forte(prog(x, PUSH, PUSH + 0.5)) - 0.012 * E.inOutSine(prog(x, PUSH + 0.5, 5));
    const pushIn = (x) => 0.972 + 0.028 * E.outSine(prog(x, 0, 1.0));
    const zoom = (x) => lerp(ZC * pushIn(x), 1, openE(x));
    const drift = (x) => 0.015 * (1.9 - x) - 0.0021;
    const cam = (x) => (x < RISE[1]
      ? lerp(zoom(x) + openE(x) * drift(x), 0.978, E.inOutCubic(prog(x, RISE[0], RISE[1])))
      : tw(x, RISE[1], 5, 0.978, 1, E.outSine) * push(x));
    const bandScale = (x) => lerp(1, ZF, riseE(x)) * cam(x);
    const bandY = (x) => lerp(0, O.YF - O.Y0, riseE(x));
    const vitalS = (x) => tw(x, RISE[1], 5, 0.955, 1, E.outSine) * push(x);
    // Reenquadramento: o símbolo nasce no eixo; enquanto a marca acende a câmera desliza até a marca
    // fechada ficar centrada; ao abrir, o símbolo volta ao eixo (a coluna centra nele); ao trancar,
    // a marca volta a ficar centrada.
    const centerIn = (x) => E.bezier(0.45, 0, 0.3, 1)(prog(x, 0.03, 0.6));
    const pan = (x) => cS * bandScale(x) * centerIn(x) * (1 - smoothQ(openAmt(x)));
    const tick = (x, b) => { const q = prog(x, b - 0.02, b + 0.16); return 12.6 * Math.sin(Math.PI * q) * Math.pow(1 - q, 1.5); };
    const birthCurve = E.bezier(0.15, 0.6, 0.3, 1);
    const birthRot = (x) => -BIRTH_TURN * (1 - birthCurve(prog(x, BIRTH[0], BIRTH[1])));
    const keyTurn = (x, [a, b]) => 180 * E.inOutExpo(prog(x, a, b)) + tick(x, b);
    const starRot = (x) => birthRot(x) + keyTurn(x, KEY) + keyTurn(x, SPIN);
    const igniteE = (x) => E.outBack(1.1)(prog(x, IGNITE[0], IGNITE[1]));
    const shrinkE = (x) => E.bezier(0.4, 0, 0.2, 1)(prog(x, KEY[0] + 0.04, KEY[1] + 0.36));
    const lockE = (x) => E.outBack(2.0)(prog(x, 2.92, 3.2));
    const STAR_OPEN = 0.62;
    const starS = (x) => lerp(0.16, 1, igniteE(x)) * lerp(lerp(1, STAR_OPEN, shrinkE(x)), 1, lockE(x))
      * (1 + 0.03 * bell(x, 0.62, 0.92)) * (1 - 0.3 * bell(x, SPIN[0] - 0.04, SPIN[1] + 0.02));
    const spinSpeed = (x) => Math.abs(starRot(x + 0.004) - starRot(x - 0.004)) / 0.008;
    Object.assign(O, { bell, openAmt, cam, bandScale, bandY, vitalS, pan, starRot, starS, spinSpeed });

    // ── A coluna aberta, simétrica no símbolo: itens da esquerda em cima, da direita embaixo ──
    const sh = 0.5 * bS.a * STAR_OPEN;
    const folga = (it) => parseFloat(getComputedStyle(it).paddingTop) / (Motion.palco.offsetWidth / 100) || 0;
    const itens = api.$$('.item');
    const esquerda = itens.filter((it) => it.compareDocumentPosition(O.S) & Node.DOCUMENT_POSITION_FOLLOWING); // antes do símbolo
    const direita = itens.filter((it) => !esquerda.includes(it));
    const pilha = (lista, side) => {
      let borda = sh + VT.GAP;
      const ordem = side < 0 ? [...lista].reverse() : lista;
      return ordem.map((it, k) => {
        const b = api.caixa(it);
        const f = folga(it);
        const h = b.a - 2 * f;
        const y = side * (borda + h / 2);
        borda += h + VT.GAP;
        return { it, b, h, w: b.l - 2 * f, y, side, rank: ordem.length - 1 - k, n: ordem.length };
      });
    };
    const slots = [...pilha(esquerda, -1), ...pilha(direita, 1)];
    const topo = Math.min(...slots.filter((s) => s.side < 0).map((s) => s.y - s.h / 2), -sh);
    const base = Math.max(...slots.filter((s) => s.side > 0).map((s) => s.y + s.h / 2), sh);
    const yA = topo - VT.GAP_M - bA.a / 2;
    const yB = base + VT.GAP_M + bB.a / 2;
    // Um quarto de volta em torno do símbolo, no sentido da chave, num arco de elipse: o semieixo
    // horizontal é a distância na marca fechada e o vertical a da coluna. Antes de destrancar as
    // peças se apertam um fio; antes de trancar abrem um fio (o openAmt já traz isso).
    const arco = (u, a, b, side) => {
      const ph = (clamp(u) * Math.PI) / 2;
      const k = 1 + 2 * Math.min(u, 0) + 1.5 * Math.max(u - 1, 0);
      return [side * a * Math.cos(ph) * k, side * b * Math.sin(ph) * k];
    };
    O.arcA = (u) => arco(u, Math.abs(xA), Math.abs(yA), -1);
    O.arcB = (u) => arco(u, Math.abs(xB), Math.abs(yB), 1);

    // ── Letras da marca: a frente de luz sai do símbolo; distância medida NA MARCA FECHADA ──
    const letrasDe = (peca, xc) => {
      const bp = api.caixa(peca);
      return api.tipo.dividir(peca.querySelector('.marca-palavra'), { por: 'letra' }).map((p) => ({ el: p.el, cx: p.cx - bp.cx + xc }));
    };
    O.frente = api.tipo.frenteDeLetras([...letrasDe(O.A, xA), ...letrasDe(O.B, xB)], { distancia: (p) => p.cx, frente: FRONT, dur: LETTER, assentar: SETTLE });

    // ── Itens: saem do símbolo como um bloco por lado ──
    const pillOut = (x, lagO, lagC) => openCurve(prog(x, VT.PO[0] + lagO, VT.PO[1] + lagO)) - closeCurve(prog(x, VT.PC[0] + lagC, VT.PC[1] + lagC));
    const travel = Math.max(...slots.map((s) => Math.abs(s.y) + s.h / 2)) - VT.SLIT;
    O.travel = travel;
    const first = (a, b, test, fallback) => {
      for (let s = a; s <= b; s += 0.002) if (test(s)) return s;
      return fallback;
    };
    const alvo = TEXTO.gigante.toLowerCase();
    O.itens = slots.map((sl) => {
      const r = { el: sl.it, side: sl.side, y: sl.y, h: sl.h, w: sl.w, chars: [], paths: [] };
      const lagO = sl.rank * VT.LAG, lagC = (sl.n - 1 - sl.rank) * 0.04;
      r.out = (x) => pillOut(x, lagO, lagC);
      r.cy = (x) => r.y - r.side * (1 - r.out(x)) * travel;
      r.vis = (x) => smoothQ(((r.side < 0 ? -(r.cy(x) + r.h / 2) : r.cy(x) - r.h / 2) - VT.SLIT) / VT.FEATHER);
      r.t0 = first(VT.PO[0], 2.2, (s) => r.vis(s) > 0.01, VT.PO[0]);
      r.t1 = first(VT.PO[0], 2.2, (s) => r.vis(s) > 0.99, VT.PO[1]);
      r.reveal = first(VT.PO[0], 2.2, (s) => r.vis(s) > 0.2, VT.PO[1]);
      r.hide = first(VT.PC[0] - 0.1, VT.PC[1] + 0.1, (s) => r.vis(s) < 0.5, VT.PC[1]);
      const svg = sl.it.querySelector('svg');
      if (svg) {
        r.svg = svg;
        r.paths = [...svg.querySelectorAll('path')];
        r.paths.forEach((p) => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 2'; });
      } else {
        const texto = sl.it.querySelector('.item-texto');
        const palavras = texto.textContent.trim().split(/\s+/).map((w) => w.toLowerCase());
        const seedIdx = palavras.indexOf(alvo);
        r.chars = api.tipo.dividir(texto, { por: 'letra' }).map((p) => ({ el: p.el, x: p.cx - sl.b.cx, palavra: p.palavra }));
        if (seedIdx >= 0) {
          const sem = r.chars.filter((ch) => ch.palavra === seedIdx);
          sem.forEach((ch, k) => { ch.seed = k; });
        }
      }
      return r;
    });
    // os textos escrevem juntos, na ordem de leitura, quando a linha do texto passa
    const textos = O.itens.filter((r) => r.chars.length);
    const T0 = Math.max(...textos.map((r) => r.reveal)) + 0.02;
    textos.forEach((r) => r.chars.forEach((c, i) => { c.t = Math.max(T0 + i * 0.02, r.reveal + 0.02); }));

    // ── A palavra gigante (o mesmo preparo do 16:9), no maior corpo que cabe na largura ──
    O.gig = el.$('.gigante');
    O.gigBrilho = el.$('.gigante-brilho');
    O.gigPalavra = el.$('.gigante-palavra');
    const pb = api.tipo.dividir(O.gigBrilho, { por: 'letra' });
    const pp = api.tipo.dividir(O.gigPalavra, { por: 'letra' });
    const escala = Motion.palco.getBoundingClientRect().width / Motion.palco.offsetWidth || 1;
    const folgaLetras = (lista, dono) => {
      const caixa = dono.getBoundingClientRect();
      lista.forEach((p) => { p.el.style.padding = '0.12em'; p.el.style.margin = '-0.12em'; });
      lista.forEach((p) => {
        const r = p.el.getBoundingClientRect();
        p.el.style.backgroundSize = `${(caixa.width / escala).toFixed(2)}px ${(caixa.height / escala).toFixed(2)}px`;
        p.el.style.backgroundPosition = `${(-(r.left - caixa.left) / escala).toFixed(2)}px ${(-(r.top - caixa.top) / escala).toFixed(2)}px`;
      });
    };
    folgaLetras(pb, O.gigBrilho);
    folgaLetras(pp, O.gigPalavra);
    O.brilhoLetras = pb.map((p) => ({ el: p.el, img: p.el.style.backgroundImage }));
    O.palavraLetras = pp.map((p) => ({ el: p.el, img: p.el.style.backgroundImage, size: p.el.style.backgroundSize, pos: p.el.style.backgroundPosition }));
    const larg = Math.max(...pp.map((p) => p.cx + p.l / 2)) - Math.min(...pp.map((p) => p.cx - p.l / 2));
    O.fit = Math.min(1, VT.GIG_W / larg);
    // os gestos do 16:9 foram medidos para um corpo de 21 cqw: crescem com a palavra
    O.KG = (parseFloat(getComputedStyle(O.gig).fontSize) / (Motion.palco.offsetWidth / 100) / 21) * O.fit;
    const gc = api.caixaNaTela(O.gig);
    const sonda = document.createElement('span');
    sonda.style.cssText = 'display:inline-block;width:0;height:0';
    O.gigPalavra.appendChild(sonda);
    O.baseOff = api.caixaNaTela(sonda).y - gc.cy;
    sonda.remove();
    O.horizonte = document.createElement('div');
    O.horizonte.className = 'horizonte';
    O.gig.insertBefore(O.horizonte, O.gig.firstChild);
    O.landX = pan(3.1);
    const landOff = O.landX / (vitalS(LINE) * O.fit);
    O.lineX = (x) => landOff * (1 - E.forte(prog(x, LINE, LINE + 0.5)));
    O.aurora = (img, d, ang) => img
      .replace(/(-?\d+(?:\.\d+)?)deg/, `${ang.toFixed(2)}deg`)
      .replace(/(-?\d+(?:\.\d+)?)%/g, (m, v) => `${(parseFloat(v) + d).toFixed(2)}%`);
    O.ang0 = parseFloat((/(-?\d+(?:\.\d+)?)deg/.exec(O.palavraLetras[0].img) || [0, 100])[1]);
  }

  function quadroV(t, el, api) {
    const O = el.o;
    const { set, ease: E, prog, lerp, clamp, tw } = api;
    const { bell } = O;
    const TAU = Math.PI * 2;
    const wave = (x, period, phase = 0) => Math.sin(TAU * (x / period + phase));
    const crest = (x, period, at) => Math.cos((TAU * (x - at)) / period);
    const glowCss = (b) => (b > 0.002
      ? `drop-shadow(0 0 ${(1.3 * b).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(85 * Math.min(1, b))}%, transparent))`
      : '');
    const bs = O.bandScale(t), by = O.bandY(t), pan = O.pan(t);
    const sy0 = O.Y0 + by; // o símbolo na tela (cqw a partir do centro)

    // ── Luz de horizonte e atmosfera (a receita do 16:9, com a elipse em pé) ──
    set(O.chao, {
      pre: '',
      x: 0.9 * crest(t, 5.0, 3.0),
      y: tw(t, IGNITE[0], 1.5, 9, 0, E.bezier(0.25, 0.4, 0.25, 1)) + 0.7 * crest(t, 4.4, 1.1),
      s: tw(t, 0, 5, 1.06, 1, E.outSine) * (1.035 + 0.01 * crest(t, 3.3, 1.35)),
      o: tw(t, IGNITE[0], 1.1, 0, 0.85, E.bezier(0.35, 0, 0.3, 1)) * (1 + 0.1 * crest(t, 4.4, 3.0)),
    });
    set(O.orbe, {
      pre: '',
      x: 0.8 * wave(t, 4.6, 0.043),
      y: tw(t, LINE, 4.4, 4, 0, E.forte) + 0.6 * wave(t, 3.7, -0.189),
      s: tw(t, LINE, 4.6, 0.82, 1, E.forte) * (1 + 0.018 * wave(t, 3.1, 0.15)),
      o: tw(t, LINE, 3.9, 0, 1, E.outCubic) * (0.95 + 0.06 * wave(t, 2.5, 0.8)),
      bright: 1 + 0.08 * bell(t, PUSH - 0.02, PUSH + 0.2),
    });
    set(O.vinheta, { o: E.inOutSine(prog(t, 0.05, 0.95)) });

    // ── A marca: a faixa é um ponto (o símbolo) que a câmera move e escala ──
    set(O.faixa, { pre: `translate(${pan.toFixed(4)}cqw, ${sy0.toFixed(4)}cqw)`, s: bs });
    const u = O.openAmt(t);
    const naTela = (x, arc) => { const [ax, ay] = arc(O.openAmt(x)); const b = O.bandScale(x); return [O.pan(x) + ax * b, O.bandY(x) + ay * b]; };
    const vel = (arc) => { const a = naTela(t + 0.01, arc), b = naTela(t - 0.01, arc); return Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.02; };
    const [ax, ay] = O.arcA(u), [bx, byy] = O.arcB(u);
    set(O.A, { pre: 'translate(-50%,-50%)', x: ax, y: ay, blur: clamp(vel(O.arcA) * 0.0016, 0, 0.16) });
    set(O.B, { pre: 'translate(-50%,-50%)', x: bx, y: byy, blur: clamp(vel(O.arcB) * 0.0016, 0, 0.16) });
    O.frente.quadro(t, { escala: bs });

    // ── O símbolo ──
    const whirl = clamp(O.spinSpeed(t) / 2600, 0, 1);
    const flash = bell(t, FLASH[0], FLASH[1]);
    const ignite = 1 - E.outCubic(prog(t, IGNITE[0], 0.62));
    const charge = bell(t, SUCK + 0.05, CLOSE[1]);
    const gather = bell(t, 0.6, 0.94);
    const breathe = 0.5 + 0.5 * crest(t, 2.4, 1.6);
    set(O.S, {
      pre: 'translate(-50%,-50%)',
      s: O.starS(t),
      o: tw(t, IGNITE[0], IGNITE[0] + 0.09, 0, 1, E.outCubic),
      blur: 0.45 * ignite + 1.1 * Math.pow(whirl, 0.8),
      r: O.starRot(t) + 2.5 * crest(t, 6.0, 0.1) * (1 - E.inOutSine(prog(t, 2.45, 2.75))),
      bright: 1 + 2 * ignite + 1.3 * whirl + 0.3 * gather + 0.35 * charge + 1.0 * flash + 0.12 * breathe,
      filter: glowCss(0.9 * ignite * (t > IGNITE[0] ? 1 : 0) + 0.7 * whirl + 0.3 * gather + 1.2 * flash + 0.3 * charge + 0.14 * breathe),
    });
    // halo em pé: uma luz alta e muito esfumada atrás da coluna, presa ao símbolo
    set(O.halo, {
      pre: 'translate(-50%,-50%)',
      x: pan + 0.5 * crest(t, 4.4, 0.2),
      y: sy0 + 0.6 * crest(t, 5.2, 0.9),
      s: tw(t, KEY[0], OPEN[1] + 0.2, 0.4, 1, E.bezier(0.25, 0.6, 0.3, 1)) * (1 + 0.045 * crest(t, 2.7, 1.8)) * tw(t, 2.64, 3.0, 1, 0.25, E.inCubic) * bs,
      o: tw(t, KEY[0], OPEN[0] + 0.7, 0, 1, E.inOutSine) * (0.92 + 0.08 * crest(t, 2.3, 1.675)) * (1 - tw(t, 2.76, 3.02, 0, 1, E.inOutCubic)),
      blur: 4,
    });

    // ── Itens: saem de dentro do símbolo, empilhados no eixo ──
    const gone = tw(t, 2.8, 2.96, 0, 1, E.inCubic);
    // reflexo: nasce no símbolo e corre para fora pela coluna, para cima e para baixo, uma vez
    const gq = prog(t, GLINT[0], GLINT[1]);
    const gD = gq > 0 && gq < 1 ? lerp(-3, O.travel + 6, E.inOutSine(gq)) : -99;
    const glintAt = (y) => (gD < -50 ? 0 : Math.exp(-Math.pow((Math.abs(y) - gD) / 4.2, 2)));
    O.itens.forEach((r) => {
      const rs = tw(t, r.t0, r.t1 + 0.35, 0.96, 1, E.forte) * lerp(1, 0.97, gone);
      const cy = r.cy(t), vis = r.vis(t);
      const vy = (Math.abs(r.cy(t + 0.01) - r.cy(t - 0.01)) / 0.02) * bs;
      set(r.el, {
        pre: 'translate(-50%,-50%)',
        y: cy,
        s: rs,
        o: vis * (1 - gone),
        bright: tw(t, r.t0, r.t1 + 0.45, 1.8, 1, E.outCubic),
        blur: 0.45 * (1 - vis) + clamp(vy * 0.0016, 0, 0.18),
      });
      const g0 = glintAt(cy);
      r.chars.forEach((c) => {
        const off = tw(t, r.hide - 0.08, r.hide, 0, 1, E.inCubic);
        const p = {
          pre: '',
          y: tw(t, c.t, c.t + 0.45, 0.6, 0, E.forte),
          s: 1,
          o: tw(t, c.t, c.t + 0.22, 0, 1, E.outCubic) * (1 - off),
          blur: tw(t, c.t, c.t + 0.4, 0.5, 0, E.forte) + 0.3 * off,
          style: { color: '', textShadow: g0 > 0.01 ? `0 0 ${(1.2 * g0).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(80 * g0)}%, transparent)` : 'none' },
        };
        if (c.seed !== undefined) {
          // a palavra brilha uma vez e converge para o ponto do símbolo (escala e espaço juntos)
          const s0 = SEED + c.seed * 0.03;
          const g = bell(t, s0, s0 + 0.26);
          const kq = E.inCubic(prog(t, SUCK, SUCK + 0.24));
          const m = Math.max(g, kq, g0);
          p.x = ((0 - c.x) / rs) * kq;
          p.y += ((0 - cy) / rs) * kq;
          p.s = lerp(1, 0.1, kq);
          p.blur += 0.45 * kq;
          p.o *= 1 - prog(t, SUCK + 0.19, SUCK + 0.24);
          p.bright = 1 + 0.35 * g + 0.8 * kq;
          p.style = {
            color: `color-mix(in srgb, var(--brilho) ${Math.round(85 * Math.max(g, kq))}%, var(--texto))`,
            textShadow: m > 0.002 ? `0 0 ${(1.2 * m).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(85 * m)}%, transparent)` : 'none',
          };
        }
        set(c.el, p);
      });
      // ícones: o traço se desenha enquanto o item acende e apaga junto com ele
      r.paths.forEach((pth, k) => {
        const p0 = r.t0 + k * 0.05;
        const drawn = E.outCubic(prog(t, p0, p0 + 0.34));
        pth.style.strokeDashoffset = (1 - drawn).toFixed(4);
        pth.style.opacity = drawn > 0.002 ? '1' : '0';
      });
      if (r.svg) r.svg.style.filter = `drop-shadow(0 0 ${(0.9 + 1.2 * g0).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(35 + 50 * g0)}%, transparent))`;
    });

    // ── A gota e a palavra gigante (o mesmo gesto do 16:9, no corpo em pé) ──
    const K = O.KG;
    const vs = O.vitalS(t) * O.fit;
    const horizon = O.YV + (O.baseOff + LINE_GAP * K) * vs;
    const head = lerp(sy0, horizon, E.inCubic(prog(t, DROP[0], DROP[1])));
    const tail = lerp(sy0, horizon, E.inCubic(prog(t, DROP[0] + 0.025, DROP[1] + 0.04)));
    const len = Math.max(0.8, head - tail);
    set(O.gota, {
      pre: 'translate(-50%,-50%)',
      x: O.landX,
      y: (head + tail) / 2,
      sx: 1,
      sy: len / 10,
      o: tw(t, DROP[0] - 0.01, DROP[0] + 0.02, 0, 1, E.outCubic) * (1 - tw(t, DROP[1] + 0.01, DROP[1] + 0.05, 0, 1, E.inCubic)),
    });
    set(O.horizonte, {
      pre: 'translate(0,-50%)',
      x: O.lineX(t),
      y: O.baseOff + LINE_GAP * K,
      sx: tw(t, LINE, LINE + 0.51, 0.02, 1.15, E.forte),
      sy: tw(t, LINE, 4.0, 1, 0.5, E.outCubic),
      o: tw(t, LINE - 0.005, LINE + 0.06, 0, 1, E.outCubic) * (1 - tw(t, 3.6, 4.15, 0, 1, E.inOutSine)),
    });
    set(O.gig, { pre: `translateY(calc(-50% + ${O.YV.toFixed(3)}cqw))`, s: vs, o: t < 2.9 ? 0 : 1 });
    const drift = 7 * wave(t - DRIFT_AT, 4.6);
    const ang = O.ang0 + 5 * wave(t - DRIFT_AT, 5.8);
    const breath = wave(t, 2.2);
    const glowIn = E.bezier(0.3, 0, 0.2, 1)(prog(t, GLOW_IN[0], GLOW_IN[1]));
    set(O.gigBrilho, {
      pre: '',
      y: tw(t, GLOW, GLOW + 0.5, 0.9 * K, 0, E.forte),
      o: glowIn * lerp(1, 0.55 * (1 + 0.1 * breath), E.inOutSine(prog(t, 3.45, 4.2))),
      blur: K * ((t < GLOW_IN[1] ? lerp(3.4, 1.3, glowIn) : lerp(1.3, 2.6, E.inOutSine(prog(t, 3.3, 3.9)))) + 0.18 * wave(t, 3.1, 0.1) * prog(t, 3.3, 3.9)),
      bright: lerp(1.6, 1, E.inOutSine(prog(t, 3.4, 4.2))),
    });
    O.brilhoLetras.forEach((c) => set(c.el, { style: { backgroundImage: O.aurora(c.img, drift, ang) } }));
    const sweep = prog(t, SWEEP[0], SWEEP[1]);
    const sp = lerp(-8, 108, E.inOutSine(sweep));
    const sweepOn = sweep > 0 && sweep < 1;
    O.palavraLetras.forEach((L, i) => {
      const c0 = WORD + i * STAGGER;
      const img = O.aurora(L.img, drift, ang);
      set(L.el, {
        pre: '',
        y: tw(t, c0, c0 + 0.6, 1.1 * K, 0, E.forte),
        o: tw(t, c0, c0 + 0.2, 0, 1, E.outCubic),
        blur: tw(t, c0, c0 + 0.5, 1.2 * K, 0, E.forte),
        bright: tw(t, c0, c0 + 0.7, 2.2, 1, E.outCubic),
        style: sweepOn
          ? {
            backgroundImage: `linear-gradient(105deg, transparent ${(sp - 8).toFixed(2)}%, color-mix(in srgb, var(--brilho) 88%, transparent) ${sp.toFixed(2)}%, transparent ${(sp + 8).toFixed(2)}%), ${img}`,
            backgroundSize: `${L.size}, ${L.size}`,
            backgroundPosition: `${L.pos}, ${L.pos}`,
          }
          : { backgroundImage: img, backgroundSize: L.size, backgroundPosition: L.pos },
      });
    });
  }


  Motion.cena('revelacao', {
    render: (c) => {
      const item = (it) => (it.icone
        ? `<span class="item item-icone"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[it.icone] || ''}</svg></span>`
        : `<span class="item item-texto-caixa"><span class="item-texto">${c.esc(it.texto)}</span></span>`);
      return `
        <div class="chao"></div><div class="orbe"></div><span class="halo-simbolo"></span>
        <div class="faixa">
          <span class="peca peca-a"><span class="marca-palavra">${c.esc(TEXTO.marcaA)}</span></span>
          ${TEXTO.esquerda.map(item).join('')}
          <span class="peca peca-simbolo">${c.svg('simbolo')}</span>
          ${TEXTO.direita.map(item).join('')}
          <span class="peca peca-b"><span class="marca-palavra">${c.esc(TEXTO.marcaB)}</span></span>
        </div>
        <p class="gigante"><span class="gigante-brilho destaque" aria-hidden="true">${c.esc(TEXTO.gigante)}</span><span class="gigante-palavra destaque">${c.esc(TEXTO.gigante)}</span></p>
        <span class="gota"></span>
        <div class="vinheta"></div>`;
    },

    montar(el, api) {
      if (api.vertical) { montarV(el, api); return; }
      const { ease: E, prog, clamp, lerp } = api;
      const O = (el.o = {});
      O.faixa = el.$('.faixa');
      O.A = el.$('.peca-a');
      O.S = el.$('.peca-simbolo');
      O.B = el.$('.peca-b');
      O.chao = el.$('.chao');
      O.orbe = el.$('.orbe');
      O.halo = el.$('.halo-simbolo');
      O.vinheta = el.$('.vinheta');
      O.gota = el.$('.gota');
      O.H = api.H;

      // ── Geometria: a faixa aberta (CSS) e a marca fechada (calculada). cqw a partir do centro.
      const bA = api.caixa(O.A), bS = api.caixa(O.S), bB = api.caixa(O.B);
      const gapC = -0.3; // vão entre palavra e símbolo na marca fechada (as folhas do símbolo avançam sobre ele)
      const Wc = bA.l + bS.l + bB.l + 2 * gapC;
      const L0 = -Wc / 2;
      const cA = L0 + bA.l / 2;
      const cS = L0 + bA.l + gapC + bS.l / 2;
      const cB = L0 + bA.l + gapC + bS.l + gapC + bB.l / 2;
      O.dA = cA - bA.cx;
      O.dS = cS - bS.cx;
      O.dB = cB - bB.cx;
      O.sC = bS.cx;
      O.half = bS.l / 2;
      O.ZC = clamp(CLOSE_W / Wc, 1.05, 1.9);
      O.ZF = clamp(FINAL_W / Wc, 0.5, 1.2);

      // ── Abertura, câmera e símbolo (funções de t; o montar só fixa as medidas) ──
      const bell = (x, a, b) => Math.pow(Math.sin(Math.PI * prog(x, a, b)), 2);
      const openCurve = E.bezier(0.35, 0.05, 0.2, 1);
      const closeCurve = E.bezier(0.62, 0, 0.18, 1);
      const riseCurve = E.bezier(0.55, 0, 0.12, 1);
      const openE = (x) => openCurve(prog(x, OPEN[0], OPEN[1]));
      const closeE = (x) => closeCurve(prog(x, CLOSE[0], CLOSE[1]));
      const riseE = (x) => riseCurve(prog(x, RISE[0], RISE[1]));
      // 0 = fechada, 1 = aberta. Antes de destrancar as peças se apertam um fio contra o símbolo; antes
      // de trancar abrem um fio; na tranca passam um fio do ponto e voltam.
      const openAmt = (x) => openE(x) - closeE(x) - 0.014 * bell(x, 0.62, 0.9) + 0.016 * bell(x, 2.4, 2.76) - 0.012 * bell(x, 2.98, 3.26);
      // Câmera: a marca fechada em close com push-in que nunca para; ao abrir recua junto e desemboca
      // numa deriva de recuo (1,5 %/s); na subida vai a 0,978 e assenta; peso de 1,2 % em 3,46.
      const push = (x) => 1 + 0.012 * E.forte(prog(x, PUSH, PUSH + 0.5)) - 0.012 * E.inOutSine(prog(x, PUSH + 0.5, 5));
      const pushIn = (x) => 0.972 + 0.028 * E.outSine(prog(x, 0, 1.0));
      const zoom = (x) => lerp(O.ZC * pushIn(x), 1, openE(x));
      const drift = (x) => 0.015 * (1.9 - x) - 0.0021;
      const tw = api.tw;
      const cam = (x) => (x < RISE[1]
        ? lerp(zoom(x) + openE(x) * drift(x), 0.978, E.inOutCubic(prog(x, RISE[0], RISE[1])))
        : tw(x, RISE[1], 5, 0.978, 1, E.outSine) * push(x));
      const bandScale = (x) => lerp(1, O.ZF, riseE(x)) * cam(x);
      const bandY = (x) => lerp(0, FINAL_Y, riseE(x));
      const vitalS = (x) => tw(x, RISE[1], 5, 0.955, 1, E.outSine) * push(x);
      // Símbolo: nasce girando 50° que desaceleram; cada meia volta de chave é 240 ms em inOutExpo
      // (o meio vira risco de luz) com um tique de 6° além do ponto, que volta.
      const tick = (x, b) => { const q = prog(x, b - 0.02, b + 0.16); return 12.6 * Math.sin(Math.PI * q) * Math.pow(1 - q, 1.5); };
      const birthCurve = E.bezier(0.15, 0.6, 0.3, 1);
      const birthRot = (x) => -BIRTH_TURN * (1 - birthCurve(prog(x, BIRTH[0], BIRTH[1])));
      const keyTurn = (x, [a, b]) => 180 * E.inOutExpo(prog(x, a, b)) + tick(x, b);
      const starRot = (x) => birthRot(x) + keyTurn(x, KEY) + keyTurn(x, SPIN);
      const igniteE = (x) => E.outBack(1.1)(prog(x, IGNITE[0], IGNITE[1]));
      const shrinkE = (x) => E.bezier(0.4, 0, 0.2, 1)(prog(x, KEY[0] + 0.04, KEY[1] + 0.36));
      const lockE = (x) => E.outBack(2.0)(prog(x, 2.92, 3.2));
      const starS = (x) => lerp(0.16, 1, igniteE(x)) * lerp(lerp(1, 0.62, shrinkE(x)), 1, lockE(x))
        * (1 + 0.03 * bell(x, 0.62, 0.92)) * (1 - 0.3 * bell(x, SPIN[0] - 0.04, SPIN[1] + 0.02));
      const offS = (x) => O.dS * (1 - clamp(openAmt(x), 0, 1));
      const offA = (x) => O.dA * (1 - openAmt(x));
      const offB = (x) => O.dB * (1 - openAmt(x));
      const spinSpeed = (x) => Math.abs(starRot(x + 0.004) - starRot(x - 0.004)) / 0.008;
      Object.assign(O, { bell, openE, closeE, riseE, openAmt, cam, bandScale, bandY, vitalS, starRot, starS, offS, offA, offB, spinSpeed, push });

      // ── Letras da marca: acendem de uma frente de luz que sai do símbolo (api.tipo.frenteDeLetras);
      //    a distância de cada letra é medida NA MARCA FECHADA. ──
      const partes = [
        ...api.tipo.dividir(O.A.querySelector('.marca-palavra'), { por: 'letra' }).map((p) => ({ el: p.el, cx: p.cx + O.dA })),
        ...api.tipo.dividir(O.B.querySelector('.marca-palavra'), { por: 'letra' }).map((p) => ({ el: p.el, cx: p.cx + O.dB })),
      ];
      O.frente = api.tipo.frenteDeLetras(partes, { distancia: (p) => p.cx - cS, frente: FRONT, dur: LETTER, assentar: SETTLE });
      const letras = O.frente.partes;
      const emitOff = (d, x) => O.frente.recuo(x, d);
      const dIn = {
        [-1]: Math.max(...letras.filter((L) => L.d < 0).map((L) => L.d)),
        [1]: Math.min(...letras.filter((L) => L.d > 0).map((L) => L.d)),
      };
      // Janela de cada lado: entre a borda da peça que desliza (a letra mais perto do símbolo) e o
      // símbolo. Os itens só aparecem dentro dela: saem de DENTRO da marca.
      const aRight = bA.x + bA.l, bLeft = bB.x;
      O.win = {
        [-1]: (x) => [aRight + offA(x) + emitOff(dIn[-1], x) + PAD, O.sC + offS(x) - O.half * starS(x)],
        [1]: (x) => [O.sC + offS(x) + O.half * starS(x), bLeft + offB(x) + emitOff(dIn[1], x) - PAD],
      };
      const first = (a, b, test, fallback) => {
        for (let s = a; s <= b; s += 0.002) if (test(s)) return s;
        return fallback;
      };
      const inside = (side, x, s, m = 0.3) => { const [a, b] = O.win[side](s); return x >= a + m && x <= b - m; };
      const shown = (side, l, r, s) => { const [a, b] = O.win[side](s); return Math.max(0, Math.min(r, b) - Math.max(l, a)); };

      // ── Itens ──
      const alvo = TEXTO.gigante.toLowerCase();
      O.itens = api.$$('.item').map((it) => {
        const b = api.caixa(it);
        const side = b.cx < O.sC ? -1 : 1;
        const r = {
          el: it, l: b.x, w: b.l, c: b.cx, side, chars: [], paths: [],
          t0: first(OPEN[0], 2.2, (s) => shown(side, b.x, b.x + b.l, s) > 0.3, OPEN[0]),
          t1: first(OPEN[0], 2.2, (s) => shown(side, b.x, b.x + b.l, s) >= b.l - 0.1, OPEN[1]),
        };
        const reveal = (x) => first(OPEN[0], 2.2, (s) => inside(side, x, s), OPEN[1]);
        const cover = (x) => first(CLOSE[0], CLOSE[1] + 0.1, (s) => !inside(side, x, s, 0), CLOSE[1] - 0.04);
        const svg = it.querySelector('svg');
        if (svg) {
          r.paths = [...svg.querySelectorAll('path')];
          r.paths.forEach((p) => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 2'; });
          r.draw = reveal(b.cx);
          r.hide = cover(b.cx);
          r.x = b.cx;
        } else {
          const texto = it.querySelector('.item-texto');
          const palavras = texto.textContent.trim().split(/\s+/).map((w) => w.toLowerCase());
          const seedIdx = palavras.indexOf(alvo);
          const partes = api.tipo.dividir(texto, { por: 'letra' });
          r.chars = partes.map((p) => ({ el: p.el, x: p.cx, reveal: reveal(p.cx), out: cover(p.cx), palavra: p.palavra }));
          if (seedIdx >= 0) {
            const sem = r.chars.filter((ch) => ch.palavra === seedIdx);
            sem.forEach((ch, k) => { ch.seed = k; ch.seedN = sem.length; });
          }
        }
        return r;
      });
      // Os textos escrevem juntos, na ordem de leitura, assim que a primeira letra de cada um aparece.
      const textos = O.itens.filter((r) => r.chars.length);
      const T0 = Math.max(...textos.map((r) => r.chars[0].reveal)) + 0.02;
      textos.forEach((r) => r.chars.forEach((ch, i) => { ch.t = Math.max(T0 + i * 0.02, ch.reveal + 0.02); }));

      // ── A palavra gigante: brilho e letra divididos juntos (o degradê segue contínuo) ──
      O.gig = el.$('.gigante');
      O.gigBrilho = el.$('.gigante-brilho');
      O.gigPalavra = el.$('.gigante-palavra');
      const pb = api.tipo.dividir(O.gigBrilho, { por: 'letra' });
      const pp = api.tipo.dividir(O.gigPalavra, { por: 'letra' });
      // Com entreletra negativa a caixa da letra é mais estreita que o desenho: cada letra ganha uma
      // folga invisível (padding com margem negativa igual) e o degradê é realinhado ao desenho.
      const escala = Motion.palco.getBoundingClientRect().width / Motion.palco.offsetWidth || 1;
      const folga = (lista, dono) => {
        const caixa = dono.getBoundingClientRect();
        lista.forEach((p) => { p.el.style.padding = '0.12em'; p.el.style.margin = '-0.12em'; });
        lista.forEach((p) => {
          const r = p.el.getBoundingClientRect();
          p.el.style.backgroundSize = `${(caixa.width / escala).toFixed(2)}px ${(caixa.height / escala).toFixed(2)}px`;
          p.el.style.backgroundPosition = `${(-(r.left - caixa.left) / escala).toFixed(2)}px ${(-(r.top - caixa.top) / escala).toFixed(2)}px`;
        });
      };
      folga(pb, O.gigBrilho);
      folga(pp, O.gigPalavra);
      O.brilhoLetras = pb.map((p) => ({ el: p.el, img: p.el.style.backgroundImage }));
      O.palavraLetras = pp.map((p) => ({ el: p.el, img: p.el.style.backgroundImage, size: p.el.style.backgroundSize, pos: p.el.style.backgroundPosition }));
      // Linha de base da palavra (o horizonte fica abaixo dela, nunca no miolo).
      const gc = api.caixaNaTela(O.gig);
      const sonda = document.createElement('span');
      sonda.style.cssText = 'display:inline-block;width:0;height:0';
      O.gigPalavra.appendChild(sonda);
      O.baseOff = api.caixaNaTela(sonda).y - gc.cy;
      sonda.remove();
      O.horizonte = document.createElement('div');
      O.horizonte.className = 'horizonte';
      O.gig.insertBefore(O.horizonte, O.gig.firstChild);
      // Onde a gota cai (x do símbolo já trancado); o horizonte nasce ali e escorrega para o centro.
      O.landX = (O.sC + offS(3.1)) * bandScale(3.1);
      const landOff = O.landX / vitalS(LINE);
      O.lineX = (x) => landOff * (1 - E.forte(prog(x, LINE, LINE + 0.5)));
      // Degradê com as paradas deslocadas (d, em %) e o ângulo girado: a mesma receita do token, derivando.
      O.aurora = (img, d, ang) => img
        .replace(/(-?\d+(?:\.\d+)?)deg/, `${ang.toFixed(2)}deg`)
        .replace(/(-?\d+(?:\.\d+)?)%/g, (m, v) => `${(parseFloat(v) + d).toFixed(2)}%`);
      O.ang0 = parseFloat((/(-?\d+(?:\.\d+)?)deg/.exec(O.palavraLetras[0].img) || [0, 100])[1]);
    },

    quadro(t, el, api) {
      const O = el.o;
      if (!O) return;
      if (O.V) { quadroV(t, el, api); return; }
      const { set, ease: E, prog, lerp, clamp, tw } = api;
      const { bell } = O;
      const TAU = Math.PI * 2;
      const wave = (x, period, phase = 0) => Math.sin(TAU * (x / period + phase));
      const crest = (x, period, at) => Math.cos((TAU * (x - at)) / period);
      const glowCss = (b) => (b > 0.002
        ? `drop-shadow(0 0 ${(1.3 * b).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(85 * Math.min(1, b))}%, transparent))`
        : '');

      // ── Luz de horizonte e atmosfera: acendem depois do símbolo e respiram a cena inteira ──
      set(O.chao, {
        pre: '',
        x: 0.9 * crest(t, 5.0, 3.0),
        y: tw(t, IGNITE[0], 1.5, 7, 0, E.bezier(0.25, 0.4, 0.25, 1)) + 0.5 * crest(t, 4.4, 1.1),
        s: tw(t, 0, 5, 1.06, 1, E.outSine) * (1.035 + 0.01 * crest(t, 3.3, 1.35)),
        o: tw(t, IGNITE[0], 1.1, 0, 0.85, E.bezier(0.35, 0, 0.3, 1)) * (1 + 0.1 * crest(t, 4.4, 3.0)),
      });
      set(O.orbe, {
        pre: '',
        x: 0.8 * wave(t, 4.6, 0.043),
        y: tw(t, LINE, 4.4, 3, 0, E.forte) + 0.4 * wave(t, 3.7, -0.189),
        s: tw(t, LINE, 4.6, 0.82, 1, E.forte) * (1 + 0.018 * wave(t, 3.1, 0.15)),
        o: tw(t, LINE, 3.9, 0, 1, E.outCubic) * (0.95 + 0.06 * wave(t, 2.5, 0.8)),
        bright: 1 + 0.08 * bell(t, PUSH - 0.02, PUSH + 0.2),
      });
      // A vinheta nasce com a luz, a partir do símbolo (no primeiro quadro o fundo é liso).
      set(O.vinheta, { o: E.inOutSine(prog(t, 0.05, 0.95)) });

      // ── A faixa ──
      const bs = O.bandScale(t), by = O.bandY(t);
      set(O.faixa, { pre: '', y: by, s: bs });
      // Desfoque de movimento fingido, pela velocidade na tela (abertura, tranca e subida).
      const vx = Math.abs(O.offA(t + 0.01) * O.bandScale(t + 0.01) - O.offA(t - 0.01) * O.bandScale(t - 0.01)) / 0.02;
      const vy = Math.abs(O.bandY(t + 0.01) - O.bandY(t - 0.01)) / 0.02;
      const mblur = clamp(Math.hypot(vx, vy) * 0.0014, 0, 0.1);
      const starAt = O.sC + O.offS(t);
      set(O.A, { pre: '', x: O.offA(t), blur: mblur });
      set(O.B, { pre: '', x: O.offB(t), blur: mblur });
      // Cada letra acende quando a frente de luz passa: nasce quente, do desfoque, um fio menor e mais
      // perto do símbolo, e esfria na cor da marca enquanto assenta (o desfoque segue a velocidade).
      O.frente.quadro(t, { escala: bs });

      // ── O símbolo: risco de luz no giro rápido, respira no hold ──
      const whirl = clamp(O.spinSpeed(t) / 2600, 0, 1);
      const flash = bell(t, FLASH[0], FLASH[1]);
      const ignite = 1 - E.outCubic(prog(t, IGNITE[0], 0.62));
      const charge = bell(t, SUCK + 0.05, CLOSE[1]);
      const gather = bell(t, 0.6, 0.94);
      const breathe = 0.5 + 0.5 * crest(t, 2.4, 1.6);
      set(O.S, {
        pre: '',
        x: O.offS(t),
        s: O.starS(t),
        o: tw(t, IGNITE[0], IGNITE[0] + 0.09, 0, 1, E.outCubic),
        blur: 0.45 * ignite + 1.1 * Math.pow(whirl, 0.8) + mblur,
        r: O.starRot(t) + 2.5 * crest(t, 6.0, 0.1) * (1 - E.inOutSine(prog(t, 2.45, 2.75))),
        bright: 1 + 2 * ignite + 1.3 * whirl + 0.3 * gather + 0.35 * charge + 1.0 * flash + 0.12 * breathe,
        filter: glowCss(0.9 * ignite * (t > IGNITE[0] ? 1 : 0) + 0.7 * whirl + 0.3 * gather + 1.2 * flash + 0.3 * charge + 0.14 * breathe),
      });
      // Halo preso ao símbolo: acende com a chave, abre com a faixa e colapsa nele na tranca.
      set(O.halo, {
        pre: 'translate(-50%,-50%)',
        x: starAt * bs + 0.5 * crest(t, 4.4, 0.2),
        y: by,
        s: tw(t, KEY[0], OPEN[1] + 0.2, 0.4, 1, E.bezier(0.25, 0.6, 0.3, 1)) * (1 + 0.045 * crest(t, 2.7, 1.8)) * tw(t, 2.64, 3.0, 1, 0.25, E.inCubic),
        o: tw(t, KEY[0], OPEN[0] + 0.7, 0, 1, E.inOutSine) * (0.92 + 0.08 * crest(t, 2.3, 1.675)) * (1 - tw(t, 2.76, 3.02, 0, 1, E.inOutCubic)),
        blur: 1.6,
      });

      // ── Itens: saem de dentro da marca por uma janela que acompanha as peças ──
      const gone = tw(t, 2.84, 3.0, 0, 1, E.inCubic);
      // Reflexo: nasce no símbolo e corre para fora pelos itens, uma vez, no meio do hold.
      const gq = prog(t, GLINT[0], GLINT[1]);
      const gD = gq > 0 && gq < 1 ? lerp(-3, 36, E.inOutSine(gq)) : -99;
      const glintAt = (side, x) => (gD < -50 ? 0 : Math.exp(-Math.pow((side * (x - starAt) - gD) / 2.6, 2)));
      O.itens.forEach((r) => {
        const rs = tw(t, r.t0, r.t1 + 0.35, 0.96, 1, E.forte) * lerp(1, 0.97, gone);
        const local = (bx) => (bx - r.c) / rs + r.w / 2;
        const [wa, wb] = O.win[r.side](t);
        const a = local(wa), b = local(wb);
        const fa = r.side < 0 ? FEATHER : STAR_FEATHER, fb = r.side < 0 ? STAR_FEATHER : FEATHER;
        const mask = `linear-gradient(90deg, transparent ${a.toFixed(3)}cqw, #000 ${(a + fa).toFixed(3)}cqw, #000 ${(b - fb).toFixed(3)}cqw, transparent ${b.toFixed(3)}cqw)`;
        set(r.el, {
          pre: '',
          y: tw(t, r.t0, r.t1 + 0.4, 0.45, 0, E.forte),
          s: rs,
          o: tw(t, r.t0 - 0.05, r.t0 + 0.25, 0, 1, E.outCubic) * (1 - gone),
          bright: tw(t, r.t0, r.t1 + 0.45, 1.8, 1, E.outCubic),
          mask,
        });
        r.chars.forEach((ch) => {
          const off = tw(t, ch.out - 0.1, ch.out, 0, 1, E.inCubic);
          const g0 = glintAt(r.side, ch.x);
          const p = {
            pre: '',
            y: tw(t, ch.t, ch.t + 0.45, 0.4, 0, E.forte),
            s: 1,
            o: tw(t, ch.t, ch.t + 0.22, 0, 1, E.outCubic) * (1 - off),
            blur: tw(t, ch.t, ch.t + 0.4, 0.35, 0, E.forte) + 0.3 * off,
            style: { color: '', textShadow: g0 > 0.01 ? `0 0 ${(0.6 * g0).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(80 * g0)}%, transparent)` : 'none' },
          };
          if (ch.seed !== undefined) {
            // a palavra brilha uma vez e é sugada para o ponto do símbolo (escala e espaço juntos)
            const s0 = SEED + ch.seed * 0.03;
            const g = bell(t, s0, s0 + 0.26);
            const k = E.inCubic(prog(t, SUCK, SUCK + 0.24));
            const m = Math.max(g, k, g0);
            p.x = ((starAt - ch.x) / rs) * k;
            p.s = lerp(1, 0.1, k);
            p.blur += 0.35 * k;
            p.o *= 1 - prog(t, SUCK + 0.19, SUCK + 0.24);
            p.bright = 1 + 0.35 * g + 0.8 * k;
            p.style = {
              color: `color-mix(in srgb, var(--brilho) ${Math.round(85 * Math.max(g, k))}%, var(--texto))`,
              textShadow: m > 0.002 ? `0 0 ${(0.7 * m).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(85 * m)}%, transparent)` : 'none',
            };
          }
          set(ch.el, p);
        });
        // Ícones: traço de luz que se desenha depois de descoberto; o reflexo acende o traço.
        r.paths.forEach((pth, k) => {
          const p0 = r.draw + 0.02 + k * 0.06;
          const drawn = E.inOutCubic(prog(t, p0, p0 + 0.5)) * (1 - tw(t, r.hide - 0.1, r.hide, 0, 1, E.inCubic));
          pth.style.strokeDashoffset = (1 - drawn).toFixed(4);
          pth.style.opacity = drawn > 0.002 ? '1' : '0';
        });
        if (r.paths.length) {
          const g0 = glintAt(r.side, r.x);
          const svg = r.el.querySelector('svg');
          svg.style.filter = `drop-shadow(0 0 ${(0.35 + 0.5 * g0).toFixed(3)}cqw color-mix(in srgb, var(--brilho) ${Math.round(35 + 50 * g0)}%, transparent))`;
        }
      });

      // ── A gota: o clique solta a luz do símbolo até o horizonte ──
      const vs = O.vitalS(t);
      const top = by;
      const horizon = 4.1 + (O.baseOff + LINE_GAP) * vs;
      const head = lerp(top, horizon, E.inCubic(prog(t, DROP[0], DROP[1])));
      const tail = lerp(top, horizon, E.inCubic(prog(t, DROP[0] + 0.025, DROP[1] + 0.04)));
      const len = Math.max(0.6, head - tail);
      set(O.gota, {
        pre: 'translate(-50%,-50%)',
        x: O.landX,
        y: (head + tail) / 2,
        sx: 1,
        sy: len / 10,
        o: tw(t, DROP[0] - 0.01, DROP[0] + 0.02, 0, 1, E.outCubic) * (1 - tw(t, DROP[1] + 0.01, DROP[1] + 0.05, 0, 1, E.inCubic)),
      });

      // ── A palavra gigante ──
      set(O.horizonte, {
        pre: 'translate(0,-50%)',
        x: O.lineX(t),
        y: O.baseOff + LINE_GAP,
        sx: tw(t, LINE, LINE + 0.51, 0.02, 1.15, E.forte),
        sy: tw(t, LINE, 4.0, 1, 0.5, E.outCubic),
        o: tw(t, LINE - 0.005, LINE + 0.06, 0, 1, E.outCubic) * (1 - tw(t, 3.6, 4.15, 0, 1, E.inOutSine)),
      });
      set(O.gig, { pre: 'translateY(calc(-50% + 4.1cqw))', s: vs, o: t < 2.9 ? 0 : 1 });
      // O degradê escorre devagar (paradas deslizando e ângulo girando) e passa pelo aprovado em 4,3.
      const drift = 7 * wave(t - DRIFT_AT, 4.6);
      const ang = O.ang0 + 5 * wave(t - DRIFT_AT, 5.8);
      const breath = wave(t, 2.2);
      const glowIn = E.bezier(0.3, 0, 0.2, 1)(prog(t, GLOW_IN[0], GLOW_IN[1]));
      set(O.gigBrilho, {
        pre: '',
        y: tw(t, GLOW, GLOW + 0.5, 0.9, 0, E.forte),
        o: 0.55 * glowIn * lerp(1, 0.55 * (1 + 0.1 * breath), E.inOutSine(prog(t, 3.45, 4.2))) / 0.55,
        blur: (t < GLOW_IN[1] ? lerp(3.4, 1.3, glowIn) : lerp(1.3, 2.6, E.inOutSine(prog(t, 3.3, 3.9)))) + 0.18 * wave(t, 3.1, 0.1) * prog(t, 3.3, 3.9),
        bright: lerp(1.6, 1, E.inOutSine(prog(t, 3.4, 4.2))),
      });
      O.brilhoLetras.forEach((c) => set(c.el, { style: { backgroundImage: O.aurora(c.img, drift, ang) } }));
      const sweep = prog(t, SWEEP[0], SWEEP[1]);
      const sp = lerp(-8, 108, E.inOutSine(sweep));
      const sweepOn = sweep > 0 && sweep < 1;
      O.palavraLetras.forEach((L, i) => {
        const c0 = WORD + i * STAGGER;
        const img = O.aurora(L.img, drift, ang);
        set(L.el, {
          pre: '',
          y: tw(t, c0, c0 + 0.6, 1.1, 0, E.forte),
          o: tw(t, c0, c0 + 0.2, 0, 1, E.outCubic),
          blur: tw(t, c0, c0 + 0.5, 1.2, 0, E.forte),
          bright: tw(t, c0, c0 + 0.7, 2.2, 1, E.outCubic),
          style: sweepOn
            ? {
              backgroundImage: `linear-gradient(105deg, transparent ${(sp - 8).toFixed(2)}%, color-mix(in srgb, var(--brilho) 88%, transparent) ${sp.toFixed(2)}%, transparent ${(sp + 8).toFixed(2)}%), ${img}`,
              backgroundSize: `${L.size}, ${L.size}`,
              backgroundPosition: `${L.pos}, ${L.pos}`,
            }
            : { backgroundImage: img, backgroundSize: L.size, backgroundPosition: L.pos },
        });
      });
    },
  });
})();
