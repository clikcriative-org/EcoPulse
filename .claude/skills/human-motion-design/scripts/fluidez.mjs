#!/usr/bin/env node
/**
 * fluidez.mjs — o detector de trancos: mede a mudança entre quadros vizinhos e aponta pulos,
 * quadros que aparecem inteiros de uma vez, movimentos que param seco e trechos congelados.
 *
 *   node scripts/fluidez.mjs <projeto> [--formato 16x9] [--versao 3]   (o MP4 do último render)
 *   node scripts/fluidez.mjs filme.mp4 [--cortes 2.4,4.5]   (ou "2,4;4,5")
 *   node scripts/fluidez.mjs pasta-de-quadros/ --fps 60
 *
 * Como lê: cada quadro vira cinza a 240 px; d = diferença média (0–255) entre vizinhos, normalizada
 * para 60 qps (a 30 qps um movimento suave muda o dobro por quadro). Cortes da linha do tempo são
 * ignorados (±1,5 quadro). Alertas:
 *   pico     d > 1,2 e > 3,2 × a mediana da vizinhança (±0,1 s)   → salto no meio do movimento
 *   espinho  d > 2,0 e > 1,7 × o maior dos dois vizinhos          → algo apareceu inteiro num quadro
 *   degrau   o par anterior > 2,0 e este < 20 % dele               → movimento forte que para seco
 *   parado   ≥ 0,25 s com d < 0,02 e imagem na tela                → trecho congelado (hold sem vida)
 * Gera <saída>/fluidez-<formato>.json, .svg (gráfico) e .html, e diz cena e tempo local de cada alerta.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerArgs, lista, num, ultimo } from './lib/args.mjs';
import { lerCinza, sondar } from './lib/ffmpeg.mjs';
import { esc, pagina, virgula } from './lib/paginas.mjs';
import { FORMATOS, lerJson, resolverProjeto } from './lib/projeto.mjs';

export const FRASES = {
  pico: 'salto no meio do movimento: algo muda de repente (curva sem rampa, propriedade que liga sem transição)',
  espinho: 'um quadro destoa dos vizinhos: algo apareceu ou sumiu inteiro num quadro, ou piscou',
  degrau: 'movimento forte que para seco: falta pouso (velocidade e desaceleração chegando juntas a zero)',
  parado: 'trecho congelado: o hold precisa de vida (deriva, luz que respira, push-in lento)',
};

/** Mede a fluidez. Entrada: arquivos (PNG/JPEG em ordem) ou video. linha: a linha do tempo (opcional). */
export async function medirFluidez({ arquivos, video, fps, largura, altura, linha = null, cortes = [], inicio = 0, entrada = 'png' }) {
  if (video && (!largura || !fps)) {
    const s = sondar(video);
    largura = largura || s.largura;
    altura = altura || s.altura;
    fps = fps || s.fps;
  }
  const W = 240;
  const H = Math.max(2, 2 * Math.round((W * altura) / largura / 2));
  const quadros = await lerCinza({ arquivos, video, largura: W, altura: H, entrada });
  const n = quadros.length;
  const N = W * H;
  const lum = quadros.map((q) => {
    let s = 0;
    for (let i = 0; i < N; i++) s += q[i];
    return s / N;
  });
  const k = fps / 60; // normaliza para 60 qps
  const d = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = quadros[i], b = quadros[i + 1];
    let s = 0;
    for (let j = 0; j < N; j++) s += Math.abs(a[j] - b[j]);
    d.push((s / N) * k);
  }
  const tPar = (i) => inicio + (i + 1) / fps; // instante do segundo quadro do par
  const todosCortes = [...cortes, ...((linha && linha.cortes) || [])];
  const pertoDeCorte = (t) => todosCortes.some((c) => Math.abs(t - c) <= 1.5 / fps + 1e-9);
  const cenaEm = (t) => {
    if (!linha) return null;
    let atual = null;
    for (const c of linha.cenas) if (t >= c.inicio - 1e-6 && t < c.fim + 1e-6) atual = c;
    return atual;
  };
  const permitido = (t) => {
    const c = cenaEm(t);
    if (!c || !c.permitirParado) return false;
    return c.permitirParado.some(([a, b]) => t - c.inicio >= a - 1e-6 && t - c.inicio <= b + 1e-6);
  };
  const alertas = [];
  const w = Math.max(3, Math.round(fps * 0.1));
  for (let i = 0; i < d.length; i++) {
    const t = tPar(i);
    if (pertoDeCorte(t)) continue;
    const viz = [];
    for (let j = Math.max(0, i - w); j < Math.min(d.length, i + w + 1); j++) if (j !== i) viz.push(d[j]);
    viz.sort((x, y) => x - y);
    const med = viz.length ? viz[Math.floor(viz.length / 2)] : 0;
    if (d[i] > 1.2 && d[i] > 3.2 * Math.max(med, 0.25)) alertas.push({ tipo: 'pico', i, t, d: d[i], viz: med });
    if (i > 0 && i < d.length - 1 && d[i] > 2.0 && d[i] > 1.7 * Math.max(d[i - 1], d[i + 1])) alertas.push({ tipo: 'espinho', i, t, d: d[i], viz: Math.max(d[i - 1], d[i + 1]) });
    if (i > 0 && d[i - 1] > 2.0 && d[i] < d[i - 1] * 0.2 && !pertoDeCorte(tPar(i - 1))) alertas.push({ tipo: 'degrau', i, t, d: d[i], viz: d[i - 1] });
  }
  let corrida = 0;
  const minimo = Math.round(fps * 0.25);
  for (let i = 0; i < d.length; i++) {
    const t = tPar(i);
    const parado = d[i] < 0.02 * k && lum[i + 1] > 1.0 && !pertoDeCorte(t) && !permitido(t);
    corrida = parado ? corrida + 1 : 0;
    if (corrida === minimo) alertas.push({ tipo: 'parado', i: i - corrida + 1, t: tPar(i - corrida + 1), d: d[i], viz: 0 });
    if (corrida > minimo && alertas.length && alertas[alertas.length - 1].tipo === 'parado') alertas[alertas.length - 1].ate = t;
  }
  alertas.sort((a, b) => a.t - b.t);
  for (const a of alertas) {
    const c = cenaEm(a.t);
    if (c) {
      a.cena = c.id;
      a.tituloCena = c.titulo;
      a.tLocal = Math.round((a.t - c.inicio) * 1000) / 1000;
    }
    a.frase = FRASES[a.tipo];
    a.t = Math.round(a.t * 1000) / 1000;
    a.d = Math.round(a.d * 100) / 100;
    a.viz = Math.round(a.viz * 100) / 100;
  }
  const porCena = {};
  if (linha) for (const c of linha.cenas) porCena[c.id] = { pico: 0, espinho: 0, degrau: 0, parado: 0 };
  for (const a of alertas) if (a.cena) porCena[a.cena][a.tipo]++;
  return { quadros: n, fps, inicio, largura, altura, d: d.map((x) => Math.round(x * 1000) / 1000), lum: lum.map((x) => Math.round(x * 10) / 10), alertas, porCena, cortes: todosCortes };
}

/** Gráfico em SVG: curva de mudança, faixas das cenas com nome, cortes e alertas. */
export function graficoSvg(res, linha) {
  const L = 1400, A = 300, m = { e: 40, d: 16, t: 34, b: 30 };
  const W = L - m.e - m.d, H = A - m.t - m.b;
  const n = res.d.length;
  const t0 = res.inicio, t1 = res.inicio + (n + 1) / res.fps;
  const xs = (t) => m.e + ((t - t0) / Math.max(1e-6, t1 - t0)) * W;
  const ordenado = [...res.d].sort((a, b) => a - b);
  const topo = Math.max(1.5, (ordenado[Math.floor(ordenado.length * 0.995)] || 1) * 1.15);
  const ys = (v) => m.t + H - (Math.min(v, topo) / topo) * H;
  const faixas = (linha?.cenas || [])
    .map((c, i) => {
      const x0 = xs(Math.max(t0, c.inicio)), x1 = xs(Math.min(t1, c.fim));
      if (x1 <= x0) return '';
      return `<rect x="${x0.toFixed(1)}" y="${m.t}" width="${(x1 - x0).toFixed(1)}" height="${H}" fill="${i % 2 ? '#f0f0ee' : '#f7f7f5'}"/><text x="${(x0 + 6).toFixed(1)}" y="${m.t - 10}" font-size="12" fill="#676a72">${String(i + 1).padStart(2, '0')} ${esc(c.titulo || c.id)}</text>`;
    })
    .join('');
  const cortes = (res.cortes || []).map((c) => `<line x1="${xs(c).toFixed(1)}" x2="${xs(c).toFixed(1)}" y1="${m.t}" y2="${m.t + H}" stroke="#b9bbc0" stroke-dasharray="3 3"/>`).join('');
  const pts = res.d.map((v, i) => `${xs(res.inicio + (i + 1) / res.fps).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const cor = { pico: '#c2410c', espinho: '#b91c1c', degrau: '#7c3aed', parado: '#0e7490' };
  const alertas = res.alertas
    .map((a) => (a.tipo === 'parado'
      ? `<rect x="${xs(a.t).toFixed(1)}" y="${m.t + H - 6}" width="${Math.max(3, xs(a.ate || a.t + 0.25) - xs(a.t)).toFixed(1)}" height="6" fill="${cor.parado}" opacity=".7"><title>parado ${virgula(a.t)} s</title></rect>`
      : `<circle cx="${xs(a.t).toFixed(1)}" cy="${ys(a.d).toFixed(1)}" r="6" fill="none" stroke="${cor[a.tipo]}" stroke-width="2"><title>${a.tipo} ${virgula(a.t)} s</title></circle>`))
    .join('');
  const eixo = [];
  for (let s = Math.ceil(t0); s <= t1; s++) eixo.push(`<text x="${xs(s).toFixed(1)}" y="${A - 10}" font-size="11" text-anchor="middle" fill="#9a9ca3">${s}s</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${A}" width="${L}" height="${A}" font-family="ui-sans-serif, system-ui, sans-serif"><rect width="${L}" height="${A}" fill="#fff"/>${faixas}${cortes}<polyline points="${pts}" fill="none" stroke="#151619" stroke-width="1.4" stroke-linejoin="round"/>${alertas}${eixo.join('')}</svg>`;
}

export function paginaFluidez(res, linha, titulo) {
  const linhas = res.alertas
    .map((a) => `<tr><td class="num">${virgula(a.t, 3)} s</td><td>${a.cena ? `${esc(a.tituloCena || a.cena)} <span class="suave num">· ${virgula(a.tLocal, 3)} s</span>` : '–'}</td><td><b>${a.tipo}</b>${a.ate ? ` <span class="suave num">até ${virgula(a.ate, 2)} s</span>` : ''}</td><td class="num">${virgula(a.d, 2)} <span class="suave">/ ${virgula(a.viz, 2)}</span></td><td>${esc(a.frase)}</td></tr>`)
    .join('');
  const css = `main{padding-top:40px}h1{font-size:34px;letter-spacing:-.03em;margin:8px 0 20px}.g{background:#fff;border-radius:12px;box-shadow:var(--pg-sombra);overflow:auto}.g svg{display:block;width:100%;height:auto;min-width:900px}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}td,th{text-align:left;padding:9px 10px;border-bottom:1px solid var(--pg-fio);vertical-align:top}th{font-weight:400;color:var(--pg-suave);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.suave{color:var(--pg-suave)}.ok{margin-top:24px;font-size:18px}`;
  const corpo = `<main><p class="sobre">Fluidez · ${esc(titulo)}</p><h1>${res.alertas.length ? `${res.alertas.length} ponto${res.alertas.length > 1 ? 's' : ''} para olhar` : 'Fluido: sem trancos'}</h1><div class="g">${graficoSvg(res, linha)}</div><p class="suave" style="margin-top:8px;font-size:13px">Curva = quanto a imagem muda de um quadro para o seguinte (normalizado para 60 qps). Linhas tracejadas = cortes (ignorados). Círculos = alertas; faixa embaixo = trecho parado.</p>${res.alertas.length ? `<table><thead><tr><th>Tempo</th><th>Cena · tempo local</th><th>O quê</th><th>Mudança / vizinhança</th><th>O que costuma ser</th></tr></thead><tbody>${linhas}</tbody></table>` : `<p class="ok">${res.quadros} quadros a ${res.fps} qps, curva contínua.</p>`}</main>`;
  return pagina({ titulo: `Fluidez · ${titulo}`, css, corpo });
}

export function resumoTexto(res) {
  if (!res.alertas.length) return `ok, sem trancos (${res.quadros} quadros a ${res.fps} qps)`;
  const cont = {};
  for (const a of res.alertas) cont[a.tipo] = (cont[a.tipo] || 0) + 1;
  return `${res.alertas.length} ponto(s) para olhar: ${Object.entries(cont).map(([k, v]) => `${v} ${k}`).join(', ')}`;
}

export function gravarFluidez(res, linha, pasta, nome, titulo) {
  mkdirSync(pasta, { recursive: true });
  const base = path.join(pasta, nome);
  const { d, lum, ...resto } = res;
  writeFileSync(`${base}.json`, JSON.stringify({ ...resto, d }, null, 1));
  writeFileSync(`${base}.svg`, graficoSvg(res, linha));
  writeFileSync(`${base}.html`, paginaFluidez(res, linha, titulo));
  return `${base}.html`;
}

/* ─── linha de comando ─── */
const souPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (souPrincipal) {
  const { pos, op } = lerArgs(process.argv.slice(2));
  const alvo = pos[0];
  if (!alvo) {
    console.error('Uso: node scripts/fluidez.mjs <projeto | video.mp4 | pasta-de-quadros> [--formato 16x9] [--versao N] [--fps 60] [--cortes 2,4.5]');
    process.exit(1);
  }
  // --cortes 2.4,4.5 ou --cortes "2,4;4,5" (com vírgula decimal, separe com ;)
  const txtCortes = op.cortes && op.cortes !== true ? String(ultimo(op.cortes)) : '';
  const cortes = (txtCortes.includes(';') ? txtCortes.split(';') : txtCortes.split(',')).map((x) => num(x.trim(), NaN)).filter(Number.isFinite);
  let res, linha = null, pastaSaida, nome, titulo;
  if (existsSync(alvo) && statSync(alvo).isFile()) {
    const info = sondar(alvo);
    res = await medirFluidez({ video: alvo, fps: num(ultimo(op.fps), info.fps), largura: info.largura, altura: info.altura, cortes });
    pastaSaida = path.join(path.dirname(path.resolve(alvo)), `${path.parse(alvo).name}-fluidez`);
    nome = 'fluidez';
    titulo = path.basename(alvo);
  } else if (existsSync(alvo) && statSync(alvo).isDirectory() && !existsSync(path.join(alvo, 'motion.json'))) {
    const arquivos = readdirSync(alvo).filter((n) => /\.(png|jpe?g)$/i.test(n) && !/folha|sheet|contato/i.test(n)).sort().map((n) => path.join(alvo, n));
    if (!arquivos.length) {
      console.error('A pasta não tem quadros PNG/JPEG.');
      process.exit(1);
    }
    const fps = num(ultimo(op.fps), 60);
    const { spawnSync } = await import('node:child_process');
    const { acharFfprobe } = await import('./lib/ambiente.mjs');
    let largura = 1920, altura = 1080;
    const pr = acharFfprobe();
    if (pr) {
      const r = spawnSync(pr, ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', arquivos[0]], { encoding: 'utf8' });
      const [w, h] = (r.stdout || '').trim().split(',').map(Number);
      if (w && h) [largura, altura] = [w, h];
    }
    res = await medirFluidez({ arquivos, fps, largura, altura, cortes, entrada: /\.jpe?g$/i.test(arquivos[0]) ? 'jpeg' : 'png' });
    pastaSaida = path.resolve(alvo, '..', `${path.basename(path.resolve(alvo))}-fluidez`);
    nome = 'fluidez';
    titulo = path.basename(path.resolve(alvo));
  } else {
    let P;
    try {
      P = resolverProjeto(alvo);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const pastaRender = path.join(P, 'render');
    const versoes = existsSync(pastaRender) ? readdirSync(pastaRender).filter((n) => /^v\d+$/.test(n)).sort((a, b) => +a.slice(1) - +b.slice(1)) : [];
    const v = op.versao ? `v${String(ultimo(op.versao)).replace(/^v/, '')}` : versoes[versoes.length - 1];
    if (!v || !existsSync(path.join(pastaRender, v))) {
      console.error('Nenhum render ainda. Rode renderizar.mjs antes.');
      process.exit(1);
    }
    const pv = path.join(pastaRender, v);
    const marcas = existsSync(path.join(pv, 'marcas.json')) ? lerJson(path.join(pv, 'marcas.json')) : null;
    const mp4s = readdirSync(pv).filter((n) => n.endsWith('.mp4'));
    const formato = ultimo(op.formato) || (mp4s.find((n) => n.includes('-16x9-')) ? '16x9' : '9x16');
    const mp4 = mp4s.find((n) => n.includes(`-${formato}-`));
    if (!mp4) {
      console.error(`Não achei o MP4 ${formato} em ${pv}`);
      process.exit(1);
    }
    linha = marcas && marcas.linhas ? marcas.linhas[formato] || marcas.linhas[Object.keys(marcas.linhas)[0]] : null;
    const info = sondar(path.join(pv, mp4));
    res = await medirFluidez({ video: path.join(pv, mp4), fps: info.fps, largura: FORMATOS[formato].largura, altura: FORMATOS[formato].altura, linha, cortes, inicio: (marcas && marcas.inicio) || 0 });
    pastaSaida = path.join(pv, '.fluidez');
    nome = `fluidez-${formato}`;
    titulo = `${mp4}`;
  }
  const html = gravarFluidez(res, linha, pastaSaida, nome, titulo);
  console.log(resumoTexto(res));
  for (const a of res.alertas.slice(0, 30)) {
    console.log(`  ${a.tipo.padEnd(7)} t=${virgula(a.t, 3)} s${a.cena ? ` · ${a.cena} t=${virgula(a.tLocal, 3)} s` : ''} · mudança ${virgula(a.d, 2)} (viz. ${virgula(a.viz, 2)}) · ${a.frase}`);
  }
  console.log(`gráfico: ${html}`);
  process.exit(res.alertas.length ? 2 : 0);
}
