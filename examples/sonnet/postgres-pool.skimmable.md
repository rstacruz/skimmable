`pg`'s built-in `Pool` — skip building a custom pool class.

```js
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,

  max: 10,                     // max clients in pool
  idleTimeoutMillis: 30000,    // close idle clients after 30s
  connectionTimeoutMillis: 5000, // fail fast if pool is full
})

// required: unhandled errors on idle clients crash the process otherwise
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

async function query(text, params) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

module.exports = { pool, query }
```

**Graceful shutdown** — closes connections cleanly on deploy/restart:

```js
process.on('SIGTERM', async () => {
  await pool.end()
  process.exit(0)
})
```

**Self-check:**

```js
async function demo() {
  const res = await pool.query('SELECT 1 as ok')
  console.assert(res.rows[0].ok === 1, 'pool query failed')
  await pool.end()
}
```

→ skipped: retry/backoff logic, add if transient network errors show up in practice.
→ skipped: query timeout (`statement_timeout`), add via `pool.query('SET statement_timeout = 5000')` per-connection if long-running queries are a risk.
