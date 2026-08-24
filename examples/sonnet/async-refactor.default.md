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

Here's the refactored version using async/await:

```javascript
async function getUser(id) {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

This assumes your `db.query` returns a promise. A few notes:

**If `db.query` only supports callbacks** (no promise interface), wrap it with `util.promisify`:

```javascript
const { promisify } = require('util');

async function getUser(id) {
  const query = promisify(db.query).bind(db);
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

*(For efficiency, promisify once at module scope rather than inside the function.)*

**Key changes:**
- The `callback` parameter is gone — the function now **returns** the result and **throws** on error.
- `if (err) return callback(err)` disappears — errors from `await` propagate automatically as rejected promises.
- `callback(new Error('Not found'))` becomes `throw new Error('Not found')`.

**How callers change** — they now use `await` with `try/catch`:

```javascript
try {
  const user = await getUser(42);
  // use user
} catch (err) {
  // handles both DB errors and 'Not found'
}
```

One behavioral note: some drivers (like `mysql`) return `[rows, fields]` from the promise version. If yours does, destructure instead:

```javascript
const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
```

Let me know which database library you're using and I can tailor it precisely.
