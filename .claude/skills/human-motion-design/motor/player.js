/* player.js — o player do filme no navegador (fora do modo captura).
   Teclas: espaço toca/pausa · ←/→ um quadro · Shift+←/→ um segundo · [ ] cena anterior/próxima ·
   L repete a cena · A área segura · F tela cheia. A prévia ao vivo pode perder quadros numa cena
   pesada: o MP4 renderizado é a verdade. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0').replace('.', ',')}`;
  }

  function montar() {
    const L = Motion.linha;
    const palco = Motion.palco;
    document.body.classList.add('m-com-player');
    const moldura = document.createElement('div');
    moldura.id = 'm-moldura';
    palco.parentNode.insertBefore(moldura, palco);
    moldura.appendChild(palco);

    const barra = document.createElement('div');
    barra.id = 'm-player';
    barra.innerHTML = `
      <div class="m-regua"><div class="m-cenas"></div><div class="m-batidas"></div><input type="range" min="0" step="0.0001" value="0" aria-label="Tempo"><div class="m-cabeca"></div></div>
      <div class="m-controles">
        <button data-a="anterior" title="Cena anterior ([)">⏮</button>
        <button data-a="tocar" class="m-tocar" title="Tocar / pausar (espaço)">Tocar</button>
        <button data-a="proxima" title="Próxima cena (])">⏭</button>
        <span class="m-tempo"></span>
        <span class="m-cena-atual"></span>
        <span class="m-espaco"></span>
        <button data-a="repetir" title="Repetir a cena (L)">Repetir cena</button>
        <select data-a="velocidade" title="Velocidade"><option value="1">1×</option><option value="0.5">0,5×</option><option value="0.25">0,25×</option></select>
        <button data-a="seguro" title="Área segura (A)">Área segura</button>
        <button data-a="cheia" title="Tela cheia (F)">⤢</button>
      </div>`;
    document.body.appendChild(barra);

    const regua = barra.querySelector('.m-regua');
    const faixa = barra.querySelector('.m-cenas');
    const input = barra.querySelector('input');
    const cabeca = barra.querySelector('.m-cabeca');
    const lblTempo = barra.querySelector('.m-tempo');
    const lblCena = barra.querySelector('.m-cena-atual');
    const btTocar = barra.querySelector('.m-tocar');
    input.max = String(L.total);

    L.cenas.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'm-cena-faixa';
      d.style.left = `${(c.inicio / L.total) * 100}%`;
      d.style.width = `${(c.dur / L.total) * 100}%`;
      d.innerHTML = `<span>${String(i + 1).padStart(2, '0')} ${c.titulo || c.id}</span>`;
      d.title = `${c.titulo || c.id} · ${fmt(c.inicio)}`;
      faixa.appendChild(d);
    });
    const bat = barra.querySelector('.m-batidas');
    const passo = 60 / (L.bpm || 120);
    for (let t = 0; t <= L.total + 1e-6; t += passo) {
      const b = document.createElement('i');
      b.style.left = `${(t / L.total) * 100}%`;
      bat.appendChild(b);
    }

    let tocando = false, t = 0, ultimo = 0, velocidade = 1, repetir = null, seguro = false;
    const ajustar = () => {
      const W = palco.offsetWidth, H = palco.offsetHeight;
      const altBarra = barra.offsetHeight + 16;
      const s = Math.min((innerWidth - 24) / W, (innerHeight - altBarra - 16) / H);
      palco.style.transform = `scale(${s})`;
      moldura.style.width = `${W * s}px`;
      moldura.style.height = `${H * s}px`;
    };
    ajustar();
    addEventListener('resize', ajustar);

    const cenaEm = (tt) => {
      let atual = L.cenas[0];
      for (const c of L.cenas) if (tt >= c.inicio - 1e-6) atual = c;
      return atual;
    };
    const mostrar = (tt) => {
      t = Math.max(0, Math.min(L.total, tt));
      Motion.ir(t);
      input.value = String(t);
      cabeca.style.left = `${(t / L.total) * 100}%`;
      const q = Math.round(t * L.fps);
      lblTempo.textContent = `${fmt(t)} · quadro ${q}`;
      const c = cenaEm(t);
      lblCena.textContent = `${String(L.cenas.indexOf(c) + 1).padStart(2, '0')} · ${c.titulo || c.id} · ${(t - c.inicio).toFixed(2).replace('.', ',')} s`;
    };
    const laco = (agora) => {
      if (!tocando) return;
      const dt = Math.min(0.1, (agora - ultimo) / 1000) * velocidade;
      ultimo = agora;
      let nt = t + dt;
      if (repetir) {
        if (nt >= repetir.inicio + repetir.dur) nt = repetir.inicio;
      } else if (nt > L.total) nt = 0;
      mostrar(nt);
      requestAnimationFrame(laco);
    };
    const alternar = () => {
      tocando = !tocando;
      btTocar.textContent = tocando ? 'Pausar' : 'Tocar';
      if (tocando) {
        ultimo = performance.now();
        requestAnimationFrame(laco);
      }
    };
    const pararE = (fn) => {
      tocando = false;
      btTocar.textContent = 'Tocar';
      fn();
    };
    const irCena = (dir) => {
      const i = L.cenas.indexOf(cenaEm(t + 1e-4));
      const alvo = L.cenas[Math.max(0, Math.min(L.cenas.length - 1, i + dir))];
      mostrar(alvo.inicio);
    };
    let caixaSeguro = null;
    const alternarSeguro = () => {
      seguro = !seguro;
      if (!caixaSeguro) {
        caixaSeguro = document.createElement('div');
        caixaSeguro.className = 'm-seguro';
        const f = Motion.FORMATOS[L.formato];
        caixaSeguro.style.left = `${f.seguro.x * 100}%`;
        caixaSeguro.style.right = `${f.seguro.x * 100}%`;
        caixaSeguro.style.top = `${f.seguro.topo * 100}%`;
        caixaSeguro.style.bottom = `${f.seguro.base * 100}%`;
        palco.appendChild(caixaSeguro);
      }
      caixaSeguro.style.display = seguro ? 'block' : 'none';
    };

    barra.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a;
      if (a === 'tocar') alternar();
      if (a === 'anterior') pararE(() => irCena(-1));
      if (a === 'proxima') pararE(() => irCena(1));
      if (a === 'repetir') {
        repetir = repetir ? null : cenaEm(t + 1e-4);
        ev.target.classList.toggle('m-ligado', !!repetir);
        if (repetir) mostrar(repetir.inicio);
      }
      if (a === 'seguro') {
        alternarSeguro();
        ev.target.classList.toggle('m-ligado', seguro);
      }
      if (a === 'cheia') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    });
    barra.querySelector('select').addEventListener('change', (ev) => (velocidade = parseFloat(ev.target.value)));
    input.addEventListener('input', () => pararE(() => mostrar(parseFloat(input.value))));
    regua.addEventListener('dblclick', (ev) => {
      const c = ev.target.closest('.m-cena-faixa');
      if (c) pararE(() => mostrar(L.cenas[[...faixa.children].indexOf(c)].inicio));
    });
    addEventListener('keydown', (ev) => {
      if (ev.target.tagName === 'SELECT') return;
      const q = 1 / L.fps;
      if (ev.key === ' ') {
        ev.preventDefault();
        alternar();
      } else if (ev.key === 'ArrowRight') pararE(() => mostrar(t + (ev.shiftKey ? 1 : q)));
      else if (ev.key === 'ArrowLeft') pararE(() => mostrar(t - (ev.shiftKey ? 1 : q)));
      else if (ev.key === ']') pararE(() => irCena(1));
      else if (ev.key === '[') pararE(() => irCena(-1));
      else if (ev.key.toLowerCase() === 'l') barra.querySelector('[data-a="repetir"]').click();
      else if (ev.key.toLowerCase() === 'a') barra.querySelector('[data-a="seguro"]').click();
      else if (ev.key.toLowerCase() === 'f') barra.querySelector('[data-a="cheia"]').click();
    });

    mostrar(parseFloat((params.get('t') || '0').replace(',', '.')) || 0);
    if (params.has('play')) alternar();
    if (params.has('seguro')) alternarSeguro();
  }

  window.MotionPlayer = { montar };
})();
