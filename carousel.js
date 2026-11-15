// Carousel dự án (học từ "glass carousel" của tomdekoning.work), viết thuần JS + CSS 3D, không thư viện.
// Các thẻ dán lên mặt trong một hình trụ: mỗi thẻ cắt thành nhiều lát dọc, mỗi lát xoay theo góc của nó,
// nên thẻ cong thật và hai bên cao dần ra mép màn hình như trang mẫu. Kéo nhanh thì độ cong tăng nhẹ.
// Tab: Visual Identity (các thương hiệu), Social Media và UX/UI (lấy từ thư viện ấn phẩm, theo album).
(function () {
  const root = document.querySelector('.gcar'); if (!root) return;
  const S = window.SITE || {};
  const stage = root.querySelector('.gc-stage'), track = root.querySelector('.gc-track'), empty = root.querySelector('.gc-empty');
  const nameEl = root.querySelector('#gcName'), tagEl = root.querySelector('#gcTags'), noEl = root.querySelector('#gcNo'), prog = root.querySelector('.gc-prog i');
  const tabs = [...root.querySelectorAll('.gc-tab')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width:640px)').matches;
  const N = small ? 10 : 18;        // số lát mỗi thẻ
  const POOL = 7;                    // số thẻ dựng cùng lúc (giữa ± 3)
  const AUTO = 4800;                 // tự chuyển sau 4,8 giây không đụng tới
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const mod = (a, n) => ((a % n) + n) % n;
  const shade = t => Math.min(0.72, Math.max(0, Math.abs(t) - 0.08) * 0.85);   // càng xa giữa càng tối

  const cats = { visual: [], social: [], uxui: [] };
  try { cats.visual = JSON.parse(root.querySelector('#gcData').textContent); } catch {}
  let cat = 'visual', items = cats.visual;
  let pos = 0, target = 0, vel = 0, prev = 0, cur = -1, drag = null, moved = false, hover = false, seen = false;
  let idle = performance.now(), fade = 1, fadeTo = 1, pending = null;
  let W = 600, H = 400, R = 700, sw = 30;

  // ---------- dựng các thẻ (tái sử dụng 7 thẻ, đổi ảnh khi cuộn) ----------
  const cards = [];
  for (let j = 0; j < POOL; j++) {
    const a = document.createElement('a'); a.className = 'gc-card'; a.draggable = false;
    for (let i = 0; i < N; i++) { const s = document.createElement('span'); s.className = 'gc-sl'; const im = document.createElement('img'); im.alt = ''; im.draggable = false; im.decoding = 'async'; s.appendChild(im); a.appendChild(s); }
    a.firstChild.classList.add('first'); a.lastChild.classList.add('last');
    track.appendChild(a); cards.push({ el: a, sl: [...a.children], k: null });
  }
  function measure() {
    const vw = stage.clientWidth;
    W = Math.min(vw * (small ? 0.8 : 0.58), 860); H = stage.clientHeight; R = W * (small ? 1.05 : 1.2); sw = W / N;
    for (const c of cards) c.sl.forEach((s, i) => {
      s.style.cssText = `left:${(-sw / 2).toFixed(1)}px;top:${(-H / 2).toFixed(1)}px;width:${(sw + 1.2).toFixed(1)}px;height:${H}px;--bx:${(-i * sw).toFixed(1)}px;--bw:${W.toFixed(1)}px`;
      const im = s.firstChild; im.style.cssText = `left:${(-i * sw).toFixed(1)}px;width:${W.toFixed(1)}px;height:${H}px`;
    });
    for (const c of cards) c.k = null;
  }
  addEventListener('resize', () => { measure(); });

  // ---------- tải ảnh: ảnh nhỏ hiện trước, ảnh lớn thay vào khi tải xong ----------
  const cache = new Map();
  const load = url => {
    if (!url) return Promise.resolve();
    if (!cache.has(url)) cache.set(url, new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(url); im.src = url; }));
    return cache.get(url);
  };
  const setSrc = (c, url) => c.sl.forEach(s => { if (s.firstChild.getAttribute('src') !== url) s.firstChild.src = url; });
  function showImage(c, it) {
    c.el.classList.add('ld');                                  // ẩn ảnh cũ ngay, không để thẻ hiện nhầm ảnh của mục trước
    const first = it.thumb || it.cover;
    load(first).then(() => {
      if (c.it !== it) return;
      setSrc(c, first); c.el.classList.remove('ld');
      if (it.thumb && it.cover !== it.thumb) load(it.cover).then(() => { if (c.it === it) setSrc(c, it.cover); });
    });
  }

  // ---------- tiêu đề: từng ký tự trượt lên ----------
  function setTitle(it) {
    if (!it) { nameEl.innerHTML = ''; tagEl.textContent = ''; return; }
    let i = 0;
    nameEl.innerHTML = String(it.title).split(/(\s+)/).map(w => /^\s+$/.test(w) ? ' ' : `<span class="gc-w">${[...w].map(ch => `<span class="gc-c${/[Oo]/.test(ch) ? ' o' : ''}" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join('');
    tagEl.textContent = it.tags || '';
    nameEl.classList.remove('go'); void nameEl.offsetWidth; nameEl.classList.add('go');
    tagEl.classList.remove('go'); void tagEl.offsetWidth; tagEl.classList.add('go');
  }

  // ---------- mỗi khung hình ----------
  function frame(now) {
    const n = items.length, loop = n >= 5;
    if (!drag) pos += (target - pos) * (reduce ? 1 : 0.075);
    if (!loop && n) { const lo = 0, hi = n - 1; if (!drag) { target = Math.max(lo, Math.min(hi, target)); } }
    vel += ((pos - prev) - vel) * 0.25; prev = pos;
    if (!drag && !hover && seen && !reduce && n > 1 && now - idle > AUTO && fadeTo === 1) { target = Math.round(target) + 1; if (!loop && target > n - 1) target = 0; idle = now; }
    if (prog) prog.style.transform = `scaleX(${hover || drag || !seen ? 0 : Math.min(1, (now - idle) / AUTO).toFixed(3)})`;
    fade += (fadeTo - fade) * 0.16;
    track.style.opacity = fade.toFixed(3);

    // độ cong tăng khi kéo nhanh
    const warp = Math.min(Math.abs(vel) * 9, 0.32);
    const Re = R * (1 - warp);
    stage.style.perspective = Re.toFixed(1) + 'px';
    track.style.transform = `translateZ(${Re.toFixed(1)}px) scale(${(0.92 + 0.08 * fade).toFixed(3)})`;
    const A = W / Re, G = 0.07, hs = A / N / 2;   // góc của một thẻ, khe giữa hai thẻ, nửa góc một lát

    const base = Math.round(pos);
    cards.forEach((c, j) => {
      const k = base + j - 3;
      const ok = n && (loop || (k >= 0 && k < n));
      if (!ok) { c.el.style.visibility = 'hidden'; return; }
      c.el.style.visibility = '';
      const idx = mod(k, n), it = items[idx];
      if (c.k !== k || c.it !== it) {
        c.k = k; c.it = it;
        c.el.href = it.href; c.el.dataset.k = k; c.el.setAttribute('aria-label', it.title);
        c.el.style.setProperty('--bg', it.bg || '#f1ede4');
        c.el.classList.toggle('cover', it.fit === 'cover');
        showImage(c, it);
      }
      const phi = (k - pos) * (A + G);
      c.sl.forEach((s, i) => {
        const th = phi + ((i + 0.5) / N - 0.5) * A;
        const at = Math.abs(th);
        if (at > 1.25) { s.style.transform = 'scale(0)'; return; }
        s.style.transform = `rotateY(${(-th).toFixed(4)}rad) translateZ(${(-Re).toFixed(1)}px)`;
        // độ tối nội suy liên tục từ mép trái sang mép phải của lát, không bị sọc
        s.style.setProperty('--s1', shade(th - hs).toFixed(3)); s.style.setProperty('--s2', shade(th + hs).toFixed(3));
      });
      c.el.tabIndex = k === base ? 0 : -1;
    });
    const k0 = n ? mod(Math.round(target), n) : -1;   // tiêu đề theo thẻ sắp vào giữa, đổi ngay khi bấm
    if (k0 !== cur) { cur = k0; setTitle(items[k0]); noEl.textContent = n ? pad(k0 + 1) + '/' + pad(n) : '00/00'; }
    requestAnimationFrame(frame);
  }

  const go = d => { target = Math.round(target) + d; idle = performance.now(); };
  root.querySelectorAll('.gc-nav').forEach(b => { b.onclick = () => go(+b.dataset.d); });

  // ---------- tab phân loại ----------
  let switching = 0;
  function setCat(c) {
    if (c === cat) return;
    const my = ++switching;
    tabs.forEach(t => { const on = t.dataset.cat === c; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    root.classList.add('switching');
    const next = cats[c] || [];
    const ready = Promise.race([Promise.all(next.slice(0, 3).map(it => load(it.thumb || it.cover))), new Promise(r => setTimeout(r, 1200))]);
    fadeTo = 0; target = Math.round(target) + 1.4;           // thẻ cũ lướt sang trái và mờ dần
    Promise.all([ready, new Promise(r => setTimeout(r, 380))]).then(() => {
      if (my !== switching) return;
      cat = c; items = next; cur = -1; cards.forEach(x => { x.k = null; x.it = null; });
      pos = prev = -1.4; target = 0; vel = 0;                  // thẻ mới lướt vào từ bên phải
      empty.hidden = items.length > 0; fadeTo = 1; idle = performance.now();
      root.classList.remove('switching');
    });
  }
  tabs.forEach(t => { t.onclick = () => setCat(t.dataset.cat); });
  function counts() { tabs.forEach(t => { const s = t.querySelector('sup'); if (s) s.textContent = (cats[t.dataset.cat] || []).length; }); }

  // ---------- kéo, cuộn ngang, phím ----------
  stage.addEventListener('wheel', e => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault(); target += dx / 420; idle = performance.now();
    clearTimeout(stage._t); stage._t = setTimeout(() => { target = Math.round(target); }, 150);
  }, { passive: false });
  stage.addEventListener('pointerdown', e => { if (e.button) return; drag = { x: e.clientX, p: pos, t: performance.now() }; moved = false; stage.classList.add('drag'); });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) moved = true;
    pos = drag.p - dx / (W * 0.9); target = pos;
  });
  const end = () => {
    if (!drag) return;
    drag = null; stage.classList.remove('drag');
    target = Math.round(pos + vel * 9);           // quán tính: vuốt nhanh thì trôi thêm
    idle = performance.now();
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('click', e => {
    const a = e.target.closest('.gc-card'); if (!a) return;
    if (moved) { e.preventDefault(); moved = false; return; }
    const d = +a.dataset.k - Math.round(pos);
    if (d) { e.preventDefault(); go(d); }          // bấm thẻ bên cạnh: đưa nó vào giữa
  });
  root.addEventListener('mouseenter', () => { hover = true; });
  root.addEventListener('mouseleave', () => { hover = false; idle = performance.now(); });
  root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) idle = performance.now(); }, { threshold: 0.3 }).observe(stage);

  measure(); empty.hidden = items.length > 0; counts();
  requestAnimationFrame(frame);

  // ---------- dữ liệu Social Media và UX/UI: lấy từ thư viện ấn phẩm (tôn trọng xoá, đổi tên, chuyển nhóm) ----------
  const getJson = async f => { try { const r = await fetch(f + '?t=' + Date.now()); return r.ok ? r.json() : null; } catch { return null; } };
  (async () => {
    const [Rm, g, d, e] = await Promise.all([import('./render.js?v=' + (S.v || '')), getJson('gallery.json'), getJson('deleted.json'), getJson('edits.json')]);
    // dự án thương hiệu đã xoá / đổi tên
    const goneP = new Set((d && d.projects) || []), names = (e && e.brandNames) || {};
    cats.visual = cats.visual.filter(it => !goneP.has(it.slug)).map(it => names[it.slug] ? { ...it, title: names[it.slug] } : it);
    if (cat === 'visual') { items = cats.visual; cur = -1; cards.forEach(x => { x.k = null; }); }
    if (!g) { counts(); return; }
    const view = Rm.compute(g, d || {}, e || {});
    const ux = new RegExp((S.car && S.car.uxui) || 'popup|mini ?game|\\bui\\b|\\bux\\b|screen|màn hình|app ui|website', 'i');
    const skip = new RegExp((S.car && S.car.skip) || '^(demo|untitled folder)$', 'i');
    const vis = new RegExp((S.car && S.car.visual) || 'logo|icon|nhận diện|identity|brand', 'i');
    const albums = new Map();
    for (const grp of view.groups) for (const it of grp.items) {
      const a = (it.album || '').split(' / ')[0].trim(); if (!a || skip.test(a)) continue;
      const key = grp.key + '|' + a;
      if (!albums.has(key)) albums.set(key, { a, grp, list: [] });
      albums.get(key).list.push(it);
    }
    const pretty = a => a.replace(/^\d+\s+(?=\d)/, '').replace(/\b\d{3,5}x\d{3,5}\b\s*/g, '').replace(/\s*\(copy\)\s*/i, '').replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, ' ').trim();
    for (const { a, grp, list } of albums.values()) {
      const it = { href: 'group.html?k=' + encodeURIComponent(grp.key), title: pretty(a) || a, tags: `${grp.label} / ${list.length} ấn phẩm`, cover: 'gallery/' + list[0].id + '.jpg', thumb: 'gallery/' + list[0].id + '-t.jpg', fit: 'contain', bg: '#121211' };
      (ux.test(a) ? cats.uxui : (vis.test(a) || vis.test(grp.label)) ? cats.visual : cats.social).push(it);
    }
    counts();
    if (cat !== 'visual') { items = cats[cat]; cur = -1; empty.hidden = items.length > 0; cards.forEach(x => { x.k = null; }); }
  })();
})();
