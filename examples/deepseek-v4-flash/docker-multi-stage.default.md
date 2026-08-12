This multi-stage approach keeps the build toolchain (TypeScript, dev dependencies) out of the final image. The runtime stage only gets compiled JavaScript plus production dependencies, and runs as a non-root user on a slim Alpine base.

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
# Full node environment: installs everything, compiles TypeScript.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Install deps first so Docker caches this layer until package files change.
COPY package.json package-lock.json ./
RUN npm ci

# Compile TypeScript -> JavaScript in /app/dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Stage 2: runtime ----------
# Fresh, minimal base. No TypeScript, no dev dependencies, no build tools.
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies into this stage's own node_modules,
# then drop npm's cache so it isn't stored in the image layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy only the compiled output from the build stage.
COPY --from=build /app/dist ./dist

# Run as non-root user (built into the node image).
USER node

EXPOSE 3000
# Adjust to match your tsconfig output / entry file.
CMD ["node", "dist/index.js"]
```

Add a `.dockerignore` so local `node_modules`, build output, and secrets aren't sent as build context:

```
node_modules
dist
.git
.env*
npm-debug.log*
Dockerfile*
.dockerignore
```

Notes:

- **`npm ci` requires a committed `package-lock.json`** — deterministic and faster than `npm install`.
- **Cache invalidation:** package files are copied before source code, so rebuilding after a code change skips the `npm ci` layers in both stages.
- **Native modules:** Alpine uses musl; most popular packages (e.g. `sharp`, `better-sqlite3`) ship musl prebuilds. If a dependency doesn't, switch both stages to `node:24-slim` (Debian/glibc) so `npm ci` can compile it in the runtime stage.
- **Trimming further:** if you don't need stack-trace source maps in production, set `"sourceMap": false` (and `"declaration": false`) in your build `tsconfig.json` — it reduces the `dist` output size.
- **Edge case:** if `package.json` has a `"prepare": "npm run build"` script, `npm ci` in the build stage will fail because `src/` isn't copied yet. Remove the `prepare` script for this project (or use `npm ci --ignore-scripts` if no dependency needs postinstall hooks).
- **Go smaller still:** for maximum reduction you can switch the final stage to `gcr.io/distroless/nodejs24-debian12` (no shell, no package manager), but install production deps in a node slim stage first so native modules stay glibc-compatible — you lose shell access for debugging.
- **Verify:** compare image sizes with `docker images`, and your app's actual entry point may be `dist/server.js` or similar — adjust the `CMD` accordingly.
