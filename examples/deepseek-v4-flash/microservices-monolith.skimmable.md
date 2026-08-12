### Framing

Slow monoliths rarely need to become microservices. Most production slowness is fixable inside the monolith, and splitting adds latency rather than removing it. Diagnose before you decide.

## Step 0 — Find the real bottleneck first

- **Profile the actual slow path** — measure request traces, slow queries, and N+1s before anything else
  - `django-debug-toolbar`, `django-silk`, or APM traces
  - Most "monolith is slow" == a handful of bad queries or missing cache
- **Check the obvious suspects**
  - Missing indexes, N+1 queries, serializing huge querysets, blocking calls in the request path (email, SMS, external HTTP)
  - `select_related` / `prefetch_related` gaps
  - Gunicorn/async worker counts and settings
- **Check whether it's operations, not code**
  - Unproxied static files, misconfigured DB pool, no read replicas, sync settings hitting the DB per request

## The hard truth about microservices and performance

- **Microservices don't make things faster — they scale independently**
  - You gain: scale only the hot service, isolate heavy compute, one team's deploy doesn't stall another
  - You lose: one network hop + serialization per call, distributed tracing, no cross-service `transaction.atomic()`
- **Same-level performance problems follow you**
  - A slow query stays slow. Now it's just behind an HTTP boundary
- **Latency arithmetic**
  - Monolith: one process, one DB pool, no hops
  - Services: request → service A → service B → DB → back — each hop adds 1–5ms plus serialization, retries, and timeout math

## Factors to weigh before splitting

- **Team size and shape** — Conway's law in practice
  - Each service needs an owning team. Fewer than ~10–12 engineers usually can't absorb the operational burden
  - If 3 people own the whole system, a monolith serves them better
- **Data coupling** — the real work is the database, not the code
  - Shared DB is the biggest tie. Split means every service owns its data, and `JOIN`s become API calls or duplicated data
  - Cross-service transactions require sagas + eventual consistency — do your finance/reporting paths tolerate that?
- **Operational maturity**
  - Distributed systems need: centralized logging, tracing, APM, CI/CD, staged deploys, on-call runbooks
  - If you debug `print()` today, multiplying services multiplies debugging effort
- **Deployment and release cadence**
  - Splitting only pays off if teams are genuinely blocked by each other's release schedule
  - One deploy pipeline, one cadence → less reason to split
- **Scale requirements**
  - Does one component need 50x the compute of the rest, or a totally different runtime (async workers, ML, WebSockets)? That's the strongest case for extraction
  - Uniform load scales fine with replicas of the monolith
- **Security and compliance**
  - Separate services = separate attack surfaces, service-to-service auth, more secrets, more blast-radius questions
  - Sometimes useful (PCI boundary), often just overhead
- **Cost**
  - More infrastructure, more pipelines, more meetings at API boundaries, more failure modes (partial failures, retries, timeouts)

## Cheaper alternatives to try first

- **Modular monolith** — most of the payoff, none of the ops burden
  - Structure the Django project into strict, decoupled Django apps with a shared kernel and explicit interfaces
  - Enforce "no imports across app boundaries" with linting/CI
  - This preserves `transaction.atomic()`, shared tests, one deploy
- **Move work off the request path**
  - Celery/RQ for emails, reports, exports, webhooks
- **Scale horizontally and vertically first**
  - Multiple workers, read replicas, Redis caching, CDN — a fraction of the cost of a split
- **Measure the ceiling** — a well-tuned monolith with one DB handles a very large load before you genuinely need more

## If you do split — do it with a strangler

- **Extract one bounded context at a time**, only where a seam exists and ownership justifies it
  - Good first candidates: background jobs, reports/exports, auth, or a domain with zero shared tables
  - Bad first candidates: anything that `JOIN`s heavily against core user/order data
- **Decouple the service, then the data**
  - Service reads the shared DB first; move ownership of tables only after the API boundary is stable
- **Keep the monolith as the host** — grow services out of it, don't rewrite in one go

## Decision rule

| Situation | Likely answer |
| --- | --- |
| Slow queries / N+1s, one small team | Fix queries, add cache and replicas |
| One team blocked by another's deploys daily | Consider modular monolith first, extract at the seam |
| A component needs 10–50x scale or a different runtime | Extract that one service |
| Payments/PCI isolation required | Extract that boundary |
| No tracing/CI maturity yet | Fix that first, don't split |

### Bottom line

Split for **team boundaries, independent scaling, or isolation** — never for raw speed. Profile first; you'll usually find the slowness is a handful of queries that a service boundary won't fix and will often make worse.
