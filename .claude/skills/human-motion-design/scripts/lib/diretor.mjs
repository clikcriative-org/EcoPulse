/* diretor.mjs — o diretor automático: o que o detector de trancos não pega e o olho de diretor pega.
   O detector de fluidez acha o tranco; o diretor acha o filme fraco: quadro parado aos olhos
   (a câmera viva impede o "parado" literal, mas ninguém sente movimento), energia muito abaixo da
   referência, corte que cai num quadro vazio, borda de camada aparecendo, cenas vizinhas iguais,
   falta de contraste de escala, texto sem contraste sobre foto, corte no eixo que não é no eixo,
   foto ampliada demais.

   Duas partes:
   - analisarQuadros: pixels do filme renderizado (renderizar.mjs, nos quadros exatos);
   - analisarStoryboard: a composição medida no DOM nos quadros-chave (storyboard.mjs).
   Devolvem notas { gravidade: 'alta'|'media'|'baixa', tipo, cena, t, tLocal, frase }. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lerCinza, sondar } from './ffmpeg.mjs';
import { quadroAprovado } from './projeto.mjs';

const v = (x, c = 2) => (Number.isFinite(x) ? String(Math.round(x * 10 ** c) / 10 ** c).replace('.', ',') : '–');
const r2 = (x, c = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** c) / 10 ** c : null);

/* ─── medidas de imagem (cinza, Uint8Array) ─── */
export function difMedia(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
/** Quanto desenho há no quadro: gradiente médio (0–255). Quadro liso ou só fundo dá perto de 0. */
export function detalhe(q, w, h) {
  let s = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      s += Math.abs(q[i] - q[i + 1]) + Math.abs(q[i] - q[i + w]);
    }
  }
  return s / ((w - 1) * (h - 1));
}
/** Correlação normalizada (−1..1) entre duas imagens do mesmo tamanho: 1 = a mesma composição. */
export function correlacao(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    sab += x * y; saa += x * x; sbb += y * y;
  }
  return saa > 1e-6 && sbb > 1e-6 ? sab / Math.sqrt(saa * sbb) : saa < 1e-6 && sbb < 1e-6 ? 1 : 0;
}
/** Reduz uma imagem cinza w×h por um fator inteiro (média). */
export function reduzir(q, w, h, f) {
  const W = Math.floor(w / f), H = Math.floor(h / f);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += q[(y * f + j) * w + x * f + i];
      out[y * W + x] = s / (f * f);
    }
  }
  return { q: out, w: W, h: H };
}

/** Energia de movimento no padrão do diretor: diferença média entre quadros a 1/30 s, em 160×90. */
export function energiaDeQuadros(q30, w, h) {
  const f = Math.max(1, Math.round(w / 160));
  const r = q30.map((q) => reduzir(q, w, h, f).q);
  const d = [];
  for (let i = 1; i < r.length; i++) d.push(difMedia(r[i], r[i - 1]));
  const porSeg = [];
  for (let i = 0; i < d.length; i += 30) {
    const fatia = d.slice(i, i + 30);
    if (fatia.length >= 10) porSeg.push(fatia.reduce((s, x) => s + x, 0) / fatia.length);
  }
  const ord = [...porSeg].sort((a, b) => a - b);
  return {
    media: d.length ? d.reduce((s, x) => s + x, 0) / d.length : 0,
    mediana: ord.length ? ord[Math.floor(ord.length / 2)] : 0,
    quaseParados: d.length ? d.filter((x) => x < 0.15).length / d.length : 0,
    porSegundo: porSeg,
  };
}

/** Energia de um vídeo qualquer (a referência), no mesmo padrão. */
export async function energiaDeVideo(video, { de = null, ate = null } = {}) {
  const s = sondar(video);
  const vertical = s.altura > s.largura;
  const w = vertical ? 90 : 160, h = vertical ? 160 : 90;
  let q = await lerCinza({ video, largura: w, altura: h, fps: 30 });
  if (de != null || ate != null) q = q.slice(Math.round((de || 0) * 30), ate != null ? Math.round(ate * 30) : undefined);
  return { ...energiaDeQuadros(q, w, h), duracao: s.duracao };
}

/* ─── onde cai cada tempo ─── */
function cenaEm(linha, t) {
  let atual = null;
  for (const c of linha.cenas) if (t >= c.inicio - 1e-6 && t < c.fim + 1e-6) atual = c;
  return atual;
}
function nota(linha, gravidade, tipo, t, frase, extra = {}) {
  const c = t != null ? cenaEm(linha, t) : null;
  return { gravidade, tipo, cena: c ? c.id : extra.cena || null, t: t != null ? Math.round(t * 100) / 100 : null, tLocal: c ? Math.round((t - c.inicio) * 100) / 100 : null, frase, ...extra };
}
const emTransicao = (linha, t, folga = 0.05) => linha.transicoes.some((X) => X.dur > 0 && t >= X.inicio - folga && t <= X.fim + folga);
const pertoDeCorte = (linha, t, folga = 0.07) => (linha.cortes || []).some((c) => Math.abs(t - c) <= folga);
const permitido = (linha, t) => {
  const c = cenaEm(linha, t);
  return !!(c && (c.permitirParado || []).some(([a, b]) => t - c.inicio >= a - 1e-6 && t - c.inicio <= b + 1e-6));
};

/* ─── borda reta paralela à borda do quadro (camada sem sobra, véu curto) ─── */
function bordaReta(q, w, h) {
  const achados = [];
  const testar = (n, len, valor, lado) => {
    // n: quantas linhas/colunas da borda para dentro; valor(k, i) = pixel na linha k, posição i
    for (let k = 1; k <= n; k++) {
      let mesmo = 0, soma = 0, sinal = 0;
      const ds = new Float32Array(len);
      for (let i = 0; i < len; i++) { ds[i] = valor(k, i) - valor(k - 1, i); sinal += ds[i]; }
      sinal = Math.sign(sinal) || 1;
      for (let i = 0; i < len; i++) {
        if (ds[i] * sinal >= 4) mesmo++;
        soma += Math.abs(ds[i]);
      }
      if (mesmo / len >= 0.8 && soma / len >= 5) {
        achados.push(lado);
        return;
      }
    }
  };
  const nV = Math.max(2, Math.ceil(h * 0.03)), nH = Math.max(2, Math.ceil(w * 0.03));
  testar(nV, w, (k, i) => q[k * w + i], 'em cima');
  testar(nV, w, (k, i) => q[(h - 1 - k) * w + i], 'embaixo');
  testar(nH, h, (k, i) => q[i * w + k], 'à esquerda');
  testar(nH, h, (k, i) => q[i * w + (w - 1 - k)], 'à direita');
  return achados;
}

/**
 * Pixels do filme. arquivos: os PNG/JPEG do render em ordem (fps), começando em `inicio` s.
 * Devolve { metricas, notas }.
 */
export async function analisarQuadros({ arquivos, fps, largura, altura, linha, J, P, inicio = 0, entrada = 'png' }) {
  const notas = [];
  const trechoInteiro = inicio <= 0.05 && inicio + arquivos.length / fps >= linha.total - 0.1;
  const passo30 = Math.max(1, Math.round(fps / 30));
  const idx30 = [];
  for (let i = 0; i < arquivos.length; i += passo30) idx30.push(i);
  const W = largura > altura ? 480 : 270;
  const H = Math.round((W * altura) / largura / 2) * 2;
  const q30 = await lerCinza({ arquivos: idx30.map((i) => arquivos[i]), largura: W, altura: H, entrada });
  const t30 = (k) => inicio + (idx30[k] || 0) / fps;
  const metricas = {};

  // 1. energia (o padrão do diretor: 1/30 s, 160×90)
  const en = energiaDeQuadros(q30, W, H);
  metricas.energia = { media: r2(en.media), mediana: r2(en.mediana), quaseParados: Math.round(en.quaseParados * 100) };

  // 2. parado aos olhos: o quadro muda menos de 2/255 em 1 s, por 1,2 s ou mais
  const f10 = Math.max(1, Math.round(30 / 10));
  const r10 = [];
  for (let k = 0; k < q30.length; k += f10) r10.push({ k, q: reduzir(q30[k], W, H, Math.max(1, Math.round(W / 160))).q });
  let corrida = null;
  const parados = [];
  for (let j = 10; j < r10.length; j++) {
    const t = t30(r10[j].k);
    const d = difMedia(r10[j].q, r10[j - 10].q);
    const ok = d >= 2.0 || permitido(linha, t);
    if (!ok) corrida = corrida ? [corrida[0], t] : [t - 1, t];
    else if (corrida) { parados.push(corrida); corrida = null; }
  }
  if (corrida) parados.push(corrida);
  const longos = parados.filter(([a, b]) => b - a >= 1.2 - 1e-6);
  metricas.paradoAosOlhos = Math.round(longos.reduce((s, [a, b]) => s + b - a, 0) * 10) / 10;
  for (const [a, b] of longos) {
    notas.push(nota(linha, b - a >= 2 ? 'alta' : 'media', 'parado-aos-olhos', a, `de ${v(a, 1)} a ${v(b, 1)} s o quadro quase não muda (menos de 2/255 em 1 s): a câmera viva sozinha não se sente; ponha um gesto visível a cada batida (deriva de camada, paralaxe, luz que passa, um objeto que respira)`, { ate: Math.round(b * 10) / 10 }));
  }

  // 3. borda reta perto da borda do quadro (fora das transições e dos cortes)
  let bordaAberta = null;
  const bordas = [];
  for (const { k } of r10) {
    const t = t30(k);
    if (emTransicao(linha, t) || pertoDeCorte(linha, t, 0.1)) continue;
    const lados = bordaReta(q30[k], W, H);
    if (lados.length) {
      if (bordaAberta && t - bordaAberta.ate <= 0.25) { bordaAberta.ate = t; lados.forEach((l) => bordaAberta.lados.add(l)); }
      else { bordaAberta = { de: t, ate: t, lados: new Set(lados) }; bordas.push(bordaAberta); }
    }
  }
  // uma borda que passa (um card abrindo, um objeto cruzando) não é defeito: só a que fica (0,25 s ou mais)
  for (const b of bordas.filter((x) => x.ate - x.de >= 0.25 - 1e-6)) {
    notas.push(nota(linha, 'alta', 'borda', b.de, `de ${v(b.de, 1)} a ${v(b.ate, 1)} s aparece uma linha reta ${[...b.lados].join(' e ')}, colada na borda do quadro: alguma camada de plano cheio (foto, véu, degradê) não tem sobra e a câmera viva mostrou a borda dela. Use a classe "plano" (sangra 6 %).`, { ate: b.ate }));
  }

  // 4. corte que cai num quadro quase vazio
  const r4 = (k) => reduzir(q30[k], W, H, 2);
  for (const X of linha.transicoes) {
    if (X.modo !== 'encadeada' || !X.para || X.tipo === 'flash') continue;
    const B = linha.cenas.find((c) => c.id === X.para);
    const qa = quadroAprovado(B);
    if (!qa) continue;
    const kDepois = idx30.findIndex((i) => inicio + i / fps >= X.corte + 1e-6);
    const kRef = idx30.findIndex((i) => inicio + i / fps >= B.inicio + qa.t - 1e-6);
    if (kDepois < 0 || kRef < 0) continue;
    const kAntes = Math.max(0, kDepois - 1);
    const a = r4(kDepois), b = r4(kRef), z = r4(kAntes);
    const da = detalhe(a.q, a.w, a.h), db = detalhe(b.q, b.w, b.h), dz = detalhe(z.q, z.w, z.h);
    // vazio de verdade: bem menos que o quadro aprovado E que o último quadro antes do corte (um objeto
    // que nasce de um ponto de luz em que a anterior terminou não conta: a continuidade está ali)
    if (db > 0.5 && da < 0.3 * db && da < 0.5 * dz) {
      notas.push(nota(linha, 'media', 'corte-vazio', X.corte + 0.001, `o corte para "${B.id}" cai num quadro quase vazio (a frase ainda não entrou): comece a entrada antes do corte (api.inicioEntrada, ou inicio −0,1 a −0,15 s)`));
    }
  }

  // 5. ritmo contra a referência (energia e cortes por segundo)
  const total = linha.total;
  const nCortes = (linha.cortes || []).length + linha.transicoes.filter((X) => X.modo === 'sobreposta' && X.para).length;
  metricas.cortesPorSegundo = r2(nCortes / Math.max(1e-6, total));
  const intencao = J && J.intencaoCalma;
  const refs = ((J && J.referencias) || []).filter((r) => r.arquivo && existsSync(r.arquivo));
  for (const r of refs.slice(0, 1)) {
    try {
      const er = await energiaDeVideo(r.arquivo, r.trecho ? { de: r.trecho[0], ate: r.trecho[1] } : {});
      metricas.referencia = { nome: r.nome, mediana: r2(er.mediana), quaseParados: Math.round(er.quaseParados * 100) };
      const dados = P && existsSync(path.join(P, 'referencias', r.nome || '', 'dados.json')) ? JSON.parse(readFileSync(path.join(P, 'referencias', r.nome, 'dados.json'), 'utf8')) : null;
      if (dados && dados.ficha && dados.ficha.duracao) metricas.referencia.cortesPorSegundo = r2((dados.transicoes || []).length / dados.ficha.duracao);
      // filmagem tem energia que tipografia não alcança: o alvo é a referência, com teto de 2,4
      const alvo = Math.min(er.mediana, 2.4);
      if (!intencao && trechoInteiro && alvo > 0 && en.mediana < 0.5 * alvo) {
        notas.push(nota(linha, 'alta', 'energia', null, `o filme tem pouca energia de movimento para a referência (mediana por segundo ${v(en.mediana)}; a referência ${v(er.mediana)}; o mínimo para este filme é ${v(0.5 * alvo)}): leve a energia, não só o pulso (planos mais curtos, cortes internos, montagem, gestos na batida) ou declare a calma em "intencaoCalma" no motion.json`));
      }
      const cr = metricas.referencia.cortesPorSegundo;
      if (!intencao && trechoInteiro && cr && cr >= 0.8 && metricas.cortesPorSegundo < 0.25 * cr) {
        notas.push(nota(linha, 'media', 'cortes', null, `a referência corta ${v(cr, 1)} vezes por segundo; o filme, ${v(metricas.cortesPorSegundo, 2)}: para uma referência de montagem, use cortes internos (cortesInternos) e planos de 0,75 a 1,5 s com as fotos dela`));
      }
    } catch (e) {
      metricas.referencia = { nome: r.nome, erro: String(e.message || e).split('\n')[0] };
    }
  }
  if (!refs.length && !intencao && trechoInteiro && en.mediana < 0.6) {
    notas.push(nota(linha, 'media', 'energia', null, `energia de movimento baixa para uma primeira versão (mediana ${v(en.mediana)} por quadro; um motion vivo fica acima de 1): mais eventos na batida, montagem, câmera que mergulha`));
  }
  metricas.duracao = r2(total, 1);
  return { metricas, notas };
}

/* ─── storyboard: composição medida no DOM ─── */
const lumRel = (c) => {
  const f = (x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const razao = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Contraste de cada texto contra o fundo por baixo dele (o PNG com os textos escondidos).
 * rgb: Uint8Array RGB do quadro inteiro (largura × altura). Devolve [{ texto, mediana, pior }].
 */
export function contrasteDosTextos(textos, rgb, largura, altura) {
  const out = [];
  for (const tx of textos) {
    const Lt = lumRel(tx.cor);
    const c = tx.caixa;
    const x0 = Math.max(0, Math.floor(c.x)), y0 = Math.max(0, Math.floor(c.y));
    const x1 = Math.min(largura, Math.ceil(c.x + c.l)), y1 = Math.min(altura, Math.ceil(c.y + c.a));
    const rs = [];
    const passo = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
    for (let y = y0; y < y1; y += passo) {
      for (let x = x0; x < x1; x += passo) {
        const i = (y * largura + x) * 3;
        rs.push(razao(Lt, lumRel([rgb[i], rgb[i + 1], rgb[i + 2]])));
      }
    }
    if (!rs.length) continue;
    rs.sort((a, b) => a - b);
    out.push({ texto: tx.texto, cqmin: tx.cqmin, mediana: rs[Math.floor(rs.length / 2)], pior: rs[Math.floor(rs.length * 0.15)] });
  }
  return out;
}

/**
 * Notas do storyboard. cenas: [{ id, tipo, quadros: [{ id, aprovado, png, medida }], contraste, cinza }]
 * (medida = Motion.medirComposicao; cinza = { q, w, h } de cada quadro, 64 px de largura).
 */
export function analisarStoryboard({ cenas, linha, formato, J }) {
  const notas = [];
  const nf = formato === '9x16' ? '9:16' : '16:9';
  const add = (gravidade, tipo, cena, frase) => notas.push({ gravidade, tipo, cena, formato, frase });
  // escala: o maior texto e o maior herói de cada cena (em qualquer quadro-chave)
  let algumGigante = false;
  for (const c of cenas) {
    const ms = c.quadros.map((q) => q.medida).filter(Boolean);
    const maxTexto = Math.max(0, ...ms.flatMap((m) => m.textos.filter((t) => t.o > 0.6).map((t) => t.cqmin)));
    const heroi = Math.max(0, ...ms.map((m) => m.heroi || 0));
    c.maxTexto = maxTexto;
    c.heroi = heroi;
    if (maxTexto >= 28 || heroi >= 0.4) algumGigante = true;
    const fotoPlano = ms.some((m) => (m.fotos || []).length);
    if (maxTexto > 0 && maxTexto < 9.5 && heroi < 0.15 && !fotoPlano) {
      add('media', 'escala', c.id, `"${c.id}": o maior texto tem ${v(maxTexto, 1)} cqmin e nada ocupa a tela: escala de site, não de filme (frase de cartela 11 a 15 cqmin, ou um herói grande)`);
    }
    // fotos ampliadas demais (vão ficar moles)
    const fotos = new Map();
    for (const m of ms) for (const f of m.fotos || []) fotos.set(f.arquivo, Math.max(fotos.get(f.arquivo) || 0, f.escala));
    for (const [arq, e] of fotos) {
      if (e > 1.5) add(e > 2 ? 'alta' : 'media', 'resolucao', c.id, `"${c.id}" no ${nf}: a foto ${arq} aparece ampliada ${v(e, 1)}× (o arquivo é pequeno para esse enquadramento) e vai ficar mole; peça uma maior ou ${formato === '9x16' ? 'a versão vertical' : 'o original'}, ou mostre menos dela`);
    }
    // contraste do texto sobre o fundo (foto, luz)
    for (const k of c.contraste || []) {
      if (k.mediana < 3 || k.pior < 1.8) {
        add(k.mediana < 2.2 ? 'alta' : 'media', 'contraste', c.id, `"${c.id}" no ${nf}: "${k.texto}" tem pouco contraste com o que está por baixo (razão ${v(k.mediana, 1)}, a pior parte ${v(k.pior, 1)}; texto de cartela pede 3 ou mais): mude a frase para o espaço vazio, escureça o véu daquele lado ou mude o enquadramento da foto`);
      }
    }
    // os quadros-chave são estados (composições diferentes), não o fim desfocado
    const cs = c.quadros.filter((q) => q.cinza);
    const dur = (linha.cenas.find((x) => x.id === c.id) || {}).dur || 0;
    if (cs.length >= 2 && dur >= 3 - 1e-6) {
      let maxDif = 0;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) maxDif = Math.max(maxDif, 1 - correlacao(cs[i].cinza.q, cs[j].cinza.q));
      if (maxDif < 0.08) add('media', 'estados', c.id, `"${c.id}": os quadros-chave são o mesmo quadro (só mais ou menos desfocado): uma cena de ${v(dur, 1)} s pede um passo com OUTRA composição (close → aberto, sozinho → coleção, card → plano)`);
    }
    const ap = c.quadros.find((q) => q.aprovado) || c.quadros[c.quadros.length - 1];
    for (const q of cs) {
      if (q === ap || !ap || !ap.cinza) continue;
      const dq = detalhe(q.cinza.q, q.cinza.w, q.cinza.h), da = detalhe(ap.cinza.q, ap.cinza.w, ap.cinza.h);
      if (da > 0.8 && dq < 0.25 * da) add('baixa', 'quadro-vazio', c.id, `"${c.id}": o quadro-chave "${q.rotulo || q.id}" saiu quase vazio; capture um instante em que já há o que ver`);
    }
  }
  if (cenas.length >= 2 && !algumGigante) {
    notas.push({ gravidade: 'alta', tipo: 'escala', cena: null, formato, frase: `nenhum momento de contraste de escala no ${nf}: nenhuma palavra de 28 cqmin ou mais e nenhum herói ocupando 40 % do quadro. Um filme sem escala vira slide: ponha uma palavra gigante, um close no objeto ou a montagem de borda a borda` });
  }
  // cenas vizinhas parecidas demais (o quadro aprovado de uma contra o da outra)
  for (let i = 1; i < cenas.length; i++) {
    const a = cenas[i - 1].quadros.find((q) => q.aprovado) || cenas[i - 1].quadros.slice(-1)[0];
    const b = cenas[i].quadros.find((q) => q.aprovado) || cenas[i].quadros.slice(-1)[0];
    if (!a || !b || !a.cinza || !b.cinza) continue;
    const r = correlacao(a.cinza.q, b.cinza.q);
    if (r > 0.9) add('media', 'vizinhas', cenas[i].id, `"${cenas[i - 1].id}" e "${cenas[i].id}" terminam em quadros quase iguais (mesma composição, mesma luz): mude o lugar, a escala ou a luz de uma delas`);
  }
  // corte no eixo: o herói que sai e o que entra no mesmo lugar e num tamanho parecido
  for (const X of linha.transicoes.filter((x) => x.tipo === 'corte-no-eixo' && x.para)) {
    const A = cenas.find((c) => c.id === X.de), B = cenas.find((c) => c.id === X.para);
    const heroiDe = (c) => {
      const q = c && (c.quadros.find((x) => x.aprovado) || c.quadros.slice(-1)[0]);
      const ts = q && q.medida ? q.medida.textos.filter((t) => t.o > 0.6).sort((a, b) => b.cqmin - a.cqmin) : [];
      return ts[0] ? { ...ts[0], L: q.medida.largura, H: q.medida.altura } : null;
    };
    const ha = heroiDe(A), hb = heroiDe(B);
    if (!ha || !hb) continue;
    const ca = [ha.caixa.x + ha.caixa.l / 2, ha.caixa.y + ha.caixa.a / 2], cb = [hb.caixa.x + hb.caixa.l / 2, hb.caixa.y + hb.caixa.a / 2];
    const desl = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) / ha.L;
    const esc = Math.max(ha.cqmin, hb.cqmin) / Math.max(0.1, Math.min(ha.cqmin, hb.cqmin));
    if (desl > 0.08 || esc > 1.6) {
      add('media', 'eixo', X.para, `o corte no eixo de "${X.de}" para "${X.para}" não é no eixo: o olho pula ${v(desl * 100, 0)} % da largura e a letra muda ${v(esc, 1)}× de tamanho. Ponha a frase nova no mesmo lugar e num tamanho parecido, ou troque a passagem (avançar-desfocar, ponte, mergulho)`);
    }
  }
  return notas;
}

/** Texto das notas para o terminal. */
export function imprimirNotas(notas, titulo = 'Diretor') {
  if (!notas.length) {
    console.log(`${titulo}: nada a apontar.`);
    return;
  }
  const ordem = { alta: 0, media: 1, baixa: 2 };
  console.log(`${titulo}: ${notas.length} ponto(s)`);
  for (const n of [...notas].sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade])) {
    const onde = n.cena ? `${n.cena}${n.tLocal != null ? ` t=${v(n.tLocal)} s` : ''}` : n.formato ? n.formato.replace('x', ':') : 'filme';
    console.log(`  ${n.gravidade === 'alta' ? '✗' : n.gravidade === 'media' ? '!' : '·'} [${n.tipo}] ${onde} · ${n.frase}`);
  }
}
