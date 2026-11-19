import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let display = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error && parsed.operationType) {
        display = `Permission or sync issue during ${parsed.operationType} on ${parsed.path || 'database'}: ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, message: display };
  }

  componentDidCatch(error: Error) {
    console.error('RM Mart ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-6 py-16">
          <div className="max-w-lg w-full bg-white border border-[#E5DEC9] rounded-xl p-8 text-center">
            <h1 className="font-serif-display text-2xl font-semibold text-[#0D3B2E]">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm text-[#52605B] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-medium rounded-lg hover:bg-[#092A20] transition-colors"
            >
              Reload RM Mart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
