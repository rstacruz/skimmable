# PostgreSQL Connection Pooling in Node.js — Best Practices

Here’s a production-grade setup using the [`pg`](https://node-postgres.com/) library, with timeouts, error handling, retries, and graceful shutdown.

## 1. The Pool Configuration

```js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'mydb',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,

  // ── Pool sizing ──────────────────────────────
  max: 10,                // max clients in the pool
  min: 2,                 // keep at least 2 clients alive
  idleTimeoutMillis: 30_000,   // close idle clients after 30s
  maxUses: 7500,          // recycle a client after 7500 queries (avoids memory leaks)

  // ── Timeouts ────────────────────────────────
  connectionTimeoutMillis: 5_000,    // how long to wait for a NEW client from the DB
  query_timeout: 10_000,             // max time for a query to execute (node-pg-mem / pg >= 8.7)
  statement_timeout: 10_000,         // server-side: kill query on Postgres after 10s
  idle_in_transaction_session_timeout: 30_000, // abort txns stuck in idle
  allowExitOnIdle: false,
});
```

**What each timeout does:**

| Option | Where enforced | Purpose |
|---|---|---|
| `connectionTimeoutMillis` | Client-side (pg) | Wait time to acquire a DB connection from Postgres itself (network/handshake) |
| `query_timeout` | Client-side (pg) | Kills a query at the Node level if it runs too long |
| `statement_timeout` | Server-side (Postgres) | Backstop — kills the query on the DB server even if the client dies |
| `idleTimeoutMillis` | Client-side (pg) | Removes unused clients from the pool |
| `idle_in_transaction_session_timeout` | Server-side | Prevents sessions stuck in `BEGIN; -- idle -- COMMIT` from hanging |

## 2. Pool-Level Error Handling

The pool emits an `error` event for issues with idle clients (network drops, server restarts, etc.). Without a handler, this **crashes the process**.

```js
pool.on('error', (err, client) => {
  console.error('[pg-pool] Unexpected error on idle client:', err);
  // Optional: notify monitoring (Sentry, DataDog, etc.)
  // Do NOT attempt to reconnect here — pg already handles reconnection
  // when a new client is requested.
});
```

## 3. Query Helper with Retry & Timeout

A wrapper function gives you consistent error handling and logging:

```js
const { Pool } = require('pg');

async function query(pool, text, params = {}) {
  const start = Date.now();
  const result = await pool.query(text, params);
  // Attach query logging — helpful for finding slow queries
  console.debug(`[pg] ${text.slice(0, 60)}… ${Date.now() - start}ms`);
  return result;
}
```

**Note:** `pool.query()` automatically checks out a client, runs the query, and releases it — the safest path. Only use `pool.connect()` manually if you need a transaction (and then **always** release in a `finally`).

## 4. Transactions with Guaranteed Cleanup

```js
async function withTransaction(pool, fn) {
  const client = await pool.connect();      // may throw 'timeout exceeded when trying to connect'
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});  // don't mask the original error
    throw err;
  } finally {
    client.release();  // CRITICAL — return client to the pool even on error
  }
}
```

## 5. Retry Logic (for transient failures)

Postgres errors can be transient (connection reset, server restart, too many connections). Retry *a bounded number of times* with exponential backoff:

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryWithRetry(pool, text, params = {}, { maxRetries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const isTransient =
        err.code === '57P01' ||          // admin_shutdown
        err.code === '57P02' ||          // crash_shutdown
        err.code === '57P03' ||          // cannot_connect_now
        err.code === '08P01' ||          // protocol_violation
        err.code === 'ECONNRESET' ||     // network reset
        err.code === 'ETIMEDOUT' ||      // socket timeout
        /connection.*(closed|terminated|reset)/i.test(err.message);

      if (!isTransient || attempt >= maxRetries) throw err;

      const backoffMs = Math.min(100 * 2 ** attempt + Math.random() * 50, 2000);
      console.warn(`[pg] transient error (${err.code}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(backoffMs);
    }
  }
}
```

## 6. Graceful Shutdown

When your app receives a termination signal, drain the pool properly:

```js
async function shutdown(signal) {
  console.log(`[pg] ${signal} received — draining pool`);
  try {
    await pool.end();   // waits for in-flight queries, then closes all clients
    console.log('[pg] pool drained');
    process.exit(0);
  } catch (err) {
    console.error('[pg] error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

In Kubernetes/Docker environments, add a timeout so the container doesn't hang:

```js
const SHUTDOWN_TIMEOUT = 10_000;
const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT);
timer.unref();  // don't keep the process alive just for this timer
```

## 7. Monitoring

Add a check endpoint for health checks:

```js
async function checkPoolHealth(pool) {
  const { totalCount, idleCount, waitingCount } = pool;  // pg exposes these
  return {
    total: totalCount,
    idle: idleCount,
    waiting: waitingCount,
    ok: idleCount > 0 || waitingCount === 0,
  };
}
```

## 8. Common Pitfalls to Avoid

1. **Not handling the pool `error` event** → unhandled `'error'` events crash Node.
2. **Forgetting `client.release()`** in transactions → pool exhaustion, app hangs.
3. **Setting `max` too high** → Postgres can only handle ~100–200 connections per instance; each one costs ~10 MB of RAM. Start with `max: 10` per instance and scale horizontally.
4. **Relying only on client-side `query_timeout`** — if the Node process dies, the query keeps running on the server. Always set `statement_timeout` server-side as a backstop.
5. **Not setting `connectionTimeoutMillis`** → default is 0 = wait forever, making failures appear as hangs.
6. **Using `pool.connect()` for single queries** — it's slower and leaks if you forget to release. Use `pool.query()` directly.

---

### Minimal but solid starting point

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  query_timeout: 10_000,
  statement_timeout: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => console.error('[pg-pool]', err));

module.exports = { pool, query, withTransaction };
```

If you're using TypeScript, [`postgres`](https://github.com/porsager/postgres) is a popular modern alternative with built-in type inference and similar timeout options. But for plain Node.js, `pg` with the above configuration is battle-tested and sufficient for most applications.
