// Menu, ẩn mục đã xoá, đăng nhập bằng GitHub token, xoá vào thùng rác (giữ 15 ngày), khôi phục, xoá hẳn.
// Không có máy chủ: "đăng nhập" = dán token GitHub của chủ repo. Không có token hợp lệ thì không có nút xoá nào.
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

  // ---- hộp thoại xác nhận (luôn hiện trước khi xoá) ----
  function ask({ title, text, ok, danger = true }) {
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'modal on';
      o.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${text}</p><div class="acts"><button type="button" class="btn ghost" data-r="0">Huỷ</button><button type="button" class="btn${danger ? '' : ' safe'}" data-r="1">${esc(ok)}</button></div></div>`;
      const done = v => { o.remove(); removeEventListener('keydown', key); res(v); };
      const key = e => { if (e.key === 'Escape') done(false); };
      o.onclick = e => { if (e.target === o) done(false); const r = e.target.dataset && e.target.dataset.r; if (r) done(r === '1'); };
      addEventListener('keydown', key); document.body.appendChild(o); $('[data-r="0"]', o).focus();
    });
  }

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
  const norm = d => ({ projects: d.projects || [], months: d.months || [], images: d.images || [], trash: d.trash || [] });

  async function checkToken() {
    const repo = await gh(`/repos/${S.repo}`);
    if (!repo.permissions || !repo.permissions.push) throw new Error('Token này không có quyền ghi vào repo.');
    return repo;
  }
  async function readDeleted() {
    try { return norm(JSON.parse(b64((await gh(`/repos/${S.repo}/contents/${S.out}/deleted.json?ref=${S.branch}`)).content))); }
    catch { return norm({}); }
  }
  const LIST = { p: 'projects', m: 'months', i: 'images' };

  // một commit: sửa deleted.json + di chuyển / xoá file
  async function commitChange(message, mutate) {
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
  }

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

  // ---- ẩn mục đã xoá (cho cả trang cũ còn trong cache) ----
  fetch('deleted.json?t=' + Date.now()).then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return;
    const set = new Set([...(d.projects || []).map(x => 'p:' + x), ...(d.months || []).map(x => 'm:' + x), ...(d.images || []).map(x => 'i:' + x)]);
    $$('[data-id]').forEach(e => { if (set.has(e.dataset.id)) e.remove(); });
    if (document.body.dataset.pid && set.has('p:' + document.body.dataset.pid)) location.replace('index.html');
  }).catch(() => {});

  // ---- chế độ quản trị: chỉ bật khi token được GitHub xác nhận ----
  const adminLink = $('#menu-admin'), trashLink = $('#menu-trash');
  function enterAdmin() {
    document.body.classList.add('admin');
    if (adminLink) adminLink.textContent = 'Quản trị';
    if (trashLink) trashLink.style.display = '';
    addButtons();
    autoPurge();
  }

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
        const what = type === 'p' ? 'dự án' : type === 'm' ? `cả tháng (${files.length} file)` : 'ấn phẩm';
        if (!await ask({ title: `Xoá ${what}?`, text: `<b>${esc(label)}</b> sẽ được chuyển vào Thùng rác và giữ ${KEEP_DAYS} ngày. Trong thời gian đó bạn khôi phục được; sau đó sẽ bị xoá hẳn.`, ok: 'Chuyển vào thùng rác' })) return;
        b.disabled = true; b.textContent = '…';
        try { await trashItem(type, id, files, label); el.remove(); toast('Đã chuyển vào Thùng rác. Web cập nhật sau khoảng 1 phút.'); }
        catch (e) { b.disabled = false; b.textContent = 'Xoá'; if (e.status === 401) { clearToken(); toast('Token hết hạn, hãy đăng nhập lại.'); } else toast('Không xoá được: ' + e.message, 6000); }
      };
      el.appendChild(b);
    });
    const pid = document.body.dataset.pid, art = $('article');
    if (pid && art && !$('.del-page')) {
      const b = document.createElement('button');
      b.className = 'btn del-page'; b.type = 'button'; b.textContent = 'Xoá dự án này';
      b.onclick = async () => {
        const label = $('h1', art).textContent;
        if (!await ask({ title: 'Xoá dự án?', text: `<b>${esc(label)}</b> sẽ được chuyển vào Thùng rác và giữ ${KEEP_DAYS} ngày.`, ok: 'Chuyển vào thùng rác' })) return;
        b.disabled = true;
        try { await trashItem('p', pid, [pid + '.html'], label); location.href = 'index.html'; }
        catch (e) { b.disabled = false; toast('Không xoá được: ' + e.message, 6000); }
      };
      art.appendChild(b);
    }
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
    const kind = { p: 'Dự án', m: 'Tháng', i: 'Ấn phẩm' };
    $('#trashcount').textContent = live.length + ' mục';
    if (!live.length) { tl.innerHTML = '<p class="sub">Thùng rác trống.</p>'; return; }
    tl.innerHTML = live.map(r => `<div class="trow" data-k="${esc(r.key)}"><div><b>${esc(r.label)}</b><small>${kind[r.type] || ''} · ${r.files.length} file · xoá ${new Date(r.deletedAt).toLocaleDateString('vi-VN')} · còn ${daysLeft(r)} ngày</small></div><div class="acts"><button class="btn ghost" data-a="restore">Khôi phục</button><button class="btn" data-a="purge">Xoá hẳn</button></div></div>`).join('');
    tl.onclick = async e => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      const rec = live.find(r => r.key === e.target.closest('.trow').dataset.k);
      const row = e.target.closest('.trow');
      try {
        if (a === 'restore') {
          if (!await ask({ title: 'Khôi phục?', text: `<b>${esc(rec.label)}</b> sẽ trở lại website.`, ok: 'Khôi phục', danger: false })) return;
          await restoreItem(rec); toast('Đã khôi phục. Web cập nhật sau khoảng 1 phút.');
        } else {
          if (!await ask({ title: 'Xoá hẳn?', text: `<b>${esc(rec.label)}</b> sẽ bị xoá vĩnh viễn khỏi thùng rác và không thể khôi phục (chỉ còn trong lịch sử git).`, ok: 'Xoá hẳn' })) return;
          await purgeItems([rec], 'Xoá hẳn'); toast('Đã xoá hẳn.');
        }
        renderTrash();
      } catch (er) { toast('Không thực hiện được: ' + er.message, 6000); }
    };
  }

  // ---- khởi động ----
  const form = $('#loginform');
  if (getToken()) {
    checkToken().then(() => { enterAdmin(); if (tl) renderTrash(); }).catch(e => {
      if (e.status === 401 || e.status === 403 || /quyền/.test(e.message)) clearToken();
      if (tl) tl.innerHTML = '<p class="sub">Hãy <a href="admin.html" style="color:var(--red)">đăng nhập</a> để xem Thùng rác.</p>';
    });
  } else if (tl) {
    tl.innerHTML = '<p class="sub">Hãy <a href="admin.html" style="color:var(--red)">đăng nhập</a> để xem Thùng rác.</p>';
  }

  // ---- trang đăng nhập ----
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
