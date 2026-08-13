**New object reference every render — object literals aren't equal to themselves.**

```js
{ foo: 'bar' } === { foo: 'bar' } // false
```

- Each render creates a **new object**, even if contents are identical.
- Child sees a "changed" prop reference → re-renders (if it checks via `React.memo`, `useMemo`, `useEffect` deps, etc.)
- Parent state update → parent re-renders → object prop is recreated → child thinks prop changed.

**Fix — memoize the object, not the component:**

```js
const options = useMemo(() => ({ foo: 'bar' }), [foo, bar]);
```

- Only recreates when `foo`/`bar` actually change.
- Pairs with `React.memo` on the child if you want to skip its render too.

**Skip if:**
- Child render is cheap → don't bother, this is premature optimization.
- Add `useMemo` only when profiling shows this render actually costs something.
