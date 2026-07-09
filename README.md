# Hệ thống Quản lý Trường Giáo lý / e-Catholic Catechism School (eCCS)

Chào mừng bạn đến với **eCCS** một giải pháp kỹ thuật số hiện đại được thiết kế để chuẩn hóa và tối ưu hóa việc quản lý Trường Giáo Lý Công Giáo.

---

## 📌 Tổng Quan Hệ Thống

Hệ thống này hỗ trợ đắc lực cho công tác quản lý của một Trường Giáo Lý, giải quyết triệt để các thách thức về điểm danh hàng tuần, theo dõi điểm số học tập, và quản lý hồ sơ Bí tích của học sinh qua nhiều năm học. Nhờ thiết kế linh hoạt, hệ thống có thể tùy biến dễ dàng để phù hợp với cả các môi trường trong nước và quốc tế.

---

## 👥 Vai Trò Người Dùng

Hệ thống được thiết kế tối ưu hóa cho từng đối tượng tương tác chính:

### 1. Giáo Lý Viên
* Là đối tượng sử dụng chính của hệ thống. Giáo lý viên có thể điểm danh nhanh chóng bằng camera (quét mã QR) ngay cả khi không có mạng, nhập điểm số trực tiếp, và cập nhật tình hình lớp học thuận tiện trên điện thoại hoặc máy tính bảng.


### 2. Ban Thường Vụ
* Theo dõi bức tranh tổng thể của Trường thông qua biểu đồ trực quan, quản lý nhân sự (Giáo lý viên), phân bổ lớp học, duyệt cấu trúc điểm số, và tra cứu lịch sử học tập/Bí tích của bất kỳ học sinh nào qua các năm học.

### 3. Phụ Huynh & Học Sinh
* Theo dõi chuyên cần (Đi lễ Chúa Nhật & Học giáo lý), cập nhật điểm số, và nhận thông báo quan trọng từ Ban trị sự. Hệ thống liên kết thông minh các anh chị em ruột trong gia đình dưới một tài khoản phụ huynh duy nhất.

---

## ⚡ Các Tính Năng Cốt Lõi

| Tính năng / Feature | Mô tả chi tiết / Detailed Description |
| :--- | :--- |
| **Điểm Danh QR & Ngoại Tuyến** | Điểm danh siêu tốc (<200ms/học sinh) qua thẻ mã QR. Ứng dụng PWA lưu trữ offline trên IndexedDB và tự động đồng bộ khi có mạng với cơ chế giải quyết xung đột thông minh. |
| **Cấu Trúc Học Tập Linh Hoạt** | Tổ chức theo Ngành, và các Lớp học. Hỗ trợ quản lý niên khóa / lớp và lưu giữ trọn vẹn lịch sử học tập nhiều năm. |
| **Đánh Giá & Điểm Số** | Hỗ trợ các loại chấm điểm linh hoạt (Thang điểm 10, Pass-Fail, A-F) và quản lý tiến trình Bí tích. |
| **Lịch & Sự Kiện** | Quản lý lịch sinh hoạt, phụng vụ, các sự kiện đặc biệt của Trường với cấp độ quan trọng được trực quan hóa (Cao, Trung bình, Thấp) để điều phối kịp thời. |
| **Phân Quyền Chi Tiết** | Phân tách rõ ràng giữa Quyền hệ thống (App Roles: Admin, Catechist, Parent) và Nhiệm vụ thực tế (Assignments: Phân công đứng lớp theo từng năm học). |

---

## 🛠️ Công Nghệ Sử Dụng

Hệ thống được phát triển trên nền tảng công nghệ hiện đại, đảm bảo tốc độ vượt trội, bảo mật cao và trải nghiệm người dùng tối ưu:

*   **Frontend Framework:** React + Tanstack Start (SSR & Routing mượt mà).
*   **Database & Backend:** [Convex](https://convex.dev) (Cơ sở dữ liệu thời gian thực, serverless mutations & queries).
*   **Styling & UI:** Vanilla CSS + Base UI (`@base-ui/react`) cho giao diện cao cấp, tăng cường khả năng tiếp cận (accessibility).
*   **Offline Capability:** Service Worker, PWA Manifest, và IndexedDB (thư viện `idb`).
*   **Testing:** Vitest + React Testing Library (đảm bảo độ tin cậy của code).

---

## 🚀 Dành Cho Nhà Phát Triển / For Developers

Nếu bạn muốn tham gia đóng góp hoặc chạy mã nguồn này tại máy cục bộ, vui lòng tham khảo các hướng dẫn sau:

*   📖 **Onboarding:** [Developer Onboarding Guide](docs/16-developer-onboarding.md) — Chi tiết cài đặt môi trường và các tiêu chuẩn viết code / Environment setup and coding standards.
*   ⚙️ **Deployment:** [Installation & Deployment Guide](docs/17-installation-deployment.md) — Hướng dẫn cài đặt Convex và triển khai hệ thống / Running Convex dev server and production deployments.
*   ⚠️ **Standard:** [Anti-Patterns Guide](docs/15-anti-patterns.md) — Các mẫu phản chuẩn cần tránh khi làm việc với codebase này / Patterns to avoid when contributing.
