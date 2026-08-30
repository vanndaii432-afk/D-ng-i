# Shop Trần Vinh — Render

## Deploy
- Tạo Web Service trên Render từ repository này.
- Runtime: Node.
- Build Command: `npm install`
- Start Command: `npm start`
- Port: dùng biến `PORT` của Render.
- Nên tạo Environment Variable `ADMIN_PASSWORD` và đặt mật khẩu admin thật; code hiện có giá trị mặc định `tranvinhzin` để test.

## Luồng
1. Khách đăng ký/đăng nhập.
2. Chưa đăng nhập không thể tạo đơn.
3. Bấm **Mua ngay** → tạo mã đơn.
4. Quét QR và chuyển đúng số tiền.
5. Admin xác nhận trong `/admin`.
6. AIM IOS/ADR mở tải file; PANEL VIP cấp Key sau xác nhận.

## Lưu ý dữ liệu
Bản này lưu users/orders/keys trong `data/*.json`. Render filesystem có thể không phù hợp để lưu dữ liệu lâu dài sau redeploy. Khi chạy thật nên chuyển sang PostgreSQL hoặc persistent disk.
