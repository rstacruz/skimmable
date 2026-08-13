**Critical: SQL injection via string interpolation**

```js
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
```

`req.params.id` goes straight into the query string. An attacker can pass something like:

```
/api/users/1 OR 1=1
/api/users/1; DROP TABLE users;--
```

Fix — use a parameterized query:

```js
app.get('/api/users/:id', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(user);
});
```

Adjust placeholder syntax (`$1`, `?`, `:id`) to whatever your DB driver uses.

**Also missing:**

- **No `id` validation** — non-numeric input still hits the query (parameterization fixes injection, but you may still want a numeric check for a clean 400 response).
- **No error handling** — `.then()` with no `.catch()`. A DB error will crash the request (unhandled rejection) instead of returning a proper error response.
- **No not-found check** — if no user matches, this likely returns `null`/`[]` as 200 instead of 404.
- **No auth/ownership check** — anyone can fetch any user by ID; confirm this endpoint should be public.

**Minimal fixed version:**

```js
app.get('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});
```
