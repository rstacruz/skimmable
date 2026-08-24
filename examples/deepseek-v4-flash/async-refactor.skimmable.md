> Refactor this callback-based Node.js function to use async/await:
> 
> function getUser(id, callback) {
>   db.query('SELECT * FROM users WHERE id = ?', [id], function(err, rows) {
>     if (err) return callback(err);
>     if (!rows.length) return callback(new Error('Not found'));
>     callback(null, rows[0]);
>   });
> }

---

**The function can't be awaited as-is — `db.query` is callback-based, so promisify it first.**

```js
const { promisify } = require('util');
const query = promisify(db.query.bind(db));

async function getUser(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

**How it maps:**

| Original | Refactored |
| --- | --- |
| `callback(err)` on error | `throw` — caller handles with `try/catch` |
| `callback(null, rows[0])` | `return rows[0]` |
| `callback(new Error('Not found'))` | `throw new Error('Not found')` |
| async callback execution | `await query(...)` |

**Caller side:**

```js
try {
  const user = await getUser(id);
  console.log(user);
} catch (err) {
  console.error(err); // covers db errors and 'Not found'
}
```

**Notes:**

- **`bind(db)` is required** — promisified functions lose `this`, and `db.query` needs it
- **If you use mysql2**, skip promisify entirely: `const db = mysql.createConnection(...).promise();` — then `db.query` returns a promise natively
- **Behavior is preserved:** db errors and the `'Not found'` error both reach the caller, just via throw instead of callback
