# Plan: Refactor Academic Year Form Date Inputs

## Overview

Refactor `src/components/forms/academic-year-form.tsx` to:

1. Replace custom DateInput with native HTML `<input type="date">`
2. Auto-populate end date 365 days after start date (if end date empty)
3. Set creation flow defaults: August 1st start, +365 days end
4. Update all tests to cover new behavior

## Phase 0: Documentation & API Discovery ✓

### Key Findings

**shadcn Input component** (`src/components/ui/input.tsx`):

- Wraps `@base-ui/react/input`
- Supports `type="date"` natively
- Returns string values in `"YYYY-MM-DD"` format

**Current DateInput** (`src/components/custom/date-input.tsx`):

- Popover-based with Calendar + text input
- Takes `value: Date | undefined`, returns via `onChange: (date: Date | undefined) => void`
- Will be fully removed

**Form state** (academic-year-form.tsx lines 80-132):

- Stores dates as strings: `"YYYY-MM-DD"`
- Converts Date → string via `${yr}-${mo}-${dy}` (lines 207, 245)
- Validation: `new Date(startDate) >= new Date(endDate)` (line 94)
- Create mode: `numberOfSemesters` defaults to `2` (line 85)

**Test patterns** (academic-year-form.test.tsx):

- Mock DateInput as simple input (lines 14-25)
- Date format in tests: `"YYYY-MM-DD"` strings
- Coverage requirement: ≥75% (per CLAUDE.md)

**Anti-patterns to avoid**:

- Don't mix Date objects and strings in same field
- Don't use DateInput after refactor
- Don't use date-fns for simple arithmetic (use Date API)

---

## Phase 1: Replace DateInput with native Input type="date"

**What to implement:**

- Replace `DateInput` imports (line 8) with existing `Input` import
- Change startDate field: remove DateInput, use `<Input type="date">`
- Change endDate field: remove DateInput, use `<Input type="date">`
- Remove date formatting handlers (lines 202-212, 240-250 have complex date conversion logic)
- Input already handles string values directly

**Files to modify:**

- `src/components/forms/academic-year-form.tsx`

**Key changes:**

- Line 8: Remove `import { DateInput } from '~/components/custom/date-input'`
- Lines 195-231 (startDate field): Replace DateInput block with Input type="date"
- Lines 233-270 (endDate field): Replace DateInput block with Input type="date"
- Simplify onChange handlers to `field.handleChange(e.target.value)` (no date formatting)

**Verification:**

- Form renders date inputs with browser native picker
- Date values stored as `"YYYY-MM-DD"` strings
- Visual inspection: dates display correctly

---

## Phase 2: Add auto-populate logic for end date

**What to implement:**

- Add `React.useEffect` hook to listen for startDate changes
- When startDate updates AND endDate is empty: calculate endDate = startDate + 365 days
- Logic:
  ```typescript
  const calculateEndDate = (startDateStr: string): string => {
    const date = new Date(startDateStr)
    date.setDate(date.getDate() + 365)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  ```

**Files to modify:**

- `src/components/forms/academic-year-form.tsx`

**Location:**

- Add hook after form initialization (after line 132)
- Hook updates form state via `form.setFieldValue('endDate', calculatedDate)`

**Verification:**

- Test: startDate change → endDate auto-fills (+365 days)
- Test: endDate NOT overwritten if already has value
- Test: clearing startDate doesn't affect endDate

---

## Phase 3: Set creation flow defaults (August 1st + 365 days)

**What to implement:**

- Calculate August 1st of current year as default startDate
- Calculate 365 days later as default endDate
- Only apply in create mode (when `!yearId`)

**Files to modify:**

- `src/components/forms/academic-year-form.tsx` (lines 81-86 defaultValues)

**Logic:**

```typescript
const getDefaultStartDate = (): string => {
  const year = new Date().getFullYear()
  return `${year}-08-01`
}

const getDefaultEndDate = (): string => {
  const date = new Date(`${new Date().getFullYear()}-08-01`)
  date.setDate(date.getDate() + 365)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
```

**Update defaultValues block:**

```typescript
defaultValues: {
  name: initialValues?.name ?? '',
  startDate: initialValues?.startDate ?? (!yearId ? getDefaultStartDate() : ''),
  endDate: initialValues?.endDate ?? (!yearId ? getDefaultEndDate() : ''),
  numberOfSemesters: !yearId ? 2 : undefined,
}
```

**Verification:**

- Test: create mode shows August 1st as default start
- Test: default end date is 365 days later
- Test: update mode uses initialValues (no defaults applied)

---

## Phase 4: Update tests

**What to implement:**

- Update DateInput mock to handle string values (type="date" inputs)
- Remove Date object conversion from mock
- Add test: startDate change auto-populates endDate
- Add test: endDate NOT overwritten if already set
- Add test: creation mode has August 1st default
- Add test: creation mode end date is +365 days from default start

**Files to modify:**

- `src/components/forms/academic-year-form.test.tsx`

**Mock update** (lines 14-25):

```typescript
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Remove DateInput mock entirely - use native input in tests
```

**New test cases to add:**

1. `test('auto-populates end date 365 days after start date when empty')`
2. `test('does not overwrite end date if already set when start date changes')`
3. `test('has August 1st default for create mode')`
4. `test('has correct default end date (Aug 1st + 365) in create mode')`

**Verification:**

- All existing tests pass
- New auto-populate tests pass
- New default tests pass
- Coverage ≥75% (run `npm test -- --coverage`)

---

## Risks & Anti-patterns

| Risk                                   | Mitigation                                           |
| -------------------------------------- | ---------------------------------------------------- |
| Date string parsing bugs               | Use native Date API, test format consistency         |
| End date overwrite on existing values  | Explicitly check `if (!endDateValue)` before setting |
| Timezone issues with Date calculations | Use local Date (not UTC) - test with current year    |
| Test mock complexity                   | Remove DateInput mock, rely on native input behavior |

---

## Success Criteria

- [x] Phase 0: Documentation discovered
- [ ] Phase 1: DateInput replaced, form renders native date pickers
- [ ] Phase 2: Auto-populate logic works (test: manually set start, end auto-fills)
- [ ] Phase 3: Defaults set (create mode shows Aug 1st + 365)
- [ ] Phase 4: All tests pass, coverage ≥75%
- [ ] Manual verification: create and edit flows work in browser

---

## Files Modified Summary

| File                                               | Lines | Change                                             |
| -------------------------------------------------- | ----- | -------------------------------------------------- |
| `src/components/forms/academic-year-form.tsx`      | ~50   | Replace DateInput, add auto-populate, add defaults |
| `src/components/forms/academic-year-form.test.tsx` | ~80   | Update mock, add 4 new test cases                  |
| **Total**                                          | ~130  | Isolated component changes, no backend impact      |
