import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CungaCash render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">This page could not be displayed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your data is safe. Reload the page to restore the latest records.
          </p>

          {/* Dev-only error details to help debugging in previews — not shown in production */}
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-4 text-left max-h-48 overflow-auto rounded bg-muted/30 p-3 text-xs">
              <strong className="block text-sm mb-2">Error:</strong>
              <div className="whitespace-pre-wrap">{this.state.error.message}</div>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show stack</summary>
                <pre className="mt-1 text-[11px]">{String(this.state.error.stack)}</pre>
              </details>
            </div>
          )}

          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reload page
          </Button>
        </section>
      </main>
    );
  }
}
