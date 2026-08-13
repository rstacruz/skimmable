```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    return (
      <div role="alert">
        <p>Something went wrong: {error.message}</p>
        <button onClick={this.retry}>Retry</button>
      </div>
    );
  }
}
```

**Usage**

```tsx
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

→ skipped: error reporting service integration, retry-count/backoff limits, custom fallback component prop (kept as render-prop instead). Add if you need Sentry/Datadog wiring or infinite-retry-loop protection.
