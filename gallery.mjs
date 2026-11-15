// Tạo trang "Sản phẩm" từ thư mục Pub_Design: nén ảnh, bỏ ảnh trùng, dựng trang theo tháng.
// Chạy:  node gallery.mjs      (chạy lại nhiều lần nếu báo "còn X ảnh": script có giới hạn thời gian và nhớ tiến độ)
// Cần ImageMagick (lệnh `convert` hoặc `magick`). Mac: brew install imagemagick
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { shell as themeShell, fancy, pageHead, writeSiteAssets, readDeleted } from './theme.mjs';

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
for (const f of files) {
  const rel = path.relative(SRC, f);
  const st = fs.statSync(f);
  let c = cache[rel];
  if (c && DEL.images.includes(c.id)) continue;
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
const remaining = todo.length - done - 0;
const pending = files.length - entries.length;

// bỏ ảnh trùng nội dung
const uniq = [];
for (const e of entries) { if (DEL.images.includes(e.id) || seenHash.has(e.hash)) continue; seenHash.set(e.hash, 1); uniq.push(e); }

// dựng trang
const cols = new Map();
for (const e of uniq) {
  const d = describe(e.rel);
  if (!cols.has(d.key)) cols.set(d.key, { ...d, items: [] });
  cols.get(d.key).items.push({ ...e, title: d.title, album: d.album });
}
const colList = [...cols.values()].filter(c => !DEL.months.includes(slugify(c.key))).sort((a, b) => a.order - b.order);
const LB = `<div class="lb" id="lb"><button aria-label="Đóng" id="lx">×</button><button class="nv pv" id="lp" aria-label="Trước">‹</button><img id="li" alt=""><button class="nv nx" id="ln" aria-label="Sau">›</button><p id="lc"></p></div>
<script>
const lb=document.getElementById('lb'),li=document.getElementById('li'),lc=document.getElementById('lc');
let ix=0;const as=new Proxy([],{get:(t,k)=>{const l=[...document.querySelectorAll('.masonry a')];return k==='length'?l.length:l[k]}});
function show(i){ix=(i+as.length)%as.length;li.src=as[ix].href;lc.textContent=as[ix].dataset.t+'  ('+(ix+1)+'/'+as.length+')';lb.classList.add('on')}
as.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(!document.body.contains(a))return;const l=[...document.querySelectorAll('.masonry a')];show(l.indexOf(a))}));
document.getElementById('lx').onclick=()=>lb.classList.remove('on');
document.getElementById('lp').onclick=()=>show(ix-1);document.getElementById('ln').onclick=()=>show(ix+1);
lb.addEventListener('click',e=>{if(e.target===lb)lb.classList.remove('on')});
addEventListener('keydown',e=>{if(!lb.classList.contains('on'))return;if(e.key==='Escape')lb.classList.remove('on');if(e.key==='ArrowLeft')show(ix-1);if(e.key==='ArrowRight')show(ix+1)});
</script>`;
const pageName = c => `g-${slugify(c.key)}.html`;
for (const c of colList) {
  const albums = new Map();
  for (const it of c.items) { if (!albums.has(it.album)) albums.set(it.album, []); albums.get(it.album).push(it); }
  let body = '';
  for (const [name, items] of albums) {
    body += (name ? `<h3 class="album">${esc(name)}</h3>` : '') + '<div class="masonry">' +
      items.map(it => `<a href="gallery/${it.id}.jpg" data-t="${esc(it.title)}" data-id="i:${it.id}" data-files="gallery/${it.id}.jpg,gallery/${it.id}-t.jpg" data-label="${esc(it.title)}"><img src="gallery/${it.id}-t.jpg" width="${Math.min(it.w, 440)}" height="${Math.round(it.h * Math.min(it.w, 440) / it.w)}" alt="${esc(it.title)}" loading="lazy"></a>`).join('') + '</div>';
  }
  const inner = `<div class="wrap"><a class="back" href="gallery.html">← Tất cả tháng</a><article style="max-width:none;padding-top:0"><h1>${fancy(c.label)}</h1><p class="lead">${c.items.length} sản phẩm</p>${body}</article></div>${LB}`;
  fs.writeFileSync(path.join(OUT, pageName(c)), themeShell(cfg, `${c.label} · ${G.title}`, `${c.items.length} sản phẩm thiết kế ${c.label}`, inner, 'gallery'));
}
const yearOf = c => (String(c.key).match(/^(\d{4})/) || [])[1] || 'Khác';
const byYear = new Map();
for (const c of colList) { const y = yearOf(c); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(c); }
let idx = '';
for (const [y, list] of [...byYear].sort((a, b) => b[0].localeCompare(a[0]))) {
  idx += `<h2 class="sec">${y === 'Khác' ? 'Khác' : 'Năm ' + y}</h2><div class="cgrid">` + list.slice().sort((a, b) => b.order - a.order).map(c => {
    const cover = c.items[0];
    const files = [pageName(c), ...c.items.flatMap(it => [`gallery/${it.id}.jpg`, `gallery/${it.id}-t.jpg`])].join(',');
    return `<a class="card" href="${pageName(c)}" data-id="m:${slugify(c.key)}" data-files="${files}" data-label="${esc(c.label)}"><div class="thumb"><img src="gallery/${cover.id}-t.jpg" alt="${esc(c.label)}" loading="lazy"></div><div class="meta"><h3>${esc(c.label)}</h3><p>${c.items.length} sản phẩm</p></div></a>`;
  }).join('') + '</div>';
}
const home = pageHead(G.title, `${uniq.length} sản phẩm, sắp xếp theo tháng. Bấm vào một tháng để xem, bấm vào ảnh để phóng to.`) + `<div class="wrap">${idx}<div style="height:48px"></div></div>`;
fs.writeFileSync(path.join(OUT, 'gallery.html'), themeShell(cfg, G.title, `${uniq.length} sản phẩm thiết kế`, home, 'gallery'));

// chuyển file ảnh không còn dùng ra khỏi docs (không xoá)
const live = new Set(uniq.flatMap(e => [e.id + '.jpg', e.id + '-t.jpg']));
const parkDir = path.join(ROOT, '_to_delete', 'gallery-stale');
for (const f of fs.readdirSync(IMG)) if (!live.has(f) && pending === 0) { fs.mkdirSync(parkDir, { recursive: true }); fs.renameSync(path.join(IMG, f), path.join(parkDir, f)); }
console.log(`Quét ${files.length} ảnh · mới nén ${done} · hiện có ${uniq.length} ảnh duy nhất (${entries.length - uniq.length} trùng) · ${colList.length} nhóm tháng`);
if (pending > 0) console.log(`CÒN ${pending} ảnh chưa nén, chạy lại: node gallery.mjs`);
