# Model 3D cho web

Chữ **M** 3D dựng từ font Host Grotesk VN Medium: đùn khối dày 0.32, bo cạnh tròn, cao 1 đơn vị, tâm ở gốc, mặt trước nhìn về +Z.
Mỗi file ~11 KB.

| File | Chất liệu | Nền hợp nhất | Gợi ý `<model-viewer>` |
|---|---|---|---|
| `m-host-grotesk.glb` | Đỏ thương hiệu `#ff1d12`, hơi bóng | tối `#0b0b0b` | `environment-image="neutral"` |
| `m-host-grotesk-chrome.glb` | Chrome gương | tối | `environment-image="models/studio-env.jpg"` (bắt buộc, không có sẽ đen) |
| `m-host-grotesk-glass.glb` | Liquid Glass (kính trong, thấy nền CSS phía sau) | đỏ `#ff1d12` / ảnh | `environment-image="models/studio-env.jpg" shadow-intensity="0.3"` |
| `m-host-grotesk-glass-real.glb` | Kính khúc xạ thật (transmission) | — | Dùng cho Blender / render; trên web chỉ khúc xạ vật 3D khác, không thấy nền CSS |
| `m-host-grotesk-white.glb` | Nhựa trắng satin | giấy `#f1ede4` hoặc tối | `environment-image="neutral"` |
| `studio-env.jpg` | Ánh sáng studio 2048×1024 (softbox + 2 vệt đỏ) | — | Dùng chung cho chrome và kính |
| `m-host-grotesk.webp` | Ảnh poster bản đỏ 1200px | — | `poster=` |

Dựng lại / dựng chữ khác:
```
python tools/glyph3d.py M models/m-host-grotesk-chrome.glb --preset chrome   # red | chrome | glass | glass-real | white
python tools/studio_env.py models/studio-env.jpg
```
Font gốc: Host Grotesk, SIL OFL 1.1. Model là hình khối dựng từ font (không nhúng file font), dùng thương mại được.
