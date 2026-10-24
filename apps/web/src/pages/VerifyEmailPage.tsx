import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/account';
import { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { user, reloadUser } = useAuth();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verificando' | 'ok' | 'erro'>('verificando');
  const [message, setMessage] = useState('');
  // O token é de uso único: em StrictMode o efeito roda duas vezes e a segunda
  // chamada falharia, mostrando erro para uma verificação que deu certo.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('erro');
      setMessage('Link inválido: falta o código de verificação.');
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    verifyEmail(token)
      .then((response) => {
        setStatus('ok');
        setMessage(response.message);
        // Atualiza a sessão aberta: sem isso a tela da conta continuava pedindo
        // para confirmar um e-mail que acabou de ser confirmado.
        void reloadUser();
      })
      .catch((error) => {
        setStatus('erro');
        setMessage(getApiErrorMessage(error, 'Não foi possível confirmar o e-mail.'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout
      title={status === 'ok' ? 'E-mail confirmado!' : 'Confirmação de e-mail'}
      subtitle="Com o e-mail confirmado, os alertas de doação chegam certinho pra você."
      footer={
        // Quem confirma pelo link costuma já estar logado no mesmo navegador.
        <Link to={user ? '/dashboard' : '/login'} className="font-bold text-sun-600 hover:underline">
          {user ? 'Ir para o painel' : 'Ir para o login'}
        </Link>
      }
    >
      {status === 'verificando' && <p className="text-sm text-ink-muted">Confirmando…</p>}
      {status === 'ok' && (
        <p className="rounded-2xl bg-leaf-100 px-4 py-3.5 text-sm leading-relaxed text-leaf-800">{message}</p>
      )}
      {status === 'erro' && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
          {message}
        </p>
      )}
    </AuthLayout>
  );
}
