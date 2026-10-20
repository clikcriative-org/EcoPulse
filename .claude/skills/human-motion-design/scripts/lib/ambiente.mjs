/* ambiente.mjs — acha as ferramentas na máquina da pessoa (macOS, Windows, Linux) e diz como
   instalar o que faltar. Nada de shell: spawn com lista de argumentos. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PASTA_MOTOR = path.join(RAIZ_SKILL, 'motor');
const require = createRequire(path.join(RAIZ_SKILL, 'package.json'));

export const SO = process.platform; // 'darwin' | 'win32' | 'linux'

/* Pastas onde os instaladores costumam pôr os programas. Um programa recém-instalado não entra no
   PATH do Claude Code que já estava aberto; procurando aqui, a skill acha mesmo assim. */
export function pastasExtras() {
  const home = os.homedir();
  if (SO === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(local, 'Microsoft', 'WinGet', 'Links'),
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs'),
      path.join(home, 'scoop', 'shims'),
    ];
  }
  if (SO === 'darwin') return ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin')];
  return ['/usr/local/bin', '/usr/bin', '/snap/bin', path.join(home, '.local', 'bin')];
}

export function acharNoPath(nome) {
  const exts = SO === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase()) : [''];
  const dirs = [...(process.env.PATH || '').split(path.delimiter).filter(Boolean), ...pastasExtras()];
  for (const d of dirs) {
    for (const e of exts) {
      const c = path.join(d, nome.toLowerCase().endsWith(e) ? nome : nome + e);
      try {
        if (existsSync(c)) return c;
      } catch {
        /* ignora */
      }
    }
  }
  return null;
}

/* ─── Playwright ─── */
export function carregarPlaywright() {
  for (const nome of ['playwright-core', 'playwright']) {
    try {
      return require(nome);
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}
export function versaoPlaywright() {
  try {
    return JSON.parse(readFileSync(require.resolve('playwright-core/package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

/* ─── Chrome / Chromium / Edge ─── */
export function candidatosChrome() {
  const lista = [];
  const add = (caminho, nome) => caminho && lista.push({ caminho, nome });
  if (process.env.CHROME_PATH) add(process.env.CHROME_PATH, 'CHROME_PATH');
  const home = os.homedir();
  if (SO === 'darwin') {
    for (const [app, bin, nome] of [
      ['Google Chrome.app', 'Google Chrome', 'Google Chrome'],
      ['Chromium.app', 'Chromium', 'Chromium'],
      ['Microsoft Edge.app', 'Microsoft Edge', 'Microsoft Edge'],
      ['Brave Browser.app', 'Brave Browser', 'Brave'],
      ['Google Chrome Canary.app', 'Google Chrome Canary', 'Chrome Canary'],
    ]) {
      add(`/Applications/${app}/Contents/MacOS/${bin}`, nome);
      add(path.join(home, 'Applications', app, 'Contents', 'MacOS', bin), nome);
    }
  } else if (SO === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    for (const base of [pf, pf86, local]) add(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'Google Chrome');
    for (const base of [pf86, pf]) add(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), 'Microsoft Edge');
    add(path.join(local, 'Chromium', 'Application', 'chrome.exe'), 'Chromium');
  } else {
    for (const [bin, nome] of [
      ['google-chrome', 'Google Chrome'],
      ['google-chrome-stable', 'Google Chrome'],
      ['chromium', 'Chromium'],
      ['chromium-browser', 'Chromium'],
      ['microsoft-edge', 'Microsoft Edge'],
      ['brave-browser', 'Brave'],
    ]) add(acharNoPath(bin), nome);
    add('/snap/bin/chromium', 'Chromium (snap)');
  }
  // o Chromium baixado pelo Playwright (npx playwright-core install chromium, na pasta da skill)
  const pw = carregarPlaywright();
  if (pw) {
    try {
      add(pw.chromium.executablePath(), 'Chromium do Playwright');
    } catch {
      /* não baixado */
    }
  }
  return lista;
}

export function acharChrome() {
  for (const c of candidatosChrome()) {
    try {
      if (c.caminho && existsSync(c.caminho)) return c;
    } catch {
      /* ignora */
    }
  }
  return null;
}

export const FLAGS_CHROME = [
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--hide-scrollbars',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-lcd-text',
  '--allow-file-access-from-files',
];

/** Abre um Chrome headless. Tenta o executável achado, depois os canais do Playwright. */
export async function abrirNavegador({ headless = true } = {}) {
  const pw = carregarPlaywright();
  if (!pw) throw new ErroAmbiente('Falta o playwright-core. Rode: node scripts/checar.mjs (instala na pasta da skill).');
  const tentativas = [];
  const achado = acharChrome();
  if (achado) tentativas.push({ executablePath: achado.caminho });
  tentativas.push({ channel: 'chrome' }, { channel: 'msedge' }, {});
  let ultimo;
  for (const t of tentativas) {
    try {
      const b = await pw.chromium.launch({ headless, ...t, args: FLAGS_CHROME });
      return b;
    } catch (e) {
      ultimo = e;
    }
  }
  throw new ErroAmbiente(
    `Não consegui abrir o Chrome. Instale o Google Chrome (ou, na pasta da skill: npx playwright-core install chromium).\n${String(ultimo?.message || ultimo).split('\n')[0]}`,
  );
}

/* ─── ffmpeg ─── */
export function acharFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const p = acharNoPath('ffmpeg');
  if (p) return p;
  try {
    const estatico = require('ffmpeg-static');
    if (estatico && existsSync(estatico)) return estatico;
  } catch {
    /* sem o pacote */
  }
  return null;
}
export function acharFfprobe() {
  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) return process.env.FFPROBE_PATH;
  return acharNoPath('ffprobe');
}
export function encodersFfmpeg(ffmpeg) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  const txt = r.stdout || '';
  return { libx264: /\blibx264\b/.test(txt), prores: /\bprores_ks\b/.test(txt), vp9: /\blibvpx-vp9\b/.test(txt), png: /\bpng\b/.test(txt) };
}
export function versaoDe(bin, args = ['-version']) {
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  return (r.stdout || r.stderr || '').split('\n')[0].trim();
}

/* ─── disco e CPU ─── */
export function espacoLivre(pasta) {
  try {
    let p = path.resolve(pasta);
    while (!existsSync(p)) p = path.dirname(p);
    const s = statfsSync(p);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}
export const cpus = () => (os.availableParallelism ? os.availableParallelism() : os.cpus().length);
export const workersPadrao = () => Math.min(4, Math.max(1, Math.floor(cpus() / 2)));

/* ─── como instalar, por sistema ─── */
export function distroLinux() {
  try {
    const txt = readFileSync('/etc/os-release', 'utf8');
    const id = (/^ID=(.*)$/m.exec(txt)?.[1] || '').replace(/"/g, '');
    const like = (/^ID_LIKE=(.*)$/m.exec(txt)?.[1] || '').replace(/"/g, '');
    const s = `${id} ${like}`;
    if (/debian|ubuntu|mint|pop/.test(s)) return 'apt';
    if (/fedora|rhel|centos/.test(s)) return 'dnf';
    if (/arch|manjaro/.test(s)) return 'pacman';
    if (/suse/.test(s)) return 'zypper';
  } catch {
    /* sem os-release */
  }
  return 'apt';
}

/** Comandos de instalação para o sistema da pessoa. Os que pedem a senha do computador ou uma
    janela de permissão vêm marcados: rodam no Terminal do sistema (o terminal do Claude Code não
    aceita digitação de senha). Depois de instalar Node ou ffmpeg: feche e abra o Claude Code. */
export function comoInstalar(item) {
  const temBrew = SO === 'darwin' && !!acharNoPath('brew');
  const temWinget = SO === 'win32' && !!acharNoPath('winget');
  const temChoco = SO === 'win32' && !!acharNoPath('choco');
  const gerente = SO === 'linux' ? distroLinux() : null;
  const SENHA = '   (pede a senha do computador: cole no Terminal do sistema)';
  const JANELA = '   (o Windows abre uma janela de permissão: aceite)';
  const winget = (id) => `winget install -e --id ${id} --accept-source-agreements --accept-package-agreements`;
  const linux = {
    apt: { ffmpeg: 'sudo apt install -y ffmpeg', chrome: 'baixe o .deb do Google Chrome em https://www.google.com/chrome e abra (ou: sudo apt install -y ./google-chrome-stable_current_amd64.deb)' },
    dnf: { ffmpeg: 'sudo dnf install -y ffmpeg', chrome: 'baixe o .rpm do Google Chrome em https://www.google.com/chrome e abra' },
    pacman: { ffmpeg: 'sudo pacman -S ffmpeg', chrome: 'sudo pacman -S chromium' },
    zypper: { ffmpeg: 'sudo zypper install ffmpeg', chrome: 'baixe o .rpm do Google Chrome em https://www.google.com/chrome e abra' },
  };
  const brewAntes = temBrew ? [] : ['/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"   (instala o Homebrew)' + SENHA];
  const pastaSkill = RAIZ_SKILL;
  const naSkill = (cmd) => (SO === 'win32' ? `cd "${pastaSkill}"; ${cmd}` : `cd "${pastaSkill}" && ${cmd}`);
  switch (item) {
    case 'node':
      if (SO === 'darwin') return [...brewAntes, 'brew install node' + (temBrew ? '' : SENHA), 'ou o instalador LTS de https://nodejs.org (abre como qualquer app)'];
      if (SO === 'win32') return [temChoco && !temWinget ? 'choco install nodejs-lts' : winget('OpenJS.NodeJS.LTS') + JANELA, 'ou o instalador LTS de https://nodejs.org'];
      return ['o instalador LTS de https://nodejs.org, ou o nvm (https://github.com/nvm-sh/nvm): nvm install --lts', 'evite o nodejs do apt no Ubuntu 22.04 ou mais antigo: vem antigo demais (Node 12)'];
    case 'chrome':
      if (SO === 'darwin') return [...brewAntes, 'brew install --cask google-chrome', `ou, sem instalar nada no sistema: ${naSkill('npx playwright-core install chromium')}`];
      if (SO === 'win32') return [winget('Google.Chrome') + JANELA, 'o Microsoft Edge que já vem no Windows também serve'];
      return [linux[gerente].chrome, `ou, sem mexer no sistema: ${naSkill('npx playwright-core install --with-deps chromium')}` + SENHA, 'o chromium do snap costuma não abrir pela skill: prefira o Google Chrome'];
    case 'ffmpeg':
      if (SO === 'darwin') return [...brewAntes, 'brew install ffmpeg'];
      if (SO === 'win32') return [temChoco && !temWinget ? 'choco install ffmpeg' : winget('Gyan.FFmpeg') + JANELA];
      return [linux[gerente].ffmpeg + SENHA];
    case 'playwright':
      return [naSkill('npm install --no-audit --no-fund')];
    default:
      return [];
  }
}

export class ErroAmbiente extends Error {}

export function garantirPasta(p) {
  mkdirSync(p, { recursive: true });
  return p;
}
