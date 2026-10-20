/* camera.js — a câmera da cena (api.camera).

   const cam = api.camera({
     alvo: el.$('.mundo'),             // o que a câmera move (padrão: el.raiz)
     camadas: [                        // paralaxe por profundidade (opcional)
       { el: el.$('.luz'), z: -0.5 },  // longe: anda metade
       { el: el.$('.grade'), z: 0 },   // plano focal
       { el: el.$('.titulo'), z: 0.5 },// perto: anda 1,5×
     ],
     modo: '2.5d',                     // '2.5d' (escala/deslocamento por camada) | '3d'
     perspectiva: 1.2,                 // distância câmera → plano focal, em larguras do quadro
     abertura: 0,                      // cqw de desfoque por unidade de |z − foco| (profundidade de campo)
     origem: [50, 50],                 // ponto de fuga, % do quadro
   });
   cam.pose({ zoom, avanco, x, y, giro, rx, ry, foco, desfoque });
   cam.mergulho(t, t0, t1, alvoEl, { cobrir, curva, para }) → { zoom, x, y } (passe para pose)

   x/y são o ponto para onde a câmera OLHA, em cqw a partir do centro do quadro: com x = 12, y = -4
   o ponto (12, -4) do plano focal vai para o centro da tela (o conteúdo anda para a esquerda e para
   baixo), com ou sem camadas e em qualquer zoom. zoom é lente (tudo junto, em volta do centro da
   tela); avanco é dolly (camadas perto crescem mais). Para um close num elemento:
     const P = cam.centro(el.$('.palavra'));          // no montar
     cam.pose({ zoom: 1.6, x: P[0], y: P[1] });       // o elemento no centro, 1,6×
   Em repouso (zoom 1, avanco 0, x = y = 0) nada muda: o quadro aprovado continua sendo o CSS. */
(function () {
  'use strict';
  Motion.estender((api, ctx) => {
    const { clamp, ease, prog, logLerp, lerp } = api;
    const R = ctx.R;
    const W = ctx.formato.largura;
    const H = api.H;
    const u = W / 100;

    function origemPx(el, V) {
      const b = api.caixa(el);
      return `${((V[0] - b.x) * u).toFixed(3)}px ${((V[1] - b.y) * u).toFixed(3)}px`;
    }

    api.camera = function camera(op = {}) {
      const alvo = op.alvo || R.el.raiz;
      const modo = op.modo || '2.5d';
      const perspectiva = op.perspectiva ?? 1.2;
      const abertura = op.abertura ?? 0;
      const origem = op.origem || [50, 50];
      // ponto de fuga em cqw a partir do centro do quadro
      const V = [origem[0] - 50, (origem[1] / 100) * H - H / 2];
      alvo.style.transformOrigin = origemPx(alvo, V);
      const camadas = (op.camadas || []).filter((c) => c && c.el).map((c) => {
        c.el.style.transformOrigin = origemPx(c.el, V);
        return { el: c.el, z: c.z || 0 };
      });
      // o motor confere se alguma camada de plano cheio sob esta câmera ficou sem sobra
      R.__alvosCamera = R.__alvosCamera || [];
      R.__alvosCamera.push(alvo, ...camadas.map((c) => c.el));
      if (modo === '3d') {
        alvo.style.transformStyle = 'preserve-3d';
        for (const c of camadas) c.el.style.transformStyle = 'preserve-3d';
      }
      const Pcqw = perspectiva * 100; // perspectiva em cqw

      function pose({ zoom = 1, avanco = 0, x = 0, y = 0, giro = 0, rx = 0, ry = 0, foco = 0, desfoque = 0 } = {}) {
        if (modo === '3d') {
          api.set(alvo, { pre: '', persp: Pcqw, z: avanco * Pcqw, x: -x * zoom, y: -y * zoom, rx, ry, r: giro, s: zoom, subpixel: true });
          for (const c of camadas) {
            const blur = abertura * Math.abs(c.z - foco);
            api.set(c.el, { pre: '', z: c.z * Pcqw * 0.5, blur });
          }
          if (desfoque || alvo.__mDesf) {
            alvo.__mDesf = true;
            api.set(alvo, { blur: desfoque });
          }
          return;
        }
        if (!camadas.length) {
          // p' = V + zoom·m·(p − V − olhar): o ponto olhado vai para o centro em qualquer zoom
          const m = 1 / Math.max(0.05, 1 - avanco);
          const k = zoom * m;
          api.set(alvo, { pre: '', x: -x * k, y: -y * k, s: k, r: giro, blur: desfoque, subpixel: true });
          return;
        }
        api.set(alvo, { pre: '', s: zoom, r: giro, blur: desfoque, subpixel: true });
        for (const c of camadas) {
          const d = 1 - c.z - avanco;
          const dd = Math.max(0.05, d);
          const m = (1 - c.z) / dd;
          // camada passando pela câmera: apaga e desfoca sozinha
          const passando = clamp((0.12 - d) / 0.07);
          const blur = abertura * Math.abs(c.z - foco) + passando * 1.2;
          api.set(c.el, { pre: '', x: -x / dd, y: -y / dd, s: m, blur, o: 1 - passando });
        }
      }

      function mergulho(t, t0, t1, alvoEl, { cobrir = 1, curva = ease.mergulho, para = null } = {}) {
        if (!alvoEl) return { zoom: 1, x: 0, y: 0 };
        if (!alvoEl.__mCaixa) alvoEl.__mCaixa = api.caixa(alvoEl);
        const b = alvoEl.__mCaixa;
        const S1 = para && para.l ? para.l / b.l : cobrir * Math.max(100 / b.l, H / b.a);
        const e = curva(prog(t, t0, t1));
        const S = logLerp(1, S1, e);
        const dest = para ? [para.cx, para.cy] : [0, 0];
        const k = Math.abs(S1 - 1) < 1e-6 ? e : (S - 1) / (S1 - 1);
        const G = [lerp(b.cx, dest[0], k), lerp(b.cy, dest[1], k)];
        // p' = V + S(p − V − olhar) = G  →  olhar = p − V − (G − V)/S
        return { zoom: S, x: b.cx - V[0] - (G[0] - V[0]) / S, y: b.cy - V[1] - (G[1] - V[1]) / S };
      }

      /** Centro de um elemento (cqw a partir do centro do quadro), medido no layout: para `pose({ x, y })`. */
      function centro(el) {
        if (!el) return [0, 0];
        const b = api.caixa(el);
        return [b.cx, b.cy];
      }

      return { pose, mergulho, centro, caixa: (el) => api.caixaNaTela(el), alvo, camadas };
    };
  });
})();
