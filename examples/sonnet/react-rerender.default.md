When you pass an object as a prop, the issue is usually that you're creating a **new object reference** on every render, even if the contents are identical.

## The Core Problem

React uses **referential equality** (`Object.is` comparison) to determine if props changed. Two objects with identical contents are still different references:

```js
{ id: 1 } === { id: 1 } // false!
```

So if the parent re-renders (due to its own state update), it recreates the object, and the child sees a "new" prop even though the values are the same.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // ❌ New object created every render
  const config = { theme: 'dark', size: 'large' };

  return <Child config={config} />;
}
```

## Solutions

**1. Memoize the object with `useMemo`:**

```jsx
const config = useMemo(
  () => ({ theme: 'dark', size: 'large' }),
  [] // deps — recompute only when these change
);
```

**2. Wrap the child in `React.memo`** so it skips re-renders when props are referentially equal:

```jsx
const Child = React.memo(function Child({ config }) {
  return <div>{config.theme}</div>;
});
```

Note: `React.memo` alone won't help if you're still passing a fresh object each render — you need **both** `React.memo` on the child **and** `useMemo` on the object.

**3. Move static objects outside the component** (if they never change):

```jsx
const CONFIG = { theme: 'dark', size: 'large' };

function Parent() {
  return <Child config={CONFIG} />;
}
```

## A Few Questions to Pin It Down

- Are you using `React.memo` on the child? Without it, the child re-renders whenever the parent does — regardless of prop changes. That's normal React behavior, not a bug.
- Is the object created inside the parent's render body?
- Same issue applies to **arrays**, **inline functions** (`onClick={() => ...}`), and objects — all get fresh references each render.

If you share the relevant component code, I can point to the exact line causing it.
