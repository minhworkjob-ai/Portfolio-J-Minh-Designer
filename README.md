# Portfolio Thương Hiệu

Website tĩnh tạo từ vault Obsidian (`../Obsidian Vault`). Không cần cài thư viện, chỉ cần Node.js.

## Cập nhật nội dung
1. Sửa ghi chú trong Obsidian như bình thường.
2. Chạy `node build.mjs` trong thư mục này. Web được tạo vào thư mục `docs/`.
3. Mở `docs/index.html` để xem thử trên máy.

## Chọn ghi chú nào được công khai
- Mặc định chỉ xuất bản các ghi chú trong thư mục ở `include` của `site.config.json`.
- Muốn thêm một ghi chú lẻ: thêm `publish: true` vào frontmatter của ghi chú đó.
- Muốn giấu một ghi chú: thêm `publish: false`.
- Các mục "File gốc trên máy", "Nguồn tham khảo", "Liên quan", "Ghi chú", "Mâu thuẫn", "Đối thủ", "Lỗi trên bảng cần biết" luôn bị cắt khỏi bản công khai (xem `stripSections`).
- Thư mục `raw/` không bao giờ được xuất bản, chỉ ảnh mà ghi chú công khai nhúng mới được sao chép.

## Đưa lên GitHub Pages (một lần)
1. Tạo kho mới trên github.com, ví dụ `portfolio`.
2. Trong thư mục này:
   ```
   git init -b main
   git add .
   git commit -m "Portfolio đầu tiên"
   git remote add origin https://github.com/TEN_TAI_KHOAN/portfolio.git
   git push -u origin main
   ```
3. Trên GitHub: Settings → Pages → Source: "Deploy from a branch" → Branch `main`, thư mục `/docs` → Save.
4. Sau 1–2 phút web có tại `https://TEN_TAI_KHOAN.github.io/portfolio/`.

## Mỗi lần cập nhật sau đó
```
node build.mjs
git add . && git commit -m "Cập nhật" && git push
```
