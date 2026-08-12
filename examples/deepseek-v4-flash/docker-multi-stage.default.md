Here's a multi-stage Dockerfile that keeps the final image lean: it uses a full Node image only for compiling, then builds a fresh production-only `node_modules` in a separate stage, and copies just the output + runtime deps into the final image.

```dockerfile
# syntax=docker/dockerfile:1

############################
# Stage 1: Build
# Full toolchain: dev deps + TypeScript compiler
############################
FROM node:24-alpine AS build
WORKDIR /app

# Copy dependency manifests first so docker layer caching
# reuses this step unless package-lock.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Copy config and source, then compile TypeScript
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

############################
# Stage 2: Production deps
# Fresh install of ONLY runtime dependencies
############################
FROM node:24-alpine AS production-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

############################
# Stage 3: Runtime
# Minimal image: just node runtime + compiled JS + prod deps
############################
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Run as non-root user (built into the official node image)
USER node

# Copy production dependencies and compiled output
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

# Optional: only copy package.json if your app reads it at runtime
# COPY --from=build --chown=node:node /app/package.json ./

# Optional: non-JS assets from the build, e.g. views/ or public/
# COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

You'll also want a `.dockerignore` so dev files don't get sent to the build context and invalidate caches:

```
node_modules
dist
coverage
.git
.gitignore
Dockerfile
.dockerignore
.env
.env.*
*.log
```

## Why this minimizes image size

- **Dev dependencies never reach the final image.** The TypeScript compiler, `@types/*`, and other dev-only packages only exist in the `build` stage. Only the compiled JS and `--omit=dev` dependencies are copied into `runtime`.
- **A fresh `npm ci --omit=dev` in a separate stage** guarantees a clean production `node_modules` (vs. `npm prune` on the full one, which can occasionally leave stray files).
- **Intermediate stages are free.** Whatever you install in the `build` stage adds zero bytes to the final image, so there's no need to run `npm cache clean` — only what you `COPY --from=` carries over.
- **Layer caching by design.** `package.json` + `package-lock.json` are copied before source code, so dependency installs are only re-run when the lockfile changes — source edits won't re-trigger `npm ci`.
- **`node:alpine` base** is ~30–50 MB compressed. If you rely on native modules (bcrypt, sharp, etc.), note that Alpine uses `musl` libc — in that case prefer `node:24-slim` (Debian-based) to avoid compilation surprises; it's slightly larger but glibc-compatible.
- **`USER node`** isn't about size, but it's good practice — don't run the app as root. The `--chown=node:node` keeps the app able to write to its working directory if needed.

Assumptions baked in: `package-lock.json` is committed, and `npm run build` runs `tsc` with `outDir: "dist"`. Adjust the final `CMD` if your entrypoint lives elsewhere in `dist`.
