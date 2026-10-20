/* ffmpeg.mjs — codificar por pipe (sem padrão f_%05d, que não sobrevive a cache nem a nomes com
   espaço), ler quadros em cinza para a fluidez e sondar vídeos. */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { acharFfmpeg, acharFfprobe } from './ambiente.mjs';

export function exigirFfmpeg() {
  const f = acharFfmpeg();
  if (!f) throw new Error('Falta o ffmpeg. Rode node scripts/checar.mjs para ver como instalar.');
  return f;
}

const PRESETS = {
  rascunho: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20'],
  final: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14'],
  maxima: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '12'],
};

/** Codifica PNGs (ou JPEGs) em ordem num MP4 H.264 (ou ProRes .mov). */
export function codificar({ arquivos, fps, destino, qualidade = 'final', entrada = 'png', largura, altura, prores = false }) {
  const ffmpeg = exigirFfmpeg();
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', entrada === 'jpeg' ? 'mjpeg' : 'png', '-i', '-'];
  if (largura && altura) args.push('-vf', `scale=${largura}:${altura}:flags=lanczos+accurate_rnd+full_chroma_int`);
  if (prores) args.push('-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0');
  else args.push(...(PRESETS[qualidade] || PRESETS.final), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  args.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(fps), destino);
  return new Promise((ok, falha) => {
    const p = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', falha);
    p.on('close', (c) => (c === 0 ? ok(destino) : falha(new Error(`ffmpeg saiu com ${c}: ${err.split('\n')[0]}`))));
    (async () => {
      for (const a of arquivos) {
        if (!p.stdin.write(readFileSync(a))) await new Promise((r) => p.stdin.once('drain', r));
      }
      p.stdin.end();
    })().catch(falha);
  });
}

/** Lê quadros em cinza (largura × altura bytes cada) de PNGs em ordem ou de um vídeo.
    `fps` (só vídeo): reamostra nessa taxa. `cor: true` lê RGB (3 bytes por pixel). */
export function lerCinza({ arquivos, video, largura = 240, altura, entrada = 'png', fps = null, cor = false }) {
  const ffmpeg = exigirFfmpeg();
  const args = ['-loglevel', 'error'];
  if (video) args.push('-i', video);
  else args.push('-f', 'image2pipe', '-c:v', entrada === 'jpeg' ? 'mjpeg' : 'png', '-i', '-');
  const fmt = cor ? 'rgb24' : 'gray';
  args.push('-vf', `${video && fps ? `fps=${fps},` : ''}scale=${largura}:${altura}:flags=area,format=${fmt}`, '-f', 'rawvideo', '-pix_fmt', fmt, 'pipe:1');
  const tam = largura * altura * (cor ? 3 : 1);
  return new Promise((ok, falha) => {
    const p = spawn(ffmpeg, args, { stdio: [video ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    const quadros = [];
    let resto = Buffer.alloc(0);
    let err = '';
    p.stdout.on('data', (d) => {
      resto = resto.length ? Buffer.concat([resto, d]) : d;
      while (resto.length >= tam) {
        quadros.push(new Uint8Array(resto.subarray(0, tam)));
        resto = resto.subarray(tam);
      }
    });
    p.stderr.on('data', (d) => (err += d));
    p.on('error', falha);
    p.on('close', (c) => (c === 0 ? ok(quadros) : falha(new Error(`ffmpeg saiu com ${c}: ${err.split('\n')[0]}`))));
    if (!video) {
      (async () => {
        for (const a of arquivos) {
          if (!p.stdin.write(readFileSync(a))) await new Promise((r) => p.stdin.once('drain', r));
        }
        p.stdin.end();
      })().catch(falha);
    }
  });
}

/** Duração, fps, tamanho e número de quadros de um vídeo. */
export function sondar(video) {
  const probe = acharFfprobe();
  if (probe) {
    const r = spawnSync(probe, ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_packets,duration:format=duration', '-of', 'json', video], { encoding: 'utf8' });
    try {
      const j = JSON.parse(r.stdout);
      const s = j.streams[0];
      const [a, b] = String(s.r_frame_rate).split('/').map(Number);
      return { largura: s.width, altura: s.height, fps: b ? a / b : a, quadros: +s.nb_read_packets, duracao: +(s.duration || j.format.duration) };
    } catch {
      /* cai para o ffmpeg */
    }
  }
  const ffmpeg = exigirFfmpeg();
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', video], { encoding: 'utf8' });
  const txt = r.stderr || '';
  const tam = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(txt);
  const fps = /(\d+(?:\.\d+)?) fps/.exec(txt);
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(txt);
  const duracao = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : NaN;
  return { largura: tam ? +tam[1] : NaN, altura: tam ? +tam[2] : NaN, fps: fps ? +fps[1] : NaN, duracao, quadros: fps && dur ? Math.round(duracao * +fps[1]) : NaN };
}
