# Memory Index

- [Convex db API conventions](convex_db_api.md) — 3-arg patch/replace/get signatures per project guidelines; SHA-256 password hashing in use (security debt)
- [TanStack Form validation patterns](tanstack_form_validation.md) — onBlur-only validators require matching onSubmit validators to prevent empty submissions
- [Auth security patterns](auth_security.md) — changePassword mutation accepts loginId from client; SHA-256 for passwords (not bcrypt); auth guard in /_authenticated layout
- [Academic years semester generation](academic_years_semester_generation.md) — KAN-23: INVALID_SEMESTER_COUNT error not mapped to a toast in AcademicYearForm catch block; watch for assertion-less tests
- [Assignments page patterns](project_assignments_patterns.md) — isBoardMember is admin-only stub; discard dialog never triggered; userDocId unsafe cast; items-prop claim corrected, see below
- [Base UI Select items prop](baseui_select_items_prop.md) — items prop IS real (drives SelectValue label lookup); flag SelectValue with no children AND no items instead
- [Global YearSwitcher stale state risk](global_year_switcher_stale_state.md) — YearSwitcher persists across route/param changes; components with local state scoped to academicYearId/classId must reset on prop change or go silently stale
- [No dirty-tracking resave bug](no_dirty_tracking_resave_bug.md) — EvaluationsBoard (and sibling grid boards) buffer server data into local state with no edited-keys tracking; Save All resends every loaded row and the merge effect never lets fresh data override a seen key — lost-update risk
