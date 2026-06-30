[← Back to index](README.md)

## 13. Role Refactor: App Roles vs Assignments

**Status:** Design complete (KAN-58), awaiting implementation

### Problem Statement

Currently `Catechist.role` field conflates two concepts:

- **App-based access level** (what system features user can access)
- **Real-life organizational role** (elected position like board member, branch leader)

This creates a problem: when board members are elected annually, the previous tech admin loses system access despite needing it for annual setup tasks.

### Solution

Separate concerns:

1. **App Role** (`Catechist.role`): `admin` | `user` — system-level permission
2. **Real-Life Assignments** (per AY): `board_member` | `branch_head` — tracked in `AcademicYearAssignment`
3. **Class Assignments**: catechist-to-class mapping per academic year

### Data Model Changes

#### Current State

```
Catechist {
  role: "catechist" | "branch_deputy" | "branch_leader" | "board"
  // ... other fields
}

CatechistClass {
  catechist_id
  class_id
  role: "homeroom" | "co_teacher"
}
```

#### New State

```
Catechist {
  role: "admin" | "user"  // App-level permission only
  // ... other fields
}

AcademicYearAssignment {
  academic_year_id
  catechist_id
  assignment_type: "board_member" | "branch_head"
  // Unique constraint: (academic_year_id, catechist_id, assignment_type)
}

ClassCatechist {
  class_id
  catechist_id
  academic_year_id
  role: "homeroom" | "co_teacher"
  // Replaces/extends CatechistClass with explicit AY tracking
}
```

### Permission Resolution

When checking if catechist can perform action:

```
function canAccess(catechist_id, action, context) {
  if (catechist.role === "admin") return true;  // Always allowed

  if (catechist.role !== "user") return false;  // Invalid role

  // Resolve by context
  if (context.academic_year_id) {
    const assignment = getAssignment(catechist_id, context.academic_year_id);
    if (assignment?.type === "board_member") return true;  // AY admin

    if (context.branch_id && assignment?.type === "branch_head") {
      if (assignment.branch_id === context.branch_id) return true;  // Branch scope
    }

    if (context.class_id) {
      const classAssignment = getClassAssignment(catechist_id, context.class_id, context.academic_year_id);
      if (classAssignment) return true;  // Class scope
    }
  }

  return false;  // Read-only default
}
```

### Data Migration

#### Phase 1: Add New Tables (Zero-downtime)

1. Create `AcademicYearAssignment` table
2. Create `ClassCatechist` table
3. Run backfill: for each current academic year, copy board/branch_leader roles to `AcademicYearAssignment`

#### Phase 2: Update Application Code

1. Update Convex queries to check `AcademicYearAssignment` instead of `Catechist.role`
2. Add authorization middleware
3. Add permission denied warnings in UI

#### Phase 3: Deprecate Old Field

1. After all app code uses new assignment model, mark `CatechistClass` as deprecated
2. Keep `Catechist.role` read-only for 2+ releases (safe migration window)
3. Remove old field when no code references it

### Implementation Checklist

- [ ] Create `AcademicYearAssignment` table
- [ ] Create `ClassCatechist` table (if not already exists)
- [ ] Add backfill mutation for current data
- [ ] Update all auth-checking queries in Convex
- [ ] Add permission middleware
- [ ] Update UI: academic year setup to assign board/branch members
- [ ] Add UI warning: "Contact admin" for permission denied
- [ ] Run tests with new permission model
- [ ] Update documentation with examples

### Edge Cases

**Admin-only operations:**

- Assigning/revoking `admin` role (only admins can do this)
- Creating academic year
- Enabling/disabling accounts

**Board member scope:**

- Board member can only see/manage within their assigned academic year
- When they leave board, access reverts to read-only (unless also assigned to class)

**Multiple assignments:**

- Catechist can be both board member AND branch head in same year (permission union)
- Catechist can teach in multiple classes (each tracked in `ClassCatechist`)

**Year boundary:**

- Assignments reset on new academic year — old assignments inactive
- Class-teaching assignments tied to academic year, not permanent

### References

- Related ticket: KAN-58
- Auth logic: `docs/03-auth-access-control.md`
- Entity relationships: `docs/02-key-entities.md`
