The classic bug: **JWT `exp` is in seconds, but `Date.now()` is in milliseconds.**

Per RFC 7519, `exp` is a *NumericDate* — seconds since the Unix epoch. So:

```js
payload.exp        // e.g. 1785000000  (seconds)
Date.now()         // e.g. 1785000000000  (milliseconds)
```

Comparing those directly is like comparing `10` to `10000` — depending on exactly how you wrote the comparison, the check collapses in one direction or the other. And if the token was *signed* with `exp: Date.now() + 3600000` (milliseconds) but *verified* treating it as seconds, tokens effectively never expire — which matches your symptom.

## The fix

The cleanest fix is to stop hand-rolling it. `jsonwebtoken`'s `verify()` checks `exp` (and the signature, which `decode()` does not) automatically:

```js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Throws TokenExpiredError if expired, JsonWebTokenError if signature bad
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

## If you must check manually

Convert to the same unit and use the correct boundary (a token is invalid **at and after** `exp`, so use `>=`):

```js
const payload = jwt.decode(token);          // note: NO validation here!
const nowSec = Math.floor(Date.now() / 1000);

if (nowSec >= payload.exp) {
  return res.status(401).json({ error: 'Token expired' });
}
```

## Things worth double-checking

- **`jwt.decode()` vs `jwt.verify()`** — `decode()` doesn't check the signature *or* expiration. If a "tutorial" middleware decodes and then hand-checks expiry, that hand-check needs to be airtight.
- **`ignoreExpiration`** — make sure you're not passing `{ ignoreExpiration: true }` to `verify()`.
- **Inverted boolean** — watch for logic like `const expired = Date.now() < payload.exp * 1000;` — the units are right but the comparison is backwards, so expired tokens pass.
- **`exp` missing entirely** — if tokens are signed without `expiresIn`/`exp`, `payload.exp` is `undefined` and a guard like `if (payload.exp && ...)` silently skips the check. Check how you're *signing*.
- **Clock skew** — if tokens seem to expire prematurely while your server clock is correct, `verify` accepts `{ clockTolerance: 30 }` (seconds). If tokens are *still* passing after that, verify the server isn't behind via NTP.

## Quick diagnostic

Log the numbers and compare with a token you *know* is expired:

```js
const nowSec = Math.floor(Date.now() / 1000);
console.log({ nowSec, exp: payload.exp, secondsRemaining: payload.exp - nowSec });
```

- `secondsRemaining` negative → the token is genuinely past `exp`, and your check logic is the bug.
- `secondsRemaining` positive or `exp` is `undefined` → the token never had a real expiry (or the signer used the wrong unit), so no middleware check can ever expire it.
