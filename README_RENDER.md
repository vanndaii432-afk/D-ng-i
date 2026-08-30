# Shop Trần Vinh — bản fix hoàn toàn

## Chạy trên Render
- Build command: `yarn install`
- Start command: `node server.js`
- Node: `>=18`

## Admin
Mật khẩu Admin cố định của bản này: `shopvinhzin`.
Không cần nhập tài khoản Admin, chỉ nhập mật khẩu.

## Thanh toán
- Nút **Mua ngay** yêu cầu khách đăng nhập tài khoản trước.
- Sau khi tạo đơn, trang thanh toán hiện ngay QR Vietcombank tại `/payment-qr.png`.
- Nội dung chuyển khoản là mã đơn hàng.
- Admin vào `/admin`, đăng nhập bằng mật khẩu rồi bấm **Xác nhận đã nhận tiền**.
- Sau khi xác nhận, file/key được mở cho đúng tài khoản tạo đơn.

## Lưu ý quan trọng trên Render
Dữ liệu `data/orders.json` và `data/users.json` nằm trên filesystem của service. Với Render không có persistent disk, dữ liệu có thể mất khi service được recreate/deploy. Nếu cần lưu đơn/tài khoản lâu dài, nên dùng database (Postgres/SQLite trên persistent disk).

## Đã loại bỏ
- Sản phẩm/file `DVI XANH - Keo Mờ` (ADR) đã được xóa khỏi bản này.
