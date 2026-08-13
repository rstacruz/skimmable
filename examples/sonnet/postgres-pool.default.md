Here's how to set up a robust PostgreSQL connection pool in Node.js using the `pg` library:

## Installation

```bash
npm install pg
```

## Basic Pool Setup

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,

  // Pool sizing
  max: 20,                       // max clients in the pool
  min: 2,                        // keep a few warm connections

  // Timeouts
  connectionTimeoutMillis: 5000, // wait max 5s for a connection from the pool
  idleTimeoutMillis: 30000,      // close idle clients after 30s
  maxUses: 7500,                 // recycle a connection after N uses (avoids leaks)

  // Query/statement timeouts (server-side)
  statement_timeout: 10000,      // abort any statement running > 10s
  query_timeout: 10000,          // client-side query timeout
  idle_in_transaction_session_timeout: 10000, // kill idle-in-transaction

  // TLS (recommended for managed/cloud databases)
  ssl: process.env.PGSSL === 'true'
    ? { rejectUnauthorized: true }
    : false,
});
```

## Error Handling

The pool emits errors on **idle** clients (e.g., a backend crashing or network drop). If you don't handle this event, it can crash your process:

```javascript
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  // Log/alert here. The pool will remove the bad client automatically.
});

pool.on('connect', (client) => {
  // Optional: set session config per connection
  // client.query('SET search_path TO my_schema');
});
```

## Safe Query Helper

For simple queries, use `pool.query()` — it checks out and releases a client automatically:

```javascript
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('query error', { text, error: err.message });
    throw err;
  }
}
```

## Transactions (Manual Client Checkout)

When you need a transaction, check out a client and **always release it** in a `finally` block:

```javascript
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // critical — returns the client to the pool
  }
}

// Usage
await withTransaction(async (client) => {
  await client.query('INSERT INTO accounts(id, balance) VALUES($1, $2)', [1, 100]);
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [50, 1]);
});
```

## Graceful Shutdown

Drain the pool cleanly on shutdown so in-flight queries finish:

```javascript
async function shutdown() {
  console.log('Closing PostgreSQL pool...');
  await pool.end(); // waits for active clients to finish, closes idle ones
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Key Recommendations

- **Size `max` carefully** — total connections across all app instances must stay under Postgres's `max_connections`. Use a formula like `max = (db_max_connections - reserved) / num_app_instances`.
- **Always set server-side timeouts** (`statement_timeout`, `idle_in_transaction_session_timeout`) to prevent runaway queries from holding connections.
- **Never forget `client.release()`** — leaked clients exhaust the pool and cause `connectionTimeoutMillis` errors.
- **For serverless** (Lambda, etc.), a traditional pool is risky; consider a proxy like **PgBouncer**, RDS Proxy, or a serverless driver (e.g., `@neondatabase/serverless`).

Want me to adapt this to TypeScript, a specific framework (Express/Fastify/NestJS), or a cloud provider (RDS, Supabase, Neon)?
