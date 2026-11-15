// Menu, ẩn mục đã xoá, đăng nhập bằng GitHub token và xoá dự án / ấn phẩm.
// Không có máy chủ: "đăng nhập" = dán token GitHub của chính chủ repo. Chỉ ai có quyền ghi vào repo mới xoá được.
(function () {
  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'jm_token';
  const getToken = () => { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
  const setToken = (t, remember) => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); (remember ? localStorage : sessionStorage).setItem(KEY, t); } catch {} };
  const clearToken = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch {} };
  const toast = (m, ms = 3500) => { const t = $('#toast'); if (!t) return alert(m); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); };

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

  async function checkToken() {
    const repo = await gh(`/repos/${S.repo}`);
    if (!repo.permissions || !repo.permissions.push) throw new Error('Token này không có quyền ghi vào repo.');
    return repo;
  }

  async function readDeleted() {
    try {
      const f = await gh(`/repos/${S.repo}/contents/${S.out}/deleted.json?ref=${S.branch}`);
      const d = JSON.parse(b64(f.content));
      return { projects: d.projects || [], months: d.months || [], images: d.images || [] };
    } catch { return { projects: [], months: [], images: [] }; }
  }

  // một commit duy nhất: cập nhật deleted.json và xoá các file
  async function deleteItems(type, id, files, label) {
    const del = await readDeleted();
    const bucket = { p: 'projects', m: 'months', i: 'images' }[type];
    if (!del[bucket].includes(id)) del[bucket].push(id);
    const ref = await gh(`/repos/${S.repo}/git/ref/heads/${S.branch}`);
    const base = await gh(`/repos/${S.repo}/git/commits/${ref.object.sha}`);
    const entries = [{ path: `${S.out}/deleted.json`, mode: '100644', type: 'blob', content: JSON.stringify(del, null, 2) + '\n' }];
    for (const f of files) entries.push({ path: `${S.out}/${f}`, mode: '100644', type: 'blob', sha: null });
    const tree = await gh(`/repos/${S.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: entries }) });
    const commit = await gh(`/repos/${S.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Xoá: ${label}`, tree: tree.sha, parents: [ref.object.sha] }) });
    await gh(`/repos/${S.repo}/git/refs/heads/${S.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  }

  // ---- ẩn mục đã xoá (cho cả trang cũ còn trong cache) ----
  fetch('deleted.json?t=' + Date.now()).then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return;
    const set = new Set([...(d.projects || []).map(x => 'p:' + x), ...(d.months || []).map(x => 'm:' + x), ...(d.images || []).map(x => 'i:' + x)]);
    $$('[data-id]').forEach(e => { if (set.has(e.dataset.id)) e.remove(); });
    if (document.body.dataset.pid && set.has('p:' + document.body.dataset.pid)) location.replace('index.html');
  }).catch(() => {});

  // ---- chế độ quản trị ----
  const admin = !!getToken();
  const adminLink = $('#menu-admin');
  if (admin) { document.body.classList.add('admin'); if (adminLink) adminLink.textContent = 'Quản trị'; }

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
        if (!confirm(`Xoá ${what} "${label}"?\nFile sẽ bị xoá khỏi GitHub (khôi phục được qua lịch sử git).`)) return;
        b.disabled = true; b.textContent = '…';
        try { await deleteItems(type, id, files, label); el.remove(); toast('Đã xoá. Web cập nhật sau khoảng 1 phút.'); }
        catch (e) { b.disabled = false; b.textContent = 'Xoá'; if (e.status === 401) { clearToken(); toast('Token hết hạn, hãy đăng nhập lại.'); } else toast('Không xoá được: ' + e.message, 6000); }
      };
      el.appendChild(b);
    });
    // nút xoá trên trang chi tiết dự án
    const pid = document.body.dataset.pid, art = $('article');
    if (pid && art && !$('.del-page')) {
      const b = document.createElement('button');
      b.className = 'btn del-page'; b.type = 'button'; b.textContent = 'Xoá dự án này';
      b.onclick = async () => {
        if (!confirm(`Xoá dự án "${$('h1', art).textContent}"?`)) return;
        b.disabled = true;
        try { await deleteItems('p', pid, [pid + '.html'], $('h1', art).textContent); location.href = 'index.html'; }
        catch (e) { b.disabled = false; toast('Không xoá được: ' + e.message, 6000); }
      };
      art.appendChild(b);
    }
  }
  if (admin) addButtons();

  // ---- trang đăng nhập ----
  const form = $('#loginform');
  if (form) {
    const msg = $('#loginmsg'), out = $('#logout'), inp = $('#tok');
    const say = (t, c) => { msg.textContent = t; msg.className = 'msg ' + (c || ''); };
    if (admin) { checkToken().then(r => { say('Đang đăng nhập · ' + r.full_name + '. Quay lại các trang để thấy nút Xoá.', 'ok'); out.style.display = 'inline-flex'; }).catch(() => { clearToken(); say('Token cũ không còn dùng được, hãy nhập lại.', 'err'); }); }
    form.onsubmit = async e => {
      e.preventDefault();
      const t = inp.value.trim(); if (!t) return;
      const sb = $('button[type=submit]', form); sb.disabled = true; say('Đang kiểm tra…');
      setToken(t, $('#remember').checked);
      try { const r = await checkToken(); say('Đăng nhập thành công · ' + r.full_name + '. Mở "Thương hiệu" hoặc "Sản phẩm" để xoá.', 'ok'); inp.value = ''; document.body.classList.add('admin'); if (adminLink) adminLink.textContent = 'Quản trị'; out.style.display = 'inline-flex'; }
      catch (er) { clearToken(); say(er.status === 401 ? 'Token sai hoặc đã hết hạn.' : er.message, 'err'); }
      sb.disabled = false;
    };
    out.onclick = () => { clearToken(); location.reload(); };
  }
})();
