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

**Program leadership (Ban Quản Trị):** Managed via `Catechist.role`. Roles include: Parish Program Director (Xứ Đoàn Trưởng), Deputy Directors, Secretary, Treasurer, and other board members.

### Students

- A student must be enrolled in **exactly one primary class** per academic year.
- A student **may simultaneously enroll** in one or more supplemental classes (e.g., Apostle class, Sacrament class), flagged as `is_primary_class = false` in `StudentClass`.
- A student progresses through branches over multiple years. Full historical records are retained via `StudentClass`.

### Catechists

- A catechist may teach in **multiple classes** simultaneously.
- Within each class, a catechist has a role: `homeroom` (chủ nhiệm) or `co_teacher` (đồng giảng).
- Catechists with `role = branch_leader` or `branch_deputy` can view all classes within their branch.
- Catechists with `role = board` can view all classes in the entire program.
