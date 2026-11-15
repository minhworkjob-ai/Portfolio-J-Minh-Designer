// Tạo trang "Sản phẩm" từ thư mục Pub_Design: nén ảnh, bỏ ảnh trùng, dựng trang theo tháng.
// Chạy:  node gallery.mjs      (chạy lại nhiều lần nếu báo "còn X ảnh": script có giới hạn thời gian và nhớ tiến độ)
// Cần ImageMagick (lệnh `convert` hoặc `magick`). Mac: brew install imagemagick
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { shell as themeShell, fancy, writeSiteAssets, readDeleted, readEdits } from './theme.mjs';
import { compute, indexHtml } from './render.js';

const ex = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const G = cfg.gallery;
const SRC = path.resolve(process.env.PUB_DESIGN || path.resolve(ROOT, G.source));
const OUT = path.join(ROOT, cfg.out);
const IMG = path.join(OUT, 'gallery');
const CACHE_FILE = path.join(ROOT, 'gallery-cache.json');
const BUDGET = Number(process.env.BUDGET || 150000);
const START = Date.now();
fs.mkdirSync(IMG, { recursive: true });
writeSiteAssets(OUT);
const DEL = readDeleted(OUT);
const EDITS = readEdits(OUT);
if (!fs.existsSync(SRC)) { console.error('Không thấy thư mục nguồn:', SRC); process.exit(1); }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pretty = s => s.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

// công cụ ảnh
let IM = null;
for (const bin of ['magick', 'convert']) { try { await ex(bin, ['-version']); IM = bin; break; } catch {} }

// quét thư mục
const extOk = new Set(G.extensions);
const nameBad = new RegExp(G.excludeNameRegex, 'i');
const skipBase = new Set(G.excludeBasenames);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (extOk.has(e.name.split('.').pop().toLowerCase()) && !nameBad.test(slugify(e.name)) && !skipBase.has(e.name)) files.push(p);
  }
})(SRC);
files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

// phân nhóm theo năm / tháng
function describe(rel) {
  const parts = rel.split(path.sep);
  const base = parts[parts.length - 1].replace(/\.[^.]+$/, '');
  const yr = /^0(\d\d)$/.test(parts[0]) ? 2000 + Number(parts[0].slice(1)) : null;
  let key, label, order, album;
  if (yr && parts.length >= 3) {
    const m = parts[1].match(/^M(\d+)_/i);
    key = `${yr}-${parts[1]}`;
    label = m ? `Tháng ${m[1]}/${yr}` : pretty(parts[1]) + ' ' + yr;
    order = yr * 100 + (m ? Number(m[1]) : 99);
    album = parts.slice(2, -1).map(pretty).join(' / ');
  } else if (yr) {
    key = `${yr}-khac`; label = `Khác ${yr}`; order = yr * 100 + 98; album = '';
  } else {
    key = parts[0]; label = pretty(parts[0]); order = 999999; album = parts.slice(1, -1).map(pretty).join(' / ');
  }
  return { key, label, order, album, title: pretty(base) };
}

// nén ảnh (có nhớ tiến độ)
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
const usedIds = new Set(Object.values(cache).map(v => v.id));
const seenHash = new Map();
const todo = [];
const entries = [];
let skipped = 0;
const isDeleted = (rel, c) => (c && DEL.images.includes(c.id)) || DEL.months.includes(slugify(describe(rel).key));
for (const f of files) {
  const rel = path.relative(SRC, f);
  const st = fs.statSync(f);
  let c = cache[rel];
  // mục đã xoá: giữ thông tin để còn khôi phục được, không nén lại
  if (isDeleted(rel, c)) { if (c) entries.push({ rel, ...c }); else skipped++; continue; }
  const fresh = c && c.size === st.size && c.mtimeMs === st.mtimeMs && fs.existsSync(path.join(IMG, c.id + '.jpg')) && fs.existsSync(path.join(IMG, c.id + '-t.jpg'));
  if (!fresh) { todo.push({ f, rel, st }); continue; }
  entries.push({ rel, ...c });
}
if (todo.length && !IM) { console.warn(`Bỏ qua ${todo.length} ảnh mới/lỗi vì chưa cài ImageMagick (brew install imagemagick).`); todo.length = 0; }
const stopAt = START + BUDGET;
let done = 0;
async function work({ f, rel, st }) {
  if (Date.now() > stopAt) return;
  const hash = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
  let id = slugify(rel.replace(/\.[^.]+$/, '')).slice(0, 80) || 'img';
  let n = 1, base = id; while (usedIds.has(id)) id = `${base}-${n++}`; usedIds.add(id);
  const full = path.join(IMG, id + '.jpg'), thumb = path.join(IMG, id + '-t.jpg');
  const im = a => ex(IM, ['-limit', 'memory', '512MiB', '-limit', 'map', '1GiB', ...a]);
  try {
    await im(['-quiet', '-define', 'jpeg:size=2600x2600', f + '[0]', '-auto-orient', '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'sRGB',
      '-resize', '1280x1280>', '-strip', '-interlace', 'Plane', '-quality', '74', full]);
    await im(['-quiet', full, '-resize', '440x440>', '-strip', '-quality', '70', thumb]);
    const { stdout } = await im([full, '-format', '%w %h', 'info:']);
    const [w, h] = stdout.trim().split(' ').map(Number);
    cache[rel] = { id, w, h, hash, size: st.size, mtimeMs: st.mtimeMs };
    entries.push({ rel, ...cache[rel] }); done++;
  } catch (e) { console.warn('Bỏ qua (lỗi đọc ảnh):', rel); usedIds.delete(id); }
}
const queue = [...todo]; 
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length && Date.now() < stopAt) await work(queue.shift()); }));
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
const pending = files.length - entries.length - skipped;

// bỏ ảnh trùng nội dung (chỉ xét ảnh còn hiển thị); ảnh đã xoá giữ riêng để khôi phục
const kept = entries.filter(e => !isDeleted(e.rel, e)), gone = entries.filter(e => isDeleted(e.rel, e));
const uniq = [];
for (const e of kept) { if (seenHash.has(e.hash)) continue; seenHash.set(e.hash, 1); uniq.push(e); }
const all = [...uniq, ...gone].sort((a, b) => a.rel.localeCompare(b.rel, 'en', { numeric: true }));

// nhóm theo năm / tháng -> gallery.json (trình duyệt dựng trang từ file này + edits.json)
const cols = new Map();
for (const e of all) {
  const d = describe(e.rel);
  const key = slugify(d.key);
  if (!cols.has(key)) cols.set(key, { key, label: d.label, order: d.order, items: [] });
  cols.get(key).items.push({ id: e.id, title: d.title, album: d.album, w: e.w, h: e.h });
}
const groups = [...cols.values()].sort((a, b) => b.order - a.order).map(({ key, label, items }) => ({ key, label, items }));
fs.writeFileSync(path.join(OUT, 'gallery.json'), JSON.stringify({ groups }));

const LB = `<div class="lb" id="lb"><button aria-label="Đóng" id="lx">×</button><button class="nv pv" id="lp" aria-label="Trước">‹</button><img id="li" alt=""><button class="nv nx" id="ln" aria-label="Sau">›</button><p id="lc"></p></div>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('li'),lc=document.getElementById('lc');
let ix=0;const list=()=>[...document.querySelectorAll('.masonry a')];
function show(i){const l=list();if(!l.length)return;ix=(i+l.length)%l.length;li.src=l[ix].href;lc.textContent=l[ix].dataset.t+'  ('+(ix+1)+'/'+l.length+')';lb.classList.add('on')}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('.masonry a');if(!a)return;e.preventDefault();show(list().indexOf(a))});
document.getElementById('lx').onclick=()=>lb.classList.remove('on');
document.getElementById('lp').onclick=()=>show(ix-1);document.getElementById('ln').onclick=()=>show(ix+1);
lb.addEventListener('click',e=>{if(e.target===lb)lb.classList.remove('on')});
addEventListener('keydown',e=>{if(!lb.classList.contains('on'))return;if(e.key==='Escape')lb.classList.remove('on');if(e.key==='ArrowLeft')show(ix-1);if(e.key==='ArrowRight')show(ix+1)});
</script>`;

// trang một nhóm: một trang chung, JS đọc ?k=<khoá>
fs.writeFileSync(path.join(OUT, 'group.html'), themeShell(cfg, `Nhóm · ${G.title}`, G.title,
  `<div class="wrap" id="grp"><a class="back" href="gallery.html">← Tất cả nhóm</a><p class="sub" style="padding-top:24px">Đang tải…</p></div>${LB}`, 'gallery', { page: 'group' }));
// link cũ g-<khoá>.html chuyển sang trang chung
const hasStub = new Set();
for (const g of groups) {
  const f = `g-${g.key}.html`; hasStub.add(f);
  fs.writeFileSync(path.join(OUT, f), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=group.html?k=${esc(g.key)}"><script>location.replace('group.html?k=${esc(g.key)}')</script>`);
}

// trang danh sách nhóm (dựng sẵn để có nội dung ngay, JS sẽ dựng lại theo chỉnh sửa mới nhất)
const view = compute({ groups }, DEL, EDITS);
const home = `<div class="wrap"><header class="ph"><h1>${fancy(G.title)}</h1><p id="galsub">${view.total} sản phẩm, sắp xếp theo nhóm. Bấm vào một nhóm để xem, bấm vào ảnh để phóng to.</p></header></div><div class="wrap" id="gal">${indexHtml(view.groups)}</div>`;
fs.writeFileSync(path.join(OUT, 'gallery.html'), themeShell(cfg, G.title, `${view.total} sản phẩm thiết kế`, home, 'gallery', { page: 'gallery' }));

// chuyển file ảnh không còn dùng ra khỏi docs (không xoá)
const live = new Set(uniq.filter(e => !isDeleted(e.rel, e)).flatMap(e => [e.id + '.jpg', e.id + '-t.jpg']));
const parkDir = path.join(ROOT, '_to_delete', 'gallery-stale');
for (const f of fs.readdirSync(IMG)) if (!live.has(f) && pending === 0) { fs.mkdirSync(parkDir, { recursive: true }); fs.renameSync(path.join(IMG, f), path.join(parkDir, f)); }
for (const f of fs.readdirSync(OUT)) if (/^g-.*\.html$/.test(f) && !hasStub.has(f)) { fs.mkdirSync(parkDir, { recursive: true }); fs.renameSync(path.join(OUT, f), path.join(parkDir, f)); }
console.log(`Quét ${files.length} ảnh · mới nén ${done} · hiện có ${view.total} ảnh hiển thị (${entries.length - uniq.length - gone.length} trùng, ${gone.length} đã xoá) · ${view.groups.length} nhóm`);
if (pending > 0) console.log(`CÒN ${pending} ảnh chưa nén, chạy lại: node gallery.mjs`);
