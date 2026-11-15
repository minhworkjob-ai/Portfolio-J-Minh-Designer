// Tạo website tĩnh từ vault Obsidian. Không cần cài thêm thư viện.
// Chạy:  node build.mjs     (hoặc VAULT="/đường/dẫn/vault" node build.mjs)
// Chỉ xuất bản: (1) ghi chú nằm trong thư mục ở "include" của site.config.json,
//               (2) hoặc ghi chú có frontmatter  publish: true
// Ghi chú có  publish: false  hoặc tên bắt đầu bằng "Nguồn" luôn bị bỏ qua.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell as themeShell, hero, pageHead, writeSiteAssets, readDeleted } from './theme.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const VAULT = path.resolve(process.env.VAULT || path.resolve(ROOT, cfg.vault));
const OUT = path.join(ROOT, cfg.out);
const ASSETS = path.join(OUT, 'assets');
const DEL = readDeleted(OUT);

if (!fs.existsSync(path.join(VAULT, '.obsidian'))) {
  console.error('Không thấy vault Obsidian tại:', VAULT);
  process.exit(1);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- đọc vault ----------
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'raw') walk(p, acc); }
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: text };
  const fm = {}; let key = null;
  for (const line of m[1].split('\n')) {
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && key) { (fm[key] ||= []).push(li[1].replace(/^["']|["']$/g, '')); continue; }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1]; let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) fm[key] = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (v === '') fm[key] = [];
    else fm[key] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: text.slice(m[0].length) };
}

const includeDirs = cfg.include.map(d => path.join(VAULT, d) + path.sep);
const pages = [];
for (const file of walk(VAULT)) {
  const name = path.basename(file, '.md');
  const { fm, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (String(fm.publish) === 'false') continue;
  if (DEL.projects.includes(slugify(name))) continue;
  if (cfg.excludeNamePrefixes.some(p => name.startsWith(p))) continue;
  const inFolder = includeDirs.some(d => file.startsWith(d));
  if (!inFolder && String(fm.publish) !== 'true') continue;
  const aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
  pages.push({ file, name, slug: slugify(name), fm, body, aliases });
}
pages.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
const byName = new Map();
for (const p of pages) for (const n of [p.name, ...p.aliases]) byName.set(n.toLowerCase(), p);

// ---------- ảnh ----------
fs.mkdirSync(ASSETS, { recursive: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
writeSiteAssets(OUT);
const copied = new Map();
const usedNames = new Set();
function useImage(rel) {
  rel = rel.trim();
  if (copied.has(rel)) return copied.get(rel);
  let src = path.join(VAULT, rel);
  if (!fs.existsSync(src)) { copied.set(rel, null); return null; }
  let base = path.basename(rel), n = 1;
  while (usedNames.has(base)) base = `${n++}-${path.basename(rel)}`;
  usedNames.add(base);
  fs.copyFileSync(src, path.join(ASSETS, base));
  copied.set(rel, 'assets/' + base);
  return 'assets/' + base;
}

// ---------- markdown -> html ----------
const HEX = /^~?#[0-9a-fA-F]{6}$/;
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, p) => {
    const u = useImage(p.replace(/&amp;/g, '&'));
    return u ? `<img src="${u}" alt="${esc(path.basename(p))}" loading="lazy">` : '';
  });
  s = s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, a) => {
    const target = byName.get(t.trim().toLowerCase());
    const label = a || t;
    return target ? `<a href="${target.slug}.html">${label}</a>` : `<span>${label}</span>`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => {
    const c = codes[i];
    const sw = HEX.test(c) ? `<i class="sw" style="background:${c.replace('~', '')}"></i>` : '';
    return `${sw}<code>${esc(c)}</code>`;
  });
  return s;
}

function renderList(lines) {
  // lines: [{indent, ordered, text}] -> html lồng nhau
  let html = '', stack = [];
  const close = () => { const t = stack.pop(); html += `</li></${t.tag}>`; };
  for (const it of lines) {
    const tag = it.ordered ? 'ol' : 'ul';
    while (stack.length && it.indent < stack[stack.length - 1].indent) close();
    if (!stack.length || it.indent > stack[stack.length - 1].indent) { html += `<${tag}>`; stack.push({ indent: it.indent, tag }); }
    else html += '</li>';
    html += `<li>${inline(it.text)}`;
  }
  while (stack.length) close();
  return html;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  let out = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lv = Math.min(h[1].length + 1, 6); out += `<h${lv}>${inline(h[2])}</h${lv}>`; i++; continue; }
    if (/^---+$/.test(line.trim())) { out += '<hr>'; i++; continue; }
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out += '<div class="tw"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] }); i++;
      }
      out += renderList(items); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*\||\s*([-*]|\d+\.)\s+|---+$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    const text = buf.join(' ');
    out += /^\s*!\[\[/.test(text) && !text.replace(/!\[\[[^\]]*\]\]/g, '').trim() ? `<figure>${inline(text)}</figure>` : `<p>${inline(text)}</p>`;
  }
  return out;
}

// ---------- chuẩn bị nội dung từng trang ----------
function prepare(p) {
  let body = p.body.replace(/\r/g, '');
  // bỏ các mục không công khai
  const parts = body.split(/^(?=## )/m);
  body = parts.filter(sec => {
    const t = (sec.match(/^## (.*)$/m) || [])[1];
    return !(t && cfg.stripSections.includes(t.trim()));
  }).join('');
  // làm sạch ghi chú nội bộ: tham chiếu raw/, lời nhắn riêng, mã số thuế
  body = body.replace(/(?<!!)\[\[raw\/[^\]]*\]\]/g, '').replace(/\(\s*\)/g, '')
    .replace(/\s*\((?:[^()]*\b)?bạn\b[^()]*\)/gi, '').replace(/(?:Chi tiết|Ghi nhận đọc ngày [\d\/]+)\s*:\s*\./g, '')
    .replace(/:\s*\./g, '.');
  body = body.split('\n').filter(l => !/Mã số thuế/i.test(l)).join('\n');
  // an toàn: bỏ mọi dòng chứa đường dẫn cá nhân
  body = body.split('\n').filter(l => !/\/Users\/|\/home\/|C:\\Users/.test(l)).join('\n');
  const title = (body.match(/^#\s+(.*)$/m) || [, p.name])[1];
  body = body.replace(/^#\s+.*\n/, '');
  let tldr = '';
  body = body.replace(/^\*\*TL;DR:\*\*\s*(.*)$/m, (_, t) => { tldr = t; return ''; });
  const firstImg = (body.match(/!\[\[([^\]|]+)/) || [])[1];
  const hexes = [...new Set((body.match(/#[0-9a-fA-F]{6}\b/g) || []))].slice(0, 5);
  p.title = title; p.tldr = tldr; p.hexes = hexes;
  p.html = mdToHtml(body);
  p.cover = firstImg ? useImage(firstImg) : null;
  p.tldrHtml = inline(tldr);
  p.plainTldr = tldr.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/[`*]/g, '');
}
pages.forEach(prepare);

// ---------- giao diện ----------

const shell = (title, desc, inner) => themeShell(cfg, title, desc, inner, 'brands');

// trang chủ
const cards = pages.map((p, i) => `
<a class="card" href="${p.slug}.html" data-id="p:${p.slug}" data-files="${p.slug}.html" data-label="${esc(p.title)}" data-q="${esc((p.title + ' ' + p.plainTldr).toLowerCase())}">
  <div class="thumb${p.cover ? '' : ' empty'}">${p.cover ? `<img src="${p.cover}" alt="${esc(p.title)}" loading="lazy">` : esc(p.title[0] || '?')}</div>
  <div class="meta"><span class="no">${String(i + 1).padStart(2, '0')}/${String(pages.length).padStart(2, '0')}</span><h3>${esc(p.title)}</h3><p>${esc(p.plainTldr)}</p>
  <div class="dots">${p.hexes.map(h => `<i style="background:${h}" title="${h}"></i>`).join('')}</div></div>
</a>`).join('');
const home = shell(cfg.title, cfg.subtitle, `
${hero(cfg)}
<div class="wrap" id="work"><div class="secbar"><span>Thương hiệu</span><input id="q" type="search" placeholder="Tìm thương hiệu…" aria-label="Tìm"><span id="n">${pages.length} dự án</span></div>
<main class="grid" id="g">${cards}</main></div>
<script>
const q=document.getElementById('q'),n=document.getElementById('n'),cs=[...document.querySelectorAll('.card')];
q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();let c=0;cs.forEach(e=>{const ok=!v||e.dataset.q.includes(v);e.style.display=ok?'':'none';if(ok)c++});n.textContent=c+' dự án'});
</script>`);
fs.writeFileSync(path.join(OUT, 'index.html'), home);

// trang đăng nhập
const loginHtml = shell('Đăng nhập · ' + cfg.title, 'Đăng nhập quản trị', `
<div class="wrap"><div class="login"><h1>Đăng nhập</h1>
<p>Chỉ chủ website mới xoá được dự án và ấn phẩm. Đăng nhập bằng GitHub token của bạn (chỉ lưu trong trình duyệt này, không gửi đi đâu ngoài GitHub).</p>
<form id="loginform" autocomplete="off"><label for="tok">GitHub token</label><input id="tok" type="password" placeholder="github_pat_…" spellcheck="false">
<div class="row"><input type="checkbox" id="remember"><label for="remember" style="margin:0;text-transform:none;letter-spacing:0">Ghi nhớ trên máy này</label></div>
<button class="btn" type="submit">Đăng nhập</button> <button class="btn ghost" type="button" id="logout" style="display:none">Đăng xuất</button>
<div class="msg" id="loginmsg"></div></form>
<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin-top:46px">Lấy token (một lần)</h2>
<ol><li>Mở <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>
<li>Repository access: <b>Only select repositories</b> → chọn repo ${esc(cfg.repo.split('/')[1])}.</li>
<li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
<li>Generate token, chép dán vào ô trên.</li></ol></div></div>`, 'admin');
fs.writeFileSync(path.join(OUT, 'admin.html'), loginHtml);
fs.writeFileSync(path.join(OUT, 'trash.html'), shell('Thùng rác · ' + cfg.title, 'Thùng rác', `${pageHead('Thùng rác', 'Mục đã xoá được giữ 15 ngày, sau đó bị xoá hẳn. Chỉ chủ website xem được.')}<div class="wrap"><div class="secbar"><span>Đã xoá</span><span id="trashcount"></span></div><div id="trashlist"><p class="sub">Đang tải…</p></div><div style="height:60px"></div></div>`));

// trang chi tiết
for (const p of pages) {
  const inner = `<div class="wrap"><a class="back" href="index.html">← Tất cả dự án</a><article>
<h1>${esc(p.title)}</h1>${p.tldr ? `<p class="lead">${p.tldrHtml}</p>` : ''}${p.html}</article></div>`;
  fs.writeFileSync(path.join(OUT, `${p.slug}.html`), themeShell(cfg, `${p.title} · ${cfg.title}`, p.plainTldr, inner, 'brands', { pid: p.slug }));
}

// báo file cũ không còn được tạo (không tự xoá)
const made = new Set(['index.html', 'admin.html', 'trash.html', 'site.js', 'deleted.json', '.nojekyll', ...pages.map(p => p.slug + '.html'), ...[...copied.values()].filter(Boolean)]);
const stale = [];
(function scan(d, rel = '') { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) scan(path.join(d, e.name), r); else if (!made.has(r) && !/^(gallery\/|gallery\.html|g-)/.test(r)) stale.push(r); } })(OUT);
if (stale.length) console.log('File cũ có thể xoá tay:', stale.join(', '));
console.log(`Đã tạo ${pages.length} trang và ${fs.readdirSync(ASSETS).length} ảnh trong ${path.relative(ROOT, OUT)}/`);
for (const p of pages) console.log(' -', p.name);
