---
name: auth_security
description: Auth layer security concerns — client-supplied loginId in mutations, SHA-256 password hashing, layout-level auth guard
metadata:
  type: project
---

**Auth guard location:** `src/routes/_authenticated.tsx` renders `<Navigate to="/login" />` when `user` is null. All routes under `/_authenticated/` rely on this guard — non-null assertions on `user` inside child routes are safe.

**SHA-256 password hashing:** `convex/auth.ts` uses `sha256Hex()` for password storage. SHA-256 is a fast, unsalted hash and is not suitable for passwords — it is trivially brute-forceable with modern GPUs. Proper password hashing (bcrypt, scrypt, argon2) requires the Node.js runtime (a Convex action with `"use node"`), not the default V8 mutation runtime. This is known security debt.

**Client-supplied loginId in changePassword:** The `changePassword` mutation accepts `loginId` from the client to look up the target account. Convex guidelines say "NEVER accept a userId or any user identifier as a function argument for authorization purposes." The `oldPassword` check partially mitigates this (attacker must also know the current password), but the pattern still violates the guideline. Ideal fix: derive the account from `ctx.auth.getUserIdentity()` server-side.

**How to apply:** Flag any new mutation that accepts a user/account identifier as an argument for lookup or authorization. SHA-256 password hashing is known technical debt — don't flag it repeatedly, but note it when touching the auth module.
