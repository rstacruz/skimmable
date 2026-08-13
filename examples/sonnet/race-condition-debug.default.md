This is a classic read-modify-write race condition. Let me show you the problem and the fixes.

## The Problem

You're probably doing something like this:

```js
// ❌ RACE CONDITION
const { rows } = await db.query('SELECT value FROM counters WHERE id = $1', [id]);
const newValue = rows[0].value + 1;
await db.query('UPDATE counters SET value = $1 WHERE id = $2', [newValue, id]);
return newValue;
```

Two concurrent requests both read `5`, both compute `6`, both write `6`. You lost an increment.

## Fix 1: Atomic UPDATE (best, simplest)

Let PostgreSQL do the math atomically and return the result:

```js
// ✅ Single atomic statement
const { rows } = await db.query(
  'UPDATE counters SET value = value + 1 WHERE id = $1 RETURNING value',
  [id]
);
return rows[0].value;
```

A single `UPDATE` takes a row lock, so concurrent increments serialize correctly. `RETURNING` gives you the new value in the same round trip. **This is what you want in almost all cases.**

## Fix 2: Row lock with SELECT ... FOR UPDATE

Only needed if you must read, run app logic, then write inside a transaction:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT value FROM counters WHERE id = $1 FOR UPDATE',
    [id]
  );
  const newValue = rows[0].value + 1;
  // ... any app-side logic ...
  await client.query('UPDATE counters SET value = $1 WHERE id = $2', [newValue, id]);
  await client.query('COMMIT');
  return newValue;
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

`FOR UPDATE` locks the row so other transactions block until you commit.

## Key gotchas to check

- **Connection pooling**: Fix 2 only works if every query in the transaction runs on the *same* client (`pool.connect()`), not `pool.query()` which grabs a random connection each time.
- **Don't compute in JS** unless you have a reason to — Fix 1 avoids the whole problem.
- **UPSERT** if the row might not exist yet:

```js
await db.query(`
  INSERT INTO counters (id, value) VALUES ($1, 1)
  ON CONFLICT (id) DO UPDATE SET value = counters.value + 1
  RETURNING value
`, [id]);
```

Go with **Fix 1** unless you specifically need to run logic between the read and write. Want to share your current code so I can point out exactly what to change?
