// FIXED: Router-level error boundary to prevent blank pages on render errors - Phase 1
import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './ui/Button';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  title?: string;
  message?: string;
  onReset?: () => void;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
        this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-brand-text-main tracking-tight mb-2">
              {this.props.title || 'Something went wrong'}
            </h2>
            <p className="text-brand-text-sub font-bold text-sm mb-6">
              {this.props.message || 'This page could not be displayed. Try refreshing or go back.'}
            </p>
                        {(import.meta as unknown as Record<string, unknown>).env.DEV &&
              this.state.error?.message && (
                <p className="text-xs text-rose-600 mb-4 font-mono text-left bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl">
                  {this.state.error.message}
                </p>
              )}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={this.handleRetry} className="flex items-center gap-2">
                <RefreshCw size={18} /> Try again
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go back
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
