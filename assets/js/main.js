/* ==========================================================================
   NEKOMA — interaction engine
   Vanilla JS + GSAP/ScrollTrigger + Lenis (all optional — content renders without them)
   ========================================================================== */
(() => {
  'use strict';

  const D = window.NEKOMA;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
  // Effects run the same on every machine (the owner wants an identical experience even when
  // Windows 'animation effects' is turned off, which reports prefers-reduced-motion).
  const REDUCED = false;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let lenis = null;
  const state = { mouseX: innerWidth / 2, mouseY: innerHeight / 2 };

  /* ------------------------------------------------------------------
     Drive images — self-hosted copies in assets/img/drive/<ID>.webp
     (+ <ID>-sm.webp). If a local file is missing, fall back to Drive's
     thumbnail through a small queue (3 parallel, retries, then a slate).
     ------------------------------------------------------------------ */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const NO_SIGNAL = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><rect width="160" height="90" fill="#141416"/><text x="80" y="48" fill="#8a857c" font-family="monospace" font-size="7" letter-spacing=".6" text-anchor="middle">PREVIEW UNAVAILABLE</text></svg>`);
  const localDrive = (id, sm = false) => `assets/img/drive/${id}${sm ? '-sm' : ''}.webp`;
  const driveUrl = (id, w, n = 0) => (n % 2 === 0
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w${w}${n ? '&r=' + n : ''}`
    : `https://lh3.googleusercontent.com/d/${id}=w${w}`);
  const dimg = (id, w, alt = '', sm = false) =>
    `<img src="${localDrive(id, sm)}" data-fallback="${id}" data-w="${w}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

  const driveQ = (() => {
    const queue = [];
    let active = 0;
    const pump = () => {
      while (active < 3 && queue.length) {
        const img = queue.shift();
        if (!img.isConnected || img.dataset.state === 'done') continue;
        active++;
        const tries = +(img.dataset.tries || 0);
        const key = img.dataset.drive + '|' + img.dataset.w;
        const probe = new Image();
        probe.onload = () => {
          active--;
          if (img.dataset.drive + '|' + img.dataset.w === key) { img.src = probe.src; img.dataset.state = 'done'; }
          pump();
        };
        probe.onerror = () => {
          active--;
          if (img.dataset.drive + '|' + img.dataset.w === key) {
            img.dataset.tries = tries + 1;
            if (tries < 4) setTimeout(() => { queue.push(img); pump(); }, 1400 * (tries + 1) + Math.random() * 1200);
            else { img.src = NO_SIGNAL; img.dataset.state = 'done'; }
          }
          pump();
        };
        probe.src = driveUrl(img.dataset.drive, img.dataset.w, tries);
      }
    };
    return {
      now(img, id, w) {
        img.dataset.drive = id; img.dataset.w = w; img.dataset.tries = 0; img.dataset.state = 'wait';
        img.src = BLANK; queue.unshift(img); pump();
      },
    };
  })();
  function setDriveImg(img, id, w, sm = false) {
    delete img.dataset.drive; delete img.dataset.state; delete img.dataset.tries;
    img.dataset.fallback = id; img.dataset.w = w;
    img.src = localDrive(id, sm);
  }
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.fallback && !img.dataset.drive) driveQ.now(img, img.dataset.fallback, img.dataset.w || 1000);
  }, true);

  /* ------------------------------------------------------------------
     RENDER — build every list from data.js
     ------------------------------------------------------------------ */
  const featured = D.projects.filter((p) => p.featured);
  const sorted = [...D.projects].sort((a, b) => b.year - a.year);

  function renderWork() {
    $('.work__track').innerHTML = featured.map((p, i) => `
      <article class="wcard" tabindex="0" role="button" data-project="${p.id}" data-cursor="Open" aria-label="Open case study: ${esc(p.title)}">
        <div class="wcard__media"><img src="${p.hero}" alt="${esc(p.title)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"></div>
        <h3 class="wcard__name">${esc(p.title)}</h3>
      </article>`).join('') + `
      <a class="wcard wcard--end" href="#archive" data-cursor="Archive">
        <span class="mono">+ ${D.projects.length - featured.length} more in the archive</span>
        <b>Full<br>archive</b>
        <svg><use href="#i-arrow"/></svg>
      </a>`;
    $('.timeline__clips').innerHTML = featured.map((p, i) => `<button class="clip" style="--c:${p.accent}" data-clip="${i}" data-cursor="Jump">${esc(p.title)}</button>`).join('') +
      `<button class="clip clip--end" data-clip="${featured.length}" data-cursor="Jump">Archive</button>`;
  }

  function renderArchive() {
    const counts = { all: D.projects.length };
    D.projects.forEach((p) => p.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    $('.filters').innerHTML = D.categories.map((c, i) =>
      `<button class="filter${i === 0 ? ' is-active' : ''}" role="tab" aria-selected="${i === 0}" data-filter="${c.id}">${c.label}<sup>${pad(counts[c.id] || 0)}</sup></button>`).join('');
    $('.archive__list').innerHTML = sorted.map((p, i) => `
      <li class="arow" data-cats="${p.cats.join(' ')}">
        <button class="arow__btn" data-project="${p.id}" data-cursor="View">
          <span class="arow__no mono">${pad(i + 1)}</span>
          <span><span class="arow__title">${esc(p.title)}</span><span class="arow__sub mono">${esc(p.client)} · ${p.year}</span></span>
          <span class="arow__client">${esc(p.client)}</span>
          <span class="arow__kind mono">${esc(p.kind)}</span>
          <span class="arow__year mono">${p.year}</span>
          <svg class="arow__arrow"><use href="#i-arrow"/></svg>
          <img class="arow__thumb" src="${p.cover}" alt="" loading="lazy" decoding="async">
        </button>
      </li>`).join('');
  }

  let mvSource = 'motion';
  let pgmItem = null;
  function renderWall() {
    const list = D[mvSource];
    $('.mv__grid').innerHTML = list.map((v, i) => `
      <button class="tile${i >= 12 ? ' is-extra' : ''}" data-vid="${i}" data-cursor="Play" aria-label="Play ${esc(v.title)}">
        ${dimg(v.id, 960)}
        <span class="mv__name">${esc(v.title)}</span>
      </button>`).join('');
    $('.mv').classList.remove('is-all');
    const more = $('.mv__more');
    more.textContent = `Show all ${list.length}`;
    more.style.display = list.length > 12 ? '' : 'none';
    setPGM(0, false);
  }
  function setPGM(i, cut = true) {
    pgmItem = D[mvSource][i];
    const img = $('.mv__pgm-img');
    setDriveImg(img, pgmItem.id, 1280);
    $('.mv__pgm-title').textContent = pgmItem.title;
    $$('.tile').forEach((t) => t.classList.toggle('is-pgm', +t.dataset.vid === i));
    if (cut && HAS_GSAP && !REDUCED) gsap.fromTo(img, { opacity: 0.25, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
  }

  function renderShowroom() {
    $('.show__list').innerHTML = D.spatial.map((s, i) => `
      <li><button class="show__item" data-set="${i}" aria-label="Show ${esc(s.title)}">
        <span class="mono">${pad(i + 1)}</span><b>${esc(s.title)}</b>
      </button></li>`).join('');
    $('.show__count .mono').textContent = '/ ' + pad(D.spatial.length);
  }

  function renderLoadout() {
    $('.loadout__slots').innerHTML = D.tools.map((t) => `
      <div class="slot">
        <span class="slot__key mono"><b>${t.key}</b></span>
        <span class="slot__abbr">${t.abbr}</span>
        <span><span class="slot__name">${t.name}</span><br><span class="slot__use mono">${t.use}</span></span>
      </div>`).join('');
  }

  function renderRundown() {
    $('.rundown__list').innerHTML = D.career.map((c, i) => `
      <li class="rrow${i === 0 ? ' is-open' : ''}">
        <button class="rrow__btn" aria-expanded="${i === 0}">
          <span class="rrow__seg mono">${pad(i + 1)}</span>
          <span class="rrow__time mono">${esc(c.time || '—')}</span>
          <span class="rrow__role">${esc(c.role)}</span>
          <span class="rrow__house">${esc(c.house)}</span>
          <span class="rrow__fmt mono">${esc(c.format || '—')}</span>
          <span class="rrow__plus" aria-hidden="true"></span>
        </button>
        <div class="rrow__panel" style="${i === 0 ? 'height:auto' : ''}">
          <div class="rrow__panel-in">
            ${c.lead ? `<p class="rrow__lead">${esc(c.lead)}</p>` : ''}
            <ul class="rrow__notes">${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
          </div>
        </div>
      </li>`).join('');
  }

  let reelFrames = [];
  function renderReel() {
    const extra = D.projects.find((p) => p.id === 'wild-rift-1v1');
    reelFrames = [...featured, extra].filter(Boolean).map((p) => ({ src: p.hero, title: p.title }));
    $('.reel__frames').innerHTML = reelFrames.map((f, i) => `<img ${i < 3 ? 'src' : 'data-src'}="${f.src}" alt="" decoding="async">`).join('');
    $('[data-reel-total]').textContent = pad(reelFrames.length);
  }

  /* ------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------ */
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' '));
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$('.w', el);
  }

  let toastT;
  function toast(msg) {
    const t = $('.toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  /* ------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------ */
  function initLenis() {
    if (!window.Lenis || REDUCED) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (HAS_GSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToTarget(target, opts = {}) {
    if (lenis) lenis.scrollTo(target, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else {
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }
  function lockScroll(on) {
    document.body.classList.toggle('is-locked', on);
    if (lenis) on ? lenis.stop() : lenis.start();
  }

  /* ------------------------------------------------------------------
     01 HOME — the showreel window opens to full screen on scroll
     ------------------------------------------------------------------ */
  const stage = $('.hero__stage');
  const reel = $('.reel');
  function frameRect() {
    const sr = stage.getBoundingClientRect();
    const r = $('.hero__frame').getBoundingClientRect();
    return { l: r.left - sr.left, t: r.top - sr.top, w: r.width, h: r.height };
  }
  function setReelStatic() {
    const f = frameRect();
    stage.style.setProperty('--rl', f.l + 'px');
    stage.style.setProperty('--rt', f.t + 'px');
    stage.style.setProperty('--rw', f.w + 'px');
    stage.style.setProperty('--rh', f.h + 'px');
  }

  function startReel() {
    const imgs = $$('.reel__frames img');
    imgs.forEach((im) => { if (im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); } });
    const titleEl = $('[data-reel-title]'), idxEl = $('[data-reel-idx]');
    const frames = $('.reel__frames');
    let idx = 0;
    const show = (i) => {
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      titleEl.textContent = reelFrames[i].title;
      idxEl.textContent = pad(i + 1);
      // a light shake on every cut
      if (!REDUCED && frames.animate && reel.classList.contains('is-shaking')) {
        frames.animate([
          { transform: 'translate(0,0)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' },
          { transform: 'translate(-1px,-1px)' }, { transform: 'translate(1px,1px)' }, { transform: 'translate(0,0)' },
        ], { duration: 320, easing: 'ease-out' });
      }
    };
    show(0);
    setInterval(() => { idx = (idx + 1) % imgs.length; show(idx); }, REDUCED ? 4200 : 2200);
  }

  function initHero() {
    if (!REDUCED) reel.classList.add('is-shaking');
    if (!HAS_GSAP) { setReelStatic(); return; }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.hero', start: 'top top', end: '+=140%', pin: true, scrub: 0.7, invalidateOnRefresh: true,
        onUpdate: (self) => {
          const open = self.progress > 0.02;
          stage.classList.toggle('is-open', open);
          reel.classList.toggle('is-shaking', !open && !REDUCED);
        },
      },
    });
    tl.fromTo(stage,
      { '--rl': () => frameRect().l + 'px', '--rt': () => frameRect().t + 'px', '--rw': () => frameRect().w + 'px', '--rh': () => frameRect().h + 'px' },
      { '--rl': '0px', '--rt': '0px', '--rw': () => stage.clientWidth + 'px', '--rh': () => stage.clientHeight + 'px', ease: 'power2.inOut', duration: 1 }, 0)
      .to('.wordmark', { yPercent: 60, opacity: 0, duration: 0.5, ease: 'power1.in' }, 0)
      .to('.hero__meta, .hero__foot, .hero__lede, .hero__frame', { opacity: 0, duration: 0.3 }, 0)
      .fromTo('.reel__l3, .reel__count', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.2 }, 0.82)
      .to({}, { duration: 0.3 });
  }

  /* ------------------------------------------------------------------
     LOADER → home entrance
     ------------------------------------------------------------------ */
  function runLoader() {
    const loader = $('.loader');
    const finish = () => { document.body.classList.remove('is-loading'); startReel(); };
    if (!HAS_GSAP) { loader.remove(); finish(); return; }

    const word = $('.loader__word'), pct = $('.loader__pct'), bar = $('.loader__bar i');
    const firstImgs = $$('.reel__frames img').slice(0, 3);
    const loaded = Promise.race([
      Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), ...firstImgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; })))]),
      new Promise((r) => setTimeout(r, 4500)),
    ]);

    gsap.set('.wordmark .ch', { yPercent: 110 });
    gsap.set('.hero__meta, .hero__foot, .hero__lede', { opacity: 0, y: 16 });
    gsap.set('.hero__frame', { opacity: 0 });
    gsap.set(stage, { '--shut': '50%' });

    const counter = { v: 0 };
    const render = () => {
      word.style.setProperty('--p', counter.v.toFixed(2) + '%');
      pct.textContent = pad(Math.round(counter.v), 3);
      bar.style.transform = `scaleX(${counter.v / 100})`;
    };
    const countTween = gsap.to(counter, { v: 88, duration: REDUCED ? 0.3 : 1.8, ease: 'power2.inOut', onUpdate: render });

    Promise.all([loaded, new Promise((r) => countTween.eventCallback('onComplete', r))]).then(() => {
      gsap.timeline({ onComplete: () => loader.remove() })
        .to(counter, { v: 100, duration: 0.4, ease: 'power1.out', onUpdate: render })
        .to(word, { scale: 1.04, duration: 0.5, ease: 'power2.out' }, '+=0.1')
        .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.95, ease: 'expo.inOut' }, '-=0.2')
        .add(() => { finish(); homeIntro(); }, '-=0.45');
    });
  }

  function homeIntro() {
    gsap.timeline()
      .to('.wordmark .ch', { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 0)
      .to(stage, { '--shut': '0%', duration: 1.1, ease: 'expo.inOut' }, 0.15)
      .to('.hero__frame', { opacity: 1, duration: 0.5 }, 0.7)
      .to('.hero__meta, .hero__lede, .hero__foot', { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.45);
  }

  /* ------------------------------------------------------------------
     INTRO words + stats
     ------------------------------------------------------------------ */
  function initIntro() {
    const words = splitWords($('.intro__text'));
    if (!HAS_GSAP) return;
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1, stagger: 0.06, ease: 'none',
      scrollTrigger: { trigger: '.intro__text', start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
    // stat numbers: fade + de-blur in when scrolled into view, while counting up
    $$('.stat__num').forEach((el, i) => {
      const to = +el.dataset.count, suf = el.dataset.suffix || '';
      const o = { v: 0 };
      el.textContent = '00' + suf;
      if (!REDUCED) gsap.set(el, { opacity: 0, filter: 'blur(22px)', yPercent: 14 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => {
          if (!REDUCED) gsap.to(el, { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 1.5, ease: 'expo.out', delay: i * 0.15, clearProps: 'filter' });
          gsap.to(o, { v: to, duration: 1.6, ease: 'expo.out', delay: i * 0.15, onUpdate: () => { el.textContent = pad(Math.round(o.v)) + suf; } });
        },
      });
    });
  }

  /* ------------------------------------------------------------------
     02 WORK — horizontal scroll + timeline
     ------------------------------------------------------------------ */
  let workST = null;
  function initWork() {
    const track = $('.work__track');
    const clips = $$('.clip');
    const playhead = $('.timeline__playhead');
    const countEl = $('.timeline__count');
    const clipsBox = $('.timeline__clips');
    const cards = $$('.wcard', track);

    const updateTimeline = (p) => {
      playhead.style.transform = `translateX(${(p * clipsBox.clientWidth).toFixed(1)}px)`;
      const idx = Math.min(cards.length - 1, Math.floor(p * cards.length * 0.999));
      countEl.textContent = idx >= featured.length ? 'Archive' : `${pad(idx + 1)} / ${pad(featured.length)}`;
      clips.forEach((c, i) => c.classList.toggle('is-active', i === idx));
    };

    if (!HAS_GSAP) return;
    gsap.matchMedia().add('(min-width: 761px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.work__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true,
          onUpdate: (self) => updateTimeline(self.progress),
        },
      });
      workST = tween.scrollTrigger;
      $$('.wcard__media', track).forEach((m) => {
        gsap.fromTo(m, { xPercent: -4 }, {
          xPercent: 4, ease: 'none',
          scrollTrigger: { trigger: m.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      updateTimeline(0);
      return () => { workST = null; };
    });

    clipsBox.addEventListener('click', (e) => {
      const c = e.target.closest('.clip'); if (!c || !workST) return;
      const card = cards[+c.dataset.clip];
      const dist = Math.max(1, track.scrollWidth - innerWidth);
      const x = clamp(card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), 0, dist);
      scrollToTarget(workST.start + (x / dist) * (workST.end - workST.start), { duration: 1.2 });
    });
  }

  /* ------------------------------------------------------------------
     03 ARCHIVE — filters + hover preview
     ------------------------------------------------------------------ */
  function initArchive() {
    const rows = $$('.arow');
    $('.filters').addEventListener('click', (e) => {
      const b = e.target.closest('.filter'); if (!b) return;
      $$('.filter').forEach((f) => { f.classList.toggle('is-active', f === b); f.setAttribute('aria-selected', f === b); });
      const id = b.dataset.filter;
      const shown = [];
      rows.forEach((r) => {
        const on = id === 'all' || r.dataset.cats.split(' ').includes(id);
        r.classList.toggle('is-hidden', !on);
        if (on) shown.push(r);
      });
      if (HAS_GSAP && !REDUCED) gsap.fromTo(shown, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.035, ease: 'expo.out' });
      if (HAS_GSAP) ScrollTrigger.refresh();
    });

    if (!FINE || !HAS_GSAP) return;
    const prev = $('.archive__preview');
    const img = $('img', prev);
    const qx = gsap.quickTo(prev, 'x', { duration: 0.55, ease: 'power3' });
    const qy = gsap.quickTo(prev, 'y', { duration: 0.55, ease: 'power3' });
    const list = $('.archive__list');
    let active = false;
    list.addEventListener('mousemove', (e) => { qx(e.clientX); qy(e.clientY); });
    list.addEventListener('mouseover', (e) => {
      const b = e.target.closest('.arow__btn'); if (!b) return;
      const p = D.projects.find((x) => x.id === b.dataset.project);
      if (img.getAttribute('src') !== p.cover) img.src = p.cover;
      if (!active) {
        active = true;
        gsap.set(prev, { x: e.clientX, y: e.clientY });
        gsap.to(prev, { scaleY: 1, opacity: 1, duration: 0.45, ease: 'expo.out', overwrite: 'auto' });
      }
    });
    list.addEventListener('mouseleave', () => {
      active = false;
      gsap.to(prev, { scaleY: 0, opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
    });
  }

  /* ------------------------------------------------------------------
     04 MOTION & VIDEO — monitor wall
     ------------------------------------------------------------------ */
  function initWall() {
    renderWall();
    $('.tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab'); if (!t || t.dataset.src === mvSource) return;
      $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', x === t); });
      mvSource = t.dataset.src;
      renderWall();
      if (HAS_GSAP) {
        if (!REDUCED) gsap.fromTo('.tile', { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: { each: 0.025, from: 'random' } });
        ScrollTrigger.refresh();
      }
    });
    const grid = $('.mv__grid');
    grid.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.tile'); if (!t || !FINE) return;
      const i = +t.dataset.vid;
      if (D[mvSource][i] !== pgmItem) setPGM(i);
    });
    grid.addEventListener('click', (e) => {
      const t = e.target.closest('.tile'); if (!t) return;
      const i = +t.dataset.vid; setPGM(i, false); openVideo(D[mvSource][i]);
    });
    $('.mv__pgm').addEventListener('click', () => pgmItem && openVideo(pgmItem));
    $('.mv__more').addEventListener('click', (e) => {
      const all = $('.mv').classList.toggle('is-all');
      e.currentTarget.textContent = all ? 'Show fewer' : `Show all ${D[mvSource].length}`;
      if (HAS_GSAP) ScrollTrigger.refresh();
    });
  }

  /* ------------------------------------------------------------------
     05 3D — showroom (list · stage · details)
     ------------------------------------------------------------------ */
  function initShowroom() {
    const items = $$('.show__item');
    const main = $('.show__main img');
    const n = D.spatial.length;
    let cur = -1, curImg = 0;

    const showImg = (k, animate = true) => {
      const set = D.spatial[cur];
      curImg = (k + set.images.length) % set.images.length;
      setDriveImg(main, set.images[curImg], 1600);
      main.alt = `${set.title} — render ${curImg + 1}`;
      $$('.show__thumbs button').forEach((b, j) => b.classList.toggle('is-active', j === curImg));
      if (animate && HAS_GSAP && !REDUCED) gsap.fromTo(main, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out', overwrite: true });
    };
    const select = (i, animate = true) => {
      i = (i + n) % n;
      if (i === cur) return;
      cur = i;
      const set = D.spatial[i];
      items.forEach((b, j) => { b.classList.toggle('is-active', j === i); b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      $('.show__num').textContent = pad(i + 1);
      $('.show__title').textContent = set.title;
      $('.show__thumbs').innerHTML = set.images.length > 1
        ? set.images.map((id, k) => `<button aria-label="Render ${k + 1}">${dimg(id, 640, '', true)}</button>`).join('')
        : '';
      showImg(0, animate);
      if (animate && HAS_GSAP && !REDUCED) gsap.fromTo(['.show__num', '.show__title'], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'expo.out', stagger: 0.05, overwrite: true });
      // keep the active chip visible on mobile
      const list = $('.show__list');
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: items[i].parentElement.offsetLeft - 16, behavior: 'smooth' });
    };

    $('.show__list').addEventListener('click', (e) => { const b = e.target.closest('.show__item'); if (b) select(+b.dataset.set); });
    $$('.show__btn').forEach((b) => b.addEventListener('click', () => select(cur + +b.dataset.dir)));
    $('.show__thumbs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showImg($$('.show__thumbs button').indexOf(b)); });
    $('.show__main').addEventListener('click', () => openLightbox(D.spatial[cur], curImg));
    select(0, false);
  }

  /* ------------------------------------------------------------------
     06 ABOUT — 3D tilt + glare on the profile card
     ------------------------------------------------------------------ */
  function initPlayer() {
    const card = $('.pcard');
    if (!card || !FINE || REDUCED) return;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-(y - 0.5) * 11).toFixed(2) + 'deg');
      card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  }

  /* ------------------------------------------------------------------
     07 CAREER accordion
     ------------------------------------------------------------------ */
  function initRundown() {
    let refreshT;
    $('.rundown__list').addEventListener('click', (e) => {
      const btn = e.target.closest('.rrow__btn'); if (!btn) return;
      const row = btn.parentElement, panel = $('.rrow__panel', row);
      const open = !row.classList.contains('is-open');
      row.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open);
      if (HAS_GSAP) {
        gsap.to(panel, { height: open ? 'auto' : 0, duration: 0.6, ease: 'expo.inOut' });
        clearTimeout(refreshT); refreshT = setTimeout(() => ScrollTrigger.refresh(), 650);
      } else panel.style.height = open ? 'auto' : '0';
    });
  }

  /* ------------------------------------------------------------------
     08 CONTACT
     ------------------------------------------------------------------ */
  function initContact() {
    $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const v = b.dataset.copy;
      try { await navigator.clipboard.writeText(v); }
      catch (_) { const t = document.createElement('textarea'); t.value = v; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      toast('Email copied — talk soon');
    }));
    if (HAS_GSAP && !REDUCED) {
      gsap.from('.contact__title .line > span', { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: '.contact__title', start: 'top 82%' } });
    }
  }

  /* ------------------------------------------------------------------
     CASE STUDY overlay
     ------------------------------------------------------------------ */
  const caseEl = $('.case');
  let caseIdx = -1;
  function fillCase(i) {
    const p = sorted[i];
    caseIdx = i;
    $('.case__kind').textContent = `${p.kind} · ${p.year}`;
    $('.case__title').textContent = p.title;
    $('.case__client').textContent = p.client;
    $('.case__year').textContent = p.year;
    $('.case__disc').textContent = p.disciplines.join(', ');
    $('.case__tools').textContent = p.tools.join(', ');
    $('.case__desc').textContent = p.desc;
    $('.case__behance').href = p.behance;
    $('.case__behance2').href = p.behance;
    const heroImg = $('.case__hero img');
    heroImg.src = p.hero; heroImg.alt = `${p.title} — key visual`;
    $('.case__gallery').innerHTML = p.images.filter((s) => s !== p.hero).map((src, k) => {
      const half = /\/(max_1200|1400|disp)/.test(src);
      return `<figure class="${half ? 'is-half' : ''}"><img src="${src}" alt="${esc(p.title)} — image ${k + 1}" loading="lazy" decoding="async"></figure>`;
    }).join('');
    $$('.case__gallery img').forEach((im) => {
      const done = () => {
        im.classList.add('is-loaded');
        if (im.naturalWidth / im.naturalHeight > 2.1) im.parentElement.classList.remove('is-half');
        im.parentElement.style.minHeight = '0';
      };
      if (im.complete && im.naturalWidth) done(); else im.addEventListener('load', done, { once: true });
    });
    $('.case__next-title').textContent = sorted[(i + 1) % sorted.length].title;
    $('.case__scroll').scrollTop = 0;
  }
  function openCase(id) {
    const i = sorted.findIndex((p) => p.id === id);
    if (i < 0) return;
    fillCase(i);
    caseEl.classList.add('is-open');
    caseEl.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    if (HAS_GSAP && !REDUCED) {
      gsap.fromTo(caseEl, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' });
      gsap.fromTo('.case__head > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.45 });
    } else caseEl.style.clipPath = 'none';
    setTimeout(() => $('.case__close').focus({ preventScroll: true }), 50);
  }
  function closeCase() {
    if (!caseEl.classList.contains('is-open')) return;
    const done = () => { caseEl.classList.remove('is-open'); caseEl.setAttribute('aria-hidden', 'true'); lockScroll(false); };
    if (HAS_GSAP && !REDUCED) gsap.to(caseEl, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.75, ease: 'expo.inOut', onComplete: done });
    else done();
  }
  function initCase() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-project]');
      if (t) { e.preventDefault(); openCase(t.dataset.project); }
    });
    $('.work__track').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { const c = e.target.closest('[data-project]'); if (c) { e.preventDefault(); openCase(c.dataset.project); } }
    });
    $('.case__close').addEventListener('click', closeCase);
    $('.case__next').addEventListener('click', () => {
      const n = (caseIdx + 1) % sorted.length;
      if (HAS_GSAP && !REDUCED) {
        gsap.to('.case__scroll', { opacity: 0, duration: 0.3, onComplete: () => {
          fillCase(n);
          gsap.to('.case__scroll', { opacity: 1, duration: 0.4 });
          gsap.fromTo('.case__head > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05 });
        } });
      } else fillCase(n);
    });
  }

  /* ------------------------------------------------------------------
     VIDEO modal
     ------------------------------------------------------------------ */
  const vm = $('.vmodal');
  function openVideo(item) {
    $('.vmodal__title').textContent = item.title;
    $('.vmodal__open').href = D.drive.view(item.id);
    $('iframe', vm).src = D.drive.preview(item.id);
    vm.classList.add('is-open'); vm.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    setTimeout(() => $('.vmodal__close').focus({ preventScroll: true }), 50);
  }
  function closeVideo() {
    if (!vm.classList.contains('is-open')) return;
    vm.classList.remove('is-open'); vm.setAttribute('aria-hidden', 'true');
    setTimeout(() => { $('iframe', vm).src = 'about:blank'; }, 300);
    if (!caseEl.classList.contains('is-open')) lockScroll(false);
  }
  function initVideo() {
    $('.vmodal__close').addEventListener('click', closeVideo);
    vm.addEventListener('click', (e) => { if (e.target === vm) closeVideo(); });
  }

  /* ------------------------------------------------------------------
     LIGHTBOX (3D sets)
     ------------------------------------------------------------------ */
  const lb = $('.lightbox');
  let lbSet = null, lbIdx = 0;
  function showLB(i) {
    lbIdx = (i + lbSet.images.length) % lbSet.images.length;
    const img = $('.lightbox__stage img');
    setDriveImg(img, lbSet.images[lbIdx], 2000);
    img.alt = `${lbSet.title} — render ${lbIdx + 1}`;
    $('.lightbox__count').textContent = `${pad(lbIdx + 1)} / ${pad(lbSet.images.length)}`;
    $$('.lightbox__thumbs button').forEach((b, k) => b.classList.toggle('is-active', k === lbIdx));
    if (HAS_GSAP && !REDUCED) gsap.fromTo(img, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
  }
  function openLightbox(set, start = 0) {
    lbSet = set;
    $('.lightbox__title').textContent = set.title;
    $('.lightbox__thumbs').innerHTML = set.images.map((id, k) => `<button aria-label="Render ${k + 1}">${dimg(id, 640, '', true)}</button>`).join('');
    $$('.lightbox__nav').forEach((b) => (b.style.display = set.images.length < 2 ? 'none' : ''));
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    showLB(start);
  }
  function closeLightbox() {
    if (!lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
    lockScroll(false);
  }
  function initLightbox() {
    $('.lightbox__close').addEventListener('click', closeLightbox);
    $('.lightbox__prev').addEventListener('click', () => showLB(lbIdx - 1));
    $('.lightbox__next').addEventListener('click', () => showLB(lbIdx + 1));
    $('.lightbox__thumbs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showLB($$('.lightbox__thumbs button').indexOf(b)); });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 45) showLB(lbIdx + (dx < 0 ? 1 : -1)); });
  }
  const anyOverlay = () => caseEl.classList.contains('is-open') || vm.classList.contains('is-open') || lb.classList.contains('is-open');

  /* ------------------------------------------------------------------
     TASKBAR — quick jump between pages (click, ← →, keys 1–8)
     ------------------------------------------------------------------ */
  function initTaskbar() {
    const links = $$('.taskbar__items a');
    const targets = links.map((a) => (a.getAttribute('href') === '#top' ? 0 : $(a.getAttribute('href'))));
    const prog = $('.taskbar__progress');
    const [prevBtn, nextBtn] = $$('.taskbar__arrow');
    const itemsBox = $('.taskbar__items');
    let active = 0;

    const setActive = (i) => {
      if (i === active && links[i].classList.contains('is-active')) return;
      active = i;
      links.forEach((a, k) => { a.classList.toggle('is-active', k === i); if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === links.length - 1;
      const a = links[i];
      if (itemsBox.scrollWidth > itemsBox.clientWidth) itemsBox.scrollTo({ left: a.offsetLeft - itemsBox.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
    };
    const go = (i) => { i = clamp(i, 0, links.length - 1); setActive(i); scrollToTarget(targets[i]); };

    links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go(i); }));
    prevBtn.addEventListener('click', () => go(active - 1));
    nextBtn.addEventListener('click', () => go(active + 1));
    document.addEventListener('keydown', (e) => {
      if (anyOverlay() || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (/^[1-8]$/.test(e.key)) go(+e.key - 1);
    });

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${(max > 0 ? clamp(scrollY / max, 0, 1) : 0).toFixed(4)})`;
      document.body.classList.toggle('hud-solid', scrollY > innerHeight * 0.5);
    };
    if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (HAS_GSAP) {
      $$('section[data-step]').forEach((s) => {
        ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setActive(+s.dataset.step - 1) });
      });
    }
    setActive(0);
  }

  /* ------------------------------------------------------------------
     TOP BAR theme + section head reveals + anchors + Esc
     ------------------------------------------------------------------ */
  function initChrome() {
    if (HAS_GSAP) {
      $$('.intro, .player, .contact').forEach((s) => {
        ScrollTrigger.create({ trigger: s, start: 'top top+=30', end: 'bottom top+=30', toggleClass: { targets: document.body, className: 'hud-light' } });
      });
      if (!REDUCED) {
        $$('.sec-head__title').forEach((t) => gsap.from(t, { yPercent: 28, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 88%' } }));
        $$('.sec-head__idx').forEach((t) => gsap.from(t, { opacity: 0, x: -10, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 90%' } }));
      }
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const id = a.getAttribute('href');
      e.preventDefault();
      if (lenis) lenis.start();
      const target = id === '#top' || id === '#' ? 0 : $(id);
      if (target !== null) scrollToTarget(target);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeVideo(); closeLightbox(); closeCase(); }
      if (lb.classList.contains('is-open')) {
        if (e.key === 'ArrowRight') showLB(lbIdx + 1);
        if (e.key === 'ArrowLeft') showLB(lbIdx - 1);
      }
    });
  }

  /* ------------------------------------------------------------------
     CURSOR
     ------------------------------------------------------------------ */
  function initCursor() {
    addEventListener('mousemove', (e) => { state.mouseX = e.clientX; state.mouseY = e.clientY; }, { passive: true });
    if (!FINE) return;
    document.documentElement.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    let rx = state.mouseX, ry = state.mouseY;
    const loop = () => {
      rx = lerp(rx, state.mouseX, 0.18); ry = lerp(ry, state.mouseY, 0.18);
      dot.style.transform = `translate3d(${state.mouseX}px,${state.mouseY}px,0)`;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener('mouseover', (e) => {
      const l = e.target.closest('[data-cursor]');
      const a = e.target.closest('a, button, .filter');
      if (l) { label.textContent = l.dataset.cursor; cur.classList.add('is-label'); cur.classList.remove('is-link'); }
      else { cur.classList.remove('is-label'); cur.classList.toggle('is-link', !!a); }
    });
    document.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cur.classList.remove('is-hidden'));
    vm.addEventListener('mouseover', (e) => { if (e.target.tagName === 'IFRAME') cur.classList.add('is-hidden'); });
    vm.addEventListener('mouseout', (e) => { if (e.target.tagName === 'IFRAME') cur.classList.remove('is-hidden'); });
  }

  /* ------------------------------------------------------------------
     TEXT SPOTLIGHT — a soft red area follows the cursor across text.
     Only the glyphs near the cursor change colour (dark → red, light → red;
     bone on the red Contact section). Each word paints its own radial
     gradient clipped to its glyphs, positioned at the cursor.
     ------------------------------------------------------------------ */
  function initTextSpot() {
    if (!FINE) return;
    const HOSTS = '.wordmark, .hero__lede, .intro__text, .stat__title, .sec-head__title, .player__bio, .player__attrs dd, .rrow__role, .rrow__house, .rrow__lead, .rrow__notes li, .contact__title, .contact__sub, .case__title, .case__desc, .pcard__name';
    const LEAF = '.tx, .w, .ch';
    let host = null, leaves = [], raf = 0;

    const wrap = (root) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (tw.nextNode()) { const n = tw.currentNode; if (n.textContent.trim() && !n.parentElement.closest(LEAF)) nodes.push(n); }
      nodes.forEach((n) => {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
          else { const s = document.createElement('span'); s.className = 'tx'; s.textContent = p; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      });
    };
    const paint = () => {
      raf = 0;
      leaves.forEach((l) => {
        const r = l.getBoundingClientRect();
        l.style.setProperty('--x', (state.mouseX - r.left).toFixed(1) + 'px');
        l.style.setProperty('--y', (state.mouseY - r.top).toFixed(1) + 'px');
      });
    };
    const queue = () => { if (host && !raf) raf = requestAnimationFrame(paint); };
    const on = (h) => {
      clearTimeout(h._spotT);
      wrap(h);
      const ls = $$(LEAF, h);
      ls.forEach((l) => {
        if (l.classList.contains('tx-on')) return;
        l.style.setProperty('--tc', getComputedStyle(l).color);
        l.classList.add('tx-on');
      });
      h.classList.add('spot-host');
      requestAnimationFrame(() => h.style.setProperty('--spot-k', '1'));
      return ls;
    };
    const off = (h, ls) => {
      h.style.setProperty('--spot-k', '0');
      h._spotT = setTimeout(() => {
        ls.forEach((l) => { l.classList.remove('tx-on'); ['--tc', '--x', '--y'].forEach((p) => l.style.removeProperty(p)); });
        h.classList.remove('spot-host');
        h.style.removeProperty('--spot-k');
      }, 400);
    };

    document.addEventListener('mouseover', (e) => {
      const h = e.target.closest ? e.target.closest(HOSTS) : null;
      if (h === host) return;
      if (host) off(host, leaves);
      host = h;
      leaves = h ? on(h) : [];
      queue();
    });
    addEventListener('mousemove', queue, { passive: true });
    if (lenis) lenis.on('scroll', queue); else addEventListener('scroll', queue, { passive: true });
  }

  /* ------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------ */
  function boot() {
    renderWork();
    renderArchive();
    renderShowroom();
    renderLoadout();
    renderRundown();
    renderReel();

    if (HAS_GSAP) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    initLenis();
    initCursor();
    initHero();
    initIntro();
    initWork();
    initArchive();
    initWall();
    initShowroom();
    initPlayer();
    initRundown();
    initContact();
    initCase();
    initVideo();
    initLightbox();
    initTaskbar();
    initChrome();
    initTextSpot();
    runLoader();

    if (HAS_GSAP) {
      addEventListener('load', () => ScrollTrigger.refresh());
      if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
