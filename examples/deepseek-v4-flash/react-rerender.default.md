> Why is my React component re-rendering on every state update even though the props haven't changed? I'm passing an object as a prop.

---

The short answer: **it's almost certainly because a new object reference is being created on every render.**

Here's what's happening.

## How React decides to re-render

By default, when you pass props to a child, **React does not compare their contents** ("deep equality"). It only cares about **reference equality** — whether the prop is the *same object in memory* as last time.

If the parent re-renders, it re-evaluates everything in its JSX. If you're passing an object inline, a brand-new object is created on every single render:

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      {/* ❌ A NEW { theme: 'dark' } object is created every time Parent renders */}
      <Child config={{ theme: 'dark' }} />
    </>
  );
}
```

Even though `{ theme: 'dark' }` is *semantically* identical every time, each render creates a new object with a **new memory reference**. To React, that's "different props."

Two things are going on:

1. If `Child` **isn't** wrapped in `React.memo`, it re-renders whenever its parent re-renders. Period. No prop comparison happens at all.
2. If `Child` **is** wrapped in `React.memo`, memo does a *shallow* comparison — and because the reference changed, it detects a prop change and re-renders anyway.

## The fix

### 1. If the object is static, define it outside the component:

```jsx
const DARK_CONFIG = { theme: 'dark' };

function Parent() {
  // same reference every time — memo will now work
  return <Child config={DARK_CONFIG} />;
}
```

### 2. If it depends on values, memoize it with `useMemo`:

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);

  const config = useMemo(
    () => ({ theme: 'dark', owner: user?.name }),
    [user]           // only recreated when user changes
  );

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <Child config={config} />
    </>
  );
}
```

Now `config` keeps the same reference across `count` updates, and `React.memo` on the child will correctly skip re-rendering.

### 3. The same problem applies to functions:

```jsx
// ❌ new function every render
<Child onClick={() => handleClick(id)} />

// ✅ stable function
<Child onClick={useCallback(() => handleClick(id), [id])} />
```

### 4. Restructure to isolate state

Sometimes the best fix is to move the state *down* so the expensive child isn't even in the same subtree as the thing updating:

```jsx
function Parent() {
  return (
    <>
      <Counter />       {/* count state lives here — only Counter re-renders */}
      <ExpensiveChild config={DARK_CONFIG} />
    </>
  );
}
```

## Important caveats

- **A component's own state updates should re-render it.** That's correct React behavior — don't try to suppress that.
- Don't reach for `useMemo`/`memo` everywhere. Memoization itself has a cost, and React's default re-rendering is usually fast. Profile first; if the child is genuinely expensive (large tree, heavy rendering), then optimize.
- `React.memo` only does a **shallow** comparison. If you mutate an object and pass the same reference, memo will *skip* the re-render (often a bug, not a feature). Keep props immutable.

So: **stabilize your object references**, combine with `React.memo` where it pays off, and React will stop re-rendering the child when the parent's unrelated state changes.
