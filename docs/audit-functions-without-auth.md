# Functions Missing Auth/Permission Checks

> Generated: 2026-07-08
> Total exported functions: ~149 across 24 files
> Functions without auth checks: **12** (down from 35 — 23 resolved)

---

## By Severity

### Critical — No protection at all

#### `catechists.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `getMyProfile` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `getMyAddress` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `getMyContacts` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `updateMyProfile` | mutation | fixed | Added `requesterId` + `assertValidCatechist` + self-or-admin (`requesterId === catechistId` or `admin` role) |
| `upsertMyAddress` | mutation | fixed | Same pattern |
| `addContact` | mutation | fixed | Same pattern |
| `updateContact` | mutation | fixed | Same pattern (resolves `catechistId` from contact) |
| `deleteContact` | mutation | fixed | Same pattern |
| `getProfilePhotoUrl` | query | skip | Display-only, used widely (sidebar, roster, attendance). Only exposes URL if record exists — no data leak beyond what lists show |

#### `students.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `getProfilePhotoUrl` | query | skip | Same reasoning as catechist counterpart |

#### `catechistPermissions.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `getPermissions` | query | fixed | Added explicit `assertValidCatechist` (was implicitly enforced via `getEffectivePermissions` → `getBaseCatechist`) |

#### `assignments.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `listYearAssignments` | query | fixed | Replaced bare `ctx.db.get` with `assertValidCatechist` — throws on invalid/deleted/inactive |

---

### Warning — Conditional / delegated auth

#### `seed.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `seedFiftyStudents` | mutation | skip | Dev-only helper — conditional check (only asserts admin if `requesterId` provided; skips if undefined for seed scripts) |

#### `csvImport.ts`
| Function | Type | Status | Notes |
|---|---|---|---|
| `bulkImportStudents` | action | skip | No own check, but delegates to internal mutation (`internalReserveCounters`) which has `assertAdminRole` — effectively gated |
| `bulkImportCatechists` | action | skip | Same pattern as above |

---

### Intentionally public

| File | Function | Type | Status | Reason |
|---|---|---|---|---|
| `setup.ts` | `hasAdmin` | query | skip | First-time setup check, must be public |
| `setup.ts` | `runSetup` | mutation | skip | Guarded by "no admin already exists" — intentional |
| `auth.ts` | `login` | mutation | skip | Public — credential-based auth only |
| `auth.ts` | `changePassword` | mutation | skip | Password-based auth only |
| `appConfig.ts` | `get` | query | skip | Public read of configurable settings |
| `storage.ts` | `generateUploadUrl` | mutation | skip | Public upload endpoint |
| `seed.ts` | `runSeed` | internalMutation | skip | `internalMutation` — can only be called internally |

## Resolved this session

| File | Function | Type | Status | Summary |
|---|---|---|---|---|
| `students.ts` | `updateProfilePhoto` | mutation | fixed | Added `requesterId` arg + `assertEditStudentPermission` — homeroom catechists/board/admins can edit student photos |
| `students.ts` | `deleteProfilePhoto` | mutation | fixed | Same pattern |
| `catechists.ts` | `updateProfilePhoto` | mutation | fixed | Added `requesterId` arg + `assertValidCatechist` + self-only check (`requesterId === catechistId`) |
| `catechists.ts` | `deleteProfilePhoto` | mutation | fixed | Same pattern |
| `assignments.ts` | `listYearAssignments` | query | fixed | Replaced bare `ctx.db.get` with `assertValidCatechist` |
| `catechists.ts` | `getMyProfile` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `catechists.ts` | `getMyAddress` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `catechists.ts` | `getMyContacts` | query | fixed | Added `requesterId` + `assertValidCatechist` |
| `catechists.ts` | `updateMyProfile` | mutation | fixed | Added `requesterId` + `assertValidCatechist` + self-or-admin |
| `catechists.ts` | `upsertMyAddress` | mutation | fixed | Same pattern |
| `catechists.ts` | `addContact` | mutation | fixed | Same pattern |
| `catechists.ts` | `updateContact` | mutation | fixed | Same pattern (resolves `catechistId` from contact) |
| `catechists.ts` | `deleteContact` | mutation | fixed | Same pattern |

---

## Summary

| Category | Count |
|---|---|
| Critical (no guard) | 2 |
| Warning (conditional/delegated) | 1 |
| Intentionally public | 7 |
| Skipped (safe as-is) | 4 |
| Fixed (this session) | 13 |
| **Remaining** | **5** |
| **Resolved total** | **24** |