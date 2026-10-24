import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../lib/api';
import { getPostLoginPath } from '../lib/redirect';
import { AuthLayout } from '../components/layout/AuthLayout';
import { InputField } from '../components/ui/Field';
import { PasswordField } from '../components/ui/PasswordField';
import { Button } from '../components/ui/Button';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getPostLoginPath(location.state);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível entrar.'));
    }
  };

  // Quem já está logado e cai aqui (favorito, botão voltar) segue direto.
  if (user && !isSubmitting) return <Navigate to={redirectTo} replace />;

  return (
    <AuthLayout
      title="Que bom te ver de novo!"
      subtitle="Entre pra acompanhar suas doações ou reservas."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/register" className="font-bold text-sun-600 hover:underline">
            Cadastre-se, é de graça
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <InputField
          id="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          error={errors.email?.message}
          icon={
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2-.5a.5.5 0 00-.5.5v.379l7.5 4.615 7.5-4.615V5a.5.5 0 00-.5-.5H5zm12.5 2.245-7.257 4.464a.5.5 0 01-.486 0L4.5 6.745V15a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V6.745z" />
            </svg>
          }
          {...register('email')}
        />

        <PasswordField
          id="password"
          label="Senha"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          icon={
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
          }
          {...register('password')}
        />

        <Link
          to="/esqueci-senha"
          className="-mt-1 self-end text-sm font-semibold text-leaf-600 hover:underline"
        >
          Esqueci minha senha
        </Link>

        {serverError && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
