/* captura.mjs — abre o filme montado no Chrome headless e captura quadros.
   Workers = navegadores separados (medido: escala melhor que várias páginas num navegador).
   Blocos contíguos de ~1 s com aquecimento: antes do primeiro quadro de um bloco o navegador
   visita o quadro anterior, então o estado de pintura fica igual ao de um render em sequência. */
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirNavegador } from './ambiente.mjs';
import { FORMATOS } from './projeto.mjs';

const RUIDO = /net::ERR_|Failed to load resource|favicon/i;

export async function abrirFilme(navegador, arquivo, { formato, escala = 1, query = 'captura', timeout = 120_000 } = {}) {
  const F = FORMATOS[formato];
  const pagina = await navegador.newPage({ viewport: { width: F.largura, height: F.altura }, deviceScaleFactor: escala });
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e.message || e)));
  pagina.on('console', (m) => m.type() === 'error' && !RUIDO.test(m.text()) && erros.push(m.text()));
  const url = `${pathToFileURL(arquivo).href}?${query}`;
  await pagina.goto(url, { waitUntil: 'load', timeout });
  try {
    await pagina.waitForFunction(() => window.__MOTION__ && window.__MOTION__.pronto, null, { timeout });
  } catch {
    const doMotor = await pagina.evaluate(() => (window.__MOTION__ ? window.__MOTION__.erros() : [])).catch(() => []);
    throw new Error(`o filme não ficou pronto em ${timeout / 1000} s. ${[...erros, ...doMotor.map(fraseDeErro)].slice(0, 4).join(' | ') || ''}`);
  }
  return { pagina, erros };
}

export const fraseDeErro = (e) =>
  typeof e === 'string' ? e : `${e.cena ? `cena "${e.cena}"` : 'motor'} · ${e.fase}${e.t != null ? ` · t=${String(e.t).replace('.', ',')} s` : ''}: ${e.mensagem}`;

export async function errosDoMotor(pagina) {
  return pagina.evaluate(() => window.__MOTION__.erros()).catch(() => []);
}

export async function foto(pagina, { tipo = 'png', qualidade = 92 } = {}) {
  const op = { type: tipo, timeout: 60_000, ...(tipo === 'jpeg' ? { quality: qualidade } : {}) };
  try {
    return await pagina.screenshot(op);
  } catch {
    await pagina.waitForTimeout(1500);
    return pagina.screenshot(op);
  }
}

function gravarAtomico(destino, buf) {
  mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, destino);
}

/**
 * Renderiza uma lista de quadros [{ f, t, destino }] (os que faltam no cache) com N navegadores.
 * Para no primeiro erro de cena (quadro/transição) e devolve { erros }.
 */
export async function renderizarQuadros({ arquivo, formato, fps, escala = 1, quadros, workers = 4, tipo = 'png', aoProgresso } = {}) {
  const faltam = quadros.filter((q) => !existsSync(q.destino));
  if (!faltam.length) return { erros: [], feitos: 0 };
  // blocos contíguos de até ~1 s
  const blocos = [];
  let atual = [];
  for (const q of faltam) {
    const ant = atual[atual.length - 1];
    if (ant && (q.f !== ant.f + 1 || atual.length >= Math.max(8, Math.round(fps)))) {
      blocos.push(atual);
      atual = [];
    }
    atual.push(q);
  }
  if (atual.length) blocos.push(atual);
  const nW = Math.max(1, Math.min(workers, blocos.length));
  const navegadores = [];
  let parar = null;
  let feitos = 0;
  const inicio = Date.now();
  const erros = [];
  const fechar = async () => Promise.all(navegadores.map((b) => b.close().catch(() => {})));
  const aoSinal = () => {
    parar = 'interrompido';
    fechar().finally(() => process.exit(130));
  };
  process.once('SIGINT', aoSinal);
  try {
    await Promise.all(
      Array.from({ length: nW }, async () => {
        const nav = await abrirNavegador();
        navegadores.push(nav);
        const { pagina, erros: errosPagina } = await abrirFilme(nav, arquivo, { formato, escala });
        const iniciais = await errosDoMotor(pagina);
        let base = iniciais.length;
        const graves = iniciais.filter((x) => x.fase !== 'aviso');
        if (graves.length || errosPagina.length) {
          erros.push(...graves.map(fraseDeErro), ...errosPagina.splice(0));
          parar = parar || 'erro';
          return;
        }
        while (!parar && blocos.length) {
          const bloco = blocos.shift();
          if (bloco[0].f > 0) await pagina.evaluate((t) => window.__MOTION__.ir(t), (bloco[0].f - 1) / fps);
          for (const q of bloco) {
            if (parar) break;
            await pagina.evaluate((t) => window.__MOTION__.ir(t), q.t);
            const buf = await foto(pagina, { tipo });
            gravarAtomico(q.destino, buf);
            feitos++;
            if (aoProgresso && feitos % 15 === 0) {
              const dt = (Date.now() - inicio) / 1000;
              aoProgresso({ feitos, total: faltam.length, restante: (dt / feitos) * (faltam.length - feitos) });
            }
          }
          const e = await errosDoMotor(pagina);
          if (e.length > base) {
            const novos = e.slice(base).filter((x) => x.fase !== 'aviso');
            base = e.length;
            if (novos.length) {
              erros.push(...novos.map(fraseDeErro));
              parar = 'erro';
            }
          }
          if (errosPagina.length) {
            erros.push(...errosPagina.splice(0));
            parar = 'erro';
          }
        }
      }),
    );
  } finally {
    process.removeListener('SIGINT', aoSinal);
    await fechar();
  }
  return { erros: [...new Set(erros)], feitos, segundos: (Date.now() - inicio) / 1000 };
}
