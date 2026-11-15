// Menu, ẩn mục đã xoá, đăng nhập bằng GitHub token, xoá vào thùng rác (giữ 15 ngày), khôi phục, xoá hẳn,
// đổi tên, sắp xếp lại, gộp nhóm và chuyển ấn phẩm giữa các nhóm.
// Không có máy chủ: "đăng nhập" = dán token GitHub của chủ repo. Không có token hợp lệ thì không có nút sửa nào.
(function () {
  const S = window.SITE || {};
  const KEEP_DAYS = 15;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'jm_token';
  const getToken = () => { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
  const setToken = (t, remember) => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); (remember ? localStorage : sessionStorage).setItem(KEY, t); } catch {} };
  const clearToken = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch {} };
  const toast = (m, ms = 4000) => { const t = $('#toast'); if (!t) return alert(m); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const mixTitle = s => String(s).replace(/[Oo]|[&<>"]/g, m => /[Oo]/.test(m) ? `<span class="o">${m}</span>` : esc(m));
  const PAGE = document.body.dataset.page || '';
  const PID = document.body.dataset.pid || '';
  const SYNC = 'Web cập nhật sau khoảng 1 phút.';

  const normDel = d => ({ projects: (d && d.projects) || [], months: (d && d.months) || [], images: (d && d.images) || [], trash: (d && d.trash) || [] });
  const normEd = d => {
    const e = { brandNames: {}, brandOrder: [], groupNames: {}, groupOrder: [], groupNew: {}, groupMerged: {}, imageGroup: {}, imageOrder: {} };
    for (const k of Object.keys(e)) if (d && d[k] && typeof d[k] === typeof e[k]) e[k] = d[k];
    return e;
  };
  const state = { del: normDel({}), edits: normEd({}), gdata: null, groups: [], admin: false };

  // ---- hộp thoại: xác nhận / nhập tên / chọn nhóm. Luôn hiện trước khi xoá hay gộp. Trả về null nếu huỷ ----
  function dialog({ title, text = '', ok = 'OK', danger = true, input, select }) {
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'modal on';
      const field = input ? `<input class="fld" type="text" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" maxlength="120">`
        : select ? `<select class="fld">${select.map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('')}</select>` : '';
      o.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${field}<div class="acts"><button type="button" class="btn ghost" data-r="0">Huỷ</button><button type="button" class="btn${danger ? '' : ' safe'}" data-r="1">${esc(ok)}</button></div></div>`;
      const f = $('.fld', o);
      const done = v => { o.remove(); removeEventListener('keydown', key); res(v); };
      const submit = () => { if (input) { const v = f.value.trim(); if (!v) { f.focus(); return; } done(v); } else if (select) done(f.value); else done(true); };
      const key = e => { if (e.key === 'Escape') done(null); else if (e.key === 'Enter' && input) { e.preventDefault(); submit(); } };
      o.onclick = e => { if (e.target === o) done(null); const r = e.target.dataset && e.target.dataset.r; if (r === '0') done(null); else if (r === '1') submit(); };
      addEventListener('keydown', key); document.body.appendChild(o);
      if (input) { f.focus(); f.select(); } else $('[data-r="0"]', o).focus();
    });
  }
  const ask = async o => (await dialog(o)) === true;

  // ---- menu ----
  const menu = $('#menu'), btn = $('#menubtn');
  if (btn) btn.onclick = () => { const on = menu.classList.toggle('on'); $('span', btn).textContent = on ? 'Đóng' : 'Menu'; };
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu) { menu.classList.remove('on'); if (btn) $('span', btn).textContent = 'Menu'; } });

  // ---- GitHub API ----
  const API = 'https://api.github.com';
  async function gh(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + getToken(), 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) } });
    if (!r.ok) { let m = r.status + ''; try { m = (await r.json()).message || m; } catch {} const e = new Error(m); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  const b64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
  const toB64 = s => { let b = ''; new TextEncoder().encode(s).forEach(c => { b += String.fromCharCode(c); }); return btoa(b); };
  // mọi thay đổi ghi vào repo đi lần lượt, không chồng lên nhau
  let chain = Promise.resolve();
  const serial = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };

  async function checkToken() {
    const repo = await gh(`/repos/${S.repo}`);
    if (!repo.permissions || !repo.permissions.push) throw new Error('Token này không có quyền ghi vào repo.');
    return repo;
  }
  // chỉ coi là "chưa có file" khi GitHub báo 404; lỗi khác thì dừng, tránh ghi đè nhầm
  async function apiJson(file, norm) {
    try { return norm(JSON.parse(b64((await gh(`/repos/${S.repo}/contents/${S.out}/${file}?ref=${S.branch}`)).content))); }
    catch (e) { if (e.status === 404) return norm({}); throw e; }
  }
  const readDeleted = () => apiJson('deleted.json', normDel);
  const LIST = { p: 'projects', m: 'months', i: 'images' };

  // một commit: sửa deleted.json + di chuyển / xoá file
  const commitChange = (message, mutate) => serial(async () => {
    const del = await readDeleted();
    const ref = await gh(`/repos/${S.repo}/git/ref/heads/${S.branch}`);
    const base = await gh(`/repos/${S.repo}/git/commits/${ref.object.sha}`);
    const full = await gh(`/repos/${S.repo}/git/trees/${base.tree.sha}?recursive=1`);
    const sha = new Map(full.tree.filter(t => t.type === 'blob').map(t => [t.path, t.sha]));
    const entries = [];
    const move = (from, to) => { const s = sha.get(from); if (!s) return false; entries.push({ path: to, mode: '100644', type: 'blob', sha: s }, { path: from, mode: '100644', type: 'blob', sha: null }); return true; };
    const drop = from => { if (!sha.has(from)) return false; entries.push({ path: from, mode: '100644', type: 'blob', sha: null }); return true; };
    mutate(del, { move, drop, has: p => sha.has(p) });
    entries.unshift({ path: `${S.out}/deleted.json`, mode: '100644', type: 'blob', content: JSON.stringify(del, null, 2) + '\n' });
    const tree = await gh(`/repos/${S.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: entries }) });
    const commit = await gh(`/repos/${S.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }) });
    await gh(`/repos/${S.repo}/git/refs/heads/${S.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    state.del = del;
    return del;
  });

  // sửa edits.json (tên, thứ tự, gộp, chuyển): đọc bản mới nhất, áp thay đổi, ghi lại; trùng phiên bản thì thử lại
  const saveEdits = (message, mutate) => serial(async () => {
    for (let t = 0; ; t++) {
      let sha, cur;
      try { const f = await gh(`/repos/${S.repo}/contents/${S.out}/edits.json?ref=${S.branch}`); sha = f.sha; cur = normEd(JSON.parse(b64(f.content))); }
      catch (e) { if (e.status !== 404) throw e; cur = normEd({}); }
      mutate(cur);
      const body = { message, branch: S.branch, content: toB64(JSON.stringify(cur, null, 2) + '\n') };
      if (sha) body.sha = sha;
      try { await gh(`/repos/${S.repo}/contents/${S.out}/edits.json`, { method: 'PUT', body: JSON.stringify(body) }); state.edits = cur; return cur; }
      catch (e) { if ((e.status === 409 || e.status === 422) && t < 2) continue; throw e; }
    }
  });
  const fail = (e, what = 'Không thực hiện được') => {
    if (e && e.status === 401) { clearToken(); toast('Token hết hạn, hãy đăng nhập lại.'); }
    else toast(what + ': ' + (e && e.message), 6000);
  };

  // chuyển vào thùng rác: file sang _trash/<khoá>/ (nằm ngoài thư mục web)
  const trashItem = (type, id, files, label) => commitChange(`Thùng rác: ${label}`, (del, o) => {
    const key = `${type}-${id}`; const kept = [];
    for (const f of files) if (o.move(`${S.out}/${f}`, `_trash/${key}/${f}`)) kept.push(f);
    if (!del[LIST[type]].includes(id)) del[LIST[type]].push(id);
    del.trash = del.trash.filter(t => t.key !== key);
    del.trash.push({ key, type, id, label, deletedAt: new Date().toISOString(), files: kept });
  });
  const restoreItem = rec => commitChange(`Khôi phục: ${rec.label}`, (del, o) => {
    for (const f of rec.files) o.move(`_trash/${rec.key}/${f}`, `${S.out}/${f}`);
    del[LIST[rec.type]] = del[LIST[rec.type]].filter(x => x !== rec.id);
    del.trash = del.trash.filter(t => t.key !== rec.key);
  });
  const purgeItems = (recs, why) => commitChange(`${why}: ${recs.map(r => r.label).join(', ').slice(0, 120)}`, (del, o) => {
    for (const rec of recs) { for (const f of rec.files) o.drop(`_trash/${rec.key}/${f}`); del.trash = del.trash.filter(t => t.key !== rec.key); }
  });
  const daysLeft = rec => Math.ceil((new Date(rec.deletedAt).getTime() + KEEP_DAYS * 864e5 - Date.now()) / 864e5);

  // =====================================================================
  //  Hiển thị: dự án (thẻ có sẵn trong trang) + nhóm sản phẩm (dựng từ gallery.json)
  // =====================================================================
  const rendererP = (PAGE === 'gallery' || PAGE === 'group') ? import('./render.js') : null;
  const getJson = async f => { try { const r = await fetch(f + '?t=' + Date.now()); return r.ok ? r.json() : null; } catch { return null; } };

  const slugOf = c => c.dataset.id.slice(2);
  const pad = n => String(n).padStart(2, '0');
  function renumber() {
    const cs = $$('#g .card[data-id^="p:"]');
    cs.forEach((c, i) => { const no = $('.no', c); if (no) no.textContent = pad(i + 1) + '/' + pad(cs.length); });
    const n = $('#n'); if (n && !$('#q').value) n.textContent = cs.length + ' dự án';
  }

  function applyBrands() {
    const { del, edits: ed } = state;
    const gone = new Set(del.projects);
    $$('[data-id^="p:"]').forEach(e => { if (gone.has(slugOf(e))) e.remove(); });
    if (PID && gone.has(PID)) { location.replace('index.html'); return; }
    $$('.gc-slide[data-id^="p:"]').forEach(s => { const n = ed.brandNames[slugOf(s)]; if (n) s.dataset.label = n; });
    $$('.card[data-id^="p:"]').forEach(c => {
      const n = ed.brandNames[slugOf(c)];
      if (n) { $('h3', c).textContent = n; c.dataset.label = n; if (!c.dataset.q0) c.dataset.q0 = c.dataset.q || ''; c.dataset.q = (n + ' ' + c.dataset.q0).toLowerCase(); }
    });
    if (PID && ed.brandNames[PID]) { const h = $('article h1'); if (h) h.innerHTML = mixTitle(ed.brandNames[PID]); document.title = ed.brandNames[PID] + ' · ' + (S.title || ''); }
    const g = $('#g');
    if (g && ed.brandOrder.length) {
      const cards = $$('.card', g), rank = new Map(ed.brandOrder.map((k, i) => [k, i])), at = new Map(cards.map((c, i) => [c, i]));
      const rk = c => rank.has(slugOf(c)) ? rank.get(slugOf(c)) : 1e6 + at.get(c);
      cards.sort((a, b) => rk(a) - rk(b)).forEach(c => g.appendChild(c));
    }
    renumber();
  }

  async function renderGallery() {
    if (!rendererP || !state.gdata) return;
    const R = await rendererP;
    const view = R.compute(state.gdata, state.del, state.edits, { showEmpty: state.admin });
    state.groups = view.groups; state.view = view;
    if (PAGE === 'gallery') {
      const el = $('#gal'); if (!el) return;
      el.innerHTML = R.indexHtml(view.groups);
      const sub = $('#galsub'); if (sub) sub.textContent = `${view.total} sản phẩm, sắp xếp theo nhóm. Bấm vào một nhóm để xem, bấm vào ảnh để phóng to.`;
    } else {
      const el = $('#grp'); if (!el) return;
      const k = new URLSearchParams(location.search).get('k');
      const g = view.groups.find(x => x.key === k);
      if (!g) { el.innerHTML = '<a class="back" href="gallery.html">← Tất cả nhóm</a><p class="sub" style="padding-top:24px">Không tìm thấy nhóm này. Có thể nó đã bị xoá, gộp hoặc đổi chỗ.</p>'; return; }
      el.innerHTML = R.groupHtml(g);
      document.title = g.label + ' · ' + (S.title || '');
    }
  }

  const curKey = () => new URLSearchParams(location.search).get('k');
  async function refresh() { applyBrands(); await renderGallery(); decorate(); if (window.FX) FX.scan(); else addEventListener('load', () => window.FX && FX.scan()); }

  // =====================================================================
  //  Chế độ quản trị
  // =====================================================================
  const deb = (k, fn, ms = 700) => { clearTimeout(deb[k]); deb[k] = setTimeout(fn, ms); };

  // kéo thả (máy tính). Điện thoại dùng nút ‹ › và chế độ chọn ảnh.
  let dragEl = null;
  function sortable(items, axis, onDrop) {
    items.forEach(el => {
      if (el.dataset.dnd) return; el.dataset.dnd = '1'; el.draggable = true;
      const clear = () => $$('.dropb,.dropa').forEach(x => x.classList.remove('dropb', 'dropa', 'y'));
      const after = e => { const r = el.getBoundingClientRect(); return axis === 'y' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2; };
      el.addEventListener('dragstart', e => { dragEl = el; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'x'); } catch {} });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); clear(); dragEl = null; });
      el.addEventListener('dragover', e => {
        if (!dragEl || dragEl === el || dragEl.parentNode !== el.parentNode) return;
        e.preventDefault(); clear(); el.classList.add(after(e) ? 'dropa' : 'dropb'); if (axis === 'y') el.classList.add('y');
      });
      el.addEventListener('drop', e => {
        if (!dragEl || dragEl === el || dragEl.parentNode !== el.parentNode) return;
        e.preventDefault(); const a = after(e); clear();
        el.parentNode.insertBefore(dragEl, a ? el.nextSibling : el); onDrop();
      });
    });
  }
  function nudge(el, dir) {
    const sib = e => dir < 0 ? e.previousElementSibling : e.nextElementSibling;
    let n = sib(el); while (n && n.style.display === 'none') n = sib(n);
    if (!n) return false;
    el.parentNode.insertBefore(el, dir < 0 ? n : n.nextSibling); return true;
  }
  function addCtl(el, { move, rename, merge }) {
    if ($('.ctl', el)) return;
    const bar = document.createElement('div'); bar.className = 'ctl';
    bar.innerHTML = `${move ? '<button type="button" data-a="l" title="Đưa lên trước">‹</button><button type="button" data-a="r" title="Đưa ra sau">›</button>' : ''}<button type="button" data-a="n">Đổi tên</button>${merge ? '<button type="button" data-a="m">Gộp</button>' : ''}`;
    bar.onclick = ev => {
      ev.preventDefault(); ev.stopPropagation();
      const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
      if (a === 'l' || a === 'r') { if (nudge(el, a === 'l' ? -1 : 1)) move(); } else if (a === 'n') rename(); else if (a === 'm') merge();
    };
    el.appendChild(bar);
  }

  // ---- đổi tên dự án ----
  async function renameBrand(slug, cur) {
    const v = await dialog({ title: 'Đổi tên dự án', ok: 'Lưu', danger: false, input: { value: cur } });
    if (v === null || v === cur) return;
    try { await saveEdits(`Đổi tên dự án: ${v}`, ed => { ed.brandNames[slug] = v; }); applyBrands(); toast('Đã đổi tên. ' + SYNC); }
    catch (e) { fail(e, 'Không đổi được tên'); }
  }
  const brandKeys = () => $$('#g .card[data-id^="p:"]').map(slugOf);
  function saveBrandOrder() {
    renumber();
    deb('brand', () => saveEdits('Sắp xếp lại thứ tự dự án', ed => { ed.brandOrder = brandKeys(); }).then(() => toast('Đã lưu thứ tự. ' + SYNC)).catch(e => fail(e, 'Không lưu được thứ tự')));
  }
  function decorateBrands() {
    $$('#g .card[data-id^="p:"]').forEach(c => addCtl(c, { move: saveBrandOrder, rename: () => renameBrand(slugOf(c), c.dataset.label), merge: null }));
    sortable($$('#g .card[data-id^="p:"]'), 'x', saveBrandOrder);
    const art = $('article');
    if (PID && art && !$('.ren-page')) {
      const b = document.createElement('button'); b.className = 'btn ghost ren-page'; b.type = 'button'; b.textContent = 'Đổi tên dự án';
      b.onclick = () => renameBrand(PID, $('h1', art).textContent);
      art.appendChild(b);
    }
  }

  // ---- nhóm sản phẩm ----
  const nImgs = k => (state.groups.find(g => g.key === k) || { items: [] }).items.length;
  async function renameGroup(key, cur) {
    const v = await dialog({ title: 'Đổi tên nhóm', ok: 'Lưu', danger: false, input: { value: cur } });
    if (v === null || v === cur) return;
    try { await saveEdits(`Đổi tên nhóm: ${v}`, ed => { ed.groupNames[key] = v; }); await refresh(); toast('Đã đổi tên. ' + SYNC); }
    catch (e) { fail(e, 'Không đổi được tên'); }
  }
  async function newGroup() {
    const v = await dialog({ title: 'Nhóm mới', text: 'Nhóm trống, sau đó bạn chuyển ấn phẩm vào.', ok: 'Tạo nhóm', danger: false, input: { placeholder: 'Tên nhóm' } });
    if (v === null) return;
    const key = 'n-' + (slugify(v) || 'nhom') + '-' + Date.now().toString(36);
    try { await saveEdits(`Tạo nhóm: ${v}`, ed => { ed.groupNew[key] = v; }); await refresh(); toast('Đã tạo nhóm "' + v + '". ' + SYNC); }
    catch (e) { fail(e, 'Không tạo được nhóm'); }
  }
  async function mergeGroup(key, label) {
    const others = state.groups.filter(g => g.key !== key);
    if (!others.length) return toast('Chưa có nhóm nào khác để gộp vào.');
    const to = await dialog({ title: `Gộp "${label}"`, text: `Toàn bộ <b>${nImgs(key)}</b> ấn phẩm của nhóm này sẽ chuyển sang nhóm bạn chọn, rồi nhóm <b>${esc(label)}</b> biến mất.`, ok: 'Gộp nhóm', select: others.map(g => ({ value: g.key, label: `${g.label} (${g.items.length})` })) });
    if (!to) return;
    try {
      await saveEdits(`Gộp nhóm: ${label}`, ed => {
        if (to === key) return;
        for (const k of Object.keys(ed.groupMerged)) if (ed.groupMerged[k] === key) ed.groupMerged[k] = to;
        ed.groupMerged[key] = to;
        ed.groupOrder = ed.groupOrder.filter(k => k !== key);
      });
      if (PAGE === 'group') { location.href = 'group.html?k=' + encodeURIComponent(to); return; }
      await refresh(); toast('Đã gộp. ' + SYNC);
    } catch (e) { fail(e, 'Không gộp được'); }
  }
  const groupKeys = () => $$('.cgrid .card[data-key]').map(c => c.dataset.key);
  function saveGroupOrder() {
    deb('group', () => saveEdits('Sắp xếp lại thứ tự nhóm', ed => { ed.groupOrder = groupKeys(); }).then(() => toast('Đã lưu thứ tự. ' + SYNC)).catch(e => fail(e, 'Không lưu được thứ tự')));
  }

  // chuyển ấn phẩm sang nhóm khác (nhiều ảnh một lúc)
  async function moveImages(ids) {
    const from = curKey();
    const opts = state.groups.filter(g => g.key !== from).map(g => ({ value: g.key, label: `${g.label} (${g.items.length})` }));
    opts.push({ value: '__new__', label: '＋ Tạo nhóm mới…' });
    let to = await dialog({ title: `Chuyển ${ids.length} ấn phẩm`, text: 'Chọn nhóm đích. Ấn phẩm sẽ nằm ở cuối nhóm đó.', ok: 'Chuyển', danger: false, select: opts });
    if (!to) return;
    let newName = null;
    if (to === '__new__') {
      newName = await dialog({ title: 'Nhóm mới', ok: 'Tạo và chuyển', danger: false, input: { placeholder: 'Tên nhóm' } });
      if (newName === null) return;
      to = 'n-' + (slugify(newName) || 'nhom') + '-' + Date.now().toString(36);
    }
    try {
      await saveEdits(`Chuyển ${ids.length} ấn phẩm`, ed => { if (newName) ed.groupNew[to] = newName; for (const id of ids) ed.imageGroup[id] = to; });
      setSelecting(false); await refresh(); toast(`Đã chuyển ${ids.length} ấn phẩm. ${SYNC}`);
    } catch (e) { fail(e, 'Không chuyển được'); }
  }
  const imgOrder = () => $$('.masonry a[data-id]').map(a => a.dataset.id.slice(2));
  function saveImageOrder() {
    const key = curKey(), order = imgOrder();
    deb('img', () => saveEdits('Sắp xếp lại ấn phẩm', ed => { ed.imageOrder[key] = order; }).then(() => toast('Đã lưu thứ tự. ' + SYNC)).catch(e => fail(e, 'Không lưu được thứ tự')));
  }

  // chế độ chọn ảnh
  const sel = new Set();
  let selbar = null;
  function updSelbar() {
    if (!selbar) return;
    selbar.classList.toggle('on', document.body.classList.contains('selecting'));
    $('#selcount', selbar).textContent = `Đã chọn ${sel.size}`;
    $$('[data-s="move"],[data-s="top"],[data-s="end"]', selbar).forEach(b => { b.disabled = !sel.size; });
  }
  function setSelecting(on) {
    document.body.classList.toggle('selecting', on);
    if (!on) sel.clear();
    $$('.masonry a').forEach(a => a.classList.toggle('picked', sel.has(a.dataset.id.slice(2))));
    const t = $('#selbtn'); if (t) t.textContent = on ? 'Thoát chọn ảnh' : 'Chọn ảnh';
    updSelbar();
  }
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('selecting')) return;
    const a = e.target.closest && e.target.closest('.masonry a'); if (!a) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const id = a.dataset.id.slice(2);
    if (sel.has(id)) { sel.delete(id); a.classList.remove('picked'); } else { sel.add(id); a.classList.add('picked'); }
    updSelbar();
  }, true);
  function ensureSelbar() {
    if (selbar) return;
    selbar = document.createElement('div'); selbar.className = 'selbar';
    selbar.innerHTML = '<span id="selcount"></span><button class="btn" data-s="move">Chuyển tới…</button><button class="btn ghost" data-s="top">Lên đầu</button><button class="btn ghost" data-s="end">Xuống cuối</button><button class="btn ghost" data-s="all">Chọn tất cả</button><button class="btn ghost" data-s="done">Xong</button>';
    selbar.onclick = async e => {
      const a = e.target.dataset && e.target.dataset.s; if (!a) return;
      if (a === 'done') return setSelecting(false);
      if (a === 'all') { $$('.masonry a[data-id]').forEach(x => sel.add(x.dataset.id.slice(2))); return setSelecting(true); }
      if (a === 'move') return moveImages([...sel]);
      const ids = imgOrder(), pick = ids.filter(i => sel.has(i)), rest = ids.filter(i => !sel.has(i)), key = curKey();
      const order = a === 'top' ? [...pick, ...rest] : [...rest, ...pick];
      try { await saveEdits('Sắp xếp lại ấn phẩm', ed => { ed.imageOrder[key] = order; }); await refresh(); toast('Đã sắp xếp. ' + SYNC); }
      catch (er) { fail(er, 'Không sắp xếp được'); }
    };
    document.body.appendChild(selbar);
  }

  function decorateGallery() {
    if (PAGE === 'gallery') {
      const tools = $('#gtools');
      if (tools && !tools.firstChild) { tools.innerHTML = '<button class="btn" type="button">＋ Nhóm mới</button>'; tools.firstChild.onclick = newGroup; }
      $$('.cgrid .card[data-key]').forEach(c => addCtl(c, { move: saveGroupOrder, rename: () => renameGroup(c.dataset.key, c.dataset.label), merge: () => mergeGroup(c.dataset.key, c.dataset.label) }));
      $$('.cgrid').forEach(g => sortable($$('.card[data-key]', g), 'x', saveGroupOrder));
    } else if (PAGE === 'group') {
      const key = curKey(), g = state.groups.find(x => x.key === key); if (!g) return;
      const tools = $('#gtools');
      if (tools && !tools.firstChild) {
        tools.innerHTML = '<button class="btn ghost" type="button" data-t="ren">Đổi tên nhóm</button><button class="btn ghost" type="button" data-t="mer">Gộp vào nhóm khác</button><button class="btn ghost" type="button" id="selbtn" data-t="sel">Chọn ảnh</button><button class="btn" type="button" data-t="del">Xoá cả nhóm</button>';
        tools.onclick = async e => {
          const t = e.target.dataset && e.target.dataset.t; if (!t) return;
          if (t === 'ren') renameGroup(key, g.label);
          else if (t === 'mer') mergeGroup(key, g.label);
          else if (t === 'sel') setSelecting(!document.body.classList.contains('selecting'));
          else if (t === 'del') {
            const files = g.items.flatMap(it => [`gallery/${it.id}.jpg`, `gallery/${it.id}-t.jpg`]);
            if (!await ask({ title: 'Xoá cả nhóm?', text: `<b>${esc(g.label)}</b> cùng ${g.items.length} ấn phẩm sẽ được chuyển vào Thùng rác và giữ ${KEEP_DAYS} ngày.`, ok: 'Chuyển vào thùng rác' })) return;
            try { await trashItem('m', key, files, g.label); location.href = 'gallery.html'; } catch (er) { fail(er, 'Không xoá được'); }
          }
        };
      }
      ensureSelbar(); setSelecting(document.body.classList.contains('selecting'));
      $$('.masonry').forEach(m => sortable($$('a[data-id]', m), 'y', saveImageOrder));
    }
  }

  // ---- nút xoá (luôn có hộp thoại hỏi trước) ----
  function addButtons() {
    $$('[data-id][data-files]').forEach(el => {
      if ($('.del', el)) return;
      const b = document.createElement('button');
      b.className = 'del'; b.type = 'button'; b.textContent = 'Xoá';
      b.onclick = async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const [type, ...rest] = el.dataset.id.split(':'); const id = rest.join(':');
        const label = el.dataset.label || id;
        const files = el.dataset.files.split(',').filter(Boolean);
        const what = type === 'p' ? 'dự án' : type === 'm' ? `cả nhóm (${files.length / 2} ấn phẩm)` : 'ấn phẩm';
        if (!await ask({ title: `Xoá ${what}?`, text: `<b>${esc(label)}</b> sẽ được chuyển vào Thùng rác và giữ ${KEEP_DAYS} ngày. Trong thời gian đó bạn khôi phục được; sau đó sẽ bị xoá hẳn.`, ok: 'Chuyển vào thùng rác' })) return;
        b.disabled = true; b.textContent = '…';
        try { await trashItem(type, id, files, label); await refresh(); toast('Đã chuyển vào Thùng rác. ' + SYNC); }
        catch (e) { b.disabled = false; b.textContent = 'Xoá'; fail(e, 'Không xoá được'); }
      };
      el.appendChild(b);
    });
    const art = $('article');
    if (PID && art && !$('.del-page')) {
      const b = document.createElement('button');
      b.className = 'btn del-page'; b.type = 'button'; b.textContent = 'Xoá dự án này';
      b.onclick = async () => {
        const label = $('h1', art).textContent;
        if (!await ask({ title: 'Xoá dự án?', text: `<b>${esc(label)}</b> sẽ được chuyển vào Thùng rác và giữ ${KEEP_DAYS} ngày.`, ok: 'Chuyển vào thùng rác' })) return;
        b.disabled = true;
        try { await trashItem('p', PID, [PID + '.html'], label); location.href = 'index.html'; }
        catch (e) { b.disabled = false; fail(e, 'Không xoá được'); }
      };
      art.appendChild(b);
    }
  }

  function decorate() {
    if (!state.admin) return;
    addButtons(); decorateBrands(); decorateGallery();
  }

  const adminLink = $('#menu-admin'), trashLink = $('#menu-trash');
  async function enterAdmin() {
    state.admin = true;
    document.body.classList.add('admin');
    
    if (trashLink) trashLink.style.display = '';
    try { const [d, e] = await Promise.all([readDeleted(), apiJson('edits.json', normEd)]); state.del = d; state.edits = e; } catch {}
    await refresh();
    autoPurge();
  }

  // mục quá 15 ngày: xoá hẳn khi chủ web mở trang (không có máy chủ nên chạy lúc đăng nhập)
  let purging = false;
  async function autoPurge() {
    if (purging || sessionStorage.getItem('jm_purged')) return; purging = true;
    try {
      const del = await readDeleted();
      const old = del.trash.filter(r => daysLeft(r) <= 0);
      if (old.length) { await purgeItems(old, 'Xoá hẳn (quá 15 ngày)'); toast(`Đã xoá hẳn ${old.length} mục quá ${KEEP_DAYS} ngày trong Thùng rác.`); }
      sessionStorage.setItem('jm_purged', '1');
    } catch {}
    purging = false;
  }

  // ---- trang Thùng rác ----
  const tl = $('#trashlist');
  async function renderTrash() {
    const del = await readDeleted();
    const live = del.trash.filter(r => daysLeft(r) > 0).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    const kind = { p: 'Dự án', m: 'Nhóm', i: 'Ấn phẩm' };
    $('#trashcount').textContent = live.length + ' mục';
    if (!live.length) { tl.innerHTML = '<p class="sub">Thùng rác trống.</p>'; return; }
    tl.innerHTML = live.map(r => `<div class="trow" data-k="${esc(r.key)}"><div><b>${esc(r.label)}</b><small>${kind[r.type] || ''} · ${r.files.length} file · xoá ${new Date(r.deletedAt).toLocaleDateString('vi-VN')} · còn ${daysLeft(r)} ngày</small></div><div class="acts"><button class="btn ghost" data-a="restore">Khôi phục</button><button class="btn" data-a="purge">Xoá hẳn</button></div></div>`).join('');
    tl.onclick = async e => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      const rec = live.find(r => r.key === e.target.closest('.trow').dataset.k);
      try {
        if (a === 'restore') {
          if (!await ask({ title: 'Khôi phục?', text: `<b>${esc(rec.label)}</b> sẽ trở lại website.`, ok: 'Khôi phục', danger: false })) return;
          await restoreItem(rec); toast('Đã khôi phục. ' + SYNC);
        } else {
          if (!await ask({ title: 'Xoá hẳn?', text: `<b>${esc(rec.label)}</b> sẽ bị xoá vĩnh viễn khỏi thùng rác và không thể khôi phục (chỉ còn trong lịch sử git).`, ok: 'Xoá hẳn' })) return;
          await purgeItems([rec], 'Xoá hẳn'); toast('Đã xoá hẳn.');
        }
        renderTrash();
      } catch (er) { toast('Không thực hiện được: ' + er.message, 6000); }
    };
  }

  // ---- khởi động ----
  (async function boot() {
    const [d, e, g] = await Promise.all([getJson('deleted.json'), getJson('edits.json'), rendererP ? getJson('gallery.json') : null]);
    if (d) state.del = normDel(d); if (e) state.edits = normEd(e); if (g) state.gdata = g;
    await refresh();
    if (getToken()) {
      checkToken().then(async () => { await enterAdmin(); if (tl) renderTrash(); }).catch(er => {
        if (er.status === 401 || er.status === 403 || /quyền/.test(er.message)) clearToken();
        if (tl) tl.innerHTML = '<p class="sub">Hãy <a href="admin.html" style="color:var(--red)">đăng nhập</a> để xem Thùng rác.</p>';
      });
    } else if (tl) {
      tl.innerHTML = '<p class="sub">Hãy <a href="admin.html" style="color:var(--red)">đăng nhập</a> để xem Thùng rác.</p>';
    }
  })();

  // ---- trang đăng nhập ----
  const form = $('#loginform');
  if (form) {
    const msg = $('#loginmsg'), out = $('#logout'), inp = $('#tok');
    const say = (t, c) => { msg.textContent = t; msg.className = 'msg ' + (c || ''); };
    if (getToken()) checkToken().then(r => { say('Đang đăng nhập · ' + r.full_name + '. Mở "Thương hiệu", "Sản phẩm" hoặc "Thùng rác".', 'ok'); out.style.display = 'inline-flex'; }).catch(() => say('Token cũ không còn dùng được, hãy nhập lại.', 'err'));
    form.onsubmit = async e => {
      e.preventDefault();
      const t = inp.value.trim(); if (!t) return;
      const sb = $('button[type=submit]', form); sb.disabled = true; say('Đang kiểm tra…');
      setToken(t, $('#remember').checked);
      try { const r = await checkToken(); say('Đăng nhập thành công · ' + r.full_name + '. Mở "Thương hiệu", "Sản phẩm" hoặc "Thùng rác".', 'ok'); inp.value = ''; out.style.display = 'inline-flex'; enterAdmin(); }
      catch (er) { clearToken(); say(er.status === 401 ? 'Token sai hoặc đã hết hạn.' : er.message, 'err'); }
      sb.disabled = false;
    };
    out.onclick = () => { clearToken(); try { sessionStorage.removeItem('jm_purged'); } catch {} location.reload(); };
  }
})();
