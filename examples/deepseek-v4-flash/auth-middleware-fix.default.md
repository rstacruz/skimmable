The classic culprit: **your JWT `exp` field is in seconds, but `Date.now()` returns milliseconds.**

Per RFC 7519, `exp` is a NumericDate — seconds since the Unix epoch. Today that's ~`1784000000`, while `Date.now()` is ~`1784000000000`. If your check is something like:

```js
if (Date.now() < payload.exp) {
  // reject as expired ❌
}
```

…then you're comparing 1.78 *trillion* against 1.78 *billion*. `Date.now() < payload.exp` is always `false`, so the "reject" branch never runs and every token sails through — expired or not.

## The fix

Convert to the same unit. Either divide `Date.now()` by 1000, or multiply `exp` by 1000:

```js
const nowSec = Math.floor(Date.now() / 1000);
if (!payload.exp || payload.exp <= nowSec) {
  return res.status(401).json({ error: 'Token expired' });
}
```

Note the `!payload.exp` check — if the token was signed without `expiresIn`, `payload.exp` is `undefined`, and `undefined <= nowSec` is `false`, so a token with **no expiry at all** would pass your check.

## But honestly, don't hand-roll this

If you're using the `jsonwebtoken` library, `jwt.verify()` already enforces `exp` (and `nbf`) and throws a `TokenExpiredError`. Just use it:

```js
import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      clockTolerance: 30, // seconds of leeway for clock skew
    });
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

## Quick checklist if it's *still* letting expired tokens through

1. **Are you using `jwt.decode()` instead of `jwt.verify()`?** `decode()` does not verify the signature *or* the expiry — it just base64-decodes the payload. Switch to `verify()`.
2. **Did you set `ignoreExpiration: true`?** If you passed that (or `ignoreExpiration` in `express-jwt` config), `verify()` will happily accept expired tokens. Remove it.
3. **Direction of the comparison.** `payload.exp < Date.now()` as a "reject" condition would also be wrong: `1.78e9 < 1.78e12` is always `true`, so you'd reject *every* token (the opposite symptom — but worth knowing). Use `exp * 1000 < Date.now()` or `Date.now() / 1000 > exp`.
4. **`new Date(payload.exp)` trap.** If you did `new Date(payload.exp)` expecting a date, you're feeding seconds into a milliseconds constructor → you get **Jan 21, 1970**, which is always in the past. Multiply by 1000 first.

If you want to message me your actual middleware snippet, I'll point out exactly which line is off.
