> Refactor this callback-based Node.js function to use async/await:
> 
> function getUser(id, callback) {
>   db.query('SELECT * FROM users WHERE id = ?', [id], function(err, rows) {
>     if (err) return callback(err);
>     if (!rows.length) return callback(new Error('Not found'));
>     callback(null, rows[0]);
>   });
> }

---

Here's the refactored version. Since the original `db.query` is callback-based, you'll need to wrap it in a Promise — or promisify it — before you can `await` it:

```js
const { promisify } = require('util');

const query = promisify(db.query).bind(db);

async function getUser(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Not found');
  return rows[0];
}
```

**Key points:**

- `promisify(db.query).bind(db)` converts the callback API into a promise-returning function (`rows` is the first callback argument, which maps cleanly to the resolved value). `.bind(db)` preserves the correct `this` for the DB connection.
- The `if (!rows.length) throw new Error('Not found')` behaves exactly like the original `callback(new Error('Not found'))` — because async functions automatically convert a thrown error into a **rejected** promise.
- `return rows[0]` is the success path, mirroring the original `callback(null, rows[0])`.

Because async functions always return promises, the **caller** changes from:

```js
// Before
getUser(id, (err, user) => {
  if (err) console.error(err);
  else console.log(user);
});
```

to:

```js
// After
try {
  const user = await getUser(id);
  console.log(user);
} catch (err) {
  console.error(err);
}
```

or with `.catch()` if not inside an async function.

**Alternative** (if you can't use `promisify`, or prefer an explicit wrapper):

```js
async function getUser(id) {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
      if (err) return reject(err);
      if (!rows.length) return reject(new Error('Not found'));
      resolve(rows[0]);
    });
  });
}
```

Both produce identical behavior to the original, just with promises instead of callbacks.
