> My Express auth middleware is letting expired JWT tokens through. The expiry check uses Date.now() compared to the token's exp field. What's wrong and how do I fix it?

---

**Bug: unit mismatch.** `exp` is seconds since epoch (JWT spec). `Date.now()` is milliseconds.

Comparing them directly makes tokens look 1000x further from expiry than they are — expired tokens still pass.

```js
// ❌ wrong — exp (seconds) vs Date.now() (ms)
if (decoded.exp < Date.now()) throw new Error('expired');

// ✅ fix — convert one side
if (decoded.exp * 1000 < Date.now()) throw new Error('expired');
// or: if (decoded.exp < Date.now() / 1000)
```

Better: let `jwt.verify()` handle it — it already checks `exp` correctly and throws `TokenExpiredError`.

```js
const jwt = require('jsonwebtoken');

try {
  const decoded = jwt.verify(token, secret); // checks exp for you
  req.user = decoded;
  next();
} catch (err) {
  if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
  return res.status(401).json({ error: 'Invalid token' });
}
```

`[code] → skipped: manual exp math, use jwt.verify's built-in check instead.`
