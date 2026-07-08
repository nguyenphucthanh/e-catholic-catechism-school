[← Back to index](README.md)

## 17. Installation & Deployment

This app has **two independent deployables**: the Convex backend (database + functions) and the TanStack Start frontend (static/SSR site). They deploy separately and talk to each other over `VITE_CONVEX_URL`. Keep that split in mind for everything below — "deploying the frontend" never touches your data, and "deploying Convex" never touches your hosting.

### 17.1 Architecture Recap

```
Browser  ──►  Frontend host (Vercel / Netlify / any Node server)
                   │  reads VITE_CONVEX_URL at build/runtime
                   ▼
              Convex backend (Convex Cloud, or self-hosted)
```

The frontend is a [TanStack Start](https://tanstack.com/start) app built on [Nitro](https://nitro.build), which is deploy-target-agnostic — it compiles to whatever platform's expected output format via a "preset." No platform-specific code lives in the app itself.

### 17.2 Prerequisites

- Node.js (LTS) and npm
- A [Convex](https://convex.dev) account (free tier is enough to start), **or** a self-hosted Convex backend (§17.6)
- Git

### 17.3 Forking This Project

If you're standing up your own instance (e.g. for a different parish), you don't need to touch any code to rebrand data — org name, diocese, etc. are runtime config (`appConfig` table, see `docs/schema/08-app-config.md`). Steps:

1. **Fork/clone the repo.**
   ```
   git clone <your-fork-url>
   cd e-catholic-catechism-school
   npm install
   ```
2. **Create your own Convex project** — don't reuse the original author's deployment. Run:
   ```
   npx convex dev
   ```
   Log in (or sign up) when prompted, choose "create a new project." This generates a fresh `.env.local` pointing at *your* deployment — you now own your own database, isolated from anyone else's fork.
3. **Follow `docs/16-developer-onboarding.md`** for local setup, seeding, and first login — same steps whether you're the original maintainer or a fresh fork.
4. **Set your locale defaults** in `.env.local` / your hosting provider's env vars if not Vietnam-based:
   ```
   VITE_DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh
   VITE_DEFAULT_LOCALE=vi-VN
   ```
5. **Push your own remote** and detach from the original repo's history if you don't want to track upstream:
   ```
   git remote set-url origin <your-new-remote>
   ```
   (Skip this if you intend to pull upstream updates — keep `origin` as your fork and add the original as an `upstream` remote instead.)

### 17.4 Deploying Convex (Backend)

Regardless of hosting platform for the frontend, push your Convex functions/schema to a production deployment before going live:

```
npx convex deploy
```

This requires a **production** Convex deployment (separate from your `dev:` one) — Convex's dashboard walks you through creating it the first time. Note the production `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` it gives you; you'll set those on your frontend host, not in `.env.local` (which is dev-only and gitignored).

### 17.5 Deploying the Frontend

The build command is always the same:

```
npm run build
```

This produces a Nitro output (`.output/`) shaped for whatever preset is active. `npm start` (`node .output/server/index.mjs`) runs it as a plain Node server — that's the fallback path for any platform that isn't specifically detected.

#### Option A — Vercel (this project's default target)

Vercel auto-detects Nitro/TanStack Start projects — no config file needed in most cases.

1. Import the repo in the Vercel dashboard (or `vercel` CLI).
2. Set environment variables in Vercel's project settings:
   - `VITE_CONVEX_URL`
   - `VITE_CONVEX_SITE_URL`
   - `VITE_DEFAULT_TIMEZONE`, `VITE_DEFAULT_LOCALE`
   - Do **not** set `CONVEX_DEPLOYMENT` here — that's only for `npx convex dev`/`deploy` running locally/in CI, not needed at frontend runtime.
3. Build command: `npm run build`. Output directory: leave default (Vercel's Nitro preset handles it).
4. Deploy. Re-run `npx convex deploy` separately whenever backend code changes — Vercel deploys don't touch Convex.

#### Option B — Netlify

Nitro ships a Netlify preset. Two ways to select it:

1. **Env var (simplest):** set `NITRO_PRESET=netlify` in your Netlify site's build environment variables, alongside the `VITE_*` vars from Option A. Build command `npm run build`, publish directory `.output/public` (Nitro's Netlify preset also emits the required `netlify/functions` output for SSR routes automatically).
2. **Or a `netlify.toml`** at the repo root if you want it explicit/checked in:
   ```toml
   [build]
     command = "npm run build"
     publish = ".output/public"

   [build.environment]
     NITRO_PRESET = "netlify"
   ```

Either way, set the same `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` / locale vars as environment variables in Netlify's dashboard.

#### Option C — Any generic Node host (self-hosted, Docker, a VPS, etc.)

Nitro's default preset already targets a plain Node server, so this needs no preset override:

```
npm install
npm run build
npm start
```

`npm start` runs `node .output/server/index.mjs` and listens on `PORT` (default 3000) — set `PORT` and the `VITE_*` env vars in your process manager (systemd, pm2, Docker `ENV`, etc.). This is also the path to use for other platforms Nitro supports a preset for (Cloudflare, Deno Deploy, AWS Lambda, ...) — set `NITRO_PRESET` accordingly and consult [Nitro's deploy docs](https://nitro.build/deploy) for the exact preset name and any platform-specific env vars.

### 17.6 Self-Hosting Convex (Instead of Convex Cloud)

Everything above assumes Convex Cloud (`*.convex.cloud` / `*.convex.site` URLs). If you need to run the backend on your own infrastructure instead — e.g. data residency requirements, no third-party dependency — Convex publishes an official self-hosting path:

- **Self-hosted Convex backend guide:** https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- **Convex docs — self-hosting overview:** https://docs.convex.dev/production/self-hosting

At a high level: you run the open-source Convex backend binary/Docker image yourself, point `CONVEX_DEPLOYMENT`/`VITE_CONVEX_URL` at your own host instead of `*.convex.cloud`, and use the same `npx convex deploy` workflow against it. Schema (`convex/schema.ts`) and functions are unchanged — self-hosting is an infrastructure choice, not a code change. Follow Convex's own guide for the current setup steps since this evolves independently of this project.

### 17.7 Production Checklist

- [ ] Production Convex deployment created and functions pushed (`npx convex deploy`)
- [ ] Frontend host has `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` set to the **production** Convex deployment (not `dev:`)
- [ ] Locale env vars (`VITE_DEFAULT_TIMEZONE`, `VITE_DEFAULT_LOCALE`) set for your target audience
- [ ] First-run org setup (`/setup` route, `convex/setup.ts`) completed against production data — creates the initial admin account and `appConfig` row
- [ ] `.env.local` is **not** committed and is not what production reads from — production config lives in the host's env var settings
- [ ] Confirm `npm run build` succeeds locally before pushing — it also runs `tsc --noEmit`, so a build failure often means a type error, not a deploy config issue
