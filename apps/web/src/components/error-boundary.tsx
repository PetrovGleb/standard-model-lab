/* ErrorBoundary: catches a crash while rendering a view, shows the error instead of a blank page and lets the user go back. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { say } from '../language';

interface Props {
  readonly children: ReactNode;
  readonly onReset?: () => void;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }
    return (
      <section className="card">
        <h3 className="error">
          {say('Не удалось показать эту страницу', 'This page could not be shown')}
        </h3>
        <p className="muted">
          {say(
            'Ошибка интерфейса. Данные эксперимента не потеряны.',
            'Interface error. The experiment data is not lost.',
          )}
        </p>
        <pre>{this.state.error.message}</pre>
        <div className="actions">
          <button
            type="button"
            className="primary"
            data-tooltip={say('Вернуться назад и попробовать снова', 'Go back and try again')}
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            {say('Вернуться', 'Go back')}
          </button>
        </div>
      </section>
    );
  }
}
