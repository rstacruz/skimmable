# Examples

Real outputs from the benchmark suite (`benchmarks/`). The same prompt was answered twice: once with skimmable active, once without.

## React re-render debugging

> Why is my React component re-rendering on every state update even though the props haven't changed? I'm passing an object as a prop.

Skimmable uses **43% fewer tokens** (2186 → 1256).

<details>
<summary><b>Before</b> — normal output (2186 tokens)</summary>

> The short answer: **the object is a *new* object every render, so the props *have* changed — by reference, even if not by content.** And on top of that, React re-renders children whenever the parent re-renders, with or without prop changes.
> 
> Here's the breakdown and what to do about it.
> 
> ---
> 
> ## 1. The default React behavior
> 
> When a parent component's state updates, the parent re-renders and **all of its children re-render by default**, regardless of whether their props changed:
> 
> ```jsx
> function Parent() {
>   const [count, setCount] = useState(0);
>   // Every click of "Increment" re-renders Child, even though its props "look" the same
>   return <Child config={{ theme: 'dark' }} />;
> }
> ```
> 
> React only *bails out* of a child re-render if the child is wrapped in `React.memo` (or extends `PureComponent`, or implements `shouldComponentUpdate`). Otherwise it just renders everything.
> 
> ---
> 
> ## 2. Why memoization doesn't save you here
> 
> If you *do* wrap the child in `React.memo`, it does a **shallow comparison** of props using reference equality (`Object.is`). That means:
> 
> ```jsx
> const Child = React.memo(({ config }) => {
>   console.log("Child rendered");
>   return <div>{config.theme}</div>;
> });
> 
> function Parent() {
>   const [count, setCount] = useState(0);
>   return <Child config={{ theme: 'dark' }} />;  // 🚨 new object literal every render
> }
> ```
> 
> Even though `config` holds the same values, `{ theme: 'dark' }` creates a **brand-new object reference** on every render. So `Object.is(prevConfig, nextConfig)` is `false`, and `React.memo` thinks the prop changed → re-render happens anyway.
> 
> This is the most common reason: **you're passing an object literal (or array, or function) inline, which breaks memoization.**
> 
> ---
> 
> ## 3. Fixes
> 
> ### Fix A: Hoist static objects out of the component
> 
> If the object doesn't depend on anything in the component, define it once at module level:
> 
> ```jsx
> const CONFIG = { theme: 'dark' };
> 
> function Parent() {
>   const [count, setCount] = useState(0);
>   return <Child config={CONFIG} />; // same reference every render ✅
> }
> ```
> 
> ### Fix B: Use `useMemo` for derived objects
> 
> If the object depends on state or props:
> 
> ```jsx
> function Parent() {
>   const [count, setCount] = useState(0);
> 
>   const config = useMemo(
>     () => ({ theme: 'dark', threshold: count > 10 ? 'high' : 'low' }),
>     [count] // only rebuild when count changes
>   );
> 
>   return <Child config={config} />;
> }
> ```
> 
> Now `config` only gets a new reference when `count` changes, not on every render.
> 
> ### Fix C: Same problem applies to functions and children
> 
> The exact same issue happens with:
> 
> ```jsx
> <Child onClick={() => doSomething()} />       // new function every render
> <Child>{children}</Child>                      // new JSX element every render
> ```
> 
> Use `useCallback` for functions, and wrap `children` in `useMemo` if the child is memoized and you need the identity to be stable.
> 
> ---
> 
> ## 4. One more gotcha: context with object values
> 
> If the component consumes context, the provider value being a new object re-renders **every consumer**:
> 
> ```jsx
> <MyContext.Provider value={{ user }}>  // 🚨 new object every render
> ```
> 
> Wrap it in `useMemo`:
> 
> ```jsx
> const value = useMemo(() => ({ user }), [user]);
> <MyContext.Provider value={value}>
> ```
> 
> `<Child>` in this tree re-renders even if it's memoized and its own props are stable — because a new context value forces consumers to re-render.
> 
> ---
> 
> ## 5. Verify it in DevTools
> 
> Don't guess — profile it:
> 
> 1. Open **React DevTools → Profiler**.
> 2. Click the record button, interact, stop.
> 3. Check the **"Why did this render?"** panel for the child. It will tell you exactly which prop changed (e.g., `config` changed) or if it's due to the parent rendering.
> 
> ---
> 
> ## 6. Important: this might be fine
> 
> Re-rendering isn't inherently a bug. React re-renders are cheap *unless* the component subtree is expensive (large lists, heavy computations, complex forms). If your component is small, the re-render is probably harmless — don't add `useMemo`/`React.memo` prematurely. Only stabilize object props when profiling shows it's a real bottleneck.
> 
> ---
> 
> **Summary of the chain:**
> 
> | Why it re-renders | Fix |
> |---|---|
> | Parent re-renders → child re-renders by default | Wrap child in `React.memo` |
> | Inline object literal → new reference every render | Hoist constant, use `useMemo`, or `useCallback` |
> | Context value object changes identity | `useMemo` the provider value |
> 
> The mental model: **React compares props by reference, never by deep content.** If you want React to "see" that an object is unchanged, you must give it the *same reference* across renders.

</details>

<details>
<summary><b>After</b> — skimmable output (1256 tokens)</summary>

> ## Why it happens
> 
> React re-renders a component when **its parent re-renders** — not when props change. By default, children re-render unconditionally.
> 
> Your object prop makes it worse: if it's created inline (or comes from state), **every render produces a new reference**, so even `React.memo` sees it as "changed."
> 
> ```
> Parent state update
>   → Parent re-renders
>     → New object reference created
>       → Child re-renders (memo's shallow compare fails)
> ```
> 
> ## The problem in code
> 
> ```jsx
> function Parent() {
>   const [count, setCount] = useState(0)
> 
>   // New object every render — kills React.memo
>   const config = { theme: "dark", size: "lg" }
> 
>   return (
>     <>
>       <button onClick={() => setCount(c => c + 1)}>{count}</button>
>       <Child config={config} />
>     </>
>   )
> }
> 
> const Child = React.memo(({ config }) => {
>   console.log("Child re-rendered")
>   return <div>{config.theme}</div>
> })
> ```
> 
> Every `count` update logs `"Child re-rendered"` — even though the object's *contents* never changed.
> 
> ## Fixes (pick based on your situation)
> 
> **1. Memoize the object with `useMemo`**
> 
> ```jsx
> const config = useMemo(() => ({ theme: "dark", size: "lg" }), [])
> // Stable reference → React.memo works
> ```
> 
> **2. Move the object out of the component**
> 
> ```jsx
> // Outside the component — never recreated
> const CONFIG = { theme: "dark", size: "lg" }
> ```
> 
> **3. If the object comes from state, memoize it separately**
> 
> ```jsx
> const [settings, setSettings] = useState({ theme: "dark" })
> 
> // Only recreate when settings actually change
> const config = useMemo(() => ({ ...settings, origin: "parent" }), [settings])
> ```
> 
> ## One more thing to check
> 
> If the object is passed as a **prop that the child itself mutates or uses in an effect**, the child's `useEffect` dependency array will also fire every render. Same fix applies — `useMemo` the object or use the individual primitives as deps:
> 
> ```jsx
> useEffect(() => {
>   // ...
> }, [config.theme]) // depend on the primitive, not the object
> ```
> 
> ## Worth noting
> 
> - **Don't over-optimize.** If the child is cheap to render, the default re-render is fine.
> - **`React.memo` + `useMemo`** is the standard pairing for this exact problem.
> - **Alternative pattern:** move state down or use the `children` prop — components passed as `children` don't re-render when the parent re-renders.

</details>

---

## Microservices vs monolith

> We have a monolithic Django app that's getting slow. The team is debating microservices. What are the key factors to consider before splitting up the monolith?

Skimmable uses **40% fewer tokens** (2585 → 1558, median across runs).

<details>
<summary><b>Before</b> — normal output (2585 tokens)</summary>

> Before splitting a Django monolith into microservices, the key question is not “is the monolith slow?” but **“is the monolith slow because of boundaries that would benefit from independent teams/deployment, or because of code-level issues that microservices won’t fix?”** Microservices introduce significant complexity, so evaluate these factors first.
> 
> ## 1. Team & Organizational Structure
> - **Conway’s Law**: services will mirror your team boundaries. If you don’t have clear, autonomous teams that can own a domain end-to-end, microservices will create coordination overhead rather than reduce it.
> - **Can each team ship independently?** If a change still requires synchronized releases across multiple services, you’ve only moved the monolith into distributed form.
> - **Team size**: a small team (<10 developers) is usually better served by a **modular monolith**. Microservices only pay off with enough people to own and operate several services.
> 
> ## 2. Domain Boundaries & Coupling
> - **Bounded contexts**: Have you identified clear subdomains (e.g., billing, inventory, users) with stable APIs between them?
> - **If you can’t define clean boundaries inside the monolith** (e.g., Django apps importing each other’s models everywhere, signals causing cross-app side effects), splitting will be painful. Start by enforcing boundaries *within* the monolith first.
> - **Shared code**: shared models, utilities, or migrations across apps will become shared libraries/API contracts – decide how versioning and compatibility will work.
> - **Transaction boundaries**: if a business operation needs atomicity across multiple domains (e.g., order + payment + inventory), a distributed transaction is a major red flag. You’ll need **eventual consistency**, sagas, or compensation logic.
> 
> ## 3. Scalability Needs
> - **What actually bottlenecks?** CPU? Database connections? Background tasks? A monolith can often scale by adding workers, replicas, or caching.
> - **Different resource profiles**: if one component needs 100 replicas and the rest only 2, microservices can save resources. Measure this first.
> - **Database is usually the real bottleneck** – splitting services without splitting the database doesn’t help. You need to separate data ownership too.
> 
> ## 4. Data & Persistence
> - **Shared database**: if all services still point to the same Postgres/MySQL schema, you haven’t decoupled anything – you’ve just added network calls.
> - **Data ownership**: each service must own its data and expose it only through an API. Repartitioning a shared schema is often the hardest part of the split.
> - **Migrations**: Django migrations across apps in a monolith are atomic; in a distributed system, schema changes must be backward-compatible across releases.
> 
> ## 5. Deployment & Release Cadence
> - **Do you need independent deployability?** If you deploy everything together anyway, microservices add overhead without benefit.
> - **CI/CD maturity**: can you deploy a single service without affecting others? Do you have feature flags, rolling deployments, and automated rollback?
> - **Versioning**: how will you handle breaking API changes? Will you use API versioning, contract testing, and consumer-driven contracts?
> 
> ## 6. Operational Complexity
> - **Observability**: you’ll need distributed tracing (e.g., OpenTelemetry), centralized logging, and metrics across services to debug requests that span multiple systems.
> - **Network failures**: every remote call introduces latency, timeouts, retries, and partial failures. You need resilience patterns (circuit breakers, bulkheads, retries with exponential backoff).
> - **Infrastructure**: Kubernetes, service discovery, load balancing, secret management, monitoring – do you have the ops skills and budget?
> 
> ## 7. Latency & Performance
> - **The monolith is “slow”** – microservices often make things slower because of serialization and network overhead. A well-optimized monolith with proper DB indexes, caching, and async processing usually beats a naïve microservice split.
> - **N+1 remote calls**: an ORM query that does `.select_related()` locally can become dozens of HTTP calls across services. You’ll need aggregation layers, BFFs, or GraphQL, and possibly data denormalization to avoid chatty calls.
> 
> ## 8. Cost, Risk, and Skillset
> - **Cost**: more services = more infrastructure, more monitoring, more maintenance, more documentation, more security surface.
> - **Team skill**: not every team is ready for distributed systems debugging – are they comfortable with event-driven architectures, eventual consistency, and distributed tracing?
> - **Migration risk**: a big-bang rewrite is a common failure mode. Consider an **incremental strangler fig** approach: extract one bounded context at a time while keeping the rest as a monolith, and only when that service proves value.
> 
> ## Practical Starting Point
> Before any split, do this:
> 
> 1. Profile the monolith – identify the actual performance bottlenecks (queries, views, tasks).
> 2. Enforce **modularity** inside Django: use well-defined app boundaries, restrict direct model imports, use explicit interfaces (e.g., service classes or internal APIs).
> 3. Extract **one** domain at a time only if it meets the criteria above and gives a clear benefit (independent scaling, team autonomy, release independence).
> 4. If you can’t name a single problem that microservices would solve better than a modular monolith with async workers and caching, **don’t split yet**.
> 
> Ultimately, the decision should be driven by organizational boundaries, data ownership, and deployability needs – not by “monolith = bad.” A well-structured modular monolith is often the pragmatic answer for a team that isn’t already scaling teams and release cadence independently.

</details>

<details>
<summary><b>After</b> — skimmable output (1558 tokens)</summary>

> ## Short answer
> 
> Microservices rarely fix "slow." They add network hops, not remove them. Profile the monolith first — most slowness is DB queries, missing indexes, N+1s, or bad caching, all fixable in-place.
> 
> Split when the *monolith structure* is the bottleneck (team ownership, deploy coupling, scaling one module), not when it's merely slow.
> 
> ## Key factors
> 
> ### 1. Actual bottleneck
> 
> - Profile before deciding: DB query plans, slow endpoints, blocked IO, third-party calls
> - Microservices solve **team, ownership, and scaling** problems — not slow code
> - Every internal call becomes a network call: +latency, +failure modes
> 
> ### 2. Team & organization (Conway's law)
> 
> - Do you have teams that can own a service **end-to-end**? (code, data, deploys, on-call)
> - Each service needs a stable, accountable owner team (~2–8 people)
> - Without this, you get a **distributed monolith** — worst of both worlds
> 
> ### 3. Domain boundaries
> 
> - Candidate services must map to clear business domains (bounded contexts)
> - If everything touches everything (shared models, shared tables), there's no clean cut
> - Extract along **seams that already exist** — don't invent new ones
> 
> ### 4. Data is the hard part
> 
> - Each service should own its database exclusively
> - Cross-service transactions become distributed: sagas, outbox pattern, eventual consistency
> - Sharing a DB between services is a trap — you still have a monolith, plus network overhead
> 
> ### 5. Operational cost
> 
> - More services → more deploys, dashboards, alerts, on-call rotations
> - Prerequisites: mature CI/CD, container orchestration, service discovery, tracing, centralized logs
> - Ask honestly: does the team have the tooling *and* the people to run this?
> 
> ### 6. Failure & consistency
> 
> - Assume the network fails: timeouts, retries, circuit breakers, idempotency
> - Eventually-consistent data changes how features behave for users
> - Internal calls need the same care as third-party APIs — that's new discipline
> 
> ### 7. Migration strategy
> 
> - **Strangler fig pattern**: carve off one capability at a time, keep the rest intact
> - Never do a big-bang rewrite — extract incrementally, service by service
> - Plan rollback and freeze the monolith during each extraction window
> 
> ### 8. Good first candidates
> 
> - Low coupling to the rest of the app
> - Different rate of change than the core (e.g. rarely-touched reporting)
> - Independent scaling needs (CPU-heavy job vs. web serving)
> - Clear single team owner
> 
> ## When not to split
> 
> - **Small team** (< ~10–15 engineers) — a modular monolith is usually faster to ship
> - **Pre-product-market-fit** — velocity matters more than architecture purity
> - **Slowness without profiling** — fix performance inside the monolith first
> 
> ## Cheaper alternatives first
> 
> - **Modular monolith**: strict internal boundaries, separate packages/apps, per-module DB if feasible
> - Caching (Redis), async workers (Celery/queue), read replicas, DB tuning
> - Vertical scaling — often far cheaper than distributed complexity
> 
> **Bottom line:** if you can't answer "yes" to most of the factors above, staying a (well-modularized) monolith is the rational choice. Split to solve *ownership and scaling*, not speed.

</details>

---

## Docker multi-stage build

> Write a multi-stage Dockerfile for a Node.js TypeScript application that minimizes the final image size. The app uses npm and needs to compile TypeScript before running.

Skimmable uses **28% fewer tokens** (7927 → 5667, median across runs).

<details>
<summary><b>Before</b> — normal output (7927 tokens)</summary>

> Below is a production‑ready multi‑stage `Dockerfile` for a Node.js + TypeScript application using npm.
> 
> ```dockerfile
> # ---------- Build stage ----------
> FROM node:20-alpine AS build
> 
> WORKDIR /app
> 
> # Install dependencies (including devDependencies needed for TypeScript compilation)
> COPY package*.json ./
> RUN npm ci
> 
> # Copy source and compile TypeScript
> COPY . .
> RUN npm run build
> 
> # ---------- Production stage ----------
> FROM node:20-alpine AS production
> 
> ENV NODE_ENV=production
> WORKDIR /app
> 
> # Install only production dependencies
> COPY package*.json ./
> RUN npm ci --omit=dev && npm cache clean --force
> 
> # Copy compiled output from the build stage
> COPY --from=build /app/dist ./dist
> 
> # (Optional) copy other runtime assets if needed
> # COPY --from=build /app/public ./public
> 
> # Drop permissions to a non‑root user for security
> USER node
> 
> EXPOSE 3000
> CMD ["node", "dist/index.js"]
> ```
> 
> ## How it works
> 
> 1. **Build stage**  
>    - Uses a full Node image (`node:20-alpine`) with npm and TypeScript tooling.  
>    - Installs **all** dependencies (`devDependencies` included) via `npm ci`.  
>    - Copies the entire source and runs `npm run build`, emitting compiled JavaScript into `dist/`.
> 
> 2. **Production stage**  
>    - Starts fresh with a clean Alpine‑based Node image.  
>    - Installs **only production dependencies** with `npm ci --omit=dev` — this keeps the image lean while still having runtime‑required packages.  
>    - Copies only the compiled `dist/` folder from the builder, leaving out source maps, TypeScript sources, and dev tooling.  
>    - Runs as the unprivileged `node` user for better security.
> 
> ## Key optimizations
> 
> - **Multi‑stage builds** prevent build‑time dependencies (TypeScript, `@types/*`, compilers) from entering the final image.
> - **Alpine Linux** base reduces base image size dramatically.
> - **`npm ci`** ensures reproducible, clean dependency installs.
> - **`--omit=dev`** in the runtime stage avoids copying the entire `node_modules` with unnecessary packages.
> - **`npm cache clean --force`** removes npm’s cache from the layer, saving additional space.
> - **Layer caching** is efficient because `package*.json` is copied before the full source, so dependency layers are reused when only app code changes.
> 
> ## Extra tip: `.dockerignore`
> 
> Place a `.dockerignore` in the project root to exclude local `node_modules`, `.git`, and other unnecessary files from the build context:
> 
> ```dockerignore
> node_modules
> dist
> .git
> npm-debug.log
> ```
> 
> This prevents accidental copying of the host’s `node_modules` and speeds up the build.

</details>

<details>
<summary><b>After</b> — skimmable output (5667 tokens)</summary>

> ### Multi-stage Dockerfile — build TypeScript in one stage, copy only production artifacts into the final image.
> 
> ```dockerfile
> # ---------- Stage 1: build ----------
> FROM node:24-alpine AS build
> WORKDIR /app
> 
> # Install all deps (incl. dev) — lockfile required for npm ci
> COPY package.json package-lock.json ./
> RUN npm ci
> 
> # Copy source and compile
> COPY tsconfig.json ./
> COPY src ./src
> RUN npm run build
> 
> # Drop devDependencies (typescript, etc.) — only prod deps reach the final image
> RUN npm prune --omit=dev
> 
> # ---------- Stage 2: runtime ----------
> FROM node:24-alpine AS runtime
> 
> ENV NODE_ENV=production
> WORKDIR /app
> 
> # Copy only what is needed to run
> COPY --from=build /app/package.json ./
> COPY --from=build /app/node_modules ./node_modules
> COPY --from=build /app/dist ./dist
> 
> # Run as non-root (the node image ships a `node` user)
> USER node
> 
> EXPOSE 3000
> CMD ["node", "dist/index.js"]
> ```
> 
> ## Why this minimizes size
> 
> | Decision | Effect |
> |---|---|
> | `node:24-alpine` | ~50 MB base vs ~200 MB for Debian-based images |
> | `npm prune --omit=dev` | TypeScript/tsc/eslint never enter the final image |
> | Only `dist/` copied | Source code and build toolchain are discarded with Stage 1 |
> | `cdist/` copied, no `src/` | No `.ts` source in runtime image |
> | `NODE_ENV=production` | Skips dev-only behavior; some deps ship smaller prod bundles |
> 
> ## Requirements
> 
> - **`package-lock.json` committed** — `npm ci` fails without it (if your project lacks one, use `npm install` and commit the lockfile).
> - **`tsconfig.json` outputs to `dist/`** — via `"outDir": "dist"`, with the entry compiled to `dist/index.js`. Adjust the `CMD` to your real entry point.
> - **Files live in `src/`** — adjust the `COPY` if your layout differs.
> - If the app writes files at runtime (logs, uploads), add `--chown=node:node` to the `COPY` lines, otherwise the read-only `USER node` setup is fine.
> 
> ## .dockerignore
> 
> Keep the build context (and cache) clean:
> 
> ```dockerignore
> node_modules
> dist
> .git
> .gitignore
> *.log
> .env
> Dockerfile
> .dockerignore
> ```
> 
> ## Build & run
> 
> ```bash
> docker build -t my-app .
> docker run -p 3000:3000 my-app
> ```
> 
> ## Optional refinements
> 
> - **Dedicated deps stage** — better layer caching if you prefer never installing dev deps in the prod path (needs 2× `npm ci`, but the prod install only re-runs when `package.json`/lockfile change):
> 
>   ```dockerfile
>   FROM node:24-alpine AS deps
>   RUN npm ci --omit=dev
>   ```
> 
>   Then `COPY --from=deps /app/node_modules ./node_modules` instead of the prune step.
> - **Faster rebuilds** — with BuildKit: `RUN --mount=type=cache,target=/root/.npm npm ci` caches the npm cache outside image layers.
> - **Distroless runtime** — the smallest option, no shell, no npm in the image:
> 
>   ```dockerfile
>   FROM gcr.io/distroless/nodejs22-debian12:nonroot
>   WORKDIR /app
>   COPY --from=build /app/node_modules ./node_modules
>   COPY --from=build /app/dist ./dist
>   CMD ["dist/index.js"]
>   ```
> 
>   Tradeoff: no shell makes debugging harder.
> - **pnpm** — `pnpm install --frozen-lockfile` + `pnpm prune --prod` produce a smaller `node_modules` (hard-linked store), but add a toolchain that must also be installed in the build stage.

</details>
