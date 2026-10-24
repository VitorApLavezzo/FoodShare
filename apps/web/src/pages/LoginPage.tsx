import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../lib/api';
import { getPostLoginPath } from '../lib/redirect';
import {
  forgetRememberedAccount,
  getRememberedAccount,
  type RememberedAccount,
} from '../lib/remembered-account';
import { AuthLayout } from '../components/layout/AuthLayout';
import { InputField } from '../components/ui/Field';
import { PasswordField } from '../components/ui/PasswordField';
import { Button } from '../components/ui/Button';
import { RoleBadge, type BadgeTone } from '../components/ui/Badge';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

const ROLE_LABEL: Record<RememberedAccount['role'], string> = {
  DONOR: 'Doador',
  NGO: 'ONG',
  ADMIN: 'Administrador',
};

// Mesma legenda de cor do resto do app: laranja publica, verde recebe.
const ROLE_TONE: Record<RememberedAccount['role'], BadgeTone> = { DONOR: 'sun', NGO: 'leaf', ADMIN: 'ink' };
const AVATAR_CLASS: Record<RememberedAccount['role'], string> = {
  DONOR: 'bg-sun-100 text-sun-800',
  NGO: 'bg-leaf-100 text-leaf-800',
  ADMIN: 'bg-leaf-800 text-canvas',
};

/**
 * Uma entrada só para os dois tipos de conta — o tipo já vem do cadastro, então
 * um seletor "Doador/ONG" aqui seria uma escolha que não muda nada (ou, pior,
 * um jeito novo de errar). O que faltava era deixar isso dito: o painel da
 * esquerda que explicava some no celular.
 */
function AccountTypesNote() {
  return (
    // "Mesmo acesso para doador e ONG" soava como "o mesmo e-mail serve para
    // os dois"; "contas de … ou de …" deixa claro que são contas separadas.
    // Numa linha só, inclusive no celular: "Doador" é o nome do tipo na tela de
    // cadastro, e "Estabelecimento doador" empurrava a etiqueta da ONG para baixo.
    <p className="flex flex-nowrap items-center gap-x-1.5 text-[12px] whitespace-nowrap text-ink-muted min-[380px]:text-[13px]">
      Para contas de
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-2.5 py-0.5 font-semibold text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-sun-500" aria-hidden />
        Doador
      </span>
      ou de
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-2.5 py-0.5 font-semibold text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-leaf-600" aria-hidden />
        ONG
      </span>
    </p>
  );
}

/** "Continuar como…": a conta que já entrou neste aparelho, com o tipo à vista. */
function RememberedAccountCard({ account }: { account: RememberedAccount }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border-2 border-line bg-canvas p-3.5">
      <span
        className={`font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${AVATAR_CLASS[account.role]}`}
        aria-hidden
      >
        {account.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-ink">
          {account.name}
          <RoleBadge tone={ROLE_TONE[account.role]}>{ROLE_LABEL[account.role]}</RoleBadge>
        </p>
        <p className="truncate text-sm text-ink-muted">{account.email}</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getPostLoginPath(location.state);
  const [serverError, setServerError] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(getRememberedAccount);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: remembered?.email ?? '' },
  });

  // "Não é você?" também serve para computador compartilhado (a sede da ONG,
  // o caixa do mercado): esquece a conta lembrada e volta ao formulário comum.
  const useAnotherAccount = () => {
    forgetRememberedAccount();
    setRemembered(null);
    setServerError(null);
    setValue('email', '');
    setTimeout(() => setFocus('email'), 0);
  };

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
      title={
        remembered ? `Que bom te ver de novo, ${remembered.name.split(' ')[0]}!` : 'Que bom te ver de novo!'
      }
      subtitle={remembered ? 'Digite sua senha para continuar.' : 'Entre com o e-mail do seu cadastro.'}
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
        {remembered ? (
          <>
            <RememberedAccountCard account={remembered} />
            {/* O e-mail continua no formulário (escondido) para o envio e para o
                gerenciador de senhas saber de qual conta é a senha. */}
            <input
              type="email"
              autoComplete="username"
              readOnly
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              {...register('email')}
            />
            <button
              type="button"
              onClick={useAnotherAccount}
              className="-mt-2 self-start rounded-sm text-sm font-semibold text-leaf-600 hover:underline"
            >
              Não é você? Entrar com outra conta
            </button>
          </>
        ) : (
          <>
            <AccountTypesNote />
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
          </>
        )}

        <PasswordField
          id="password"
          label="Senha"
          autoComplete="current-password"
          placeholder="••••••••"
          autoFocus={!!remembered}
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
