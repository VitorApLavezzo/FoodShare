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
        <div className="max-w-md rounded-xl border border-neutral-200 p-6 text-center dark:border-neutral-800">
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">Algo deu errado</h1>
          <p className="mt-2 text-sm text-neutral-500">
            A tela não pôde ser exibida. Tente recarregar — se continuar, a mensagem técnica está no console.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
