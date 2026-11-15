// Carousel dự án nổi bật (học từ "glass carousel" của tomdekoning.work), viết thuần JS:
// thẻ cong 3D theo vị trí, tên dự án + nhãn ở trên, số thứ tự 01/07 ở dưới.
// Điều khiển: kéo (chuột / ngón tay), cuộn ngang trackpad, nút ‹ ›, phím mũi tên; tự chạy khi không đụng tới.
(function () {
  const root = document.querySelector('.gcar'); if (!root) return;
  const stage = root.querySelector('.gc-stage'), name = root.querySelector('#gcName'), tags = root.querySelector('#gcTags'), no = root.querySelector('#gcNo');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fancy = s => String(s).replace(/[Oo]|[&<>"]/g, m => /[Oo]/.test(m) ? `<span class="o">${m}</span>` : esc(m));
  const slides = () => [...root.querySelectorAll('.gc-slide')];
  const pad = n => String(n).padStart(2, '0');
  const wrap = (d, n) => { d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; };
  let pos = 0, target = 0, last = -1, drag = null, hover = false, seen = false, idle = performance.now(), moved = false;

  function layout() {
    const s = slides(), n = s.length; if (!n) return;
    const w = s[0].offsetWidth, gap = w * 0.8;
    s.forEach((el, i) => {
      const d = wrap(i - pos, n), a = Math.abs(d), hide = a > 2.6;
      el.style.transform = `translate3d(${(d * gap).toFixed(1)}px,0,${(-a * 200).toFixed(1)}px) rotateY(${(-d * 26).toFixed(2)}deg) scale(${(1 - Math.min(a, 3) * 0.05).toFixed(3)})`;
      el.style.opacity = hide ? 0 : 1;
      el.style.zIndex = 100 - Math.round(a * 10);
      el.style.filter = `brightness(${(1 - Math.min(a, 2) * 0.3).toFixed(2)})`;
      el.style.pointerEvents = hide ? 'none' : '';
      el.tabIndex = a < 0.5 ? 0 : -1;
    });
    const k = ((Math.round(pos) % n) + n) % n;
    if (k !== last) {
      last = k; const el = s[k];
      name.innerHTML = fancy(el.dataset.label || ''); tags.textContent = el.dataset.tags || '';
      no.textContent = pad(k + 1) + '/' + pad(n);
      name.classList.remove('sw'); void name.offsetWidth; name.classList.add('sw');
    }
  }
  function tick(now) {
    if (!drag) pos += (target - pos) * (reduce ? 1 : 0.085);
    if (!drag && !hover && seen && !reduce && now - idle > 4200) { target = Math.round(target) + 1; idle = now; }
    layout();
    requestAnimationFrame(tick);
  }
  const go = d => { target = Math.round(target) + d; idle = performance.now(); };
  root.querySelectorAll('.gc-nav').forEach(b => { b.onclick = () => go(+b.dataset.d); });

  // cuộn ngang bằng trackpad (cuộn dọc vẫn cuộn trang như thường)
  stage.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); target += e.deltaX / 380; idle = performance.now();
    clearTimeout(stage._t); stage._t = setTimeout(() => { target = Math.round(target); }, 160);
  }, { passive: false });

  // kéo bằng chuột hoặc ngón tay
  stage.addEventListener('pointerdown', e => { if (e.button) return; drag = { x: e.clientX, p: pos }; moved = false; stage.classList.add('drag'); });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) moved = true;
    pos = drag.p - dx / (slides()[0].offsetWidth * 0.8); target = pos;
  });
  const end = () => { if (!drag) return; drag = null; stage.classList.remove('drag'); target = Math.round(pos); idle = performance.now(); };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('click', e => {
    const a = e.target.closest('.gc-slide'); if (!a) return;
    if (moved) { e.preventDefault(); moved = false; return; }
    const s = slides(), d = wrap(s.indexOf(a) - pos, s.length);
    if (Math.abs(d) > 0.5) { e.preventDefault(); go(Math.round(d)); }   // bấm thẻ bên cạnh: đưa nó vào giữa
  });
  root.addEventListener('mouseenter', () => { hover = true; });
  root.addEventListener('mouseleave', () => { hover = false; idle = performance.now(); });
  root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) idle = performance.now(); }, { threshold: 0.35 }).observe(root);
  requestAnimationFrame(tick);
})();
