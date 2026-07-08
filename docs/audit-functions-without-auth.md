# Functions Missing Auth/Permission Checks

> Generated: 2026-07-08
> Total exported functions: 149 across 24 files
> Functions without auth checks: 35

---

## By Severity

### Critical — No protection at all

#### `catechists.ts`
| Function | Type | Notes |
|---|---|---|
| `getMyProfile` | query | No guard |
| `getMyAddress` | query | No guard |
| `getMyContacts` | query | No guard |
| `updateMyProfile` | mutation | No guard |
| `upsertMyAddress` | mutation | No guard |
| `addContact` | mutation | No guard |
| `updateContact` | mutation | No guard |
| `deleteContact` | mutation | No guard |
| `updateProfilePhoto` | mutation | No guard |
| `deleteProfilePhoto` | mutation | No guard |
| `getProfilePhotoUrl` | query | No guard |

#### `students.ts`
| Function | Type | Notes |
|---|---|---|
| `updateProfilePhoto` | mutation | No guard |
| `deleteProfilePhoto` | mutation | No guard |
| `getProfilePhotoUrl` | query | No guard |

#### `catechistPermissions.ts`
| Function | Type | Notes |
|---|---|---|
| `getPermissions` | query | `getEffectivePermissions` throws if invalid catechist, but no explicit `assertValidCatechist` |

#### `assignments.ts`
| Function | Type | Notes |
|---|---|---|
| `listYearAssignments` | query | Fetches catechist by id but no role assertion |

---

### Warning — Conditional / delegated auth

#### `seed.ts`
| Function | Type | Notes |
|---|---|---|
| `seedFiftyStudents` | mutation | Only checks admin if `requesterId` is provided; skips entirely if undefined |

#### `csvImport.ts`
| Function | Type | Notes |
|---|---|---|
| `bulkImportStudents` | action | No own check; delegates to internal mutation which has `assertAdminRole` |
| `bulkImportCatechists` | action | Same pattern |

---

### Intentionally public

| File | Function | Type | Reason |
|---|---|---|---|
| `setup.ts` | `hasAdmin` | query | First-time setup check |
| `setup.ts` | `runSetup` | mutation | Guarded by "no admin exists" |
| `auth.ts` | `login` | mutation | Public — password-based auth only |
| `auth.ts` | `changePassword` | mutation | Password-based auth only |
| `appConfig.ts` | `get` | query | Public read |
| `storage.ts` | `generateUploadUrl` | mutation | Public upload |
| `seed.ts` | `runSeed` | internalMutation | Internal-only |

---

## Summary

| Category | Count |
|---|---|
| Critical (no guard) | 21 |
| Warning (conditional/delegated) | 3 |
| Intentionally public | 7 |
| **Total** | **31 unique** |