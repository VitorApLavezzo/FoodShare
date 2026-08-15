import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../lib/api';
import { AuthLayout } from '../components/layout/AuthLayout';
import { InputField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome ou razão social.'),
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  role: z.enum(['DONOR', 'NGO']),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  { value: 'DONOR', title: 'Doador', desc: 'Restaurante, mercado ou padaria', icon: '🍽️' },
  { value: 'NGO', title: 'ONG', desc: 'Instituição receptora', icon: '🤲' },
] as const;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'DONOR' } });

  const role = watch('role');

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await registerUser(values);
      navigate('/dashboard');
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível criar a conta.'));
    }
  };

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Cadastre seu estabelecimento ou sua ONG na plataforma."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tipo de conta
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${
                  role === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                    : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700'
                }`}
              >
                <input type="radio" value={opt.value} className="sr-only" {...register('role')} />
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">{opt.title}</span>
                <span className="text-xs text-neutral-500">{opt.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <InputField
          id="name"
          label="Nome / razão social"
          placeholder="Ex: Restaurante Sabor Caseiro"
          error={errors.name?.message}
          {...register('name')}
        />

        <InputField
          id="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <InputField
          id="password"
          type="password"
          label="Senha"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400"
          >
            {serverError}
          </p>
        )}

        <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
