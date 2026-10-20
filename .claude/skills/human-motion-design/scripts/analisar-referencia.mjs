#!/usr/bin/env node
/**
 * analisar-referencia.mjs — leitura quadro a quadro de um vídeo de referência de motion.
 *
 * Gera numa pasta tudo o que o Claude precisa LER e OLHAR para transformar a referência
 * em decisões de storyboard:
 *
 *   relatorio.md               leitura completa (comece por aqui)
 *   00-linha-do-tempo.png      cor, planos, energia de movimento, foco, luz, câmera e som no tempo
 *   01-planos-N.jpg            storyboard reverso: quadros-chave de cada plano
 *   planos/plano-NN.jpg        folha de contato de cada plano (entrada densa, hold, saída densa)
 *   transicoes/tNN-MM.jpg      tira densa de cada transição que não é corte seco
 *   cortes/cortes-N.jpg        cortes secos, 5 quadros em volta de cada um
 *   zoom/zoom-A-B.jpg          todos os quadros de um trecho pedido com --zoom
 *   paleta.png                 cores dominantes do vídeo e de cada plano
 *   dados.json / quadros.csv   números para consulta
 *
 * Depende só de Node 18+ e de ffmpeg/ffprobe no PATH (sem pacotes npm).
 *
 * Uso:
 *   node analisar-referencia.mjs <video> [opções]
 *     --saida <pasta>        onde gravar (padrão: human-output/motion-design/referencias/<nome>)
 *     --inicio <s>           analisar a partir deste tempo (aceita 12,5 ou 0:12.5)
 *     --fim <s>              analisar até este tempo
 *     --tira-fps <n>         quadros por segundo nas tiras densas (padrão 10)
 *     --zoom <a-b>           folha com todos os quadros entre a e b segundos (pode repetir)
 *     --sensibilidade <n>    >1 acha mais cortes e batidas, <1 acha menos (padrão 1)
 *     --sem-audio            não analisa o som
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ───────────────────────────── utilidades ─────────────────────────────

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, casas = 2) => (Number.isFinite(v) ? v.toFixed(casas).replace('.', ',') : '–');
const fs_ = (t, casas = 2) => (Number.isFinite(t) ? `${fmt(t, casas)} s` : '–');
const fms = (t) => (Number.isFinite(t) ? `${Math.round(t * 1000)} ms` : '–');
const fpct = (v, casas = 0) => `${fmt(v * 100, casas)}%`;
const sinal = (v, casas = 1) => (v > 0 ? '+' : '') + fmt(v, casas);

function percentil(arr, p) {
  const a = Float64Array.from(Array.from(arr).filter(Number.isFinite)).sort();
  if (!a.length) return NaN;
  const k = (a.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.ceil(k);
  return a[f] + (a[c] - a[f]) * (k - f);
}
const mediana = (a) => percentil(a, 0.5);
const media = (a) => {
  let s = 0, n = 0;
  for (const v of a) if (Number.isFinite(v)) { s += v; n++; }
  return n ? s / n : NaN;
};

function slug(s) {
  return (
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'referencia'
  );
}

const hex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();

function lerTempo(v) {
  if (v == null) return NaN;
  const s = String(v).trim().replace(',', '.');
  if (s.includes(':')) return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  return Number(s);
}

function razao(txt) {
  if (!txt) return NaN;
  const [a, b] = String(txt).split('/').map(Number);
  if (!b) return a || NaN;
  return a / b;
}

function erro(msg, codigo = 1) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(codigo);
}

const RAMPA = ' ▁▂▃▄▅▆▇█';
/** Linha de blocos (log) para ler a energia como texto: ▁ quase parado, █ corte/movimento forte. */
function sparkline(vals, largura = 40, piso = 0.02, teto = 30) {
  if (!vals.length) return '';
  const n = Math.min(largura, vals.length);
  let s = '';
  for (let k = 0; k < n; k++) {
    const a = Math.floor((k * vals.length) / n);
    const b = Math.max(a + 1, Math.floor(((k + 1) * vals.length) / n));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, vals[i]);
    if (m < piso) { s += '·'; continue; }
    const x = (Math.log10(m) - Math.log10(piso)) / (Math.log10(teto) - Math.log10(piso));
    s += RAMPA[clamp(Math.floor(x * 8) + 1, 1, 8)];
  }
  return s;
}

// ───────────────────────────── argumentos e ferramentas ─────────────────────────────

function ajuda() {
  console.log(`
Leitura quadro a quadro de um vídeo de referência de motion.

  node analisar-referencia.mjs <video> [opções]

  --saida <pasta>        onde gravar (padrão: human-output/motion-design/referencias/<nome>)
  --inicio <s>           analisar a partir deste tempo (12,5 ou 0:12.5)
  --fim <s>              analisar até este tempo
  --tira-fps <n>         quadros por segundo nas tiras densas (padrão 10)
  --zoom <a-b>           folha com TODOS os quadros entre a e b segundos (pode repetir)
  --sensibilidade <n>    >1 acha mais cortes e batidas, <1 acha menos (padrão 1)
  --sem-audio            não analisa o som
`);
}

function lerArgs(argv) {
  const o = { video: null, saida: null, inicio: 0, fim: null, tiraFps: 10, zoom: [], audio: true, sens: 1, forcar: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) erro(`A opção ${a} precisa de um valor.`);
      return argv[++i];
    };
    if (a === '--saida' || a === '-o') o.saida = val();
    else if (a === '--inicio') o.inicio = lerTempo(val());
    else if (a === '--fim') o.fim = lerTempo(val());
    else if (a === '--tira-fps') o.tiraFps = clamp(lerTempo(val()) || 10, 2, 30);
    else if (a === '--zoom') o.zoom.push(val());
    else if (a === '--sensibilidade') o.sens = clamp(lerTempo(val()) || 1, 0.25, 4);
    else if (a === '--sem-audio') o.audio = false;
    else if (a === '--forcar') o.forcar = true;
    else if (a === '--ajuda' || a === '-h' || a === '--help') { ajuda(); process.exit(0); }
    else if (!a.startsWith('-') && !o.video) o.video = a;
    else erro(`Não entendi a opção "${a}". Rode com --ajuda para ver as opções.`);
  }
  return o;
}

function verificarFerramentas() {
  const faltam = [];
  for (const t of ['ffmpeg', 'ffprobe']) {
    const r = spawnSync(t, ['-version'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) faltam.push(t);
  }
  if (faltam.length) {
    erro(
      `Falta ${faltam.join(' e ')} nesta máquina (é o que abre o vídeo quadro a quadro).\n` +
        '  Mac:     brew install ffmpeg\n' +
        '  Windows: winget install Gyan.FFmpeg   (depois feche e abra o terminal)\n' +
        '  Linux:   sudo apt install ffmpeg',
      2,
    );
  }
  const maior = Number(process.versions.node.split('.')[0]);
  if (maior < 18) erro(`Este script precisa do Node 18 ou mais novo (esta máquina tem ${process.versions.node}).`, 2);
}

// ───────────────────────────── ficha técnica ─────────────────────────────

const PROPORCOES = [
  ['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:5', 4 / 5], ['5:4', 5 / 4], ['4:3', 4 / 3], ['3:4', 3 / 4],
  ['2:3', 2 / 3], ['3:2', 3 / 2], ['21:9', 21 / 9], ['2,39:1', 2.39], ['1,85:1', 1.85], ['2:1', 2], ['1:2', 0.5],
];

function nomeProporcao(w, h) {
  const r = w / h;
  let melhor = null;
  for (const [nome, v] of PROPORCOES) {
    const d = Math.abs(r / v - 1);
    if (d < 0.02 && (!melhor || d < melhor.d)) melhor = { nome, d };
  }
  const orient = r > 1.05 ? 'horizontal' : r < 0.95 ? 'vertical' : 'quadrado';
  return { nome: melhor ? melhor.nome : `${fmt(r, 2)}:1`, orientacao: orient };
}

function lerFicha(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', video], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (r.status !== 0) erro(`Não consegui abrir o vídeo "${video}".\n${(r.stderr || '').trim()}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  if (!v) erro('Esse arquivo não tem imagem de vídeo.');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  let fps = razao(v.avg_frame_rate);
  let fpsTexto = v.avg_frame_rate;
  const fpsR = razao(v.r_frame_rate);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 1000) { fps = fpsR; fpsTexto = v.r_frame_rate; }
  if (!Number.isFinite(fps) || fps <= 0 || fps > 1000) { fps = 30; fpsTexto = '30'; }
  let rot = 0;
  for (const sd of v.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation);
  if (v.tags && v.tags.rotate) rot = Number(v.tags.rotate);
  let w = v.width;
  let h = v.height;
  const sar = razao((v.sample_aspect_ratio || '1:1').replace(':', '/'));
  if (Number.isFinite(sar) && sar > 0 && Math.abs(sar - 1) > 0.01) w = Math.round(w * sar);
  if (Math.abs(rot) % 180 === 90) [w, h] = [h, w];
  let duracao = Number(j.format && j.format.duration) || Number(v.duration) || 0;
  if (!duracao && Number(v.nb_frames)) duracao = Number(v.nb_frames) / fps;
  const codecsImagem = ['png', 'mjpeg', 'jpeg2000', 'webp', 'bmp', 'tiff', 'gif', 'heif', 'avif', 'jpegxl'];
  const formato = (j.format && j.format.format_name) || '';
  if (!duracao) {
    // sem duração no cabeçalho: conta os quadros (rápido, não decodifica)
    const c = spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', video], { encoding: 'utf8' });
    const pk = Number(String(c.stdout).trim().split(/[\s,]/)[0]);
    if (pk > 1) duracao = pk / fps;
    else if (codecsImagem.includes(v.codec_name) || /image2|_pipe/.test(formato)) {
      erro('Isso é uma imagem parada, não um vídeo. Para ler movimento preciso de um vídeo (mp4, mov, webm ou gif animado). Imagens entram como referência de estilo, não aqui.');
    }
  }
  const prop = nomeProporcao(w, h);
  return {
    arquivo: path.resolve(video),
    nome: path.basename(video),
    duracao,
    largura: w,
    altura: h,
    proporcao: prop.nome,
    orientacao: prop.orientacao,
    fps,
    fpsTexto,
    fpsVariavel: Number.isFinite(fpsR) && Math.abs(fpsR - fps) > 0.05,
    quadros: Number(v.nb_frames) || Math.round(duracao * fps),
    codec: v.codec_name,
    cor: [v.pix_fmt, v.color_space, v.color_transfer].filter(Boolean).join(' · '),
    bitrate: Number(j.format && j.format.bit_rate) || null,
    rotacao: rot,
    audio: a ? { codec: a.codec_name, canais: a.channels, taxa: Number(a.sample_rate) } : null,
  };
}

function tamanho(w, h, lado) {
  const e = lado / Math.max(w, h);
  return { W: Math.max(2, Math.round((w * e) / 2) * 2), H: Math.max(2, Math.round((h * e) / 2) * 2) };
}

// ───────────────────────────── decodificação ─────────────────────────────

/** Abre o vídeo com o ffmpeg e entrega cada quadro (RGB ou cinza) já reduzido. O buffer é reaproveitado. */
function decodificar({ video, inicio, dur, fpsTexto, W, H, cinza = false, aoQuadro }) {
  return new Promise((ok, falha) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
    if (inicio > 0) args.push('-ss', String(inicio));
    args.push('-i', video);
    if (dur) args.push('-t', String(dur));
    args.push(
      '-map', '0:v:0', '-an', '-sn', '-dn',
      '-vf', `fps=${fpsTexto},scale=${W}:${H}:flags=area,format=${cinza ? 'gray' : 'rgb24'}`,
      '-f', 'rawvideo', 'pipe:1',
    );
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const tam = W * H * (cinza ? 1 : 3);
    const quadro = Buffer.allocUnsafe(tam);
    let cheio = 0;
    let idx = 0;
    p.stdout.on('data', (chunk) => {
      let off = 0;
      while (off < chunk.length) {
        const n = Math.min(tam - cheio, chunk.length - off);
        chunk.copy(quadro, cheio, off, off + n);
        cheio += n;
        off += n;
        if (cheio === tam) {
          try { aoQuadro(quadro, idx++); } catch (e) { p.kill(); falha(e); return; }
          cheio = 0;
        }
      }
    });
    let errTxt = '';
    p.stderr.on('data', (d) => (errTxt += d));
    p.on('error', falha);
    p.on('close', (code) => (code === 0 || idx > 0 ? ok(idx) : falha(new Error(errTxt || `ffmpeg saiu com ${code}`))));
  });
}

function decodificarSom({ video, inicio, dur, taxa }) {
  return new Promise((ok) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
    if (inicio > 0) args.push('-ss', String(inicio));
    args.push('-i', video);
    if (dur) args.push('-t', String(dur));
    args.push('-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(taxa), '-f', 's16le', 'pipe:1');
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const partes = [];
    p.stdout.on('data', (d) => partes.push(d));
    p.on('error', () => ok(null));
    p.on('close', () => {
      const buf = Buffer.concat(partes);
      if (buf.length < 2048) return ok(null);
      const ab = new ArrayBuffer(buf.length - (buf.length % 2));
      new Uint8Array(ab).set(buf.subarray(0, ab.byteLength));
      ok(new Int16Array(ab));
    });
  });
}

// ───────────────────────────── passo 1: sinais por quadro ─────────────────────────────

const GRADE = 8; // grade de foco/contraste GRADE×GRADE

/** Movimento entre dois quadros por blocos (pirâmide 2×) e ajuste de um modelo de câmera (deslocamento, zoom, giro). */
function fluxo(Aa, Ba, Am, Bm, W, H) {
  const w2 = W >> 1;
  const h2 = H >> 1;
  const B = 8;
  const R = 3;
  const vet = [];
  let total = 0;
  const FB = B * 2;
  const sadF = (fx, fy, dx, dy) => {
    if (fx + dx < 0 || fy + dy < 0 || fx + FB + dx > W || fy + FB + dy > H) return Infinity;
    let s = 0;
    for (let y = 0; y < FB; y++) {
      const ob = (fy + y) * W + fx;
      const oa = (fy + y + dy) * W + fx + dx;
      for (let x = 0; x < FB; x++) s += Math.abs(Ba[ob + x] - Aa[oa + x]);
    }
    return s;
  };
  for (let by = R; by + B + R < h2; by += B) {
    for (let bx = R; bx + B + R < w2; bx += B) {
      total++;
      let gx = 0;
      let gy = 0;
      for (let y = 0; y < B; y++) {
        const o = (by + y) * w2 + bx;
        for (let x = 0; x < B; x++) {
          const p = o + x;
          gx += Math.abs(Bm[p + 1] - Bm[p]);
          gy += Math.abs(Bm[p + w2] - Bm[p]);
        }
      }
      if (gx < B * B * 2.5 || gy < B * B * 2.5) continue; // liso ou só linhas numa direção
      let melhor = Infinity;
      let mdx = 0;
      let mdy = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          let s = 0;
          for (let y = 0; y < B && s < melhor; y++) {
            const ob = (by + y) * w2 + bx;
            const oa = (by + y + dy) * w2 + bx + dx;
            for (let x = 0; x < B; x++) s += Math.abs(Bm[ob + x] - Am[oa + x]);
          }
          if (s < melhor || (s === melhor && dx * dx + dy * dy < mdx * mdx + mdy * mdy)) {
            melhor = s; mdx = dx; mdy = dy;
          }
        }
      }
      const fx = bx * 2;
      const fy = by * 2;
      let bdx = mdx * 2;
      let bdy = mdy * 2;
      let bs = sadF(fx, fy, bdx, bdy);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const s = sadF(fx, fy, mdx * 2 + dx, mdy * 2 + dy);
          if (s < bs) { bs = s; bdx = mdx * 2 + dx; bdy = mdy * 2 + dy; }
        }
      }
      if (!Number.isFinite(bs)) continue;
      const s0 = sadF(fx, fy, 0, 0);
      const q = bs / (FB * FB);
      if (q > 10 && q > 0.6 * (s0 / (FB * FB))) continue; // conteúdo mudou demais: vetor não confiável
      let ox = 0;
      let oy = 0;
      const sx1 = sadF(fx, fy, bdx - 1, bdy);
      const sx2 = sadF(fx, fy, bdx + 1, bdy);
      const sy1 = sadF(fx, fy, bdx, bdy - 1);
      const sy2 = sadF(fx, fy, bdx, bdy + 1);
      if (Number.isFinite(sx1) && Number.isFinite(sx2)) {
        const d = sx1 - 2 * bs + sx2;
        if (d > 0) ox = clamp((0.5 * (sx1 - sx2)) / d, -0.5, 0.5);
      }
      if (Number.isFinite(sy1) && Number.isFinite(sy2)) {
        const d = sy1 - 2 * bs + sy2;
        if (d > 0) oy = clamp((0.5 * (sy1 - sy2)) / d, -0.5, 0.5);
      }
      vet.push({ x: fx + FB / 2, y: fy + FB / 2, vx: -(bdx + ox), vy: -(bdy + oy) });
    }
  }
  const r = { n: vet.length, cob: total ? vet.length / total : 0, tx: NaN, ty: NaN, zoom: NaN, rot: NaN, coer: NaN, mov: NaN };
  if (vet.length < 4) return r;
  const tx = mediana(vet.map((v) => v.vx));
  const ty = mediana(vet.map((v) => v.vy));
  const cx = W / 2;
  const cy = H / 2;
  const zs = [];
  const rs = [];
  for (const v of vet) {
    const rx = v.x - cx;
    const ry = v.y - cy;
    const rr = rx * rx + ry * ry;
    if (rr < (0.12 * W) ** 2) continue;
    const ux = v.vx - tx;
    const uy = v.vy - ty;
    zs.push((ux * rx + uy * ry) / rr);
    rs.push((uy * rx - ux * ry) / rr);
  }
  const zoom = zs.length >= 4 ? mediana(zs) : 0;
  const rot = rs.length >= 4 ? mediana(rs) : 0;
  let inl = 0;
  let mov = 0;
  for (const v of vet) {
    const rx = v.x - cx;
    const ry = v.y - cy;
    const px = tx + zoom * rx - rot * ry;
    const py = ty + zoom * ry + rot * rx;
    if (Math.hypot(v.vx - px, v.vy - py) < 0.75) inl++;
    if (Math.hypot(v.vx, v.vy) > 0.5) mov++;
  }
  return { ...r, tx, ty, zoom, rot, coer: inl / vet.length, mov: mov / vet.length };
}

async function passo1(op, ficha, jan) {
  const { W, H } = tamanho(ficha.largura, ficha.altura, 256);
  const mw = W >> 1;
  const mh = H >> 1;
  const N = W * H;
  const Q = {
    W, H, mw, mh, fps: jan.fps, inicio: jan.inicio, n: 0,
    lum: [], desv: [], E: [], A: [], Hd: [], foco: [], cx: [], cy: [], bx0: [], bx1: [], by0: [], by1: [],
    hist: [], barra: [], mini: [], grade: [], borda: [], bordaDesv: [],
    cam: { tx: [], ty: [], zoom: [], rot: [], coer: [], cob: [], mov: [] },
    amostras: [],
  };
  const passoFluxo = Math.max(1, Math.round(jan.fps / 30));
  Q.passoFluxo = passoFluxo;
  const passoAmostra = Math.max(1, Math.round(jan.fps / 5));
  const bw = Math.max(2, Math.round(Math.min(W, H) * 0.06));
  const ehBorda = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < bw || y < bw || x >= W - bw || y >= H - bw) ehBorda[y * W + x] = 1;
  const celX = new Uint8Array(W).map((_, x) => Math.min(GRADE - 1, Math.floor((x * GRADE) / W)));
  const celY = new Uint8Array(H).map((_, y) => Math.min(GRADE - 1, Math.floor((y * GRADE) / H)));
  let Lant = null;
  let histAnt = null;
  let Lfl = null;
  let Mfl = null;
  const colC = new Uint32Array(W);
  const linC = new Uint32Array(H);
  let ultimoAviso = 0;

  const total = await decodificar({
    video: ficha.arquivo, inicio: jan.inicio, dur: jan.dur, fpsTexto: jan.fpsTexto, W, H,
    aoQuadro: (rgb, i) => {
      const L = new Uint8Array(N);
      const hist = new Float32Array(216);
      const barra = new Uint8Array(H * 3);
      const gr = new Float64Array(GRADE * GRADE * 4);
      let sL = 0;
      let sL2 = 0;
      let br = 0, bg = 0, bb = 0, bl = 0, bl2 = 0, bn = 0;
      for (let y = 0; y < H; y++) {
        let rr = 0, gg = 0, b2 = 0;
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          const q = p * 3;
          const r = rgb[q], g = rgb[q + 1], b = rgb[q + 2];
          const l = (54 * r + 183 * g + 19 * b) >> 8;
          L[p] = l;
          sL += l;
          sL2 += l * l;
          hist[((r * 6) >> 8) * 36 + ((g * 6) >> 8) * 6 + ((b * 6) >> 8)]++;
          rr += r; gg += g; b2 += b;
          if (ehBorda[p]) { br += r; bg += g; bb += b; bl += l; bl2 += l * l; bn++; }
        }
        barra[y * 3] = rr / W; barra[y * 3 + 1] = gg / W; barra[y * 3 + 2] = b2 / W;
      }
      for (let k = 0; k < 216; k++) hist[k] /= N;
      const mean = sL / N;
      const std = Math.sqrt(Math.max(0, sL2 / N - mean * mean));
      // gradiente e grade de foco
      let gsum = 0;
      for (let y = 0; y < H - 1; y++) {
        const cyy = celY[y] * GRADE;
        for (let x = 0; x < W - 1; x++) {
          const p = y * W + x;
          const l = L[p];
          const g = Math.abs(L[p + 1] - l) + Math.abs(L[p + W] - l);
          gsum += g;
          const c = (cyy + celX[x]) * 4;
          gr[c] += l; gr[c + 1] += l * l; gr[c + 2] += g; gr[c + 3]++;
        }
      }
      const foco = gsum / N / (std + 4);
      // miniatura 2×
      const M = new Uint8Array(mw * mh);
      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          const p = 2 * y * W + 2 * x;
          M[y * mw + x] = (L[p] + L[p + 1] + L[p + W] + L[p + W + 1] + 2) >> 2;
        }
      }
      // diferença com o anterior
      let E = 0, A = 0, hd = 0, cxs = 0, cys = 0, ws = 0;
      let bx0 = NaN, bx1 = NaN, by0 = NaN, by1 = NaN;
      if (Lant) {
        colC.fill(0);
        linC.fill(0);
        let nm = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = y * W + x;
            const d = Math.abs(L[p] - Lant[p]);
            E += d;
            if (d > 10) { A++; colC[x]++; linC[y]++; nm++; cxs += x * d; cys += y * d; ws += d; }
          }
        }
        E /= N;
        A /= N;
        for (let k = 0; k < 216; k++) hd += Math.abs(hist[k] - histAnt[k]);
        hd /= 2;
        if (nm > 8) {
          const ext = (cont, n) => {
            let acc = 0, a = 0, b = n - 1;
            for (let k = 0; k < n; k++) { acc += cont[k]; if (acc >= nm * 0.05) { a = k; break; } }
            acc = 0;
            for (let k = n - 1; k >= 0; k--) { acc += cont[k]; if (acc >= nm * 0.05) { b = k; break; } }
            return [a / n, (b + 1) / n];
          };
          [bx0, bx1] = ext(colC, W);
          [by0, by1] = ext(linC, H);
        }
      }
      Q.lum.push(mean);
      Q.desv.push(std);
      Q.E.push(E);
      Q.A.push(A);
      Q.Hd.push(hd);
      Q.foco.push(foco);
      Q.cx.push(ws ? cxs / ws / W : NaN);
      Q.cy.push(ws ? cys / ws / H : NaN);
      Q.bx0.push(bx0); Q.bx1.push(bx1); Q.by0.push(by0); Q.by1.push(by1);
      Q.hist.push(hist);
      Q.barra.push(barra);
      Q.mini.push(M);
      Q.grade.push(gr);
      Q.borda.push([br / bn, bg / bn, bb / bn]);
      Q.bordaDesv.push(Math.sqrt(Math.max(0, bl2 / bn - (bl / bn) ** 2)));
      // câmera
      let f = null;
      if (i % passoFluxo === 0) {
        if (Lfl) f = fluxo(Lfl, L, Mfl, M, W, H);
        Lfl = L;
        Mfl = M;
      }
      Q.cam.tx.push(f ? f.tx : NaN);
      Q.cam.ty.push(f ? f.ty : NaN);
      Q.cam.zoom.push(f ? f.zoom : NaN);
      Q.cam.rot.push(f ? f.rot : NaN);
      Q.cam.coer.push(f ? f.coer : NaN);
      Q.cam.cob.push(f ? f.cob : NaN);
      Q.cam.mov.push(f ? f.mov : NaN);
      // amostras de cor
      if (i % passoAmostra === 0) {
        const px = [];
        for (let y = 1; y < H; y += 4) for (let x = 1; x < W; x += 4) { const q = (y * W + x) * 3; px.push(rgb[q], rgb[q + 1], rgb[q + 2]); }
        Q.amostras.push({ quadro: i, px: Uint8Array.from(px) });
      }
      Lant = L;
      histAnt = hist;
      const t = i / jan.fps;
      if (t - ultimoAviso >= 2 || i === 0) {
        ultimoAviso = t;
        process.stdout.write(`\r  lendo quadros… ${fmt(t, 1)} s de ${fmt(jan.dur, 1)} s   `);
      }
    },
  });
  process.stdout.write('\n');
  Q.n = total;
  return Q;
}

// ───────────────────────────── som ─────────────────────────────

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br; im[b] = im[a] - bi;
        re[a] += br; im[a] += bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

async function analisarSom(ficha, jan) {
  const taxa = 11025;
  const s = await decodificarSom({ video: ficha.arquivo, inicio: jan.inicio, dur: jan.dur, taxa });
  if (!s) return null;
  const nfft = 1024;
  const hop = 110;
  const dt = hop / taxa;
  const K = Math.floor((s.length - nfft) / hop) + 1;
  if (K < 50) return null;
  const jan_ = new Float32Array(nfft).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  let ant = null;
  const fluxoE = new Float64Array(K);
  const fluxoB = new Float64Array(K); // graves (bumbo): ajuda a achar onde cai a batida
  const rms = new Float64Array(K);
  const binMax = Math.floor((6000 / taxa) * nfft);
  const binGrave = Math.max(3, Math.floor((180 / taxa) * nfft));
  for (let k = 0; k < K; k++) {
    let e = 0;
    for (let i = 0; i < nfft; i++) { const v = s[k * hop + i] / 32768; re[i] = v * jan_[i]; im[i] = 0; e += v * v; }
    rms[k] = Math.sqrt(e / nfft);
    fft(re, im);
    const mag = new Float64Array(binMax);
    let fl = 0;
    let flb = 0;
    for (let b = 1; b < binMax; b++) {
      mag[b] = Math.log1p(10 * Math.hypot(re[b], im[b]));
      if (ant) { const dlt = Math.max(0, mag[b] - ant[b]); fl += dlt; if (b < binGrave) flb += dlt; }
    }
    fluxoE[k] = fl;
    fluxoB[k] = flb;
    ant = mag;
  }
  const volume = media(rms);
  if (volume < 0.002) return { mudo: true, volume };
  const silencio = rms.filter((v) => v < 0.003).length / K;
  // força de ataque: fluxo acima da média local
  const wm = Math.round(0.25 / dt);
  const ataque = (fl) => {
    const out = new Float64Array(K);
    let acc = 0;
    const pref = new Float64Array(K + 1);
    for (let k = 0; k < K; k++) { acc += fl[k]; pref[k + 1] = acc; }
    for (let k = 0; k < K; k++) {
      const a = Math.max(0, k - wm), b = Math.min(K, k + wm + 1);
      out[k] = Math.max(0, fl[k] - (pref[b] - pref[a]) / (b - a));
    }
    return out;
  };
  const o = ataque(fluxoE);
  const oB = ataque(fluxoB);
  const om = media(o);
  const osd = Math.sqrt(media(Array.from(o, (v) => (v - om) ** 2)));
  // andamento: autocorrelação (sem a média) com preferência suave por ~120 BPM
  const oc = Float64Array.from(o, (v) => v - om);
  const Lmin = Math.round(0.3 / dt);
  const Lmax = Math.min(Math.round(1.5 / dt), K - 2);
  let r0 = 0;
  for (let k = 0; k < K; k++) r0 += oc[k] * oc[k];
  r0 /= K;
  const ac = new Float64Array(Lmax + 2);
  for (let L = Lmin - 1; L <= Lmax + 1; L++) {
    let r = 0;
    for (let k = 0; k + L < K; k++) r += oc[k] * oc[k + L];
    ac[L] = r / (K - L) / (r0 || 1);
  }
  let melhorL = Lmin;
  let melhorV = -Infinity;
  for (let L = Lmin; L <= Lmax; L++) {
    const w = Math.exp(-0.5 * (Math.log2((L * dt) / 0.5) / 1.0) ** 2);
    const v = ac[L] * w;
    if (v > melhorV) { melhorV = v; melhorL = L; }
  }
  let Lf = melhorL;
  const y0 = ac[melhorL - 1], y1 = ac[melhorL], y2 = ac[melhorL + 1];
  const d = y0 - 2 * y1 + y2;
  if (d < 0) Lf = melhorL + clamp((0.5 * (y0 - y2)) / d, -0.5, 0.5);
  const P = Lf * dt;
  // clareza: a autocorrelação no período (e no dobro dele) se destaca do resto?
  const L2 = Math.min(Lmax, Math.round(2 * Lf));
  const clareza = ac[melhorL];
  const repete = L2 <= Lmax ? ac[L2] : clareza;
  const batidaClara = clareza >= 0.2 && repete >= 0.1 && silencio < 0.3;
  // fase: ataques gerais + graves (o bumbo costuma marcar a batida; chimbal e caixa ficam no contratempo)
  const mo = media(o) || 1;
  const mb = media(oB) || 1;
  const of = Float64Array.from(o, (v, k) => v / mo + (1.5 * oB[k]) / mb);
  const interp = (x) => {
    const i = Math.floor(x);
    if (i < 0 || i + 1 >= K) return 0;
    return of[i] + (of[i + 1] - of[i]) * (x - i);
  };
  let melhorF = 0;
  let melhorS = -Infinity;
  for (let f = 0; f < P; f += dt) {
    let sc = 0;
    for (let t = f; t < K * dt; t += P) sc += interp(t / dt);
    if (sc > melhorS) { melhorS = sc; melhorF = f; }
  }
  const atraso = (0.75 * nfft) / taxa; // o ataque aparece no fluxo quando entra pela borda da janela
  const batidas = [];
  for (let t = melhorF; t < K * dt; t += P) batidas.push(t + atraso);
  // impactos: picos fortes e isolados (máximo local estrito em ±60 ms)
  const picos = [];
  const viz = Math.round(0.06 / dt);
  const fm = media(of);
  const fsd = Math.sqrt(media(Array.from(of, (v) => (v - fm) ** 2)));
  for (let k = 1; k < K - 1; k++) {
    if (of[k] < fm + 2 * fsd) continue;
    let ehPico = true;
    for (let j = Math.max(0, k - viz); j <= Math.min(K - 1, k + viz); j++) {
      if (j === k) continue;
      if (of[j] > of[k] || (of[j] === of[k] && j < k)) { ehPico = false; break; }
    }
    if (ehPico) picos.push({ t: k * dt + atraso, forca: of[k] / (fm + 2 * fsd) });
  }
  picos.sort((a, b) => b.forca - a.forca);
  const impactos = picos.slice(0, 40).sort((a, b) => a.t - b.t);
  return {
    mudo: false,
    volume,
    silencio,
    batidaClara,
    clareza,
    bpm: 60 / P,
    periodo: P,
    batidas,
    impactos,
    envelope: { dt, valores: Array.from(o), atraso },
  };
}

// ───────────────────────────── comparações entre quadros ─────────────────────────────

function medianaU8(a) {
  const h = new Uint32Array(256);
  for (let i = 0; i < a.length; i++) h[a[i]]++;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += h[v]; if (acc >= a.length / 2) return v; }
  return 0;
}

/** Quanto do conteúdo visível trocou de um quadro para o outro (0 = nada, 1 = tudo). */
function trocaDeConteudo(a, b) {
  const ma = medianaU8(a);
  const mb = medianaU8(b);
  let cont = 0;
  let mud = 0;
  for (let p = 0; p < a.length; p++) {
    const ca = Math.abs(a[p] - ma) > 20;
    const cb = Math.abs(b[p] - mb) > 20;
    if (ca || cb) { cont++; if (Math.abs(a[p] - b[p]) > 20) mud++; }
  }
  if (!cont) return Math.abs(ma - mb) > 20 ? 1 : 0;
  return mud / cont;
}

/** Compara a composição antes/depois: quanto do que havia ficou, quanto é novo (com tolerância de ~2% de deslocamento). */
function compararComposicao(a, b, w, h) {
  const ma = medianaU8(a);
  const mb = medianaU8(b);
  const R = 2;
  let ca = 0, cb = 0, fica = 0, novo = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const ea = Math.abs(a[p] - ma) > 24;
      const eb = Math.abs(b[p] - mb) > 24;
      if (ea) {
        ca++;
        let achou = false;
        for (let dy = -R; dy <= R && !achou; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (Math.abs(b[q] - mb) > 24 && Math.abs(b[q] - a[p]) < 22) { achou = true; break; }
          }
        }
        if (achou) fica++;
      }
      if (eb) {
        cb++;
        let achou = false;
        for (let dy = -R; dy <= R && !achou; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (Math.abs(a[q] - ma) > 24 && Math.abs(a[q] - b[p]) < 22) { achou = true; break; }
          }
        }
        if (!achou) novo++;
      }
    }
  }
  const N = w * h;
  return { conteudoAntes: ca / N, conteudoDepois: cb / N, ficou: ca ? fica / ca : 1, novo: cb ? novo / cb : 0 };
}

/** O quadro do meio é uma mistura dos dois lados? (fusão/crossfade) */
function testeFusao(a, m, b) {
  let num = 0, den = 0, base = 0;
  for (let p = 0; p < a.length; p++) {
    const d = a[p] - b[p];
    num += (m[p] - b[p]) * d;
    den += d * d;
    base += Math.abs(d);
  }
  if (!den) return { alfa: 0, erro: 1 };
  const alfa = clamp(num / den, 0, 1);
  let res = 0;
  for (let p = 0; p < a.length; p++) res += Math.abs(m[p] - (alfa * a[p] + (1 - alfa) * b[p]));
  return { alfa, erro: res / (base || 1) };
}

/** Procura escala e deslocamento que levam o quadro A ao quadro B (câmera lenta: push-in, deriva). */
function medirEscala(A, B, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const x0 = Math.round(w * 0.12), x1 = Math.round(w * 0.88), y0 = Math.round(h * 0.12), y1 = Math.round(h * 0.88);
  const amostra = (x, y) => {
    if (x < 0 || y < 0 || x > w - 1.001 || y > h - 1.001) return NaN;
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const p = yi * w + xi;
    return (A[p] * (1 - fx) + A[p + 1] * fx) * (1 - fy) + (A[p + w] * (1 - fx) + A[p + w + 1] * fx) * fy;
  };
  const erroDe = (s, tx, ty) => {
    let soma = 0, n = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const va = amostra(cx + (x - cx - tx) / s, cy + (y - cy - ty) / s);
        if (Number.isNaN(va)) continue;
        soma += Math.abs(B[y * w + x] - va);
        n++;
      }
    }
    return n ? soma / n : Infinity;
  };
  const e0 = erroDe(1, 0, 0);
  let m = { s: 1, tx: 0, ty: 0, e: e0 };
  for (let s = 0.8; s <= 1.2501; s += 0.01) {
    for (let ty = -3; ty <= 3; ty++) for (let tx = -3; tx <= 3; tx++) {
      const e = erroDe(s, tx, ty);
      if (e < m.e) m = { s, tx, ty, e };
    }
  }
  const g = { ...m };
  for (let s = g.s - 0.01; s <= g.s + 0.0101; s += 0.0025) {
    for (let ty = g.ty - 1; ty <= g.ty + 1.001; ty += 0.25) for (let tx = g.tx - 1; tx <= g.tx + 1.001; tx += 0.25) {
      const e = erroDe(s, tx, ty);
      if (e < m.e) m = { s, tx, ty, e };
    }
  }
  return { escala: m.s, dx: m.tx / w, dy: m.ty / h, erro0: e0, erro: m.e, ganho: e0 > 0 ? 1 - m.e / e0 : 0, noLimite: m.s <= 0.8051 || m.s >= 1.2449 };
}

function focoRegiao(gr, cels) {
  let s = 0, s2 = 0, g = 0, n = 0;
  for (const c of cels) { s += gr[c * 4]; s2 += gr[c * 4 + 1]; g += gr[c * 4 + 2]; n += gr[c * 4 + 3]; }
  if (!n) return { foco: NaN, contraste: NaN };
  const m = s / n;
  const sd = Math.sqrt(Math.max(0, s2 / n - m * m));
  return { foco: g / n / (sd + 4), contraste: sd };
}

// ───────────────────────────── segmentação: cortes, passagens, batidas, planos ─────────────────────────────

function nomeRegiao(x0, x1, y0, y1) {
  if (![x0, x1, y0, y1].every(Number.isFinite)) return 'quadro todo';
  if (x1 - x0 > 0.75 && y1 - y0 > 0.75) return 'quadro todo';
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const v = cy < 0.36 ? 'alto' : cy > 0.64 ? 'baixo' : 'meio';
  const h = cx < 0.36 ? 'esquerda' : cx > 0.64 ? 'direita' : 'centro';
  if (v === 'meio' && h === 'centro') return 'centro';
  if (v === 'meio') return `meio, à ${h}`;
  if (h === 'centro') return v === 'alto' ? 'alto, no centro' : 'embaixo, no centro';
  return `${v === 'alto' ? 'alto' : 'embaixo'}, à ${h}`;
}

function rotuloCurva(perfil) {
  const n = perfil.length;
  if (n < 3) return { t50: NaN, tPico: NaN, rotulo: 'instantâneo (1–2 quadros)', codigo: 'instantaneo' };
  const tot = perfil.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  let t50 = 1;
  for (let i = 0; i < n; i++) {
    const antes = acc;
    acc += perfil[i];
    if (acc >= tot / 2) { t50 = (i + (tot / 2 - antes) / (perfil[i] || 1)) / n; break; }
  }
  let ip = 0;
  for (let i = 1; i < n; i++) if (perfil[i] > perfil[ip]) ip = i;
  const tPico = (ip + 0.5) / n;
  const max = perfil[ip] || 1;
  const plano = tot / n / max;
  let rotulo, codigo;
  if (plano > 0.72 && t50 > 0.4 && t50 < 0.6) { rotulo = 'velocidade constante (linear)'; codigo = 'linear'; }
  else if (t50 < 0.27) { rotulo = 'arranca rápido e assenta devagar (ease-out forte, tipo expo/quint)'; codigo = 'out-forte'; }
  else if (t50 < 0.4) { rotulo = 'desacelera no fim (ease-out)'; codigo = 'out'; }
  else if (t50 <= 0.6) { rotulo = 'acelera e desacelera (ease-in-out)'; codigo = 'in-out'; }
  else if (t50 <= 0.73) { rotulo = 'acelera para o fim (ease-in)'; codigo = 'in'; }
  else { rotulo = 'acelera forte até o fim (ease-in expo, típico de saída para corte)'; codigo = 'in-forte'; }
  return { t50, tPico, rotulo, codigo };
}

function analisarEvento(Q, ev, ctx) {
  const { fps } = Q;
  const { e } = ctx;
  const i0 = ev.i0, i1 = ev.i1;
  const perfil = [];
  for (let i = i0; i <= i1; i++) perfil.push(e[i]);
  const curva = rotuloCurva(perfil);
  let ip = i0;
  for (let i = i0; i <= i1; i++) if (e[i] > e[ip]) ip = i;
  // região (onde a mudança acontece)
  const pegar = (arr) => { const v = []; for (let i = i0; i <= i1; i++) if (Number.isFinite(arr[i])) v.push(arr[i]); return v; };
  const x0 = percentil(pegar(Q.bx0), 0.2), x1 = percentil(pegar(Q.bx1), 0.8);
  const y0 = percentil(pegar(Q.by0), 0.2), y1 = percentil(pegar(Q.by1), 0.8);
  const area = media(pegar(Q.A));
  // varredura do centro da mudança (cascata, máscara, wipe)
  let sw = 0, sx = 0, sy = 0, st = 0, stt = 0, stx = 0, sty = 0;
  for (let i = i0; i <= i1; i++) {
    if (!Number.isFinite(Q.cx[i])) continue;
    const w = e[i];
    const t = (i - i0) / fps;
    sw += w; sx += w * Q.cx[i]; sy += w * Q.cy[i]; st += w * t; stt += w * t * t; stx += w * t * Q.cx[i]; sty += w * t * Q.cy[i];
  }
  let varredura = null;
  const durS = (i1 - i0 + 1) / fps;
  if (sw > 0 && i1 - i0 >= 3) {
    const vt = stt / sw - (st / sw) ** 2;
    if (vt > 1e-6) {
      const bx = (stx / sw - (st / sw) * (sx / sw)) / vt;
      const by = (sty / sw - (st / sw) * (sy / sw)) / vt;
      const dx = bx * durS;
      const dy = by * durS;
      if (Math.abs(dx) > 0.15 && Math.abs(dx) > Math.abs(dy)) varredura = dx > 0 ? 'varre da esquerda para a direita' : 'varre da direita para a esquerda';
      else if (Math.abs(dy) > 0.15) varredura = dy > 0 ? 'varre de cima para baixo' : 'varre de baixo para cima';
    }
  }
  // deslocamento do que se move (fluxo)
  let dx = 0, dy = 0, zl = 0, amostrasCam = 0;
  for (let i = i0; i <= i1; i++) {
    if (!Number.isFinite(Q.cam.tx[i]) || Q.cam.cob[i] < 0.04) continue;
    dx += Q.cam.tx[i];
    dy += Q.cam.ty[i];
    zl += Math.log1p(Q.cam.zoom[i]);
    amostrasCam++;
  }
  const mov = { dxPct: (dx / Q.W) * 100, dyPct: (dy / Q.H) * 100, zoomPct: (Math.exp(zl) - 1) * 100, amostras: amostrasCam };
  const partes = [];
  if (amostrasCam >= 2) {
    if (Math.abs(mov.zoomPct) >= 2) partes.push(mov.zoomPct > 0 ? `cresce/aproxima ${fmt(mov.zoomPct, 0)}%` : `encolhe/afasta ${fmt(-mov.zoomPct, 0)}%`);
    if (Math.abs(mov.dyPct) >= 1.5) partes.push(mov.dyPct < 0 ? `sobe ${fmt(-mov.dyPct, 0)}% da altura` : `desce ${fmt(mov.dyPct, 0)}% da altura`);
    if (Math.abs(mov.dxPct) >= 1.5) partes.push(mov.dxPct > 0 ? `desliza ${fmt(mov.dxPct, 0)}% para a direita` : `desliza ${fmt(-mov.dxPct, 0)}% para a esquerda`);
  }
  mov.rotulo = partes.length ? partes.join(', ') : 'sem deslocamento medido (mudança de opacidade, foco, máscara ou rápida demais para medir)';
  // foco e contraste na região
  const cels = [];
  const ex = (a, b) => [clamp(Math.floor((Number.isFinite(a) ? a : 0) * GRADE) - 1, 0, GRADE - 1), clamp(Math.ceil((Number.isFinite(b) ? b : 1) * GRADE), 1, GRADE)];
  const [cx0, cx1] = ex(x0, x1);
  const [cy0, cy1] = ex(y0, y1);
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) cels.push(y * GRADE + x);
  const pre = Math.max(ctx.p0, i0 - 1);
  const pos = Math.min(ctx.p1, i1 + 1);
  const fr = (i) => focoRegiao(Q.grade[i], cels);
  const fPre = fr(pre), fPos = fr(pos);
  const n4 = Math.max(1, Math.round((i1 - i0 + 1) * 0.25));
  const fIni = media(Array.from({ length: n4 }, (_, k) => fr(i0 + k).foco));
  const fFim = media(Array.from({ length: n4 }, (_, k) => fr(i1 - k).foco));
  let fMin = Infinity;
  for (let i = i0; i <= i1; i++) fMin = Math.min(fMin, fr(i).foco);
  let foco;
  const cresce = fPos.contraste > fPre.contraste * 1.3 + 1;
  const some = fPre.contraste > fPos.contraste * 1.3 + 1;
  if (cresce && fPos.foco > fIni * 1.3) foco = 'entra do desfoque para o foco';
  else if (some && fPre.foco > fFim * 1.3) foco = 'sai desfocando';
  else if (fMin < 0.65 * Math.min(fPre.foco, fPos.foco)) foco = 'desfoca no meio do movimento (blur de movimento ou transição com desfoque)';
  else if (cresce) foco = 'aparece sem desfoque (opacidade, máscara ou movimento)';
  else if (some) foco = 'some sem desfoque';
  else foco = 'nitidez estável';
  // composição antes/depois
  const comp = compararComposicao(Q.mini[pre], Q.mini[pos], Q.mw, Q.mh);
  let mudanca;
  if (comp.conteudoAntes < 0.004 && comp.conteudoDepois >= 0.004) mudanca = 'tela vazia ganha conteúdo';
  else if (comp.conteudoDepois < 0.004 && comp.conteudoAntes >= 0.004) mudanca = 'tela esvazia';
  else if (comp.conteudoAntes < 0.004 && comp.conteudoDepois < 0.004) mudanca = 'só luz/cor muda';
  else if (comp.ficou >= 0.5 && comp.novo >= 0.25) mudanca = 'acrescenta elemento';
  else if (comp.ficou < 0.35 && comp.novo >= 0.5) mudanca = 'troca o que está na tela';
  else if (comp.ficou < 0.5 && comp.novo < 0.25) mudanca = 'remove elemento';
  else if (comp.ficou >= 0.5 && comp.novo < 0.25) mudanca = 'move/ajusta o que já estava';
  else mudanca = 'transforma a composição';
  return {
    i0, i1, pico: ip,
    t0: ctx.t(i0), t1: ctx.t(i1), tPico: ctx.t(ip),
    dur: durS,
    energiaPico: e[ip],
    curva,
    regiao: { x0, x1, y0, y1, nome: nomeRegiao(x0, x1, y0, y1) },
    area,
    varredura,
    mov,
    foco: { rotulo: foco, antes: fPre.foco, inicio: fIni, fim: fFim, depois: fPos.foco, min: fMin },
    comp: { ...comp, rotulo: mudanca },
    velocidade: sparkline(perfil, 24),
  };
}

function acharEventos(es, p0, p1, fps, k) {
  const vals = es.slice(p0, p1 + 1);
  const base = percentil(vals, 0.25);
  const hi = Math.max(0.6, 3 * base) / k;
  const lo = Math.max(0.3, 1.8 * base) / k;
  const runs = [];
  let ini = -1;
  let max = 0;
  for (let i = p0; i <= p1 + 1; i++) {
    const v = i <= p1 ? es[i] : -1;
    if (v >= lo) { if (ini < 0) { ini = i; max = 0; } max = Math.max(max, v); }
    else if (ini >= 0) { runs.push({ i0: ini, i1: i - 1, max }); ini = -1; }
  }
  const gap = Math.max(1, Math.round(0.1 * fps));
  const juntos = [];
  for (const r of runs) {
    const u = juntos[juntos.length - 1];
    if (u && r.i0 - u.i1 - 1 <= gap) { u.i1 = r.i1; u.max = Math.max(u.max, r.max); }
    else juntos.push({ ...r });
  }
  return { eventos: juntos.filter((r) => r.max >= hi && r.i1 - r.i0 + 1 >= 2), base, hi, lo };
}

function segmentar(Q, op) {
  const { n, fps } = Q;
  const k = op.sens;
  const t = (i) => Q.inicio + i / fps;
  const e = Q.E.map((v) => (v * fps) / 30); // energia normalizada (equivale a 30 qps)
  const liso = Q.desv.map((d) => d < 4);
  // 1) trechos de tela lisa (preto, branco, cor chapada)
  const corridas = [];
  for (let i = 0; i < n; i++) {
    if (!liso[i]) continue;
    let j = i;
    while (j + 1 < n && liso[j + 1]) j++;
    corridas.push({ a: i, b: j });
    i = j;
  }
  // 2) cortes secos
  const E = Q.E;
  const cortes = [];
  const pops = [];
  for (let i = 1; i < n; i++) {
    if (liso[i] || liso[i - 1]) continue;
    const viz = Math.max(E[i - 1] || 0, E[i + 1] || 0);
    const rE = E[i] / (viz + 0.3);
    const vizH = Math.max(Q.Hd[i - 1] || 0, Q.Hd[i + 1] || 0);
    const rH = Q.Hd[i] / (vizH + 0.02);
    let ok = (E[i] >= 1.5 / k && rE >= 2.5 / k) || (Q.Hd[i] >= 0.2 / k && rH >= 3 / k && rE >= 1.5);
    let largura = 1;
    if (!ok && i + 2 < n && !liso[i + 1]) {
      const m = Math.min(E[i], E[i + 1]);
      const v2 = Math.max(E[i - 1] || 0, E[i + 2] || 0);
      if (m >= 3 / k && m / (v2 + 0.3) >= 3 / k) { ok = true; largura = 2; }
    }
    if (!ok) continue;
    const troca = trocaDeConteudo(Q.mini[i - 1], Q.mini[i + largura - 1]);
    const item = { i, largura, troca, E: E[i] };
    if (troca >= 0.35) cortes.push(item);
    else pops.push(item);
    if (largura === 2) i++;
  }
  const quadroCorte = new Uint8Array(n);
  for (const c of [...cortes, ...pops]) for (let j = 0; j < c.largura; j++) quadroCorte[c.i + j] = 1;
  // energia suavizada, sem os picos de corte
  // o quadro do corte pertence ao plano novo: herda a energia do quadro seguinte (do mesmo plano)
  const eUso = e.slice();
  for (let i = n - 1; i >= 0; i--) if (quadroCorte[i]) eUso[i] = i + 1 < n ? eUso[i + 1] : 0;
  // imagem que surge de uma tela lisa num quadro só (sem fade) também é um corte, não uma batida
  const entraSeco = new Set();
  for (const c of corridas) {
    const j = c.b + 1;
    if (j >= n - 1 || liso[j]) continue;
    if (E[j] >= 1.5 / k && E[j] / ((E[j + 1] || 0) + 0.3) >= 2.5 / k) { eUso[j] = eUso[j + 1]; entraSeco.add(j); quadroCorte[j] = 1; }
  }
  // suavização curta que não atravessa cortes nem telas lisas
  const trecho = new Int32Array(n);
  for (let i = 1; i < n; i++) trecho[i] = trecho[i - 1] + (quadroCorte[i] && !quadroCorte[i - 1] ? 1 : 0) + (liso[i] !== liso[i - 1] ? 1 : 0);
  const w = Math.max(0, Math.round(fps * 0.02));
  const es = eUso.map((_, i) => {
    let s = 0, c = 0;
    for (let j = i - w; j <= i + w; j++) if (j >= 0 && j < n && trecho[j] === trecho[i]) { s += eUso[j]; c++; }
    return s / c;
  });
  // 3) planos brutos
  const fronteiras = []; // {tipo, a, b} quadros que pertencem à transição; o próximo plano começa em b+1
  for (const c of corridas) fronteiras.push({ tipo: 'liso', a: c.a, b: c.b });
  for (const c of cortes) fronteiras.push({ tipo: 'corte', a: c.i, b: c.i + c.largura - 2, corte: c });
  const montarPlanos = (fr) => {
    fr.sort((x, y) => x.a - y.a);
    const planos = [];
    let ini = 0;
    for (const f of fr) {
      const fim = f.a - 1;
      if (fim >= ini) planos.push({ p0: ini, p1: fim });
      ini = Math.max(ini, f.b + 1);
    }
    if (ini <= n - 1) planos.push({ p0: ini, p1: n - 1 });
    return planos;
  };
  let planos = montarPlanos(fronteiras);
  // 4) viradas: batidas que trocam a tela inteira sem corte (transição contínua)
  const viradas = [];
  for (const p of planos) {
    const { eventos } = acharEventos(es, p.p0, p.p1, fps, k);
    for (const ev of eventos) {
      const durEv = (ev.i1 - ev.i0 + 1) / fps;
      if (durEv > 1.5) continue;
      const pre = Math.max(p.p0, ev.i0 - 1);
      const pos = Math.min(p.p1, ev.i1 + 1);
      if (pre === p.p0 && ev.i0 - p.p0 < 2) continue; // entrada logo no início do plano
      if (pos === p.p1 && p.p1 - ev.i1 < 2) continue; // saída que termina no corte
      const comp = compararComposicao(Q.mini[pre], Q.mini[pos], Q.mw, Q.mh);
      if (comp.ficou < 0.3 && comp.novo > 0.5 && comp.conteudoAntes > 0.02 && comp.conteudoDepois > 0.02) {
        let ip = ev.i0;
        for (let i = ev.i0; i <= ev.i1; i++) if (es[i] > es[ip]) ip = i;
        viradas.push({ tipo: 'virada', a: ip, b: ip - 1, janela: [ev.i0, ev.i1], pre, pos, comp });
      }
    }
  }
  planos = montarPlanos([...fronteiras, ...viradas]);
  // planos curtos demais (1–2 quadros entre transições) viram parte da transição
  const minQ = Math.max(2, Math.round(fps * 0.06));
  planos = planos.filter((p) => p.p1 - p.p0 + 1 >= minQ);
  return { e, eUso, es, liso, corridas, cortes, pops, viradas, planos, quadroCorte, entraSeco, t };
}

// ───────────────────────────── leitura de cada plano ─────────────────────────────

const LIMIAR_CONTINUO = 0.8; // energia de quem nunca para: filmagem, câmera na mão, fundo animado

/** Estado de cada quadro: corte, liso, mov (batida), continuo (filmagem), hold (vivo), parado, outro (transição). */
function estados(S, planos, n) {
  const est = new Array(n).fill('outro');
  for (const p of planos) {
    for (let i = p.p0; i <= p.p1; i++) est[i] = S.e[i] < 0.03 ? 'parado' : S.es[i] >= LIMIAR_CONTINUO ? 'continuo' : 'hold';
    for (const ev of p.eventos) for (let i = ev.i0; i <= ev.i1; i++) est[i] = 'mov';
  }
  for (let i = 0; i < n; i++) { if (S.liso[i]) est[i] = 'liso'; if (S.quadroCorte[i]) est[i] = 'corte'; }
  return est;
}

function descreverFluxo(f) {
  if (!f || f.amostras < 3 || !(f.cobertura >= 0.35)) return null;
  const partes = [];
  if (Math.abs(f.zoomPct) >= 1.5) partes.push(f.zoomPct > 0 ? `aproxima ${fmt(f.zoomPct, 0)}% (push-in/zoom)` : `afasta ${fmt(-f.zoomPct, 0)}% (pull-out)`);
  if (Math.abs(f.dxPct) >= 3) partes.push(`a imagem corre ${fmt(Math.abs(f.dxPct), 0)}% da largura para a ${f.dxPct > 0 ? 'direita (câmera vai para a esquerda)' : 'esquerda (câmera vai para a direita)'}`);
  if (Math.abs(f.dyPct) >= 3) partes.push(`a imagem corre ${fmt(Math.abs(f.dyPct), 0)}% da altura para ${f.dyPct > 0 ? 'baixo (câmera sobe)' : 'cima (câmera desce)'}`);
  return partes.length ? partes.join('; ') : 'câmera estável (parada, tripé ou deriva mínima)';
}

function analisarPlanos(Q, S, op) {
  const { fps } = Q;
  const k = op.sens;
  const out = [];
  for (let n = 0; n < S.planos.length; n++) {
    const { p0, p1 } = S.planos[n];
    const ctx = { e: S.eUso, p0, p1, t: S.t }; // sem o pico do quadro de corte
    const { eventos, base, hi, lo } = acharEventos(S.es, p0, p1, fps, k);
    const evs = eventos.map((ev) => analisarEvento(Q, ev, ctx));
    // pops (aparições secas) dentro do plano viram batidas instantâneas
    for (const pop of S.pops) {
      if (pop.i < p0 || pop.i > p1) continue;
      if (evs.some((ev) => pop.i >= ev.i0 - 1 && pop.i <= ev.i1 + 1)) continue;
      const ev = analisarEvento(Q, { i0: pop.i, i1: Math.min(p1, pop.i + pop.largura - 1) }, ctx);
      ev.curva = { t50: NaN, tPico: NaN, rotulo: 'aparece/some seco, num quadro (sem animação)', codigo: 'seco' };
      evs.push(ev);
    }
    evs.sort((a, b) => a.i0 - b.i0);
    const dur = (p1 - p0 + 1) / fps;
    // estados por quadro
    const emEvento = new Uint8Array(p1 - p0 + 1);
    for (const ev of evs) for (let i = ev.i0; i <= ev.i1; i++) emEvento[i - p0] = 1;
    let melhorHold = null;
    for (let i = p0; i <= p1; i++) {
      if (emEvento[i - p0]) continue;
      let j = i;
      while (j + 1 <= p1 && !emEvento[j + 1 - p0]) j++;
      if (!melhorHold || j - i > melhorHold.i1 - melhorHold.i0) melhorHold = { i0: i, i1: j };
      i = j;
    }
    let hold = null;
    if (melhorHold && (melhorHold.i1 - melhorHold.i0 + 1) / fps >= 0.2) {
      const vals = S.eUso.slice(melhorHold.i0, melhorHold.i1 + 1);
      const eMed = mediana(vals);
      hold = {
        ...melhorHold,
        t0: S.t(melhorHold.i0), t1: S.t(melhorHold.i1),
        dur: (melhorHold.i1 - melhorHold.i0 + 1) / fps,
        eMed,
        vida: eMed < 0.03 ? 'congelado (imagem parada)' : eMed < LIMIAR_CONTINUO ? 'vivo (algo continua se mexendo de leve)' : 'em movimento contínuo (filmagem, câmera ou fundo animado)',
      };
    }
    const quadrosMov = emEvento.reduce((a, b) => a + b, 0);
    // entrada / saída
    const primeiro = evs[0];
    const ultimo = evs[evs.length - 1];
    const entrada = primeiro && primeiro.i0 - p0 <= Math.max(0.4 * fps, 0.2 * (p1 - p0)) ? primeiro : null;
    const saida = ultimo && p1 - ultimo.i1 <= 2 && ultimo !== entrada ? ultimo : null;
    const comecaEmMovimento = S.es[p0] >= lo;
    const terminaEmMovimento = S.es[p1] >= lo;
    // câmera lenta (escala entre começo e fim do hold, ou do miolo do plano)
    let cam = null;
    let ia, ib;
    if (hold && hold.dur >= 0.4) { ia = hold.i0 + 1; ib = hold.i1 - 1; }
    else if (dur >= 0.8) { ia = p0 + Math.round((p1 - p0) * 0.2); ib = p0 + Math.round((p1 - p0) * 0.85); }
    if (ia != null && ib > ia) {
      const m = medirEscala(Q.mini[ia], Q.mini[ib], Q.mw, Q.mh);
      const dt = (ib - ia) / fps;
      const partes = [];
      // confiável: comparar com escala explica boa parte da diferença e sobra pouco erro (ou explica muito)
      const confiavel = m.erro0 > 0.4 && m.ganho >= 0.15 && (m.erro <= 6 || m.ganho >= 0.35);
      if (m.erro0 <= 0.4) partes.push('quadro praticamente parado entre o começo e o fim do trecho');
      else if (!confiavel) partes.push('o conteúdo muda demais para medir a câmera por comparação');
      else {
        const pin = m.noLimite ? 'mais de 25' : fmt((m.escala - 1) * 100, 1);
        const pout = m.noLimite ? 'mais de 20' : fmt((1 - m.escala) * 100, 1);
        if (Math.abs(m.escala - 1) >= 0.006) partes.push(m.escala > 1 ? `push-in de ${pin}% em ${fs_(dt, 1)}` : `pull-out de ${pout}% em ${fs_(dt, 1)}`);
        if (Math.abs(m.dx) >= 0.006) partes.push(`deriva ${fmt(Math.abs(m.dx) * 100, 1)}% para a ${m.dx > 0 ? 'direita' : 'esquerda'}`);
        if (Math.abs(m.dy) >= 0.006) partes.push(`deriva ${fmt(Math.abs(m.dy) * 100, 1)}% para ${m.dy > 0 ? 'baixo' : 'cima'}`);
        if (!partes.length) partes.push('sem câmera perceptível (escala e posição estáveis)');
      }
      cam = { ...m, de: S.t(ia), ate: S.t(ib), confiavel, rotulo: partes.join(', ') };
    }
    // câmera rápida (fluxo): mergulhos e passagens
    let zl = 0, dx = 0, dy = 0, amostras = 0, cobs = [];
    for (let i = p0; i <= p1; i++) {
      if (!Number.isFinite(Q.cam.tx[i])) continue;
      cobs.push(Q.cam.cob[i]);
      if (Q.cam.cob[i] < 0.2 || Q.cam.coer[i] < 0.5) continue;
      zl += Math.log1p(Q.cam.zoom[i]); dx += Q.cam.tx[i]; dy += Q.cam.ty[i]; amostras++;
    }
    const fluxoPlano = { zoomPct: (Math.exp(zl) - 1) * 100, dxPct: (dx / Q.W) * 100, dyPct: (dy / Q.H) * 100, amostras, cobertura: mediana(cobs) };
    // fundo
    const bordas = [];
    const bdesv = [];
    for (let i = p0; i <= p1; i++) { bordas.push(Q.borda[i]); bdesv.push(Q.bordaDesv[i]); }
    const corFundo = [0, 1, 2].map((c) => mediana(bordas.map((b) => b[c])));
    const desvFundo = mediana(bdesv);
    const varFundo = Math.sqrt(media(bordas.map((b) => (b[0] - corFundo[0]) ** 2 + (b[1] - corFundo[1]) ** 2 + (b[2] - corFundo[2]) ** 2)));
    const lumF = 0.2126 * corFundo[0] + 0.7152 * corFundo[1] + 0.0722 * corFundo[2];
    let fundo;
    if (desvFundo < 3 && lumF < 6) fundo = 'preto chapado';
    else if (desvFundo < 3 && lumF > 245) fundo = 'branco chapado';
    else if (desvFundo < 3) fundo = 'cor chapada';
    else if (desvFundo < 14) fundo = 'gradiente ou luz suave';
    else fundo = 'imagem, textura ou filmagem';
    if (varFundo > 25) fundo += ', muda ao longo do plano';
    // quadros-chave
    const chaveA = entrada ? Math.min(p1, entrada.i1 + 1) : p0;
    let chaveC;
    if (hold && hold.i0 >= chaveA) chaveC = Math.round((hold.i0 + hold.i1) / 2);
    else if (saida) chaveC = Math.max(p0, saida.i0 - 1);
    else chaveC = p0 + Math.round((p1 - p0) * 0.75);
    let chaveB = null;
    const meio = evs.filter((ev) => ev !== entrada && ev !== saida);
    if (meio.length >= 1 && chaveC - chaveA > fps * 0.8) {
      const ev = meio[Math.floor(meio.length / 2)];
      const cand = Math.min(p1, ev.i1 + 1);
      if (cand > chaveA + 2 && cand < chaveC - 2) chaveB = cand;
    }
    const natureza = fundo.startsWith('imagem') && base >= LIMIAR_CONTINUO * 0.6 ? 'filmagem' : 'grafico';
    out.push({
      n: n + 1, p0, p1, t0: S.t(p0), t1: S.t(p1 + 1), dur, natureza,
      eventos: evs, entrada, saida, hold, comecaEmMovimento, terminaEmMovimento,
      propMovimento: quadrosMov / (p1 - p0 + 1),
      limiares: { base, hi, lo },
      cam, fluxo: fluxoPlano,
      fundo: { cor: hex(corFundo), rgb: corFundo, tipo: fundo, desvio: desvFundo },
      chave: { a: chaveA, b: chaveB, c: chaveC },
      energia: sparkline(S.eUso.slice(p0, p1 + 1), 48),
    });
  }
  return out;
}

// ───────────────────────────── transições ─────────────────────────────

function nomeCor(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.12 || d < 0.06) {
    if (l < 0.04) return 'preto';
    if (l < 0.12) return 'quase preto';
    if (l < 0.3) return 'cinza escuro';
    if (l < 0.62) return 'cinza';
    if (l < 0.9) return 'cinza claro';
    return 'branco';
  }
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  let nome;
  if (h < 15 || h >= 345) nome = 'vermelho';
  else if (h < 40) nome = 'laranja';
  else if (h < 65) nome = 'amarelo';
  else if (h < 160) nome = 'verde';
  else if (h < 195) nome = 'ciano';
  else if (h < 255) nome = 'azul';
  else if (h < 290) nome = 'roxo';
  else if (h < 330) nome = 'magenta';
  else nome = 'rosa';
  if (l < 0.25) nome += ' escuro';
  else if (l > 0.78) nome += s < 0.5 ? ' pastel' : ' claro';
  return nome;
}

function corDoQuadro(Q, i) {
  const b = Q.barra[i];
  let r = 0, g = 0, bb = 0;
  for (let y = 0; y < Q.H; y++) { r += b[y * 3]; g += b[y * 3 + 1]; bb += b[y * 3 + 2]; }
  return [r / Q.H, g / Q.H, bb / Q.H];
}

function descreverTransicoes(Q, S, planos) {
  const { fps } = Q;
  const trs = [];
  const tol = 1.5;
  for (let n = 0; n < planos.length - 1; n++) {
    const A = planos[n];
    const B = planos[n + 1];
    const a = A.p1 + 1; // primeiro quadro que não é do plano A
    const b = B.p0 - 1; // último quadro antes do plano B
    const tr = { de: A.n, para: B.n, a, b, tCorte: S.t(B.p0), dur: Math.max(0, (b - a + 1) / fps) };
    const corrida = S.corridas.find((c) => c.a <= B.p0 && c.b >= A.p1);
    const virada = S.viradas.find((v) => v.a === B.p0);
    const corte = S.cortes.find((c) => c.i + c.largura - 1 === B.p0 || c.i === B.p0);
    if (corrida) {
      const ci = corDoQuadro(Q, corrida.a);
      const cf = corDoQuadro(Q, corrida.b);
      const ni = nomeCor(ci), nf = nomeCor(cf);
      tr.tipo = 'passagem por tela lisa';
      tr.rotulo = ni === nf ? `passagem pelo ${ni} (${hex(ci)})` : `passagem por tela lisa, de ${ni} para ${nf}`;
      tr.liso = { de: S.t(corrida.a), ate: S.t(corrida.b + 1), dur: (corrida.b - corrida.a + 1) / fps, corInicio: hex(ci), corFim: hex(cf) };
      // o plano anterior perde contraste até a tela lisa? (fade) e o próximo ganha?
      let i = corrida.a - 1, nOut = 0;
      while (i - 1 >= A.p0 && Q.desv[i - 1] >= Q.desv[i] * 1.01 && S.e[i] > 0.2 && nOut < fps * 1.5) { i--; nOut++; }
      let j = corrida.b + 1, nIn = 0;
      while (j + 1 <= B.p1 && Q.desv[j + 1] >= Q.desv[j] * 1.01 && S.e[j + 1] > 0.2 && nIn < fps * 1.5) { j++; nIn++; }
      tr.esmaece = { sai: nOut / fps, entra: nIn / fps };
      tr.saiSeco = nOut === 0 && Q.E[corrida.a] >= 1.5;
      tr.entraSeco = S.entraSeco.has(B.p0);
    } else if (virada) {
      tr.tipo = 'transição contínua';
      const [w0, w1] = virada.janela;
      tr.janela = [S.t(w0), S.t(w1 + 1)];
      tr.dur = (w1 - w0 + 1) / fps;
      const m = Math.round((w0 + w1) / 2);
      const fu = testeFusao(Q.mini[virada.pre], Q.mini[m], Q.mini[virada.pos]);
      let zl = 0, dx = 0, dy = 0, focoMin = Infinity;
      for (let i = w0; i <= w1; i++) {
        focoMin = Math.min(focoMin, Q.foco[i]);
        if (!Number.isFinite(Q.cam.tx[i]) || Q.cam.cob[i] < 0.05) continue;
        zl += Math.log1p(Q.cam.zoom[i]); dx += Q.cam.tx[i]; dy += Q.cam.ty[i];
      }
      const zoomPct = (Math.exp(zl) - 1) * 100;
      const focoBorda = Math.min(Q.foco[virada.pre], Q.foco[virada.pos]);
      const partes = [];
      if (fu.erro < 0.3 && fu.alfa > 0.15 && fu.alfa < 0.85) partes.push('fusão (uma imagem dissolve na outra)');
      if (Math.abs(zoomPct) > 10) partes.push(zoomPct > 0 ? `mergulho/zoom-in de ~${fmt(zoomPct, 0)}%` : `afastamento/zoom-out de ~${fmt(-zoomPct, 0)}%`);
      if (Math.abs(dx / Q.W) > 0.25) partes.push(`passagem lateral (${dx > 0 ? 'para a direita' : 'para a esquerda'})`);
      if (Math.abs(dy / Q.H) > 0.25) partes.push(`passagem vertical (${dy > 0 ? 'para baixo' : 'para cima'})`);
      if (focoMin < 0.6 * focoBorda) partes.push('com desfoque no meio');
      if (!partes.length) partes.push('transformação (elementos viram a próxima tela)');
      tr.rotulo = partes.join(', ');
      tr.fusao = fu;
    } else if (corte) {
      tr.tipo = corte.largura === 2 ? 'corte com quadro intermediário' : 'corte seco';
      const fl = corte.largura === 2 ? Q.lum[corte.i] : NaN;
      const vizL = Math.max(Q.lum[corte.i - 1], Q.lum[corte.i + 1] || 0);
      if (corte.largura === 2 && fl > vizL + 25) tr.rotulo = 'corte com flash (um quadro claro no meio)';
      else if (corte.largura === 2) tr.rotulo = 'corte com um quadro de passagem';
      else tr.rotulo = 'corte seco';
      // corta em movimento ou parado?
      const antes = S.es.slice(Math.max(A.p0, A.p1 - Math.round(fps * 0.1)), A.p1 + 1);
      const depois = S.es.slice(B.p0 + corte.largura, Math.min(B.p1, B.p0 + Math.round(fps * 0.1)) + 1);
      const mAntes = media(antes), mDepois = media(depois);
      tr.movimento = { antes: mAntes, depois: mDepois };
      const movA = mAntes >= A.limiares.lo, movB = mDepois >= B.limiares.lo;
      tr.rotulo += movA && movB ? ', no meio do movimento dos dois lados' : movA ? ', cortando a saída em movimento (o próximo entra calmo)' : movB ? ', de um quadro calmo para um plano que já entra se mexendo' : ', de um quadro calmo para outro (sem movimento forte em volta do corte)';
      // mesmo eixo? (centro de massa do conteúdo parecido nos dois lados)
      const massa = (M) => {
        const md = medianaU8(M);
        let sx = 0, sy = 0, s = 0;
        for (let y = 0; y < Q.mh; y++) for (let x = 0; x < Q.mw; x++) { const v = Math.abs(M[y * Q.mw + x] - md); if (v > 24) { sx += x * v; sy += y * v; s += v; } }
        return s ? [sx / s / Q.mw, sy / s / Q.mh, s] : null;
      };
      const ma = massa(Q.mini[A.p1]);
      const mb = massa(Q.mini[B.p0 + corte.largura - 1]);
      if (ma && mb) {
        const dist = Math.hypot(ma[0] - mb[0], ma[1] - mb[1]);
        tr.eixo = dist;
        if (dist < 0.08) tr.rotulo += '; o peso da composição fica no mesmo lugar (corte no mesmo eixo)';
        else if (dist > 0.25) tr.rotulo += '; o peso da composição pula de lugar (o olho é levado)';
      }
    } else {
      tr.tipo = 'outra';
      tr.rotulo = 'troca sem corte nítido';
    }
    trs.push(tr);
  }
  // abertura e fechamento
  const extras = {};
  const c0 = S.corridas.find((c) => c.a === 0);
  if (c0) extras.abre = { cor: hex(corDoQuadro(Q, 0)), nome: nomeCor(corDoQuadro(Q, 0)), dur: (c0.b + 1) / fps };
  const cf = S.corridas.find((c) => c.b === Q.n - 1);
  if (cf && cf !== c0) extras.fecha = { cor: hex(corDoQuadro(Q, cf.a)), nome: nomeCor(corDoQuadro(Q, cf.a)), dur: (cf.b - cf.a + 1) / fps };
  void tol;
  return { trs, extras };
}

// ───────────────────────────── pulso, paleta ─────────────────────────────

function estimarPulso(marcas, dur, fps) {
  if (marcas.length < 6) return null;
  const sig = Math.max(1.5 / fps, 0.025);
  const tol = Math.max(1 / fps + 0.008, 0.035);
  let melhor = null;
  const avaliar = (P) => {
    let best = null;
    for (let f = 0; f < 48; f++) {
      const fase = (f / 48) * P;
      let sc = 0, sw = 0, alin = 0;
      for (const m of marcas) {
        let d = ((m.t - fase) % P + P) % P;
        d = Math.min(d, P - d);
        sc += m.w * Math.exp(-0.5 * (d / sig) ** 2);
        sw += m.w;
        if (d <= tol) alin++;
      }
      const v = sc / sw;
      if (!best || v > best.v) best = { P, fase, v, alin: alin / marcas.length };
    }
    best.acaso = Math.min(1, (sig * Math.sqrt(2 * Math.PI)) / P);
    best.ganho = best.v - best.acaso;
    best.acasoAlin = Math.min(1, (2 * tol) / P);
    return best;
  };
  for (let P = 0.4; P <= 2.0001; P += 0.005) {
    const r = avaliar(P);
    if (!melhor || r.ganho > melhor.ganho) melhor = r;
  }
  // preferir a leitura entre 80 e 160 BPM quando o dobro/metade explica quase igual
  for (const fator of [2, 0.5]) {
    const P2 = melhor.P * fator;
    if (P2 < 0.4 || P2 > 2.0) continue;
    const bpm2 = 60 / P2;
    const r = avaliar(P2);
    if (bpm2 >= 80 && bpm2 <= 160 && (60 / melhor.P < 80 || 60 / melhor.P > 160) && r.alin >= melhor.alin * 0.85) melhor = r;
  }
  return { ...melhor, bpm: 60 / melhor.P, n: marcas.length, confiavel: melhor.alin >= 0.55 && melhor.alin >= 2 * melhor.acasoAlin };
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIN = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
function lab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Cores dominantes por k-means em Lab (determinístico). */
function paleta(px, kMax = 8, semente = 7) {
  const n = px.length / 3;
  if (!n) return [];
  const passo = Math.max(1, Math.floor(n / 60000));
  const pts = [];
  for (let i = 0; i < n; i += passo) pts.push(i);
  const L = new Float64Array(pts.length * 3);
  pts.forEach((i, j) => { const [a, b, c] = lab(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]); L[j * 3] = a; L[j * 3 + 1] = b; L[j * 3 + 2] = c; });
  const m = pts.length;
  const k = Math.min(kMax, m);
  const r = rng(semente);
  const cent = [];
  cent.push(Math.floor(r() * m));
  const d2 = new Float64Array(m).fill(Infinity);
  const C = [];
  const pega = (j) => [L[j * 3], L[j * 3 + 1], L[j * 3 + 2]];
  C.push(pega(cent[0]));
  while (C.length < k) {
    let soma = 0;
    const c = C[C.length - 1];
    for (let j = 0; j < m; j++) {
      const d = (L[j * 3] - c[0]) ** 2 + (L[j * 3 + 1] - c[1]) ** 2 + (L[j * 3 + 2] - c[2]) ** 2;
      if (d < d2[j]) d2[j] = d;
      soma += d2[j];
    }
    if (soma === 0) break;
    let alvo = r() * soma;
    let esc = 0;
    for (let j = 0; j < m; j++) { alvo -= d2[j]; if (alvo <= 0) { esc = j; break; } }
    C.push(pega(esc));
  }
  const rot = new Int32Array(m);
  for (let it = 0; it < 14; it++) {
    for (let j = 0; j < m; j++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < C.length; c++) {
        const d = (L[j * 3] - C[c][0]) ** 2 + (L[j * 3 + 1] - C[c][1]) ** 2 + (L[j * 3 + 2] - C[c][2]) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      rot[j] = bi;
    }
    const s = C.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < m; j++) { const q = s[rot[j]]; q[0] += L[j * 3]; q[1] += L[j * 3 + 1]; q[2] += L[j * 3 + 2]; q[3]++; }
    s.forEach((q, c) => { if (q[3]) C[c] = [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; });
  }
  // grupos com cor média em RGB
  let grupos = C.map((c) => ({ lab: c, rgb: [0, 0, 0], n: 0 }));
  for (let j = 0; j < m; j++) {
    const g = grupos[rot[j]];
    const i = pts[j];
    g.rgb[0] += px[i * 3]; g.rgb[1] += px[i * 3 + 1]; g.rgb[2] += px[i * 3 + 2]; g.n++;
  }
  grupos = grupos.filter((g) => g.n).map((g) => ({ ...g, rgb: g.rgb.map((v) => v / g.n) }));
  // junta grupos muito parecidos (ΔE < 10)
  grupos.sort((a, b) => b.n - a.n);
  const final = [];
  for (const g of grupos) {
    const igual = final.find((f) => Math.hypot(f.lab[0] - g.lab[0], f.lab[1] - g.lab[1], f.lab[2] - g.lab[2]) < 10);
    if (igual) {
      const t = igual.n + g.n;
      igual.rgb = igual.rgb.map((v, c) => (v * igual.n + g.rgb[c] * g.n) / t);
      igual.n = t;
    } else final.push({ ...g });
  }
  return final
    .sort((a, b) => b.n - a.n)
    .map((g) => {
      const l = lab(...g.rgb.map((v) => Math.round(v)));
      return { hex: hex(g.rgb), rgb: g.rgb.map(Math.round), parte: g.n / m, L: l[0], croma: Math.hypot(l[1], l[2]), nome: nomeCor(g.rgb) };
    });
}

function luminanciaRel(rgb) {
  const [r, g, b] = rgb.map((v) => LIN[Math.round(clamp(v, 0, 255))]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const la = luminanciaRel(a), lb = luminanciaRel(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

// ───────────────────────────── desenho (sem dependências) ─────────────────────────────

const FONTE = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
  '/': ['.....', '....#', '...#.', '..#..', '.#...', '#....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '·': ['.....', '.....', '.....', '.##..', '.##..', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

function normalizarTexto(s) {
  return String(s)
    .replace(/×/g, 'x')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split('')
    .map((c) => (FONTE[c] ? c : ' '))
    .join('');
}

const CORES = {
  fundo: [14, 16, 19], painel: [22, 25, 30], grade: [40, 44, 52], texto: [201, 206, 214], fraco: [120, 128, 140],
  energia: [233, 237, 242], energiaFill: [70, 78, 90], foco: [242, 184, 75], luz: [154, 163, 174],
  camMais: [99, 214, 155], camMenos: [180, 140, 240], som: [79, 195, 247], corte: [255, 90, 90],
  liso: [34, 44, 78], virada: [255, 159, 67], hold: [62, 142, 106], continuo: [80, 170, 190], parado: [80, 80, 80], chave: [255, 196, 64],
};

class Tela {
  constructor(w, h, fundo = CORES.fundo) {
    this.w = Math.round(w);
    this.h = Math.round(h);
    this.px = Buffer.alloc(this.w * this.h * 3);
    this.ret(0, 0, this.w, this.h, fundo);
  }

  ret(x, y, w, h, c, a = 1) {
    const x0 = clamp(Math.round(x), 0, this.w), y0 = clamp(Math.round(y), 0, this.h);
    const x1 = clamp(Math.round(x + w), 0, this.w), y1 = clamp(Math.round(y + h), 0, this.h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const q = (yy * this.w + xx) * 3;
        if (a >= 1) { this.px[q] = c[0]; this.px[q + 1] = c[1]; this.px[q + 2] = c[2]; }
        else for (let k = 0; k < 3; k++) this.px[q + k] = Math.round(this.px[q + k] + (c[k] - this.px[q + k]) * a);
      }
    }
  }

  linha(x0, y0, x1, y1, c, esp = 1, a = 1) {
    const passos = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= passos; s++) {
      const x = x0 + ((x1 - x0) * s) / passos;
      const y = y0 + ((y1 - y0) * s) / passos;
      this.ret(x - esp / 2, y - esp / 2, esp, esp, c, a);
    }
  }

  moldura(x, y, w, h, c, esp = 3) {
    this.ret(x - esp, y - esp, w + 2 * esp, esp, c);
    this.ret(x - esp, y + h, w + 2 * esp, esp, c);
    this.ret(x - esp, y, esp, h, c);
    this.ret(x + w, y, esp, h, c);
  }

  static largura(s, esc = 2) {
    const t = normalizarTexto(s);
    return t.length ? t.length * 6 * esc - esc : 0;
  }

  texto(x, y, s, c = CORES.texto, esc = 2, larguraMax = Infinity) {
    let t = normalizarTexto(s);
    while (t.length && Tela.largura(t, esc) > larguraMax) t = t.slice(0, -1);
    let cx = Math.round(x);
    for (const ch of t) {
      const g = FONTE[ch];
      for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) if (g[r][col] === '#') this.ret(cx + col * esc, y + r * esc, esc, esc, c);
      cx += 6 * esc;
    }
    return cx - x;
  }

  /** Cola uma imagem RGB reduzindo por média de área (boa para miniaturas). */
  colar(src, sw, sh, x, y, dw = sw, dh = sh) {
    dw = Math.round(dw);
    dh = Math.round(dh);
    const fx = sw / dw;
    const fy = sh / dh;
    for (let yy = 0; yy < dh; yy++) {
      const ty = y + yy;
      if (ty < 0 || ty >= this.h) continue;
      const sy0 = Math.floor(yy * fy);
      const sy1 = Math.max(sy0 + 1, Math.min(sh, Math.floor((yy + 1) * fy)));
      for (let xx = 0; xx < dw; xx++) {
        const tx = x + xx;
        if (tx < 0 || tx >= this.w) continue;
        const sx0 = Math.floor(xx * fx);
        const sx1 = Math.max(sx0 + 1, Math.min(sw, Math.floor((xx + 1) * fx)));
        let r = 0, g = 0, b = 0, n = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          for (let sx = sx0; sx < sx1; sx++) {
            const q = (sy * sw + sx) * 3;
            r += src[q]; g += src[q + 1]; b += src[q + 2]; n++;
          }
        }
        const o = (ty * this.w + tx) * 3;
        this.px[o] = r / n; this.px[o + 1] = g / n; this.px[o + 2] = b / n;
      }
    }
  }

  salvar(arq) {
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    const jpg = /\.jpe?g$/i.test(arq);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${this.w}x${this.h}`, '-i', 'pipe:0', '-frames:v', '1'];
    if (jpg) args.push('-q:v', '3', '-pix_fmt', 'yuvj444p');
    args.push(arq);
    const r = spawnSync('ffmpeg', args, { input: this.px, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`Não consegui gravar ${arq}: ${r.stderr}`);
  }
}

// ───────────────────────────── linha do tempo ─────────────────────────────

function desenharLinhaDoTempo(arq, Q, S, planos, trs, som, pulso, ficha) {
  const W = 1568;
  const ML = 108;
  const MR = 16;
  const PW = W - ML - MR;
  const linhas = [
    ['titulo', 40], ['COR', 56], ['PLANOS', 30], ['ESTADO', 12], ['ENERGIA', 230], ['FOCO', 70], ['LUZ', 56], ['CAMERA', 70],
  ];
  if (som && !som.mudo) linhas.push(['SOM', 70]);
  linhas.push(['eixo', 34]);
  const GAP = 8;
  const Hh = linhas.reduce((a, l) => a + l[1] + GAP, 0) + 8;
  const T = new Tela(W, Hh);
  const n = Q.n;
  const colDe = (x) => Math.floor((x * n) / PW);
  const xDe = (i) => ML + (i * PW) / n;
  const pos = {};
  let y = 8;
  for (const [nome, h] of linhas) { pos[nome] = { y, h }; y += h + GAP; }
  // título
  const titulo = `${ficha.nome}  ·  ${fmt(n / Q.fps, 2)} s  ·  ${ficha.largura}x${ficha.altura}  ·  ${fmt(ficha.fps, ficha.fps % 1 ? 2 : 0)} qps  ·  ${planos.length} planos`;
  T.texto(16, pos.titulo.y + 8, titulo, CORES.texto, 3, W - 32);
  for (const [nome, h] of linhas) {
    if (nome === 'titulo' || nome === 'eixo') continue;
    T.texto(12, pos[nome].y + Math.max(0, h / 2 - 7), nome, CORES.fraco, 2);
    T.ret(ML, pos[nome].y, PW, h, CORES.painel);
  }
  // cor (código de barras de cor: cada coluna é o quadro espremido)
  {
    const { y: y0, h } = pos.COR;
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      for (let yy = 0; yy < h; yy++) {
        const row = Math.floor((yy * Q.H) / h);
        let r = 0, g = 0, bb = 0, c = 0;
        for (let i = a; i < b; i++) { const br = Q.barra[i]; r += br[row * 3]; g += br[row * 3 + 1]; bb += br[row * 3 + 2]; c++; }
        T.ret(ML + x, y0 + yy, 1, 1, [r / c, g / c, bb / c]);
      }
    }
  }
  // planos
  {
    const { y: y0, h } = pos.PLANOS;
    planos.forEach((p, k) => {
      const xa = xDe(p.p0), xb = xDe(p.p1 + 1);
      T.ret(xa, y0, Math.max(1, xb - xa - 1), h, k % 2 ? [58, 64, 74] : [88, 96, 108]);
      const rot = `P${p.n}`;
      if (Tela.largura(rot, 2) + 6 < xb - xa) T.texto(xa + 4, y0 + h / 2 - 7, rot, [235, 238, 242], 2);
      else if (Tela.largura(String(p.n), 1) + 2 < xb - xa) T.texto(xa + 1, y0 + h / 2 - 3, String(p.n), [235, 238, 242], 1);
    });
  }
  // estados
  {
    const { y: y0, h } = pos.ESTADO;
    const estado = estados(S, planos, n);
    const cor = { mov: CORES.energia, hold: CORES.hold, continuo: CORES.continuo, parado: CORES.parado, liso: CORES.liso, corte: CORES.corte, outro: CORES.virada };
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      const cont = {};
      for (let i = a; i < b; i++) cont[estado[i]] = (cont[estado[i]] || 0) + 1;
      let e = Object.keys(cont).sort((u, v) => cont[v] - cont[u])[0];
      if (cont.corte) e = 'corte';
      T.ret(ML + x, y0, 1, h, cor[e]);
    }
  }
  // energia (log)
  {
    const { y: y0, h } = pos.ENERGIA;
    const piso = 0.02;
    const teto = Math.max(20, percentil(S.e, 0.995));
    const yv = (v) => y0 + h - 2 - ((Math.log10(Math.max(v, piso)) - Math.log10(piso)) / (Math.log10(teto) - Math.log10(piso))) * (h - 6);
    for (const g of [0.1, 1, 10]) {
      if (g >= teto) continue;
      const yy = yv(g);
      T.ret(ML, yy, PW, 1, CORES.grade);
      T.texto(ML - 34, yy - 5, fmt(g, g < 1 ? 1 : 0), CORES.fraco, 1);
    }
    // faixas de tela lisa e viradas
    for (const c of S.corridas) T.ret(xDe(c.a), y0, Math.max(1, xDe(c.b + 1) - xDe(c.a)), h, CORES.liso, 0.7);
    for (const v of S.viradas) T.ret(xDe(v.janela[0]), y0, Math.max(1, xDe(v.janela[1] + 1) - xDe(v.janela[0])), h, CORES.virada, 0.25);
    let ant = null;
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      let m = 0;
      for (let i = a; i < b; i++) m = Math.max(m, S.e[i]);
      const yy = yv(m);
      T.ret(ML + x, yy, 1, y0 + h - yy, CORES.energiaFill);
      if (ant != null) T.linha(ML + x - 1, ant, ML + x, yy, CORES.energia, 1.5);
      ant = yy;
    }
    // início das batidas
    for (const p of planos) for (const ev of p.eventos) T.ret(xDe(ev.i0) - 1, y0, 2, 8, CORES.foco);
    T.texto(ML + 6, y0 + 4, 'LOG', CORES.fraco, 1);
  }
  // foco
  {
    const { y: y0, h } = pos.FOCO;
    const ref = percentil(Q.foco, 0.98) || 1;
    let ant = null;
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      const m = media(Q.foco.slice(a, b));
      const yy = y0 + h - 3 - clamp(m / ref, 0, 1) * (h - 6);
      if (ant != null) T.linha(ML + x - 1, ant, ML + x, yy, CORES.foco, 1.5);
      ant = yy;
    }
  }
  // luz
  {
    const { y: y0, h } = pos.LUZ;
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      const m = media(Q.lum.slice(a, b)) / 255;
      const yy = y0 + h - 2 - m * (h - 4);
      T.ret(ML + x, yy, 1, y0 + h - yy, CORES.luz, 0.55);
    }
  }
  // câmera: zoom (barras) e deslocamento (linha)
  {
    const { y: y0, h } = pos.CAMERA;
    const meio = y0 + h / 2;
    T.ret(ML, meio, PW, 1, CORES.grade);
    const zps = Q.cam.zoom.map((z, i) => (Number.isFinite(z) && Q.cam.cob[i] >= 0.05 ? (z * Q.fps * 100) / Q.passoFluxo : NaN));
    const pan = Q.cam.tx.map((tx, i) => (Number.isFinite(tx) && Q.cam.cob[i] >= 0.05 ? (Math.hypot(tx / Q.W, Q.cam.ty[i] / Q.H) * Q.fps * 100) / Q.passoFluxo : NaN));
    const lim = 40;
    let ant = null;
    for (let x = 0; x < PW; x++) {
      const a = colDe(x);
      const b = Math.max(a + 1, colDe(x + 1));
      const z = media(zps.slice(a, b));
      if (Number.isFinite(z) && Math.abs(z) > 0.5) {
        const hh = (clamp(z, -lim, lim) / lim) * (h / 2 - 2);
        if (hh > 0) T.ret(ML + x, meio - hh, 1, hh, CORES.camMais);
        else T.ret(ML + x, meio, 1, -hh, CORES.camMenos);
      }
      const p = media(pan.slice(a, b));
      if (Number.isFinite(p)) {
        const yy = y0 + h - 2 - clamp(p / 100, 0, 1) * (h - 4);
        if (ant != null) T.linha(ML + x - 1, ant, ML + x, yy, CORES.texto, 1, 0.6);
        ant = yy;
      } else ant = null;
    }
    T.texto(ML + 6, y0 + 4, '+ APROXIMA', CORES.camMais, 1);
    T.texto(ML + 6, y0 + h - 11, '- AFASTA', CORES.camMenos, 1);
  }
  // som
  if (pos.SOM) {
    const { y: y0, h } = pos.SOM;
    const env = som.envelope;
    const ref = percentil(env.valores, 0.99) || 1;
    const t0 = Q.inicio;
    for (let x = 0; x < PW; x++) {
      const ta = (x / PW) * (n / Q.fps);
      const tb = ((x + 1) / PW) * (n / Q.fps);
      let m = 0;
      for (let k = Math.floor((ta - env.atraso) / env.dt); k <= Math.ceil((tb - env.atraso) / env.dt); k++) if (k >= 0 && k < env.valores.length) m = Math.max(m, env.valores[k]);
      const hh = clamp(m / ref, 0, 1) * (h - 12);
      T.ret(ML + x, y0 + h - hh, 1, hh, CORES.som, 0.8);
    }
    if (som.batidaClara) for (const b of som.batidas) { const x = ML + (b / (n / Q.fps)) * PW; if (x <= ML + PW) T.ret(x, y0, 1, 8, CORES.texto); }
    for (const im of som.impactos) { const x = ML + (im.t / (n / Q.fps)) * PW; if (x <= ML + PW) T.ret(x - 2, y0 + 10, 4, 4, CORES.foco); }
    void t0;
  }
  // cortes atravessando tudo
  const yTopo = pos.COR.y;
  const yBase = pos.eixo.y;
  for (const tr of trs) {
    const x = xDe(planosInicio(planos, tr.para));
    if (tr.tipo === 'corte seco' || tr.tipo === 'corte com quadro intermediário') T.ret(x - 1, yTopo, 2, yBase - yTopo, CORES.corte, 0.8);
  }
  // pulso visual (grade)
  if (pulso && pulso.confiavel) {
    const { y: y0 } = pos.ENERGIA;
    const dur = n / Q.fps;
    for (let t = pulso.fase; t < dur; t += pulso.P) { const x = ML + (t / dur) * PW; T.ret(x, y0 - 4, 1, 4, CORES.foco); }
  }
  // eixo do tempo
  {
    const { y: y0 } = pos.eixo;
    const dur = n / Q.fps;
    const passos = [0.5, 1, 2, 5, 10, 15, 30, 60];
    const passo = passos.find((p) => (PW / dur) * p >= 60) || 60;
    for (let t = 0; t <= dur + 1e-6; t += passo) {
      const x = ML + (t / dur) * PW;
      T.ret(x, y0, 1, 8, CORES.fraco);
      const rot = `${fmt(Q.inicio + t, passo < 1 ? 1 : 0)}s`;
      T.texto(Math.min(x - Tela.largura(rot, 2) / 2, W - Tela.largura(rot, 2) - 4), y0 + 12, rot, CORES.fraco, 2);
    }
  }
  T.salvar(arq);
}

function planosInicio(planos, numero) {
  const p = planos.find((x) => x.n === numero);
  return p ? p.p0 : 0;
}

// ───────────────────────────── folhas de contato (passo 2) ─────────────────────────────

function layoutGrade(n, aspecto, { larguraMax = 1568, alturaMax = 860, rotulo = 40, gap = 10, colsMin = 2, colsMax = 12 } = {}) {
  for (let c = colsMin; c <= colsMax; c++) {
    const tw = Math.floor((larguraMax - gap * (c + 1)) / c);
    const th = Math.round(tw / aspecto);
    const rows = Math.ceil(n / c);
    if (rows * (th + rotulo + gap) <= alturaMax) return { c, tw, th, rows, rotulo, gap };
  }
  const c = colsMax;
  const tw = Math.floor((larguraMax - gap * (c + 1)) / c);
  return { c, tw, th: Math.round(tw / aspecto), rows: Math.ceil(n / c), rotulo, gap };
}

/** Monta uma folha: células com miniatura + 2 linhas de rótulo, um título e (opcional) uma faixa de energia. */
function folha({ arquivo, titulo, subtitulo, celulas, aspecto, faixa, larguraMax = 1568, alturaMax = 860, colsMin = 2 }) {
  const L = layoutGrade(celulas.length, aspecto, { larguraMax, alturaMax, colsMin });
  const topo = subtitulo ? 66 : 46;
  const alturaFaixa = faixa ? 104 : 0;
  const W = larguraMax;
  const H = topo + L.rows * (L.th + L.rotulo + L.gap) + alturaFaixa + 12;
  const cels = celulas.map((c, k) => {
    const col = k % L.c;
    const row = Math.floor(k / L.c);
    return { ...c, x: L.gap + col * (L.tw + L.gap), y: topo + row * (L.th + L.rotulo + L.gap), w: L.tw, h: L.th };
  });
  return {
    arquivo, W, H, celulas: cels,
    preparar(T) {
      T.texto(L.gap, 12, titulo, CORES.texto, 3, W - 2 * L.gap);
      if (subtitulo) T.texto(L.gap, 44, subtitulo, CORES.fraco, 2, W - 2 * L.gap);
      for (const c of cels) {
        const esc = 2;
        T.texto(c.x, c.y + c.h + 6, c.rotulo1 || '', c.corRotulo || CORES.texto, esc, c.w);
        if (c.rotulo2) T.texto(c.x, c.y + c.h + 6 + 18, c.rotulo2, CORES.fraco, esc, c.w);
      }
      if (faixa) faixa(T, 10, H - alturaFaixa - 4, W - 20, alturaFaixa - 8, cels);
    },
    finalizar(T) {
      for (const c of cels) if (c.moldura) T.moldura(c.x, c.y, c.w, c.h, c.moldura, 3);
    },
  };
}

function faixaEnergia(S, p0, p1, fps, inicio) {
  return (T, x, y, w, h, cels) => {
    T.ret(x, y, w, h, CORES.painel);
    const n = p1 - p0 + 1;
    const piso = 0.02;
    const teto = Math.max(10, percentil(S.eUso.slice(p0, p1 + 1), 0.99));
    const yv = (v) => y + h - 4 - ((Math.log10(Math.max(v, piso)) - Math.log10(piso)) / (Math.log10(teto) - Math.log10(piso))) * (h - 22);
    let ant = null;
    for (let k = 0; k < w; k++) {
      const a = p0 + Math.floor((k * n) / w);
      const b = Math.max(a + 1, p0 + Math.floor(((k + 1) * n) / w));
      let m = 0;
      for (let i = a; i < b && i <= p1; i++) m = Math.max(m, S.eUso[i]);
      const yy = yv(m);
      T.ret(x + k, yy, 1, y + h - yy, CORES.energiaFill);
      if (ant != null) T.linha(x + k - 1, ant, x + k, yy, CORES.energia, 1.5);
      ant = yy;
    }
    const xDe = (i) => x + ((i - p0 + 0.5) / n) * w;
    let ultimoX = -100;
    cels.forEach((c, k) => {
      if (c.quadro < p0 || c.quadro > p1) return;
      const xx = xDe(c.quadro);
      T.ret(xx, y, 1, h, CORES.foco, 0.5);
      const rot = String(k + 1);
      if (xx - ultimoX >= Tela.largura(rot, 1) + 4) { T.texto(xx + 2, y + 2, rot, CORES.foco, 1); ultimoX = xx; }
    });
    T.texto(x + w - Tela.largura('ENERGIA (LOG)', 1) - 4, y + h - 10, 'ENERGIA (LOG)', CORES.fraco, 1);
    void fps; void inicio;
  };
}

function escolherQuadrosPlano(p, S, fps, tiraFps, max = 20) {
  const obrig = new Set([p.p0, p.p1, p.chave.a, p.chave.c]);
  if (p.chave.b != null) obrig.add(p.chave.b);
  for (const ev of p.eventos) { obrig.add(ev.pico); }
  for (const taxa of [tiraFps, tiraFps * 0.8, tiraFps * 0.6, tiraFps * 0.4, tiraFps * 0.25, 1.5, 1]) {
    const s = new Set(obrig);
    const passoD = Math.max(1, Math.round(fps / taxa));
    for (const ev of p.eventos) for (let i = Math.max(p.p0, ev.i0 - 1); i <= Math.min(p.p1, ev.i1 + 1); i += passoD) s.add(i);
    const passoH = Math.max(1, Math.round(fps / Math.min(2, taxa)));
    for (let i = p.p0; i <= p.p1; i += passoH) s.add(i);
    if (s.size <= max) return [...s].sort((a, b) => a - b);
  }
  // ainda muitos: obrigatórios + espaçados
  const lista = [...obrig].sort((a, b) => a - b);
  const resto = max - lista.length;
  for (let k = 1; k <= resto; k++) lista.push(p.p0 + Math.round(((p.p1 - p.p0) * k) / (resto + 1)));
  return [...new Set(lista)].sort((a, b) => a - b).slice(0, max);
}

function rotuloTempo(S, i) { return `${fmt(S.t(i), 2)} s`; }

async function passo2(op, ficha, jan, Q, S, planos, trs, saida) {
  const aspecto = ficha.largura / ficha.altura;
  const folhas = [];
  const arquivos = { planos: [], transicoes: [], cortes: [], visao: [], zoom: [] };
  const fps = Q.fps;
  // 1) storyboard reverso: quadros-chave de cada plano
  {
    const cels = [];
    for (const p of planos) {
      const lista = [['A', p.chave.a]];
      if (p.chave.b != null) lista.push(['B', p.chave.b]);
      lista.push(['C', p.chave.c]);
      for (const [nome, q] of lista) {
        cels.push({
          quadro: q,
          rotulo1: `P${p.n} ${nome} ${rotuloTempo(S, q)}`,
          rotulo2: nome === 'A' ? `PLANO ${fmt(p.dur, 2)} s` : nome === 'C' ? (p.hold ? 'HOLD' : 'PRE-SAIDA') : 'MEIO',
          corRotulo: nome === 'C' ? CORES.chave : CORES.texto,
        });
      }
    }
    const porPagina = aspecto >= 1 ? 24 : 30;
    for (let k = 0, pg = 1; k < cels.length; k += porPagina, pg++) {
      const arq = path.join(saida, `01-planos-${pg}.jpg`);
      arquivos.visao.push(arq);
      folhas.push(folha({
        arquivo: arq,
        titulo: `STORYBOARD REVERSO ${pg}/${Math.ceil(cels.length / porPagina)}`,
        subtitulo: 'A = primeiro estado legivel  B = meio  C = quadro do hold (composicao final)',
        celulas: cels.slice(k, k + porPagina),
        aspecto,
        colsMin: aspecto >= 1 ? 4 : 6,
      }));
    }
  }
  // 2) folha de cada plano
  for (const p of planos) {
    const qs = escolherQuadrosPlano(p, S, fps, op.tiraFps);
    const cels = qs.map((q, k) => {
      let tag = '';
      if (q === p.chave.a) tag = 'A';
      if (q === p.chave.b) tag = 'B';
      if (q === p.chave.c) tag = 'C HOLD';
      const ev = p.eventos.find((e) => q >= e.i0 - 1 && q <= e.i1 + 1);
      if (!tag && ev) tag = q === ev.pico ? 'PICO' : q < ev.i0 ? 'ANTES' : q > ev.i1 ? 'FIM' : 'MOVE';
      if (!tag && p.hold && q >= p.hold.i0 && q <= p.hold.i1) tag = 'HOLD';
      return {
        quadro: q,
        rotulo1: `#${k + 1} ${rotuloTempo(S, q)}`,
        rotulo2: `+${fmt((q - p.p0) / fps, 2)} ${tag}`,
        moldura: q === p.chave.c ? CORES.chave : null,
      };
    });
    const arq = path.join(saida, 'planos', `plano-${String(p.n).padStart(2, '0')}.jpg`);
    arquivos.planos.push(arq);
    folhas.push(folha({
      arquivo: arq,
      titulo: `PLANO ${p.n}  ${fmt(p.t0, 2)}-${fmt(p.t1, 2)} s  (${fmt(p.dur, 2)} s)  ${p.eventos.length} BATIDAS`,
      subtitulo: `+ = tempo no plano  ·  ANTES/MOVE/PICO/FIM = onde o quadro cai na batida  ·  embaixo: energia do plano e a posicao de cada quadro`,
      celulas: cels,
      aspecto,
      faixa: faixaEnergia(S, p.p0, p.p1, fps, Q.inicio),
      colsMin: aspecto >= 1 ? 4 : 6,
    }));
  }
  // 3) transições que não são corte seco: tira densa
  const passoT = Math.max(1, Math.round(fps / op.tiraFps));
  const secos = [];
  for (const tr of trs) {
    if (tr.tipo === 'corte seco') { secos.push(tr); continue; }
    const A = planos.find((p) => p.n === tr.de);
    const B = planos.find((p) => p.n === tr.para);
    let ini, fim, marca;
    if (tr.tipo === 'transição contínua') {
      const v = S.viradas.find((x) => x.a === B.p0);
      ini = v.janela[0] - Math.round(fps * 0.2); fim = v.janela[1] + Math.round(fps * 0.2); marca = B.p0;
    } else {
      ini = tr.a - Math.round(fps * 0.4); fim = tr.b + Math.round(fps * 0.4); marca = B.p0;
    }
    ini = Math.max(A.p0, ini);
    fim = Math.min(B.p1, fim);
    // quadro a quadro só nas bordas (onde o plano sai e onde o seguinte entra); o resto na taxa da tira
    const borda = new Set();
    for (const c of [A.p1, B.p0]) for (let i = c - 2; i <= c + 2; i++) if (i >= ini && i <= fim) borda.add(i);
    const tira = [];
    for (let i = ini; i <= fim; i += passoT) if (!borda.has(i)) tira.push(i);
    let lista = [...borda];
    const vagas = Math.max(0, 20 - lista.length);
    if (tira.length <= vagas) lista.push(...tira);
    else for (let k = 0; k < vagas; k++) lista.push(tira[Math.round((k * (tira.length - 1)) / Math.max(1, vagas - 1))]);
    lista = [...new Set(lista)].sort((a, b) => a - b);
    const cels = lista.map((q) => ({
      quadro: q,
      rotulo1: rotuloTempo(S, q),
      rotulo2: `${q < marca ? '' : '+'}${fmt((q - marca) / fps, 2)}${q >= tr.a && q <= tr.b ? ' TRANS' : q < marca ? ' ANTES' : ' DEPOIS'}`,
      moldura: q === B.p0 ? CORES.corte : q === A.p1 ? CORES.fraco : null,
    }));
    const arq = path.join(saida, 'transicoes', `t${String(tr.de).padStart(2, '0')}-${String(tr.para).padStart(2, '0')}.jpg`);
    tr.imagem = arq;
    arquivos.transicoes.push(arq);
    folhas.push(folha({
      arquivo: arq,
      titulo: `TRANSICAO P${tr.de} > P${tr.para}  ${fmt(tr.tCorte, 2)} s`,
      subtitulo: normalizarTexto(tr.rotulo).slice(0, 120),
      celulas: cels,
      aspecto,
      colsMin: aspecto >= 1 ? 4 : 6,
    }));
  }
  // 4) cortes secos: 5 quadros em volta de cada um, vários cortes por página
  if (secos.length) {
    const porLinha = aspecto >= 1 ? 1 : 2;
    const quad = Math.max(1, Math.round(fps * 0.25));
    const grupos = secos.map((tr) => {
      const A = planos.find((p) => p.n === tr.de);
      const B = planos.find((p) => p.n === tr.para);
      const qs = [Math.max(A.p0, A.p1 - quad), A.p1, B.p0, Math.min(B.p1, B.p0 + 1), Math.min(B.p1, B.p0 + quad)];
      return { tr, qs, B };
    });
    const twTeste = Math.floor((1568 - 10 * (5 * porLinha + 1)) / (5 * porLinha));
    const alturaLinha = Math.round(twTeste / aspecto) + 40 + 10;
    const linhasPorPagina = Math.max(1, Math.floor(860 / alturaLinha));
    const porPagina = linhasPorPagina * porLinha;
    for (let k = 0, pg = 1; k < grupos.length; k += porPagina, pg++) {
      const cels = [];
      for (const g of grupos.slice(k, k + porPagina)) {
        g.qs.forEach((q, j) => cels.push({
          quadro: q,
          rotulo1: j === 2 ? `P${g.tr.de}>P${g.tr.para} ${rotuloTempo(S, q)}` : rotuloTempo(S, q),
          rotulo2: `${q < g.B.p0 ? '' : '+'}${fmt((q - g.B.p0) / fps, 2)}${j === 2 ? ' CORTE' : ''}`,
          moldura: j === 2 ? CORES.corte : null,
          corRotulo: j === 2 ? CORES.corte : CORES.texto,
        }));
        g.tr.imagem = path.join(saida, 'cortes', `cortes-${pg}.jpg`);
      }
      const arq = path.join(saida, 'cortes', `cortes-${pg}.jpg`);
      arquivos.cortes.push(arq);
      const L = { colsMin: 5 * porLinha };
      folhas.push(folha({
        arquivo: arq,
        titulo: `CORTES SECOS ${pg}/${Math.ceil(grupos.length / porPagina)}`,
        subtitulo: `cada linha: -${fmt(quad / fps, 2)} s, ultimo quadro, PRIMEIRO DEPOIS, +1 quadro, +${fmt(quad / fps, 2)} s`,
        celulas: cels,
        aspecto,
        colsMin: L.colsMin,
        alturaMax: 10000,
      }));
    }
  }
  // 5) zoom: todos os quadros de um trecho
  for (const z of op.zoom) {
    const [a, b] = z.split(/[-–]/).map(lerTempo);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) { console.log(`  (ignorei --zoom ${z}: use o formato 4,2-4,8)`); continue; }
    const ia = clamp(Math.round((a - Q.inicio) * fps), 0, Q.n - 1);
    const ib = clamp(Math.round((b - Q.inicio) * fps), 0, Q.n - 1);
    const passo = Math.max(1, Math.ceil((ib - ia + 1) / 30));
    const cels = [];
    for (let i = ia; i <= ib; i += passo) {
      cels.push({ quadro: i, rotulo1: `${fmt(S.t(i), 3)} s`, rotulo2: `Q${i + Math.round(Q.inicio * fps)} +${Math.round(((i - ia) / fps) * 1000)} MS`, moldura: S.quadroCorte[i] ? CORES.corte : null });
    }
    const arq = path.join(saida, 'zoom', `zoom-${fmt(a, 2)}-${fmt(b, 2)}.jpg`.replace(/,/g, '_'));
    arquivos.zoom.push(arq);
    folhas.push(folha({
      arquivo: arq,
      titulo: `QUADRO A QUADRO ${fmt(a, 2)}-${fmt(b, 2)} s`,
      subtitulo: passo > 1 ? `${ib - ia + 1} quadros no trecho: mostrando 1 a cada ${passo} (${Math.round((passo / fps) * 1000)} ms)` : `todos os ${ib - ia + 1} quadros do trecho (${Math.round(1000 / fps)} ms cada)`,
      celulas: cels,
      aspecto,
      colsMin: aspecto >= 1 ? 5 : 8,
      alturaMax: 10000,
    }));
  }
  // decodifica uma vez e preenche as folhas
  const { W: TW, H: TH } = tamanho(ficha.largura, ficha.altura, 512);
  const porQuadro = new Map();
  for (const f of folhas) {
    f.max = -1;
    for (const c of f.celulas) {
      const q = clamp(c.quadro, 0, Q.n - 1);
      c.quadro = q;
      if (!porQuadro.has(q)) porQuadro.set(q, []);
      porQuadro.get(q).push({ f, c });
      f.max = Math.max(f.max, q);
    }
  }
  const fechar = (f) => {
    if (!f.tela) { f.tela = new Tela(f.W, f.H); f.preparar(f.tela); }
    f.finalizar(f.tela);
    f.tela.salvar(f.arquivo);
    f.tela = null;
    f.fechada = true;
  };
  let ultimoAviso = -10;
  await decodificar({
    video: ficha.arquivo, inicio: jan.inicio, dur: jan.dur, fpsTexto: jan.fpsTexto, W: TW, H: TH,
    aoQuadro: (rgb, i) => {
      const t = i / fps;
      if (t - ultimoAviso >= 2) { ultimoAviso = t; process.stdout.write(`\r  montando folhas… ${fmt(t, 1)} s de ${fmt(jan.dur, 1)} s   `); }
      const lista = porQuadro.get(i);
      if (!lista) return;
      for (const { f, c } of lista) {
        if (f.fechada) continue;
        if (!f.tela) { f.tela = new Tela(f.W, f.H); f.preparar(f.tela); }
        f.tela.colar(rgb, TW, TH, c.x, c.y, c.w, c.h);
        if (i >= f.max) fechar(f);
      }
    },
  });
  process.stdout.write('\n');
  for (const f of folhas) if (!f.fechada) fechar(f);
  return arquivos;
}

// ───────────────────────────── paleta (imagem) ─────────────────────────────

function desenharPaleta(arq, global, acentos, porPlano) {
  const W = 1568;
  const sw = Math.min(170, Math.floor((W - 20 - 10 * 7) / 8));
  const linhasPlano = Math.ceil(porPlano.length / 3);
  const blocoAc = acentos.length ? sw + 70 + 40 : 0;
  const H = 52 + sw + 70 + blocoAc + 40 + linhasPlano * 44 + 20;
  const T = new Tela(W, H);
  const faixa = (lista, y) => {
    lista.forEach((c, k) => {
      const x = 10 + k * (sw + 10);
      T.ret(x, y, sw, sw, c.rgb);
      T.moldura(x, y, sw, sw, CORES.grade, 1);
      T.texto(x, y + sw + 8, c.hex, CORES.texto, 2, sw);
      T.texto(x, y + sw + 28, `${fmt(c.parte * 100, c.parte < 0.01 ? 2 : 1)}%`, CORES.fraco, 2, sw);
      T.texto(x, y + sw + 48, c.nome, CORES.fraco, 2, sw);
    });
  };
  T.texto(10, 14, 'PALETA DOMINANTE (PARTE DA TELA NO TEMPO)', CORES.texto, 3);
  faixa(global, 52);
  let y0 = 52 + sw + 74;
  if (acentos.length) {
    T.texto(10, y0, 'ACENTOS: SO AS CORES SATURADAS, MESMO PEQUENAS (DEGRADES, BRILHOS, DESTAQUES)', CORES.texto, 2);
    faixa(acentos, y0 + 30);
    y0 += blocoAc;
  }
  T.texto(10, y0, 'POR PLANO (4 CORES MAIS PRESENTES)', CORES.texto, 2);
  y0 += 30;
  const colW = Math.floor((W - 20) / 3);
  porPlano.forEach((pp, k) => {
    const x = 10 + (k % 3) * colW;
    const y = y0 + Math.floor(k / 3) * 44;
    T.texto(x, y + 10, `P${pp.n}`, CORES.fraco, 2);
    pp.cores.slice(0, 4).forEach((c, j) => {
      const cx = x + 56 + j * 116;
      T.ret(cx, y, 36, 34, c.rgb);
      T.moldura(cx, y, 36, 34, CORES.grade, 1);
      T.texto(cx + 42, y + 4, c.hex.slice(1), CORES.texto, 1);
      T.texto(cx + 42, y + 18, `${fmt(c.parte * 100, 0)}%`, CORES.fraco, 1);
    });
  });
  T.salvar(arq);
}

// ───────────────────────────── relatório ─────────────────────────────

function rel(saida, arq) { return path.relative(saida, arq).split(path.sep).join('/'); }

function escreverRelatorio({ saida, ficha, jan, Q, S, planos, trs, extras, som, pulso, pal, acentos, arquivos, alinhamento, ritmo }) {
  const L = [];
  const p = (s = '') => L.push(s);
  const nPl = planos.length;
  p(`# Leitura da referência: ${ficha.nome}`);
  p();
  p('> Medições automáticas, quadro a quadro. Elas apontam ONDE olhar e dão os números (tempos, durações, curvas);');
  p('> a descrição do que acontece (tipografia, objetos, estilo) vem de abrir as imagens. Onde o número e o olho');
  p('> discordarem, vale o olho.');
  p();
  p('## Ficha técnica');
  p();
  p('| | |');
  p('|---|---|');
  p(`| Arquivo | \`${ficha.arquivo}\` |`);
  p(`| Trecho analisado | ${fs_(jan.inicio)} a ${fs_(jan.inicio + Q.n / Q.fps)} (${Q.n} quadros) |`);
  p(`| Duração do arquivo | ${fs_(ficha.duracao)} |`);
  p(`| Formato | ${ficha.largura}×${ficha.altura}, ${ficha.proporcao} ${ficha.orientacao} |`);
  p(`| Quadros por segundo | ${fmt(ficha.fps, ficha.fps % 1 ? 3 : 0)}${ficha.fpsVariavel ? ' (variável no arquivo; lido como constante)' : ''}${Q.fps !== ficha.fps ? ` · analisado a ${fmt(Q.fps, 0)} qps` : ''} |`);
  p(`| Um quadro dura | ${fms(1 / Q.fps)} |`);
  p(`| Codec / cor | ${ficha.codec} · ${ficha.cor || '–'} |`);
  p(`| Som | ${ficha.audio ? `${ficha.audio.codec}, ${ficha.audio.canais} canal(is), ${ficha.audio.taxa} Hz${som && som.mudo ? ' (trilha muda)' : ''}` : 'sem trilha de som'} |`);
  p();
  // resumo
  const durs = planos.map((x) => x.dur);
  const secos = trs.filter((t) => t.tipo === 'corte seco').length;
  const lisos = trs.filter((t) => t.tipo === 'passagem por tela lisa').length;
  const cont = trs.filter((t) => t.tipo === 'transição contínua').length;
  const inter = trs.filter((t) => t.tipo === 'corte com quadro intermediário').length;
  const est = estados(S, planos, Q.n);
  const conta = (k) => est.filter((x) => x === k).length / Q.n;
  const evTodos = planos.flatMap((x) => x.eventos);
  p('## Em uma olhada');
  p();
  p(`- **${nPl} planos** em ${fs_(Q.n / Q.fps)}: duração média ${fs_(media(durs))}, mediana ${fs_(mediana(durs))}, do mais curto (${fs_(Math.min(...durs))}) ao mais longo (${fs_(Math.max(...durs))}).`);
  p(`- **Transições**: ${secos} corte(s) seco(s), ${inter} corte(s) com quadro intermediário, ${lisos} passagem(ns) por tela lisa (preto/branco/cor), ${cont} transição(ões) contínua(s) sem corte.`);
  if (extras.abre) p(`- Abre do ${extras.abre.nome} (${extras.abre.cor}) por ${fms(extras.abre.dur)}.`);
  if (extras.fecha) p(`- Fecha no ${extras.fecha.nome} (${extras.fecha.cor}) por ${fms(extras.fecha.dur)}.`);
  p(`- **Tempo de tela**: ${fpct(conta('mov'))} em batidas de movimento, ${fpct(conta('hold'))} em hold vivo, ${fpct(conta('continuo'))} em movimento contínuo (filmagem/câmera), ${fpct(conta('parado'))} congelado, ${fpct(conta('liso'))} em tela lisa, ${fpct(conta('corte') + conta('outro'))} em cortes e transições.`);
  const nFilm = planos.filter((x) => x.natureza === 'filmagem').length;
  if (nFilm) p(`- **Natureza**: ${nFilm} de ${nPl} planos parecem filmagem/vídeo (textura no quadro todo e movimento que nunca para); ${nPl - nFilm} parecem gráfico/motion.`);
  if (evTodos.length) p(`- **Batidas de movimento medidas**: ${evTodos.length} (média de ${fmt(evTodos.length / Math.max(1, Q.n / Q.fps), 1)} por segundo). Duração típica de um movimento: ${fms(mediana(evTodos.map((e) => e.dur)))} (metade fica entre ${fms(percentil(evTodos.map((e) => e.dur), 0.25))} e ${fms(percentil(evTodos.map((e) => e.dur), 0.75))}).`);
  else p('- **Batidas de movimento medidas**: nenhuma se destaca do movimento de fundo de cada plano (o movimento é contínuo ou a imagem fica parada).');
  const curvas = {};
  for (const ev of evTodos) curvas[ev.curva.codigo] = (curvas[ev.curva.codigo] || 0) + 1;
  const nomesCurva = { 'out-forte': 'ease-out forte', out: 'ease-out', 'in-out': 'ease-in-out', in: 'ease-in', 'in-forte': 'ease-in forte', linear: 'linear', instantaneo: 'instantâneo', seco: 'seco' };
  if (evTodos.length) p(`- **Curvas** (pela forma da energia): ${Object.entries(curvas).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${nomesCurva[c] || c} ${v}`).join(' · ')}.`);
  const focoE = evTodos.filter((e) => e.foco.rotulo.startsWith('entra do desfoque')).length;
  const focoS = evTodos.filter((e) => e.foco.rotulo.startsWith('sai desfocando')).length;
  if (focoE || focoS) p(`- **Foco**: ${focoE} entrada(s) do desfoque para o foco e ${focoS} saída(s) desfocando.`);
  p(`- **Ritmo de corte**: ${ritmo}`);
  if (pulso) {
    p(pulso.confiavel
      ? `- **Pulso visual**: cortes e inícios de movimento caem numa grade de ~${fs_(pulso.P, 3)} (≈ ${fmt(pulso.bpm, 0)} BPM, ${fmt(pulso.P * Q.fps, 1)} quadros): ${fpct(pulso.alin)} das marcas a ±1 quadro da grade (o acaso daria ~${fpct(pulso.acasoAlin)}).`
      : '- **Pulso visual**: cortes e inícios de movimento não caem numa grade de andamento fixa (ritmo livre, guiado pela leitura, pela fala ou pelo som).');
  }
  if (som && !som.mudo) {
    if (som.batidaClara) p(`- **Música**: ~${fmt(som.bpm, 0)} BPM (batida a cada ${fs_(som.periodo, 3)} = ${fmt(som.periodo * Q.fps, 1)} quadros). ${alinhamento ? alinhamento.resumo : ''}`);
    else p(`- **Som**: ${alinhamento ? alinhamento.resumo : 'sem batida regular.'}${alinhamento && alinhamento.cortesNoImpacto != null && trs.length ? ` ${alinhamento.cortesNoImpacto} de ${trs.length} cortes caem num impacto do som.` : ''}`);
  } else if (som && som.mudo) p('- **Som**: a trilha existe mas está muda.');
  if (pal.length) {
    const fundo = pal[0];
    const claro = [...pal].sort((a, b) => b.L - a.L)[0];
    const ac = acentos.slice(0, 3);
    p(`- **Cor**: domina ${fundo.nome} ${fundo.hex} (${fpct(fundo.parte)} da tela no tempo)` +
      (claro && claro !== fundo ? `; o mais claro é ${claro.nome} ${claro.hex} (contraste ${fmt(contraste(fundo.rgb, claro.rgb), 1)}:1 com o dominante)` : '') +
      (ac.length ? `; acentos saturados: ${ac.map((c) => `${c.nome} ${c.hex} (${fpct(c.parte, c.parte < 0.01 ? 2 : 1)})`).join(', ')}` : '; quase sem cor saturada (paleta neutra)') + '.');
  }
  p();
  p('## Imagens, na ordem de leitura');
  p();
  const imgs = [];
  imgs.push(`\`00-linha-do-tempo.png\`: o vídeo inteiro no tempo. De cima para baixo: **COR** (cada coluna é o quadro espremido), **PLANOS**, **ESTADO** (branco = batida de movimento, verde = hold vivo, ciano = movimento contínuo, cinza = congelado, azul-escuro = tela lisa, vermelho = corte), **ENERGIA** (escala log; tracinhos amarelos = início de cada batida; faixas azuis = tela lisa; faixas laranja = transição contínua), **FOCO** (sobe = mais nítido), **LUZ** (brilho médio), **CAMERA** (verde para cima = aproxima, roxo para baixo = afasta; a linha clara é a velocidade de deslocamento)${som && !som.mudo ? `, **SOM** (ataques do som${som.batidaClara ? '; tracinhos brancos = batidas' : ''}; pontos amarelos = impactos)` : ''}. Linhas vermelhas verticais = cortes secos.`);
  imgs.push(`${arquivos.visao.map((a) => `\`${rel(saida, a)}\``).join(', ')}: storyboard reverso, os quadros-chave A (primeiro estado legível), B (meio) e C (composição final do hold, rótulo amarelo) de cada plano.`);
  imgs.push(`\`planos/plano-NN.jpg\`: folha de contato de cada plano, densa nas batidas (${fmt(op_tiraFps, 0)} qps) e espaçada no hold; a faixa de baixo é a energia do plano com o número de cada quadro.`);
  if (arquivos.transicoes.length) imgs.push('`transicoes/tNN-MM.jpg`: tira densa de cada transição que não é corte seco (moldura vermelha = primeiro quadro do plano seguinte).');
  if (arquivos.cortes.length) imgs.push('`cortes/cortes-N.jpg`: cada corte seco com 2 quadros antes e 3 depois.');
  if (arquivos.zoom.length) imgs.push(`${arquivos.zoom.map((a) => `\`${rel(saida, a)}\``).join(', ')}: quadro a quadro do trecho pedido.`);
  imgs.push('`paleta.png`: cores dominantes (global e por plano).');
  imgs.forEach((t, k) => p(`${k + 1}. ${t}`));
  p();
  p('Dados: `dados.json` (tudo o que está aqui, estruturado) e `quadros.csv` (uma linha por quadro: energia, foco, luz, câmera, estado).');
  p();
  // sugestões de zoom: as batidas mais ricas (entradas com desfoque, cascatas, as mais longas)
  const candidatos = planos.flatMap((pl) => pl.eventos.map((ev) => ({ pl, ev, nota: (ev.foco.rotulo.startsWith('entra do desfoque') ? 2 : 0) + (ev.varredura ? 2 : 0) + (ev === pl.entrada ? 1 : 0) + Math.min(2, ev.dur * 2) })));
  candidatos.sort((a, b) => b.nota - a.nota);
  const sug = candidatos.slice(0, 3).map(({ pl, ev }) => `\`--zoom ${fmt(Math.max(0, ev.t0 - 0.05), 2)}-${fmt(ev.t1 + 0.1, 2)}\` (P${pl.n}, ${ev === pl.entrada ? 'entrada' : ev === pl.saida ? 'saída' : 'batida'} de ${fms(ev.dur)})`);
  p(`Para ver um trecho quadro a quadro, rode de novo com \`--zoom a-b\` (todos os quadros entre a e b segundos).${sug.length ? ` Os trechos que mais valem um zoom: ${sug.join('; ')}.` : ''}`);
  p();
  // planos
  p('## Planos');
  p();
  p('| Plano | Tempo | Duração | Batidas | Entrada | Hold | Saída | Câmera | Fundo |');
  p('|---|---|---|---|---|---|---|---|---|');
  for (const pl of planos) {
    const ent = pl.entrada ? `${fms(pl.entrada.dur)}, ${pl.entrada.curva.codigo}` : pl.comecaEmMovimento ? 'já em movimento' : '–';
    const hd = pl.hold ? `${fs_(pl.hold.dur)}, ${pl.hold.vida.split(' ')[0].replace('em', 'contínuo')}` : '–';
    const sa = pl.saida ? `${fms(pl.saida.dur)}, ${pl.saida.curva.codigo}` : pl.terminaEmMovimento ? 'corta em movimento' : 'corta do hold, sem saída';
    const fl = descreverFluxo(pl.fluxo);
    const cam = pl.cam && pl.cam.confiavel ? pl.cam.rotulo.split(', ')[0] : fl ? fl.split(' (')[0].split(';')[0] : pl.cam && pl.cam.erro0 <= 0.4 ? 'parada' : 'não medida';
    p(`| P${pl.n} | ${fmt(pl.t0, 2)}–${fmt(pl.t1, 2)} | ${fs_(pl.dur)} | ${pl.eventos.length} | ${ent} | ${hd} | ${sa} | ${cam} | ${pl.fundo.tipo} ${pl.fundo.cor} |`);
  }
  p();
  for (const pl of planos) {
    p(`### P${pl.n} · ${fs_(pl.t0)} → ${fs_(pl.t1)} (${fs_(pl.dur)})`);
    p();
    p(`Energia: \`${pl.energia}\``);
    p();
    p(`- Imagem: \`planos/plano-${String(pl.n).padStart(2, '0')}.jpg\` · quadros-chave A ${fs_(S.t(pl.chave.a))}${pl.chave.b != null ? `, B ${fs_(S.t(pl.chave.b))}` : ''}, C ${fs_(S.t(pl.chave.c))}`);
    p(`- Fundo: ${pl.fundo.tipo} (borda ${pl.fundo.cor}). ${pl.natureza === 'filmagem' ? 'Parece filmagem/vídeo. ' : ''}Batidas de movimento ocupam ${fpct(pl.propMovimento)} do plano.`);
    if (pl.hold) p(`- Hold: ${fs_(pl.hold.t0 - pl.t0)} → ${fs_(pl.hold.t1 + 1 / Q.fps - pl.t0)} do plano (${fs_(pl.hold.dur)}), ${pl.hold.vida}.`);
    else p('- Sem hold: o plano não para de se mexer.');
    if (pl.cam) p(`- Câmera (comparando ${fs_(pl.cam.de)} com ${fs_(pl.cam.ate)}): ${pl.cam.rotulo}.`);
    const fl = descreverFluxo(pl.fluxo);
    if (fl) p(`- Câmera pelo fluxo (textura em ${fpct(pl.fluxo.cobertura)} do quadro, somado no plano): ${fl}.`);
    else if (pl.fluxo.amostras >= 3 && (Math.abs(pl.fluxo.zoomPct) > 5 || Math.abs(pl.fluxo.dxPct) > 5 || Math.abs(pl.fluxo.dyPct) > 5)) {
      p(`- O que se move na tela, somado no plano (pouca textura: pode ser objeto, não câmera): escala ${sinal(pl.fluxo.zoomPct, 0)}%, horizontal ${sinal(pl.fluxo.dxPct, 0)}% da largura, vertical ${sinal(pl.fluxo.dyPct, 0)}% da altura.`);
    }
    if (!pl.eventos.length) p('- Nenhuma batida de movimento acima do ruído do plano.');
    else {
      p('- Batidas (tempo dentro do plano):');
      for (const ev of pl.eventos) {
        const papel = ev === pl.entrada ? 'ENTRADA · ' : ev === pl.saida ? 'SAÍDA · ' : '';
        const partes = [
          `${papel}${fms(ev.dur)}`,
          `onde: ${ev.regiao.nome} (${fpct(ev.area)} dos pixels mudando por quadro)`,
          `curva: ${ev.curva.rotulo}`,
          `velocidade \`${ev.velocidade}\``,
          ev.foco.rotulo,
          ev.mov.rotulo,
          ev.varredura,
          ev.comp.rotulo,
        ].filter(Boolean);
        p(`  - **${fmt(ev.t0 - pl.t0, 2)}** (${fs_(ev.t0)} → ${fs_(ev.t1 + 1 / Q.fps)}): ${partes.join('; ')}.`);
      }
    }
    p();
  }
  // transições
  p('## Transições');
  p();
  if (!trs.length) p('Um plano só, sem transições.');
  else {
    p('| De → para | Tempo | Tipo | Duração | Leitura | Imagem |');
    p('|---|---|---|---|---|---|');
    for (const tr of trs) {
      let durTxt = tr.tipo === 'corte seco' ? '1 quadro' : tr.tipo === 'corte com quadro intermediário' ? '2 quadros' : fms(tr.dur);
      let leitura = tr.rotulo;
      if (tr.liso) {
        durTxt = `${fms(tr.liso.dur)} de tela lisa`;
        const partes = [];
        if (tr.saiSeco) partes.push('o plano anterior corta seco para a tela lisa');
        else if (tr.esmaece.sai > 0.03) partes.push(`o plano anterior perde contraste por ~${fms(tr.esmaece.sai)}`);
        if (tr.entraSeco) partes.push('a imagem seguinte volta seca, num quadro');
        else if (tr.esmaece.entra > 0.03) partes.push(`o seguinte ganha contraste por ~${fms(tr.esmaece.entra)}`);
        if (partes.length) leitura += '; ' + partes.join(', ');
      }
      p(`| P${tr.de} → P${tr.para} | ${fs_(tr.tCorte)} | ${tr.tipo} | ${durTxt} | ${leitura} | ${tr.imagem ? `\`${rel(saida, tr.imagem)}\`` : '–'} |`);
    }
  }
  p();
  // som e pulso
  if (som && !som.mudo) {
    p('## Som e sincronia');
    p();
    if (som.batidaClara) p(`- Andamento estimado: **${fmt(som.bpm, 1)} BPM** (uma batida a cada ${fs_(som.periodo, 3)}, ${fmt(som.periodo * Q.fps, 1)} quadros). Primeira batida em ${fs_(som.batidas[0] + jan.inicio, 3)}.`);
    if (alinhamento) for (const l of alinhamento.linhas) p(`- ${l}`);
    p(`- Impactos mais fortes da trilha (s): ${som.impactos.slice(0, 24).map((x) => fmt(x.t + jan.inicio, 2)).join(' · ')}`);
    p();
  }
  // paleta
  p('## Paleta');
  p();
  p('| Cor | Hex | Parte da tela | Luminosidade | Saturação |');
  p('|---|---|---|---|---|');
  for (const c of pal) p(`| ${c.nome} | \`${c.hex}\` | ${fpct(c.parte, 1)} | ${fmt(c.L, 0)} | ${fmt(c.croma, 0)} |`);
  p();
  if (acentos.length) {
    p('Acentos (só as cores saturadas, mesmo pequenas: degradês, brilhos, palavras em destaque):');
    p();
    p('| Cor | Hex | Parte da tela | Luminosidade | Saturação |');
    p('|---|---|---|---|---|');
    for (const c of acentos) p(`| ${c.nome} | \`${c.hex}\` | ${fpct(c.parte, 2)} | ${fmt(c.L, 0)} | ${fmt(c.croma, 0)} |`);
    p();
  }
  p('Por plano (4 mais presentes): ' + planos.map((pl) => `P${pl.n} ${pl.paleta.slice(0, 4).map((c) => c.hex).join(' ')}`).join(' · '));
  p();
  // rascunho do storyboard
  p('## Rascunho do roteiro reverso (preencher olhando as imagens)');
  p();
  p('Mesma forma do storyboard: plano, duração, quadros-chave e batidas com o tempo dentro do plano. Os tempos já estão');
  p('medidos; troque cada `[…]` pelo que se vê nas folhas (o que entra, de onde, como, em que unidade, com que curva).');
  p();
  p('```');
  for (const pl of planos) {
    p(`P${pl.n} · ${fmt(pl.dur, 1)} s · fundo ${pl.fundo.tipo}`);
    p(`  quadro A (${fmt(S.t(pl.chave.a) - pl.t0, 1)}): […primeiro estado legível]`);
    if (pl.chave.b != null) p(`  quadro B (${fmt(S.t(pl.chave.b) - pl.t0, 1)}): […]`);
    p(`  quadro C (${fmt(S.t(pl.chave.c) - pl.t0, 1)}): […composição final]`);
    for (const ev of pl.eventos) p(`  ${fmt(ev.t0 - pl.t0, 1)}  […] (${fms(ev.dur)}, ${ev.curva.codigo}${ev.foco.rotulo.startsWith('entra do desfoque') ? ', desfoque→foco' : ''}${ev.foco.rotulo.startsWith('sai desfocando') ? ', sai desfocando' : ''})`);
    const tr = trs.find((x) => x.de === pl.n);
    if (tr) p(`  ${fmt(pl.dur, 1)}  → ${tr.rotulo}`);
  }
  p('```');
  p();
  p('## Linguagem de movimento da referência (rascunho para o storyboard)');
  p();
  p(`- **Ritmo**: ${pulso && pulso.confiavel ? `grade de ~${fs_(pulso.P, 2)} (≈ ${fmt(pulso.bpm, 0)} BPM)` : som && !som.mudo && som.batidaClara ? `música a ~${fmt(som.bpm, 0)} BPM` : 'livre (sem grade de andamento)'}; planos de ${fs_(mediana(durs), 1)} na mediana; ${ritmo}`);
  p(`- **Entradas**: duração típica ${fms(mediana(planos.filter((x) => x.entrada).map((x) => x.entrada.dur)))}; curvas ${resumoCurvas(planos.filter((x) => x.entrada).map((x) => x.entrada.curva.codigo), nomesCurva)}. […unidade (letra/palavra/linha/bloco), atraso entre unidades, de onde vem, desfoque/opacidade/máscara]`);
  p(`- **Hold**: ${fs_(mediana(planos.filter((x) => x.hold).map((x) => x.hold.dur)))} na mediana; ${planos.filter((x) => x.hold && x.hold.vida.startsWith('vivo')).length} vivos, ${planos.filter((x) => x.hold && x.hold.vida.startsWith('congelado')).length} congelados, ${planos.filter((x) => x.hold && x.hold.vida.startsWith('em movimento')).length} em movimento contínuo. […o que se mexe no hold]`);
  p(`- **Saídas**: ${planos.filter((x) => x.saida).length} plano(s) com saída animada (mediana ${fms(mediana(planos.filter((x) => x.saida).map((x) => x.saida.dur)))}; curvas ${resumoCurvas(planos.filter((x) => x.saida).map((x) => x.saida.curva.codigo), nomesCurva)}); ${planos.filter((x) => !x.saida && !x.terminaEmMovimento).length} cortam direto do hold, sem saída animada.`);
  p(`- **Câmera**: ${resumoCamera(planos)} […mergulhos, paralaxe entre camadas]`);
  p(`- **Cortes**: ${secos} secos, ${lisos} por tela lisa, ${cont} contínuos. […mesmo eixo? match de forma? corte no movimento?]`);
  p(`- **Luz e cor**: ${pal.slice(0, 3).map((c) => `${c.nome} ${c.hex}`).join(', ')}. […gradiente, brilho que atravessa, grão, vinheta]`);
  p('- **Profundidade**: […camadas, desfoque de profundidade, motion blur]');
  p();
  p('## Limites desta leitura');
  p();
  p('- "Energia" é a diferença média de brilho entre quadros: mede quanto a imagem muda, não o que muda. Opacidade, foco, cor e movimento somam juntos.');
  p('- A curva é estimada pela forma da energia; quando várias letras/objetos entram em cascata, ela descreve o conjunto, não cada peça. Confirme na folha.');
  p('- Câmera e movimento de objeto só se separam quando há textura no fundo. Em fundo chapado, "sobe/desliza/cresce" é o que se move na tela, não a câmera.');
  p('- Texto não é lido (sem OCR): leia nas imagens.');
  fs.writeFileSync(path.join(saida, 'relatorio.md'), L.join('\n') + '\n');
}

let op_tiraFps = 10;

function resumoCurvas(codigos, nomes) {
  if (!codigos.length) return '–';
  const c = {};
  for (const k of codigos) c[k] = (c[k] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nomes[k] || k} ${v}`).join(', ');
}

function resumoCamera(planos) {
  const push = planos.filter((p) => p.cam && p.cam.confiavel && p.cam.escala > 1.006);
  const pull = planos.filter((p) => p.cam && p.cam.confiavel && p.cam.escala < 0.994);
  const parada = planos.filter((p) => p.cam && p.cam.erro0 <= 0.4);
  const partes = [];
  if (push.length) partes.push(`${push.length} plano(s) com push-in lento (${push.map((p) => `P${p.n} ${fmt((p.cam.escala - 1) * 100, 1)}%`).join(', ')})`);
  if (pull.length) partes.push(`${pull.length} com pull-out`);
  if (parada.length) partes.push(`${parada.length} com quadro parado no hold`);
  const mergulho = planos.filter((p) => p.eventos.some((e) => e.mov.zoomPct > 10));
  if (mergulho.length) partes.push(`aproximações rápidas (>10%) em ${mergulho.map((p) => `P${p.n}`).join(', ')}`);
  return partes.length ? partes.join('; ') + '.' : 'nada conclusivo medido.';
}

function descreverRitmo(planos) {
  const d = planos.map((p) => p.dur);
  if (d.length < 3) return 'poucos planos para ler uma tendência.';
  const t = Math.max(1, Math.floor(d.length / 3));
  const ini = media(d.slice(0, t));
  const fim = media(d.slice(-t));
  const cv = Math.sqrt(media(d.map((x) => (x - media(d)) ** 2))) / media(d);
  const partes = [];
  if (fim < ini * 0.7) partes.push(`acelera: o primeiro terço tem planos de ${fs_(ini, 1)} e o último de ${fs_(fim, 1)}`);
  else if (fim > ini * 1.4) partes.push(`desacelera: de ${fs_(ini, 1)} no começo para ${fs_(fim, 1)} no fim`);
  else partes.push(`constante ao longo do vídeo (~${fs_(media(d), 1)} por plano)`);
  partes.push(cv < 0.25 ? 'durações bem regulares' : cv < 0.6 ? 'durações variadas' : 'mistura planos muito curtos com longos');
  return partes.join(', ') + '.';
}

// ───────────────────────────── principal ─────────────────────────────

async function main() {
  const op = lerArgs(process.argv.slice(2));
  if (!op.video) { ajuda(); process.exit(1); }
  op_tiraFps = op.tiraFps;
  verificarFerramentas();
  if (!fs.existsSync(op.video)) erro(`Não achei o arquivo "${op.video}".`);
  const ficha = lerFicha(op.video);
  const inicio = Math.max(0, op.inicio || 0);
  const fimArq = ficha.duracao || Infinity;
  const fim = Math.min(Number.isFinite(op.fim) ? op.fim : fimArq, fimArq);
  const dur = fim - inicio;
  if (!(dur > 0)) erro('O trecho pedido está vazio (confira --inicio e --fim).');
  let fps = ficha.fps;
  let fpsTexto = ficha.fpsTexto;
  if (fps > 60) { fps = 60; fpsTexto = '60'; }
  if (dur > 180 && fps > 30) { fps = 30; fpsTexto = '30'; console.log('  referência longa: lendo a 30 qps.'); }
  if (dur > 600 && !op.forcar) erro('Referência com mais de 10 minutos. Escolha o trecho que interessa com --inicio e --fim (ou use --forcar).');
  const jan = { inicio, dur, fps, fpsTexto };
  const saida = path.resolve(op.saida || path.join('human-output', 'motion-design', 'referencias', slug(path.parse(op.video).name)));
  fs.mkdirSync(saida, { recursive: true });
  for (const sub of ['planos', 'transicoes', 'cortes', 'zoom']) {
    const d = path.join(saida, sub);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/\.(jpg|png)$/i.test(f)) fs.unlinkSync(path.join(d, f));
  }
  for (const f of fs.readdirSync(saida)) if (/^01-planos-\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(saida, f));

  console.log(`\nReferência: ${ficha.nome}  (${ficha.largura}×${ficha.altura}, ${fmt(ficha.fps, 2)} qps, ${fs_(ficha.duracao)})`);
  const t0 = Date.now();
  const Q = await passo1(op, ficha, jan);
  if (Q.n < 2) erro('O vídeo tem menos de 2 quadros no trecho pedido.');
  const som = op.audio && ficha.audio ? await analisarSom(ficha, jan) : null;
  const S = segmentar(Q, op);
  if (!S.planos.length) S.planos.push({ p0: 0, p1: Q.n - 1 });
  const planos = analisarPlanos(Q, S, op);
  // paleta global e por plano
  const todos = [];
  for (const a of Q.amostras) for (const v of a.px) todos.push(v);
  const pal = paleta(Uint8Array.from(todos), 8);
  // acentos: só as cores saturadas, mesmo que ocupem pouca área (degradês, brilhos, palavras em destaque)
  const sat = [];
  for (let i = 0; i < todos.length; i += 3) {
    const [L, a, b] = lab(todos[i], todos[i + 1], todos[i + 2]);
    if (Math.hypot(a, b) > 22 && L > 15 && L < 97) sat.push(todos[i], todos[i + 1], todos[i + 2]);
  }
  const acentos = sat.length >= 300 ? paleta(Uint8Array.from(sat), 6, 5).map((c) => ({ ...c, parte: (c.parte * sat.length) / todos.length })) : [];
  for (const pl of planos) {
    const px = [];
    for (const a of Q.amostras) if (a.quadro >= pl.p0 && a.quadro <= pl.p1) for (const v of a.px) px.push(v);
    if (!px.length) { const a = Q.amostras.reduce((m, x) => (Math.abs(x.quadro - pl.p0) < Math.abs(m.quadro - pl.p0) ? x : m)); px.push(...a.px); }
    pl.paleta = paleta(Uint8Array.from(px), 5, 11);
  }
  const { trs, extras } = descreverTransicoes(Q, S, planos);
  // pulso visual
  const marcas = [];
  for (const tr of trs) {
    // numa passagem por tela lisa, o "corte" pode estar no começo ou no fim do liso: as duas bordas contam meio
    if (tr.liso) { marcas.push({ t: tr.liso.de - jan.inicio, w: 0.5 }); marcas.push({ t: tr.liso.ate - jan.inicio, w: 0.5 }); }
    else marcas.push({ t: tr.tCorte - jan.inicio, w: 1 });
  }
  for (const pl of planos) for (const ev of pl.eventos) if (ev.i0 > pl.p0 + 1) marcas.push({ t: ev.i0 / Q.fps, w: 0.6 });
  const pulso = estimarPulso(marcas, Q.n / Q.fps, Q.fps);
  // alinhamento com o som
  let alinhamento = null;
  if (som && !som.mudo) {
    const tol = Math.max(1 / Q.fps + 0.01, 0.045);
    const cortesT = trs.map((tr) => tr.tCorte - jan.inicio);
    const perto = (lista, t) => lista.reduce((m, b) => Math.min(m, Math.abs(b - t)), Infinity);
    const inicios = [...cortesT, ...planos.flatMap((pl) => pl.eventos.map((ev) => ev.i0 / Q.fps))];
    const impactosCobertos = som.impactos.filter((im) => perto(inicios, im.t) <= 2 / Q.fps + 0.01).length;
    const cortesNoImpacto = cortesT.filter((t) => perto(som.impactos.map((x) => x.t), t) <= 2 / Q.fps + 0.01).length;
    const linhas = [];
    let resumo = '';
    if (som.batidaClara) {
      const meias = som.batidas.map((b) => b + som.periodo / 2);
      const naBatida = cortesT.filter((t) => perto(som.batidas, t) <= tol).length;
      const naMeia = cortesT.filter((t) => perto(som.batidas, t) > tol && perto(meias, t) <= tol).length;
      const acaso = Math.min(1, (2 * tol) / som.periodo);
      if (cortesT.length) {
        linhas.push(`Cortes/transições na batida (±${fms(tol)}): **${naBatida} de ${cortesT.length}** (${fpct(naBatida / cortesT.length)}; o acaso daria ~${fpct(acaso)}). No contratempo (meia batida): ${naMeia}. Batida e contratempo podem estar trocados: confira ouvindo.`);
        const atrasos = cortesT.map((t) => {
          let best = Infinity;
          for (const b of [...som.batidas, ...meias]) { const d = t - b; if (Math.abs(d) < Math.abs(best)) best = d; }
          return best;
        }).filter((d) => Math.abs(d) <= som.periodo / 4);
        if (atrasos.length >= 3) {
          const md = mediana(atrasos);
          linhas.push(`Contando batida e meia batida, os cortes caem em média ${fms(Math.abs(md))} ${md > 0 ? 'depois' : 'antes'} da grade (${fmt(Math.abs(md) * Q.fps, 1)} quadros).`);
        }
        resumo = `${naBatida + naMeia} de ${cortesT.length} cortes caem na grade da música (batida ou meia batida; o acaso daria ~${fpct(Math.min(1, 2 * acaso))}).`;
      }
      const duracoesBat = planos.map((pl) => pl.dur / som.periodo);
      const inteiros = duracoesBat.filter((x) => Math.abs(x * 2 - Math.round(x * 2)) < 0.2).length;
      linhas.push(`Duração dos planos em batidas: ${duracoesBat.map((x) => fmt(x, 1)).join(' · ')} (${inteiros} de ${duracoesBat.length} fecham em batida ou meia batida).`);
    } else {
      linhas.push(`Sem batida regular clara (${som.silencio > 0.3 ? `${fpct(som.silencio)} da trilha é silêncio; ` : ''}provável fala, efeitos ou ambiente). O corte não segue um andamento de música.`);
      resumo = 'sem batida regular: a trilha parece fala, efeitos ou ambiente.';
    }
    if (som.impactos.length) {
      linhas.push(`Dos ${som.impactos.length} impactos mais fortes do som, ${impactosCobertos} têm um corte ou início de movimento a ±2 quadros.`);
      const janelaImp = 2 * (2 / Q.fps + 0.01);
      const acasoImp = Math.min(1, (som.impactos.length * janelaImp) / Math.max(1, Q.n / Q.fps));
      if (cortesT.length) linhas.push(`Dos ${cortesT.length} cortes, ${cortesNoImpacto} (${fpct(cortesNoImpacto / cortesT.length)}) caem a ±2 quadros de um impacto do som; o acaso daria ~${fpct(acasoImp)}.${cortesNoImpacto / cortesT.length > 2 * acasoImp ? ' O corte segue os impactos do som.' : ''}`);
    }
    alinhamento = { impactosCobertos, cortesNoImpacto, linhas, resumo };
  }
  console.log(`  ${planos.length} planos, ${trs.length} transições, ${planos.reduce((a, p) => a + p.eventos.length, 0)} batidas de movimento.`);
  // imagens
  desenharLinhaDoTempo(path.join(saida, '00-linha-do-tempo.png'), Q, S, planos, trs, som, pulso, ficha);
  desenharPaleta(path.join(saida, 'paleta.png'), pal, acentos, planos.map((pl) => ({ n: pl.n, cores: pl.paleta })));
  const arquivos = await passo2(op, ficha, jan, Q, S, planos, trs, saida);
  // dados
  const ritmo = descreverRitmo(planos);
  const limpo = (ev) => ({ ...ev });
  const dados = {
    gerado: new Date().toISOString(),
    ficha,
    trecho: { inicio: jan.inicio, fim: jan.inicio + Q.n / Q.fps, quadros: Q.n, fpsAnalise: Q.fps },
    resumo: { planos: planos.length, transicoes: trs.length, batidas: planos.reduce((a, p) => a + p.eventos.length, 0), ritmo },
    planos: planos.map((pl) => ({
      n: pl.n, t0: pl.t0, t1: pl.t1, dur: pl.dur, quadros: [pl.p0, pl.p1],
      chave: { a: S.t(pl.chave.a), b: pl.chave.b != null ? S.t(pl.chave.b) : null, c: S.t(pl.chave.c) },
      entrada: pl.entrada ? { t0: pl.entrada.t0, dur: pl.entrada.dur, curva: pl.entrada.curva.codigo } : null,
      saida: pl.saida ? { t0: pl.saida.t0, dur: pl.saida.dur, curva: pl.saida.curva.codigo } : null,
      hold: pl.hold ? { t0: pl.hold.t0, t1: pl.hold.t1, dur: pl.hold.dur, vida: pl.hold.vida, energiaMediana: pl.hold.eMed } : null,
      camera: pl.cam, fluxo: pl.fluxo, fundo: pl.fundo, paleta: pl.paleta, limiares: pl.limiares, energia: pl.energia,
      batidas: pl.eventos.map(limpo),
    })),
    transicoes: trs.map((tr) => ({ ...tr, imagem: tr.imagem ? rel(saida, tr.imagem) : null })),
    abertura: extras.abre || null,
    fechamento: extras.fecha || null,
    pulsoVisual: pulso,
    som: som ? { ...som, envelope: undefined } : null,
    sincronia: alinhamento,
    paleta: pal,
    acentos,
  };
  fs.writeFileSync(path.join(saida, 'dados.json'), JSON.stringify(dados, (k, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null) : v), 1));
  // csv por quadro
  const nomesEst = { mov: 'batida', continuo: 'continuo', hold: 'hold', parado: 'parado', liso: 'liso', corte: 'corte', outro: 'transicao' };
  const est = estados(S, planos, Q.n).map((x) => nomesEst[x]);
  const plDe = new Int32Array(Q.n).fill(0);
  for (const pl of planos) for (let i = pl.p0; i <= pl.p1; i++) plDe[i] = pl.n;
  const csv = ['quadro,tempo,plano,estado,energia,area_mudando,mudanca_cor,luz,contraste,foco,centro_x,centro_y,cam_dx_pct_s,cam_dy_pct_s,cam_zoom_pct_s,cam_cobertura'];
  const k = Q.fps / Q.passoFluxo;
  for (let i = 0; i < Q.n; i++) {
    const c = Q.cam;
    csv.push([
      i, (Q.inicio + i / Q.fps).toFixed(4), plDe[i] || '', est[i], S.e[i].toFixed(3), Q.A[i].toFixed(4), Q.Hd[i].toFixed(4), Q.lum[i].toFixed(1), Q.desv[i].toFixed(1), Q.foco[i].toFixed(4),
      Number.isFinite(Q.cx[i]) ? Q.cx[i].toFixed(3) : '', Number.isFinite(Q.cy[i]) ? Q.cy[i].toFixed(3) : '',
      Number.isFinite(c.tx[i]) ? ((c.tx[i] / Q.W) * 100 * k).toFixed(2) : '',
      Number.isFinite(c.ty[i]) ? ((c.ty[i] / Q.H) * 100 * k).toFixed(2) : '',
      Number.isFinite(c.zoom[i]) ? (c.zoom[i] * 100 * k).toFixed(2) : '',
      Number.isFinite(c.cob[i]) ? c.cob[i].toFixed(2) : '',
    ].join(','));
  }
  fs.writeFileSync(path.join(saida, 'quadros.csv'), csv.join('\n') + '\n');
  escreverRelatorio({ saida, ficha, jan, Q, S, planos, trs, extras, som, pulso, pal, acentos, arquivos, alinhamento, ritmo });
  console.log(`  pronto em ${fmt((Date.now() - t0) / 1000, 1)} s → ${saida}`);
  console.log(`  comece por: ${path.join(saida, 'relatorio.md')}\n`);
}

export { lerFicha, analisarSom, paleta, estimarPulso, medirEscala, fluxo, Tela };

const ehPrincipal = (() => {
  try { return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (ehPrincipal) {
  main().catch((e) => erro(e && e.stack ? e.stack : String(e)));
}
