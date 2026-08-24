> Implement a React error boundary component that catches render errors, shows a fallback UI with a retry button, and logs the error details.

---

Error boundaries must be class components — React only exposes the two lifecycle methods they rely on (`getDerivedStateFromError` and `componentDidCatch`) on classes, so there's no hook-based way to create one from scratch.

Here's a full TypeScript implementation:

```tsx
// ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  /** The subtree to guard. */
  children: ReactNode;
  /** Custom fallback UI. Either a static node or a function receiving the error and a reset callback. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called after an error is caught — wire up Sentry/analytics here. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called whenever the boundary resets (retry click or resetKeys change). */
  onReset?: () => void;
  /** If any key changes identity while the boundary is in an error state, the boundary auto-resets. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  // Runs before render: switches the tree to the fallback UI.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  // Runs after the error is caught: for side effects like logging.
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Render error caught:", {
      error,
      errorInfo,
    });
    // Send to your error-tracking service (Sentry, Datadog, etc.)
    this.props.onError?.(error, errorInfo);
  }

  // Auto-reset when a dependency prop (resetKeys) changes, so the subtree
  // re-renders with fresh data instead of staying stuck on the fallback.
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.error) return;

    const prev = prevProps.resetKeys;
    const next = this.props.resetKeys;
    const keysChanged =
      prev?.length !== next?.length ||
      prev?.some((key, i) => key !== next?.[i]);

    if (keysChanged) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    const { fallback, children } = this.props;

    if (!error) return children;

    // Function fallback gets the error and a retry callback.
    if (typeof fallback === "function") {
      return fallback(error, this.reset);
    }

    // Static fallback node.
    if (fallback !== undefined) {
      return fallback;
    }

    // Default fallback UI with retry button.
    return (
      <div
        role="alert"
        style={{
          maxWidth: 560,
          margin: "2rem auto",
          padding: "1.5rem",
          border: "1px solid #f5c6cb",
          borderRadius: 8,
          backgroundColor: "#fdf3f4",
          color: "#721c24",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          Something went wrong
        </h2>
        <p style={{ margin: "0 0 0.75rem" }}>
          The application hit an unexpected error while rendering. You can try
          again below.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            padding: "0.75rem",
            background: "rgba(0, 0, 0, 0.05)",
            borderRadius: 4,
            fontSize: "0.8rem",
          }}
        >
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 1rem",
            border: "none",
            borderRadius: 4,
            backgroundColor: "#721c24",
            color: "#fff",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
```

## Usage

```tsx
import ErrorBoundary from "./ErrorBoundary";
import { reportError } from "./telemetry";

function App() {
  return (
    <ErrorBoundary
      onError={(error, info) => {
        // Log error details to your backend
        reportError({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
        });
      }}
      onReset={() => {
        // Clear any related app state so the retry can actually succeed
        clearCachedDashboardData();
      }}
      // Auto-retry when the user switches accounts
      resetKeys={[accountId]}
      // Optional: custom fallback instead of the default one
      fallback={(error, reset) => (
        <div role="alert">
          <h3>Oops, this section crashed</h3>
          <p>{error.message}</p>
          <button onClick={reset}>Retry</button>
        </div>
      )}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
```

## How the retry works

`reset()` sets `error` back to `null`, so React re-renders the boundary's children. Note this is effectively a remount of that subtree — children start with fresh state. If the error came from external state that hasn't changed (e.g., a malformed API response still cached in a store), the retry will catch the error again immediately. That's why the `onReset`/`resetKeys` hooks exist: to clear the bad data before re-rendering.

## What error boundaries don't catch

- **Event handlers** — errors there don't affect rendering, so use `try/catch` in the handler.
- **Async code** — promises, `setTimeout`, `async/await`. Attach `.catch()` and set local error state.
- **Errors in the error boundary itself** — a boundary can't catch its own errors; wrap it in another boundary if needed.
- **Server-side rendering** — catch errors in a try/catch around `renderToString`.

If you need a hook-based ergonomic API, wrap this class in a `useErrorBoundary()` hook or component that exposes `reset` via context — but the class underneath is still the only native mechanism.
