The classic bug: **unit mismatch**. JWT's `exp` claim is in **seconds** (Unix time), but `Date.now()` returns **milliseconds**.

So a comparison like this always fails to detect expiry:

```js
if (decoded.exp < Date.now()) {  // WRONG
  throw new Error('Token expired');
}
```

Here `decoded.exp` might be `1786000000` (seconds) while `Date.now()` is `1786000000000` (milliseconds). The token value is ~1000x smaller, so the check almost never triggers and expired tokens sail through.

## Fix

Convert one side so the units match:

```js
if (decoded.exp < Math.floor(Date.now() / 1000)) {  // both in seconds
  throw new Error('Token expired');
}
```

or

```js
if (decoded.exp * 1000 < Date.now()) {  // both in ms
  throw new Error('Token expired');
}
```

## Better: let the library do it

If you're using `jsonwebtoken`, don't hand-roll the expiry check at all. `jwt.verify()` validates `exp` automatically (and throws `TokenExpiredError`):

```js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

A couple of things to double-check:

- Make sure you're calling `jwt.verify()`, not `jwt.decode()` — `decode` does **no** validation (signature or expiry), which is another common reason expired/tampered tokens get through.
- If you added `{ ignoreExpiration: true }` to the verify options anywhere, remove it.

Which approach are you using — manual check or the library?
