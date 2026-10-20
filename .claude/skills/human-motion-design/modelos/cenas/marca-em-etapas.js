/*@ficha
{
  "ideia": "A marca em etapas que se leem: o símbolo acende de um ponto, quente, num close; a câmera recua enquanto o nome se revela no sentido da leitura; o símbolo faz o gesto da marca e o convite entra embaixo.",
  "camera": "Nasce em close (1,6×) no símbolo e recua em 3 batidas com curva forte, até o enquadramento; depois push-in bem lento, passando por 1,0 no quadro aprovado.",
  "quadros": [
    { "id": "inicio", "rotulo": "Início", "legenda": "Só o símbolo, em close, acendendo de um ponto, ainda quente", "tb": 0.5 },
    { "id": "meio", "rotulo": "Passo 2", "legenda": "A câmera recuando, ainda perto; o nome da marca se revelando da esquerda para a direita", "tb": 1.6 },
    { "id": "fim", "rotulo": "Fim", "legenda": "A marca inteira no eixo, o convite embaixo", "tb": 5.2, "aprovado": true }
  ],
  "batidas": [
    { "tb": 0, "tipo": "objeto", "texto": "O símbolo acende de um ponto: cresce com uma mola curta, girando 24° que desaceleram; a luz dele abre o fundo em volta, sem borda." },
    { "tb": 1, "tipo": "luz", "texto": "O nome da marca se revela no sentido da leitura, por uma máscara de borda macia (0,7 s), saindo do símbolo; nenhuma letra fica quebrada parada." },
    { "tb": 1, "tipo": "camera", "texto": "A câmera recua do close até o enquadramento em 3 batidas." },
    { "tb": 3, "tipo": "objeto", "texto": "O gesto da marca: o símbolo passa 6° do ponto e volta (tique), e uma luz larga atravessa a marca uma vez." },
    { "tb": 4, "tipo": "tipo", "texto": "O convite sai do desfoque palavra a palavra, pequeno, embaixo da marca." },
    { "tb": 5, "tipo": "vida", "texto": "Hold: a luz atrás do símbolo pulsa a cada duas batidas, como um coração calmo; a luz de trás respira." },
    { "tb": 7, "tipo": "vida", "texto": "O símbolo respira um fio; o fim esmaece até o fundo." }
  ],
  "saida": { "tipo": "esmaecer" }
}
@*/
/* {{id}} — "{{titulo}}" · Marca em etapas ({{dur}} s)
   Ideia: C5/C9 em etapas legíveis. Camadas: a luz (longe), a marca (plano focal, data-ponte
   "objeto"), a luz que atravessa (perto).
   A logo vem de marca/ativos (SVG de preferência). Se o SVG tiver o grupo class="simbolo", o
   símbolo faz a primeira etapa sozinho; senão, a logo inteira se revela da esquerda para a direita.
   A logo é sagrada: mover, girar, mascarar e desfocar, sim; redesenhar ou trocar a cor no hold, não.
   TROQUE: LOGO (o nome do arquivo em marca/ativos, sem extensão), CONVITE ('' tira). */
{ // bloco: as constantes desta cena não colidem com as das outras
const LOGO = '{{logo}}';
const MARCA_TEXTO = 'marca'; // só quando não há logo: o nome em texto
const CONVITE = 'Um convite curto';

Motion.cena('{{id}}', {
  render: (c) => `
    <div class="camada c-longe"><div class="luz"></div></div>
    <div class="camada c-meio"><div class="luz-marca"></div><div class="pilha">
      <div class="marca" data-ponte="objeto">${LOGO ? c.foto(LOGO, { classe: 'logo' }) : `<span class="titulo marca-texto">${MARCA_TEXTO}</span>`}</div>
      ${CONVITE ? `<p class="apoio convite">${CONVITE}</p>` : ''}
    </div></div>
    <div class="camada c-perto"><div class="atravessa"></div></div>`,

  poses: {
    inicio: (el, api) => el.etapas(0.5, api, true),
    meio: (el, api) => el.etapas(api.b(1.6), api, true),
  },

  montar(el, api) {
    el.marca = el.$('.marca');
    el.simbolo = el.$('.marca .simbolo, .marca [data-simbolo]');
    el.convite = el.$('.convite');
    el.convitePal = el.convite ? api.tipo.dividir(el.convite, { por: 'palavra' }) : [];
    el.luz = el.$('.luz');
    el.luzMarca = el.$('.luz-marca');
    el.atravessa = el.$('.atravessa');
    el.cam = api.camera({
      camadas: [
        { el: el.$('.c-longe'), z: -0.6 },
        { el: el.$('.c-meio'), z: 0 },
        { el: el.$('.c-perto'), z: 0.35 },
      ],
    });
    const cm = api.caixa(el.marca);
    if (el.simbolo) {
      el.simbolo.style.transformBox = 'fill-box';
      el.simbolo.style.transformOrigin = '50% 50%';
      const r = el.simbolo.getBoundingClientRect(), m = el.marca.getBoundingClientRect();
      // a borda seca da máscara fica no vão entre o símbolo e o nome (ninguém vê borda num vão vazio)
      const svg = el.marca.querySelector('svg');
      const escala = svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
      const desenho = [...el.marca.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line, text, use, image')].filter((n) => !el.simbolo.contains(n) && !n.closest('defs, mask, clipPath'));
      const resto = desenho
        .map((n) => [n.getBoundingClientRect(), (parseFloat(getComputedStyle(n).strokeWidth) || 0) * escala])
        .filter(([b]) => b.width > 0 || b.height > 0)
        .reduce((mn, [b, tr]) => Math.min(mn, b.left - tr / 2), Infinity);
      el.fracSimbolo = (Number.isFinite(resto) && resto > r.right ? (r.right + resto) / 2 - m.left : r.right - m.left) / m.width;
      const cs = api.caixaNaTela(el.simbolo);
      el.P = [cs.cx, cs.cy];
    } else {
      el.fracSimbolo = 0;
      el.P = [cm.x + Math.min(cm.l, cm.a) * 0.5, cm.cy];
    }
    // a luz da marca nasce atrás do símbolo (medido uma vez)
    el.luzMarca.style.left = `calc(50% + ${el.P[0].toFixed(3)}cqw)`;
    el.luzMarca.style.top = `calc(50% + ${el.P[1].toFixed(3)}cqw)`;
    el.etapas = (t, a = api, pose = false) => {
      const { prog, ease, lerp, suave, b } = a;
      const ini = a.inicioEntrada(0.02);
      // 1. o símbolo acende de um ponto (objeto: a mola pode passar do ponto)
      const mola = a.spring(t - ini, { freq: 1.5, damp: 6.5 });
      const quente = 1 - ease.outCubic(prog(t, ini, ini + 1.1));
      const tique = a.fisica.tique(t, b(3), { passa: 6 });
      const respira = 0.006 * a.vida(t, { inicio: b(5), periodo: 3.4 });
      if (el.simbolo) {
        a.set(el.simbolo, { s: lerp(0.3, 1, mola) * (1 + respira), r: -24 * (1 - ease.outCubic(prog(t, ini, ini + 0.9))) + tique, o: suave(prog(t, ini, ini + 0.08)) });
      }
      // a luz atrás do símbolo: forte e quente no nascimento, assenta num brilho que respira
      const pulsa = a.naBatida(t, { de: b(5), cada: 2, ataque: 0.14 }).v;
      a.set(el.luzMarca, { o: suave(prog(t, ini, ini + 0.15)) * (0.55 + 0.45 * quente) * (1 + 0.22 * pulsa), s: (0.7 + 0.3 * ease.outCubic(prog(t, ini, ini + 0.8))) * (1 + 0.03 * pulsa) });
      // 2. o nome se revela no sentido da leitura, saindo do símbolo
      const s = 0.22;
      a.fx.revelarNaLeitura(el.marca, ease.inOutSine(prog(t, b(1), b(1) + 0.7)), { suavidade: s, fixo: el.simbolo ? el.fracSimbolo : 0 });
      a.set(el.marca, { x: 1.6 * (1 - ease.forte(prog(t, b(1), b(1) + 1.0))) });
      // 3. a luz larga atravessa a marca uma vez, no gesto
      const pa = prog(t, b(3), b(3) + 0.9);
      a.set(el.atravessa, { x: lerp(-60, 60, ease.inOutSine(pa)), o: Math.sin(Math.PI * pa) });
      // 4. o convite, pequeno, palavra a palavra
      if (el.convitePal.length) a.tipo.focar(t, el.convitePal, { inicio: b(4) });
      // câmera: close no símbolo → recua até o enquadramento; depois push bem lento
      const r = ease.outQuad(prog(t, ini + 0.15, b(3.2)));
      el.cam.pose({ zoom: lerp(1.6, 1, r) * a.viva(t, { v: 0.013 }), x: el.P[0] * (1 - r), y: el.P[1] * (1 - r) });
      if (!pose) a.fx.respirar(t, el.luz, { periodo: 3.6, amp: 0.09, base: 1 + 0.2 * pulsa });
    };
  },

  quadro(t, el, api) {
    el.etapas(t);
  },
});
}
