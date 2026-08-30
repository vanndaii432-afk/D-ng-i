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


## Tự động duyệt Vietcombank
Bản này đã có sẵn endpoint backend `POST /api/payments/vietcombank` để nhận thông báo giao dịch từ hệ thống Vietcombank/Open Banking hoặc nhà cung cấp thanh toán được bạn ủy quyền. Khi nhận giao dịch, shop đối chiếu **mã đơn trong nội dung chuyển khoản + số tiền** rồi tự chuyển đơn sang `PAID` và cấp Key/mở file.

### Cấu hình Render
- `ADMIN_PASSWORD`: mật khẩu Admin.
- `VCB_WEBHOOK_SECRET`: một chuỗi bí mật do bạn tự tạo để xác thực callback.

Callback URL sau khi deploy:
`https://TEN-MIEN-RENDER-CUA-BAN/api/payments/vietcombank`

Header xác thực:
`X-Webhook-Secret: <VCB_WEBHOOK_SECRET>`

Nội dung chuyển khoản mà khách cần nhập là **mã đơn hàng**, ví dụ `TVABC123`. Shop hiển thị mã này ngay cạnh QR.

**Quan trọng:** Vietcombank hiện cung cấp các giải pháp kết nối H2H/Open API cho khách hàng doanh nghiệp; việc bật callback/API thực tế phải được Vietcombank hoặc đơn vị thanh toán được bạn sử dụng cấp thông tin kết nối. Chỉ thêm endpoint trong shop không tự tạo quyền truy cập vào tài khoản Vietcombank. Xem thông tin chính thức của Vietcombank về kết nối H2H/API: https://www.vietcombank.com.vn/vi-VN/To-chuc/Trang-chu-DCTC/Giai-phap/DCTC---Thanh-toan/DCTC---Ket-noi-he-thong


## Lưu ý đăng nhập
- Mật khẩu Admin không nằm trong mã nguồn. Trên Render phải tạo biến `ADMIN_PASSWORD` đúng mật khẩu Admin của bạn.
- Tạo thêm `SESSION_SECRET` là một chuỗi ngẫu nhiên dài để phiên đăng nhập khách hàng ổn định sau restart.
- Nếu đổi/redeploy mà không dùng persistent disk/database, `data/users.json`, `orders.json`, `keys.json` có thể mất.

## QR thanh toán
- `public/payment-qr.png` đã được thay bằng mã QR Vietcombank do chủ shop cung cấp.
- Mã QR VietQR có thể chứa thông tin ngân hàng, số tài khoản, số tiền và nội dung giao dịch. citeturn0search0
