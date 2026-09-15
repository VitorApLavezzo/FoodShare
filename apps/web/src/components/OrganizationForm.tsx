import { useState, type FocusEvent } from 'react';
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABEL,
  type OrganizationType,
} from '@foodshare/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createOrganization,
  updateOrganization,
  type CreateOrganizationInput,
  type Organization,
} from '../lib/organizations';
import { getApiErrorMessage } from '../lib/api';
import { fetchAddressByCep, geocodeAddress } from '../lib/cep';
import { isValidCnpj, formatCnpj, fetchCnpjData } from '../lib/cnpj';
import { InputField, SelectField, TextareaField } from './ui/Field';
import { Button } from './ui/Button';

const schema = z.object({
  legalName: z.string().min(2, 'Informe a razão social.'),
  tradeName: z.string().min(2, 'Informe o nome fantasia.'),
  document: z.string().min(1, 'Informe o CNPJ.').refine(isValidCnpj, 'CNPJ inválido.'),
  type: z.enum(ORGANIZATION_TYPES as [OrganizationType, ...OrganizationType[]]).optional(),
  phone: z.string().min(8, 'Informe um telefone válido.'),
  email: z.string().email('Informe um e-mail válido.'),
  responsibleName: z.string().min(2, 'Informe o responsável.'),
  description: z.string().optional(),
  estimatedCapacity: z.coerce.number().int().min(0).optional(),
  notificationRadiusKm: z.coerce.number().int().min(1).optional(),
  street: z.string().min(2, 'Informe a rua.'),
  number: z.string().optional(),
  neighborhood: z.string().min(2, 'Informe o bairro.'),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().min(2, 'Informe o estado (UF).'),
  zipCode: z.string().min(5, 'Informe o CEP.'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

type FormValues = z.infer<typeof schema>;

export function OrganizationForm({
  kind,
  organization,
  onCreated,
  onSaved,
}: {
  kind: 'DONOR' | 'NGO';
  organization?: Organization;
  onCreated?: (organization: Organization) => void;
  onSaved?: (organization: Organization) => void;
}) {
  const isEditing = !!organization;
  const [serverError, setServerError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>('idle');
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: organization
      ? {
          legalName: organization.legalName,
          tradeName: organization.tradeName,
          document: organization.document ? formatCnpj(organization.document) : undefined,
          type: organization.type ?? undefined,
          phone: organization.phone,
          email: organization.email,
          responsibleName: organization.responsibleName,
          description: organization.description ?? undefined,
          estimatedCapacity: organization.estimatedCapacity ?? undefined,
          notificationRadiusKm: organization.notificationRadiusKm ?? undefined,
          street: organization.address.street,
          number: organization.address.number,
          neighborhood: organization.address.neighborhood,
          city: organization.address.city,
          state: organization.address.state,
          zipCode: organization.address.zipCode,
          latitude: organization.address.latitude,
          longitude: organization.address.longitude,
        }
      : undefined,
  });

  const handleCepBlur = async (event: FocusEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    if (digits.length !== 8) return;

    setCepStatus('loading');
    try {
      const address = await fetchAddressByCep(digits);
      if (!address) {
        setCepStatus('not-found');
        return;
      }
      setCepStatus('idle');
      setValue('street', address.street, { shouldValidate: true });
      setValue('neighborhood', address.neighborhood, { shouldValidate: true });
      setValue('city', address.city, { shouldValidate: true });
      setValue('state', address.state, { shouldValidate: true });
      if (address.latitude !== undefined && address.longitude !== undefined) {
        setValue('latitude', address.latitude, { shouldValidate: true });
        setValue('longitude', address.longitude, { shouldValidate: true });
      }
      setFocus('number');
    } catch {
      setCepStatus('not-found');
    }
  };

  const handleDocumentBlur = async (event: FocusEvent<HTMLInputElement>) => {
    if (isEditing) return;
    const digits = event.target.value.replace(/\D/g, '');
    if (!isValidCnpj(digits)) return;

    const data = await fetchCnpjData(digits);
    if (!data) return;

    if (data.legalName && !getValues('legalName')) setValue('legalName', data.legalName, { shouldValidate: true });
    if (data.tradeName && !getValues('tradeName')) setValue('tradeName', data.tradeName, { shouldValidate: true });
    if (data.phone && !getValues('phone')) setValue('phone', data.phone, { shouldValidate: true });
    if (data.email && !getValues('email')) setValue('email', data.email, { shouldValidate: true });
    if (data.address) {
      if (data.address.street && !getValues('street')) setValue('street', data.address.street, { shouldValidate: true });
      if (data.address.number && !getValues('number')) setValue('number', data.address.number);
      if (data.address.neighborhood && !getValues('neighborhood'))
        setValue('neighborhood', data.address.neighborhood, { shouldValidate: true });
      if (data.address.city && !getValues('city')) setValue('city', data.address.city, { shouldValidate: true });
      if (data.address.state && !getValues('state')) setValue('state', data.address.state, { shouldValidate: true });
      if (data.address.zipCode && !getValues('zipCode')) setValue('zipCode', data.address.zipCode, { shouldValidate: true });
    }
  };

  const handleNumberBlur = async (event: FocusEvent<HTMLInputElement>) => {
    const number = event.target.value.trim();
    if (!number) return;
    const { street, city, state } = getValues();
    const coordinates = await geocodeAddress(street, number, city, state);
    if (coordinates) {
      setValue('latitude', coordinates.latitude, { shouldValidate: true });
      setValue('longitude', coordinates.longitude, { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const { street, number, neighborhood, city, state, zipCode, latitude, longitude, ...rest } = values;
    const input: CreateOrganizationInput = {
      ...rest,
      address: { street, number, neighborhood, city, state, zipCode, latitude, longitude },
    };
    try {
      if (isEditing) {
        const updated = await updateOrganization(kind, organization.id, input);
        onSaved?.(updated);
      } else {
        const created = await createOrganization(kind, input);
        onCreated?.(created);
      }
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível salvar o cadastro.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Razão social" error={errors.legalName?.message} {...register('legalName')} />
        <InputField label="Nome fantasia" error={errors.tradeName?.message} {...register('tradeName')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(() => {
          const { onChange, onBlur, ...documentField } = register('document');
          return (
            <InputField
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              error={errors.document?.message}
              hint="Ao sair do campo, tentamos preencher os dados automaticamente."
              onChange={(e) => {
                e.target.value = formatCnpj(e.target.value);
                onChange(e);
              }}
              onBlur={(e) => {
                onBlur(e);
                handleDocumentBlur(e);
              }}
              {...documentField}
            />
          );
        })()}
        {kind === 'DONOR' ? (
          <SelectField label="Tipo de estabelecimento" {...register('type')}>
            {Object.entries(ORGANIZATION_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        ) : (
          <InputField
            type="number"
            min={0}
            label="Capacidade estimada de atendimento"
            {...register('estimatedCapacity')}
          />
        )}
      </div>

      {kind === 'NGO' && (
        <InputField
          type="number"
          min={1}
          label="Raio de notificação (km)"
          hint="Você será alertada quando um doador publicar alimentos dentro dessa distância. Padrão: 50km."
          error={errors.notificationRadiusKm?.message}
          {...register('notificationRadiusKm')}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Telefone" error={errors.phone?.message} {...register('phone')} />
        <InputField
          type="email"
          label="E-mail de contato"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <InputField label="Responsável" error={errors.responsibleName?.message} {...register('responsibleName')} />

      <TextareaField label="Descrição (opcional)" rows={2} {...register('description')} />

      <fieldset className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Endereço</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            {(() => {
              const { onBlur, ...zipCodeField } = register('zipCode');
              return (
                <InputField
                  label="CEP"
                  placeholder="00000-000"
                  maxLength={9}
                  error={errors.zipCode?.message}
                  hint={
                    cepStatus === 'loading'
                      ? 'Buscando endereço…'
                      : cepStatus === 'not-found'
                        ? undefined
                        : 'Preenche o resto automaticamente.'
                  }
                  onBlur={(e) => {
                    onBlur(e);
                    handleCepBlur(e);
                  }}
                  {...zipCodeField}
                />
              );
            })()}
            {cepStatus === 'not-found' && (
              <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                CEP não encontrado — preencha o endereço manualmente.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <InputField label="Rua" error={errors.street?.message} {...register('street')} />
          </div>
          {(() => {
            const { onBlur, ...numberField } = register('number');
            return (
              <InputField
                label="Número"
                onBlur={(e) => {
                  onBlur(e);
                  handleNumberBlur(e);
                }}
                {...numberField}
              />
            );
          })()}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <InputField label="Bairro" error={errors.neighborhood?.message} {...register('neighborhood')} />
          <InputField label="Cidade" error={errors.city?.message} {...register('city')} />
          <InputField label="Estado (UF)" maxLength={2} error={errors.state?.message} {...register('state')} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <InputField
            type="number"
            step="any"
            label="Latitude"
            hint="Ex: -22.5647 (use o Google Maps para localizar)."
            error={errors.latitude?.message}
            {...register('latitude')}
          />
          <InputField
            type="number"
            step="any"
            label="Longitude"
            error={errors.longitude?.message}
            {...register('longitude')}
          />
        </div>
      </fieldset>

      {serverError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400"
        >
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} className="self-start">
        {isEditing ? 'Salvar alterações' : 'Salvar cadastro'}
      </Button>
    </form>
  );
}
