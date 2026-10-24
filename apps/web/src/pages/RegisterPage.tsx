import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../lib/api';
import { checkEmailAvailability } from '../lib/auth';
import { AuthLayout } from '../components/layout/AuthLayout';
import { InputField } from '../components/ui/Field';
import { PasswordField } from '../components/ui/PasswordField';
import { Button } from '../components/ui/Button';

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome ou razão social.'),
  email: z.string().email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .regex(STRONG_PASSWORD_REGEX, 'A senha deve ter 1 letra maiúscula, 1 número e 1 caractere especial.'),
  role: z.enum(['DONOR', 'NGO']),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  { value: 'DONOR', title: 'Doador', desc: 'Restaurante, mercado ou padaria', dot: 'bg-sun-500' },
  { value: 'NGO', title: 'ONG', desc: 'Instituição receptora', dot: 'bg-leaf-600' },
] as const;

export function RegisterPage() {
  const { user, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>(
    'idle',
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'DONOR' } });

  const role = watch('role');
  const password = watch('password') ?? '';
  const email = watch('email');

  useEffect(() => {
    const isValidFormat = z.string().email().safeParse(email).success;
    if (!isValidFormat) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        const available = await checkEmailAvailability(email);
        setEmailStatus(available ? 'available' : 'taken');
        if (!available) {
          setError('email', { message: 'Já existe uma conta com este e-mail.' });
        } else {
          clearErrors('email');
        }
      } catch {
        setEmailStatus('error');
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onSubmit = async (values: FormValues) => {
    if (emailStatus === 'taken') return;
    setServerError(null);
    try {
      await registerUser(values);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível criar a conta.'));
    }
  };

  // A confirmação vem em verde e em negrito porque é a única dica do formulário
  // que afirma algo em vez de instruir.
  const emailHint =
    emailStatus === 'checking' ? (
      'Verificando disponibilidade…'
    ) : emailStatus === 'available' ? (
      <span className="font-semibold text-leaf-600">✓ E-mail disponível.</span>
    ) : undefined;

  if (user && !isSubmitting) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout
      title="Bora começar?"
      subtitle="Cadastre seu estabelecimento ou sua ONG. É rapidinho."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-bold text-sun-600 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-ink-body">Tipo de conta</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col items-start gap-1 rounded-[20px] border-2 p-3.5 text-left transition focus-within:ring-4 focus-within:ring-leaf-600/20 ${
                  role === opt.value
                    ? 'border-leaf-600 bg-leaf-50'
                    : 'border-line bg-surface hover:border-line-bold'
                }`}
              >
                <input type="radio" value={opt.value} className="sr-only" {...register('role')} />
                <span className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} aria-hidden />
                <span className="mt-1 text-[15px] font-bold text-leaf-800">{opt.title}</span>
                <span className="text-xs text-ink-muted">{opt.desc}</span>
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
          hint={emailHint}
          {...register('email')}
        />

        <PasswordField
          id="password"
          label="Senha"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          error={errors.password?.message}
          showStrength
          value={password}
          {...register('password')}
        />

        {serverError && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
