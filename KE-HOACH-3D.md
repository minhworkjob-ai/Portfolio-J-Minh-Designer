# Kế hoạch: Ảnh → 3D (Comfy Cloud) → Portfolio & Web

## 1. Workflow đã dựng trên Comfy Cloud

| Workflow | Dùng cho | Model | Đầu ra | Chi phí |
|---|---|---|---|---|
| [JMinh - Nhan vat sang 3D (Hunyuan3D 3.1 PBR)](https://cloud.comfy.org/#e658ac32-f59b-400b-9bc1-ce3c7146c2de) | Nhân vật, mascot, sản phẩm, vật thể | Tencent Hunyuan3D 3.1 (API) | GLB + OBJ + 4 map PBR (basecolor, metallic, normal, roughness) | ~190 credit/lần |
| [JMinh - Boi canh sang 3D (MoGe-2)](https://cloud.comfy.org/#d75f0ebd-ae73-4c2e-a266-d3b7240991a4) | Bối cảnh, phòng, set, key visual có chiều sâu | MoGe-2 (open source) | GLB có texture (mesh 2.5D) | 0 credit API |

**Vì sao tách 2 workflow:** Hunyuan3D chỉ dựng **vật thể đơn lẻ**, không dựng được cảnh. Với bối cảnh, MoGe-2 ước lượng độ sâu từ 1 ảnh để ra mesh 2.5D. Mesh này đẹp khi xoay nhẹ khoảng ±25°, rất hợp làm hiệu ứng parallax trên web.

**Lựa chọn khác khi cần:**
- Nhân vật chỉ có 1 ảnh mặt trước → chạy template *Generate Multiple Angles* (Qwen Edit) để tạo ảnh mặt sau/bên, rồi đưa vào ô ②–④ của workflow nhân vật.
- Cần bản miễn phí, chỉ lấy khối trắng → template `3d_hunyuan3d-v2.1` (open source).
- Bối cảnh 360° → template *MoGe: Panorama to Mesh*.
- Muốn hiệu ứng "hạt sáng" thay cho mesh → *Idol / TripoSplat: Image to Gaussian Splat*.

### Chuẩn bị ảnh đầu vào
- **Nhân vật:** đứng giữa khung, thấy toàn thân, nền trơn hoặc đã tách nền (dùng Photoshop *Remove Background*). Ảnh từ 1024px trở lên, ánh sáng đều. Nếu định rig thì để tư thế chữ A hoặc T.
- **Bối cảnh:** phối cảnh rõ, có tiền cảnh, trung cảnh và hậu cảnh. Tránh kính, gương và bề mặt phản chiếu mạnh.

## 2. Tối ưu model cho web (bắt buộc trước khi nhúng)

Model lấy thẳng từ Hunyuan thường nặng 20–60 MB, cần nén xuống mục tiêu: **hero ≤ 3 MB, model trong trang dự án ≤ 6 MB**.

```bash
# một lần: npm i -g @gltf-transform/cli
gltf-transform optimize character.glb character-web.glb \
  --compress draco --texture-compress webp --texture-size 2048 --simplify-ratio 0.5
```

- Ảnh poster (hiện trong lúc chờ tải và làm ảnh dự phòng): chụp 1 khung từ Comfy preview hoặc Blender, xuất WebP 1600px.
- Đặt tên file: `ten-du-an-nhan-vat.glb` và `ten-du-an-nhan-vat.webp`.
- Muốn chỉnh tay (UV, vật liệu, ánh sáng) thì mở OBJ/GLB trong Blender hoặc Adobe Substance 3D, xuất lại GLB.

## 3. Nhúng vào Portfolio (repo này)

Dùng thư viện **`<model-viewer>`** của Google (1 script, không cần build, hỗ trợ xoay, zoom và AR trên điện thoại).

### 3a. Hero trang chủ (ưu tiên)
Thay ảnh trong khối đỏ `.redpanel` bằng model 3D xoay chậm. Nếu chưa có model thì vẫn giữ ảnh như cũ.

- `site.config.json`: thêm
  ```json
  "hero3d": { "src": "models/hero.glb", "poster": "models/hero.webp", "alt": "Nhân vật 3D J Minh" }
  ```
- `theme.mjs` → hàm `hero()`: khi có `cfg.hero3d` thì render
  ```html
  <model-viewer src="models/hero.glb" poster="models/hero.webp" alt="…"
    auto-rotate auto-rotate-delay="0" rotation-per-second="12deg"
    camera-controls disable-zoom interaction-prompt="none"
    shadow-intensity="0.6" exposure="1.1" loading="lazy" reveal="auto"></model-viewer>
  ```
  Script chỉ nạp khi trang có model:
  `<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>`
- `build.mjs`: sao chép thư mục `models/` (ngoài vault) vào `docs/models/`.
- Màn hình nhỏ hoặc khi người xem bật `prefers-reduced-motion`: tắt auto-rotate, chỉ hiện poster.

### 3b. Trang dự án (từ Obsidian)
Trong ghi chú dự án, thêm frontmatter:
```yaml
model3d: models/ten-du-an-nhan-vat.glb
model3d_poster: models/ten-du-an-nhan-vat.webp
```
`build.mjs` thấy trường này thì chèn một khối viewer 3D ngay dưới ảnh bìa. Trên điện thoại bật thêm nút **AR** (`ar ar-modes="webxr scene-viewer quick-look"`); riêng iOS cần thêm file `.usdz`, có thể chuyển từ GLB bằng Reality Converter.

### 3c. Carousel "Dự án"
Thêm tab **3D** vào `carousel()` và `carousel.js`. Mỗi thẻ hiện poster tĩnh, chỉ khi thẻ đang ở giữa mới nạp `<model-viewer>`, để trang luôn nhẹ.

### 3d. Bối cảnh MoGe (parallax)
Dùng `<model-viewer>` với camera khóa góc: `min-camera-orbit="-25deg 80deg auto" max-camera-orbit="25deg 100deg auto"`. Model nghiêng theo chuột (hoặc theo con quay hồi chuyển trên điện thoại) qua `fx.js`. Hiệu ứng này dùng làm nền hero hoặc banner đầu trang dự án.

## 4. Kênh khác ngoài portfolio
- **Website khách hàng / landing:** dùng chung đoạn `<model-viewer>` ở trên. Nếu làm bằng Framer thì dùng component Embed hoặc Code Component.
- **Figma:** xuất poster và chuỗi ảnh xoay 360° để trình bày. Nếu cần prototype 3D tương tác thì nhúng link Framer.
- **Behance:** upload GLB qua mục *3D* của project.
- **Social (CapCut / After Effects):** render turntable 360° từ Blender (1080×1350 hoặc 1080×1920), hoặc nhập GLB thẳng vào After Effects (Advanced 3D).

## 5. Các bước tiếp theo

| # | Việc | Ai |
|---|---|---|
| 1 | Chọn 1 nhân vật và 1 bối cảnh làm thử, gửi ảnh | Studio |
| 2 | Chạy 2 workflow, kiểm tra GLB trong Comfy preview | Claude, sau khi studio duyệt credit |
| 3 | Tối ưu GLB, tạo poster | Claude |
| 4 | Code 3a (hero) và 3b (trang dự án), build thử `docs/`, chụp màn hình desktop và mobile | Claude |
| 5 | Duyệt giao diện, merge lên `main` để GitHub Pages cập nhật | Studio |
| 6 | (Tùy chọn) tab 3D trong carousel, parallax bối cảnh, AR | Claude |

**Lưu ý giấy phép:** Hunyuan3D 3.1 chạy qua API Comfy/Tencent, nên kiểm tra điều khoản thương mại của Comfy Cloud khi dùng cho khách. Các bản Hunyuan3D open source (2.x) dùng *Tencent Community License*, giấy phép này không áp dụng ở EU, Anh và Hàn Quốc. MoGe dùng giấy phép MIT.
