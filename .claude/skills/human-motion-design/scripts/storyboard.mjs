#!/usr/bin/env node
/**
 * storyboard.mjs — a prancha do filme, antes de animar (e a cada rodada de refinamento).
 * Renderiza os quadros-chave de cada cena (primeiro e último, e os do meio se houver) em PNG, no
 * formato pedido, com o mesmo código que depois anima, e monta storyboard/index.html: cabeçalho,
 * a linguagem do movimento, a sequência (folha de contato e régua do tempo) e uma seção por cena
 * com os quadros grandes, as batidas com tempo, a câmera e a passagem para a próxima.
 *
 *   node scripts/storyboard.mjs <projeto>
 *   node scripts/storyboard.mjs <projeto> --formato 9x16        (a recomposição em pé)
 *   node scripts/storyboard.mjs <projeto> --formato ambos
 *   node scripts/storyboard.mjs <projeto> --cenas abertura,app  (só essas cenas; as outras ficam como estavam)
 *   node scripts/storyboard.mjs <projeto> --poses               (força as poses estáticas, mesmo com quadro())
 *   node scripts/storyboard.mjs <projeto> --aprovar             (congela os quadros atuais como aprovados)
 *   node scripts/storyboard.mjs <projeto> --pdf                 (também storyboard/storyboard.pdf)
 *   node scripts/storyboard.mjs <projeto> --sem-revisao         (não sobe o número da revisão)
 *
 * No fim, o diretor automático confere a composição em cada formato (escala, contraste do texto
 * sobre a foto, foto ampliada demais, quadros-chave que são o mesmo quadro, cenas vizinhas iguais,
 * corte no eixo que não é no eixo) e o esqueleto do filme (tipos, clímax, BPM na tela).
 * Depois de animar, com --sem-revisao, ele também compara cada quadro final com o aprovado.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lerArgs, lista, ultimo } from './lib/args.mjs';
import { abrirNavegador } from './lib/ambiente.mjs';
import { abrirFilme, errosDoMotor, foto, fraseDeErro } from './lib/captura.mjs';
import { lerMarca, montarFilme } from './lib/montar.mjs';
import { analisarStoryboard, contrasteDosTextos, imprimirNotas } from './lib/diretor.mjs';
import { lerCinza } from './lib/ffmpeg.mjs';
import { ROTULO_BATIDA, dataBr, esc, nomeFormato, pagina, rel, tempoBatida, tempoFino, timecode, timecodeFino, virgula } from './lib/paginas.mjs';
import {
  FORMATOS, descreverTransicao, formatosPedidos, gravarJson, hoje, lerProjeto, linhaDoTempo, quadroAprovado, resolverProjeto, validarProjeto,
} from './lib/projeto.mjs';

const { pos, op } = lerArgs(process.argv.slice(2), { bandeiras: ['poses', 'aprovar', 'pdf', 'sem-revisao', 'sem-diretor', 'ajuda', 'help'] });
if (op.ajuda || op.help) {
  console.log(`Uso: node <skill>/scripts/storyboard.mjs <projeto> [opções]
  --formato 16x9|9x16|ambos   em que formato desenhar os quadros-chave (padrão: o base)
  --cenas a,b                 só essas cenas (as outras ficam como estavam)
  --poses                     usa as poses estáticas mesmo se a cena já tem quadro(t)
  --aprovar --sem-revisao     congela a revisão que a pessoa aprovou
  --pdf                       também storyboard/storyboard.pdf
  --sem-diretor               pula a conferência automática da composição`);
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
const { erros, avisos } = validarProjeto(projeto);
for (const a of avisos) console.log(`! ${a}`);
if (erros.length) {
  console.error('Precisa corrigir antes do storyboard:');
  for (const e of erros) console.error(`  ✗ ${e}`);
  process.exit(1);
}
const montagem = ultimo(op.montagem) || 'principal';
const formatos = formatosPedidos(ultimo(op.formato), J.formatoBase || '16x9');
const so = lista(op.cenas);
const pastaSb = path.join(P, 'storyboard');
mkdirSync(pastaSb, { recursive: true });

const nn = (i) => String(i + 1).padStart(2, '0');
const nomeQuadro = (i, cena, q) => `${nn(i)}-${cena}-${q}.png`;
const errosMotor = [];
const inicio = Date.now();
const medidas = {}; // formato → cena → { quadros: [{ id, rotulo, aprovado, png, medida }], contraste }
const pastaDiretor = path.join(P, '.cache', 'diretor');

/** Mede a composição no estado atual (e, no quadro aprovado, o contraste do texto sobre o fundo). */
async function medir(pagina, formato, cena, q, png, aprovado) {
  if (op['sem-diretor']) return;
  const m = (medidas[formato] = medidas[formato] || {});
  const reg = (m[cena.id] = m[cena.id] || { id: cena.id, tipo: cena.tipo, quadros: [], contraste: [] });
  let medida = null;
  try {
    medida = await pagina.evaluate((id) => window.__MOTION__.medirComposicao(id), cena.id);
  } catch {
    /* motor antigo */
  }
  reg.quadros.push({ id: q.id, rotulo: q.rotulo, aprovado, png, medida });
  if (aprovado && medida && medida.textos.length) {
    mkdirSync(pastaDiretor, { recursive: true });
    const semTexto = path.join(pastaDiretor, `${formato}-${cena.id}-sem-texto.png`);
    await pagina.evaluate((id) => window.__MOTION__.esconderTextos(id, true), cena.id);
    writeFileSync(semTexto, await foto(pagina));
    await pagina.evaluate((id) => window.__MOTION__.esconderTextos(id, false), cena.id);
    const F = FORMATOS[formato];
    const [rgb] = await lerCinza({ arquivos: [semTexto], largura: F.largura, altura: F.altura, cor: true });
    reg.contraste = contrasteDosTextos(medida.textos, rgb, F.largura, F.altura);
  }
}

/* ─── 1. quadros-chave ─── */
const navegador = await abrirNavegador();
try {
  for (const formato of formatos) {
    const { arquivo, linha, avisos: av } = montarFilme(projeto, { montagem, formato, fps: J.fps });
    for (const a of av) console.log(`! ${a}`);
    const pasta = path.join(pastaSb, 'quadros', formato);
    mkdirSync(pasta, { recursive: true });
    const { pagina: pg, erros: errosPg } = await abrirFilme(navegador, arquivo, { formato });
    const infos = await pg.evaluate(() => window.__MOTION__.cenas());
    const temQuadro = Object.fromEntries(infos.map((c) => [c.id, c.temQuadro]));
    let n = 0;
    for (const [i, c] of linha.cenas.entries()) {
      if (so.length && !so.includes(c.id)) continue;
      const qAprovado = quadroAprovado(c);
      for (const q of c.quadros) {
        const destino = path.join(pasta, nomeQuadro(i, c.id, q.id));
        const aprovado = q === qAprovado;
        if (temQuadro[c.id] && !op.poses) {
          await pg.evaluate(([id, t]) => window.__MOTION__.irCena(id, t), [c.id, q.t]);
          writeFileSync(destino, await foto(pg));
          await medir(pg, formato, c, q, destino, aprovado);
        } else {
          const { pagina: pp, erros: e2 } = await abrirFilme(navegador, arquivo, { formato, query: `captura&pose=${encodeURIComponent(`${c.id}:${q.id}`)}` });
          writeFileSync(destino, await foto(pp));
          await medir(pp, formato, c, q, destino, aprovado);
          errosMotor.push(...(await errosDoMotor(pp)).map(fraseDeErro), ...e2);
          await pp.close();
        }
        n++;
      }
    }
    errosMotor.push(...(await errosDoMotor(pg)).map(fraseDeErro), ...errosPg);
    await pg.close();
    console.log(`✓ ${n} quadros-chave em ${nomeFormato(formato)} → storyboard/quadros/${formato}/`);
  }
} finally {
  await navegador.close();
}

/* ─── 1b. o diretor automático: composição em cada formato e o quadro final contra o aprovado ─── */
const notasDiretor = [];
if (!op['sem-diretor']) {
  const linhaD = linhaDoTempo(projeto, { montagem, formato: J.formatoBase || formatos[0], fps: J.fps });
  for (const formato of Object.keys(medidas)) {
    const F = FORMATOS[formato];
    const w = F.largura > F.altura ? 64 : 36, h = F.largura > F.altura ? 36 : 64;
    const cenasD = [];
    for (const c of linhaD.cenas) {
      const reg = medidas[formato][c.id];
      if (!reg) continue;
      const cinzas = await lerCinza({ arquivos: reg.quadros.map((q) => q.png), largura: w, altura: h });
      reg.quadros.forEach((q, k) => (q.cinza = { q: cinzas[k], w, h }));
      cenasD.push(reg);
      // depois de animar: o quadro final de agora contra o aprovado (o olho decide; o número aponta)
      const ap = reg.quadros.find((q) => q.aprovado);
      const congelado = ap && path.join(pastaSb, 'aprovado', formato, path.basename(ap.png));
      if (ap && existsSync(congelado) && J.storyboard && J.storyboard.aprovadoEm) {
        const [x, y] = await lerCinza({ arquivos: [ap.png, congelado], largura: 240, altura: Math.round((240 * F.altura) / F.largura) });
        let d = 0;
        for (let k = 0; k < x.length; k++) d += Math.abs(x[k] - y[k]);
        d /= x.length;
        if (d > 2.5) notasDiretor.push({ gravidade: d > 6 ? 'alta' : 'media', tipo: 'aprovado', cena: c.id, formato, frase: `"${c.id}" no ${nomeFormato(formato)}: o quadro final mudou em relação ao aprovado (diferença média ${virgula(d, 1)}/255). Abra os dois lado a lado (storyboard/quadros e storyboard/aprovado); em plano de foto com push a diferença pode ser só a câmera, confira no olho` });
      }
    }
    notasDiretor.push(...analisarStoryboard({ cenas: cenasD, linha: linhaD, formato, J }));
  }
  mkdirSync(pastaDiretor, { recursive: true });
  writeFileSync(path.join(pastaDiretor, 'storyboard.json'), JSON.stringify(notasDiretor, null, 1));
}

/* ─── 2. revisão e aprovação ─── */
J.storyboard = J.storyboard || { revisao: 0, aprovadoEm: null };
if (!op['sem-revisao']) J.storyboard.revisao = (J.storyboard.revisao || 0) + 1;
if (op.aprovar) {
  for (const formato of formatos) {
    const de = path.join(pastaSb, 'quadros', formato);
    const para = path.join(pastaSb, 'aprovado', formato);
    mkdirSync(para, { recursive: true });
    for (const f of readdirSync(de).filter((x) => x.endsWith('.png'))) copyFileSync(path.join(de, f), path.join(para, f));
  }
  J.storyboard.aprovadoEm = hoje();
  J.storyboard.revisaoAprovada = J.storyboard.revisao;
  console.log(`✓ storyboard aprovado (rev. ${J.storyboard.revisao}): quadros congelados em storyboard/aprovado/`);
}
gravarJson(path.join(P, 'motion.json'), J);

/* ─── 3. a prancha ─── */
const linha = linhaDoTempo(projeto, { montagem, formato: J.formatoBase || formatos[0], fps: J.fps });
const formatosComQuadros = ['16x9', '9x16'].filter((f) => existsSync(path.join(pastaSb, 'quadros', f)) && readdirSync(path.join(pastaSb, 'quadros', f)).some((x) => x.endsWith('.png')));
const principal = formatosComQuadros.includes(formatos[0]) ? formatos[0] : formatosComQuadros[0];
const cenasJson = Object.fromEntries((J.cenas || []).map((c) => [c.id, c]));
const img = (formato, i, cena, q) => {
  const f = path.join(pastaSb, 'quadros', formato, nomeQuadro(i, cena, q));
  return existsSync(f) ? rel(pastaSb, f) : null;
};

const meta = [
  ['Peça', J.peca || 'Filme de motion'],
  ['Duração', `${virgula(linha.total, 1)} s`],
  ['Cenas', String(linha.cenas.length)],
  ['Formato', formatosComQuadros.map((f) => `${nomeFormato(f)} · ${FORMATOS[f].largura}×${FORMATOS[f].altura}`).join(' e ')],
  ['Ritmo', `${linha.bpm} BPM · batida de ${virgula(60 / linha.bpm, 3)} s`],
  ['Mestre', `${linha.fps} qps`],
];

const linguagem = (J.linguagem || [])
  .map((l) => `<li><h3>${esc(l.titulo)}</h3><p>${esc(l.texto)}</p></li>`)
  .join('');

const refs = (J.referencias || [])
  .map((r) => {
    const pastaRef = path.join(P, 'referencias', r.nome || '');
    const capa = ['01-planos-1.jpg', '00-linha-do-tempo.png'].map((n) => path.join(pastaRef, n)).find((f) => existsSync(f));
    return `<li>${capa ? `<a href="${rel(pastaSb, capa)}" target="_blank" rel="noopener"><img src="${rel(pastaSb, capa)}" alt=""></a>` : ''}<div><h3>${esc(r.titulo || r.nome)}</h3>${r.leitura ? `<p>${esc(r.leitura)}</p>` : ''}</div></li>`;
  })
  .join('');

// régua do tempo: cada cena numa faixa, alternando duas trilhas para mostrar a sobreposição
const regua = linha.cenas
  .map((c, i) => {
    const l = (c.inicio / linha.total) * 100, w = (c.dur / linha.total) * 100;
    return `<a class="bloco t${i % 2}" href="#cena-${esc(c.id)}" style="left:${l.toFixed(3)}%;width:${w.toFixed(3)}%"><b>${nn(i)}</b> ${esc(c.titulo)}</a>`;
  })
  .join('');
const janelas = linha.transicoes
  .filter((X) => X.dur > 0)
  .map((X) => `<i class="janela" title="${esc(nomeTransicao(X.tipo))}" style="left:${((X.inicio / linha.total) * 100).toFixed(3)}%;width:${(((X.fim - X.inicio) / linha.total) * 100).toFixed(3)}%"></i>`)
  .join('');
const marcas = [];
for (let s = 0; s <= Math.floor(linha.total + 1e-6); s++) marcas.push(`<span style="left:${((s / linha.total) * 100).toFixed(3)}%">${s}s</span>`);

// colunas da folha de contato: nenhuma cena sozinha na última linha
const colunasContato = (n, formato) => {
  const opcoes = formato === '9x16' ? [4, 5, 6, 7] : [3, 4, 5];
  let melhor = opcoes[0], nota = -1;
  for (const c of opcoes) {
    const resto = n % c;
    const cheio = n <= c ? n / c : resto === 0 ? 1 : resto / c;
    const val = cheio + c * 0.001;
    if (val > nota) [melhor, nota] = [c, val];
  }
  return Math.min(melhor, Math.max(1, n));
};
const contato = (formato) =>
  linha.cenas
    .map((c, i) => {
      const q = c.quadros[c.quadros.length - 1];
      const src = q && img(formato, i, c.id, q.id);
      return `<li><a href="#cena-${esc(c.id)}"><div class="quadro f${formato}">${src ? `<img src="${src}" alt="">` : ''}</div><p><b>${nn(i)} · ${esc(c.titulo)}</b><span class="num">${timecode(c.inicio)}</span></p></a></li>`;
    })
    .join('');

const secoes = linha.cenas
  .map((c, i) => {
    const cj = cenasJson[c.id] || {};
    const saida = linha.transicoes.find((X) => X.de === c.id);
    const entrada = linha.transicoes.find((X) => X.para === c.id);
    const etiquetas = [
      c.fundoPuro ? 'Fundo puro para edição' : null,
      cj.midia || /c\.(foto|video)\(/.test(readFileSync(path.join(P, 'cenas', `${c.variante ? `${c.id}@${c.variante}` : c.id}.js`), 'utf8')) ? 'Mídia da pessoa' : null,
      c.variante ? `Variante: ${c.variante}` : null,
      ...(cj.etiquetas || []),
    ].filter(Boolean);
    const quadros = (formato) => {
      const n = c.quadros.length;
      return `<div class="quadros n${Math.min(4, n)} f${formato}" data-formato="${formato}">${c.quadros
        .map((q, k) => {
          const src = img(formato, i, c.id, q.id);
          const rotulo = q.rotulo || (k === 0 ? 'Início' : k === n - 1 ? 'Fim' : `Passo ${k + 1}`);
          return `<figure><div class="quadro f${formato}">${src ? `<img src="${src}" alt="${esc(rotulo)}">` : '<div class="vazio">sem quadro</div>'}</div><figcaption><b>${esc(rotulo)} <span class="num">· ${tempoFino(q.t)} s</span></b>${q.legenda ? `<span>${esc(q.legenda)}</span>` : ''}</figcaption></figure>`;
        })
        .join('')}</div>`;
    };
    const batidas = [...(cj.batidas || [])]
      .sort((a, b) => a.t - b.t)
      .map((b) => `<li><span class="t num">${tempoBatida(b.t)}</span><span class="tag ${esc(b.tipo || 'tipo')}">${esc(ROTULO_BATIDA[b.tipo] || b.tipo || 'Movimento')}</span><p>${esc(b.texto)}</p></li>`)
      .join('');
    const lado = [
      cj.camera ? ['Câmera', cj.camera] : null,
      ['Entra', entrada ? descreverTransicao(entrada, projeto.catalogo, 'entra') : i === 0 ? 'Abre o filme.' : 'Corte seco.'],
      ['Sai', saida ? descreverTransicao(saida, projeto.catalogo, 'sai') : i === linha.cenas.length - 1 ? 'Fecha o filme no quadro final, vivo até o último quadro.' : 'Corte seco.'],
      cj.som ? ['Som', cj.som] : null,
    ]
      .filter(Boolean)
      .map(([h, t]) => `<div><h4 class="sobre">${esc(h)}</h4><p>${esc(t)}</p></div>`)
      .join('');
    const passagem =
      saida && saida.para
        ? `<div class="passagem"><span class="num">${nn(i)} → ${nn(i + 1)}</span><b>${esc(nomeTransicao(saida.tipo))}</b><span class="num">${tempoFino(saida.dur)} s</span></div>`
        : '';
    return `<section class="cena" id="cena-${esc(c.id)}">
      <header class="cena-cab">
        <span class="n num">${nn(i)}</span>
        <div class="cena-tit"><h2>${esc(c.titulo)}</h2>${cj.ideia ? `<p class="ideia">${esc(cj.ideia)}</p>` : ''}</div>
        <div class="cena-tempo num">${timecodeFino(c.inicio)} — ${timecodeFino(c.fim)} <span class="pilula">${tempoFino(c.dur)} s</span></div>
      </header>
      ${etiquetas.length ? `<div class="etiquetas">${etiquetas.map((e) => `<span class="etiqueta">${esc(e)}</span>`).join('')}</div>` : ''}
      ${formatosComQuadros.map(quadros).join('')}
      <div class="notas">
        <div class="movimento"><h4 class="sobre">Movimento</h4>${batidas ? `<ol>${batidas}</ol>` : '<p class="vazio-txt">As batidas desta cena ainda não foram escritas.</p>'}</div>
        <aside class="lado">${lado}</aside>
      </div>
    </section>${passagem}`;
  })
  .join('');

function nomeTransicao(t) {
  return (
    {
      corte: 'Corte seco',
      'corte-no-eixo': 'Corte no eixo, em movimento',
      'avancar-desfocar': 'Avança, desfoca e nasce do desfoque',
      esmaecer: 'Esmaecer uniforme',
      dissolver: 'Fusão',
      empurrar: 'Empurrão',
      chicote: 'Chicote de câmera',
      mergulho: 'Mergulho no elemento',
      ponte: 'Elemento-ponte',
      'ponto-de-luz': 'Ponto de luz',
      atravessar: 'A câmera atravessa',
      flash: 'Flash',
      'lamina-de-luz': 'Lâmina de luz',
      iris: 'Revelação radial',
      'na-cena': 'Passagem coreografada na cena',
    }[t] || t
  );
}

const abas =
  formatosComQuadros.length > 1
    ? `<div class="abas" role="tablist">${formatosComQuadros.map((f) => `<button role="tab" data-f="${f}" class="${f === principal ? 'on' : ''}">${nomeFormato(f)}</button>`).join('')}</div>`
    : '';

const css = `
.prancha { padding-top: 8px; }
/* o cabeçalho veste a marca do filme: o fundo, a cor do texto e a fonte do título dela */
.cab-marca { background: var(--fundo, #111); color: var(--texto, #f2f2f2); }
.cab-marca .cab-in { max-width: 1320px; margin: 0 auto; padding: 56px 16px 52px; }
@media (min-width: 720px) { .cab-marca .cab-in { padding: 72px 40px 64px; } }
.cab { display: grid; gap: 22px; }
.cab .sobre { color: var(--texto-suave, #a6a6a6); }
.cab h1 { font-family: var(--fonte-titulo, var(--pg-sans)); font-weight: var(--titulo-peso, 400); font-size: clamp(44px, 8.4vw, 132px); line-height: 0.96; letter-spacing: var(--titulo-tracking, -0.045em); text-wrap: balance; max-width: 15ch; }
.cab .meta div { border-top-color: color-mix(in srgb, var(--texto, #fff) 18%, transparent); }
.cab .meta dt { color: var(--texto-suave, #a6a6a6); }
.cab .abas { background: color-mix(in srgb, var(--texto, #fff) 8%, transparent); box-shadow: none; }
.cab .abas button { color: var(--texto-suave, #a6a6a6); }
.cab .abas button.on { background: var(--texto, #fff); color: var(--fundo, #111); }
.cab .linha-sup { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: center; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px 28px; margin: 6px 0 0; }
.meta div { border-top: 1px solid var(--pg-fio); padding-top: 10px; }
.meta dt { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pg-suave); }
.meta dd { margin: 4px 0 0; font-size: 15px; }
.bloco-sec { padding: 44px 0; border-bottom: 1px solid var(--pg-fio); }
.bloco-sec > h2 { margin-bottom: 20px; }
.linguagem ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 22px 28px; }
.linguagem h3 { font-size: 17px; letter-spacing: -0.01em; margin-bottom: 6px; }
.linguagem p { color: var(--pg-suave); font-size: 14px; text-wrap: pretty; }
.refs ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.refs li { display: grid; grid-template-columns: 140px 1fr; gap: 14px; align-items: start; }
.refs img { width: 140px; border-radius: 8px; box-shadow: var(--pg-sombra); }
.refs h3 { font-size: 15px; margin-bottom: 4px; }
.refs p { font-size: 13px; color: var(--pg-suave); }
.regua { position: relative; height: 78px; margin: 4px 0 30px; }
.regua .bloco { position: absolute; height: 28px; display: flex; align-items: center; gap: 6px; padding: 0 8px; overflow: hidden; white-space: nowrap; border-radius: 6px; background: var(--pg-papel); box-shadow: inset 0 0 0 1px var(--pg-fio-forte); font-size: 12px; color: var(--pg-tinta); text-decoration: none; }
.regua .bloco b { font-weight: 500; color: var(--pg-suave); }
.regua .t0 { top: 0; }
.regua .t1 { top: 32px; }
.regua .janela { position: absolute; top: 0; height: 60px; background: repeating-linear-gradient(135deg, rgba(21,22,25,0.10) 0 4px, transparent 4px 8px); border-radius: 4px; pointer-events: none; }
.regua .escala { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; border-top: 1px solid var(--pg-fio); }
.regua .escala span { position: absolute; top: 2px; transform: translateX(-50%); font-size: 10px; color: var(--pg-fraca); font-variant-numeric: tabular-nums; }
.regua .escala span:first-child { transform: none; }
.contato { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 16px; }
@media (min-width: 900px) { .contato.f16x9, .contato.f9x16 { grid-template-columns: repeat(var(--col, 4), minmax(0, 1fr)); } }
@media (min-width: 600px) and (max-width: 899px) { .contato.f9x16 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.contato a { display: block; text-decoration: none; }
.contato p { display: flex; justify-content: space-between; gap: 8px; margin-top: 9px; font-size: 12.5px; color: var(--pg-suave); }
.contato p b { font-weight: 400; color: var(--pg-tinta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quadro.f16x9 { aspect-ratio: 16 / 9; }
.quadro.f9x16 { aspect-ratio: 9 / 16; }
.quadro .vazio { display: grid; place-items: center; height: 100%; color: #777; font-size: 12px; }
.cena { padding: 56px 0 44px; border-bottom: 1px solid var(--pg-fio); scroll-margin-top: 12px; }
.cena-cab { display: grid; grid-template-columns: auto 1fr; gap: 6px 22px; align-items: start; margin-bottom: 18px; }
.cena-cab .n { font-size: clamp(48px, 6vw, 84px); line-height: 0.86; letter-spacing: -0.05em; }
.cena-tit h2 { font-size: clamp(26px, 3.2vw, 40px); line-height: 1.04; letter-spacing: -0.03em; }
.cena-tit .ideia { margin-top: 8px; font-size: 16px; color: var(--pg-suave); max-width: 60ch; text-wrap: pretty; }
.cena-tempo { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--pg-suave); }
@media (min-width: 900px) { .cena-cab { grid-template-columns: auto 1fr auto; } .cena-tempo { grid-column: auto; align-self: center; } }
.etiquetas { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 18px; }
.quadros { display: grid; gap: 16px; }
.quadros figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 10px; font-size: 13.5px; color: var(--pg-suave); text-wrap: pretty; }
.quadros figcaption b { font-weight: 500; color: var(--pg-tinta); }
.quadros figcaption b .num { font-weight: 400; color: var(--pg-fraca); }
.quadros.f16x9 { grid-template-columns: repeat(auto-fill, minmax(min(100%, 500px), 1fr)); gap: 22px 18px; }
.quadros.f16x9.n3 > figure:last-child:nth-child(3) { grid-column: 1 / -1; }
.quadros.f16x9.n1 { grid-template-columns: minmax(0, 860px); }
.quadros.f9x16 { grid-template-columns: repeat(auto-fill, minmax(min(46%, 280px), 330px)); }
.quadros + .quadros { margin-top: 26px; }
body.so-16x9 .quadros.f9x16, body.so-9x16 .quadros.f16x9, body.so-16x9 .contato.f9x16, body.so-9x16 .contato.f16x9 { display: none; }
.notas { display: grid; gap: 28px; margin-top: 30px; }
@media (min-width: 960px) { .notas { grid-template-columns: minmax(0, 1fr) 340px; gap: 48px; } }
.movimento ol { display: grid; gap: 0; margin-top: 12px; }
.movimento li { display: grid; grid-template-columns: 64px auto 1fr; gap: 6px 12px; align-items: baseline; padding: 11px 0; border-top: 1px solid var(--pg-fio); }
.movimento li:last-child { border-bottom: 1px solid var(--pg-fio); }
.movimento .t { font-size: 13px; color: var(--pg-suave); }
.movimento p { font-size: 14.5px; text-wrap: pretty; }
@media (max-width: 560px) { .movimento li { grid-template-columns: 56px 1fr; } .movimento li p { grid-column: 1 / -1; } }
.tag { justify-self: start; display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; color: var(--c, var(--pg-suave)); background: color-mix(in srgb, var(--c, #888) 10%, transparent); }
.tag.tipo { --c: var(--pg-tipo); } .tag.camera { --c: var(--pg-camera); } .tag.transicao { --c: var(--pg-transicao); }
.tag.luz { --c: var(--pg-luz); } .tag.objeto { --c: var(--pg-objeto); } .tag.vida { --c: var(--pg-vida); }
.lado { display: grid; gap: 18px; align-content: start; }
.lado div { padding: 14px 16px; border-radius: 12px; background: var(--pg-papel); box-shadow: inset 0 0 0 1px var(--pg-fio); }
.lado p { margin-top: 6px; font-size: 14px; text-wrap: pretty; }
.vazio-txt { margin-top: 12px; color: var(--pg-fraca); font-size: 14px; }
.passagem { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--pg-fio); font-size: 13px; color: var(--pg-suave); }
.passagem b { font-weight: 500; color: var(--pg-tinta); }
.passagem::before { content: ''; width: 28px; height: 1px; background: var(--pg-fio-forte); }
.abas { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--pg-papel); box-shadow: inset 0 0 0 1px var(--pg-fio); }
.abas button { height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--pg-suave); font: 13px var(--pg-sans); cursor: pointer; }
.abas button.on { background: var(--pg-tinta); color: #fff; }
.rodape { padding: 56px 0 0; display: grid; gap: 8px; }
.rodape p:first-child { font-size: clamp(22px, 2.6vw, 30px); line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; max-width: 30ch; }
.rodape p + p { color: var(--pg-suave); font-size: 13px; }
@media print { body { background: #fff; } .abas { display: none; } .cena { break-inside: avoid-page; } }
`;

const corpo = `<header class="cab-marca"><div class="cab-in cab">
    <div class="linha-sup"><p class="sobre">Storyboard · ${esc(J.titulo || projeto.slug)} · rev. ${String(J.storyboard.revisao || 1).padStart(2, '0')}${J.storyboard.aprovadoEm && J.storyboard.revisaoAprovada === J.storyboard.revisao ? ' · aprovado em ' + dataBr(J.storyboard.aprovadoEm) : ''}</p>${abas}</div>
    <h1>${esc(J.cartaz || J.titulo || projeto.slug)}</h1>
    <dl class="meta">${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </div></header>
<main class="prancha">
  ${linguagem ? `<section class="bloco-sec linguagem"><h2 class="sobre">A linguagem do movimento</h2><ul>${linguagem}</ul></section>` : ''}
  ${refs ? `<section class="bloco-sec refs"><h2 class="sobre">Referências</h2><ul>${refs}</ul></section>` : ''}
  <section class="bloco-sec sequencia">
    <h2 class="sobre">Sequência</h2>
    <div class="regua">${regua}${janelas}<div class="escala">${marcas.join('')}</div></div>
    ${formatosComQuadros.map((f) => `<ol class="contato f${f}" style="--col:${colunasContato(linha.cenas.length, f)}">${contato(f)}</ol>`).join('')}
  </section>
  ${secoes}
  <footer class="rodape">
    <p>Aprovado o storyboard, a gente anima em 16:9, 9:16 ou nos dois.</p>
    <p>Quadros renderizados com a marca e as imagens reais do projeto. Cada batida tem o tempo local da cena, em segundos.</p>
  </footer>
</main>`;

const script = formatosComQuadros.length > 1
  ? `const b=document.body;const abas=[...document.querySelectorAll('.abas button')];
function ver(f){b.classList.remove('so-16x9','so-9x16');b.classList.add('so-'+f);abas.forEach(a=>a.classList.toggle('on',a.dataset.f===f));try{localStorage.setItem('sb-formato',f)}catch(e){}}
abas.forEach(a=>a.onclick=()=>ver(a.dataset.f));let f0='${principal}';try{f0=localStorage.getItem('sb-formato')||f0}catch(e){}ver(f0);`
  : '';

// a marca do filme (cores e fontes embutidas) só para o cabeçalho da prancha
let cssMarca = '';
try {
  cssMarca = lerMarca(P, pastaSb).css;
} catch {
  /* sem marca: o cabeçalho fica neutro */
}
const html = pagina({ titulo: `Storyboard · ${J.titulo || projeto.slug}`, css: cssMarca + css, corpo, script });
const destino = path.join(pastaSb, 'index.html');
writeFileSync(destino, html);

if (op.pdf) {
  const nav = await abrirNavegador();
  const pg = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  await pg.goto(pathToFileURL(destino).href, { waitUntil: 'load' });
  await pg.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))));
  await pg.pdf({ path: path.join(pastaSb, 'storyboard.pdf'), width: '1440px', height: '2000px', printBackground: true });
  await nav.close();
  console.log('✓ storyboard/storyboard.pdf');
}

if (!op['sem-diretor']) imprimirNotas(notasDiretor, '\nDiretor (composição)');
const unicos = [...new Set(errosMotor)];
if (unicos.length) {
  console.log('\nO motor avisou:');
  for (const e of unicos.slice(0, 12)) console.log(`  ✗ ${e}`);
}
console.log(`\nStoryboard rev. ${String(J.storyboard.revisao).padStart(2, '0')}: ${destino}  (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
process.exit(unicos.some((e) => !/aviso/.test(e)) ? 2 : 0);
