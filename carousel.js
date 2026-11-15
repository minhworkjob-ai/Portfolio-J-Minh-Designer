// Carousel dự án bản NHẸ: 5 thẻ dùng lại, mỗi thẻ chỉ một ảnh nhỏ, CSS 3D đơn giản.
// Chỉ chạy khung hình khi đang chuyển động; tự chuyển bằng bộ hẹn giờ và dừng khi ra khỏi màn hình / tab bị ẩn.
// Tab: Visual Identity (thương hiệu), Social Media và UX/UI (lấy từ thư viện ấn phẩm, theo tên album).
(function () {
  const root = document.querySelector('.gcar'); if (!root) return;
  const S = window.SITE || {};
  const stage = root.querySelector('.gc-stage'), track = root.querySelector('.gc-track'), empty = root.querySelector('.gc-empty');
  const nameEl = root.querySelector('#gcName'), tagEl = root.querySelector('#gcTags'), noEl = root.querySelector('#gcNo');
  const tabs = [...root.querySelectorAll('.gc-tab')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const mod = (a, n) => ((a % n) + n) % n;
  const cats = { visual: [], social: [], uxui: [] };
  try { cats.visual = JSON.parse(root.querySelector('#gcData').textContent); } catch {}
  let cat = 'visual', items = cats.visual;
  let pos = 0, target = 0, raf = 0, drag = null, moved = false, seen = false, hover = false, cur = -1, lock = 0;
  let W = 600, step = 500;

  // 5 thẻ dùng lại
  const POOL = 5, cards = [];
  for (let j = 0; j < POOL; j++) {
    const a = document.createElement('a'); a.className = 'gc-card'; a.draggable = false;
    const im = document.createElement('img'); im.alt = ''; im.draggable = false; im.decoding = 'async'; a.appendChild(im);
    track.appendChild(a); cards.push({ el: a, im, k: null, it: null });
  }
  const measure = () => { W = Math.min(stage.clientWidth * (innerWidth < 641 ? 0.74 : 0.5), 640); step = W * 0.86; stage.style.setProperty('--w', W + 'px'); };
  addEventListener('resize', () => { measure(); draw(); });

  function setTitle(it) {
    if (!it) { nameEl.textContent = ''; tagEl.textContent = ''; return; }
    nameEl.innerHTML = String(it.title).replace(/[Oo]|[&<>"]/g, m => /[Oo]/.test(m) ? `<span class="o">${m}</span>` : esc(m));
    tagEl.textContent = it.tags || '';
    root.classList.remove('tt'); void root.offsetWidth; root.classList.add('tt');
  }

  function draw() {
    const n = items.length, base = Math.round(pos);
    cards.forEach((c, j) => {
      const k = base + j - 2, d = k - pos, a = Math.abs(d);
      const ok = n && (n >= 4 || (k >= 0 && k < n)) && a < 2.6;
      if (!ok) { if (c.el.style.visibility !== 'hidden') c.el.style.visibility = 'hidden'; return; }
      c.el.style.visibility = '';
      const it = items[mod(k, n)];
      if (c.it !== it || c.k !== k) {
        if (c.it !== it) { c.im.style.opacity = 0; c.im.src = it.thumb || it.cover; c.el.href = it.href; c.el.setAttribute('aria-label', it.title); c.el.style.setProperty('--bg', it.bg || '#f1ede4'); c.el.classList.toggle('cover', it.fit === 'cover'); }
        c.it = it; c.k = k; c.el.dataset.k = k;
      }
      c.el.style.transform = `translate3d(${(d * step).toFixed(1)}px,0,${(-a * 130).toFixed(0)}px) rotateY(${(-d * 22).toFixed(1)}deg) scale(${(1 - Math.min(a, 2) * 0.05).toFixed(3)})`;
      c.el.style.opacity = Math.max(0, 1 - a * 0.28).toFixed(2);
      c.el.style.zIndex = 10 - Math.round(a * 3);
      c.el.tabIndex = k === base ? 0 : -1;
    });
    const k0 = n ? mod(Math.round(target), n) : -1;
    if (k0 !== cur) { cur = k0; setTitle(items[k0]); noEl.textContent = n ? pad(k0 + 1) + '/' + pad(n) : '00/00'; }
  }
  function loop() {
    if (!drag) pos += (target - pos) * (reduce ? 1 : 0.14);
    if (Math.abs(target - pos) < 0.002 && !drag) { pos = target; draw(); raf = 0; return; }
    draw(); raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const clampT = () => { const n = items.length; if (n < 4) target = Math.max(0, Math.min(Math.max(0, n - 1), target)); };
  const go = d => { target = Math.round(target) + d; clampT(); kick(); };
  root.querySelectorAll('.gc-nav').forEach(b => { b.onclick = () => go(+b.dataset.d); });

  // tab: mờ ra -> đổi dữ liệu -> hiện lại (không chờ tải ảnh, không giữ trạng thái chờ)
  function setCat(c) {
    if (c === cat) return;
    const my = ++lock;
    tabs.forEach(t => { const on = t.dataset.cat === c; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    track.classList.add('out');
    setTimeout(() => {
      if (my !== lock) return;
      cat = c; items = cats[c] || []; pos = target = 0; cur = -1;
      cards.forEach(x => { x.it = null; x.k = null; });
      empty.hidden = items.length > 0; draw();
      requestAnimationFrame(() => track.classList.remove('out'));
    }, 220);
  }
  tabs.forEach(t => { t.onclick = () => setCat(t.dataset.cat); });
  const counts = () => tabs.forEach(t => { const s = t.querySelector('sup'); if (s) s.textContent = (cats[t.dataset.cat] || []).length; });
  cards.forEach(c => { c.im.onload = () => { c.im.style.opacity = 1; }; c.im.onerror = () => { c.im.style.opacity = 1; }; });

  // kéo / cuộn ngang / phím
  stage.addEventListener('wheel', e => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault(); target += dx / 420; clampT(); kick();
    clearTimeout(stage._t); stage._t = setTimeout(() => { target = Math.round(target); clampT(); kick(); }, 150);
  }, { passive: false });
  stage.addEventListener('pointerdown', e => { if (e.button) return; drag = { x: e.clientX, p: pos, t: performance.now() }; moved = false; stage.classList.add('drag'); });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) moved = true;
    pos = drag.p - dx / step; target = pos; kick();
  });
  const end = () => {
    if (!drag) return;
    const dt = Math.max(1, performance.now() - drag.t), v = (drag.p - pos) / dt;     // vận tốc (thẻ / ms)
    drag = null; stage.classList.remove('drag');
    target = Math.round(pos + v * 220); clampT(); kick();
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('click', e => {
    const a = e.target.closest('.gc-card'); if (!a) return;
    if (moved) { e.preventDefault(); moved = false; return; }
    const d = +a.dataset.k - Math.round(pos);
    if (d) { e.preventDefault(); go(d); }
  });
  root.addEventListener('mouseenter', () => { hover = true; });
  root.addEventListener('mouseleave', () => { hover = false; });
  root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  new IntersectionObserver(es => { seen = es[0].isIntersecting; }, { threshold: 0.3 }).observe(stage);
  // tự chuyển mỗi 5 giây khi đang xem, không rê chuột, tab không bị ẩn
  if (!reduce) setInterval(() => { if (seen && !hover && !drag && !document.hidden && items.length > 1) { const n = items.length; target = Math.round(target) + 1; if (n < 4 && target > n - 1) target = 0; kick(); } }, 5000);

  measure(); empty.hidden = items.length > 0; counts(); draw();

  // dữ liệu Social Media và UX/UI: từ thư viện ấn phẩm (tôn trọng xoá, đổi tên, chuyển nhóm)
  const getJson = async f => { try { const r = await fetch(f + '?t=' + Math.floor(Date.now() / 60000)); return r.ok ? r.json() : null; } catch { return null; } };
  (async () => {
    const [Rm, g, d, e] = await Promise.all([import('./render.js?v=' + (S.v || '')), getJson('gallery.json'), getJson('deleted.json'), getJson('edits.json')]);
    const goneP = new Set((d && d.projects) || []), names = (e && e.brandNames) || {};
    cats.visual = cats.visual.filter(it => !goneP.has(it.slug)).map(it => names[it.slug] ? { ...it, title: names[it.slug] } : it);
    if (cat === 'visual') { items = cats.visual; cur = -1; cards.forEach(x => { x.it = null; }); }
    if (g) {
      const view = Rm.compute(g, d || {}, e || {});
      const ux = new RegExp((S.car && S.car.uxui) || 'popup|mini ?game|\\bui\\b|\\bux\\b|screen|màn hình|app ui|website', 'i');
      const vis = new RegExp((S.car && S.car.visual) || 'logo|icon|nhận diện|identity|brand', 'i');
      const skip = new RegExp((S.car && S.car.skip) || '^(demo|untitled folder)$', 'i');
      const albums = new Map();
      for (const grp of view.groups) for (const it of grp.items) {
        const a = (it.album || '').split(' / ')[0].trim(); if (!a || skip.test(a)) continue;
        const key = grp.key + '|' + a;
        if (!albums.has(key)) albums.set(key, { a, grp, list: [] });
        albums.get(key).list.push(it);
      }
      const pretty = a => a.replace(/^\d+\s+(?=\d)/, '').replace(/\b\d{3,5}x\d{3,5}\b\s*/g, '').replace(/\s*\(copy\)\s*/i, '').replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, ' ').trim();
      for (const { a, grp, list } of albums.values()) {
        const it = { href: 'group.html?k=' + encodeURIComponent(grp.key), title: pretty(a) || a, tags: `${grp.label} / ${list.length} ấn phẩm`, cover: 'gallery/' + list[0].id + '-t.jpg', fit: 'contain', bg: '#121211' };
        (ux.test(a) ? cats.uxui : (vis.test(a) || vis.test(grp.label)) ? cats.visual : cats.social).push(it);
      }
    }
    counts();
    if (cat !== 'visual') { items = cats[cat]; cur = -1; empty.hidden = items.length > 0; cards.forEach(x => { x.it = null; }); }
    draw();
  })();
})();
