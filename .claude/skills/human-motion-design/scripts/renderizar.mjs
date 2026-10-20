#!/usr/bin/env node
/**
 * renderizar.mjs — o MP4 determinístico do filme inteiro, com as transições, quadro a quadro.
 *
 *   node scripts/renderizar.mjs <projeto> --formato 16x9|9x16|ambos --fps 30|60
 *   node scripts/renderizar.mjs <projeto> --formato ambos --fps 60 --nota "entrada da cena 2 mais lenta"
 *   node scripts/renderizar.mjs <projeto> --cenas abertura,app        (só esse trecho, mesmos tempos)
 *   node scripts/renderizar.mjs <projeto> --por-cena                  (também um MP4 por cena)
 *
 * Opções:
 *   --formato 16x9 | 9x16 | ambos   (padrão: formatoBase do projeto)
 *   --fps 30 | 60                   renderiza nativo nessa taxa (nunca converte 60 → 30)
 *   --qualidade final | rascunho | maxima   (maxima captura em 2× e reduz com lanczos)
 *   --montagem principal            outra ordem das cenas definida em motion.json → montagens
 *   --cenas a,b  |  --de 2 --ate 5  só um trecho (tempos globais)
 *   --por-cena                      um MP4 por cena além do filme
 *   --prores                        também .mov ProRes 422 HQ 10 bits (para a ilha de edição)
 *   --workers 4                     navegadores em paralelo (padrão: metade dos núcleos, até 4)
 *   --nota "…"                      o que mudou nesta versão (aparece na página de entrega)
 *   --versao N                      grava em render/vN (para juntar formatos na mesma versão)
 *   --conferir                      o filme inteiro só para conferir (ex.: a 60 qps quando a entrega
 *                                   é a 30): vai para render/trechos/ e NUNCA vira versão de entrega
 *   --sem-cache  --sem-fluidez  --sem-diretor
 *
 * Saídas em render/v<N>/: <slug>-<formato>-<fps>fps.mp4, capa-<formato>.png, marcas.json (cortes,
 * batidas e transições em tempo global, para som e edição) e relatorio.json (não vai na entrega).
 * Quadros ficam em .cache/quadros/: uma rodada de ajuste só re-renderiza as cenas que mudaram.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lerArgs, lista, num, ultimo } from './lib/args.mjs';
import { abrirNavegador, workersPadrao } from './lib/ambiente.mjs';
import { abrirFilme, errosDoMotor, foto, fraseDeErro, renderizarQuadros } from './lib/captura.mjs';
import { codificar } from './lib/ffmpeg.mjs';
import { montarFilme } from './lib/montar.mjs';
import {
  FORMATOS, assinaturaDoQuadro, contextoDeAssinatura, formatosPedidos, gravarJson, hoje, lerProjeto, resolverProjeto, validarProjeto,
} from './lib/projeto.mjs';
import { gravarFluidez, medirFluidez, resumoTexto } from './fluidez.mjs';
import { analisarQuadros, imprimirNotas } from './lib/diretor.mjs';
import { nomeFormato, virgula } from './lib/paginas.mjs';

const { pos, op } = lerArgs(process.argv.slice(2), { bandeiras: ['por-cena', 'prores', 'sem-cache', 'sem-fluidez', 'sem-diretor', 'conferir', 'ajuda', 'help'] });
if (op.ajuda || op.help) {
  console.log(`Uso: node <skill>/scripts/renderizar.mjs <projeto> [--formato 16x9|9x16|ambos] [--fps 60|30] [--nota "…"]
  entrega:   --formato ambos --fps 60 --nota "o que mudou"      (vira render/vN, aparece na página)
  conferir:  --conferir --fps 60                                (filme inteiro em render/trechos, nunca vira versão)
  trecho:    --cenas a,b  |  --de 2 --ate 5                     (render/trechos)
  mais:      --qualidade final|rascunho|maxima · --por-cena · --prores · --montagem B · --versao N · --workers 4
             --sem-cache · --sem-fluidez · --sem-diretor`);
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
const { erros: errosValidacao, avisos } = validarProjeto(projeto);
for (const a of avisos) console.log(`! ${a}`);
if (errosValidacao.length) {
  console.error('Precisa corrigir antes de renderizar:');
  for (const e of errosValidacao) console.error(`  ✗ ${e}`);
  process.exit(1);
}
const formatos = formatosPedidos(ultimo(op.formato), J.formatoBase || '16x9');
const fps = num(ultimo(op.fps), J.fps || 60);
const qualidade = ['final', 'rascunho', 'maxima'].includes(ultimo(op.qualidade)) ? ultimo(op.qualidade) : 'final';
const escala = qualidade === 'maxima' ? 2 : 1;
const tipoImg = qualidade === 'rascunho' ? 'jpeg' : 'png';
const montagem = ultimo(op.montagem) || 'principal';
const workers = Math.max(1, Math.min(8, num(ultimo(op.workers), workersPadrao())));
const soCenas = lista(op.cenas);

// versão (um trecho sem --versao vai para render/trechos/ e não vira versão de entrega)
const pastaRender = path.join(P, 'render');
mkdirSync(pastaRender, { recursive: true });
const ehTrecho = soCenas.length > 0 || op.de !== undefined || op.ate !== undefined || !!op.conferir;
const existentes = readdirSync(pastaRender).filter((n) => /^v\d+$/.test(n)).map((n) => +n.slice(1));
const versao = op.versao ? num(String(ultimo(op.versao)).replace(/^v/, ''), 1) : ehTrecho ? 0 : (existentes.length ? Math.max(...existentes) : 0) + 1;
const pastaV = versao ? path.join(pastaRender, `v${versao}`) : path.join(pastaRender, 'trechos');
mkdirSync(pastaV, { recursive: true });

if (op['sem-cache']) rmSync(path.join(P, '.cache', 'quadros'), { recursive: true, force: true });

// versão do navegador entra na assinatura do cache (a rasterização muda entre versões)
const navTeste = await abrirNavegador();
const versaoNavegador = navTeste.version();
await navTeste.close();

const sufixo = montagem === 'principal' ? '' : `-${montagem}`;
const relatorio = { versao, data: hoje(), fps, qualidade, montagem, formatos: {}, erros: [] };
const linhas = {};
const inicioTudo = Date.now();
let falhou = false;

for (const formato of formatos) {
  const F = FORMATOS[formato];
  const { arquivo, linha, avisos: av } = montarFilme(projeto, { montagem, formato, fps });
  for (const a of av) console.log(`! ${a}`);
  linhas[formato] = linha;
  // trecho
  let de = 0, ate = linha.total;
  if (soCenas.length) {
    const sel = linha.cenas.filter((c) => soCenas.includes(c.id));
    if (!sel.length) {
      console.error(`Nenhuma dessas cenas existe: ${soCenas.join(', ')}`);
      process.exit(1);
    }
    de = Math.min(...sel.map((c) => c.inicio));
    ate = Math.max(...sel.map((c) => c.fim));
  }
  if (op.de !== undefined) de = num(ultimo(op.de), de);
  if (op.ate !== undefined) ate = num(ultimo(op.ate), ate);
  const f0 = Math.round(de * fps);
  const f1 = Math.max(f0 + 1, Math.round(ate * fps));
  const ctx = contextoDeAssinatura(projeto, linha, { escala, qualidade, navegador: versaoNavegador });
  const pastaCache = path.join(P, '.cache', 'quadros', `${formato}@${escala}${qualidade === 'rascunho' ? '-rascunho' : ''}`);
  mkdirSync(pastaCache, { recursive: true });
  const quadros = [];
  for (let f = f0; f < f1; f++) {
    const t = f / fps;
    quadros.push({ f, t, destino: path.join(pastaCache, `${assinaturaDoQuadro(linha, ctx, t)}.${tipoImg === 'jpeg' ? 'jpg' : 'png'}`) });
  }
  const faltam = quadros.filter((q) => !existsSync(q.destino)).length;
  console.log(`\n${nomeFormato(formato)} · ${fps} qps · ${quadros.length} quadros (${virgula(de, 2)}–${virgula(ate, 2)} s) · ${faltam ? `${faltam} para renderizar` : 'tudo no cache'} · ${workers} navegadores`);
  const t0 = Date.now();
  let ultimoLog = 0;
  const r = await renderizarQuadros({
    arquivo, formato, fps, escala, quadros, workers, tipo: tipoImg,
    aoProgresso: ({ feitos, total, restante }) => {
      if (Date.now() - ultimoLog < 4000) return;
      ultimoLog = Date.now();
      console.log(`  quadro ${feitos} de ${total} · faltam ~${restante > 90 ? `${Math.round(restante / 60)} min` : `${Math.max(1, Math.round(restante))} s`}`);
    },
  });
  if (r.erros.length) {
    falhou = true;
    relatorio.erros.push(...r.erros);
    console.error('\nO render parou: uma cena deu erro.');
    for (const e of r.erros.slice(0, 8)) console.error(`  ✗ ${e}`);
    break;
  }
  const segRender = (Date.now() - t0) / 1000;
  // codificar
  const trecho = soCenas.length ? `-${soCenas.join('-')}` : op.de !== undefined || op.ate !== undefined ? `-${virgula(de, 1)}a${virgula(ate, 1)}s` : op.conferir ? '-conferencia' : '';
  const nomeMp4 = `${projeto.slug}${sufixo}${trecho}-${formato}-${fps}fps.mp4`;
  const arquivos = quadros.map((q) => q.destino);
  await codificar({ arquivos, fps, destino: path.join(pastaV, nomeMp4), qualidade, entrada: tipoImg, ...(escala !== 1 ? { largura: F.largura, altura: F.altura } : {}) });
  console.log(`✓ ${path.relative(P, path.join(pastaV, nomeMp4))} (${virgula(quadros.length / fps, 2)} s, render ${Math.round(segRender)} s)`);
  const info = { arquivo: nomeMp4, quadros: quadros.length, de, ate, segundosRender: Math.round(segRender), renderizados: r.feitos };
  if (op.prores) {
    const mov = nomeMp4.replace(/\.mp4$/, '.mov');
    await codificar({ arquivos, fps, destino: path.join(pastaV, mov), entrada: tipoImg, prores: true, ...(escala !== 1 ? { largura: F.largura, altura: F.altura } : {}) });
    info.prores = mov;
    console.log(`✓ ${path.relative(P, path.join(pastaV, mov))}`);
  }
  if (op['por-cena']) {
    info.cenas = [];
    mkdirSync(path.join(pastaV, 'cenas'), { recursive: true });
    for (const [i, c] of linha.cenas.entries()) {
      const lista2 = quadros.filter((q) => q.t >= c.inicio - 1e-6 && q.t < c.fim - 1e-6);
      if (!lista2.length) continue;
      const n = `${projeto.slug}-${String(i + 1).padStart(2, '0')}-${c.id}-${formato}-${fps}fps.mp4`;
      await codificar({ arquivos: lista2.map((q) => q.destino), fps, destino: path.join(pastaV, 'cenas', n), qualidade, entrada: tipoImg, ...(escala !== 1 ? { largura: F.largura, altura: F.altura } : {}) });
      info.cenas.push(`cenas/${n}`);
    }
    console.log(`✓ ${info.cenas.length} MP4 por cena em ${path.relative(P, path.join(pastaV, 'cenas'))}/`);
  }
  // capa: o quadro escolhido, isolado (sem transição)
  const capa = J.capa || {};
  const cenaCapa = linha.cenas.find((c) => c.id === capa.cena) || linha.cenas[linha.cenas.length - 1];
  const qCapa = cenaCapa.quadros.find((q) => q.id === capa.quadro) || cenaCapa.quadros[cenaCapa.quadros.length - 1];
  {
    const nav = await abrirNavegador();
    try {
      const { pagina } = await abrirFilme(nav, arquivo, { formato, escala: 1 });
      await pagina.evaluate(([id, t]) => window.__MOTION__.irCena(id, t), [cenaCapa.id, qCapa ? qCapa.t : cenaCapa.dur * 0.7]);
      writeFileSync(path.join(pastaV, `capa-${formato}.png`), await foto(pagina));
      relatorio.erros.push(...(await errosDoMotor(pagina)).map(fraseDeErro));
    } finally {
      await nav.close();
    }
    info.capa = `capa-${formato}.png`;
  }
  // fluidez nos quadros exatos (PNG do cache)
  if (!op['sem-fluidez']) {
    const res = await medirFluidez({ arquivos, fps, largura: F.largura * escala, altura: F.altura * escala, linha, inicio: f0 / fps, entrada: tipoImg });
    gravarFluidez(res, linha, path.join(pastaV, '.fluidez'), `fluidez-${formato}`, `${J.titulo} · ${nomeFormato(formato)} · v${versao}`);
    info.fluidez = { resumo: resumoTexto(res), alertas: res.alertas };
    console.log(`  fluidez: ${resumoTexto(res)}`);
    for (const a of res.alertas.slice(0, 12)) {
      console.log(`    ${a.tipo.padEnd(7)} ${a.cena ? `${a.cena} t=${virgula(a.tLocal, 3)} s` : `t=${virgula(a.t, 3)} s`} · ${a.frase}`);
    }
  }
  // o diretor automático: o que o detector de trancos não pega (parado aos olhos, borda, energia…)
  if (!op['sem-diretor']) {
    try {
      const dir = await analisarQuadros({ arquivos, fps, largura: F.largura * escala, altura: F.altura * escala, linha, J, P, inicio: f0 / fps, entrada: tipoImg });
      info.diretor = dir;
      mkdirSync(path.join(pastaV, '.diretor'), { recursive: true });
      writeFileSync(path.join(pastaV, '.diretor', `diretor-${formato}.json`), JSON.stringify(dir, null, 1));
      const m = dir.metricas;
      console.log(`  diretor: energia ${virgula(m.energia.mediana, 2)} por quadro (mediana por segundo)${m.referencia && m.referencia.mediana != null ? `, referência ${virgula(m.referencia.mediana, 2)}` : ''} · ${m.energia.quaseParados} % de quadros quase parados · ${virgula(m.paradoAosOlhos, 1)} s parados aos olhos · ${virgula(m.cortesPorSegundo, 2)} cortes/s${m.referencia && m.referencia.cortesPorSegundo != null ? ` (referência ${virgula(m.referencia.cortesPorSegundo, 2)})` : ''}`);
      if (dir.notas.length) imprimirNotas(dir.notas, '  diretor');
    } catch (e) {
      console.log(`  diretor: não consegui analisar (${String(e.message || e).split('\n')[0]})`);
    }
  }
  relatorio.formatos[formato] = info;
}

// marcas.json: tempos globais para som e edição
const base = linhas[formatos[0]];
if (base) {
  const cenasJson = Object.fromEntries((J.cenas || []).map((c) => [c.id, c]));
  const marcas = {
    titulo: J.titulo,
    fps,
    bpm: base.bpm,
    total: base.total,
    inicio: 0,
    cenas: base.cenas.map((c) => ({ id: c.id, titulo: c.titulo, inicio: c.inicio, fim: c.fim })),
    cortes: base.cortes,
    transicoes: base.transicoes.map((X) => ({ de: X.de, para: X.para, tipo: X.tipo, inicio: X.inicio, fim: X.fim, corte: X.corte })),
    batidas: base.cenas.flatMap((c) => (cenasJson[c.id]?.batidas || []).map((b) => ({ cena: c.id, tipo: b.tipo, t: Math.round((c.inicio + b.t) * 1000) / 1000, texto: b.texto }))).sort((a, b) => a.t - b.t),
    linhas,
  };
  if (versao) writeFileSync(path.join(pastaV, 'marcas.json'), JSON.stringify(marcas, null, 1));
}
relatorio.segundos = Math.round((Date.now() - inicioTudo) / 1000);
const anterior = versao && existsSync(path.join(pastaV, 'relatorio.json')) ? JSON.parse((await import('node:fs')).readFileSync(path.join(pastaV, 'relatorio.json'), 'utf8')) : null;
if (anterior && anterior.formatos) relatorio.formatos = Object.assign({}, anterior.formatos, relatorio.formatos);
if (versao) writeFileSync(path.join(pastaV, 'relatorio.json'), JSON.stringify(relatorio, null, 1));

if (!falhou && versao) {
  J.versoes = J.versoes || [];
  let reg = J.versoes.find((x) => x.v === versao);
  if (!reg) {
    reg = { v: versao, data: hoje(), formatos: [], fps, nota: '' };
    J.versoes.push(reg);
  }
  reg.formatos = [...new Set([...(reg.formatos || []), ...Object.keys(relatorio.formatos)])];
  reg.fps = fps;
  reg.data = hoje();
  if (op.nota && op.nota !== true) reg.nota = String(ultimo(op.nota));
  else if (!reg.nota) reg.nota = versao === 1 ? 'Primeira versão' : '';
  J.formatos = [...new Set([...(J.formatos || []), ...formatos])];
  gravarJson(path.join(P, 'motion.json'), J);
  console.log(`\nPronto: render/v${versao}/ em ${relatorio.segundos} s. Monte a entrega com: node <skill>/scripts/previa.mjs "${P}"`);
} else if (!falhou) console.log(`\n${op.conferir ? 'Conferência' : 'Trecho'} pronta em render/trechos/ (${relatorio.segundos} s); não entra como versão de entrega.`);
process.exit(falhou ? 2 : 0);
