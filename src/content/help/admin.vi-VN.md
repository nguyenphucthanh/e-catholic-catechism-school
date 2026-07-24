# Hướng dẫn dành cho Quản trị viên hệ thống (Admin)

Chào mừng bạn đến với trang hướng dẫn dành cho Quản trị viên. Bạn giữ vai trò quản lý cấp cao nhất, chịu trách nhiệm về cấu hình hệ thống cốt lõi và phân quyền bảo mật cho toàn bộ ứng dụng.

---

## ⚙️ Cấu hình hệ thống chung (App Config)

Admin chịu trách nhiệm cập nhật các thông tin cơ bản mang tính nhận diện của Đoàn, tại trang **App Config**.

### Các thiết lập chính

- **Tên Giáo xứ (Parish Name)** (bắt buộc): Tên Giáo xứ nơi trường hoạt động (VD: Giáo xứ Tân Định).
- **Tên Giáo phận (Diocese Name)** (bắt buộc): Giáo phận mà giáo xứ trực thuộc.
- **Tên Đoàn TNTT (Troop Name)** (tùy chọn): Tên Đoàn Thiếu Nhi Thánh Thể (VD: Đoàn Anrê Phú Yên).
- **Logo Đoàn**: Tải lên logo chính thức để hiển thị trên màn hình đăng nhập và trang in ấn.
- **Định dạng tên (Name Format)**: Chọn thứ tự hiển thị họ/tên.
- **Tùy chọn Lịch Phụng vụ**: Bật/tắt việc cử hành Lễ Hiển Linh, Mình Máu Thánh Chúa, và Lễ Chúa Thăng Thiên vào Chúa Nhật.

---

## 🔒 Phân quyền hệ thống & Tài khoản Admin

Chỉ có tài khoản Admin mới có quyền gán vai trò quản trị hệ thống (`admin`) cho các Giáo lý viên khác.

### Quản lý quyền Admin

- Đi tới trang **Tài khoản Giáo lý viên** (Catechist Accounts) hoặc **Tài khoản Học sinh** (Student Accounts).
- Nhấp chỉnh sửa tài khoản Giáo lý viên cần cấp quyền.
- Gán vai trò hệ thống thành `admin` hoặc thu hồi về `user`.
- **Lưu ý quan trọng**: Luôn giữ ít nhất một tài khoản hoạt động ở quyền `admin` để tránh mất quyền quản trị.

---

## 🛠️ Bảo trì & Quản trị Cơ sở dữ liệu (Database Maintenance)

Bảo trì cơ sở dữ liệu và giám sát các thay đổi hệ thống.

- **Convex Dashboard**: Sử dụng bảng điều khiển Convex để theo dõi các truy vấn và kiểm tra hiệu năng hệ thống.
- **Xử lý sự cố**: Khôi phục mật khẩu cho các giáo lý viên bị quên thông tin đăng nhập, giải quyết các lỗi đồng bộ điểm danh QR ngoại tuyến (dữ liệu điểm danh lưu tạm trên thiết bị và đồng bộ khi có mạng trở lại).
