/* projeto.mjs — ler, validar e calcular a linha do tempo de um projeto de motion.
   Um projeto é a pasta human-output/motion-design/<slug>/ com motion.json, marca/, midia/, cenas/. */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PASTA_MOTOR } from './ambiente.mjs';

export const FORMATOS = {
  '16x9': { largura: 1920, altura: 1080, nome: '16:9' },
  '9x16': { largura: 1080, altura: 1920, nome: '9:16' },
};
export const TIPOS_BATIDA = ['tipo', 'camera', 'transicao', 'luz', 'objeto', 'vida'];

/** A biblioteca de tipos de cena (modelos/cenas/<tipo>.js). `batidas` = duração sugerida. */
export const TIPOS_CENA = {
  frase: { nome: 'Frase', familia: 'texto', batidas: 4, durMax: 2.5, ideia: 'a frase chega de perto, a câmera recua e um destaque acende na batida' },
  'palavra-gigante': { nome: 'Palavra gigante', familia: 'texto', batidas: 6, forte: true, ideia: 'uma palavra de borda a borda, a lente a encontra de perto e recua; o apoio pequeno entra na batida' },
  'frase-que-vira': { nome: 'Frase que vira', familia: 'texto', batidas: 5, ideia: 'a frase converge num ponto de luz que vira o objeto da próxima cena' },
  montagem: { nome: 'Montagem', familia: 'objeto', batidas: 10, forte: true, climax: true, ideia: 'um herói sozinho, os outros caem em pilha, a pilha prende o ar e explode em órbita; a frase entra no centro' },
  aparelho: { nome: 'Aparelho', familia: 'objeto', batidas: 8, forte: true, ideia: 'o aparelho chega da profundidade, a tela se monta card a card e a câmera mergulha nela' },
  'foto-plano': { nome: 'Foto em plano', familia: 'foto', batidas: 6, ideia: 'a foto em plano cheio com foco que chega, a frase no espaço vazio dela, câmera viva' },
  'foto-objeto': { nome: 'Foto como objeto', familia: 'foto', batidas: 7, forte: true, ideia: 'a foto chega como card inclinado e abre até virar o plano cheio; a frase assenta por cima' },
  'marca-em-etapas': { nome: 'Marca em etapas', familia: 'marca', batidas: 8, ideia: 'o símbolo acende de um ponto, a marca se revela no sentido da leitura e o convite entra' },
};
export const PAPEIS = ['gancho', 'desenvolvimento', 'climax', 'respiro', 'prova', 'convite', 'marca'];

export const sha1 = (x) => createHash('sha1').update(x).digest('hex');
export const lerJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const gravarJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n');

export function normalizarFormato(f) {
  if (!f) return null;
  const s = String(f).toLowerCase().replace(/[:/]/g, 'x').replace(/\s/g, '');
  if (s === '16x9' || s === 'horizontal' || s === 'deitado') return '16x9';
  if (s === '9x16' || s === 'vertical' || s === 'empe' || s === 'em-pe') return '9x16';
  return null;
}
export function formatosPedidos(v, padrao) {
  if (!v || v === true) return [padrao];
  const s = String(v).toLowerCase();
  if (s === 'ambos' || s === 'todos' || s === 'os-dois') return ['16x9', '9x16'];
  const out = s.split(',').map(normalizarFormato).filter(Boolean);
  return out.length ? [...new Set(out)] : [padrao];
}

export function catalogo() {
  return lerJson(path.join(PASTA_MOTOR, 'catalogo.json')).transicoes;
}

/** Acha a pasta do projeto a partir de um caminho, de um slug ou da pasta atual. */
export function resolverProjeto(arg) {
  const tentar = (p) => (p && existsSync(path.join(p, 'motion.json')) ? path.resolve(p) : null);
  if (arg) {
    const direto = tentar(arg) || tentar(path.join(process.cwd(), 'human-output', 'motion-design', arg));
    if (direto) return direto;
    if (existsSync(arg) && statSync(arg).isFile() && path.basename(arg) === 'motion.json') return path.dirname(path.resolve(arg));
    throw new Error(`Não achei o projeto "${arg}" (procurei a pasta e human-output/motion-design/${arg}/ com motion.json).`);
  }
  const aqui = tentar(process.cwd());
  if (aqui) return aqui;
  const base = path.join(process.cwd(), 'human-output', 'motion-design');
  const lista = existsSync(base) ? readdirSync(base).filter((d) => tentar(path.join(base, d))) : [];
  if (lista.length === 1) return path.join(base, lista[0]);
  if (!lista.length) throw new Error('Nenhum projeto aqui. Crie um com: node <skill>/scripts/novo-projeto.mjs --titulo "…"');
  throw new Error(`Diga qual projeto: ${lista.join(', ')}`);
}

export function lerProjeto(pasta) {
  const json = lerJson(path.join(pasta, 'motion.json'));
  return { pasta, json, slug: json.slug || path.basename(pasta), catalogo: catalogo() };
}

export function arquivoDaCena(projeto, id, variante) {
  const base = path.join(projeto.pasta, 'cenas', variante ? `${id}@${variante}` : id);
  return { js: `${base}.js`, css: `${base}.css` };
}

const lerSeExiste = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

export function hashDaCena(projeto, id, variante) {
  const a = arquivoDaCena(projeto, id, variante);
  return sha1(`${variante || ''}\n${lerSeExiste(a.js)}\n${lerSeExiste(a.css)}`).slice(0, 16);
}

export function hashPasta(pasta, { conteudo = false } = {}) {
  if (!existsSync(pasta)) return '0';
  const h = createHash('sha1');
  const andar = (d) => {
    for (const n of readdirSync(d).sort()) {
      if (n.startsWith('.')) continue;
      const p = path.join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) andar(p);
      else {
        h.update(`${path.relative(pasta, p)}|${s.size}|`);
        if (conteudo && s.size < 8e6) h.update(readFileSync(p));
        else h.update(String(Math.floor(s.mtimeMs)));
      }
    }
  };
  andar(pasta);
  return h.digest('hex').slice(0, 16);
}

export function hashMotor() {
  const h = createHash('sha1');
  for (const n of readdirSync(PASTA_MOTOR).sort()) {
    if (/\.(js|css|json)$/.test(n)) h.update(readFileSync(path.join(PASTA_MOTOR, n)));
  }
  return h.digest('hex').slice(0, 16);
}

/* ─── transições: modo e tempos ─── */
export function normalizarSaida(saida, cat) {
  if (!saida) return { tipo: 'corte', modo: 'encadeada', antes: 0, depois: 0, opcoes: {}, texto: null };
  if (typeof saida === 'string') saida = { tipo: saida };
  const tipo = saida.tipo || 'corte';
  const base = cat[tipo];
  const modo = saida.modo || (base && base.modo);
  if (!modo) throw new Error(`transição "${tipo}" não está no catálogo: declare "modo" ("sobreposta" ou "encadeada") e "dur" no motion.json`);
  const dur = saida.dur ?? (base && base.dur) ?? 0.4;
  const antes = saida.antes ?? (base && base.antes) ?? 0;
  const depois = saida.depois ?? (base && base.depois) ?? 0;
  const opcoes = Object.assign({}, base ? base.opcoes : {}, saida);
  for (const k of ['tipo', 'modo', 'dur', 'antes', 'depois', 'texto', 'textoEntrada']) delete opcoes[k];
  return { tipo, modo, dur: modo === 'sobreposta' ? dur : 0, antes: modo === 'encadeada' ? antes : 0, depois: modo === 'encadeada' ? depois : 0, opcoes, texto: saida.texto || null, textoEntrada: saida.textoEntrada || null };
}

/** As cenas de uma montagem, em ordem, com a saída que vale naquela montagem. */
export function cenasDaMontagem(json, montagem = 'principal') {
  const porId = Object.fromEntries((json.cenas || []).map((c) => [c.id, c]));
  const ordem = (json.montagens && json.montagens[montagem]) || (montagem === 'principal' ? (json.cenas || []).map((c) => c.id) : null);
  if (!ordem) throw new Error(`montagem "${montagem}" não existe (há: ${Object.keys(json.montagens || { principal: 1 }).join(', ')})`);
  return ordem.map((item) => {
    const id = typeof item === 'string' ? item : item.cena;
    const c = porId[id];
    if (!c) throw new Error(`a montagem "${montagem}" usa a cena "${id}", que não existe`);
    return typeof item === 'string' ? c : Object.assign({}, c, item.saida ? { saida: item.saida } : {});
  });
}

/** Linha do tempo (calculada só aqui, injetada no filme). */
export function linhaDoTempo(projeto, { montagem = 'principal', formato, fps } = {}) {
  const J = projeto.json;
  const cat = projeto.catalogo;
  const lista = cenasDaMontagem(J, montagem);
  fps = fps || J.fps || 60;
  formato = formato || J.formatoBase || '16x9';
  const cenas = [];
  const transicoes = [];
  const cortes = [];
  let inicio = 0;
  lista.forEach((c, i) => {
    const saida = normalizarSaida(c.saida, cat);
    const dur = +c.dur;
    const info = {
      id: c.id,
      titulo: c.titulo || c.id,
      indice: i,
      inicio: Math.round(inicio * 1e6) / 1e6,
      dur,
      fim: Math.round((inicio + dur) * 1e6) / 1e6,
      variante: c.variante || null,
      fundoPuro: !!c.fundoPuro,
      quadros: (c.quadros || []).map((q) => ({ id: q.id, rotulo: q.rotulo || q.id, legenda: q.legenda || '', t: +q.t, ...(q.aprovado ? { aprovado: true } : {}) })),
      tipo: c.tipo || null,
      permitirParado: c.permitirParado || [],
      cortesInternos: (c.cortesInternos || []).map(Number).filter((x) => x > 0 && x < +c.dur),
      saida: { tipo: saida.tipo, modo: saida.modo, dur: saida.dur || saida.antes + saida.depois },
      entrada: null,
      hash: hashDaCena(projeto, c.id, c.variante),
    };
    if (i > 0) {
      const ant = cenas[i - 1];
      info.entrada = { tipo: ant.__saida.tipo, modo: ant.__saida.modo, dur: ant.saida.dur };
    }
    info.__saida = saida;
    cenas.push(info);
    const proxima = lista[i + 1];
    const sob = saida.modo === 'sobreposta' && proxima ? saida.dur : 0;
    inicio = inicio + dur - sob;
  });
  const total = Math.round((cenas[cenas.length - 1].fim) * 1e6) / 1e6;
  cenas.forEach((A, i) => {
    const s = A.__saida;
    const B = cenas[i + 1] || null;
    if (s.tipo === 'corte' && !B) return;
    const X = { de: A.id, para: B ? B.id : null, tipo: s.tipo, modo: s.modo, opcoes: Object.assign({}, s.opcoes, { __dur: s.dur, __antes: s.antes, __depois: s.depois }), texto: s.texto, textoEntrada: s.textoEntrada };
    if (s.modo === 'sobreposta') {
      X.inicio = B ? B.inicio : Math.max(A.inicio, A.fim - s.dur);
      X.fim = A.fim;
      X.corte = null;
      X.dur = X.fim - X.inicio;
    } else {
      X.corte = A.fim;
      X.antes = Math.min(s.antes, A.dur);
      X.depois = B ? Math.min(s.depois, B.dur) : 0;
      X.inicio = X.corte - X.antes;
      X.fim = X.corte + X.depois;
      X.dur = X.antes + X.depois;
      if (B) cortes.push(X.corte);
    }
    transicoes.push(X);
  });
  for (const c of cenas) {
    delete c.__saida;
    // cortes secos dentro da cena (montagem de fotos): o detector de fluidez não acusa, o diretor conta
    for (const ci of c.cortesInternos || []) cortes.push(Math.round((c.inicio + ci) * 1e6) / 1e6);
  }
  cortes.sort((a, b) => a - b);
  return {
    fps,
    bpm: J.bpm || 120,
    total,
    formato,
    montagem,
    titulo: J.titulo || projeto.slug,
    cenas,
    transicoes,
    cortes,
    estilo: J.movimento || {},
  };
}

/** Confere o motion.json e os arquivos. Devolve { erros, avisos } em português de motion. */
export function validarProjeto(projeto) {
  const J = projeto.json;
  const erros = [];
  const avisos = [];
  const cat = projeto.catalogo;
  if (!Array.isArray(J.cenas) || !J.cenas.length) erros.push('o roteiro não tem cenas (motion.json → "cenas")');
  const ids = new Set();
  for (const c of J.cenas || []) {
    const nome = c.id || '(sem id)';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id || '')) erros.push(`cena "${nome}": o id precisa ser minúsculo, sem acento nem espaço (ex.: "abertura", "cena-2")`);
    if (ids.has(c.id)) erros.push(`cena "${nome}" aparece duas vezes`);
    ids.add(c.id);
    if (!(c.dur > 0)) erros.push(`cena "${nome}": duração precisa ser maior que zero`);
    const arq = arquivoDaCena(projeto, c.id, c.variante);
    if (!existsSync(arq.js)) erros.push(`cena "${nome}": falta o arquivo cenas/${path.basename(arq.js)}`);
    const qs = c.quadros || [];
    if (qs.length < 1) avisos.push(`cena "${nome}": sem quadros-chave (o storyboard pede início e fim)`);
    for (const q of qs) {
      if (!(q.t >= 0 && q.t <= c.dur)) erros.push(`cena "${nome}": o quadro "${q.id}" está em ${q.t} s, fora da cena (0 a ${c.dur} s)`);
    }
    for (const b of c.batidas || []) {
      if (!(b.t >= 0 && b.t <= c.dur + 1e-6)) erros.push(`cena "${nome}": a batida em ${b.t} s está fora da cena`);
      if (b.tipo && !TIPOS_BATIDA.includes(b.tipo)) avisos.push(`cena "${nome}": batida de tipo "${b.tipo}" (use ${TIPOS_BATIDA.join(', ')})`);
    }
    try {
      normalizarSaida(c.saida, cat);
    } catch (e) {
      erros.push(`cena "${nome}": ${e.message}`);
    }
  }
  for (const m of Object.keys(J.montagens || {})) {
    try {
      const lista = cenasDaMontagem(J, m);
      lista.forEach((c, i) => {
        const s = normalizarSaida(c.saida, cat);
        const prox = lista[i + 1];
        if (s.modo === 'sobreposta' && prox && s.dur > Math.min(c.dur, prox.dur)) {
          erros.push(`montagem "${m}": a transição de "${c.id}" para "${prox.id}" (${s.dur} s) é mais longa que uma das cenas`);
        }
      });
    } catch (e) {
      erros.push(e.message);
    }
  }
  try {
    const lista = cenasDaMontagem(J, 'principal');
    lista.forEach((c, i) => {
      const s = normalizarSaida(c.saida, cat);
      const prox = lista[i + 1];
      if (s.modo === 'sobreposta' && prox && s.dur > Math.min(c.dur, prox.dur)) {
        erros.push(`a transição de "${c.id}" para "${prox.id}" (${s.dur} s) é mais longa que uma das cenas`);
      }
      if (s.tipo === 'mergulho' && !s.opcoes.alvo) erros.push(`cena "${c.id}": o mergulho precisa de "alvo" (o seletor do elemento onde a câmera mergulha)`);
      if (s.tipo === 'ponte' && !s.opcoes.nome) erros.push(`cena "${c.id}": a ponte precisa de "nome" (o data-ponte que as duas cenas compartilham)`);
    });
  } catch (e) {
    erros.push(e.message);
  }
  avisos.push(...conferirEsqueleto(J));
  if (J.fps && ![24, 25, 30, 50, 60].includes(+J.fps)) avisos.push(`fps ${J.fps}: use 30 ou 60 (24/25 só se o destino pedir)`);
  if (J.formatoBase && !FORMATOS[J.formatoBase]) erros.push(`formatoBase "${J.formatoBase}": use "16x9" ou "9x16"`);
  const tokens = path.join(projeto.pasta, 'marca', 'tokens.css');
  if (!existsSync(tokens)) erros.push('falta marca/tokens.css (as cores e fontes da marca)');
  else {
    const css = readFileSync(tokens, 'utf8');
    const faltam = ['--fundo', '--texto', '--texto-suave', '--destaque', '--fonte-titulo', '--fonte-texto'].filter((t) => !new RegExp(`${t}\\s*:`).test(css));
    if (faltam.length) avisos.push(`marca/tokens.css sem ${faltam.join(', ')}`);
  }
  return { erros, avisos };
}

/** O quadro aprovado de uma cena: o marcado com "aprovado": true, senão o último. */
export function quadroAprovado(c) {
  const qs = c.quadros || [];
  return qs.find((q) => q.aprovado) || qs[qs.length - 1] || null;
}

/** O esqueleto do filme: tipos, papel, curva de intensidade, BPM na tela. Devolve avisos. */
export function conferirEsqueleto(J) {
  const av = [];
  const cenas = J.cenas || [];
  if (!cenas.length) return av;
  const total = cenas.reduce((s, c) => s + (+c.dur || 0), 0);
  const batida = 60 / (J.bpm || 120);
  const semTipo = cenas.filter((c) => !c.tipo).map((c) => c.id);
  if (semTipo.length) av.push(`cena(s) sem "tipo" (${semTipo.join(', ')}): diga que dinâmica cada uma é (${Object.keys(TIPOS_CENA).join(', ')})`);
  for (const c of cenas) {
    if (c.tipo && !TIPOS_CENA[c.tipo]) av.push(`cena "${c.id}": tipo "${c.tipo}" não é da biblioteca (${Object.keys(TIPOS_CENA).join(', ')})`);
    if (c.papel && !PAPEIS.includes(c.papel)) av.push(`cena "${c.id}": papel "${c.papel}" (use ${PAPEIS.join(', ')})`);
    const T = TIPOS_CENA[c.tipo];
    if (T && T.durMax && c.dur > T.durMax + 1e-6) av.push(`cena "${c.id}" (${T.nome}, ${c.dur} s): cena só de frase segura no máximo ${String(T.durMax).replace('.', ',')} s; mais que isso vira slide (divida em duas ou dê uma virada de estado)`);
    if (c.dur >= 3 - 1e-6 && (c.quadros || []).length < 3) av.push(`cena "${c.id}" (${c.dur} s): cena de 3 s ou mais é uma mini-sequência; desenhe um passo do meio com OUTRA composição (3 quadros-chave), não o fim desfocado`);
    // o BPM na tela: um evento a cada 1 ou 2 batidas, a cena inteira
    const ts = [0, ...(c.batidas || []).map((b) => +b.t).filter(Number.isFinite), +c.dur].sort((a, b) => a - b);
    let pior = 0, de = 0;
    for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > pior) [pior, de] = [ts[i] - ts[i - 1], ts[i - 1]];
    if (pior > 2 * batida + 0.06 && (c.batidas || []).length) av.push(`cena "${c.id}": de ${String(Math.round(de * 100) / 100).replace('.', ',')} s a ${String(Math.round((de + pior) * 100) / 100).replace('.', ',')} s nenhuma batida acontece; o BPM precisa aparecer na tela a cada 1 ou 2 batidas (um gesto, uma luz, um objeto)`);
  }
  // no máximo 2 cenas seguidas do mesmo tipo
  for (let i = 2; i < cenas.length; i++) {
    const t = cenas[i].tipo;
    if (t && t === cenas[i - 1].tipo && t === cenas[i - 2].tipo) av.push(`três cenas seguidas do tipo "${t}" (${cenas[i - 2].id}, ${cenas[i - 1].id}, ${cenas[i].id}): o filme vira slide; troque o tipo de uma delas`);
  }
  if (cenas.length >= 3 && cenas.every((c) => c.tipo)) {
    const g = TIPOS_CENA[cenas[0].tipo];
    if (g && !g.forte && cenas[0].tipo !== 'marca-em-etapas') av.push(`o gancho ("${cenas[0].id}", ${g.nome}) é fraco: os 2 primeiros segundos pedem a dinâmica mais forte do filme (palavra-gigante, montagem, aparelho ou foto-objeto)`);
    if (total >= 12 && !cenas.some((c) => c.tipo === 'montagem' || c.papel === 'climax')) av.push(`filme de ${Math.round(total)} s sem clímax de montagem: inclua uma cena "montagem" (pilha → explosão → órbita, grade que acende) ou marque o clímax com "papel": "climax"`);
    const clima = cenas.some((c) => c.clima || ['foto', 'objeto'].includes(TIPOS_CENA[c.tipo]?.familia));
    if (total >= 12 && !clima) av.push('nenhuma mudança de clima (foto, objeto, close, plano claro): o filme inteiro fica no mesmo registro');
  }
  return av;
}

/** Texto do storyboard para a transição (entra/sai), com os números da transição. */
export function descreverTransicao(X, cat, lado = 'sai') {
  if (!X) return null;
  if (lado === 'sai' && X.texto) return X.texto;
  if (lado === 'entra' && X.textoEntrada) return X.textoEntrada;
  const base = cat[X.tipo];
  const modelo = base ? base[lado] : lado === 'sai' ? `Transição "${X.tipo}".` : `Entra pela transição "${X.tipo}".`;
  const num = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');
  const op = X.opcoes || {};
  const dirs = { esquerda: 'a esquerda', direita: 'a direita', cima: 'cima', baixo: 'baixo' };
  const valores = {
    dur: num(X.dur || 0),
    antes: num(X.antes || 0),
    depois: num(X.depois || 0),
    avancoPct: `${Math.round((op.avanco ?? 0.07) * 100)} %`,
    direcaoTexto: dirs[op.direcao || 'esquerda'] || op.direcao,
    alvoTexto: op.alvoTexto || 'no elemento escolhido',
    nome: op.nome || op.ponte || '',
  };
  return modelo.replace(/\{(\w+)\}/g, (m, k) => (valores[k] !== undefined ? valores[k] : m));
}

/* ─── cache de quadros: assinatura por quadro ─── */
export function contextoDeAssinatura(projeto, linha, { escala = 1, qualidade = 'final', navegador = '' } = {}) {
  const P = projeto.pasta;
  const base = sha1(
    [
      hashMotor(),
      navegador,
      linha.formato,
      escala,
      qualidade,
      linha.fps,
      linha.bpm,
      JSON.stringify(linha.estilo || {}),
      hashPasta(path.join(P, 'marca'), { conteudo: true }),
      hashPasta(path.join(P, 'midia')),
      sha1(lerSeExiste(path.join(P, 'cenas', '_comum.css')) + lerSeExiste(path.join(P, 'cenas', '_comum.js')) + lerSeExiste(path.join(P, 'cenas', '_transicoes.js'))),
    ].join('|'),
  );
  // Uma cena só depende das vizinhas se lê as pontes delas (api.anterior/proxima.ponte); nas
  // janelas de transição as duas entram pela própria transição.
  const vizinhos = {};
  const hashPorId = Object.fromEntries(linha.cenas.map((c) => [c.id, c.hash]));
  linha.cenas.forEach((c, i) => {
    const a = linha.cenas[i - 1], b = linha.cenas[i + 1];
    const js = lerSeExiste(arquivoDaCena(projeto, c.id, c.variante).js);
    const lePontes = /\b(anterior|proxima)\s*\.\s*ponte\b/.test(js);
    vizinhos[c.id] = `${lePontes ? `${a ? a.hash : '-'}${b ? b.hash : '-'}` : ''}${JSON.stringify(c.quadros)}${c.fundoPuro}`;
  });
  return { base, vizinhos, hashPorId };
}

export function assinaturaDoQuadro(linha, ctx, t) {
  const EPS = 1e-6;
  const partes = [ctx.base];
  linha.cenas.forEach((c, i) => {
    const ultima = i === linha.cenas.length - 1;
    if (t >= c.inicio - EPS && (t < c.fim - EPS || (ultima && t <= c.fim + EPS))) {
      partes.push(`${c.id}:${c.hash}:${(t - c.inicio).toFixed(6)}:${ctx.vizinhos[c.id]}:${c.inicio.toFixed(6)}`);
    }
  });
  for (const X of linha.transicoes) {
    if (t >= X.inicio - EPS && t <= X.fim + EPS) {
      partes.push(`${X.tipo}:${JSON.stringify(X.opcoes)}:${(t - X.inicio).toFixed(6)}:${X.dur}:${ctx.hashPorId[X.de]}:${X.para ? ctx.hashPorId[X.para] : '-'}`);
    }
  }
  return sha1(partes.join('|')).slice(0, 24);
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
