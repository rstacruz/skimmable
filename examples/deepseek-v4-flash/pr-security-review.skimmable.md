> Review this Express route handler for security issues:
> 
> app.get('/api/users/:id', (req, res) => {
>   const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
>   db.query(query).then(user => res.json(user));
> });

---

**Verdict: critical SQL injection — never interpolate request data into a SQL string.**

```js
const query = `SELECT * FROM users WHERE id = ${req.params.id}`; // ❌ attacker-controlled input
```

## Issues by severity

- **Critical — SQL injection**
  - `req.params.id` is concatenated directly into the query
  - `GET /api/users/1 OR 1=1--` returns every user in the table
  - With `multipleStatements` enabled (mysql2), stacked queries work: `1; DROP TABLE users;--`
- **High — no input validation**
  - `req.params.id` arrives as a string, never checked to be an integer
- **Medium — unhandled promise rejection**
  - No `.catch` on `db.query` — a failed query rejects the promise
  - Express 4 won't forward it: the request hangs, and newer Node versions may crash the process
- **Context-dependent — over-exposure**
  - `SELECT *` returns all columns (password hashes, email, …) to the client
  - No authorization check — any caller can read any user's record (verify no auth middleware runs upstream)

## Fix: parameterized query + error handling

```js
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

- **Placeholder syntax** — `?` shown above; use `$1` if the driver is node-postgres
- **Validate the format** — reject non-numeric ids before querying:
  ```js
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  ```
- **Tighten the response** — select only the columns the API needs (`id`, `name`, …) and return 404 when no row matches
