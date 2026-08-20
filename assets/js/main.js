/* ==========================================================================
   Amoboba — интерактив лендинга.
   Всё тяжёлое (canvas) считается только пока секция в кадре;
   при prefers-reduced-motion анимации не запускаются вовсе.
   ========================================================================== */
(() => {
'use strict';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE    = matchMedia('(hover:hover) and (pointer:fine)').matches;
const clamp   = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp    = (a, b, t) => a + (b - a) * t;

/* «живёт» ли элемент в кадре — общий помощник для ленивых анимаций */
function whenVisible(el, on, off) {
  const io = new IntersectionObserver(es => {
    es.forEach(e => (e.isIntersecting ? on() : off && off()));
  }, { rootMargin: '120px' });
  io.observe(el);
}

/* ---------------------------------------------------------------- заставка */
(() => {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const finish = () => {
    intro.classList.add('done');
    document.body.classList.remove('loading');
  };
  if (REDUCED) { finish(); return; }
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const wait  = new Promise(r => setTimeout(r, 1150));
  Promise.all([ready, wait]).then(finish);
  setTimeout(finish, 3000); // страховка, если шрифты не доехали
})();

/* ------------------------------------------------------------------ меню */
(() => {
  const top  = document.getElementById('top');
  const mark = document.getElementById('mark');
  const bars = document.getElementById('bars');
  if (!top || !mark || !bars) return;

  function setOpen(open) {
    top.classList.toggle('open', open);
    mark.setAttribute('aria-expanded', open ? 'true' : 'false');
    mark.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    bars.tabIndex = open ? 0 : -1;
  }
  const toggle = () => setOpen(!top.classList.contains('open'));

  mark.addEventListener('click', toggle);
  bars.addEventListener('click', () => { if (top.classList.contains('open')) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && top.classList.contains('open')) { setOpen(false); mark.focus(); }
  });
  document.querySelectorAll('.panel a').forEach(a => a.addEventListener('click', () => setOpen(false)));
})();

/* -------------------------------------------- шапка: липнет, прячется вниз */
(() => {
  const head = document.getElementById('head');
  const top  = document.getElementById('top');
  if (!head) return;
  let last = 0, ticking = false;

  const update = () => {
    const y = window.scrollY;
    head.classList.toggle('stuck', y > 24);
    const menuOpen = top && top.classList.contains('open');
    head.classList.toggle('hide', !menuOpen && y > 320 && y > last + 4);
    last = y;
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

/* --------------------------------------------------- полоса прогресса чтения */
(() => {
  const bar = document.getElementById('progress');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--sp', max > 0 ? clamp(scrollY / max, 0, 1) : 0);
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  update();
})();

/* ------------------------------------------------- мягкий свет за курсором */
(() => {
  const root = document.documentElement;
  if (!FINE || REDUCED) return;
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;

  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    root.style.setProperty('--glow', '1');
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  addEventListener('pointerleave', () => root.style.setProperty('--glow', '0'));

  function loop() {
    x = lerp(x, tx, 0.14);
    y = lerp(y, ty, 0.14);
    root.style.setProperty('--mx', x.toFixed(1) + 'px');
    root.style.setProperty('--my', y.toFixed(1) + 'px');
    raf = (Math.abs(x - tx) > 0.5 || Math.abs(y - ty) > 0.5) ? requestAnimationFrame(loop) : 0;
  }
})();

/* ------------------------------------------- разбивка заголовка на слова */
document.querySelectorAll('[data-split]').forEach(el => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.style.setProperty('--i', i);
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
});

/* --------------------------------------------- появление блоков при скролле
   IntersectionObserver закрывает обычную прокрутку, но переход сразу по якорю
   перепрыгивает промежуточные секции — они не успевают пересечься с вьюпортом
   и остаются прозрачными. Поэтому рядом идёт подметание: всё, что уже выше
   нижней границы экрана, показывается независимо от наблюдателя. */
(() => {
  const items = new Set(document.querySelectorAll('.reveal'));
  if (!items.size) return;

  const show = el => { el.classList.add('in'); items.delete(el); io.unobserve(el); };

  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) show(e.target); });
  }, { threshold: 0.2 });
  items.forEach(el => io.observe(el));

  let ticking = false;
  function sweep() {
    items.forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * 0.85) show(el);
    });
    if (!items.size) removeEventListener('scroll', onScroll);
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(sweep); }
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('load', sweep);
  sweep();
})();

/* ------------------------------------- плитки логотипов: свет идёт за мышью */
if (FINE) {
  document.querySelectorAll('.lg').forEach(tile => {
    tile.addEventListener('pointermove', e => {
      const r = tile.getBoundingClientRect();
      tile.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      tile.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  });
}

/* ------------------------------- warden3: эхо-пятно следует за указателем */
if (FINE && !REDUCED) {
  document.querySelectorAll('[data-cursor]').forEach(sec => {
    sec.addEventListener('pointermove', e => {
      const r = sec.getBoundingClientRect();
      sec.style.setProperty('--px', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      sec.style.setProperty('--py', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  });
}

/* -------------------------------------------- параллакс скрина «Каталожки» */
(() => {
  const shot = document.querySelector('.kat-shot');
  const sec  = document.getElementById('katalozhka');
  if (!shot || !sec || REDUCED) return;
  const base = 'perspective(2000px) rotateY(-24deg) rotateX(6deg) rotateZ(-2deg)';
  let ticking = false, live = false;

  whenVisible(sec, () => { live = true; update(); }, () => { live = false; });

  function update() {
    const r = sec.getBoundingClientRect();
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    shot.style.transform =
      `translate3d(${(p * -40).toFixed(1)}px, calc(-50% + ${(p * 46).toFixed(1)}px), 0) ${base}`;
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (live && !ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
})();

/* ==========================================================================
   Герой: хромовая надпись.
   База (буквы + хром + шум) пересчитывается только при ресайзе,
   а по кадрам гоняется лишь блик — он ловит указатель.
   ========================================================================== */
(() => {
  const cv = document.getElementById('silver');
  if (!cv) return;
  const ctx  = cv.getContext('2d');
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d', { willReadFrequently: true });

  const LINES  = ['Темки крутятся,', 'бабки мутятся'];
  const FONT   = '900 SIZEpx "Myriad Pro","Myriad","Segoe UI",-apple-system,"Helvetica Neue",Arial,sans-serif';
  const CHROME = [
    [0.00,'#ffffff'],[0.10,'#dfe3e8'],[0.26,'#9aa0a8'],[0.44,'#4c525a'],
    [0.49,'#1c1f24'],[0.52,'#c8cdd4'],[0.62,'#ffffff'],[0.74,'#8f959d'],
    [0.86,'#d9dce1'],[1.00,'#63686f']
  ];
  /* сумма шести равномерных — почти нормальное распределение, как шум сэмплинга */
  const rndN = () => (Math.random()+Math.random()+Math.random()+Math.random()+Math.random()+Math.random()-3)/1.5;

  let wCss = 0, hCss = 0;

  function renderBase() {
    const parent = cv.parentElement;
    wCss = parent.clientWidth;
    if (!wCss) return;
    const dpr   = Math.min(devicePixelRatio || 1, 2);
    const block = Math.max(1, Math.round(dpr));

    /* чем уже экран, тем большую долю ширины занимает надпись */
    const fill = wCss < 520 ? 0.94 : wCss < 820 ? 0.82 : 0.67;
    let size = Math.min(wCss * 0.075, 64);
    bctx.font = FONT.replace('SIZE', size);
    const widest = Math.max(...LINES.map(l => bctx.measureText(l).width));
    if (widest > 0) size = Math.min(size * (wCss * fill) / widest, 72);

    const lh = size * 1.06;
    hCss = Math.ceil(lh * LINES.length + size * 0.35);

    cv.style.width  = wCss + 'px';
    cv.style.height = hCss + 'px';
    cv.width  = base.width  = Math.round(wCss * dpr);
    cv.height = base.height = Math.round(hCss * dpr);

    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, wCss, hCss);

    // 1. буквы
    bctx.font = FONT.replace('SIZE', size);
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillStyle = '#fff';
    const top = hCss / 2 - lh * (LINES.length - 1) / 2;
    LINES.forEach((l, i) => bctx.fillText(l, wCss / 2, top + i * lh));

    // 2. заливка хромом внутри букв
    const g = bctx.createLinearGradient(0, top - lh * 0.6, 0, top + lh * (LINES.length - 0.4));
    CHROME.forEach(([p, c]) => g.addColorStop(p, c));
    bctx.globalCompositeOperation = 'source-in';
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, wCss, hCss);
    bctx.globalCompositeOperation = 'source-over';

    // 3. шум рендера: в тенях сэмплов меньше — зерна больше
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = base.width, H = base.height;
    const img = bctx.getImageData(0, 0, W, H);
    const d = img.data;

    for (let y = 0; y < H; y += block) {
      for (let x = 0; x < W; x += block) {
        const i0 = (y * W + x) * 4;
        if (d[i0 + 3] < 8) continue;

        const lum = (d[i0] * 0.299 + d[i0 + 1] * 0.587 + d[i0 + 2] * 0.114) / 255;
        const amp = 46 * (1 - lum) + 12;
        const n = rndN() * amp;
        const cr = rndN() * 6, cg = rndN() * 6, cb = rndN() * 6;
        const fire = Math.random() < 0.00035 ? 170 + Math.random() * 85 : 0;

        for (let by = 0; by < block && y + by < H; by++) {
          for (let bx = 0; bx < block && x + bx < W; bx++) {
            const i = ((y + by) * W + (x + bx)) * 4;
            if (d[i + 3] < 8) continue;
            d[i]     = clamp(d[i]     + n + cr + fire, 0, 255);
            d[i + 1] = clamp(d[i + 1] + n + cg + fire, 0, 255);
            d[i + 2] = clamp(d[i + 2] + n + cb + fire, 0, 255);
          }
        }
      }
    }
    bctx.putImageData(img, 0, 0);
    draw(performance.now());
  }

  /* блик: медленно ползёт сам и подтягивается к указателю */
  let px = 0, py = 0, tpx = 0, tpy = 0;

  function draw(t) {
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);
    if (!W || !H) return;

    px = lerp(px, tpx, 0.08);
    py = lerp(py, tpy, 0.08);

    const c = clamp(0.5 + 0.34 * Math.sin(t * 0.00034) + px * 0.3, 0.06, 0.94);
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(clamp(c - 0.13, 0, 1), 'rgba(255,255,255,0)');
    g.addColorStop(c, 'rgba(255,255,255,.55)');
    g.addColorStop(clamp(c + 0.13, 0, 1), 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // мягкое пятно света ровно под указателем
    const rg = ctx.createRadialGradient(
      (0.5 + px) * W, (0.5 + py) * H, 0,
      (0.5 + px) * W, (0.5 + py) * H, Math.max(W, H) * 0.42);
    rg.addColorStop(0, 'rgba(255,255,255,.22)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* наклон сцены и позиция блика — от указателя */
  const stage = document.getElementById('hero-stage');
  const hero  = cv.closest('.hero');
  if (FINE && !REDUCED && hero) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tpx = clamp((e.clientX - r.left) / r.width  - 0.5, -0.5, 0.5);
      tpy = clamp((e.clientY - r.top)  / r.height - 0.5, -0.5, 0.5);
      if (stage) {
        stage.style.setProperty('--rx', (tpx *  7).toFixed(2) + 'deg');
        stage.style.setProperty('--ry', (tpy * -5).toFixed(2) + 'deg');
      }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      tpx = tpy = 0;
      if (stage) { stage.style.setProperty('--rx', '0deg'); stage.style.setProperty('--ry', '0deg'); }
    });
  }

  let raf = 0;
  const tick = t => { draw(t); raf = requestAnimationFrame(tick); };
  if (!REDUCED) {
    whenVisible(cv,
      () => { if (!raf) raf = requestAnimationFrame(tick); },
      () => { cancelAnimationFrame(raf); raf = 0; });
  }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderBase, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderBase);
  renderBase();
})();

/* ==========================================================================
   Sculk-Strike: слева плывут споры, справа поднимаются угли.
   ========================================================================== */
(() => {
  const cv  = document.getElementById('ss-canvas');
  const sec = document.getElementById('sculk-strike');
  if (!cv || !sec || REDUCED) return;

  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, parts = [], raf = 0;

  function resize() {
    const r = sec.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width  = Math.round(r.width  * dpr);
    H = cv.height = Math.round(r.height * dpr);
    seed();
  }

  function seed() {
    const n = clamp(Math.round((W * H) / (26000 * dpr)), 30, 130);
    parts = Array.from({ length: n }, () => spawn(Math.random() * H));
  }

  /* левая половина — бирюзовые споры, правая — оранжевые угли */
  function spawn(y) {
    const x = Math.random() * W;
    const ember = x > W * 0.52;
    return {
      x, y: y == null ? H + Math.random() * 60 : y,
      r: (ember ? 0.8 + Math.random() * 1.8 : 1.2 + Math.random() * 2.6) * dpr,
      vy: (ember ? -0.55 - Math.random() * 0.9 : -0.12 - Math.random() * 0.22) * dpr,
      vx: (Math.random() - 0.5) * (ember ? 0.35 : 0.16) * dpr,
      a: (ember ? 0.35 : 0.22) + Math.random() * 0.35,
      ph: Math.random() * Math.PI * 2,
      ember
    };
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.x += p.vx + Math.sin(t * 0.0006 + p.ph) * 0.22 * dpr;
      p.y += p.vy;
      if (p.y < -20 || p.x < -20 || p.x > W + 20) Object.assign(p, spawn(null));

      const flick = p.ember ? 0.65 + 0.35 * Math.sin(t * 0.008 + p.ph) : 1;
      const a = p.a * flick;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      if (p.ember) {
        g.addColorStop(0, `rgba(255,168,64,${a})`);
        g.addColorStop(0.4, `rgba(255,94,14,${a * 0.4})`);
      } else {
        g.addColorStop(0, `rgba(120,240,225,${a})`);
        g.addColorStop(0.4, `rgba(42,211,196,${a * 0.35})`);
      }
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 180); });
  resize();
  whenVisible(sec,
    () => { if (!raf) raf = requestAnimationFrame(frame); },
    () => { cancelAnimationFrame(raf); raf = 0; });
})();

})();
