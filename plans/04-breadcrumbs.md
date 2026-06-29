# Plan: Dynamic Page Breadcrumbs

Breadcrumbs render in the authenticated layout header, updating automatically as the user navigates.

---

## Phase 0: Verified Facts

### Current static breadcrumb (`src/routes/_authenticated.tsx:50-56`)

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbPage>Dashboard</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

Currently imports only: `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbList`, `BreadcrumbPage` — missing `BreadcrumbLink`, `BreadcrumbSeparator`.

### Breadcrumb components (`src/components/ui/breadcrumb.tsx`)

- `BreadcrumbLink` — uses Base UI `render` prop pattern (`render={<Link to="..." />}`), NOT `asChild`
- `BreadcrumbSeparator` — `<li>` wrapper, renders `ChevronRightIcon` by default
- `BreadcrumbPage` — `<span>` for current (non-link) segment
- `BreadcrumbItem` — `<li>` wrapper

### TanStack Router hooks (v1.168.22)

- `useLocation()` — returns `{ pathname: string, ... }` — use for current route
- Currently used: `useNavigate()`, `createFileRoute()`, `Navigate`
- NOT used yet: `useLocation()`, `useMatches()`

### Route segments → i18n keys

| Route pathname     | Segment           | i18n key         | vi label       |
| ------------------ | ----------------- | ---------------- | -------------- |
| `/dashboard`       | `dashboard`       | `nav.dashboard`  | "Dashboard"    |
| `/profile`         | `profile`         | `nav.profile`    | "Hồ sơ"        |
| `/change-password` | `change-password` | `password.title` | "Đổi Mật Khẩu" |

### Base UI render prop pattern (from `breadcrumb.tsx:42-60`)

```tsx
// CORRECT — render prop
<BreadcrumbLink render={<Link to="/dashboard" />}>Dashboard</BreadcrumbLink>

// WRONG — asChild (not Base UI pattern)
<BreadcrumbLink asChild><Link to="/dashboard">Dashboard</Link></BreadcrumbLink>
```

### Anti-patterns

- Do NOT use `asChild` — this project uses Base UI
- Do NOT use `useMatches()` — `useLocation()` is sufficient for flat routes
- Do NOT hardcode English strings in breadcrumbs — use `t()`

---

## Phase 1: Route-to-Label Map

**File:** `src/lib/breadcrumbs.ts` (new file)

```ts
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'nav.dashboard',
  profile: 'nav.profile',
  'change-password': 'password.title',
}
```

Keys = URL path segments (the part after `/`). Values = i18n keys from vi.json/en.json.

When new routes are added, add an entry here. If a segment has no entry, the raw segment string is displayed as fallback.

### Verification

- File exists at `src/lib/breadcrumbs.ts`
- All current route segments covered: `dashboard`, `profile`, `change-password`
- `npx tsc --noEmit` passes

---

## Phase 2: Dynamic Breadcrumb in Authenticated Layout

**File:** `src/routes/_authenticated.tsx` — replace static breadcrumb

### Import changes

Add to existing router import:

```ts
import {
  Navigate,
  Outlet,
  Link, // ADD
  createFileRoute,
  useLocation, // ADD
  useNavigate,
} from '@tanstack/react-router'
```

Add to existing breadcrumb import:

```ts
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink, // ADD
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator, // ADD
} from '~/components/ui/breadcrumb'
```

Add new imports:

```ts
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { SEGMENT_LABELS } from '~/lib/breadcrumbs'
```

### Hook usage (inside `AuthenticatedLayout`)

```ts
const { t } = useTranslation()
const { pathname } = useLocation()

const crumbs = pathname
  .replace(/^\//, '')
  .split('/')
  .filter(Boolean)
  .map((seg, i, arr) => ({
    label: t(SEGMENT_LABELS[seg] ?? seg),
    path: '/' + arr.slice(0, i + 1).join('/'),
    isCurrent: i === arr.length - 1,
  }))
```

### JSX — replace lines 50-56

```tsx
<Breadcrumb>
  <BreadcrumbList>
    {crumbs.map((crumb, i) => (
      <React.Fragment key={crumb.path}>
        {i > 0 && <BreadcrumbSeparator />}
        <BreadcrumbItem>
          {crumb.isCurrent ? (
            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link to={crumb.path} />}>
              {crumb.label}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
      </React.Fragment>
    ))}
  </BreadcrumbList>
</Breadcrumb>
```

### Verification

- Navigate to `/dashboard` → breadcrumb shows "Dashboard" (non-link, current page)
- Navigate to `/profile` → breadcrumb shows "Hồ sơ" (vi) / "Profile" (en)
- Navigate to `/change-password` → breadcrumb shows "Đổi Mật Khẩu" / "Change Password"
- Switch language → breadcrumb label updates immediately (no page reload)
- `npx tsc --noEmit` passes
- `npm run lint` passes

---

## Phase 3: Final Verification

```bash
npx tsc --noEmit
npm run lint
```

Manual checks:

- [ ] `/dashboard` — "Dashboard" as BreadcrumbPage (non-link span)
- [ ] `/profile` — "Hồ sơ" in vi, "Profile" in en
- [ ] `/change-password` — "Đổi Mật Khẩu" in vi, "Change Password" in en
- [ ] Language switch → breadcrumb updates without navigation
- [ ] Future nested route `/foo/bar` → "foo > bar" with foo as clickable link, bar as current page
