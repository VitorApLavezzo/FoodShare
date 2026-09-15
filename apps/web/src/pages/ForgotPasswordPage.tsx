import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestPasswordReset } from '../lib/account';
import { getApiErrorMessage } from '../lib/api';
import { AuthLayout } from '../components/layout/AuthLayout';
import { InputField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';

const schema = z.object({ email: z.string().email('Informe um e-mail válido.') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível enviar o e-mail agora.'));
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviamos um link para você escolher uma nova senha."
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        // Mensagem propositalmente neutra: confirmar se o e-mail existe
        // revelaria quem tem conta na plataforma.
        <p className="rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          Se existir uma conta com esse e-mail, o link de redefinição já está a caminho. Ele vale por 30 minutos.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <InputField
            type="email"
            label="E-mail da conta"
            error={errors.email?.message}
            {...register('email')}
          />
          {serverError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
              {serverError}
            </p>
          )}
          <Button type="submit" loading={isSubmitting}>
            Enviar link de recuperação
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
