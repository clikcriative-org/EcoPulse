#!/usr/bin/env node
/**
 * previa.mjs — a página de entrega: os vídeos tocando (16:9 e 9:16), as cenas com miniatura
 * (clique leva ao tempo), o storyboard, as versões anteriores, "Quer mudar alguma coisa?" e os
 * botões de baixar (MP4 de cada formato, capa, MP4 por cena e Baixar tudo .zip).
 * Sem bastidor: nada de relatório técnico, regras da conversa ou nome de comando na página.
 *
 *   node scripts/previa.mjs <projeto>               → <projeto>/previa.html (última versão)
 *   node scripts/previa.mjs <projeto> --versao 2
 *   node scripts/previa.mjs <projeto> --servir      → também sobe um servidor local (downloads funcionam)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lerArgs, num, ultimo } from './lib/args.mjs';
import { dataBr, esc, nomeFormato, pagina, rel, tempoBatida, timecode, virgula, ROTULO_BATIDA } from './lib/paginas.mjs';
import { FORMATOS, lerJson, lerProjeto, resolverProjeto } from './lib/projeto.mjs';
import { servir } from './lib/servir.mjs';
import { criarZip } from './lib/zip.mjs';

const { pos, op } = lerArgs(process.argv.slice(2), { bandeiras: ['sem-zip', 'ajuda', 'help'] });
if (op.ajuda || op.help) {
  console.log(`Uso: node <skill>/scripts/previa.mjs <projeto> [--servir [porta]] [--versao N] [--sem-zip]
  Gera <projeto>/previa.html (a página de entrega) e o zip da versão; com --servir, sobe um servidor
  local (os botões de baixar funcionam) e fica rodando: rode em segundo plano.`);
  process.exit(0);
}
let P;
try {
  P = resolverProjeto(pos[0]);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const projeto = lerProjeto(P);
const J = projeto.json;
const pastaRender = path.join(P, 'render');
const versoes = existsSync(pastaRender)
  ? readdirSync(pastaRender).filter((n) => /^v\d+$/.test(n) && existsSync(path.join(pastaRender, n, 'relatorio.json'))).map((n) => +n.slice(1)).sort((a, b) => a - b)
  : [];
if (!versoes.length) {
  console.error('Ainda não há render. Rode renderizar.mjs antes de montar a entrega.');
  process.exit(1);
}
const v = op.versao ? num(String(ultimo(op.versao)).replace(/^v/, ''), versoes[versoes.length - 1]) : versoes[versoes.length - 1];
const pastaV = path.join(pastaRender, `v${v}`);
if (!existsSync(path.join(pastaV, 'relatorio.json'))) {
  console.error(`Não achei a versão v${v}.`);
  process.exit(1);
}
const rel0 = lerJson(path.join(pastaV, 'relatorio.json'));
const marcas = existsSync(path.join(pastaV, 'marcas.json')) ? lerJson(path.join(pastaV, 'marcas.json')) : null;
const formatos = ['16x9', '9x16'].filter((f) => rel0.formatos[f]);
const r = (p) => rel(P, p);
const registro = (J.versoes || []).find((x) => x.v === v) || {};
const cenas = marcas ? marcas.cenas : (J.cenas || []).map((c) => ({ id: c.id, titulo: c.titulo, inicio: 0, fim: c.dur }));
const cenasJson = Object.fromEntries((J.cenas || []).map((c) => [c.id, c]));
const total = marcas ? marcas.total : cenas.reduce((s, c) => Math.max(s, c.fim), 0);
const tamanho = (p) => {
  const b = statSync(p).size;
  return b > 1e6 ? `${virgula(b / 1e6, 1)} MB` : `${Math.round(b / 1e3)} KB`;
};

/* ─── zip com tudo ─── */
let zip = null;
if (!op['sem-zip']) {
  const itens = [];
  for (const f of formatos) {
    const info = rel0.formatos[f];
    itens.push({ caminho: path.join(pastaV, info.arquivo), nome: info.arquivo });
    if (info.prores && existsSync(path.join(pastaV, info.prores))) itens.push({ caminho: path.join(pastaV, info.prores), nome: info.prores });
    if (info.capa && existsSync(path.join(pastaV, info.capa))) itens.push({ caminho: path.join(pastaV, info.capa), nome: info.capa });
    for (const c of info.cenas || []) if (existsSync(path.join(pastaV, c))) itens.push({ caminho: path.join(pastaV, c), nome: c });
  }
  zip = path.join(pastaV, `${projeto.slug}-v${v}.zip`);
  criarZip(zip, itens.filter((i) => existsSync(i.caminho)));
}

/* ─── miniaturas: o quadro final de cada cena (storyboard) ─── */
const miniatura = (formato, i, c) => {
  const pasta = path.join(P, 'storyboard', 'quadros', formato);
  if (!existsSync(pasta)) return null;
  const nn = String(i + 1).padStart(2, '0');
  const qs = (cenasJson[c.id]?.quadros || []).map((q) => q.id);
  const ultimoQ = qs[qs.length - 1];
  const f = path.join(pasta, `${nn}-${c.id}-${ultimoQ}.png`);
  return existsSync(f) ? r(f) : null;
};

const principal = formatos.includes('16x9') ? '16x9' : formatos[0];
const blocoVideo = (f) => {
  const info = rel0.formatos[f];
  const mp4 = path.join(pastaV, info.arquivo);
  const capa = info.capa && existsSync(path.join(pastaV, info.capa)) ? r(path.join(pastaV, info.capa)) : '';
  return `<figure class="video f${f}">
    <div class="tela f${f}"><video id="video-${f}" src="${esc(r(mp4))}" ${capa ? `poster="${esc(capa)}"` : ''} controls muted loop playsinline preload="metadata"></video></div>
    <figcaption>
      <div><b>${nomeFormato(f)}</b> <span class="num">${FORMATOS[f].largura}×${FORMATOS[f].altura} · ${rel0.fps} qps · ${tamanho(mp4)}</span></div>
      <div class="baixar">
        <a class="botao" href="${esc(r(mp4))}" download>MP4 <small>${nomeFormato(f)}</small></a>
        ${capa ? `<a class="botao contorno" href="${esc(capa)}" download>Capa <small>PNG</small></a>` : ''}
        ${info.prores ? `<a class="botao contorno" href="${esc(r(path.join(pastaV, info.prores)))}" download>ProRes <small>.mov</small></a>` : ''}
      </div>
    </figcaption>
  </figure>`;
};

const listaCenas = cenas
  .map((c, i) => {
    const img = miniatura(principal, i, c) || miniatura(formatos[0], i, c);
    const porCena = (rel0.formatos[principal]?.cenas || []).find((x) => x.includes(`-${String(i + 1).padStart(2, '0')}-${c.id}-`));
    return `<li><button type="button" data-t="${c.inicio}" title="Ver a partir daqui"><div class="mini f${principal}">${img ? `<img src="${esc(img)}" alt="" loading="eager">` : ''}</div><p><b>${String(i + 1).padStart(2, '0')} · ${esc(c.titulo)}</b><span class="num">${timecode(c.inicio)}</span></p></button>${porCena ? `<a class="so-cena" href="${esc(r(path.join(pastaV, porCena)))}" download>MP4 da cena</a>` : ''}</li>`;
  })
  .join('');

const storyboard = (J.cenas || [])
  .filter((c) => cenas.some((x) => x.id === c.id))
  .map((c) => {
    const i = cenas.findIndex((x) => x.id === c.id);
    const nn = String(i + 1).padStart(2, '0');
    const f = principal;
    const quadros = (c.quadros || [])
      .map((q) => {
        const arq = path.join(P, 'storyboard', 'quadros', f, `${nn}-${c.id}-${q.id}.png`);
        return existsSync(arq) ? `<figure><div class="mini f${f}"><img src="${esc(r(arq))}" alt="" loading="eager"></div><figcaption>${esc(q.rotulo || q.id)}${q.legenda ? ` · ${esc(q.legenda)}` : ''}</figcaption></figure>` : '';
      })
      .join('');
    const bat = [...(c.batidas || [])]
      .sort((a, b) => a.t - b.t)
      .map((b) => `<li><span class="num">${tempoBatida(b.t)}</span> <em>${esc(ROTULO_BATIDA[b.tipo] || '')}</em> ${esc(b.texto)}</li>`)
      .join('');
    return `<article class="sb-cena"><header><span class="num">${nn}</span><h3>${esc(c.titulo || c.id)}</h3>${c.ideia ? `<p>${esc(c.ideia)}</p>` : ''}</header><div class="sb-quadros f${f}">${quadros}</div>${bat ? `<ol class="sb-batidas">${bat}</ol>` : ''}</article>`;
  })
  .join('');

const outras = versoes
  .filter((x) => x !== v)
  .reverse()
  .map((x) => {
    const pv = path.join(pastaRender, `v${x}`);
    let relX = null;
    try {
      relX = lerJson(path.join(pv, 'relatorio.json'));
    } catch {
      return '';
    }
    const reg = (J.versoes || []).find((y) => y.v === x) || {};
    const links = Object.entries(relX.formatos || {})
      .map(([f, info]) => (existsSync(path.join(pv, info.arquivo)) ? `<a href="${esc(r(path.join(pv, info.arquivo)))}" download>${nomeFormato(f)}</a>` : ''))
      .join(' · ');
    return `<li><b>v${x}</b><span class="num">${dataBr(reg.data || relX.data)}</span><span>${esc(reg.nota || '')}</span><span class="links">${links}</span></li>`;
  })
  .join('');

const linhaMeta = [`${virgula(total, 1)} s`, `${rel0.fps} qps`, formatos.map(nomeFormato).join(' e '), `${cenas.length} cenas`].join(' · ');
const sbLink = existsSync(path.join(P, 'storyboard', 'index.html')) ? r(path.join(P, 'storyboard', 'index.html')) : null;

const css = `
.entrega { padding-top: 48px; }
.cab { display: grid; gap: 14px; padding-bottom: 32px; }
.cab h1 { font-size: clamp(40px, 6.4vw, 96px); line-height: 0.95; letter-spacing: -0.045em; text-wrap: balance; max-width: 16ch; }
.cab .meta { color: var(--pg-suave); font-size: 15px; }
.cab .nota { font-size: 15px; max-width: 60ch; }
.acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.videos { display: grid; gap: 24px; align-items: start; }
.videos.dois { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 980px) { .videos.dois { grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr); } }
.videos.um.f9x16 { max-width: 460px; }
.video .tela { overflow: hidden; border-radius: 14px; background: #0c0c0d; box-shadow: var(--pg-sombra); }
.video .tela.f16x9 { aspect-ratio: 16 / 9; }
.video .tela.f9x16 { aspect-ratio: 9 / 16; max-height: 80vh; margin: 0 auto; }
.video video { width: 100%; height: 100%; object-fit: contain; background: #0c0c0d; }
.video figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; font-size: 13.5px; color: var(--pg-suave); }
.video figcaption b { font-weight: 500; color: var(--pg-tinta); margin-right: 6px; }
.baixar { display: flex; flex-wrap: wrap; gap: 6px; }
.baixar .botao { height: 34px; padding: 0 14px; font-size: 12.5px; }
.sec { padding-top: 52px; }
.sec > h2 { margin-bottom: 18px; }
.cenas ol { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px 14px; }
.cenas button { display: block; width: 100%; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.cenas button:hover .mini { box-shadow: 0 0 0 2px var(--pg-tinta), var(--pg-sombra); }
.cenas p { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 13px; color: var(--pg-suave); }
.cenas p b { font-weight: 400; color: var(--pg-tinta); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.so-cena { display: inline-block; margin-top: 4px; font-size: 12px; color: var(--pg-suave); }
.mini { overflow: hidden; border-radius: 8px; background: #0c0c0d; box-shadow: var(--pg-sombra); transition: box-shadow 160ms; }
.mini.f16x9 { aspect-ratio: 16 / 9; }
.mini.f9x16 { aspect-ratio: 9 / 16; }
.mini img { width: 100%; height: 100%; object-fit: cover; }
.sb-cena { display: grid; gap: 14px; padding: 22px 0; border-top: 1px solid var(--pg-fio); }
@media (min-width: 980px) { .sb-cena { grid-template-columns: 260px minmax(0, 1fr); column-gap: 32px; } .sb-cena .sb-batidas { grid-column: 2; } }
.sb-cena header { display: grid; gap: 4px; align-content: start; }
.sb-cena header .num { font-size: 13px; color: var(--pg-suave); }
.sb-cena h3 { font-size: 22px; letter-spacing: -0.02em; }
.sb-cena header p { color: var(--pg-suave); font-size: 14px; text-wrap: pretty; }
.sb-quadros { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.sb-quadros.f9x16 { grid-template-columns: repeat(auto-fill, minmax(130px, 160px)); }
.sb-quadros figcaption { margin-top: 6px; font-size: 12.5px; color: var(--pg-suave); text-wrap: pretty; }
.sb-batidas { display: grid; gap: 6px; font-size: 13.5px; }
.sb-batidas .num { display: inline-block; min-width: 52px; color: var(--pg-suave); }
.sb-batidas em { font-style: normal; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pg-fraca); margin-right: 4px; }
.versoes li { display: grid; grid-template-columns: 48px 96px 1fr auto; gap: 12px; padding: 10px 0; border-top: 1px solid var(--pg-fio); font-size: 14px; align-items: baseline; }
.versoes .links a { color: var(--pg-tinta); }
@media (max-width: 640px) { .versoes li { grid-template-columns: 40px 1fr; } .versoes li > span:nth-child(3), .versoes .links { grid-column: 1 / -1; } }
.mudar { margin-top: 56px; padding: 28px; border-radius: 18px; background: var(--pg-papel); box-shadow: inset 0 0 0 1px var(--pg-fio); }
.mudar h2 { font-size: clamp(24px, 3vw, 34px); letter-spacing: -0.03em; }
.mudar p { margin-top: 6px; color: var(--pg-suave); }
.mudar ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 18px; }
.mudar li { padding: 12px 14px; border-radius: 12px; background: var(--pg-fundo); font-size: 14px; }
`;

const corpo = `<main class="entrega">
  <header class="cab">
    <p class="sobre">Motion · v${v} · ${dataBr(registro.data || rel0.data)}</p>
    <h1>${esc(J.titulo || projeto.slug)}</h1>
    <p class="meta num">${esc(linhaMeta)}</p>
    ${registro.nota && v > 1 ? `<p class="nota">Nesta versão: ${esc(registro.nota)}</p>` : ''}
    <div class="acoes">
      ${zip ? `<a class="botao" href="${esc(r(zip))}" download>Baixar tudo <small>.zip · ${tamanho(zip)}</small></a>` : ''}
      ${sbLink ? `<a class="botao contorno" href="${esc(sbLink)}" target="_blank" rel="noopener">Storyboard</a>` : ''}
    </div>
  </header>
  <section class="videos ${formatos.length > 1 ? 'dois' : `um f${formatos[0]}`}">${formatos.map(blocoVideo).join('')}</section>
  <section class="sec cenas"><h2 class="sobre">Cenas</h2><ol>${listaCenas}</ol></section>
  ${storyboard ? `<section class="sec"><h2 class="sobre">Storyboard</h2>${storyboard}</section>` : ''}
  ${outras ? `<section class="sec versoes"><h2 class="sobre">Versões anteriores</h2><ul>${outras}</ul></section>` : ''}
  <section class="mudar">
    <h2>Quer mudar alguma coisa?</h2>
    <p>É só dizer na conversa, do jeito que falaria com quem animou. Por exemplo:</p>
    <ul>
      <li>“Na cena ${Math.min(2, cenas.length)}, a entrada do texto mais lenta”</li>
      <li>“O mergulho mais longo, com mais embalo”</li>
      <li>“Segura mais um segundinho no fim, com a marca”</li>
      <li>“Troca a frase da cena 1 por …”</li>
    </ul>
  </section>
</main>`;

const script = `
const principal = document.getElementById('video-${principal}');
document.querySelectorAll('.cenas button[data-t]').forEach((b) => b.addEventListener('click', () => {
  if (!principal) return;
  principal.currentTime = parseFloat(b.dataset.t) + 0.001;
  principal.play().catch(() => {});
  principal.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));
const vistos = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.35 });
document.querySelectorAll('.videos video').forEach((v) => vistos.observe(v));
`;

const destino = path.join(P, 'previa.html');
writeFileSync(destino, pagina({ titulo: `${J.titulo || projeto.slug} · v${v}`, css, corpo, script }));
console.log(`Página de entrega: ${destino}`);
if (zip) console.log(`Pacote: ${path.relative(P, zip)}`);

if (op.servir) {
  const porta = op.servir === true ? 4600 : num(op.servir, 4600);
  const { url } = await servir(P, { porta });
  console.log(`Servindo em ${url}previa.html  (Ctrl+C para parar; servido, os botões baixam o arquivo)`);
} else {
  console.log('Dica: com --servir os botões de baixar funcionam em qualquer navegador.');
}
