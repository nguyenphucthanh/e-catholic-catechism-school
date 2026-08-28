# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Catechists (giáo lý viên) at every level use this daily: class catechists taking attendance and entering grades, branch heads (trưởng ngành) overseeing a branch's classes, board members (ban thường vụ) running the whole academic year, and admins doing system setup. There is no single "primary" role — the product must work well for the full catechist hierarchy, not just the entry-level teacher. Parents/guardians are a secondary, read-only audience checking attendance, grades, and notices for their children (accounts are shared across siblings).

## Product Purpose

Manages a single parish's Catholic catechism school (Trường Giáo Lý / TNTT program): student enrollment across branches (ngành) and classes, weekly Sunday Mass + catechism attendance via offline-capable QR scanning, flexible per-teacher grading, sacramental record-keeping across multiple years, and guardian/family contact management. Success is a catechist scanning ~100 students in under 200ms each before Mass with no network, and a board member being able to trust the historical record years later.

## Positioning

No competitive positioning is being pursued — not built to out-position alternatives.

## Operating Context

- Runs across academic years with two semesters each; historical records (attendance, grades, class assignments, sacraments) are preserved permanently even as students move between branches/classes.
- Sunday Mass and catechism class attendance are the primary weekly ritual; 2-3 catechists scan QR cards for ~100 students in a short window before Mass starts, often with unreliable or no network (PWA + IndexedDB offline sync).
- Grading is teacher-configured per semester (ScoreColumn), not a fixed rubric — one class might use a 10-point scale, another pass/fail, another letter grades.
- Designed to work for both Vietnam-based and overseas (US/AU/CA) parishes with minimal config differences (international address format, E.164 phone numbers).
- Login is loginId + password (no email) — `CAT-<member_id>` for catechists, `STD-<student_code>` for parents/students — chosen for easy mobile entry by less tech-savvy parents.

## Capabilities and Constraints

- Role-based access: `admin` (full system access) vs `user` (scoped by per-academic-year assignment: board_member, branch_head, class_catechist, or unassigned read-only).
- Soft delete everywhere (`is_deleted` flag) — historical references must still resolve through deleted rows.
- Attendance is shown as raw status counts per semester, never as a computed score.
- Phone numbers normalized to E.164 before storage.
- Member/student IDs are raw incremented integers, zero-padded only for display.
- No email-based flows anywhere (no email reset, no email login).

## Evidence on Hand

- Live demo: https://e-catholic-catechist-school.vercel.app (demo data resets daily; admin demo login `CAT-1` / `CAT-1`).
- Reference screenshots of current UI at `docs/screenshots/` (dashboard, students, class views, calendar, catechist/student profile, mass attendance, QR scan, assignment, admin setup).
- Full domain documentation at `docs/` (see `docs/README.md` for index) — system overview, key entities, academic structure, auth/permissions, grading, attendance, calendar.

## Product Principles

- Offline-first for the one moment that can't fail: attendance scanning before Mass, with no network.
- Historical integrity over convenience: nothing is ever hard-deleted; a record from 5 years ago must still resolve correctly.
- Flexibility without chaos: grading structure is teacher-configurable, but attendance/roles/permissions stay strictly modeled.
- Built for the full catechist hierarchy (class teacher through admin), not just one persona — screens must serve daily class-level use and yearly system-level oversight alike.
- Low-friction access for non-technical users: short numeric login IDs, mobile-first, easy entry on cheap Android phones.

## Accessibility & Inclusion

No formal accessibility standard (e.g. WCAG level) is required at this time. The practical bar is usability on low-end Android phones for non-technical parents and catechists.
