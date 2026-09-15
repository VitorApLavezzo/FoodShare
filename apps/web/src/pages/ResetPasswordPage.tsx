import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from '../lib/account';
import { getApiErrorMessage } from '../lib/api';
import { AuthLayout } from '../components/layout/AuthLayout';
import { PasswordField } from '../components/ui/PasswordField';
import { Button } from '../components/ui/Button';

// Mesma exigência do cadastro, validada já no cliente para o usuário não
// descobrir a regra só depois de enviar.
const schema = z
  .object({
    password: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres.')
      .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, 'Use ao menos 1 maiúscula, 1 número e 1 símbolo.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await resetPassword(token, values.password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível redefinir a senha.'));
    }
  };

  return (
    <AuthLayout
      title="Nova senha"
      subtitle="Escolha uma senha para voltar a acessar sua conta."
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Voltar para o login
        </Link>
      }
    >
      {!token ? (
        <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          Link inválido: falta o código de verificação. Solicite a recuperação novamente.
        </p>
      ) : done ? (
        <p className="rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          Senha redefinida! Redirecionando para o login…
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <PasswordField label="Nova senha" error={errors.password?.message} {...register('password')} />
          <PasswordField
            label="Confirme a nova senha"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {serverError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
              {serverError}
            </p>
          )}
          <Button type="submit" loading={isSubmitting}>
            Redefinir senha
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
