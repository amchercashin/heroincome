import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100vh] h-[100dvh] items-center justify-center bg-[var(--hi-void)] p-6">
          <div className="max-w-[300px] text-center">
            <div className="font-serif text-[32px] leading-tight text-[var(--hi-text)]">Что-то пошло не так</div>
            <p className="mt-2 text-[length:var(--hi-text-body)] leading-relaxed text-[var(--hi-text-2)]">
              Ваши данные в безопасности — они хранятся на устройстве. Попробуйте перезагрузить приложение.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 h-12 rounded-2xl bg-[var(--hi-gold)] px-6 text-[length:var(--hi-text-body)] font-semibold text-[#1a1509]"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
