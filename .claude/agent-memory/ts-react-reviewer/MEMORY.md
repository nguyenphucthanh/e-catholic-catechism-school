# Memory Index

- [Convex db API conventions](convex_db_api.md) — 3-arg patch/replace/get signatures per project guidelines; SHA-256 password hashing in use (security debt)
- [TanStack Form validation patterns](tanstack_form_validation.md) — onBlur-only validators require matching onSubmit validators to prevent empty submissions
- [Auth security patterns](auth_security.md) — changePassword mutation accepts loginId from client; SHA-256 for passwords (not bcrypt); auth guard in /_authenticated layout
- [Academic years semester generation](academic_years_semester_generation.md) — KAN-23: INVALID_SEMESTER_COUNT error not mapped to a toast in AcademicYearForm catch block; watch for assertion-less tests
