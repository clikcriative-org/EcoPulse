#!/usr/bin/env node
/**
 * novo-projeto.mjs — cria o projeto de motion da pessoa em human-output/motion-design/<slug>/,
 * na pasta atual (nunca dentro da skill).
 *
 *   node scripts/novo-projeto.mjs --titulo "Lançamento do app" \
 *        --ids gancho:palavra-gigante,produto:aparelho,colecao:montagem,fecho:marca-em-etapas
 *   node scripts/novo-projeto.mjs --titulo "…" --cenas 4 --formato 9x16 --bpm 110 \
 *        --marca ~/marca-da-empresa  --logo logo.svg --fonte Fonte-Regular.woff2 \
 *        --midia fotos/ --midia gravacao.mp4 --assets ~/repo-da-marca --referencia ref.mp4
 *
 * Opções:
 *   --titulo "…"            nome do filme (obrigatório)
 *   --slug nome             pasta do projeto (padrão: o título sem acento)
 *   --ids id:tipo,…         as cenas, cada uma com o TIPO da biblioteca (modelos/cenas/):
 *                           frase · palavra-gigante · frase-que-vira · montagem · aparelho ·
 *                           foto-plano · foto-objeto · marca-em-etapas
 *   --cenas N               sem --ids: um esqueleto de N cenas com tipos variados
 *   --formato 16x9|9x16     formato base (padrão 16x9); o outro vem depois, recomposto
 *   --fps 60  --bpm 120     taxa do mestre e ritmo do filme
 *   --marca <pasta|tokens.css>  marca pronta (tokens.css, fontes/, ativos/, marca.md)
 *   --logo <arquivo>        logo/símbolo (svg, png) → marca/ativos/
 *   --fonte <arquivo>       arquivo de fonte → marca/fontes/ (gera o @font-face)
 *   --midia <arquivo|pasta> fotos e vídeos que podem aparecer no filme → midia/
 *   --assets <pasta>        repositório/pasta cheia de assets: separa fontes, logos, imagens e vídeos
 *   --referencia <video>    vídeo de referência (anotado no projeto; leia com analisar-referencia.mjs)
 *   --pasta <base>          onde criar human-output/ (padrão: a pasta atual)
 *   --forcar                completa um projeto que já existe sem apagar nada
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lerArgs, lista, num, ultimo } from './lib/args.mjs';
import { RAIZ_SKILL } from './lib/ambiente.mjs';
import { TIPOS_CENA, gravarJson, hoje, normalizarFormato } from './lib/projeto.mjs';

const { op } = lerArgs(process.argv.slice(2), { bandeiras: ['forcar', 'ajuda', 'help'] });
const AJUDA = `Uso: node <skill>/scripts/novo-projeto.mjs --titulo "Nome do filme" --ids id:tipo,id:tipo,… [opções]

  --ids id:tipo,…          as cenas em ordem, cada uma com um tipo da biblioteca:
                           ${Object.keys(TIPOS_CENA).join(' · ')}
  --cenas N                (sem --ids) um esqueleto de N cenas com tipos variados
  --formato 16x9|9x16      formato base (padrão 16x9)
  --fps 60  --bpm 120      taxa do mestre e ritmo do filme
  --marca <pasta|tokens.css>  marca pronta (tokens.css, fontes/, ativos/, marca.md)
  --logo <arquivo>         logo/símbolo (svg, png) → marca/ativos/
  --fonte <arquivo>        arquivo de fonte → marca/fontes/ (gera o @font-face)
  --midia <arquivo|pasta>  fotos e vídeos que podem aparecer no filme → midia/
  --assets <pasta>         repositório/pasta cheia de assets (separa fontes, logos, imagens, vídeos)
  --referencia <video>     vídeo de referência (anotado; leia com analisar-referencia.mjs)
  --slug nome · --pasta <base> · --forcar`;
if (op.ajuda || op.help) {
  console.log(AJUDA);
  process.exit(0);
}
const titulo = ultimo(op.titulo);
if (!titulo || titulo === true) {
  console.error(AJUDA);
  process.exit(1);
}
const slugDe = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'motion';
const slug = slugDe(ultimo(op.slug) || titulo);
const base = path.resolve(ultimo(op.pasta) || process.cwd());
if (base.startsWith(RAIZ_SKILL + path.sep) || base === RAIZ_SKILL) {
  console.error('O projeto não pode morar dentro da pasta da skill. Rode na pasta de trabalho da pessoa.');
  process.exit(1);
}
const P = path.join(base, 'human-output', 'motion-design', slug);
if (existsSync(path.join(P, 'motion.json')) && !op.forcar) {
  console.error(`Já existe um projeto em ${P}. Use outro --slug ou --forcar para completar sem apagar.`);
  process.exit(1);
}
const formato = normalizarFormato(ultimo(op.formato)) || '16x9';
const fps = num(ultimo(op.fps), 60);
const bpmPedido = num(ultimo(op.bpm), 120);
// BPM lento (abaixo de 96): as cenas contam em tempo dobrado. Os modelos são escritos em batidas de
// um pulso de 100 a 160; a 80 BPM tudo ficaria uma vez e meia mais lento que a referência. O dobro
// cai na mesma grade da trilha (uma batida da trilha = duas das cenas).
const bpm = bpmPedido < 96 ? bpmPedido * 2 : bpmPedido;
/* ─── as cenas: id e tipo ─── */
const TIPOS = Object.keys(TIPOS_CENA);
function esqueleto(n) {
  // o gancho forte, um meio variado com um clímax de montagem, a marca no fim
  if (n <= 1) return ['marca-em-etapas'];
  if (n === 2) return ['palavra-gigante', 'marca-em-etapas'];
  const meio = ['frase', 'montagem', 'frase-que-vira', 'foto-plano', 'aparelho', 'foto-objeto', 'frase'];
  return ['palavra-gigante', ...meio.slice(0, n - 2), 'marca-em-etapas'];
}
let pedidas;
if (lista(op.ids).length) {
  pedidas = lista(op.ids).map((x) => {
    const [id, tipo] = x.split(':').map((y) => y && y.trim());
    return { id: slugDe(id), tipo: tipo || null };
  });
  const sem = pedidas.filter((c) => !c.tipo || !TIPOS_CENA[c.tipo]);
  if (sem.length) {
    console.error(`Cada cena precisa de um tipo da biblioteca (id:tipo). Faltou ou não existe em: ${sem.map((c) => c.id + (c.tipo ? `:${c.tipo}` : '')).join(', ')}`);
    console.error(`Tipos: ${TIPOS.map((t) => `${t} (${TIPOS_CENA[t].ideia})`).join('\n       ')}`);
    process.exit(1);
  }
} else {
  const n = Math.max(1, Math.min(12, num(ultimo(op.cenas), 4)));
  pedidas = esqueleto(n).map((tipo, i) => ({ id: `cena-${i + 1}`, tipo }));
}
const ids = pedidas.map((c) => c.id);

const criados = [];
const avisos = [];
const mk = (...p) => {
  const d = path.join(P, ...p);
  mkdirSync(d, { recursive: true });
  return d;
};
for (const d of ['marca/fontes', 'marca/ativos', 'midia', 'referencias', 'cenas']) mk(d);
const MODELOS = path.join(RAIZ_SKILL, 'modelos');

function copiar(origem, destinoDir, nome) {
  const dest = path.join(destinoDir, nome || path.basename(origem));
  if (existsSync(dest)) return dest;
  copyFileSync(origem, dest);
  criados.push(path.relative(P, dest));
  return dest;
}

/* ─── marca ─── */
const EXT_FONTE = /\.(woff2?|ttf|otf)$/i;
const EXT_IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const EXT_VIDEO = /\.(mp4|mov|webm|m4v|mkv)$/i;
const tokensDest = path.join(P, 'marca', 'tokens.css');
const marcaArg = ultimo(op.marca);
if (marcaArg && marcaArg !== true) {
  const m = path.resolve(marcaArg);
  if (!existsSync(m)) avisos.push(`não achei a marca em ${m}`);
  else if (statSync(m).isFile()) copiar(m, path.join(P, 'marca'), 'tokens.css');
  else {
    const andar = (de, para) => {
      for (const n of readdirSync(de)) {
        if (n.startsWith('.') || n === 'node_modules') continue;
        const a = path.join(de, n);
        if (statSync(a).isDirectory()) {
          mkdirSync(path.join(para, n), { recursive: true });
          andar(a, path.join(para, n));
        } else copiar(a, para);
      }
    };
    andar(m, path.join(P, 'marca'));
  }
}
if (!existsSync(tokensDest)) copiar(path.join(MODELOS, 'marca', 'tokens.css'), path.join(P, 'marca'));

/* ─── assets soltos e repositório ─── */
const PESO = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, book: 400, normal: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
const fontesNovas = [];
function adicionarFonte(arq) {
  const dest = copiar(arq, path.join(P, 'marca', 'fontes'));
  const nome = path.basename(dest).replace(/\.[^.]+$/, '');
  const partes = nome.split(/[-_ ]+/);
  let peso = 400, italico = /italic|oblique/i.test(nome);
  let familia = partes[0];
  for (let i = partes.length - 1; i > 0; i--) {
    const k = partes[i].toLowerCase().replace(/italic|oblique/g, '');
    if (PESO[k] !== undefined) {
      peso = PESO[k];
      familia = partes.slice(0, i).join(' ');
      break;
    }
    if (k === '' && i === partes.length - 1) continue;
  }
  familia = familia.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/VariableFont.*$/i, '').trim() || 'Marca';
  const formato = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[path.extname(dest).slice(1).toLowerCase()];
  fontesNovas.push({ familia, peso, italico, url: `fontes/${path.basename(dest)}`, formato, variavel: /variable/i.test(nome) });
}
function classificar(arq, { logo = false } = {}) {
  const n = path.basename(arq);
  if (EXT_FONTE.test(n)) return adicionarFonte(arq);
  if (EXT_IMG.test(n)) {
    const ehMarca = logo || /logo|marca|brand|simbolo|símbolo|symbol|icone|ícone|icon|selo|lockup|wordmark/i.test(n);
    if (statSync(arq).size > 40e6) return avisos.push(`pulei ${n} (imagem maior que 40 MB)`);
    return copiar(arq, ehMarca ? path.join(P, 'marca', 'ativos') : path.join(P, 'midia'));
  }
  if (EXT_VIDEO.test(n)) {
    if (statSync(arq).size > 800e6) return avisos.push(`pulei ${n} (vídeo maior que 800 MB)`);
    return copiar(arq, path.join(P, 'midia'));
  }
  if (/(tokens|theme|tema|variables|variaveis|design-?system|brand|marca)[^/]*\.(css|json|md)$/i.test(n)) {
    mkdirSync(path.join(P, 'marca', 'leitura'), { recursive: true });
    return copiar(arq, path.join(P, 'marca', 'leitura'));
  }
  return null;
}
function varrer(pasta, opts = {}) {
  let n = 0;
  const pular = /^(node_modules|\.git|dist|build|\.next|\.cache|coverage|vendor|human-output)$/;
  const andar = (d, prof) => {
    if (prof > 8 || n > 600) return;
    for (const nome of readdirSync(d)) {
      if (nome.startsWith('.') || pular.test(nome)) continue;
      const a = path.join(d, nome);
      const s = statSync(a);
      if (s.isDirectory()) andar(a, prof + 1);
      else if (classificar(a, opts)) n++;
    }
  };
  andar(pasta, 0);
  return n;
}
for (const l of [].concat(op.logo || []).filter((x) => x !== true)) {
  const a = path.resolve(l);
  if (existsSync(a)) classificar(a, { logo: true });
  else avisos.push(`não achei o logo ${a}`);
}
for (const f of [].concat(op.fonte || []).filter((x) => x !== true)) {
  const a = path.resolve(f);
  if (existsSync(a) && EXT_FONTE.test(a)) adicionarFonte(a);
  else avisos.push(`não achei a fonte ${a}`);
}
for (const m of [].concat(op.midia || []).filter((x) => x !== true)) {
  const a = path.resolve(m);
  if (!existsSync(a)) avisos.push(`não achei ${a}`);
  else if (statSync(a).isDirectory()) varrer(a);
  else classificar(a);
}
for (const r of [].concat(op.assets || []).filter((x) => x !== true)) {
  const a = path.resolve(r);
  if (!existsSync(a)) avisos.push(`não achei a pasta de assets ${a}`);
  else {
    const n = varrer(a);
    console.log(`· ${n} arquivos aproveitados de ${a}`);
  }
}

// @font-face das fontes novas
if (fontesNovas.length) {
  let css = readFileSync(tokensDest, 'utf8');
  const blocos = fontesNovas
    .filter((f) => !css.includes(f.url))
    .map(
      (f) =>
        `@font-face { font-family: "${f.familia}"; src: url("${f.url}") format("${f.formato}"); font-weight: ${f.variavel ? '100 900' : f.peso}; font-style: ${f.italico ? 'italic' : 'normal'}; font-display: block; }`,
    );
  if (blocos.length) {
    const familias = [...new Set(fontesNovas.map((f) => f.familia))];
    css = `/* fontes da marca (geradas pelo novo-projeto; ajuste se o nome da família não bater) */\n${blocos.join('\n')}\n\n${css}`;
    if (/--fonte-titulo:\s*ui-sans-serif/.test(css)) {
      const fam = `"${familias[0]}", ui-sans-serif, system-ui, sans-serif`;
      css = css.replace(/--fonte-titulo:[^;]+;/, `--fonte-titulo: ${fam};`).replace(/--fonte-texto:[^;]+;/, `--fonte-texto: ${fam};`);
    }
    writeFileSync(tokensDest, css);
  }
}

/* ─── cenas a partir da biblioteca de tipos (modelos/cenas/<tipo>.js e .css) ─── */
const batida = 60 / bpm;
const r3 = (x) => Math.round(x * 1000) / 1000;
const ativosMarca = readdirSync(path.join(P, 'marca', 'ativos')).filter((n) => !n.startsWith('.') && /\.(svg|png|webp)$/i.test(n));
const logoPadrao = (ativosMarca.find((n) => /\.svg$/i.test(n) && /logo|marca|brand|lockup|wordmark/i.test(n)) || ativosMarca.find((n) => /\.svg$/i.test(n)) || ativosMarca[0] || '').replace(/\.[^.]+$/, '');
const fotosMidia = readdirSync(path.join(P, 'midia')).filter((n) => !n.startsWith('.') && /\.(png|jpe?g|webp|avif|svg)$/i.test(n)).map((n) => n.replace(/\.[^.]+$/, ''));
const PAPEL = (i, n, tipo) => (i === 0 ? 'gancho' : tipo === 'montagem' ? 'climax' : tipo === 'marca-em-etapas' ? 'marca' : i === n - 1 ? 'convite' : 'desenvolvimento');
/* A passagem padrão pela vizinhança (o storyboard decide; isto é só o ponto de partida):
   texto → objeto ou marca: o texto converge num ponto de luz onde o objeto da próxima nasce;
   texto → texto: no eixo quando é o mesmo tipo, senão avança e desfoca; foto → foto: corte em
   movimento (montagem); qualquer coisa → foto: funde com um respiro de foco. */
const COM_OBJETO = new Set(['montagem', 'aparelho', 'foto-objeto', 'marca-em-etapas']);
function passagem(tA, tB, saidaFicha) {
  const fa = TIPOS_CENA[tA].familia, fb = TIPOS_CENA[tB].familia;
  if (saidaFicha) {
    if (saidaFicha.tipo === 'na-cena' && !COM_OBJETO.has(tB)) return { tipo: 'ponto-de-luz' };
    return saidaFicha;
  }
  if (COM_OBJETO.has(tB) && (fa === 'texto' || fb === 'marca')) return { tipo: 'ponto-de-luz', ponte: 'objeto' };
  if (fa === 'texto' && fb === 'texto') return tA === tB ? { tipo: 'corte-no-eixo' } : { tipo: 'avancar-desfocar' };
  if (fa === 'foto' && fb === 'foto') return { tipo: 'corte' };
  if (fb === 'foto') return { tipo: 'dissolver', desfoque: 0.6, escala: 0.04 };
  return { tipo: 'avancar-desfocar' };
}
let fotoUsada = 0;
const cenas = pedidas.map(({ id, tipo }, i) => {
  const T = TIPOS_CENA[tipo];
  const fonteJs = readFileSync(path.join(MODELOS, 'cenas', `${tipo}.js`), 'utf8');
  const fonteCss = readFileSync(path.join(MODELOS, 'cenas', `${tipo}.css`), 'utf8');
  const m = /\/\*@ficha\s*([\s\S]*?)@\*\/\s*/.exec(fonteJs);
  const ficha = m ? JSON.parse(m[1]) : {};
  let nb = T.batidas;
  if (T.durMax) nb = Math.min(nb, Math.max(2, Math.floor((T.durMax + 1e-6) / batida)));
  const dur = r3(nb * batida);
  const ate = (tb) => Math.min(r3(tb * batida), r3(dur - 0.08));
  const foto = fotosMidia.length ? fotosMidia[fotoUsada++ % fotosMidia.length] : 'foto';
  const titulo = `Cena ${i + 1}`;
  const subs = (x) =>
    x
      .replaceAll('{{id}}', id)
      .replaceAll('{{titulo}}', titulo)
      .replaceAll('{{dur}}', String(dur).replace('.', ','))
      .replaceAll('{{foto}}', foto)
      .replaceAll('{{logo}}', logoPadrao);
  const js = path.join(P, 'cenas', `${id}.js`);
  const css = path.join(P, 'cenas', `${id}.css`);
  if (!existsSync(js)) {
    writeFileSync(js, subs(fonteJs.replace(m ? m[0] : '', '')));
    criados.push(path.relative(P, js));
  }
  if (!existsSync(css)) {
    writeFileSync(css, subs(fonteCss));
    criados.push(path.relative(P, css));
  }
  const c = {
    id,
    tipo,
    papel: PAPEL(i, pedidas.length, tipo),
    titulo,
    dur,
    ideia: ficha.ideia || T.ideia,
    camera: ficha.camera || 'Push-in vivo, passando por 1,0 no quadro aprovado.',
    quadros: (ficha.quadros || []).map((q) => ({ id: q.id, rotulo: q.rotulo, legenda: q.legenda, t: ate(q.tb), ...(q.aprovado ? { aprovado: true } : {}) })),
    batidas: (ficha.batidas || []).filter((b) => b.tb * batida < dur - 0.04).map((b) => ({ t: r3(b.tb * batida), tipo: b.tipo, texto: b.texto })),
  };
  if (i < pedidas.length - 1) c.saida = passagem(tipo, pedidas[i + 1].tipo, ficha.saida);
  else if (ficha.saida && ['esmaecer', 'atravessar'].includes(ficha.saida.tipo)) c.saida = ficha.saida;
  return c;
});

/* ─── motion.json ─── */
const refs = [].concat(op.referencia || []).filter((x) => x !== true).map((r) => ({ nome: slugDe(path.parse(r).name), arquivo: path.resolve(r), leitura: '' }));
const json = {
  versao: 1,
  titulo,
  slug,
  fps,
  bpm,
  ...(bpm !== bpmPedido ? { bpmTrilha: bpmPedido } : {}),
  formatoBase: formato,
  formatos: [formato],
  movimento: {
    curvaEntrada: [0.16, 1, 0.3, 1],
    cascataLetra: 0.026,
    cascataPalavra: 0.045,
    entrada: 0.6,
    opacidade: 0.18,
    subida: 0.18,
    desfoque: 0.14,
    saida: 0.25,
    camera: 0.012,
  },
  linguagem: [
    { titulo: 'Ritmo', texto: `${bpm !== bpmPedido ? `${bpmPedido} BPM, contados em tempo dobrado (${bpm})` : `${bpm} BPM`}: uma batida = ${String(Math.round((60 / bpm) * 1000) / 1000).replace('.', ',')} s. Entradas e trocas caem na batida; um acontecimento visível a cada uma ou duas.` },
    { titulo: 'Texto', texto: 'Do desfoque para o foco, subida curta, 26 ms entre letras, curva forte, a frase inteira legível em até 0,5 s. Tipografia nunca quica nem estica.' },
    { titulo: 'Câmera', texto: 'Nunca parada: push-in de 3 a 6 % no plano, passando por 1,0 no quadro aprovado.' },
    { titulo: 'Hold', texto: 'Legível por pelo menos 0,8 s e vivo: a luz respira, o degradê deriva, um brilho passa uma vez.' },
    { titulo: 'Saída', texto: '150 a 350 ms, acelerando até o último quadro; mais curta que a entrada.' },
  ],
  referencias: refs,
  cenas,
  capa: { cena: cenas[cenas.length - 1].id, quadro: (cenas[cenas.length - 1].quadros.find((q) => q.aprovado) || cenas[cenas.length - 1].quadros.slice(-1)[0] || { id: 'fim' }).id },
  storyboard: { revisao: 0, aprovadoEm: null },
  versoes: [],
  criadoEm: hoje(),
};
const jsonDest = path.join(P, 'motion.json');
if (!existsSync(jsonDest)) {
  gravarJson(jsonDest, json);
  criados.push('motion.json');
}
const briefing = path.join(P, 'briefing.md');
if (!existsSync(briefing)) {
  writeFileSync(briefing, readFileSync(path.join(MODELOS, 'briefing.md'), 'utf8').replaceAll('{{titulo}}', titulo));
  criados.push('briefing.md');
}

// ativos.json: nome → arquivo (para o Claude achar logo e símbolos)
const ativos = readdirSync(path.join(P, 'marca', 'ativos')).filter((n) => !n.startsWith('.'));
if (ativos.length) gravarJson(path.join(P, 'marca', 'ativos.json'), Object.fromEntries(ativos.map((n) => [n.replace(/\.[^.]+$/, ''), `ativos/${n}`])));
const midia = readdirSync(path.join(P, 'midia')).filter((n) => !n.startsWith('.'));

console.log(`\nProjeto criado: ${P}\n`);
console.log(`  ${cenas.length} cenas · ${formato === '9x16' ? '9:16' : '16:9'} · ${fps} fps · ${bpm} BPM${bpm !== bpmPedido ? ` (tempo dobrado de ${bpmPedido})` : ''} · ${String(Math.round(cenas.reduce((a, c) => a + c.dur, 0) * 10) / 10).replace('.', ',')} s`);
for (const c of cenas) console.log(`    ${c.id.padEnd(16)} ${TIPOS_CENA[c.tipo].nome.padEnd(18)} ${String(c.dur).replace('.', ',').padEnd(6)} s  → ${c.saida ? c.saida.tipo : 'fim'}`);
console.log(`  marca: ${existsSync(path.join(P, 'marca', 'leitura')) ? 'tokens + arquivos de leitura em marca/leitura/' : 'marca/tokens.css'}${fontesNovas.length ? ` · ${fontesNovas.length} fonte(s)` : ''}${ativos.length ? ` · ${ativos.length} ativo(s)` : ''}`);
console.log(`  mídia: ${midia.length ? midia.join(', ') : 'nenhuma ainda'}`);
if (!fontesNovas.length && !/@font-face/.test(readFileSync(tokensDest, 'utf8'))) {
  console.log('  ! sem fonte da marca: o filme usa a fonte do sistema (copie os arquivos com --fonte ou para marca/fontes/)');
}
for (const a of avisos) console.log(`  ! ${a}`);
console.log('\nPróximos passos: marca/tokens.css; o roteiro em motion.json (copy, papel, durações, batidas);');
console.log('em cada cenas/<id>.js, a copy e a composição (os modelos são só ponto de partida técnico: redesenhe cada tela para esta ideia);');
console.log('e o storyboard: node <skill>/scripts/storyboard.mjs ' + JSON.stringify(P));
