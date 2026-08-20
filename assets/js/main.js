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

/* WebGPU: монохромные металлические волны на первом экране. */
(async () => {
  const canvas = document.getElementById('hero-gpu');
  if (!canvas || !navigator.gpu) return;

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) return;

    const format = navigator.gpu.getPreferredCanvasFormat();
    const shader = device.createShaderModule({ code: `
      struct Uniforms {
        resolution: vec2f,
        time: f32,
        aspect: f32,
        pointer: vec2f,
        padding: vec2f,
      };
      @group(0) @binding(0) var<uniform> u: Uniforms;

      struct VertexOut { @builtin(position) position: vec4f, @location(0) uv: vec2f };

      @vertex fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
        var positions = array<vec2f, 3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
        var out: VertexOut;
        out.position = vec4f(positions[i], 0.0, 1.0);
        out.uv = positions[i] * 0.5 + 0.5;
        return out;
      }

      fn hash21(p: vec2f) -> f32 {
        return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
      }

      fn valueNoise(p: vec2f) -> f32 {
        let cell = floor(p);
        let local = fract(p);
        let smoothLocal = local * local * (3.0 - 2.0 * local);
        let a = hash21(cell);
        let b = hash21(cell + vec2f(1.0, 0.0));
        let c = hash21(cell + vec2f(0.0, 1.0));
        let d = hash21(cell + vec2f(1.0, 1.0));
        return mix(mix(a, b, smoothLocal.x), mix(c, d, smoothLocal.x), smoothLocal.y);
      }

      fn lowPassNoise(p: vec2f, t: f32) -> f32 {
        let drift = vec2f(t * 0.055, -t * 0.035);
        let first = valueNoise(p * 2.15 + drift);
        let second = valueNoise(p * 4.1 - drift * 1.4) * 0.48;
        let third = valueNoise(p * 7.6 + drift * 0.7) * 0.22;
        return (first + second + third) / 1.7;
      }

      @fragment fn fs(in: VertexOut) -> @location(0) vec4f {
        var p = in.uv * 2.0 - 1.0;
        p.x *= u.aspect;
        let mouse = vec2f((u.pointer.x * 2.0 - 1.0) * u.aspect, 1.0 - u.pointer.y * 2.0);
        let influence = exp(-2.8 * dot(p - mouse, p - mouse));
        let t = u.time * 0.22;
        let renderNoise = lowPassNoise(p, t);

        let warp = 0.16 * sin(p.y * 3.2 - t)
          + 0.08 * sin((p.x + p.y) * 5.0 + t * 1.7)
          + (renderNoise - 0.5) * 0.13;
        let diagonal = p.x * 0.78 + p.y * 0.46 + warp + influence * 0.18;
        let bands = 0.5 + 0.5 * sin(diagonal * 12.0 - t * 2.0);
        let sharp = pow(bands, 9.0);
        let soft = 0.5 + 0.5 * sin(diagonal * 3.1 + t);
        let fold = pow(abs(sin((p.x * 0.42 - p.y * 0.72) * 5.2 + t)), 18.0);
        let vignette = smoothstep(1.45, 0.16, length(p * vec2f(0.72, 1.0)));
        let noisyLight = (renderNoise - 0.5) * (0.035 + sharp * 0.075 + fold * 0.045);
        let light = (0.035 + soft * 0.055 + sharp * 0.20 + fold * 0.10 + influence * 0.075 + noisyLight) * vignette;
        let tone = clamp(light, 0.0, 0.34);
        return vec4f(vec3f(tone), 1.0);
      }
    ` });

    const uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    let pointerX = 0.72, pointerY = 0.38, raf = 0, visible = true;
    const hero = canvas.closest('.hero');
    hero?.addEventListener('pointermove', event => {
      const rect = hero.getBoundingClientRect();
      pointerX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      pointerY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    }, { passive: true });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.configure({ device, format, alphaMode: 'opaque' });
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    observer.observe(canvas);

    const start = performance.now();
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const width = canvas.width, height = canvas.height;
      if (!width || !height) return;
      const values = new Float32Array([
        width, height,
        REDUCED ? 0 : (now - start) / 1000,
        width / height,
        pointerX, pointerY,
        0, 0,
      ]);
      device.queue.writeBuffer(uniformBuffer, 0, values);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      if (!REDUCED) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  } catch (error) {
    console.warn('WebGPU hero fallback:', error);
  }
})();

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

})();
