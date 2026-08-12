**Don't split to make it faster — microservices fix autonomy and independent scaling, not slowness. In a Django app, "slow" is almost always a query, index, or blocking-I/O problem, and splitting first adds network latency, distributed-data complexity, and ops burden.**

## The core question first

**Before any architecture debate, answer: what is actually slow?**

- **N+1 ORM queries** — missing `select_related` / `prefetch_related`
- **Missing indexes** on hot FK/query columns
- **Sync views blocking** on slow third-party API calls or I/O
- **Uncached hot reads** — sessions, config, expensive computed values
- **Heavy template rendering** — no cached loader, overly large partials
- **Long transactions** — writes held inside big `transaction.atomic` blocks

Profile with an APM or `django-silk` / `py-spy` before touching the architecture. Most "the monolith got slow" complaints resolve to one of these — none of which require a split.

## Why microservices rarely fix slowness

- **Local calls become network calls** — adds latency, plus retries and timeouts
- **New failure modes** — cascading timeouts, partial failures, degraded responses
- **One query becomes N** — joins turn into cross-service aggregation
- **Distributed-systems tax** — sagas, eventual consistency, idempotency, tracing

## When splitting is actually justified

- **Independent deploy cadence** — one team ships many times a day without coordinating
- **Independent scaling** — one component needs dramatically more resources than the rest
- **Team autonomy (Conway's law)** — service boundaries should match team boundaries
- **Isolation requirements** — security or compliance separation for one component
- **Runtime constraints** — something Django can't do well

**If none of these apply, the answer is a modular monolith + performance levers, not microservices.**

## Cheaper levers inside the monolith first

- **Cache hot reads** — Redis for sessions, config, expensive queries
- **Background jobs** — Celery / Dramatiq for anything not needed synchronously
- **Fix the queries** — indexes, `select_related`, keyset pagination
- **Offload blocking work** — async views (ASGI), or external services for email/PDFs
- **Scale horizontally** — more app instances; Django is stateless once sessions move to Redis
- **Read replicas** — for reporting-heavy paths

## If you still split: the key factors

- **Data ownership — the hardest part**
  - Which service owns which table?
  - Foreign keys across services break — replace with events or API calls
  - Reporting joins become data-warehouse or "view" queries
- **Operational maturity**
  - Per-service CI/CD, secrets, logging, metrics, on-call
  - Distributed tracing (OpenTelemetry) before you need it, not after
- **Team size**
  - Under ~10 devs, ops overhead usually outweighs autonomy gains
  - Unclear bounded contexts → you get a distributed monolith
- **Cost** — N services = N× infra, N× pipelines, N× monitoring surfaces

## Quick comparison

| Axis | Monolith | Microservices |
|---|---|---|
| Dev speed (small team) | High | Low |
| Independent deploy | No | Yes |
| Independent scale | No | Yes |
| Data consistency | ACID, easy | Eventual, hard |
| Ops cost | Low | High |
| Debugging | One stack | Distributed traces |

## Recommended sequence

1. **Profile and fix the bottleneck** in the monolith
2. **Enforce module boundaries** — Django apps with private interfaces (modular monolith)
3. **Extract one service only** when a bounded context is clear and a trigger above applies
4. **Strangler fig pattern** — extract incrementally, monolith stays the fallback

A good heuristic: if the team can't name a bounded context, they can't name a service.
