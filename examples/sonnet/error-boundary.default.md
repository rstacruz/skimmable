> Implement a React error boundary component that catches render errors, shows a fallback UI with a retry button, and logs the error details.

---

Here's a React error boundary component with fallback UI, retry functionality, and error logging:

```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details to your monitoring service
    this.setState({ errorInfo });

    // Replace with your logging service (Sentry, Datadog, etc.)
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Reset the boundary so children re-render
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Support a custom fallback via render prop or element
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({
              error: this.state.error,
              retry: this.handleRetry,
            })
          : this.props.fallback;
      }

      return (
        <div role="alert" className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message ?? 'An unexpected error occurred.'}</p>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
              <summary>Error details</summary>
              {this.state.error?.stack}
              {this.state.errorInfo.componentStack}
            </details>
          )}

          <button onClick={this.handleRetry} type="button">
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Usage

```jsx
import ErrorBoundary from './ErrorBoundary';

function App() {
  return (
    <ErrorBoundary onError={(err, info) => logToService(err, info)}>
      <MyComponent />
    </ErrorBoundary>
  );
}

// With a custom fallback
<ErrorBoundary
  fallback={({ error, retry }) => (
    <div>
      <p>Failed: {error.message}</p>
      <button onClick={retry}>Try again</button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

### Key notes

- **Class component is required** — React only supports error boundaries via class components (`getDerivedStateFromError` / `componentDidCatch`). There's no Hooks equivalent yet.
- **What it catches:** render errors, lifecycle methods, and constructors of the child tree. It does **not** catch errors in event handlers, async code (`setTimeout`, promises), or SSR — use try/catch for those.
- **Retry limitations:** if the underlying cause persists (e.g., bad props), retrying will re-trigger the error. For robust recovery, add a `resetKeys` prop that resets the boundary when specified values change.

Want me to add a `resetKeys` prop, TypeScript types, or integration with a specific logging service like Sentry?
