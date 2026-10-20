/* _comum.js — capas de demonstração, usadas pelo bento (o leque do card) e pela órbita.
   Com fotos em midia/ (qualquer nome, em ordem alfabética), as capas viram as fotos e isto aqui
   só desenha o que faltar. Sem fotos, cada capa é uma arte de luz feita com os tokens da marca
   (seis desenhos que se alternam: orbe, aurora, horizonte, letreiro, diagonal e feixe), com um título.
   Tudo dentro da capa é medido pela largura dela (cqi): a mesma capa fica idêntica no leque
   pequeno do bento e grande na órbita, o que deixa o mergulho entre as duas cenas invisível. */
(function () {
  const TITULOS = [
    'Primeiros passos', 'Direção de arte', 'Luz e cor', 'Narrativa', 'Som e ritmo',
    'Movimento', 'Tipografia', 'Câmera', 'Edição', 'Produto',
    'Marca', 'Estratégia', 'Roteiro', 'Fotografia', 'Interface',
    'Dados', 'Vendas', 'Comunidade', 'Ao vivo', 'Lançamento',
  ];
  // pares de luz (tokens) por capa: o desenho alterna, a cor gira pela paleta da marca
  const LUZES = [
    ['--capa-1', '--capa-2'], ['--capa-4', '--capa-3'], ['--capa-3', '--capa-2'], ['--capa-5', '--capa-6'], ['--capa-2', '--capa-1'],
    ['--capa-6', '--capa-5'], ['--capa-4', '--capa-5'], ['--capa-3', '--capa-4'],
  ];
  const DESENHOS = ['orbe', 'aurora', 'horizonte', 'letreiro', 'diagonal', 'feixe'];
  const r = (i, k) => {
    const x = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  window.Capas = {
    N: 20,
    titulo: (i) => TITULOS[i % TITULOS.length],
    /** HTML de uma capa: `<span class="capa …">`. extra = atributos (style, aria). */
    html(c, i, { classe = '', extra = '' } = {}) {
      const fotos = c.midias ? c.midias() : [];
      if (fotos.length) {
        return `<span class="capa capa-foto ${classe}" ${extra}>${c.foto(fotos[i % fotos.length], { classe: 'capa-img' })}</span>`;
      }
      const [a, b] = LUZES[(i * 5) % LUZES.length];
      const d = DESENHOS[i % DESENHOS.length];
      const vars = `--ca:var(${a});--cb:var(${b});--px:${(18 + 64 * r(i, 1)).toFixed(1)}%;--py:${(20 + 50 * r(i, 2)).toFixed(1)}%;--gr:${Math.round(-30 + 60 * r(i, 3))}deg`;
      const num = String(i + 1).padStart(2, '0');
      const titulo = c.esc(TITULOS[i % TITULOS.length]);
      // letreiro: o título é a própria arte, gigante, em degradê
      const letreiro = d === 'letreiro' ? `<span class="capa-palavra" style="${vars}">${titulo}</span>` : '';
      return `<span class="capa capa-arte capa-${d} ${classe}" ${extra}><span class="capa-luz" style="${vars}"></span>${letreiro}`
        + `<span class="capa-num">${num}</span><span class="capa-titulo">${titulo}</span></span>`;
    },
  };
})();
