# PostgreSQL Connection Pooling in Node.js

The standard library is [`pg`](https://node-postgres.com/) (`pg.Pool`). Here's a production-grade setup covering timeouts, error handling, and graceful shutdown.

## 1. Basic Pool with Timeouts

```js
const { Pool } = require('pg');

const pool = new Pool({
  // Connection details
  host: process.env.PGHOST,
  port: 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,

  // Pool sizing
  max: 10,                       // max clients in pool (default: 10)
  min: 2,                        // min clients kept alive (default: 0)
  idleTimeoutMillis: 30_000,     // close idle client after 30s (default: 10s)
  connectionTimeoutMillis: 5_000, // max wait for a connection before error (default: 0 = no timeout — set this!)

  // Client-level timeouts
  query_timeout: 10_000,         // kill query on client side after 10s (default: no timeout)
  statement_timeout: 10_000,     // server-side: abort query on DB after 10s (default: no timeout)
  idle_in_transaction_session_timeout: 60_000, // server-side: abort tx if idle > 60s

  // TCP keepalive
  keepAlive: true,
  keepAliveInitialDelayMillis: 1_000,

  // SSL (required on many managed DBs)
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
```

### Timeout options explained

| Option | Where it acts | What it does |
|---|---|---|
| `connectionTimeoutMillis` | Client (pool) | Fails if no connection can be acquired within N ms (e.g., pool exhausted or DB down). **Always set this** — default 0 means wait forever. |
| `query_timeout` | Client | Client aborts a query that runs > N ms. |
| `statement_timeout` | Server | Postgres itself cancels the query after N ms — protects you from runaway queries consuming DB resources. |
| `idle_in_transaction_session_timeout` | Server | Postgres aborts a transaction left idle too long, freeing locks. |
| `idleTimeoutMillis` | Pool | Removes an unused client from the pool after N ms to free connections. |
| `keepAlive` / `keepAliveInitialDelayMillis` | TCP | Detects dead connections (e.g., after a network drop) sooner. |

## 2. Error Handling

### a) Pool-level errors

Idle clients can emit errors (e.g., the database restarts). If unhandled, **they will crash your process**:

```js
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
  // Optionally notify monitoring (Sentry, Datadog, etc.)
});
```

### b) Per-query error handling

```js
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    // Categorize the error
    switch (err.code) {
      case '23505': // unique_violation
        console.warn('Duplicate entry', err.detail);
        throw new DuplicateError(err);
      case '53300': // too_many_connections
      case '57P01': // admin_shutdown (DB restarting)
        // transient — worth retrying with backoff
        return retry(text, params);
      case '57014': // query_canceled (statement_timeout fired)
        console.error('Query timeout:', text);
        break;
      default:
        console.error('DB error:', err.message, { text, params });
        throw err;
    }
    throw err;
  }
}
```

> Note: Postgres error codes are documented in the [PostgreSQL appendix](https://www.postgresql.org/docs/current/errcodes-appendix.html). Common ones: `23505` (unique violation), `23503` (foreign key violation), `40001` (serialization failure — retry), `57014` (query canceled).

### c) Always release the client (transactions)

`pool.query()` handles acquisition/release automatically, but if you use `pool.connect()` for transactions, you **must** release in `finally`:

```js
async function doTransaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - 100 WHERE id = $1', [1]);
    await client.query('UPDATE accounts SET balance = balance + 100 WHERE id = $2', [2]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {}); // ROLLBACK itself can fail
    throw err;
  } finally {
    client.release(); // ALWAYS release — else pool leaks and eventually exhausts
  }
}
```

If `client.release()` is called after a failed transaction, the pool automatically destroys that client (Postgres requires a clean session state), so you don't need to handle that manually.

### d) Request-time cancellation with AbortSignal

`pg` supports `AbortSignal` — useful to pair with HTTP request timeouts (e.g., an Express middleware timeout):

```js
app.get('/search', async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000); // HTTP-level timeout

  try {
    const result = await pool.query({ text: 'SELECT ...', signal: controller.signal });
    res.json(result.rows);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'timed out' });
    }
    res.status(500).json({ error: 'internal error' });
  } finally {
    clearTimeout(timer);
  }
});
```

## 3. Retry with Backoff (transient errors)

```js
async function withRetry(fn, { retries = 3, baseDelay = 100 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = [
        'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',   // network
        '57P01', '57P02', '53300',                   // admin_shutdown, crash_shutdown, too_many_connections
        '40001',                                     // serialization_failure
      ].includes(err.code) || err.code === '57P01';

      if (!isTransient || attempt === retries) throw err;
      await delay(baseDelay * 2 ** attempt); // exponential backoff
    }
  }
}
```

## 4. Graceful Shutdown

```js
async function shutdown(signal) {
  console.log(`${signal} received, closing pool...`);
  // query_timeout / connectionTimeoutMillis set to small values so this doesn't hang
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

## 5. Alternative: postgres.js

If you don't need SQL-string compatibility with `pg`, consider [`postgres` (postgres.js)](https://github.com/porsager/postgres) — it's faster (~2x), supports tagged-template queries, and has built-in timeout/retry handling:

```js
import postgres from 'postgres';

const sql = postgres({
  host, port, database, username, password,
  max: 10,
  idle_timeout: 30,      // seconds
  connect_timeout: 5,    // seconds
  statement_timeout: 10, // seconds
  onnotice: () => {},
  onerror: (err) => console.error('DB error', err),
});

// Queries automatically retry (default 2 attempts)
// Timeouts throw PostgresError subclassed errors

await sql`SELECT * FROM users WHERE id = ${id}`;
await sql.end({ timeout: 5 }); // graceful shutdown
```

## Key takeaways

1. **Always set `connectionTimeoutMillis`** — the default of 0 means your app hangs forever when the pool is exhausted.
2. **Set `statement_timeout` server-side** to protect the database, and `query_timeout` client-side to protect the app.
3. **Always attach `pool.on('error')`** — unhandled errors from idle clients crash the process.
4. **Release clients in `finally`** when using `pool.connect()`.
5. **Pair pool timeouts with request-level cancellation** (`AbortSignal`) so users get a 504 rather than a hung request.
