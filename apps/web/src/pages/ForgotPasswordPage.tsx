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
      title="Esqueceu a senha?"
      subtitle="Sem problema. A gente manda um link pra você escolher uma nova."
      footer={
        <Link to="/login" className="font-bold text-sun-600 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        // Mensagem propositalmente neutra: confirmar se o e-mail existe
        // revelaria quem tem conta na plataforma.
        <p className="rounded-2xl bg-leaf-100 px-4 py-3.5 text-sm leading-relaxed text-leaf-800">
          Se existir uma conta com esse e-mail, o link de redefinição já está a caminho. Ele vale por 30
          minutos.
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
            <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
              {serverError}
            </p>
          )}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Enviar link de recuperação
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
