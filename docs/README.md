# System Design Docs — Index

Documentation for the Trường Giáo Lý (Catechism School) management system. Read
top-to-bottom to learn the project — sections are ordered as a learning path,
from orientation → concepts → per-feature detail → reference → conventions.

> File numbers are historical (order of authoring) and kept stable because code
> comments and cross-links point at them. Follow the **grouping below**, not the
> raw numbers, for reading order.

---

## 1. Start Here — orientation & setup

Get the mental model and a running dev environment.

- [System Overview](01-system-overview.md) — what the system is and who uses it.
- [Developer Onboarding](16-developer-onboarding.md) — environment setup, coding standards, and the must-read list for new contributors.
- [Installation & Deployment](17-installation-deployment.md) — running the Convex dev server and production deploys.

## 2. Core Concepts — the domain

The entities and academic model everything else builds on.

- [Key Entities & Business Rules](02-key-entities.md) — Student, Catechist, Class, ClassYear, Guardian, and how they relate.
- [Academic Structure](04-academic-structure.md) — academic years, semesters, session types, class scoping.

## 3. Feature Domains — how each subsystem works

Read the one you're working on.

- [Authentication & Access Control](03-auth-access-control.md) — loginId-based auth (no email), role definitions.
- [Permission Matrix](19-permission-matrix.md) — who can do what (companion to Auth above).
- [Grading & Assessment Logic](05-grading-assessment.md) — score columns, semester/annual results.
- [Attendance Logic](06-attendance-logic.md) — attendance model and status counts.
- [Attendance — QR & Offline-First](11-attendance-qr-offline.md) — the QR-scan / offline implementation.
- [Calendar Management](18-calendar-management.md) — calendar events and their strict-scope permission rules.

## 4. Data Model Reference

Look up the exact schema when implementing.

- Complete Database Schema:
  - [Core Organization](schema/01-core-organization.md)
  - [Catechists](schema/02-catechists.md)
  - [Students](schema/03-students.md)
  - [Attendance](schema/04-attendance.md)
  - [Grading](schema/05-grading.md) — `ScoreColumn`, `ScoreEntry`, `SemesterResult`, `AnnualResult`
  - [Authentication](schema/06-authentication.md)
  - [Assignments](schema/07-assignments.md)
  - [AppConfig](schema/08-app-config.md)
  - [Calendar](schema/09-calendar.md)
- [Enum Reference](08-enum-reference.md)
- [Indexes & Constraints](10-indexes-constraints.md)
- [Appendix: Table Relationship Summary](12-appendix-relationships.md)

## 5. Design Decisions & Conventions

The "why", plus the rules to follow when contributing.

- [Key Design Decisions](09-design-decisions.md) — rationale behind non-obvious choices.
- [Role Refactor: App Roles vs Assignments](13-role-refactor-migration.md) — history of the role model change.
- [UI Styling Guide](14-ui-styling-guide.md) — required page-shape and styling conventions.
- [Anti-Patterns](15-anti-patterns.md) — concrete mistakes already made in this codebase; worth memorizing.

## 6. Agent & Ops Playbooks

For AI agents and maintenance workflows.

- [Issue Tracker](agents/issue-tracker.md) — GitHub Issues workflow via `gh`.
- [Triage Labels](agents/triage-labels.md) — the 5 canonical labels.
- [Domain Docs](agents/domain.md) — single-context domain modeling.
- [Audit: Functions Without Auth](audit-functions-without-auth.md) — security audit notes.
