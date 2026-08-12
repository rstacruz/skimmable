### Short answer

React re-renders children whenever the parent re-renders — **props are never compared unless the child is memoized**. And if you're passing an object literal, it gets a new reference on every render, so even `React.memo` can't bail out.

### Why it happens

**1. No `React.memo` → child always re-renders**

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // New object reference every render
  const config = { theme: "dark" };

  return <Child config={config} />;
}

function Child({ config }) {
  // Runs on every Parent render, no matter what
}
```

Default React behavior: parent state update → all children re-run. That's expected, not a bug.

**2. `React.memo` → but object identity changes**

```jsx
const Child = React.memo(function Child({ config }) {
  // Still re-renders — see why below
});
```

`React.memo` uses `Object.is` on each prop. Your config *values* look the same, but:

- `{ theme: "dark" }` inline → new object on every render
- `Object.is(prevConfig, nextConfig)` → `false`
- So memo sees a "changed" prop and re-renders

**3. Object built from state/derived data**

```jsx
const config = { theme: darkMode ? "dark" : "light" }; // new ref each render
```

Even if `darkMode` didn't change, the object is recreated.

### Fixes

**Static object → hoist out of the component**

```jsx
const CONFIG = { theme: "dark" }; // module scope, same ref forever

function Parent() {
  return <Child config={CONFIG} />;
}
```

**Object depends on other values → `useMemo`**

```jsx
const config = useMemo(() => ({ theme: darkMode ? "dark" : "light" }), [darkMode]);
```

Now `config` keeps its reference while `darkMode` is unchanged.

**Stable instance → `useState` or `useRef`**

```jsx
const [config] = useState(() => ({ theme: "dark" }));
```

### To diagnose

- Check the child is wrapped in `React.memo` / `PureComponent` — otherwise this is normal React behavior
- Log identity inside the child:

```jsx
function Child({ config }) {
  console.log("render", config);
  return null;
}
```

- Check the object in the parent:

```jsx
console.log("config in parent", config);
```

> Same values printed, but a new object created each render → that's the cause.

- Or use DevTools Profiler → "Why did this render?" tooltip on the child
- Third-party hooks (`useQuery`, `useSelector` result objects) can also return new references — memoize the object you pass down, not just the raw hook result

### Rule of thumb

- **Functions** → `useCallback`
- **Objects** → `useMemo`, hoisting, or state
- **Child** → `React.memo` to benefit from either

Both pieces are required: stable prop reference **and** a memoized child.
