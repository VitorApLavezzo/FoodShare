import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/account';
import { getApiErrorMessage } from '../lib/api';
import { AuthLayout } from '../components/layout/AuthLayout';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
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
      })
      .catch((error) => {
        setStatus('erro');
        setMessage(getApiErrorMessage(error, 'Não foi possível confirmar o e-mail.'));
      });
  }, [token]);

  return (
    <AuthLayout
      title="Confirmação de e-mail"
      subtitle="Confirmar o e-mail garante que você receba os alertas de doação."
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Ir para o login
        </Link>
      }
    >
      {status === 'verificando' && <p className="text-sm text-neutral-500">Confirmando…</p>}
      {status === 'ok' && (
        <p className="rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          {message}
        </p>
      )}
      {status === 'erro' && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {message}
        </p>
      )}
    </AuthLayout>
  );
}
