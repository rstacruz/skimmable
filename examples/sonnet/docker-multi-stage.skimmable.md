> Write a multi-stage Dockerfile for a Node.js TypeScript application that minimizes the final image size. The app uses npm and needs to compile TypeScript before running.

---

```dockerfile
# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- prod deps only ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ---- final stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

USER node
CMD ["node", "dist/index.js"]
```

**Why 3 stages, not 2:**
- `build` has devDependencies (typescript, @types/*) — needed only to compile
- `deps` installs prod-only deps in a clean layer, so build tools never reach final image
- final stage copies just compiled JS + prod `node_modules` — no source, no tsc, no build cache

→ skipped: multi-arch build, `.dockerignore` file, distroless base. Add `.dockerignore` (node_modules, dist, .git) now — it's one file and prevents npm ci from tripping over stale local `node_modules`.
