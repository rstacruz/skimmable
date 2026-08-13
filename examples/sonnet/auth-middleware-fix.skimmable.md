**Root cause: unit mismatch — `exp` is seconds, `Date.now()` is milliseconds.**

- JWT `exp` claim = Unix seconds
- `Date.now()` = Unix milliseconds
- Comparing them directly makes every token look ~1000x further from expiry (effectively never expires)

**Fix:**

```js
if (Date.now() >= decoded.exp * 1000) {
  return res.status(401).json({ error: 'Token expired' });
}
```

Or skip the manual check entirely — `jwt.verify()` already validates `exp` correctly and throws `TokenExpiredError`:

```js
jwt.verify(token, secret); // throws if expired, no manual math needed
```

→ **skipped:** manual expiry math. Use `jwt.verify()`'s built-in check, add manual comparison only if you need custom grace-period logic.
