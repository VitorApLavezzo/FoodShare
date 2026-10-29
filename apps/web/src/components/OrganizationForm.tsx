import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABEL,
  type OrganizationType,
} from '@foodshare/types';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createOrganization,
  updateOrganization,
  type CreateOrganizationInput,
  type Organization,
} from '../lib/organizations';
import { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fetchAddressByCep, formatCep, geocodeAddress } from '../lib/cep';
import { isValidCnpj, formatCnpj, fetchCnpjData } from '../lib/cnpj';
import { InputField, SelectField, TextareaField } from './ui/Field';
import { Button } from './ui/Button';

// Leaflet é pesado e só o formulário de endereço precisa dele aqui — carrega
// sob demanda, como o MapPage.
const LocationPicker = lazy(() =>
  import('./LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

const COORDINATE_REQUIRED =
  'Não foi possível localizar este endereço no mapa — revise rua, número e cidade.';

const schema = z.object({
  legalName: z.string().min(2, 'Informe a razão social.'),
  tradeName: z.string().min(2, 'Informe o nome fantasia.'),
  document: z
    .string()
    .min(1, 'Informe o CNPJ.')
    .refine(isValidCnpj, 'CNPJ inválido.'),
  type: z
    .enum(ORGANIZATION_TYPES as [OrganizationType, ...OrganizationType[]])
    .optional(),
  phone: z.string().min(8, 'Informe um telefone válido.'),
  email: z.string().email('Informe um e-mail válido.'),
  responsibleName: z.string().min(2, 'Informe o responsável.'),
  description: z.string().optional(),
  street: z.string().min(2, 'Informe a rua.'),
  number: z.string().optional(),
  neighborhood: z.string().min(2, 'Informe o bairro.'),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().min(2, 'Informe o estado (UF).'),
  zipCode: z.string().min(5, 'Informe o CEP.'),
  // Preenchidas pela geocodificação ou pelo pino do mapa, nunca digitadas: a
  // mensagem de tipo é o que o usuário vê quando o endereço não foi localizado.
  latitude: z.coerce
    .number({ invalid_type_error: COORDINATE_REQUIRED })
    .min(-90)
    .max(90),
  longitude: z.coerce
    .number({ invalid_type_error: COORDINATE_REQUIRED })
    .min(-180)
    .max(180),
});

type FormValues = z.infer<typeof schema>;

type LocationStatus =
  'idle' | 'locating' | 'precise' | 'approximate' | 'manual' | 'failed';

const LOCATION_HINT: Record<LocationStatus, string | undefined> = {
  idle: 'Calculada automaticamente a partir do endereço.',
  locating: 'Localizando o endereço no mapa…',
  precise:
    'Localização encontrada pelo endereço. Se o pino não estiver em cima do local, arraste-o.',
  approximate:
    'Ponto aproximado do CEP — preencha o número ou arraste o pino até o local.',
  manual: 'Ponto ajustado por você no mapa.',
  failed: undefined,
};

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
  const { user } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>(
    'idle',
  );
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    isEditing ? 'precise' : 'idle',
  );
  // Guarda o endereço já geocodificado: sair de cinco campos seguidos dispararia
  // cinco buscas iguais no Nominatim, que limita a uma por segundo.
  const lastGeocoded = useRef<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    getValues,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: organization
      ? {
          legalName: organization.legalName,
          tradeName: organization.tradeName,
          document: organization.document
            ? formatCnpj(organization.document)
            : undefined,
          type: organization.type ?? undefined,
          phone: organization.phone,
          email: organization.email,
          responsibleName: organization.responsibleName,
          description: organization.description ?? undefined,
          street: organization.address.street,
          number: organization.address.number,
          neighborhood: organization.address.neighborhood,
          city: organization.address.city,
          state: organization.address.state,
          zipCode: organization.address.zipCode
            ? formatCep(organization.address.zipCode)
            : undefined,
          latitude: organization.address.latitude,
          longitude: organization.address.longitude,
        }
      : // No cadastro, o e-mail de contato quase sempre é o da própria conta:
        // já vem preenchido, e dá para trocar se a organização usar outro.
        { email: user?.email ?? '' },
  });

  const [latitude, longitude] = useWatch({
    control,
    name: ['latitude', 'longitude'],
  });

  /**
   * Converte o endereço digitado em latitude/longitude. Junto com o pino do
   * mapa, é a única coisa que escreve nesses dois campos — por isso eles são
   * somente leitura: o ponto que decide o raio de alerta e a posição no mapa
   * tem de vir do endereço ou de quem apontou o local, não de um número colado
   * à mão.
   */
  const refreshCoordinates = useCallback(async () => {
    const { street, number, neighborhood, city, state, zipCode } = getValues();
    if (!street || !city || !state) return;

    const signature = [street, number, neighborhood, city, state]
      .join('|')
      .toLowerCase();
    if (signature === lastGeocoded.current) return;

    setLocationStatus('locating');
    const coordinates = await geocodeAddress({
      street,
      number,
      neighborhood,
      city,
      state,
      zipCode,
    });

    if (coordinates) {
      lastGeocoded.current = signature;
      setValue('latitude', coordinates.latitude, { shouldValidate: true });
      setValue('longitude', coordinates.longitude, { shouldValidate: true });
      clearErrors(['latitude', 'longitude']);
      setLocationStatus('precise');
      return;
    }

    // Sem resultado: se o CEP já tinha deixado um ponto aproximado, o cadastro
    // segue com ele em vez de travar por uma busca externa que não respondeu.
    const fallback = getValues('latitude');
    const hasFallback = typeof fallback === 'number' && !Number.isNaN(fallback);
    setLocationStatus(hasFallback ? 'approximate' : 'failed');
  }, [clearErrors, getValues, setValue]);

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
        setLocationStatus('approximate');
      }
      await refreshCoordinates();
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

    if (data.legalName && !getValues('legalName'))
      setValue('legalName', data.legalName, { shouldValidate: true });
    if (data.tradeName && !getValues('tradeName'))
      setValue('tradeName', data.tradeName, { shouldValidate: true });
    if (data.phone && !getValues('phone'))
      setValue('phone', data.phone, { shouldValidate: true });
    if (data.email && !getValues('email'))
      setValue('email', data.email, { shouldValidate: true });
    if (!data.address) return;

    const { street, number, neighborhood, city, state, zipCode } = data.address;
    if (street && !getValues('street'))
      setValue('street', street, { shouldValidate: true });
    if (number && !getValues('number')) setValue('number', number);
    if (neighborhood && !getValues('neighborhood'))
      setValue('neighborhood', neighborhood, { shouldValidate: true });
    if (city && !getValues('city'))
      setValue('city', city, { shouldValidate: true });
    if (state && !getValues('state'))
      setValue('state', state, { shouldValidate: true });
    // A Receita devolve o CEP só com dígitos ("13480000"). Gravar assim deixava
    // o campo fora do formato esperado e a busca por CEP nunca era disparada,
    // então o resto do endereço ficava sem completar.
    if (zipCode && !getValues('zipCode')) {
      const formatted = formatCep(zipCode);
      setValue('zipCode', formatted, { shouldValidate: true });

      const digitsOnly = zipCode.replace(/\D/g, '');
      if (digitsOnly.length === 8) {
        const fromCep = await fetchAddressByCep(digitsOnly);
        if (fromCep) {
          if (!getValues('street'))
            setValue('street', fromCep.street, { shouldValidate: true });
          if (!getValues('neighborhood'))
            setValue('neighborhood', fromCep.neighborhood, {
              shouldValidate: true,
            });
          if (!getValues('city'))
            setValue('city', fromCep.city, { shouldValidate: true });
          if (!getValues('state'))
            setValue('state', fromCep.state, { shouldValidate: true });
          if (
            fromCep.latitude !== undefined &&
            fromCep.longitude !== undefined
          ) {
            setValue('latitude', fromCep.latitude, { shouldValidate: true });
            setValue('longitude', fromCep.longitude, { shouldValidate: true });
            setLocationStatus('approximate');
          }
        }
      }
    }

    await refreshCoordinates();
  };

  const handlePinMove = useCallback(
    (coordinates: { latitude: number; longitude: number }) => {
      setValue('latitude', coordinates.latitude, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue('longitude', coordinates.longitude, {
        shouldValidate: true,
        shouldDirty: true,
      });
      clearErrors(['latitude', 'longitude']);
      setLocationStatus('manual');
    },
    [clearErrors, setValue],
  );

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const {
      street,
      number,
      neighborhood,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      ...rest
    } = values;
    const input: CreateOrganizationInput = {
      ...rest,
      address: {
        street,
        number,
        neighborhood,
        city,
        state,
        zipCode,
        latitude,
        longitude,
      },
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
      setServerError(
        getApiErrorMessage(error, 'Não foi possível salvar o cadastro.'),
      );
    }
  };

  /** Campo de endereço que, ao perder o foco, remarca o ponto no mapa. */
  const addressField = (
    name: 'street' | 'number' | 'neighborhood' | 'city' | 'state',
  ) => {
    const { onBlur, ...field } = register(name);
    return {
      ...field,
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        onBlur(event);
        void refreshCoordinates();
      },
    };
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-xs text-ink-muted">
        Campos marcados com <span className="font-semibold text-danger">*</span>{' '}
        são obrigatórios.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          required
          label="Razão social"
          error={errors.legalName?.message}
          {...register('legalName')}
        />
        <InputField
          required
          label="Nome fantasia"
          error={errors.tradeName?.message}
          {...register('tradeName')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(() => {
          const { onChange, onBlur, ...documentField } = register('document');
          return (
            <InputField
              required
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
        {kind === 'DONOR' && (
          <SelectField label="Tipo de estabelecimento" {...register('type')}>
            {Object.entries(ORGANIZATION_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          required
          label="Telefone"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <InputField
          required
          type="email"
          label="E-mail de contato"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <InputField
        required
        label="Responsável"
        error={errors.responsibleName?.message}
        {...register('responsibleName')}
      />

      <TextareaField
        label="Descrição (opcional)"
        rows={2}
        {...register('description')}
      />

      <fieldset className="rounded-[20px] border-[1.5px] border-line p-4">
        <legend className="px-1.5 text-sm font-semibold text-ink-body">
          Endereço
        </legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            {(() => {
              const { onChange, onBlur, ...zipCodeField } = register('zipCode');
              return (
                <InputField
                  required
                  label="CEP"
                  placeholder="00000-000"
                  maxLength={9}
                  inputMode="numeric"
                  error={errors.zipCode?.message}
                  hint={
                    cepStatus === 'loading'
                      ? 'Buscando endereço…'
                      : cepStatus === 'not-found'
                        ? undefined
                        : 'Preenche o resto automaticamente.'
                  }
                  onChange={(e) => {
                    e.target.value = formatCep(e.target.value);
                    onChange(e);
                  }}
                  onBlur={(e) => {
                    onBlur(e);
                    handleCepBlur(e);
                  }}
                  {...zipCodeField}
                />
              );
            })()}
            {cepStatus === 'not-found' && (
              <p className="mt-1.5 text-xs font-semibold text-sun-800">
                CEP não encontrado — preencha o endereço manualmente.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <InputField
              required
              label="Rua"
              error={errors.street?.message}
              {...addressField('street')}
            />
          </div>
          <InputField
            label="Número"
            hint="Deixa a localização no mapa mais precisa."
            {...addressField('number')}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <InputField
            required
            label="Bairro"
            error={errors.neighborhood?.message}
            {...addressField('neighborhood')}
          />
          <InputField
            required
            label="Cidade"
            error={errors.city?.message}
            {...addressField('city')}
          />
          <InputField
            required
            label="Estado (UF)"
            maxLength={2}
            error={errors.state?.message}
            {...addressField('state')}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-ink-body">
            Localização no mapa
          </p>
          <p className="mb-2 text-xs text-ink-muted">
            Arraste o pino ou clique no mapa para marcar a entrada exata. A
            visão de satélite ajuda a achar o prédio.
          </p>
          <Suspense
            fallback={
              <div className="flex h-[320px] items-center justify-center rounded-2xl border-[1.5px] border-line bg-sand-deep text-sm text-ink-muted">
                Carregando mapa…
              </div>
            }
          >
            <LocationPicker
              latitude={latitude === undefined ? undefined : Number(latitude)}
              longitude={
                longitude === undefined ? undefined : Number(longitude)
              }
              onChange={handlePinMove}
            />
          </Suspense>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <InputField
            type="number"
            step="any"
            readOnly
            label="Latitude"
            className="bg-sand-muted text-ink-muted"
            hint={LOCATION_HINT[locationStatus]}
            {...register('latitude')}
          />
          <InputField
            type="number"
            step="any"
            readOnly
            label="Longitude"
            className="bg-sand-muted text-ink-muted"
            {...register('longitude')}
          />
        </div>
        {(locationStatus === 'failed' ||
          errors.latitude ||
          errors.longitude) && (
          <p className="mt-1.5 text-xs font-semibold text-sun-800">
            {COORDINATE_REQUIRED}
          </p>
        )}
      </fieldset>

      {serverError && (
        <p
          role="alert"
          className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger"
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
