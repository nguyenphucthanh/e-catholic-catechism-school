---
name: tanstack_form_validation
description: TanStack Form validation pattern in this codebase — onBlur validators only; submit-time validation gap is a recurring risk
metadata:
  type: project
---

This codebase uses TanStack Form with `validators.onBlur` for field-level validation. The pattern seen in `change-password.tsx` sets validators only on `onBlur`, which means the `onSubmit` handler fires with stale/unvalidated state if the user never blurs a field.

Always check that any `onSubmit` handler either:

1. Also defines `validators.onSubmit` on each field, OR
2. Gates submission on `form.state.isValid` / `form.state.canSubmit`, OR
3. Has server-side validation that surfaces errors back to the UI.

**Why:** Without submit-time validators, a user can click Submit without touching any field and bypass all onBlur validation.

**How to apply:** Flag any `form.Field` that uses `validators.onBlur` only and where the `onSubmit` handler calls a mutation/API directly without checking form validity.
