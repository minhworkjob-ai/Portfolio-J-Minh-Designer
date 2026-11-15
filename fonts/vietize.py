# Việt hoá Host Grotesk (SIL OFL 1.1): thêm dấu hỏi, dấu nặng, móc (ơ ư) và mọi chữ có dấu tiếng Việt.
# Kết quả là một font phái sinh đổi tên "Host Grotesk VN", vẫn theo giấy phép OFL.
import sys, math, unicodedata
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

SRC, WGHT, OUT = sys.argv[1], int(sys.argv[2]), sys.argv[3]
font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': WGHT})
glyf, hmtx, cmap = font['glyf'], font['hmtx'], font.getBestCmap()
XH, CAP = font['OS/2'].sxHeight, font['OS/2'].sCapHeight

def bbox(name):
    g = glyf[name]; g.recalcBounds(glyf)
    return (g.xMin, g.yMin, g.xMax, g.yMax) if g.numberOfContours else (0, 0, 0, 0)

def add_glyph(name, g, adv, uni=None):
    glyf[name] = g
    g.recalcBounds(glyf)
    hmtx[name] = (int(round(adv)), int(getattr(g, 'xMin', 0) or 0))
    order = font.getGlyphOrder()
    if name not in order: order.append(name); font.setGlyphOrder(order)
    if uni:
        for t in font['cmap'].tables:
            if t.isUnicode(): t.cmap[uni] = name

def composite(parts):
    g = Glyph(); g.numberOfContours = -1; g.components = []
    for name, x, y in parts:
        c = GlyphComponent(); c.glyphName = name; c.x = int(round(x)); c.y = int(round(y)); c.flags = 0x4 if not g.components else 0
        g.components.append(c)
    return g

# ---------- vẽ nét: đường tâm + độ dày -> một contour ----------
def stroke(points, t):
    L, R = [], []
    n = len(points)
    for i, (x, y) in enumerate(points):
        x0, y0 = points[max(i - 1, 0)]; x1, y1 = points[min(i + 1, n - 1)]
        dx, dy = x1 - x0, y1 - y0; d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d * t / 2, dx / d * t / 2
        L.append((x + nx, y + ny)); R.append((x - nx, y - ny))
    poly = L + R[::-1]
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly[::-1] if area > 0 else poly  # TrueType: contour ngoài theo chiều kim đồng hồ

def draw(polys):
    pen = TTGlyphPen(None)
    for poly in polys:
        pen.moveTo(tuple(map(round, poly[0])))
        for p in poly[1:]: pen.lineTo(tuple(map(round, p)))
        pen.closePath()
    return pen.glyph()

def bez(p0, p1, p2, n=18):
    return [((1-s)**2*p0[0]+2*(1-s)*s*p1[0]+s*s*p2[0], (1-s)**2*p0[1]+2*(1-s)*s*p1[1]+s*s*p2[1]) for s in (i/n for i in range(n+1))]

stem = bbox('l')[2] - bbox('l')[0]           # độ dày nét đứng của chữ l
T = stem * 0.78                               # độ dày dấu
ac = bbox('acutecomb'); acC = bbox('acutecomb.case')

# dấu hỏi: cung tròn mở sang trái + chân ngắn, cao bằng dấu sắc
def hook_glyph(base_bottom, height):
    r = height * 0.30
    yc = base_bottom + height - r - T / 2
    pts = [(r * math.cos(math.radians(a)), yc + r * math.sin(math.radians(a))) for a in range(160, -91, -10)]
    pts += [(0, yc - r - (height - 2 * r - T) * k) for k in (0.5, 1.0)]
    return draw([stroke(pts, T)])

H = ac[3] - ac[1]
add_glyph('hookabovecomb', hook_glyph(ac[1], H * 1.12), 0, 0x0309)
add_glyph('hookabovecomb.case', hook_glyph(acC[1], (acC[3] - acC[1]) * 1.12), 0)

# dấu nặng: lấy hình dấu chấm, đặt dưới chân chữ, tâm ở x = 0
px = bbox('period'); pw, ph = px[2] - px[0], px[3] - px[1]
pen = TTGlyphPen(None)
glyf['period'].draw(TransformPen(pen, (1, 0, 0, 1, -(px[0] + pw / 2), -px[3] - ph * 0.55)), glyf)
add_glyph('dotbelowcomb', pen.glyph(), 0, 0x0323)

# móc của ơ, ư: nét cong từ vai phải đi ra rồi vểnh lên
def horn_glyph(w, h):
    return draw([stroke(bez((0, 0), (w, h * 0.05), (w * 0.82, h)), T)])
add_glyph('horncomb', horn_glyph(stem * 1.5, XH * 0.36), 0, 0x031B)
add_glyph('horncomb.case', horn_glyph(stem * 1.7, CAP * 0.30), 0)

# ---------- toạ độ neo trên của từng chữ gốc (lấy từ glyph có sẵn như aacute) ----------
topx = {}
for code, gname in cmap.items():
    g = glyf[gname]
    if g.isComposite() and len(g.components) == 2 and g.components[1].glyphName.split('.')[0] in ('acutecomb', 'gravecomb', 'tildecomb', 'uni0302'):
        topx.setdefault(g.components[0].glyphName, g.components[1].x)
def center(name): b = bbox(name); return (b[0] + b[2]) / 2

MARK = {0x300: 'gravecomb', 0x301: 'acutecomb', 0x303: 'tildecomb', 0x309: 'hookabovecomb', 0x302: 'uni0302', 0x306: 'uni0306'}
GAP = 34

def build(ch):
    d = unicodedata.normalize('NFD', ch)
    base, marks = d[0], [ord(m) for m in d[1:]]
    upper = base.isupper()
    top = [m for m in marks if m in MARK]
    horn = 0x31B in marks; dot = 0x323 in marks
    bname = cmap[ord(base)]
    if base == 'i' and top: bname = 'dotlessi'
    parts = [(bname, 0, 0)]
    adv = hmtx[bname][0]
    b = bbox(bname)
    ax = topx.get(bname, center(bname))
    narrow = '.narrow' if bname == 'dotlessi' else ''
    if horn:
        hn = 'horncomb.case' if upper else 'horncomb'
        hb = bbox(hn)
        hx = b[2] - stem * 0.55
        hy = (CAP * 0.80) if upper else (XH * 0.74)
        parts.append((hn, hx, hy))
        adv = max(adv, hx + hb[2] + stem * 0.45)
    prev = None  # bbox của dấu trên vừa đặt (toạ độ tuyệt đối)
    for m in top:
        mn = MARK[m]
        if upper and mn + '.case' in glyf.keys(): mn += '.case'
        elif upper: mn = mn  # dấu hỏi chữ hoa đã có .case ở trên
        if narrow and mn + narrow in glyf.keys(): mn += narrow
        mb = bbox(mn)
        x, y = ax, 0
        if upper and mn in ('hookabovecomb',):
            mn = 'hookabovecomb.case'; mb = bbox(mn)
        if prev is not None:
            pw_ = prev[2] - prev[0]; ph_ = prev[3] - prev[1]
            if m == 0x303 or prev_mark == 0x306:          # ngã trên mũ, hoặc dấu trên trăng: đặt chồng lên
                y = prev[3] - mb[1] + GAP * 0.6
            elif m == 0x300:                                # huyền cạnh mũ: lệch trái
                y = prev[3] - mb[1] - ph_ * 0.30
                x = prev[0] - mb[2] + pw_ * 0.06
            else:                                           # sắc, hỏi cạnh mũ: lệch phải
                y = prev[3] - mb[1] - ph_ * 0.30
                x = prev[2] - mb[0] - pw_ * 0.06
        parts.append((mn, x, y))
        prev = (mb[0] + x, mb[1] + y, mb[2] + x, mb[3] + y); prev_mark = m
    if dot:
        dx = center(bname) + ((b[2] - b[0]) * 0.22 if base in 'yY' else 0)
        parts.append(('dotbelowcomb', dx, 0))
    return composite(parts), adv

VI = [0x1A0, 0x1A1, 0x1AF, 0x1B0] + list(range(0x1EA0, 0x1EFA))
made = 0
for cp in VI:
    if cp in cmap: continue
    g, adv = build(chr(cp))
    add_glyph('uni%04X' % cp, g, adv, cp); made += 1

# tên mới (font phái sinh theo OFL phải đổi tên nếu muốn, ở đây đổi để tránh nhầm với bản gốc)
fam, sub = 'Host Grotesk VN', {400: 'Regular', 500: 'Medium'}.get(WGHT, str(WGHT))
name = font['name']
for rec in list(name.names):
    if rec.nameID in (1, 16): rec.string = fam
    elif rec.nameID in (2, 17): rec.string = sub
    elif rec.nameID == 4: rec.string = f'{fam} {sub}'
    elif rec.nameID == 6: rec.string = f'HostGroteskVN-{sub}'
    elif rec.nameID == 3: rec.string = f'HostGroteskVN-{sub};vietized'
font['OS/2'].usWeightClass = WGHT
font.flavor = 'woff2' if OUT.endswith('.woff2') else None
font.save(OUT)
print('added', made, 'glyphs ->', OUT)
