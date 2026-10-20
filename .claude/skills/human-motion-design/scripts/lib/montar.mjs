/* montar.mjs — monta o filme: um HTML único por formato com o motor, a marca (fontes embutidas),
   as cenas e a linha do tempo. Abre em qualquer lugar (file://) e não carrega nada da rede. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PASTA_MOTOR, acharFfmpeg } from './ambiente.mjs';
import { arquivoDaCena, catalogo, linhaDoTempo } from './projeto.mjs';

const ORDEM_MOTOR = ['tempo.js', 'motion.js', 'camera.js', 'tipo.js', 'dinamicas.js', 'nivel.js', 'midia.js', 'transicoes.js', 'player.js'];
const IMAGEM = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const VIDEO = /\.(mp4|mov|webm|m4v|mkv)$/i;
const FONTE = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };

const ler = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const posix = (p) => p.split(path.sep).join('/');
const urlRel = (de, para) => posix(path.relative(de, para)).split('/').map(encodeURIComponent).join('/');
const scriptSeguro = (s) => s.replace(/<\/script/gi, '<\\/script');

/** Lê marca/tokens.css: troca url() de fontes por data URI e lista as famílias. */
export function lerMarca(pastaProjeto, pastaFilme) {
  const pastaMarca = path.join(pastaProjeto, 'marca');
  let css = ler(path.join(pastaMarca, 'tokens.css'));
  const extra = existsSync(pastaMarca) ? readdirSync(pastaMarca).filter((n) => n.endsWith('.css') && n !== 'tokens.css').sort() : [];
  for (const n of extra) css += `\n/* ${n} */\n` + ler(path.join(pastaMarca, n));
  const fontes = [];
  css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, url) => {
    if (/^(data:|https?:|#)/.test(url)) return m;
    const abs = path.resolve(pastaMarca, url);
    if (!existsSync(abs)) return m;
    const ext = path.extname(abs).toLowerCase();
    if (FONTE[ext]) return `url("data:${FONTE[ext]};base64,${readFileSync(abs).toString('base64')}")`;
    return `url("${urlRel(pastaFilme, abs)}")`;
  });
  for (const bloco of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const familia = /font-family\s*:\s*(['"]?)([^;'"]+)\1/.exec(bloco)?.[2]?.trim();
    const peso = /font-weight\s*:\s*([^;]+)/.exec(bloco)?.[1]?.trim().split(/\s+/)[0] || '400';
    const estilo = /font-style\s*:\s*([^;]+)/.exec(bloco)?.[1]?.trim() || 'normal';
    if (familia) fontes.push({ familia, peso, estilo });
  }
  return { css, fontes };
}

/** Mídia da pessoa (midia/) e ativos da marca (marca/ativos/), por nome. */
export function lerMidia(pastaProjeto, pastaFilme, { textoCenas = '', fps = 30, larguraMax = 1920 } = {}) {
  const mapa = {};
  const svg = {};
  const pastas = [path.join(pastaProjeto, 'midia'), path.join(pastaProjeto, 'marca', 'ativos')];
  const avisos = [];
  for (const base of pastas) {
    if (!existsSync(base)) continue;
    const andar = (d) => {
      for (const n of readdirSync(d).sort()) {
        if (n.startsWith('.')) continue;
        const abs = path.join(d, n);
        if (statSync(abs).isDirectory()) {
          andar(abs);
          continue;
        }
        const chave = path.relative(base, abs).split(path.sep).join('/').replace(/\.[a-z0-9]+$/i, '');
        if (mapa[chave]) continue; // midia/ ganha de marca/ativos/
        const item = { chave, arquivo: abs, url: urlRel(pastaFilme, abs) };
        if (/\.svg$/i.test(n)) {
          item.tipo = 'svg';
          if (statSync(abs).size < 600_000) svg[chave] = readFileSync(abs, 'utf8');
        } else if (IMAGEM.test(n)) item.tipo = 'imagem';
        else if (VIDEO.test(n)) item.tipo = 'video';
        else continue;
        mapa[chave] = item;
        mapa[path.basename(n)] = item;
        mapa[n.replace(/\.[a-z0-9]+$/i, '')] = mapa[n.replace(/\.[a-z0-9]+$/i, '')] || item;
      }
    };
    andar(base);
  }
  // vídeos usados com c.video('nome'): viram sequência de quadros no fps do filme
  const usados = new Set([...textoCenas.matchAll(/\bc\.video\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
  for (const nome of usados) {
    const item = mapa[nome] || mapa[nome.replace(/\.[a-z0-9]+$/i, '')];
    if (!item || item.tipo !== 'video') {
      avisos.push(`c.video("${nome}"): não achei esse vídeo em midia/`);
      continue;
    }
    if (item.quadros) continue;
    const pasta = path.join(pastaProjeto, '.cache', 'midia', `${item.chave.replace(/[^\w-]+/g, '_')}-${fps}`);
    const pronto = path.join(pasta, 'pronto.json');
    const assinatura = `${statSync(item.arquivo).size}|${Math.floor(statSync(item.arquivo).mtimeMs)}|${larguraMax}`;
    let info = existsSync(pronto) ? JSON.parse(readFileSync(pronto, 'utf8')) : null;
    if (!info || info.assinatura !== assinatura) {
      const ffmpeg = acharFfmpeg();
      if (!ffmpeg) {
        avisos.push(`c.video("${nome}"): precisa do ffmpeg para virar quadros`);
        continue;
      }
      mkdirSync(pasta, { recursive: true });
      for (const n of readdirSync(pasta)) if (/^q_\d+\.jpg$/.test(n)) unlinkSync(path.join(pasta, n));
      const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', item.arquivo, '-vf', `fps=${fps},scale='min(iw,${larguraMax})':-2`, '-q:v', '2', path.join(pasta, 'q_%05d.jpg')], { encoding: 'utf8' });
      if (r.status !== 0) {
        avisos.push(`c.video("${nome}"): o ffmpeg não conseguiu ler o vídeo (${(r.stderr || '').split('\n')[0]})`);
        continue;
      }
      const n = readdirSync(pasta).filter((x) => /^q_\d+\.jpg$/.test(x)).length;
      info = { assinatura, n, fps };
      writeFileSync(pronto, JSON.stringify(info));
    }
    item.quadros = { pasta: urlRel(pastaFilme, pasta), prefixo: 'q_', ext: 'jpg', n: info.n, fps };
  }
  // limpa caminhos absolutos antes de ir para o HTML
  const publico = {};
  for (const [k, v] of Object.entries(mapa)) publico[k] = { chave: v.chave, url: v.url, tipo: v.tipo, ...(v.quadros ? { quadros: v.quadros } : {}) };
  return { mapa: publico, svg, avisos };
}

/**
 * Monta filme/<montagem>-<formato>.html. Devolve { arquivo, linha, avisos }.
 * opções: montagem, formato, fps, destino (caminho do HTML), cenas (lista de ids: só elas, mesmos tempos)
 */
export function montarFilme(projeto, { montagem = 'principal', formato, fps, destino, cenas: so } = {}) {
  const P = projeto.pasta;
  const linha = linhaDoTempo(projeto, { montagem, formato, fps });
  const arquivo = destino || path.join(P, 'filme', `${montagem}-${linha.formato}.html`);
  const pastaFilme = path.dirname(arquivo);
  mkdirSync(pastaFilme, { recursive: true });
  const avisos = [];

  let linhaFilme = linha;
  if (so && so.length) {
    // só estas cenas, com os mesmos tempos globais, mais as vizinhas que se sobrepõem a elas
    const pedidas = new Set(so);
    for (const X of linha.transicoes) {
      if (X.modo === 'sobreposta' && X.para) {
        if (pedidas.has(X.de)) pedidas.add(X.para);
        if (pedidas.has(X.para)) pedidas.add(X.de);
      }
    }
    linhaFilme = Object.assign({}, linha, {
      cenas: linha.cenas.filter((c) => pedidas.has(c.id)),
      transicoes: linha.transicoes.filter((X) => pedidas.has(X.de) && (!X.para || pedidas.has(X.para))),
    });
  }

  const marca = lerMarca(P, pastaFilme);
  const textoCenas = [];
  let cssCenas = '';
  let jsCenas = '';
  const comumCss = ler(path.join(P, 'cenas', '_comum.css'));
  const comumJs = ler(path.join(P, 'cenas', '_comum.js'));
  const transJs = ler(path.join(P, 'cenas', '_transicoes.js'));
  const scriptsCenas = [];
  for (const c of linhaFilme.cenas) {
    const a = arquivoDaCena(projeto, c.id, c.variante);
    const js = ler(a.js);
    const css = ler(a.css);
    if (!js) avisos.push(`a cena "${c.id}" não tem ${path.basename(a.js)}`);
    textoCenas.push(js, css);
    cssCenas += `\n/* ── cenas/${path.basename(a.css)} ── */\n${css}`;
    scriptsCenas.push(`<script>${scriptSeguro(js)}\n//# sourceURL=cenas/${path.basename(a.js)}</script>`);
  }
  jsCenas = scriptsCenas.join('\n');
  const midia = lerMidia(P, pastaFilme, { textoCenas: textoCenas.join('\n') + comumJs, fps: linha.fps, larguraMax: 1920 });
  avisos.push(...midia.avisos);

  // imagens citadas por nome no CSS/JS das cenas: decodificadas antes de começar
  const citadas = new Set();
  const textoTudo = textoCenas.join('\n') + comumCss + comumJs + marca.css;
  for (const [k, v] of Object.entries(midia.mapa)) {
    if (v.tipo === 'imagem' && textoTudo.includes(k)) citadas.add(v.url);
  }

  const motor = ORDEM_MOTOR.map((n) => `<script>${scriptSeguro(ler(path.join(PASTA_MOTOR, n)))}\n//# sourceURL=motor/${n}</script>`).join('\n');
  const css = [ler(path.join(PASTA_MOTOR, 'base.css')), ler(path.join(PASTA_MOTOR, 'nivel.css')), ler(path.join(PASTA_MOTOR, 'player.css'))].join('\n');
  const dados = {
    MOTION_LINHA: linhaFilme,
    MOTION_FONTES: marca.fontes,
    MOTION_MIDIA: midia.mapa,
    MOTION_SVG: midia.svg,
    MOTION_IMAGENS: [...citadas],
    MOTION_CATALOGO: catalogo(),
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="pt-BR" data-formato="${linha.formato}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(linha.titulo)} · ${linha.formato === '9x16' ? '9:16' : '16:9'}</title>
<style>
/* ── marca/tokens.css (fontes embutidas) ── */
${marca.css}
/* ── motor/base.css ── */
${css}
/* ── cenas/_comum.css ── */
${comumCss}
${cssCenas}
</style>
</head>
<body>
<div id="palco" data-formato="${linha.formato}"></div>
<script>${Object.entries(dados).map(([k, v]) => `window.${k}=${scriptSeguro(JSON.stringify(v))};`).join('\n')}</script>
${motor}
${comumJs ? `<script>${scriptSeguro(comumJs)}\n//# sourceURL=cenas/_comum.js</script>` : ''}
${transJs ? `<script>${scriptSeguro(transJs)}\n//# sourceURL=cenas/_transicoes.js</script>` : ''}
${jsCenas}
<script>
Motion.iniciar().then(function () {
  if (!Motion.captura && window.MotionPlayer) MotionPlayer.montar();
}).catch(function (e) { Motion.erro(null, 'motor', null, e); });
</script>
</body>
</html>
`;
  writeFileSync(arquivo, html);
  return { arquivo, linha, linhaFilme, avisos, fontes: marca.fontes };
}
