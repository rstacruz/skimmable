# Security Review

## Critical: SQL Injection

```javascript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
```

This is a textbook SQL injection vulnerability. `req.params.id` is raw user input (from the URL path) concatenated directly into the SQL string.

**Attack example:** Requesting `/api/users/1 OR 1=1` produces:

```sql
SELECT * FROM users WHERE id = 1 OR 1=1
```

which returns **every** user in the table. Worse, `1; DROP TABLE users; --` would execute destructive statements, and stacked queries could be used to exfiltrate, modify, or delete data.

**Fix:** Use parameterized queries (the only safe approach):

```javascript
app.get('/api/users/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = $1';
  db.query(query, [req.params.id])
    .then(user => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    });
});
```

*(Syntax may differ slightly depending on your driver — `?` for mysql2, `$1` for pg.)*

## Additional Issues

1. **Unhandled promise rejection** — There's no `.catch()`. If the query fails, the rejection is unhandled, which in modern Node.js versions crashes the process. Even if it didn't crash, the client would receive an unhelpful/leaky 500. Always catch and map to a proper response.

2. **No 404 handling** — A missing user resolves to `null`/`undefined`, which gets sent as `200 OK` with an empty body instead of a proper 404.

3. **Missing input validation** — Even with parameterized queries, a non-numeric `id` should be rejected early with a `400` (e.g., `/api/users/abc`). Validate before hitting the database.

4. **No authentication/authorization** — As written, any anonymous user can fetch any user's record. At minimum, require authentication; ideally, restrict access so users can only fetch their own profile (or protect sensitive fields like password hashes — avoid `SELECT *` and explicitly list columns).

5. **No rate limiting** — User-ID enumeration via blind requests is trivial here. Add rate limiting on sensitive endpoints.

## Summary

The SQL injection is a **must-fix** (CWE-89, OWASP A03:2021). The rest are important hardening steps: parameterize, validate, handle errors, enforce authz, and don't leak more fields than necessary.
