Here's the refactored version:

```js
async function getUser(id) {
  const rows = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

**Key changes:**

- **No `callback` parameter** — the function returns a promise instead.
- **Errors** → `throw` (async functions automatically reject the returned promise).
- **Success** → `return rows[0]` instead of `callback(null, rows[0])`.
- **"Not found"** → `throw new Error('Not found')` instead of passing it to the callback.

**Caller now uses `await` or `.then()`:**

```js
try {
  const user = await getUser(42);
  console.log(user);
} catch (err) {
  console.error(err);
}
```

---

**Alternative: `util.promisify` (cleaner if you reuse the query)**

```js
const { promisify } = require('util');
const query = promisify(db.query).bind(db); // .bind(db) preserves `this`

async function getUser(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

> ⚠️ `bind(db)` matters — if `db.query` relies on `this` internally, promisifying it without binding can break it.

**Bonus:** if your DB driver supports promises natively (e.g., `mysql2/promise`), you can skip the wrapper entirely:

```js
async function getUser(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

The behavior is identical to the original, but now errors propagate as rejected promises instead of callback arguments.
