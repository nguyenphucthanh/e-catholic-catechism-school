# System Design Docs — Index

Broken down from the original consolidated system design doc (v2.0) for easier reading. Each file below maps to one section.

1. [System Overview](01-system-overview.md)
2. [Key Entities & Business Rules](02-key-entities.md)
3. [Authentication & Access Control](03-auth-access-control.md)
4. [Academic Structure](04-academic-structure.md)
5. [Grading & Assessment Logic](05-grading-assessment.md)
6. [Attendance Logic](06-attendance-logic.md)
7. Complete Database Schema
   - [7.1 Core Organization](schema/01-core-organization.md)
   - [7.2 Catechists](schema/02-catechists.md)
   - [7.3 Students](schema/03-students.md)
   - [7.4 Attendance](schema/04-attendance.md)
   - [7.5 Grading](schema/05-grading.md) — including `ScoreColumn`, `ScoreEntry`, `SemesterResult`, `AnnualResult`
   - [7.6 Authentication](schema/06-authentication.md)
   - [7.7 Assignments](schema/07-assignments.md)
   - [7.8 AppConfig](schema/08-app-config.md)
   - [7.9 Calendar](schema/09-calendar.md)
8. [Enum Reference](08-enum-reference.md)
9. [Key Design Decisions](09-design-decisions.md)
10. [Indexes & Constraints](10-indexes-constraints.md)
11. [Attendance System — QR & Offline-First](11-attendance-qr-offline.md)
12. [Appendix: Table Relationship Summary](12-appendix-relationships.md)
13. [Role Refactor: App Roles vs Assignments](13-role-refactor-migration.md)
14. [UI Styling Guide](14-ui-styling-guide.md)
15. [Anti-Patterns](15-anti-patterns.md)
16. [Developer Onboarding](16-developer-onboarding.md)
17. [Installation & Deployment](17-installation-deployment.md)
18. [Calendar Management](18-calendar-management.md)

---

# Hệ thống Quản lý Giáo lý TNTT / e-Catholic Catechism School Management System

Chào mừng bạn đến với **e-Catholic Catechism School Management System** (Hệ thống Quản lý Giáo lý Thiếu Nhi Thánh Thể) — một giải pháp kỹ thuật số hiện đại được thiết kế để chuẩn hóa và tối ưu hóa việc quản lý các Đoàn Thiếu Nhi Thánh Thể (TNTT) tại Việt Nam cũng như hải ngoại (Mỹ, Úc, Canada, v.v.).

Welcome to the **e-Catholic Catechism School Management System** — a modern digital solution designed to standardize and optimize the management of Vietnamese Eucharistic Youth Movement (TNTT) communities globally (Vietnam, US, Australia, Canada, etc.).

---

## 📌 Tổng Quan Hệ Thống / System Overview

### Tiếng Việt
Hệ thống này hỗ trợ đắc lực cho công tác quản lý của một Đoàn TNTT, giải quyết triệt để các thách thức về điểm danh hàng tuần, theo dõi điểm số học tập, và quản lý hồ sơ Bí tích của học sinh qua nhiều năm học. Nhờ thiết kế linh hoạt, hệ thống có thể tùy biến dễ dàng để phù hợp với cả các cộng đồng TNTT trong nước và quốc tế.

### English
This system supports the administration of a TNTT community, addressing core operational challenges such as weekly attendance, grading progress tracking, and student sacramental record management across multiple academic years. Thanks to its flexible design, it easily adapts to both domestic and overseas TNTT groups.

---

## 👥 Vai Trò Người Dùng / User Roles

Hệ thống được thiết kế tối ưu hóa cho từng đối tượng tương tác chính:
The system is tailored to provide specific value to each target user group:

### 1. Giáo Lý Viên & Trưởng Lớp / Catechists & Classroom Teachers
*   **Tiếng Việt:** Là đối tượng sử dụng chính của hệ thống. Giáo lý viên có thể điểm danh nhanh chóng bằng camera (quét mã QR) ngay cả khi không có mạng, nhập điểm số trực tiếp, và cập nhật tình hình lớp học thuận tiện trên điện thoại hoặc máy tính bảng.
*   **English:** The primary users of the system. Catechists can perform lightning-fast attendance scans via camera (QR code) even without an internet connection, record grades directly, and manage classroom schedules easily on any mobile or tablet device.

### 2. Cha Tuyên Úy & Ban Thường Vụ / Parish Priests & Executive Board
*   **Tiếng Việt:** Theo dõi bức tranh tổng thể của Đoàn thông qua biểu đồ trực quan, quản lý nhân sự (Giáo lý viên), phân bổ lớp học, duyệt cấu trúc điểm số, và tra cứu lịch sử học tập/Bí tích của bất kỳ đoàn sinh nào qua các năm học.
*   **English:** Monitor the entire community's health through a visual dashboard, manage catechist staffing, assign classes, configure grading weightage, and audit student academic or sacramental histories across multiple years.

### 3. Phụ Huynh & Đoàn Sinh / Parents & Students
*   **Tiếng Việt:** Xem lịch học, lịch phụng vụ, theo dõi chuyên cần (Đi lễ Chúa Nhật & Học giáo lý), cập nhật điểm số, và nhận thông báo quan trọng từ Ban trị sự. Hệ thống liên kết thông minh các anh chị em ruột trong gia đình dưới một tài khoản phụ huynh duy nhất.
*   **English:** View class schedules, liturgical calendars, track attendance metrics (Sunday Mass & catechism class), view grade cards, and receive announcements. The system intelligently links siblings under a single parent account.

---

## ⚡ Các Tính Năng Cốt Lõi / Core Features

| Tính năng / Feature | Mô tả chi tiết / Detailed Description |
| :--- | :--- |
| **Điểm Danh QR & Ngoại Tuyến**<br>*QR & Offline Attendance* | **VN:** Điểm danh siêu tốc (<200ms/học sinh) qua thẻ mã QR. Ứng dụng PWA lưu trữ offline trên IndexedDB và tự động đồng bộ khi có mạng với cơ chế giải quyết xung đột thông minh.<br>**EN:** Instant scan (<200ms/student) using printed QR cards. Leverages PWA features and IndexedDB for offline queueing, with automatic background sync and smart conflict resolution. |
| **Cấu Trúc Học Tập Linh Hoạt**<br>*Flexible Academic Structure* | **VN:** Tổ chức theo Ngành (Ấu, Thiếu, Nghĩa, Hiệp), Phân đoàn, và các Lớp học. Hỗ trợ chuyển niên niên khóa, tự động lên lớp và lưu giữ trọn vẹn lịch sử học tập nhiều năm.<br>**EN:** Organized by Branches (Ngành), Sub-branches, and Classes. Supports multi-year lifecycle, student promotion, and historic records preservation. |
| **Đánh Giá & Điểm Số**<br>*Grading & Assessments* | **VN:** Tự động tính toán điểm trung bình học kỳ, điểm cả năm dựa trên các cột điểm linh hoạt (Miệng, 15 phút, 1 tiết, Thi học kỳ) và quản lý tiến trình Bí tích.<br>**EN:** Automatically calculates semester and annual GPA based on configurable score categories (Oral, Quiz, Midterm, Final) and logs sacramental progress. |
| **Lịch & Sự Kiện**<br>*Calendar & Event Management* | **VN:** Quản lý lịch sinh hoạt, phụng vụ, các sự kiện đặc biệt của Đoàn với cấp độ nghiêm trọng được trực quan hóa (Cao, Trung bình, Thấp) để điều phối kịp thời.<br>**EN:** Manages liturgical and academic calendars, special events with visual severity indicators (High, Medium, Low) for proactive scheduling. |
| **Phân Quyền Chi Tiết**<br>*Granular Access Control* | **VN:** Phân tách rõ ràng giữa Quyền hệ thống (App Roles: Admin, Catechist, Parent) và Nhiệm vụ thực tế (Assignments: Phân công đứng lớp theo từng năm học).<br>**EN:** Strictly separates global system roles (App Roles) from academic assignments (e.g., teaching specific classes in a specific year). |

---

## 🛠️ Công Nghệ Sử Dụng / Technology Stack

Hệ thống được phát triển trên nền tảng công nghệ hiện đại, đảm bảo tốc độ vượt trội, bảo mật cao và trải nghiệm người dùng tối ưu:
The system leverages a modern tech stack to ensure performance, security, and top-tier user experience:

*   **Frontend Framework:** React + Tanstack Start (SSR & Routing mượt mà).
*   **Database & Backend:** [Convex](https://convex.dev) (Cơ sở dữ liệu thời gian thực, serverless mutations & queries).
*   **Styling & UI:** Vanilla CSS + Base UI (`@base-ui/react`) cho giao diện cao cấp, tăng cường khả năng tiếp cận (accessibility).
*   **Offline Capability:** Service Worker, PWA Manifest, và IndexedDB (thư viện `idb`).
*   **Testing:** Vitest + React Testing Library (đảm bảo độ tin cậy của code).

---

## 🚀 Dành Cho Nhà Phát Triển / For Developers

Nếu bạn muốn tham gia đóng góp hoặc chạy mã nguồn này tại máy cục bộ, vui lòng tham khảo các hướng dẫn sau:
If you want to contribute to this codebase or run it locally, please refer to the following guides:

*   📖 **Onboarding:** [Developer Onboarding Guide](16-developer-onboarding.md) — Chi tiết cài đặt môi trường và các tiêu chuẩn viết code / Environment setup and coding standards.
*   ⚙️ **Deployment:** [Installation & Deployment Guide](17-installation-deployment.md) — Hướng dẫn cài đặt Convex và triển khai hệ thống / Running Convex dev server and production deployments.
*   ⚠️ **Standard:** [Anti-Patterns Guide](15-anti-patterns.md) — Các mẫu phản chuẩn cần tránh khi làm việc với codebase này / Patterns to avoid when contributing.
