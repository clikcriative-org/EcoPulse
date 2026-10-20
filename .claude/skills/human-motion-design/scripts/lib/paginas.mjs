/* paginas.mjs — o que as páginas da skill (storyboard, entrega, fluidez) têm em comum.
   Paleta neutra própria, clara: as páginas são da skill; os quadros carregam a marca da pessoa. */
import path from 'node:path';

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Caminho relativo para usar em href/src (com / e espaços codificados). */
export const rel = (de, para) =>
  path
    .relative(de, para)
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');

/** 1,5 · 0,25 */
export const virgula = (v, casas = 2) => {
  if (!Number.isFinite(v)) return '–';
  const r = Math.round(v * 10 ** casas) / 10 ** casas;
  return String(r).replace('.', ',');
};
/** 00:04,5 */
export function timecode(t, casas = 1) {
  const m = Math.floor(t / 60 + 1e-9);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(casas).padStart(casas ? 3 + casas : 2, '0').replace('.', ',')}`;
}
export const segundos = (t) => `${virgula(t, 2)} s`;
/** 0,5 · 0,05 · 1,125 (três casas quando a meia batida pede: 1,125 nunca vira 1,13). */
export const tempoFino = (t) => {
  if (!Number.isFinite(t)) return '–';
  const r3 = Math.round(t * 1000) / 1000;
  const casas = Math.abs(r3 * 10 - Math.round(r3 * 10)) < 1e-6 ? 1 : Math.abs(r3 * 100 - Math.round(r3 * 100)) < 1e-6 ? 2 : 3;
  return r3.toFixed(casas).replace('.', ',');
};
/** 00:01,125 — o timecode com as casas que o tempo pede. */
export function timecodeFino(t) {
  const m = Math.floor(t / 60 + 1e-9);
  const resto = t - m * 60;
  const txt = tempoFino(resto);
  const [int, dec] = txt.split(',');
  return `${String(m).padStart(2, '0')}:${int.padStart(2, '0')}${dec ? ',' + dec : ''}`;
}
/** 0,0 s · 0,5 s · 0,05 s · 1,125 s */
export const tempoBatida = (t) => `${tempoFino(t)} s`;
export const nomeFormato = (f) => (f === '9x16' ? '9:16' : '16:9');
export const dataBr = (iso) => {
  const [a, m, d] = String(iso || '').split('-');
  return d ? `${d}/${m}/${a}` : iso || '';
};

export const ROTULO_BATIDA = {
  tipo: 'Tipografia',
  camera: 'Câmera',
  transicao: 'Transição',
  luz: 'Luz',
  objeto: 'Objeto',
  vida: 'Vida no hold',
};

export const CSS_BASE = `
:root {
  --pg-fundo: #f4f4f2;
  --pg-papel: #ffffff;
  --pg-tinta: #151619;
  --pg-suave: #676a72;
  --pg-fraca: #9a9ca3;
  --pg-fio: #e2e2df;
  --pg-fio-forte: #cfcfcb;
  --pg-raio: 14px;
  --pg-sombra: 0 1px 2px rgba(20, 21, 25, 0.06), 0 8px 28px rgba(20, 21, 25, 0.08);
  --pg-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --pg-mono: ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  --pg-tipo: #4b55a8;
  --pg-camera: #1f7a73;
  --pg-transicao: #9a5b13;
  --pg-luz: #8a7414;
  --pg-objeto: #a3404f;
  --pg-vida: #3f7a3a;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--pg-fundo);
  color: var(--pg-tinta);
  font: 15px/1.55 var(--pg-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
h1, h2, h3, h4, p, figure, ol, ul { margin: 0; padding: 0; }
ol, ul { list-style: none; }
h1, h2, h3, h4 { font-weight: 400; }
a { color: inherit; }
img, video { display: block; max-width: 100%; }
main { max-width: 1320px; margin: 0 auto; padding: 0 16px 72px; }
@media (min-width: 720px) { main { padding: 0 40px 96px; } }
.sobre { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--pg-suave); }
.num { font-variant-numeric: tabular-nums; }
.pilula {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 11px; border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--pg-fio-forte);
  font-size: 12px; color: var(--pg-tinta); white-space: nowrap; font-variant-numeric: tabular-nums;
}
.etiqueta {
  display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px;
  background: var(--pg-papel); box-shadow: inset 0 0 0 1px var(--pg-fio);
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pg-suave); white-space: nowrap;
}
.botao {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 18px; border-radius: 999px; border: 0;
  background: var(--pg-tinta); color: #fff; text-decoration: none; cursor: pointer;
  font: 500 13px/1 var(--pg-sans); letter-spacing: 0.01em; white-space: nowrap;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms;
}
.botao:hover { background: #2a2c31; }
.botao:active { transform: scale(0.97); }
.botao small { font-weight: 400; opacity: 0.66; }
.botao.contorno { background: transparent; color: var(--pg-tinta); box-shadow: inset 0 0 0 1px var(--pg-fio-forte); }
.botao.contorno:hover { background: rgba(20, 21, 25, 0.05); }
.quadro {
  position: relative; overflow: hidden; border-radius: 10px; background: #0d0d0e;
  box-shadow: var(--pg-sombra);
}
.quadro img, .quadro video { width: 100%; height: 100%; object-fit: cover; }
`;

export function pagina({ titulo, css = '', corpo, script = '' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23151619'/%3E%3Cpath d='M11 9l12 7-12 7z' fill='%23f4f4f2'/%3E%3C/svg%3E">
<title>${esc(titulo)}</title>
<style>${CSS_BASE}${css}</style>
</head>
<body>
${corpo}
${script ? `<script>${script}</script>` : ''}
</body>
</html>
`;
}
