"""Dựng chữ 3D (GLB) từ glyph của font Host Grotesk VN.

Chạy:  python tools/glyph3d.py M models/m-host-grotesk.glb
Tùy chọn: --font fonts/HostGroteskVN-Medium.woff2 --depth 0.32 --bevel 0.035 --steps 8
          --preset red|chrome|glass|glass-real|white  (ghi đè: --color --metal --rough)

Cần: pip install fonttools brotli trimesh shapely mapbox_earcut
Chữ được đùn khối, bo cạnh tròn hai mặt (profile 1/4 hình tròn), chuẩn hoá cao 1 đơn vị, đặt giữa gốc toạ độ.
"""
import argparse, math
import numpy as np
import trimesh
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import orient_polygons


def flatten(ops, seg=16):
    """Chuyển lệnh vẽ glyph thành danh sách đường khép kín (đường cong → đoạn thẳng)."""
    rings, cur, p0 = [], [], None
    for op, args in ops:
        if op == 'moveTo':
            cur = [args[0]]; p0 = args[0]
        elif op == 'lineTo':
            cur.append(args[0])
        elif op == 'qCurveTo':
            pts = [cur[-1], *args]
            # quadratic B-spline (TrueType): chèn điểm on-curve giữa các off-curve
            ctrl = pts[1:-1]; end = pts[-1]; start = pts[0]
            ons = [start]
            for i in range(len(ctrl) - 1):
                ons.append(((ctrl[i][0] + ctrl[i + 1][0]) / 2, (ctrl[i][1] + ctrl[i + 1][1]) / 2))
            ons.append(end)
            for i, c in enumerate(ctrl):
                a, b = ons[i], ons[i + 1]
                for t in np.linspace(0, 1, seg + 1)[1:]:
                    cur.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                                (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]))
        elif op == 'curveTo':
            a = cur[-1]; c1, c2, b = args
            for t in np.linspace(0, 1, seg + 1)[1:]:
                u = 1 - t
                cur.append((u ** 3 * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * b[0],
                            u ** 3 * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * b[1]))
        elif op in ('closePath', 'endPath'):
            if len(cur) > 2: rings.append(cur)
            cur = []
    return rings


def glyph_shape(font_path, char):
    f = TTFont(font_path)
    gs = f.getGlyphSet()
    name = f.getBestCmap()[ord(char)]
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    rings = [Polygon(r).buffer(0) for r in flatten(pen.value)]
    # even-odd: ghép đường ngoài và lỗ (chữ có lỗ như A, O, Đ)
    shape = Polygon()
    for r in sorted(rings, key=lambda p: -p.area):
        shape = shape.difference(r) if shape.contains(r) else shape.union(r)
    return shape


def ring_coords(poly):
    return [np.asarray(poly.exterior.coords)[:-1]] + [np.asarray(i.coords)[:-1] for i in poly.interiors]


def loft(a, b, za, zb, verts, faces):
    """Nối hai vòng cùng số điểm (a ở za, b ở zb) bằng dải tam giác."""
    n = len(a); base = len(verts)
    verts.extend([(x, y, za) for x, y in a]); verts.extend([(x, y, zb) for x, y in b])
    for i in range(n):
        j = (i + 1) % n
        faces.append((base + i, base + j, base + n + j))
        faces.append((base + i, base + n + j, base + n + i))


def cap(poly, z, up, verts, faces):
    v2, f2 = trimesh.creation.triangulate_polygon(poly, engine='earcut')
    base = len(verts)
    verts.extend([(x, y, z) for x, y in v2])
    for t in f2:
        faces.append((base + t[0], base + t[1], base + t[2]) if up else (base + t[0], base + t[2], base + t[1]))


def build(shape, depth, bevel, steps):
    verts, faces = [], []
    shape = orient_polygons(shape)  # ngoài ngược chiều kim đồng hồ, lỗ cùng chiều
    polys = list(shape.geoms) if shape.geom_type == 'MultiPolygon' else [shape]
    for poly in polys:
        # các lớp inset theo profile 1/4 tròn: inset = r(1-cos), z-offset = r(1-sin)
        layers = []
        for k in range(steps + 1):
            th = (math.pi / 2) * k / steps
            inset = bevel * (1 - math.sin(th))
            dz = bevel * (1 - math.cos(th))
            p = poly if inset == 0 else orient_polygons(poly.buffer(-inset, join_style='mitre', mitre_limit=10))
            layers.append((p, dz))
        # vòng điểm từng lớp phải tương ứng 1-1; buffer mitre giữ nguyên số đỉnh với chữ thẳng như M
        rings = [ring_coords(p) for p, _ in layers]
        if any(len(r) != len(rings[-1]) or any(len(a) != len(b) for a, b in zip(r, rings[-1])) for r in rings):
            raise SystemExit('Bevel quá lớn hoặc glyph có đường cong: giảm --bevel.')
        zf, zb = depth / 2, -depth / 2
        # mặt trước (z dương) và mặt sau
        cap(layers[0][0], zf, True, verts, faces)
        cap(layers[0][0], zb, False, verts, faces)
        for r in range(len(rings[0])):
            for k in range(steps):
                a, b = rings[k][r], rings[k + 1][r]
                loft(a, b, zf - layers[k][1], zf - layers[k + 1][1], verts, faces)   # bo cạnh trước
                loft(b, a, zb + layers[k + 1][1], zb + layers[k][1], verts, faces)   # bo cạnh sau
            full = rings[steps][r]
            loft(full, full, zf - bevel, zb + bevel, verts, faces)                 # thành bên
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=True)
    m.merge_vertices()
    m.fix_normals()
    return m


# chất liệu dựng sẵn; extensions = phần mở rộng glTF (model-viewer, three.js, Blender đều đọc được)
PRESETS = {
    'red':    dict(color='#ff1d12', metal=0.15, rough=0.32),
    'chrome': dict(color='#f2f3f5', metal=1.0, rough=0.06),
    # Liquid Glass cho web: kính trong pha alpha (thấy nền CSS phía sau như icon trên web),
    # mép bắt sáng nhờ clearcoat + specular. Muốn kính khúc xạ thật để render Blender: --preset glass-real
    'glass':  dict(color='#ffffff', alpha=0.22, metal=0.0, rough=0.05, ext={
        'KHR_materials_clearcoat': {'clearcoatFactor': 1.0, 'clearcoatRoughnessFactor': 0.02},
        'KHR_materials_ior': {'ior': 1.5},
        'KHR_materials_specular': {'specularFactor': 1.0}}),
    'glass-real': dict(color='#ffffff', metal=0.0, rough=0.12, ext={
        'KHR_materials_transmission': {'transmissionFactor': 1.0},
        'KHR_materials_ior': {'ior': 1.45},
        'KHR_materials_volume': {'thicknessFactor': 0.32, 'attenuationDistance': 1.2,
                                 'attenuationColor': [0.93, 0.95, 1.0]},
        'KHR_materials_clearcoat': {'clearcoatFactor': 1.0, 'clearcoatRoughnessFactor': 0.04}}),
    # nhựa trắng mờ (satin): nhám nhẹ, phủ một lớp bóng mỏng
    'white':  dict(color='#ecebe7', metal=0.0, rough=0.62, ext={
        'KHR_materials_clearcoat': {'clearcoatFactor': 0.35, 'clearcoatRoughnessFactor': 0.3}}),
}


def patch_glb(path, ext):
    """Gắn extension chất liệu vào JSON chunk của file GLB."""
    import json, struct
    data = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + jlen])
    rest = data[20 + jlen:]
    for m in doc['materials']:
        m.setdefault('extensions', {}).update(ext)
        if 'KHR_materials_transmission' in ext:
            m['alphaMode'] = 'OPAQUE'
    doc['extensionsUsed'] = sorted(set(doc.get('extensionsUsed', [])) | set(ext))
    j = json.dumps(doc, separators=(',', ':')).encode()
    j += b' ' * (-len(j) % 4)
    total = 12 + 8 + len(j) + len(rest)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(j), 0x4E4F534A) + j + rest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('char'); ap.add_argument('out')
    ap.add_argument('--font', default='fonts/HostGroteskVN-Medium.woff2')
    ap.add_argument('--depth', type=float, default=0.32)
    ap.add_argument('--bevel', type=float, default=0.035)
    ap.add_argument('--steps', type=int, default=8)
    ap.add_argument('--preset', choices=sorted(PRESETS), default='red')
    ap.add_argument('--color'); ap.add_argument('--metal', type=float); ap.add_argument('--rough', type=float)
    a = ap.parse_args()
    pr = PRESETS[a.preset]
    color = a.color or pr['color']
    metal = pr['metal'] if a.metal is None else a.metal
    rough = pr['rough'] if a.rough is None else a.rough

    shape = glyph_shape(a.font, a.char)
    minx, miny, maxx, maxy = shape.bounds
    s = 1.0 / (maxy - miny)  # chuẩn hoá chiều cao = 1
    from shapely import affinity
    shape = affinity.translate(shape, -(minx + maxx) / 2, -(miny + maxy) / 2)
    shape = affinity.scale(shape, s, s, origin=(0, 0))

    mesh = build(shape, a.depth, a.bevel, a.steps)
    # tách mặt phẳng và cạnh bo bằng smoothing theo góc để bóng đổ sắc nét ở thành, mượt ở bo
    mesh = trimesh.graph.smooth_shade(mesh, angle=math.radians(35))
    # glTF lưu màu ở không gian linear: đổi từ mã hex sRGB
    srgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name=f'glyph-{a.preset}', baseColorFactor=[*rgb, pr.get('alpha', 1.0)],
        alphaMode='BLEND' if pr.get('alpha', 1.0) < 1 else 'OPAQUE', metallicFactor=metal, roughnessFactor=rough))
    # GLB dùng trục Y hướng lên: chữ đã nằm trên mặt XY, mặt trước nhìn về +Z
    mesh.export(a.out)
    if pr.get('ext'): patch_glb(a.out, pr['ext'])
    print(f'{a.out}: {a.preset}, {len(mesh.vertices)} đỉnh, {len(mesh.faces)} mặt, kín nước={mesh.is_watertight}')


if __name__ == '__main__':
    main()
