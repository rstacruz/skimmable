> We have a monolithic Django app that's getting slow. The team is debating microservices. What are the key factors to consider before splitting up the monolith?

---

**Don't split yet — check if you actually have a decomposition problem or just a scaling problem.**

Microservices trade one class of problems (slow queries, deploy contention) for another (network calls, distributed transactions, ops overhead). Most "slow monolith" problems are fixable without a rewrite.

## Rule out cheaper fixes first

- **Profile before you split** — find *what* is slow (DB queries, N+1s, missing indexes, sync work that should be async)
- **Django-specific levers:**
  - `select_related` / `prefetch_related` for N+1s
  - Read replicas for read-heavy load
  - `django-cacheops` / Redis caching
  - Celery for anything that doesn't need to block the request
  - DB connection pooling (`pgbouncer`)
  - Horizontal scaling of the monolith itself (it's stateless if done right — just run more instances)
- **A slow monolith usually means a slow database, not too many apps in one repo.**

## If you still think you need to split, check these first

- **Team topology**
  - Microservices solve an *organizational* scaling problem (many teams stepping on each other), not a performance one
  - One team, one deploy cadence → services just add latency and ops burden for no org benefit
- **Data boundaries**
  - Can you find seams where models don't join across "services"?
  - If everything joins to everything (common in CRM/contact-type apps), you'll just be doing joins over the network — slower, not faster
- **Transactional boundaries**
  - Anything currently in one DB transaction that would now span two services needs saga/compensation logic
  - This is real engineering cost, not free
- **Operational maturity**
  - Do you have: service discovery, distributed tracing, centralized logging, retry/circuit-breaker patterns?
  - If not, you're building that infra *before* you get any benefit

## Middle ground (often the right call)

- **Modular monolith** — enforce boundaries in code (separate Django apps, no cross-app model imports, clear internal APIs) without the network hop
- **Extract only the actual hotspot** — one slow, isolable piece (e.g. a report generator, an enrichment job) as a single service; leave the rest alone
- **Async offload** — move slow work to background workers (Celery/queues) before reaching for service boundaries

---

**Bottom line:** profile first. If the bottleneck is DB/query-shaped, fix that — it's days not months. Only split along team/ownership boundaries where you have a real organizational reason, not just a performance one. Splitting for performance alone, without a data/team seam, usually makes things slower.
