import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Shared logging ────────────────────────────────────────────────────────────

function logBoundaryError(
  boundaryName: string,
  error: Error,
  errorInfo: ErrorInfo | null,
) {
  const slug = (() => {
    try {
      const parts = window.location.pathname.split("/").filter(Boolean);
      return parts[0] ?? "(unknown)";
    } catch {
      return "(unknown)";
    }
  })();

  const payload = {
    boundary: boundaryName,
    timestamp: new Date().toISOString(),
    environment: import.meta.env.MODE,
    route: window.location.pathname + window.location.search,
    slug,
    errorMessage: error.message,
    errorName: error.name,
    componentStack: errorInfo?.componentStack?.trim() ?? null,
  };

  console.error(`[${boundaryName}] Render error captured`, payload);
}

// ─── RouteErrorBoundary ────────────────────────────────────────────────────────

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logBoundaryError("RouteErrorBoundary", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-red-50 p-4 rounded-full">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-muted-foreground text-sm">
            Please try again or refresh the page.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="default" onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 text-left bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-48">
              <summary className="cursor-pointer text-muted-foreground mb-2">
                Error details (dev only)
              </summary>
              <div className="text-red-600 whitespace-pre-wrap">
                {this.state.error.toString()}
              </div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-muted-foreground mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </details>
          )}
        </div>
      </div>
    );
  }
}

// ─── BookingErrorBoundary ──────────────────────────────────────────────────────

interface BookingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface BookingErrorBoundaryProps {
  children: ReactNode;
}

export class BookingErrorBoundary extends Component<
  BookingErrorBoundaryProps,
  BookingErrorBoundaryState
> {
  constructor(props: BookingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<BookingErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logBoundaryError("BookingErrorBoundary", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleBackToListing = () => {
    try {
      // URL pattern: /:slug/book  → navigate to /:slug
      const parts = window.location.pathname.split("/").filter(Boolean);
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const slug = parts[0] ?? "";
      window.location.href = `${base}/${slug}`;
    } catch {
      window.history.back();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-red-50 p-4 rounded-full">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-foreground">
            We hit an error loading this booking
          </h2>
          <p className="text-muted-foreground text-sm">
            Please refresh the page or try again. If the issue continues, contact support.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="default" onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
            <Button
              variant="ghost"
              onClick={this.handleBackToListing}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to listing
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 text-left bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-48">
              <summary className="cursor-pointer text-muted-foreground mb-2">
                Error details (dev only)
              </summary>
              <div className="text-red-600 whitespace-pre-wrap">
                {this.state.error.toString()}
              </div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-muted-foreground mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </details>
          )}
        </div>
      </div>
    );
  }
}
