import { Component } from 'react';
import { logError } from '@/lib/logger';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, {
      component: 'ErrorBoundary',
      errorInfo: errorInfo.componentStack
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
          <div className="max-w-sm text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Sistema susidūrė su klaida</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Bandome atkurti sistemą. Jei problema išliks, susisiekite su administratoriumi.
            </p>
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Bandyti dar kartą
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;