[← Back to index](README.md)

## 2. Key Entities & Business Rules

### Organizational Hierarchy

```
Đoàn (Parish Program)
└── Ngành (Branch) — 6 fixed branches in order:
    ├── Chiên Con      (youngest)
    ├── Ấu Nhi
    ├── Thiếu Nhi
    ├── Nghĩa Sĩ
    ├── Hiệp Sĩ
    └── Dự Trưởng     (oldest / future catechists)
        └── Lớp (Class) — multiple classes per branch per year
```

**Branch leadership:** Each branch has one catechist appointed as `branch_leader` and optionally one as `branch_deputy`. Tracked via `CatechistClass.role`.

**Program leadership (Ban Quản Trị):** Board membership is a **per-academic-year assignment**, not a fixed role. Board members are selected at the start of each academic year and tracked via `AcademicYearAssignment(academic_year_id, catechist_id, assignment_type="board_member")`. This allows tech admin access to persist across board elections.

### Students

- A student must be enrolled in **exactly one primary class** per academic year.
- A student **may simultaneously enroll** in one or more supplemental classes (e.g., Apostle class, Sacrament class), flagged as `is_primary_class = false` in `StudentClass`.
- A student progresses through branches over multiple years. Full historical records are retained via `StudentClass`.

### Catechists

- A catechist may teach in **multiple classes** simultaneously.
- Within each class, a catechist has a role: `homeroom` (chủ nhiệm) or `co_teacher` (đồng giảng).
- **App-level role** (`Catechist.role`): either `admin` or `user`
  - `admin`: full system access (independent of assignments)
  - `user`: access determined by real-life assignments
- **Real-life assignments** (via `AcademicYearAssignment` per AY):
  - `board_member`: system admin for that academic year
  - `branch_head`: manages own branch, can view/assign classes within branch
  - Class assignment: teaching role in specific class(es)
