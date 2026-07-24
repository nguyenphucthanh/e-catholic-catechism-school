# Hướng dẫn dành cho Ban trị sự / Ban điều hành

Chào mừng bạn đến với trang hướng dẫn dành cho Ban trị sự. Bạn phụ trách quản lý toàn diện trường giáo lý theo từng năm học, bao gồm điều phối nhân sự, cơ cấu lớp học, và cấu hình hệ thống.

---

## 📅 Thiết lập Năm học mới (Academic Year Setup)

Việc chuyển giao và chuẩn bị cho năm học mới là quy trình quan trọng nhất, thực hiện qua trình thuật (wizard) **Academic Year Setup** gồm 5 bước.

### Quy trình thiết lập năm học

1. Vào menu **Năm Học**.
2. Mở **Academic Year Setup** và thực hiện theo trình thuật:
   - **Bước 1: Tạo năm học mới** — nhập ngày bắt đầu, ngày kết thúc.
   - **Bước 2: Đặt năm học mới làm năm hoạt động** — hệ thống sẽ vận hành theo năm học này.
   - **Bước 3: Tạo lớp học hàng loạt** — định nghĩa các lớp học (ví dụ: Ấu 1A, Nghĩa 2B).
   - **Bước 4: Lên lớp / Ghi danh Học sinh** — chuyển Học sinh từ lớp năm học trước lên, hoặc ghi danh Học sinh mới.
   - **Bước 5: Phân công Giáo lý viên** — giao giáo lý viên làm chủ nhiệm hoặc đồng giảng cho từng lớp.

> [!IMPORTANT]
> **Khóa dữ liệu & Trạng thái Năm học**: Các thao tác chỉnh sửa dữ liệu theo năm học (như tạo buổi học, điểm danh, ghi danh) yêu cầu năm học đó phải ở trạng thái Đang hoạt động (`is_active = true`). Các năm học cũ hoặc chưa kích hoạt sẽ tự động bị khóa để bảo toàn dữ liệu lịch sử.

---

## 👥 Quản lý Nhân sự & Phân công vai trò

Ban trị sự quản lý toàn bộ phân công công tác trong năm học. Đây là các phân công gắn với tài khoản Giáo lý viên hiện có, không phải vai trò hệ thống riêng.

### Phân công Ban trị sự & Trưởng ngành

- **Ủy viên Ban trị sự (Board assignment)**: Gán vai trò Ban trị sự cho giáo lý viên trong năm học hiện hành để họ có quyền quản lý.
- **Trưởng ngành / Phó ngành**: Phân công Giáo lý viên phụ trách dẫn dắt từng Phân đoàn/Ngành cụ thể.
- **Giáo lý viên đứng lớp**: Thiết lập vai trò đứng lớp (Chủ nhiệm/Đồng giảng) cho từng lớp học.

> [!NOTE]
> **Bảo toàn dữ liệu (Xóa mềm - Soft Delete)**: Khi xóa Học sinh, Giáo lý viên hoặc Lớp học, hệ thống không xóa vĩnh viễn khỏi cơ sở dữ liệu mà chỉ đánh dấu `is_deleted = true`. Điều này giúp các báo cáo lịch sử và bảng điểm chuyên cần cũ luôn được bảo toàn chính xác.

---

## 📥 Nhập dữ liệu hàng loạt từ Excel/CSV

Để tiết kiệm thời gian, bạn có thể nhập danh sách Học sinh và Giáo lý viên hàng loạt tại trang **Import** (chỉ dành cho Admin).

### Hướng dẫn nhập file

Trình thuật nhập dữ liệu gồm 7 bước:

1. **Upload File** — chọn file CSV/Excel.
2. **Configuration** — thiết lập tùy chọn nhập.
3. **Map Columns** — ánh xạ các cột trong file của bạn với các trường dữ liệu tương ứng (Họ tên, ngày sinh, tên thánh, số điện thoại...).
4. **Preview & Validate** — xem trước dữ liệu và xử lý các cảnh báo lỗi.
5. **Confirm Import** — xác nhận trước khi lưu.
6. **Importing** — hệ thống xử lý file.
7. **Import Result** — xem kết quả nhập thành công/thất bại.

