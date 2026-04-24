import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;
      let firestoreInfo = null;

      try {
        if (this.state.error?.message) {
          firestoreInfo = JSON.parse(this.state.error.message);
          if (firestoreInfo.operationType) {
            isFirestoreError = true;
            errorMessage = `Firestore ${firestoreInfo.operationType} error on path: ${firestoreInfo.path || 'unknown'}`;
          }
        }
      } catch (e) {
        // Not a JSON error message, use default
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-4">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Something went wrong</h2>
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-left">
              <p className="text-sm text-red-600 dark:text-red-400 font-mono break-all">
                {errorMessage}
              </p>
              {isFirestoreError && firestoreInfo && (
                <div className="mt-4 text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                  <p>User ID: {firestoreInfo.authInfo.userId || 'Not logged in'}</p>
                  <p>Email: {firestoreInfo.authInfo.email || 'N/A'}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-[var(--primary)] text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
