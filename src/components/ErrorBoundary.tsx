import { Component, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-6"
        >
          <div className="max-w-md w-full bg-white rounded-[28px] p-8 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800">出了点问题</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              页面遇到意外错误，请点击下方按钮重试。如果问题持续出现，请刷新页面。
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 bg-red-50 rounded-xl p-3 break-all font-mono">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
            >
              <RotateCcw size={18} /> 重试
            </button>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}
