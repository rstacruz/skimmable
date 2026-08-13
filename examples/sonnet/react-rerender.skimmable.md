**Object prop gets a new reference every render.**

- Even with identical values, `{}` !== `{}` in JS
  - Parent re-renders → creates new object literal → child sees "different" prop → re-renders

## Fix options

```jsx
// ❌ New object every render
<Child config={{ foo: bar }} />

// ✅ Memoize the object
const config = useMemo(() => ({ foo: bar }), [bar]);
<Child config={config} />

// ✅ Or memoize the child + pass primitives
<Child foo={bar} />
```

**Also check:** `React.memo` on the child.

- Without it, child re-renders on every parent render regardless of props
  - `memo` does shallow prop comparison — but still fails if you pass a fresh object each time
  - So you need **both**: `memo(Child)` + stable prop reference

> 🎯 **TLDR: New object reference each render breaks equality.** Memoize the object or use `React.memo`.
> - Object literals aren't `===` even if equal
> - `useMemo` for the prop, `React.memo` for the child
