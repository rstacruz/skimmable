> My Node.js API endpoint that increments a counter in PostgreSQL sometimes returns the same value for concurrent requests. How do I fix this race condition?

---

The root cause is almost certainly a read-modify-write cycle in your application code:

```js
// ❌ BAD: not atomic
const { rows } = await client.query('SELECT value FROM counters WHERE id = $1', [id]);
const next = rows[0].value + 1;
await client.query('UPDATE counters SET value = $1 WHERE id = $2', [next, id]);
return next;
```

When two requests run concurrently, **both** read `5`, both compute `6`, and both return `6`.

## The fix: do the increment in a single atomic SQL statement

PostgreSQL's `UPDATE` is atomic per row — let the database do the math:

```js
const { rows } = await client.query(
  'UPDATE counters SET value = value + 1 WHERE id = $1 RETURNING value',
  [id]
);
return rows[0].value;
```

The `value = value + 1` happens while the row is locked, so concurrent requests **serialize**: the first gets `6`, the second gets `7`. No read, no compute, no race.

## If you're using an ORM

- **Sequelize**: `Counter.increment('value', { where: { id } })` (then re-fetch if you need the new value).
- **TypeORM**: `counter.value = () => 'value + 1'` in an update, or `QueryBuilder.increment()`.
- **Knex**: `.increment('value', 1)`.
- **Prisma**: `update({ data: { value: { increment: 1 } } })`.

## When would you need something heavier?

- **`SELECT ... FOR UPDATE`** — only necessary if the increment depends on reading *other* columns first (e.g., conditional logic based on the current value). Wrap it in a transaction:

  ```sql
  BEGIN;
  SELECT value FROM counters WHERE id = $1 FOR UPDATE;
  -- ... application logic ...
  UPDATE counters SET value = value + 1 WHERE id = $1;
  COMMIT;
  ```

- **Postgres sequences** (`nextval()`) — a good fit if you only need unique monotonic numbers and don't care about gaps. They're famously fast but not tied to a row and leave holes on rollback.

- **Serializable isolation** — possible but overkill here; it forces retry logic for `40001` serialization failures.

## One caveat about `RETURNING`

If a request with the same `id` touches the counter in a transaction that *rolls back*, the sequence of returned values will have gaps. If you need gap-free, sequential numbers with no skips, you'd need a different mechanism (e.g., a lock on the row for the entire transaction) — but for the vast majority of counters (view counts, request counters, etc.), gaps are perfectly acceptable.

**Bottom line:** push the increment into the database with `UPDATE ... SET value = value + 1 ... RETURNING value`. It's one round-trip, no transaction management, and it's race-free by construction.
