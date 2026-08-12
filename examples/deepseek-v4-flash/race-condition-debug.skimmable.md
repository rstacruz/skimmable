**The fix: replace the read-then-write with a single atomic `UPDATE`, and use `RETURNING` to get the new value.**

Your current code probably looks like this — two concurrent requests can both read `5`, both compute `6`, and one increment is lost:

```js
// ❌ Both requests can run the SELECT before either runs the UPDATE
const { count } = await db.query('SELECT count FROM counters WHERE id = $1', [id])
await db.query('UPDATE counters SET count = $1 WHERE id = $2', [count + 1, id])
return count + 1
```

Default `READ COMMITTED` isolation does **not** protect you here: both SELECTs commit before either UPDATE runs, so both see the old value.

## The fix — atomic UPDATE with RETURNING

```sql
UPDATE counters SET count = count + 1 WHERE id = $1 RETURNING count;
```

In node-postgres:

```js
const { rows } = await db.query(
  'UPDATE counters SET count = count + 1 WHERE id = $1 RETURNING count',
  [id]
)
return rows[0].count
```

- A single `UPDATE` is atomic — PostgreSQL serializes concurrent ones via row locks
- `RETURNING count` gives you the **new** value, so no separate SELECT is needed
- This also fixes the counter being off-by-N under load, not just the duplicate return values

## If you must read the value before deciding what to write

Use `SELECT ... FOR UPDATE` inside a transaction — it locks the row until commit, so the concurrent request blocks, then reads the fresh value:

```sql
BEGIN;
SELECT count FROM counters WHERE id = $1 FOR UPDATE;
-- ...calculate new value in app code...
UPDATE counters SET count = $2 WHERE id = $1;
COMMIT;
```

- A plain transaction **without** `FOR UPDATE` does not fix this — both reads still happen before either write

## ORM equivalents

| ORM | Increment API |
|---|---|
| Prisma | `prisma.counter.update({ where: { id }, data: { count: { increment: 1 } } })` |
| Sequelize | `Counter.increment('count', { where: { id } })` |
| Knex | `knex('counters').where({ id }).increment('count', 1).returning('count')` |

## Summary

- **Pure increment** → atomic `UPDATE ... RETURNING` (simplest, recommended)
- **Need old value to decide the write** → `SELECT ... FOR UPDATE` in a transaction
- **Transactions alone won't save you** — only row locks or a single atomic statement will
