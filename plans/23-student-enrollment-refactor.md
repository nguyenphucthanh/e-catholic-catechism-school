# 23: Student Enrollment Dialog Refactor

Refactor the student enrollment dialog to simplify the selection flow. This includes removing the Single/Bulk tab mode, replacing combobox chips with a list/table, expanding the dialog width, and implementing a selection table with a reset-and-refocus search flow.

---

## Phase 0: Documentation Discovery

### 1. Available UI Primitives
- **Base UI Dialog**: Standard modal dialog in [dialog.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/dialog.tsx).
- **Base UI Combobox**: Single-select Combobox in [combobox.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/combobox.tsx) with search query controlled via `inputValue` and `onInputValueChange`.
- **Table Components**: Table layouts defined in [table.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/table.tsx).
- **Trash/Remove Icon**: Import `TrashIcon` or `XIcon` from `lucide-react`.

### 2. Allowed APIs
- `@tanstack/react-form` APIs: `form.getFieldValue('studentIds')` and `form.setFieldValue('studentIds', [...])` to manage form state.
- Combobox APIs: `inputValue` (controlled search text) and `onInputValueChange` (handles typing).
- React refs: `useRef<HTMLInputElement | null>(null)` to refocus the combobox input programmatically.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT use `ComboboxChips` or `ComboboxChip`**: We are moving selection tracking from inline chips to an explicit HTML table below the input.
- ❌ **Do NOT lose input focus on selection**: Use a DOM ref to call `.focus()` on the combobox input immediately after a student is added to the table.
- ❌ **Do NOT persist selected students in the search dropdown**: Keep filtering the query results in-memory so selected students are removed from the dropdown list.

---

## Phase 1: Frontend Dialog Refactor

### What to Implement
Refactor [enrollment-dialog.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/enrollment-dialog.tsx):

1. **Clean Form State & Tabs**:
   - Remove `tabMode` from form values.
   - Delete the `<Tabs>`, `<TabsList>`, and `<TabsContent>` JSX wrappers. The layout will be a single unified column.
2. **Search Input & Combobox Controller**:
   - Implement `const [searchQuery, setSearchQuery] = React.useState("")` to control search input text.
   - Create a ref `inputRef = useRef<HTMLInputElement>(null)`.
   - Render the `Combobox` as a single-select (remove `multiple` prop), with its `value` prop hardcoded to `""` or `null`.
   - In `onValueChange(selectedStudentId)`:
     - Check if `selectedStudentId` is not null.
     - Add it to the form's `studentIds` array.
     - Set `searchQuery` to `""`.
     - Trigger `inputRef.current?.focus()` to maintain keyboard focus for the next entry.
   - Replace `<ComboboxChips>` with a simple `<ComboboxInput ref={inputRef} inputValue={searchQuery} onInputValueChange={setSearchQuery} />`.
3. **Selected Students Table**:
   - Render a scrollable table card/container below the Combobox.
   - Use components from `~/components/ui/table` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`).
   - Columns:
     - **Mã học sinh** (Student Code)
     - **Tên học sinh** (Saint Name + Full Name)
     - **Thao tác** (Remove button with a small icon and secondary/ghost variant)
   - Clicking "Remove" will remove the student ID from the form's `studentIds` array.
   - If the list is empty, display a placeholder row or message: "Chưa chọn học sinh nào" (No students selected).
4. **Layout/Size adjustments**:
   - Change `DialogContent` width class from `max-w-2xl` to `max-w-3xl` to make the dialog wider and more spacious.
   - Set a maximum height and vertical scrollbar on the selected students table container so it doesn't expand the dialog off-screen if many students are added.

---

## Phase 2: Verification

### Automated Verification
- Run existing tests to ensure no regressions:
  ```bash
  npx vitest run convex/students.test.ts
  ```
- Run tests for enrollment-dialog:
  ```bash
  npx vitest run src/components/forms/enrollment-dialog.test.tsx
  ```
  *(Update the tests in the next phase to match the new UI without tabs or chips)*.

### Manual Verification
1. Open the enrollment dialog on a class details page.
2. Verify the dialog is wider (`max-w-3xl`) and has no Bulk/Single tabs.
3. Type a student's name/code. Press Enter to select them.
4. Verify the student is added as a row to the table underneath, the combobox text is cleared, and focus remains in the search input.
5. Verify that selected students no longer appear in the search dropdown.
6. Click the "Remove" (X) button on a row. Verify the student is removed from the table and becomes searchable in the combobox again.
7. Fill in the enrollment date and submit the form. Verify that students are successfully enrolled and the dialog closes.
