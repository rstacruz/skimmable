### PostgreSQL Pool Setup (Node.js)

Use [`pg`](https://node-postgres.com) with a `Pool`. Timeouts and error handling are the two tricky parts — here's the full picture.

### Minimal setup

```ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,

  // Connection management
  max: 10,                        // max clients in pool
  min: 0,                         // idle clients to keep open
  idleTimeoutMillis: 30_000,      // close idle client after 30s
  connectionTimeoutMillis: 5_000, // fail if can't get a client in 5s
  allowExitOnIdle: true,          // let process exit when pool is idle
  maxUses: 7500,                  // recycle clients to avoid memory leaks
});

// Fatal errors (network down, auth failure, etc.) — always attach this
pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});
```

### Timeout options

| Option | Default | What it does |
|---|---|---|
| `connectionTimeoutMillis` | 0 (wait forever) | Time to wait to **acquire** a client from the pool |
| `idleTimeoutMillis` | 10000 | Client idle before returned to pool is closed |
| `maxUses` | Infinity | Connections closed after N queries (guards against stale/broken connections) |
| `statement_timeout` | — | **Server-side**: cancels a query after N ms (`SET statement_timeout`) |
| `query_timeout` | — | **Client-side**: kills the query's promise after N ms |

Key difference: `connectionTimeoutMillis` protects you from pool exhaustion — no client becomes available within the window, you get `timeout exceeded when trying to connect`. It does **not** time out the query itself.

For query timeout, either set it server-side in the pool config:

```ts
options: {
  statement_timeout: 10_000, // psql-level: aborts slow queries on the server
}
```

...or wrap individual queries:

```ts
const result = await Promise.race([
  pool.query('SELECT ...'),
  timeout(5_000),              // your own rejection helper
]);
```

### Error handling patterns

**Never leak clients** — a leaked client starves the pool until max is hit:

```ts
// Correct: always release
const client = await pool.connect();
try {
  await client.query('...');
} finally {
  client.release();
}
```

**Releasing broken connections**:

```ts
try {
  await client.query('...');
} catch (err) {
  await client.release(err); // release with error → connection is destroyed, not reused
}
```

**Classify errors** to decide retry vs fail (property is on the error, set by `pg`):

```ts
// err.code — PostgreSQL error codes ('ECONNREFUSED', '57P01', etc.)
if (isTransient(err)) {
  await sleep(backoff);
  retry();
}
```

Common transient codes worth retrying: `57P01` (admin shutdown), `57P03` (cannot connect now), `08006` (connection failure), `53300` (too many connections).

### Health check / heartbeat

```ts
async function checkPool(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

### Graceful shutdown

```ts
async function shutdown() {
  await pool.end(); // closes all idle clients, waits for in-flight queries
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Gotchas

- **Never put a query outside a try/finally with `pool.connect()`** — the pool will silently exhaust.
- **`pool.query()`** is the shortcut: acquires, runs, and releases internally — prefer it over `pool.connect()` unless you need a transaction.
- **Transactions** require a single client — use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` in a `finally`.
- **Env-based config**: don't hardcode credentials; `pg` reads `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` automatically if you pass no connection fields.
- If you need a lightweight alternative with auto-retry and circuit breaking, look at [`pg-pool`](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool) (it's the same underlying pool) or `postgres` (porsager) which has built-in timeouts.
