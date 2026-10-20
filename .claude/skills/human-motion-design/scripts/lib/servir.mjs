/* servir.mjs — servidor estático local (127.0.0.1), sem dependência, com Range (vídeo arrastável)
   e tipos MIME certos. Para abrir a página de entrega com downloads funcionando. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

export function servir(raiz, { porta = 4600, host = '127.0.0.1' } = {}) {
  raiz = path.resolve(raiz);
  const srv = http.createServer((req, res) => {
    let caminho;
    try {
      caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let arq = path.join(raiz, caminho);
    if (!arq.startsWith(raiz)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(arq) && statSync(arq).isDirectory()) arq = path.join(arq, 'index.html');
    if (!existsSync(arq)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('não encontrado');
      return;
    }
    const tam = statSync(arq).size;
    const tipo = MIME[path.extname(arq).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const ini = range[1] ? +range[1] : 0;
      const fim = range[2] ? Math.min(+range[2], tam - 1) : tam - 1;
      res.writeHead(206, { 'content-type': tipo, 'content-range': `bytes ${ini}-${fim}/${tam}`, 'accept-ranges': 'bytes', 'content-length': fim - ini + 1, 'cache-control': 'no-store' });
      createReadStream(arq, { start: ini, end: fim }).pipe(res);
    } else {
      res.writeHead(200, { 'content-type': tipo, 'content-length': tam, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
      createReadStream(arq).pipe(res);
    }
  });
  return new Promise((ok, falha) => {
    const tentar = (p, n) => {
      srv.once('error', (e) => (e.code === 'EADDRINUSE' && n < 20 ? tentar(p + 1, n + 1) : falha(e)));
      srv.listen(p, host, () => ok({ servidor: srv, url: `http://${host}:${p}/` }));
    };
    tentar(porta, 0);
  });
}
