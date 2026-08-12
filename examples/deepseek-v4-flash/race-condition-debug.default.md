This is the classic **read-then-write race condition**. Your endpoint probably does something like this:

```js
app.post('/increment', async (req, res) => {
  const { rows } = await pool.query('SELECT counter FROM counters WHERE id = 1');
  const newValue = rows[0].counter + 1;
  await pool.query('UPDATE counters SET counter = $1 WHERE id = 1', [newValue]);
  res.json({ value: newValue });
});
```

With two concurrent requests, both `SELECT`s can read the same value (say `10`) before either `UPDATE` runs. Both compute `11`, both write `11`, and both return `11`. The counter ends at `11` instead of `12`.

## The fix: make the increment atomic

Do the read and write in a single statement using `UPDATE ... RETURNING`:

```js
app.post('/increment', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE counters SET counter = counter + 1 WHERE id = 1 RETURNING counter'
  );
  res.json({ value: rows[0].counter });
});
```

**Why this works:** `counter = counter + 1` is evaluated by PostgreSQL while the row is locked by the update. Concurrent requests are serialized at the row level — the second update sees the value written by the first — so each request gets a distinct, correct value.

## Alternative: use a transaction with a row lock

If your endpoint does more than just increment (e.g., reads other fields or writes to multiple tables), wrap it in a transaction and lock the row first:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT counter FROM counters WHERE id = 1 FOR UPDATE'
  );
  const newValue = rows[0].counter + 1;
  await client.query('UPDATE counters SET counter = $1 WHERE id = 1', [newValue]);
  await client.query('COMMIT');
  res.json({ value: newValue });
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

`SELECT ... FOR UPDATE` blocks the second transaction until the first commits, so the second one reads the updated value.

## What won't fix it (or only seems like it would)

- **`SERIALIZABLE` isolation alone** — PostgreSQL resolves serialization conflicts by aborting one transaction, but *you* have to retry it, and the initial read still needs the write to be properly ordered. It's not the right tool for a simple counter.
- **`SELECT ... FOR SHARE`** — allows concurrent reads, doesn't serialize writers properly for this pattern.
- **Client-side "optimistic" counters / in-memory increments** — only work if you deploy a single Node.js process, which defeats horizontal scaling.

## A note on ordering

The atomic `UPDATE` guarantees **distinct** values, but not the order in which requests were received — that's inherently nondeterministic under concurrency. If you need strict FIFO ordering, that's a different problem (and usually means you need a queue, not a database counter).

For the common case of "give each request the next number," `UPDATE ... RETURNING` is the clean, idiomatic fix.
