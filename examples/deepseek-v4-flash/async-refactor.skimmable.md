## Refactored version

```javascript
async function getUser(id) {
  const rows = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

## Behavior mapping

| Original callback | Async/await equivalent |
|---|---|
| `callback(err)` | `reject(err)` |
| `callback(new Error('Not found'))` | `throw new Error('Not found')` |
| `callback(null, rows[0])` | `return rows[0]` |

## Notes

- **Callers** — use `await getUser(id)` in a `try/catch`, or `.catch()` if not inside an async function
- **If your db driver supports it** — `db.query` with `util.promisify` or a native promise API avoids the manual wrapper:

```javascript
const query = util.promisify(db.query);

async function getUser(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

- **Error handling** — rejection and thrown errors are equivalent in practice; both must be caught by the caller
