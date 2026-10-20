/* args.mjs — leitura simples de argumentos: posicionais, --opcao valor, --bandeira, repetíveis. */
export function lerArgs(argv = process.argv.slice(2), { bandeiras = [] } = {}) {
  const pos = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      let nome = a.slice(2);
      let valor;
      const eq = nome.indexOf('=');
      if (eq >= 0) {
        valor = nome.slice(eq + 1);
        nome = nome.slice(0, eq);
      } else if (!bandeiras.includes(nome) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
        valor = argv[++i];
      } else valor = true;
      if (op[nome] === undefined) op[nome] = valor;
      else op[nome] = [].concat(op[nome], valor);
    } else pos.push(a);
  }
  return { pos, op };
}

/** Número com vírgula ou ponto ("0,5" ou "0.5"). */
export const num = (v, padrao) => {
  if (v === undefined || v === true || v === null || v === '') return padrao;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
};

/** Lista "a,b,c" (ou repetida) → array. */
export const lista = (v) =>
  v === undefined || v === true
    ? []
    : []
        .concat(v)
        .flatMap((x) => String(x).split(','))
        .map((s) => s.trim())
        .filter(Boolean);

export const ultimo = (v) => (Array.isArray(v) ? v[v.length - 1] : v);
