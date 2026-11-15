// Hiệu ứng học từ tomdekoning.work, viết thuần JS (không thư viện):
// chữ hiện từng ký tự trong khung che · thẻ nổi lên lần lượt khi cuộn · parallax đầu trang · con trỏ chấm tròn.
(function () {
  if (!document.documentElement.classList.contains('fx')) return;
  window.__fx = 1;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SPLIT = '.mega, .ph h1, article h1, h2.sec, .login h1';
  const REVEAL = '.card, .trow, .secbar, .tag, .lead, .masonry a, .album, .gc-head, .gc-stage, .ftrow, .ftcol';

  // ---- tách chữ: từng ký tự nằm trong một khung che, trượt lên khi vào màn hình ----
  function split(el) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            [...part].forEach(c => {
              const m = document.createElement('span'); m.className = 'cm';
              const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i++);
              m.appendChild(s); w.appendChild(m);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
  }

  const io = new IntersectionObserver(es => {
    let k = 0;
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      if (el.matches(SPLIT)) el.classList.add('in');
      else { el.style.transitionDelay = (k++ * 70) + 'ms'; el.classList.add('in'); setTimeout(() => { el.style.transitionDelay = ''; }, 1100); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  function scan() {
    $$(SPLIT).forEach(el => { if (el.dataset.fx) return; el.dataset.fx = '1'; split(el); io.observe(el); });
    $$(REVEAL).forEach(el => { if (el.dataset.fx) return; el.dataset.fx = '1'; el.classList.add('rv'); io.observe(el); });
  }
  window.FX = { scan };
  scan();
  requestAnimationFrame(() => document.documentElement.classList.add('fx-ready'));

  // ---- parallax đầu trang: các phần tử [data-speed] trượt theo cuộn, có làm mượt ----
  const px = $$('[data-speed]');
  if (px.length) {
    let cur = 0, tgt = 0, raf = 0;
    const tick = () => {
      cur += (tgt - cur) * 0.12;
      px.forEach(el => { el.style.transform = `translate3d(0,${(cur * Number(el.dataset.speed)).toFixed(1)}px,0)`; });
      raf = Math.abs(tgt - cur) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('scroll', () => { tgt = Math.min(scrollY, innerHeight * 1.5); if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  }

  // ---- con trỏ: chấm tròn đỏ đi theo chuột, to lên khi chạm vào liên kết (chỉ máy có chuột) ----
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = document.createElement('div'); dot.className = 'cursor-dot'; document.body.appendChild(dot);
    let x = 0, y = 0, cx = 0, cy = 0, on = false;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; if (!on) { on = true; cx = x; cy = y; dot.classList.add('on'); } });
    document.addEventListener('mouseleave', () => { on = false; dot.classList.remove('on'); });
    (function loop() {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      dot.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', e => dot.classList.toggle('big', !!(e.target.closest && e.target.closest('a,button,.card,input,select'))));
  }
})();
