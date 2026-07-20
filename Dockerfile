# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: vite dev server + convex dev, hot reload via bind mount ----
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build: compile production Nitro server bundle ----
# VITE_* vars are inlined into the client bundle at build time, so they must
# be passed as build args (not just runtime env) — see Vite's env docs.
FROM deps AS build
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_DEFAULT_TIMEZONE
ARG VITE_DEFAULT_LOCALE
ARG VITE_SENTRY_DSN
COPY . .
RUN npm run build

# ---- prod: run only the built output ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
