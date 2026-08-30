# Shop Trần Vinh — Render

## Deploy
- Tạo Web Service trên Render từ repository này.
- Runtime: Node.
- Build Command: `npm install`
- Start Command: `npm start`
- Port: dùng biến `PORT` của Render.
- **Bắt buộc** tạo Environment Variable `ADMIN_PASSWORD` trên Render và đặt mật khẩu Admin của bạn.
- Mật khẩu Admin **không được hiển thị trong giao diện** và không được đặt mặc định trong code.

## Luồng mua hàng
1. Khách đăng ký hoặc đăng nhập.
2. Chưa đăng nhập thì nút **Mua ngay** sẽ đưa khách tới trang đăng nhập.
3. Chọn sản phẩm/thời hạn và bấm **Mua ngay** để tạo đơn.
4. Hệ thống hiển thị mã đơn, số tiền và QR thanh toán.
5. Admin vào `/admin`, đăng nhập và xác nhận đơn sau khi kiểm tra giao dịch.
6. PANEL VIP: panel có thể tải miễn phí trước; **Key chỉ cấp sau khi thanh toán được xác nhận**.
7. AIM IOS / AIM ADR: **file chỉ tải được sau khi đơn được xác nhận**.

## Đã sửa trong bản này
- Xóa hoàn toàn dòng làm lộ mật khẩu Admin trên giao diện.
- Nút Mua ngay dùng sự kiện JavaScript rõ ràng và có kiểm tra đăng nhập.
- Sửa route tải file sau thanh toán để hoạt động đúng.
- Sửa mô tả xuống dòng thật, không còn hiện `\n`.
- Thu gọn card, chữ, nút và bố cục cho màn hình iPhone.
- Trang Đăng nhập/Đăng ký được làm lại gọn, có chuyển tab và giữ đường dẫn quay lại sau đăng nhập.
- Admin Test tạo đơn 0đ đúng số tiền 0đ.
- Không hiển thị mật khẩu Admin trong HTML.

## Dữ liệu
Bản này lưu users/orders/keys trong `data/*.json`. Render filesystem có thể không phù hợp để lưu dữ liệu lâu dài sau redeploy. Khi chạy thật nên dùng PostgreSQL hoặc persistent disk.
