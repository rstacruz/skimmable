## Issues found

### Critical — SQL injection

`req.params.id` is concatenated directly into the SQL string, so any value an attacker sends becomes part of the query. Parameterized queries prevent this.

```sql
-- request to /api/users/1%20OR%201=1
SELECT * FROM users WHERE id = 1 OR 1=1
```

- **Exploit** — `/api/users/1 OR 1=1` — returns every user row
- **Exploit** — `/api/users/1; DROP TABLE users;--` — destructive if the driver allows stacked queries

### Medium — no error handling

`db.query(...).then(...)` has no `.catch()`. If the query rejects, you get an unhandled rejection — which can crash the process or leak stack traces to logs.

### Low — returns the full row

`res.json(user)` exposes every column, including things like `password_hash`, `token`, etc. Select only the fields the client needs.

### Low — no validation or 404

- Non-numeric values (e.g. `/api/users/abc`) are passed through
- A missing user returns `undefined` instead of a 404

## Fixed version

```js
app.get('/api/users/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const user = await db.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Changes:

- **`?` placeholder + array parameter** — kills the SQL injection
- **Regex guard** — only digits accepted
- **Whitelisted columns** — no password/token leakage
- **404 and 500 handling** — no undefined responses, no crashes
