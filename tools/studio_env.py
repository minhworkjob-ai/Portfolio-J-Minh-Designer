"""Tạo ảnh môi trường studio (equirectangular 2:1) cho chất liệu chrome / kính trên web.
Chạy: python tools/studio_env.py models/studio-env.jpg
Bầu trời xám sáng dần lên đỉnh, đường chân trời rõ, sàn tối, softbox lớn bao quanh
và 2 vệt đỏ thương hiệu #ff1d12 để mép chữ bắt sáng đỏ."""
import sys, numpy as np
from PIL import Image, ImageFilter
W, H = 2048, 1024
v = np.linspace(0, 1, H)[:, None]
sky = 0.30 + 0.55 * np.clip(1 - v / 0.5, 0, 1) ** 1.5          # 0.85 ở đỉnh → 0.30 ở chân trời
img = np.repeat(np.repeat(sky[..., None], W, 1), 3, 2)
fl = np.linspace(0.20, 0.06, H - H // 2)[:, None, None]  # sàn xám đậm → tối dần xuống dưới
img[H // 2:] = fl
def box(u0, u1, v0, v1, rgb):
    img[int(v0 * H):int(v1 * H), int(u0 * W):int(u1 * W)] = rgb
for u in (0.08, 0.33, 0.58, 0.83):                    # 4 softbox dọc bao quanh 360°
    box(u, u + 0.09, 0.14, 0.46, (1, 1, 1))
    box(u + 0.11, u + 0.22, 0.40, 0.62, (0.9, 0.9, 0.92))  # softbox thấp ngang tầm chữ (mặt phẳng chrome phản chiếu)
box(0.0, 1.0, 0.0, 0.05, (1, 1, 1))                   # đèn trần
box(0.47, 0.49, 0.10, 0.48, (1.0, 0.11, 0.07))        # vệt đỏ
box(0.97, 0.99, 0.10, 0.48, (1.0, 0.11, 0.07))
im = Image.fromarray((np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(5))
im.save(sys.argv[1], quality=88)
print(sys.argv[1], im.size)
