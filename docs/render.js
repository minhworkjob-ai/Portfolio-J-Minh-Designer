// Phần dựng nhóm ảnh dùng chung cho Node (build) và trình duyệt (render lại sau khi chủ web sửa).
// Dữ liệu gốc: gallery.json. Chỉnh sửa của chủ web: edits.json. Mục đã xoá: deleted.json.
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Tiêu đề kết hợp serif nghiêng (Playfair Display) + sans đậm hẹp (Anton): nửa đầu serif, nửa sau sans in hoa.
const titleCase = t => t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()) : t;
export const mixTitle = (s, mode) => {
  s = String(s).trim();
  const w = s.split(/\s+/);
  if (mode === 'se') return `<span class="se">${esc(titleCase(s))}</span>`;
  if (mode === 'sa' || w.length < 2) return `<span class="sa">${esc(s)}</span>`;
  const k = Math.floor(w.length / 2);
  return `<span class="se">${esc(titleCase(w.slice(0, k).join(' ')))}</span> <span class="sa">${esc(w.slice(k).join(' '))}</span>`;
};
export const fancy = s => mixTitle(s);

export const emptyEdits = () => ({ brandNames: {}, brandOrder: [], groupNames: {}, groupOrder: [], groupNew: {}, groupMerged: {}, imageGroup: {}, imageOrder: {} });
export const normEdits = d => { const e = emptyEdits(); for (const k of Object.keys(e)) if (d && d[k] && typeof d[k] === typeof e[k]) e[k] = d[k]; return e; };

export const yearOf = g => (String(g.key).match(/^(\d{4})/) || [])[1] || 'Khác';

// Gộp dữ liệu gốc + chỉnh sửa + mục đã xoá thành danh sách nhóm hiện hành.
export function compute(data, del = {}, edits = {}, { showEmpty = false } = {}) {
  const ed = normEdits(edits);
  const delImg = new Set(del.images || []), delMon = new Set(del.months || []);
  const res = k => { let n = 0; while (ed.groupMerged[k] && n++ < 20) k = ed.groupMerged[k]; return k; };
  const base = new Map(), imgs = [];
  for (const g of data.groups) { base.set(g.key, { key: g.key, label: g.label, items: [] }); for (const it of g.items) imgs.push({ ...it, home: g.key }); }
  for (const [k, l] of Object.entries(ed.groupNew)) if (!base.has(k)) base.set(k, { key: k, label: l, items: [], isNew: true });
  for (const im of imgs) {
    if (delImg.has(im.id)) continue;
    const want = ed.imageGroup[im.id];
    const k = res(want && base.has(want) ? want : im.home);
    const g = base.get(k);
    if (!g || delMon.has(k)) continue;
    g.items.push({ ...im, moved: !!want && k !== res(im.home) });
  }
  for (const g of base.values()) {
    g.label = ed.groupNames[g.key] || g.label;
    const o = ed.imageOrder[g.key];
    if (Array.isArray(o) && o.length) {
      const r = new Map(o.map((id, i) => [id, i])), at = new Map(g.items.map((it, i) => [it, i]));
      const rk = it => r.has(it.id) ? r.get(it.id) : 1e9 + at.get(it);
      g.items.sort((a, b) => rk(a) - rk(b));
    }
  }
  const list = [...base.values()].filter(g => !ed.groupMerged[g.key] && !delMon.has(g.key) && (showEmpty || g.items.length));
  const rank = new Map(ed.groupOrder.map((k, i) => [k, i])), at0 = new Map(list.map((g, i) => [g, i]));
  const gk = g => rank.has(g.key) ? rank.get(g.key) : 1e6 + at0.get(g);
  list.sort((a, b) => gk(a) - gk(b));
  return { groups: list, total: list.reduce((n, g) => n + g.items.length, 0) };
}

export function groupCard(g) {
  const cover = g.items[0];
  const files = g.items.flatMap(it => [`gallery/${it.id}.jpg`, `gallery/${it.id}-t.jpg`]).join(',');
  return `<a class="card" href="group.html?k=${esc(g.key)}" data-id="m:${esc(g.key)}" data-key="${esc(g.key)}" data-files="${esc(files)}" data-label="${esc(g.label)}"><div class="thumb${cover ? '' : ' empty'}">${cover ? `<img src="gallery/${cover.id}-t.jpg" alt="${esc(g.label)}" loading="lazy">` : '∅'}</div><div class="meta"><h3>${esc(g.label)}</h3><p>${g.items.length} sản phẩm</p></div></a>`;
}

// trang chủ phần Sản phẩm: các nhóm, chia theo năm
export function indexHtml(groups) {
  const by = new Map();
  for (const g of groups) { const y = yearOf(g); if (!by.has(y)) by.set(y, []); by.get(y).push(g); }
  const years = [...by.keys()].sort((a, b) => a === 'Khác' ? 1 : b === 'Khác' ? -1 : b.localeCompare(a));
  return '<div class="gtools" id="gtools"></div>' + years.map(y => `<h2 class="sec">${mixTitle(y === 'Khác' ? 'Khác' : 'Năm ' + y)}</h2><div class="cgrid">${by.get(y).map(groupCard).join('')}</div>`).join('') + '<div style="height:48px"></div>';
}

// trang một nhóm
export function groupHtml(g) {
  const albums = new Map();
  for (const it of g.items) { const a = it.moved ? '' : (it.album || ''); if (!albums.has(a)) albums.set(a, []); albums.get(a).push(it); }
  let body = '';
  for (const [name, items] of albums) {
    body += (name ? `<h3 class="album">${esc(name)}</h3>` : '') + '<div class="masonry">' +
      items.map(it => `<a href="gallery/${it.id}.jpg" data-t="${esc(it.title)}" data-id="i:${esc(it.id)}" data-files="gallery/${esc(it.id)}.jpg,gallery/${esc(it.id)}-t.jpg" data-label="${esc(it.title)}"><img src="gallery/${esc(it.id)}-t.jpg" width="${Math.min(it.w, 440)}" height="${Math.round(it.h * Math.min(it.w, 440) / it.w)}" alt="${esc(it.title)}" loading="lazy"></a>`).join('') + '</div>';
  }
  if (!g.items.length) body = '<p class="sub">Nhóm này chưa có sản phẩm nào.</p>';
  return `<a class="back" href="gallery.html">← Tất cả nhóm</a><article style="max-width:none;padding-top:0"><h1>${fancy(g.label)}</h1><p class="lead">${g.items.length} sản phẩm</p><div class="gtools" id="gtools"></div>${body}</article>`;
}
