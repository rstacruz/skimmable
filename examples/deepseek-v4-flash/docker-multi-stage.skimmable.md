### Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# ---- Stage 1: build ----
# Has dev dependencies (typescript, @types/*) — result is discarded
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: production deps ----
# Fresh install without dev dependencies — small layer for the runtime image
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ---- Stage 3: runtime ----
# Smallest image: node, prod deps, compiled output. No typescript, no sources.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Why it's small

- **Build stage discarded** — typescript, dev deps, and `src/` never reach the final image
- **Separate `deps` stage** — production-only `node_modules`; `--omit=dev` keeps node_modules free of typechecking/transpilation tooling
- **Alpine base** — ~50 MB vs ~180 MB for the default `node` image
- **`npm ci`** — reproducible installs from the lockfile; fails loudly if `package-lock.json` drifts
- **BuildKit cache mounts** — `/root/.npm` cache survives rebuilds, so dependency reinstall is fast
- **`NODE_ENV=production`** — lets framework code skip dev-only asserts/paths
- **Non-root `USER app`** — security hardening, no size cost

### Adjustments to make

- **Entry point** — change `dist/index.js` to match your `tsconfig.json` `outDir` + `main`. If `outDir` is `dist` and `rootDir` is `src`, it's `dist/index.js`; if `rootDir` is `.`, it's `dist/src/index.js`
- **Alpine vs distroless** — `gcr.io/distroless/nodejs20-debian12` shaves ~30 MB more but has no shell (no `docker exec` debugging) and uses a different `CMD` shape (`CMD ["dist/index.js"]`)

### Companion `.dockerignore`

Keeps local `node_modules` and builds out of the build context — faster builds, smaller context:

```dockerignore
node_modules
dist
.git
npm-debug.log*
*.md
```
