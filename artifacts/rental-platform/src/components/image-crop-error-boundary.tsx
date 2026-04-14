import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary specifically around ImageCropDialog.
 * Catches render-time crashes (e.g. missing icon imports, unexpected nulls)
 * and shows an inline recovery UI instead of crashing the whole page.
 */
export class ImageCropErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[image-crop] render error", {
      error: error.message,
      name: error.name,
      componentStack: info.componentStack,
      environment: import.meta.env.MODE,
    });
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Photo upload unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Something went wrong with the photo editor. Your listing data is safe — only the photo upload was affected.
                </p>
                {import.meta.env.DEV && (
                  <p className="text-xs text-destructive/80 mt-2 font-mono break-all">
                    {this.state.error.message}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={this.handleReset}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Dismiss and try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
