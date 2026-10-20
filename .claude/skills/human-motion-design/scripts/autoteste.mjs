#!/usr/bin/env node
/**
 * autoteste.mjs — confere o motor e os modelos depois de qualquer mudança na skill (para quem mantém
 * a skill; não é parte do fluxo com a pessoa). Roda num projeto temporário, fora da skill.
 *
 *   node scripts/autoteste.mjs            tudo (~30 s)
 *   node scripts/autoteste.mjs --rapido   só o motor (sem os modelos)
 *
 * Confere:
 *  1. ponto-de-luz: a luz nasce no ponto da ponte da próxima cena (não no canto);
 *  2. lamina-de-luz e ponto-de-luz não clareiam o fundo da cena que sai;
 *  3. o aviso de camada de plano cheio sem sobra;
 *  4. cada modelo de cena (modelos/cenas): storyboard sem erro do motor e pureza.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerArgs } from './lib/args.mjs';
import { RAIZ_SKILL, abrirNavegador } from './lib/ambiente.mjs';
import { exigirFfmpeg } from './lib/ffmpeg.mjs';
import { abrirFilme } from './lib/captura.mjs';
import { montarFilme } from './lib/montar.mjs';
import { TIPOS_CENA, gravarJson, lerProjeto } from './lib/projeto.mjs';

const { op } = lerArgs(process.argv.slice(2), { bandeiras: ['rapido', 'manter'] });
const base = mkdtempSync(path.join(os.tmpdir(), 'hmd-autoteste-'));
let falhas = 0;
const ok = (cond, txt) => {
  console.log(`${cond ? '✓' : '✗'} ${txt}`);
  if (!cond) falhas++;
};

/* ─── projeto mínimo do motor ─── */
const P = path.join(base, 'human-output', 'motion-design', 'motor');
for (const d of ['cenas', 'marca', 'midia', 'referencias']) mkdirSync(path.join(P, d), { recursive: true });
writeFileSync(path.join(P, 'marca', 'tokens.css'), ':root{--fundo:#101010;--texto:#f0f0f0;--texto-suave:#999;--destaque:#ff8800;--destaque-grad:linear-gradient(90deg,#ff8800,#ffaa00);--luz-1:#ff8800;--luz-2:#222;--luz-3:#444;--fonte-titulo:sans-serif;--fonte-texto:sans-serif;}');
writeFileSync(path.join(P, 'cenas', 'a.js'), `Motion.cena('a', {
  render: () => '<div class="camada fundo-a"></div><div class="pilha"><h2 class="titulo">Teste</h2></div>',
  montar(el, api) { el.cam = api.camera(); },
  quadro(t, el, api) { el.cam.pose({ zoom: api.viva(t) }); },
});`);
writeFileSync(path.join(P, 'cenas', 'a.css'), '.cena-a .fundo-a{background:#303030}.cena-a .titulo{font-size:12cqmin}');
writeFileSync(path.join(P, 'cenas', 'b.js'), `Motion.cena('b', {
  render: () => '<div class="alvo" data-ponte="alvo"></div>',
  quadro(t, el, api) {},
});`);
writeFileSync(path.join(P, 'cenas', 'b.css'), '.cena-b .alvo{position:absolute;left:70cqw;top:20cqh;width:4cqw;height:4cqw;margin:-2cqw 0 0 -2cqw;background:#ff8800}');
gravarJson(path.join(P, 'motion.json'), {
  titulo: 'Autoteste', slug: 'motor', fps: 30, bpm: 120, formatoBase: '16x9', formatos: ['16x9'],
  cenas: [
    { id: 'a', dur: 1.5, quadros: [{ id: 'fim', t: 1 }], saida: { tipo: 'ponto-de-luz', ponte: 'alvo' } },
    { id: 'b', dur: 1, quadros: [{ id: 'fim', t: 0.8 }] },
  ],
});

const nav = await abrirNavegador();
try {
  const projeto = lerProjeto(P);
  const { arquivo, linha } = montarFilme(projeto, { formato: '16x9', fps: 30 });
  const X = linha.transicoes[0];
  const { pagina } = await abrirFilme(nav, arquivo, { formato: '16x9' });
  // 1. a luz no ponto certo
  const r = await pagina.evaluate(async (t) => {
    await window.__MOTION__.ir(t);
    const luz = document.querySelector('.m-sobre-luz');
    const alvo = Motion.cenaPorId.b.pontes.inicio.alvo;
    const b = luz && luz.getBoundingClientRect();
    const P = document.getElementById('palco').getBoundingClientRect();
    const u = P.width / 100;
    return b ? { luz: [(b.left + b.width / 2 - P.left) / u - 50, (b.top + b.height / 2 - P.top) / u - (P.height / P.width) * 50], alvo: [alvo.cx, alvo.cy], visivel: getComputedStyle(luz).display !== 'none' } : null;
  }, X.inicio + (X.fim - X.inicio) * 0.5);
  const dist = r ? Math.hypot(r.luz[0] - r.alvo[0], r.luz[1] - r.alvo[1]) : Infinity;
  ok(r && r.visivel && dist < 1, `ponto-de-luz nasce no ponto da ponte (distância ${dist.toFixed(2)} cqw)`);
  // 2. o fundo da cena que sai não clareia
  const filtro = await pagina.evaluate(async (t) => {
    await window.__MOTION__.ir(t);
    return { secao: Motion.cenaPorId.a.secao.style.filter || '', camera: Motion.cenaPorId.a.camera.style.filter || '' };
  }, X.inicio + (X.fim - X.inicio) * 0.3);
  ok(!/brightness/.test(filtro.secao) && /brightness/.test(filtro.camera), 'ponto-de-luz clareia só o conteúdo, não o fundo da cena');
  // 3. aviso de plano cheio sem sobra (a cena a tem .fundo-a com inset 0 sob a câmera)
  const erros = await pagina.evaluate(() => window.__MOTION__.erros());
  ok(erros.some((e) => e.cena === 'a' && /plano cheio sem sobra/.test(e.mensagem)), 'o motor avisa a camada de plano cheio sem sobra');
  await pagina.close();
} finally {
  await nav.close();
}

/* ─── 4. os modelos ─── */
if (!op.rapido) {
  const tipos = Object.keys(TIPOS_CENA);
  const ids = tipos.map((t, i) => `c${i + 1}:${t}`).join(',');
  const nodeBin = process.execPath;
  // insumos de teste: uma foto (gerada pelo ffmpeg) e uma logo com o grupo .simbolo
  const ins = path.join(base, 'insumos');
  mkdirSync(ins, { recursive: true });
  const ff = spawnSync(exigirFfmpeg(), ['-loglevel', 'error', '-f', 'lavfi', '-i', 'gradients=s=1600x1000:c0=0x6b4a33:c1=0xd9b38c:x0=200:y0=100:x1=1400:y1=900:seed=3,format=rgb24', '-frames:v', '1', path.join(ins, 'foto-teste.jpg')], { encoding: 'utf8' });
  ok(ff.status === 0, 'foto de teste gerada');
  writeFileSync(path.join(ins, 'logo-teste.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><g class="simbolo"><circle cx="40" cy="40" r="30" fill="#ff8800"/></g><g class="palavra" fill="currentColor"><rect x="90" y="20" width="190" height="40" rx="20"/></g></svg>');
  const r1 = spawnSync(nodeBin, [path.join(RAIZ_SKILL, 'scripts', 'novo-projeto.mjs'), '--titulo', 'Modelos', '--ids', ids, '--midia', path.join(ins, 'foto-teste.jpg'), '--logo', path.join(ins, 'logo-teste.svg')], { cwd: base, encoding: 'utf8' });
  ok(r1.status === 0, `novo-projeto com os ${tipos.length} tipos`);
  const r2 = spawnSync(nodeBin, [path.join(RAIZ_SKILL, 'scripts', 'storyboard.mjs'), 'modelos', '--sem-diretor'], { cwd: base, encoding: 'utf8' });
  const motorAvisou = /O motor avisou/.test(r2.stdout || '');
  ok(r2.status === 0 && !motorAvisou, `storyboard dos modelos sem erro do motor${motorAvisou ? `: ${(r2.stdout.split('O motor avisou:')[1] || '').trim().split('\n').slice(0, 4).join(' | ')}` : ''}`);
  const r3 = spawnSync(nodeBin, [path.join(RAIZ_SKILL, 'scripts', 'quadros.mjs'), 'modelos', '--pureza'], { cwd: base, encoding: 'utf8' });
  const impuras = (r3.stdout || '').split('\n').filter((l) => l.startsWith('✗'));
  ok(r3.status === 0 && !impuras.length, `pureza dos modelos${impuras.length ? `: ${impuras.join(' | ')}` : ''}`);
}

if (!op.manter) rmSync(base, { recursive: true, force: true });
else console.log(`projeto de teste mantido em ${base}`);
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
