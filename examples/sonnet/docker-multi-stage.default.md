Here's a multi-stage Dockerfile optimized for minimal final image size:

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including devDependencies for tsc)
# Copy manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build   # assumes "build": "tsc" -> outputs to ./dist


# ---- Stage 2: Production dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# Only install production deps (no devDependencies like typescript)
RUN npm ci --omit=dev && npm cache clean --force


# ---- Stage 3: Runtime ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Run as non-root for security
USER node

# Copy only what's needed at runtime
COPY --chown=node:node --from=deps    /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist         ./dist
COPY --chown=node:node package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## Key size-minimizing techniques

1. **Multi-stage build** — TypeScript, dev dependencies, and source files never make it into the final image; only compiled JS and production `node_modules` do.

2. **`alpine` base image** — `node:20-alpine` is ~50MB vs ~400MB for the default Debian-based image.

3. **Separate `deps` stage with `--omit=dev`** — production `node_modules` are built cleanly without any devDependencies (like `typescript`, `@types/*`).

4. **Layer caching** — copying `package*.json` before source means `npm ci` only re-runs when dependencies change, not on every code edit.

5. **`npm ci` over `npm install`** — reproducible, faster, respects the lockfile exactly.

## Assumptions to verify

- Your `package.json` has a `"build"` script (e.g. `"build": "tsc"`).
- `tsconfig.json` has `"outDir": "./dist"` and the entrypoint compiles to `dist/index.js`.
- Adjust `EXPOSE 3000` and the `CMD` path to match your app.

## Optional: add a `.dockerignore`

This speeds up builds and prevents leaking local artifacts:

```
node_modules
dist
npm-debug.log
.git
.env
Dockerfile
.dockerignore
```

Want me to adapt this for a specific setup — e.g. a monorepo, `pnpm`/`yarn`, native modules requiring build tools, or adding a `HEALTHCHECK`?
