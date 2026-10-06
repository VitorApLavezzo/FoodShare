import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Sem isso, qualquer erro de render derrubava a árvore inteira e o usuário
 * ficava com a tela em branco, sem nem saber que algo falhou.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-6 text-center">
          <h1 className="font-display text-[22px] font-semibold text-leaf-800">Algo deu errado</h1>
          <p className="mt-2 text-sm text-ink-muted">
            A tela não pôde ser exibida. Tente recarregar — se continuar, a mensagem técnica está no console.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-leaf-800 px-5 py-2.5 text-sm font-bold text-canvas shadow-[0_2px_0_var(--color-leaf-900)] transition hover:bg-leaf-600"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
