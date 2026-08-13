**Use an atomic `UPDATE ... RETURNING`, not a read-then-write.**

- Root cause: your code likely does `SELECT count` → increment in JS → `UPDATE`. Two requests read the same value before either writes.

```sql
UPDATE counters
SET value = value + 1
WHERE id = $1
RETURNING value;
```

```js
const { rows } = await pool.query(
  'UPDATE counters SET value = value + 1 WHERE id = $1 RETURNING value',
  [id]
);
const newValue = rows[0].value;
```

- Postgres serializes row-level writes, so this is race-free with zero extra locking code.
- No transaction, `SELECT ... FOR UPDATE`, or app-level lock needed — the single statement does read+write atomically.

→ skipped: advisory locks / transactions, add only if you need to update counter + other rows together atomically.
