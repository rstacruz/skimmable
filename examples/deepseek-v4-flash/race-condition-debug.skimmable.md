### Root cause

You almost certainly have a **read-modify-write race** in your handler:

```js
// ❌ racy: two concurrent requests can both read 5, both write 6
const { rows } = await pool.query('SELECT count FROM counters WHERE id = $1', [id]);
const next = rows[0].count + 1;
await pool.query('UPDATE counters SET count = $1 WHERE id = $2', [next, id]);
return next;
```

Both requests read `5` → both return `6` → one increment is lost.

### Fix 1: single atomic statement (recommended)

Do the increment inside PostgreSQL as one statement — the database serializes it for you:

```js
// ✅ atomic: no way for two requests to read the same value
const { rows } = await pool.query(
  'UPDATE counters SET count = count + 1 WHERE id = $1 RETURNING count',
  [id]
);
return rows[0].count;
```

This is the simplest fix and the one you should use for a plain counter.

### Fix 2: row lock (only if you need extra steps between read and write)

If you must read the value and do more logic (validation, side effects) before updating, lock the row inside a transaction:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT count FROM counters WHERE id = $1 FOR UPDATE',
    [id]
  );
  const next = rows[0].count + 1;
  // ... other logic here ...
  await client.query('UPDATE counters SET count = $1 WHERE id = $2', [next, id]);
  await client.query('COMMIT');
  return next;
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release(); // always return the client to the pool
}
```

### Options compared

- **Atomic UPDATE ... RETURNING** — best for pure counters; simple, no transaction needed
- **`SELECT ... FOR UPDATE`** — needed only when you do extra logic between read and write
- **Optimistic lock (`WHERE count = $old`)** — works but you must detect 0 rows affected and retry; more code, only useful for cross-service cases
- **`nextval()` on a sequence** — gives unique values but with gaps, and doesn't preserve the "current value" semantics; not a fix for "increment the counter"

### Verification

Fire two concurrent requests at the endpoint — you should now get two distinct, consecutive values every time.
