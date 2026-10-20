#!/usr/bin/env node
/**
 * quadros.mjs — instrumentos para olhar o movimento de verdade, quadro a quadro, enquanto anima.
 *
 *   node scripts/quadros.mjs <projeto> --cena abertura --passo 0.25 --folha     folha de contato a cada 0,25 s
 *   node scripts/quadros.mjs <projeto> --cena abertura --de 0 --ate 0.6 --passo 0.0167 --folha
 *                                                                              quadros consecutivos de um trecho rápido
 *   node scripts/quadros.mjs <projeto> --cena abertura --tempos 0.1,0.35,1.2   instantes pontuais
 *   node scripts/quadros.mjs <projeto> --global --de 1.8 --ate 2.6 --passo 0.033 --folha
 *                                                                              tempos do filme, com as transições
 *   node scripts/quadros.mjs <projeto> --pureza [--cena abertura]              a cena depende da ordem dos quadros?
 *
 * Opções: --formato 16x9|9x16 · --escala 0.5 (PNG menor) · --colunas 4 (folha).
 * Tempos de --cena são locais (0 = início da cena) e a cena aparece sozinha, sem transição.
 * Saída em <projeto>/.cache/inspecao/<cena|global>/ (PNGs) e <cena>-<de>a<ate>-<passo>-folha.png ao lado; a última linha é um JSON
 * com os arquivos e os erros do motor. Abra as imagens e olhe: número aponta, o olho decide.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lerArgs, lista, num, ultimo } from './lib/args.mjs';
import { abrirNavegador } from './lib/ambiente.mjs';
import { abrirFilme, errosDoMotor, foto, fraseDeErro } from './lib/captura.mjs';
import { lerCinza } from './lib/ffmpeg.mjs';
import { montarFilme } from './lib/montar.mjs';
import { esc, virgula } from './lib/paginas.mjs';
import { FORMATOS, formatosPedidos, lerProjeto, resolverProjeto, validarProjeto } from './lib/projeto.mjs';

const { pos, op } = lerArgs(process.argv.slice(2), { bandeiras: ['folha', 'global', 'pureza', 'todos', 'ajuda', 'help'] });
if (op.ajuda || op.help) {
  console.log(`Uso: node <skill>/scripts/quadros.mjs <projeto> …
  --cena id --passo 0.25 --folha                     folha de contato da cena (tempo local)
  --cena id --de 0 --ate 0.6 --passo 0.0167 --folha  quadros consecutivos de um trecho rápido
  --cena id --tempos 0.1,0.35,1.2                    instantes pontuais
  --global --de 1.8 --ate 2.6 --passo 0.033 --folha  tempo do filme, com as transições
  --pureza [--cena id]                               a cena depende da ordem dos quadros?
  --formato 16x9|9x16 · --escala 0.5 · --colunas 4`);
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
const { erros: errosVal } = validarProjeto(projeto);
if (errosVal.length) {
  for (const e of errosVal) console.error(`✗ ${e}`);
  process.exit(1);
}
const formato = formatosPedidos(ultimo(op.formato), projeto.json.formatoBase || '16x9')[0];
const escala = num(ultimo(op.escala), 1);
const F = FORMATOS[formato];
const { arquivo, linha } = montarFilme(projeto, { formato, fps: projeto.json.fps });
const nav = await abrirNavegador();
const erros = [];

try {
  if (op.pureza) {
    /* ── pureza: a mesma cena em ordem crescente e embaralhada, com saltos para outras cenas ── */
    const alvo = lista(op.cena);
    const cenas = linha.cenas.filter((c) => !alvo.length || alvo.includes(c.id));
    const { pagina } = await abrirFilme(nav, arquivo, { formato, escala: 0.5 });
    const pasta = path.join(P, '.cache', 'inspecao', 'pureza');
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const resultado = [];
    for (const c of cenas) {
      const ts = Array.from({ length: 8 }, (_, i) => Math.round(((c.dur * (i + 0.5)) / 8) * 1000) / 1000);
      const a = [], b = [];
      for (const [k, t] of ts.entries()) {
        await pagina.evaluate(([id, tt]) => window.__MOTION__.irCena(id, tt), [c.id, t]);
        const f = path.join(pasta, `${c.id}-a-${k}.png`);
        writeFileSync(f, await foto(pagina));
        a.push(f);
      }
      const ordem = ts.map((t, k) => [t, k]).sort((x, y) => Math.sin(x[1] * 12.9898) - Math.sin(y[1] * 12.9898));
      const outra = linha.cenas.find((x) => x.id !== c.id);
      for (const [t, k] of ordem) {
        if (outra) await pagina.evaluate(([id, tt]) => window.__MOTION__.irCena(id, tt), [outra.id, outra.dur / 2]);
        await pagina.evaluate(([id, tt]) => window.__MOTION__.irCena(id, tt), [c.id, t]);
        const f = path.join(pasta, `${c.id}-b-${k}.png`);
        writeFileSync(f, await foto(pagina));
        b[k] = f;
      }
      const W = 240, H = Math.round((240 * F.altura) / F.largura / 2) * 2;
      const ga = await lerCinza({ arquivos: a, largura: W, altura: H });
      const gb = await lerCinza({ arquivos: b, largura: W, altura: H });
      const difs = ga.map((q, k) => {
        let s = 0;
        for (let i = 0; i < q.length; i++) s += Math.abs(q[i] - gb[k][i]);
        return s / q.length;
      });
      const pior = Math.max(...difs);
      const tPior = ts[difs.indexOf(pior)];
      resultado.push({ cena: c.id, pior: Math.round(pior * 100) / 100, t: tPior });
      console.log(pior > 0.5
        ? `✗ ${c.id}: depende da ordem perto de t = ${virgula(tPior, 2)} s (diferença ${virgula(pior, 2)}): alguma propriedade não é definida em todo quadro`
        : `✓ ${c.id}: pura (pior diferença ${virgula(pior, 2)})`);
    }
    erros.push(...(await errosDoMotor(pagina)).map(fraseDeErro));
    console.log(JSON.stringify({ pureza: resultado, erros }));
  } else {
    /* ── instantes, intervalo com passo, folha ── */
    const global = !!op.global;
    const cena = global ? null : linha.cenas.find((c) => c.id === ultimo(op.cena));
    if (!global && !cena) {
      console.error(`Diga a cena com --cena (há: ${linha.cenas.map((c) => c.id).join(', ')}) ou use --global.`);
      process.exit(1);
    }
    const dur = global ? linha.total : cena.dur;
    let tempos = lista(op.tempos).map((x) => num(x, NaN)).filter(Number.isFinite);
    if (!tempos.length) {
      const passo = op.todos ? 1 / linha.fps : num(ultimo(op.passo), 0.25);
      const de = num(ultimo(op.de), 0), ate = Math.min(dur, num(ultimo(op.ate), dur));
      for (let k = 0; de + k * passo <= ate + 1e-6 && k < 400; k++) tempos.push(Math.round((de + k * passo) * 10000) / 10000);
    }
    const nome = global ? 'global' : cena.id;
    // a folha leva o trecho e o passo no nome: a folha densa não apaga a de 0,25 s
    const de0 = tempos[0], ate0 = tempos[tempos.length - 1];
    const passoTxt = lista(op.tempos).length ? 'pontos' : `p${virgula(op.todos ? 1 / linha.fps : num(ultimo(op.passo), 0.25), 4)}`;
    const nomeFolha = `${nome}-${virgula(de0, 2)}a${virgula(ate0, 2)}-${passoTxt}-folha`;
    const pasta = path.join(P, '.cache', 'inspecao', nome);
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const { pagina } = await abrirFilme(nav, arquivo, { formato, escala });
    const arquivos = [];
    for (const t of tempos) {
      if (global) await pagina.evaluate((tt) => window.__MOTION__.ir(tt), t);
      else await pagina.evaluate(([id, tt]) => window.__MOTION__.irCena(id, tt), [cena.id, t]);
      const f = path.join(pasta, `${nome}_${t.toFixed(3).padStart(7, '0')}.png`);
      writeFileSync(f, await foto(pagina));
      arquivos.push({ t, f });
    }
    erros.push(...(await errosDoMotor(pagina)).map(fraseDeErro));
    let folha = null;
    if (op.folha) {
      // o próprio Chrome desenha a folha: grade com o tempo embaixo de cada quadro
      const col = num(ultimo(op.colunas), F.largura > F.altura ? 4 : 6);
      const larg = F.largura > F.altura ? 380 : 220;
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f4f4f2;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;color:#151619}
      .g{display:grid;grid-template-columns:repeat(${col},${larg}px);gap:14px 10px;padding:16px}figure{margin:0}img{display:block;width:100%;border-radius:4px;background:#000}
      figcaption{margin-top:4px;font-variant-numeric:tabular-nums;color:#555}h1{margin:16px 16px 0;font-size:13px;font-weight:500}</style>
      <h1>${esc(projeto.json.titulo || '')} · ${esc(global ? 'filme' : `${cena.titulo} (${cena.id})`)} · ${formato === '9x16' ? '9:16' : '16:9'}${global ? ' · tempo do filme' : ' · tempo da cena'}</h1>
      <div class="g">${arquivos.map((a) => `<figure><img src="${pathToFileURL(a.f).href}"><figcaption>${virgula(a.t, 3)} s</figcaption></figure>`).join('')}</div>`;
      const fh = path.join(pasta, '..', `${nomeFolha}.html`);
      writeFileSync(fh, html);
      const pg = await nav.newPage({ viewport: { width: col * (larg + 10) + 32, height: 400 } });
      await pg.goto(pathToFileURL(fh).href, { waitUntil: 'load' });
      folha = path.join(pasta, '..', `${nomeFolha}.png`);
      await pg.screenshot({ path: folha, fullPage: true });
      await pg.close();
    }
    console.log(`${arquivos.length} quadros em ${path.relative(process.cwd(), pasta) || pasta}${folha ? ` · folha: ${path.basename(folha)}` : ''}`);
    if (erros.length) for (const e of erros.slice(0, 8)) console.log(`✗ ${e}`);
    console.log(JSON.stringify({ pasta, folha, quadros: arquivos.map((a) => a.f), erros }));
  }
} finally {
  await nav.close();
}
process.exit(erros.some((e) => !/aviso/.test(e)) ? 2 : 0);
