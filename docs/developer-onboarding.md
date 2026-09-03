[← Back to index](README.md)

## 16. Developer Onboarding

Welcome. This doc gets you from zero to a working local setup, and tells you the rules that aren't obvious from just reading code. Read this fully before your first PR — it's shorter than the mistakes it prevents.

### 16.1 What This Project Is

A management system for a Catholic catechism school (Trường Giáo Lý): students, catechists (teachers), classes, attendance (including QR scanning), grading, and guardians/parents. Vietnamese-first (i18n with `vi` default), built for a real parish's admin staff and volunteer teachers — many of whom are not tech-savvy, so UI simplicity and mobile-friendliness matter more than usual.

### 16.2 Tech Stack

| Layer          | Tech                                                        |
| -------------- | ------------------------------------------------------------ |
| Backend        | [Convex](https://convex.dev) — database, functions, auth, file storage, all in one |
| Frontend       | [TanStack Start](https://tanstack.com/start) (React, file-based routing via TanStack Router) |
| UI components  | shadcn — but built on **Base UI** (`@base-ui/react`), **not Radix** |
| Forms          | TanStack Form + Zod validation |
| Tables         | TanStack Table (wrapped as `DataTable`) |
| Styling        | Tailwind CSS v4 |
| i18n           | i18next / react-i18next (`vi` + `en`) |
| Testing        | Vitest |

If you've used Next.js + Prisma + Radix before, the closest mental model: TanStack Start ≈ Next.js (file routes, SSR), Convex ≈ Prisma + Postgres + a realtime layer + serverless functions, all bundled together. Base UI ≈ Radix's sibling library — same idea (unstyled accessible primitives), different API, so **don't copy Radix code/docs verbatim**.

### 16.3 First-Time Setup

1. **Install dependencies**

   ```
   npm install
   ```

2. **Set up Convex.** Run:

   ```
   npx convex dev
   ```

   First run prompts you to log in to Convex and creates/links a dev deployment. This generates `.env.local` with `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`. Keep this running in a terminal tab — it watches `convex/` and pushes function/schema changes live, and also runs `vite dev` for you (see `npm run dev` below, which wraps both).
3. **Check `.env.local`** matches `.env.example`'s shape:

   ```
   CONVEX_DEPLOYMENT=dev:<your-deployment>
   VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
   VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site
   VITE_DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh
   VITE_DEFAULT_LOCALE=vi-VN
   ```

   `.env.local` is gitignored — never commit it, it's per-developer/per-deployment.

   **Also set these in the Convex dashboard** (Settings → Environment Variables — not `.env.local`, Convex functions don't read that file):

   - `BREAK_GLASS_CODE` — required emergency override code for backend break-glass access when normal auth is unavailable (see [Auth: Admin Lockout Recovery](auth-access-control.md#admin-lockout-recovery-break-glass)).
   - `CATECHIST_ACCOUNT_PREFIX` / `STUDENT_ACCOUNT_PREFIX` — optional, default `"CAT"` / `"STD"` (see [Installation & Deployment](installation-deployment.md#1741-required-convex-environment-variables)).
4. **Run the app:**

   ```
   npm run dev
   ```

   This starts both Convex dev sync and the Vite dev server. Open the printed localhost URL.
5. **Seed data (optional but recommended).** Check `convex/seed.ts` and `sample-data/` / `test-data/` for scripts to populate a dev deployment with realistic branches/classes/students so the UI isn't empty. Ask a teammate if unsure how it's currently invoked — this evolves.
6. **First login.** Auth uses `loginId` + password, not email (see §16.7). If your dev deployment is empty, you'll need to seed or run the `setup.tsx` route flow (first-run org setup) before you can log in as anyone.

### 16.4 Everyday Commands

| Command                  | What it does                                                        |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`             | Start Convex dev sync + Vite dev server together                     |
| `npm run typecheck`       | `tsc` only, no build                                                  |
| `npm run lint`            | `tsc` + ESLint, zero warnings allowed (`--max-warnings 0`)            |
| `npm run format`          | Prettier, writes in place                                             |
| `npm test`                | Run all Vitest tests once                                             |
| `npm run test:coverage`   | Run tests with coverage report                                       |
| `npm run build`           | Production build (`vite build` + typecheck)                          |

Run `npm run lint` and relevant tests before opening a PR — CI will fail on any lint warning, not just errors.

### 16.5 Project Structure — Where Things Live

```
convex/                  Backend: schema, queries, mutations, actions
  schema.ts              THE database schema — source of truth for tables/fields
  <feature>.ts           Functions for one feature area (students.ts, attendance.ts, ...)
  <feature>.test.ts      Convex-side unit tests, colocated with the function file
  _generated/            Auto-generated by Convex — never hand-edit
  _generated/ai/guidelines.md   Convex usage rules — READ BEFORE writing backend code

src/
  routes/                File-based routing (TanStack Router). Folder path = URL path.
    _authenticated/      Routes requiring login (wrapped by an auth guard)
      _catechist/        Routes for logged-in catechists
        _admin/          Admin-only sub-routes
  components/
    ui/                  shadcn-generated primitives — NEVER hand-edit these
    forms/, custom/      Project-specific composed components
  lib/                   Shared utilities: name formatting, i18n, permissions, export, etc.
  locales/               Translation JSON (vi / en)
  hooks/                 Shared React hooks

docs/                    System design docs — schema rationale, business rules, conventions
  README.md              Index of all system design docs
CLAUDE.md                Authoritative coding rules, anti-patterns, and testing requirements
```

**Route naming convention:** a file prefixed with `-` (e.g. `-students.test.tsx`) is *not* a route — TanStack Router ignores files starting with `-`. That's how test files sit next to their route file without becoming routes themselves.

### 16.6 Read These Before Writing Code

In this order:

1. **[`docs/README.md`](README.md)** — index of all system design docs. Skim every section title so you know what exists.
2. **[`docs/key-entities.md`](key-entities.md)** and **[`convex/schema.ts`](../convex/schema.ts)** — what the core entities are (Student, Catechist, Class, ClassYear, Guardian, etc.) and the authoritative database schema.
3. **[`docs/auth-access-control.md`](auth-access-control.md)** & **[`docs/permission-matrix.md`](permission-matrix.md)** — how login, roles, and permissions work.
4. **[`CLAUDE.md`](../CLAUDE.md)** (repo root) — authoritative coding rules, UI patterns, anti-patterns, and testing requirements.
5. **`convex/_generated/ai/guidelines.md`** — Convex-specific API rules (indexes vs `.filter()`, auth patterns, etc.). Required reading before touching any file in `convex/`.

### 16.7 Non-Obvious Rules You Will Hit Immediately

The canonical, detailed list of coding rules and anti-patterns is maintained in [`CLAUDE.md`](../CLAUDE.md). Key highlights you will hit immediately:

- **Auth is loginId + password, not email.** Catechists log in as `CAT-<member_id>`, parents as `STD-<student_code>`. No email/password-reset flow exists — admins reset passwords manually. See [`docs/auth-access-control.md`](auth-access-control.md).
- **Nothing is ever hard-deleted.** Every table has `is_deleted: boolean`. "Delete" in the UI always means flipping this flag. Queries filter `is_deleted = false`.
- **Convex queries never use `.filter()`.** Always define an index in `schema.ts` and query with `.withIndex(...)`.
- **Academic years lock.** Once an `AcademicYear` is inactive, all data scoped to it is read-only. Mutations must verify `academic_year.is_active = true`.
- **Phone numbers are always E.164** (`+84901234567`), normalized via `libphonenumber-js` before storage. Never store what the user typed raw.
- **Saint names precede full names in the UI** (`Maria Nguyễn Văn A`), per Vietnamese Catholic convention. Use `formatPersonName()` from `src/lib/name.ts`.
- **`src/components/ui/*` is generated code.** Never hand-edit. Fix mismatches at the call site; use the shadcn CLI to regenerate if a base component itself needs changing.
- **Base UI, not Radix.** If you're used to Radix primitives, check `/shadcn-baseui` skill or Base UI docs — APIs differ.
- **No numeric grade averaging across different scales.** Different columns can use different scales (`scale_10`, `pass_fail`, `letter_af`) and are displayed independently.
- **Attendance is shown as raw status counts, not a score.**

When in doubt about any of these, check [`CLAUDE.md`](../CLAUDE.md) first — it is the running, authoritative list of project rules.

### 16.8 Contribution Rules

- **Every new component or function needs unit tests.** Minimum coverage **75%** (statements, branches, functions, lines) on files touched by your change — checked via `npm test -- --coverage`. You don't need to raise coverage on unrelated files.
- **Convex changes**: read `convex/_generated/ai/guidelines.md` first; it overrides anything you assume from general Convex knowledge or training data.
- **UI changes**: follow the page-shape conventions in [`CLAUDE.md`](../CLAUDE.md) (list = DataTable with search/sort/grouping, detail = card layout, create/edit = Zod + TanStack Form). Prefer an existing shadcn component over hand-rolled HTML/CSS.
- **Don't introduce abstractions ahead of need.** This codebase favors direct, readable code over premature generalization.
- **Run `npm run lint` before pushing.** Zero warnings tolerated in CI.

### 16.9 Getting Help

- Full schema + business-rule rationale: `docs/` (start at [`docs/README.md`](README.md)).
- Stuck on a Convex-specific API question: `convex/_generated/ai/guidelines.md`.
- Stuck on a UI component question: shadcn MCP / `/shadcn-baseui` skill, or look at an existing similar page under `src/routes/_authenticated/_catechist/` for a working pattern to copy.
- Unsure if something is a known gotcha: check [`CLAUDE.md`](../CLAUDE.md) before spending an hour debugging it.

### 16.10 Sentry (Error Monitoring)

This project reports errors to [Sentry](https://sentry.io).

Locally, setting `VITE_SENTRY_DSN` in `.env.local` is optional — leaving it unset just means dev errors aren't reported (fine for day-to-day work). For full production deployment settings and source-map upload env vars (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`), see [Installation & Deployment: Sentry](installation-deployment.md#178-sentry-error-monitoring).
