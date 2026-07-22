# System Design Docs — Index

Documentation for the Trường Giáo Lý (Catechism School) management system. Read
top-to-bottom to learn the project — sections are ordered as a learning path,
from orientation → concepts → per-feature detail → reference → conventions.

---

## 1. Start Here — orientation & setup

Get the mental model and a running dev environment.

- [System Overview](system-overview.md) — what the system is and who uses it.
- [Developer Onboarding](developer-onboarding.md) — environment setup, coding standards, and the must-read list for new contributors.
- [Installation & Deployment](installation-deployment.md) — running the Convex dev server and production deploys.

## 2. Core Concepts — the domain

The entities and academic model everything else builds on.

- [Key Entities & Business Rules](key-entities.md) — Student, Catechist, Class, ClassYear, Guardian, and how they relate.
- [Academic Structure](academic-structure.md) — academic years, semesters, session types, class scoping.

## 3. Feature Domains — how each subsystem works

Read the one you're working on.

- [Authentication & Access Control](auth-access-control.md) — loginId-based auth (no email), role definitions.
- [Permission Matrix](permission-matrix.md) — who can do what (companion to Auth above).
- [Grading & Assessment Logic](grading-assessment.md) — score columns, semester/annual results.
- [Attendance Logic](attendance-logic.md) — attendance model and status counts.
- [Attendance — QR & Offline-First](attendance-qr-offline.md) — the QR-scan / offline implementation.
- [Calendar Management](calendar-management.md) — calendar events and their strict-scope permission rules.

## 4. Data Model Reference

See `convex/schema.ts` for complete database schema (source of truth). TypeScript types are in `src/**/*.ts` (use `FunctionReturnType` for Convex query types).

## 5. Design Decisions & Conventions

The "why", plus the rules to follow when contributing.

- [Key Design Decisions](design-decisions.md) — rationale behind non-obvious choices.
- **Coding rules** (UI, backend, data model, testing anti-patterns) — see `CLAUDE.md`.

## 6. Agent & Ops Playbooks

For AI agents and maintenance workflows.

- [Issue Tracker](agents/issue-tracker.md) — GitHub Issues workflow via `gh`.
- [Triage Labels](agents/triage-labels.md) — the 5 canonical labels.
- [Domain Docs](agents/domain.md) — single-context domain modeling.
- [Audit: Functions Without Auth](audit-functions-without-auth.md) — security audit notes.
