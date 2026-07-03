import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import i18n from "../i18n";

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback render. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

/**
 * Global error boundary that catches render errors anywhere in the ACP
 * client tree and shows a recoverable fallback.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to console so transport / store errors are visible alongside.
    console.error("[ACPClient] Uncaught render error:", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{i18n.t("error.title")}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {error.message || i18n.t("error.defaultMessage")}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={this.reset}>
          <RotateCcw className="h-4 w-4" />
          {i18n.t("common.tryAgain")}
        </Button>
      </div>
    );
  }
}
