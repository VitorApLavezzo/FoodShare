import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../lib/api';
import { updateProfile, changePassword, downloadMyData, deleteMyAccount } from '../lib/account';
import { fetchMyOrganization } from '../lib/organizations';
import { AppHeader } from '../components/layout/AppHeader';
import { InputField } from '../components/ui/Field';
import { PasswordField } from '../components/ui/PasswordField';
import { Button } from '../components/ui/Button';
import { OrganizationForm } from '../components/OrganizationForm';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  DONOR: 'Doador',
  NGO: 'ONG',
};

const profileSchema = z.object({
  name: z.string().min(2, 'Informe seu nome ou razão social.'),
});
type ProfileValues = z.infer<typeof profileSchema>;

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z
      .string()
      .min(8, 'A nova senha deve ter ao menos 8 caracteres.')
      .regex(
        STRONG_PASSWORD_REGEX,
        'A nova senha deve ter 1 letra maiúscula, 1 número e 1 caractere especial.',
      ),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  if (!user) return null;

  const onSubmit = async (values: ProfileValues) => {
    setServerError(null);
    try {
      const updated = await updateProfile(values.name);
      setUser(updated);
      showToast('Perfil atualizado.', 'success');
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível atualizar o perfil.'));
    }
  };

  return (
    <SectionCard title="Perfil" description="Seu nome e informações básicas de acesso.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <InputField label="Nome" error={errors.name?.message} {...register('name')} />
        <InputField
          label="E-mail"
          value={user.email}
          disabled
          hint="O e-mail de login não pode ser alterado."
        />
        <InputField label="Papel" value={ROLE_LABEL[user.role] ?? user.role} disabled />
        {serverError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="self-start" loading={isSubmitting} disabled={!isDirty}>
          Salvar alterações
        </Button>
      </form>
    </SectionCard>
  );
}

function PasswordSection() {
  const { showToast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const newPassword = watch('newPassword') ?? '';

  const onSubmit = async (values: PasswordValues) => {
    setServerError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      reset();
      showToast('Senha alterada com sucesso.', 'success');
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível trocar a senha.'));
    }
  };

  return (
    <SectionCard title="Senha" description="Vale trocar de tempos em tempos.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            showStrength
            value={newPassword}
            {...register('newPassword')}
          />
          <PasswordField
            label="Confirmar nova senha"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>
        {serverError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="self-start" loading={isSubmitting}>
          Trocar senha
        </Button>
      </form>
    </SectionCard>
  );
}

function OrganizationSection({ kind }: { kind: 'DONOR' | 'NGO' }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const organizationQuery = useQuery({
    queryKey: ['my-organization', kind],
    queryFn: () => fetchMyOrganization(kind),
  });

  if (organizationQuery.isLoading) {
    return <p className="text-sm text-ink-muted">Carregando dados da organização…</p>;
  }
  if (!organizationQuery.data) return null;

  return (
    <SectionCard
      title={kind === 'NGO' ? 'Dados da ONG' : 'Dados do estabelecimento'}
      description={
        kind === 'NGO'
          ? 'É isso que os doadores veem quando você reserva uma doação.'
          : 'É isso que as ONGs veem quando olham suas doações.'
      }
    >
      <OrganizationForm
        kind={kind}
        organization={organizationQuery.data}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['my-organization', kind] });
          showToast('Dados da organização atualizados.', 'success');
        }}
      />
    </SectionCard>
  );
}

/**
 * Direitos do titular (LGPD): obter os próprios dados e excluir a conta. Antes
 * não havia caminho nenhum para nenhum dos dois.
 */
function PrivacySection() {
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      await downloadMyData();
      showToast('Seus dados foram baixados.', 'success');
    } catch {
      showToast('Não foi possível exportar agora.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    // Dupla confirmação: é irreversível e derruba a sessão.
    if (!window.confirm('Excluir sua conta? Seus dados pessoais serão removidos e esta ação é irreversível.'))
      return;
    if (!window.confirm('Confirma mesmo? Você perderá o acesso imediatamente.')) return;

    setBusy(true);
    try {
      await deleteMyAccount();
      await logout();
      window.location.href = '/';
    } catch {
      showToast('Não foi possível excluir a conta agora.', 'error');
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Privacidade"
      description="Baixe uma cópia dos seus dados ou encerre sua conta na plataforma."
    >
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" loading={busy} onClick={handleExport}>
          Baixar meus dados
        </Button>
        <Button variant="danger" disabled={busy} onClick={handleDelete}>
          Excluir minha conta
        </Button>
      </div>
      <p className="mt-3.5 text-xs leading-relaxed text-ink-muted">
        O histórico de doações já concluídas é mantido de forma anônima, por ser registro também da outra
        organização envolvida.
      </p>
    </SectionCard>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 pt-10 pb-20">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">
            Minha conta
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Seu perfil, sua senha e os dados do seu estabelecimento, tudo num lugar só.
          </p>
        </div>

        <ProfileSection />
        <PasswordSection />
        {(user.role === 'DONOR' || user.role === 'NGO') && <OrganizationSection kind={user.role} />}
        <PrivacySection />
      </div>
    </div>
  );
}
