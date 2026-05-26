import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // eslint-disable-next-line no-console
    console.error('UI error caught by boundary:', error, errorInfo);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="container-x py-16">
        <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-8">
          <div
            className="mb-2 font-mono text-[10px] uppercase text-[var(--danger)]"
            style={{ letterSpacing: '0.22em' }}
          >
            Ошибка рендера
          </div>
          <h2 className="display-h" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            ЧТО-ТО ПОШЛО НЕ ТАК
          </h2>
          <p className="mt-4 text-sm text-[var(--text-2)]">
            На странице упал один из компонентов. Это не должно было случиться — но мы поймали
            ошибку, чтобы остальной сайт остался рабочим.
          </p>
          <details className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase text-[var(--text-3)]">
              Стэк ошибки
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--text-2)]">
              {String(this.state.error?.message || this.state.error)}
              {this.state.error?.stack ? '\n\n' + this.state.error.stack : ''}
            </pre>
          </details>
          <button onClick={this.handleReset} className="btn btn-primary mt-6">
            Попробовать снова
          </button>
        </div>
      </section>
    );
  }
}

export default ErrorBoundary;
