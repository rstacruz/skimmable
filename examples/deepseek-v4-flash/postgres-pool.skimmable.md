### Short answer

**Use `pg`'s `Pool` with explicit timeouts (`connectionTimeoutMillis`, `query_timeout`, `statement_timeout`), a mandatory `pool.on('error')` listener for idle clients, and retry-with-backoff for transient Postgres error codes.**

## Pool setup

```js
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,

  max: 10,                    // max simultaneous clients
  connectionTimeoutMillis: 5000,  // fail fast if DB is unreachable
  idleTimeoutMillis: 30000,       // close idle clients after 30s
  query_timeout: 10000,           // cancel query after 10s (client-side)
  statement_timeout: 15000,       // server-side statement limit (ms)
})

// REQUIRED: idle clients can error (DB restart, network drop) — listen always
pool.on('error', (err) => {
  console.error('idle client error:', err)
})
```

## Timeout options

| Option | Default | Meaning |
| --- | --- | --- |
| `connectionTimeoutMillis` | `0` (forever) | Wait for a connection from the pool before rejecting |
| `idleTimeoutMillis` | `10000` | Client can sit idle before being closed |
| `query_timeout` | none | Client-side cancel of a slow query (ms) |
| `statement_timeout` | none | Server-side `SET statement_timeout` (ms) |
| `max` | `10` | Pool size — 10 is a sane start; tune under load |

## Error handling

**Postgres error codes** — branch on `err.code`, not `err.message`:

- `ECONNREFUSED`, `08006` — connection failed (transient, retry)
- `57P01` — server shutting down (transient, retry)
- `57P03` — "cannot connect now" (transient, retry)
- `40001`, `40P01` — serialization failure / deadlock (transient, retry)
- `57014` — query canceled (your `query_timeout` hit — don't retry blindly)
- `23505` — unique violation (config error, don't retry)
- `28P01` — auth failure (config error, don't retry)

**Retry with exponential backoff:**

```js
const RETRIABLE = ['ECONNREFUSED', '08006', '57P01', '57P03', '40001', '40P01']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function queryWithRetry(text, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(text, params)
    } catch (err) {
      if (!RETRIABLE.includes(err.code) || attempt === retries) throw err
      await sleep(100 * 2 ** (attempt - 1)) // 100ms, 200ms, 400ms
    }
  }
}
```

## Transactions — release discipline

**With transactions you must use `pool.connect()` and release in `finally`** — a leaked client permanently shrinks the pool:

```js
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('INSERT INTO users (name) VALUES ($1)', ['ada'])
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
}
```

## Pitfalls

- **`connectionTimeoutMillis: 0` is the default** — a dead DB will hang your requests forever. Set it.
- **The pool does not retry failed queries** — you must implement retry yourself (above).
- **Create the pool once at module load**, never inside a request handler.
- **Graceful shutdown** — call `await pool.end()` on `SIGTERM` so in-flight queries finish.
- **For one-off scripts/migrations**, use a single `Client` instead of a pool — no pooling need, no pool `error` listener.
