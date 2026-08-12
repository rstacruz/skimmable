### The unit mismatch (what you asked about)

JWT's `exp` claim is in **seconds**; `Date.now()` is in **milliseconds** — a 1000× difference:

```js
// token payload:        exp = 1755100000     (seconds)
// Date.now():           1755100000000        (milliseconds)
```

The right conversions:

```js
payload.exp * 1000 < Date.now()              // expired
// or, keep everything in seconds:
payload.exp < Math.floor(Date.now() / 1000)  // expired
```

### But that bug *rejects*, it doesn't *accept*

With a valid seconds-based `exp`, both naive comparisons always evaluate to "expired":

```js
exp > Date.now()   // 1.7e9 > 1.7e12  → always false → token always rejected
exp < Date.now()   // 1.7e9 < 1.7e12  → always true  → token always rejected
```

So the unit mismatch alone would 401 **everything** — it can't be what lets expired tokens through. There's a second bug.

### What actually lets expired tokens through

- **`exp` is missing on the payload.** If the token was signed without `expiresIn`, there is no `exp` claim, so `payload.exp` is `undefined` — and *every* comparison with `undefined` is `false`. Your reject branch never fires, so every token is accepted:

```js
if (payload.exp < Date.now()) {
  return res.status(401).json({ error: 'expired' });
}
next();  // payload.exp is undefined → check is false → always reaches here
```

- **`jwt.decode()` instead of `jwt.verify()`.** `decode()` is just base64 — it checks nothing, and anyone can craft a token with a far-future `exp`. Even a correct manual expiry check over a decoded token still accepts forged tokens.

This combination matches your symptom exactly: a missing `exp` (no `expiresIn` when signing) plus a manual check that silently no-ops on `undefined`.

### Fix

Sign with an expiry, and let `jsonwebtoken` do the checking — `verify()` validates the signature, `exp`, `nbf`, and throws `TokenExpiredError` when the token is past:

```js
// signing
jwt.sign(payload, SECRET, { expiresIn: '1h' });

// middleware
try {
  req.user = jwt.verify(token, SECRET);
  next();
} catch (err) {
  return res.status(401).json({ error: 'invalid or expired token' });
}
```

If you must keep the manual check, verify the signature first, then compare in matching units:

```js
const payload = jwt.verify(token, SECRET);          // throws if signature invalid
if (payload.exp * 1000 < Date.now()) {
  return res.status(401).json({ error: 'expired' });
}
req.user = payload;
next();
```
