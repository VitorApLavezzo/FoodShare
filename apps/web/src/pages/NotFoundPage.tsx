import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/layout/Logo';
import { ButtonLink } from '../components/ui/Button';

/** Antes, qualquer endereço desconhecido mostrava uma tela em branco. */
export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <Logo className="h-8 w-auto" />
      <div>
        <p className="font-display text-[64px] leading-none font-semibold text-sun-500">404</p>
        <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold text-leaf-800">
          Essa página não existe
        </h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-muted">
          O link pode estar quebrado ou a página mudou de lugar.
        </p>
      </div>
      <ButtonLink to={user ? '/dashboard' : '/'} size="lg">
        {user ? 'Voltar ao painel' : 'Ir para o início'}
      </ButtonLink>
    </div>
  );
}
