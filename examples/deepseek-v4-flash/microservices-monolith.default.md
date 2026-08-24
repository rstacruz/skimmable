> We have a monolithic Django app that's getting slow. The team is debating microservices. What are the key factors to consider before splitting up the monolith?

---

Short version up front: **splitting for speed alone is usually a trap.** Distributed systems add network latency, serialization overhead, and coordination costs. If your monolith is slow, the fix is usually profiling, caching, and database work — not microservices. But there are legitimate reasons to split, and those are worth thinking through.

Here's a practical framework for the decision:

## 1. Diagnose the actual bottleneck first

Before any architecture discussion, answer: *where is the time going?*

- Slow queries or missing indexes?
- N+1 ORM queries?
- Un-cached repeated work?
- Heavy synchronous work (PDF generation, image processing, email) blocking requests?
- Poorly sized database / no connection pooling?

In my experience, 80% of "monolith is slow" problems are solved by adding `select_related`/`prefetch_related`, introducing a cache layer (Redis in front of hot endpoints), or offloading expensive work to Celery/background tasks. For a Django app specifically, if you split to microservices you now have *two fewer databases to query efficiently* (no JOINs across service boundaries) and API calls where you used to have SQL queries.

**The skill you need is profiling, not decomposing.**

## 2. Understand that microservices don't make things faster

They add:

- **Network round-trips** — every inter-service call adds latency (even 1–5ms local, 20–100ms+ realistic)
- **Serialization overhead** — pydantic/JSON conversions that ORM queries never needed
- **Distributed transaction pain** — sagas, eventual consistency, retries, idempotency
- **Operational overhead** — observability, tracing, deployments, versioning contracts

The main *performance* benefit is **independent scaling**: if one workload is CPU-heavy (report generation) and another is I/O-bound (API serving), you can scale them separately. But that only matters once you actually have that scaling pressure and a single resource is the bottleneck.

## 3. Organizational factors (Conway's Law)

This is the single strongest predictor of microservice success. Splitting works when:

- You have **multiple teams** that can each fully own a service (code, data, deploy, on-call)
- There are **clear domain boundaries** that match team ownership
- Teams can make changes **without coordinating** with each other

If it's 3–5 developers total, microservices will *triple* your operations workload for zero organizational benefit. A well-structured modular monolith gives you most of the boundary discipline at a fraction of the cost.

## 4. The database is the real problem

In a Django monolith, the DB is the shared heart. Splitting services means splitting data. Ask hard questions:

- Which tables are owned by which service? (No shared tables — that's a "distributed monolith")
- How do you handle **foreign keys across service boundaries**? Solution: store service-local IDs and make API calls, or use event-driven eventual consistency with an outbox pattern.
- What about **transactions spanning boundaries**? Django's `transaction.atomic` disappears once you split. That's a huge correctness change.
- What about **reporting/analytics** that join across domains? You'll need a read model or data warehouse.

Many teams split code but keep one shared database — that gives all the complexity of microservices with none of the independence, and it's the most common failure mode.

## 5. Operational capability

Honest audit: can your team operate N services?

- Distributed tracing (OpenTelemetry, Sentry performance, Jaeger)
- Canary deploys and rollbacks per service
- Monitoring of per-service latency/error rates (Prometheus/Grafana, Datadog)
- Contract testing between services
- Handling partial failures (timeouts, retries, circuit breakers, fallbacks)

If you don't have solid observability for *one* app, adding nine will be chaos. Slow monoliths are usually fixed faster than distributed systems at 1/10th the ops cost.

## 6. The smuggling problem and alternative paths

Teams often sneak microservices in via "extract this one service." That's actually the healthy path — but only via the **strangler pattern**:

1. Identify a true bounded context with independent business logic (e.g., billing, notifications, search)
2. Extract it behind a stable API while keeping the monolith thick
3. Iterate — and allow the decision to stop if extraction isn't delivering value

Alternatives to consider before the split:

- **Modular monolith** — Django apps with strict boundaries, internal package APIs, no cross-app model imports. Gives team ownership boundaries without ops complexity.
- **Async queues** — Celery/Dramatiq/Arq for slow, non-critical work
- **Read replicas + denormalized read models** — move reporting load off the transactional DB
- **CDN + full-page caching** — Redis or Varnish for public pages
- **DB-level fixes** — a lot can be done with indexes, partitioning, or a managed Postgres with proper tuning

## 7. When microservices are genuinely the right call

- You have a real scaling pressure that requires independent horizontal scaling (different services, different resource profiles)
- You need **independent deploy cadence** (deploying payment changes shouldn't redeploy the whole app)
- Team size and structure genuinely map to domain boundaries (multiple teams, 5+ engineers each)
- The domain really is composed of separable subsystems with low coupling (e.g., auth, payments, notifications — not "everything touches users")
- You need tech diversity for a specific reason (a service written in Go for high-throughput stream processing — rare and usually unjustified)

---

**My recommendation for your situation:** before debating architecture, spend a week profiling. Identify the top 10 slowest endpoints and what's making them slow. Fix the DB queries, add caching, parallelize or offload heavy work. Measure again. If you still have a fundamental scaling or organizational problem *after* that, consider extracting exactly one low-coupling service as a pilot — with the explicit rule that the pilot must demonstrably beat the monolith on team velocity, not just raw speed.

The monolith isn't your enemy. Unmanaged complexity in *any* architecture is. Microservices are a bet on your team's operational maturity — most teams lose that bet on first attempt, and the performance story is usually the weakest justification of all.
