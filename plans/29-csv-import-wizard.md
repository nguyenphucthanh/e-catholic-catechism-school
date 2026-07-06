# Plan 29 — CSV Import Wizard (Catechists & Students)

## Overview

A JIRA-inspired multi-step CSV import wizard for bulk-importing **catechist** or **student**
records. Admin-only. Keeps as much data as possible — optional-field failures produce partial
imports, not full rejections.

The wizard has **7 steps**:

| # | Step | Description |
|---|------|-------------|
| 1 | Upload | Select UTF-8 CSV file |
| 2 | Configure | Target entity, delimiter, date format |
| 3 | Map Columns | Assign CSV columns to target fields |
| 4 | Validate & Preview | Parse all rows, show status per row, duplicate warnings |
| 5 | Confirm | Review summary before committing |
| 6 | Import | Chunked bulk save, progress bar |
| 7 | Result | Per-row outcome, links to detail pages |

All CSV parsing happens **client-side** in the browser. Only validated field objects are sent to
Convex via chunked mutation calls (50 records/batch to stay within ~1 MB payload limit).

---

## Phase 0 — Documentation Discovery

### Allowed APIs & Patterns

| Concern | Source | Pattern |
|---------|--------|---------|
| Admin-only route guard | `src/routes/_authenticated/_catechist/_admin.tsx` | `isAdmin(user)` → redirect |
| Admin route placement | `_admin/` directory | `admin.*` file prefix |
| Breadcrumbs | `catechists_.create.tsx` | `staticData: { crumbs: [{label, path?}] }` |
| DataTable | `src/components/custom/data-table.tsx` | `<DataTable columns data />` |
| Bulk client loop | `classes_.bulk-create.tsx` | iterate mutation per batch |
| Toast | all routes | `toast.success / toast.error` from `sonner` |
| Catechist create w/ contacts | `convex/catechists.ts:368` `createWithDetails` | accepts `contacts[]`, handles phone E.164 validation + isPrimary deduplication |
| Catechist phone validation | `convex/catechists.ts:10` | E.164 regex `^\+[1-9]\d{6,14}$` |
| Student create | `convex/students.ts:185` | `create` mutation — required: `fullName` |
| Guardian create | `convex/guardians.ts:35` | `createGuardian` — required: `fullName` |
| Guardian link to student | `convex/guardians.ts:196` | `linkGuardianToStudent` — `relationship`, `contactPriority` (unique per student) |
| Guardian contact | `convex/guardians.ts:107` | `addGuardianContact` — phone must be E.164 |
| Duplicate guard (guardian link) | `convex/guardians.ts:222–230` | checks `by_student_id_and_guardian_id` unique |
| Convex array limit | guidelines.md | 8192 max — chunk at 50 |
| Mutation payload limit | guidelines.md | ~1 MB — chunk at 50 records |
| i18n | `src/locales/en.json`, `vi.json` | flat keys `csvImport.*` |

### Entity Field Maps

**Students** — `convex/students.ts create` args:

| CSV Column Group | Field | Required | Type | Notes |
|-----------------|-------|----------|------|-------|
| Core | `fullName` | ✅ | string | |
| Core | `saintName` | ❌ | string | Tên Thánh |
| Core | `dateOfBirth` | ❌ | date→ISO | Format configured in Step 2 |
| Core | `gender` | ❌ | enum | `male`/`female`; normalize Vietnamese: nam/nữ |
| Core | `previousParish` | ❌ | string | Giáo xứ cũ |
| Core | `previousDiocese` | ❌ | string | Giáo phận cũ |
| Core | `isActive` | ❌ | boolean | default `true` |
| Guardian | `guardian_name` | ❌ | string | Creates `Guardian` record |
| Guardian | `guardian_saint_name` | ❌ | string | |
| Guardian | `guardian_relationship` | ❌ | string | default `"guardian"` |
| Guardian | `guardian_phone` | ❌ | E.164 | Creates `GuardianContact` |
| Guardian | `guardian_email` | ❌ | email | Creates `GuardianContact` |

**Catechists** — `convex/catechists.ts createWithDetails` args:

| CSV Column Group | Field | Required | Type | Notes |
|-----------------|-------|----------|------|-------|
| Core | `fullName` | ✅ | string | |
| Core | `saintName` | ❌ | string | |
| Core | `dateOfBirth` | ❌ | date→ISO | |
| Core | `gender` | ❌ | enum | |
| Core | `joinedDate` | ❌ | date→ISO | |
| Core | `title` | ❌ | string | Cha/Thầy/Soeur/Huynh Trưởng |
| Core | `community` | ❌ | string | Cộng đoàn |
| Core | `level` | ❌ | string | |
| Core | `notes` | ❌ | string | |
| Contact | `phone` | ❌ | E.164 | Creates `CatechistContact(type=phone)` |
| Contact | `email` | ❌ | email | Creates `CatechistContact(type=email)` |

> **Anti-patterns to avoid:**
> - Do NOT send raw CSV text to Convex — parse fully client-side first
> - Do NOT use a Convex Action (no external I/O; mutations per batch are sufficient)
> - Phone values MUST be E.164 before sending to mutation — validate client-side, mark partial if invalid
> - `contactPriority` for `StudentGuardian` must be unique per student — always use `1` for first guardian in a CSV row
> - Do NOT skip phone validation — existing server mutations enforce E.164 and will throw

### Duplicate Detection Strategy

Because Convex has no unique index on `fullName+dateOfBirth`, duplicate detection is:
1. **Client-side only**: during Step 4 (Validate & Preview), run an `internalQuery` that searches
   `catechists` / `students` by `fullName` to find potential duplicates.
2. Flag matching rows with a `⚠️ Possible duplicate` warning badge.
3. User sees warnings in Step 4 and Step 5 (Confirm). They can still choose to import.
4. The mutation does **not** block duplicate creation — duplicates are allowed per user decision.

Row cap: **500 rows max per upload** — enforced in Step 1 after parsing. If file exceeds 500 rows,
show error and block proceed.

---

## Phase 1 — Backend: `convex/csvImport.ts`

### Strategy

Reuse `createWithDetails` (catechists) and `students.create` + `guardians.createGuardian` +
`guardians.linkGuardianToStudent` pattern inside a new batch mutation. Each record in the batch is
processed independently — errors are caught per-record and returned, never bubble up to abort the
whole batch.

### New Mutation: `bulkImportStudents`

```typescript
// convex/csvImport.ts
export const bulkImportStudents = mutation({
  args: {
    requesterId: v.id('catechists'),
    records: v.array(
      v.object({
        // core
        fullName: v.string(),
        saintName: v.optional(v.string()),
        dateOfBirth: v.optional(v.string()),       // ISO YYYY-MM-DD
        gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
        previousParish: v.optional(v.string()),
        previousDiocese: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        // guardian (optional block)
        guardian: v.optional(v.object({
          fullName: v.string(),
          saintName: v.optional(v.string()),
          relationship: v.string(),
          phone: v.optional(v.string()),    // pre-validated E.164
          email: v.optional(v.string()),
        })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const results = []
    for (let i = 0; i < args.records.length; i++) {
      try {
        const rec = args.records[i]
        const seq = await nextCounter(ctx, 'student')
        const studentCode = String(seq)
        const studentId = await ctx.db.insert('students', {
          fullName: rec.fullName,
          saintName: rec.saintName,
          dateOfBirth: rec.dateOfBirth,
          gender: rec.gender,
          previousParish: rec.previousParish,
          previousDiocese: rec.previousDiocese,
          studentCode,
          isActive: rec.isActive ?? true,
          isDeleted: false,
          createdAt: Date.now(),
        })
        const loginId = `STD-${studentCode}`
        await ctx.db.insert('accounts', {
          loginId, passwordHash: hashPassword(loginId),
          accountType: 'student', userRefId: studentId,
          isActive: true, createdAt: Date.now(), isDeleted: false,
        })
        // Guardian block
        if (rec.guardian) {
          const guardianId = await ctx.db.insert('guardians', {
            fullName: rec.guardian.fullName,
            saintName: rec.guardian.saintName,
            isDeleted: false,
          })
          if (rec.guardian.phone) {
            await ctx.db.insert('guardianContacts', {
              guardianId, contactType: 'phone',
              value: rec.guardian.phone, isPrimary: true, isDeleted: false,
            })
          }
          if (rec.guardian.email) {
            await ctx.db.insert('guardianContacts', {
              guardianId, contactType: 'email',
              value: rec.guardian.email, isPrimary: !rec.guardian.phone, isDeleted: false,
            })
          }
          await ctx.db.insert('studentGuardians', {
            studentId, guardianId,
            relationship: rec.guardian.relationship,
            contactPriority: 1,
            isDeleted: false,
          })
        }
        results.push({ index: i, status: 'ok', id: studentId })
      } catch (e) {
        results.push({ index: i, status: 'error', error: String(e) })
      }
    }
    return results
  },
})
```

### New Mutation: `bulkImportCatechists`

Similar pattern; calls `insertCatechistRecord` helper (extracted from `catechists.ts` as an
`internalMutation`-usable function) then inserts contacts.

```typescript
export const bulkImportCatechists = mutation({
  args: {
    requesterId: v.id('catechists'),
    records: v.array(
      v.object({
        fullName: v.string(),
        saintName: v.optional(v.string()),
        dateOfBirth: v.optional(v.string()),
        gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
        joinedDate: v.optional(v.string()),
        title: v.optional(v.string()),
        community: v.optional(v.string()),
        level: v.optional(v.string()),
        notes: v.optional(v.string()),
        phone: v.optional(v.string()),   // pre-validated E.164
        email: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const results = []
    for (let i = 0; i < args.records.length; i++) {
      try {
        const rec = args.records[i]
        const memberId = (await nextCounter(ctx, 'catechist')).toString()
        const catechistId = await ctx.db.insert('catechists', {
          ...omit(rec, ['phone', 'email']),
          memberId, role: 'user', isActive: true, isDeleted: false,
        })
        const loginId = `CAT-${memberId}`
        await ctx.db.insert('accounts', {
          loginId, passwordHash: hashPassword(loginId),
          accountType: 'catechist', userRefId: catechistId,
          isActive: true, createdAt: Date.now(), isDeleted: false,
        })
        if (rec.phone) {
          await ctx.db.insert('catechistContacts', {
            catechistId, label: 'Phone', contactType: 'phone',
            value: rec.phone, isPrimary: true, isDeleted: false,
          })
        }
        if (rec.email) {
          await ctx.db.insert('catechistContacts', {
            catechistId, label: 'Email', contactType: 'email',
            value: rec.email, isPrimary: !rec.phone, isDeleted: false,
          })
        }
        results.push({ index: i, status: 'ok', id: catechistId })
      } catch (e) {
        results.push({ index: i, status: 'error', error: String(e) })
      }
    }
    return results
  },
})
```

### New Query: `checkDuplicates`

```typescript
export const checkDuplicates = query({
  args: {
    requesterId: v.id('catechists'),
    target: v.union(v.literal('students'), v.literal('catechists')),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    // Returns flat list of existing fullNames for client-side matching
    const table = args.target === 'students' ? 'students' : 'catechists'
    const all = await ctx.db.query(table)
      .withIndex('by_is_deleted', q => q.eq('isDeleted', false))
      .collect()
    const nameSet = new Set(args.names.map(n => n.toLowerCase()))
    return all
      .filter(r => nameSet.has(r.fullName.toLowerCase()))
      .map(r => ({ id: r._id, fullName: r.fullName }))
  },
})
```

### Files

- **[NEW]** `convex/csvImport.ts`
- **[NEW]** `convex/csvImport.test.ts`

### Verification Checklist — Phase 1

- [x] `npm test -- convex/csvImport.test.ts` passes
- [x] Non-admin requester → auth error
- [x] Student created with guardian: student + guardian + guardianContact + studentGuardian rows inserted
- [x] Record with bad data: caught, returns `{ status: 'error' }`, other records in batch succeed
- [x] `checkDuplicates` returns matching names only
- [x] Coverage ≥ 75% (actual: 100% stmts/functions/lines, 92.85% branches)

---

## Phase 2 — Field Definitions & Parser Hook

### [NEW] `src/components/csv-import/csvFieldDefinitions.ts`

```typescript
export type FieldDef = {
  key: string             // matches mutation record key
  labelKey: string        // i18n label
  required: boolean
  group: 'core' | 'guardian' | 'contact'
  // Coerces raw string → typed value string | null (null = skip field)
  coerce: (raw: string, dateFormat: string) => string | null
  // Returns i18n error key or null if valid
  validate: (coerced: string | null, raw: string) => string | null
}

export const STUDENT_FIELDS: FieldDef[]
export const CATECHIST_FIELDS: FieldDef[]
```

Key coerce behaviours:
- **Date fields**: use `date-fns/parse` with the 4 supported formats → output `YYYY-MM-DD`
- **Gender**: case-insensitive map `{ nam|male|m → 'male', nữ|nu|female|f → 'female' }`, unrecognised → null (partial)
- **Phone**: strip spaces/dashes → validate E.164 → null if invalid (partial, not error)
- **Email**: basic RFC 5321 check → null if invalid (partial)
- **Boolean** (`isActive`): `true|yes|1|có → true`, `false|no|0|không → false`, else null → default `true`

### [NEW] `src/components/csv-import/useImportParser.ts`

```typescript
type ParsedRow = Record<string, string>

type RowIssue = {
  field: string
  messageKey: string   // i18n key
  blocking: boolean    // true = row is 'error', false = row is 'partial'
}

type ValidatedRow = {
  rowIndex: number
  status: 'ok' | 'partial' | 'error'
  coerced: Record<string, string | null>
  issues: RowIssue[]
  duplicateWarning?: string  // name of matched existing record
}

export function useImportParser(
  rawText: string,
  config: ImportConfig,
  columnMapping: Record<string, string | null>,
  duplicateNames: string[],   // from checkDuplicates query result
): ValidatedRow[]
```

Row status logic:
- Any **required field** missing or coerce → `null` → `status: 'error'` + `blocking: true` issue
- Any optional field coerce → `null` (bad date/phone) → `status: 'partial'` + `blocking: false` issue
- All fields OK → `status: 'ok'`
- Duplicate name match → adds `duplicateWarning` (does not change status)

### Files

- **[NEW]** `src/components/csv-import/csvFieldDefinitions.ts`
- **[NEW]** `src/components/csv-import/useImportParser.ts`
- **[NEW]** `src/components/csv-import/useImportParser.test.ts`

### Verification Checklist — Phase 2

- [x] Date parsing: all 4 formats produce `YYYY-MM-DD`
- [x] Invalid date → null, row becomes `partial`
- [x] Missing `fullName` → row is `error`
- [x] Invalid phone → null (partial), valid E.164 passes through
- [x] Gender normalization: `Nam` → `male`, `nữ` → `female`, `other` → null (partial)
- [x] `duplicateWarning` set when name matches existing record

---

## Phase 3 — Wizard Route & Steps 1–4

### [NEW] Route: `src/routes/_authenticated/_catechist/_admin/import.tsx`

```typescript
export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/import',
)({
  component: ImportWizardPage,
  staticData: {
    crumbs: [{ label: 'nav.admin.import' }],
  },
})
```

Wizard state held in `React.useReducer`. Steps are pure view components — all state lives in the
parent reducer.

```typescript
type ImportConfig = {
  target: 'students' | 'catechists'
  delimiter: ',' | ';' | '\t' | '|'
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY'
}

type WizardState = {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7
  file: File | null
  rawText: string
  csvHeaders: string[]                         // parsed from first line
  config: ImportConfig
  columnMapping: Record<string, string | null> // csvHeader → fieldKey | null
  validatedRows: ValidatedRow[]
  importResults: ImportRowResult[]
}
```

Stepper header: horizontal step indicator (1-7) with labels, always visible.

### Step Components

#### [NEW] `src/components/csv-import/ImportStep1Upload.tsx`

- Drag-and-drop zone + `<input type="file" accept=".csv">`
- **Alert (Warning)**: "Please prepare a UTF-8 encoded CSV file. Files with non-UTF-8 encoding will show garbled Vietnamese text."
- On file select: read as text via `FileReader` with `{ encoding: 'utf-8' }`
- Count rows — if > 500 show error alert and block "Next"
- Shows file name + row count on success

#### [NEW] `src/components/csv-import/ImportStep2Config.tsx`

- **Import target** — `<Select>`: Students (Học Sinh) | Catechists (Giáo Lý Viên)
- **Delimiter** — `<Select>`: Comma `,`, Semicolon `;`, Tab `\t`, Pipe `|`
- **Date format** — `<Select>`: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
- On "Next": extract CSV headers from first data line using selected delimiter

#### [NEW] `src/components/csv-import/ImportStep3ColumnMap.tsx`

- Table with two columns: **CSV Column** (pill, read-only) | **Maps to** (`<Select>`)
- "Maps to" options = target entity's `FieldDef[]` (display name + `[Required]` / `[Guardian]` / `[Contact]` badge) + "— Skip —" option
- Validation before Next:
  - At least `fullName` is mapped (blocks proceed otherwise)
  - No two CSV columns share the same target field (inline error per duplicate row)

#### [NEW] `src/components/csv-import/ImportStep4Preview.tsx`

- Calls `checkDuplicates` query with all row names
- Runs `useImportParser` on full CSV
- Summary bar: `{ok} will import | {partial} partial import | {error} skipped | {dup} possible duplicates`
- Filter tabs: **All** / **OK** / **Partial** / **Error** / **Duplicates**
- DataTable columns: `#`, Status badge, Duplicate badge, mapped field previews, Issues tooltip
  - Issues tooltip: expandable list of `{ field, message }` per row
- "Proceed to Review" disabled if importable count (ok + partial) = 0

### Verification Checklist — Phase 3

- [x] Non-admin → redirected to `/dashboard` by `_admin.tsx` guard (inherited from layout)
- [x] Upload: > 500 rows → error, blocks Next
- [x] Step 3: `fullName` not mapped → blocks Next
- [x] Step 3: two CSV cols → same target → inline duplicate error
- [x] Step 4: filter tabs update counts correctly
- [x] Step 4: duplicate warning badge visible on matching rows
- [x] typecheck + build clean (verified manually — component tests deferred to Phase 5)

---

## Phase 4 — Confirm, Import & Result (Steps 5–7)

#### [NEW] `src/components/csv-import/ImportStep5Confirm.tsx`

Summary panel before committing:
- Target entity (Students / Catechists)
- Total records to import (ok + partial)
- Skipped (error) count
- Duplicate warning count (expandable list of names)
- Checkbox: "I understand that duplicate records may be created. Proceed anyway." — required to enable "Start Import"
- "Back" → return to Step 4 | "Start Import" → advance to Step 6

#### [NEW] `src/components/csv-import/ImportStep6Import.tsx`

Auto-starts chunked import on mount.

```typescript
const CHUNK_SIZE = 50
// Filter to importable rows (ok + partial) only
const importableRows = validatedRows.filter(r => r.status !== 'error')
const chunks = chunk(importableRows, CHUNK_SIZE)

for (const batch of chunks) {
  const mutationArg = batch.map(r => buildMutationRecord(r.coerced))
  const batchResults = await bulkImport({ requesterId, records: mutationArg })
  accumulateResults(batchResults, batch)
  setProgress(processed / total)
}
// Auto-advance to Step 7 on completion
```

UI:
- Progress bar: `{processed} / {total} records`
- Current batch number
- **Back button disabled** during import
- On completion: `toast.success('Imported X records')` → auto-advance

#### [NEW] `src/components/csv-import/ImportStep7Result.tsx`

- Summary stat cards: ✅ **Successful** | ⚠️ **Partial** (saved with missing optional fields) | ❌ **Failed**
- DataTable columns: `#`, Status badge, Full Name, ID, Actions
  - For students: link `→ /students/$id`
  - For catechists: link `→ /catechists/$id`
  - Error rows: show error message
- CTA buttons:
  - **"Import More"** → reset wizard to Step 1
  - **"Done"** → navigate to `/students` or `/catechists`

### Verification Checklist — Phase 4

- [x] Step 5: "Start Import" disabled until checkbox is ticked
- [x] Step 5: duplicate names expandable list shows correctly
- [x] Step 6: Back button disabled during import
- [x] Step 6: progress bar increments per batch
- [x] Step 7: student links navigate to `/students/$id`
- [x] Step 7: catechist links navigate to `/catechists/$id`
- [x] Step 7: "Import More" resets all state to Step 1
- [x] typecheck + build clean (verified manually — component tests deferred to Phase 5)

---

## Phase 5 — i18n, Nav & Tests

### i18n Keys (`src/locales/en.json` + `src/locales/vi.json`)

```json
{
  "csvImport": {
    "title": "Import from CSV",
    "steps": {
      "upload": "Upload File",
      "config": "Configuration",
      "columnMap": "Map Columns",
      "preview": "Preview & Validate",
      "confirm": "Confirm Import",
      "importing": "Importing…",
      "result": "Import Result"
    },
    "upload": {
      "dragDrop": "Drag & drop a CSV file here, or click to browse",
      "warning": "Please prepare a UTF-8 encoded CSV file to avoid garbled Vietnamese characters.",
      "rowLimitError": "File contains more than 500 rows. Please split into smaller files.",
      "selected": "Selected: {{name}} ({{rows}} rows)"
    },
    "config": {
      "target": "Import into",
      "targetStudents": "Students (Học Sinh)",
      "targetCatechists": "Catechists (Giáo Lý Viên)",
      "delimiter": "Delimiter",
      "dateFormat": "Date Format"
    },
    "columnMap": {
      "csvColumn": "CSV Column",
      "mapsTo": "Maps to",
      "skip": "— Skip (do not import) —",
      "requiredWarning": "Required field \"fullName\" must be mapped to proceed",
      "duplicateError": "\"{{field}}\" is already mapped from another column"
    },
    "preview": {
      "summary": "{{ok}} will import fully · {{partial}} partial · {{error}} skipped · {{dup}} possible duplicates",
      "filter": { "all": "All", "ok": "OK", "partial": "Partial", "error": "Error", "duplicates": "Duplicates" },
      "status": { "ok": "OK", "partial": "Partial", "error": "Error" },
      "duplicateWarning": "Possible duplicate: matches existing record \"{{name}}\"",
      "noImportable": "No importable rows. Fix errors or remap columns before proceeding."
    },
    "confirm": {
      "title": "Ready to import?",
      "summary": "{{count}} records will be saved to {{target}}.",
      "duplicatesAlert": "{{count}} rows match existing records by name. Duplicates will still be created.",
      "acknowledge": "I understand that duplicate records may be created. Proceed anyway.",
      "startImport": "Start Import"
    },
    "result": {
      "successful": "Successful",
      "partial": "Partial",
      "failed": "Failed",
      "importMore": "Import More",
      "done": "Done",
      "viewRecord": "View"
    }
  },
  "nav": {
    "admin": {
      "import": "Import CSV"
    }
  }
}
```

Vietnamese equivalents follow the same keys in `vi.json`.

### Nav Integration

Add import entry to the admin navigation (locate in `_authenticated.tsx` or shared nav config):

```typescript
{ label: 'nav.admin.import', path: '/admin/import', icon: Upload }
```

### Test Files

| File | Coverage target |
|------|----------------|
| `convex/csvImport.test.ts` | ≥ 75% statements/branches |
| `src/components/csv-import/useImportParser.test.ts` | ≥ 75% |
| `src/routes/_authenticated/_catechist/_admin/-import.test.tsx` | Route guard |
| `src/components/csv-import/ImportStep1Upload.test.tsx` | Row limit, file select |
| `src/components/csv-import/ImportStep3ColumnMap.test.tsx` | Duplicate + required mapping |
| `src/components/csv-import/ImportStep4Preview.test.tsx` | Filter tabs, status counts |
| `src/components/csv-import/ImportStep5Confirm.test.tsx` | Checkbox gate |

### Verification Checklist — Phase 5

- [x] `npm test -- --coverage` ≥ 75% on all new files (100/92.85/100/100 backend; all wizard components ≥79% branches, most 100%; route 82/87/76/82 — see notes below)
- [x] All keys present in both `en.json` and `vi.json`
- [x] Nav link visible for admin, hidden for regular users (via existing `adminItems` gate in `app-sidebar.tsx`)

Note: repo-wide `npm test -- --coverage` still fails the global branch threshold (68.21%) due to pre-existing unrelated files at 0% coverage (`convex/accountFollowUp.ts`, `convex/storage.ts`, `admin.catechist-accounts.tsx`, `admin.student-accounts.tsx`, `student-form.tsx`, `address-form.tsx`, `personal-info-form.tsx`, some dashboard widgets) — confirmed pre-dating this feature, out of scope.

---

## File Summary

### New Files

| File | Phase |
|------|-------|
| `convex/csvImport.ts` | 1 |
| `convex/csvImport.test.ts` | 1 |
| `src/components/csv-import/csvFieldDefinitions.ts` | 2 |
| `src/components/csv-import/useImportParser.ts` | 2 |
| `src/components/csv-import/useImportParser.test.ts` | 5 |
| `src/routes/_authenticated/_catechist/_admin/import.tsx` | 3 |
| `src/routes/_authenticated/_catechist/_admin/-import.test.tsx` | 5 |
| `src/components/csv-import/ImportStep1Upload.tsx` | 3 |
| `src/components/csv-import/ImportStep1Upload.test.tsx` | 5 |
| `src/components/csv-import/ImportStep2Config.tsx` | 3 |
| `src/components/csv-import/ImportStep3ColumnMap.tsx` | 3 |
| `src/components/csv-import/ImportStep3ColumnMap.test.tsx` | 5 |
| `src/components/csv-import/ImportStep4Preview.tsx` | 3 |
| `src/components/csv-import/ImportStep4Preview.test.tsx` | 5 |
| `src/components/csv-import/ImportStep5Confirm.tsx` | 4 |
| `src/components/csv-import/ImportStep5Confirm.test.tsx` | 5 |
| `src/components/csv-import/ImportStep6Import.tsx` | 4 |
| `src/components/csv-import/ImportStep7Result.tsx` | 4 |

### Modified Files

| File | Change |
|------|--------|
| `src/locales/en.json` | Add `csvImport.*` + `nav.admin.import` keys |
| `src/locales/vi.json` | Add same keys in Vietnamese |
| Admin nav config | Add import link with `Upload` icon |
