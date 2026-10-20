#!/usr/bin/env node
/**
 * checar.mjs — confere se a máquina tem tudo para fazer motion com a skill, antes de começar.
 *
 *   node scripts/checar.mjs              checa e instala o playwright-core na pasta da skill se faltar
 *   node scripts/checar.mjs --completo   também mede a velocidade de captura (estimativa de render)
 *   node scripts/checar.mjs --sem-instalar | --json
 *
 * Confere: Node (versão), Chrome/Chromium/Edge (acha o executável no macOS, Windows e Linux),
 * ffmpeg e ffprobe (e o encoder H.264), playwright-core, espaço em disco e núcleos.
 * Diz em português o que falta e o comando exato de instalação para o sistema da pessoa.
 * Instalação no sistema (brew, winget, apt) fica com a pessoa; só o npm local é automático.
 * Sai com 0 quando dá para trabalhar e 1 quando falta algo obrigatório.
 */
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { lerArgs } from './lib/args.mjs';
import {
  RAIZ_SKILL, SO, acharChrome, acharFfmpeg, acharFfprobe, acharNoPath, carregarPlaywright, comoInstalar, cpus,
  encodersFfmpeg, espacoLivre, abrirNavegador, versaoDe, versaoPlaywright, workersPadrao,
} from './lib/ambiente.mjs';

const { op } = lerArgs(process.argv.slice(2), { bandeiras: ['completo', 'sem-instalar', 'json'] });
const SISTEMA = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[SO] || SO;
const itens = [];
const ok = (nome, detalhe) => itens.push({ nome, ok: true, detalhe });
const falta = (nome, detalhe, comandos, obrigatorio = true) => itens.push({ nome, ok: false, detalhe, comandos, obrigatorio });
const log = (...a) => !op.json && console.log(...a);

log(`\nHuman Motion Design · checando a máquina (${SISTEMA})\n`);

/* Node */
const [maior, menor] = process.versions.node.split('.').map(Number);
if (maior > 18 || (maior === 18 && menor >= 17)) ok('Node', `v${process.versions.node}`);
else falta('Node', `v${process.versions.node} é antigo (precisa 18.17 ou mais novo)`, comoInstalar('node'));

/* playwright-core (local, na pasta da skill) */
let pw = carregarPlaywright();
if (!pw && !op['sem-instalar']) {
  log('· Instalando o playwright-core na pasta da skill (uma vez só, ~10 MB)…');
  const npm = SO === 'win32' ? 'npm.cmd' : 'npm';
  // sem --prefix: o cwd já é a pasta da skill (no Windows o shell juntaria um caminho com espaço sem aspas)
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund'], {
    cwd: RAIZ_SKILL,
    stdio: op.json ? 'ignore' : 'inherit',
    shell: SO === 'win32',
  });
  if (r.status === 0) pw = carregarPlaywright();
}
if (pw) ok('playwright-core', `${versaoPlaywright() || ''} (na pasta da skill)`);
else falta('playwright-core', 'não está instalado na pasta da skill', comoInstalar('playwright'));

/* Navegador */
const chrome = acharChrome();
let versaoChrome = null;
if (chrome && pw) {
  try {
    const nav = await abrirNavegador();
    versaoChrome = nav.version();
    await nav.close();
  } catch (e) {
    falta('Navegador', `achei ${chrome.nome}, mas ele não abriu: ${String(e.message).split('\n')[0]}`, comoInstalar('chrome'));
  }
}
if (chrome && (versaoChrome || !pw)) ok('Navegador', `${chrome.nome}${versaoChrome ? ` ${versaoChrome}` : ''} · ${chrome.caminho}`);
else if (!chrome) falta('Navegador', 'não achei Google Chrome, Chromium nem Edge', comoInstalar('chrome'));

/* ffmpeg e ffprobe */
const ffmpeg = acharFfmpeg();
if (ffmpeg) {
  const enc = encodersFfmpeg(ffmpeg);
  const v = versaoDe(ffmpeg).replace(/^ffmpeg version\s+/, '').split(' ')[0];
  if (enc.libx264) ok('ffmpeg', `${v} · H.264 ✓${enc.prores ? ' · ProRes ✓' : ''}${enc.vp9 ? ' · VP9 ✓' : ''}`);
  else falta('ffmpeg', `${v} sem o encoder H.264 (libx264): instale outra build`, comoInstalar('ffmpeg'));
} else falta('ffmpeg', 'não está instalado (é ele que transforma os quadros em MP4)', comoInstalar('ffmpeg'));
const ffprobe = acharFfprobe();
if (ffprobe) ok('ffprobe', 'para ler vídeos de referência');
else falta('ffprobe', 'não achei (vem junto com o ffmpeg; a leitura de vídeo de referência precisa dele)', comoInstalar('ffmpeg'), false);

/* Disco e núcleos */
const livre = espacoLivre(process.cwd());
if (livre != null) {
  const gb = livre / 1e9;
  if (gb >= 10) ok('Disco livre', `${gb.toFixed(0)} GB`);
  else falta('Disco livre', `só ${gb.toFixed(1)} GB: um filme de 20 a 30 s nos dois formatos, com as conferências, guarda de 4 a 8 GB de quadros no cache`, ['libere espaço ou apague a pasta .cache dos projetos que já terminaram'], gb < 3);
}
ok('Processador', `${cpus()} núcleos → ${workersPadrao()} navegadores em paralelo no render`);

/* Medida de velocidade (opcional) */
let medida = null;
if (op.completo && pw && chrome) {
  try {
    const nav = await abrirNavegador();
    const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.setContent(
      `<div id=p style="width:1920px;height:1080px;background:#111;display:grid;place-items:center;overflow:hidden"><h1 id=t style="color:#eee;font:400 160px system-ui;filter:blur(2px)">Teste de captura</h1></div>`,
    );
    const N = 24;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      await pg.evaluate((k) => {
        const h = document.getElementById('t');
        h.style.transform = `scale(${1 + k * 0.002}) translateY(${k}px)`;
        h.style.filter = `blur(${(k % 5) * 0.4}px)`;
      }, i);
      await pg.screenshot({ type: 'png' });
    }
    const ms = (performance.now() - t0) / N;
    await nav.close();
    const efetivo = ms / Math.max(1, workersPadrao() * 0.65);
    const filme30s60 = (1800 * efetivo) / 1000 / 60;
    medida = { msPorQuadro: Math.round(ms), minutosFilme30s60fps: Math.round(filme30s60 * 10) / 10 };
    ok('Velocidade', `~${Math.round(ms)} ms por quadro num navegador · um filme de 30 s a 60 fps leva ~${Math.max(1, Math.round(filme30s60))} min (mais em cenas com muito desfoque)`);
  } catch (e) {
    falta('Velocidade', `não consegui medir: ${String(e.message).split('\n')[0]}`, [], false);
  }
}

/* Relatório */
const obrigatoriosFaltando = itens.filter((i) => !i.ok && i.obrigatorio !== false);
if (!op.json) {
  for (const i of itens) {
    console.log(`${i.ok ? '✓' : i.obrigatorio === false ? '!' : '✗'} ${i.nome}: ${i.detalhe}`);
    if (!i.ok && i.comandos?.length) {
      console.log(`  Para instalar (${SISTEMA}):`);
      for (const c of i.comandos) console.log(`    ${c}`);
    }
  }
  console.log('');
  if (obrigatoriosFaltando.length) {
    console.log(`Falta ${obrigatoriosFaltando.map((i) => i.nome).join(', ')}. Instale e rode a checagem de novo (depois de instalar Node ou ffmpeg, feche e abra o Claude Code).`);
  } else {
    console.log('Tudo pronto para storyboard, animação e render.');
  }
} else {
  console.log(
    JSON.stringify(
      {
        pronto: !obrigatoriosFaltando.length,
        sistema: SISTEMA,
        itens,
        medida,
        dica: 'Os resultados ficam melhores com o Opus 5.5 e o ultracode (é só escrever ultracode no pedido). Demora um pouco mais, mas a primeira versão já sai bem mais acertada.',
      },
      null,
      2,
    ),
  );
}
process.exit(obrigatoriosFaltando.length ? 1 : 0);
