This is one of the most common React performance gotchas. There are actually **two separate mechanisms** at play, and you're likely hitting both:

---

## 1. Default behavior: parent renders → children render

By default, when a parent component re-renders, **every child re-renders too** — regardless of whether its props changed. This is by design: React doesn't know what might depend on the parent's state, so it re-renders everything down the tree.

So if your parent has `useState` and updates it, the child re-renders no matter what props you pass.

**Fix:** wrap the child in `React.memo()`:

```jsx
const Child = React.memo(function Child({ config }) {
  // ...
});
```

Now the child only re-renders when its props **shallowly differ** from last time.

---

## 2. The object prop is a new reference every render

Here's the sneaky part. Even with `React.memo`, this *still* re-renders:

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <Child config={{ theme: "dark", size: "lg" }} />  // ❌ new object every render
    </>
  );
}
```

Why? Because `{ theme: "dark", size: "lg" }` creates a **brand-new object reference** on every render. `React.memo` does a **shallow comparison** (`prevProp === nextProp`), and the new reference fails that check. So memo sees "prop changed" and re-renders anyway.

It's the same with arrays, functions, class instances — anything non-primitive.

---

## The fixes

### Option A: Hoist the object outside the component (best for static values)

```jsx
const CONFIG = { theme: "dark", size: "lg" };

function Parent() {
  // ...
  return <Child config={CONFIG} />; // ✅ same reference every time
}
```

### Option B: `useMemo` (for values derived from state/props)

```jsx
const config = useMemo(
  () => ({ theme: "dark", size: isLarge ? "lg" : "sm" }),
  [isLarge]
);

return <Child config={config} />;
```

### Option C: If it's a function, use `useCallback` instead

```jsx
const handleClick = useCallback(() => { ... }, [deps]);
```

### Option D: Restructure the object away

Pass primitives directly — nothing to compare by reference:

```jsx
<Child theme="dark" size={isLarge ? "lg" : "sm"} />
```

---

## Quick diagnosis checklist

| Symptom | Cause |
|---|---|
| No `memo`, child re-renders | Normal React behavior |
| `memo` present, still re-renders | Object prop has a new reference each render |
| `memo` present, primitives only | Something else (context, state in component, parent re-mount) |

---

## When *not* to bother

`memo` + `useMemo` add garbage-collection and comparison overhead themselves. For small, cheap components the re-render cost is negligible — React is fast. Optimize only when you have a genuinely heavy subtree, many components, or measurable jank. When in doubt, profile with the React DevTools profiler first.

**TL;DR:** Re-renders are expected by default; use `React.memo` to opt out; but `memo` won't help if your object prop is recreated on every render — memoize the object (or hoist it) so its reference stays stable.
